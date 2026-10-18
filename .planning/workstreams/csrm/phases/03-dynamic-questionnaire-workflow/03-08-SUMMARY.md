---
phase: 03-dynamic-questionnaire-workflow
plan: 08
subsystem: questionnaire-requestor-discovery
tags: [nextjs, server-components, accessibility, responsive-ui, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: owner-scoped typed questionnaire inventory service and bounded questionnaire summary projection from Plan 03-07
provides:
  - Direct Requestor My Questionnaires route backed only by the owner-scoped typed service
  - Responsive accessible populated, loading, empty, error, and permission-denied presentation states
  - Capability-filtered My Questionnaires navigation with encoded detail links
affects: [03-09, 03-12, questionnaire-renderer, requestor-navigation]

tech-stack:
  added: []
  patterns: [server-loaded closed UI state, semantic responsive card list, capability-visible navigation]

key-files:
  created:
    - apps/web/src/features/questionnaires/questionnaire-list.tsx
    - apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx
    - apps/web/app/(app)/app/questionnaires/page.tsx
    - apps/web/app/(app)/app/questionnaires/loading.tsx
    - apps/web/app/(app)/app/questionnaires/error.tsx
  modified:
    - apps/web/src/config/navigation/navigation.ts

key-decisions:
  - "Reuse assessment-request:read for questionnaire navigation visibility because Requestor questionnaire access is owner-scoped by Strapi and navigation is not authorization."
  - "Keep the discovery presentation server-compatible and reserve client behavior for the route error boundary retry."
  - "Render questionnaire state, answered progress, and unanswered count as explicit text and icons so meaning never depends on color."

requirements-completed: [QUES-01]

duration: 3min
completed: 2026-08-30
---

# Phase 3 Plan 8: Requestor Questionnaire Discovery Summary

**Requestors now have a directly reachable, owner-scoped My Questionnaires page with encoded detail links and accessible responsive feedback across all five route states.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-29T18:05:30Z
- **Completed:** 2026-08-29T18:08:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a Server Component route that calls only `listMyQuestionnaires` and maps its bounded transport result to populated, empty, error, or permission-safe presentation.
- Added single-column mobile and two-column desktop questionnaire cards with request context, encoded detail destinations, text-and-icon state, semantic progress, and unanswered counts.
- Added layout-matched loading skeletons, a useful empty-state route, recoverable errors, and a permission state that receives and reveals no questionnaire, request, or answer content.
- Added My Questionnaires to capability-filtered primary and mobile navigation without treating visibility as authorization.
- Added an unconditional five-test component contract covering the five states, responsive structure, safe denial, direct navigation, and the typed service boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-05A: Specify My Questionnaires states and safe projection** - `00cb9a3` (test)
2. **Task 2: Build owner-scoped My Questionnaires discovery** - `442c53a` (feat)
3. **Verification hardening: Prove denied states discard supplied records** - `487b804` (test)

## Files Created/Modified

- `apps/web/src/features/questionnaires/questionnaire-list.tsx` - Responsive five-state questionnaire discovery cards and safe feedback states.
- `apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx` - Unconditional component, route-boundary, and navigation coverage.
- `apps/web/app/(app)/app/questionnaires/page.tsx` - Requestor Server Component using the owner-scoped typed service.
- `apps/web/app/(app)/app/questionnaires/loading.tsx` - Route-level list-shaped loading state.
- `apps/web/app/(app)/app/questionnaires/error.tsx` - Route error boundary with retry behavior.
- `apps/web/src/config/navigation/navigation.ts` - Capability-filtered My Questionnaires destination.

## Decisions Made

- Questionnaire navigation shares the existing `assessment-request:read` usability capability; Strapi remains responsible for owner scope and record authorization.
- Questionnaire document IDs are treated as opaque and encoded before becoming route segments.
- Derived unanswered counts live in a presentation helper outside JSX, while the authoritative answered, total, percent, and state values come from the closed typed service projection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical verification] Exercised permission denial with record data present**
- **Found during:** Final threat-model verification
- **Issue:** The original denial assertion used an empty collection, so it did not prove the presentation discarded questionnaire data if supplied alongside the denied state.
- **Fix:** Rerendered the permission state with a complete questionnaire projection and retained negative assertions for questionnaire title, request title, and progress.
- **Files modified:** `apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx`
- **Verification:** Focused workflow tests pass 5/5 under the plain pnpm test command.
- **Commit:** `487b804`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical security verification).
**Impact on plan:** Test strength increased; production behavior and architecture are unchanged.

## Issues Encountered

- The plan referenced an older Next.js documentation path. The installed version's authoritative replacement, `01-app/01-getting-started/05-server-and-client-components.md`, was read before implementation.
- pnpm reported Node v22.19.0 through its launcher although Node v24.19.0 is on PATH. Focused tests, strict typechecking, and generated-contract checks all passed; global tooling was not changed.

## Verification Results

- `cd apps/web; pnpm test -- src/features/questionnaires/questionnaire-workflow.test.tsx` - PASS (5/5 tests, unconditional GREEN execution).
- `pnpm --filter @csrm/web typecheck` - PASS.
- `pnpm --filter @csrm/web api:check` - PASS.
- Owner-scoped typed service link and absence of page-level raw fetch - PASS.
- Five presentation states, safe permission content, encoded links, semantic progress/state, responsive grid, and capability navigation - PASS.
- GREEN test-integrity scan - PASS (no Phase 3 RED sentinel, missing-module wrapper, file guard, execArgv gate, focused-test gate, or early-return escape hatch).
- Frozen questionnaire/question schema diff - PASS (no changes).
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`).

## Known Stubs

None.

## Next Phase Readiness

- Plan 03-09 can attach the shared questionnaire renderer to the encoded detail destinations created here.
- Plan 03-12 can exercise direct Requestor discovery through the seeded owner-scoped list.
- No blocker remains for subsequent Phase 3 plans.

## Self-Check: PASSED

- All six created or modified implementation/test files and this summary exist.
- Task commits `00cb9a3`, `442c53a`, and `487b804` are present in repository history.
- Focused tests, strict typechecking, generated API parity, schema freeze, catalogue parity, and GREEN integrity checks pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
