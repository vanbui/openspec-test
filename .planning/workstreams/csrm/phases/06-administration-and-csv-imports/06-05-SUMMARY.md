---
phase: 06-administration-and-csv-imports
plan: 05
subsystem: administration-ui
tags: [nextjs, react-hook-form, zod, shadcn, capabilities, playwright]

requires:
  - phase: 06-04
    provides: authoritative Risk Type CRUD and typed Server Actions
provides:
  - Capability-first Risk Type list, create, and detail/edit App Router routes
  - Responsive five-state workspace and validated reusable Risk Type forms
  - Analyst-only grouped Administration discovery with Requestor non-disclosure
affects: [06-06, 06-08, 06-09, administration-ui, csv-imports]

tech-stack:
  added: []
  patterns:
    - capability is resolved before any collection configuration, query, or service read
    - server-rendered typed records feed a focused interactive workspace and RHF form boundary
    - bounded relation options fall back to sequenced typed server search without raw fetch

key-files:
  created:
    - apps/web/src/features/administration/administration-workspace.tsx
    - apps/web/app/(app)/app/admin/[collection]/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/new/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx
  modified:
    - apps/web/src/features/administration/administration-actions.ts
    - apps/web/src/lib/capabilities/capability-adapter.ts
    - apps/web/src/lib/capabilities/development-capabilities.ts
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/src/components/shell/capability-navigation.tsx
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - apps/web/e2e/administration-workflow.spec.ts

key-decisions:
  - "Treat administration:manage as presentation capability only; every route resolves it before reads while Strapi remains the authorization authority."
  - "Project no more than 100 deterministic Control options to the client and use sequenced typed server search for off-page matches."
  - "Keep Risk Types as the only operable Administration collection in this wave; CSV import and later collections retain their later-plan boundaries."

patterns-established:
  - "Denied Administration routes render one non-enumerating permission state with no list chrome, counts, forms, or record lookup."
  - "Create/update failures retain values, map 409 conflicts to name, and revalidate only after authoritative success."

requirements-completed: [ADMIN-01]

duration: 1h 18m
completed: 2026-09-02
---

# Phase 06 Plan 05: Risk Type Administration Workspace Summary

**Capability-first Risk Type administration with responsive list states, dedicated validated create/edit pages, bounded Control selection, and end-to-end Bob/Jane disclosure proof**

## Performance

- **Duration:** 1h 18m
- **Started:** 2026-09-01T14:55:31Z
- **Completed:** 2026-09-01T16:13:29Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Mounted `/app/admin/risk-types` list, create, and detail/edit routes with capability checks before collection parsing or service access.
- Added canonical URL search/sort/paging, 300 ms search, mobile cards, desktop table, five deliberate states, exact Risk Type copy, retained form values, 409 mapping, unsaved-change confirmation, downstream context, and no delete surface.
- Added a bounded applicable-Control picker that accepts dynamic search input, suppresses stale responses, and persists only server-authorised document IDs.
- Added analyst-only grouped Administration discovery while keeping Requestor navigation and all direct routes non-enumerating.
- Proved the isolated Bob/Jane journey: create, relation selection, edit, reload persistence, no delete, and Requestor denial across list/create/detail/import URLs.

## Task Commits

1. **Task 1 RED: Extend Risk Type workspace contract** - `07fc8b4` (test)
2. **Task 2 RED: Add Administration navigation contract** - `f173e8b` (test)
3. **Task 1 GREEN: Mount Risk Type workspace** - `27496b2` (feat)
4. **Task 2 GREEN: Gate grouped Administration navigation** - `90db0fd` (feat)
5. **Picker and E2E correctness fixes** - `71034bc`, `943f184`, `89080fc`, `1462bb4`, `1ba4167`, `d89d8bc`, `60c3b8d`, `f7af3b1`, `5bbd89a`, `128dc66` (fix)

## Files Created/Modified

- `apps/web/src/features/administration/administration-workspace.tsx` - Responsive list states, canonical navigation, validated forms, applicable-Control selection, and downstream detail context.
- `apps/web/app/(app)/app/admin/[collection]/page.tsx` - Capability-first typed Risk Type list route.
- `apps/web/app/(app)/app/admin/[collection]/new/page.tsx` - Capability-first create route with bounded relation options.
- `apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx` - Non-enumerating detail/edit route and authoritative reload.
- `apps/web/src/features/administration/administration-actions.ts` - Validated dynamic applicable-Control search through the typed server boundary.
- `apps/web/src/lib/capabilities/*`, navigation configuration, and shell navigation - Singular analyst-only Administration capability and grouped responsive discovery.
- Administration component/capability/E2E tests - RED/GREEN coverage and robust intended-alert selection.

## Decisions Made

- Navigation remains presentation only. The Server Component routes check `administration:manage` before interpreting caller-controlled collection, query, or document identifiers; Strapi still enforces token, exact FunctionAPI, role, and record authority.
- The browser never receives the complete 2,646-Control catalogue. Server pages project at most 100 deterministically ordered authorised options; dynamic off-page search remains typed, bounded, and stale-suppressed.
- Risk Type paths were corrected to the approved `/app/admin/risk-types` route family; the earlier `/app/administration/risk-types` configuration was treated as a directly blocking contract bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the inherited Risk Type route family**
- **Found during:** Task 1
- **Issue:** Plan 06-04 configured `/app/administration/risk-types`, conflicting with the approved UI contract and declared App Router files.
- **Fix:** Changed list/create/detail links to `/app/admin/risk-types` before mounting routes.
- **Files modified:** `administration-config.ts`
- **Verification:** Component links and isolated browser navigation pass.
- **Committed in:** `27496b2`

**2. [Rule 2 - Missing Critical] Added bounded authoritative applicable-Control selection**
- **Found during:** Task 1 E2E verification
- **Issue:** Risk Type forms could not complete their declared writable relation field without a typed, bounded picker.
- **Fix:** Added dynamic validated server search, deterministic bounded initial options, authorised relation fallbacks, accessibility labeling, and stale suppression.
- **Files modified:** `administration-actions.ts`, `administration-workspace.tsx`, create/detail routes
- **Verification:** Typecheck, component tests, integrity gate, and isolated E2E relation selection pass.
- **Committed in:** `71034bc` through `5bbd89a`

**3. [Rule 3 - Blocking] Completed narrow-width discovery and role-transition controls**
- **Found during:** Task 2 E2E verification
- **Issue:** The inherited mobile drawer kept the new group, Risk Types link, and development role transition unreachable to the locked 375 px journey without opening unrelated UI.
- **Fix:** Added capability-gated narrow-width Administration discovery and development sign-out control while retaining the full modal navigation.
- **Files modified:** `capability-navigation.tsx`
- **Verification:** Bob discovery and Jane sign-in transition pass in isolated E2E.
- **Committed in:** `943f184`, `128dc66`

**4. [Rule 3 - Blocking] Scoped the E2E permission alert to the intended state**
- **Found during:** Task 2 E2E verification
- **Issue:** Next's route announcer also has `role=alert`, producing a strict-locator collision without weakening either accessibility surface.
- **Fix:** Filtered the locator by the exact non-disclosure permission copy.
- **Files modified:** `administration-workflow.spec.ts`
- **Verification:** All four Jane denial URLs pass.
- **Committed in:** `128dc66`

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical workflow, 2 Rule 3 blockers).
**Impact on plan:** All changes were required to satisfy the locked Risk Type UI, accessibility, route, and disclosure contracts. No later collection or CSV implementation was pulled forward.

## TDD Gate Compliance

- RED `07fc8b4` failed on the absent workspace and create/edit behavior.
- RED `f173e8b` failed on the absent analyst capability and Administration group.
- GREEN `27496b2` and `90db0fd` follow both RED commits; focused component/capability tests pass.
- No PHASE6_RED, execArgv, file-existence, early-return, tautological fixture, or assertion escape was added.

## Verification Evidence

- Risk Type workspace component contract — PASS, 5/5 focused tests.
- Capability/navigation contract — PASS, 6/6 focused tests.
- `corepack pnpm --filter @csrm/web typecheck` — PASS.
- `corepack pnpm --filter @csrm/web api:check` — PASS.
- `node scripts/verify-phase-06-integrity.mjs` — PASS, including frozen schemas, byte-identical catalogues, token gates, no raw fetch/facade/delete, isolated ports, and anti-escape checks.
- `playwright test ... --grep @administration-risk-types` — PASS, 1/1 against derived ports and a process-unique SQLite database. A non-persistent 300-second startup allowance was used because this filesystem intermittently exceeded the repository's 120-second server-start limit; the checked-in timeout remains unchanged.
- The broader Administration workflow file retains three honest CSV RED tests for Plans 06-08/06-09; the Risk Type and capability portions are GREEN.

## Known Stubs

- `Import CSV` intentionally links to the reserved `/app/admin/risk-types/import` route, whose actual five-step import UI remains owned by Plans 06-08/06-09. It does not block ADMIN-01 list/create/view/edit behavior and remains capability-gated/non-enumerating for Jane.

## Issues Encountered

- Repeated forcibly bounded E2E diagnostics left derived-port Playwright children alive on Windows. Only validated process trees created by these isolated runs were stopped; live 1337/3000 services and `apps/strapi/.tmp/data.db` were never touched.
- Slow filesystem startup required a temporary, uncommitted Playwright server timeout increase for final verification. The production tree and checked-in test configuration were restored before close-out.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Risk Type UI is complete and ready for Plan 06-06 to add Control administration using the same route and presentation boundary.
- CSV import remains intentionally deferred to its owning plans.
- No unresolved HIGH threat remains for direct-route bypass, Requestor disclosure, malformed action input, or delete exposure.

## Self-Check: PASSED

- All four created files and all declared modified files exist.
- RED/GREEN and fix commits `07fc8b4` through `128dc66` exist in history.
- Focused tests, typecheck, generated API drift, Phase 6 integrity, frozen schema/catalogue checks, and isolated Bob/Jane E2E all pass.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
