---
phase: 04-assessment-review-risk-editing-and-release
plan: "16"
subsystem: api
tags: [strapi, assessment-release, authorization, transactions, owner-scope, tdd]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: shared Assessment ancestor serialization, release readiness, descendant immutability, and exact Risk and ControlImplementation routes
provides:
  - Analyst-only readiness-gated atomic assessment release under the shared row lock
  - Complete-release owner-only Requestor list, rating, detail, Risk, and ControlImplementation projections
  - Exact development Content API actions with no Requestor mutation FunctionAPI
affects: [04-09, 04-10, 04-11, 04-12, 04-13, 04-14, phase-05-risk-register]

tech-stack:
  added: []
  patterns: [single-timestamp aggregate release, owner-plus-complete-release predicate, shared analyst-and-requestor read routes]

key-files:
  created: []
  modified:
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - apps/strapi/tests/authorization.integration.test.ts

key-decisions:
  - "Release serializes on Assessment documentId, locks and reloads full readiness inside one transaction, then stamps both dates and the owning request with one server time."
  - "Requestor projections require both exact owner ancestry and the complete assessment release triple plus approved owning request; partial and cross-owner records resolve as absent."
  - "Shared assessment, Risk, and ControlImplementation GET operations branch by the server authorization actor while all mutations remain exact analyst-only FunctionAPIs."

patterns-established:
  - "Explicit release: exact grant -> analyst assertion -> serialize -> transaction -> row lock -> authoritative aggregate reload -> readiness -> same-time Assessment/request writes."
  - "Released read: exact grant -> Requestor assertion -> owner-constrained query -> complete isReleased predicate -> closed projection."

requirements-completed: [ASSESS-04, ASSESS-05]

duration: 17min
completed: 2026-08-30
---

# Phase 4 Plan 16: Atomic Assessment Release and Owner Projections Summary

**Analyst-controlled one-transaction release now exposes only complete released aggregates to their owning Requestor and permanently closes every aggregate mutation route.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-30T00:31:12Z
- **Completed:** 2026-08-30T00:48:05Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Mounted only `POST /api/v1/risk_assessments/{assessmentId}/release`, requiring the exact analyst grant, in-review readiness, a serialized row lock, and one transaction that stamps assessment status, approver, approval date, assessment date, and owning request status.
- Proved injected second-write rollback leaves all five persisted facts unchanged, simultaneous attempts yield exactly one success and one conflict, repeat release conflicts, and all partial release combinations remain immutable.
- Added owner-only released assessment collection, rating summary, detail, Risk, and ControlImplementation reads with both owner ancestry and complete release/request predicates evaluated server-side.
- Kept Requestor mutation capability absent across release, Assessment, Risk, and ControlImplementation routes while preserving implicit Requestor birthright as empty/absent for non-owners.
- Reconciled the exact served Phase 4 development handler actions without adding IAM, generic CRUD, ambiguous approval verbs, dependencies, schema fields, or catalogue changes.

## Task Commits

The TDD task was committed through its required gates:

1. **RED: Specify atomic release and owner reads** - `b644267` (test)
2. **GREEN: Release immutable owner assessments** - `8aa6938` (feat)

No refactor commit was needed; the minimal GREEN implementation remained clear and the final suite stayed green.

## Files Created/Modified

- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Mounted rollback, concurrency, partial-fact, IDOR, descendant read, and mutation-denial coverage.
- `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts` - Exact release and released Requestor read route inventory.
- `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts` - Actor-aware closed projections and explicit release delegation.
- `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` - Owner-constrained queries, complete-release predicate, rating counts, and bounded descendant projection.
- `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` - Serialized locked release transaction with readiness recheck and one authoritative timestamp.
- `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` - Exact served Phase 4 development actions.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Strict positive action-array parity for the mounted Phase 4 surface.
- `apps/strapi/tests/authorization.integration.test.ts` - Strict seed/reconciliation expectations for the same action surface.

## Decisions Made

- Complete Requestor visibility requires `assessmentStatus=approved`, a valid `approvedBy`, a valid `approvalDate`, owning `requestStatus=approved`, and exact requestor ownership. Any missing part fails closed.
- `assessmentDate` and `approvalDate` receive the same server-generated instant because the frozen model represents release as one aggregate event.
- Shared read URLs retain their authoritative catalogue operations; actor-specific server logic supplies analyst review or owner-only released projections without creating competing endpoints.
- `approve` and `submit_for_approval` remain unmounted, and draft assistance retains no path to release.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated stale exact development-permission assertions**
- **Found during:** Task 1 GREEN verification
- **Issue:** Two earlier exact-array tests positively required the Phase 3-only development action list and one explicitly forbade every Phase 4 assessment action, making the required permission reconciliation and full-suite GREEN mutually exclusive.
- **Fix:** Updated both assertions to positively enumerate the complete exact Phase 4 handler list, retained full-array equality, retained CSRM-only and no-IAM/delete checks, and added a separate exact Phase 4 subset assertion.
- **Files modified:** `apps/strapi/tests/contract-catalogue.integration.test.ts`, `apps/strapi/tests/authorization.integration.test.ts`
- **Verification:** Final Strapi suite passed 65/65 tests; no skip, gate, early return, sentinel, or conditional assertion was added.
- **Committed in:** `8aa6938`

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The correction preserves strict test integrity and makes the existing exact assertions describe the newly served permission surface without widening production authorization.

## Issues Encountered

- Existing analyst-only GET expectations were updated to the intended shared-route behavior: active birthright Requestors receive owner-filtered `404`/empty results for unreleased or non-owned records, while mutations and inactive/missing identities remain `403`.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: 62 existing tests passed; only the three new mounted capability tests failed on unmounted release/Requestor routes.
- GREEN focused assessment workflow: PASS, 15/15 tests.
- Final `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 65/65 tests.
- Catalogue integrity: PASS, authoritative and bootstrap copies remain byte-identical at Git blob `06a2f352716d8056bbd166516324c8a94bc23d90`.
- Frozen API and schema guards: PASS, `specification.json` remains `c8f36c442a51ccf48402c12cf07af2005e04371b`; Assessment schema remains `25ec1021623ba8e96a3e9a5e5bd335f6b853b3cb`.
- Route inventory: PASS, explicit `release` is mounted and `approve`/`submit_for_approval` remain absent.
- Key-link trace: PASS, controller `releaseAssessment` delegates to the serialized row-lock workflow; Requestor reads call the owner plus `isReleased` projection predicate.
- Test-integrity scan: PASS, no RED sentinel, runner argument mutation, file guard, skip/todo, conditional assertion bypass, or early return remains.

## Known Stubs

None.

## Self-Check: PASSED

- All eight modified implementation/test files exist.
- RED commit `b644267` and GREEN commit `8aa6938` exist in repository history in the required order.
- All task acceptance criteria and plan-level verification pass with frozen schemas and byte-identical catalogues.

## Next Phase Readiness

- Plans 04-09 through 04-14 can consume the exact explicit release and immutable owner-read routes.
- Phase 5 receives a released aggregate whose Assessment, Risk, and ControlImplementation descendants are immutable under direct-route attempts.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
