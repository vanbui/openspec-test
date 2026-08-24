---
phase: quick-260824-qb2
plan: 01
subsystem: request-workflow
tags: [csrm, strapi, server-actions, draft-persistence, playwright]
requires:
  - phase: 07-requestor-request-workflow
    provides: Trusted request Server Actions and Strapi-backed request workflow.
provides:
  - Complete sanitized requestor draft data is persisted on first save.
  - Real-Strapi reload coverage for the New Request first-save path.
affects: [CSRM-05, request-workflow]
actuals:
  tokens: 3027
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Share one editable-draft API input contract between create and update calls.
key-files:
  created: []
  modified:
    - apps/csrm/src/lib/api/csrm-service.ts
    - apps/csrm/src/features/requests/request-actions.ts
    - apps/csrm/e2e/request-workflow.spec.ts
key-decisions:
  - "New draft creation reuses the update-shaped editable payload and leaves server-owned metadata to Strapi."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: "New Request Save draft sends all sanitized requestor-editable values in its initial POST."
    requirement: CSRM-05
    verification:
      - kind: unit
        ref: apps/csrm/src/features/requests/request-actions.test.ts#forwards every normalized editable field for a new draft
        status: pass
      - kind: unit
        ref: apps/csrm/src/lib/api/csrm-service.test.ts#serializes Phase 7 operations
        status: pass
    human_judgment: false
  - id: D2
    description: "First-saved draft values survive a redirect and reload through real Strapi."
    requirement: CSRM-05
    verification:
      - kind: e2e
        ref: apps/csrm/e2e/request-workflow.spec.ts#Jane persists, submits, withdraws, and discovers a request through real Strapi
        status: pass
    human_judgment: false
duration: 4 min
completed: 2026-08-24
status: complete
---

# Quick Task 260824-qb2: Complete New Request Draft Persistence Summary

**The initial New Request Save draft now sends every sanitized editable field to Strapi and reloads that persisted data before the request can be submitted.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-24T09:02:00Z
- **Completed:** 2026-08-24T09:06:17Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Replaced the title-only create payload with the same complete editable draft contract used by updates.
- Retained the explicit Server Action form parser, preventing forged actor, owner, request number, status, submission, transition, and capability fields from reaching Strapi.
- Added unit serialization coverage and a real-Strapi redirect/reload regression covering all form sections and available catalogue selections.

## Task Commits

1. **Task 1 RED: Complete draft payload regression coverage** - `cef9178` (test)
2. **Task 1 GREEN: Persist complete new request drafts** - `5e0fea7` (fix)

## Files Created/Modified

- `apps/csrm/src/lib/api/csrm-service.ts` - Shares the complete editable-draft input contract between create and update calls.
- `apps/csrm/src/lib/api/csrm-service.test.ts` - Asserts full POST payload serialization.
- `apps/csrm/src/features/requests/request-actions.ts` - Forwards the sanitized `saveInput` value for new drafts.
- `apps/csrm/src/features/requests/request-actions.test.ts` - Covers normalized editable fields and forged-field exclusion on creation.
- `apps/csrm/e2e/request-workflow.spec.ts` - Verifies first-save values survive a real Strapi redirect and reload.

## Decisions Made

- Reused the update-shaped editable payload for creation; Strapi remains the authority for requestor, request number, workflow status, and submission date.

## Verification

- PASS: `yarn workspace @idambox/csrm test src/features/requests/request-actions.test.ts src/lib/api/csrm-service.test.ts`
- PASS: `yarn workspace @idambox/csrm test:e2e request-workflow.spec.ts --grep "Jane persists, submits, withdraws, and discovers a request through real Strapi"`
- PASS: `git diff --check cef9178^ HEAD`
- BLOCKED OUT OF SCOPE: `yarn workspace @idambox/csrm verify` reaches unrelated failing capability-count assertions in `src/config/capabilities.test.ts` and `src/lib/fixtures/resolve-identity.test.ts`; they expect 23 capabilities while the committed catalogue exposes 27.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The broad CSRM verification suite has three pre-existing capability-count failures unrelated to this draft-persistence change. Focused unit and real-stack regression checks pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The New Request initial-save path now preserves the complete editable draft state. Resolve the unrelated capability-count expectations before treating the broad `verify` command as green.

## Self-Check: PASSED

- Confirmed both TDD commits exist in git history.
- Confirmed the five plan files are present and committed.
