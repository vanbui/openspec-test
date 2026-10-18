---
phase: 06-administration-and-csv-imports
plan: 04
subsystem: administration
tags: [strapi, nextjs, openapi-fetch, zod, authorization, concurrency]

requires:
  - phase: 06-02
    provides: exact Administration route, grant, and human analyst scope boundary
  - phase: 06-03
    provides: generated 24-operation Administration OpenAPI contract
provides:
  - Authoritative Risk Type list, detail, create, and update workflow under the exact /v1 boundary
  - Normalized natural-key conflict handling with serialized transactional mutation rechecks
  - Strict typed Risk Type web service and validated success-only Server Actions
affects: [06-05, 06-06, administration-ui, csv-imports]

tech-stack:
  added: []
  patterns:
    - closed collection adapters map caller kinds to fixed UIDs, tables, fields, and sort columns
    - mutation queues serialize normalized-key rechecks inside Strapi transactions
    - server-only openapi-fetch calls are wrapped by strict runtime response schemas

key-files:
  created:
    - apps/strapi/src/api/csrm-administration/services/administration-config.ts
    - apps/strapi/src/api/csrm-administration/services/administration-query.ts
    - apps/strapi/src/api/csrm-administration/services/administration-repository.ts
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/web/src/features/administration/administration-config.ts
    - apps/web/src/features/administration/administration-schema.ts
    - apps/web/src/features/administration/administration-service.ts
    - apps/web/src/features/administration/administration-actions.ts
  modified:
    - apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts
    - apps/strapi/tests/tsconfig.json

key-decisions:
  - "Keep Risk Type as the only enabled Administration workflow kind in Plan 06-04 while retaining compile-time closed configuration for later collections."
  - "Project no persistence metadata and resolve applicable Control document IDs server-side before mutation."
  - "Map normalized application conflicts and database uniqueness failures to the same field-addressable 409 response."

patterns-established:
  - "Administration authorization is asserted before service parsing and every caller-selected lookup."
  - "Canonical list queries count and select from one predicate, hydrate only page IDs, and restore repository order."
  - "Administration actions validate closed inputs, retain submitted values, and revalidate configured routes only after success."

requirements-completed: [ADMIN-01]

duration: 16 min
completed: 2026-09-01
---

# Phase 06 Plan 04: Risk Type Server and Typed Web Boundary Summary

**Race-safe Risk Type CRUD through the exact analyst-only Strapi boundary, with strict generated transport calls and field-addressable Server Action conflicts**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-01T14:34:00Z
- **Completed:** 2026-09-01T14:50:21Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added honest paginated Risk Type search/sort, closed detail projections, positive mutation allowlists, and bounded applicable-Control resolution.
- Serialized Risk Type mutations and rechecked NFKC/trim/case-normalized names in transactions; simultaneous equivalent creates yield one 201 and one field-addressable 409.
- Added strict web schemas, four literal generated OpenAPI calls, and Server Actions that preserve values, map 409 to `name`, and never expose delete.
- Preserved the no-query legacy Risk Type picker dispatch and the exact token, app, grant, and human Security Analyst gates.

## Task Commits

1. **Task 1: Implement authoritative Risk Type CRUD** - `0c5e24d` (feat)
2. **Task 2: Connect generated Risk Type transport and actions** - `933f087` (feat)
3. **Rule 3 test-output repair** - `a63639e` (fix)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/services/administration-config.ts` - Closed collection UIDs, tables, natural keys, writable fields, and sort columns.
- `apps/strapi/src/api/csrm-administration/services/administration-query.ts` - Strict canonical queries, positive mutation parsing, normalization, and closed DTO projection.
- `apps/strapi/src/api/csrm-administration/services/administration-repository.ts` - Bound queries, honest totals, bounded hydration, relation resolution, and transactional persistence.
- `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` - Scope-first Risk Type CRUD, serialization, conflict normalization, and safe workflow errors.
- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` - Thin Risk Type HTTP handlers and closed 400/403/404/409 envelopes.
- `apps/web/src/features/administration/administration-config.ts` - Canonical Risk Type routes and natural-key metadata.
- `apps/web/src/features/administration/administration-schema.ts` - Strict URL, body, list, detail, and relation schemas.
- `apps/web/src/features/administration/administration-service.ts` - Server-only literal generated Risk Type transport.
- `apps/web/src/features/administration/administration-actions.ts` - Validated create/update actions with retained values and success-only invalidation.
- `apps/strapi/tests/tsconfig.json` - Emits Administration service modules into the isolated test build.

## Decisions Made

- Enabled only the Risk Type workflow in this slice; Control, Information System, Information Asset, and CSV handlers remain fail closed for their owning plans.
- Used fixed adapter metadata and constant SQL columns; no caller can supply a content UID, table, owner field, relation target, or sort column.
- Kept display names trimmed while comparing natural keys with NFKC plus locale-aware case folding.
- Returned bounded applicable-Control document IDs only after server-side existence resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Included Administration services in the isolated Strapi test output**
- **Found during:** Task 1 verification
- **Issue:** The Wave 0 unit test intentionally used a dynamic module load, so the test TypeScript project did not emit the newly created service module and could not execute its assertions.
- **Fix:** Added the Administration service glob to the test TypeScript include list without changing or weakening any test.
- **Files modified:** `apps/strapi/tests/tsconfig.json`
- **Verification:** The closed query/mutation/DTO unit test passes from `.tmp/tests-dist`.
- **Committed in:** `a63639e`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking issue)
**Impact on plan:** The repair only makes production Administration services available to the existing isolated test runner; assertion behavior is unchanged.

## Issues Encountered

- The full Strapi gate currently reports 103 expected passes and six remaining RED assertions for Control and CSV behavior owned by Plans 06-06 through 06-09. Within its shared loop, all Risk Type list/detail/closed update/normalized conflict/no-delete checks pass before the first Control sentinel.
- The full web Administration suite remains RED at the missing UI/CSV modules and later collection schema configuration. Plan 06-04 focused service, strict Risk Type response, typecheck, and OpenAPI drift checks pass.

## Verification

- `corepack pnpm --filter @csrm/strapi exec tsc --pretty false` - PASS
- Isolated mounted Risk Type normalized concurrency test - PASS (201 and 409; one persisted record)
- Shared mounted CRUD test - Risk Type segment PASS; stops at the later Control sentinel
- Closed Administration query/mutation/DTO unit test - PASS
- `corepack pnpm --filter @csrm/web exec vitest run src/features/administration/administration-service.test.ts` - PASS (5/5)
- Strict Risk Type list/detail payload test - PASS
- `corepack pnpm --filter @csrm/web typecheck` - PASS
- `corepack pnpm --filter @csrm/web api:check` - PASS
- Catalogue copies and content-type schemas were not modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-05 can mount the Risk Type UI directly on the closed service and Server Actions.
- Later collection and CSV plans retain their deliberate RED sentinels and fail-closed handlers.

## Self-Check: PASSED

- All eight created implementation files and both modified files exist.
- Commits `0c5e24d`, `933f087`, and `a63639e` exist in history.
- Risk Type mounted CRUD, denial ordering, normalized concurrency, strict DTO, typed-service, typecheck, and API drift claims were verified.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-01*
