---
phase: 04-assessment-review-risk-editing-and-release
plan: "21"
subsystem: assessment-editor
tags: [nextjs, typescript, server-actions, playwright, integrity-gate]
requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: authorised assessment detail ownerLabels and bounded active-user owner search
provides:
  - Typed page-to-editor owner-search callback wiring for both Risk owner relations
  - Persisted owner-label fidelity after empty or truncated search results
  - Portable approved-base Phase 4 integrity verification and full-gate evidence
affects: [assessment-review, assessment-release, phase-04-verification]
tech-stack:
  added: []
  patterns:
    - Server Action callbacks keep owner identity search outside Client Components.
    - Persisted relation labels come only from the existing authorised assessment-detail transport.
key-files:
  created: []
  modified:
    - apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/web/src/features/assessments/assessment-editor.tsx
    - apps/web/src/features/assessments/risk-editor.tsx
    - apps/web/src/features/assessments/owner-combobox.tsx
    - scripts/verify-phase-04-integrity.ps1
key-decisions:
  - "Pass the typed searchActiveUsersAction directly through page, AssessmentEditor, RiskEditor, and OwnerCombobox."
  - "Use server-derived ownerLabels exclusively for persisted selections; search results never affect readiness."
  - "Verify Phase 4 from the fixed approved base rather than a named branch."
patterns-established:
  - "Owner pickers accept typed action input objects rather than locally reconstructed transport values."
  - "Phase integrity scripts validate a fixed ancestor and immutable catalogue parity before suites run."
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 8min
completed: 2026-08-30
---

# Phase 04 Plan 21: Owner Fidelity and Integrity Closure Summary

**Authorised owner search now reaches both Risk owner pickers through typed callbacks while persisted server-derived labels survive reloads and the complete isolated-database closure gate passes.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-30T16:20:00+10:00
- **Completed:** 2026-08-30T16:28:00+10:00
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments

- Wired `searchActiveUsersAction` from the analyst detail page through both editor layers to both accessible owner comboboxes.
- Kept selected owner labels in the existing authorised detail response, including when the bounded search response lacks that owner.
- Removed named-branch coupling from the Phase 4 integrity check and added approved-base, catalogue hash/parity, and current-branch regression coverage.
- Proved the closure gate: focused tests, integrity test/script, 68 Strapi tests, 166 web tests, API check, and 11 isolated Playwright tests all passed.

## Task Commits

1. **Task 1: Wire both owner comboboxes through the analyst editor and page** — `8b46c27` (feat)
2. **Task 2: Consume persisted owner labels from assessment detail and run the complete closure gate** — `e6971eb` (feat)

The independently committed isolated-fixture repair `14823ba` was preserved; its full Playwright result was 11/11 passing.

## Files Created/Modified

- `apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx` — injects the concrete typed owner search action.
- `apps/web/src/features/assessments/{assessment-editor,risk-editor,owner-combobox}.tsx` — propagates typed search and renders safe persisted selections.
- `apps/web/src/features/assessments/{assessment-editor,owner-combobox}.test.tsx` — verifies callback and persisted-label fidelity.
- `apps/web/e2e/assessment-release-workflow.spec.ts` — persists and reloads combobox-owned Risk data through release flow.
- `scripts/verify-phase-04-integrity{,.test}.ps1` — validates the portable approved-base integrity safeguards.

## Decisions Made

- Use the existing authorised assessment-detail `ownerLabels` projection rather than introducing an owner-label request or arbitrary identity input.
- Maintain server-owned release readiness independently of picker options and selected display labels.
- Base integrity validation on approved commit `ccfe77e6650e95b539645700f190aaab2c924bfe`, not the active branch name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled legacy STATE.md tracking through supported named SDK arguments**
- **Found during:** Plan close-out
- **Issue:** The positional state metric/decision/session calls and legacy plan parser do not support this frontmatter-first state format.
- **Fix:** Used the SDK's named mutation arguments to record metrics, decisions, session, current plan, and execution status; roadmap and requirements handlers completed normally.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** STATE now records current plan 23, completed 04-21 session, metrics, and decisions; ROADMAP records 22/23 plans executed.

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking tooling compatibility issue).

The fixture-isolation repair was already committed separately before this continuation and was not altered.

## Issues Encountered

- The earlier shared-fixture E2E interference was resolved in the preserved `14823ba` commit; the complete suite subsequently passed with the process-unique Playwright database.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 4 owner fidelity, release safety, frozen-catalogue/schema protections, and full-suite evidence are ready for phase verification.

## Self-Check: PASSED

Verified the summary exists and commits `8b46c27`, `e6971eb`, and preserved fixture fix `14823ba` are reachable.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
