import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import type { PdfPage } from './pdf.js';
import { OCR_MODES, type OcrMode, type OcrPageDiagnostic } from './ocr-quality.js';
export { OCR_MODES } from './ocr-quality.js';
export type { OcrMode, OcrPageDiagnostic } from './ocr-quality.js';

export const LITEPARSE_VERSION = '2.14.6';
export const OCR_LANGUAGES = ['spa', 'cat', 'eus', 'glg', 'eng'] as const;
export type OcrLanguage = typeof OCR_LANGUAGES[number];
const require = createRequire(import.meta.url);
const run = promisify(execFile);

export interface OcrDocument {
  pages: PdfPage[];
  extraction: {
    sourceSha256: string;
    parser: 'liteparse';
    version: string;
    ocrEnabled: true;
    ocrLanguage: OcrLanguage;
    normalization: 'nfc-trim-v1';
    mode: OcrMode;
    strategy: 'selective-v1' | 'adaptive-raster-v2' | 'raster-v1';
    pageDiagnostics: OcrPageDiagnostic[];
  };
}

/** Presence/version only: this does not download or test OCR language data. */
export function ocrReadiness() {
  let version: string | null = null;
  try { version = (require('@llamaindex/liteparse/package.json') as { version: string }).version; } catch { /* Optional dependency. */ }
  return { installed: version !== null, version, supportedVersion: LITEPARSE_VERSION,
    ready: version === LITEPARSE_VERSION, languageDataChecked: false };
}

/** Reject partial, reordered or malformed extraction before any classifier call. */
export function validateOcrPages(result: unknown, maxPages: number): PdfPage[] {
  const r = result as { totalPages?: unknown; pages?: Array<{ pageNum?: unknown; text?: unknown }>; pageErrors?: unknown[] } | null;
  if (!r || !Number.isSafeInteger(r.totalPages) || (r.totalPages as number) < 1 || (r.totalPages as number) > maxPages
      || !Array.isArray(r.pages) || r.pages.length !== r.totalPages || !Array.isArray(r.pageErrors) || r.pageErrors.length) {
    throw new Error('OCR did not return every source page within the configured limit.');
  }
  return r.pages.map((p, i) => {
    if (!p || p.pageNum !== i + 1 || typeof p.text !== 'string') throw new Error('OCR page boundaries could not be verified.');
    const text = p.text.normalize('NFC').trim();
    return { page: i + 1, text, textStatus: text ? 'text' : 'no_extractable_text' };
  });
}

/** Local native-text + selective OCR, in a killable process. No cloud OCR endpoint. */
export async function readPdfWithOcr(path: string, options: { maxPages?: number; ocrLanguage?: OcrLanguage; ocrMode?: OcrMode } = {}): Promise<OcrDocument> {
  const maxPages = options.maxPages ?? 100, language = options.ocrLanguage ?? 'spa';
  const mode = options.ocrMode ?? 'auto';
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new Error('maxPages must be an integer from 1 to 1000.');
  if (!OCR_LANGUAGES.includes(language)) throw new Error('Unsupported OCR language.');
  if (!OCR_MODES.includes(mode)) throw new Error('Unsupported OCR mode.');
  const file = resolve(path), info = await stat(file);
  if (!info.isFile() || info.size > 50 * 1024 * 1024) throw new Error('Expected a PDF file no larger than 50 MiB.');
  if (!ocrReadiness().ready) throw new Error(`Install @llamaindex/liteparse@${LITEPARSE_VERSION} alongside aeat-doc-classifier to use --ocr.`);
  const dir = await mkdtemp(join(tmpdir(), 'aeat-ocr-'));
  try {
    const output = join(dir, 'result.json');
    const source = import.meta.url.endsWith('.ts');
    const worker = fileURLToPath(new URL(source ? './ocr-worker.ts' : './ocr-worker.js', import.meta.url));
    // Native OCR can write diagnostics even with quiet=true. Keep both streams away
    // from the public JSON protocol and never echo document-containing stderr.
    await run(process.execPath, [...(source ? ['--import', 'tsx'] : []), worker, file, output, String(maxPages), language, mode], {
      timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
      env: { ...process.env, TYPESAFE_API_KEY: '', NODE_OPTIONS: '' },
    });
    if ((await stat(output)).size > 24 * 1024 * 1024) throw new Error('OCR output too large.');
    const result = JSON.parse(await readFile(output, 'utf8')) as { parsed: unknown; sourceSha256: string; diagnostics: OcrPageDiagnostic[] };
    if (!/^[a-f0-9]{64}$/.test(result.sourceSha256)) throw new Error('OCR provenance missing.');
    const pages = validateOcrPages(result.parsed, maxPages);
    if (!Array.isArray(result.diagnostics) || result.diagnostics.length !== pages.length || result.diagnostics.some((d, i) =>
      d.page !== pages[i]!.page || d.outputTextSha256 !== createHash('sha256').update(pages[i]!.text).digest('hex')
      || d.outputTextBytes !== Buffer.byteLength(pages[i]!.text))) throw new Error('OCR page provenance mismatch.');
    return { pages, extraction: {
      sourceSha256: result.sourceSha256, parser: 'liteparse', version: LITEPARSE_VERSION,
      ocrEnabled: true, ocrLanguage: language, normalization: 'nfc-trim-v1',
      mode, strategy: mode === 'auto' ? 'adaptive-raster-v2' : mode === 'raster' ? 'raster-v1' : 'selective-v1', pageDiagnostics: result.diagnostics,
    } };
  } catch {
    throw new Error('Local OCR failed or returned incomplete pages. Check the PDF, page limit, LiteParse installation and language data.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
