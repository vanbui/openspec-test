---
phase: 03-dynamic-questionnaire-workflow
plan: 09
subsystem: questionnaire-web-workflow
tags: [nextjs, react-hook-form, zod, accessibility, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: parsed questionnaire definitions and pure visibility/progress/completeness rules from Plan 03-02
  - phase: 03-dynamic-questionnaire-workflow
    provides: authorised immutable draft and submit workflow from Plan 03-05
  - phase: 03-dynamic-questionnaire-workflow
    provides: typed questionnaire services and value-preserving Server Actions from Plan 03-07
provides:
  - One shared accessible edit/read-only questionnaire renderer for every defined answer type
  - Draft save, conditional clearing, active validation, irreversible confirmation, and immutable submitted transition
  - Server-owned Requestor questionnaire detail route with loading, empty, error, permission, ready, and submitted states
affects: [03-10, 03-12, analyst-review, questionnaire-e2e]

tech-stack:
  added: []
  patterns: [definition-driven RHF schema, pre-open confirmation validation, authoritative read-only transition]

key-files:
  created:
    - apps/web/src/features/questionnaires/questionnaire-renderer.tsx
    - apps/web/src/features/questionnaires/questionnaire-detail.tsx
    - apps/web/app/(app)/app/questionnaires/[documentId]/page.tsx
    - apps/web/app/(app)/app/questionnaires/[documentId]/loading.tsx
    - apps/web/app/(app)/app/questionnaires/[documentId]/error.tsx
  modified:
    - apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx
    - apps/web/src/components/csrm/confirm-dialog.tsx

key-decisions:
  - "Validate the complete active questionnaire before opening confirmation, then persist current active answers before invoking the server-owned atomic submit operation."
  - "Render submitted answers through the same ordered section and visibility tree as edit mode, replacing controls with semantic read-only values."
  - "Treat active required File upload questions as explicit unavailable blockers and never expose a text, URL, or file control fallback."

requirements-completed: [QUES-02, QUES-03, QUES-04, QUES-05]

duration: 8min
completed: 2026-08-30
---

# Phase 3 Plan 9: Shared Questionnaire Completion Workflow Summary

**A single data-defined RHF/Zod renderer now saves resumable drafts, clears hidden answers, confirms immutable submission, and displays authoritative submitted responses through the same accessible tree.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-30T04:14:42Z
- **Completed:** 2026-08-30T04:22:42Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Rendered Text, Long text, Boolean, Single select, Multi select, and Date answers with ordered sections, explicit labels/legends, linked errors, and responsive semantic-token layouts.
- Added fail-closed File upload handling, watched conditional visibility, hidden-answer unregister/clearing, textual progress, required-answer links, and focus recovery.
- Preserved values through draft failures, announced successful draft saves distinctly, blocked duplicate submissions, retained server failures inside confirmation, and immediately removed controls after authoritative success.
- Added a typed Server Component detail route that maps authorised ready, empty, error, permission-denied, and submitted states without raw fetches or client-owned authorization.
- Removed the RED sentinel and loading gate so every assertion executes unconditionally under the ordinary test command.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-04: Specify the shared interactive/read-only renderer** - `a6c1ee4` (test)
2. **Task 2: Build the shared renderer and Requestor detail route** - `017520f` (feat)

## Files Created/Modified

- `apps/web/src/features/questionnaires/questionnaire-renderer.tsx` - Shared edit/read-only RHF renderer, conditions, validation, progress, draft, and submission workflow.
- `apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx` - Unconditional nine-scenario renderer and route-state contract.
- `apps/web/src/features/questionnaires/questionnaire-detail.tsx` - Server-compatible state and questionnaire presentation mapping.
- `apps/web/app/(app)/app/questionnaires/[documentId]/page.tsx` - Typed owner-authorised questionnaire detail Server Component.
- `apps/web/app/(app)/app/questionnaires/[documentId]/loading.tsx` - Layout-matched questionnaire loading skeleton.
- `apps/web/app/(app)/app/questionnaires/[documentId]/error.tsx` - Recoverable App Router error boundary.
- `apps/web/src/components/csrm/confirm-dialog.tsx` - Optional asynchronous pre-open validation gate shared with the renderer.

## Decisions Made

- Browser validation remains advisory: the renderer uses the parsed definition to guide users, sends only `questionKey`/`value` pairs, and relies on Strapi to recompute completeness and own workflow state.
- Submit first saves the current visible values through the typed draft action, then invokes the authoritative transaction-backed submit action; hidden and unsupported values are excluded.
- Permission failures render no questionnaire summary or answer content, while the route delays question loading until the authorised questionnaire summary succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added a pre-open confirmation validation gate**
- **Found during:** Task 2
- **Issue:** The existing confirmation composite opened immediately, which could expose an irreversible confirmation before active client validation and could not focus the first invalid question without a dialog flash.
- **Fix:** Added an optional asynchronous `onBeforeOpen` contract that prevents opening when validation fails while preserving existing callers and focus behavior.
- **Files modified:** `apps/web/src/components/csrm/confirm-dialog.tsx`, `apps/web/src/features/questionnaires/questionnaire-renderer.tsx`
- **Verification:** Renderer tests, existing request-form tests, full web suite, and strict typecheck pass.
- **Commit:** `017520f`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical validation behavior).
**Impact on plan:** The existing confirmation primitive gained one backward-compatible optional hook; no dependency, API facade, backend contract, or authorization behavior changed.

## Issues Encountered

- The plan referenced an older Next.js documentation path. The installed Next.js server/client component guide was read from its current `01-getting-started/05-server-and-client-components.md` location before implementation.

## Verification Results

- Node 24.19.0 focused renderer/detail suite - PASS (9/9 tests)
- Node 24.19.0 full web suite - PASS (86/86 tests)
- `pnpm --filter @csrm/web typecheck` - PASS
- `pnpm --filter @csrm/web api:check` - PASS
- GREEN integrity scan - PASS (no RED sentinel, file-existence loading gate, or test escape hatch)
- Raw-fetch and hard-coded colour scan across new route/renderer files - PASS
- Frozen questionnaire/question schema diff - PASS (unchanged)
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)

## Known Stubs

- `apps/web/src/features/questionnaires/questionnaire-renderer.tsx` deliberately renders File upload as unavailable because Phase 3 has no authorised upload/storage/scanning contract. Active required upload questions block submission and no fallback value is accepted.

## Threat Flags

None. The new detail route and browser-to-action boundary are explicitly covered by the plan threat register; no additional trust boundary was introduced.

## Next Phase Readiness

- Plan 03-10 can reuse `QuestionnaireRenderer` directly in `read-only` mode for Security Analyst review without a second rendering implementation.
- Plan 03-12 can exercise the seeded Requestor save/resume/submit journey and authoritative analyst view end to end.
- No blocker remains for the remaining Phase 3 plans.

## Self-Check: PASSED

- All seven created or modified implementation/test files and this summary exist.
- Task commits `a6c1ee4` and `017520f` are present in repository history.
- Focused/full tests, strict typecheck, contract drift, schema freeze, catalogue parity, and GREEN integrity checks pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
