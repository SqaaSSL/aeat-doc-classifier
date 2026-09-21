# Reviewed Spanish sample corpus

Research and review completed **2026-09-21**. **42 selected pages from 12 official PDFs**, with the original **17 calibration / 25 reserved-validation** split preserved. Codex visually reviewed every selected page, froze the reference identities before inference, ran the unchanged classifier in three conditions, and completed the revision of all 126 predictions. [Full benchmark](benchmarks/spanish-reviewed-2026-09-21.md) · [Completed per-page review](benchmarks/spanish-reviewed-2026-09-21-review.json).

The [original candidate manifest](../eval/calibration-v1.json) remains an immutable acquisition snapshot, including its historical “review pending” status. The [reviewed-label manifest](../eval/spanish-v1-judged.json) supersedes that status and records evidence for all 42 pages; all proposed identities were confirmed. [OCR fingerprints](../eval/spanish-v1-inputs.json) freeze all 237 source pages used for extraction/context. No PDF or extracted text is committed. The reviewer is Codex (AI assistant and implementation author), not a separately recruited human accountant. The requested review is complete, with no external-review prerequisite outstanding.

## Verified sample documents

| Official source | Physical pages selected | Partition | Why it is useful |
| --- | --- | --- | --- |
| [BOE: Modelo 036 (2025 annex)](https://www.boe.es/boe/dias/2025/01/09/pdfs/BOE-A-2025-410.pdf) | 7, 8, 13, 15, 18 | calibration | 2025 model 036 annex only; exclude duplicate copies and model 030 annex. Native text. This BOE order also contains already-seen 030 layouts, which are not selected. |
| [BOE: Modelo 111](https://www.boe.es/buscar/pdf/2011/BOE-A-2011-4948-consolidado.pdf) | 13, 14 | calibration | Scanned model 111 declaration and bank copy; rendered and visually inspected. Exclude near-duplicate declaration copy and mailing envelope. |
| [BOE: 117 / 123 / 124 annexes](https://www.boe.es/buscar/pdf/2007/BOE-A-2007-20485-consolidado.pdf) | 9, 10, 11 | validation-reserved | Scanned annexes: unsupported 117 and 124 flank supported 123. Visually inspected. Keep the entire multi-model source in one split. |
| [AEAT: Modelo 202 (2022)](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Sociedades/Sociedades_2022/Imagenes/AnexoII_Mod202-2022_es_es.pdf) | 1, 2, 3, 4 | calibration | 2022 native-text form and additional-data annex, including continuations. Historical sample, not current filing guidance. |
| [BOE: Modelos 210 / 211](https://www.boe.es/buscar/pdf/2010/BOE-A-2010-19707-consolidado.pdf) | 25, 27, 29, 31, 32, 34, 36 | validation-reserved | Scanned nonresident form annexes; visually inspected. Exclude duplicate recipient copies. Two supported models in one source remain together. |
| [BOE: Modelo 309](https://www.boe.es/buscar/pdf/2003/BOE-A-2003-23809-consolidado.pdf) | 5, 6 | calibration | Scanned model 309 declaration and partial bank copy; visually inspected. Mailing envelope excluded. |
| [BOE: Modelo 347 record-layout instructions](https://www.boe.es/buscar/pdf/2008/BOE-A-2008-16973-consolidado.pdf) | 6, 7 | validation-reserved | Record-layout instructions, not a completed return; review confirms these are instructions, not return pages. |
| [BOE: Modelo 369](https://www.boe.es/boe/dias/2021/06/18/pdfs/BOE-A-2021-10161.pdf) | 10, 11, 13, 14, 19, 20, 22 | validation-reserved | Native-text annex: non-Union, Union, import and prior-declaration-payment layouts; all seven selected pages visually inspected. Keep all variants in one split. |
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

Downloads use only the government hosts listed in the verifier, with bounded responses, no redirects and no provider credentials. Cached PDFs live in ignored `eval/corpus/calibration-v1/`. Changes in file hashes, page counts or native extraction fail verification; never silently refresh the frozen manifest. Native fingerprints were generated with Poppler 26.05.0. The completed OCR condition has separate frozen extraction hashes, version and options in `eval/spanish-v1-inputs.json`; verify them with `npm run eval:spanish -- --prepare`.

## What independent means here

- None of these PDF URLs/hashes appears in public-v1. The original Modelo 303 development sources are also excluded. This removes exact-source reuse, not all resemblance between tax templates.
- Whole PDFs and declared model/source families stay in one partition. The ATC form and its instructions remain together; all 210/211 annexes remain together. Selected supported AEAT model families do not cross partitions. These sparse model-disjoint groups support an initial generalization check, not per-model threshold fitting for all 33 models.
- The existing public-v1 corpus is regression/development data. The 25-page partition was reserved from model tuning and has now been evaluated once in the frozen three-condition experiment. It is not a blind annotation study. BOE/AEAT styles recur across sets, and overlap with Jev pretraining is unknown.
- The 036 source also contains unselected 030 annexes, a previously used model family. Those pages must not be called unseen validation. Do not automatically classify whole mixed BOE orders as a single document or let unrelated annexes provide context.
- Labels were completed by Codex using official provenance, source context and visual inspection of all selected pages before predictions. The same agent subsequently checked all outcomes and recorded corrections separately. This is AI adjudication, not independent human annotation. No reference label was changed to match a prediction.

## Completed protocol and what comes next

1. **Completed:** visually review all 42 selected pages; record kind, source authority, supported model, required-review policy and evidence. Codex is the named reviewer.
2. **Completed:** freeze source and extraction hashes, labels, prompts/catalog, model and scoring before inference. Commit `09b594a` contains the frozen experiment. Keep extraction and classification failures in end-to-end denominators.
3. **Completed:** evaluate native text, Spanish OCR and that same OCR decision with optional context. Preserve all outcomes and the unchanged 0.95 gates. No threshold fitting was performed on either partition.
4. **Completed:** inspect every prediction, record corrections separately, publish per-page outcomes, source-macro recognition and both partitions. The original classifier outputs and frozen labels remain intact.
5. **Next engineering priorities:** detect and repair header-only OCR, recover missing model identifiers, improve annex grouping and distinguish form illustrations from instructional pages. These evaluated samples now provide regression cases; use a new holdout for subsequent changes.
6. **Broader validation:** add permissioned, de-identified completed filings, filing receipts, real invoices, rectifying invoices, payroll, rotated/low-quality scans and mixed packets across generators and businesses. Fit any thresholds on reviewed calibration data and report coverage versus accepted precision. The current public seed is too small to substantiate a high production precision target.

## PGC sources and remaining gap

The University of Cantabria publishes a [Contabilidad Financiera course with practical cases covering PGC and PGC-PYMES](https://ocw.unican.es/course/view.php?id=60&lang=es). It is a useful lead for accounting exercises with explicit transaction context. The site links **CC BY-NC-SA 4.0** terms: its content is not bundled or relicensed MIT here. Individual downloadable exercises, answer keys and current-rule suitability still need checking before inclusion. No independent PGC score is claimed.

For account-allocation ground truth, each case needs the entity activity, purchase/sale perspective, accounting plan, transaction components and relevant capitalization policy, plus a reviewed principal account or an explicit abstention target. A public invoice by itself does not supply all of that. Teacher answers or model-generated labels must not be treated as current expert labels without review.

## Reuse

The repository contains original metadata and annotations under MIT. Source PDFs retain their publishers’ terms; public availability is not a blanket MIT grant. See [data provenance](../DATA-LICENSE.md).
