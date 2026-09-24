---
phase: 04-assessment-review-risk-editing-and-release
plan: "18"
subsystem: web
tags: [zod, openapi, nextjs, assessment, risk]
requires:
  - phase: 04-17
    provides: actor-specific assessment-detail OpenAPI contract
provides:
  - strict analyst and Requestor detail parsing
  - full persisted Risk hydration in the analyst editor
  - server-authoritative release readiness presentation
affects: [assessment-review, released-assessment-detail]
tech-stack:
  added: []
  patterns: [closed actor DTOs, full analyst-risk projection, server-owned readiness]
key-files:
  created: []
  modified: [apps/web/src/features/assessments/assessment-schema.ts, apps/web/src/features/assessments/assessment-service.ts, apps/web/src/features/assessments/assessment-editor.tsx, apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx]
key-decisions:
  - "The analyst detail response is the sole source for full Risks, owner labels, and release readiness."
  - "Compact RiskSummary responses remain separate from full analyst-risk reload projections."
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 8min
completed: 2026-08-30
---

# Phase 04 Plan 18: Strict Detail Hydration Summary

**The analyst editor now remounts complete persisted Risk state and displays only Strapi-supplied release readiness.**

## Performance

- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Enforced closed discriminated analyst and Requestor assessment-detail parsers.
- Passed full persisted analyst Risks and bounded owner labels directly from the typed detail service to the editor.
- Replaced client-side release reconstruction with the server readiness projection and added remount hydration coverage.

## Task Commits

1. **Task 1: Parse the full Risk and readiness contract without client reconstruction** — `7bb08e2`, `a2b4bf5`
2. **Task 2: Mount save-remount fidelity for every frozen Risk field** — `ebc4bb6`

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Correctness] Kept compact mutation/list Risk responses distinct from analyst reload Risks**
- **Found during:** Task 2
- **Issue:** Existing mutation and Requestor list operations publish the frozen compact RiskSummary contract, so parsing them as the full analyst reload projection would reject valid server responses.
- **Fix:** Introduced distinct compact and full web schemas; only the analyst detail variant exposes the full Risk projection.
- **Files modified:** `assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `risk-editor.tsx`
- **Verification:** Focused tests and strict TypeScript passed.
- **Commit:** `a2b4bf5`, `ebc4bb6`

**Total deviations:** 1 auto-fixed (Rule 2). No scope expansion beyond preserving the existing generated contract.

## Verification

- `pnpm --filter @csrm/web api:generate` — passed
- `pnpm test -- src/features/assessments/assessment-editor.test.tsx src/features/assessments/assessment-service.test.ts` — passed (32 tests)
- `pnpm typecheck` — passed
- `git diff --check` — passed

## Known Stubs

None. Existing empty select choices and input placeholders are valid editable control states, not unwired data.

## Next Phase Readiness

The assessment detail web boundary fails closed on actor-crossing payloads while preserving every editable analyst Risk field across reload.

## Issues Encountered

The legacy Phase 4 `STATE.md` counters cannot be parsed by the SDK's advance-plan, metric, or decision handlers. Session and roadmap updates succeeded; no state content was manually rewritten.

## Self-Check: PASSED

- Confirmed task commits `7bb08e2`, `a2b4bf5`, and `ebc4bb6` exist.
- Confirmed all key modified files exist and focused verification passes.
