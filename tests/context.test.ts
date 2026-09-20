import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPageWithContext, planContext, type Backend } from '../src/index.js';

const pages = [1, 2, 3, 4, 5].map(page => ({ page, text: `Page ${page}\n` + 'A sufficiently detailed document continuation. '.repeat(8) }));
function mock(continuity = 'same_document', continuityConfidence = 0.99, jurisdiction = 'aeat', form = 'aeat-390') {
  const states: unknown[] = [];
  const backend: Backend = { async ask(state, qs) {
    states.push(state);
    const contextual = !!qs.continuity;
    const choices: Record<string, string> = { kind: 'tax_form', jurisdiction: contextual ? jurisdiction : 'unknown', form, continuity };
    return { model: 'test', usage: { input_tokens: 20, output_tokens: 5 }, answers: Object.fromEntries(Object.entries(qs).map(([id, q]) => {
      const choice = choices[id]!, confidence = id === 'continuity' ? continuityConfidence : 0.99;
      return [id, { type: 'choice' as const, choice, confidence,
        probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 0.99 : 0.01 / (Object.keys(q.criteria).length - 1)])) }];
    })) };
  } };
  return { backend, states };
}

test('context can recover a continuation only after continuity and routing gates pass', async () => {
  const m = mock(); const r = await classifyPageWithContext(pages, 3, { backend: m.backend });
  assert.equal(r.pageOnly.status, 'needs_review'); assert.equal(r.result.status, 'accepted');
  assert.equal(r.result.form, 'aeat-390'); assert.equal(m.states.length, 2);
  assert.deepEqual(r.context.pages.map(p => p.page), [1, 2, 3, 4]);
  assert.equal(r.context.requestSha256?.length, 64);
  assert.equal(r.result.audit.inputSha256, r.pageOnly.audit.inputSha256);
  assert.equal(r.pageOnly.audit.usage.input_tokens + r.result.audit.usage.input_tokens, 40);
});

test('different documents and uncertain continuity cannot turn context into an accepted form', async () => {
  for (const [label, confidence] of [['different_documents', 0.99], ['unclear', 0.99], ['same_document', 0.8]] as const) {
    const r = await classifyPageWithContext(pages, 3, { backend: mock(label, confidence).backend });
    assert.equal(r.result.status, 'needs_review'); assert.equal(r.result.form, null);
    assert.equal(r.result.formDefinition, null);
    assert.ok(r.result.reasons.includes('context_continuity_not_established'));
  }
});

test('context cannot bypass non-national, unsupported or historical-model policy', async () => {
  for (const [jurisdiction, form] of [['foral', 'aeat-303'], ['aeat', 'aeat-037'], ['aeat', 'none']]) {
    const r = await classifyPageWithContext(pages, 3, { backend: mock('same_document', 0.99, jurisdiction, form).backend });
    assert.equal(r.result.status, 'needs_review'); assert.equal(r.result.form, null);
  }
});

test('empty text and sparse image headers cannot inherit a neighboring form', async () => {
  const empty = await classifyPageWithContext([{ page: 1, text: '' }, pages[1]!], 1);
  assert.equal(empty.result.status, 'needs_ocr'); assert.equal(empty.context.attempted, false);
  const m = mock(); const sparse = await classifyPageWithContext([{ page: 1, text: 'BOLETIN OFICIAL DEL ESTADO ANEXO I' }, pages[1]!], 1, { backend: m.backend });
  assert.equal(m.states.length, 1); assert.equal(sparse.context.reason, 'insufficient_target_text');
});

test('window planner preserves text, order, contiguity and bounded serialized request size', () => {
  const long = [1, 2, 3, 4].map(page => ({ page, text: 'ñ'.repeat(11_000) }));
  const p = planContext(long, 3);
  assert.ok(Buffer.byteLength(JSON.stringify({ state: p.state, questions: p.questions })) < 54_000);
  assert.ok(p.state.pages.some(x => x.page === 3));
  for (let i = 0; i < p.state.pages.length; i++) {
    assert.equal(p.state.pages[i]!.text, 'ñ'.repeat(11_000));
    if (i) assert.equal(p.state.pages[i]!.page, p.state.pages[i - 1]!.page + 1);
  }
  for (const input of [[pages[1]!, pages[0]!], [pages[0]!, pages[2]!], [pages[0]!, pages[0]!]]) {
    assert.throws(() => planContext(input, 1), /consecutive/);
  }
});

test('already accepted isolated results do not trigger a second paid request', async () => {
  const m = mock();
  const backend: Backend = { ask: (s, qs) => m.backend.ask(s, { ...qs, continuity: { type: 'choice', instructions: '', criteria: { same_document: '', other: '' } } }) };
  const r = await classifyPageWithContext(pages, 3, { backend });
  assert.equal(r.result.status, 'accepted'); assert.equal(r.context.attempted, false); assert.equal(m.states.length, 1);
});
