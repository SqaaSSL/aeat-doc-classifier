# Jev versus GPT-5.6 Luna: frozen development comparison

This experiment compares the same classifier with two backends and adds an image-only Luna condition. It does not claim that either model is universally better, or that the repository is a replacement for an LLM. The classifier already uses Jev, a language model.

## Prespecified experiment

- All 42 reviewed targets from `spanish-v1-judged.json`; unchanged labels and errors retained in every denominator. Thirty supported AEAT pages, one eligible TGSS example, eleven required-review controls. No invoice amount, PGC or field-extraction score.
- Jev 1.13.0 and GPT-5.6 Luna at low reasoning effort receive the exact same v0.5 adaptive OCR, Choice instructions and catalog. Neither sees labels, earlier results, source URLs or source filenames. Each model's isolated reply is reused by its optional context retry. Context windows and continuity gates use the existing implementation. Because retries are conditional, the two models can make different numbers of context requests.
- Five conditions: Jev isolated OCR; Jev OCR plus context; Luna isolated OCR; Luna OCR plus context; Luna image-only. Text-model order alternates by target. Image-only runs last on each target, with a fresh session and a complete physical page rendered at 300 DPI. It receives the same questions/catalog but no OCR, neighbors or prior predictions. Image filenames are opaque; CLI image preprocessing may resize the supplied PNG. The supplied image hashes are frozen.
- No model-generated tools are allowed. Each Luna request runs in a new ephemeral, read-only Codex session in a temporary directory. User configuration, project instructions, memory use, browsing and tool features are disabled. The harness rejects any tool activity even if followed by valid classification JSON. Codex's system/skill-description overhead remains visible in usage; this is **Luna through Codex**, not a bare Responses API request. No account authentication tokens are read or exported by the harness.
- Structured output requires every Choice option's probability and a confidence estimate. Both backends pass the unchanged distribution validator and 0.95 routing gates. **Luna's confidence/distribution is self-reported; it is not equivalent to Jev confidence or empirically calibrated.** Raw recognition is the primary comparison; accepted precision/coverage are descriptive policy outcomes, not equal-risk comparisons. No threshold is fitted to this set.
- One prespecified benchmark run after transport-only probes on synthetic text and an excluded blank page. No best-of selection, repaired predictions, score-driven retries or post-prediction reference changes. Provider-internal transport retries may occur; failures remain failures. All outcomes are inspected by Codex, the implementation author and AI reviewer, with corrections separate from original predictions.

This is a development comparison: these public forms have already informed our OCR and prompts. It is not independent validation. Jev-oriented Choice wording is shared rather than optimized separately for Luna. Images versus OCR changes the available representation, so the image column is a separate workflow comparison, not a controlled model substitution.

## Measurements

Report supported AEAT model + kind, complete kind/authority/model identity across all pages, correct eligible acceptance, wrong acceptance, held controls, errors, and every prediction. Show source-macro recognition because pages in one PDF are correlated. Keep the original 17/25 partition names for traceability, without calling either untouched validation.

Record all logical model calls, reported input/cached/output/reasoning tokens where available, and elapsed call time. Jev timings include its HTTP adapter and bounded retries; Luna timings include CLI startup and Codex overhead. Neither is pure model inference latency. Context's total includes its isolated call, counted once in the ledger. Extraction is cached equally for text conditions; image rendering occurs before inference. The signed-in Codex run provides no per-request currency bill, so **no dollar-cost or API price superiority claim** is made. Unknown failed-call usage remains unknown.

## Reproduce

Use Node.js 22+, the repository dependencies, authenticated Codex CLI with access to `gpt-5.6-luna`, and `TYPESAFE_API_KEY`. The measured client version is recorded per run. Official access and configuration references: [models](https://learn.chatgpt.com/docs/models), [scripted execution](https://learn.chatgpt.com/docs/developer-commands#codex-exec), [configuration](https://learn.chatgpt.com/docs/config-file/config-reference).

1. Acquire the frozen official sources and regenerate the adaptive text cache following the extraction report. Never silently refresh source or extraction fingerprints.
2. Render each selected physical page using Poppler `pdftoppm -f PAGE -l PAGE -singlefile -r 300 -png SOURCE OUTPUT`. Use the opaque filenames in `luna-images-v1.json`, under ignored `eval/corpus/luna-images-v1/`. Verify all hashes. This run uses Poppler 26.05.0.
3. The committed `luna-v1-protocol.json` pins the implementation, labels, text and image manifest before inference. `npm run eval:luna -- --prepare` is only for initially creating that protocol; it will not overwrite an existing one.
4. From a clean checkout, run `npm run eval:luna`. The runner verifies all inputs before model calls. Complete and partial runs go to ignored `eval/results/`; failures do not disappear from the report.

Only hashes, predictions, metrics and review findings are published. Source PDFs and image/text caches retain their publishers' terms and are not redistributed under MIT.

## Separate follow-up: labels without probability distributions

After observing structured-response failures in the first run, we froze an additional **post-hoc output-format ablation** in `luna-labels-v1-protocol.json`. It requests only `kind`, `jurisdiction` and `form` from Luna on the same 42 isolated OCR inputs and unchanged Choice criteria. It does not supply previous predictions or reference answers. There are no probabilities, confidence estimates, context, images or automatic-acceptance claims in this follow-up.

This tests recognition through a simpler output contract; it does not replace or repair the original run. Its results must be shown separately, including every failure, and identified as a follow-up designed after seeing the first experiment. Compare it with the isolated OCR columns, not with contextual or image-only evidence. No general claim about maximum model capability follows from either prompt.

Reproduce with `node --import tsx eval/luna-labels.ts` from a clean source checkout with the existing adaptive OCR cache and a signed-in Codex CLI. The committed protocol pins prompts, schema, source fingerprints and labels before this follow-up's first model call. The `--prepare` option only creates a new protocol and refuses to overwrite one.
