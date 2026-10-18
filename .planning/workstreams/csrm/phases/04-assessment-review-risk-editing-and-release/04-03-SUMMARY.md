---
phase: 04-assessment-review-risk-editing-and-release
plan: "03"
subsystem: api
tags: [strapi, domain-validation, secure-identifiers, assessment-release, tdd]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: composite release contract, closed mutation DTOs, and frozen Risk/ControlImplementation field inventories from Plan 02
provides:
  - Shared cryptographically secure RAR, ASM, and RSK identifier allocation with bounded unique-only retry
  - Pure fail-closed assessment release, mutability, transition, and readiness rules
  - Positive assessment, Risk, and ControlImplementation mutation allowlists with closed validation
affects: [04-04, 04-06, 04-07, 04-08, 04-15, 04-16]

tech-stack:
  added: []
  patterns: [prefix-parameterized Crockford identifiers, fail-closed composite release facts, positive mutation allowlists, path-addressed readiness results]

key-files:
  created:
    - apps/strapi/tests/assessment-workflow.unit.test.ts
    - apps/strapi/src/api/csrm-assessment-request/services/domain-number.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-number.ts
    - apps/strapi/src/api/csrm-risk/services/risk-number.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
  modified:
    - apps/strapi/src/api/csrm-assessment-request/services/request-number.ts

key-decisions:
  - "Recognize identifier collisions by the specific owned field so unrelated unique constraints propagate immediately."
  - "Treat any incomplete release fact as immutable and non-released; only the valid complete triple is released."
  - "Reject unknown and server-owned mutation keys instead of silently accepting or persisting them."
  - "Return exact missing-field paths from release readiness so later server and UI consumers share one checklist contract."

patterns-established:
  - "Domain number allocation: crypto bytes plus UTC Crockford format, field-specific collision classifier, and one shared five-attempt loop."
  - "Assessment aggregate validation: pure release/transition/readiness rules and closed parsers remain independent of controllers and persistence."

requirements-completed: [ASSESS-03, ASSESS-04, ASSESS-05]

duration: 9min
completed: 2026-08-30
---

# Phase 4 Plan 3: Assessment Domain Rules and Secure Identifiers Summary

**Shared secure RAR/ASM/RSK allocation plus one fail-closed assessment contract for review transitions, release readiness, ratings, and aggregate mutation boundaries.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-29T22:26:51Z
- **Completed:** 2026-08-29T22:36:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Generalized the existing RAR generator without changing its public contract, then added ASM and RSK helpers over the same cryptographically secure UTC Crockford implementation.
- Encoded all eight release-fact combinations, immutable partial facts, exact first-edit transitions, one-time reviewer ownership, and the complete release-readiness checklist.
- Added exact assessment, Risk, and ControlImplementation writable parsers that validate ratings, enums, dates, booleans, and relation identifiers while rejecting parent, workflow, release, identity, and audit ownership.
- Added exhaustive unit coverage alongside the existing request-number regression suite through genuine RED and GREEN commits.

## Task Commits

Each TDD task was committed through separate RED and GREEN gates:

1. **Task 1 RED: Generalize secure ASM and RSK identifiers** - `7a5f3c4` (test)
2. **Task 1 GREEN: Generalize secure ASM and RSK identifiers** - `d1efd05` (feat)
3. **Task 2 RED: Encode release, transition, readiness, and mutation allowlists** - `4ae27c6` (test)
4. **Task 2 GREEN: Encode release, transition, readiness, and mutation allowlists** - `311e5de` (feat)

**Plan metadata:** committed separately with this summary and sequential tracking updates.

## Files Created/Modified

- `apps/strapi/tests/assessment-workflow.unit.test.ts` - Exhaustive identifier, release-fact, transition, readiness, rating, allowlist, and hostile-input contracts.
- `apps/strapi/src/api/csrm-assessment-request/services/domain-number.ts` - Shared secure generation, field-specific collision recognition, and bounded allocation loop.
- `apps/strapi/src/api/csrm-assessment-request/services/request-number.ts` - Preserves RAR exports while delegating to the generalized implementation.
- `apps/strapi/src/api/csrm-assessment/services/assessment-number.ts` - ASM generation and unique-conflict allocation wrapper.
- `apps/strapi/src/api/csrm-risk/services/risk-number.ts` - RSK generation and unique-conflict allocation wrapper.
- `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` - Pure release, mutability, transition, readiness, rating, and mutation validation contract.

## Decisions Made

- Unique-conflict retry requires both recognizable uniqueness evidence and the exact owned field name; collisions on other database fields are never retried.
- A partial release aggregate is not a draft state: any present release fact blocks mutation, while visibility still requires the complete valid triple.
- Writable parsers use exact positive key sets and reject hostile extras, ensuring controllers cannot accidentally pass server-owned facts through to Strapi.
- Readiness returns stable missing paths such as `risks[0].targetDate`, including Treat-specific nested Control requirements, for reuse without duplicating business logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled position and percentage fields unsupported by the installed state handlers**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` could not parse the frontmatter-first state format, and `state.update-progress` wrote the phase summary percentage instead of milestone-wide completion.
- **Fix:** Retained the successful handler updates for metrics, decisions, session, roadmap, and requirements, then reconciled Plan 4, 37/50 completed plans (74%), and the Plan 04-04 next action.
- **Files modified:** `.planning/STATE.md`
- **Verification:** State records `current_plan: 4`, `completed_plans: 37`, `percent: 74`, and `Stopped At: Completed 04-03-PLAN.md`; ROADMAP records 3/16 Phase 4 plans executed.
- **Committed in:** plan tracking commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Sequential tracking was restored without changing production behavior or widening scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test` in `apps/strapi`: PASS, 40/40 tests under Node 24.19.0.
- Focused compiled unit plus request-number regression run: PASS, 14/14 tests.
- TDD history check: PASS, each RED test commit precedes its corresponding GREEN implementation commit.
- Catalogue SHA-256 comparison: PASS, both copies remain byte-identical.
- Frozen content-type schema diff guard: PASS, no `schema.json` changes.
- Stub scan: PASS, no TODO/FIXME/placeholder or unwired production values.
- Threat-surface scan: PASS, no route, network, authorization, schema, or file-access surface was added.

## Known Stubs

None.

## Self-Check: PASSED

- All six created/modified implementation and test files exist.
- Task commits `7a5f3c4`, `d1efd05`, `4ae27c6`, and `311e5de` exist in repository history.
- Every task acceptance criterion and the plan-level verification command passed.

## Next Phase Readiness

- Later assessment generation, metadata, Risk, ControlImplementation, and release routes can import one deterministic domain contract rather than duplicate state or validation rules.
- No unresolved blocker or schema change is required for the remaining Phase 4 persisted workflow plans.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
