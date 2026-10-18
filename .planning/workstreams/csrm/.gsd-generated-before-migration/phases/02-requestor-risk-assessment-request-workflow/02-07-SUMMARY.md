---
phase: 02-requestor-risk-assessment-request-workflow
plan: 07
subsystem: requestor-request-inventory
tags: [nextjs, strapi, zod, openapi-fetch, tanstack-table, vitest]
requires:
  - phase: 02-03
    provides: server-only development identity transport
  - phase: 02-05
    provides: Strapi owner scope and workflow guards
  - phase: 02-06
    provides: generated pagination and closed populate contracts
provides:
  - bounded URL query parsing and render-ready assessment request records
  - closed summary, detail, and dashboard request projections
  - responsive My Requests table/card route with deliberate loading and failure states
affects: [02-08, 02-09, 02-12]
tech-stack:
  added: []
  patterns:
    - generated openapi-fetch requests with projection-specific runtime normalization
    - Server Component data loading with a thin URL-control client island
    - safe URL passthrough allowlist with page reset on filter changes
key-files:
  created:
    - apps/web/src/features/requests/request-domain.ts
    - apps/web/src/features/requests/request-schema.ts
    - apps/web/src/features/requests/request-service.ts
    - apps/web/src/features/requests/request-service.test.ts
    - apps/web/src/features/requests/request-table.tsx
    - apps/web/src/features/requests/request-table.test.tsx
    - apps/web/app/(app)/app/requests/page.tsx
    - apps/web/app/(app)/app/requests/loading.tsx
    - apps/web/app/(app)/app/requests/error.tsx
  modified:
    - apps/web/src/components/csrm/data-table.tsx
key-decisions:
  - Preserve only the explicit view parameter when rebuilding My Requests URLs; discard owner and other untrusted parameters.
  - Strip relations outside each service projection after runtime parsing even if an upstream response is over-populated.
  - Expose workflow-specific page-size options through the shared DataTable rather than widening the request query allowlist.
requirements-completed: [REQ-01]
duration: 11 min
completed: 2026-08-29
---

# Phase 02 Plan 07: Authorised My Requests Summary

**Owner-scoped Strapi request inventory with bounded URL controls, closed hydrated projections, and a responsive five-state My Requests experience.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-29T13:22:21Z
- **Completed:** 2026-08-29T13:33:37Z
- **Tasks:** 3
- **Files changed:** 10

## Accomplishments

- Added strict CSRM assessment request types, status presentation, render-ready dates, pagination, and Zod parsing for bounded browser query state.
- Implemented server-only summary, detail, and dashboard reads through generated operations with exact repeated populate serialization and projection-specific normalization.
- Delivered `/app/requests` as a Server Component with responsive table/cards, URL-backed search/status/sort/pagination, accurate counts, loading skeletons, distinct first-use and filtered empties, retry, and permission denial.
- Proved malformed input, hostile over-population, malformed payloads, 403, transport failure, safe URL preservation, responsive content, and every route state with focused tests.

## Task Commits

1. **02-W0-02A: Specify typed query mapping and payload normalization** — `d1cf7f5` (test)
2. **02-07-02: Implement request domain, Zod query schema, and typed service** — `71c318c` (feat)
3. **02-W0-02B RED: Specify the complete My Requests slice** — `c7f6ca1` (test)
4. **02-W0-02B GREEN: Deliver the complete My Requests slice** — `8cae045` (feat)

## Files Created/Modified

- `apps/web/src/features/requests/request-domain.ts` — JDL-aligned request records, relation summaries, statuses, sorting, pagination, and date presentation.
- `apps/web/src/features/requests/request-schema.ts` — bounded URL and strict transport payload parsing with closed projection adapters.
- `apps/web/src/features/requests/request-service.ts` — server-only generated request list/detail/dashboard operations and safe failures.
- `apps/web/src/features/requests/request-service.test.ts` — serializer, query, projection, pagination, malformed, forbidden, and transport coverage.
- `apps/web/src/features/requests/request-table.tsx` — responsive URL-control client island over the shared DataTable.
- `apps/web/src/features/requests/request-table.test.tsx` — controls, counts, responsive content, state slots, and server-route assertions.
- `apps/web/app/(app)/app/requests/page.tsx` — authorised My Requests Server Component.
- `apps/web/app/(app)/app/requests/loading.tsx` — route-aligned loading skeleton presentation.
- `apps/web/app/(app)/app/requests/error.tsx` — recoverable route error boundary.
- `apps/web/src/components/csrm/data-table.tsx` — optional validated page-size choices for feature-specific bounds.

## Decisions Made

- Only `view` is currently safe to preserve across request-query changes; ownership and other unknown keys are deliberately dropped.
- Each service adapter removes relations that were not requested by its closed projection, preventing accidental nested data from crossing the typed boundary.
- Request sort values remain user-readable URL strings while generated Strapi parameters use typed sort objects and the default serializer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added feature-specific DataTable page-size options**
- **Found during:** Task 3
- **Issue:** The shared table exposed `25` and `100`, while the validated request contract permits only `10`, `20`, and `50`; selecting an unsupported value would create inconsistent URL state.
- **Fix:** Added an optional `pageSizeOptions` prop with the existing values as defaults, then supplied the closed request allowlist from RequestTable.
- **Files modified:** `apps/web/src/components/csrm/data-table.tsx`, `apps/web/src/features/requests/request-table.tsx`
- **Verification:** Shared DataTable tests, request table tests, strict typecheck, and the full web suite pass.
- **Commit:** `8cae045`

**Total deviations:** 1 auto-fixed (1 missing critical functionality).

**Impact:** The deviation preserves existing shared-table behavior while making request URL state consistent with server validation.

## Known Stubs

None. The detail links intentionally target the Phase 02 request detail route delivered by the subsequent workflow plan; the current list goal is complete.

## Verification

- `cd apps/strapi && npm test` — PASS (10/10)
- `cd apps/web && pnpm typecheck` — PASS
- `cd apps/web && pnpm test` — PASS (32/32 across 11 files)
- Targeted request service and table tests — PASS (5/5)

## Self-Check: PASSED

- All ten listed created/modified files exist.
- Task commits `d1cf7f5`, `71c318c`, `c7f6ca1`, and `8cae045` exist in history.
- All task acceptance criteria and plan-level verification commands pass.
- No unplanned endpoint, authentication path, file access pattern, or schema trust boundary was introduced.

## Next Phase Readiness

- Plan 02-08 can consume `getRequest` and the normalized system/asset summaries for detail/edit workflows.
- Plan 02-09 can consume the closed dashboard request projection with questionnaire/assessment summaries.
- Plan 02-12 can extend the server-only service boundary with typed mutations without changing list ownership semantics.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
