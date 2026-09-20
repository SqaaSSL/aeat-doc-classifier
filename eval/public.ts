import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { classifyPage, readPdfPages } from '../src/index.js';
import { DEFAULT_GATE, normalizeText } from '../src/decisions.js';
import { jevBackend } from '../src/jev.js';
import { summarize, type PublicManifest, type PublicRow, type PublicRun } from './public-types.js';

const exec = promisify(execFile);
const root = new URL('../', import.meta.url);
const manifestFile = new URL('./public-v1.json', import.meta.url);
const corpus = new URL('./corpus/public-v1/', import.meta.url);
const results = new URL('./results/', import.meta.url);
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const maxPdfBytes = 50 * 1024 * 1024;
const hosts = new Set(['sede.agenciatributaria.gob.es', 'www.boe.es', 'www.irs.gov',
  'www3.gobiernodecanarias.org', 'atc.gencat.cat', 'gidak.bizkaia.eus']);

async function download(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('Corpus source must be an allowlisted public government HTTPS URL.');
  }
  // No provider credentials are used in corpus downloads.
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Corpus download failed: HTTP ${response.status}.`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxPdfBytes) throw new Error('Corpus PDF exceeds 50 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--download-only')) {
    throw new Error('Usage: npm run eval:public -- [--download-only]');
  }
  const downloadOnly = args[0] === '--download-only';
  if (!downloadOnly && !process.env.TYPESAFE_API_KEY?.trim()) throw new Error('Set TYPESAFE_API_KEY before a live benchmark.');
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString()) as PublicManifest;
  await mkdir(corpus, { recursive: true });
  const prepared: { sourceId: string; text: string; annotation: PublicRow }[] = [];
  const sourceIds = new Set<string>(), sourceHashes = new Set<string>(), inputHashes = new Set<string>();
  for (const source of manifest.sources) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id) || sourceIds.has(source.id) || sourceHashes.has(source.sha256)) {
      throw new Error('Invalid or duplicate corpus source.');
    }
    sourceIds.add(source.id); sourceHashes.add(source.sha256);
    const file = new URL(`${source.id}.pdf`, corpus);
    let bytes: Buffer, downloaded = false;
    try { bytes = await readFile(file); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      bytes = await download(source.url); downloaded = true;
    }
    if (bytes.length !== source.bytes || bytes.length > maxPdfBytes || bytes.subarray(0, 4).toString() !== '%PDF'
        || sha256(bytes) !== source.sha256) throw new Error(`Source changed: ${source.id}. Refuse to silently replace the frozen corpus.`);
    if (downloaded) await writeFile(file, bytes, { flag: 'wx' });
    const pages = await readPdfPages(fileURLToPath(file));
    if (pages.length !== source.pageCount) throw new Error(`Page count changed: ${source.id}.`);
    const selected = new Set<number>();
    for (const annotation of source.cases) {
      if (!Number.isInteger(annotation.page) || selected.has(annotation.page)) throw new Error('Invalid or duplicate case page.');
      selected.add(annotation.page);
      const page = pages[annotation.page - 1];
      if (!page) throw new Error(`Page missing: ${source.id}/${annotation.page}.`);
      const text = normalizeText(page.text);
      if (sha256(text) !== annotation.inputSha256 || Buffer.byteLength(text) !== annotation.inputBytes) {
        throw new Error(`Extraction changed: ${source.id}/${annotation.page}. Check Poppler version; do not relabel automatically.`);
      }
      if (annotation.group !== 'extraction') {
        if (!text || inputHashes.has(annotation.inputSha256)) throw new Error('Empty or duplicate recognition input.');
        inputHashes.add(annotation.inputSha256);
      }
      prepared.push({ sourceId: source.id, text, annotation: { ...annotation, sourceId: source.id, elapsedMs: 0 } });
    }
    console.log(`Verified ${source.id}: ${source.cases.length} selected pages.`);
  }
  console.log(`Frozen corpus verified: ${manifest.sources.length} PDFs, ${prepared.length} pages.`);
  if (downloadOnly) return;

  // Hash every classifier source and both catalogs; no filename or expected label enters model state.
  const fingerprint: [string, string][] = [];
  for (const name of (await readdir(new URL('../src/', import.meta.url))).filter(n => n.endsWith('.ts')).sort()) {
    fingerprint.push([`src/${name}`, sha256(await readFile(new URL(`../src/${name}`, import.meta.url)))]);
  }
  for (const name of ['aeat-models.json', 'pgc-accounts.json']) {
    fingerprint.push([`data/${name}`, sha256(await readFile(new URL(`../data/${name}`, import.meta.url)))]);
  }
  const cwd = fileURLToPath(root);
  const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD'], { cwd });
  const { stdout: dirty } = await exec('git', ['status', '--porcelain'], { cwd });
  const poppler = await exec('pdftotext', ['-v']);
  const startedAt = new Date().toISOString(), rows: PublicRow[] = [];
  await mkdir(results, { recursive: true });
  // Exclusive creation preserves previous runs, including partial runs and failures.
  const output = new URL(`public-v1-${startedAt.replace(/[:.]/g, '-')}.json`, results);
  const run: PublicRun = {
    schemaVersion: 1, startedAt, completedAt: startedAt,
    manifestSha256: sha256(manifestBytes), implementationSha256: sha256(JSON.stringify(fingerprint)),
    classifierCommit: commit.trim(), workingTreeDirty: !!dirty.trim(), model: 'jev-1.13.0', gate: DEFAULT_GATE,
    environment: { node: process.version, poppler: (poppler.stderr || poppler.stdout).split('\n')[0]! },
    manifest, summary: summarize(rows), rows,
  };
  await writeFile(output, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
  const backend = jevBackend({ model: run.model });
  for (const item of prepared) {
    const start = performance.now();
    const row = item.annotation;
    try { row.result = await classifyPage(item.text, { backend }); }
    catch { row.error = 'classification_failed'; }
    row.elapsedMs = Math.round(performance.now() - start);
    rows.push(row);
    run.completedAt = new Date().toISOString(); run.summary = summarize(rows);
    await writeFile(output, JSON.stringify(run, null, 2) + '\n');
    console.log(`${item.sourceId} p${row.page}: ${row.result?.status ?? row.error}; candidate ${row.result?.candidates?.form.value ?? 'none'}`);
  }
  console.log(JSON.stringify(run.summary, null, 2));
  console.log(`Saved ${fileURLToPath(output)}`);
  if (run.summary.errors || run.summary.wrongAccepted) process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Benchmark failed.'); process.exitCode = 1; });
