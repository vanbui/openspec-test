---
phase: 04-assessment-review-risk-editing-and-release
plan: "10"
subsystem: ui
tags: [nextjs, react-suspense, server-components, polling, accessibility, vitest]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: strict analyst assessment services, draft-job actions, and separate review DTOs
provides:
  - Suspense-backed analyst request and assessment review routes with concrete responsive skeletons
  - Deliberate empty, permission, not-found, and transport failure outcomes
  - Single-flight bounded draft-job polling with accessible transitions and failed-only retry
affects: [04-11, 04-12, 04-13, 04-14, phase-04-e2e]

tech-stack:
  added: []
  patterns: [synchronous route shell with async Suspense child, bounded client-island polling, typed review-service composition]

key-files:
  created:
    - apps/web/src/features/assessments/assessment-list.tsx
    - apps/web/src/features/assessments/assessment-detail.tsx
    - apps/web/src/features/assessments/assessment-draft-job.tsx
    - apps/web/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/web/app/(app)/app/review/requests/page.tsx
    - apps/web/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/web/app/(app)/app/review/assessments/page.tsx
  modified: []

key-decisions:
  - "Keep each review route shell synchronous and place every typed service read inside a named async child under an explicit concrete Suspense fallback."
  - "Bound draft-job observation to one request in flight, one-second cadence, and a 30-second client budget while preserving the server-owned job as authority."
  - "Compose request detail with the authorised questionnaire review inventory so draft generation receives the opaque questionnaire identifier without raw UI transport."

patterns-established:
  - "Review loading: synchronous App Router page -> Suspense skeleton -> async typed-service child -> deliberate resolved state."
  - "Job lifecycle: start once -> scheduled single-flight poll -> terminal/timeout/unmount cleanup -> failed-only retry."

requirements-completed: [ASSESS-01, ASSESS-02]

duration: 11min
completed: 2026-08-30
---

# Phase 4 Plan 10: Analyst Review and Draft Job UI Summary

**Responsive analyst review queues now stream concrete Suspense skeletons and lead into a single-flight, 30-second-bounded deterministic draft assistant that never releases an assessment.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-30T01:10:41Z
- **Completed:** 2026-08-30T01:20:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added synchronous request-list, request-detail, and assessment-list route shells whose async typed-service reads sit below explicit responsive Suspense skeletons.
- Delivered mobile cards and desktop tables with encoded opaque-ID navigation plus deliberate empty, permission, not-found, and transport failure handling.
- Added deterministic draft assistance with duplicate-start prevention, one in-flight poll, one-second cadence, terminal/unmount/job-change cleanup, 30-second timeout recovery, failed-only retry, and one polite live region.
- Kept draft output explicitly reviewable and advisory; completion links to analyst review and cannot trigger release.

## Task Commits

Each TDD task was committed through its required gates:

1. **Task 1 RED: Specify analyst review loading states** - `e9eec7a` (test)
2. **Task 1 GREEN: Add Suspense-backed analyst review pages** - `f7871fe` (feat)
3. **Task 2 RED: Specify bounded draft-job lifecycle** - `f90c8e2` (test)
4. **Task 2 GREEN: Add bounded assessment draft polling** - `3469668` (feat)

## Files Created/Modified

- `apps/web/src/features/assessments/assessment-list.tsx` - Responsive analyst request and assessment collections, concrete skeletons, and deliberate resolved states.
- `apps/web/src/features/assessments/assessment-detail.tsx` - Submitted request context, shared questionnaire navigation, safe detail states, and draft-job placement.
- `apps/web/src/features/assessments/assessment-draft-job.tsx` - Accessible single-flight bounded polling client island.
- `apps/web/src/features/assessments/assessment-review-workflow.test.tsx` - Deferred loading-state, responsive state, timer cleanup, timeout, retry, announcement, and navigation coverage.
- `apps/web/app/(app)/app/review/requests/page.tsx` - Suspense-backed analyst request queue route.
- `apps/web/app/(app)/app/review/requests/[documentId]/page.tsx` - Suspense-backed request/questionnaire detail composition.
- `apps/web/app/(app)/app/review/assessments/page.tsx` - Suspense-backed analyst assessment queue route.

## Decisions Made

- Route-level metadata and headers remain stable while only the service-reading child suspends, preventing blank whole-page loading transitions.
- Polling state is local to the smallest Client Component island; request/detail collections remain Server Components and all operations pass through existing typed actions and services.
- The poller announces only meaningful lifecycle changes and keeps visible state text/icons so status never depends on colour.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired draft assistance into authorised request detail**
- **Found during:** Task 2 (Build the bounded deterministic draft-job client island)
- **Issue:** Creating the island without placing it in request detail would leave Bob unable to start or observe a draft from the delivered review workflow.
- **Fix:** Embedded the island in `AssessmentDetail` and composed the request detail read with the existing typed questionnaire review service to resolve its opaque questionnaire identifier.
- **Files modified:** `apps/web/src/features/assessments/assessment-detail.tsx`, `apps/web/app/(app)/app/review/requests/[documentId]/page.tsx`
- **Verification:** Focused workflow tests, full web suite, and strict TypeScript all pass.
- **Committed in:** `3469668`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** The adjustment completed the planned end-to-end review-to-draft path without adding an API, dependency, authorization decision, or raw fetch.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused assessment review workflow: PASS, 12/12 tests.
- Full web Vitest suite: PASS, 138/138 tests across 23 files.
- Strict TypeScript: PASS with `pnpm typecheck`.
- Generated API drift: PASS with `pnpm api:check`; the frozen specification and generated client remain aligned.
- Frozen contract/model guard: PASS, no `schema.json` or `docs/references/specification.json` change.
- Catalogue integrity: PASS, authoritative and bootstrap copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Boundary scan: PASS, no raw fetch, client role check, hard-coded brand colour, dependency, or release action was introduced.
- Test integrity: PASS, no skips, todos, RED sentinel, runner-argument mutation, file guard, conditional assertion bypass, or test early return remains.

## Known Stubs

None.

## Self-Check: PASSED

- All seven plan-owned implementation/test files exist.
- All four RED/GREEN task commits exist in repository history in the required order.
- All plan verification and success criteria pass with frozen schemas, byte-identical catalogues, and advisory-only draft assistance.

## Next Phase Readiness

- Plans 04-11 through 04-14 can build the assessment editor, release interaction, and end-to-end journey on the analyst review and bounded-job surfaces.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
