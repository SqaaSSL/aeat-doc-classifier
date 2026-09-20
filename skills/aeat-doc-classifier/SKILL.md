---
name: aeat-doc-classifier
description: Classify Spanish AEAT tax documents or propose a PGC account for a specified transaction using the aeat-classify CLI. Use for document triage and accounting proposals, not tax calculations or filing.
metadata: {"openclaw":{"requires":{"bins":["aeat-classify"],"env":["TYPESAFE_API_KEY"]},"primaryEnv":"TYPESAFE_API_KEY"}}
---

# AEAT document classification

Use the installed `aeat-classify` CLI. `aeat-classify --help` explains flags; `aeat-classify schema` returns its machine-readable command/output contract. `aeat-classify doctor` checks configuration locally; add `--pdf` to require Poppler, or `--ocr` to check the optional LiteParse package for classification. The latter checks package presence/version, not actual OCR operation. Missing setup should be reported, not worked around by guessing classifications.

The executing environment needs `TYPESAFE_API_KEY`; the CLI sends the supplied text to TypeSafe. Use the user's authorized documents. Keep credentials in the environment or secret manager, never in arguments, document text, source code or responses. These instructions do not grant permission to submit private material beyond the user's request.

## Commands

- Document: `aeat-classify classify /absolute/path/document.pdf --compact` (also accepts `.txt`). Output is an array of `{page, result}`.
- Scanned PDF: use `aeat-classify parse /absolute/path/document.pdf --ocr --ocr-language spa` to inspect local extraction without a key, then `aeat-classify classify /absolute/path/document.pdf --ocr --compact` for Jev classification. The optional `@llamaindex/liteparse@2.14.6` package must be installed alongside the CLI. Initial OCR use may download language data; classification sends extracted text to TypeSafe. Preserve extraction provenance and review status.
- Text from another tool: run `aeat-classify classify - --compact`, passing the extracted UTF-8 text through the subprocess stdin. Do not interpolate document text into shell command strings.
- Account: `aeat-classify account /absolute/path/transaction.txt --direction purchase --plan pgc-pymes --compact`. Choose direction relative to the entity's books (`purchase`, `sale`, `payroll`, `finance`), and use its applicable plan (`pgc` or `pgc-pymes`). If direction is unknown, ask for it or pass `unknown` for an explicit review result. Do not assume a legal entity qualifies for a plan. Output is one account-suggestion object.
- Inspect supported choices locally: `aeat-classify catalog forms` or `aeat-classify catalog accounts`.

Quote file paths or use argument arrays. Use an absolute path, or `--` before a filename beginning with a dash. Account input must be one reviewed text component, not an entire PDF or mixed journal entry. Text input is limited to 24,000 UTF-8 bytes. Native PDF extraction uses Poppler. The optional OCR path uses local LiteParse; empty OCR text is still unresolved and does not establish that the page is blank.

## Interpret results

Exit 0 means execution completed, not that the answer was accepted. Inspect `status` and `reasons`. Only a non-null `form` with `status: accepted` is an accepted model identity; `candidates` can contain rejected choices. Keep `needs_review` and `needs_ocr` visible to the user. Do not silently reduce confidence thresholds to force an answer.

An account is a proposal, and `requiresHumanReview` is always true, even for `status: suggested`. Preserve that review requirement. Classification does not authenticate a document, verify a filing, determine deductibility, calculate taxes, or authorize posting an entry.

With `--fail-on-review`, exit 2 accompanies normal result JSON when review is required, including every account proposal. Exit 1 means execution/provider/input failure, 3 means setup/authentication failure, and 64 means invalid arguments. Errors are JSON on stderr with `error.code` and `error.message`; do not parse an error as a classification or blindly retry it.
