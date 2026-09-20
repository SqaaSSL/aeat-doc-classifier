# Development evaluation — 2026-09-20

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
