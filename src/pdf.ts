import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
export interface PdfPage { page: number; text: string; textStatus: 'text' | 'no_extractable_text' }

export async function readPdfPages(path: string, options: { maxPages?: number } = {}): Promise<PdfPage[]> {
  const file = resolve(path), maxPages = options.maxPages ?? 100;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new Error('maxPages must be an integer from 1 to 1000.');
  await access(file);
  const info = await stat(file);
  if (!info.isFile() || info.size > 50 * 1024 * 1024) throw new Error('Expected a PDF file no larger than 50 MiB.');
  try {
    const { stdout: metadata } = await run('pdfinfo', [file], { timeout: 30_000, maxBuffer: 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } });
    const count = Number(/^Pages:\s+(\d+)/m.exec(metadata)?.[1]);
    if (!Number.isSafeInteger(count) || count < 1 || count > maxPages) throw new Error('PDF page count is invalid or exceeds maxPages.');
    const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { timeout: 60_000, maxBuffer: 24 * 1024 * 1024 });
    const chunks = stdout.split('\f');
    if (chunks.length === count + 1 && !chunks[count]!.trim()) chunks.pop();
    if (chunks.length !== count) throw new Error('PDF page boundaries could not be verified.');
    return chunks.map((chunk, i) => {
      const text = chunk.trim();
      return { page: i + 1, text, textStatus: text ? 'text' : 'no_extractable_text' };
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Install Poppler (pdfinfo and pdftotext) to read PDFs.');
    // Poppler stderr can contain document content; keep it out of downstream logs.
    if (error instanceof Error && /^(PDF page)/.test(error.message)) throw error;
    throw new Error('PDF extraction failed. Check encryption, file integrity and Poppler installation.');
  }
}
