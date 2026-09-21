import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateOcrPages } from '../src/ocr.js';
import { runCli } from '../src/cli-runner.js';
import { fallbackReasons, boundedDpi, MAX_RASTER_PIXELS, hasHeaderIdentifier, needsHeaderRetry, preserveSelectiveHeader, usableReplacement } from '../src/ocr-quality.js';

test('adaptive OCR distinguishes a scanned body behind a text header from a native-text document', () => {
  assert.deepEqual(fallbackReasons({ textLength: 61, imageCoverage: 0.43, isGarbled: false }, 'auto'), ['substantial_image_with_sparse_native_text']);
  assert.deepEqual(fallbackReasons({ textLength: 6000, imageCoverage: 0.43, isGarbled: false }, 'auto'), []);
  assert.deepEqual(fallbackReasons({ textLength: 61, imageCoverage: 0.02, isGarbled: false }, 'auto'), []);
  assert.deepEqual(fallbackReasons({ textLength: 0, imageCoverage: 0, isGarbled: false }, 'auto'), []);
  assert.deepEqual(fallbackReasons(undefined, 'selective'), []);
  assert.deepEqual(fallbackReasons(undefined, 'raster'), ['raster_mode_requested']);
  assert.throws(() => fallbackReasons(undefined, 'auto'), /complexity/);
});

test('model-header quality checks use nearby printed digits, not box numbers or a catalog whitelist', () => {
  const p = { width: 600, height: 840, text: 'Autoliquidación', textItems: [
    { text: 'Modelo', x: 500, y: 100, width: 40, height: 12 },
    { text: '9 9 9', x: 500, y: 120, width: 40, height: 24 },
  ] };
  assert.equal(hasHeaderIdentifier(p), true); assert.equal(needsHeaderRetry(p), false);
  assert.equal(hasHeaderIdentifier({ ...p, textItems: [p.textItems[0]!, { ...p.textItems[1]!, y: 600 }] }), false);
  assert.equal(hasHeaderIdentifier({ ...p, textItems: [p.textItems[0]!, { ...p.textItems[1]!, x: 80 }] }), false);
  assert.equal(needsHeaderRetry({ ...p, textItems: [] }), true);
  assert.equal(needsHeaderRetry({ ...p, text: 'Ordinary letter', textItems: [] }), false);
  assert.equal(preserveSelectiveHeader({ ...p, text: 'A form with substantial readable body text. '.repeat(10) }), true);
  assert.equal(preserveSelectiveHeader({ ...p, text: 'BOE annex Modelo 999' }), false);
  assert.equal(preserveSelectiveHeader({ ...p, text: 'Readable body. '.repeat(50), textItems: [] }), false);
});

test('raster allocation is bounded before rendering and sparse replacement cannot erase usable text', () => {
  for (const [w, h] of [[595, 842], [2000, 2000], [4000, 3000]]) {
    const dpi = boundedDpi(w!, h!, 450);
    assert.ok(Math.ceil(w! * dpi / 72) * Math.ceil(h! * dpi / 72) <= MAX_RASTER_PIXELS);
  }
  assert.throws(() => boundedDpi(100_000, 100_000, 300));
  assert.throws(() => boundedDpi(NaN, 842, 300));
  assert.equal(usableReplacement('BOE header', 'Recovered form body with readable fields and identifier'), true);
  assert.equal(usableReplacement('Readable native text '.repeat(100), 'BOE header'), false);
  assert.equal(usableReplacement('Readable form', ''), false);
  assert.equal(usableReplacement('', '   ---   '), false);
});

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
