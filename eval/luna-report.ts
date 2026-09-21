import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sha, metrics, type Judgments, type Outcome } from './spanish-types.js';
import { scoreRow } from './public-types.js';
import type { LunaTransport } from './luna-backend.js';

const [path, prefix, ...extra] = process.argv.slice(2);
if (!path || !prefix || extra.length) throw new Error('Usage: node --import tsx eval/luna-report.ts raw.json output-prefix');
type Pair = { ocr: Outcome; context: Outcome };
const raw = await readFile(path), jb = await readFile(new URL('./spanish-v1-judged.json', import.meta.url)), pb = await readFile(new URL('./luna-v1-protocol.json', import.meta.url));
const refs = JSON.parse(jb.toString()) as Judgments;
const run = JSON.parse(raw.toString()) as {
  startedAt: string; completedAt: string; commit: string; cli: string; protocolSha256: string;
  protocol: { frozenAt: string; judgmentsSha256: string; inputsSha256: string; imageManifestSha256: string; implementationSha256: string };
  rows: Array<{ sourceId: string; page: number; inputSha256: string; imageSha256: string; jev: Pair; luna: Pair; image: Outcome }>;
  calls: Array<{ sourceId: string; page: number; provider: string; stage: string; requestSha256: string; elapsedMs: number;
    usage?: { input_tokens: number; output_tokens: number }; error?: string; transport?: LunaTransport }>;
};
const inputsBytes = await readFile(new URL('./extraction-v3-inputs.json', import.meta.url)), imagesBytes = await readFile(new URL('./luna-images-v1.json', import.meta.url));
const inputs = JSON.parse(inputsBytes.toString()) as { sources: Array<{ id: string; pages: Array<{ sha256: string }> }> };
const images = JSON.parse(imagesBytes.toString()) as { pages: Array<{ sourceId: string; page: number; sha256: string }> };
if (run.rows.length !== refs.cases.length || run.protocolSha256 !== sha(pb) || run.protocol.judgmentsSha256 !== sha(jb)
    || run.protocol.inputsSha256 !== sha(inputsBytes) || run.protocol.imageManifestSha256 !== sha(imagesBytes)
    || JSON.stringify(run.protocol) !== JSON.stringify(JSON.parse(pb.toString()))
    || Date.parse(run.protocol.frozenAt) > Date.parse(run.startedAt)) throw new Error('Incomplete or changed benchmark');
const conditions = ['jev/ocr', 'jev/context', 'luna/ocr', 'luna/context', 'luna/image'] as const;
type Condition = typeof conditions[number];
const rowsFor = (condition: Condition) => run.rows.map((row, i) => {
  const c = refs.cases[i]!, image = images.pages[i]!;
  const input = inputs.sources.find(s => s.id === c.sourceId)!.pages[c.page - 1]!.sha256;
  if (row.sourceId !== c.sourceId || row.page !== c.page || row.inputSha256 !== input
      || image.sourceId !== c.sourceId || image.page !== c.page || row.imageSha256 !== image.sha256) throw new Error('Mismatched target/evidence');
  const [p, m] = condition.split('/'), o = m === 'image' ? row.image : row[p as 'jev' | 'luna'][m as 'ocr' | 'context'];
  if (!o || Boolean(o.result) === Boolean(o.error) || !Number.isFinite(o.elapsedMs) || o.elapsedMs < 0
      || o.result && (o.result.audit.inputSha256 !== (m === 'image' ? image.sha256 : input)
        || o.result.gate.minConfidence !== 0.95 || o.result.gate.minProbability !== 0.95)) throw new Error('Invalid outcome');
  return { ...c, ...o, inputSha256: m === 'image' ? image.sha256 : input };
});
const summary = Object.fromEntries(['all', 'calibration', 'validation-reserved'].map(split => [split,
  Object.fromEntries(conditions.map(c => [c, metrics(rowsFor(c).filter(r => split === 'all' || r.split === split))]))]));
let matchedTextRequests = 0;
for (const call of run.calls.filter(c => c.provider === 'jev')) {
  const other = run.calls.find(c => c.provider === 'luna' && c.sourceId === call.sourceId && c.page === call.page && c.stage === call.stage);
  if (other) { if (other.requestSha256 !== call.requestSha256) throw new Error('Text request differs by model'); matchedTextRequests++; }
}
const median = (ns: number[]) => { const x = [...ns].sort((a, b) => a - b); return x.length ? (x[Math.floor((x.length - 1) / 2)]! + x[Math.floor(x.length / 2)]!) / 2 : null; };
const usage = Object.fromEntries(['jev-text', 'luna-text', 'luna-image'].map(group => {
  const calls = run.calls.filter(c => group === 'jev-text' ? c.provider === 'jev' : c.provider === 'luna' && (group === 'luna-image' ? c.stage === 'image' : c.stage !== 'image'));
  return [group, { calls: calls.length, failed: calls.filter(c => c.error).length,
    knownInputTokens: calls.reduce((n, c) => n + (c.usage?.input_tokens ?? c.transport?.inputTokens ?? 0), 0),
    knownOutputTokens: calls.reduce((n, c) => n + (c.usage?.output_tokens ?? c.transport?.outputTokens ?? 0), 0),
    knownCachedInputTokens: group === 'jev-text' ? null : calls.reduce((n, c) => n + (c.transport?.cachedInputTokens ?? 0), 0),
    knownReasoningOutputTokens: group === 'jev-text' ? null : calls.reduce((n, c) => n + (c.transport?.reasoningOutputTokens ?? 0), 0),
    callsWithUnknownUsage: calls.filter(c => !c.usage && c.transport?.inputTokens === undefined).length,
    totalCallMs: calls.reduce((n, c) => n + c.elapsedMs, 0), medianCallMs: median(calls.map(c => c.elapsedMs)) }];
}));
const workflowMedianMs = Object.fromEntries(conditions.map(c => [c, median(rowsFor(c).map(r => r.elapsedMs))]));
const ratio = (n: number, d: number) => `${n}/${d} (${(100 * n / d).toFixed(1)}%)`;
const table = (split: string) => {
  const s = conditions.map(c => summary[split]![c]!);
  const row = (name: string, fn: (x: typeof s[number]) => string | number) => `| ${name} | ${s.map(fn).join(' | ')} |`;
  return ['| Measure | Jev OCR | Jev + context | Luna OCR | Luna + context | Luna image only |', '| --- | ---: | ---: | ---: | ---: | ---: |',
    row('AEAT model + page kind', x => ratio(x.aeatModelAndKindCorrect, x.aeatPages)),
    row('Complete identity, all pages', x => ratio(x.fullIdentityCorrect, x.pages)),
    row('Correct automatic routing, eligible pages', x => ratio(x.correctEligibleAccepted, x.routingEligible)),
    row('Correct among accepted', x => x.accepted ? ratio(x.correctAccepted, x.accepted) : '0/0'),
    row('Wrong automatic acceptances', x => x.wrongAccepted),
    row('Required-review controls held', x => ratio(x.reviewCorrect, x.reviewRequired)),
    row('Review / needs OCR / errors', x => `${x.needsReview} / ${x.needsOcr} / ${x.errors}`),
    row('Macro AEAT recognition, equal PDF weight', x => `${(100 * x.sourceMacroAeatRecognition!).toFixed(1)}%`),
  ].join('\n');
};
const predictions = conditions.map(c => `### ${c}\n\n| Target | Kind / authority / model | Status | Verdict |\n| --- | --- | --- | --- |\n` + rowsFor(c).map(row => {
  const p = row.result?.candidates, s = scoreRow(row);
  const verdict = row.error ? 'Failure; retained in denominator' : s.wrongAccepted ? 'WRONG ACCEPTANCE' : s.correctAccepted ? 'Correct accepted route' : s.identityCorrect ? 'Correct identity; held' : 'Wrong identity; held';
  return `| ${row.sourceId} p${row.page} | ${p ? [p.kind.value, p.jurisdiction.value, p.form.value].join(' / ') : 'No valid prediction'} | ${row.result?.status ?? 'error'} | ${verdict} |`;
}).join('\n')).join('\n\n');
const report = { ...run, summary, usage, workflowMedianMs, matchedTextRequests, sourceRunSha256: sha(raw) };
await writeFile(prefix + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const markdown = `# Jev versus GPT-5.6 Luna — ${run.startedAt.slice(0, 10)}

**A five-condition development comparison on 42 previously reviewed pages.** Same adaptive OCR, catalog, Choice instructions and routing policy for the two text backends; a separate Luna condition reads page images without OCR text or neighbors. Reference labels were not changed. [Frozen protocol](../../eval/LUNA-BENCHMARK.md) · [Protocol fingerprints](../../eval/luna-v1-protocol.json) · [All results](${basename(prefix)}.json) · [Original visual reference review](spanish-reviewed-2026-09-21-review.json).

## Results

${table('all')}

There are 30 supported AEAT pages, one eligible TGSS example, and 11 controls that require review. Errors stay in denominators. **Luna's confidence values are self-reported, not equivalent to Jev confidence.** Acceptance under the same numerical 0.95 policy is descriptive and is not a calibrated equal-risk comparison. Raw identity is the primary model comparison. Both models use our catalog and routing code, so this measures backend substitution rather than an unconfigured chatbot versus the full product.

## Controls and limits

- All 237 source-page OCR fingerprints and all 42 image hashes were verified before inference. The image-only condition supplies 300-DPI full-page PNGs with opaque filenames and no OCR text. Codex may resize images internally. ${matchedTextRequests} text requests made by both providers have identical evidence-and-question hashes; conditional context retries can differ by model.
- Every Luna call is a fresh ephemeral session, requested as \`gpt-5.6-luna\` with low reasoning effort. Tools, browsing, memories and project instructions are disabled, and any observed tool activity invalidates the outcome. Codex system/skill-description overhead remains. This is Luna through the signed-in Codex CLI, not a bare API call or a reused judge conversation. The explicit requested model is recorded; CLI events do not provide a separate resolved-model snapshot identifier.
- Fresh Jev runs use \`jev-1.13.0\`. Each context condition reuses its model's isolated reply before the existing optional retry. Original outputs, provider errors and wrong acceptances are preserved. No threshold fitting, repaired predictions or best-of reruns are applied.
- These public templates have already informed our OCR and Jev-oriented Choice prompts. Both original partitions are development data. Pages within PDFs are correlated. This does not establish production, field/amount extraction, PGC, broad scan-quality or adversarial robustness performance. The image-only column changes evidence representation as well as workflow; it is not an isolated model substitution.

## Usage and elapsed time

| Calls, each counted once | Jev text | Luna text | Luna images |
| --- | ---: | ---: | ---: |
${(['calls', 'failed', 'knownInputTokens', 'knownCachedInputTokens', 'knownOutputTokens', 'knownReasoningOutputTokens', 'callsWithUnknownUsage', 'medianCallMs', 'totalCallMs'] as const).map(key => `| ${key} | ${['jev-text', 'luna-text', 'luna-image'].map(k => usage[k]![key] ?? 'not reported').join(' | ')} |`).join('\n')}

Median per-target workflow time (ms), including its isolated call once if context is attempted: ${conditions.map(c => c + ' ' + workflowMedianMs[c]).join('; ')}.

Jev time includes its HTTP adapter and bounded retries. Luna time includes CLI startup, Codex instructions/skills overhead and model inference. Failed calls stay in the timing totals; reported tokens are counted where known, and unknown usage is not treated as free. Cached/reasoning-token counts are subcategories, not added again to totals. OCR and image rendering were prepared before inference. **These are observed workflow timings, not pure model latency or API price comparisons. No per-request currency bill is available for signed-in Codex, so dollar-cost superiority is unmeasured.**

## Original 25-page partition, now development data

${table('validation-reserved')}

## Original 17-page partition, now development data

${table('calibration')}

## Provenance and reproduction

- Run ${run.startedAt} to ${run.completedAt}; implementation commit \`${run.commit}\`; CLI \`${run.cli}\`.
- Protocol SHA-256 \`${run.protocolSha256}\`; implementation SHA-256 \`${run.protocol.implementationSha256}\`.
- Reference SHA-256 \`${run.protocol.judgmentsSha256}\`; OCR manifest SHA-256 \`${run.protocol.inputsSha256}\`; image manifest SHA-256 \`${run.protocol.imageManifestSha256}\`.
- Raw run SHA-256 \`${sha(raw)}\`. Published artifacts contain predictions and hashes; source PDFs, page images and extracted text are not bundled.

Follow the [acquisition and execution instructions](../../eval/LUNA-BENCHMARK.md#reproduce). Generate a report from a complete raw run with \`node --import tsx eval/luna-report.ts eval/results/luna-TIMESTAMP.json eval/results/luna-report-TIMESTAMP\`. The generator recomputes metrics and rejects changed labels, inputs, gates, missing outcomes or mismatched paired requests. Hosted-model and runtime variation can change new results.

## Every prediction against the unchanged reference

${predictions}
`;
await writeFile(prefix + '.md', markdown, { flag: 'wx' }); console.log(`Wrote ${prefix}.json and .md`);
