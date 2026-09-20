// Acquisition/verification only. Deliberately has no inference or calibration call.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readPdfPages } from '../src/pdf.js';
import { normalizeText } from '../src/decisions.js';
import { validateCandidates, type CandidateManifest } from './calibration-types.js';
const sha = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--download')) throw new Error('Usage: npm run samples:verify -- [--download]');
  const manifest = JSON.parse(await readFile(new URL('./calibration-v1.json', import.meta.url), 'utf8')) as CandidateManifest;
  const previous = JSON.parse(await readFile(new URL('./public-v1.json', import.meta.url), 'utf8')) as { sources: Array<{ url: string; sha256: string }> };
  validateCandidates(manifest, previous.sources);
  const corpus = new URL('./corpus/calibration-v1/', import.meta.url);
  await mkdir(corpus, { recursive: true });
  for (const source of manifest.sources) {
    const file = new URL(`${source.id}.pdf`, corpus);
    let bytes: Buffer, downloaded = false;
    try { bytes = await readFile(file); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !args.includes('--download')) throw new Error(`Missing ${source.id}; use --download to acquire sources.`);
      const r = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (!r.ok || !r.body) throw new Error(`Download failed: ${source.id} HTTP ${r.status}`);
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const chunk of r.body) {
        size += chunk.length;
        if (size > source.bytes) throw new Error(`Source size changed: ${source.id}`);
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks); downloaded = true;
    }
    if (bytes.length !== source.bytes || bytes.subarray(0, 4).toString() !== '%PDF' || sha(bytes) !== source.sha256) throw new Error(`Source hash changed: ${source.id}; do not replace frozen data.`);
    if (downloaded) await writeFile(file, bytes, { flag: 'wx' });
    const pages = await readPdfPages(fileURLToPath(file));
    if (pages.length !== source.pageCount) throw new Error(`Page count changed: ${source.id}`);
    for (const c of source.cases) {
      const text = normalizeText(pages[c.page - 1]!.text);
      if (sha(text) !== c.nativeInputSha256 || Buffer.byteLength(text) !== c.nativeInputBytes) throw new Error(`Extraction changed: ${source.id}/${c.page}; verify Poppler version.`);
    }
    console.log(`Verified ${source.id}: ${source.cases.length} candidate pages (${source.split}).`);
  }
  console.log(JSON.stringify({ pdfs: manifest.sources.length, candidatePages: manifest.sources.reduce((n, s) => n + s.cases.length, 0),
    classifierCalls: 0, labelStatus: manifest.labelStatus }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Candidate verification failed.'); process.exitCode = 1; });
