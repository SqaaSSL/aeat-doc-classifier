import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateOcrPages } from '../src/ocr.js';
import { runCli } from '../src/cli-runner.js';

test('OCR preserves complete ordered pages, including empty pages, and normalizes Unicode', () => {
  assert.deepEqual(validateOcrPages({ totalPages: 2, pageErrors: [], pages: [
    { pageNum: 1, text: '  Declaracio\u0301n  ' }, { pageNum: 2, text: ' \n ' },
  ] }, 2), [
    { page: 1, text: 'Declaración', textStatus: 'text' },
    { page: 2, text: '', textStatus: 'no_extractable_text' },
  ]);
});

test('OCR rejects omissions, repeats, reordering, oversize documents and reported page failures', () => {
  const pages = [{ pageNum: 1, text: 'Modelo 111' }, { pageNum: 2, text: 'Continuación' }];
  for (const result of [
    null, {}, { totalPages: 3, pages, pageErrors: [] },
    { totalPages: 2, pages: pages.slice(0, 1), pageErrors: [] },
    { totalPages: 2, pages: [...pages].reverse(), pageErrors: [] },
    { totalPages: 2, pages: [pages[0], pages[0]], pageErrors: [] },
    { totalPages: 2, pages, pageErrors: [{ pageNum: 2, message: 'private OCR failure' }] },
    { totalPages: 1, pages: [{ pageNum: 1, text: null }], pageErrors: [] },
  ]) assert.throws(() => validateOcrPages(result, 2));
  assert.throws(() => validateOcrPages({ totalPages: 2, pages, pageErrors: [] }, 1));
});

test('failed OCR never reaches Jev or leaks parser diagnostics into output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aeat-ocr-test-'));
  try {
    const file = join(dir, 'broken.pdf'); await writeFile(file, 'private document contents');
    let calls = 0, stdout = '', stderr = '';
    const exit = await runCli(['classify', file, '--ocr'], {
      env: {}, backend: { async ask() { calls++; throw new Error('must not run'); } },
      stdout: s => { stdout += s; }, stderr: s => { stderr += s; },
    });
    assert.ok(exit === 1 || exit === 3); // Optional engine may be absent in a minimal install.
    assert.equal(calls, 0); assert.equal(stdout, '');
    assert.ok(['OCR_FAILED', 'MISSING_OCR'].includes(JSON.parse(stderr).error.code));
    assert.ok(!stderr.includes('private document'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
