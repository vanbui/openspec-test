---
status: complete
phase: 02-identity-model-and-leaver-safe-keycloak-sync
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md, 02-11-SUMMARY.md, 02-12-SUMMARY.md, 02-13-SUMMARY.md]
started: 2026-10-19T04:03:43Z
updated: 2026-10-19T06:30:27Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running Strapi and the compose stack. Clear ephemeral state (apps/backend/.tmp, the dev SQLite database). Start Keycloak from docker/docker-compose.yaml and Strapi with `pnpm --dir apps/backend develop`, NODE_ENV=development and IDAMBOX_SEED_IAM=true. Strapi boots without errors, schema bootstrap and seeds complete, and the admin panel at http://localhost:1337/admin loads with live data.
result: pass

### 2. Dev seed registers the midPoint (dev) Identity Source
expected: In the Strapi admin Content Manager, the Identity Source "midPoint (dev)" exists and is bound to the service user `midpoint-dev-provisioning` (active, protected, manual, no password or Keycloak subject), whose only Role is Identity Provisioning. Restarting Strapi does not create a second source or service user.
result: pass

### 3. Existing users read as manual and unprotected, with CSRM access unchanged
expected: Existing IdamBox Users (e.g. the seeded requestor and analyst fixtures) show no Identity Source or source key and protected = false. Signing into the CSRM web app as one of them shows the same menus and records as before Phase 2.
result: pass

### 4. Sourced user's HR fields are locked, roles are not
expected: In the Strapi admin, editing an HR-owned field (e.g. displayName or email) of a user owned by an Identity Source is refused, while changing that user's Roles saves successfully. A manual user's HR fields still edit normally.
result: pass

### 5. Leaver deactivation commits while Keycloak is down
expected: With provisioning on (IDAMBOX_KEYCLOAK_PROVISIONING=true, IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true) and a linked user signed into CSRM, stop Keycloak (`docker compose -f docker/docker-compose.yaml -p idp stop keycloak`). Setting that user's accountStatus to inactive in the Strapi admin saves promptly, and their next CSRM request is refused (403). After `start keycloak`, within about a minute the Keycloak user shows Enabled = off and has no sessions, and the KeycloakSyncOutbox row reads completed. (Alternatively: the live gate `node .tmp/tests-dist/tests/helpers/iam-live-keycloak-gate.js --timeout-seconds 600` exits 0 on this machine.)
result: pass

### 6. Two-process PostgreSQL gate passes on this machine
expected: With the `iam-pg-gate` compose profile running (postgres:16 on 127.0.0.1:15432) and the IAM_PG_GATE_* variables set, `pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 1800` exits 0 with every stage passing, and only the gate-owned iam_gate_* database is created and dropped.
result: pass

### 7. Write guard catches a raw IdamBoxUser write
expected: `node .tmp/tests-dist/scripts/idambox-user-write-guard.js --check` (from apps/backend, after compiling tests) passes over 100+ files. Temporarily adding `strapi.db.query("api::idambox-user.idambox-user").updateMany(...)` to a source file makes it fail with that file, line and `updateMany`; removing it makes it pass again.
result: pass

### 8. Full backend suite is green
expected: `pnpm --dir apps/backend test` exits 0 with no failures (about 50 minutes; one platform skip is acceptable only if it is unrelated to IAM — on macOS the POSIX-mode test should run, not skip).
result: pass

### 9. Contract-gap record and ADR 0002 amendment are in place
expected: `docs/contract-gaps/iam-identity-model-and-leaver-sync.md` names `csrm` as a reader of IdamBoxUser and is marked approved. `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md` records the amendment: an existing user's deactivation commits with an outbox enqueue and no remote call, while creates, other mirrored updates and reactivation stay blocking.
result: pass

### 10. Services are excluded from analyst candidates and rejected as assignees
expected: Services are excluded before the analyst candidate window and rejected as submitted assignees.
result: pass
source: automated
coverage_id: request-assignment

### 11. Owner search excludes services
expected: Shared owner search excludes services before its 20-person limit and preserves human selection.
result: pass
source: automated
coverage_id: owner-search

### 12. Submitted owners reject services
expected: Risk, treatment, control implementation and administration owner writes reject services without changing records or counts.
result: pass
source: automated
coverage_id: submitted-owners

### 13. Historical people keep safe labels
expected: Binding changes are read freshly, inactive sources remain excluded and historical references retain safe labels.
result: pass
source: automated
coverage_id: historical-people

### 14. Identity ownership guard
expected: Locked ownership, administrative paths, inverse grants and context isolation.
result: pass
source: automated
coverage_id: identity-ownership

### 15. Source identity input contract
expected: Approved DTO fields, opaque keys, literal digests and safe conflict outcomes.
result: pass
source: automated
coverage_id: source-identity-input

### 16. Scoped identity service reads and writes
expected: Scoped source reads, validated creates and owned patches with safe projections.
result: pass
source: automated
coverage_id: D1

### 17. Atomic claims, tuple conflicts and tombstones
expected: Atomic explicit claims, immutable tuple conflicts, retained tombstones and blocking rollback.
result: pass
source: automated
coverage_id: D2

### 18. Claimed dev fixtures survive reseeding
expected: Claimed development fixtures survive repeat seeding and ambiguous matches fail closed.
result: pass
source: automated
coverage_id: D3

## Summary

total: 18
passed: 18
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
