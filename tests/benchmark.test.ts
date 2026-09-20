import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreRow, summarize, type PublicManifest, type PublicRow } from '../eval/public-types.js';
import type { Classification } from '../src/classify.js';

const d = (value: string) => ({ value, confidence: 0.99, probability: 0.99, alternatives: [], probabilities: { [value]: 0.99 } });
function row(overrides: Partial<PublicRow> = {}, resultOverrides: Partial<Classification> = {}): PublicRow {
  return {
    sourceId: 'fixture', page: 1, inputSha256: 'fixture', inputBytes: 30, group: 'aeat',
    expected: { kind: 'tax_form', jurisdiction: 'aeat', form: 'aeat-100' },
    reviewRequired: false, note: '', elapsedMs: 100,
    result: { status: 'accepted', kind: 'tax_form', jurisdiction: 'aeat', form: 'aeat-100', formDefinition: null,
      candidates: { kind: d('tax_form'), jurisdiction: d('aeat'), form: d('aeat-100') }, reasons: [],
      gate: { minConfidence: 0.95, minProbability: 0.95 },
      audit: { model: 'test-model', catalogVersion: 'test', inputSha256: 'fixture', usage: { input_tokens: 10, output_tokens: 5 } },
      ...resultOverrides }, ...overrides,
  };
}

test('benchmark distinguishes correct candidates, review, and automatic routing', () => {
  const accepted = row(), reviewed = row({}, { status: 'needs_review', form: null });
  assert.equal(scoreRow(reviewed).identityCorrect, true);
  assert.equal(scoreRow(reviewed).correctAccepted, false);
  const s = summarize([accepted, reviewed]);
  assert.equal(s.aeatModelAndKindCorrect, 2);
  assert.equal(s.accepted, 1);
  assert.equal(s.acceptanceRate, 0.5);
  assert.equal(s.acceptedPrecision, 1);
});

test('wrong routed label counts as a false acceptance even with correct candidates', () => {
  const s = scoreRow(row({}, { form: 'aeat-102' }));
  assert.equal(s.identityCorrect, true);
  assert.equal(s.wrongAccepted, true);
});

test('out-of-scope acceptance is wrong; review can succeed despite wrong raw candidates', () => {
  const input = row({ group: 'scope_control', reviewRequired: true, expected: { kind: 'tax_form', jurisdiction: 'foreign', form: null } });
  assert.equal(scoreRow(input).wrongAccepted, true);
  input.result!.status = 'needs_review'; input.result!.form = null;
  assert.equal(scoreRow(input).identityCorrect, false);
  assert.equal(scoreRow(input).reviewCorrect, true);
});

test('failures remain in recognition and acceptance denominators, never count as reviews', () => {
  const s = summarize([row(), row({ result: undefined, error: 'classification_failed' })]);
  assert.equal(s.pages, 2);
  assert.equal(s.recognitionPages, 2);
  assert.equal(s.aeatPages, 2);
  assert.equal(s.aeatModelCorrect, 1);
  assert.equal(s.errors, 1);
  assert.equal(s.acceptanceRate, 0.5);
  assert.equal(s.needsReview, 0);
});

test('empty extraction checks do not inflate model recognition or measured latency', () => {
  const empty = row({ group: 'extraction', reviewRequired: true, expectedStatus: 'needs_ocr' }, {
    status: 'needs_ocr', kind: null, jurisdiction: null, form: null, candidates: null,
    audit: { model: null, catalogVersion: 'test', inputSha256: '', usage: { input_tokens: 0, output_tokens: 0 } },
  });
  const s = summarize([empty]);
  assert.equal(s.recognitionPages, 0);
  assert.equal(s.reviewCorrect, 1);
  assert.equal(s.modelCalls, 0);
  assert.equal(s.medianModelCallMs, null);
  assert.equal(s.acceptedPrecision, null);
  empty.result!.status = 'needs_review';
  assert.equal(scoreRow(empty).reviewCorrect, false);
});

test('frozen manifest has distinct sources/pages and bounded, unique recognition inputs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../eval/public-v1.json', import.meta.url), 'utf8')) as PublicManifest;
  const ids = new Set<string>(), pdfs = new Set<string>(), texts = new Set<string>();
  for (const s of manifest.sources) {
    assert.ok(!ids.has(s.id) && !pdfs.has(s.sha256)); ids.add(s.id); pdfs.add(s.sha256);
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
    assert.equal(new URL(s.url).protocol, 'https:');
    const pages = new Set<number>();
    for (const c of s.cases) {
      assert.ok(c.page > 0 && c.page <= s.pageCount && !pages.has(c.page)); pages.add(c.page);
      assert.match(c.inputSha256, /^[a-f0-9]{64}$/);
      assert.ok(c.inputBytes <= 24_000);
      if (c.group !== 'extraction') {
        assert.ok(c.inputBytes > 0 && !texts.has(c.inputSha256)); texts.add(c.inputSha256);
        assert.ok(c.expected.kind && c.expected.jurisdiction);
      }
      assert.equal(c.reviewRequired, c.group !== 'aeat');
    }
  }
});
