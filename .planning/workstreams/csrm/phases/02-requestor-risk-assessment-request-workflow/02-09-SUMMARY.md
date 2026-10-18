---
phase: 02-requestor-risk-assessment-request-workflow
plan: 09
subsystem: full-stack
tags: [nextjs, strapi, dashboard, playwright, accessibility, authorization]

requires:
  - phase: 02-07
    provides: Owner-scoped typed request list, detail, and dashboard operations
  - phase: 02-08
    provides: Requestor create, draft edit, detail, and irreversible submit screens
  - phase: 02-12
    provides: Shared request validation, typed mutations, and Server Actions
provides:
  - Authorised data-driven Requestor dashboard with draft and questionnaire actions
  - Explicit service-backed unavailable release projection that never equates approval with release
  - Real dual-server Requestor acceptance journey with responsive, accessibility, persistence, and denial evidence
affects: [requestor-dashboard, request-workflow, phase-02-verification, phase-08-authentication]

tech-stack:
  added: []
  patterns: [server-only dashboard projection, allowlisted generated-query normalization, isolated real-data Playwright acceptance]

key-files:
  created:
    - apps/web/src/features/dashboard/requestor-dashboard-service.ts
    - apps/web/src/features/dashboard/requestor-dashboard.tsx
    - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/web/app/(app)/app/loading.tsx
    - apps/web/app/(app)/app/error.tsx
    - apps/web/src/features/requests/request-form-values.ts
  modified:
    - apps/web/app/(app)/app/page.tsx
    - apps/web/e2e/requestor-request-workflow.spec.ts
    - apps/web/playwright.config.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/bootstrap/seed-csrm-data.ts

key-decisions:
  - "Represent recently released assessments as an explicit contract-unavailable projection until Strapi persists an authoritative release fact; approval alone is never release."
  - "Normalize only the generated allowlisted sort and populate shapes at the owner-scoped Strapi collection boundary."
  - "Run final browser acceptance against a dedicated seeded SQLite database and real mounted Strapi services."

patterns-established:
  - "Dashboard pages load typed state in a Server Component and pass a closed ready/loading/error/permission union to presentation."
  - "Integration contracts prove both generated query serialization and mounted server interpretation before browser acceptance."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 31 min
completed: 2026-08-29
---

# Phase 02 Plan 09: Requestor Dashboard and Browser Acceptance Summary

**Authorised dashboard projections now drive responsive request and questionnaire actions, while a real Strapi-backed browser journey proves create-through-submit behavior without inventing assessment release semantics.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-29T14:00:30Z
- **Completed:** 2026-08-29T14:31:39Z
- **Tasks:** 3 completed
- **Files modified:** 19

## Accomplishments

- Added a server-only dashboard service that derives draft and questionnaire actions solely from owner-scoped typed request records and exposes permission, transport, malformed, empty, and populated outcomes deliberately.
- Replaced the Workspace placeholder with responsive semantic cards, real counts and links, icon-plus-label statuses, route skeleton/error handling, and a contract-honest released-assessment state.
- Turned the original Requestor browser contract green through mounted Strapi: create, relation persistence, reload, edit, irreversible submit, authoritative timestamp/status, list controls, dashboard behavior, mobile focus/overflow, and unauthenticated direct-route denial.
- Preserved mounted cross-owner IDOR coverage and made the generated dashboard query executable without allowing sponsor or other relation expansion.

## Task Commits

Each task was committed atomically:

1. **02-W0-04: Specify data-driven dashboard projections and five states** - `9ae4c84` (test)
2. **02-09-02: Build the authorised Requestor dashboard** - `a41e1db` (feat)
3. **02-W0-05-GREEN: Complete the browser journey and full Phase 2 gate** - `25910eb` (fix)

## Files Created/Modified

- `apps/web/src/features/dashboard/requestor-dashboard-service.ts` - Closed authorised dashboard projection and safe load-state mapping.
- `apps/web/src/features/dashboard/requestor-dashboard.tsx` - Responsive request, questionnaire, release-gap, loading, error, and permission presentation.
- `apps/web/src/features/dashboard/requestor-dashboard.test.tsx` - Typed projection, release-gap, and five-state behavior contract.
- `apps/web/app/(app)/app/page.tsx` - Dashboard Server Component with typed service load and create action.
- `apps/web/e2e/requestor-request-workflow.spec.ts` - Real create, persist, edit, submit, query, dashboard, mobile, and denial journey.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` - Owner-scoped generated sort/search/populate interpretation.
- `apps/strapi/src/bootstrap/seed-csrm-data.ts` - Idempotent authorised system and asset fixtures for isolated development acceptance.
- `apps/web/src/features/requests/request-form-values.ts` - Server-safe mapping from hydrated requests to edit defaults.

## Decisions Made

- Assessment approval remains distinct from assessment release. The dashboard returns zero released items with explicit unavailable metadata until an authoritative persisted release field exists.
- The collection controller accepts generated nested sort objects and only the `questionnaire` and `assessment` populate values; hostile sponsor population continues to be dropped.
- The canonical OpenAPI response remains `200` for assessment-request creation, so the mounted controller and tests now match the typed client contract.
- Playwright uses `.tmp/playwright-02-09.db`; the developer database at `.tmp/data.db` was never modified or removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned generated dashboard queries with mounted collection parsing**
- **Found during:** Task 3 mounted dashboard load
- **Issue:** Generated nested sort parameters were rejected, `_q` was ignored, and allowlisted questionnaire/assessment populate values were discarded.
- **Fix:** Normalized generated sort/search/populate shapes inside the existing owner-scoped collection boundary while continuing to drop sponsor expansion.
- **Files modified:** `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts`, `apps/strapi/tests/request-workflow.integration.test.ts`
- **Verification:** Mounted generated-query test, Strapi 10/10, and full Playwright 9/9 pass.
- **Committed in:** `25910eb`

**2. [Rule 3 - Blocking] Supplied deterministic authorised reference fixtures**
- **Found during:** Task 3 relation persistence journey
- **Issue:** Isolated Playwright databases seeded identities and grants but no information system or asset, so the original persisted-relation contract could not execute.
- **Fix:** Added idempotent development seed fixtures and moved acceptance to its dedicated SQLite filename without touching the developer database.
- **Files modified:** `apps/strapi/src/bootstrap/seed-csrm-data.ts`, `apps/web/playwright.config.ts`
- **Verification:** The browser selects, saves, reloads, and rechecks both persisted relations.
- **Committed in:** `25910eb`

**3. [Rule 1 - Bug] Matched create responses and nullable transport facts to the typed action boundary**
- **Found during:** Task 3 draft creation
- **Issue:** Mounted create returned undocumented `201`, and the mutation parser rejected authoritative nullable fields, producing a false service-unavailable result.
- **Fix:** Returned the specified `200` response and normalized the transport request shape before constructing the mutation result.
- **Files modified:** `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`, `apps/strapi/tests/authorization.integration.test.ts`, `apps/strapi/tests/request-workflow.integration.test.ts`, `apps/web/src/features/requests/request-schema.ts`
- **Verification:** Create redirects to the real document, focused service/action tests pass, and mounted POST assertions pass.
- **Committed in:** `25910eb`

**4. [Rule 3 - Blocking] Moved edit-default mapping across the Server/Client boundary**
- **Found during:** Task 3 draft resume/edit
- **Issue:** The edit Server Component invoked an exported function from a Client Component, which Next.js rejects at runtime.
- **Fix:** Extracted the mapping into a server-safe feature module shared by the page and client workflow.
- **Files modified:** `apps/web/src/features/requests/request-form-values.ts`, `apps/web/src/features/requests/request-form.tsx`, `apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx`
- **Verification:** Strict typecheck, request form/workflow tests, and persisted Playwright edit pass.
- **Committed in:** `25910eb`

**5. [Rule 2 - Missing Critical Functionality] Restored reachable request inventory navigation**
- **Found during:** Task 3 mobile journey
- **Issue:** The Requestor had read capability but no My Requests navigation entry.
- **Fix:** Added the capability-gated My Requests item; authorization remains enforced by Strapi.
- **Files modified:** `apps/web/src/config/navigation/navigation.ts`
- **Verification:** Keyboard mobile navigation reaches My Requests and the full shell suite passes at six viewports.
- **Committed in:** `25910eb`

**6. [Rule 1 - Bug] Corrected dashboard CTA contrast**
- **Found during:** Full Playwright axe gate
- **Issue:** The link CTA inherited foreground text on the primary background and failed WCAG AA contrast.
- **Fix:** Bound the CTA text explicitly to the semantic primary-foreground token.
- **Files modified:** `apps/web/app/(app)/app/page.tsx`
- **Verification:** Axe reports zero violations.
- **Committed in:** `25910eb`

---

**Total deviations:** 6 auto-fixed (3 bugs, 1 missing critical functionality, 2 blocking issues).

**Impact:** Every deviation was required to execute the existing typed, authorised Phase 2 contract through real services. No dependency, frontend API facade, new endpoint, content-type schema, sponsor access, or authorization bypass was introduced.

## Issues Encountered

The first dual-server attempts exposed integration behavior that isolated unit mocks could not reveal. Each failure received a mounted or browser-level regression assertion before the final locked gate was rerun.

## Known Stubs

- `apps/web/src/features/dashboard/requestor-dashboard-service.ts:63` - The empty released-assessment array is intentional and typed as `contract-unavailable`; the persisted model has no authoritative release fact. This does not block the plan because honest gap presentation is the required Phase 2 behavior.

## Verification

- `cd apps/strapi && npm test` - PASS (10/10)
- `cd apps/web && pnpm typecheck` - PASS
- `cd apps/web && pnpm test` - PASS (42/42 across 15 files)
- `cd apps/web && pnpm test:e2e` - PASS (9/9, including axe and 375-1440 responsive coverage)
- Focused RED emitted only `PHASE2_RED_W0_04_DASHBOARD_PROJECTION_ABSENT` - PASS
- Ports 1337, 3000, and 3100 are free after verification - PASS

## Threat Flags

None. The existing assessment-request trust boundary gained stricter allowlisted query interpretation and mounted evidence; no new endpoint, authentication path, file-access pattern, schema, or client authority was added.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- All 19 created or modified plan files exist.
- Task commits `9ae4c84`, `a41e1db`, and `25910eb` exist in repository history.
- All task acceptance criteria and all four exact locked phase commands pass.
- The only identified stub is the intentional documented release-contract gap required by the plan.

## Next Phase Readiness

- Phase 2 is complete with REQ-01 through REQ-05 and T-02 controls exercised through mounted and browser tests.
- The assessment release fact remains an explicit future contract decision; no Phase 2 behavior depends on an invented value.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
