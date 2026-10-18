---
phase: 04-assessment-review-risk-editing-and-release
plan: "05"
subsystem: api
tags: [strapi, authorization, assessment-review, tdd, pagination]

requires:
  - phase: 04-02
    provides: frozen assessment workflow contract and exact catalogue grants
  - phase: 04-03
    provides: reviewable assessment workflow states and release invariants
provides:
  - Exact-grant analyst review queue at GET /api/v1/assessment_requests
  - Closed eligible-status filters, bounded pagination and sorting, and named queue projection
  - Mounted denial and query-expansion coverage linked to existing request and questionnaire reads
affects: [04-09, 04-10, 04-12, analyst-review-workflow]

tech-stack:
  added: []
  patterns:
    - Route-specific authorization scope stored in ctx.state and revalidated by the query builder
    - Custom /v1 route composed ahead of unchanged Strapi core request routes

key-files:
  created:
    - apps/strapi/tests/assessment-workflow.integration.test.ts
  modified:
    - apps/strapi/src/api/csrm-assessment-request/operations.ts
    - apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/src/policies/csrm-authorization.ts

key-decisions:
  - "Use a dedicated assessmentReviewCollectionScope flag so the analyst queue cannot inherit Requestor birthright or the broader core collection behavior."
  - "Treat the queue documentId as the opaque link key into the existing authorized request detail, whose persisted relation leads to submitted questionnaire reads."

patterns-established:
  - "Analyst review collections require an exact active analyst FunctionAPI grant plus a route-specific server scope."
  - "Queue inputs reject unknown keys and client-controlled populate/owner expansion before persistence queries are built."

requirements-completed: [ASSESS-01]

duration: 14min
completed: 2026-08-30
---

# Phase 4 Plan 5: Analyst Assessment Review Queue Summary

**Exact-grant Strapi review queue exposing only four eligible workflow states through bounded inputs and a five-field assessment request projection**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-29T22:54:17Z
- **Completed:** 2026-08-29T23:08:01Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Mounted `GET /api/v1/assessment_requests` without removing or widening the existing owner-scoped core request routes.
- Required an active identity with the exact analyst catalogue grant; Requestors, inactive identities, missing identities, and analyst-labelled users without a grant receive safe 403 responses.
- Restricted the queue to submitted, questionnaire-in-progress, risk-assessment-drafted, and under-review records with bounded pagination, allowlisted filters/sorts, and a closed five-field projection.
- Proved opaque queue identifiers reach the existing authorised request detail and persisted submitted-questionnaire relationship while arbitrary owner/populate expansion fails closed.

## Task Commits

The task followed a genuine RED/GREEN cycle:

1. **RED: mounted analyst review queue contract** - `71a5f71` (test)
2. **GREEN: exact-grant bounded analyst queue** - `b891a51` (feat)

No refactor commit was needed; the minimal GREEN implementation already separated policy, query construction, projection, controller, and route responsibilities cleanly.

## Files Created/Modified

- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Mounted positive, denial, bounded-query, projection, and existing-link coverage.
- `apps/strapi/src/api/csrm-assessment-request/operations.ts` - Canonical analyst queue FunctionAPI operation.
- `apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` - Custom `/v1` queue composed with unchanged core routes and two policies.
- `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` - Selects and projects the analyst queue only after route scope is resolved.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` - Closed analyst query parser, eligible-state predicate, pagination, sort, and projection.
- `apps/strapi/src/policies/csrm-authorization.ts` - Exact active analyst collection decision stored server-side.

## Decisions Made

- Added a dedicated analyst-review collection scope instead of reusing the core `all` scope, preventing accidental Requestor birthright access or route-policy confusion.
- Kept the frozen queue DTO at its contract-defined five fields; the opaque request `documentId` is followed through the existing authorised detail and persisted questionnaire relation rather than adding competing link fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled sequential state fields unsupported by the installed state handlers**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` could not parse the frontmatter-first state format, while `state.update-progress` wrote the completed-plan count as the percentage and could not update the section-based next action.
- **Fix:** Retained successful handler updates for the plan counter, metrics, decisions, session, roadmap, and requirements; then reconciled Plan 6, 39/50 completed plans (78%), and the Plan 04-06 next action.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE records `current_plan: 6`, `completed_plans: 39`, `percent: 78`, and `Stopped At: Completed 04-05-PLAN.md`; ROADMAP records 5/16 Phase 4 plans executed.
- **Committed in:** plan tracking commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Sequential tracking was restored without changing production behavior or widening scope.

## Issues Encountered

- GREEN debugging corrected fixture selection for the complete under-review state and retained the legacy core-operation inventory by exporting the new canonical operation separately. The final suite is fully green and no production scope changed beyond the planned route.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: full Strapi suite passed all 50 pre-existing tests and failed only the two ordinary missing-route assertions with HTTP 404.
- GREEN gate: `npm test` in `apps/strapi` under Node 24.19.0 and `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 52/52 tests.
- Targeted mounted and contract tests: PASS, 5/5 tests.
- Explicit actor denials and query-expansion rejection: PASS with safe 403/400 responses.
- Existing Phase 2/3 request and questionnaire routes: PASS in the full suite.
- Catalogue SHA-256 comparison: PASS, both copies remain byte-identical.
- Frozen content-type schema diff guard: PASS, no `schema.json` changes.
- Test-integrity and stub scan: PASS, no sentinel, skip, guard, placeholder, TODO, or conditional escape hatch.

## Known Stubs

None.

## Self-Check: PASSED

- All six created or modified plan files exist.
- RED commit `71a5f71` and GREEN commit `b891a51` exist in repository history in the required order.
- Every task acceptance criterion and the plan-level mounted/contract verification passed without touching frozen schemas, catalogue content, dependencies, or `apps/web/next-env.d.ts`.

## Next Phase Readiness

- Plans 04-09 and 04-10 can consume the bounded analyst queue through the generated assessment contract and opaque request identifiers.
- The exact route grant and server scope are ready for the later Bob-to-Jane end-to-end journey.
- No blocker, external configuration, schema change, or dependency addition remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
