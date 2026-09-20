// Internal subprocess entry point. Native OCR diagnostics never reach CLI stdout.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { LiteParse } from '@llamaindex/liteparse';
import { OCR_LANGUAGES, validateOcrPages, type OcrLanguage } from './ocr.js';

async function main() {
  const [file, output, max, language] = process.argv.slice(2);
  const maxPages = Number(max);
  if (!file || !output || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000 || !OCR_LANGUAGES.includes(language as OcrLanguage)) throw new Error();
  const bytes = await readFile(file);
  if (bytes.length > 50 * 1024 * 1024 || bytes.subarray(0, 4).toString() !== '%PDF') throw new Error();
  const parser = new LiteParse({
    ocrEnabled: true, ocrLanguage: language, ocrFailureFatal: true, continueOnPageError: false,
    maxPages, quiet: true, keepHeadersFooters: true, numWorkers: 2,
    // Do not enable document JavaScript/form actions or an external OCR server.
    renderFormFields: false, extractImages: false, extractScreenshots: false,
  });
  const parsed = await parser.parse(bytes);
  validateOcrPages(parsed, maxPages);
  await writeFile(output, JSON.stringify({ sourceSha256: createHash('sha256').update(bytes).digest('hex'), parsed: {
    totalPages: parsed.totalPages, pageErrors: parsed.pageErrors,
    pages: parsed.pages.map(p => ({ pageNum: p.pageNum, text: p.text })),
  } }), { mode: 0o600, flag: 'wx' });
}

main().catch(() => { process.exitCode = 1; });
