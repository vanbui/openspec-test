---
phase: 07-requestor-request-workflow
plan: "08"
subsystem: testing
tags: [playwright, strapi, nextjs, webpack, security, accessibility]
requires:
  - phase: 07-requestor-request-workflow
    provides: Requestor workflow, ownership policy, and CSRM UI routes
provides:
  - Disposable real-Strapi browser workflow coverage for Jane and Bob
  - Production emitted-asset and HTTP fixture-exclusion regression coverage
  - Stable desktop and mobile request workflow visual baselines
affects: [CSRM-05, e2e, production-boundary, request-workflow]
actuals:
  tokens: 63311
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns: ["Playwright webServer starts verified disposable Strapi", "Production-only fixture resolver replacement uses explicit Webpack builds"]
key-files:
  created: [apps/csrm/scripts/start-e2e-strapi.mjs, apps/csrm/e2e/request-workflow.spec.ts, apps/csrm/src/lib/fixtures/resolve-identity.production.ts]
  modified: [apps/csrm/playwright.config.ts, apps/csrm/next.config.ts, apps/csrm/src/app/requests/page.tsx]
key-decisions:
  - "Run E2E development and production Next servers with explicit Webpack so production-only replacement plugins apply under Next 16."
  - "Mask the generated CRA request number in the visual baseline while asserting the visible workflow title separately."
patterns-established:
  - "Real-backend E2E launchers must verify direct-child database ownership before narrowly cleaning SQLite artifacts."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: "Jane completes the persisted draft, submission, withdrawal, and request-list journey against disposable Strapi storage."
    requirement: CSRM-05
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-workflow.spec.ts#Jane persists, submits, withdraws, and discovers a request through real Strapi"
        status: pass
      - kind: automated_ui
        ref: "playwright:request-dashboard-desktop-1440.png"
        status: pass
    human_judgment: false
  - id: D2
    description: "Analyst collaboration, requestor ownership denial, responsive controls, and production fixture exclusion remain enforced."
    requirement: CSRM-05
    verification:
      - kind: e2e
        ref: "yarn workspace @idambox/csrm test:e2e --grep 'request workflow|request production boundary'"
        status: pass
      - kind: automated_ui
        ref: "playwright:request-form-mobile-390.png"
        status: pass
    human_judgment: false
duration: 46min
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 08: Real-Strapi Workflow Boundary Summary

**Disposable Strapi-backed browser coverage proves the Requestor journey, ownership denial, responsive controls, and production fixture exclusion.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-08-22T15:05:14Z
- **Completed:** 2026-08-22T15:51:21Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments

- Added a verified, disposable Strapi launcher and Playwright web-server stack for the real CSRM backend.
- Proved Jane's create, save, submit, withdraw, and discovery journey; Bob's analyst edit; and a metadata-safe identifier-swap denial.
- Added six-viewport geometry/touch-target checks, request snapshots, and a recursive production JS/HTTP exclusion test.
- Prevented development identity fixture values from reaching production output and corrected the `/requests` server/client import boundary and post-create focus transfer.

## Task Commits

1. **Task 1: Prove the complete direct-Strapi workflow, IDOR boundary, responsive contract, and production fixture exclusion (RED)** - `991c6c7` (test)
2. **Task 1: Prove the complete direct-Strapi workflow, IDOR boundary, responsive contract, and production fixture exclusion (GREEN)** - `68c4328` (feat)

## Files Created/Modified

- `apps/csrm/scripts/start-e2e-strapi.mjs` - starts and narrowly cleans a verified disposable Strapi SQLite runtime.
- `apps/csrm/e2e/request-workflow.spec.ts` - browser workflow, IDOR, responsive, and production-boundary coverage.
- `apps/csrm/e2e/snapshots/request-dashboard-desktop-1440.png` - stable action-first desktop request-list baseline.
- `apps/csrm/e2e/snapshots/request-form-mobile-390.png` - stable mobile request-form baseline.
- `apps/csrm/playwright.config.ts` - real Strapi, explicit Webpack development, and isolated production servers.
- `apps/csrm/src/lib/fixtures/resolve-identity.production.ts` - fail-closed production fixture seam.
- `apps/csrm/next.config.ts` - production resolver replacement.

## Decisions Made

- Explicit Webpack is required for the E2E Next servers because Next 16 defaults to Turbopack, which does not execute the existing `webpack()` replacement configuration.
- The generated CRA number is visually masked because it is intentionally random; its workflow title is asserted independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repaired the `/requests` server/client import boundary**
- **Found during:** Task 1
- **Issue:** The server page called runtime array methods on values exported from a Client Component, causing a client-reference proxy crash.
- **Fix:** Kept the client-only types as imports and defined server-safe status/sort validation values locally.
- **Files modified:** `apps/csrm/src/app/requests/page.tsx`
- **Verification:** Targeted real-stack E2E suite passes.
- **Committed in:** `68c4328`

**2. [Rule 1 - Bug] Restored focus after the create redirect**
- **Found during:** Task 1
- **Issue:** The new request details heading did not receive focus after creation.
- **Fix:** Focus the heading on mount before emitting the status announcement.
- **Files modified:** `apps/csrm/src/features/requests/request-details.tsx`
- **Verification:** Jane E2E journey asserts focused heading after redirect.
- **Committed in:** `68c4328`

**3. [Rule 2 - Security] Excluded development identity data from production assets**
- **Found during:** Task 1
- **Issue:** Initial production asset scanning found development fixture values in emitted JavaScript.
- **Fix:** Added a fail-closed production resolver and built the E2E production server with explicit Webpack replacement support.
- **Files modified:** `apps/csrm/next.config.ts`, `apps/csrm/src/lib/fixtures/resolve-identity.production.ts`, `apps/csrm/playwright.config.ts`
- **Verification:** Targeted production-boundary E2E test passes recursive emitted-JS and HTTP checks.
- **Committed in:** `68c4328`

**4. [Rule 2 - Accessibility] Made mobile request-card actions full touch targets**
- **Found during:** Task 1
- **Issue:** The mobile View request link did not consistently expose a 44px tall interactive box.
- **Fix:** Rendered the link as an aligned inline-flex control while retaining the existing minimum height.
- **Files modified:** `apps/csrm/src/features/requests/request-list.tsx`
- **Verification:** Six-viewport touch-target E2E test passes.
- **Committed in:** `68c4328`

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 2).

## Issues Encountered

- `yarn workspace @idambox/csrm verify` still fails three existing capability-count assertions that expect 23 capabilities rather than the committed 27.
- The full E2E suite runs 10 tests; the four request-workflow tests pass, while six legacy shell tests retain Phase 6 placeholder-page and asset-scan expectations. Details are recorded in `deferred-items.md`.

## Known Stubs

None.

## User Setup Required

None - the test launcher provisions and cleans its disposable local Strapi runtime.

## Next Phase Readiness

The Requestor workflow has executable real-backend and production-boundary coverage. Refresh the stale capability-count and Phase 6 shell E2E baselines before treating the repository-wide verification suite as green.

## Self-Check: PASSED

Verified the five shipped test/security artifacts exist and both TDD commits (`991c6c7`, `68c4328`) are present in git history.

---
*Phase: 07-requestor-request-workflow*
*Completed: 2026-08-22*
