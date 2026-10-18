---
phase: 04-assessment-review-risk-editing-and-release
plan: "07"
subsystem: api
tags: [strapi, assessment-metadata, authorization, transactions, tdd]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: deterministic draft Assessment aggregates with server-owned provenance and exact analyst grants
provides:
  - Exact analyst assessment list, status-summary, detail, and update routes
  - Closed Assessment summary/detail projections and positive metadata mutation allowlist
  - Transactional first-edit review transitions with partial/complete release immutability
affects: [04-08, 04-09, 04-10, 04-13, 04-16]

tech-stack:
  added: []
  patterns: [closed analyst projections, serialized ancestor lock and reload, server-owned first-edit transition]

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts
  modified:
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/strapi/src/api/csrm-assessment/operations.ts
    - apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts

key-decisions:
  - "Require the authorization policy's explicit analyst actor decision inside every assessment controller path, so the catalogue's shared Requestor GET grant cannot enable prerelease reads in this plan."
  - "Serialize by assessment documentId and lock/reload the Assessment inside the transaction before parsing or applying the positive metadata allowlist."
  - "Stamp reviewedBy and both first-review transitions only for draft/risk-assessment-drafted; later in-review/under-review edits preserve the original reviewer."

patterns-established:
  - "Assessment metadata route: exact FunctionAPI policy -> analyst actor assertion -> closed query/body validation -> bounded projection."
  - "First accepted edit: serialize -> transaction -> ancestor lock/reload -> release guard -> allowlist -> Assessment/request transition writes."

requirements-completed: [ASSESS-03]

duration: 10min
completed: 2026-08-30
---

# Phase 4 Plan 7: Bounded Assessment Metadata Workflow Summary

**Exact analyst-only Assessment metadata routes now expose closed projections and atomically begin review on the first allowlisted edit while release facts remain immutable and server-owned.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T23:39:31Z
- **Completed:** 2026-08-29T23:50:01Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Mounted only the contract-backed `GET /api/v1/risk_assessments`, status-summary, detail, and `PATCH` operations behind both application-enabled and exact FunctionAPI policies.
- Added closed eight-field list and fifteen-field detail DTO projections, including bounded user summaries and rejection of every caller-controlled query expansion.
- Implemented a six-field positive metadata allowlist covering summary, rating, control effectiveness, recommendations, rationale, and next review date.
- Serialized updates by Assessment, locked and reloaded the aggregate inside a transaction, rejected every partial or complete release fact, and resolved the analyst identity server-side.
- Transitioned the first accepted edit from Assessment `draft` to `in-review` and owning request `risk-assessment-drafted` to `under-review`, stamping `reviewedBy` once while later edits preserve it.
- Proved Requestor, ungranted, inactive, missing, invalid-value, hostile-field, missing-record, immutable-release, and generic core CRUD denials through mounted HTTP.

## Task Commits

The TDD task was committed through its required gates:

1. **RED: Add failing mounted assessment metadata contract** - `cad037d` (test)
2. **GREEN: Mount bounded assessment metadata workflow** - `8895529` (feat)

**Plan metadata:** committed with this summary before sequential tracking updates.

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` - Enforces analyst scope and produces closed list, detail, and status projections.
- `apps/strapi/src/api/csrm-assessment/operations.ts` - Names the four exact catalogue-backed Assessment metadata operations.
- `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts` - Mounts exact `/v1` metadata routes without restoring generic core CRUD.
- `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts` - Enforces analyst decisions, validates closed inputs, delegates mutation, and emits safe errors.
- `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` - Owns serialization, transaction locking, mutability checks, positive allowlisting, and first-edit transitions.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Covers bounded DTOs, every editable field, hostile exclusions, transitions, actor denials, release immutability, and generic route absence.

## Decisions Made

- The shared catalogue GET operation is not sufficient for this plan's analyst-only slice: controllers also require the authorization policy's resolved actor to be `analyst`, leaving Requestor release reads for Plan 04-16.
- Assessment collection reads accept no caller query surface because the frozen OpenAPI operations declare no query parameters; Strapi populate/filter/sort expansion therefore fails closed.
- The workflow retains the existing complete/partial release guard as the single mutability predicate and performs it against the transactionally reloaded ancestor.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The existing harness' direct Assessment inspection does not populate `reviewedBy`; mounted detail reloads were used to prove persisted reviewer identity without expanding plan ownership into the shared harness.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: full Strapi suite passed all 55 existing tests and failed only the two new missing assessment-route assertions with HTTP 404.
- GREEN gate: `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 57/57 tests.
- Final full verification after the GREEN commit: PASS, 57/57 tests.
- Catalogue SHA-256 comparison: PASS, authoritative and bootstrap copies remain byte-identical at `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Frozen Assessment schema guard: PASS, unchanged Git object `25ec1021623ba8e96a3e9a5e5bd335f6b853b3cb`.
- Key-link trace: PASS, the controller delegates `updateAssessment` to the workflow and the workflow calls `assertMutableAssessment` after lock/reload.
- Test-integrity scan: PASS, no RED sentinel, `execArgv`, file-existence guard, skip, todo, conditional escape hatch, or early-return test bypass.

## Known Stubs

None.

## Self-Check: PASSED

- All six created or modified task files exist.
- RED commit `cad037d` and GREEN commit `8895529` exist in repository history in the required order.
- All task acceptance criteria and plan-level verification pass without schema, catalogue, dependency, developer-database, Risk-route, ControlImplementation-route, release-route, or Requestor-read changes.

## Next Phase Readiness

- Plan 04-08 can add descendant Risk and ControlImplementation mutations against the same ancestor mutability boundary.
- Plans 04-09, 04-10, and 04-13 can consume the closed metadata read/update DTOs and explicit first-review transition behavior.
- Plan 04-16 remains responsible for readiness-gated release and owner-only Requestor reads.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
