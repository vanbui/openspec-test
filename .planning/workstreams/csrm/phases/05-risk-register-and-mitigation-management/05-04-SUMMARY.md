---
phase: 05-risk-register-and-mitigation-management
plan: 04
subsystem: ui
tags: [nextjs, react, risk-register, data-table, accessibility, typed-api]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Canonical Risk Register query parser, closed DTOs, selected labels, and typed Strapi list service from Plan 05-03
provides:
  - Capability-gated organisation Risk Register route
  - Canonical shareable search, filter, sort, and pagination interactions
  - Responsive desktop table and mobile Risk cards with deliberate route states
affects: [05-06, 05-07, phase-05-verification, risk-detail]

tech-stack:
  added: []
  patterns: [server-owned URL state, typed service-only route reads, responsive DataTable composition]

key-files:
  created:
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/app/(app)/app/risks/page.tsx
    - apps/web/app/(app)/app/risks/loading.tsx
    - apps/web/app/(app)/app/risks/error.tsx
  modified:
    - apps/web/src/features/risks/risk-register.test.tsx
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-schema.test.ts

key-decisions:
  - "Canonical URL serialization is rebuilt exclusively from the approved Risk Register query shape, so unsupported date-filter and unknown state cannot survive an interaction."
  - "Capability denial is resolved before typed Risk inventory reads and renders without filters, totals, or record clues."
  - "Desktop tables and mobile cards consume the same server-ordered DTO page and authoritative pagination total."

patterns-established:
  - "Register route pattern: synchronous page shell with PageHeader and a Suspense-wrapped async capability/service child."
  - "Responsive list pattern: URL-only client interaction layer over manual server sorting and pagination."

requirements-completed: [RISK-01]

duration: 14min
completed: 2026-09-01
---

# Phase 05 Plan 04: Responsive Risk Register Summary

**Capability-gated Risk Register with canonical shareable filters, server-authoritative sorting and totals, responsive table/cards, and accessible deliberate states**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-31T16:41:58Z
- **Completed:** 2026-08-31T16:55:36Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Delivered `/app/risks` as a server-owned App Router route that checks `risk:manage` before calling the typed Risk service layer.
- Added all approved search, categorical, relationship, sort, page-size, paging, chip, and clear-filter interactions with canonical `router.replace(..., { scroll: false })` URLs.
- Rendered eight sortable desktop columns and explicit-link mobile cards with semantic ratings, icon-plus-text treatment/overdue states, UTC dates, honest totals, and stale-page correction.
- Preserved the PageHeader and exact approved loading, first-use empty, filtered-empty, error, and permission presentations without partial disclosure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify canonical register interactions and five states** - `eee0769` (test)
2. **Task 2: Build the responsive organisation Risk Register** - `7117b80` (feat)

## Files Created/Modified

- `apps/web/src/features/risks/risk-register.tsx` - Responsive register composition, table/card projection, canonical navigation, and deliberate state treatments.
- `apps/web/src/features/risks/risk-register-filters.tsx` - Labelled responsive search, primary filters, popover, mobile Sheet, and bounded relation selections.
- `apps/web/src/features/risks/risk-register.test.tsx` - Full interaction, sort, responsive presentation, canonicalization, and state contract.
- `apps/web/app/(app)/app/risks/page.tsx` - Capability-gated server route using only typed Risk services.
- `apps/web/app/(app)/app/risks/loading.tsx` - Final-geometry loading presentation with retained PageHeader.
- `apps/web/app/(app)/app/risks/error.tsx` - Retryable route error presentation with exact approved copy.
- `apps/web/src/features/risks/risk-schema.ts` - UTC medium `en-AU` target-date formatting aligned to the UI contract.
- `apps/web/src/features/risks/risk-schema.test.ts` - Updated exact date-format assertion.

## Decisions Made

- Rebuild browser query strings from the closed `RiskRegisterQuery` contract rather than copying current URL state; this automatically drops `targetDateFrom`, `targetDateTo`, and all unknown list parameters.
- Keep capability denial outside the shared DataTable so no filter, count, paging, density, or protected record clue is rendered.
- Preserve server response order without client sorting, including target-date null-last behavior in both directions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected inherited target-date display format**
- **Found during:** Task 2 (Build the responsive organisation Risk Register)
- **Issue:** The Plan 05-03 helper emitted numeric `en-AU` dates, while the binding UI contract requires medium UTC dates such as `30 Sept 2026`.
- **Fix:** Added `dateStyle: 'medium'` to the shared UTC formatter and updated its exact unit assertion.
- **Files modified:** `apps/web/src/features/risks/risk-schema.ts`, `apps/web/src/features/risks/risk-schema.test.ts`
- **Verification:** Risk schema tests, focused register tests, full web suite, typecheck, and production build pass.
- **Committed in:** `7117b80`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The correction was required for the approved display contract and did not widen the API or date-filter surface.

## Issues Encountered

- Initial GREEN typecheck identified an untyped empty capability set and a test DOM element narrowing issue; both were corrected before verification.
- The full web suite prints the existing jsdom navigation notice after completion, but all 208 tests pass and the command exits successfully.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Self-Check: PASSED

- All five created route/component files and three modified test/schema files exist.
- Task commits `eee0769` and `7117b80` exist in order.
- Focused Risk Register and schema verification passes 26 tests; the full web suite passes 208 tests.
- Strict TypeScript typecheck and the Next.js production build pass.
- Static scans find no raw fetch, literal feature colours, `PHASE5_RED`, `execArgv`, file guard, early-return escape hatch, TODO, FIXME, placeholder, or known stub in the Plan 05-04 surface.
- The denied state exposes no filters, count, paging, or protected Risk clue.

## Next Phase Readiness

- The organisation register now links assessment-created Risks to the dedicated detail route for the remaining Phase 5 detail and mitigation plans.
- Responsive browser and accessibility journey coverage can exercise the complete canonical list contract without an obsolete GREEN escape hatch.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
