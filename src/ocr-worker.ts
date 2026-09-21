// Internal subprocess entry point. Native OCR diagnostics never reach CLI stdout.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { LiteParse } from '@llamaindex/liteparse';
import { OCR_LANGUAGES, validateOcrPages, type OcrLanguage } from './ocr.js';
import { OCR_MODES, MAX_RASTER_PIXELS, boundedDpi, fallbackReasons, hasHeaderIdentifier, needsHeaderRetry, preserveSelectiveHeader, usableReplacement, contentLength,
  type OcrMode, type OcrPageDiagnostic } from './ocr-quality.js';

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const normalize = (text: string) => text.normalize('NFC').trim();

async function main() {
  const [file, output, max, language, mode] = process.argv.slice(2);
  const maxPages = Number(max);
  if (!file || !output || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000 || !OCR_LANGUAGES.includes(language as OcrLanguage) || !OCR_MODES.includes(mode as OcrMode)) throw new Error();
  const bytes = await readFile(file);
  if (bytes.length > 50 * 1024 * 1024 || bytes.subarray(0, 4).toString() !== '%PDF') throw new Error();
  const config = {
    ocrEnabled: true, ocrLanguage: language, ocrFailureFatal: true, continueOnPageError: false,
    maxPages, quiet: true, keepHeadersFooters: true, numWorkers: 2,
    // Do not enable document JavaScript/form actions or an external OCR server.
    renderFormFields: false, extractImages: false, extractScreenshots: false,
  };
  const parser = new LiteParse({ ...config, includeComplexity: mode !== 'selective' });
  const parsed = await parser.parse(bytes);
  validateOcrPages(parsed, maxPages);
  const diagnostics: OcrPageDiagnostic[] = [];
  for (const page of parsed.pages) {
    const original = normalize(page.text), signals = page.complexity;
    const reasons = fallbackReasons(signals, mode as OcrMode);
    const preserve = mode === 'auto' && reasons.length > 0 && preserveSelectiveHeader(page);
    if (preserve) reasons.push('selective_model_header_preserved');
    const diagnostic: OcrPageDiagnostic = {
      page: page.pageNum, method: 'selective', reasons, warnings: [],
      nativeTextLength: signals?.textLength ?? null, imageCoverage: signals?.imageCoverage ?? null,
      selectiveTextSha256: hash(original), selectiveTextBytes: Buffer.byteLength(original),
      outputTextSha256: hash(original), outputTextBytes: Buffer.byteLength(original), selectedAttempt: null, attempts: [],
    };
    if (reasons.length && !preserve) {
      const raster = async (requested: number) => {
        const dpi = boundedDpi(page.width, page.height, requested);
        const engine = new LiteParse({ ...config, dpi });
        const shots = await engine.screenshot(bytes, [page.pageNum]);
        const shot = shots[0];
        if (shots.length !== 1 || !shot || shot.pageNum !== page.pageNum || shot.width * shot.height > MAX_RASTER_PIXELS
            || shot.imageBuffer.length > 50 * 1024 * 1024) throw new Error('Raster bounds exceeded.');
        // Parsing the PNG removes the misleading native text layer. Only pixels become OCR evidence.
        const result = await new LiteParse({ ...config, dpi, maxPages: 1 }).parse(shot.imageBuffer);
        validateOcrPages(result, 1);
        if (result.totalPages !== 1) throw new Error('Raster OCR returned unexpected pages.');
        const candidate = result.pages[0]!;
        candidate.text = normalize(candidate.text);
        diagnostic.attempts.push({ dpi, width: shot.width, height: shot.height, imageSha256: hash(shot.imageBuffer),
          textSha256: hash(candidate.text), textBytes: Buffer.byteLength(candidate.text), headerIdentifier: hasHeaderIdentifier(candidate) });
        return candidate;
      };
      let candidate = await raster(300), selected = 0;
      if (needsHeaderRetry(candidate) && boundedDpi(page.width, page.height, 450) > diagnostic.attempts[0]!.dpi) {
        const second = await raster(450);
        if (hasHeaderIdentifier(second) && usableReplacement(candidate.text, second.text)) { candidate = second; selected = 1; }
      }
      if (mode === 'raster' || usableReplacement(original, candidate.text)) {
        page.text = candidate.text; diagnostic.method = 'raster'; diagnostic.selectedAttempt = selected;
        if (needsHeaderRetry(candidate)) diagnostic.warnings.push('model_header_not_resolved');
      } else diagnostic.warnings.push('raster_replacement_rejected');
      if (contentLength(candidate.text) < 200) diagnostic.warnings.push('sparse_raster_text');
    }
    const finalText = normalize(page.text);
    diagnostic.outputTextSha256 = hash(finalText); diagnostic.outputTextBytes = Buffer.byteLength(finalText);
    diagnostics.push(diagnostic);
  }
  await writeFile(output, JSON.stringify({ sourceSha256: hash(bytes), diagnostics, parsed: {
    totalPages: parsed.totalPages, pageErrors: parsed.pageErrors,
    pages: parsed.pages.map(p => ({ pageNum: p.pageNum, text: p.text })),
  } }), { mode: 0o600, flag: 'wx' });
}

main().catch(() => { process.exitCode = 1; });
