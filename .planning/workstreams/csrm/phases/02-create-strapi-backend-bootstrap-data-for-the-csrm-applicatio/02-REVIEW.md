---
phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio
reviewed: 2026-08-09T07:47:03Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - apps/backend/src/bootstrap/seed-csrm-data.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - scripts/verify-csrm-seed-runtime.mjs
  - scripts/verify-csrm-seed.mjs
  - scripts/verify-core-model.mjs
  - package.json
  - apps/backend/README.md
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-09T07:47:03Z  
**Depth:** standard  
**Files Reviewed:** 7  
**Status:** issues_found

## Summary

This re-review read the seven scoped files with their Strapi bootstrap, database configuration, schema, and provisioning dependencies after commits `6c4b0e5` and `5cd714b`. The prior cleanup BLOCKER and the catalogue-inverse, Windows-path, and encryption-key warnings are resolved: cleanup validates the allocated directory identity and removes only known SQLite artifacts non-recursively; the catalogue and static verifier now assert both directions of the graph; the path prefix is platform-aware; and `ENCRYPTION_KEY` is isolated with the other test settings.

`yarn verify:csrm-seed && yarn verify:schema && yarn check-types` passes, and the verifier leaves no `verify-csrm-seed-*` directory behind. One concurrency-related idempotency warning remains.

## Narrative Findings (AI reviewer)

### WR-01 [WARNING]: CSRM seeding is still only serially idempotent

**Files:** `/Users/vanbui/src/test/idambox/apps/backend/src/bootstrap/seed-csrm-data.ts:78-108`, `/Users/vanbui/src/test/idambox/apps/backend/src/bootstrap/seed-csrm-data.ts:121-162`, `/Users/vanbui/src/test/idambox/scripts/verify-csrm-seed-runtime.mjs:275-283`  
**Issue:** Functions and FunctionApis use a non-atomic `findMany`-then-`create` flow and have no immutable unique seed key or database uniqueness constraint. Two backend instances booting with `IDAMBOX_SEED_CSRM=true` can both observe no matching record and create duplicates. The runtime verifier loads the same database twice sequentially, so it demonstrates serial idempotence only and cannot expose this startup race.

**Fix:** Treat this as a data migration rather than a local seed-script patch: introduce persistent unique catalogue keys, backfill/migrate existing records, enforce unique database constraints, and handle uniqueness conflicts with a retry/re-read flow. Add a genuine concurrent two-instance boot test against one disposable database to prove the final design.

---

_Reviewed: 2026-08-09T07:47:03Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
