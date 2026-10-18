---
phase: 06-administration-and-csv-imports
plan: 01
subsystem: testing
tags: [node-test, vitest, playwright, strapi, csv, authorization, integrity]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: mounted Strapi HTTP harness, derived-port Playwright lifecycle, and integrity-gate patterns
provides:
  - Attributable Bob/Jane Administration browser RED contract with four independently selectable segments
  - Mounted authorization, CRUD, CSV-bound, five-state, rollback, and non-enumeration acceptance contracts
  - Frozen-schema and cross-layer Phase 6 integrity gate
affects: [06-02-route-authorization, 06-03-contracts, 06-04-administration-crud, 06-08-csv-parsing, 06-10-phase-green]

tech-stack:
  added: []
  patterns: [attributable RED wrapper, persistence-verified denial, five-state CSV contract, frozen-schema hash gate]

key-files:
  created:
    - apps/web/e2e/administration-workflow.spec.ts
    - apps/web/scripts/verify-administration-red.mjs
    - apps/strapi/tests/administration.unit.test.ts
    - apps/strapi/tests/administration.integration.test.ts
    - apps/web/src/features/administration/administration-schema.test.ts
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - scripts/verify-phase-06-integrity.mjs
  modified:
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/authorization.integration.test.ts

key-decisions:
  - "Keep each Administration E2E segment independently selectable with its own health, sign-in, and shell baseline."
  - "Treat unchanged as a first-class CSV state whose persistence must remain byte-for-byte unchanged."
  - "Make authorization denials prove collection persistence before asserting the expected status."

patterns-established:
  - "Attributable RED: wrapper success requires the exact missing Administration navigation assertion after inherited baselines."
  - "Security denial: malformed identifiers, queries, and multipart files are denied before parsing and record counts are rechecked."
  - "Integrity closure: schema hashes, catalogue bytes, route gates, dependencies, test escapes, live ports, and transport boundaries are scanned together."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04]

duration: 45 min
completed: 2026-09-01
---

# Phase 6 Plan 1: Administration Acceptance and Integrity Prerequisite Summary

**Attributable Bob/Jane browser RED plus executable analyst-only CRUD, five-state CSV, persistence-denial, and integrity contracts**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-01T12:39:00Z
- **Completed:** 2026-09-01T13:24:36Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added four serial Playwright segments for Risk Types, Controls, Systems/Assets, and imports, each with independent derived-port health/auth/shell prerequisites.
- Extended the mounted Strapi harness with safe Administration fixtures, collection persistence probes, and multipart construction without touching the developer database.
- Defined closed query/DTO, exact 5 MiB/5,000-row/65,536-byte bounds, five distinct CSV states, digest drift, rollback, formula safety, and unchanged-zero-write contracts.
- Added an integrity gate covering frozen schemas, catalogue identity/delete exposure, token-only routes, test escapes, live ports, secrets, attribution, typed transport, frontend facades, and dependency changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing Bob/Jane end-to-end happy path** - `e1f2a81` (test)
2. **Task 2: Write focused security, workflow, and integrity contracts** - `662976b` (test)

## Files Created/Modified

- `apps/web/e2e/administration-workflow.spec.ts` - Four independently selectable Bob/Jane browser acceptance segments.
- `apps/web/scripts/verify-administration-red.mjs` - Node-built-ins-only attributable RED verifier.
- `apps/strapi/tests/administration.unit.test.ts` - Closed query, normalization, CSV grammar, bounds, classification, and formula-safety contracts.
- `apps/strapi/tests/administration.integration.test.ts` - Mounted authorization, CRUD, concurrency, digest, rollback, and persistence contracts.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Safe Administration fixtures, counts, record reads, and multipart builder.
- `apps/strapi/tests/authorization.integration.test.ts` - Exact 24-operation human-analyst/no-delete catalogue contract.
- `apps/web/src/features/administration/administration-schema.test.ts` - Canonical URL, closed DTO, and client CSV-bound contracts.
- `apps/web/src/features/administration/administration-workflow.test.tsx` - Responsive states, debounce, five-step import, and confirmation contracts.
- `scripts/verify-phase-06-integrity.mjs` - Phase-range integrity and security boundary gate.

## Decisions Made

- Kept the RED wrapper focused on `@administration-risk-types`; later segments cannot accidentally turn an earlier slice GREEN.
- Used process-unique `dylan-test-${process.pid}` mutation data while retaining stable seeded update/unchanged import fixtures.
- Required denial tests to compare authoritative record counts after every malformed request, including routes that are currently absent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The inherited aborted attempt left generated Next/Playwright artifacts and STATE changes. Legitimate Task 1 source was reviewed and completed; generated `.tmp`, `next-env.d.ts`, `tsconfig.json`, debug, and prior STATE changes were preserved and excluded from task commits.
- The focused suites are intentionally RED. Strapi fails only at absent Phase 6 modules/routes/dispatch, web fails only at absent Administration modules, and integrity fails at the planned pre-06-02 delete/catalogue/route gaps.

## Verification Evidence

- `node apps/web/scripts/verify-administration-red.mjs` — PASS; health, fixture sign-in, shell, actor, and reduced-motion baselines passed before the exact missing Administration navigation assertion.
- Strapi and web test TypeScript compilation — PASS with Node v24.19.0.
- `corepack pnpm --filter @csrm/strapi test` — expected RED only at absent `csrm-administration` modules/routes and canonical dispatch behavior; mounted bootstrap and seeding succeeded.
- `corepack pnpm --filter @csrm/web test -- src/features/administration` — expected RED only at absent Administration schema/workspace/CSV modules; 253 inherited tests remained green in the run.
- `node scripts/verify-phase-06-integrity.mjs` — all prerequisite/self-integrity checks pass; expected RED remains for four stale delete grants, four generic mutation/delete routers, and the absent token-only 24-operation boundary.

## Known Stubs

None. All created files are executable acceptance or integrity contracts; absent Phase 6 product modules are the intentional RED boundary for subsequent plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 06-02 to mount the token-only 24-operation Administration boundary and remove generic mutation/delete exposure.
- No unresolved harness, bootstrap, live-port, schema, catalogue-copy, dependency, or secret blocker exists.

## Self-Check: PASSED

- All nine declared files exist.
- Task commits `e1f2a81` and `662976b` exist in history.
- Final attributable RED wrapper passed after Task 2 was committed.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-01*
