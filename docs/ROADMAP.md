# Roadmap

## 0.1 — delivered foundation

- MIT TypeScript library and CLI, pinned Jev integration, bounded requests and validated distributions.
- 33 AEAT definitions, page-type and authority routing, historical Modelo 037.
- Selected PGC/PGC-PYMES principal-account suggestions with explicit caller context and review status.
- Text and PDF ingestion, synthetic evaluation, public PDF smoke test, offline CI and source documentation.

## 0.2 — delivered agent CLI

- Prebuilt CLI distribution, bounded UTF-8 stdin, JSON errors, explicit exit codes and optional review failure status.
- Offline setup checks, catalogs and a machine-readable command contract.
- Portable skill with documented Claude Code, ChatGPT/Codex, OpenClaw and generic subprocess setup.
- No hosted MCP service; terminal-capable agents use the CLI directly.

## 0.3 — trustworthy document coverage

Delivered in v0.3.0: an opt-in experimental context retry with continuity gates, preserved isolated decisions, bounded neighboring-page evidence, and a [paired development report](benchmarks/context-2026-09-20.md). Recognition improved on the reused set; automatic acceptance remains low. The [DocJev review](DOCJEV-REVIEW.md) prioritizes independent labels, document grouping, OCR, separate calibration and a measured fallback. The broader coverage work below remains open.

Initial public baseline delivered: [44 pages from 21 official PDFs](benchmarks/public-2026-09-20.md), a frozen source/input-hashed manifest, separate recognition/acceptance/review metrics, and reproducible evaluation. The first run accepted 9/44 pages with no incorrect acceptance observed; continuation pages and missing issuer evidence remain key limitations. This does not meet the representative-corpus exit criterion below.

1. Build a permissioned and redacted Spanish document corpus with expert labels; keep issuer/document families disjoint across development and test splits.
2. Delivered in v0.4.0: optional Spanish LiteParse OCR with provenance and a five-page regression report. Broader scan quality, co-official-language and dynamic-form evaluation remain open.
3. Add packet segmentation and page-to-document grouping without inheriting labels across unrelated attachments or taxpayers.
4. Expand AEAT models from primary sources, preserve historical revisions, hash downloaded references, and publish reviewed catalog diffs.
5. Calibrate type, jurisdiction and form gates separately. Report precision among accepted decisions, total coverage, abstention and confusion matrices; evaluate adversarial content and co-official languages.

Exit criterion: documented performance on a held-out representative corpus, not a target invented from the US reference project.

## Delivered in 0.4 — local OCR and sample acquisition

- Optional Spanish LiteParse OCR, local parse command and agent-facing provenance.
- Five-page extraction regression report with failures retained.
- 42 fresh pages from 12 official PDFs, split 17/25; [Codex review and three-condition benchmark completed](benchmarks/spanish-reviewed-2026-09-21.md), with unchanged gates and per-page adjudication.
- The reviewed extraction failures inform the v0.5 work below. Use a new holdout after these reviewed results inform changes.

## Delivered in 0.5 — adaptive extraction

- Detect substantial scanned content behind sparse native text and retry the whole page as a raster.
- Bounded 300-DPI OCR and a conditional 450-DPI retry for unresolved model headers, with explicit per-page provenance and warnings.
- Automatic, original selective, and explicit raster modes in the CLI/library; no additional OCR dependency or service.
- Preserve readable selective model headers before considering replacement; retain the first development regression in the public record.
- [Completed same-run comparison and Codex review](benchmarks/extraction-guarded-2026-09-21.md): 29/30 isolated AEAT recognition, 30/30 with context, and 19/31 correct eligible contextual acceptance. One final failure remains. These are development results, with unchanged gates and frozen reference labels.
- Next: improve annex grouping and response-validator diagnostics, then evaluate a new holdout. Broader scan quality and character/amount accuracy remain unmeasured.

## Delivered evaluation — Jev versus Luna

- [Five-condition comparison and completed review](benchmarks/luna-2026-09-21.md) on the 42 development pages: identical OCR/catalog for both text backends, optional context, and a separate Luna image-only condition.
- [Post-hoc label-only follow-up](benchmarks/luna-labels-2026-09-21.md) separates output-contract failures from simple label recognition. All original outcomes remain published.
- Next: investigate teaching-example versus invoice mistakes, improve validation diagnostics, and evaluate an optional text/vision fallback with separate calibration on new document families. The existing 0.95 gates cannot be transferred between models as equal-risk thresholds. Production backend remains Jev.

## Next — accounting assistance

1. Extract invoice fields with evidence spans and immutable source links; exact decimal arithmetic, document totals and identifier checks belong in code.
2. Split multi-category invoices and payrolls into reviewed components, introduce entity-specific charts, and collect explicit capitalization and business-use policy.
3. Suggest complete balanced draft entries only after rates, tax territory, exemptions, reverse charge, withholding, timing and deductibility are explicitly validated.
4. Export reviewed data to supported accounting packages and AEAT book layouts, with year-specific validation and traceable corrections.

Account acceptance never substitutes for fiscal treatment or user authorization to post an entry.

## Separate projects or later adapters

- Facturae/XML and other structured formats should be parsed and validated before semantic classification.
- SII and VERI*FACTU require their own current schemas, certificate handling, lifecycle and conformance work.
- Regional/foral/IGIC packs require local source catalogs and separately measured performance.
- A review UI can consume this library; no hosted service or user-data store is required by the core.
