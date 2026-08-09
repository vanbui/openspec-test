---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "09"
subsystem: testing
tags: [playwright, nextjs, chromium, visual-regression, accessibility, production-boundary]
requires:
  - phase: 06-03
    provides: CSRM Next.js application and verification commands
  - phase: 06-08
    provides: responsive shell, development identity selector, and state primitives
provides:
  - Deterministic Chromium screenshots across all approved CSRM viewports
  - Browser contracts for navigation, focus, access states, overflow, and state rendering
  - Production boundary verification that excludes fixture controls and test-evidence routes
affects: [phase-06-verification, csrm-e2e, csrm-production-boundary]
actuals:
  tokens: 5585
  tasks: 3
  commits: 4
tech-stack:
  added: [Playwright Chromium browser binary]
  patterns: [committed Playwright golden images, isolated production E2E server, production-only module replacement]
key-files:
  created:
    - apps/csrm/e2e/snapshots/shell-states.png
    - apps/csrm/src/app/test-evidence/states/state-evidence-harness.tsx
    - apps/csrm/src/proxy.ts
  modified:
    - apps/csrm/e2e/shell.spec.ts
    - apps/csrm/playwright.config.ts
    - apps/csrm/next.config.ts
    - apps/csrm/src/components/shell/app-shell.tsx
key-decisions:
  - "Run a separately built, NODE_ENV=production server on port 3002 so browser tests prove shipped output rather than development output."
  - "Use webpack NormalModuleReplacementPlugin to replace the development identity client island with a null production module."
  - "Return direct 404 responses for test-evidence paths from a narrowly matched Next 16 proxy because streamed notFound() responses can be HTTP 200."
patterns-established:
  - "Browser evidence: pair semantic, geometry, and network assertions with committed snapshots."
  - "Production-only test routes: retain page-level guards and enforce exact HTTP status at the proxy boundary."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Deterministic responsive shell, navigation, focus, overflow, and state evidence at all approved viewports
    requirement: APP-06
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/shell.spec.ts; yarn workspace @idambox/csrm test:e2e"
        status: pass
    human_judgment: false
  - id: D2
    description: Production build excludes fixture selector code and returns 404 for development-only test-evidence paths
    requirement: APP-06
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/shell.spec.ts#production fixture exclusion"
        status: pass
      - kind: other
        ref: "yarn workspace @idambox/csrm build"
        status: pass
    human_judgment: false
  - id: D3
    description: Light-first BProton visual contract, responsive hierarchy, focus visibility, and safe-state copy
    requirement: APP-06
    verification:
      - kind: manual_procedural
        ref: "approved visual review of eight apps/csrm/e2e/snapshots images"
        status: pass
    human_judgment: true
    rationale: Human approval was required for visual hierarchy and brand restraint beyond pixel comparison.
duration: 48min
completed: 2026-08-09
status: complete
---

# Phase 6 Plan 09: Browser Evidence and Visual Contract Summary

**Chromium evidence across six CSRM viewports with safe access/state checks and a production boundary that strips development identity fixtures.**

## Performance

- **Duration:** 48 min
- **Started:** 2026-08-09T20:36:36+10:00
- **Completed:** 2026-08-09T21:24:24+10:00
- **Tasks:** 3
- **Files modified:** 23

## Accomplishments

- Added deterministic Chromium golden evidence for Requestor, Analyst, mobile, tablet, collapsed navigation, and state composition views.
- Proved drawer focus restoration, Escape/selection dismissal, 44px touch controls, account semantics, responsive overflow safety, and safe access/unavailable states in real browsers.
- Built and started an isolated production server in E2E, proving fixture labels/client control are absent and test-evidence URLs fail with HTTP 404.
- Completed the full browser, unit, OpenAPI drift, production-build, and human visual review gate.

## Task Commits

1. **Task 1: Prove one desktop and one mobile shell journey in Chromium** - `be10195` (test), `b0ccaa7` (feat)
2. **Task 2: Smoke the remaining viewports, access states, long text, loading, and production boundary** - `520d03c` (test), `216c2dc` (feat)
3. **Task 3: Approve the CSRM foundation visual contract after the full gate** - approved by the user after review of all eight golden images

## Files Created/Modified

- `apps/csrm/e2e/shell.spec.ts` - semantic, layout, local-network, state, and production-boundary browser contracts.
- `apps/csrm/playwright.config.ts` - deterministic local development and isolated production server configuration.
- `apps/csrm/e2e/snapshots/*.png` - committed approved visual baselines.
- `apps/csrm/src/app/test-evidence/states/*` - development-only state-composition evidence page.
- `apps/csrm/src/proxy.ts` - targeted production 404 responses for test-only evidence paths.
- `apps/csrm/next.config.ts` - isolated E2E output and production fixture-module replacement.

## Decisions Made

- A dedicated port-3002 production server is built from an isolated output directory with `NODE_ENV=production`; this prevents development output and test environment flags from invalidating production assertions.
- Production replaces the client development-identity selector with a null module, rather than merely hiding it at render time, so labels cannot ship in client assets.
- The exact test-evidence paths are intercepted by Next 16 `proxy.ts` in production to guarantee a real 404 before streaming; their existing page-level guards remain in place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored the intended reading width for the home-page description**
- **Found during:** Task 1
- **Issue:** A Tailwind spacing token made `max-w-2xl` resolve to 48px, rendering desktop copy as vertical words.
- **Fix:** Added a dedicated reading-width token and used it for the page/header content width.
- **Files modified:** `apps/csrm/src/app/globals.css`, `apps/csrm/src/app/page.tsx`, `apps/csrm/src/components/shell/page-header.tsx`
- **Verification:** Requestor desktop golden image and focused Chromium test passed.
- **Committed in:** `b0ccaa7`

**2. [Rule 1 - Bug] Made development identity selection visible to direct protected-route evidence**
- **Found during:** Task 2
- **Issue:** The analyst evidence page did not read the development identity cookie, so it always evaluated as Requestor.
- **Fix:** Passed the request cookie into the fixture resolver and refreshed the layout after selection; the direct unit-test seam safely handles the absence of request storage.
- **Files modified:** `apps/csrm/src/app/test-evidence/analyst-only/page.tsx`, `apps/csrm/src/lib/fixtures/select-development-identity.ts`
- **Verification:** Access/state browser matrix and all 48 unit tests passed.
- **Committed in:** `216c2dc`

**3. [Rule 2 - Critical functionality] Enforced production fixture exclusion and real test-route 404s**
- **Found during:** Task 2
- **Issue:** The development identity client island was bundled in production, and streamed page-level `notFound()` can respond with HTTP 200.
- **Fix:** Replaced the selector module with a null production implementation and added a narrowly matched production proxy for the two test-evidence paths.
- **Files modified:** `apps/csrm/next.config.ts`, `apps/csrm/src/components/shell/development-identity-selector.production.tsx`, `apps/csrm/src/proxy.ts`
- **Verification:** Fresh static scan contains no fixture labels; production browser test confirms no selector and two HTTP 404 responses.
- **Committed in:** `216c2dc`

**4. [Rule 3 - Blocking issue] Isolated production E2E output from the development server**
- **Found during:** Task 2
- **Issue:** Development and production Next servers shared `.next`, so one could overwrite the other during the production check.
- **Fix:** Configured an ignored `.next-e2e-production` output and build-before-start production web server.
- **Files modified:** `.gitignore`, `apps/csrm/next.config.ts`, `apps/csrm/playwright.config.ts`
- **Verification:** Full five-test Playwright suite passed with both local servers managed by Playwright.
- **Committed in:** `216c2dc`

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3).

**Impact on plan:** All changes were required to make the planned browser and production-boundary evidence correct; no product workflow scope was added.

## Human Approval

The user approved the blocking visual checkpoint after review of the eight committed golden images. The review confirmed responsive hierarchy, visible focus/navigation affordances, restrained light-first styling, and safe state copy.

## Verification

- `yarn workspace @idambox/csrm test:e2e` — passed (5 tests)
- `yarn workspace @idambox/csrm test` — passed (48 tests)
- `yarn workspace @idambox/csrm verify:openapi` — passed (103 operations, no drift)
- `yarn workspace @idambox/csrm build` — passed

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The CSRM foundation has approved automated and human visual evidence. Future work can rely on the committed browser contract and production-fixture exclusion gate.

## Self-Check: PASSED

- Summary exists on disk.
- All four task commits are present in git history.

---
*Phase: 06-create-the-idambox-csrm-next-js-application*
*Completed: 2026-08-09*
