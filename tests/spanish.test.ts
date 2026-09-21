import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairedOcr, sha, metrics, verifyRun, type Judgments, type Inputs } from '../eval/spanish-types.js';
import { JevError } from '../src/jev.js';
import type { Backend } from '../src/types.js';

const pages = [1, 2].map(page => ({ page, text: 'A Spanish tax declaration continuation with enough text for context. '.repeat(8) }));
const backend = (jurisdiction: string): Backend => ({ async ask(_state, qs) {
  const choices: Record<string, string> = { kind: 'tax_form', jurisdiction, form: 'aeat-036', continuity: 'same_document' };
  return { model: 'test', usage: { input_tokens: 10, output_tokens: 3 }, answers: Object.fromEntries(Object.entries(qs).map(([id, q]) => {
    const choice = choices[id]!;
    return [id, { type: 'choice' as const, choice, confidence: 0.99, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 0.99 : 0.01 / (Object.keys(q.criteria).length - 1)])) }];
  })) };
} });

test('context failure preserves the exact valid OCR baseline without querying it twice', async () => {
  let baselineCalls = 0, contextCalls = 0;
  const result = await pairedOcr(pages, 2, { async ask(s, q) { baselineCalls++; return backend('unknown').ask(s, q); } }, {
    async ask() { contextCalls++; throw new JevError('Invalid Jev response; no classification accepted.'); },
  });
  assert.equal(baselineCalls, 1); assert.equal(contextCalls, 1);
  assert.equal(result.ocr.result?.status, 'needs_review'); assert.ok(result.context.error); assert.equal(result.context.result, undefined);
});

test('a failed baseline remains a failure in both paired conditions; accepted baseline costs one call', async () => {
  let calls = 0;
  const fail: Backend = { async ask() { calls++; throw new Error('sensitive provider text'); } };
  const failed = await pairedOcr(pages, 2, fail, fail);
  assert.equal(calls, 1); assert.equal(failed.context.error, failed.ocr.error); assert.ok(!failed.ocr.error?.includes('sensitive'));
  const accepted = await pairedOcr(pages, 2, backend('aeat'), fail);
  assert.equal(calls, 1); assert.deepEqual(accepted.context.result, accepted.ocr.result); assert.equal(accepted.contextAudit?.attempted, false);
});

test('all reviewed targets and OCR pages match the frozen acquisition; failures stay in denominator', () => {
  const read = (file: string) => readFileSync(new URL(`../eval/${file}`, import.meta.url));
  const acquisitionBytes = read('calibration-v1.json');
  const acquisition = JSON.parse(acquisitionBytes.toString());
  const j = JSON.parse(read('spanish-v1-judged.json').toString()) as Judgments;
  const inputs = JSON.parse(read('spanish-v1-inputs.json').toString()) as Inputs;
  assert.equal(j.acquisitionSha256, sha(acquisitionBytes)); assert.equal(inputs.acquisitionSha256, sha(acquisitionBytes));
  assert.equal(j.cases.length, 42); assert.equal(j.cases.filter(c => c.split === 'calibration').length, 17);
  assert.equal(j.cases.filter(c => c.reviewRequired).length, 11);
  assert.equal(j.cases.filter(c => c.group === 'aeat').length, 30);
  assert.equal(new Set(j.cases.map(c => `${c.sourceId}/${c.page}`)).size, 42);
  for (const s of acquisition.sources) {
    const frozen = inputs.sources.find(i => i.id === s.id)!;
    assert.equal(frozen.sourceSha256, s.sha256); assert.equal(frozen.pages.length, s.pageCount);
    for (const c of s.cases) {
      const judged = j.cases.find(r => r.sourceId === s.id && r.page === c.page)!;
      assert.deepEqual(judged.expected, c.proposed); assert.equal(judged.inputSha256, c.nativeInputSha256);
      assert.match(judged.visualSha256, /^[a-f0-9]{64}$/); assert.ok(judged.note.length > 40);
    }
  }
  const rows = j.cases.map(c => ({ ...c, elapsedMs: 0, error: 'failed' }));
  const m = metrics(rows);
  assert.equal(m.errors, 42); assert.equal(m.routingEligible, 31); assert.equal(m.reviewCorrect, 0);
  assert.equal(m.aeatPages, 30); assert.equal(m.fullIdentityCorrect, 0);
  const outcomes = j.cases.map(c => ({ sourceId: c.sourceId, page: c.page,
    native: { error: 'failed', elapsedMs: 0 }, ocr: { error: 'failed', elapsedMs: 0 }, context: { error: 'failed', elapsedMs: 0 } }));
  verifyRun(outcomes, j, inputs);
  assert.throws(() => verifyRun(outcomes.slice(1), j, inputs), /Incomplete/);
  assert.throws(() => verifyRun([outcomes[1]!, ...outcomes.slice(1)], j, inputs), /duplicate/);
});
