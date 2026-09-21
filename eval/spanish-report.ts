import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sha, modes, summary, rowsFor, verifyRun, type SpanishRow, type Judgments, type Inputs, type Call } from './spanish-types.js';
import { scoreRow } from './public-types.js';
import type { CandidateManifest } from './calibration-types.js';

const [input, prefix, ...extra] = process.argv.slice(2);
if (!input || !prefix || extra.length) throw new Error('Usage: npm run eval:spanish-report -- raw-run.json output-prefix');
const raw = await readFile(input);
const run = JSON.parse(raw.toString()) as {
  startedAt: string; completedAt: string; commit: string; model: string; implementationSha256: string;
  judgmentsSha256: string; inputsSha256: string; acquisitionSha256: string; gate: { minConfidence: number; minProbability: number };
  rows: SpanishRow[]; calls: Call[];
};
const jb = await readFile(new URL('./spanish-v1-judged.json', import.meta.url));
const ib = await readFile(new URL('./spanish-v1-inputs.json', import.meta.url));
const ab = await readFile(new URL('./calibration-v1.json', import.meta.url));
if (run.judgmentsSha256 !== sha(jb) || run.inputsSha256 !== sha(ib) || run.acquisitionSha256 !== sha(ab)) throw new Error('Frozen manifests changed.');
const judgments = JSON.parse(jb.toString()) as Judgments, inputs = JSON.parse(ib.toString()) as Inputs;
const acquisition = JSON.parse(ab.toString()) as CandidateManifest;
verifyRun(run.rows, judgments, inputs);
if (Date.parse(judgments.frozenAt) > Date.parse(run.startedAt) || Date.parse(inputs.frozenAt) > Date.parse(run.startedAt)
    || run.gate.minConfidence !== 0.95 || run.gate.minProbability !== 0.95) throw new Error('Run does not follow the frozen protocol.');
const totals = summary(run.rows, judgments, inputs);
const usage = {
  logicalRequests: run.calls.length, validatedReplies: run.calls.filter(c => c.usage).length,
  failedRequests: run.calls.filter(c => c.error).length,
  contextRetries: run.calls.filter(c => c.stage === 'context').length,
  knownInputTokens: run.calls.reduce((n, c) => n + (c.usage?.input_tokens ?? 0), 0),
  knownOutputTokens: run.calls.reduce((n, c) => n + (c.usage?.output_tokens ?? 0), 0),
};
const ratio = (n: number, d: number) => d ? `${n}/${d} (${(100 * n / d).toFixed(1)}%)` : 'n/a';
const table = (split: string) => {
  const s = totals[split]!;
  const line = (label: string, value: (m: typeof s[string]) => string | number) => `| ${label} | ${modes.map(mode => value(s[mode]!)).join(' | ')} |`;
  return ['| Measure | Native only | Spanish OCR | Same OCR + context |', '| --- | ---: | ---: | ---: |',
    line('Correct AEAT model + page kind, before gates', m => ratio(m.aeatModelAndKindCorrect, m.aeatPages)),
    line('Correct complete identity, all pages', m => ratio(m.fullIdentityCorrect, m.pages)),
    line('Correct automatic routing, eligible pages', m => ratio(m.correctEligibleAccepted, m.routingEligible)),
    line('Correct automatic routing, AEAT pages', m => ratio(m.aeatAccepted, m.aeatPages)),
    line('All automatic acceptances', m => ratio(m.accepted, m.pages)),
    line('Correct among accepted', m => ratio(m.correctAccepted, m.accepted)),
    line('Wrong automatic acceptances', m => m.wrongAccepted),
    line('Required-review controls held correctly', m => ratio(m.reviewCorrect, m.reviewRequired)),
    line('Review / needs OCR / errors', m => `${m.needsReview} / ${m.needsOcr} / ${m.errors}`),
    line('Macro AEAT model + kind, equal weight per PDF', m => m.sourceMacroAeatRecognition === null ? 'n/a' : `${(m.sourceMacroAeatRecognition * 100).toFixed(1)}%`),
  ].join('\n');
};
const scoreTables = modes.map(mode => {
  const rows = rowsFor(run.rows, judgments, inputs, mode);
  return `### ${mode}\n\n| Target | Expected kind / authority / model | Predicted kind / authority / model | Routing | Review verdict |\n| --- | --- | --- | --- | --- |\n` + rows.map(r => {
    const s = scoreRow(r), c = r.result?.candidates;
    const predicted = c ? [c.kind.value, c.jurisdiction.value, c.form.value].join(' / ') : 'no valid prediction';
    const verdict = r.error ? 'ERROR; counted as failure' : s.wrongAccepted ? 'WRONG ACCEPTANCE' : s.correctAccepted ? 'Correct automatic route'
      : r.reviewRequired ? (s.identityCorrect ? 'Correct identity; required review' : 'Required review held; identity wrong')
      : s.identityCorrect ? 'Correct identity; unnecessarily held for review' : 'Identity wrong; held for review';
    return `| ${r.sourceId} p${r.page} | ${[r.expected.kind, r.expected.jurisdiction, r.expected.form ?? 'none'].join(' / ')} | ${predicted} | ${r.result?.status ?? r.error} | ${verdict} |`;
  }).join('\n');
}).join('\n\n');
const evidence = judgments.cases.map(c => {
  const source = acquisition.sources.find(s => s.id === c.sourceId)!;
  return `| [${c.sourceId} p${c.page}](${source.url}#page=${c.page}) | ${c.split} | ${c.note} |`;
}).join('\n');
const gateReasons = modes.map(mode => {
  const counts = new Map<string, number>();
  for (const row of rowsFor(run.rows, judgments, inputs, mode).filter(r => !r.reviewRequired)) for (const reason of row.result?.reasons ?? []) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return `- **${mode}**, eligible pages only (reasons can overlap): ${[...counts].sort((a, b) => b[1] - a[1]).map(([reason, n]) => `${reason}: ${n}`).join('; ') || 'none'}.`;
}).join('\n');
const published = { ...run, summary: totals, usage, sourceRunSha256: sha(raw),
  review: { reviewer: judgments.reviewer, labelsFrozenAt: judgments.frozenAt,
    scope: 'All 42 reference labels and all 126 condition outcomes are available below for completed Codex adjudication. Recognition and automatic routing are scored separately; there is no pending external review prerequisite.' } };
await writeFile(`${prefix}.json`, JSON.stringify(published, null, 2) + '\n', { flag: 'wx' });
const report = `# Reviewed Spanish benchmark — ${run.startedAt.slice(0, 10)} UTC

**42 pages from 12 new official PDFs; nine supported AEAT models.** Codex completed the document review requested by the project owner: all selected pages were rendered and inspected, expected identities and routing policy were frozen before Jev inference, and predictions are scored against those judgments. Reviewer: **Codex (AI assistant and implementation author)**. This is a completed AI review, not a claim that an independent human accountant supplied the labels.

[Full results](${basename(prefix)}.json) · [Frozen judgments and evidence](../../eval/spanish-v1-judged.json) · [Frozen OCR inputs](../../eval/spanish-v1-inputs.json) · [Source catalog](../SPANISH-SAMPLES.md)

## All 42 selected pages

${table('all')}

There are **30 supported AEAT pages**, one routable TGSS document and **11 required-review controls**: two unsupported AEAT models, six Catalan tax pages and three Facturae guide pages. Eligible automatic-routing coverage therefore uses **31**, not 42, as its denominator. Complete identity requires all three raw heads to agree with the reviewed labels. AEAT model + kind uses only the 30 supported AEAT pages. A correctly held control can still have a wrong identity. Errors remain in every applicable denominator and never count as a successful review.

## Reserved validation partition — 25 pages

${table('validation-reserved')}

## Calibration partition — 17 pages

${table('calibration')}

The partition names were frozen during acquisition. **No threshold fitting or prompt changes were made on either partition.** All three conditions were fixed before inspecting any predictions, and the first completed run is retained. The reserved partition has now been evaluated: if these outcomes inform future changes, it becomes regression data and a new holdout is needed. Exact PDF sources differ from the previous benchmark; publisher/template styles recur, pages are correlated, and provider-training overlap is unknown. The macro measure gives each supported-AEAT PDF equal weight. This is document-recognition verification on a small official-document corpus, not a representative production estimate or a PGC benchmark.

## What the comparison measures

Native-only uses Poppler 26.05.0. Spanish OCR uses LiteParse 2.14.6 with native text plus selective local Tesseract OCR in Spanish. This changes the extraction engine as well as adding OCR, so their difference is an **extraction-pipeline comparison**, not a pure OCR-only effect. All 237 source pages were fingerprinted for the OCR/context condition. Raw text and PDFs remain local and uncommitted.

The third condition reuses each exact isolated OCR reply, locally, then runs the existing context retry when required. It adds up to two preceding pages and one following page from the full source PDF, without oracle annex grouping. Accepted isolated results are preserved. Sparse targets are not filled in from neighbors. Context requires a confident same-document decision; every applicable threshold remains **0.95**. Filenames, URLs, source IDs, reference labels and review notes are never sent as model evidence. Context includes additional, unscored neighboring pages. If a context request fails, its outcome is an error while the valid isolated result is retained. No extra baseline request is used to obtain a better answer.

Blank forms and bank copies count as tax forms, not filed receipts. Technical record layouts and explanatory worked-example introductions count as instructions. Unsupported 117/124 and regional 650/660 map to no supported national model. Continuation labels may use the source cover for issuer/model identity even when the isolated page lacks that evidence; a cautious isolated abstention remains operationally appropriate despite reducing measured recognition or coverage.

## Reasons eligible pages were held

${gateReasons}

## Reproduce

From the source checkout with Node.js 22+, Poppler 26.05.0 and the TypeSafe key in the environment:

\`\`\`sh
npm ci
npm run samples:verify -- --download
npm run eval:spanish -- --prepare
npm run eval:spanish
npm run eval:spanish-report -- eval/results/spanish-TIMESTAMP.json eval/results/spanish-TIMESTAMP-report
\`\`\`

Preparation performs local Spanish extraction when its ignored cache is absent and verifies every fingerprint before inference. Different extraction output fails the run rather than silently refreshing evidence. Live evaluation requires a clean committed worktree; reports are written incrementally to an ignored timestamped file. The report generator rejects incomplete, duplicated, reordered or mismatched targets and recomputes all scores. Hosted outputs can vary on reruns; preserve each complete run.

## Provenance and measured usage

- Run: ${run.startedAt} to ${run.completedAt}; model: \`${run.model}\`; frozen experiment commit: \`${run.commit}\`.
- Implementation/catalog SHA-256: \`${run.implementationSha256}\`.
- Reviewed labels SHA-256: \`${run.judgmentsSha256}\`; OCR fingerprints SHA-256: \`${run.inputsSha256}\`.
- Raw run SHA-256: \`${sha(raw)}\`.
- **${usage.logicalRequests} logical backend requests**, including ${usage.contextRetries} context retries; ${usage.validatedReplies} validated replies and ${usage.failedRequests} failed requests. The provider client's bounded HTTP retries are internal to a logical request.
- Validated replies report **${usage.knownInputTokens.toLocaleString('en-US')} input tokens** and **${usage.knownOutputTokens.toLocaleString('en-US')} output tokens**. Failed-response usage is unknown, so these are known totals, not a complete billing claim when errors occur. Paired baseline usage is counted once. Per-request and per-condition elapsed times are stored in JSON; context time includes its shared baseline.
- One local full-corpus OCR extraction took ${inputs.sources.reduce((n, s) => n + s.extractionMs, 0).toLocaleString('en-US')} ms in total. Cached input verification is excluded from classification timings. No speedup or pure OCR latency claim is made.

## Completed reference-label review

Every target below was visually inspected before inference. All acquisition-stage proposed identities were confirmed. Source pages and explanatory review notes make the decisions auditable; unsupported printed models remain explicit in the notes.

| Source page | Frozen partition | Reviewer evidence and decision |
| --- | --- | --- |
${evidence}

## Every prediction checked against the reviewed labels

The tables cover **all 126 outcomes**, including requests rejected by the response validator. “Correct identity; unnecessarily held” means the reference label is clear in the reviewed source but automatic routing did not pass policy; it does not assert that the model's confidence should simply be overridden.

${scoreTables}
`;
await writeFile(`${prefix}.md`, report, { flag: 'wx' });
console.log(`Wrote ${prefix}.json and ${prefix}.md`);
