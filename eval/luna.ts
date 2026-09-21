import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { classifyPage } from '../src/classify.js';
import { planContext } from '../src/context.js';
import { jevBackend } from '../src/jev.js';
import type { Backend } from '../src/types.js';
import type { OcrDocument } from '../src/ocr.js';
import { sha, outcome, pairedOcr, metrics, type Inputs, type Judgments, type Outcome } from './spanish-types.js';
import { lunaBackend, LUNA_MODEL, LUNA_INSTRUCTIONS, DISABLED_FEATURES, type LunaTransport } from './luna-backend.js';

const exec = promisify(execFile), prepare = process.argv[2] === '--prepare';
if (process.argv.length !== (prepare ? 3 : 2)) throw new Error('Usage: npm run eval:luna [-- --prepare]');
const bytes = async (path: string) => readFile(new URL(path, import.meta.url));
const jb = await bytes('./spanish-v1-judged.json'), ib = await bytes('./extraction-v3-inputs.json'), vb = await bytes('./luna-images-v1.json');
const refs = JSON.parse(jb.toString()) as Judgments;
const inputs = JSON.parse(ib.toString()) as Inputs & { extractionImplementationSha256: string };
const images = JSON.parse(vb.toString()) as { renderer: string; pages: Array<{ sourceId: string; page: number; file: string; sha256: string; bytes: number }> };
const docs = new Map<string, OcrDocument>();
for (const source of inputs.sources) {
  if (sha(await bytes(`./corpus/calibration-v1/${source.id}.pdf`)) !== source.sourceSha256) throw new Error('Changed source PDF');
  const doc = JSON.parse((await bytes(`./corpus/extraction-v3-${inputs.extractionImplementationSha256.slice(0, 12)}/${source.id}.json`)).toString()) as OcrDocument;
  if (doc.extraction.sourceSha256 !== source.sourceSha256 || doc.pages.length !== source.pages.length) throw new Error('Changed OCR source');
  for (const [i, p] of doc.pages.entries()) if (p.page !== i + 1 || sha(p.text) !== source.pages[i]!.sha256) throw new Error('Changed OCR text');
  docs.set(source.id, doc);
}
if (images.pages.length !== refs.cases.length) throw new Error('Incomplete image manifest');
const imagePaths = new Map<string, string>();
for (const [i, ref] of refs.cases.entries()) {
  const image = images.pages[i]!;
  if (image.sourceId !== ref.sourceId || image.page !== ref.page || !/^[a-f0-9]{20}\.png$/.test(image.file)) throw new Error('Changed image target');
  const path = new URL(`./corpus/luna-images-v1/${image.file}`, import.meta.url);
  if (sha(await readFile(path)) !== image.sha256) throw new Error('Changed image bytes');
  imagePaths.set(`${ref.sourceId}/${ref.page}`, fileURLToPath(path));
  planContext(docs.get(ref.sourceId)!.pages, ref.page);
}
const fingerprints: Array<[string, string]> = [];
for (const name of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.ts')).sort()) fingerprints.push([`src/${name}`, sha(await bytes(`../src/${name}`))]);
for (const name of ['luna.ts', 'luna-backend.ts', 'spanish-types.ts', 'public-types.ts']) fingerprints.push([`eval/${name}`, sha(await bytes(`./${name}`))]);
for (const name of ['aeat-models.json', 'pgc-accounts.json']) fingerprints.push([`data/${name}`, sha(await bytes(`../data/${name}`))]);
const protocol = { schemaVersion: 1, frozenAt: new Date().toISOString(), implementationSha256: sha(JSON.stringify(fingerprints)),
  judgmentsSha256: sha(jb), inputsSha256: sha(ib), imageManifestSha256: sha(vb),
  models: { jev: 'jev-1.13.0', luna: LUNA_MODEL }, lunaReasoningEffort: 'low',
  lunaInstructionsSha256: sha(LUNA_INSTRUCTIONS), disabledFeatures: DISABLED_FEATURES,
  conditions: ['jev/ocr', 'jev/context', 'luna/ocr', 'luna/context', 'luna/image'],
  method: 'Single prespecified run; 42 reviewed development targets; five outcomes each. Identical adaptive OCR and Choice criteria for both text backends, existing optional neighbor retry and unchanged 0.95 policy. Fresh isolated decisions reused within each contextual pair. Provider order alternates by page; image-only runs last. Image-only uses a complete 300-DPI PNG with no OCR text or source filename. No gold labels or earlier predictions enter inference. Codex CLI overhead and self-reported confidence preclude raw API price/confidence equivalence. No performance-based reruns or label changes.',
};
const protocolPath = new URL('./luna-v1-protocol.json', import.meta.url);
if (prepare) { await writeFile(protocolPath, JSON.stringify(protocol, null, 2) + '\n', { flag: 'wx' }); console.log('Protocol frozen; 42 text/image targets verified; no classification calls.'); process.exit(0); }
const pb = await readFile(protocolPath), frozen = JSON.parse(pb.toString()) as typeof protocol;
if (JSON.stringify({ ...protocol, frozenAt: '' }) !== JSON.stringify({ ...frozen, frozenAt: '' })) throw new Error('Frozen protocol changed');
if ((await exec('git', ['status', '--porcelain'])).stdout.trim()) throw new Error('Commit the frozen benchmark before inference');
const commit = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim(), cli = (await exec('codex', ['--version'])).stdout.trim();
const jev = jevBackend({ model: 'jev-1.13.0' }), startedAt = new Date().toISOString();
type Pair = Awaited<ReturnType<typeof pairedOcr>>;
type Call = { sourceId: string; page: number; provider: 'jev' | 'luna'; stage: 'ocr' | 'context' | 'image';
  requestSha256: string; elapsedMs: number; usage?: { input_tokens: number; output_tokens: number }; error?: string; transport?: LunaTransport };
const run = { schemaVersion: 1, startedAt, completedAt: startedAt, commit, protocol: frozen, protocolSha256: sha(pb), cli,
  rows: [] as Array<{ sourceId: string; page: number; inputSha256: string; imageSha256: string; jev: Pair; luna: Pair; image: Outcome }>,
  calls: [] as Call[], summary: {} as Record<string, unknown> };
const tracked = (sourceId: string, page: number, provider: 'jev' | 'luna', stage: Call['stage'], image?: string): Backend => ({ async ask(state, questions) {
  const call: Call = { sourceId, page, provider, stage, elapsedMs: 0,
    requestSha256: sha(JSON.stringify({ state: stage === 'image' ? { imageSha256: images.pages.find(i => i.sourceId === sourceId && i.page === page)!.sha256 } : state, questions })) };
  const start = performance.now(), backend = provider === 'jev' ? jev : lunaBackend(t => { call.transport = t; }, image);
  try { const response = await backend.ask(state, questions); call.usage = response.usage; return response; }
  catch (error) { call.error = error instanceof Error ? error.message : 'Request failed'; throw error; }
  finally { call.elapsedMs = Math.round(performance.now() - start); run.calls.push(call); }
} });
const score = () => Object.fromEntries(frozen.conditions.map(condition => {
  const [provider, mode] = condition.split('/');
  return [condition, metrics(run.rows.map((row, i) => ({ ...refs.cases[i]!, inputSha256: mode === 'image' ? row.imageSha256 : row.inputSha256,
    ...(mode === 'image' ? row.image : row[provider as 'jev' | 'luna'][mode as 'ocr' | 'context']) })))];
}));
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const output = new URL(`./results/luna-${startedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
await writeFile(output, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
for (const [i, ref] of refs.cases.entries()) {
  const pages = docs.get(ref.sourceId)!.pages, image = images.pages[i]!;
  const pair = async (provider: 'jev' | 'luna') => pairedOcr(pages, ref.page, tracked(ref.sourceId, ref.page, provider, 'ocr'), tracked(ref.sourceId, ref.page, provider, 'context'));
  let j: Pair, l: Pair;
  if (i % 2 === 0) { j = await pair('jev'); l = await pair('luna'); } else { l = await pair('luna'); j = await pair('jev'); }
  const vision = await outcome(() => classifyPage('Attached page image; no extracted text supplied.', { backend: tracked(ref.sourceId, ref.page, 'luna', 'image', imagePaths.get(`${ref.sourceId}/${ref.page}`)!) }));
  if (vision.result) vision.result.audit.inputSha256 = image.sha256;
  run.rows.push({ sourceId: ref.sourceId, page: ref.page, inputSha256: sha(pages[ref.page - 1]!.text), imageSha256: image.sha256, jev: j, luna: l, image: vision });
  run.completedAt = new Date().toISOString(); run.summary = score();
  await writeFile(output, JSON.stringify(run, null, 2) + '\n');
  console.log(`${i + 1}/42 ${ref.sourceId} p${ref.page}: Jev ${j.context.result?.status ?? 'error'}; Luna ${l.context.result?.status ?? 'error'}; image ${vision.result?.status ?? 'error'}`);
}
console.log(JSON.stringify(run.summary, null, 2)); console.log(fileURLToPath(output));
if (run.calls.some(c => c.error)) process.exitCode = 1;
