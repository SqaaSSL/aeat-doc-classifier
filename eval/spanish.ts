import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { classifyPage, readPdfPages, jevBackend, planContext, DEFAULT_GATE } from '../src/index.js';
import { readPdfWithOcr, type OcrDocument } from '../src/ocr.js';
import { normalizeText } from '../src/decisions.js';
import type { Backend } from '../src/types.js';
import type { CandidateManifest } from './calibration-types.js';
import { sha, safeError, outcome, pairedOcr, summary, verifyRun, type Judgments, type Inputs, type SpanishRow, type Call, type Mode } from './spanish-types.js';

const exec = promisify(execFile);
const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--prepare')) throw new Error('Usage: npm run eval:spanish [-- --prepare]');
const prepareOnly = args[0] === '--prepare';
const acquisitionBytes = await readFile(new URL('./calibration-v1.json', import.meta.url));
const acquisition = JSON.parse(acquisitionBytes.toString()) as CandidateManifest;
const judgeBytes = await readFile(new URL('./spanish-v1-judged.json', import.meta.url));
const judgments = JSON.parse(judgeBytes.toString()) as Judgments;
const inputBytes = await readFile(new URL('./spanish-v1-inputs.json', import.meta.url));
const inputs = JSON.parse(inputBytes.toString()) as Inputs;
if ([judgments, inputs].some(m => m.acquisitionSha256 !== sha(acquisitionBytes))) throw new Error('Acquisition manifest changed.');
const cache = new URL('./corpus/spanish-v1-prepared/', import.meta.url);
await mkdir(cache, { recursive: true });
const prepared = new Map<string, { native: Awaited<ReturnType<typeof readPdfPages>>; ocr: OcrDocument['pages'] }>();
for (const source of acquisition.sources) {
  const pdf = new URL(`./corpus/calibration-v1/${source.id}.pdf`, import.meta.url);
  const bytes = await readFile(pdf);
  if (sha(bytes) !== source.sha256 || bytes.length !== source.bytes) throw new Error(`Source changed: ${source.id}`);
  const native = await readPdfPages(fileURLToPath(pdf));
  const cached = new URL(`${source.id}.json`, cache);
  let parsed: OcrDocument;
  try { parsed = JSON.parse(await readFile(cached, 'utf8')) as OcrDocument; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    parsed = await readPdfWithOcr(fileURLToPath(pdf), { ocrMode: 'selective' });
    await writeFile(cached, JSON.stringify(parsed), { flag: 'wx' });
  }
  const frozen = inputs.sources.find(s => s.id === source.id);
  if (!frozen || frozen.sourceSha256 !== source.sha256 || native.length !== source.pageCount
      || parsed.pages.length !== source.pageCount || frozen.pages.length !== source.pageCount
      || parsed.extraction.sourceSha256 !== source.sha256 || parsed.extraction.version !== '2.14.6'
      || parsed.extraction.ocrLanguage !== 'spa' || !parsed.extraction.ocrEnabled
      || parsed.extraction.normalization !== 'nfc-trim-v1') throw new Error(`Extraction provenance mismatch: ${source.id}`);
  for (const [i, p] of parsed.pages.entries()) {
    const f = frozen.pages[i]!;
    if (p.page !== i + 1 || f.page !== p.page || sha(normalizeText(p.text)) !== f.sha256 || Buffer.byteLength(p.text) !== f.bytes) throw new Error(`OCR text changed: ${source.id}/${i + 1}`);
  }
  for (const c of judgments.cases.filter(c => c.sourceId === source.id)) {
    const text = normalizeText(native[c.page - 1]!.text);
    if (sha(text) !== c.inputSha256 || Buffer.byteLength(text) !== c.inputBytes) throw new Error(`Native text changed: ${source.id}/${c.page}`);
    planContext(parsed.pages, c.page);
  }
  prepared.set(source.id, { native, ocr: parsed.pages });
  console.log(`Verified native and Spanish OCR inputs: ${source.id}`);
}
if (prepareOnly) { console.log('All frozen inputs verified; no inference performed.'); process.exit(0); }
const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD']);
const { stdout: dirty } = await exec('git', ['status', '--porcelain']);
if (dirty.trim()) throw new Error('Commit the reviewed labels, inputs and runner before live evaluation.');
const fingerprint = [];
for (const file of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.ts')).sort()) fingerprint.push([`src/${file}`, sha(await readFile(new URL(`../src/${file}`, import.meta.url)))]);
for (const file of ['aeat-models.json', 'pgc-accounts.json']) fingerprint.push([`data/${file}`, sha(await readFile(new URL(`../data/${file}`, import.meta.url)))]);
const { stderr: poppler } = await exec('pdftotext', ['-v']);
const startedAt = new Date().toISOString();
const model = 'jev-1.13.0';
const report = {
  schemaVersion: 1, experiment: 'spanish-reviewed-v1', startedAt, completedAt: startedAt,
  commit: commit.trim(), implementationSha256: sha(JSON.stringify(fingerprint)),
  judgmentsSha256: sha(judgeBytes), inputsSha256: sha(inputBytes), acquisitionSha256: sha(acquisitionBytes),
  model, gate: DEFAULT_GATE, environment: { node: process.version, poppler: poppler.split('\n')[0], ocr: 'LiteParse 2.14.6 / spa' },
  protocol: 'Fixed gates and prompts. All 42 labels visually reviewed by Codex before inference. Three paired conditions; replay the same OCR isolated reply locally for the context baseline. No label, URL or filename enters model state. First run retained, failures included. No threshold fitting.',
  rows: [] as SpanishRow[], calls: [] as Call[], summary: {} as ReturnType<typeof summary>,
};
const backend = jevBackend({ model });
const tracked = (sourceId: string, page: number, stage: Mode): Backend => ({ async ask(state, questions) {
  const call: Call = { sourceId, page, stage, startedAt: new Date().toISOString(), elapsedMs: 0, requestSha256: sha(JSON.stringify({ model, state, questions })) };
  const start = performance.now();
  try { const reply = await backend.ask(state, questions); call.model = reply.model; call.usage = reply.usage; return reply; }
  catch (error) { call.error = safeError(error); throw error; }
  finally { call.elapsedMs = Math.round(performance.now() - start); report.calls.push(call); }
} });
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const out = new URL(`./results/spanish-${startedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
await writeFile(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
for (const c of judgments.cases) {
  const p = prepared.get(c.sourceId)!;
  const native = await outcome(() => classifyPage(p.native[c.page - 1]!.text, { backend: tracked(c.sourceId, c.page, 'native') }));
  const paired = await pairedOcr(p.ocr, c.page, tracked(c.sourceId, c.page, 'ocr'), tracked(c.sourceId, c.page, 'context'));
  const row: SpanishRow = { sourceId: c.sourceId, page: c.page, native, ...paired };
  report.rows.push(row); report.completedAt = new Date().toISOString(); report.summary = summary(report.rows, judgments, inputs);
  await writeFile(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`${c.sourceId} p${c.page}: ${native.result?.status ?? 'error'} / ${paired.ocr.result?.status ?? 'error'} / ${paired.context.result?.status ?? 'error'}`);
}
verifyRun(report.rows, judgments, inputs);
console.log(JSON.stringify(report.summary, null, 2)); console.log(fileURLToPath(out));
if (report.calls.some(c => c.error)) process.exitCode = 1;
