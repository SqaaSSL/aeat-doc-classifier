import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runCli, type CliOptions } from '../src/cli-runner.js';
import { JevError, type Backend } from '../src/index.js';

async function call(args: string[], text: string | Buffer = '', options: CliOptions = {}) {
  let stdout = '', stderr = '';
  const exit = await runCli(args, {
    env: {}, stdinIsTTY: false, stdin: (async function* () { yield text; })(),
    stdout: value => { stdout += value; }, stderr: value => { stderr += value; }, ...options,
  });
  return { exit, stdout, stderr };
}
function mock(choices: Record<string, string>): Backend {
  return { async ask(_state, qs) { return {
    model: 'test', usage: { input_tokens: 1, output_tokens: 1 },
    answers: Object.fromEntries(Object.entries(qs).map(([id, q]) => [id, {
      type: 'choice' as const, choice: choices[id]!, confidence: 1,
      probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choices[id] ? 1 : 0])),
    }])),
  }; } };
}
const accepted = mock({ kind: 'tax_form', jurisdiction: 'aeat', form: 'aeat-303' });

test('CLI reads piped text and produces only parseable result JSON', async () => {
  let state: unknown;
  const r = await call(['classify', '-', '--compact'], 'Agencia Tributaria. Modelo 303.', { backend: { async ask(s, q) { state = s; return accepted.ask(s, q); } } });
  assert.equal(r.exit, 0); assert.equal(r.stderr, ''); assert.equal(r.stdout.trim().split('\n').length, 1);
  assert.equal(JSON.parse(r.stdout)[0].result.form, 'aeat-303');
  assert.deepEqual(state, { document: { text: 'Agencia Tributaria. Modelo 303.' } });
});
test('review exit preserves the normal JSON result', async () => {
  const ordinary = await call(['classify', '-']);
  assert.equal(ordinary.exit, 0); assert.equal(JSON.parse(ordinary.stdout)[0].result.status, 'needs_ocr');
  const strict = await call(['classify', '-', '--fail-on-review']);
  assert.equal(strict.exit, 2); assert.equal(strict.stderr, ''); assert.deepEqual(JSON.parse(strict.stdout), JSON.parse(ordinary.stdout));
  assert.equal((await call(['classify', '-', '--fail-on-review'], 'Modelo 303', { backend: accepted })).exit, 0);
});
test('all account proposals retain review requirement and caller context', async () => {
  const r = await call(['account', '-', '--direction', 'sale', '--plan', 'pgc', '--activity', 'Asesoría', '--fail-on-review'], 'Honorarios prestados', { backend: mock({ account: '705', suitability: 'single_component' }) });
  assert.equal(r.exit, 2); const result = JSON.parse(r.stdout);
  assert.equal(result.account.code, '705'); assert.equal(result.requiresHumanReview, true);
  assert.deepEqual(result.context, { direction: 'sale', plan: 'pgc', activity: 'Asesoría' });
});
test('account unknown direction is a local review outcome without a key', async () => {
  const r = await call(['account', '-', '--direction', 'unknown'], 'Factura');
  assert.equal(r.exit, 0); assert.equal(JSON.parse(r.stdout).account, null);
  assert.ok(JSON.parse(r.stdout).reasons.includes('missing_transaction_direction'));
});
test('missing key is a structured setup error with no stdout', async () => {
  const r = await call(['classify', '-'], 'Modelo 303');
  assert.equal(r.exit, 3); assert.equal(r.stdout, ''); assert.equal(JSON.parse(r.stderr).error.code, 'MISSING_API_KEY');
});
test('invalid or irrelevant options fail before reading input', async () => {
  for (const args of [
    ['classify'], ['account', '-'], ['account', '-', '--direction', 'invented'],
    ['account', '-', '--direction', 'sale', '--plan', 'invented'],
    ['classify', '-', '--threshold', 'NaN'], ['classify', '-', '--max-pages', '0'],
    ['classify', '-', '--direction', 'sale'], ['doctor', 'extra'], ['catalog', 'invented'],
    ['classify', '-', '--api-key', 'never-echo-this-secret'],
    ['classify', '-', '--experimental-context'],
    ['account', '-', '--direction', 'sale', '--experimental-context'],
    ['classify', '-', '--ocr'], ['classify', 'file.pdf', '--ocr-language', 'spa'],
    ['classify', 'file.pdf', '--ocr', '--ocr-language', 'invalid'], ['parse', '-'],
    ['parse', 'file.pdf', '--experimental-context'], ['account', '-', '--ocr'],
    ['parse', 'file.pdf', '--ocr-mode', 'raster'],
    ['parse', 'file.pdf', '--ocr', '--ocr-mode', 'invalid'],
    ['classify', '-', '--ocr', '--ocr-mode', 'auto'],
  ]) {
    const r = await call(args, '', { stdin: (async function* () { throw new Error('Do not read'); })() });
    assert.equal(r.exit, 64, args.join(' ')); assert.equal(r.stdout, '');
    assert.equal(JSON.parse(r.stderr).error.code, 'USAGE_ERROR'); assert.ok(!r.stderr.includes('never-echo-this-secret'));
  }
});
test('invalid UTF-8, PDF stdin and oversized input fail before inference', async () => {
  for (const text of [Buffer.from([0xc3, 0x28]), '%PDF-1.7 content', 'a\0b', 'ñ'.repeat(12_001)]) {
    const r = await call(['classify', '-'], text);
    assert.equal(r.exit, 64); assert.equal(r.stdout, ''); assert.ok(['INVALID_INPUT', 'INPUT_TOO_LARGE'].includes(JSON.parse(r.stderr).error.code));
  }
});
test('UTF-8 character split across stdin chunks is preserved', async () => {
  const bytes = Buffer.from('Nómina');
  const r = await call(['classify', '-'], '', { stdin: (async function* () { yield bytes.subarray(0, 2); yield bytes.subarray(2); })(), backend: mock({ kind: 'payroll', jurisdiction: 'not_applicable', form: 'none' }) });
  assert.equal(r.exit, 0); assert.equal(JSON.parse(r.stdout)[0].result.kind, 'payroll');
});
test('stdin on a terminal fails instead of prompting an agent', async () => {
  const r = await call(['classify', '-'], '', { stdinIsTTY: true });
  assert.equal(r.exit, 64); assert.equal(r.stdout, '');
});
test('doctor reports readiness without disclosing or validating the credential', async () => {
  const r = await call(['doctor'], '', { env: { TYPESAFE_API_KEY: 'private-test-key' }, checkBinary: async () => false });
  assert.equal(r.exit, 0); const value = JSON.parse(r.stdout);
  assert.equal(value.textReady, true); assert.equal(value.pdfReady, false); assert.equal(value.networkChecked, false);
  assert.ok(!r.stdout.includes('private-test-key'));
  assert.equal((await call(['doctor', '--pdf'], '', { env: { TYPESAFE_API_KEY: 'private-test-key' }, checkBinary: async () => false })).exit, 3);
  assert.equal((await call(['doctor'], '', { checkBinary: async () => true })).exit, 3);
});
test('catalog and machine-readable command contract need no API credentials', async () => {
  assert.equal(JSON.parse((await call(['catalog', 'forms'])).stdout).forms.length, 33);
  assert.equal(JSON.parse((await call(['catalog', 'accounts'])).stdout).accounts.length, 40);
  const schema = JSON.parse((await call(['schema'])).stdout);
  assert.equal(schema.contractVersion, 4); assert.equal(schema.authentication.cliArgumentSupported, false);
  assert.deepEqual(schema.options['ocr-mode'].enum, ['auto', 'selective', 'raster']);
  assert.equal(schema.options['ocr-mode'].default, 'auto');
  assert.equal(schema.options['experimental-context'].default, false);
  assert.ok(schema.commands.classify.options.includes('experimental-context'));
  assert.equal(schema.outputSchemas.accountSuggestion.properties.requiresHumanReview.const, true);
});
test('help, version and portable skill work offline', async () => {
  assert.match((await call(['--help'])).stdout, /Usage:/);
  assert.match((await call([])).stdout, /Usage:/);
  assert.match((await call(['--version'])).stdout, /^\d+\.\d+\.\d+\n$/);
  assert.match((await call(['skill'])).stdout, /^---\nname: aeat-doc-classifier\n/);
});
test('input paths with spaces or shell characters are read literally', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aeat-cli-'));
  try {
    const file = join(dir, '-invoice ; literal.txt'); await writeFile(file, 'Modelo 303');
    const r = await call(['classify', '--', file], '', { backend: accepted });
    assert.equal(r.exit, 0); assert.equal(JSON.parse(r.stdout)[0].result.form, 'aeat-303');
  } finally { await rm(dir, { recursive: true }); }
});
test('provider authentication and runtime errors use separate machine-readable codes', async () => {
  const auth = await call(['classify', '-'], 'x', { backend: { ask: async () => { throw new JevError('Jev returned HTTP 401; no classification accepted.', 401); } } });
  assert.equal(auth.exit, 3); assert.equal(JSON.parse(auth.stderr).error.code, 'AUTHENTICATION_ERROR');
  const failure = await call(['classify', '-'], 'x', { backend: { ask: async () => { throw new Error('private text and secret'); } } });
  assert.equal(failure.exit, 1); assert.ok(!failure.stderr.includes('private')); assert.equal(failure.stdout, '');
});
test('process entrypoint exposes the documented exit code and clean streams', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'classify', '-', '--fail-on-review'], { input: '', encoding: 'utf8', env: { ...process.env, TYPESAFE_API_KEY: '' } });
  assert.equal(result.status, 2); assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout)[0].result.status, 'needs_ocr');
});
