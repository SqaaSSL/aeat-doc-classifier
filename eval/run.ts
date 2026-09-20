import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { classifyPage, suggestAccount, catalogVersion, type AccountingContext } from '../src/index.js';

type Fixture = { id: string; task: 'document' | 'account'; text: string; context?: AccountingContext; expected: { kind?: string; form?: string | null; jurisdiction?: string; status?: string; account?: string | null } };
const fixtureBytes = await readFile(new URL('./fixtures.json', import.meta.url), 'utf8');
const fixtures = JSON.parse(fixtureBytes) as Fixture[];
const results = [];
const summary = { cases: fixtures.length, passed: 0, strictMisses: 0, wrongAccepted: 0, errors: 0, inputTokens: 0, outputTokens: 0 };
for (const f of fixtures) {
  const start = performance.now();
  try {
    const result = f.task === 'document' ? await classifyPage(f.text) : await suggestAccount(f.text, { context: f.context! });
    let correct: boolean, passed: boolean, wrongAccepted: boolean;
    if ('form' in result) {
      correct = f.expected.status === 'needs_ocr' ? result.status === 'needs_ocr' :
        result.candidates?.kind.value === f.expected.kind && result.candidates.jurisdiction.value === f.expected.jurisdiction &&
        (f.expected.form ? result.candidates.form.value === f.expected.form : result.form === null);
      passed = correct && result.status === f.expected.status;
      wrongAccepted = result.status === 'accepted' && (!correct || f.expected.status !== 'accepted');
    } else {
      correct = (result.account?.code ?? null) === (f.expected.account ?? null);
      passed = correct;
      wrongAccepted = result.account !== null && !correct;
    }
    summary.passed += Number(passed); summary.strictMisses += Number(!passed); summary.wrongAccepted += Number(wrongAccepted);
    summary.inputTokens += result.audit.usage.input_tokens; summary.outputTokens += result.audit.usage.output_tokens;
    results.push({ id: f.id, task: f.task, expected: f.expected, correct, passed, wrongAccepted, latencyMs: Math.round(performance.now() - start), result });
    console.log(`${passed ? 'PASS' : 'REVIEW'} ${f.id}: ${result.status}${result.reasons.length ? ' (' + result.reasons.join(', ') + ')' : ''}`);
  } catch (error) {
    summary.errors++;
    results.push({ id: f.id, error: error instanceof Error ? error.message : 'Evaluation failed' });
    console.log(`ERROR ${f.id}`);
    // Auth or provider errors should not trigger a paid loop over every remaining fixture.
    break;
  }
}
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const report = { evaluatedAt: new Date().toISOString(), corpus: 'handwritten-synthetic-smoke-v1', fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'), catalogVersion, summary, results, limitation: 'Small synthetic development set, not a held-out real-document accuracy or calibration benchmark. No taxpayer documents used.' };
await writeFile(new URL('./results/synthetic.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary));
if (summary.errors || summary.wrongAccepted) process.exitCode = 1;
