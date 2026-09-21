import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLuna, lunaSchema, type LunaTransport } from '../eval/luna-backend.js';
const questions = { kind: { type: 'choice' as const, instructions: 'Classify', criteria: { a: 'A', b: 'B' } } };
const answer = { answers: { kind: { type: 'choice', choice: 'a', confidence: 0.9, probabilities: { a: 0.9, b: 0.1 } } } };
const events = (extra: unknown[] = [], value: unknown = answer) => [...extra,
  { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } },
  { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 10, output_tokens: 20, reasoning_output_tokens: 2 } },
].map(x => JSON.stringify(x)).join('\n');
const transport = (): LunaTransport => ({ promptSha256: '', schemaSha256: '', elapsedMs: 0 });
test('Luna benchmark validates distributions and records reported usage', () => {
  const t = transport(); const result = decodeLuna(events(), questions, t);
  assert.equal(result.answers.kind!.choice, 'a'); assert.equal(t.cachedInputTokens, 10);
  assert.throws(() => decodeLuna(events([], { answers: { kind: { ...answer.answers.kind, probabilities: { a: 0.9 } } } }), questions, transport()));
  assert.equal(lunaSchema(questions).additionalProperties, false);
});
test('Luna benchmark rejects tool use and failed turns, even with valid final JSON', () => {
  assert.throws(() => decodeLuna(events([{ type: 'item.completed', item: { type: 'command_execution', command: 'read labels' } }]), questions, transport()));
  assert.throws(() => decodeLuna(events([{ type: 'turn.failed' }]), questions, transport()));
  assert.throws(() => decodeLuna(events([{ type: 'item.completed', item: { type: 'error', message: 'Unexpected problem' } }]), questions, transport()));
});
