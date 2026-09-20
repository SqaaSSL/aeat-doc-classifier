import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { summarize, type PublicRun } from './public-types.js';

const pct = (n: number, d: number) => d ? `${n}/${d} (${(100 * n / d).toFixed(1)}%)` : 'n/a';
const args = process.argv.slice(2);
if (args.length !== 2) throw new Error('Usage: npm run eval:report -- run.json report.md');
const [input, output] = args as [string, string];
const run = JSON.parse(await readFile(input, 'utf8')) as PublicRun;
const expectedCases = run.manifest.sources.flatMap(s => s.cases.map(c => ({ sourceId: s.id, ...c })));
if (run.schemaVersion !== 1 || expectedCases.length !== run.rows.length ||
    expectedCases.some((c, i) => c.sourceId !== run.rows[i]?.sourceId || c.page !== run.rows[i]?.page ||
      c.inputSha256 !== run.rows[i]?.inputSha256 || JSON.stringify(c.expected) !== JSON.stringify(run.rows[i]?.expected) ||
      c.group !== run.rows[i]?.group || c.reviewRequired !== run.rows[i]?.reviewRequired ||
      c.expectedStatus !== run.rows[i]?.expectedStatus)) {
  throw new Error('Incomplete run or results do not match the embedded frozen manifest.');
}
const s = summarize(run.rows);
if (JSON.stringify(s) !== JSON.stringify(run.summary)) throw new Error('Stored summary does not match per-page results.');
const groups = ['aeat', 'scope_control', 'extraction'] as const;
const models = [...new Set(expectedCases.filter(c => c.group === 'aeat').map(c => c.expected.form))].sort();
const sourcesTable = run.manifest.sources.map(source => {
  const rows = run.rows.filter(r => r.sourceId === source.id), t = summarize(rows);
  return `| [${source.id}](${source.url}) | ${rows.map(r => r.page).join(', ')} | ${t.aeatPages ? pct(t.aeatModelAndKindCorrect, t.aeatPages) : 'n/a'} | ${t.accepted} | ${t.needsReview + t.needsOcr} | ${t.wrongAccepted} | ${t.errors} |`;
}).join('\n');
const pagesTable = run.rows.map(r => {
  const c = r.result?.candidates;
  return `| ${r.sourceId} p${r.page} | ${r.expected.kind ?? '—'} / ${r.expected.jurisdiction ?? '—'} / ${r.expected.form ?? 'none'} | ${c ? `${c.kind.value} / ${c.jurisdiction.value} / ${c.form.value}` : '—'} | ${r.result?.status ?? 'error'} | ${r.result?.reasons.join(', ') || r.error || '—'} |`;
}).join('\n');
const reasons = Object.entries(run.rows.reduce<Record<string, number>>((out, row) => {
  for (const reason of row.result?.reasons ?? []) out[reason] = (out[reason] ?? 0) + 1;
  return out;
}, {})).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `| ${reason} | ${count} |`).join('\n');
const report = `# Public PDF benchmark — ${run.startedAt.slice(0, 10)}

**${s.pages} physical pages from ${s.documents} public government PDFs.** Jev model \`${run.model}\`, minimum provider confidence **${run.gate.minConfidence}** and selected-option probability **${run.gate.minProbability}**. No prompt or threshold tuning on this corpus before this first run. This is an initial source-based benchmark, not a production accuracy claim.

[Full machine-readable run](${basename(input)}) · [Frozen corpus and labels](../../eval/public-v1.json) · [Methodology and reproduction](../../eval/PUBLIC-BENCHMARK.md) · [Earlier development evaluation](README.md)

## Results

| Measure | Result |
| --- | ---: |
| Correct top AEAT model, before confidence gating | ${pct(s.aeatModelCorrect, s.aeatPages)} |
| Correct top AEAT model **and page kind**, before gating | ${pct(s.aeatModelAndKindCorrect, s.aeatPages)} |
| Correct full candidate identity (kind, source jurisdiction, form) on text pages | ${pct(s.fullIdentityCorrect, s.recognitionPages)} |
| Automatically accepted, across **all** selected pages | ${pct(s.accepted, s.pages)} |
| Correct among automatically accepted | ${pct(s.correctAccepted, s.accepted)} |
| Incorrect automatic acceptances | ${s.wrongAccepted} |
| Sent for review | ${s.needsReview} |
| No extractable text: needs_ocr | ${s.needsOcr} |
| Required review/OCR controls handled correctly | ${pct(s.reviewCorrect, s.reviewRequired)} |
| API/runtime errors | ${s.errors} |

Automatic acceptance is document routing only. Review results are not counted as successful automatic classifications. Source labels remain the identity target on continuation pages even if their isolated text lacks enough evidence to identify the issuer or model. A correct candidate below the gates remains a review result. Empty/dynamic/image-only extraction checks are excluded from recognition accuracy, but included in total coverage and required-review metrics. Errors remain in applicable denominators.

| Stratum | Pages | Accepted | Review / OCR | Errors |
| --- | ---: | ---: | ---: | ---: |
${groups.map(g => { const t = summarize(run.rows.filter(r => r.group === g)); return `| ${g} | ${t.pages} | ${t.accepted} | ${t.needsReview} / ${t.needsOcr} | ${t.errors} |`; }).join('\n')}

The recognition stratum covers **${models.length} AEAT models**: ${models.map(m => m!.replace('aeat-', '')).join(', ')}. Image-only annexes for 130 and 131 are extraction checks and do not count as demonstrated recognition coverage. The non-national checks cover Canary IGIC, Catalan ATC, Bizkaia and the US IRS. Joint 193/296 instructions should not receive a single AEAT form label.

## Per-source results

Links open the original source PDFs; selected pages are **physical PDF page numbers**, not printed form numbers. Original PDFs are downloaded on demand and are not redistributed or relicensed under MIT.

| Source PDF | Physical pages | AEAT model + kind correct | Accepted | Review / OCR | Wrong accepts | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${sourcesTable}

## Review reasons

More than one reason can apply to the same page.

| Reason | Pages |
| --- | ---: |
${reasons}

## Provenance and run details

- Corpus frozen: ${run.manifest.frozenAt}; run: ${run.startedAt} to ${run.completedAt}.
- Commit: \`${run.classifierCommit}\`; working tree dirty at run time: **${run.workingTreeDirty}**.
- Manifest SHA-256: \`${run.manifestSha256}\`.
- Classifier implementation/catalog fingerprint: \`${run.implementationSha256}\`.
- Node: \`${run.environment.node}\`; extraction: \`${run.environment.poppler}\`, layout-preserving UTF-8, NFC normalization, no OCR, no source/filename/page-neighbor hints.
- ${s.modelCalls} successful inference calls, ${s.inputTokens.toLocaleString('en-US')} reported input tokens, ${s.outputTokens.toLocaleString('en-US')} reported output tokens. Median successful call time: **${s.medianModelCallMs ?? 'n/a'} ms**. Network/retries are included; local empty-input returns are excluded. This is one sequential hosted run, not a speed guarantee.

## Interpretation and limits

This corpus was selected deliberately for variety, not randomly from taxpayer workflows. Labels were curated by the assistant from official source titles, fields, text and selected rendered annexes **before predictions**; they have not had independent accountant review. These sources may have appeared in Jev training data; “new to this project” does not imply an uncontaminated model holdout. After publication this becomes a regression set, not a fresh test set for subsequent tuning.

Documents are mainly blank forms, official teaching examples and instructions, including older document layouts and tax years. Recognition does not establish that an old layout or rule remains valid for filing. The corpus does not measure real completed returns, invoice routing, receipts, handwriting, OCR accuracy, adversarial robustness or PGC account allocation. The [13 synthetic accounting cases](README.md) remain a separate development result; **no external PGC accuracy claim is made**.

Pages from the same PDF are correlated; per-source results are shown to expose this. No independent-sample confidence interval or population estimate is justified. ${s.wrongAccepted === 0 ? 'Zero observed wrong acceptances in this small run does not establish zero risk.' : 'Incorrect acceptances require investigation before consequential automation.'} Strict gates can sharply reduce automation coverage. The missing-header and image-only cases intentionally expose limits of isolated-page, text-only classification.

Source and normalized-input hashes pin exactly what was evaluated. A later download or Poppler extraction that differs fails verification before any model call. Hosted inference can still vary despite matching hashes. Acquisition failures excluded **before inference** are recorded in the manifest. The previous four-page Modelo 303 development test and its two source PDFs are excluded from this set.

## Every selected page

The expected jurisdiction is the source's issuing tax administration, including when omitted from an isolated continuation page. Extraction checks with no readable content have no identity target. Raw candidates below thresholds are diagnostic only.

| Page | Expected kind / source jurisdiction / AEAT form | Raw candidate kind / jurisdiction / form | Outcome | Review reasons |
| --- | --- | --- | --- | --- |
${pagesTable}
`;
await writeFile(output, report, { flag: 'wx' });
console.log(`Wrote ${output}`);
