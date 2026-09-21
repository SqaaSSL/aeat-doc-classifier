# Luna label-only follow-up — 2026-09-21

**A separately frozen, post-hoc output-format experiment on the same 42 development pages.** After observing shared Choice-contract failures in the [main run](luna-2026-09-21.md), we asked fresh Luna sessions for only three labels. All isolated OCR evidence and catalog criteria remain identical; the instructions and output schema change. This is one new pass, not a repair or selection of the best predictions from multiple runs. [Frozen protocol](../../eval/luna-labels-v1-protocol.json) · [Method](../../eval/LUNA-BENCHMARK.md#separate-follow-up-labels-without-probability-distributions) · [Every result and source evidence](luna-labels-2026-09-21.json).

## Recognition comparison — isolated OCR only

| Measure | Jev Choice contract | Luna Choice contract | Luna labels only |
| --- | ---: | ---: | ---: |
| AEAT model + page kind | 29/30 (96.7%) | 28/30 (93.3%) | 28/30 (93.3%) |
| Complete identity, all pages | 32/42 (76.2%) | 34/42 (81.0%) | 31/42 (73.8%) |
| Failed page outcomes | 3 | 3 | 0 |
| Macro AEAT recognition, equal PDF weight | 93.8% | 91.3% | 87.5% |

Failures remain in every denominator. Label-only outputs contain no confidence or probability estimates: **automatic-acceptance coverage and precision are not measured for this follow-up.** The main run remains unchanged. A different single sample can vary as well as the output format; this is not a causal estimate of schema effects or an optimized maximum-capability prompt.

## Completed review

Codex, the AI assistant and implementation author, checked all 42 follow-up predictions against the frozen visual references. This is not independent human annotation. [Per-page review and corrections](luna-labels-2026-09-21-review.json). No references or original predictions changed.

- **31 complete identities match; 11 do not.** Six pages return `unknown` authority: 036 p15/p18, 202 p4, 347 p6/p7 and Facturae p1. Some isolated continuations lack issuer evidence, so uncertainty can be reasonable even though it does not match the source-based reference.
- **Unsupported Modelo 124 is guessed as 123.** The original Luna Choice run correctly returned `none`; simplifying the output did not preserve every earlier success.
- **Five kinds are wrong:** 347 p6 and ATC instruction p2/p15/p16 are called forms; Facturae p18 is called an invoice. The original source review identifies all five as guidance, including explanatory prose around form/table examples.
- **347 p7 also loses its model identity.** It returns `none` instead of 347; neighboring source context establishes the reference identity, but this isolated follow-up provides no neighbors.
- All 42 responses pass label validation. This avoids the three failures in Luna's original isolated Choice condition, but full identity falls from 34/42 to 31/42. Median observed call time falls from 22,531 ms to 5,916 ms; output volume also falls. These are single-run workflow observations, not a causal model-speed or accuracy guarantee.

The simpler output format is useful to evaluate, but this run does not support claiming it improves recognition. The repeated invoice-example mistake remains a concrete target for future evaluation. No automatic-acceptance decision is inferred from labels alone.

## Usage and elapsed time

- calls: 42
- failed: 0
- knownInputTokens: 582048
- knownCachedInputTokens: 239616
- knownOutputTokens: 2329
- knownReasoningOutputTokens: 1127
- callsWithUnknownUsage: 0
- medianCallMs: 5916
- totalCallMs: 286221

Cached input and reasoning output are subcategories, not additional totals. Timing includes CLI startup and Codex system/skill overhead; it is not pure API latency. No per-call currency bill is available. Every request used a fresh ephemeral session requesting GPT-5.6 Luna at low reasoning effort with tools disabled. No resolved snapshot identifier is exposed by this CLI. Source text, labels and prior outputs were not available through files or tools to the model.

## Original partitions, both now development data

| Partition | AEAT model + kind | Complete identity | Errors |
| --- | ---: | ---: | ---: |
| calibration | 13/13 (100.0%) | 12/17 (70.6%) | 0 |
| validation-reserved | 15/17 (88.2%) | 19/25 (76.0%) | 0 |

## Provenance and reproduction

- Run 2026-09-21T06:43:21.347Z to 2026-09-21T06:48:07.649Z; commit `67b0a69c2fb9075d9d13ed2fa6d9ea95ccca1713`; CLI `codex-cli 0.154.0`.
- Protocol SHA-256 `d4da607072dd667fafdce296e8cb752a80d10b5c7551ef0daa87dbb54a21d3d9`; reference SHA-256 `5119a476eab9cc04f2a5fa458c7381c278c47fdea23c3ae9316abed18fb04bcc`.
- Raw run SHA-256 `84aaf65cdb97e2fdaf2d75e5c4fa88b372f94baf596b73492c1ec77057865100`; main report SHA-256 `7a8cef10a9bd91b1fa4a830e6ba9b8f9ce9e0ad4b80d565551452d3988ba25b2`.
- All 42 isolated evidence-and-question hashes match the original Jev OCR requests. Source text, PDFs and images are not bundled.

Generate this report with `node --import tsx eval/luna-labels-report.ts eval/results/luna-labels-TIMESTAMP.json docs/benchmarks/luna-2026-09-21.json eval/results/luna-labels-report-TIMESTAMP`. The generator verifies frozen labels, protocols, target order, OCR fingerprints and paired request hashes and recomputes all scores.

## Every prediction against the unchanged reference

| Target | Expected kind / authority / model | Predicted kind / authority / model | Mismatched fields |
| --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | None |
| 036-order p8 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | None |
| 036-order p13 | tax_form / aeat / aeat-036 | tax_form / aeat / aeat-036 | None |
| 036-order p15 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | jurisdiction |
| 036-order p18 | tax_form / aeat / aeat-036 | tax_form / unknown / aeat-036 | jurisdiction |
| 111-order p13 | tax_form / aeat / aeat-111 | tax_form / aeat / aeat-111 | None |
| 111-order p14 | tax_form / aeat / aeat-111 | tax_form / aeat / aeat-111 | None |
| 123-order p9 | tax_form / aeat / none | tax_form / aeat / none | None |
| 123-order p10 | tax_form / aeat / aeat-123 | tax_form / aeat / aeat-123 | None |
| 123-order p11 | tax_form / aeat / none | tax_form / aeat / aeat-123 | form |
| 202-form p1 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | None |
| 202-form p2 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | None |
| 202-form p3 | tax_form / aeat / aeat-202 | tax_form / aeat / aeat-202 | None |
| 202-form p4 | tax_form / aeat / aeat-202 | tax_form / unknown / aeat-202 | jurisdiction |
| 210-211-order p25 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | None |
| 210-211-order p27 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | None |
| 210-211-order p29 | tax_form / aeat / aeat-210 | tax_form / aeat / aeat-210 | None |
| 210-211-order p31 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | None |
| 210-211-order p32 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | None |
| 210-211-order p34 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | None |
| 210-211-order p36 | tax_form / aeat / aeat-211 | tax_form / aeat / aeat-211 | None |
| 309-order p5 | tax_form / aeat / aeat-309 | tax_form / aeat / aeat-309 | None |
| 309-order p6 | tax_form / aeat / aeat-309 | tax_form / aeat / aeat-309 | None |
| 347-order p6 | instructions / aeat / aeat-347 | tax_form / unknown / aeat-347 | kind, jurisdiction |
| 347-order p7 | instructions / aeat / aeat-347 | instructions / unknown / none | jurisdiction, form |
| 369-order p10 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p11 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p13 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p14 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p19 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p20 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| 369-order p22 | tax_form / aeat / aeat-369 | tax_form / aeat / aeat-369 | None |
| catalonia-650-form p1 | tax_form / regional / none | tax_form / regional / none | None |
| catalonia-650-form p5 | tax_form / regional / none | tax_form / regional / none | None |
| catalonia-650-instructions p1 | instructions / regional / none | instructions / regional / none | None |
| catalonia-650-instructions p2 | instructions / regional / none | tax_form / regional / none | kind |
| catalonia-650-instructions p15 | instructions / regional / none | tax_form / regional / none | kind |
| catalonia-650-instructions p16 | instructions / regional / none | tax_form / regional / none | kind |
| tgss-receipt p1 | social_security / not_applicable / none | social_security / not_applicable / none | None |
| facturae-examples p1 | instructions / not_applicable / none | instructions / unknown / none | jurisdiction |
| facturae-examples p4 | instructions / not_applicable / none | instructions / not_applicable / none | None |
| facturae-examples p18 | instructions / not_applicable / none | invoice / not_applicable / none | kind |
