---
phase: 02-requestor-risk-assessment-request-workflow
plan: 12
subsystem: api
tags: [nextjs, server-actions, zod, openapi-fetch, strapi]

requires:
  - phase: 02-05
    provides: server-owned Requestor mutation and irreversible submission workflow
  - phase: 02-06
    provides: generated assessment-request mutation and authorised inventory contracts
  - phase: 02-07
    provides: typed request query service and normalized request projections
provides:
  - Shared schemas for editable assessment-request fields and relation document IDs
  - Typed create, draft update, submit, system, and asset Strapi operations
  - Server-revalidated mutation actions with structured safe outcomes
affects: [02-08, request-form, request-detail, request-submission]

tech-stack:
  added: []
  patterns: [shared browser-and-action validation, generated-operation mutation allowlists, success-only cache invalidation]

key-files:
  created:
    - apps/web/src/features/requests/request-actions.ts
    - apps/web/src/features/requests/request-actions.test.ts
  modified:
    - apps/web/src/features/requests/request-schema.ts
    - apps/web/src/features/requests/request-service.ts
    - apps/web/src/features/requests/request-service.test.ts

key-decisions:
  - "Require only title for draft and submit input because no later authoritative completeness rule exists."
  - "Keep sponsor absent until a least-privilege sponsor-directory contract is defined."
  - "Return submitted request data from the submit action while create and draft update navigate to the saved request."

patterns-established:
  - "Mutation boundary: Server Actions parse unknown input with the shared closed schema before calling typed services."
  - "Workflow ownership: callers can send only editable fields; Strapi owns requestor, number, status transition, and timestamps."

requirements-completed: [REQ-02, REQ-03, REQ-04]

duration: 6 min
completed: 2026-08-29
---

# Phase 02 Plan 12: Typed Request Mutation Boundary Summary

**Shared Zod contracts now feed generated Strapi create, draft-update, submit, and authorised inventory operations through thin server-revalidated actions.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T13:37:18Z
- **Completed:** 2026-08-29T13:43:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Defined one closed editable-field contract for assessment-request browser and Server Action input, with title as the only required user-entered field and exact persisted enums, dates, text bounds, and relation document IDs.
- Added typed generated operations for create, draft update, irreversible submit intent, and the two authorised system/asset inventories.
- Excluded requestor, requestNumber, submittedDate, questionnaire, assessment, sponsor, and client-owned workflow status from mutation input.
- Added safe 400/403/409/transport outcomes and success-only `/app` and `/app/requests` revalidation, with navigation after create and draft update.
- Proved the boundary with exact request-body, projection, validation, error, and ordering assertions.

## Task Commits

Each task was committed atomically:

1. **02-W0-03A: Specify typed mutation and Server Action contracts** - `55c50e3` (test)
2. **02-12-02: Implement shared schemas, typed mutation services, and Server Actions** - `8d25414` (feat)

## Files Created/Modified

- `apps/web/src/features/requests/request-actions.ts` - Revalidates unknown input, normalizes safe action results, and performs success-only cache/navigation work.
- `apps/web/src/features/requests/request-actions.test.ts` - Covers validation, safe failures, revalidation/navigation ordering, and server-owned field exclusion.
- `apps/web/src/features/requests/request-schema.ts` - Defines editable, update, submit, mutation-response, and inventory schemas.
- `apps/web/src/features/requests/request-service.ts` - Calls generated Strapi mutation and authorised inventory operations.
- `apps/web/src/features/requests/request-service.test.ts` - Asserts exact generated bodies, inventory projections, and absence of sponsor access.

## Decisions Made

- Title remains the only required field for both draft save and submission; the action boundary does not invent completeness rules absent from the persisted/generated contract.
- Sponsor remains intentionally unsupported because no least-privilege sponsor-directory API contract exists. No generic user or IAM lookup was added.
- Submit returns the authoritative persisted result, including status and submitted date, so the form workflow can render the irreversible transition without a client-owned timestamp.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced a broad forbidden-field regex with exact property assertions**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** The RED test's `/assessment/` substring check incorrectly matched the permitted `assessmentType` field.
- **Fix:** Asserted each forbidden body property independently, preserving coverage without rejecting the authoritative assessmentType field.
- **Files modified:** `apps/web/src/features/requests/request-service.test.ts`
- **Verification:** Strict typecheck and focused service/action tests pass.
- **Committed in:** `8d25414`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug).
**Impact on plan:** The correction made the security assertion precise; implementation scope and API surface were unchanged.

## Issues Encountered

None.

## Verification

- Deliberate RED command emitted only `PHASE2_RED_W0_03A_MUTATION_ACTION_BEHAVIOR_ABSENT` - PASS
- `cd apps/web; pnpm typecheck` - PASS
- `cd apps/web; pnpm test -- src/features/requests/request-service.test.ts src/features/requests/request-actions.test.ts` - PASS (4 tests)
- `cd apps/web; pnpm test` - PASS (34 tests)
- No raw fetch, frontend API facade, generic sponsor access, or client-owned workflow fact in the action/service boundary - PASS

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-08 can consume the shared schemas, typed inventory reads, and create/update/submit actions for the Requestor form and detail workflow.
- Sponsor selection remains deliberately absent until a least-privilege directory contract is designed.
- No blockers remain for the form/page implementation.

## Self-Check: PASSED

- All five created or modified implementation/test files exist.
- Task commits `55c50e3` and `8d25414` exist in repository history.
- Focused and full web verification suites pass.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
