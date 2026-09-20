import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { classifyPage, readPdfPages, readPdfWithOcr, jevBackend } from '../src/index.js';
import { DEFAULT_GATE, normalizeText } from '../src/decisions.js';
import type { PublicManifest } from './public-types.js';

// A fixed regression comparison, never the fresh Spanish calibration candidates.
const cases = [
  { sourceId: '130-131-order', page: 10, expectedForm: 'aeat-130' },
  { sourceId: '130-131-order', page: 12, expectedForm: 'aeat-131' },
  { sourceId: '102-form', page: 2, expectedForm: null },
  { sourceId: '200-payment', page: 1, expectedForm: null },
  { sourceId: '206-unsupported', page: 1, expectedForm: null },
];
const sha = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: npm run eval:ocr');
  if (!process.env.TYPESAFE_API_KEY?.trim()) throw new Error('Set TYPESAFE_API_KEY.');
  const manifest = JSON.parse(await readFile(new URL('./public-v1.json', import.meta.url), 'utf8')) as PublicManifest;
  const prepared = [];
  for (const sourceId of new Set(cases.map(c => c.sourceId))) {
    const source = manifest.sources.find(s => s.id === sourceId)!;
    const file = new URL(`./corpus/public-v1/${sourceId}.pdf`, import.meta.url);
    if (sha(await readFile(file)) !== source.sha256) throw new Error(`Source changed: ${sourceId}`);
    const native = await readPdfPages(fileURLToPath(file));
    const start = performance.now();
    const ocr = await readPdfWithOcr(fileURLToPath(file));
    const extractionMs = Math.round(performance.now() - start);
    if (native.length !== source.pageCount || ocr.pages.length !== source.pageCount) throw new Error('Missing pages.');
    for (const c of cases.filter(c => c.sourceId === sourceId)) {
      const before = normalizeText(native[c.page - 1]!.text), after = normalizeText(ocr.pages[c.page - 1]!.text);
      if (sha(before) !== source.cases.find(row => row.page === c.page)!.inputSha256) throw new Error('Baseline extraction changed.');
      prepared.push({ ...c, before, after, extraction: ocr.extraction, documentExtractionMs: extractionMs });
    }
    console.log(`Extracted ${sourceId}; preserved ${ocr.pages.length} source pages.`);
  }
  const startedAt = new Date().toISOString();
  const output = new URL(`./results/ocr-${startedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
  await mkdir(new URL('./results/', import.meta.url), { recursive: true });
  const rows: unknown[] = [];
  const run = { schemaVersion: 1, startedAt, model: 'jev-1.13.0', gate: DEFAULT_GATE,
    corpus: 'public-v1 extraction subset; inspected regression data, not independent validation', rows };
  await writeFile(output, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
  const backend = jevBackend({ model: run.model });
  for (const { before, after, ...item } of prepared) {
    const results = [];
    for (const [parser, input] of [['poppler', before], ['liteparse', after]] as const) {
      const start = performance.now();
      try { results.push({ parser, inputBytes: Buffer.byteLength(input), inputSha256: sha(input),
        result: await classifyPage(input, { backend }), elapsedMs: Math.round(performance.now() - start) }); }
      catch { results.push({ parser, inputBytes: Buffer.byteLength(input), inputSha256: sha(input), error: 'classification_failed' }); process.exitCode = 1; }
    }
    rows.push({ ...item, results });
    await writeFile(output, JSON.stringify(run, null, 2) + '\n');
    console.log(`${item.sourceId} p${item.page}: ${results.map(r => r.result ? `${r.parser} ${r.result.status}/${r.result.candidates?.form.value ?? 'none'}` : 'error').join('; ')}`);
  }
  console.log(`Saved ${fileURLToPath(output)}`);
}
main().catch(() => { console.error('OCR regression failed. Check corpus availability, source hashes and OCR setup.'); process.exitCode = 1; });
