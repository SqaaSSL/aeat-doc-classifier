import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readPdfWithOcr, type OcrDocument } from '../src/ocr.js';
import { jevBackend } from '../src/jev.js';
import { planContext } from '../src/context.js';
import { DEFAULT_GATE } from '../src/decisions.js';
import type { Backend, DecisionResponse } from '../src/types.js';
import type { CandidateManifest } from './calibration-types.js';
import { sha, pairedOcr, metrics, safeError, type Judgments, type Inputs, type Call } from './spanish-types.js';

const exec = promisify(execFile);
const prepareOnly = process.argv[2] === '--prepare';
if (process.argv.length !== (prepareOnly ? 3 : 2)) throw new Error('Usage: npm run eval:extraction [-- --prepare]');
const acquisitionBytes = await readFile(new URL('./calibration-v1.json', import.meta.url));
const acquisition = JSON.parse(acquisitionBytes.toString()) as CandidateManifest;
const judgeBytes = await readFile(new URL('./spanish-v1-judged.json', import.meta.url));
const judgments = JSON.parse(judgeBytes.toString()) as Judgments;
const previousBytes = await readFile(new URL('./spanish-v1-inputs.json', import.meta.url));
const previous = JSON.parse(previousBytes.toString()) as Inputs;
const fingerprints: Array<[string, string]> = [];
for (const file of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.ts')).sort()) {
  fingerprints.push([`src/${file}`, sha(await readFile(new URL(`../src/${file}`, import.meta.url)))]);
}
for (const file of ['aeat-models.json', 'pgc-accounts.json']) fingerprints.push([`data/${file}`, sha(await readFile(new URL(`../data/${file}`, import.meta.url)))]);
const implementationSha256 = sha(JSON.stringify(fingerprints));
const extractionSha256 = sha(JSON.stringify(fingerprints.filter(([file]) => file.startsWith('src/ocr'))));
const cache = new URL(`./corpus/extraction-v3-${extractionSha256.slice(0, 12)}/`, import.meta.url);
await mkdir(cache, { recursive: true });
const inputs: Inputs & { extractionImplementationSha256: string; strategy: string } = {
  schemaVersion: 1, frozenAt: new Date().toISOString(), acquisitionSha256: sha(acquisitionBytes),
  extractionImplementationSha256: extractionSha256, strategy: 'adaptive-raster-v2',
  parser: 'LiteParse 2.14.6; adaptive full-page raster fallback', language: 'spa', normalization: 'nfc-trim-v1', sources: [],
};
const prepared = new Map<string, { selective: OcrDocument; adaptive: OcrDocument }>();
for (const source of acquisition.sources) {
  const path = fileURLToPath(new URL(`./corpus/calibration-v1/${source.id}.pdf`, import.meta.url));
  if (sha(await readFile(path)) !== source.sha256) throw new Error(`Source changed: ${source.id}`);
  const selective = JSON.parse(await readFile(new URL(`./corpus/spanish-v1-prepared/${source.id}.json`, import.meta.url), 'utf8')) as OcrDocument;
  const file = new URL(`${source.id}.json`, cache);
  let adaptive: OcrDocument & { extractionMs: number };
  try { adaptive = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !prepareOnly) throw error;
    const start = performance.now();
    const result = await readPdfWithOcr(path, { ocrMode: 'auto' });
    adaptive = { ...result, extractionMs: Math.round(performance.now() - start) };
    await writeFile(file, JSON.stringify(adaptive), { flag: 'wx' });
  }
  const oldSource = previous.sources.find(s => s.id === source.id)!;
  for (const doc of [selective, adaptive]) if (doc.pages.length !== source.pageCount || doc.extraction.sourceSha256 !== source.sha256) throw new Error('Missing source pages.');
  if (adaptive.extraction.strategy !== 'adaptive-raster-v2') throw new Error('Wrong extraction strategy.');
  for (const [i, page] of selective.pages.entries()) if (page.page !== i + 1 || sha(page.text) !== oldSource.pages[i]!.sha256) throw new Error('Changed baseline extraction.');
  for (const [i, page] of adaptive.pages.entries()) {
    const d = adaptive.extraction.pageDiagnostics[i]!;
    if (page.page !== i + 1 || d.page !== page.page || d.outputTextSha256 !== sha(page.text)) throw new Error('Changed adaptive page evidence.');
    if (d.selectiveTextSha256 !== oldSource.pages[i]!.sha256) throw new Error('The first extraction stage changed; this is not a fallback-only comparison.');
  }
  for (const c of source.cases) { planContext(selective.pages, c.page); planContext(adaptive.pages, c.page); }
  inputs.sources.push({ id: source.id, sourceSha256: source.sha256, extractionMs: adaptive.extractionMs,
    pages: adaptive.pages.map(p => ({ page: p.page, sha256: sha(p.text), bytes: Buffer.byteLength(p.text) })) });
  prepared.set(source.id, { selective, adaptive });
  console.log(`${source.id}: ${source.pageCount} pages verified; ${adaptive.extraction.pageDiagnostics.filter(d => d.method === 'raster').length} raster fallbacks; ${adaptive.extractionMs} ms`);
}
const inputFile = new URL('./extraction-v3-inputs.json', import.meta.url);
const evidence = (value: Inputs) => JSON.stringify(value.sources.map(({ extractionMs: _time, ...source }) => source));
if (prepareOnly) {
  let existing: typeof inputs | undefined;
  try { existing = JSON.parse(await readFile(inputFile, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (existing) {
    if (existing.extractionImplementationSha256 !== extractionSha256 || evidence(existing) !== evidence(inputs)) throw new Error('Frozen extraction changed; manifest not overwritten.');
    console.log('Frozen adaptive inputs verified; no classifier calls made.');
  } else {
    await writeFile(inputFile, JSON.stringify(inputs, null, 2) + '\n', { flag: 'wx' });
    console.log('New extraction inputs frozen; no classifier calls made.');
  }
  process.exit(0);
}
const inputBytes = await readFile(inputFile), frozen = JSON.parse(inputBytes.toString()) as typeof inputs;
if (frozen.extractionImplementationSha256 !== extractionSha256 || evidence(frozen) !== evidence(inputs)) throw new Error('Frozen extraction changed.');
const { stdout: dirty } = await exec('git', ['status', '--porcelain']);
if (dirty.trim()) throw new Error('Commit the implementation and frozen inputs before inference.');
const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD']);
const model = 'jev-1.13.0', backend = jevBackend({ model }), startedAt = new Date().toISOString();
type Pair = Awaited<ReturnType<typeof pairedOcr>>;
const run = {
  schemaVersion: 1, experiment: 'adaptive-raster-v2', interpretation: 'Development ablation on the reviewed 42-page corpus; not a new holdout. No threshold or classifier prompt changes.',
  startedAt, completedAt: startedAt, commit: commit.trim(), implementationSha256,
  judgmentsSha256: sha(judgeBytes), baselineInputsSha256: sha(previousBytes), inputsSha256: sha(inputBytes),
  acquisitionSha256: sha(acquisitionBytes), model, gate: DEFAULT_GATE,
  environment: { node: process.version, parser: 'LiteParse 2.14.6', language: 'spa' },
  calls: [] as Array<Call & { variant: 'selective' | 'adaptive'; cacheHit: boolean }>,
  rows: [] as Array<{ sourceId: string; page: number; selective: Pair; adaptive: Pair; extraction: OcrDocument['extraction']['pageDiagnostics'][number] }>,
  summary: {} as Record<string, unknown>,
};
// Identical requests share the same reply OR error across conditions. Cache keys contain no labels.
const requests = new Map<string, Promise<DecisionResponse>>();
const tracked = (sourceId: string, page: number, variant: 'selective' | 'adaptive', stage: 'ocr' | 'context'): Backend => ({ async ask(state, questions) {
  const requestSha256 = sha(JSON.stringify({ model, state, questions })), cacheHit = requests.has(requestSha256);
  const call: typeof run.calls[number] = { sourceId, page, variant, stage, cacheHit, requestSha256, elapsedMs: 0, startedAt: new Date().toISOString() };
  const start = performance.now();
  if (!cacheHit) requests.set(requestSha256, backend.ask(state, questions));
  try { const reply = await requests.get(requestSha256)!; call.model = reply.model; call.usage = reply.usage; return reply; }
  catch (error) { call.error = safeError(error); throw error; }
  finally { call.elapsedMs = Math.round(performance.now() - start); run.calls.push(call); }
} });
const score = () => Object.fromEntries(['all', 'calibration', 'validation-reserved'].map(split => [split,
  Object.fromEntries((['selective', 'adaptive'] as const).map(variant => [variant,
    Object.fromEntries((['ocr', 'context'] as const).map(mode => [mode, metrics(run.rows.flatMap(row => {
      const c = judgments.cases.find(c => c.sourceId === row.sourceId && c.page === row.page)!;
      if (split !== 'all' && c.split !== split) return [];
      const p = (variant === 'selective' ? previous : frozen).sources.find(s => s.id === row.sourceId)!.pages[row.page - 1]!;
      return [{ ...c, inputSha256: p.sha256, inputBytes: p.bytes, ...row[variant][mode] }];
    }))]))]))]));
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const output = new URL(`./results/extraction-${startedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
await writeFile(output, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
for (const c of judgments.cases) {
  const p = prepared.get(c.sourceId)!;
  const selective = await pairedOcr(p.selective.pages, c.page, tracked(c.sourceId, c.page, 'selective', 'ocr'), tracked(c.sourceId, c.page, 'selective', 'context'));
  const adaptive = await pairedOcr(p.adaptive.pages, c.page, tracked(c.sourceId, c.page, 'adaptive', 'ocr'), tracked(c.sourceId, c.page, 'adaptive', 'context'));
  run.rows.push({ sourceId: c.sourceId, page: c.page, selective, adaptive, extraction: p.adaptive.extraction.pageDiagnostics[c.page - 1]! });
  run.completedAt = new Date().toISOString(); run.summary = score();
  await writeFile(output, JSON.stringify(run, null, 2) + '\n');
  console.log(`${c.sourceId} p${c.page}: ${selective.context.result?.status ?? 'error'} -> ${adaptive.context.result?.status ?? 'error'}; ${adaptive.context.result?.candidates?.form.value ?? 'no prediction'}`);
}
console.log(JSON.stringify(run.summary, null, 2)); console.log(fileURLToPath(output));
if (run.calls.some(c => c.error)) process.exitCode = 1;
