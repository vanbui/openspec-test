---
phase: 04-assessment-review-risk-editing-and-release
plan: "13"
subsystem: ui
tags: [nextjs, react-suspense, react-hook-form, shadcn, accessibility, vitest]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: strict assessment actions, typed analyst services, release readiness domain rules, and ConfirmDialog
provides:
  - Complete analyst assessment, Risk, and ControlImplementation editing over the frozen mutation surface
  - Exhaustive icon-and-label risk rating semantics with semantic theme tokens
  - Synchronous detail route shell with a concrete Suspense skeleton and safe resolved states
  - Readiness-linked explicit release confirmation with duplicate locking, retained failure, and immutable success presentation
affects: [04-14, phase-04-e2e, phase-05-risk-register]

tech-stack:
  added: []
  patterns: [changed-field-only compact DTO editing, synchronous route shell with async Suspense child, readiness-gated irreversible confirmation]

key-files:
  created:
    - apps/web/src/components/csrm/risk-rating-badge.tsx
    - apps/web/src/features/assessments/assessment-editor.tsx
    - apps/web/src/features/assessments/risk-editor.tsx
    - apps/web/src/features/assessments/control-implementation-editor.tsx
    - apps/web/src/features/assessments/assessment-editor.test.tsx
    - apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx
  modified: []

key-decisions:
  - "Submit only analyst-changed Risk and ControlImplementation fields because the frozen read contract returns compact summaries; merge authoritative successful edits into local review state."
  - "Keep the assessment route shell synchronous and perform every typed detail/reference read inside the named async child beneath AssessmentEditorSkeleton."
  - "Offer release only for a mutable in-review assessment with a complete mirrored checklist, while Strapi remains authoritative and rejected release stays retryable inside ConfirmDialog."

patterns-established:
  - "Compact aggregate edit: hydrate known summary values -> expose the full positive allowlist -> submit changed fields only -> merge successful response locally."
  - "Release interaction: linked readiness guidance -> explicit irreversible alert dialog -> single in-flight action -> retained normalized failure or immutable success presentation."

requirements-completed: [ASSESS-03, ASSESS-04]

duration: 13min
completed: 2026-08-30
---

# Phase 4 Plan 13: Analyst Assessment Editing and Release Summary

**A responsive contract-aligned analyst editor now exposes every frozen Risk and mitigation-control field, then permits release only through an explicit readiness-gated confirmation whose failure remains safely retryable.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-30T01:27:57Z
- **Completed:** 2026-08-30T01:40:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added assessment metadata editing plus all 34 frozen non-server-owned Risk fields, with contextual Risk add/update and deliberately no delete affordance or action.
- Added all eight frozen ControlImplementation fields with reusable Control references and exact add/update/remove behavior.
- Added Low, Moderate, High, and Critical badges with exhaustive TypeScript mapping, visible labels, icons, and semantic theme tokens.
- Added a synchronous App Router detail shell whose typed reads suspend below a concrete responsive editor skeleton and resolve to safe permission, transport, empty, or not-found outcomes.
- Added linked, politely announced readiness omissions and an explicit irreversible ConfirmDialog release flow with duplicate locking, retained normalized rejection, focused retry, and removal of all mutation controls after success.

## Task Commits

1. **Shared RED: Specify assessment editing and release behavior** - `00eb38e` (test)
2. **Task 1 GREEN: Add contract-aligned analyst assessment editor** - `7d12355` (feat)
3. **Task 2: Gate release behind explicit analyst confirmation** - `9ba2ae7` (feat)
4. **Rule 1 fix: Preserve metadata save failures** - `4ade34d` (fix)
5. **Task 2 RED: Require live release readiness guidance** - `43af88d` (test)
6. **Task 2 GREEN: Announce release readiness changes** - `b277020` (feat)

## Files Created/Modified

- `apps/web/src/components/csrm/risk-rating-badge.tsx` - Exhaustive icon, label, and semantic-token risk-rating presentation.
- `apps/web/src/features/assessments/assessment-editor.tsx` - Aggregate metadata/Risk/control composition, safe states, readiness guidance, immutable states, and release interaction.
- `apps/web/src/features/assessments/risk-editor.tsx` - Full changed-field-only Risk create/update form over the frozen positive allowlist.
- `apps/web/src/features/assessments/control-implementation-editor.tsx` - Exact contextual mitigation-control create/update/remove form.
- `apps/web/src/features/assessments/assessment-editor.test.tsx` - Mounted field-surface, actions, state, Suspense, readiness, release, retry, and immutability proof.
- `apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx` - Suspense-wrapped typed assessment/reference/descendant reads and deliberate error mapping.

## Decisions Made

- Compact Risk responses are never treated as permission to clear unknown persisted values; update forms submit only fields changed by the analyst.
- RiskType and reusable Control records remain reference selections, while contextual Risk and ControlImplementation values remain the only editable data.
- Any partial release fact removes mutation controls and fails closed; navigation visibility and disabled controls are presentation only, never authorization.
- The client checklist guides the analyst but cannot override Strapi readiness or release rejection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved strict metadata saves with empty optional choices and field errors**
- **Found during:** Task 2 verification
- **Issue:** A null optional rating/control-effectiveness rendered as an empty select value, which would be submitted as an invalid empty string; a rejected metadata save also retained only the form-level error.
- **Fix:** Normalize empty optional choices to omitted values, normalize the cleared review date to null, map server field errors into React Hook Form, and retain the analyst-entered value.
- **Files modified:** `apps/web/src/features/assessments/assessment-editor.tsx`, `apps/web/src/features/assessments/assessment-editor.test.tsx`
- **Verification:** Focused editor suite, full plain web suite, and strict TypeScript all pass.
- **Committed in:** `4ade34d`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The fix keeps the strict mutation boundary usable without expanding the API, schema, dependency set, or server-owned release surface.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused assessment editor/release suite: PASS, 10/10 tests.
- Full plain web Vitest suite: PASS, 148/148 tests across 24 files.
- Strict TypeScript: PASS with `pnpm typecheck`.
- Frozen contract/generated client guard: PASS, no change to `docs/references/specification.json` or `apps/web/src/lib/api/generated/schema.d.ts`.
- Frozen Strapi schema guard: PASS, no `schema.json` change.
- Catalogue integrity: PASS, authoritative and bootstrap copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Boundary scan: PASS, no raw fetch, frontend API facade, client authorization decision, Risk delete path, dependency, hard-coded brand colour, or automatic release was introduced.
- Test integrity: PASS, no skips, todos, RED sentinel, runner-argument mutation, file guard, conditional assertion bypass, or test early return was added.

## Known Stubs

None.

## Self-Check: PASSED

- All six plan-owned implementation/test files exist.
- All six TDD/task/fix commits exist in repository history.
- Focused and plain full-suite verification passes with strict TypeScript, frozen schemas, byte-identical catalogues, and analyst-only explicit release.

## Next Phase Readiness

- Plan 04-14 can exercise the complete analyst draft-edit-release journey against these current UI outputs.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
