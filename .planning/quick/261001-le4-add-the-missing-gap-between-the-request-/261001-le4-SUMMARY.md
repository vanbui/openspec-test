---
phase: quick-261001-le4
plan: 01
subsystem: web/assessments
tags: [layout, spacing, analyst-view, regression-test]
requires: []
provides:
  - "Analyst request detail whose blocks below the page header share one grid gap-6 container"
affects:
  - apps/csrm/src/features/assessments/assessment-detail.tsx
tech-stack:
  added: []
  patterns: ["single grid gap-6 container owns vertical rhythm (matches Requestor page)"]
key-files:
  modified:
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
decisions:
  - "Reversal control keeps a class-less wrapper div so the grid does not stretch the button"
metrics:
  tasks: 1
  completed: 2026-10-01
status: complete
commits: 1
plan_head_before: 5d6d66b50e77f07abf2525fba874d31590d2191a
plan_head_after: e10a1a1
actuals:
  tasks: 1
  commits: 1
---

# Phase quick-261001-le4 Plan 01: Analyst request detail gap Summary

The Analyst request detail view now uses the Requestor view's pattern: PageHeader, then one `grid gap-6` div holding the stepper, hub, optional "Return to draft" control, "Request context", and the generation cards, so 24px separates "Request relationships" from "Request context" in both states.

## What changed

- `assessment-detail.tsx`: populated return restructured only. The stepper and hub are direct grid children (no wrapping div, so a `null` child adds no gap). The `mt-6` wrappers, the `mb-4` on the reversal wrapper and `className="mt-6"` on `AssessmentDraftJob` were removed. The reversal control stays in a class-less div so it keeps its intrinsic width.
- `assessment-review-workflow.test.tsx`: two regression tests (draft request without reversal; submitted request with reversal and both generation cards) assert the shared `grid gap-6` container, containment of "Request relationships", and no `mt-`/`mb-`/`my-` class on direct children.

## TDD

RED: both new tests failed on the containment assertion with 30 existing tests passing. GREEN: 32/32 passing, 261001-kxa test unedited.

## Deviations from Plan

None - plan executed as written. (Committed RED and GREEN together as one commit, which the plan allows.)

## Verification

- `pnpm --filter @csrm/web exec vitest run assessment-review-workflow`: 32 passed.
- `pnpm --filter @csrm/web typecheck`: clean.
- Not run: browser/Playwright specs and the manual human check (no dev server permitted).

## Known Stubs

None.

## Self-Check: PASSED

Both modified files exist; commit e10a1a1 exists on csrm-20260928.
