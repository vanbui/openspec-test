---
phase: 12-ai-context-suggestions-and-provenance
plan: 11
subsystem: assessment workflow and contract
tags: [assessment, conflict-reasons, review-transition, contract]
requires:
  - phase: 12-10
    provides: the current specification and generated client declaration
provides:
  - locked assessment mutations return ASSESSMENT_NOT_MUTABLE through the assessment controller
  - assessment mutations can select the accepted-edit transition or preserve review state
  - four decision conflict reasons appear in both closed contract enums and both runtime lists
affects: [12-12, 12-13, 16, 17, 17.1]
tech-stack:
  added: []
  patterns: [closed conflict reason transport, result-selected review transition]
key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/csrm/conflict-reasons.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/backend/tests/assessment-workflow.unit.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
key-decisions:
  - "The existing mutability predicate is unchanged; its 409 now carries ASSESSMENT_NOT_MUTABLE."
  - "The transition defaults to accepted-edit; none writes no assessment, reviewer or request transition. Readiness is computed before the mutation."
status: complete
completed: 2026-10-06
commits:
  red: dd04907
  green: 126295c
  docs: (this commit)
---

# Phase 12 Plan 11 Summary

## Accomplishments

- The single assessment mutability guard names `ASSESSMENT_NOT_MUTABLE`, and the assessment controller transports that reason on a refused change.
- Assessment mutations select `accepted-edit` or `none`, including from their result. Existing callers retain the accepted-edit default. The pre-edit readiness and draft state are captured before writes.
- The four planned decision reasons are in the backend and web lists, both specification enums, and the regenerated client declaration.

## Verification

- The new web cases first failed 5/62, then passed. The full `src/lib/api` run passed 142/142; web typecheck passed.
- The focused backend unit and parity tests passed 27/27. The mounted run passed 58/59 before the test double's expected relation representation was corrected; the only failure was in the new unit case.
- Full backend suite: `pnpm --dir apps/backend test` passed 743/743, with 0 failures, 0 skipped and 0 cancelled.
- `api:generate` succeeded. `api:check` regenerated the declaration but its git-diff check returned 1 because this run cannot stage the generated file. Its output showed only the two expected enum changes. `git diff --check` passed.

## Decisions

- The draft-to-review transition uses the assessment status captured before the assessment write, so it also works when a document service updates the loaded object in place.

## Deviations

- Added a transport test in `server-client.test.ts` to prove the reason survives normalization.
- Git remained read-only. The orchestrator must stage the generated declaration before rerunning `api:check`.

## Self-Check: PASSED
