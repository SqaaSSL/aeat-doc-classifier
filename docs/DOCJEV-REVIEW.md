# DocJev review and AEAT improvement plan

Reviewed 2026-09-20 at [jerryjliu/docjev revision 9ed0fe0](https://github.com/jerryjliu/docjev/tree/9ed0fe05984ce1906af9272b8b400c8d46520f98). The useful lesson is to preserve document structure and measure complete workflows. Our initial classifier was asking isolated pages to supply evidence often printed only on another page.

## What to adopt

| Idea | Why it matters here | Status |
| --- | --- | --- |
| Ordered page context, with bounded requests | Restores missing model titles and issuer headers on continuations | Implemented as an **opt-in experimental retry**, with a separate continuity gate |
| Explicit document boundaries | Prevents a preceding AEAT form from contaminating another taxpayer, authority or model | Continuity guard implemented; a full packet segmenter is still needed |
| Parser/OCR adapters with provenance | Native PDF text alone misses scanned forms and some dynamic PDFs | Implemented in v0.4.0 as optional Spanish LiteParse OCR; [regression report](benchmarks/ocr-2026-09-20.md) |
| Separate extraction, decision and total usage metrics | A retry can improve answers while increasing cost; reused extraction must not be counted as a model speedup | Paired experiment reports extraction separately and totals both attempts |
| A second-engine baseline on identical input | Establishes whether errors come from extraction, prompts, missing context or Jev itself | Planned; no second model was evaluated here |
| Reviewable evidence and preserved original artifacts | Makes errors inspectable and prevents improved-looking reports from hiding old results | Source hashes, original benchmark and per-page paired results retained |

DocJev's [architecture](https://github.com/jerryjliu/docjev/blob/9ed0fe05984ce1906af9272b8b400c8d46520f98/docs/architecture.md) classifies whole documents and asks about page boundaries when splitting packets. It also offers local parsing and optional cloud OCR. Its [reported pilot](https://github.com/jerryjliu/docjev/blob/9ed0fe05984ce1906af9272b8b400c8d46520f98/benchmarks/results/real-small-v1-run01/report.md) classifies 40 complete English documents into five broad categories. That task differs from our Spanish page-kind/authority/33-model routing task. Its 40/40 result does not imply 100% AEAT accuracy or the same automatic-acceptance coverage.

The repository is [Apache-2.0](https://github.com/jerryjliu/docjev/blob/9ed0fe05984ce1906af9272b8b400c8d46520f98/LICENSE). Our contextual implementation is original TypeScript, inspired by the architecture; no DocJev implementation, assets or dataset were copied. This repository remains MIT. A future contribution that copies code must retain the applicable license and notices.

## What the original numbers mean

The initial public run recognized **23/27** AEAT model/page-kind pairs and automatically accepted **9/27** eligible pages. The broader **9/44** denominator also includes 17 deliberately required-review/extraction controls. Increasing acceptance by accepting those controls would make the system worse.

Among the 18 eligible pages not accepted, **15** had low authority confidence. Reasons overlap: six had low kind confidence and three had low form confidence. Four raw identity misses involved continuation content: two 390 pages guessed as 303, a 100 continuation and a 349 instruction continuation. These patterns favor recovering evidence and document structure before changing thresholds. [Original results](benchmarks/public-2026-09-20.json).

The 0.95 defaults were conservative policy choices, not fitted Spanish thresholds. TypeSafe explains that its confidence is computed from the option distribution; confidence and winning probability are distinct values, **not independent verification signals**. Both should be calibrated against observed task outcomes. [Provider confidence documentation](https://docs.typesafe.ai/confidence). The provider also recommends narrow, literal questions and filtering irrelevant context, which argues for bounded windows rather than concatenating entire large tax manuals. [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

## What we implemented and measured

`classifyPageWithContext` first applies the existing isolated-page classifier. Accepted and empty-text results are preserved. An uncertain page with enough text may be retried with up to two predecessor pages and one successor, constrained to a contiguous window and a conservative request-size limit. It adds a same-document continuity decision and applies the existing routing rules and default 0.95 gates. Neither source filenames nor source URLs nor gold labels are sent to Jev. The result preserves both attempts and hashes every context page.

The CLI exposes this through `--experimental-context` for PDFs. The context option itself does **not** split PDFs into documents, perform OCR or prove that neighboring pages have a common taxpayer. The continuity decision is itself model-based and can be wrong. A short target with only a scanned-page header cannot acquire a form identity just from its neighbors. One uncertainty can therefore remain even after the raw form becomes correct.

In the [first paired experiment](benchmarks/context-2026-09-20.md), isolated attempts scored **24/27** for model + kind and accepted **8/27** eligible pages. Context scored **27/27**, accepted **10/27**, and held all **17/17** controls, with no wrong acceptance observed. The original first run remains **23/27 and 9/27**; the difference between isolated runs demonstrates hosted-model variation.

This is a development ablation on the already inspected corpus, with additional neighboring-page evidence. It is not a new independent benchmark and does not establish 100% real-world accuracy. Automation coverage remains low (**37.0%** of eligible pages), so the option remains experimental and disabled by default. The extra 31 retries also increased reported usage; the report totals both stages.

## Next improvements, in order

1. **Build a separate calibration and validation corpus.** Collect permissioned/redacted real completed returns, receipts, invoices, scanned pages and mixed packets from multiple issuers, years and software templates. Have an independent Spanish tax/accounting reviewer check labels. Keep source/template families disjoint across development, calibration and final validation; never tune on the final split. Public-v1 is now a regression set.
2. **Group pages before relying on headers.** Combine explicit model headers, printed pagination, document/filing references and taxpayer/period consistency with a separately evaluated boundary decision. Test both category changes and adjacent returns of the same model for different taxpayers or periods. Report exact packet match and boundary precision/recall as well as page accuracy. Preserve uncertainty and never make all pages inherit the first page's model.
3. **Separate extraction quality from classification uncertainty.** Add a local OCR adapter and image/nonblank checks only when native text is absent or inadequate. Evaluate [LiteParse](https://github.com/run-llama/liteparse) against the existing Poppler path; configure and test Spanish/co-official language data rather than assuming an English OCR default is adequate. [Tesseract publishes supported language models](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html). Dynamic forms may need rendering before OCR. Record parser/language/version and input provenance; a genuinely blank page is not a successful OCR recognition.
4. **Calibrate decisions separately.** Fit kind, authority, form and continuity thresholds on the calibration split, report accepted precision versus coverage and inspect confusion pairs. Use stricter rules for accounting/posting than reversible document routing. Our experiment still had nine AEAT pages blocked by authority confidence, nine by form confidence and six by continuity; these overlap. A single blanket threshold does not resolve their different failure modes. Lowering it on public-v1 until the numbers look better would overfit.
5. **Evaluate an optional stronger-model fallback.** Send only unresolved cases to a separately configured model, using the same evidence and strict output validation; route disagreements for review. Benchmark Jev-only, fallback-only and cascade modes on the identical untouched inputs, including actual latency and token cost. Agreement between models is evidence to evaluate, not proof of correctness. No additional provider is configured or silently used today.
6. **Validate accounting independently.** Build PGC ground truth around entity activity, purchase/sale direction, capitalization policy, tax territory and transaction components. A public invoice without that context is not a sufficient account-allocation label. Do not use better document recognition to claim better PGC advice.

The near-term target is a useful increase in supported-document acceptance **at a measured acceptable error rate on new data**. No production accuracy or automation target is promised from this small development comparison. Keeping filing, tax arithmetic and posting outside this classifier remains deliberate.

## Follow-up: Spanish OCR and candidate data

The [v0.4 OCR adapter](OCR.md) uses LiteParse directly from TypeScript, with Spanish OCR, complete-page checks, a bounded subprocess and extraction provenance. The original Python adapter was not copied. The [fresh sample research](SPANISH-SAMPLES.md) adds a source-hashed 42-page candidate corpus with separate calibration and reserved-validation partitions. No thresholds have been changed. Codex has now [completed the visual review and three-condition benchmark](benchmarks/spanish-reviewed-2026-09-21.md): the remaining misses point first to header-only OCR and document grouping. The report identifies the reviewer as the AI implementation author, and preserves every error.
