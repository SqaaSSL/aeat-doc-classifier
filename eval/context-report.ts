import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { contextSummary, type ContextRow } from './context-metrics.js';
import type { PublicManifest } from './public-types.js';

const [input, prefix, ...extra] = process.argv.slice(2);
if (!input || !prefix || extra.length) throw new Error('Usage: npm run eval:context-report -- raw-run.json output-prefix');
const raw = await readFile(input), run = JSON.parse(raw.toString()) as {
  startedAt: string; completedAt: string; commit: string; model: string; manifestSha256: string;
  implementationSha256: string; extractionMs: number; rows: ContextRow[]; summary: unknown;
};
const manifestBytes = await readFile(new URL('./public-v1.json', import.meta.url));
const manifest = JSON.parse(manifestBytes.toString()) as PublicManifest;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const expected = manifest.sources.flatMap(s => s.cases.map(c => ({ sourceId: s.id, ...c })));
if (run.manifestSha256 !== hash(manifestBytes) || expected.length !== run.rows.length || expected.some((c, i) => {
  const r = run.rows[i]!;
  return c.sourceId !== r.sourceId || c.page !== r.page || c.inputSha256 !== r.inputSha256 ||
    c.group !== r.group || c.reviewRequired !== r.reviewRequired || c.expectedStatus !== r.expectedStatus ||
    JSON.stringify(c.expected) !== JSON.stringify(r.expected);
})) throw new Error('Incomplete or mismatched context run.');
const summary = contextSummary(run.rows), before = summary.pairedPageOnly, after = summary.contextual;
const published = { ...run, summary, sourceRunSha256: hash(raw),
  reportingNote: 'Summary regenerated from immutable page outcomes. elapsedMs is whole-pipeline time (isolated attempt plus optional retry); no isolated-stage latency is inferred. Both attempts count toward total usage.' };
await writeFile(`${prefix}.json`, JSON.stringify(published, null, 2) + '\n', { flag: 'wx' });
const ratio = (n: number, d: number) => `${n}/${d} (${(100 * n / d).toFixed(1)}%)`;
const rows = run.rows.map(r => `| ${r.sourceId} p${r.page} | ${r.contextual?.pageOnly.candidates?.form.value ?? 'none'} | ${r.result?.candidates?.form.value ?? 'none'} | ${r.contextual?.pageOnly.status ?? 'error'} → ${r.result?.status ?? 'error'} | ${r.contextual?.context.reason ?? r.error} |`).join('\n');
const report = `# Context retry experiment — ${run.startedAt.slice(0, 10)}

**Development comparison on the already inspected 44-page public-v1 corpus. This is not a new held-out accuracy estimate.** Prompts and the contextual retry were designed after examining the original failures; no independent human annotation review has occurred. The first contextual run is reported without tuning and retrying it for a better score.

[Full results](${basename(prefix)}.json) · [Original benchmark](public-2026-09-20.md) · [Frozen source labels](../../eval/public-v1.json) · [Design and next steps](../DOCJEV-REVIEW.md)

| Measure | Fresh isolated attempt | Same attempt + contextual retry |
| --- | ---: | ---: |
| Correct AEAT model + page kind | ${ratio(before.aeatModelAndKindCorrect, before.aeatPages)} | ${ratio(after.aeatModelAndKindCorrect, after.aeatPages)} |
| Accepted among eligible AEAT pages | ${ratio(before.accepted, before.aeatPages)} | ${ratio(after.accepted, after.aeatPages)} |
| Accepted across all pages | ${ratio(before.accepted, before.pages)} | ${ratio(after.accepted, after.pages)} |
| Wrong automatic acceptances | ${before.wrongAccepted} | ${after.wrongAccepted} |
| Required review/OCR checks held correctly | ${before.reviewCorrect}/${before.reviewRequired} | ${after.reviewCorrect}/${after.reviewRequired} |
| Errors | ${before.errors} | ${after.errors} |

The original published isolated run scored **23/27** for model + kind and accepted **9/27** eligible pages. The fresh isolated attempts in this paired experiment scored **24/27** and accepted **8/27**. Hosted outputs varied; comparing 27/27 against 24/27 within this run better separates context effects from that variation. The original report is preserved.

## What changed

Only uncertain, text-bearing pages are retried. Each retry receives the target's full text with at most two preceding pages and one following page, in source order. Complete neighboring pages are omitted when needed to keep the serialized request within 54,000 UTF-8 bytes; text is never truncated. No filename, expected label or source URL enters model state. All neighbors come from the original PDF, including pages not scored by the original benchmark, so this experiment uses **additional evidence**.

The retry asks a fourth question: whether the provided pages belong to the same source document. Automatic acceptance requires both probability and provider confidence to meet the unchanged **0.95** threshold for this continuity decision and all applicable classification decisions. The original routing policy still rejects unsupported/historical/foreign/regional/foral forms. Empty extraction and sparse targets are not filled in from neighboring pages. Accepted isolated results are preserved.

Context recovered the remaining wrong raw AEAT identities in this paired run. Two Modelo 200 continuation pages newly passed every gate. However, many correct candidates remained below form/authority thresholds; six AEAT pages were also blocked by uncertain continuity, often around copies or annexes. **Recognition improved substantially on this development set; automatic acceptance remained low at ${ratio(after.accepted, after.aeatPages)}.** A generic context window is not a substitute for validated document grouping or confidence calibration.

All 17 required-review/extraction checks remained held. Some raw candidates on joint-model and Bizkaia instructions were still wrong, so correct review behavior must not be confused with correct source identity. The corpus is small, nonrandom, correlated and previously inspected; neither 27/27 raw recognition nor zero wrong acceptances establishes production reliability. No OCR or PGC accuracy improvement was measured.

## Reproduce

From a source checkout with Node.js 22+, Poppler and the TypeSafe key in your environment:

\`\`\`sh
npm ci
npm run eval:public -- --download-only
npm run eval:context
npm run eval:context-report -- eval/results/context-TIMESTAMP.json eval/results/context-TIMESTAMP-report
\`\`\`

The runner verifies source and target-text hashes before inference. It evaluates all original 44 targets; missing outcomes stay in denominators. Each target stores its isolated decision, contextual decision, continuity distribution and context-page/request hashes. Original documents and text are not published. Reports are generated offline and preserve old artifacts.

## Usage and provenance

- Run: ${run.startedAt} to ${run.completedAt}; model: \`${run.model}\`; experiment commit: \`${run.commit}\`.
- Implementation/catalog SHA-256: \`${run.implementationSha256}\`.
- Original corpus SHA-256: \`${run.manifestSha256}\`; raw run SHA-256: \`${hash(raw)}\`.
- ${summary.contextRetries} context retries; ${summary.successfulApiCalls} successful API calls total. The context mode costs more than isolated classification: **${summary.inputTokens.toLocaleString('en-US')} input tokens** and **${summary.outputTokens.toLocaleString('en-US')} output tokens** across both attempts.
- PDF extraction: ${run.extractionMs} ms. Median complete per-page pipeline time: ${summary.medianPipelineMs} ms, including local empty-page returns. This is **not** isolated model inference latency. No per-stage inference timing or speedup is claimed.

## Every target

| Page | Isolated raw model | Final raw model | Status | Context decision |
| --- | --- | --- | --- | --- |
${rows}
`;
await writeFile(`${prefix}.md`, report, { flag: 'wx' });
console.log(`Wrote ${prefix}.json and ${prefix}.md`);
