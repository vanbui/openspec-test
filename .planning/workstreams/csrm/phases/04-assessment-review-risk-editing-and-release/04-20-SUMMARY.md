---
phase: 04-assessment-review-risk-editing-and-release
plan: "20"
subsystem: web
tags: [nextjs, server-actions, zod, accessibility, combobox, authorization]
requires:
  - phase: 04-19
    provides: bounded active-user search transport and persisted owner labels
provides:
  - validated authorised active-user Server Action
  - reusable debounced accessible owner picker
affects: [assessment-review, risk-editing, control-implementation-editing]
tech-stack:
  added: []
  patterns: [strict server action boundary, injected client search callback, stale-response suppression]
key-files:
  created: [apps/web/src/features/assessments/owner-combobox.tsx, apps/web/src/features/assessments/owner-combobox.test.tsx]
  modified: [apps/web/src/features/assessments/assessment-actions.ts, apps/web/src/features/assessments/assessment-actions.test.ts, apps/web/src/features/assessments/assessment-service.ts, apps/web/src/features/assessments/assessment-service.test.ts]
key-decisions:
  - "Owner search is injected into the Client Component and remains behind the validated Server Action."
  - "Persisted selected owners stay independent of transient active-user search results."
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 3min
completed: 2026-08-30
---

# Phase 04 Plan 20: Safe Owner Search and Combobox Foundation Summary

**Validated active-user searches now pass through a Server Action into a debounced accessible owner combobox that retains persisted owner labels.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-30T15:32:52+10:00
- **Completed:** 2026-08-30T15:35:45+10:00
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Added strict bounded owner-search action validation with safe non-disclosing errors and a typed service result.
- Enforced the 20-result active picker cap while preserving server-authoritative persisted owner labels through assessment detail.
- Built a callback-injected shadcn Popover/Command combobox with debounce, keyboard and pointer selection, stale-result protection, retry, and optional clear.

## Task Commits

1. **Task 1: Define the typed owner-search service and Server Action contract** — `41599a7` (test), `5583259` (feat)
2. **Task 2: Build the standalone accessible debounced owner combobox** — `059dfbb` (test), `1e6234f` (feat)

## Decisions Made

- Owner search remains a Server Action callback contract; the client component imports neither the service nor the action.
- The active picker only handles transient authorised results; a selected persisted owner remains visible even if inactive or outside the current capped result set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical boundary cap] Enforced the 20-result active-user response cap in the typed web parser**
- **Found during:** Task 1
- **Issue:** The generic list parser allowed up to 10,000 ActiveUser records despite the bounded 04-19 picker contract.
- **Fix:** Replaced it with a closed 20-item response schema and added a failing-over-cap test.
- **Files modified:** `assessment-service.ts`, `assessment-service.test.ts`
- **Verification:** Focused service/action tests and strict TypeScript passed.
- **Commit:** `5583259`

**2. [Rule 3 - Blocking test runtime support] Added local DOM shims for existing cmdk primitives**
- **Found during:** Task 2
- **Issue:** jsdom does not implement `ResizeObserver` or `scrollIntoView`, both required by the existing Command primitive.
- **Fix:** Scoped lightweight shims to the new component test without altering production behavior or shared test configuration.
- **Files modified:** `owner-combobox.test.tsx`
- **Verification:** Focused combobox test passed with no unhandled runtime errors.
- **Commit:** `1e6234f`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3). No scope expansion or dependency change.

## Verification

- `pnpm test -- src/features/assessments/owner-combobox.test.tsx src/features/assessments/assessment-actions.test.ts src/features/assessments/assessment-service.test.ts` — passed (35 tests)
- `pnpm typecheck` — passed
- Confirmed `owner-combobox.tsx` has no assessment service or action import.
- `git diff --check` — passed

## Known Stubs

None.

## Issues Encountered

The legacy Phase 4 state counters cannot be parsed by the SDK's advance-plan, progress, metric, or decision handlers. Session recording and roadmap plan-progress updates succeeded; no project state was manually rewritten.

## Next Phase Readiness

The owner-selection primitive is ready for later assessment editor wiring while retaining Strapi as the authorised production API boundary.

## Self-Check: PASSED

- Confirmed task commits `41599a7`, `5583259`, `059dfbb`, and `1e6234f` exist.
- Confirmed all six plan files exist and focused verification passes.
