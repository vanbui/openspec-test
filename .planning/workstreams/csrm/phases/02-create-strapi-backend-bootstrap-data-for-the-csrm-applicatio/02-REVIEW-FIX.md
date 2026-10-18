---
phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio
status: partial
findings_in_scope: 5
fixed: 4
skipped: 1
iteration: 2
completed: 2026-08-09
---

# Phase 02 Code Review Fix Report

## Fixed

- **CR-01:** Bound disposable SQLite cleanup to the allocated directory identity, remove only known SQLite artifacts, and use non-recursive directory removal (`5cd714b`).
- **WR-01:** Make Role-to-Function and Function-to-Role catalogue relationships bidirectionally consistent and assert both directions (`6c4b0e5`).
- **WR-02:** Use platform-native path construction for the disposable database boundary (`5cd714b`).
- **WR-04:** Set, save, and restore an explicit test-only `ENCRYPTION_KEY` during runtime verification (`5cd714b`).

## Deferred

- **WR-03:** Concurrent Strapi boots can still race while creating Functions and FunctionApis. A safe fix requires persistent seed keys, legacy-row backfill/migration, database uniqueness, unique-conflict retry behavior, and a genuine concurrent-boot integration test. Adding a uniqueness constraint without that migration path could fail deployment against existing data, so this was not applied speculatively during the Phase 02 historical gap closure.

## Verification

- `yarn verify:csrm-seed` — passed
- `yarn verify:schema` — passed
- `yarn check-types` — passed
- Re-review — 0 blockers, 1 warning, 0 informational findings
