# Research and design decisions

Reviewed 2026-09-20. Intended first users: autónomos, SMEs and their advisers. The initial deliverable is a reusable TypeScript library and CLI with reproducible evaluations.

## What we extend

[kyotofin/tax-doc-classifier](https://github.com/kyotofin/tax-doc-classifier) demonstrates a useful pattern: extract page text, describe the candidate forms, ask Jev for a closed-set decision, and gate downstream actions. Its README describes an IRS-specific corpus and Apache-2.0 licensing. Those measurements and data do not establish Spanish performance. This repository independently implements the pattern under MIT, with Spanish tax catalogs and a separate accounting decision.

[TypeSafe's model documentation](https://docs.typesafe.ai/models) says Jev does not expose customer fine-tuning/LoRA: extension happens through state, question instructions and criteria. English is its strongest language. We retain Spanish document text and official Spanish labels, but use explicit English decision criteria; this choice is an engineering hypothesis tested on the development cases, not proof that English prompts are universally better.

The [official API](https://docs.typesafe.ai/api) exposes `POST https://api.typesafe.ai/v1/systemone`, bearer authentication and Choice/Score/Noul questions. We use Choice only, with explicit unknown options and fewer than the documented 255 options per question. All question answers are independent. An irrelevant form prediction is ignored on a confidently identified invoice or bank-statement route. Confidence and winning probability are [distinct provider outputs](https://docs.typesafe.ai/confidence).

Jev's [documented limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) include numerical precision, indirection and adversarial content. Therefore this version does not infer amounts, dates, deadlines, tax eligibility or complete journal entries. Document text is marked as evidence in prompts, but prompt wording is not a security guarantee. Human review and independently validated policy remain necessary around consequential workflows.

## Spanish tax taxonomy

The [AEAT model directory](https://sede.agenciatributaria.gob.es/Sede/presentar-consultar-declaraciones-modelo.html) is the primary catalog. Each of the 33 curated definitions links to its official procedure page. Important confusions are described explicitly: 303/390, 111/190, 115/180, 123/193, 130/131, 200/202, 216/296, 347/349 and 720/721. Identifying a form is separate from deciding whether a taxpayer must file it.

The AEAT [2025 change notice for Modelo 037](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2025/capitulo-01-novedades-destacar-2025/modelo-037.html) records its suppression effective 3 February 2025. It remains recognizable for document archives, with `status: historical` and `validUntil: 2025-02-02`; it is never returned as an accepted current model. This metadata is not a complete legal validity engine.

The page taxonomy distinguishes the form itself, filing acknowledgement, completion instructions and tax notices. A CSV printed on a receipt is evidence of document type; its presence does not validate the receipt or prove filing. A professional's invoice for preparing Modelo 303 is an invoice. A bank debit for the same model is a bank document. Foral, Canary and other regional administrations are separate jurisdiction classes even where they reuse model numbers.

Pages are processed independently. Continuation pages can omit an authority or form title; this version may abstain and does not infer identity from an adjacent page. It does not segment mixed taxpayer packets or assume a filename is evidence. OCR and document grouping are explicit follow-on work.

## Plan General de Contabilidad

The reference texts are the consolidated [Real Decreto 1514/2007, PGC](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19884) and [Real Decreto 1515/2007, PGC-PYMES](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19966). We verified the selected account numbers against both texts. The 40-account subset is shared between the two plans; this does not make their recognition and measurement rules identical. Sector adaptations and entity-specific subaccounts are outside the initial scope.

Account proposals need caller-supplied transaction direction and plan. Optional business activity helps distinguish sales of merchandise from own production and ordinary from ancillary income. A suitability question rejects a whole payroll, mixed invoice or combined principal/interest repayment when it requires splitting. Ordinary invoice VAT/withholding lines do not turn its principal expense into multiple principal categories, but those amounts and their treatment still require a separate workflow.

The 29 principal candidates cover common expense, revenue and fixed-asset categories. Eleven tax, settlement and bank accounts are reference-only: having an invoice does not by itself establish input VAT deductibility, output VAT liability, a withholding obligation or the balancing accounts for a full entry. RETA payments, capitalization ambiguity, finance leases and personal/business-use ambiguity must be reviewed. Every proposal explicitly requires human review.

An autónomo's tax books and a company's PGC accounting are different workflows. This library does not decide which accounting or record-keeping obligations apply. Before mapping any source data to an AEAT return, use the applicable year's rules, taxpayer context and an independent fiscal review.

## Future interoperability

AEAT publishes [declaration file layouts](https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos.html) and [electronic IVA/IRPF record-book formats](https://sede.agenciatributaria.gob.es/Sede/iva/pre-303/nuevo-servicio-pre303-importacion-libros-electronico/formatos-electronicos-libros-registro.html). These are candidates for future **validated exports**, not formats generated by this release.

[SII](https://sede.agenciatributaria.gob.es/Sede/iva/suministro-inmediato-informacion.html) involves electronic VAT record submission. [VERI*FACTU/SIF](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes.html) governs billing systems and associated records. Neither is equivalent to classifying a PDF or suggesting a PGC account. No conformity or filing capability is claimed here. As of the research date, the cited AEAT FAQ states mandatory adaptation dates of 1 January 2027 for corporate income taxpayers and 1 July 2027 for the remaining covered taxpayers, following Real Decreto-ley 15/2025. These dates are research context only and are not embedded in executable rules.

## Evidence and limits

Initial evaluation consists of 39 handwritten synthetic examples and four selected public PDF pages concerning Modelo 303. Both are development checks. No customer tax documents or secrets are published. The first live run exposed excess abstention in authority/type classification; the criteria were clarified without lowering the 0.95 gates. Reports preserve the baseline and final counts and document the development-set reuse.

For production, build a legally usable corpus spanning issuers, years, layouts, scans, languages, ordinary and rectifying documents, regional forms and mixed packets. Label it with a Spanish accounting professional, split by document/issuer, keep an untouched test set, and measure false acceptance, review rate and coverage per class. Unsupported forms and adversarial documents need explicit negative examples. Calibration needs substantially more evidence than this release contains.
