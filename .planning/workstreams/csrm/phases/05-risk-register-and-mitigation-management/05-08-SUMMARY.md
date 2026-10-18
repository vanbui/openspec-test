---
phase: 05-risk-register-and-mitigation-management
plan: 08
subsystem: web-ui
tags: [nextjs, react-hook-form, risk-detail, mitigation-controls, accessibility, server-actions]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Complete mutable/released Risk aggregate and conflict-refresh actions from Plans 05-05 and 05-07
  - phase: 04-assessment-generation-and-review
    provides: Reusable Risk, ControlImplementation, owner-picker, and confirmation patterns
provides:
  - Capability-gated contextual Risk detail route with safe loading, error, permission, and not-available states
  - Five-section responsive Risk detail presentation with semantic released mode
  - Delta-only Risk editor and inline mitigation add, edit, and remove workflows
  - Accessible live feedback, destructive confirmation, focus restoration, and authoritative 409 replacement
affects: [05-09, risk-detail-e2e, risk-register-uat]

tech-stack:
  added: []
  patterns: [authoritative client aggregate replacement, structurally immutable released presentation, delayed final-geometry skeleton]

key-files:
  created:
    - apps/web/src/features/risks/risk-details.test.tsx
    - apps/web/src/features/risks/risk-details.tsx
    - apps/web/src/features/risks/risk-detail-editor.tsx
    - apps/web/src/features/risks/mitigation-control-list.tsx
    - apps/web/app/(app)/app/risks/[documentId]/page.tsx
    - apps/web/app/(app)/app/risks/[documentId]/loading.tsx
    - apps/web/app/(app)/app/risks/[documentId]/error.tsx
    - apps/web/app/(app)/app/risks/[documentId]/not-found.tsx
  modified:
    - apps/web/src/components/csrm/confirm-dialog.tsx

key-decisions:
  - "Load the complete Risk aggregate only after the risk:manage capability check, and load mutable picker inventories only after the server-owned parentLock is known."
  - "Replace local detail state from the single authoritative 409 result; released authority removes all editors while unavailable authority removes the complete Risk projection."
  - "Render released Risks through semantic values with no forms, disabled controls, mutation buttons, or picker inventory reads."

patterns-established:
  - "Dedicated Risk editing: a maximum-640px single-column form computes the positive-allowlist delta locally and merges successful authoritative output."
  - "Mitigation management: contextual implementations retain reusable-Control terminology and update the local complete aggregate only after server success."

requirements-completed: [RISK-02]

duration: 14min
completed: 2026-09-01
---

# Phase 5 Plan 8: Risk Detail and Mitigation Management Summary

**A capability-gated five-section Risk detail now supports delta-only Risk and mitigation maintenance while released aggregates remain semantically readable and structurally immutable.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-31T18:02:47Z
- **Completed:** 2026-08-31T18:16:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added the synchronous `/app/risks/[documentId]` route shell with Suspense, document-ID validation, server capability gating before lookup, exactly one complete aggregate read, and safe no-disclosure states.
- Rendered the full Risk in five ordered responsive sections with UTC `en-AU` dates, semantic rating badges, exact Risk type/reusable Control terminology, and authorised related-assessment linking.
- Added a dedicated single-column Risk editor that validates on blur/submit, submits changed allowlisted fields only, confirms dirty discard, restores focus, and announces no-op or successful saves.
- Added inline mitigation creation, editing, and destructive removal with reusable-Control search, exact confirmation copy, retained failure dialogs, server-success merges, and live announcements.
- Made released Risks structurally read only: no mutation forms, disabled controls, picker inventory requests, mutation affordances, or hidden prefetch elements are rendered.
- Replaced stale editors after 409 with the authoritative released aggregate or the safe not-available state without retrying the mutation or showing partial Risk data.

## Task Commits

Each task was committed through its TDD sequence:

1. **Task 1 RED: Specify the complete Risk detail experience** - `334a172` (test)
2. **Task 2 GREEN: Deliver Risk detail and mitigation management** - `83a6c2a` (feat)

## Files Created/Modified

- `apps/web/src/features/risks/risk-details.test.tsx` - Unconditional five-section, mutable, released, safe-state, focus, feedback, mitigation, and 409 behavior coverage.
- `apps/web/src/features/risks/risk-details.tsx` - Complete detail state router, released notice, responsive definitions, and delayed final-geometry loading surface.
- `apps/web/src/features/risks/risk-detail-editor.tsx` - Dedicated delta-only Risk editor with owner search, validation, discard confirmation, and authoritative merging.
- `apps/web/src/features/risks/mitigation-control-list.tsx` - Contextual mitigation read/mutable switch with inline create, edit, and remove workflows.
- `apps/web/app/(app)/app/risks/[documentId]/*` - Capability-gated route plus loading, error, and not-found boundaries.
- `apps/web/src/components/csrm/confirm-dialog.tsx` - Optional secondary-action label for the exact Keep mitigation control contract.

## Decisions Made

- The route authorizes the Security Analyst capability before parsing or reading the caller-selected Risk and does not request editor inventories for released aggregates.
- The complete aggregate remains the only populated client state. A failed aggregate load and a not-available conflict discard all local Risk and mitigation facts.
- Successful mutation results are merged into the local aggregate; no mutation is optimistically applied before Strapi success.
- The shared confirmation primitive accepts an optional cancel label so destructive domain copy remains exact without creating a parallel dialog primitive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added an exact secondary confirmation label**
- **Found during:** Task 2
- **Issue:** The shared `ConfirmDialog` hard-coded `Cancel`, but the locked mitigation-removal contract requires `Keep mitigation control`.
- **Fix:** Added an optional `cancelLabel` with the existing `Cancel` default and supplied the exact mitigation label.
- **Files modified:** `apps/web/src/components/csrm/confirm-dialog.tsx`, `apps/web/src/features/risks/mitigation-control-list.tsx`
- **Verification:** Focused detail tests, the complete 230-test web suite, strict typecheck, and production build pass.
- **Commit:** `83a6c2a`

**Total deviations:** 1 auto-fixed (1 missing critical functionality). **Impact:** Exact approved destructive copy is supported without changing existing dialog consumers.

## Issues Encountered

- The initial GREEN run exposed three test-harness timing/query corrections and strict union narrowing errors. Queries were made plural where ratings intentionally appear in header and body, focus assertions now wait for the remounted trigger, and conflict/action unions are narrowed explicitly.
- The PowerShell `pnpm` shim does not preserve the required runtime. Package commands used the active Node 24.19.0 executable with its bundled Corepack pnpm entry point.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The Risk not-available content is an intentional closed failure state and never receives a Risk projection.

## Threat Flags

None. The new route and form boundaries are covered by the plan threat model: capability and Strapi authorization precede record reads, strict complete DTOs render as escaped React text, and all mutations cross existing allowlisted server actions with parent-lock enforcement.

## Self-Check: PASSED

- All eight created UI/route files and the modified confirmation primitive exist.
- TDD commits `334a172` and `83a6c2a` exist in RED-to-GREEN order.
- All 20 focused Risk detail/action tests pass; the complete web suite passes all 230 tests.
- Strict TypeScript typecheck and the Next.js production build pass under Node 24.19.0.
- Source scans find no raw fetch, unsafe HTML, literal feature color, `PHASE5_RED`, `execArgv`, or focused-test escape hatch in the Plan 05-08 surface.
- Released tests assert no forms, disabled controls, mutation actions, or prefetch elements; denial and not-available states assert no Risk number, statement, or relation disclosure.

## Next Phase Readiness

- Plan 05-09 can exercise the seeded mutable and released aggregates through the isolated browser harness.
- Responsive keyboard, persistence, exact authorization, and released zero-affordance behavior are ready for end-to-end verification.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
