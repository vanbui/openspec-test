---
phase: 03-dynamic-questionnaire-workflow
plan: 01
subsystem: testing
tags: [playwright, e2e, strapi, nextjs, accessibility, questionnaire-workflow]

requires:
  - phase: 02-requestor-risk-assessment-request-workflow
    provides: Development fixture identities, authorised application shell, and isolated dual-server Playwright harness
provides:
  - Executable RED browser contract for the Requestor questionnaire workflow
  - Cross-session Security Analyst read-only review contract
  - Responsive, keyboard, validation-focus, and axe accessibility assertions
affects: [03-06-questionnaire-seed, 03-08-requestor-discovery, 03-09-questionnaire-renderer, 03-10-analyst-review, 03-12-green-e2e]

tech-stack:
  added: []
  patterns: [baseline-gated RED sentinel, mounted dual-server browser acceptance, shared outcome-level accessibility checks]

key-files:
  created: [apps/web/e2e/questionnaire-workflow.spec.ts]
  modified: []

key-decisions:
  - "Emit the Phase 3 RED sentinel only after Strapi health, fixture sign-in, shell, responsive, keyboard, and existing navigation baselines pass."
  - "Keep the PHASE3_RED sentinel confined to Plan 03-01 and require Plan 03-12 to remove the escape hatch when the journey turns GREEN."

patterns-established:
  - "Questionnaire E2E traceability: observable assertions carry QUES-01 through QUES-05 identifiers."
  - "Cross-role browser workflow: clear the Requestor session, sign in as the analyst fixture, and verify the same submitted answer without edit controls."

requirements-completed: [QUES-01, QUES-02, QUES-03, QUES-04, QUES-05]

duration: 4min
completed: 2026-08-30
---

# Phase 3 Plan 1: Questionnaire Workflow RED Contract Summary

**Baseline-gated Playwright contract for Requestor discovery, conditional draft/resume, validated submission, and Security Analyst read-only review**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T16:40:05Z
- **Completed:** 2026-08-29T16:44:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Encoded the complete Jane-to-Bob browser outcome across authorised questionnaire discovery, conditional response entry, draft persistence, invalid and confirmed submission, and authoritative analyst review.
- Added 375px and 1440px overflow checks, keyboard focus assertions, linked validation focus, and serious/critical axe checks at key workflow states.
- Proved the mounted Strapi and Next.js run reaches exactly `PHASE3_RED_E2E_MISSING_QUESTIONNAIRE_WORKFLOW` after all infrastructure, authentication, shell, and navigation baselines pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-06: Write the failing Requestor-to-analyst questionnaire journey** - `9df5fef` (test)

## Files Created/Modified

- `apps/web/e2e/questionnaire-workflow.spec.ts` - Full-stack RED-to-GREEN acceptance contract for QUES-01 through QUES-05.

## Decisions Made

- Used a stable seeded questionnaire title and accessible labels as user-visible contract anchors while leaving document IDs server-owned.
- Kept the deliberate `PHASE3_RED_E2E_MISSING_QUESTIONNAIRE_WORKFLOW` escape hatch only in this RED plan. Plan 03-12 must remove it and run the same assertions GREEN; weakening or bypassing the assertions is not acceptable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

- RED is genuine and committed in `9df5fef`: test discovery and TypeScript pass, while the isolated mounted run fails only at the deliberate Phase 3 sentinel.
- This plan intentionally ends at RED. The GREEN implementation and sentinel removal are owned by Plan 03-12, so no `feat(03-01)` commit is expected.

## Known Stubs

- `apps/web/e2e/questionnaire-workflow.spec.ts:66` contains the intentional RED-only sentinel. It does not bypass assertions: it fires only after baseline checks pass and must be removed by Plan 03-12 when the workflow exists.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-02 through 03-11 can implement the locked contract without changing its outcome assertions.
- Plan 03-12 owns the GREEN dual-server run and removal of the explicit RED sentinel wrapper.

## Self-Check: PASSED

- Found `apps/web/e2e/questionnaire-workflow.spec.ts`.
- Found task commit `9df5fef`.
- TypeScript, Playwright discovery, QUES-01 through QUES-05 traceability, catalogue copy parity, and expected-RED attribution all passed.
- No unplanned production threat surface or non-RED stubs were introduced.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
