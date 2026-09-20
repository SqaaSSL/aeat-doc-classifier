import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { classifyPageWithContext, readPdfPages, jevBackend, planContext, DEFAULT_GATE, type ContextualPageResult } from '../src/index.js';
import { normalizeText } from '../src/decisions.js';
import { summarize, type PublicManifest, type PublicRow } from './public-types.js';
import { contextSummary } from './context-metrics.js';

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const exec = promisify(execFile);
const manifestBytes = await readFile(new URL('./public-v1.json', import.meta.url));
const manifest = JSON.parse(manifestBytes.toString()) as PublicManifest;
const prepared = [];
const parseStart = performance.now();
for (const source of manifest.sources) {
  const file = new URL(`./corpus/public-v1/${source.id}.pdf`, import.meta.url), bytes = await readFile(file);
  if (hash(bytes) !== source.sha256) throw new Error(`Source changed: ${source.id}.`);
  const pages = await readPdfPages(fileURLToPath(file));
  if (pages.length !== source.pageCount) throw new Error(`Page count changed: ${source.id}.`);
  for (const c of source.cases) {
    if (hash(normalizeText(pages[c.page - 1]!.text)) !== c.inputSha256) throw new Error(`Target text changed: ${source.id}/${c.page}.`);
    planContext(pages, c.page);
    prepared.push({ sourceId: source.id, pages, c });
  }
}
const extractionMs = Math.round(performance.now() - parseStart);
const fingerprint = [];
for (const file of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.ts')).sort()) {
  fingerprint.push([`src/${file}`, hash(await readFile(new URL(`../src/${file}`, import.meta.url)))]);
}
for (const file of ['aeat-models.json', 'pgc-accounts.json']) fingerprint.push([`data/${file}`, hash(await readFile(new URL(`../data/${file}`, import.meta.url)))]);
const startedAt = new Date().toISOString();
const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD']);
const { stderr: poppler } = await exec('pdftotext', ['-v']);
const report = {
  schemaVersion: 1, experiment: 'neighbors-v1', interpretation: 'Development ablation on the previously inspected public-v1 corpus; not a new held-out accuracy estimate.',
  startedAt, completedAt: startedAt, model: 'jev-1.13.0', gate: DEFAULT_GATE,
  commit: commit.trim(), implementationSha256: hash(JSON.stringify(fingerprint)), manifestSha256: hash(manifestBytes),
  environment: { node: process.version, poppler: poppler.split('\n')[0] }, extractionMs,
  rows: [] as Array<PublicRow & { contextual?: ContextualPageResult }>,
  summary: {} as Record<string, unknown>,
};
const folder = new URL('./results/', import.meta.url); await mkdir(folder, { recursive: true });
const out = new URL(`context-${startedAt.replace(/[:.]/g, '-')}.json`, folder);
await writeFile(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const backend = jevBackend({ model: report.model });
for (const item of prepared) {
  const row: typeof report.rows[number] = { sourceId: item.sourceId, ...item.c, elapsedMs: 0 };
  const start = performance.now();
  try {
    row.contextual = await classifyPageWithContext(item.pages, item.c.page, { backend });
    row.result = row.contextual.result;
  } catch { row.error = 'classification_failed'; }
  row.elapsedMs = Math.round(performance.now() - start);
  report.rows.push(row); report.completedAt = new Date().toISOString();
  report.summary = contextSummary(report.rows);
  await writeFile(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`${row.sourceId} p${row.page}: ${row.contextual?.pageOnly.status ?? 'error'} -> ${row.result?.status ?? 'error'} (${row.result?.candidates?.form.value ?? 'none'}); ${row.contextual?.context.reason ?? row.error}`);
}
console.log(JSON.stringify(report.summary, null, 2)); console.log(fileURLToPath(out));
const final = summarize(report.rows);
if (final.errors || final.wrongAccepted) process.exitCode = 1;
