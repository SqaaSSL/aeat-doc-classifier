import type { ChoiceAnswer, Decision, Gate } from './types.js';

export const DEFAULT_GATE: Readonly<Gate> = Object.freeze({ minConfidence: 0.95, minProbability: 0.95 });

export function resolveGate(overrides?: Partial<Gate>): Gate {
  const gate = { ...DEFAULT_GATE, ...overrides };
  for (const value of Object.values(gate)) if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Gate thresholds must be between 0 and 1.');
  return gate;
}

export function decision(answer: ChoiceAnswer): Decision {
  return {
    value: answer.choice, confidence: answer.confidence, probability: answer.probabilities[answer.choice]!,
    alternatives: Object.entries(answer.probabilities).filter(([k]) => k !== answer.choice)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([value, probability]) => ({ value, probability })),
    probabilities: answer.probabilities,
  };
}

export function passes(d: Decision, gate: Gate): boolean {
  return d.confidence >= gate.minConfidence && d.probability >= gate.minProbability;
}

export function normalizeText(text: string | readonly string[]): string {
  if (typeof text !== 'string' && (!Array.isArray(text) || text.some(line => typeof line !== 'string'))) throw new TypeError('Expected text or an array of text lines.');
  const normalized = (typeof text === 'string' ? text : text.join('\n')).normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (Buffer.byteLength(normalized, 'utf8') > 24_000) throw new Error('Page text exceeds 24,000 UTF-8 bytes; split the input without losing evidence.');
  return normalized;
}
