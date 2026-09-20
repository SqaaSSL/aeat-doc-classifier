import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readPdfPages, classifyPage, catalogVersion } from '../src/index.js';

// Public reference PDFs only. Never silently substitute private taxpayer documents.
const sources = [
  { id: '303-sample-2025', url: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/IVA/IVA_2025/Imagenes/Cap_9_303_eu_es.pdf', pages: [1, 2, 3], kind: 'tax_form', form: 'aeat-303' },
  { id: '303-instructions-2025', url: 'https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/G414/Inst_mod_303_2025.pdf', pages: [1], kind: 'instructions', form: 'aeat-303' },
];
await mkdir(new URL('./corpus/', import.meta.url), { recursive: true });
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const rows = [];
for (const source of sources) {
  const file = new URL(`./corpus/${source.id}.pdf`, import.meta.url);
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    const response = await fetch(source.url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Public PDF download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024 || bytes.subarray(0, 4).toString() !== '%PDF') throw new Error('Expected a public PDF under 50 MiB.');
    await writeFile(file, bytes);
  }
  const { fileURLToPath } = await import('node:url');
  const pages = await readPdfPages(fileURLToPath(file));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  for (const index of source.pages) {
    const page = pages[index - 1];
    if (!page) throw new Error('Reference PDF page missing.');
    const result = await classifyPage(page.text);
    const identityCorrect = result.candidates?.form.value === source.form && result.candidates.kind.value === source.kind;
    const wrongAccepted = result.status === 'accepted' && (!identityCorrect || result.jurisdiction !== 'aeat');
    rows.push({ source: source.url, sourceSha256: sha256, page: index, expectedKind: source.kind, expectedForm: source.form, identityCorrect, wrongAccepted, result });
    console.log(`${source.id} p${index}: ${result.status}, ${result.candidates?.form.value}, ${result.reasons.join(', ')}`);
  }
}
const summary = { pages: rows.length, identityCorrect: rows.filter(r => r.identityCorrect).length, accepted: rows.filter(r => r.result.status === 'accepted').length, wrongAccepted: rows.filter(r => r.wrongAccepted).length };
await writeFile(new URL('./results/pdf.json', import.meta.url), JSON.stringify({ evaluatedAt: new Date().toISOString(), catalogVersion, summary, rows, limitation: 'Four selected public reference pages from two PDFs of one AEAT model; not representative of filled taxpayer documents. Page-level authority may be absent on continuation pages.' }, null, 2) + '\n');
console.log(JSON.stringify(summary));
if (summary.wrongAccepted) process.exitCode = 1;
