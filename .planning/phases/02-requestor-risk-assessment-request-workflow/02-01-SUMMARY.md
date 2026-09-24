---
phase: 02-requestor-risk-assessment-request-workflow
plan: 01
subsystem: testing
tags: [playwright, e2e, strapi, nextjs, sqlite, requestor-workflow]

requires:
  - phase: 01-monorepo-foundation-and-secure-application-shell
    provides: Development role sign-in, capability-driven application shell, and Playwright foundation
provides:
  - Executable browser contract for the complete Requestor assessment-request journey
  - Deterministic Playwright orchestration for development Strapi and Next.js
  - Deliberate RED diagnostic isolated to the missing My Requests affordance
affects: [02-07-request-list, 02-08-request-form-workflow, 02-09-requestor-dashboard]

tech-stack:
  added: []
  patterns: [dual Playwright web servers, isolated seeded SQLite E2E data, sentinel-attributed RED acceptance test]

key-files:
  created: [apps/web/e2e/requestor-request-workflow.spec.ts]
  modified: [apps/web/playwright.config.ts]

key-decisions:
  - "Use a dedicated apps/strapi/.tmp/playwright.db SQLite database and never reuse an existing server for the acceptance run."
  - "Require Strapi health and the existing Requestor shell baseline before emitting the Phase 2 RED sentinel."

patterns-established:
  - "Browser RED attribution: startup, authentication, shell, navigation, and baseline failures use distinct diagnostics; only the first missing Phase 2 affordance emits the sentinel."
  - "Real-boundary E2E: Playwright starts seeded Strapi before Next.js and supplies development-only identity configuration without secrets or a frontend proxy."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 11min
completed: 2026-08-29
---

# Phase 2 Plan 1: Requestor Workflow Acceptance Contract Summary

**Complete Requestor create-to-submit browser contract backed by isolated seeded Strapi and Next.js development servers**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-29T11:38:00Z
- **Completed:** 2026-08-29T11:48:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Defined the Requestor journey across dashboard, list, create, detail, edit, confirmed submission, tracking, and unauthenticated direct-route denial.
- Added 375px overflow and keyboard-focus coverage plus server-backed search, status filter, sorting, and pagination expectations.
- Configured Playwright to start isolated seeded Strapi and Next.js servers and proved the current journey fails only at the planned missing My Requests affordance.

## Task Commits

Each task was committed atomically:

1. **Task 1: 02-W0-05: Write the failing Requestor workflow journey** - `cbc49a3` (test)
2. **Task 2: 02-01-02: Configure isolated Strapi and Next Playwright servers** - `5f69527` (chore)

## Files Created/Modified

- `apps/web/e2e/requestor-request-workflow.spec.ts` - Browser acceptance contract for authorised creation, persistence, editing, submission, tracking, responsive access, and session-cleared denial.
- `apps/web/playwright.config.ts` - Ordered Strapi/Next web servers with explicit development gates, isolated SQLite storage, readiness URLs, and bounded startup.

## Decisions Made

- Disabled existing-server reuse for both processes so the test cannot silently inherit incompatible local identity, seed, or database configuration.
- Used Strapi's documented `/_health` readiness endpoint and kept the Next.js base URL at `127.0.0.1:3100`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disambiguated the Requestor shell baseline locator**
- **Found during:** Task 2 (02-01-02: Configure isolated Strapi and Next Playwright servers)
- **Issue:** Exact Requestor text matched both the development-role option and the shell header, stopping the real-server run before the deliberate RED assertion.
- **Fix:** Scoped the role assertion to the application banner.
- **Files modified:** `apps/web/e2e/requestor-request-workflow.spec.ts`
- **Verification:** The dual-server run passed all baseline checks and emitted only `PHASE2_RED_E2E_MISSING_MY_REQUESTS`.
- **Committed in:** `5f69527`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The locator correction was required for accurate RED attribution and did not expand scope.

## Issues Encountered

- Playwright 1.58 matches `--grep` against a full title that includes the file suite. The plan's start-and-end anchored title expression discovered zero tests, so the focused verification used the equivalent end-anchored test title while retaining the explicit file filter. Test discovery, server startup, and sentinel attribution all passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The acceptance contract is ready for Plans 02-07 through 02-09 to satisfy without changing its assertions.
- The journey is intentionally RED at the missing My Requests navigation affordance; Plan 02-09 owns final GREEN execution.

## Self-Check: PASSED

- Found `apps/web/e2e/requestor-request-workflow.spec.ts` and `apps/web/playwright.config.ts`.
- Found task commits `cbc49a3` and `5f69527`.
- TypeScript, Playwright discovery, and the dual-server expected-RED attribution check passed.
- No known stubs or unplanned threat surfaces were found in the created or modified files.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
