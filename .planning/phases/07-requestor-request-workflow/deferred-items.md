# Deferred Items

## 2026-08-22 — Unrelated CSRM capability-count assertions

`yarn workspace @idambox/csrm verify` currently fails in:

- `src/config/capabilities.test.ts` (two assertions)
- `src/lib/fixtures/resolve-identity.test.ts` (one assertion)

Each assertion expects 23 capabilities while the committed CSRM catalogue now contains 27. This OpenAPI contract task does not modify capabilities, the catalogue, or development identity fixtures, so the failure is out of scope.
