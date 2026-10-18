---
phase: 05-risk-register-and-mitigation-management
plan: 09
subsystem: testing
tags: [playwright, accessibility, responsive-ui, integrity, nyquist, strapi]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised Risk reads, responsive register/detail UI, immutable release boundary, and mutable mitigation fixture
provides:
  - Full real-stack Bob/Jane Risk Register acceptance proof on isolated ports 1338/3100
  - Deterministic phase-history, schema, package, catalogue, authorization, API-generation, and anti-escape integrity gate
  - Reconciled executable Nyquist validation evidence for every Phase 5 task
affects: [phase-06, verification, release-gates, risk-register]

tech-stack:
  added: []
  patterns: [active-Node Corepack subprocesses, history-derived integrity range, browser geometry assertions]

key-files:
  created:
    - scripts/verify-phase-05-integrity.mjs
  modified:
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/playwright.config.ts
    - apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
    - .planning/phases/05-risk-register-and-mitigation-management/05-VALIDATION.md

key-decisions:
  - "Derive Phase 5 integrity scope from the oldest task commit recorded in a 05-*-SUMMARY.md and compare final repository state against its parent."
  - "Keep the browser total assertion authoritative and suite-order independent by comparing the displayed total with distinct rendered records while requiring both stable fixtures."
  - "Launch Playwright web servers through the invoking Node runtime's Corepack entry point so Node 24.19.0 is preserved on Windows."

patterns-established:
  - "Phase integrity gates use named diagnostics and fail closed without dependencies."
  - "Responsive acceptance checks browser geometry, focus behavior, and semantic accessibility rather than implementation classes alone."

requirements-completed: [RISK-01, RISK-02]

duration: 1h34m
completed: 2026-09-01
---

# Phase 5 Plan 9: Risk Register Acceptance and Integrity Summary

**A real isolated Bob/Jane browser journey now proves the complete Risk Register workflow, backed by a deterministic phase-wide repository and Nyquist integrity gate.**

## Performance

- **Duration:** 1h 34m
- **Started:** 2026-08-31T18:22:38Z
- **Completed:** 2026-08-31T19:56:28Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Closed the original browser contract with all ten canonical filters, target-date null-last sorting, explicit Overdue presentation, released immutability, mutation persistence, and non-disclosing Jane denial.
- Proved both routes at 375, 390, 430, 768, 1024, and 1440px, plus 200% zoom, reduced motion, keyboard-visible focus, focus restoration, Axe, and zero horizontal overflow.
- Added a Node-built-in integrity runner covering the Phase 5 history range, immutable package/schema files, byte-identical catalogue hash, public-role exposure, generated API drift, forbidden ports, raw transport/colour use, test escapes, and attribution.
- Reconciled every Phase 5 validation row to an existing executable command and removed the obsolete expected-RED wrapper.

## Task Commits

Each task was committed atomically:

1. **Task 1: Turn the full Bob/Jane Risk journey GREEN** - `d3885df` (test)
2. **Task 2: Run the blocking Phase 5 integrity and Nyquist gate** - `196cd3c` (test)

## Files Created/Modified

- `scripts/verify-phase-05-integrity.mjs` - Deterministic dependency-free Phase 5 release integrity gate.
- `apps/web/e2e/risk-register-workflow.spec.ts` - Complete real-stack functional, security, responsive, focus, accessibility, and persistence journey.
- `apps/web/playwright.config.ts` - Node-runtime-stable isolated Strapi/Next server launcher.
- `apps/strapi/src/bootstrap/seed-risk-register-workflow.ts` - Absent-only canonical released fixture alongside the stable mutable fixture.
- `apps/web/src/features/risks/risk-register-filters.tsx` - Complete mobile and desktop canonical filter families.
- `apps/web/src/features/risks/risk-schema.ts` - Exact generic-inventory envelope validation and duplicate picker-option protection.
- `apps/web/app/globals.css` and `apps/web/src/components/shell/app-shell.tsx` - Shell shrink constraint preventing table-driven viewport overflow.
- `apps/web/src/components/csrm/data-table.tsx` - Valid active-filter accessibility semantics.
- `.planning/phases/05-risk-register-and-mitigation-management/05-VALIDATION.md` - Final GREEN Nyquist evidence and executable command map.
- `apps/web/scripts/verify-risk-register-red.mjs` - Removed after the original RED contract became GREEN.

## Decisions Made

- Used the first attributable task commit recorded by Phase 5 summaries as the integrity baseline, failing if that history cannot be resolved.
- Compared the current final tree with the pre-phase baseline for immutable files, allowing a detected package-script deviation to be restored without accepting final drift.
- Kept the E2E database shared within one Playwright invocation and made total assertions honest under earlier assessment-created Risks instead of assuming test isolation between specs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved Node 24 for Playwright child servers**
- **Found during:** Task 1
- **Issue:** The Windows pnpm shim selected a different Node installation for Strapi and Next child processes.
- **Fix:** Launched Corepack's pnpm entry point with `process.execPath`.
- **Files modified:** `apps/web/playwright.config.ts`
- **Verification:** Focused and full Playwright suites passed under Node 24.19.0.
- **Committed in:** `d3885df`

**2. [Rule 2 - Missing Critical] Added an absent-only canonical released fixture**
- **Found during:** Task 1
- **Issue:** The isolated database did not contain exact released assessment `ASM-2026-33SAEN` required by the acceptance contract.
- **Fix:** Added triple-gated, absent-only released request/assessment/Risk creation without altering existing released records or the Control inventory.
- **Files modified:** `apps/strapi/src/bootstrap/seed-risk-register-workflow.ts`
- **Verification:** Focused seed tests, 94-test Strapi suite, and released read-only browser assertions passed.
- **Committed in:** `d3885df`

**3. [Rule 1 - Bug] Corrected picker payloads and complete mobile filters**
- **Found during:** Task 1
- **Issue:** Generic inventory responses were rejected despite matching Strapi's real envelope, the empty owner search omitted Bob/Jane, and mobile filters lacked three primary families.
- **Fix:** Validated the exact paginated generic envelope, loaded bounded owner matches, deduplicated options, and reused core filters in the Sheet.
- **Files modified:** Risk page, filter, schema, and schema/service tests.
- **Verification:** 32 focused register tests and the full browser journey passed.
- **Committed in:** `d3885df`

**4. [Rule 1 - Bug] Removed 768px overflow and invalid ARIA**
- **Found during:** Task 1
- **Issue:** The shell content grid item expanded to the table's intrinsic width and an unroled `div` used a prohibited `aria-label`.
- **Fix:** Added a `min-width: 0` shell constraint and removed the invalid redundant label.
- **Files modified:** App shell, global styles, and DataTable.
- **Verification:** Six-width geometry matrix and serious/critical Axe scans passed.
- **Committed in:** `d3885df`

**5. [Rule 3 - Blocking] Restored forbidden package-file drift**
- **Found during:** Task 2
- **Issue:** The phase-wide integrity scan found a late concurrency edit in `apps/strapi/package.json`.
- **Fix:** Restored the exact pre-phase test command and verified all 94 Strapi tests without the package change.
- **Files modified:** `apps/strapi/package.json`
- **Verification:** Integrity reports zero package drift and the root test gate passes.
- **Committed in:** `196cd3c`

**6. [Rule 1 - Bug] Made the final journey suite-order independent**
- **Found during:** Task 2
- **Issue:** Earlier full-suite assessment release legitimately added Risks to the isolated database, invalidating a focused-only hard-coded total.
- **Fix:** Compared the authoritative displayed total with distinct rendered records and required the stable released/mutable fixtures explicitly.
- **Files modified:** `apps/web/e2e/risk-register-workflow.spec.ts`
- **Verification:** Focused journey and all 12 E2E tests pass in suite order.
- **Committed in:** `196cd3c`

**7. [Rule 1 - Bug] Deduplicated related owner options**
- **Found during:** Task 2
- **Issue:** A Risk with the same risk owner and treatment owner supplied duplicate keyed options to React.
- **Fix:** Deduplicated related users by opaque document ID before rendering editors.
- **Files modified:** Risk detail page.
- **Verification:** Full typecheck, web tests, build, and E2E gate pass.
- **Committed in:** `196cd3c`

---

**Total deviations:** 7 auto-fixed (4 bugs, 2 blocking issues, 1 missing critical function)
**Impact on plan:** Every adjustment was required for deterministic acceptance, accessibility, final-tree integrity, or suite-order correctness; no new product scope or dependency was introduced.

## Issues Encountered

- The first root E2E run exposed a focused-versus-full-suite data assumption; the assertion now validates honest totals under both conditions.
- Next dev logged benign closed-stream diagnostics during earlier assessment navigation, but all browser assertions and server health checks passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Safe “not available” denial copy and arbitrary document IDs are intentional authorization test paths, not product placeholders.

## Self-Check: PASSED

- All four key artifacts exist.
- Task commits `d3885df` and `196cd3c` exist in repository history.
- The post-commit integrity gate and whitespace check exit 0.

## Next Phase Readiness

- Phase 5 satisfies RISK-01 and RISK-02 with focused, full-suite, browser, security, accessibility, responsive, and repository-integrity evidence.
- No blockers remain for the next roadmap phase.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
