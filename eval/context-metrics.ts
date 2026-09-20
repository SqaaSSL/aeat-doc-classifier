import type { ContextualPageResult } from '../src/index.js';
import { summarize, type PublicRow } from './public-types.js';

export type ContextRow = PublicRow & { contextual?: ContextualPageResult };
export function contextSummary(rows: ContextRow[]) {
  // elapsedMs covers the entire retry pipeline. Do not call it isolated model latency,
  // or count just the final decision's usage as total pipeline usage.
  const routing = (items: PublicRow[]) => {
    const { modelCalls, medianModelCallMs, inputTokens, outputTokens, ...metrics } = summarize(items);
    return metrics;
  };
  const times = rows.filter(r => r.result).map(r => r.elapsedMs).sort((a, b) => a - b);
  return {
    pairedPageOnly: routing(rows.map(r => ({ ...r, result: r.contextual?.pageOnly }))),
    contextual: routing(rows),
    contextRetries: rows.filter(r => r.contextual?.context.attempted).length,
    successfulApiCalls: rows.reduce((n, r) => n + (r.contextual?.pageOnly.audit.model ? 1 : 0) + (r.contextual?.context.attempted && r.result?.audit.model ? 1 : 0), 0),
    medianPipelineMs: times.length ? (times[Math.floor((times.length - 1) / 2)]! + times[Math.floor(times.length / 2)]!) / 2 : null,
    inputTokens: rows.reduce((n, r) => n + (r.contextual?.pageOnly.audit.usage.input_tokens ?? 0) + (r.contextual?.context.attempted ? r.result!.audit.usage.input_tokens : 0), 0),
    outputTokens: rows.reduce((n, r) => n + (r.contextual?.pageOnly.audit.usage.output_tokens ?? 0) + (r.contextual?.context.attempted ? r.result!.audit.usage.output_tokens : 0), 0),
  };
}
