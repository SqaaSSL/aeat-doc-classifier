import type { Backend, ChoiceAnswer, ChoiceQuestion, DecisionResponse } from './types.js';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export class JevError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'JevError'; }
}

/** Validate provider and custom-backend replies before any classification can be accepted. */
export function validateResponse(raw: unknown, questions: Record<string, ChoiceQuestion>): DecisionResponse {
  const fail = (): never => { throw new JevError('Invalid Jev response; no classification accepted.'); };
  if (!object(raw) || typeof raw.model !== 'string' || !raw.model || !object(raw.answers) || !object(raw.usage)) return fail();
  if (!Number.isSafeInteger(raw.usage.input_tokens) || (raw.usage.input_tokens as number) < 0 ||
      !Number.isSafeInteger(raw.usage.output_tokens) || (raw.usage.output_tokens as number) < 0) return fail();
  const answers: Record<string, ChoiceAnswer> = {};
  for (const [key, q] of Object.entries(questions)) {
    const a = raw.answers[key];
    if (!object(a) || a.type !== 'choice' || typeof a.choice !== 'string' || !Object.hasOwn(q.criteria, a.choice) ||
        !unit(a.confidence) || !object(a.probabilities)) return fail();
    const expected = Object.keys(q.criteria), probs = a.probabilities;
    if (Object.keys(probs).length !== expected.length || expected.some(k => !Object.hasOwn(probs, k) || !unit(probs[k]))) return fail();
    const values = expected.map(k => probs[k] as number);
    if (Math.abs(values.reduce((s, p) => s + p, 0) - 1) > 0.01 ||
        (probs[a.choice] as number) + 1e-6 < Math.max(...values)) return fail();
    answers[key] = { type: 'choice', choice: a.choice, confidence: a.confidence, probabilities: { ...probs } as Record<string, number> };
  }
  return { model: raw.model, answers, usage: { input_tokens: raw.usage.input_tokens as number, output_tokens: raw.usage.output_tokens as number } };
}

export interface JevOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Dependency injection for testing; the production endpoint is fixed. */
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function jevBackend(options: JevOptions = {}): Backend {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey?.trim()) throw new JevError('Set TYPESAFE_API_KEY before calling Jev.');
  const model = options.model ?? process.env.TYPESAFE_MODEL ?? 'jev-1.13.0';
  const timeoutMs = options.timeoutMs ?? 30_000, retries = options.maxRetries ?? 2;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000 || !Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new JevError('Invalid timeout or retry limit.');
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  return {
    async ask(state, questions) {
      const qs = Object.values(questions);
      if (!qs.length || qs.some(q => q.type !== 'choice' || Object.keys(q.criteria).length < 2 || Object.keys(q.criteria).length > 255)) {
        throw new JevError('Each Choice must have between 2 and 255 options.');
      }
      const body = JSON.stringify({ model, state, questions });
      // Conservative byte bound avoids silently truncating evidence or exceeding context on usual text.
      if (Buffer.byteLength(body, 'utf8') > 60_000) throw new JevError('Request too large; split into smaller pages or transactions.');
      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try {
          response = await fetcher(ENDPOINT, {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body, signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
          });
        } catch {
          // Never propagate provider, network or abort errors that could echo inputs or secrets.
          throw new JevError('Jev request failed or timed out; no classification accepted.');
        }
        if (!response.ok) {
          const retryable = [429, 500, 502, 503, 504, 529].includes(response.status);
          if (retryable && attempt < retries) {
            const header = response.headers.get('retry-after');
            const seconds = header === null ? NaN : Number(header);
            const delay = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : NaN;
            await response.body?.cancel();
            await sleep(Math.min(30_000, Math.max(0, Number.isFinite(delay) ? delay : 500 * 2 ** attempt)));
            continue;
          }
          await response.body?.cancel();
          throw new JevError(`Jev returned HTTP ${response.status}; no classification accepted.`, response.status);
        }
        let raw: unknown;
        try { raw = await response.json(); } catch { throw new JevError('Jev returned invalid JSON.'); }
        return validateResponse(raw, questions);
      }
    },
  };
}
