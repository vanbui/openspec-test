---
phase: 06-administration-and-csv-imports
plan: 06
subsystem: administration-controls
tags: [strapi, nextjs, controls, pagination, zod, playwright]

requires:
  - phase: 06-05
    provides: capability-first generic Administration workspace and Risk Type vertical outcome
provides:
  - Authoritative server-paginated, searched, filtered, and sorted 2,646-record Control administration
  - Closed Control DTO, mutation, service, form, list, and detail adapters with no delete or sourceData exposure
  - Analyst-only responsive Control discovery and isolated Bob/Jane browser proof
affects: [06-07, 06-08, 06-09, administration-ui, csv-imports]

tech-stack:
  added: []
  patterns:
    - collection differences stay in the existing closed Administration adapter family
    - Control framework suggestions remain bounded to the current page while filtering stays server authoritative
    - natural-key writes serialize per collection and normalize both application and database conflicts

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-administration/services/administration-config.ts
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/web/src/features/administration/administration-config.ts
    - apps/web/src/features/administration/administration-workspace.tsx
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/e2e/administration-workflow.spec.ts

key-decisions:
  - "Keep Control inventory totals, search across control number/name/framework, framework/type filters, sorting, and pagination exclusively server authoritative."
  - "Use controlType as the canonical generated-contract filter key and reject unknown or invalid query values before repository access."
  - "Offer only current-page framework suggestions in the browser while accepting typed framework input so no bounded page is presented as a global facet inventory."

patterns-established:
  - "Control mutation DTOs allow only frozen scalar fields and project no sourceData, persistence metadata, relations, or contextual implementations."
  - "Control discovery is generated from the capability-gated navigation model at desktop and mobile widths; visibility remains presentation only."

requirements-completed: [ADMIN-02]

duration: 1h 9m
completed: 2026-09-02
---

# Phase 06 Plan 06: Control Administration Summary

**Authoritative 2,646-record Control administration with global server query semantics, closed scalar mutations, responsive typed UI, and isolated analyst/Requestor disclosure proof**

## Performance

- **Duration:** 1h 9m
- **Started:** 2026-09-01T16:19:27Z
- **Completed:** 2026-09-01T17:28:35Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Enabled mounted Control list/detail/create/update behavior through the existing Administration adapters while preserving the unchanged no-query assessment picker path.
- Applied search across `controlNumber`, `name`, and `framework`, exact framework/control-type filters, deterministic global sorting, authoritative count, and pagination before bounded hydration.
- Added strict web DTO/input schemas, generated-client services, Server Actions, responsive desktop/mobile presentation, closed reusable-Control forms, persistence reload, field-safe 409 conflicts, and no delete/sourceData surface.
- Added analyst-only desktop and mobile Control discovery plus one independently selected Playwright segment proving the exact 2,646 baseline, dynamic server query behavior, accessibility, persistence, and Requestor non-enumeration.

## Task Commits

1. **Task 1 RED: Add failing Control administration contract** - `5668a58` (test)
2. **Task 1 GREEN: Enable authoritative Control administration** - `0399e54` (feat)
3. **Task 2 RED: Add failing Control discovery journey** - `3891cc3` (test)
4. **Task 2 GREEN: Expose complete Control administration journey** - `30ffe23` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/services/administration-config.ts` - Closed search/filter/projection and writable-field Control configuration.
- `apps/strapi/src/api/csrm-administration/services/administration-query.ts` - Strict Control query, mutation, enum, and DTO projection validation.
- `apps/strapi/src/api/csrm-administration/services/administration-repository.ts` - Shared pre-count/pre-page global search and filters with bounded hydration.
- `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` - Control enablement, per-kind natural-key serialization, safe conflicts, and non-enumerating errors.
- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` and `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` - Existing mounted Control CRUD handlers and canonical shared-path Administration dispatch.
- `apps/web/src/features/administration/*` - Closed Control schemas, typed transport, Server Actions, configuration, responsive list, and create/edit detail forms.
- `apps/web/app/(app)/app/admin/[collection]/*` - Capability-first Control list/create/detail route composition.
- `apps/web/src/config/navigation/navigation.ts` and `apps/web/src/components/shell/capability-navigation.tsx` - Analyst-only Control discovery at desktop and mobile widths.
- Mounted, component, and isolated Playwright tests - Global query, mutation, accessibility, persistence, no-delete, denial, and non-enumeration proof.

## Decisions Made

- The browser never infers a global Control catalogue from a page. It renders at most 100 authoritative records, and every search/filter/sort/page transition returns to Strapi.
- Framework remains free typed input with suggestions derived only from the current bounded page. This supports new analyst-authored frameworks without hardcoded picker search literals or false global facet claims.
- The mounted test harness contains two isolated Control fixtures in addition to the canonical 2,646 library; the clean isolated E2E environment proves the exact 2,646 product baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended the complete existing adapter family beyond the abbreviated plan file list**
- **Found during:** Task 1
- **Issue:** Backend query/repository/controllers and web schema/service/actions/workspace/App Router files still contained Risk-Type-only guards, so changing configuration and workflow alone could not produce a real Control vertical outcome.
- **Fix:** Extended only the existing shared Administration adapter family; added no layer, route, schema, dependency, authorization grant, or API facade.
- **Files modified:** `administration-query.ts`, `administration-repository.ts`, both existing controllers, web schema/service/actions/workspace, and existing dynamic App Router pages.
- **Verification:** Strapi compile, mounted Control HTTP proof, web typecheck/component tests, generated API check, integrity gate, and isolated E2E pass.
- **Committed in:** `0399e54`

**2. [Rule 1 - Bug] Corrected the canonical Control type filter key**
- **Found during:** Task 1
- **Issue:** The shared-path dispatcher allowed `type`, while the frozen generated contract and Administration DTO use `controlType`.
- **Fix:** Aligned closed web/backend parsing and dispatch to `controlType`; invalid enums and unknown keys fail before repository access.
- **Files modified:** `csrm-risk/controllers/csrm-risk.ts`, Administration query/schema adapters.
- **Verification:** Mounted combined framework/controlType filter returns only the persisted Preventive Control; `api:check` remains green.
- **Committed in:** `0399e54`

**3. [Rule 3 - Blocking] Made narrow-width Control discovery use the capability-gated navigation model**
- **Found during:** Task 2 isolated E2E
- **Issue:** The inherited 375 px shortcut rendered only Risk Types even after Controls entered the grouped navigation configuration.
- **Fix:** Derived all visible Administration shortcuts from the existing capability-filtered navigation model and allowed wrapping without horizontal overflow.
- **Files modified:** `capability-navigation.tsx`.
- **Verification:** 375/768/1280/1440 overflow checks and Bob/Jane discovery assertions pass.
- **Committed in:** `30ffe23`

**4. [Rule 2 - Missing Critical] Closed Control list accessibility defects found by the required axe gate**
- **Found during:** Task 2 isolated E2E
- **Issue:** A manually assigned combobox role lacked required ARIA state, and the inherited primary token pairing failed contrast on the Control CTA.
- **Fix:** Used the native input+datalist combobox contract with bounded page suggestions and an accessible semantic outline CTA variant.
- **Files modified:** `administration-workspace.tsx`.
- **Verification:** Serious/critical axe results are empty and keyboard focus remains visible.
- **Committed in:** `30ffe23`

---

**Total deviations:** 4 auto-fixed (2 Rule 2 missing critical, 1 Rule 1 bug, 1 Rule 3 blocker).
**Impact on plan:** Every deviation was necessary for the declared Control correctness, accessibility, and end-to-end outcome. No later collection, CSV implementation, schema, dependency, or authorization surface was added.

## TDD Gate Compliance

- Task 1 RED `5668a58` reached the mounted `/v1/controls` route and failed on the real Risk-Type-only workflow guard; the component contract failed on the real Control configuration guard.
- Task 1 GREEN `0399e54` follows RED and passes mounted, component, schema, typecheck, generated-contract, and integrity checks.
- Task 2 RED `3891cc3` failed on the absent capability-gated Controls navigation link.
- Task 2 GREEN `30ffe23` follows RED and passes focused discovery plus the independently selected browser journey.
- No sentinel, `execArgv`, file-existence, early-return, skip/fixme, or tautological-fixture escape was introduced.

## Verification Evidence

- Strapi production/test TypeScript compilation — PASS.
- Mounted `ADMIN-02 Controls` HTTP test — PASS: 200 bounded list/filter/detail/update, 201 create, safe 400 overpost, concurrent 201/409 natural-key result, persistence reload.
- Administration component contract — PASS, 7 relevant tests; later-plan CSV RED tests remain deliberately unselected.
- Administration canonical schema contract — PASS, 2/2 relevant tests.
- `corepack pnpm --filter @csrm/web typecheck` — PASS.
- `corepack pnpm --filter @csrm/web api:check` — PASS.
- `node scripts/verify-phase-06-integrity.mjs` — PASS: frozen schemas, byte-identical catalogues, 24 token gates, no delete/raw fetch/facade, derived isolation, anti-escape scan, and generated contract.
- Correctly forwarded targeted Playwright command selected exactly one `@administration-controls` test — PASS, 1/1 in 1.5 minutes against derived ports and a UUID SQLite database.

## Known Stubs

- `Import CSV` intentionally links to `/app/admin/controls/import`; the five-step Control import implementation remains owned by Plans 06-08/06-09. It does not block ADMIN-02 list/create/view/edit behavior, and Jane’s route is capability-gated before record interpretation.

## Issues Encountered

- On this Windows/pnpm combination, the documented extra `--` was forwarded literally to Playwright and caused later System/Asset segments to start. Only validated derived process trees were stopped; the equivalent correctly forwarded command selected exactly the one Control test and passed. Live 1337/3000 and `apps/strapi/.tmp/data.db` were untouched.
- Two early E2E attempts exposed real mobile discovery and accessibility issues; both were fixed and the final isolated rerun passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Control administration is complete and ready for Plan 06-07 to extend the same adapters to Information Systems and Information Assets.
- No unresolved HIGH threat remains for Control route bypass, Requestor disclosure, stale delete mutation, natural-key conflict, or client-authoritative totals.

## Self-Check: PASSED

- All 19 modified files exist, and task commits `5668a58`, `0399e54`, `3891cc3`, and `30ffe23` exist in history.
- Frozen schema hashes and catalogue bytes match; generated API output is clean.
- Mounted Control, focused web, integrity, and isolated single-segment E2E gates all pass.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
