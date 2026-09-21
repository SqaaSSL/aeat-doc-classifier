# Adaptive extraction development comparison — 2026-09-21

**A paired development comparison on the same 42 reviewed pages, not a new holdout.** The extraction change was designed after inspecting the previous failures. A [first development iteration](extraction-2026-09-21.md) recovered all six original misses but introduced a 210-to-216 header regression; this separate run tests the added preservation guard. Codex's [frozen reference labels](../../eval/spanish-v1-judged.json) and [completed source-page review](spanish-reviewed-2026-09-21-review.json) remain unchanged. No classifier prompts, catalog definitions or 0.95 gates were changed. [Full results and all request outcomes](extraction-guarded-2026-09-21.json) · [New extraction fingerprints](../../eval/extraction-v3-inputs.json) · [Original reviewed benchmark](spanish-reviewed-2026-09-21.md).

## Same-run comparison — all 42 pages

| Measure | Selective OCR | Selective + context | Adaptive OCR | Adaptive + context |
| --- | ---: | ---: | ---: | ---: |
| Correct AEAT model + page kind | 23/30 (76.7%) | 23/30 (76.7%) | 29/30 (96.7%) | 30/30 (100.0%) |
| Correct complete identity, all pages | 28/42 (66.7%) | 31/42 (73.8%) | 33/42 (78.6%) | 38/42 (90.5%) |
| Correct automatic routing, eligible pages | 10/31 (32.3%) | 13/31 (41.9%) | 16/31 (51.6%) | 19/31 (61.3%) |
| Correct among accepted | 10/10 (100.0%) | 13/13 (100.0%) | 16/16 (100.0%) | 19/19 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 | 0 |
| Required-review controls held correctly | 10/11 (90.9%) | 9/11 (81.8%) | 10/11 (90.9%) | 10/11 (90.9%) |
| Review / needs OCR / errors | 31 / 0 / 1 | 27 / 0 / 2 | 25 / 0 / 1 | 22 / 0 / 1 |
| Macro AEAT recognition, equal weight per PDF | 69.6% | 69.6% | 93.8% | 100.0% |

The corpus contains 30 supported AEAT pages, one routable TGSS example, and 11 controls that require review. Correct automatic routing uses 31 eligible pages as its denominator. Raw model + kind recognition is separate from complete identity and accepted routing. Errors stay in denominators and do not count as a successful review.

## Completed outcome review

Reviewer: **Codex, the AI assistant and implementation author**. All **168 outcomes** were checked against the unchanged source-page references; the [completed per-page review and corrections](extraction-guarded-2026-09-21-review.json) record the findings. This is AI adjudication, not independent human annotation. The original 42-page visual review remains linked above; the 111 bank copy, 210 annex and 124 control images were reopened to check the recovery/regression findings.

- **All six original extraction misses are recovered:** 111 p13/p14, 211 p31/p34/p36 and 309 p6. Five now pass automatic routing; 111 p14 retains a continuity-review requirement. Fuller extraction also allows 210 p25 to be accepted. These are six additional correct automatic routes versus the same-run selective baseline, with no previously accepted route lost.
- **The first iteration's regression is fixed:** 210 p27 keeps its readable selective header and remains correctly identified as 210, rather than 216. It is still held by the continuity gate in this run. The [first iteration](extraction-2026-09-21.md) remains published; this is a separately frozen code revision, not a rerun selected for a better score.
- **One isolated supported-AEAT miss remains:** 347 p7 needs context to identify its instruction continuation. Adaptive context also keeps 347 p6 as instructions; selective context incorrectly treats it as a form. Both pages remain under review.
- **Unsupported-model identity regresses on the 124 control:** 123-order p11 visibly says Modelo 124, outside the supported catalog. Selective isolated OCR chooses `none`; adaptive OCR and context guess 123. The unchanged gates hold it, but that does not make the identity correct. Keep the expected catalog identity `none` and investigate unsupported-model handling separately.
- **Two illustrated instruction pages remain wrong:** ATC guidance p15/p16 are still called forms. Their regional scope keeps them under review. They are not national AEAT forms, and are not counted as correct complete identities.
- **One final failure remains:** unsupported Modelo 117 at 123-order p9 returns an invalid Jev response. The same request/error is shared across all conditions. The separate selective-context request for Modelo 124 also fails; the adaptive-context result is valid but has the wrong raw identity described above. Neither failure counts as a successful review. There are two unique failed backend requests in total.

The final condition has **19 accepted, 22 review, 0 needs OCR, 1 error**. All 19 automatic routes match the reference. Of 31 eligible pages, the other 12 have correct complete identities but remain under jurisdiction, kind, form or continuity gates. Of 11 required-review controls, ten are held and one fails; three of the held controls still have an incorrect raw identity. Thus complete identity is **38/42**, even though supported-AEAT model + kind recognition is **30/30**.

**Next work:** improve annex boundaries and continuity evidence for the 12 correctly identified but held eligible pages; distinguish explicit unsupported headers and illustrated guidance; expose safe response-validation diagnostics. Test further changes on a new holdout. No amount, NIF, period, field-level OCR or PGC accuracy claim follows from this result.

## What changed

The old selective engine sometimes extracts a BOE text header while leaving the scanned form unread. The adapter now inspects native-text/image signals. An image covering at least 15% of the page with fewer than 500 native characters (or garbled native text) triggers full-page raster OCR. Native-text-rich pages keep their existing extraction. The revised guard also preserves a selective result with at least 200 letters/digits and a readable model header, avoiding unnecessary replacement of useful OCR evidence. This uses the same optional LiteParse 2.14.6 engine with Spanish Tesseract; no new service, credential or dependency was introduced.

The fallback starts at 300 DPI. If the extracted page contains a form cue but has no readable model header with nearby 2–4 digit text, it tries 450 DPI. It selects that retry only when header evidence is recovered without severe text loss. Header checks accept any printed number, including unsupported models; no expected label, filename or catalog lookup is used. Digits are not corrected or invented. The second pass is a whole-page raster pass, not a crop or character-accuracy guarantee. Development probes used 300, 450 and 600 DPI; 600 was not consistently better and is not a production retry.

Each rendered image is capped at 24 million pixels, lowering DPI on oversized pages; the whole document still has a 120-second worker deadline. Empty or severely depleted replacements retain the selective result in auto mode and emit a warning. Explicit raster mode requests raster output for every page. Hashes, reasons, chosen attempts and unresolved-header warnings accompany each page. These are diagnostic heuristics, not proof of complete extraction. Original PDFs are untouched.

## Experimental controls

- Both the old and new extraction pipelines were evaluated in this run. Identical serialized Jev requests share the exact same validated reply **or error**, so an unchanged input does not get another chance solely because it appears in two conditions. New context windows are queried when neighboring text changes.
- Within each context pair, the exact isolated reply is reused before any optional contextual request. Context still needs its existing continuity gate, and sparse targets still cannot inherit a model. All original PDF neighbors are available; no gold-based annex segmentation is introduced.
- All 237 source-page selective-text hashes were checked against the frozen previous inputs. The first stage is unchanged; only flagged pages receive replacement text. 8/42 selected target inputs changed; 8/42 used raster output. Additional unscored neighbors can change too.
- New extraction hashes and code were committed before the live comparison. Each of the 168 condition outcomes is preserved, including invalid provider replies. No score-driven rerun, threshold tuning or reference-label revision followed this run.
- The 17/25 original partition names below are retained for traceability. Both are now development/regression data because their earlier outcomes informed this implementation. Neither is a fresh validation estimate. OCR character/amount accuracy and PGC account accuracy are not measured here.

## Original 25-page partition

| Measure | Selective OCR | Selective + context | Adaptive OCR | Adaptive + context |
| --- | ---: | ---: | ---: | ---: |
| Correct AEAT model + page kind | 13/17 (76.5%) | 13/17 (76.5%) | 16/17 (94.1%) | 17/17 (100.0%) |
| Correct complete identity, all pages | 15/25 (60.0%) | 17/25 (68.0%) | 17/25 (68.0%) | 21/25 (84.0%) |
| Correct automatic routing, eligible pages | 7/17 (41.2%) | 8/17 (47.1%) | 11/17 (64.7%) | 12/17 (70.6%) |
| Correct among accepted | 7/7 (100.0%) | 8/8 (100.0%) | 11/11 (100.0%) | 12/12 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 | 0 |
| Required-review controls held correctly | 7/8 (87.5%) | 6/8 (75.0%) | 7/8 (87.5%) | 7/8 (87.5%) |
| Review / needs OCR / errors | 17 / 0 / 1 | 15 / 0 / 2 | 13 / 0 / 1 | 12 / 0 / 1 |
| Macro AEAT recognition, equal weight per PDF | 76.8% | 76.8% | 87.5% | 100.0% |

## Original 17-page partition

| Measure | Selective OCR | Selective + context | Adaptive OCR | Adaptive + context |
| --- | ---: | ---: | ---: | ---: |
| Correct AEAT model + page kind | 10/13 (76.9%) | 10/13 (76.9%) | 13/13 (100.0%) | 13/13 (100.0%) |
| Correct complete identity, all pages | 13/17 (76.5%) | 14/17 (82.4%) | 16/17 (94.1%) | 17/17 (100.0%) |
| Correct automatic routing, eligible pages | 3/14 (21.4%) | 5/14 (35.7%) | 5/14 (35.7%) | 7/14 (50.0%) |
| Correct among accepted | 3/3 (100.0%) | 5/5 (100.0%) | 5/5 (100.0%) | 7/7 (100.0%) |
| Wrong automatic acceptances | 0 | 0 | 0 | 0 |
| Required-review controls held correctly | 3/3 (100.0%) | 3/3 (100.0%) | 3/3 (100.0%) | 3/3 (100.0%) |
| Review / needs OCR / errors | 14 / 0 / 0 | 12 / 0 / 0 | 12 / 0 / 0 | 10 / 0 / 0 |
| Macro AEAT recognition, equal weight per PDF | 62.5% | 62.5% | 100.0% | 100.0% |

## Every selected page considered for fallback

| Page | UTF-8 bytes before → after | Attempted DPI | Chosen extraction | Warnings |
| --- | --- | --- | --- | --- |
| 111-order p13 | 79 → 8627 | 300 | 300 DPI | none |
| 111-order p14 | 79 → 2432 | 300, 450 | 450 DPI | none |
| 123-order p9 | 3447 → 3447 |  | selective retained | none |
| 123-order p10 | 3305 → 3305 |  | selective retained | none |
| 123-order p11 | 4180 → 6025 | 300 | 300 DPI | none |
| 210-211-order p25 | 126 → 7712 | 300 | 300 DPI | none |
| 210-211-order p27 | 1655 → 1655 |  | selective retained | none |
| 210-211-order p29 | 2113 → 2113 |  | selective retained | none |
| 210-211-order p31 | 98 → 5649 | 300 | 300 DPI | none |
| 210-211-order p32 | 2061 → 2061 |  | selective retained | none |
| 210-211-order p34 | 79 → 2290 | 300, 450 | 450 DPI | none |
| 210-211-order p36 | 79 → 3468 | 300, 450 | 450 DPI | none |
| 309-order p5 | 6428 → 6428 |  | selective retained | none |
| 309-order p6 | 2414 → 2037 | 300 | 300 DPI | none |

## Reproduce

Use a source checkout, Node.js 22+, Poppler for the original corpus verifier, and the optional LiteParse dependency installed by `npm ci`:

```sh
npm ci
npm run samples:verify -- --download
npm run eval:spanish -- --prepare
npm run eval:extraction -- --prepare
npm run eval:extraction
npm run eval:extraction-report -- eval/results/extraction-TIMESTAMP.json eval/results/extraction-TIMESTAMP-report
```

Live inference uses `TYPESAFE_API_KEY` and requires a clean committed tree. For a fresh checkout, regenerate the adaptive cache with `npm run eval:extraction -- --prepare`; an existing committed input manifest is verified, never overwritten. Any fingerprint change stops the comparison. Classifier text/URLs/labels are not mixed: the model receives page text and the existing Choice questions only. Raw PDFs and text stay in ignored local directories; published artifacts contain hashes and predictions.

## Usage and provenance

- Run: 2026-09-21T05:50:45.368Z to 2026-09-21T05:51:17.372Z; commit: `ff00f64a3fad4a0eabe61fff422bc40a4b58a7b1`; model: `jev-1.13.0`.
- Implementation SHA-256: `1eec3992e1ac3d8a21b4b295d79e9e5d190cd11c75cb9fd6cd5061821ed941e5`; reviewed labels SHA-256: `5119a476eab9cc04f2a5fa458c7381c278c47fdea23c3ae9316abed18fb04bcc`.
- Baseline inputs SHA-256: `66acd8a1d5270797873fd0507c873541ca7942e10608615ab028f2c3eedd45d3`; new inputs SHA-256: `71b29352b7d34a650e227fb672a8e2f0848964a8a0e95362c0714fe080931139`; raw run SHA-256: `f7a11b6a254bc5db604e4d778ebd8388feaeafd844a5afe229c6de7878a30a21`.
- 81 unique backend requests, 53 reused requests, 2 unique failed requests. Internal bounded HTTP retries are not separate logical requests in this ledger.
- Validated unique replies report 392,341 input and 49,346 output tokens. Failed-response usage is unknown; this is not an exact billing statement when errors occur. Shared replies are counted once.
- Full adaptive extraction of all 237 pages took 213,759 ms on this machine. Native extraction plus selective OCR alone previously took 132,089 ms in a separate run; that historical timing is not a controlled speed comparison. Per-source extraction timings are in the input manifest. Inference times with response caching are not latency benchmarks.

## Every prediction against the reviewed source labels

### selective / ocr

| Target | Predicted kind / authority / model | Status | Judge verdict |
| --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p8 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p13 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p15 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p18 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held by gates |
| 111-order p13 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 111-order p14 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 123-order p9 | No valid prediction | error | Failed; counted in denominator |
| 123-order p10 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | tax_form / aeat / none | needs_review | Correct identity and required review |
| 202-form p1 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p3 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p4 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 210-211-order p25 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p27 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p29 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 210-211-order p32 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 210-211-order p36 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 309-order p5 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / aeat-303 | needs_review | Identity wrong; held by gates |
| 347-order p6 | instructions / aeat / aeat-347 | needs_review | Correct identity; held by gates |
| 347-order p7 | instructions / aeat / none | needs_review | Identity wrong; held by gates |
| 369-order p10 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held by gates |
| 369-order p13 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held by gates |
| 369-order p19 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p22 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-form p5 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p1 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p2 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p15 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p16 | tax_form / regional / none | needs_review | Review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p4 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p18 | instructions / not_applicable / none | needs_review | Correct identity and required review |

### selective / context

| Target | Predicted kind / authority / model | Status | Judge verdict |
| --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p8 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p13 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p15 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p18 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 111-order p13 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 111-order p14 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 123-order p9 | No valid prediction | error | Failed; counted in denominator |
| 123-order p10 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | No valid prediction | error | Failed; counted in denominator |
| 202-form p1 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p3 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p4 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 210-211-order p25 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p27 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p29 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 210-211-order p32 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 210-211-order p36 | other / unknown / none | needs_review | Identity wrong; held by gates |
| 309-order p5 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / none | needs_review | Identity wrong; held by gates |
| 347-order p6 | tax_form / aeat / aeat-347 | needs_review | Identity wrong; held by gates |
| 347-order p7 | instructions / aeat / aeat-347 | needs_review | Correct identity; held by gates |
| 369-order p10 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p13 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p19 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p22 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-form p5 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p1 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p2 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p15 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p16 | tax_form / regional / none | needs_review | Review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p4 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p18 | instructions / not_applicable / none | needs_review | Correct identity and required review |

### adaptive / ocr

| Target | Predicted kind / authority / model | Status | Judge verdict |
| --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p8 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p13 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p15 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p18 | tax_form / unknown / aeat-036 | needs_review | Identity wrong; held by gates |
| 111-order p13 | tax_form / aeat / aeat-111 | accepted | Correct automatic route |
| 111-order p14 | tax_form / aeat / aeat-111 | needs_review | Correct identity; held by gates |
| 123-order p9 | No valid prediction | error | Failed; counted in denominator |
| 123-order p10 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | tax_form / aeat / aeat-123 | needs_review | Review held; identity wrong |
| 202-form p1 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p3 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p4 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 210-211-order p25 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p27 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p29 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p32 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p36 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 309-order p5 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 347-order p6 | instructions / aeat / aeat-347 | needs_review | Correct identity; held by gates |
| 347-order p7 | instructions / aeat / none | needs_review | Identity wrong; held by gates |
| 369-order p10 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held by gates |
| 369-order p13 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / unknown / aeat-369 | needs_review | Identity wrong; held by gates |
| 369-order p19 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p22 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-form p5 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p1 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p2 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p15 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p16 | tax_form / regional / none | needs_review | Review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p4 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p18 | instructions / not_applicable / none | needs_review | Correct identity and required review |

### adaptive / context

| Target | Predicted kind / authority / model | Status | Judge verdict |
| --- | --- | --- | --- |
| 036-order p7 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p8 | tax_form / aeat / aeat-036 | accepted | Correct automatic route |
| 036-order p13 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p15 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 036-order p18 | tax_form / aeat / aeat-036 | needs_review | Correct identity; held by gates |
| 111-order p13 | tax_form / aeat / aeat-111 | accepted | Correct automatic route |
| 111-order p14 | tax_form / aeat / aeat-111 | needs_review | Correct identity; held by gates |
| 123-order p9 | No valid prediction | error | Failed; counted in denominator |
| 123-order p10 | tax_form / aeat / aeat-123 | accepted | Correct automatic route |
| 123-order p11 | tax_form / aeat / aeat-123 | needs_review | Review held; identity wrong |
| 202-form p1 | tax_form / aeat / aeat-202 | accepted | Correct automatic route |
| 202-form p2 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p3 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 202-form p4 | tax_form / aeat / aeat-202 | needs_review | Correct identity; held by gates |
| 210-211-order p25 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p27 | tax_form / aeat / aeat-210 | needs_review | Correct identity; held by gates |
| 210-211-order p29 | tax_form / aeat / aeat-210 | accepted | Correct automatic route |
| 210-211-order p31 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p32 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p34 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 210-211-order p36 | tax_form / aeat / aeat-211 | accepted | Correct automatic route |
| 309-order p5 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 309-order p6 | tax_form / aeat / aeat-309 | accepted | Correct automatic route |
| 347-order p6 | instructions / aeat / aeat-347 | needs_review | Correct identity; held by gates |
| 347-order p7 | instructions / aeat / aeat-347 | needs_review | Correct identity; held by gates |
| 369-order p10 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p11 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p13 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p14 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p19 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| 369-order p20 | tax_form / aeat / aeat-369 | needs_review | Correct identity; held by gates |
| 369-order p22 | tax_form / aeat / aeat-369 | accepted | Correct automatic route |
| catalonia-650-form p1 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-form p5 | tax_form / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p1 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p2 | instructions / regional / none | needs_review | Correct identity and required review |
| catalonia-650-instructions p15 | tax_form / regional / none | needs_review | Review held; identity wrong |
| catalonia-650-instructions p16 | tax_form / regional / none | needs_review | Review held; identity wrong |
| tgss-receipt p1 | social_security / not_applicable / none | accepted | Correct automatic route |
| facturae-examples p1 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p4 | instructions / not_applicable / none | needs_review | Correct identity and required review |
| facturae-examples p18 | instructions / not_applicable / none | needs_review | Correct identity and required review |
