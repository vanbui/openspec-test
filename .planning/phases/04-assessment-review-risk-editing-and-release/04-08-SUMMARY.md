---
phase: 04-assessment-review-risk-editing-and-release
plan: "08"
subsystem: api
tags: [strapi, control-implementation, authorization, transactions, tdd]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: shared Assessment ancestor lock, release guard, first-edit transition, contextual Risk workflow, and exact catalogue grants
provides:
  - Exact analyst-only ControlImplementation list, create, PATCH, and DELETE routes
  - Risk-to-Assessment ancestor traversal and immutable descendant mutations under the shared Assessment transaction lock
  - Closed contextual ControlImplementation projections that preserve reusable Control terminology
affects: [04-09, 04-13, 04-16, phase-05-risk-register]

tech-stack:
  added: []
  patterns: [parent-locked descendant mutation, positive field allowlist, server-resolved reusable references]

key-files:
  created:
    - apps/strapi/src/api/csrm-control-implementation/operations.ts
    - apps/strapi/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
  modified:
    - apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts
    - apps/strapi/src/api/csrm-control-implementation/controllers/csrm-control-implementation.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts

key-decisions:
  - "Resolve every ControlImplementation mutation through Risk to its owning Assessment, then reload and verify the exact descendant ancestry inside the shared serialized Assessment transaction."
  - "Represent the reusable Control in the bounded ControlImplementation DTO by its opaque documentId while projecting the contextual ControlImplementation fields separately."
  - "Keep analyst ControlImplementation reads exact-parent and closed while deferring Requestor release reads to Plan 04-16."

patterns-established:
  - "ControlImplementation mutation: exact FunctionAPI policy -> explicit analyst assertion -> closed input -> Risk-to-Assessment resolution -> shared row lock and release guard -> authoritative descendant reload -> server-side reference resolution -> write."
  - "Contextual projection: ControlImplementation fields remain distinct from the reusable Control reference and expose no Risk, Assessment, workflow, release, identity, or audit internals."

requirements-completed: [ASSESS-03]

duration: 14min
completed: 2026-08-30
---

# Phase 4 Plan 08: Parent-Locked ControlImplementation Workflow Summary

**Exact contextual ControlImplementation routes now resolve Risk-to-Assessment ancestry under the shared lock and reject every partial or complete release descendant mutation.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-30T00:11:00Z
- **Completed:** 2026-08-30T00:25:18Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Replaced generic ControlImplementation CRUD with exact catalogue-backed `GET/POST /api/v1/risks/{riskId}/control_implementations` and `PATCH/DELETE /api/v1/control_implementations/{implementationId}` operations.
- Covered exactly `control`, `controlOwner`, `controlStatus`, `effectivenessRating`, `evidence`, `implementationDueDate`, `implementedDate`, and `reviewDate`, with reusable Controls and active owners resolved server-side.
- Traversed every mutation from ControlImplementation or Risk to Assessment, serialized by Assessment documentId, locked and reloaded the ancestor, invoked the shared immutable guard, and revalidated descendant ancestry before persistence.
- Rejected forged Risk/Assessment relations, IDs, workflow/release/audit facts, invalid enum/date/reference values, wrong parents, ungranted actors, missing resources, and generic core CRUD.
- Proved mounted pre-release add/edit/remove, complete-release direct child blocking, and all seven partial/complete release combinations with unconditional tests.

## Task Commits

The TDD task was committed through its required gates:

1. **RED: Specify contextual ControlImplementation workflow** - `2cf2474` (test)
2. **GREEN: Mount parent-locked ControlImplementation workflow** - `a956d31` (feat)

**Plan metadata:** committed with this summary before sequential tracking updates.

## Files Created/Modified

- `apps/strapi/src/api/csrm-control-implementation/operations.ts` - Names the four exact catalogue-backed contextual operations.
- `apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts` - Mounts only the exact list/create/PATCH/DELETE workflow routes.
- `apps/strapi/src/api/csrm-control-implementation/controllers/csrm-control-implementation.ts` - Enforces explicit analyst scope, closed inputs, safe errors, and bounded projections.
- `apps/strapi/src/api/csrm-control-implementation/services/control-implementation-workflow.ts` - Owns Risk-to-Assessment traversal, ancestor locking, exact reference resolution, ancestry rechecks, and persistence.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Covers every writable field, relation and actor denials, exact parents, release immutability, and generic route absence.

## Decisions Made

- Direct PATCH and DELETE first discover the owning Assessment through ControlImplementation -> Risk -> Assessment, then reload the ControlImplementation and both ancestors inside the locked transaction before writing.
- Create requires a valid reusable Control documentId; updates may retain the existing Control but cannot clear the schema-required relation.
- Listing remains analyst-only and exact-Risk scoped without treating navigation or a parent path as authorization; Requestor release projections remain outside this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reloaded relation-backed mutation results before projection**
- **Found during:** Task 1 GREEN verification
- **Issue:** Strapi create/update results did not populate the reusable Control relation, so the closed response projector correctly failed with `409` after persistence.
- **Fix:** Reloaded the authoritative ControlImplementation with only `control` and `controlOwner` populated before projecting the response.
- **Files modified:** `apps/strapi/src/api/csrm-control-implementation/services/control-implementation-workflow.ts`
- **Verification:** Focused assessment workflow passed 12/12 tests and the full Strapi suite passed 62/62 tests.
- **Committed in:** `a956d31`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix is required for the bounded response contract and adds no new surface or scope.

## Issues Encountered

- The mounted release fixture contains a descendant only for the complete release triple. The suite therefore mounts direct create/PATCH/DELETE calls against that released descendant and separately exercises the same production service path for all six partial combinations plus the complete triple.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: full Strapi suite passed all 59 existing tests and failed only the two new missing ControlImplementation workflow tests (`405` plus its dependent fixture assertion).
- Focused GREEN gate: assessment workflow integration file PASS, 12/12 tests.
- Final full verification: `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 62/62 tests.
- TypeScript: production and test configurations compile in strict project mode.
- Exact route inventory: PASS, all four operation constants match the authoritative catalogue URLs.
- Field allowlist: PASS, all eight frozen writable ControlImplementation fields occur in the shared parser and mounted valid mutation contract.
- Key-link trace: PASS, `control-implementation-workflow.ts` resolves Risk-to-Assessment and calls `withMutableAssessmentMutation` plus `assertMutableAssessment` for create, PATCH, and DELETE.
- Catalogue integrity: PASS, authoritative and Strapi bootstrap copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Frozen ControlImplementation schema guard: PASS, worktree and HEAD both resolve to Git blob `3789ea32d51ffbbe1f99165835132f062c765ddb`.
- Test-integrity scan: PASS, no RED sentinel, runner-argument mutation, file-existence guard, skip/todo, conditional assertion bypass, or test early return remains.

## Known Stubs

None.

## Self-Check: PASSED

- All five created or modified task files exist.
- RED commit `2cf2474` and GREEN commit `a956d31` exist in repository history in the required order.
- All task acceptance criteria and plan-level verification pass without schema, catalogue, dependency, shared-harness, developer-database, release-route, or Requestor-read changes.

## Next Phase Readiness

- Plans 04-09 and 04-13 can consume the exact contextual ControlImplementation routes and bounded DTO shape.
- Plan 04-16 can add release and owner-only Requestor reads while relying on direct ControlImplementation writes already failing closed for every partial or complete release fact.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
