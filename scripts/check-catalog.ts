import assert from 'node:assert/strict';
import { aeatModels, pgcAccounts, classificationQuestions } from '../src/index.js';
for (const q of Object.values(classificationQuestions())) assert.ok(Object.keys(q.criteria).length <= 255);
assert.equal(new Set(aeatModels.map(m => m.id)).size, aeatModels.length);
assert.equal(new Set(pgcAccounts.map(a => a.code)).size, pgcAccounts.length);
for (const item of [...aeatModels, ...pgcAccounts]) {
  assert.ok(item.title && item.description && item.sources.length);
  for (const source of item.sources) assert.equal(new URL(source).protocol, 'https:');
}
console.log(`Catalog OK: ${aeatModels.length} AEAT models; ${pgcAccounts.length} PGC accounts.`);
