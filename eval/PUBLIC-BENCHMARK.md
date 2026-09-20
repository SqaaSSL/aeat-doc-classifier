# Public PDF benchmark

`public-v1.json` freezes **44 physical pages from 21 government PDFs** retrieved on 2026-09-20. It records the source URL, file SHA-256, byte count, PDF page count, selected physical pages, normalized-input SHA-256, input size, labels, required review behavior and annotation notes. Original source PDFs and extracted text remain in ignored `eval/corpus/public-v1/`; neither is redistributed.

The benchmark uses the existing page classifier and its existing 0.95 confidence/probability gates. **Do not tune prompts or gates against this set and continue calling it unseen evaluation.** Treat published results as a regression baseline. Future independent evaluations need a new corpus and separately frozen labels.

## Reproduce

Clone the GitHub repository, use Node.js 22+ and install [Poppler](https://poppler.freedesktop.org/) (`pdfinfo` and `pdftotext` on `PATH`). Then:

```sh
npm ci
npm run check

# Download and verify every source and extracted input. No API key/call required.
npm run eval:public -- --download-only

# Supply your own key securely through the environment; do not commit it.
export TYPESAFE_API_KEY="your-key"
npm run eval:public
```

The runner verifies the entire corpus **before inference**. Missing files are downloaded only from allowlisted government HTTPS hosts, without provider credentials. Changed source files, changed extraction output, duplicate recognition inputs, oversized inputs or missing pages stop the run; nothing is silently replaced, truncated or dropped. Downloads are bounded to 50 MiB. If an upstream URL changes, locate the exact hashed original or define a new corpus version; do not edit old hashes to force an old result to reproduce.

Each live run pins `jev-1.13.0` explicitly, even if `TYPESAFE_MODEL` is set elsewhere. Only normalized page text enters the classifier. Expected labels, source URLs, filenames and neighboring pages never enter model state. An empty extraction returns locally without an API call. Text-only BOE headers on image-based annexes still reach Jev and should be held for review.

Results are saved after each page to a new, timestamped `eval/results/public-v1-*.json`. They include full candidate distributions, provider confidence, gate decisions, audit hashes, reported token usage, per-page timings and any errors. No extracted document text or credential is saved in the run. API/runtime errors are retained in the denominators. Exit 1 means an API/runtime error or an incorrect automatic acceptance; ordinary abstention is not a runner failure. The script never resumes or cherry-picks a previous run automatically.

Generate a Markdown report offline from a complete result (use your actual timestamp):

```sh
npm run eval:report -- eval/results/public-v1-TIMESTAMP.json eval/results/public-v1-TIMESTAMP.md
```

The generator refuses partial runs, mismatched labels or summaries, and refuses to overwrite an existing report. For publication, copy the reviewed JSON to `docs/benchmarks/`, generate its matching Markdown there, and update the README table from that exact run. Publishing requires no new inference. Do not overwrite previous result artifacts to conceal regressions.

## Labels and selection

This is a purposive sample, selected for tax-model, page-layout, issuer and extraction variation, not a random sample of business paperwork. Labels were curated by the assistant from public source titles, form fields and page text before predictions. The two image-based BOE annexes were also rendered and visually inspected. These labels have **not** been independently reviewed by a tax professional.

The identity target is the underlying source document's kind, issuing tax administration and single supported AEAT model. A continuation page can omit those identifying details; `unknown` or a review outcome is then operationally reasonable, while failing the source-identity recognition target. This distinction prevents using filenames to make isolated-page accuracy appear stronger than it is.

- **27 AEAT recognition pages:** first pages and continuations of 11 supported models (030, 100, 102, 184, 190, 200, 232, 349, 390, 840, 848). Tax-form pages include blank forms and the official Modelo 390 teaching example. Instruction pages are explanatory prose, not forms.
- **12 scope/ambiguity controls:** 10 non-national pages (Canary Islands, Catalonia, Bizkaia, IRS), plus two joint 193/296 instruction pages. All require review, with no accepted national AEAT form. A foral instruction that mentions 303 must not be accepted as AEAT 303.
- **5 extraction checks:** three empty extractions (one blank 102 page and two dynamic payment PDFs) must return `needs_ocr`; two image-based 130/131 annexes with only BOE/annex/page headings in the text layer must abstain. These checks measure handling of missing evidence, not OCR or form-recognition accuracy.

Physical page numbers differ from printed form page numbers. Near-duplicate taxpayer/administration copies were deliberately avoided; selected input hashes prevent exact duplicates in recognition/control strata. Several pages from one source remain correlated. Source-level tables expose the distribution; no independent-sample statistical interval is reported.

Exceptions to the first-content-page selection are documented in the manifest: Modelo 100 payment page 49; distinct 840 pages 1/3/5; 390 form pages 2–4 after its numerical worksheet; Bizkaia body pages 4/12/14/22 exposing application entry, explicit 303 mentions and foral rules. These choices were made **before model inference**. Failed 036 and Álava source downloads are recorded as acquisition exclusions. The two previously evaluated AEAT 303 source PDFs are excluded entirely.

## Metric definitions

- **Top-model accuracy:** AEAT recognition pages whose raw form candidate matches the label, divided by all 27 AEAT recognition pages, including failed requests. Confidence gates do not affect this diagnostic metric.
- **Model + kind accuracy:** requires both the raw form and page-kind labels to match on those same pages.
- **Full candidate identity:** kind, source jurisdiction and form all match, across the 39 text-bearing recognition/control pages. The expected raw form for non-national or multi-model controls is `none`.
- **Automatic acceptance coverage:** pages with `status=accepted` divided by all 44 selected pages, including extraction checks and failures.
- **Accepted precision:** correct routed kind/jurisdiction/form among accepted results. Accepting a required-review control is always incorrect, even if one candidate happens to match. No accepted pages means an undefined precision, not 100%.
- **Required-review handling:** the 17 controls reach their required review/OCR outcome. Wrong raw candidates may still be safely held; that is counted as correct handling, not correct recognition.
- **Latency and usage:** sequential, successful inference calls only for median latency; local empty-input outcomes are excluded. Reported model tokens are recorded, not converted into a guaranteed bill.

## Scope and licensing

The code, original annotations and report are MIT. Government PDF rights remain with their respective publishers; see [DATA-LICENSE.md](../DATA-LICENSE.md). Public availability is not a new license. Download source material from the recorded links subject to its original terms.

This set includes older forms and instructions for identity testing; it does not certify current filing validity or tax rules. No private taxpayer files are used. It does not evaluate real completed returns, invoices, PGC allocation, handwriting, OCR quality or adversarial robustness. The existing 13 synthetic PGC/accounting fixtures remain a separate development evaluation. A credible external PGC benchmark needs transaction context and independently reviewed account labels; an online invoice alone is not enough ground truth.

These PDFs are newly evaluated by this project, but Jev's training-data overlap is unknown. A single hosted run can vary on repetition. Small, correlated samples and zero observed incorrect acceptance do not establish production reliability.
