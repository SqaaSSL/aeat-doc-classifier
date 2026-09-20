import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateCandidates, type CandidateManifest } from '../eval/calibration-types.js';
const manifest = JSON.parse(readFileSync(new URL('../eval/calibration-v1.json', import.meta.url), 'utf8')) as CandidateManifest;
const previous = JSON.parse(readFileSync(new URL('../eval/public-v1.json', import.meta.url), 'utf8')) as { sources: Array<{ url: string; sha256: string }> };
test('new candidate corpus preserves sources and declared families across splits', () => {
  validateCandidates(manifest, previous.sources);
  assert.equal(manifest.sources.reduce((n, s) => n + s.cases.length, 0), 42);
  assert.match(manifest.labelStatus, /review pending/);
});
test('candidate verification rejects prior-source contamination and cross-split relatives', () => {
  assert.throws(() => validateCandidates(manifest, [manifest.sources[0]!]));
  const copy = structuredClone(manifest);
  const paired = copy.sources.filter(s => s.familyGroup === 'atc-650-660');
  paired[0]!.split = 'calibration';
  assert.throws(() => validateCandidates(copy, previous.sources), /crosses/);
});
