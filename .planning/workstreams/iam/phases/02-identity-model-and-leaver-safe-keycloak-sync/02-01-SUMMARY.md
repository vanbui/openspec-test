---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "01"
subsystem: database
tags: [strapi, identity, schema, sqlite, uniqueness]
status: complete
completed: 2026-10-14
requires:
  - phase: 01-midpoint-platform-and-connector-spike
    provides: Connector GO and approved identity contract
provides:
  - Exact approved identity schemas and generated declarations
  - Metadata-derived physical uniqueness installed and checked before seeds
  - Fresh, migrated and restarted database verification
affects: [iam, csrm]
tech-stack:
  added: []
  patterns: [after-sync invariant bootstrap, metadata-derived relation indexes]
key-files:
  created:
    - apps/backend/src/api/identity-source/content-types/identity-source/schema.json
    - apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json
    - apps/backend/src/iam/identity/database-invariants.ts
    - apps/backend/tests/iam-schema-contract.unit.test.ts
    - apps/backend/tests/iam-database-invariants.integration.test.ts
  modified:
    - apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json
    - apps/backend/types/generated/contentTypes.d.ts
    - apps/backend/src/index.ts
    - apps/backend/src/bootstrap/seed-csrm-data.ts
requirements-completed: [MODEL-01, MODEL-03, LIFE-02]
actuals:
  tasks: 2
  commits: 0
metrics:
  tests: 9
  passed: 9
  failed: 0
  skipped: 0
---

# Plan 02-01 Summary

The three schemas match the approved record, preserving the nine existing user attributes. Generated declarations expose only the additive approved fields and collections. Neither new collection has a content API router. The frozen JDL and committed configuration are unchanged.

Bootstrap discovers physical columns and join tables from Strapi metadata, rejects duplicate bindings or inconsistent outbox relations, installs missing single-column unique indexes, and asserts the result before seeds. Conflicts never select a winner or alter persisted rows.

## Verification

| Command | Outcome |
| --- | --- |
| `pnpm --dir apps/backend exec strapi ts:generate-types --silent` | Passed; generated declarations are additive. This command loads registration but does not run schema-sync/bootstrap. |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Passed before the named checks. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-schema-contract.unit.test.js` | Initial test-first run failed for the missing schemas/fields. Final standalone run passed 4/4, with no skips. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-database-invariants.integration.test.js .tmp/tests-dist/tests/iam-schema-contract.unit.test.js` | Passed: 9/9, zero failures or skips, about 41 seconds. |

The integration fixture boots an isolated compiled legacy application with the original user attributes and no new collections, writes a user, Role and assessment request through Document Service, then upgrades the same SQLite database. Roles, subject and request references survive; optional source fields remain null and protection reads false. No backfill was needed. Fresh and repeated boots reject competing source service targets, source keys and outbox keys. Deliberately removed inverse-target indexes are restored on the next boot. Outbox relation/key disagreement and persisted duplicate target corruption are refused without data repair.

## Physical identifiers observed on SQLite

| Invariant | Table | Column / installed inverse-target index |
| --- | --- | --- |
| Source tuple key | `idambox_users` | `source_identity_key` (single-column unique, inspected) |
| Durable work key | `keycloak_sync_outboxes` | `user_document_id` (single-column unique, inspected) |
| Source service target | `identity_sources_service_user_lnk` | `idambox_user_id`; `iam_unique_058bd65b73a7f03fd56331cd` |
| Outbox user target | `keycloak_sync_outboxes_idambox_user_lnk` | `idambox_user_id`; `iam_unique_bea5a7f24e4c7d4ebccbff6d` |

`identityDatabaseLayout` exposes the runtime-discovered owner/target and user/outbox identifiers for the later PostgreSQL gate; it does not assume those dialects use the SQLite identifiers.

## Baseline and plan reconciliation

Execution started from a clean working tree. The first fetch could not obtain repository credentials through the configured helper. A later fetch using the existing CLI credential helper succeeded; the fresh default-branch reference contains no missing backend commits. No merge or history rewrite was needed. The three selected plans' structure checks were rerun and all returned valid with zero errors or warnings. Approval, dependency order, declared verification paths and pinned-runtime assumptions were rechecked against that unchanged backend baseline.

## Deviations and issues resolved

- Strict generated input types require `protected` even though the database has its false default. Added `protected: false` only to the two existing fixture create paths; updates do not reset protection.
- Corrected a test pluralization expectation to the exact approved `keycloak-sync-outboxes` spelling.
- Fixed the isolated legacy fixture to reuse the original database configuration path, so its old and upgraded boots point to the same file. Corrected its attachment configuration to valid isolated local storage.
- No schema, relation or approved index deviation was introduced.

## Task commits

| Task | Commit |
| --- | --- |
| 1 — Approved schemas and declarations | None; left in working tree for orchestrator review. |
| 2 — Durable physical constraints | None; left in working tree for orchestrator review. |

## Orchestrator-run gates

- The independent-process PostgreSQL proof belongs to 02-11. The runtime layout helper and SQLite scenarios are ready; no Docker or live database was started, and PostgreSQL/MySQL behavior is not claimed here.
- Run the whole backend suite at the orchestrator gate, comparing the recorded pre-existing baseline. It was deliberately not run here.

Both `IDAMBOX_KEYCLOAK_PROVISIONING` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` remain false/unset in tracked configuration. ROADMAP.md and STATE.md were not changed.

## Self-Check: PASSED

All declared artifacts exist and the named local checks pass. Fresh remote reconciliation passed; production-dialect proof remains explicitly pending as above. No commit was made.
