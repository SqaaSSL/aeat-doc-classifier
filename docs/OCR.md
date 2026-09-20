# Local Spanish OCR

The optional OCR path uses the same underlying engine as [DocJev's local adapter](https://github.com/jerryjliu/docjev/blob/9ed0fe05984ce1906af9272b8b400c8d46520f98/src/jev_docs/ocr/liteparse.py): [LiteParse](https://github.com/run-llama/liteparse/tree/main/packages/node), with local Tesseract recognition. DocJev wraps the Python binding with English OCR. Our original TypeScript adapter uses the Node binding, pinned to **2.14.6**, and defaults to **Spanish (`spa`)**. We do not require DocJev's Python environment or copy its implementation. LiteParse remains Apache-2.0; our adapter is MIT.

## Install and use

After installing the aeat-doc-classifier v0.4.0 release:

```sh
npm install --global @llamaindex/liteparse@2.14.6
aeat-classify doctor --ocr
aeat-classify parse /absolute/path/document.pdf --ocr --ocr-language spa
aeat-classify classify /absolute/path/document.pdf --ocr --fail-on-review
```

Install both packages in the same npm prefix/environment. For library use, install both in the same local project:

```ts
import { readPdfWithOcr, classifyPage } from '@sqaassl/aeat-doc-classifier';
const document = await readPdfWithOcr('/absolute/path/document.pdf', { ocrLanguage: 'spa', maxPages: 100 });
for (const page of document.pages) {
  const classification = await classifyPage(page.text);
  // Preserve document.extraction alongside every downstream classification.
  console.log({ page: page.page, extraction: document.extraction, classification });
}
```

`parse` needs no TypeSafe key and makes no classification calls. Language data may be downloaded on first use; parsing/OCR processes the document locally. We configure no external OCR endpoint. `classify` sends extracted text to TypeSafe using the existing environment key and unchanged 0.95 gates. Local CPU/runtime costs remain; this adapter adds no OCR-provider per-page charge.

The optional package is a development dependency and optional peer dependency, so a minimal release installation still works without it for text/Poppler operations. `doctor --ocr` checks its exact package version and classification-key presence. It does not load the native binary, inspect cached language files, or prove that OCR works; use `parse --ocr` as the operational check. Poppler is not needed for the OCR path.

## Output and failure behavior

The result preserves one ordered entry for every source page, including empty pages. Extraction provenance records the original bytes' SHA-256, engine/version, configured language and `nfc-trim-v1` normalization. `ocrEnabled` describes the parser configuration; it does not assert that every page was OCR'd or that its text is correct.

The native parser runs in a separate process with a 120-second timeout. The input limit is 50 MiB, the default page limit is 100 (configurable up to 1,000), and the serialized extraction output is bounded at 24 MiB. Classification still rejects pages exceeding 24,000 UTF-8 bytes instead of truncating them. Native diagnostic output is isolated from the CLI's JSON streams. Transient extraction JSON is created in a private temporary directory and removed after use; the adapter does not maintain a document-text cache.

We require a complete, consecutive page list matching the engine's reported source count and reject reported page errors. `ocrFailureFatal` and `continueOnPageError: false` are enabled. Document form-field JavaScript/actions, image export and cloud OCR are not enabled. These checks detect incomplete output, not every recognition mistake or misleading text layer.

Empty text remains unresolved. The classifier returns `needs_ocr` even after an OCR attempt if there is still no text; check the `extraction` field to see that OCR was already attempted. This avoids declaring a page visually blank from text alone. Dynamic PDF compatibility, handwriting, rotated/degraded scans and all languages need broader evaluation. `cat`, `eus`, `glg` and `eng` are exposed as language selections; only `spa` was exercised in this release.

## Evidence

The [five-page regression report](benchmarks/ocr-2026-09-20.md) preserves the first run, including a failed classification. The two known scanned annexes recovered their form identities, with one accepted. These are recognition outcomes on a tiny known set, not character-level OCR accuracy or an independent full-corpus benchmark. The [fresh Spanish corpus](SPANISH-SAMPLES.md) remains unscored for future calibration and validation.
