---
phase: 06-administration-and-csv-imports
plan: 02
subsystem: api-authorization
tags: [strapi, authorization, administration, routing, catalogue, compatibility]

requires:
  - phase: 06-administration-and-csv-imports
    plan: 01
    provides: mounted denial, persistence, catalogue, and integrity RED contracts
provides:
  - Closed 24-operation Administration FunctionAPI inventory with exact human Security Analyst grants
  - Token-first /v1 route boundary with authoritative Administration collection scope
  - Single-owner legacy picker versus canonical Administration list dispatch
  - Generic mutation and delete route lockdown with retained Requestor reference reads
affects: [06-03-contract-catalogue, 06-04-administration-crud, 06-08-csv-import, 06-10-phase-green]

tech-stack:
  added: []
  patterns: [explicit token gate per route, query-selected exact grant, fail-closed controller surface, persistence-verified route absence]

key-files:
  created:
    - apps/strapi/src/api/csrm-administration/operations.ts
    - apps/strapi/src/api/csrm-administration/routes/csrm-administration.ts
    - apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts
  modified:
    - apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/operations.ts
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/src/api/csrm-risk-type/routes/csrm-risk-type.ts
    - apps/strapi/src/api/csrm-control/routes/csrm-control.ts
    - apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts
    - apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts
    - apps/strapi/tests/authorization.integration.test.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json

key-decisions:
  - "Represent legacy Risk Type and Control picker grants as distinct query-qualified FunctionAPI operations while retaining the unchanged no-query HTTP contract."
  - "Treat any explicit picker-route query as an Administration request for exact-grant and human-analyst authorization before closed query parsing."
  - "Keep unavailable downstream CRUD/import handlers fail closed with safe 400 responses until their owning implementation plans land."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04]

duration: 44 min
completed: 2026-09-01
---

# Phase 6 Plan 2: Administration Authorization Boundary Summary

**Exact human-analyst Administration grants, token-first route enforcement, compatibility-safe picker dispatch, and complete generic mutation/delete lockdown**

## Performance

- **Duration:** 44 min
- **Started:** 2026-09-01T13:27:00Z
- **Completed:** 2026-09-01T14:11:30Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Added exactly 24 unique no-delete Administration operations and mounted each through an explicit content API token gate, application-enabled policy, exact FunctionAPI grant, and human Security Analyst scope.
- Preserved the single existing `/v1/risk_types` and `/v1/controls` GET owners: no-query requests retain the legacy `{ data }` picker contract, while explicit queries switch to the Administration grant and scope before parsing.
- Made both catalogue copies byte-identical, removed stale Administration DELETE and unrelated duplicate operations, and excluded Requestor and Security Analyst Agent roles from Administration functions.
- Disabled every generic Risk Type and Control route and retained only the already-authorized Information System/Asset collection reads required by Requestors.
- Replaced tautological missing-record route assertions with real persisted fixtures, count checks, unchanged-record comparisons, and 404/405 non-enumeration assertions.

## Task Commits

1. **Task 1: Mount exact analyst-only Administration operations** - `c9b50d5` (feat)
2. **Task 2: Remove stale generic mutation and delete exposure** - `811b59f` (fix)
3. **Rule 1 regression fix: Decouple inherited assessment fixtures from removed generic mutation** - `3932ab7` (test)
4. **Rule 3 integrity fix: Make every token gate mechanically explicit** - `77b82e2` (fix)

## Decisions Made

- Gave the unchanged no-query assessment pickers distinct query-qualified catalogue operation identities so their agent-compatible grant cannot authorize canonical Administration requests on the same HTTP paths.
- Classified every non-empty picker query as Administration at the policy layer; the controller then rejects partial or unknown canonical shapes before any collection lookup.
- Kept the new Administration controller surface deliberately fail closed until Plans 06-04 and 06-09 supply CRUD and import workflows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Reconciled the exact catalogue boundary in the route task**
- **Found during:** Task 1
- **Issue:** The existing catalogue contained duplicate/stale operations, four DELETE grants, and Administration membership for the analyst agent, so exact route policies could not meet the plan's human-only one-grant invariant.
- **Fix:** Reconciled both byte-identical catalogue copies to the closed 24-operation inventory and introduced distinct assessment-picker grants.
- **Files modified:** Both FunctionAPI catalogue copies and `csrm-risk/operations.ts`
- **Verification:** One catalogue match per Administration operation, zero Administration DELETE entries, and byte comparison pass.
- **Commit:** `c9b50d5`

**2. [Rule 3 - Blocking Issue] Added a fail-closed controller registration surface**
- **Found during:** Task 1 mounted startup verification
- **Issue:** Strapi cannot register routes that reference an absent controller; deferred inline controller resolution blocked harness bootstrap.
- **Fix:** Added safe 400 handlers for the downstream operations so authorization policies execute now and later plans can replace handlers without remounting routes.
- **Files modified:** `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts`
- **Verification:** Mounted harness starts and all T-06-01 denial cases pass.
- **Commit:** `c9b50d5`

**3. [Rule 1 - Regression] Removed inherited test dependence on the retired generic Risk Type POST route**
- **Found during:** Overall Strapi verification after Task 2
- **Issue:** An assessment lifecycle test created deterministic Risk Types through the generic route that this plan intentionally removed, cascading failures through inherited assessment tests.
- **Fix:** Seeded those test-only Risk Types directly in the isolated mounted harness and removed the stale HTTP fixture setup.
- **Files modified:** `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/assessment-workflow.integration.test.ts`
- **Verification:** Focused mounted assessment draft lifecycle passes; the full suite has no inherited assessment failures.
- **Commit:** `3932ab7`

**4. [Rule 3 - Blocking Issue] Expanded route declarations for the integrity gate**
- **Found during:** Phase 6 integrity verification
- **Issue:** A route helper made the token boundary executable but prevented the non-negotiable integrity gate from counting each route and token strategy explicitly.
- **Fix:** Expanded all 22 Administration route declarations; the existing two picker routes remain explicit in `csrm-risk`.
- **Files modified:** `apps/strapi/src/api/csrm-administration/routes/csrm-administration.ts`
- **Verification:** Integrity reports 24 routes, 24 token gates, and 24 operations.
- **Commit:** `77b82e2`

**Total deviations:** 4 auto-fixed (1 missing critical functionality, 1 regression, 2 blocking issues). **Impact:** The authorization boundary is complete and auditable; downstream CRUD/import behavior remains intentionally RED for its owning plans.

## Verification Evidence

- TypeScript application and test compilation — PASS under Node v24.19.0.
- Focused catalogue, route inventory, legacy picker, and agent-denial tests — PASS (3/3).
- Mounted T-06-01 denial-before-parse matrix — PASS across all four collections, token absence, Requestor, agent, and missing-grant identities.
- Mounted stale generic route test — PASS with real fixtures, 404/405 responses, unchanged counts/records, and retained Requestor System/Asset reads.
- Mounted inherited assessment draft lifecycle — PASS after direct isolated fixture setup.
- `node scripts/verify-phase-06-integrity.mjs` — PASS, including frozen schemas, catalogue identity, no-delete closure, test anti-escape checks, live-port isolation, and 24 explicit token gates.
- `corepack pnpm --filter @csrm/strapi test` — 101/109 pass; the remaining eight failures are the honest downstream Phase 6 RED contracts for absent Administration query/CRUD and CSV services owned by Plans 06-04 through 06-09. No inherited workflow failure remains.

## Known Stubs

- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` — fail-closed safe 400 handlers intentionally reserve the authorized route surface. Plan 06-04 replaces CRUD/list handlers; Plan 06-09 replaces preview/import handlers. These stubs do not bypass authorization or prevent Plan 06-02's route-boundary goal.

## Issues Encountered

- The complete Strapi suite remains intentionally RED only for eight downstream Administration behavior contracts. Turning those tests green here would violate plan ownership and collapse the phase's attributable progression.
- Existing generated web/debug worktree changes were preserved and excluded from every plan commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 06-03 to finalize the OpenAPI/contract documentation around this exact route and grant inventory.
- The route boundary, catalogue identity, legacy picker compatibility, generic-route lockdown, inherited assessment workflows, and Phase 6 integrity gate are ready for downstream CRUD and import implementation.

## Self-Check: PASSED

- All declared and deviation-created files exist.
- Task and deviation commits `c9b50d5`, `811b59f`, `3932ab7`, and `77b82e2` exist in history.
- Both catalogue copies are byte-identical and the Phase 6 integrity gate passes.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-01*
