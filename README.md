# aeat-doc-classifier

Spanish tax document classification and reviewable Plan General de Contabilidad account suggestions, powered by [TypeSafe Jev](https://docs.typesafe.ai/). Built for autónomos, small businesses and the software their advisers use. **MIT licensed, early release.**

The classifier identifies a page's document type, tax authority and AEAT model. A separate accounting function proposes one principal PGC account for a transaction whose direction and accounting plan the caller supplies. It returns candidates, probabilities, provider confidence, review reasons, source references and an audit hash.

This is a document-routing library and CLI. It does not calculate tax, extract invoice amounts, determine deductibility, create complete journal entries, file returns, or implement SII/VERI*FACTU. No OCR is bundled. Spanish production accuracy is not yet established; see [measured development results](docs/benchmarks/README.md).

## Quick start

Requirements: Node.js 22+, a TypeSafe API key, and [Poppler](https://poppler.freedesktop.org/) (`pdfinfo`, `pdftotext`) if reading PDFs. Text input needs no external binary.

```sh
git clone https://github.com/SqaaSSL/aeat-doc-classifier.git
cd aeat-doc-classifier
npm ci
npm run check

# Set this in your shell or secret manager. Never commit a real key.
export TYPESAFE_API_KEY="your-key"
node dist/cli.js classify examples/modelo-303.txt
node dist/cli.js account examples/factura-asesoria.txt --direction purchase --plan pgc-pymes
node dist/cli.js classify /path/to/document.pdf --max-pages 100
```

Install Poppler using `brew install poppler` on macOS or `sudo apt-get install poppler-utils` on Debian/Ubuntu. Install the library from GitHub using `npm install github:SqaaSSL/aeat-doc-classifier`. The npm package name is declared in the manifest; this release is distributed through GitHub, not the npm registry.

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
| Input | Spanish text and text-bearing PDF pages; no OCR, XML/Facturae parsing, signature or CSV authenticity verification |

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

The examples and committed tests contain synthetic material. Optional PDF evaluation downloads only public AEAT references into a git-ignored directory. CI needs no API key and makes no inference calls. Live evaluations incur usage; the project reports tokens rather than borrowing the reference project's US accuracy or pricing claims.

## Development and evaluation

```sh
npm run check           # Types, unit tests and build; no API key required
npm run catalog:check   # Catalog integrity and Choice option limits
npm run eval            # 39 synthetic development cases; uses TYPESAFE_API_KEY
npm run eval:pdf        # Four public reference PDF pages; requires Poppler and key
npm pack --dry-run      # Inspect the distributable package
```

Live reports are written to ignored `eval/results/`; [published summaries](docs/benchmarks/README.md) distinguish raw identity, acceptance, abstention and wrong accepted results. The synthetic set is a development set, not a held-out benchmark. Only one model is represented in the small PDF smoke test.

A custom `Backend` can replace Jev. It must return the full Choice distributions, provider confidence, model ID and usage; all responses undergo the same validation. Keep arithmetic and fiscal calculations in deterministic code. Read [research and design](docs/RESEARCH.md), [the roadmap](docs/ROADMAP.md), and [contribution guidelines](CONTRIBUTING.md).

## License and inspiration

Original implementation, criteria prose and synthetic fixtures: [MIT](LICENSE). Inspired by the public approach in [kyotofin/tax-doc-classifier](https://github.com/kyotofin/tax-doc-classifier), which is Apache-2.0. No upstream source code or IRS criteria were copied into this repository. Source documents retain their own status and terms; see [data provenance](DATA-LICENSE.md). This project is not affiliated with AEAT, ICAC or TypeSafe.
