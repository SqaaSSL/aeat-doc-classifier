# Contributing

Use Node.js 22 or later. Run `npm ci`, `npm run check`, and `npm run catalog:check`. Unit tests and CI must run without credentials. Optional live evaluations use `TYPESAFE_API_KEY` and are never run automatically on pull requests.

For catalog changes, include a direct official source, review date, positive examples and the nearest confusable models/accounts. Document historical forms and changes in coverage. Do not treat a new model number as evidence of a taxpayer's filing obligation. The account catalog is a shared subset, not a complete implementation of PGC or PGC-PYMES.

Add regression tests for acceptance boundaries and malformed responses. Keep model-assisted evaluation separate from deterministic tests; mocks prove policy behavior, not Jev's accuracy. Preserve unsuccessful evaluation results when they explain a limitation, and never describe development fixtures as held-out validation.

Do not commit taxpayer documents, real identifiers, credentials, downloaded corpora or raw production logs. Use synthetic fixtures or a documented, permissioned redaction process. This implementation is MIT; preserve all required notices when introducing third-party material.
