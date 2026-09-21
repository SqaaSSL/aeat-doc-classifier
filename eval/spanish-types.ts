import { createHash } from 'node:crypto';
import { classifyPage, type Classification } from '../src/classify.js';
import { classifyPageWithContext, type ContextualPageResult, type TextPage } from '../src/context.js';
import { JevError } from '../src/jev.js';
import type { Backend, DecisionResponse } from '../src/types.js';
import { scoreRow, summarize, type PublicCase, type PublicRow } from './public-types.js';

export const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const modes = ['native', 'ocr', 'context'] as const;
export type Mode = typeof modes[number];
export interface JudgedCase extends PublicCase {
  sourceId: string;
  split: 'calibration' | 'validation-reserved';
  visualSha256: string;
}
export interface Judgments {
  schemaVersion: 1; frozenAt: string; acquisitionSha256: string;
  reviewer: string; protocol: string; cases: JudgedCase[];
}
export interface Inputs {
  schemaVersion: 1; frozenAt: string; acquisitionSha256: string;
  parser: string; language: string; normalization: string;
  sources: Array<{ id: string; sourceSha256: string; extractionMs: number;
    pages: Array<{ page: number; sha256: string; bytes: number }> }>;
}
export interface Outcome { elapsedMs: number; result?: Classification; error?: string }
export interface SpanishRow {
  sourceId: string; page: number; native: Outcome; ocr: Outcome; context: Outcome;
  contextAudit?: ContextualPageResult['context'];
}
export interface Call {
  sourceId: string; page: number; stage: Mode; startedAt: string; elapsedMs: number;
  requestSha256: string; model?: string; usage?: DecisionResponse['usage']; error?: string;
}
export const safeError = (error: unknown) => error instanceof JevError ? error.message : 'Classification failed; no result accepted.';
export async function outcome(work: () => Promise<Classification>): Promise<Outcome> {
  const start = performance.now();
  try { return { result: await work(), elapsedMs: Math.round(performance.now() - start) }; }
  catch (error) { return { error: safeError(error), elapsedMs: Math.round(performance.now() - start) }; }
}

/** Pair the exact same isolated decision with a context retry; never re-query a failed baseline. */
export async function pairedOcr(pages: TextPage[], page: number, baselineBackend: Backend, contextBackend: Backend) {
  let cached: DecisionResponse | undefined;
  const ocr = await outcome(() => classifyPage(pages.find(p => p.page === page)!.text, {
    backend: { async ask(state, questions) { cached = await baselineBackend.ask(state, questions); return cached; } },
  }));
  if (!ocr.result) return { ocr, context: { ...ocr } };
  let contextual: ContextualPageResult | undefined;
  let replayed = false;
  const context = await outcome(async () => {
    contextual = await classifyPageWithContext(pages, page, { backend: { async ask(state, questions) {
      if (!replayed) {
        replayed = true;
        if (!cached) throw new Error('Missing isolated reply.');
        return cached;
      }
      return contextBackend.ask(state, questions);
    } } });
    return contextual.result;
  });
  context.elapsedMs += ocr.elapsedMs;
  return { ocr, context, ...(contextual ? { contextAudit: contextual.context } : {}) };
}

export function rowsFor(rows: SpanishRow[], judgments: Judgments, inputs: Inputs, mode: Mode): PublicRow[] {
  const expected = new Map(judgments.cases.map(c => [`${c.sourceId}/${c.page}`, c]));
  return rows.map(row => {
    const c = expected.get(`${row.sourceId}/${row.page}`);
    if (!c) throw new Error('Unexpected benchmark target.');
    const input = inputs.sources.find(s => s.id === row.sourceId)?.pages.find(p => p.page === row.page);
    if (!input) throw new Error('Missing OCR fingerprint.');
    return { ...c, inputSha256: mode === 'native' ? c.inputSha256 : input.sha256,
      inputBytes: mode === 'native' ? c.inputBytes : input.bytes, ...row[mode] };
  });
}

export function metrics(rows: PublicRow[]) {
  // A result's audit contains only its final reply; use the call ledger for complete usage.
  const { modelCalls: _m, medianModelCallMs: _t, inputTokens: _i, outputTokens: _o, ...counts } = summarize(rows);
  const eligible = rows.filter(r => !r.reviewRequired);
  const aeat = rows.filter(r => r.group === 'aeat');
  const sourceGroups = [...new Set(aeat.map(r => r.sourceId))].map(id => aeat.filter(r => r.sourceId === id));
  return { ...counts, routingEligible: eligible.length, correctEligibleAccepted: eligible.filter(r => scoreRow(r).correctAccepted).length,
    aeatAccepted: aeat.filter(r => scoreRow(r).correctAccepted).length,
    sourceMacroAeatRecognition: sourceGroups.length ? sourceGroups.reduce((sum, group) => sum + group.filter(r => {
      const s = scoreRow(r); return s.formCorrect && s.kindCorrect;
    }).length / group.length, 0) / sourceGroups.length : null };
}

export function summary(rows: SpanishRow[], judgments: Judgments, inputs: Inputs) {
  return Object.fromEntries(['all', 'calibration', 'validation-reserved'].map(split => {
    const selected = new Set(judgments.cases.filter(c => split === 'all' || c.split === split).map(c => `${c.sourceId}/${c.page}`));
    const subset = rows.filter(r => selected.has(`${r.sourceId}/${r.page}`));
    return [split, Object.fromEntries(modes.map(mode => [mode, metrics(rowsFor(subset, judgments, inputs, mode))]))];
  }));
}

export function verifyRun(rows: SpanishRow[], judgments: Judgments, inputs: Inputs) {
  if (rows.length !== judgments.cases.length) throw new Error('Incomplete benchmark run.');
  for (const [i, row] of rows.entries()) {
    const c = judgments.cases[i]!;
    if (row.sourceId !== c.sourceId || row.page !== c.page) throw new Error('Changed or duplicate target.');
    for (const mode of modes) {
      const o = row[mode];
      if (!o || Boolean(o.result) === Boolean(o.error) || !Number.isFinite(o.elapsedMs) || o.elapsedMs < 0) throw new Error('Missing or ambiguous outcome.');
      const input = mode === 'native' ? c.inputSha256 : inputs.sources.find(s => s.id === row.sourceId)?.pages.find(p => p.page === row.page)?.sha256;
      if (o.result && o.result.audit.inputSha256 !== input) throw new Error('Outcome input fingerprint mismatch.');
    }
  }
}
