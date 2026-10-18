---
phase: 01-monorepo-foundation-and-secure-application-shell
reviewed: 2026-08-29T09:49:48Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/tests/authorization.integration.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-29T09:49:48Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The approved DELETE gap is closed correctly. Requestor retains exactly the four canonical non-delete operations, while Security Analyst and Security Analyst Agent receive canonical DELETE through one separate API-only Function. Role, Function, and FunctionAPI links are reciprocal; all five served operations occur exactly once in both catalogue copies; and the copies are byte-identical with SHA-256 `6CDAE19B7E3BAFE3EB28AB0DDCA73CFCF0C7BC51D710B2B05CA4A347F5076267`.

The parity regression is sound. It resolves paths from the compiled test location rather than the process working directory, compares the raw bytes used by the authoritative and bootstrap files, and passes in the normal Strapi package suite. The suite passed 6/6 during this review, including the mounted Requestor 403/persistence and Security Analyst 204/removal sequence. No schema, route, or authorization-policy change is required for the grant decision.

Two advisory robustness findings remain. Neither demonstrates a current authorization bypass in the approved gap behavior.

## Narrative Findings

## Warnings

### WR-01 (WARNING): An upgrade seed can retain the legacy DELETE FunctionAPI as a duplicate orphan

**File:** `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json:124-146,733-737`

**Issue:** The catalogue replaces `function.risk_assessment_requests.core_api.api.05` with `function.risk_assessment_requests.delete_api.api.01` under a newly created Function. On an already-seeded installation, the production seeder searches for reusable FunctionAPI records only among those currently related to the Function being processed. It first replaces the core Function's relations, detaching the former DELETE record, then processes the new delete Function and creates another record with the same canonical URL because the detached record is outside that search. The fresh SQLite harness proves the new graph but does not exercise this upgrade transition. Authorization remains least-privilege because the stale record is detached, but persisted catalogue data can retain a duplicate orphan.

**Fix:** Make the seed transition migration-safe by locating the legacy DELETE record globally and reconnecting/updating it, or deleting it before creating the replacement. Add an upgrade regression that seeds the pre-split graph, re-seeds the current graph in the same database, and asserts exactly one persisted `DELETE:/api/csrm-assessment-requests/{id}` record related only to `Assessment Request Delete API`. No schema, route, or policy change is needed.

### WR-02 (WARNING): Mounted coverage does not exercise implicit-only Requestor or assigned Agent paths

**File:** `apps/strapi/tests/authorization.integration.test.ts:81-98,142-153`

**Issue:** The mounted owner identities have the Requestor Role explicitly persisted by the harness, so the HTTP cases do not independently prove the birthright path for an active user with no persisted Requestor assignment. The fixture exposed as `harness.identities.analystAgent` is deliberately created with no roles and serves as a missing-grant negative case; no mounted request uses a user explicitly assigned the Security Analyst Agent Role. Static catalogue assertions correctly prove both intended links, and the approved DELETE scenario requires only a Security Analyst success case, so this is an advisory regression-coverage gap rather than evidence that current grants are wrong.

**Fix:** Rename the no-grant fixture to reflect its actual role state. Add an active user with no persisted roles to exercise implicit Requestor access and DELETE denial, plus a user explicitly assigned `Security Analyst Agent` to exercise collection scope and DELETE through mounted HTTP with persistence assertions.

---

_Reviewed: 2026-08-29T09:49:48Z_
_Reviewer: code review_
_Depth: standard_
