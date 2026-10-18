---
phase: 05-risk-register-and-mitigation-management
plan: 02
subsystem: api
tags: [strapi, sqlite, authorization, risk-register, pagination]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Attributable Risk Register acceptance boundary from Plan 05-01
  - phase: 04-assessment-generation-review-and-release
    provides: Contextual Risk workflows, exact-grant authorization, and isolated mounted HTTP harness
provides:
  - Authenticated analyst-only GET /api/v1/risks route
  - Closed flat Risk Register query parser with the locked filter and sort matrix
  - SQLite-backed semantic severity and null-last target-date ordering before pagination
  - Honest distinct totals, bounded hydration, positive Risk projection, and selected relation labels
affects: [05-03, 05-04, 05-05, 05-09, phase-08-production-dialect-validation]

tech-stack:
  added: []
  patterns: [exact human-analyst collection scope, bound SQLite page selector, selected-ID hydration]

key-files:
  created:
    - apps/strapi/src/api/csrm-risk/services/risk-register-query.ts
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/tests/risk-register.unit.test.ts
    - apps/strapi/tests/risk-register.integration.test.ts
  modified:
    - apps/strapi/src/api/csrm-risk/operations.ts
    - apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts

key-decisions:
  - "Require the exact human Security Analyst role and exact GET:/api/v1/risks grant before creating Risk Register collection scope."
  - "Perform semantic severity and bidirectional target-date null-last ordering in the SQLite repository before limit/offset, then hydrate only selected document IDs through Strapi."
  - "Reject targetDateFrom and targetDateTo as unknown contract parameters while continuing to project and globally sort targetDate."

patterns-established:
  - "Risk Register scope: policy creates riskRegisterCollectionScope only for a human Security Analyst with the exact operation grant; the service reasserts it before parsing or repository access."
  - "Register repository: one parsed filter model drives distinct count and page selection, existence subqueries avoid mitigation duplicates, and Strapi hydration restores database order."

requirements-completed: [RISK-01]

duration: 35min
completed: 2026-09-01
---

# Phase 5 Plan 2: Authorised Risk Register Read Summary

**A token-authenticated, exact-human-analyst Risk Register API now provides closed filters, database-semantic ordering, distinct totals, bounded relation labels, and honest cross-page results.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-31T15:14:00Z
- **Completed:** 2026-08-31T15:48:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Mounted `GET /api/v1/risks` behind content API token authentication, `csrm-app-enabled`, and exact human Security Analyst authorization.
- Implemented the locked flat search/filter/sort/page contract, including safe rejection of unsupported `targetDateFrom` and `targetDateTo` parameters.
- Applied Low/Moderate/High/Critical CASE ranking and target-date null-last ordering inside the SQLite repository before pagination, with stable Risk-number tie-breaking.
- Returned distinct totals and a closed nine-field Risk projection after hydrating only page-selected document IDs, plus bounded labels for requested owner, Assessment, system, and asset relations.
- Proved mounted denial before query validation, persistence preservation, duplicate-mitigation handling, all eight bidirectional sorts, cross-page stability, page sizes, out-of-range totals, and safe output closure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify the closed query, semantic order, and mounted denial boundary** - `b658c37` (test)
2. **Task 2: Implement the authorised Risk Register read** - `015a451` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` - Closed canonical parser for every approved Risk Register query parameter.
- `apps/strapi/src/api/csrm-risk/services/risk-register.ts` - Scope assertion, SQLite count/page repository, bounded hydration, selected labels, and positive projection.
- `apps/strapi/src/api/csrm-risk/operations.ts` - Exact catalogue operation constant for the register read.
- `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` - Token-only mounted GET route and exact policy configuration.
- `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` - Closed list action with safe 400/403 mapping.
- `apps/strapi/src/policies/csrm-authorization.ts` - Dedicated Risk Register collection scope for the exact human analyst grant.
- `apps/strapi/tests/risk-register.unit.test.ts` - Parser, scope, projection, shared-filter, and pagination contracts.
- `apps/strapi/tests/risk-register.integration.test.ts` - Mounted authorization, persistence, filters, sorts, totals, and SQLite ordering proof.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Isolated direct fixture writers for dense register data without a production switch.

## Decisions Made

- Security Analyst Agent grants do not create Risk Register scope even when that role carries the same FunctionAPI; this route is reserved for the exact human Security Analyst role.
- Severity ranking and target-date null placement remain encapsulated at the SQLite repository boundary. Production-dialect equivalence remains a Phase 8 acceptance obligation.
- Selected relation labels are resolved only for the five requested opaque identifiers and returned as closed `{documentId,label}` values.
- Broad RISK-01 date-filter wording remains the documented contract gap; this plan does not invent unsupported date parameters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added isolated direct register fixture writers**
- **Found during:** Task 2 (Implement the authorised Risk Register read)
- **Issue:** Existing release-fact fixtures intentionally have incomplete edit-transition metadata, so using mounted mutation routes to create dense ordering fixtures correctly returned 409.
- **Fix:** Added test-harness-only Risk and mitigation fixture writers against the isolated database; production routes and runtime behavior remain unchanged.
- **Files modified:** `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/risk-register.integration.test.ts`
- **Verification:** Focused mounted tests and the complete Strapi suite pass.
- **Committed in:** `015a451`

**2. [Rule 1 - Bug] Restricted collection scope to the exact human analyst role**
- **Found during:** Task 2 full mounted verification
- **Issue:** The shared explicit-analyst helper also recognizes Security Analyst Agent, allowing a same-operation agent grant to reach query validation.
- **Fix:** Used the existing exact human Security Analyst operation check for the new Risk Register scope.
- **Files modified:** `apps/strapi/src/policies/csrm-authorization.ts`, `apps/strapi/tests/risk-register.integration.test.ts`
- **Verification:** Service-agent, ungranted analyst, Requestor, inactive, and missing identities all receive 403 before record work.
- **Committed in:** `015a451`

**3. [Rule 1 - Bug] Corrected bound LIKE escaping for SQLite**
- **Found during:** Task 2 mounted filter verification
- **Issue:** The initial SQLite ESCAPE expression encoded more than one character and rejected valid bounded searches.
- **Fix:** Switched to a single-character `!` escape and escaped caller `%`, `_`, and `!` characters before binding.
- **Files modified:** `apps/strapi/src/api/csrm-risk/services/risk-register.ts`
- **Verification:** The complete AND-filter mounted request returns one distinct row and the full Strapi suite passes.
- **Committed in:** `015a451`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking issue)
**Impact on plan:** All fixes were necessary for the locked security, correctness, and mounted-test requirements; no production scope or dependency was added.

## Issues Encountered

- The PowerShell `pnpm` shim invokes Node 22 despite Node 24 being active. Verification used the active Node 24 executable with its bundled Corepack pnpm entry point, matching the established Plan 05-01 workaround.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Self-Check: PASSED

- All four created files exist.
- Task commits `b658c37` and `015a451` exist.
- `pnpm --filter @csrm/strapi test` through Node 24 Corepack passes all 82 tests.
- The mounted route retains `content-api-token`, `global::csrm-app-enabled`, then exact `global::csrm-authorization` policy order.
- Content-type schemas, package manifests, lockfile, public allowlists, and catalogue sources are unmodified.
- Authoritative and Strapi source catalogue copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- The modified production/test surface contains no TODO, FIXME, sentinel, conditional RED escape hatch, or placeholder implementation.

## Next Phase Readiness

- Plan 05-03 can define and implement the complete authorised Risk detail aggregate on top of the dedicated Risk Register scope and service boundary.
- Phase 8 must run the same semantic rank, null-last, tie-break, and cross-page contract against the selected production database dialect.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
