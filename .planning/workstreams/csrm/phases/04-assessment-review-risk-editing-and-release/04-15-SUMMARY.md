---
phase: 04-assessment-review-risk-editing-and-release
plan: "15"
subsystem: api
tags: [strapi, contextual-risk, authorization, transactions, tdd]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: bounded Assessment metadata workflow with shared ancestor mutability and first-edit transition rules
provides:
  - Exact analyst Risk list, create, and PATCH workflow routes without generic Risk CRUD
  - Parent-locked contextual Risk mutations with a complete positive field allowlist and server-owned RSK identifiers
  - Bounded RiskType, Control, and active-user reference projections
affects: [04-08, 04-09, 04-13, 04-16, phase-05-risk-register]

tech-stack:
  added: []
  patterns: [shared mutable-assessment transaction helper, server-resolved descendant relations, closed contextual Risk projections]

key-files:
  created:
    - apps/strapi/src/api/csrm-risk/operations.ts
    - apps/strapi/src/api/csrm-risk/services/risk-workflow.ts
  modified:
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts

key-decisions:
  - "Route every Assessment and contextual Risk write through one shared serialized transaction helper that locks and reloads the ancestor before applying release and first-edit rules."
  - "Resolve RiskType, active owner, information-system, and information-asset document IDs against their exact server-side content types before persistence; caller-supplied relation objects and ancestor fields remain invalid."
  - "Keep Risk responses aligned with the frozen five-field RiskSummary contract while serving RiskType, Control, and active-user picker data through separate closed projections."

patterns-established:
  - "Descendant mutation: exact FunctionAPI policy -> explicit analyst assertion -> closed query/body -> resolve child ancestor -> serialize -> transaction -> ancestor row lock/reload -> release guard -> relation resolution -> write -> shared transition."
  - "Reference picker: exact narrow operation -> explicit analyst assertion -> closed query -> fixed server limit -> allowlisted projection."

requirements-completed: [ASSESS-03]

duration: 14min
completed: 2026-08-30
---

# Phase 4 Plan 15: Parent-Locked Contextual Risk Workflow Summary

**Exact analyst-only contextual Risk routes now allocate RSK identifiers server-side, resolve bounded references, and lock the owning Assessment before every create or direct child update.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-29T23:54:43Z
- **Completed:** 2026-08-30T00:08:45Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- Replaced generic core Risk CRUD with exact `GET/POST /api/v1/risk_assessments/{assessmentId}/risks` and `PATCH /api/v1/risks/{riskId}` workflow operations behind application and exact FunctionAPI policies.
- Covered all 34 frozen writable Risk fields, including both issue and risk statements, enums, dates, boolean exemption state, and five server-resolved relation fields.
- Centralized Assessment metadata and Risk descendant edits through one serialized transaction helper that locks and reloads the ancestor, rejects every partial or complete release fact, and reuses the first accepted edit transition.
- Allocated `RSK-YYYY-XXXXXX` identifiers server-side and rejected caller-owned identifiers, parents, control implementations, workflow/release facts, identities, and audit timestamps.
- Served fixed-limit RiskType, Control, and active-user picker reads through closed projections, with active-only owner search and no generic IAM/admin response shape.
- Proved exact-parent traversal, hostile cross-resource IDs, missing records, invalid values, Requestor/ungranted/inactive/missing actors, direct post-release child writes, and generic Risk CRUD absence through mounted HTTP.

## Task Commits

The TDD task was committed through its required gates:

1. **RED: Add failing contextual Risk workflow contract** - `9f8d384` (test)
2. **GREEN: Mount parent-locked contextual Risk workflow** - `19aa852` (feat)

**Plan metadata:** committed with this summary before sequential tracking updates.

## Files Created/Modified

- `apps/strapi/src/api/csrm-risk/operations.ts` - Names the six exact catalogue-backed Risk and reference operations.
- `apps/strapi/src/api/csrm-risk/services/risk-workflow.ts` - Owns exact-parent traversal, server reference resolution, RSK allocation, and ancestor-locked Risk persistence.
- `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` - Mounts only the six contract-backed contextual Risk/reference routes.
- `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` - Enforces explicit analyst scope, closed inputs, safe errors, and bounded response projections.
- `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` - Exposes the shared serialized ancestor transaction used by Assessment and Risk edits.
- `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` - Adds closed Risk and reference projections plus active-user search validation.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Covers the complete named allowlist, references, hostile parents/fields, transitions, release immutability, actors, and generic-route absence.

## Decisions Made

- Descendant Risk mutation does not duplicate release or transition logic: it uses the Assessment workflow's queue, row lock, authoritative reload, `assertMutableAssessment`, and `transitionForAcceptedEdit` path.
- Direct PATCH resolves Risk to Assessment before serialization, then reloads the child under the locked ancestor and rejects any changed parent before writing.
- The shared catalogue user-search URL is additionally constrained by the controller's explicit analyst decision for this slice; Requestor owner selection remains outside this Risk workflow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The shared harness' direct Risk helper populates RiskType and risk owner but not impacted system, impacted asset, or treatment owner. Mounted creation still exercised all valid relation IDs, while hostile cross-content-type IDs proved exact server-side resolution without expanding plan ownership into the harness.
- The initial invalid-reference assertion targeted a deliberately released aggregate and correctly encountered the ancestor `409` guard first; it was retargeted to the mutable contextual Risk so payload rejection and release rejection remain independently attributable.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: full Strapi suite passed all 57 existing tests and failed only the two new missing Risk/reference capability tests (`404`/`405`).
- GREEN gate: `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 59/59 tests.
- Final full verification after required-field hardening: PASS, 59/59 tests.
- Allowlist audit: PASS, all 34 plan-named writable Risk fields occur in both the parser allowlist and mounted valid mutation contract.
- Catalogue integrity: PASS, authoritative and Strapi bootstrap copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Frozen Risk schema guard: PASS, worktree and HEAD both resolve to Git blob `268bae2de2413ce09dfd68ae2012c1dda9aedf77`.
- Key-link trace: PASS, `risk-workflow.ts` calls `withMutableAssessmentMutation`, whose locked authoritative path invokes `assertMutableAssessment` and `transitionForAcceptedEdit`.
- Test-integrity scan: PASS, no RED sentinel, runner-argument mutation, file-existence guard, skip/todo, conditional assertion bypass, or test early return remains.

## Known Stubs

None.

## Self-Check: PASSED

- All seven created or modified task files exist.
- RED commit `9f8d384` and GREEN commit `19aa852` exist in repository history in the required order.
- All task acceptance criteria and plan-level verification pass without schema, catalogue, dependency, shared-harness, developer-database, ControlImplementation-route, release-route, or Requestor-read changes.

## Next Phase Readiness

- Plan 04-08 can reuse the shared mutable-assessment helper when mounting ControlImplementation descendants.
- Plans 04-09 and 04-13 can consume the exact Risk mutation and picker contracts.
- Plan 04-16 can add release and owner-only Requestor reads while relying on direct Risk writes already failing closed after any partial or complete release fact.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
