# Fresh Spanish calibration candidates

Research completed 2026-09-21 (Dubai). **42 selected pages from 12 downloaded, fingerprinted official PDFs**: **17 calibration pages and 25 reserved validation pages**. No Jev calls, threshold fitting or classifier-driven sample selection have been performed on this corpus. These are source-disjoint candidates, not independently reviewed ground truth or a production validation set.

The [manifest](../eval/calibration-v1.json) freezes URLs, complete PDF SHA-256/size/page count, physical page selections, declared family groups, proposed labels and diagnostic native-text fingerprints. No PDF or extracted text is committed. The verification command checks all 42 selections without a model key.

## Verified sample documents

| Official source | Physical pages selected | Partition | Why it is useful |
| --- | --- | --- | --- |
| [BOE: Modelo 036 (2025 annex)](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf) | 7, 8, 13, 15, 18 | calibration | 2025 model 036 annex only; exclude duplicate copies and model 030 annex. Native text. This BOE order also contains already-seen 030 layouts, which are not selected. |
| [BOE: Modelo 111](https://www.boe.es/buscar/pdf/2011/BOE-A-2011-4948-consolidado.pdf) | 13, 14 | calibration | Scanned model 111 declaration and bank copy; rendered and visually inspected. Exclude near-duplicate declaration copy and mailing envelope. |
| [BOE: 117 / 123 / 124 annexes](https://www.boe.es/buscar/pdf/2007/BOE-A-2007-20485-consolidado.pdf) | 9, 10, 11 | validation-reserved | Scanned annexes: unsupported 117 and 124 flank supported 123. Visually inspected. Keep the entire multi-model source in one split. |
| [AEAT: Modelo 202 (2022)](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf) | 1, 2, 3, 4 | calibration | 2022 native-text form and additional-data annex, including continuations. Historical sample, not current filing guidance. |
| [BOE: Modelos 210 / 211](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf) | 25, 27, 29, 31, 32, 34, 36 | validation-reserved | Scanned nonresident form annexes; visually inspected. Exclude duplicate recipient copies. Two supported models in one source remain together. |
| [BOE: Modelo 309](https://www.boe.es/buscar/pdf/2003/BOE-A-2003-23809-consolidado.pdf) | 5, 6 | calibration | Scanned model 309 declaration and partial bank copy; visually inspected. Mailing envelope excluded. |
| [BOE: Modelo 347 record-layout instructions](https://www.boe.es/buscar/pdf/2008/BOE-A-2008-16973-consolidado.pdf) | 6, 7 | validation-reserved | Record-layout instructions, not a completed return; page-kind interpretation needs independent review. |
| [BOE: Modelo 369](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf) | 10, 11, 13, 14, 19, 20, 22 | validation-reserved | Native-text annex: non-Union, Union, import and prior-declaration-payment layouts; representative headers visually inspected. Keep all variants in one split. |
| [ATC: Modelo 650 in Spanish](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/650_es.pdf) | 1, 5 | validation-reserved | Spanish-language ATC 650 form and continuation; visually inspected. Regional scope control. Native extraction misses some title/header content. |
| [ATC: 650 / 660 instructions in Spanish](https://atc.gencat.cat/web/.content/documents/05_doc_models/arxius/660_instruccions_es.pdf) | 1, 2, 15, 16 | validation-reserved | Spanish-language joint 650/660 instructions; same family and split as the ATC form. Regional controls. |
| [TGSS: public RLC example](https://www.seg-social.es/wps/wcm/connect/wss/941db335-fa29-4d82-9d49-54092f71c4e5/ACC_40822.pdf?MOD=AJPERES) | 1 | calibration | Public TGSS example linked as recibo (2008); visually inspected. Non-tax-authority routing control, not an AEAT filing receipt. |
| [Facturae: official 3.0 examples guide](https://www.facturae.gob.es/content/dam/facturae/formato/documents/EspanolFacturae3_0.pdf) | 1, 4, 18 | calibration | Official Facturae 3.0 teaching guide with two worked examples and embedded XML. These pages are instructions, not real invoice PDFs; no PGC target or invoice-accuracy credit. |

The supported AEAT sample identities are **036, 111, 123, 202, 210, 211, 309, 347 and 369**. The 347 pages are explanatory technical instructions, not actual return pages. Models 117/124 are useful unsupported-model controls. The Catalan sources are written in Spanish and exercise authority confusion, not Catalan OCR. The RLC is an official published example, not evidence of any current payment. Facturae pages are a teaching guide with illustrative data and XML; they do not establish performance on real invoice PDFs, structured Facturae parsing, invoice field extraction or PGC accounts. Older samples are for document recognition, not current filing rules.

## Acquire and verify

From a source checkout with Node.js 22+, project dependencies and Poppler:

```sh
npm run samples:verify -- --download
npm run samples:verify
```

Downloads use only the government hosts listed in the verifier, with bounded responses, no redirects and no provider credentials. Cached PDFs live in ignored `eval/corpus/calibration-v1/`. Changes in file hashes, page counts or native extraction fail verification; never silently refresh the frozen manifest. Native fingerprints were generated with Poppler 26.05.0. An OCR condition needs its own frozen extraction hashes/version/options before a live evaluation.

## What independent means here

- None of these PDF URLs/hashes appears in public-v1. The original Modelo 303 development sources are also excluded. This removes exact-source reuse, not all resemblance between tax templates.
- Whole PDFs and declared model/source families stay in one partition. The ATC form and its instructions remain together; all 210/211 annexes remain together. Selected supported AEAT model families do not cross partitions. These sparse model-disjoint groups support an initial generalization check, not per-model threshold fitting for all 33 models.
- The existing public-v1 corpus is regression/development data. The new 25-page partition is reserved from model tuning, but has been inspected for curation. It is not a blind annotation study. BOE/AEAT styles recur across sets, and overlap with Jev pretraining is unknown.
- The 036 source also contains unselected 030 annexes, a previously used model family. Those pages must not be called unseen validation. Do not automatically classify whole mixed BOE orders as a single document or let unrelated annexes provide context.
- Labels are proposed by the assistant from official provenance, text and visual inspection of scanned/special pages. An independent Spanish tax/accounting reviewer has not checked them. Retain disagreements and ambiguous cases; do not substitute model predictions for gold labels.

## Calibration protocol before claiming an improvement

1. Independently review each selected page and its permitted document context. Finalize page kind, source authority, form identity, visual blank/illegible status and required-review policy. Record reviewer identity, rationale and adjudication; version label corrections separately.
2. Add permissioned, de-identified completed filings and filing receipts from multiple years, document generators and businesses. Include real invoices, rectifying invoices, payroll/RNT, rotated/low-quality scans and mixed packets. These public templates are a useful seed, not a replacement for that distribution.
3. Freeze extraction options and hashes, prompt/catalog versions, model and scoring rules. Keep classification errors and extraction failures in end-to-end denominators. Compare native-only and OCR conditions separately.
4. Fit per-head thresholds on the 17-page calibration partition only, or preferably a larger reviewed extension grouped by source/template family. Report accepted precision versus coverage, uncertainty intervals, type/authority/form confusions, and macro results by source rather than treating correlated pages as independent. This seed is too small to substantiate a high production precision target.
5. Evaluate the reserved 25 pages once after decisions are frozen; report the complete run, including errors. Once outcomes influence changes, retire that partition into regression data and acquire a new holdout. Do not lower thresholds until these pages pass.

## PGC sources and remaining gap

The University of Cantabria publishes a [Contabilidad Financiera course with practical cases covering PGC and PGC-PYMES](https://ocw.unican.es/course/view.php?id=60&lang=es). It is a useful lead for accounting exercises with explicit transaction context. The site links **CC BY-NC-SA 4.0** terms: its content is not bundled or relicensed MIT here. Individual downloadable exercises, answer keys and current-rule suitability still need checking before inclusion. No independent PGC score is claimed.

For account-allocation ground truth, each case needs the entity activity, purchase/sale perspective, accounting plan, transaction components and relevant capitalization policy, plus a reviewed principal account or an explicit abstention target. A public invoice by itself does not supply all of that. Teacher answers or model-generated labels must not be treated as current expert labels without review.

## Reuse

The repository contains original metadata and annotations under MIT. Source PDFs retain their publishers’ terms; public availability is not a blanket MIT grant. See [data provenance](../DATA-LICENSE.md).
