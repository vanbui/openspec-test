---
phase: 03-dynamic-questionnaire-workflow
plan: 10
subsystem: questionnaire-analyst-review
tags: [nextjs, server-components, accessibility, authorization, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: explicit typed analyst questionnaire services and submitted-only Strapi answer projection from Plan 03-07
  - phase: 03-dynamic-questionnaire-workflow
    provides: responsive Requestor questionnaire discovery patterns from Plan 03-08
  - phase: 03-dynamic-questionnaire-workflow
    provides: shared edit/read-only QuestionnaireRenderer from Plan 03-09
provides:
  - Direct Security Analyst questionnaire inventory and detail routes using explicit typed analyst services
  - Submitted-only response review through the shared QuestionnaireRenderer read-only mode
  - Accessible responsive loading, empty, error, permission, awaiting-submission, and submitted states
affects: [03-11, 03-12, analyst-navigation, questionnaire-e2e]

tech-stack:
  added: []
  patterns: [submitted-state-before-answer-fetch, shared read-only renderer composition, content-discarding safe states]

key-files:
  created:
    - apps/web/src/features/questionnaires/questionnaire-review-list.tsx
    - apps/web/src/features/questionnaires/questionnaire-review.tsx
    - apps/web/app/(app)/app/review/questionnaires/page.tsx
    - apps/web/app/(app)/app/review/questionnaires/loading.tsx
    - apps/web/app/(app)/app/review/questionnaires/error.tsx
    - apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx
    - apps/web/app/(app)/app/review/questionnaires/[documentId]/loading.tsx
    - apps/web/app/(app)/app/review/questionnaires/[documentId]/error.tsx
  modified:
    - apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx

key-decisions:
  - "Check the authoritative questionnaire state before requesting questions so analyst detail routes never request or compose draft answers."
  - "Represent not-started and draft inventory records as awaiting submission while reserving ready-for-review status for submitted records."
  - "Discard questionnaire and definition props in every non-submitted detail state, even if a caller supplies them."

requirements-completed: [QUES-05]

duration: 6min
completed: 2026-08-30
---

# Phase 3 Plan 10: Analyst Questionnaire Review Summary

**Security Analysts can now discover questionnaire work and review authoritative submitted responses through the same read-only renderer used by Requestors, with drafts masked before they cross the page boundary.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T18:27:14Z
- **Completed:** 2026-08-29T18:32:59Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added responsive analyst questionnaire inventory cards with direct encoded review links, explicit awaiting/ready status, request context, and accessible loading, empty, error, and permission feedback.
- Added server-owned analyst inventory and detail routes using only `listQuestionnairesForReview`, `getQuestionnaire`, and `getQuestionnaireQuestions` from the typed service layer.
- Prevented draft answer leakage by checking authoritative submission state before loading definitions or answers and by discarding supplied data in all non-submitted presentation states.
- Composed submitted answers through the existing `QuestionnaireRenderer` with the exact normalized definition, document ID, and `read-only` mode; no analyst mutation controls or parallel renderer were introduced.
- Added unconditional component and route-boundary coverage for analyst discovery, direct reachability, safe states, submitted-only rendering, and absence of save/submit controls.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-05B: Specify analyst states and shared rendering** - `f32a09a` (test)
2. **Task 2: Build shared analyst discovery and read-only review** - `018df1b` (feat)

## Files Created/Modified

- `apps/web/src/features/questionnaires/questionnaire-review-list.tsx` - Analyst inventory cards and safe five-state list presentation.
- `apps/web/src/features/questionnaires/questionnaire-review.tsx` - Submitted-only analyst detail composition through the shared renderer.
- `apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx` - Eleven unconditional Requestor and analyst workflow contracts.
- `apps/web/app/(app)/app/review/questionnaires/page.tsx` - Typed analyst questionnaire inventory Server Component.
- `apps/web/app/(app)/app/review/questionnaires/loading.tsx` - Layout-matched analyst inventory loading state.
- `apps/web/app/(app)/app/review/questionnaires/error.tsx` - Recoverable analyst inventory error boundary.
- `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx` - Submitted-state-gated analyst detail Server Component.
- `apps/web/app/(app)/app/review/questionnaires/[documentId]/loading.tsx` - Layout-matched analyst detail loading state.
- `apps/web/app/(app)/app/review/questionnaires/[documentId]/error.tsx` - Recoverable analyst detail error boundary.

## Decisions Made

- Authoritative submission state is resolved before the detail route requests question projections; draft and not-started records render only the waiting state.
- Analyst inventory remains useful for all authorised questionnaire states, but only submitted records receive the ready-for-review label and answer-rendering path.
- Safe detail states do not retain or render questionnaire metadata or definition props, making disclosure prevention explicit in the presentation boundary as well as Strapi.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan referenced an older Next.js server-components documentation path. The installed version's authoritative replacement, `01-app/01-getting-started/05-server-and-client-components.md`, was read before implementation.
- pnpm reported Node v22.19.0 through its launcher although Node v24.19.0 is on PATH. The full tests, strict typecheck, and generated-contract checks passed; global tooling was not changed.

## Verification Results

- RED verification - PASS: all five Requestor baselines passed and all five new analyst scenarios failed only with `PHASE3_RED_W0_05_ANALYST_REVIEW_ABSENT`.
- `pnpm --filter @csrm/web test` - PASS (20 files, 92/92 tests).
- `pnpm --filter @csrm/web typecheck` - PASS.
- `pnpm --filter @csrm/web api:check` - PASS.
- Shared renderer implementation scan - PASS (exactly one exported `QuestionnaireRenderer`).
- GREEN integrity scan - PASS (no Phase 3 RED sentinel, file-existence guard, `execArgv`, focused test, or early-return escape hatch).
- Analyst surface scan - PASS (no raw fetch, mutation action, Phase 4 review operation, or parallel renderer).
- Frozen questionnaire/question schema diff - PASS (unchanged).
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`).

## Known Stubs

None.

## Next Phase Readiness

- Plan 03-11 can expose the new analyst inventory through capability-filtered navigation and dashboard integration.
- Plan 03-12 can exercise Bob's direct submitted-response review through the seeded end-to-end journey.
- No blocker remains for subsequent Phase 3 plans.

## Self-Check: PASSED

- All nine created or modified implementation/test files and this summary exist.
- Task commits `f32a09a` and `018df1b` are present in repository history.
- Full tests, strict typecheck, generated API parity, renderer uniqueness, GREEN integrity, schema freeze, and catalogue parity pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
