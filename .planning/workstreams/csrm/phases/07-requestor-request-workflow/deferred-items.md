# Deferred Items

## 2026-08-22 — Unrelated CSRM capability-count assertions

`yarn workspace @idambox/csrm verify` currently fails in:

- `src/config/capabilities.test.ts` (two assertions)
- `src/lib/fixtures/resolve-identity.test.ts` (one assertion)

Each assertion expects 23 capabilities while the committed CSRM catalogue now contains 27. This OpenAPI contract task does not modify capabilities, the catalogue, or development identity fixtures, so the failure is out of scope.

## 2026-08-23 — Stale Phase 6 shell E2E expectations

`yarn workspace @idambox/csrm test:e2e` runs 10 tests; the four request-workflow tests pass, while six existing `e2e/shell.spec.ts` assertions fail because they still expect the Phase 6 placeholder home and its short shell snapshots. Phase 7 now correctly renders the real Dashboard and request data. Its legacy production scan also expects route capability strings to be absent from server chunks even though the current application route registry necessarily includes those values. This real-Strapi request workflow task does not modify the retired shell contract or its snapshots, so the failures are out of scope.
