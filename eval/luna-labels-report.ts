import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { classificationQuestions } from '../src/classify.js';
import { sha, metrics, type Judgments, type Inputs, type Outcome } from './spanish-types.js';

const [path, mainPath, prefix, ...extra] = process.argv.slice(2);
if (!path || !mainPath || !prefix || extra.length) throw new Error('Usage: node --import tsx eval/luna-labels-report.ts raw.json main-report.json output-prefix');
type Labels = Record<'kind' | 'jurisdiction' | 'form', string>;
type Row = { sourceId: string; page: number; inputSha256: string; requestSha256: string; elapsedMs: number;
  labels?: Labels; error?: string; usage?: Record<string, number> };
const read = (name: string) => readFile(new URL(name, import.meta.url));
const raw = await readFile(path), mb = await readFile(mainPath), jb = await read('./spanish-v1-judged.json');
const pb = await read('./luna-labels-v1-protocol.json'), ib = await read('./extraction-v3-inputs.json');
const base = await read('./luna-v1-protocol.json');
const refs = JSON.parse(jb.toString()) as Judgments, inputs = JSON.parse(ib.toString()) as Inputs;
const run = JSON.parse(raw.toString()) as { startedAt: string; completedAt: string; commit: string; cli: string;
  protocolSha256: string; protocol: { frozenAt: string; judgmentsSha256: string; inputsSha256: string; baseProtocolSha256: string }; rows: Row[] };
const main = JSON.parse(mb.toString()) as { protocolSha256: string;
  rows: Array<{ sourceId: string; page: number; inputSha256: string; jev: { ocr: Outcome }; luna: { ocr: Outcome } }>;
  calls: Array<{ sourceId: string; page: number; provider: string; stage: string; requestSha256: string }> };
if (run.protocolSha256 !== sha(pb) || JSON.stringify(run.protocol) !== JSON.stringify(JSON.parse(pb.toString()))
    || run.protocol.judgmentsSha256 !== sha(jb) || run.protocol.inputsSha256 !== sha(ib)
    || run.protocol.baseProtocolSha256 !== sha(base) || main.protocolSha256 !== sha(base)
    || Date.parse(run.protocol.frozenAt) > Date.parse(run.startedAt)
    || run.rows.length !== refs.cases.length || main.rows.length !== refs.cases.length) throw new Error('Changed or incomplete experiment');
const keys = ['kind', 'jurisdiction', 'form'] as const, questions = classificationQuestions();
const scored = run.rows.map((row, i) => {
  const c = refs.cases[i]!, original = main.rows[i]!;
  const request = main.calls.filter(x => x.provider === 'jev' && x.stage === 'ocr' && x.sourceId === c.sourceId && x.page === c.page);
  if (row.sourceId !== c.sourceId || row.page !== c.page || original.sourceId !== c.sourceId || original.page !== c.page
      || row.inputSha256 !== inputs.sources.find(s => s.id === c.sourceId)?.pages[c.page - 1]?.sha256
      || original.inputSha256 !== row.inputSha256 || request.length !== 1 || request[0]!.requestSha256 !== row.requestSha256
      || Boolean(row.labels) === Boolean(row.error) || !Number.isFinite(row.elapsedMs) || row.elapsedMs < 0
      || row.labels && (Object.keys(row.labels).length !== 3 || keys.some(k => !Object.hasOwn(questions[k]!.criteria, row.labels![k])))) throw new Error('Invalid outcome or unmatched isolated evidence');
  const expected = { ...c.expected, form: c.expected.form ?? 'none' };
  const mismatchedFields = keys.filter(k => row.labels?.[k] !== expected[k]);
  return { ...row, split: c.split, group: c.group, expected, sourceEvidence: c.note, visualSha256: c.visualSha256,
    mismatchedFields, identityCorrect: mismatchedFields.length === 0,
    aeatModelAndKindCorrect: c.group === 'aeat' && !mismatchedFields.includes('kind') && !mismatchedFields.includes('form') };
});
const summary = Object.fromEntries(['all', 'calibration', 'validation-reserved'].map(split => {
  const rows = scored.filter(r => split === 'all' || r.split === split), aeat = rows.filter(r => r.group === 'aeat');
  const sources = [...new Set(aeat.map(r => r.sourceId))];
  return [split, { pages: rows.length, aeatPages: aeat.length, aeatModelAndKindCorrect: aeat.filter(r => r.aeatModelAndKindCorrect).length,
    fullIdentityCorrect: rows.filter(r => r.identityCorrect).length, errors: rows.filter(r => r.error).length,
    sourceMacroAeatRecognition: sources.reduce((n, id) => n + aeat.filter(r => r.sourceId === id && r.aeatModelAndKindCorrect).length / aeat.filter(r => r.sourceId === id).length, 0) / sources.length,
    fieldCorrect: Object.fromEntries(keys.map(k => [k, rows.filter(r => !r.mismatchedFields.includes(k)).length])) }];
}));
const comparison = { 'jev/ocr': metrics(main.rows.map((r, i) => ({ ...refs.cases[i]!, ...r.jev.ocr }))),
  'luna/ocr': metrics(main.rows.map((r, i) => ({ ...refs.cases[i]!, ...r.luna.ocr }))), 'luna/labels': summary.all! };
const times = run.rows.map(r => r.elapsedMs).sort((a, b) => a - b);
const usage = { calls: run.rows.length, failed: run.rows.filter(r => r.error).length,
  knownInputTokens: run.rows.reduce((n, r) => n + (r.usage?.input_tokens ?? 0), 0),
  knownCachedInputTokens: run.rows.reduce((n, r) => n + (r.usage?.cached_input_tokens ?? 0), 0),
  knownOutputTokens: run.rows.reduce((n, r) => n + (r.usage?.output_tokens ?? 0), 0),
  knownReasoningOutputTokens: run.rows.reduce((n, r) => n + (r.usage?.reasoning_output_tokens ?? 0), 0),
  callsWithUnknownUsage: run.rows.filter(r => !r.usage).length,
  medianCallMs: (times[Math.floor((times.length - 1) / 2)]! + times[Math.floor(times.length / 2)]!) / 2,
  totalCallMs: times.reduce((a, b) => a + b, 0) };
const report = { ...run, rows: scored, summary, comparison, usage, matchedIsolatedRequests: scored.length,
  sourceRunSha256: sha(raw), mainReportSha256: sha(mb) };
await writeFile(prefix + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const ratio = (n: number, d: number) => `${n}/${d} (${(100 * n / d).toFixed(1)}%)`;
const columns = Object.values(comparison);
const markdown = `# Luna label-only follow-up — ${run.startedAt.slice(0, 10)}

**A separately frozen, post-hoc output-format experiment on the same 42 development pages.** After observing shared Choice-contract failures in the [main run](luna-2026-09-21.md), we asked fresh Luna sessions for only three labels. All isolated OCR evidence and catalog criteria remain identical; the instructions and output schema change. This is one new pass, not a repair or selection of the best predictions from multiple runs. [Frozen protocol](../../eval/luna-labels-v1-protocol.json) · [Method](../../eval/LUNA-BENCHMARK.md#separate-follow-up-labels-without-probability-distributions) · [Every result and source evidence](${basename(prefix)}.json).

## Recognition comparison — isolated OCR only

| Measure | Jev Choice contract | Luna Choice contract | Luna labels only |
| --- | ---: | ---: | ---: |
| AEAT model + page kind | ${columns.map(c => ratio(c.aeatModelAndKindCorrect, c.aeatPages)).join(' | ')} |
| Complete identity, all pages | ${columns.map(c => ratio(c.fullIdentityCorrect, c.pages)).join(' | ')} |
| Failed page outcomes | ${columns.map(c => c.errors).join(' | ')} |
| Macro AEAT recognition, equal PDF weight | ${columns.map(c => (100 * c.sourceMacroAeatRecognition!).toFixed(1) + '%').join(' | ')} |

Failures remain in every denominator. Label-only outputs contain no confidence or probability estimates: **automatic-acceptance coverage and precision are not measured for this follow-up.** The main run remains unchanged. A different single sample can vary as well as the output format; this is not a causal estimate of schema effects or an optimized maximum-capability prompt.

## Usage and elapsed time

${Object.entries(usage).map(([k, v]) => '- ' + k + ': ' + v).join('\n')}

Cached input and reasoning output are subcategories, not additional totals. Timing includes CLI startup and Codex system/skill overhead; it is not pure API latency. No per-call currency bill is available. Every request used a fresh ephemeral session requesting GPT-5.6 Luna at low reasoning effort with tools disabled. No resolved snapshot identifier is exposed by this CLI. Source text, labels and prior outputs were not available through files or tools to the model.

## Original partitions, both now development data

| Partition | AEAT model + kind | Complete identity | Errors |
| --- | ---: | ---: | ---: |
${['calibration', 'validation-reserved'].map(k => { const s = summary[k]!; return `| ${k} | ${ratio(s.aeatModelAndKindCorrect, s.aeatPages)} | ${ratio(s.fullIdentityCorrect, s.pages)} | ${s.errors} |`; }).join('\n')}

## Provenance and reproduction

- Run ${run.startedAt} to ${run.completedAt}; commit \`${run.commit}\`; CLI \`${run.cli}\`.
- Protocol SHA-256 \`${run.protocolSha256}\`; reference SHA-256 \`${run.protocol.judgmentsSha256}\`.
- Raw run SHA-256 \`${sha(raw)}\`; main report SHA-256 \`${sha(mb)}\`.
- All ${scored.length} isolated evidence-and-question hashes match the original Jev OCR requests. Source text, PDFs and images are not bundled.

Generate this report with \`node --import tsx eval/luna-labels-report.ts eval/results/luna-labels-TIMESTAMP.json docs/benchmarks/luna-2026-09-21.json eval/results/luna-labels-report-TIMESTAMP\`. The generator verifies frozen labels, protocols, target order, OCR fingerprints and paired request hashes and recomputes all scores.

## Every prediction against the unchanged reference

| Target | Expected kind / authority / model | Predicted kind / authority / model | Mismatched fields |
| --- | --- | --- | --- |
${scored.map(r => `| ${r.sourceId} p${r.page} | ${keys.map(k => r.expected[k]).join(' / ')} | ${r.labels ? keys.map(k => r.labels![k]).join(' / ') : 'No valid output'} | ${r.error ? 'Failure' : r.mismatchedFields.join(', ') || 'None'} |`).join('\n')}
`;
await writeFile(prefix + '.md', markdown, { flag: 'wx' });
console.log(JSON.stringify({ summary, usage }, null, 2));
