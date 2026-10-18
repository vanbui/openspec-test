---
phase: quick
plan: 260831-r6j
subsystem: auth
tags: [strapi, api-token, authorization, playwright, nextjs]
requires:
  - phase: 01
    provides: development identity bridge and IdamBox authorization policy
provides:
  - API-token-only transport for CSRM routes with historical public-grant cleanup
  - mounted and isolated browser API-token provisioning
  - development bridge bearer validation and documented boundary
affects: [phase-08-keycloak, strapi-content-api, web-transport]
tech-stack:
  added: []
  patterns: [deletion-only permission reconciliation, triple-gated deterministic test credential, layered transport and user authorization]
key-files:
  created:
    - apps/strapi/src/bootstrap/reconcile-development-public-permissions.ts
    - apps/strapi/src/bootstrap/seed-development-api-token.ts
  modified:
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/web/src/lib/api/transport/server-client.ts
    - apps/web/playwright.config.ts
    - docs/contract-gaps/phase-01-openapi-gaps.md
key-decisions:
  - "Use Strapi's content-api-token strategy for custom routes while preserving every existing IdamBox policy chain."
  - "Persist the isolated deterministic credential only as the installed Strapi service's salted hash."
  - "Give Playwright separate Strapi and Next runtime/build locations so live development servers remain untouched."
patterns-established:
  - "Transport authentication executes before development identity and IdamBox policy authorization."
  - "Historical public grants are reconciled by deletion only on every boot."
requirements-completed: [QUICK-R6J]
duration: 32min
completed: 2026-08-31
status: complete
---

# Quick Task 260831-r6j: Require the Strapi API token for every frontend call

**CSRM transport now requires a Strapi bearer credential while the unchanged development identity and IdamBox policies retain per-user authority.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-31T09:40:00Z
- **Completed:** 2026-08-31T10:12:23Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Replaced development public-role grant seeding with unconditional, idempotent deletion of the complete historical managed action set while preserving unrelated permissions.
- Required Content API token authentication on the previously anonymous custom routes and proved the sequential 401 transport and 403 per-user authorization gates.
- Minted non-expiring Full access credentials inside mounted test harnesses and added triple-gated, Strapi-hashed deterministic provisioning for isolated browser tests.
- Required and attached `CSRM_API_TOKEN` in development bridge mode without changing production optionality pending Phase 8.
- Documented the two-layer development transport boundary and environment contracts.

## Task Commits

1. **Task 1: Close the Strapi anonymous gate and prove two-layer authorization** — `f49c61ab35c19a7df91477b85c4a6aa9af7c0215`
2. **Task 2: Provision isolated development tokens and enforce the web transport contract** — `11763a627ed26351a4f8b9eb2a20e2c6379593b3`
3. **Task 3: Record the transport boundary and run immutable full acceptance** — `6b6c30f280f4b80a16c0f63b6224625c36ff8c87`

## Verification Evidence

- `apps/strapi: npm test` — 70 tests passed.
- `apps/web: pnpm typecheck` — passed.
- `apps/web: pnpm test` — 26 files and 172 tests passed.
- `apps/web: pnpm api:check` — generated contract remained unchanged.
- `apps/web: pnpm test:e2e` — 11 tests passed using isolated ports 1338 and 3100.
- Mounted negatives passed: identity without credential returned 401; credential without identity returned 403; credential plus authorized identity succeeded.
- Both catalogue copies remained byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- All 15 content-type schema paths and SHA-256 hashes matched the preflight inventory.
- No dependency manifest, lockfile, content-type schema, catalogue, roadmap, or phase-state file changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Routed every mounted workflow wrapper through the shared credential helper**
- **Found during:** Task 1 verification
- **Issue:** Request and questionnaire suites used suite-local raw fetch wrappers, so they did not inherit the harness bearer credential.
- **Fix:** Routed both wrappers through `harness.request` without changing assertions or authorization behavior.
- **Files modified:** `apps/strapi/tests/request-workflow.integration.test.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
- **Verification:** Full Strapi suite passed with 70 tests.
- **Committed in:** `f49c61ab35c19a7df91477b85c4a6aa9af7c0215`

**2. [Rule 3 - Blocking] Isolated the Playwright Next build directory**
- **Found during:** Task 2 browser verification
- **Issue:** The live port-3000 Next development server held the project's default build-directory lock, preventing the isolated port-3100 server from starting.
- **Fix:** Added an environment-selected Next `distDir` used only by Playwright, leaving ordinary local development unchanged.
- **Files modified:** `apps/web/next.config.ts`, `apps/web/playwright.config.ts`
- **Verification:** Playwright passed all 11 tests without stopping or reusing live servers.
- **Committed in:** `11763a627ed26351a4f8b9eb2a20e2c6379593b3`

**Total deviations:** 2 auto-fixed blocking issues. Both were required to satisfy shared-harness inheritance and isolated browser execution.

## Issues Encountered

- Initial focused runs exposed the two wrapper bypasses and the live Next build lock; both were corrected as documented above.
- Expected React test warnings and Next teardown stream-close diagnostics remained non-failing and pre-existing; all acceptance commands exited successfully.

## Known Stubs

None.

## User Setup Required

None beyond the existing ignored `apps/web/.env` operator configuration containing the admin-generated Full access `CSRM_API_TOKEN`. Ordinary local Strapi databases must leave `CSRM_DEV_API_TOKEN` unset.

## Next Phase Readiness

- The development bridge is locked to authenticated Strapi transport and ready for continued Phase 4 work.
- Production Keycloak authentication remains explicitly deferred to Phase 8.

## Self-Check: PASSED

- All created files exist.
- All three required task commits exist on `dylan-test`.
- Full acceptance and immutable-file checks passed.

---
*Quick task: 260831-r6j*
*Completed: 2026-08-31*
