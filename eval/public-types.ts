import type { Classification } from '../src/classify.js';

export interface PublicCase {
  page: number;
  inputSha256: string;
  inputBytes: number;
  group: 'aeat' | 'scope_control' | 'extraction';
  expected: { kind: string | null; jurisdiction: string | null; form: string | null };
  reviewRequired: boolean;
  expectedStatus?: 'needs_ocr';
  note: string;
}

export interface PublicSource {
  id: string;
  title: string;
  url: string;
  sha256: string;
  bytes: number;
  pageCount: number;
  cases: PublicCase[];
}

export interface PublicManifest {
  version: string;
  frozenAt: string;
  annotation: string;
  selection: string;
  sources: PublicSource[];
  exclusions: { url: string; reason: string }[];
}

export interface PublicRow extends PublicCase {
  sourceId: string;
  elapsedMs: number;
  result?: Classification;
  error?: string;
}

export function scoreRow(row: PublicRow) {
  const result = row.result;
  const candidates = result?.candidates;
  const recognitionEligible = row.group !== 'extraction';
  const formCorrect = recognitionEligible && !!candidates && candidates.form.value === (row.expected.form ?? 'none');
  const kindCorrect = recognitionEligible && !!candidates && candidates.kind.value === row.expected.kind;
  const jurisdictionCorrect = recognitionEligible && !!candidates && candidates.jurisdiction.value === row.expected.jurisdiction;
  const identityCorrect = formCorrect && kindCorrect && jurisdictionCorrect;
  const accepted = result?.status === 'accepted';
  // Score the actual routing output, not just its ungated candidates.
  const correctAccepted = accepted && !row.reviewRequired && result.kind === row.expected.kind
    && result.jurisdiction === row.expected.jurisdiction && result.form === row.expected.form;
  const reviewCorrect = row.reviewRequired && !!result && (row.expectedStatus
    ? result.status === row.expectedStatus
    : result.status === 'needs_review' || result.status === 'needs_ocr');
  return { recognitionEligible, formCorrect, kindCorrect, jurisdictionCorrect, identityCorrect,
    accepted, correctAccepted, wrongAccepted: accepted && !correctAccepted, reviewCorrect };
}

export function summarize(rows: PublicRow[]) {
  const scored = rows.map(row => ({ row, score: scoreRow(row) }));
  const count = (fn: (entry: typeof scored[number]) => boolean) => scored.filter(fn).length;
  const accepted = count(x => x.score.accepted);
  const correctAccepted = count(x => x.score.correctAccepted);
  const aeatPages = count(x => x.row.group === 'aeat');
  const recognitionPages = count(x => x.score.recognitionEligible);
  const reviewRequired = count(x => x.row.reviewRequired);
  const modelCalls = rows.filter(r => r.result?.audit.model);
  const times = modelCalls.map(r => r.elapsedMs).sort((a, b) => a - b);
  const median = times.length ? (times[Math.floor((times.length - 1) / 2)]! + times[Math.floor(times.length / 2)]!) / 2 : null;
  return {
    pages: rows.length, documents: new Set(rows.map(r => r.sourceId)).size,
    aeatPages, recognitionPages, extractionPages: count(x => x.row.group === 'extraction'),
    scopeControlPages: count(x => x.row.group === 'scope_control'),
    aeatModelCorrect: count(x => x.row.group === 'aeat' && x.score.formCorrect),
    aeatModelAndKindCorrect: count(x => x.row.group === 'aeat' && x.score.formCorrect && x.score.kindCorrect),
    fullIdentityCorrect: count(x => x.score.identityCorrect),
    accepted, correctAccepted, wrongAccepted: accepted - correctAccepted,
    acceptanceRate: rows.length ? accepted / rows.length : null,
    acceptedPrecision: accepted ? correctAccepted / accepted : null,
    needsReview: count(x => x.row.result?.status === 'needs_review'),
    needsOcr: count(x => x.row.result?.status === 'needs_ocr'),
    reviewRequired, reviewCorrect: count(x => x.score.reviewCorrect),
    errors: count(x => !x.row.result),
    modelCalls: modelCalls.length, medianModelCallMs: median,
    inputTokens: rows.reduce((n, r) => n + (r.result?.audit.usage.input_tokens ?? 0), 0),
    outputTokens: rows.reduce((n, r) => n + (r.result?.audit.usage.output_tokens ?? 0), 0),
  };
}

export interface PublicRun {
  schemaVersion: 1;
  startedAt: string;
  completedAt: string;
  manifestSha256: string;
  implementationSha256: string;
  classifierCommit: string;
  workingTreeDirty: boolean;
  model: string;
  gate: { minConfidence: number; minProbability: number };
  environment: { node: string; poppler: string };
  manifest: PublicManifest;
  summary: ReturnType<typeof summarize>;
  rows: PublicRow[];
}
