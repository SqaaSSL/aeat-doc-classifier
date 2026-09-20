# aeat-doc-classifier

Spanish tax document classification and reviewable Plan General de Contabilidad account suggestions, powered by [TypeSafe Jev](https://docs.typesafe.ai/). Built for autónomos, small businesses and the software their advisers use. **MIT licensed, early release.**

The classifier identifies a page's document type, tax authority and AEAT model. A separate accounting function proposes one principal PGC account for a transaction whose direction and accounting plan the caller supplies. It returns candidates, probabilities, provider confidence, review reasons, source references and an audit hash.

This is a document-routing library and CLI. It does not calculate tax, extract invoice amounts, determine deductibility, create complete journal entries, file returns, or implement SII/VERI*FACTU. Local OCR is available through an optional LiteParse adapter. Spanish production accuracy is not yet established; see the [public PDF benchmark](docs/benchmarks/public-2026-09-20.md).

## Public benchmark

Evaluated **44 pages from 21 official public PDFs** on **2026-09-20**, with `jev-1.13.0` and the unchanged 0.95 confidence/probability gates. The corpus includes AEAT/BOE forms and instructions, Canary Islands, Catalan, Bizkaia and IRS scope checks, and PDFs with missing text. Sources, page selections and labels were frozen before the first run; the previous four-page Modelo 303 development test is excluded.

| Measure | First-run result |
| --- | ---: |
| Correct top AEAT model and page kind, before gates | **23/27 (85.2%)** |
| Automatically accepted across all selected pages | **9/44 (20.5%)** |
| Automatically accepted among AEAT recognition pages | **9/27 (33.3%)** |
| Correct among automatically accepted | **9/9** |
| Incorrect automatic acceptances observed | **0** |
| Required review / extraction checks handled correctly | **17/17** |
| Other outcomes | **32 review, 3 needs OCR, 0 errors** |

The gates held incorrect guesses on two Modelo 390 continuation pages (guessed as 303), a Modelo 100 continuation and a Modelo 349 instruction continuation. Authority uncertainty also held many correct model candidates. All non-national and mixed-model controls were held, including two Bizkaia pages whose raw candidates incorrectly suggested AEAT 303. This run demonstrates conservative routing with limited automation coverage; **nine correct accepted pages do not establish production reliability**.

The 27 recognition pages cover **11 AEAT models**. Labels are assistant-curated, not independently accountant-reviewed, and the sample is mostly blank forms, teaching examples and instructions, with correlated pages and some older layouts. PGC suggestions are **not** externally benchmarked here; the [13 synthetic accounting cases](docs/benchmarks/README.md) remain a separate development result.

[Full report and every page's outcome](docs/benchmarks/public-2026-09-20.md) · [Machine-readable results](docs/benchmarks/public-2026-09-20.json) · [Sources and frozen labels](eval/public-v1.json) · [Reproduce the benchmark](eval/PUBLIC-BENCHMARK.md)

### Experimental context retry (v0.3.0)

Inspired by [DocJev's document-context approach](https://github.com/jerryjliu/docjev), an optional retry gives uncertain PDF pages a bounded window of neighboring pages and requires a confident same-document continuity decision. The isolated-page mode remains the default.

| Paired development comparison | Isolated attempt | With context retry |
| --- | ---: | ---: |
| Correct AEAT model + page kind | 24/27 (88.9%) | 27/27 (100%) |
| Automatically accepted among eligible AEAT pages | 8/27 (29.6%) | 10/27 (37.0%) |
| Wrong automatic acceptances observed | 0 | 0 |
| Required review/OCR controls held | 17/17 | 17/17 |

**This reuses the inspected benchmark and adds neighboring-page evidence; it is not an independent accuracy estimate.** The fresh isolated run varied from the original 23/27 and 9/27 result above. Context improved recognition in this run, but automatic acceptance remains low and extra calls increase usage. See the [paired report](docs/benchmarks/context-2026-09-20.md), [full results](docs/benchmarks/context-2026-09-20.json), and [DocJev review and improvement priorities](docs/DOCJEV-REVIEW.md).

### Spanish OCR and fresh samples (v0.4.0)

The optional local OCR adapter uses **LiteParse 2.14.6**, the same underlying engine used by DocJev, configured for Spanish. On a separate **five-page regression check**, it recovered the scanned Modelo 130 and 131 identities; one passed the unchanged acceptance gates. A blank page remained empty, model 200 remained under review, and one classification failed. This is a small extraction experiment on known documents, **not a replacement for the 44-page baseline or a new accuracy estimate**. [OCR report and all outcomes](docs/benchmarks/ocr-2026-09-20.md).

We also collected and fingerprinted **42 candidate pages from 12 new official PDFs**: **17 calibration / 25 reserved validation**. They cover nine AEAT models, scanned annexes, unsupported-model controls, Catalan tax documents, a TGSS sample receipt and Facturae teaching material. No classifier calls or threshold fitting have been performed on these samples. Proposed labels still require independent review; public documents do not establish representative production or PGC accuracy. [Source links, page selections and usage plan](docs/SPANISH-SAMPLES.md) · [Frozen candidate manifest](eval/calibration-v1.json).

## Install the CLI

Requirements: Node.js 22+, npm and a [TypeSafe API key](https://docs.typesafe.ai/). The prebuilt release includes the executable and catalogs; no Git checkout or TypeScript build is needed.

```sh
npm install --global https://github.com/SqaaSSL/aeat-doc-classifier/releases/download/v0.4.0/sqaassl-aeat-doc-classifier-0.4.0.tgz

# Set in the environment that will run your agent. Never commit a real key.
export TYPESAFE_API_KEY="your-key"
aeat-classify doctor
aeat-classify classify /absolute/path/document.txt
aeat-classify account /absolute/path/transaction.txt --direction purchase --plan pgc-pymes
```

For PDF input, install [Poppler](https://poppler.freedesktop.org/) with `brew install poppler` on macOS or `sudo apt-get install poppler-utils` on Debian/Ubuntu, then run `aeat-classify doctor --pdf`. Text input needs no external binary. All keys remain in the executing environment; there is no `--api-key` argument. A configured key is not proof that it is valid: `doctor` makes no API call.

Run without a global installation:

```sh
npx --yes --package=https://github.com/SqaaSSL/aeat-doc-classifier/releases/download/v0.4.0/sqaassl-aeat-doc-classifier-0.4.0.tgz aeat-classify --help
```

The release is distributed through [GitHub Releases](https://github.com/SqaaSSL/aeat-doc-classifier/releases), not the npm registry. Install the library locally using the same tarball URL without `--global`, or build from a Git checkout as described under [Development](#development-and-evaluation). Global installation is recommended for the agent skill below so `aeat-classify` is on the agent's `PATH`.

## Local OCR for scanned PDFs

Install the optional engine alongside the CLI, in the same npm environment:

```sh
npm install --global @llamaindex/liteparse@2.14.6
aeat-classify doctor --ocr

# Local extraction only: no TypeSafe key or classification calls required.
aeat-classify parse /absolute/path/scanned-return.pdf --ocr --ocr-language spa

# Classify the extracted pages with Jev and the existing review gates.
aeat-classify classify /absolute/path/scanned-return.pdf --ocr --fail-on-review
```

`--ocr` selects LiteParse's native-text extraction plus local Tesseract OCR where needed. The default is Spanish (`spa`); `cat`, `eus`, `glg` and `eng` can be selected but have not been benchmarked here. First use may download language data; documents are processed locally for OCR. Classification subsequently sends the extracted text to TypeSafe. There is no cloud OCR account, OCR API key or per-page OCR API fee. Hardware/runtime costs still apply.

This path does not require Poppler. Without `--ocr`, PDF extraction still uses Poppler, preserving the published baseline. `doctor --ocr` checks the optional package version and classification setup, not native-binary operation or cached language data. An actual `parse --ocr` is the readiness smoke test. For a local library installation, install `@llamaindex/liteparse@2.14.6` in the same project and call `readPdfWithOcr(path)`.

OCR results include a source SHA-256, parser version, language and normalization identifier. The process has a two-minute limit; incomplete/reordered output and reported page failures are rejected before inference. Empty pages remain unresolved (`needs_ocr` during classification); empty text alone does not prove a page is visually blank. Small or poorly scanned text may still be wrong, and dynamic PDF compatibility is not guaranteed. `parse` emits the extracted text, so treat its output as document data. Details: [OCR adapter](docs/OCR.md).

## CLI examples

```sh
aeat-classify classify /absolute/path/return.pdf --max-pages 20 --compact
aeat-classify classify /absolute/path/return.pdf --experimental-context --fail-on-review
aeat-classify classify - --compact < /absolute/path/extracted-page.txt
aeat-classify account - --direction sale --plan pgc --activity "Asesoría fiscal" < /absolute/path/transaction.txt
aeat-classify catalog forms
aeat-classify catalog accounts
aeat-classify schema
aeat-classify --help
```

Results are JSON on stdout; errors are `{ "error": { "code": "...", "message": "..." } }` on stderr. `classify` returns an array of `{page, result}` (plus `extraction` with `--ocr`); `account` returns one suggestion object. `--compact` makes the JSON one line. `-` reads UTF-8 text from stdin, bounded at 24,000 bytes; supply PDFs by file path. Quote paths, or use `--` before a filename beginning with a dash.

With `--experimental-context` (PDF only), each item also includes `pageOnly` and `context`: the original decision, whether a retry occurred, context-page hashes, request hash and continuity distribution. At most two predecessors and one successor are considered; whole neighboring pages are omitted when they cannot fit, and text is not truncated. Empty/sparse targets cannot inherit a neighbor's identity. This is an experimental classification retry, not a packet splitter or OCR engine. It can increase API usage and sends neighboring text to TypeSafe. When a retry occurs, total usage is the sum of `pageOnly.audit.usage` and `result.audit.usage`; otherwise these represent the same single attempt.

| Exit | Meaning |
| --- | --- |
| 0 | Execution completed; still inspect `status` and review fields |
| 1 | Runtime, file or provider failure |
| 2 | `--fail-on-review` found a review requirement; normal result JSON remains on stdout |
| 3 | Missing configuration, authentication failure, or `doctor` not ready |
| 64 | Invalid arguments or invalid/oversized text input |

`--fail-on-review` applies to `needs_review`, `needs_ocr`, **and every PGC proposal**, because all proposals require human review. Without that flag, these valid results exit 0. Discovery commands (`doctor`, `catalog`, `schema`, `skill`, help, version) work offline; `skill` prints Markdown, and help/version print text. See [the full command contract](data/cli-schema.json) for agent integration.

## Use with agents

Install the CLI and set `TYPESAFE_API_KEY` **in the agent's execution environment**, then give it the [portable skill](skills/aeat-doc-classifier/SKILL.md). The skill is shipped inside the package, so no repository clone is needed. The commands below create a new skill file; preserve any existing local customization before replacing it.

### Claude Code

```sh
mkdir -p ~/.claude/skills/aeat-doc-classifier
aeat-classify skill > ~/.claude/skills/aeat-doc-classifier/SKILL.md
claude
```

Ask Claude:

```text
/aeat-doc-classifier Classify /absolute/path/taxes.pdf and show any pages needing review.
```

For a project-only installation, use `.claude/skills/aeat-doc-classifier/SKILL.md` in that project. Claude still applies its normal terminal/tool permissions. Personal skills are local to that machine; configure the CLI and secret separately for remote execution. [Claude Code skills documentation](https://code.claude.com/docs/en/skills).

### ChatGPT / Codex

For Codex CLI or a local ChatGPT/Codex workspace with terminal access:

```sh
mkdir -p ~/.agents/skills/aeat-doc-classifier
aeat-classify skill > ~/.agents/skills/aeat-doc-classifier/SKILL.md
codex
```

Ask the agent:

```text
Use $aeat-doc-classifier to classify /absolute/path/taxes.pdf.
Summarize accepted model identities and preserve every review or OCR requirement.
```

For a project-only installation, use `.agents/skills/aeat-doc-classifier/SKILL.md`. The CLI, key, input files and network access must exist wherever the task executes. [Official skill locations and usage](https://learn.chatgpt.com/docs/build-skills).

In a ChatGPT session **without a terminal connected to your files**, pasting a command does not execute this local CLI. You can run the CLI yourself and share its result JSON. Direct tool access from ChatGPT developer mode requires a remote MCP integration; this release does not ship or host an MCP server. [Official ChatGPT developer-mode integration](https://developers.openai.com/api/docs/guides/developer-mode).

### OpenClaw

Run these commands from your configured OpenClaw workspace:

```sh
mkdir -p skills/aeat-doc-classifier
aeat-classify skill > skills/aeat-doc-classifier/SKILL.md
```

The skill declares the `aeat-classify` binary and `TYPESAFE_API_KEY` dependency. Set the key in the Gateway/agent environment, or use OpenClaw's `skills.entries["aeat-doc-classifier"].apiKey` secret configuration. Start a new session if needed to refresh the skill list, then ask:

```text
Use aeat-doc-classifier to classify /absolute/path/taxes.pdf.
For /absolute/path/transaction.txt, propose a PGC-PYMES account from the buyer's perspective.
Keep the accounting proposal for human review.
```

If execution is sandboxed, install the binary/Poppler and provide the files and secret **inside the sandbox**. Host-only skill environment injection does not automatically cross that boundary. [OpenClaw skills](https://docs.openclaw.ai/tools/skills), [sandbox environment configuration](https://docs.openclaw.ai/tools/skills-config).

### Other terminal-enabled agents

Cursor, Cline, OpenCode and custom agents can invoke the same executable through their terminal/process tool when permitted. Give the agent this instruction, or adapt the portable skill to its supported skill format:

```text
Use aeat-classify for AEAT document triage and PGC account proposals.
Read aeat-classify schema for the command/output contract. Send extracted text on stdin
or pass an absolute file path. Parse JSON stdout; check stderr and exit codes separately.
Keep TYPESAFE_API_KEY in the environment. Preserve review requirements and do not
infer a completed tax filing, deductibility or a posted accounting entry from a result.
```

For a custom agent, use an argument array and stdin, not a shell string containing the document. This executable [Node.js adapter example](examples/agent-tool.mjs) preserves result JSON on exit 2 and parses failures separately. Skill instructions do not add capabilities: the agent still needs a working terminal/tool runtime and its normal permissions.

## Library

```ts
import { classifyPage, suggestAccount, readPdfPages } from '@sqaassl/aeat-doc-classifier';

const page = await classifyPage(`Agencia Tributaria
Modelo 303
Impuesto sobre el Valor Añadido. Autoliquidación
Ejercicio 2025. Periodo 3T. IVA devengado. IVA deducible.`);

if (page.status === 'accepted' && page.form) {
  console.log(page.form, page.kind, page.formDefinition?.sources);
} else {
  console.log(page.status, page.reasons, page.candidates);
}

const proposal = await suggestAccount(
  'Factura recibida por asesoría fiscal y contable del mes de septiembre.',
  { context: { direction: 'purchase', plan: 'pgc-pymes' } },
);
// May suggest 623, Servicios de profesionales independientes.
// requiresHumanReview is always true, including when status is "suggested".

for (const p of await readPdfPages('/path/to/document.pdf')) {
  const result = await classifyPage(p.text);
  console.log(p.page, result.status, result.form);
}
```

Use `direction: 'sale'` to classify revenue from the entity's perspective. An adviser purchasing another adviser's work and an adviser selling their own services do not use the same principal account. Supply `activity` when needed to distinguish ordinary business revenue from ancillary income, merchandise from production, or other context-dependent choices. Select the applicable accounting plan explicitly; the library does not determine whether an entity qualifies for PGC-PYMES or is required to keep PGC accounts.

## Coverage

| Area | Initial scope |
| --- | --- |
| AEAT | 33 model definitions: 030, 036, historical 037, 100, 102, 111, 115, 123, 130, 131, 180, 184, 190, 193, 200, 202, 210, 211, 216, 232, 296, 303, 309, 347, 349, 369, 390, 714, 718, 720, 721, 840, 848 |
| Page type | Tax form, filing receipt, instructions, invoice, rectifying invoice, simplified invoice, payroll, social-security document, bank statement, accounting report, notification, other |
| Accounting | 40 selected shared PGC/PGC-PYMES accounts: 29 principal-account candidates and 11 reference-only settlement/tax accounts |
| Boundaries | Foral, autonomous-community, Canary and foreign tax documents route to review; their models are not identified |
| Input | Spanish text, native PDF text, optional local Spanish OCR; no XML/Facturae parsing, signature or CSV authenticity verification |

Catalog entries link to [AEAT](https://sede.agenciatributaria.gob.es/Sede/presentar-consultar-declaraciones-modelo.html) or the consolidated [PGC](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19884) and [PGC-PYMES](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19966). They are a curated subset reviewed on **2026-09-20**, not a complete or self-updating legal knowledge base. Modelo 037 is retained for historical documents and always routed for review.

## How acceptance works

Jev evaluates narrow Choice questions in a single request. Code decides which answers apply and whether they pass. It never uses a model number mentioned on a bank statement to turn that statement into an AEAT return.

- `accepted` means the applicable routing decisions passed both thresholds. It does **not** mean a document is authentic, correct, legally compliant or submitted.
- `needs_review` preserves raw candidates and explicit reasons. `form` is null unless the national AEAT form is accepted. Historical model identity remains available under `candidates.form`.
- `needs_ocr` means there is no extractable text. A scan and a genuinely blank page cannot be distinguished from empty text alone; inspect the page or run OCR.
- PGC `suggested` means a principal account passed the gate and suitability check. Every suggestion still has `requiresHumanReview: true`. Mixed transactions must be split before proposing accounts.

Both `confidence` and the selected option's `probability` default to a minimum of 0.95. These are conservative policy defaults, **not a claim of 95% Spanish accuracy**. They can be configured with `{ gate: { minConfidence: 0.95, minProbability: 0.95 } }`; calibrate against representative, independently labeled data before changing them. Jev's confidence and winning probability are different values.

The default model is pinned to `jev-1.13.0`; override with `TYPESAFE_MODEL` or `jevBackend({ model })`. Replies record the actual model version, catalog version, usage and input hash. Errors and malformed distributions fail closed. The client bounds retries, honors `Retry-After` up to 30 seconds, uses request timeouts, and does not follow redirects with the credential.

## Privacy and cost

Calling Jev sends page/transaction text and supplied context to **TypeSafe's hosted API**. This is not an offline model. The library does not persist text or keys and does not log provider error bodies. Your application remains responsible for its own logging, retention and access controls. A hash is an audit aid, not anonymization. Review the provider's [data-processing terms](https://docs.typesafe.ai/legal) before sending real taxpayer data; zero retention is not assumed for a standard account.

The examples and committed tests contain synthetic material. Optional PDF evaluation downloads only public government references into a git-ignored directory. Published benchmark artifacts contain source links, hashes, annotations and results, not original PDFs or extracted document text. CI needs no API key and makes no inference calls. Live evaluations incur usage; the project reports tokens rather than borrowing the reference project's US accuracy or pricing claims.

## Development and evaluation

```sh
git clone https://github.com/SqaaSSL/aeat-doc-classifier.git
cd aeat-doc-classifier
npm ci
npm run check           # Types, unit tests and build; no API key required
npm run catalog:check   # Catalog integrity and Choice option limits
npm run eval            # 39 synthetic development cases; uses TYPESAFE_API_KEY
npm run eval:pdf        # Four public reference PDF pages; requires Poppler and key
npm run eval:public -- --download-only # Fetch and verify the frozen corpus; no key
npm run eval:public     # 44 public PDF pages; requires Poppler and key
npm run eval:context    # Paired development comparison with neighboring-page retries
npm pack --dry-run      # Inspect the distributable package
node dist/cli.js --help # Run the local build
```

Live reports are written to ignored `eval/results/`; [published summaries](docs/benchmarks/README.md) distinguish raw identity, acceptance, abstention and wrong accepted results. The synthetic set is a development set. The separate public benchmark pins PDFs and extracted inputs by SHA-256 and refuses changed sources before inference; see its [methodology, metric definitions and report-generation command](eval/PUBLIC-BENCHMARK.md). Neither set establishes population accuracy, and model-training overlap is unknown.

A custom `Backend` can replace Jev. It must return the full Choice distributions, provider confidence, model ID and usage; all responses undergo the same validation. Keep arithmetic and fiscal calculations in deterministic code. Read [research and design](docs/RESEARCH.md), [the roadmap](docs/ROADMAP.md), and [contribution guidelines](CONTRIBUTING.md).

## License and inspiration

Original implementation, criteria prose and synthetic fixtures: [MIT](LICENSE). Inspired by [kyotofin/tax-doc-classifier](https://github.com/kyotofin/tax-doc-classifier) and the document-context approach in [jerryjliu/docjev](https://github.com/jerryjliu/docjev), both Apache-2.0. No upstream source code, assets or IRS criteria were copied into this repository. Source documents retain their own status and terms; see [data provenance](DATA-LICENSE.md). This project is not affiliated with AEAT, ICAC, TypeSafe or DocJev.
