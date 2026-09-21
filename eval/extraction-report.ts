import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sha, metrics, type Judgments, type Inputs, type Outcome, type Call } from './spanish-types.js';
import { scoreRow } from './public-types.js';
import type { OcrPageDiagnostic } from '../src/ocr.js';

const [input, prefix, ...extra] = process.argv.slice(2);
if (!input || !prefix || extra.length) throw new Error('Usage: npm run eval:extraction-report -- raw-run.json output-prefix');
const raw = await readFile(input);
const run = JSON.parse(raw.toString()) as {
  startedAt: string; completedAt: string; commit: string; implementationSha256: string; model: string;
  judgmentsSha256: string; baselineInputsSha256: string; inputsSha256: string; acquisitionSha256: string;
  gate: { minConfidence: number; minProbability: number };
  calls: Array<Call & { variant: string; cacheHit: boolean }>;
  rows: Array<{ sourceId: string; page: number; selective: { ocr: Outcome; context: Outcome }; adaptive: { ocr: Outcome; context: Outcome }; extraction: OcrPageDiagnostic }>;
};
const jb = await readFile(new URL('./spanish-v1-judged.json', import.meta.url)), oldb = await readFile(new URL('./spanish-v1-inputs.json', import.meta.url)), newb = await readFile(new URL('./extraction-v2-inputs.json', import.meta.url));
const judgments = JSON.parse(jb.toString()) as Judgments, oldInputs = JSON.parse(oldb.toString()) as Inputs, newInputs = JSON.parse(newb.toString()) as Inputs;
if (sha(jb) !== run.judgmentsSha256 || sha(oldb) !== run.baselineInputsSha256 || sha(newb) !== run.inputsSha256
    || run.rows.length !== judgments.cases.length || run.gate.minConfidence !== 0.95 || run.gate.minProbability !== 0.95
    || Date.parse(newInputs.frozenAt) > Date.parse(run.startedAt)) throw new Error('Incomplete or changed experiment.');
const conditions = [ ['selective', 'ocr'], ['selective', 'context'], ['adaptive', 'ocr'], ['adaptive', 'context'] ] as const;
const publicRows = (variant: 'selective' | 'adaptive', mode: 'ocr' | 'context') => run.rows.map((row, n) => {
  const c = judgments.cases[n]!;
  if (row.sourceId !== c.sourceId || row.page !== c.page) throw new Error('Mismatched or duplicated target.');
  const input = (variant === 'selective' ? oldInputs : newInputs).sources.find(s => s.id === row.sourceId)!.pages[row.page - 1]!;
  const o = row[variant][mode];
  if (!o || Boolean(o.result) === Boolean(o.error) || !Number.isFinite(o.elapsedMs)
      || o.result && o.result.audit.inputSha256 !== input.sha256) throw new Error('Invalid outcome or input.');
  return { ...c, inputSha256: input.sha256, inputBytes: input.bytes, ...o };
});
const summary = Object.fromEntries(['all', 'calibration', 'validation-reserved'].map(split => [split,
  Object.fromEntries((['selective', 'adaptive'] as const).map(variant => [variant,
    Object.fromEntries((['ocr', 'context'] as const).map(mode => [mode, metrics(publicRows(variant, mode).filter(r => split === 'all' || r.split === split))]))]))]));
const count = (fn: (r: typeof run.rows[number]) => boolean) => run.rows.filter(fn).length;
const unique = run.calls.filter(c => !c.cacheHit);
const usage = {
  uniqueBackendRequests: unique.length, cachedRequests: run.calls.length - unique.length,
  failedBackendRequests: unique.filter(c => c.error).length,
  knownInputTokens: unique.reduce((n, c) => n + (c.usage?.input_tokens ?? 0), 0),
  knownOutputTokens: unique.reduce((n, c) => n + (c.usage?.output_tokens ?? 0), 0),
};
const ratio = (n: number, d: number) => d ? `${n}/${d} (${(100 * n / d).toFixed(1)}%)` : 'n/a';
const table = (split: string) => {
  const s = conditions.map(([variant, mode]) => summary[split]![variant]![mode]!);
  const row = (label: string, v: (x: typeof s[number]) => string | number) => `| ${label} | ${s.map(v).join(' | ')} |`;
  return ['| Measure | Selective OCR | Selective + context | Adaptive OCR | Adaptive + context |', '| --- | ---: | ---: | ---: | ---: |',
    row('Correct AEAT model + page kind', x => ratio(x.aeatModelAndKindCorrect, x.aeatPages)),
    row('Correct complete identity, all pages', x => ratio(x.fullIdentityCorrect, x.pages)),
    row('Correct automatic routing, eligible pages', x => ratio(x.correctEligibleAccepted, x.routingEligible)),
    row('Correct among accepted', x => ratio(x.correctAccepted, x.accepted)),
    row('Wrong automatic acceptances', x => x.wrongAccepted),
    row('Required-review controls held correctly', x => ratio(x.reviewCorrect, x.reviewRequired)),
    row('Review / needs OCR / errors', x => `${x.needsReview} / ${x.needsOcr} / ${x.errors}`),
    row('Macro AEAT recognition, equal weight per PDF', x => `${(100 * x.sourceMacroAeatRecognition!).toFixed(1)}%`),
  ].join('\n');
};
const predictionTables = conditions.map(([variant, mode]) => `### ${variant} / ${mode}\n\n| Target | Predicted kind / authority / model | Status | Judge verdict |\n| --- | --- | --- | --- |\n` + publicRows(variant, mode).map(r => {
  const c = r.result?.candidates, s = scoreRow(r);
  const verdict = r.error ? 'Failed; counted in denominator' : s.wrongAccepted ? 'WRONG ACCEPTANCE' : s.correctAccepted ? 'Correct automatic route'
    : r.reviewRequired ? s.identityCorrect ? 'Correct identity and required review' : 'Review held; identity wrong'
      : s.identityCorrect ? 'Correct identity; held by gates' : 'Identity wrong; held by gates';
  return `| ${r.sourceId} p${r.page} | ${c ? [c.kind.value, c.jurisdiction.value, c.form.value].join(' / ') : 'No valid prediction'} | ${r.result?.status ?? 'error'} | ${verdict} |`;
}).join('\n')).join('\n\n');
const fallbackRows = run.rows.filter(r => r.extraction.reasons.length).map(r => {
  const d = r.extraction;
  return `| ${r.sourceId} p${r.page} | ${d.selectiveTextBytes} → ${d.outputTextBytes} | ${d.attempts.map(a => a.dpi).join(', ')} | ${d.selectedAttempt === null ? 'selective retained' : d.attempts[d.selectedAttempt]!.dpi + ' DPI'} | ${d.warnings.join(', ') || 'none'} |`;
}).join('\n');
const report = { ...run, summary, usage, sourceRunSha256: sha(raw),
  extractionSummary: { selectedRasterPages: count(r => r.extraction.method === 'raster'),
    changedSelectedInputs: count(r => r.extraction.outputTextSha256 !== r.extraction.selectiveTextSha256),
    warningsOnSelectedPages: count(r => r.extraction.warnings.length > 0),
    totalSourcePages: newInputs.sources.reduce((n, s) => n + s.pages.length, 0),
    totalExtractionMs: newInputs.sources.reduce((n, s) => n + s.extractionMs, 0) } };
await writeFile(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const markdown = `# Adaptive extraction development comparison — ${run.startedAt.slice(0, 10)}

**A paired development comparison on the same 42 reviewed pages, not a new holdout.** The extraction change was designed after inspecting the previous failures. Codex's [frozen reference labels](../../eval/spanish-v1-judged.json) and [completed source-page review](spanish-reviewed-2026-09-21-review.json) remain unchanged. No classifier prompts, catalog definitions or 0.95 gates were changed. [Full results and all request outcomes](${basename(prefix)}.json) · [New extraction fingerprints](../../eval/extraction-v2-inputs.json) · [Original reviewed benchmark](spanish-reviewed-2026-09-21.md).

## Same-run comparison — all 42 pages

${table('all')}

The corpus contains 30 supported AEAT pages, one routable TGSS example, and 11 controls that require review. Correct automatic routing uses 31 eligible pages as its denominator. Raw model + kind recognition is separate from complete identity and accepted routing. Errors stay in denominators and do not count as a successful review.

## What changed

The old selective engine sometimes extracts a BOE text header while leaving the scanned form unread. The adapter now inspects native-text/image signals. An image covering at least 15% of the page with fewer than 500 native characters (or garbled native text) triggers full-page raster OCR. Native-text-rich pages keep their existing extraction. This uses the same optional LiteParse 2.14.6 engine with Spanish Tesseract; no new service, credential or dependency was introduced.

The fallback starts at 300 DPI. If the extracted page contains a form cue but has no readable model header with nearby 2–4 digit text, it tries 450 DPI. It selects that retry only when header evidence is recovered without severe text loss. Header checks accept any printed number, including unsupported models; no expected label, filename or catalog lookup is used. Digits are not corrected or invented. The second pass is a whole-page raster pass, not a crop or character-accuracy guarantee. Development probes used 300, 450 and 600 DPI; 600 was not consistently better and is not a production retry.

Each rendered image is capped at 24 million pixels, lowering DPI on oversized pages; the whole document still has a 120-second worker deadline. Empty or severely depleted replacements retain the selective result in auto mode and emit a warning. Explicit raster mode requests raster output for every page. Hashes, reasons, chosen attempts and unresolved-header warnings accompany each page. These are diagnostic heuristics, not proof of complete extraction. Original PDFs are untouched.

## Experimental controls

- Both the old and new extraction pipelines were evaluated in this run. Identical serialized Jev requests share the exact same validated reply **or error**, so an unchanged input does not get another chance solely because it appears in two conditions. New context windows are queried when neighboring text changes.
- Within each context pair, the exact isolated reply is reused before any optional contextual request. Context still needs its existing continuity gate, and sparse targets still cannot inherit a model. All original PDF neighbors are available; no gold-based annex segmentation is introduced.
- All 237 source-page selective-text hashes were checked against the frozen previous inputs. The first stage is unchanged; only flagged pages receive replacement text. ${report.extractionSummary.changedSelectedInputs}/42 selected target inputs changed; ${report.extractionSummary.selectedRasterPages}/42 used raster output. Additional unscored neighbors can change too.
- New extraction hashes and code were committed before the live comparison. Each of the 168 condition outcomes is preserved, including invalid provider replies. No score-driven rerun, threshold tuning or reference-label revision followed this run.
- The 17/25 original partition names below are retained for traceability. Both are now development/regression data because their earlier outcomes informed this implementation. Neither is a fresh validation estimate. OCR character/amount accuracy and PGC account accuracy are not measured here.

## Original 25-page partition

${table('validation-reserved')}

## Original 17-page partition

${table('calibration')}

## Every selected fallback page

| Page | UTF-8 bytes before → after | Attempted DPI | Chosen extraction | Warnings |
| --- | --- | --- | --- | --- |
${fallbackRows}

## Reproduce

Use a source checkout, Node.js 22+, Poppler for the original corpus verifier, and the optional LiteParse dependency installed by \`npm ci\`:

\`\`\`sh
npm ci
npm run samples:verify -- --download
npm run eval:spanish -- --prepare
npm run eval:extraction
npm run eval:extraction-report -- eval/results/extraction-TIMESTAMP.json eval/results/extraction-TIMESTAMP-report
\`\`\`

Live inference uses \`TYPESAFE_API_KEY\` and requires a clean committed tree. For a fresh checkout, regenerate the adaptive cache with \`npm run eval:extraction -- --prepare\`; an existing committed input manifest is verified, never overwritten. Any fingerprint change stops the comparison. Classifier text/URLs/labels are not mixed: the model receives page text and the existing Choice questions only. Raw PDFs and text stay in ignored local directories; published artifacts contain hashes and predictions.

## Usage and provenance

- Run: ${run.startedAt} to ${run.completedAt}; commit: \`${run.commit}\`; model: \`${run.model}\`.
- Implementation SHA-256: \`${run.implementationSha256}\`; reviewed labels SHA-256: \`${run.judgmentsSha256}\`.
- Baseline inputs SHA-256: \`${run.baselineInputsSha256}\`; new inputs SHA-256: \`${run.inputsSha256}\`; raw run SHA-256: \`${sha(raw)}\`.
- ${usage.uniqueBackendRequests} unique backend requests, ${usage.cachedRequests} reused requests, ${usage.failedBackendRequests} unique failed requests. Internal bounded HTTP retries are not separate logical requests in this ledger.
- Validated unique replies report ${usage.knownInputTokens.toLocaleString('en-US')} input and ${usage.knownOutputTokens.toLocaleString('en-US')} output tokens. Failed-response usage is unknown; this is not an exact billing statement when errors occur. Shared replies are counted once.
- Full adaptive extraction of all 237 pages took ${report.extractionSummary.totalExtractionMs.toLocaleString('en-US')} ms on this machine. Native extraction plus selective OCR alone previously took 132,089 ms in a separate run; that historical timing is not a controlled speed comparison. Per-source extraction timings are in the input manifest. Inference times with response caching are not latency benchmarks.

## Every prediction against the reviewed source labels

${predictionTables}
`;
await writeFile(`${prefix}.md`, markdown, { flag: 'wx' });
console.log(`Wrote ${prefix}.json and ${prefix}.md`);
