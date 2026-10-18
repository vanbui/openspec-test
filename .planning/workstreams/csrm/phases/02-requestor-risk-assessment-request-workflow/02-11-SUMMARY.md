---
phase: 02-requestor-risk-assessment-request-workflow
plan: 11
subsystem: ui
tags: [react, accessibility, shadcn-ui, semantic-tokens, vitest, sonner]

requires:
  - phase: 01-monorepo-foundation-and-secure-application-shell
    provides: Semantic design tokens and shadcn/ui primitives
  - phase: 02-requestor-risk-assessment-request-workflow
    provides: Persisted assessment-request status contract and shared component patterns
provides:
  - Closed icon-and-label presentation mapping for every persisted request status
  - Focus-managed irreversible submission confirmation with pending repeat lock
  - One application-root notification provider
affects: [request-list, request-detail, request-submission, workflow-notifications]

tech-stack:
  added: []
  patterns: [closed status presentation maps, promise-aware confirmation controls, root notification provider]

key-files:
  created:
    - apps/web/src/components/csrm/status-badge.tsx
    - apps/web/src/components/csrm/confirm-dialog.tsx
    - apps/web/src/components/csrm/feedback-composites.test.tsx
  modified:
    - apps/web/app/layout.tsx

key-decisions:
  - "Mirror the persisted request-status enumeration in a closed TypeScript presentation map so missing status feedback fails at compile time."
  - "Keep normalized mutation failure feedback caller-owned while ConfirmDialog retains focus and remains open for retry."

patterns-established:
  - "Workflow status is always communicated with a sentence-case label and a distinct icon in semantic status utilities."
  - "Irreversible confirmation awaits the callback, synchronously rejects repeat activation, and closes only after successful completion."

requirements-completed: [REQ-01, REQ-03, REQ-04, REQ-05]

duration: 4min
completed: 2026-08-29
---

# Phase 2 Plan 11: Accessible Workflow Feedback Composites Summary

**Closed semantic status badges, promise-aware submission confirmation, and a single root Sonner provider for accessible workflow feedback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T12:43:47Z
- **Completed:** 2026-08-29T12:47:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a closed StatusBadge mapping for all seven persisted assessment-request states, each rendered with an icon, sentence-case label, semantic status tokens, and optional polite live announcement.
- Added a focus-managed ConfirmDialog that explicitly names submission, provides cancellation, awaits server completion, prevents repeat activation, and restores trigger focus.
- Mounted the existing semantic Sonner Toaster exactly once at the application root and proved the feedback contract against the persisted Strapi enum.
- Passed strict TypeScript checking, the focused feedback suite, and all 27 web tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify status, confirm, and notification behavior** - `15d2c9d` (test)
2. **Task 2: Implement StatusBadge, ConfirmDialog, and root Toaster** - `79156d1` (feat)

## Files Created/Modified

- `apps/web/src/components/csrm/status-badge.tsx` - Closed request-status map with semantic icon-and-label feedback.
- `apps/web/src/components/csrm/confirm-dialog.tsx` - Named, focus-safe, repeat-locked irreversible confirmation.
- `apps/web/src/components/csrm/feedback-composites.test.tsx` - Persisted enum, accessibility, focus, pending, and provider contract.
- `apps/web/app/layout.tsx` - Single root Toaster mount.

## Decisions Made

- Mirrored the authoritative persisted enum in a TypeScript `Record<RequestStatus, StatusPresentation>` so additions or omissions cannot silently lose user-facing status feedback.
- Kept raw mutation errors outside ConfirmDialog: callers own normalized inline/toast feedback, while the dialog remains open and usable for retry after a rejected callback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disambiguated the repeated live-status test fixture**
- **Found during:** Task 2 (Implement StatusBadge, ConfirmDialog, and root Toaster)
- **Issue:** The completed fixture intentionally rendered “Under review” twice to test both ordinary and live status variants, but the per-status assertion used a singular text query.
- **Fix:** Selected the first matching status badge for the exhaustive mapping loop and retained the second match for the explicit polite-live assertion.
- **Files modified:** `apps/web/src/components/csrm/feedback-composites.test.tsx`
- **Verification:** Strict typechecking, the focused feedback test, and all 27 web tests pass.
- **Committed in:** `79156d1`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The correction removed test-query ambiguity without changing the production contract or scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Phase 2 request screens can consume one exhaustive status presentation and one shared irreversible-submit interaction without duplicating accessibility or pending-state logic.
- Supplemental workflow notifications are available application-wide from one root provider; no blockers remain for later request workflow plans.

## Self-Check: PASSED

- All three created files and the modified root layout exist.
- Task commits `15d2c9d` and `79156d1` exist in repository history.
- The plan acceptance criteria and overall verification pass with no known stubs or unplanned security-relevant trust boundaries.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
