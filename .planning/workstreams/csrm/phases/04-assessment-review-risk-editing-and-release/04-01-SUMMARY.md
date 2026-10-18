---
phase: 04-assessment-review-risk-editing-and-release
plan: "01"
subsystem: testing
tags: [strapi, playwright, security, assessment-release, fixtures]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: mounted Strapi authorization harness, submitted questionnaire workflow, and dual-server Playwright baseline
provides:
  - Mounted Phase 4 fixtures for release facts, aggregate descendants, cross-owner records, concurrency, and injected failures
  - Executable Bob-to-Jane browser contract for analyst-controlled assessment release
  - Process-unique phase-neutral Playwright SQLite isolation
affects: [04-02, 04-03, 04-04, 04-06, 04-07, 04-08, 04-12, 04-16]

tech-stack:
  added: []
  patterns: [test-only dependency injection, complete composite-fact matrix, attributable ordinary Playwright RED]

key-files:
  created: [apps/web/e2e/assessment-release-workflow.spec.ts]
  modified: [apps/strapi/tests/helpers/strapi-http-harness.ts, apps/web/playwright.config.ts]

key-decisions:
  - "Represent the three-part release fact with all eight boolean combinations so partial releases can be tested fail-closed."
  - "Keep provider and document-write failure injection inside the mounted test harness, with no environment or production-route switch."
  - "Use a synchronous ordinary Playwright count expectation for the Wave 0 queue boundary so the RED is attributable without a locator-timeout diagnostic."

patterns-established:
  - "Assessment fixture graph: Requestor-owned request -> Assessment -> Risk -> ControlImplementation, linked to reusable RiskType and Control definitions."
  - "Browser RED integrity: prove health, authentication, shell, responsive, reduced-motion, and keyboard baselines before the first named unavailable capability assertion."

requirements-completed: [ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05]

duration: 8min
completed: 2026-08-30
---

# Phase 4 Plan 1: Assessment Release Acceptance Boundary Summary

**Mounted hostile-state fixtures and a real dual-server Bob-to-Jane assessment release contract that remains RED only at the unavailable analyst queue.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T21:52:06Z
- **Completed:** 2026-08-29T21:59:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended the mounted Strapi harness with owner and cross-owner identities, every complete/partial release-fact combination, aggregate children, reusable reference data, job targets and observations, simultaneous calls, and test-only failure injection.
- Added a traceable ASSESS-01..05 Playwright journey covering Bob's review/draft/edit/control/release flow and Jane's owner-only read-only result, including prerelease secrecy and cross-owner denial.
- Proved the new browser file is collected and fails only at the exact ordinary expectation `Phase 4 capability unmet: analyst review queue is available`, after health, authentication, shell, mobile, reduced-motion, and keyboard baselines pass.
- Renamed the Playwright database to a process-unique phase-neutral filename while retaining `STRAPI_ADMIN_AUTO_OPEN=false` and repository-local `.tmp` isolation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the mounted Phase 4 fixture harness** - `3c72807` (test)
2. **Task 2: Write the real dual-server Bob-to-Jane acceptance contract** - `8af5c83` (test)

**Plan metadata:** committed with this summary and sequential tracking updates.

## Files Created/Modified

- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Supplies Phase 4 release, aggregate, concurrency, job, and injected-failure fixtures without production switches.
- `apps/web/e2e/assessment-release-workflow.spec.ts` - Freezes the responsive, accessible, security-sensitive Bob-to-Jane browser journey as an attributable RED contract.
- `apps/web/playwright.config.ts` - Uses `.tmp/playwright-e2e-${process.pid}.db` for phase-neutral process isolation.

## Decisions Made

- Enumerated all eight combinations of `assessmentStatus=approved`, `approvedBy`, and `approvalDate` rather than naming only a subset, ensuring future scope tests cover every malformed partial release.
- Implemented provider and document-write failure controls by temporarily replacing injected test dependencies and restoring them in `finally`; production code and environment behavior remain unchanged.
- Used `expect(await locator.count(), message).toBe(1)` for the named Wave 0 boundary because a locator visibility matcher emits a timeout diagnostic that the plan's strict attribution wrapper correctly rejects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed locator-timeout noise from the intended ordinary RED**
- **Found during:** Task 2 (Write the real dual-server Bob-to-Jane acceptance contract)
- **Issue:** The initial locator visibility expectation reached the correct named queue boundary, but Playwright emitted `Timeout: 15000ms`; the prescribed verification wrapper therefore rejected the run as potentially infrastructure-related.
- **Fix:** Kept the same ordinary Playwright expectation and exact message, but asserted the synchronous locator count so the output identifies only the unavailable capability.
- **Files modified:** `apps/web/e2e/assessment-release-workflow.spec.ts`
- **Verification:** The prescribed wrapper exited zero and printed `Expected attributable Phase 4 capability RED confirmed.`
- **Committed in:** `8af5c83`

**2. [Rule 3 - Blocking] Reconciled state fields unsupported by the installed state handler**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` and `state.update-progress` could not parse the frontmatter-first `STATE.md` format, although the metric, decision, session, roadmap, and requirement handlers succeeded.
- **Fix:** Advanced the existing frontmatter and mirrored Markdown position to Plan 2 and recalculated 35 completed plans out of 50 as 70%, preserving the handler-written session and metrics.
- **Files modified:** `.planning/STATE.md`
- **Verification:** State now records `current_plan: 2`, `completed_plans: 35`, `percent: 70`, and `Stopped At: Completed 04-01-PLAN.md`.
- **Committed in:** plan metadata commit

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue).
**Impact on plan:** The corrections strengthened RED attribution and completed sequential tracking without weakening, bypassing, or changing the acceptance boundary.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test` in `apps/strapi`: PASS, 26/26 tests.
- Prescribed Phase 4 Playwright RED attribution wrapper: PASS.
- `pnpm exec playwright test --list assessment-release-workflow.spec.ts`: PASS, one test collected.
- Integrity sweep for `PHASE4_RED`, skips, fixmes, conditional environment gates, file guards, and empty early returns: PASS.
- Catalogue copies SHA-256 comparison: PASS, byte-identical.
- Frozen content-type schema diff guard: PASS, no schema changes.

## Self-Check: PASSED

- All three owned files exist.
- Task commits `3c72807` and `8af5c83` exist in repository history.
- The browser RED is attributable to the named unmet queue capability after affirmative infrastructure baselines.

## Next Phase Readiness

- Wave 0 fixtures are ready for contract, domain, provider/registry, mounted authorization, rollback, concurrency, and release plans.
- The browser contract remains intentionally RED until later Phase 4 production and UI slices implement the analyst review queue and complete release journey.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
