---
phase: 02-requestor-risk-assessment-request-workflow
plan: 04
subsystem: ui
tags: [react, tanstack-table, accessibility, responsive, vitest]

requires:
  - phase: 01-monorepo-foundation-and-secure-application-shell
    provides: shadcn table primitives, semantic design tokens, and strict web test infrastructure
provides:
  - Generic controlled CSRM DataTable for server sorting, filtering, and pagination
  - Responsive desktop table and caller-supplied mobile card rendering
  - Persisted per-user density, numeric alignment, and focus-safe sticky header contracts
affects: [02-requestor-risk-assessment-request-workflow, request-lists, analyst-tables]

tech-stack:
  added: ["@tanstack/react-table@9.2.4"]
  patterns: [explicit TanStack v9 feature registry, caller-owned URL state, per-user density persistence]

key-files:
  created:
    - apps/web/src/components/csrm/data-table.tsx
    - apps/web/src/components/csrm/data-table.test.tsx
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Use TanStack Table v9 explicit feature registration with controlled server state while keeping URL navigation caller-owned."
  - "Persist density under a per-user browser key and load it after mount to preserve hydration safety."

patterns-established:
  - "DataTable control pattern: feature pages own sorting, filters, page, and page-size state and receive explicit change callbacks."
  - "Numeric column pattern: magnitude values align right while identity numerics align left; both use tabular figures."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 5min
completed: 2026-08-29
---

# Phase 2 Plan 4: CSRM DataTable Summary

**A reusable TanStack v9 DataTable now provides controlled server navigation, responsive cards, persisted density, aligned tabular numerics, and accessible sticky-header interactions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T12:27:49Z
- **Completed:** 2026-08-29T12:33:45Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added a strict generic DataTable using TanStack Table v9 feature registration rather than legacy v8 APIs.
- Implemented caller-controlled sorting, filters, pagination, result counts, and five mutually exclusive rendering states.
- Locked the 40px sticky header, 44px/36px density contract, per-user persistence, mobile card fallback, focus protection, and numeric alignment in behavior tests.

## Task Commits

Each implementation task was committed atomically:

1. **Task 02-04-00: Verify the repository Node engine** - verification-only gate; no file changes
2. **Task 02-04-01: Specify the accessible DataTable contract** - `a161c34` (test)
3. **Task 02-04-02: Build DataTable on landed primitives** - `34d5697` (feat)

## Files Created/Modified

- `apps/web/src/components/csrm/data-table.tsx` - Generic responsive table composite and controlled interaction contract.
- `apps/web/src/components/csrm/data-table.test.tsx` - Behavior coverage for accessibility, states, density, alignment, and callbacks.
- `apps/web/package.json` - Exact TanStack React Table dependency pin.
- `pnpm-lock.yaml` - Reproducible dependency graph for TanStack Table v9.

## Decisions Made

- Registered only the filtering, sorting, and pagination features needed from TanStack Table v9.
- Kept URL state and backend requests outside the composite; callers provide controlled values and callbacks.
- Loaded persisted density after mount so server and initial client markup remain hydration-safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the loading skeleton density assertion**
- **Found during:** Task 02-04-02 (Build DataTable on landed primitives)
- **Issue:** The test expected default-height loading skeletons after compact density had already been persisted for the active user.
- **Fix:** Asserted the active compact height so loading skeletons match the selected density as required.
- **Files modified:** `apps/web/src/components/csrm/data-table.test.tsx`
- **Verification:** Focused DataTable suite and the complete web suite pass.
- **Committed in:** `34d5697`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The correction strengthens the planned density contract without expanding scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Verification

- Node engine preflight: passed on v24.19.0 against exact `>=24.19.0 <25` declaration.
- `pnpm typecheck`: passed.
- `pnpm test -- src/components/csrm/data-table.test.tsx`: 1 test passed.
- `pnpm test`: 25 tests passed across 7 files.
- Raw color scan under `src/components/csrm`: passed with no literals.

## Next Phase Readiness

- Phase 2 request and dashboard screens can compose the shared DataTable without duplicating server-state or responsive presentation behavior.
- Ready for Plan 02-05.

## Self-Check: PASSED

- All created and modified key files exist.
- Task commits `a161c34` and `34d5697` are present in repository history.
- No blocking stubs or unplanned threat surface were found.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
