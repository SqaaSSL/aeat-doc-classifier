# Benchmark reports

The latest [adaptive extraction comparison and completed Codex review](extraction-guarded-2026-09-21.md) reuses those 42 reviewed pages as **development data**. Same-run AEAT model + kind recognition improves from **23/30 to 29/30** with isolated OCR, or **23/30 to 30/30** with context. Correct eligible automatic routing with context improves from **13/31 to 19/31**, with **zero wrong acceptances observed**, **10/11 controls held** and **one final error**. Full identity is **38/42**, not 42/42; the report identifies the unsupported-model and illustrated-guidance mistakes. All 168 condition outcomes were reviewed against unchanged references. The [first adaptive attempt](extraction-2026-09-21.md), including a subsequently fixed OCR regression, remains published. Neither run is a fresh validation estimate.

The original [completed Spanish review](spanish-reviewed-2026-09-21.md) covers **42 new pages / 12 official PDFs**, with **all 126 condition outcomes checked by Codex**. AEAT model + kind recognition improves from **19/30** with native text to **23/30** with Spanish OCR and **24/30** with OCR/context. Correct eligible automatic routing improves from **7/31** to **11/31** and **14/31**, with zero wrong automatic acceptances observed. The final condition retains **three errors** and correctly holds **8/11** required-review controls. [Full JSON](spanish-reviewed-2026-09-21.json) and [per-page reviewer findings/corrections](spanish-reviewed-2026-09-21-review.json) preserve the full record. This is a new corpus, not a direct replacement of the old 85.2% score.

The [context retry experiment](context-2026-09-20.md) reuses the original 44-page corpus as a **development comparison**: paired raw model/kind recognition improved from 24/27 to 27/27; eligible automatic acceptance improved from 8/27 to 10/27. All 17 controls stayed held. It adds neighboring evidence, costs more API usage and does not replace the original benchmark with a new accuracy claim.

The original [public PDF benchmark](public-2026-09-20.md) evaluates **44 pages from 21 official PDFs** with labels frozen before inference: **23/27** AEAT pages have the correct raw model and page kind; **9/44** pages are automatically accepted, all nine correctly; **17/17** required review/OCR checks are held. It includes per-page outcomes, source links, hashes and [complete JSON results](public-2026-09-20.json). See [reproduction and metric definitions](../../eval/PUBLIC-BENCHMARK.md). It is a small source-based benchmark, not a production accuracy estimate.

The earlier development evaluation below is kept unchanged for comparison. It includes tuned synthetic cases and a four-page Modelo 303 smoke test; those source PDFs are excluded from the newer public benchmark.

## Development evaluation — 2026-09-20

Live model: `jev-1.13.0`. This report records the v0.1.0 model evaluation; v0.2.0 adds agent CLI integration without changing those classification criteria. Both provider confidence and selected-option probability must reach 0.95. [Machine-readable results, individual outcomes and hashes](2026-09-20.json) accompany this report. No real taxpayer documents were used.

| Set | Cases | Outcome |
| --- | ---: | --- |
| Deterministic unit tests | 20 | All passed; tests verify API validation and routing policy, not model accuracy |
| Synthetic document cases | 26 | 24 met the expected routing outcome; two correct candidates abstained |
| Synthetic accounting cases | 13 | All 13 met expectations: ten account suggestions and three review outcomes |
| Combined synthetic set | 39 | 37 met expectations; no incorrect accepted result observed |
| Selected public AEAT PDF pages | 4 | Correct model and page type on all four; one accepted and three sent to review |

Of 21 synthetic document cases intended to be routable, 19 were accepted. The two abstentions were Modelo 200 (authority below threshold) and Modelo 036 (page type below threshold). Historical Modelo 037, three non-national/foreign forms and empty text produced their expected review/OCR outcomes. Non-form pages are scored on routing and the absence of an accepted AEAT model; the irrelevant form head is not treated as a routing prediction.

The accounting fixtures cover bought and sold professional services, rent, utilities, merchandise, a clearly capitalized computer, recurring SaaS, interest, bank fees, a wage component, a mixed invoice, a tax form and missing direction. Ten account proposals matched the expected codes. Mixed, nontransactional and directionless inputs returned no account. Suggestions always require human review.

The PDF smoke test uses physical pages 1–3 of the [AEAT IVA manual's Modelo 303 example PDF](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/IVA/IVA_2025/Imagenes/Cap_9_303_eu_es.pdf) and physical page 1 of the [2025 Modelo 303 instructions](https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/G414/Inst_mod_303_2025.pdf). Physical PDF page numbers differ from printed form page numbers. The first sample page passed all gates. Both continuation pages and the instruction page were held because authority confidence was lower. The report records hashes of the downloaded files; these files are not redistributed.

The final synthetic run consumed 97,192 input tokens and 17,635 reported output tokens. Median elapsed time for its 37 actual inference calls was 369 ms on the development machine; the two local abstentions were excluded. Network, provider load, catalogs and model versions can change latency and cost. No price or performance guarantee follows from these numbers.

## Iteration record

The first live run met 21/39 expectations, with 18 conservative misses and zero incorrect accepted outputs. After reviewing it, we clarified the difference between a form excerpt and instructional prose, clarified the national authority name, and ignored the irrelevant form head on non-form routes. The same fixtures were reused, with no threshold reduction. The final run met 37/39 expectations. This is development-set tuning, not validation on an untouched test set.

## Limits and reproduction

These examples are small, manually authored and mostly unambiguous. They do not establish population accuracy, confidence calibration, legal correctness, scan/OCR performance, robustness to adversarial content, or coverage across the 33-model/40-account catalogs. The PDF test covers only one model and two documents. Zero observed wrong acceptances in a small set does not imply zero risk.

Run `npm run eval` with `TYPESAFE_API_KEY` for the synthetic set and `npm run eval:pdf` for the PDF set (Poppler required). Outputs go to ignored `eval/results/`. Pin the same model and compare fixture, source and PDF hashes. Hosted-model runs may differ. Build a much larger independent corpus and expert review process before using acceptance to drive consequential actions.

## Spanish OCR regression and new candidate corpus

- [Five-page OCR comparison, 2026-09-20 UTC](ocr-2026-09-20.md): two scanned identities recovered, one newly accepted; one classification failure retained. Reuses known extraction cases.
- [42 reviewed Spanish pages](../SPANISH-SAMPLES.md): labels and OCR inputs frozen before inference; the [completed benchmark and review](spanish-reviewed-2026-09-21.md) report all outcomes. No threshold fitting was performed.
