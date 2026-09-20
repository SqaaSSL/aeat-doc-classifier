import assert from 'node:assert/strict';
import test from 'node:test';
import { aeatModels, classifyPage, pgcAccounts, suggestAccount, type Backend, type ChoiceQuestion } from '../src/index.js';

function backend(choices: Record<string, string>, confidence = 0.999, peak = 0.999): Backend {
  return { async ask(_state, questions) {
    return { model: 'test-model', usage: { input_tokens: 10, output_tokens: 2 }, answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => {
      const choice = choices[id]!;
      assert.ok(Object.hasOwn(q.criteria, choice), `Missing fixture option ${id}: ${choice}`);
      return [id, { type: 'choice' as const, choice, confidence, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? peak : (1 - peak) / (Object.keys(q.criteria).length - 1)])) }];
    })) };
  } };
}
const formBackend = (form = 'aeat-303') => backend({ kind: 'tax_form', jurisdiction: 'aeat', form });
const noCalls: Backend = { ask: async () => { throw new Error('Unexpected backend call'); } };

test('empty text requires OCR/review; cannot be asserted blank from text extraction', async () => {
  const r = await classifyPage(' \n\t', { backend: noCalls });
  assert.equal(r.status, 'needs_ocr'); assert.equal(r.kind, null); assert.equal(r.audit.model, null);
});
test('supported AEAT model is accepted only when all relevant decisions pass', async () => {
  const r = await classifyPage('Agencia Tributaria Modelo 303', { backend: formBackend() });
  assert.equal(r.status, 'accepted'); assert.equal(r.form, 'aeat-303'); assert.equal(r.formDefinition?.number, '303');
  assert.equal(r.audit.model, 'test-model'); assert.equal(r.audit.inputSha256.length, 64);
});
test('confidence and winning probability are separate gates', async () => {
  for (const [confidence, probability] of [[0.5, 0.99], [0.99, 0.6]]) {
    const r = await classifyPage('Modelo 303', { backend: backend({ kind: 'tax_form', jurisdiction: 'aeat', form: 'aeat-303' }, confidence, probability) });
    assert.equal(r.status, 'needs_review'); assert.equal(r.form, null);
  }
});
test('unknown or historical model cannot produce an accepted model', async () => {
  for (const form of ['none', 'aeat-037']) {
    const r = await classifyPage('Historical or unsupported form', { backend: formBackend(form) });
    assert.equal(r.status, 'needs_review'); assert.equal(r.form, null); assert.equal(r.candidates?.form.value, form);
  }
});
test('non-national tax authority cannot inherit matching AEAT model number', async () => {
  for (const jurisdiction of ['foral', 'canary', 'regional', 'foreign', 'unknown']) {
    const r = await classifyPage('Modelo 303', { backend: backend({ kind: 'tax_form', jurisdiction, form: 'aeat-303' }) });
    assert.equal(r.status, 'needs_review'); assert.equal(r.form, null);
  }
});
test('commercial invoices and notifications never become model 303 just from a reference', async () => {
  for (const kind of ['invoice', 'notification']) {
    const r = await classifyPage('Referencia al modelo 303', { backend: backend({ kind, jurisdiction: kind === 'invoice' ? 'not_applicable' : 'aeat', form: 'aeat-303' }) });
    assert.equal(r.form, null); assert.equal(r.status, 'accepted');
  }
});
test('recognized invoices are routable without inventing a tax model', async () => {
  const r = await classifyPage('Factura', { backend: backend({ kind: 'invoice', jurisdiction: 'not_applicable', form: 'none' }) });
  assert.equal(r.status, 'accepted'); assert.equal(r.form, null);
});
test('invalid thresholds and oversized text are rejected before any call', async () => {
  for (const n of [NaN, Infinity, -0.01, 1.01]) await assert.rejects(classifyPage('x', { backend: noCalls, gate: { minConfidence: n } }));
  await assert.rejects(classifyPage('ñ'.repeat(12_001), { backend: noCalls }), /24,000/);
});
test('custom backends receive the same strict validation as Jev', async () => {
  await assert.rejects(classifyPage('x', { backend: { ask: async () => ({ answers: {} }) as never } }), /Invalid Jev response/);
});
test('accounting requires direction and never calls the model without it', async () => {
  const r = await suggestAccount('Factura consultoría', { context: { direction: 'unknown', plan: 'pgc-pymes' }, backend: noCalls });
  assert.equal(r.account, null); assert.ok(r.reasons.includes('missing_transaction_direction'));
});
test('account suggestion is context-specific and always subject to human review', async () => {
  const r = await suggestAccount('Factura recibida: asesoría fiscal', { context: { direction: 'purchase', plan: 'pgc-pymes' }, backend: backend({ account: '623', suitability: 'single_component' }) });
  assert.equal(r.account?.code, '623'); assert.equal(r.requiresHumanReview, true); assert.equal(r.status, 'suggested');
});
test('sale criteria cannot offer expense or tax accounts', async () => {
  const r = await suggestAccount('Servicio propio prestado', { context: { direction: 'sale', plan: 'pgc' }, backend: { async ask(state, qs) {
    assert.ok(!Object.hasOwn(qs.account!.criteria, '623')); assert.ok(!Object.hasOwn(qs.account!.criteria, '477'));
    return backend({ account: '705', suitability: 'single_component' }).ask(state, qs);
  } } });
  assert.equal(r.account?.code, '705');
});
test('mixed and nontransactional inputs cannot produce account proposals even with high model confidence', async () => {
  for (const suitability of ['mixed', 'not_transaction', 'unclear']) {
    const r = await suggestAccount('Several components', { context: { direction: 'purchase', plan: 'pgc' }, backend: backend({ account: '623', suitability }) });
    assert.equal(r.account, null); assert.equal(r.status, 'needs_review');
  }
});
test('all catalog IDs are unique and sourced, and model 037 is historical', () => {
  assert.equal(new Set(aeatModels.map(m => m.id)).size, aeatModels.length);
  assert.equal(new Set(pgcAccounts.map(m => m.code)).size, pgcAccounts.length);
  assert.ok(aeatModels.every(m => /^aeat-\d{3}$/.test(m.id) && m.sources.every(s => new URL(s).hostname === 'sede.agenciatributaria.gob.es')));
  assert.ok(pgcAccounts.every(a => a.sources.length === 2 && a.plans.length === 2));
  assert.equal(aeatModels.find(m => m.number === '037')?.validUntil, '2025-02-02');
  assert.ok(pgcAccounts.filter(a => ['472', '477', '4751'].includes(a.code)).every(a => a.role === 'reference'));
});
