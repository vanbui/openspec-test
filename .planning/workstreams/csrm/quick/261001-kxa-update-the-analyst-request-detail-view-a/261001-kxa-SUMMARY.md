---
phase: quick-261001-kxa
plan: 01
subsystem: web/assessments
tags: [layout, tailwind, analyst-review, regression-test]
requires: []
provides:
  - "Analyst request detail 'Request context' card spans the full content column (RCTX-01)"
affects:
  - apps/csrm/src/features/assessments/assessment-detail.tsx
tech-stack:
  added: []
  patterns: ["jsdom class-list assertion as a stand-in for layout"]
key-files:
  created: []
  modified:
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
decisions:
  - "Kept the wrapper div and removed only the lg column template, so the Analyst element carries the same `grid gap-6` pair as the Requestor page"
metrics:
  duration: ~5m
  completed: 2026-10-01
status: complete
requirements: [RCTX-01, RCTX-02]
actuals:
  tokens: 860
  tasks: 1
  commits: 1
plan_head_before: d161fce5a5f3f0cc764b68f960291cfcc7f8cb8b
plan_head_after: a11d51b7a4abc1f22c4da243f02d5d8fb9d73557
commits: 1
---

# Quick Task 261001-kxa: Analyst "Request context" card full width

**One-liner:** Removed the `lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]` template from the single-child grid around the Analyst "Request context" section, so the card fills the row like the Requestor view, with a vitest regression guard.

## What changed

- `assessment-detail.tsx` line 79: the div's `className` went from `grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]` to `grid gap-6`. The two-track template with one child left the card at about 64% of the row with an empty track beside it from the lg breakpoint.
- `assessment-review-workflow.test.tsx`: new test "lets the request context section span the full width of its container" in `analyst review presentations`. It finds the region named "Request context", reads its `parentElement`, and asserts the classes `grid` and `gap-6` and that `className` does not match `/\bgrid-cols-/`.

## TDD

- RED: the new test failed on the `not.toMatch(/\bgrid-cols-/)` assertion, received `grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]` (29 passed, 1 failed).
- GREEN: after the class change, 30/30 pass.

## Verification

- `pnpm --filter @csrm/web exec vitest run assessment-review-workflow`: passed (30/30).
- `pnpm --filter @csrm/web typecheck`: passed (exit 0).
- Not run: the optional Playwright spec, the full web unit suite, and the human visual check at 1440px and 375px (no dev server was to be started).

## Deviations from Plan

None. The plan executed as written. The RED and GREEN steps went into one commit, as the plan allows for a single task.

## Known Stubs

None.

## Threat Flags

None. The change is a CSS class on an element inside an already authorised view.

## Commits

- `a11d51b`: fix(quick-261001-kxa): span the analyst Request context card across the full content width

## Self-Check: PASSED

- Both modified files exist and the diff lists exactly those two files.
- Commit `a11d51b` exists on `csrm-20260928`.
