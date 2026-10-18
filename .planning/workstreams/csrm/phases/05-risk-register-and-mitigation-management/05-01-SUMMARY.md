---
phase: 05-risk-register-and-mitigation-management
plan: 01
subsystem: testing
tags: [playwright, e2e, tdd, authorization, accessibility]

requires:
  - phase: 04-assessment-generation-review-and-release
    provides: Isolated dual-role Playwright harness, deterministic assessment fixtures, and released assessment workflow
provides:
  - Attributable RED browser contract for the complete Risk Register analyst journey
  - Deterministic wrapper that accepts the expected missing-product failure and rejects harness failures or a GREEN run
  - Executable authorization, immutability, persistence, responsive, focus, accessibility, and overflow expectations
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09]

tech-stack:
  added: []
  patterns: [attributable Playwright RED boundary, Node built-in expected-failure verifier]

key-files:
  created:
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/scripts/verify-risk-register-red.mjs
  modified: []

key-decisions:
  - "Make the first missing-product assertion the visible /app/risks Risk Register heading after health, sign-in, and shell baselines pass."
  - "Run pnpm through the active Node executable's Corepack entry point so the RED wrapper preserves the required Node runtime on Windows."

patterns-established:
  - "Expected RED wrappers accept one named product assertion and reject GREEN, authentication, server, connection, skip, no-test, and live-port outcomes."
  - "The Phase 5 browser contract tests released immutability structurally by asserting no forms, mutation actions, or mutation prefetch."

requirements-completed: [RISK-01, RISK-02]

duration: 13min
completed: 2026-09-01
---

# Phase 5 Plan 1: Risk Register Acceptance Boundary Summary

**A real isolated Playwright journey now defines the complete analyst Risk Register outcome and passes RED verification only at the missing `/app/risks` heading.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-31T15:03:00Z
- **Completed:** 2026-08-31T15:16:16Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Specified Bob's honest register total, canonical filter URL state, Risk navigation, released read-only boundary, and authoritative mitigation persistence.
- Specified Jane's non-disclosing list and existing/arbitrary detail denials with no count, Risk number, or existence clue.
- Covered 375, 390, 430, 768, 1024, and 1440px geometry, the card/table breakpoint, detail columns, focus restoration, reduced motion, 200% zoom, Axe, and horizontal overflow.
- Proved the isolated application reaches the expected first unimplemented Risk Register assertion without a sentinel, route mock, alternate port, or authentication escape hatch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing Phase 5 analyst journey** - `0936fa2` (test)

## Files Created/Modified

- `apps/web/e2e/risk-register-workflow.spec.ts` - Complete serial Bob/Jane Risk Register acceptance journey and responsive/accessibility contract.
- `apps/web/scripts/verify-risk-register-red.mjs` - Node built-in wrapper that classifies the focused Playwright failure deterministically.

## Decisions Made

- The RED point is the visible `Risk Register` heading on `/app/risks`, reached only after Strapi health, fixture sign-in, shell, and dashboard baselines succeed.
- The verifier invokes the active Node runtime's bundled Corepack pnpm entry point, avoiding Windows command-shim runtime drift while adding no dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made the Playwright subprocess portable to the active Windows Node runtime**
- **Found during:** Task 1 (Write the failing Phase 5 analyst journey)
- **Issue:** Directly spawning the Windows `pnpm.cmd` shim from Node 24 failed immediately with `spawn EINVAL`, so the verifier could not reach Playwright.
- **Fix:** Spawned pnpm's bundled Corepack JavaScript entry point with `process.execPath` and argument arrays using Node built-ins.
- **Files modified:** `apps/web/scripts/verify-risk-register-red.mjs`
- **Verification:** `node apps/web/scripts/verify-risk-register-red.mjs` booted isolated 1338/3100 servers, ran one test, observed the named missing heading assertion, and exited 0.
- **Committed in:** `0936fa2` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix changes only subprocess launch mechanics; the focused command, isolated harness, and RED classification remain exactly as planned.

## Issues Encountered

- The repository pnpm command shim points at a different installed Node runtime on Windows; the deterministic verifier now uses the invoking Node 24 runtime instead.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The arbitrary `not-a-risk-document-id` value is deliberate denial-path test data, not a production placeholder.

## Self-Check: PASSED

- Both created files exist.
- Task commit `0936fa2` exists.
- `pnpm --filter @csrm/web typecheck` passes.
- `node apps/web/scripts/verify-risk-register-red.mjs` exits 0 only after the expected attributable RED assertion.
- The forbidden-pattern scan returns no sentinel, focused-test marker, skip, or live-port reference in the Playwright spec.

## Next Phase Readiness

- Plan 05-02 can implement the authorised server-side Risk Register read against this fixed user-outcome boundary.
- No blockers remain for the next plan.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
