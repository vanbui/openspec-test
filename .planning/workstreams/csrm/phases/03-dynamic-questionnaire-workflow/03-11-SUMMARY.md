---
phase: 03-dynamic-questionnaire-workflow
plan: 11
subsystem: questionnaire-dashboard-navigation
tags: [nextjs, server-components, capability-navigation, questionnaire, accessibility]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: owner-scoped Requestor questionnaire discovery and direct detail routes from Plan 03-08
  - phase: 03-dynamic-questionnaire-workflow
    provides: Security Analyst questionnaire inventory and submitted-response review routes from Plan 03-10
provides:
  - Capability-filtered Requestor and analyst questionnaire navigation
  - Owner-scoped Requestor dashboard questionnaire actions with encoded authoritative document IDs
  - Bounded active-questionnaire projection with accessible state, context, progress, and unanswered counts
affects: [03-12, questionnaire-e2e, requestor-dashboard, analyst-navigation]

tech-stack:
  added: []
  patterns: [typed owner-scoped dashboard composition, capability-visible navigation, discriminated dashboard actions]

key-files:
  created: []
  modified:
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/src/features/dashboard/requestor-dashboard-service.ts
    - apps/web/src/features/dashboard/requestor-dashboard.tsx
    - apps/web/src/features/dashboard/requestor-dashboard.test.tsx

key-decisions:
  - "Count active dashboard questionnaires from the owner-scoped status summary while bounding rendered action items to 50 from the owner-scoped list."
  - "Keep request and questionnaire dashboard actions as a discriminated union so each retains its authoritative workflow state and presentation contract."
  - "Expose analyst questionnaire review through assessment:review capability visibility without treating navigation as authorization."

requirements-completed: [QUES-01, QUES-05]

duration: 5min
completed: 2026-08-30
---

# Phase 3 Plan 11: Questionnaire Dashboard and Navigation Summary

**Requestor dashboard actions now use owner-scoped questionnaire records and encoded detail routes, while capability navigation directly exposes both Requestor and analyst questionnaire workflows.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T18:37:44Z
- **Completed:** 2026-08-29T18:42:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced request-status-derived questionnaire dashboard actions with authoritative `listMyQuestionnaires` records and `getMyQuestionnaireSummary` totals from the typed owner-scoped service.
- Added encoded `/app/questionnaires/{documentId}` actions with authoritative title, state, assessment-request context, progress, and unanswered counts while bounding rendered records to 50.
- Added capability-filtered analyst questionnaire navigation at `/app/review/questionnaires` and retained Requestor `My Questionnaires` visibility under its mapped capability.
- Preserved draft-request, released-assessment, loading, empty, error, and permission-denied dashboard behavior with responsive semantic-token presentation.
- Added unconditional regression coverage for capability visibility, authoritative link mapping, request-link rejection, safe failures, and accessible questionnaire context.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify capability navigation and authoritative dashboard links** - `8533b10` (test)
2. **Task 2: Connect questionnaire routes to navigation and the Requestor dashboard** - `6448131` (feat)

## Files Created/Modified

- `apps/web/src/config/navigation/navigation.ts` - Adds the analyst questionnaire route under the existing review capability.
- `apps/web/src/features/dashboard/requestor-dashboard-service.ts` - Composes draft requests with bounded owner-scoped active questionnaire actions and summary totals.
- `apps/web/src/features/dashboard/requestor-dashboard.tsx` - Renders questionnaire state, request context, textual progress, unanswered count, and semantic progress indication.
- `apps/web/src/features/dashboard/requestor-dashboard.test.tsx` - Proves capability reachability, authoritative encoded links, safe service outcomes, and preserved dashboard states.

## Decisions Made

- Active questionnaire totals use `notStarted + draft`; submitted questionnaires remain available through My Questionnaires but do not appear in the dashboard's in-progress widget.
- Dashboard action items are discriminated by `request` or `questionnaire`, preventing request statuses from being reused as questionnaire state.
- Navigation remains a capability-filtered usability surface; Strapi and the typed owner-scoped service remain the authorization and record-scope boundaries.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first GREEN test run exposed a missing `usePathname` mock in the new capability-navigation assertion. The existing test harness was completed with a stable pathname mock, after which the focused and full suites passed.
- pnpm reported Node v22.19.0 through its launcher although Node v24.19.0 is on PATH. Tests, strict typechecking, and generated-contract checks passed; global tooling was not changed.

## Verification Results

- RED verification - PASS: Phase 2 dashboard and Plan 03-08/03-10 route baselines passed before `PHASE3_RED_DASHBOARD_NAVIGATION_WIRING_ABSENT` fired; the old request-derived questionnaire projection also failed the new contract.
- `pnpm --filter @csrm/web test -- src/features/dashboard/requestor-dashboard.test.tsx` - PASS (2/2 tests).
- `pnpm --filter @csrm/web test` - PASS (20 files, 93/93 tests).
- `pnpm --filter @csrm/web typecheck` - PASS.
- `pnpm --filter @csrm/web api:check` - PASS.
- GREEN integrity scan - PASS (no Phase 3 RED sentinel, file-existence guard, `execArgv`, or focused-test escape hatch).
- Frozen questionnaire/question schema diff - PASS (unchanged).
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-12 can exercise Jane's direct dashboard questionnaire link and Bob's capability-visible questionnaire review route in the seeded browser journey.
- No blocker remains for the final Phase 3 end-to-end plan.

## Self-Check: PASSED

- All four modified implementation/test files and this summary exist.
- Task commits `8533b10` and `6448131` are present in repository history.
- Focused and full tests, strict typechecking, generated API parity, schema freeze, catalogue parity, and GREEN integrity checks pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
