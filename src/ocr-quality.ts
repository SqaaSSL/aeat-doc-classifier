/** Extraction heuristics use page evidence only, never catalog labels or filenames. */
export const OCR_MODES = ['auto', 'selective', 'raster'] as const;
export type OcrMode = typeof OCR_MODES[number];
export const MAX_RASTER_PIXELS = 24_000_000;
export interface PageSignals { textLength: number; imageCoverage: number; isGarbled: boolean }
export interface RasterPage {
  width: number; height: number; text: string;
  textItems: Array<{ text: string; x: number; y: number; width: number; height: number }>;
}
export interface RasterAttempt {
  dpi: number; width: number; height: number; imageSha256: string;
  textSha256: string; textBytes: number; headerIdentifier: boolean;
}
export interface OcrPageDiagnostic {
  page: number; method: 'selective' | 'raster'; reasons: string[]; warnings: string[];
  nativeTextLength: number | null; imageCoverage: number | null;
  selectiveTextSha256: string; selectiveTextBytes: number;
  outputTextSha256: string; outputTextBytes: number;
  selectedAttempt: number | null; attempts: RasterAttempt[];
}

export function fallbackReasons(signals: PageSignals | undefined, mode: OcrMode): string[] {
  if (mode === 'selective') return [];
  if (mode === 'raster') return ['raster_mode_requested'];
  if (!signals || !Number.isFinite(signals.imageCoverage) || !Number.isFinite(signals.textLength)) throw new Error('Missing page complexity evidence.');
  if (signals.imageCoverage < 0.15) return [];
  if (signals.textLength < 500) return ['substantial_image_with_sparse_native_text'];
  return signals.isGarbled ? ['substantial_image_with_garbled_native_text'] : [];
}

/** Cap allocation before asking the native renderer to create a bitmap. */
export function boundedDpi(width: number, height: number, requested: number): number {
  if (![width, height, requested].every(n => Number.isFinite(n) && n > 0) || requested > 450) throw new Error('Invalid raster dimensions.');
  const fits = (dpi: number) => Math.ceil(width * dpi / 72) * Math.ceil(height * dpi / 72) <= MAX_RASTER_PIXELS;
  let dpi = Math.min(requested, Math.floor(72 * Math.sqrt(MAX_RASTER_PIXELS / (width * height))));
  while (dpi >= 72 && !fits(dpi)) dpi--;
  if (dpi < 72) throw new Error('Page too large for bounded raster OCR.');
  return dpi;
}

/** A printed model header has a nearby 2–4 digit identifier; accept any number, supported or not. */
export function hasHeaderIdentifier(page: RasterPage): boolean {
  const labels = page.textItems.filter(t => /\bmodel[o0]\b/iu.test(t.text) && t.y >= 0 && t.y < page.height * 0.35);
  return labels.some(label => {
    if (/\bmodel[o0]\s*[:.-]?\s*\d(?:\s*\d){1,3}\b/iu.test(label.text)) return true;
    return page.textItems.some(item => /^\s*\d(?:\s*\d){1,3}\s*$/u.test(item.text)
      && item.y >= label.y - page.height * 0.01 && item.y <= label.y + label.height + page.height * 0.08
      && Math.abs(item.x + item.width / 2 - label.x - label.width / 2) <= page.width * 0.08);
  });
}

export function needsHeaderRetry(page: RasterPage): boolean {
  return /\b(?:modelo|autoliquidaci[oó]n|declaraci[oó]n[- ]liquidaci[oó]n)\b/iu.test(page.text)
    && !hasHeaderIdentifier(page);
}
export const contentLength = (text: string) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Reject an empty/severely depleted replacement; length is a guard, not an accuracy score. */
export function usableReplacement(before: string, after: string): boolean {
  const a = contentLength(before), b = contentLength(after);
  return b > 0 && b >= Math.min(50, a) && b >= a * 0.4;
}
