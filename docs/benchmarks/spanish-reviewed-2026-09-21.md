# Reviewed Spanish benchmark — 2026-09-21 UTC

**42 pages from 12 new official PDFs; nine supported AEAT models.** Codex completed the document review requested by the project owner: all selected pages were rendered and inspected, expected identities and routing policy were frozen before Jev inference, and predictions are scored against those judgments. Reviewer: **Codex (AI assistant and implementation author)**. This is a completed AI review, not a claim that an independent human accountant supplied the labels.

[Full results](spanish-reviewed-2026-09-21.json) · [Frozen judgments and evidence](../../eval/spanish-v1-judged.json) · [Frozen OCR inputs](../../eval/spanish-v1-inputs.json) · [Source catalog](../SPANISH-SAMPLES.md)

## Reviewer conclusion

**OCR and context help, but the current extraction path is still incomplete.** On this same new corpus, AEAT model + page-kind recognition improves from **19/30 (63.3%)** to **23/30 (76.7%)** with Spanish OCR and **24/30 (80.0%)** with context. Correct automatic routing improves from **7/31 (22.6%)** eligible pages to **11/31 (35.5%)** and **14/31 (45.2%)**. All 14 final automatic routes are correct. This is a different, harder corpus from the original 85.2% result; compare the three columns here, not percentages across different datasets.

I checked every prediction against the rendered source and resolved every remaining identity. **No reference labels were changed after seeing predictions.** The [completed per-page review](spanish-reviewed-2026-09-21-review.json) records my findings and corrections for all 42 pages and 126 condition outcomes. These reviewer resolutions remain separate from automatic outputs; they do not inflate the model's score.

| Finding from the completed review | Evidence | Engineering priority |
| --- | --- | --- |
| Five supported AEAT pages still have no usable form body after OCR | 111 physical pages 13/14 and 211 pages 31/34/36 retain just 79–98 bytes of BOE headers/annex text; the images visibly contain model identifiers and forms | Detect header-only extraction and render those pages for a full-page OCR fallback; add these five as regression cases |
| A sixth AEAT miss loses the printed model number | 309 page 6 has 2,414 bytes of extracted body text but no 309 identifier; both OCR conditions choose none | Check small header regions and preserve layout evidence; test targeted OCR or visual verification on missing identifiers |
| Some successful recognition still rests on incomplete evidence | 210 page 25 has only 126 extracted bytes: BOE heading and a 210 annex title; the form body was not recovered | Extraction checks need page-image coverage, not only nonempty text or a correctly guessed label |
| Confidence and document grouping limit automation after recognition is right | Final context results have 24 correct AEAT identities but only 13 accepted AEAT routes; seven eligible pages fail continuity, with overlapping authority/form/kind reasons | Improve annex/continuation grouping and measure per-head calibration; preserve the frozen 0.95 baseline rather than lowering gates to fit these results |
| Guidance illustrations confuse page kind | ATC instruction pages 15/16 are repeatedly called tax_form after OCR; page 2 is corrected by context | Preserve surrounding explanatory prose and distinguish embedded form examples from the containing instructional page |
| Four backend requests fail response validation | Native 369 p11; OCR 117 p9; OCR ATC 650 p5; context 124 p11 | Add safe validator diagnostics and retain isolated results when optional context fails; do not relax distribution validation or silently count errors as abstentions |

The context condition has **three failed page outcomes**, all on required-review controls. It correctly holds **8/11** controls and errors on the remaining three; zero wrong acceptances is not the same as completing all control checks. Its six remaining AEAT recognition misses are exactly the five header-only pages plus the missing-309-header page. The reader can verify every resolution against the source links below.

## All 42 selected pages

| Measure | Native only | Spanish OCR | Same OCR + context |
| --- | ---: | ---: | ---: |
| Correct AEAT model + page kind, before gates | 19/30 (63.3%) | 23/30 (76.7%) | 24/30 (80.0%) |
| Correct complete identity, all pages | 18/42 (42.9%) | 29/42 (69.0%) | 31/42 (73.8%) |
| Correct automatic routing, eligible pages | 7/31 (22.6%) | 11/31 (35.5%) | 14/31 (45.2%) |
| Correct automatic routing, AEAT pages | 6/30 (20.0%) | 10/30 (33.3%) | 13/30 (43.3%) |
| All automatic acceptances | 7/42 (16.7%) | 11/42 (26.2%) | 14/42 (33.3%) |
| Correct among accepted | 7/7 (100.0%) | 11/11 (100.0%) | 14/14 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 |
| Required-review controls held correctly | 11/11 (100.0%) | 9/11 (81.8%) | 8/11 (72.7%) |
| Review / needs OCR / errors | 34 / 0 / 1 | 29 / 0 / 2 | 25 / 0 / 3 |
| Macro AEAT model + kind, equal weight per PDF | 62.5% | 69.6% | 75.9% |

There are **30 supported AEAT pages**, one routable TGSS document and **11 required-review controls**: two unsupported AEAT models, six Catalan tax pages and three Facturae guide pages. Eligible automatic-routing coverage therefore uses **31**, not 42, as its denominator. Complete identity requires all three raw heads to agree with the reviewed labels. AEAT model + kind uses only the 30 supported AEAT pages. A correctly held control can still have a wrong identity. Errors remain in every applicable denominator and never count as a successful review.

## Reserved validation partition — 25 pages

| Measure | Native only | Spanish OCR | Same OCR + context |
| --- | ---: | ---: | ---: |
| Correct AEAT model + page kind, before gates | 9/17 (52.9%) | 13/17 (76.5%) | 14/17 (82.4%) |
| Correct complete identity, all pages | 8/25 (32.0%) | 16/25 (64.0%) | 17/25 (68.0%) |
| Correct automatic routing, eligible pages | 4/17 (23.5%) | 8/17 (47.1%) | 9/17 (52.9%) |
| Correct automatic routing, AEAT pages | 4/17 (23.5%) | 8/17 (47.1%) | 9/17 (52.9%) |
| All automatic acceptances | 4/25 (16.0%) | 8/25 (32.0%) | 9/25 (36.0%) |
| Correct among accepted | 4/4 (100.0%) | 8/8 (100.0%) | 9/9 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 |
| Required-review controls held correctly | 8/8 (100.0%) | 6/8 (75.0%) | 5/8 (62.5%) |
| Review / needs OCR / errors | 20 / 0 / 1 | 15 / 0 / 2 | 13 / 0 / 3 |
| Macro AEAT model + kind, equal weight per PDF | 62.5% | 76.8% | 89.3% |

## Calibration partition — 17 pages

| Measure | Native only | Spanish OCR | Same OCR + context |
| --- | ---: | ---: | ---: |
| Correct AEAT model + page kind, before gates | 10/13 (76.9%) | 10/13 (76.9%) | 10/13 (76.9%) |
| Correct complete identity, all pages | 10/17 (58.8%) | 13/17 (76.5%) | 14/17 (82.4%) |
| Correct automatic routing, eligible pages | 3/14 (21.4%) | 3/14 (21.4%) | 5/14 (35.7%) |
| Correct automatic routing, AEAT pages | 2/13 (15.4%) | 2/13 (15.4%) | 4/13 (30.8%) |
| All automatic acceptances | 3/17 (17.6%) | 3/17 (17.6%) | 5/17 (29.4%) |
| Correct among accepted | 3/3 (100.0%) | 3/3 (100.0%) | 5/5 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 |
| Required-review controls held correctly | 3/3 (100.0%) | 3/3 (100.0%) | 3/3 (100.0%) |
| Review / needs OCR / errors | 14 / 0 / 0 | 14 / 0 / 0 | 12 / 0 / 0 |
| Macro AEAT model + kind, equal weight per PDF | 62.5% | 62.5% | 62.5% |

The partition names were frozen during acquisition. **No threshold fitting or prompt changes were made on either partition.** All three conditions were fixed before inspecting any predictions, and the first completed run is retained. The reserved partition has now been evaluated: if these outcomes inform future changes, it becomes regression data and a new holdout is needed. Exact PDF sources differ from the previous benchmark; publisher/template styles recur, pages are correlated, and provider-training overlap is unknown. The macro measure gives each supported-AEAT PDF equal weight. This is document-recognition verification on a small official-document corpus, not a representative production estimate or a PGC benchmark.

## What the comparison measures

Native-only uses Poppler 26.05.0. Spanish OCR uses LiteParse 2.14.6 with native text plus selective local Tesseract OCR in Spanish. This changes the extraction engine as well as adding OCR, so their difference is an **extraction-pipeline comparison**, not a pure OCR-only effect. All 237 source pages were fingerprinted for the OCR/context condition. Raw text and PDFs remain local and uncommitted.

The third condition reuses each exact isolated OCR reply, locally, then runs the existing context retry when required. It adds up to two preceding pages and one following page from the full source PDF, without oracle annex grouping. Accepted isolated results are preserved. Sparse targets are not filled in from neighbors. Context requires a confident same-document decision; every applicable threshold remains **0.95**. Filenames, URLs, source IDs, reference labels and review notes are never sent as model evidence. Context includes additional, unscored neighboring pages. If a context request fails, its outcome is an error while the valid isolated result is retained. No extra baseline request is used to obtain a better answer.

Blank forms and bank copies count as tax forms, not filed receipts. Technical record layouts and explanatory worked-example introductions count as instructions. Unsupported 117/124 and regional 650/660 map to no supported national model. Continuation labels may use the source cover for issuer/model identity even when the isolated page lacks that evidence; a cautious isolated abstention remains operationally appropriate despite reducing measured recognition or coverage.

## Reasons eligible pages were held

- **native**, eligible pages only (reasons can overlap): low_jurisdiction_confidence: 22; outside_national_aeat_scope: 16; unsupported_or_unclear_document: 9; no_supported_aeat_form: 7; low_form_confidence: 4; low_kind_confidence: 3; unknown_aeat_model: 1.
- **ocr**, eligible pages only (reasons can overlap): low_jurisdiction_confidence: 18; low_form_confidence: 7; outside_national_aeat_scope: 6; unsupported_or_unclear_document: 5; unknown_aeat_model: 2; low_kind_confidence: 2; no_supported_aeat_form: 1.
- **context**, eligible pages only (reasons can overlap): low_jurisdiction_confidence: 13; context_continuity_not_established: 7; unsupported_or_unclear_document: 5; outside_national_aeat_scope: 5; low_form_confidence: 3; low_kind_confidence: 2; unknown_aeat_model: 1.

## Reproduce

From the source checkout with Node.js 22+, Poppler 26.05.0 and the TypeSafe key in the environment:

```sh
npm ci
npm run samples:verify -- --download
npm run eval:spanish -- --prepare
npm run eval:spanish
npm run eval:spanish-report -- eval/results/spanish-TIMESTAMP.json eval/results/spanish-TIMESTAMP-report
```

Preparation performs local Spanish extraction when its ignored cache is absent and verifies every fingerprint before inference. Different extraction output fails the run rather than silently refreshing evidence. Live evaluation requires a clean committed worktree; reports are written incrementally to an ignored timestamped file. The report generator rejects incomplete, duplicated, reordered or mismatched targets and recomputes all scores. Hosted outputs can vary on reruns; preserve each complete run.

## Provenance and measured usage

- Run: 2026-09-21T03:41:22.272Z to 2026-09-21T03:42:10.887Z; model: `jev-1.13.0`; frozen experiment commit: `09b594adb782853e0540f05cce6e7bbe6f1929a1`.
- Implementation/catalog SHA-256: `475fbd4faffcc15a20b1b5aeff1e17092534bc148f0c649b79343e698f75f00c`.
- Reviewed labels SHA-256: `5119a476eab9cc04f2a5fa458c7381c278c47fdea23c3ae9316abed18fb04bcc`; OCR fingerprints SHA-256: `66acd8a1d5270797873fd0507c873541ca7942e10608615ab028f2c3eedd45d3`.
- Raw run SHA-256: `e6bdead874caa06dd08e50c0214b2be2547fded23db78ed586906ca0d2b0619f`.
- **107 logical backend requests**, including 23 context retries; 103 validated replies and 4 failed requests. The provider client's bounded HTTP retries are internal to a logical request.
- Validated replies report **459,375 input tokens** and **63,554 output tokens**. Failed-response usage is unknown, so these are known totals, not a complete billing claim when errors occur. Paired baseline usage is counted once. Per-request and per-condition elapsed times are stored in JSON; context time includes its shared baseline.
- One local full-corpus OCR extraction took 132,089 ms in total. Cached input verification is excluded from classification timings. No speedup or pure OCR latency claim is made.

## Completed reference-label review

Every target below was visually inspected before inference. All acquisition-stage proposed identities were confirmed. Source pages and explanatory review notes make the decisions auditable; unsupported printed models remain explicit in the notes.

| Source page | Frozen partition | Reviewer evidence and decision |
| --- | --- | --- |
| [036-order p7](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf#page=7) | calibration | Printed Modelo 036, national AEAT header and blank census fields identify the form cover. |
| [036-order p8](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf#page=8) | calibration | Printed 036 page 2A with blank identity/address fields; continuation of the national AEAT census form on physical page 7. |
| [036-order p13](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf#page=13) | calibration | Printed 036 page 5 with VAT registration fields. IVA and references to other models do not change its 036 identity. |
| [036-order p15](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf#page=15) | calibration | Printed 036 page 7 with withholding and other tax-obligation boxes; references to 111/115/123 are obligations within 036. |
| [036-order p18](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf#page=18) | calibration | Printed 036 page 10, beneficial-owner identity table; blank form continuation, not an accounting report. |
| [111-order p13](https://www.boe.es/buscar/pdf/2011/BOE-A-2011-4948-consolidado.pdf#page=13) | calibration | Scanned national AEAT Modelo 111 with blank withholding declaration fields. |
| [111-order p14](https://www.boe.es/buscar/pdf/2011/BOE-A-2011-4948-consolidado.pdf#page=14) | calibration | Scanned Modelo 111 partial bank copy with blank fields. An unfilled bank copy is a tax form, not a filing receipt. |
| [123-order p9](https://www.boe.es/buscar/pdf/2007/BOE-A-2007-20485-consolidado.pdf#page=9) | validation-reserved | The scan explicitly prints Modelo 117. It is a national AEAT tax form but 117 is absent from the supported catalog: form none and review required. |
| [123-order p10](https://www.boe.es/buscar/pdf/2007/BOE-A-2007-20485-consolidado.pdf#page=10) | validation-reserved | The scan explicitly prints national AEAT Modelo 123 with blank declaration fields. Adjacent 117/124 annexes must not override it. |
| [123-order p11](https://www.boe.es/buscar/pdf/2007/BOE-A-2007-20485-consolidado.pdf#page=11) | validation-reserved | The scan explicitly prints Modelo 124. It is a national AEAT tax form but 124 is unsupported: form none and review required. |
| [202-form p1](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf#page=1) | calibration | National AEAT header and printed Modelo 202; blank corporate/nonresident installment-payment form. Foral checkboxes do not change the issuer. |
| [202-form p2](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf#page=2) | calibration | Printed Modelo 202 page 2 with continuation of liquidation boxes; the source cover establishes the national AEAT issuer. |
| [202-form p3](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf#page=3) | calibration | National AEAT header and Anexo Modelo 202; additional-data communication is a blank form annex, not completion instructions. |
| [202-form p4](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf#page=4) | calibration | Anexo Modelo 202 page 2; additional-information and supplementary/substitute filing boxes. This is the continuation of physical page 3. |
| [210-211-order p25](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=25) | validation-reserved | Scanned national AEAT Modelo 210, nonresident income-tax self-assessment with blank fields. |
| [210-211-order p27](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=27) | validation-reserved | Printed national AEAT Modelo 210 dividend-detail annex; repeated payer/dividend fields are part of the form. |
| [210-211-order p29](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=29) | validation-reserved | Printed national AEAT Modelo 210 deductible-expense and amortization annex; a form annex, not a bank refund receipt. |
| [210-211-order p31](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=31) | validation-reserved | Printed national AEAT Modelo 211 property-acquisition withholding self-assessment, blank form. |
| [210-211-order p32](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=32) | validation-reserved | Printed Modelo 211 partial collaborating-bank copy, with blank payment fields. It is not proof of filing or payment. |
| [210-211-order p34](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=34) | validation-reserved | Printed national AEAT Modelo 211 Anexo I, list of acquirers, blank form fields. |
| [210-211-order p36](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf#page=36) | validation-reserved | Printed national AEAT Modelo 211 Anexo II, list of nonresident transferors, blank form fields. |
| [309-order p5](https://www.boe.es/buscar/pdf/2003/BOE-A-2003-23809-consolidado.pdf#page=5) | calibration | Scanned national AEAT Modelo 309 nonperiodic VAT declaration with blank fields. |
| [309-order p6](https://www.boe.es/buscar/pdf/2003/BOE-A-2003-23809-consolidado.pdf#page=6) | calibration | Printed national AEAT Modelo 309 partial bank copy. Blank payment section and absence of validation mean a form, not a filing receipt. |
| [347-order p6](https://www.boe.es/buscar/pdf/2008/BOE-A-2008-16973-consolidado.pdf#page=6) | validation-reserved | Printed MODELO 347 with field positions, types and completion descriptions (se consignara). This is record-layout guidance, not an actual return; national AEAT URL appears in the table. |
| [347-order p7](https://www.boe.es/buscar/pdf/2008/BOE-A-2008-16973-consolidado.pdf#page=7) | validation-reserved | Continuation of the 347 record-layout instruction table on physical page 6, including field positions and Agencia Estatal de Administracion Tributaria reference. Instructions, not a return. |
| [369-order p10](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=10) | validation-reserved | National AEAT Modelo 369 non-Union regime first page; blank OSS form. |
| [369-order p11](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=11) | validation-reserved | Printed Modelo 369 page 2 with prior-period correction rows, continuing the non-Union form on physical page 10. |
| [369-order p13](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=13) | validation-reserved | National AEAT Modelo 369 Union-regime first page, blank form. |
| [369-order p14](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=14) | validation-reserved | Printed Modelo 369 page 2 with goods-supply rows, continuing the Union-regime form. |
| [369-order p19](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=19) | validation-reserved | National AEAT Modelo 369 import-regime first page with IOSS and intermediary fields. |
| [369-order p20](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=20) | validation-reserved | Printed Modelo 369 page 2 with prior-period correction rows, continuing the import-regime form. |
| [369-order p22](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf#page=22) | validation-reserved | National AEAT Modelo 369 additional-payment form for a previously submitted declaration. Blank fields make this a tax form, not the receipt of that earlier filing. |
| [catalonia-650-form p1](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/650_es.pdf#page=1) | validation-reserved | Agencia Tributaria de Catalunya header, Generalitat references and printed 650. Regional inheritance-tax form; never national AEAT 650. |
| [catalonia-650-form p5](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/650_es.pdf#page=5) | validation-reserved | Printed 650 liquidation continuation of the ATC form. Regional issuer is established by physical page 1; catalog form none even though the model number is visible. |
| [catalonia-650-instructions p1](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/660_instruccions_es.pdf#page=1) | validation-reserved | ATC header and title explicitly identify instructions for regional 660 and 650; model none for the national catalog. |
| [catalonia-650-instructions p2](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/660_instruccions_es.pdf#page=2) | validation-reserved | ATC header with explanatory prose and illustrative form snippets. The page is instructions, not a blank tax form. |
| [catalonia-650-instructions p15](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/660_instruccions_es.pdf#page=15) | validation-reserved | ATC header; documentation checklist illustration followed by information for filling Modelo 650. Embedded form illustrations do not change the instructional page kind. |
| [catalonia-650-instructions p16](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/660_instruccions_es.pdf#page=16) | validation-reserved | ATC header, definitions and completion prose around form illustrations; regional instructions. |
| [tgss-receipt p1](https://www.seg-social.es/wps/wcm/connect/wss/941db335-fa29-4d82-9d49-54092f71c4e5/ACC_40822.pdf?MOD=AJPERES#page=1) | calibration | Tesoreria General de la Seguridad Social header and Recibo de Liquidacion de Cotizaciones with an EMPRESA PRUEBA example. Route as social_security, not an AEAT filing receipt or bank statement. |
| [facturae-examples p1](https://www.facturae.gob.es/content/dam/facturae/formato/documents/EspanolFacturae3_0.pdf#page=1) | calibration | Formato FACTURAE introduction describes required/optional fields and a format table. Technical instructions with no issuing tax authority, not an invoice. |
| [facturae-examples p4](https://www.facturae.gob.es/content/dam/facturae/formato/documents/EspanolFacturae3_0.pdf#page=4) | calibration | Ejemplo 1 explains a worked invoice example and its six information blocks. Pedagogical prose and diagram make this instructions, not a transaction invoice. |
| [facturae-examples p18](https://www.facturae.gob.es/content/dam/facturae/formato/documents/EspanolFacturae3_0.pdf#page=18) | calibration | Ejemplo 2 explains the second worked example and its CABECERA block; illustrative values remain part of technical instructions, not a real invoice. |

## Every prediction checked against the reviewed labels

The tables cover **all 126 outcomes**, including requests rejected by the response validator. “Correct identity; unnecessarily held” means the reference label is clear in the reviewed source but automatic routing did not pass policy; it does not assert that the model's confidence should simply be overridden.

### native

| Target | Expected kind / authority / model | Predicted kind / authority / model | Routing | Review verdict |
| --- | --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p8 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held for review |
| 036-order p13 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held for review |
| 036-order p15 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p18 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held for review |
| 111-order p13 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 111-order p14 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 123-order p9 | tax_form / aeat / none | other / unknown / none | needs_review | Required review held; identity wrong |
| 123-order p10 | tax_form / aeat / aeat-123 | tax_form / unknown / aeat-123 | needs_review | Identity wrong; held for review |
| 123-order p11 | tax_form / aeat / none | other / unknown / none | needs_review | Required review held; identity wrong |
| 202-form p1 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p3 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p4 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p25 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p27 | tax_form / aeat / aeat-210 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p29 | tax_form / aeat / aeat-210 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p31 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p32 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p34 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p36 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 309-order p5 | tax_form / aeat / aeat-309 | tax_form / unknown / aeat-309 | needs_review | Identity wrong; held for review |
| 309-order p6 | tax_form / aeat / aeat-309 | other / unknown / none | needs_review | Identity wrong; held for review |
| 347-order p6 | instructions / aeat / aeat-347 | instructions / aeat / aeat-347 | needs_review | Correct identity; unnecessarily held for review |
| 347-order p7 | instructions / aeat / aeat-347 | instructions / aeat / none | needs_review | Identity wrong; held for review |
| 369-order p10 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / aeat / aeat-369 | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| 369-order p13 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / aeat / aeat-369 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held for review |
| 369-order p19 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held for review |
| 369-order p22 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | tax_form / regional / none | needs_review | Correct identity; required review |
| catalonia-650-form p5 | tax_form / regional / none | tax_form / aeat / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p1 | instructions / regional / none | instructions / regional / none | needs_review | Correct identity; required review |
| catalonia-650-instructions p2 | instructions / regional / none | instructions / unknown / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p15 | instructions / regional / none | tax_form / aeat / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p16 | instructions / regional / none | instructions / unknown / none | needs_review | Required review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p4 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p18 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |

### ocr

| Target | Expected kind / authority / model | Predicted kind / authority / model | Routing | Review verdict |
| --- | --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p8 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p13 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p15 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p18 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held for review |
| 111-order p13 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 111-order p14 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 123-order p9 | tax_form / aeat / none | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| 123-order p10 | tax_form / aeat / aeat-123 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | tax_form / aeat / none | tax_form / aeat / none | needs_review | Correct identity; required review |
| 202-form p1 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p3 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p4 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p25 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p27 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p29 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p32 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p36 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 309-order p5 | tax_form / aeat / aeat-309 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / aeat-309 | tax_form / aeat / none | needs_review | Identity wrong; held for review |
| 347-order p6 | instructions / aeat / aeat-347 | instructions / aeat / aeat-347 | needs_review | Correct identity; unnecessarily held for review |
| 347-order p7 | instructions / aeat / aeat-347 | instructions / aeat / none | needs_review | Identity wrong; held for review |
| 369-order p10 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p13 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p19 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p22 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | tax_form / regional / none | needs_review | Correct identity; required review |
| catalonia-650-form p5 | tax_form / regional / none | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| catalonia-650-instructions p1 | instructions / regional / none | instructions / regional / none | needs_review | Correct identity; required review |
| catalonia-650-instructions p2 | instructions / regional / none | tax_form / regional / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p15 | instructions / regional / none | tax_form / regional / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p16 | instructions / regional / none | tax_form / regional / none | needs_review | Required review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p4 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p18 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |

### context

| Target | Expected kind / authority / model | Predicted kind / authority / model | Routing | Review verdict |
| --- | --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p8 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p13 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p15 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 036-order p18 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | needs_review | Correct identity; unnecessarily held for review |
| 111-order p13 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 111-order p14 | tax_form / aeat / aeat-111 | other / unknown / none | needs_review | Identity wrong; held for review |
| 123-order p9 | tax_form / aeat / none | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| 123-order p10 | tax_form / aeat / aeat-123 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | tax_form / aeat / none | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| 202-form p1 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p3 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 202-form p4 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p25 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | needs_review | Correct identity; unnecessarily held for review |
| 210-211-order p27 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p29 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p32 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 210-211-order p36 | tax_form / aeat / aeat-211 | other / unknown / none | needs_review | Identity wrong; held for review |
| 309-order p5 | tax_form / aeat / aeat-309 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / aeat-309 | tax_form / aeat / none | needs_review | Identity wrong; held for review |
| 347-order p6 | instructions / aeat / aeat-347 | instructions / aeat / aeat-347 | needs_review | Correct identity; unnecessarily held for review |
| 347-order p7 | instructions / aeat / aeat-347 | instructions / aeat / aeat-347 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p10 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p13 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p19 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | needs_review | Correct identity; unnecessarily held for review |
| 369-order p22 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | tax_form / regional / none | needs_review | Correct identity; required review |
| catalonia-650-form p5 | tax_form / regional / none | no valid prediction | Invalid Jev response; no classification accepted. | ERROR; counted as failure |
| catalonia-650-instructions p1 | instructions / regional / none | instructions / regional / none | needs_review | Correct identity; required review |
| catalonia-650-instructions p2 | instructions / regional / none | instructions / regional / none | needs_review | Correct identity; required review |
| catalonia-650-instructions p15 | instructions / regional / none | tax_form / regional / none | needs_review | Required review held; identity wrong |
| catalonia-650-instructions p16 | instructions / regional / none | tax_form / regional / none | needs_review | Required review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p4 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
| facturae-examples p18 | instructions / not_applicable / none | instructions / not_applicable / none | needs_review | Correct identity; required review |
