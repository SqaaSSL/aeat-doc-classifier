import assert from 'node:assert/strict';
import test from 'node:test';
import { jevBackend, JevError } from '../src/index.js';
import { validateResponse } from '../src/jev.js';
const questions = { category: { type: 'choice' as const, instructions: 'Pick a category', criteria: { a: 'One', b: 'Two' } } };
const response = () => ({ model: 'jev-test', answers: { category: { type: 'choice', choice: 'a', confidence: 0.96, probabilities: { a: 0.98, b: 0.02 } } }, usage: { input_tokens: 12, output_tokens: 3 } });

test('official endpoint, bearer authentication, model pin and response shape', async () => {
  const client = jevBackend({ apiKey: 'test-key', fetch: (async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
    assert.equal(init?.redirect, 'error');
    assert.equal(JSON.parse(init?.body as string).model, 'jev-1.13.0');
    return Response.json(response());
  }) as typeof fetch });
  assert.equal((await client.ask('synthetic input', questions)).answers.category?.choice, 'a');
});
test('429 Retry-After is honored and retries are bounded', async () => {
  let calls = 0; const delays: number[] = [];
  const client = jevBackend({ apiKey: 'test', sleep: async ms => { delays.push(ms); }, fetch: (async () => ++calls < 3 ? new Response('', { status: 429, headers: { 'retry-after': '0.01' } }) : Response.json(response())) as typeof fetch });
  await client.ask('x', questions); assert.equal(calls, 3); assert.deepEqual(delays, [10, 10]);
});
test('permanent failures do not retry or expose provider body', async () => {
  let calls = 0;
  const client = jevBackend({ apiKey: 'secret', fetch: (async () => { calls++; return new Response('secret and private document', { status: 401 }); }) as typeof fetch });
  await assert.rejects(client.ask('private document', questions), (e: unknown) => e instanceof JevError && e.status === 401 && !e.message.includes('secret') && !e.message.includes('private document'));
  assert.equal(calls, 1);
});
test('network exceptions never leak request or credential details', async () => {
  const client = jevBackend({ apiKey: 'secret', fetch: (async () => { throw new Error('Authorization: secret'); }) as typeof fetch });
  await assert.rejects(client.ask('x', questions), (e: unknown) => e instanceof Error && !e.message.includes('secret'));
});
test('untrusted responses with missing fields, unknown IDs or invalid probabilities fail closed', () => {
  const mutations = [
    (r: any) => { r.answers = {}; },
    (r: any) => { r.answers.category.choice = 'outside'; },
    (r: any) => { r.answers.category.confidence = 1.2; },
    (r: any) => { r.answers.category.probabilities = { a: 0.99 }; },
    (r: any) => { r.answers.category.probabilities = { a: 1, b: 1 }; },
    (r: any) => { r.answers.category.probabilities = { a: 0.1, b: 0.9 }; },
    (r: any) => { r.answers.category.probabilities = { a: NaN, b: 0.1 }; },
    (r: any) => { r.usage.input_tokens = -1; },
    (r: any) => { r.model = ''; },
  ];
  for (const mutate of mutations) { const r = response(); mutate(r); assert.throws(() => validateResponse(r, questions), /Invalid Jev response/); }
});
test('too many choice options and oversized requests never reach the network', async () => {
  const client = jevBackend({ apiKey: 'test', fetch: (async () => { throw new Error('Unexpected call'); }) as typeof fetch });
  await assert.rejects(client.ask('x', { q: { type: 'choice', instructions: 'x', criteria: Object.fromEntries(Array.from({ length: 256 }, (_, i) => [String(i), 'x'])) } }), /255/);
  await assert.rejects(client.ask('x'.repeat(60_001), questions), /too large/);
});
