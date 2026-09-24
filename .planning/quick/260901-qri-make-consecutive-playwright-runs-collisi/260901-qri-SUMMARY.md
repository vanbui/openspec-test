---
phase: quick
plan: 260901-qri
subsystem: testing
tags: [playwright, nextjs, strapi, e2e, process-isolation]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Complete Playwright workflow coverage for the CSRM web application
provides:
  - PID-derived disjoint high-port ranges for Playwright-managed Strapi and Next servers
  - Runner-authoritative validated E2E origins shared with every worker and harness consumer
  - Bounded graceful managed-server shutdown with Playwright force-kill fallback
affects: [testing, e2e, playwright, phase-05-verification]

tech-stack:
  added: []
  patterns: [runner-owned environment configuration, fail-closed E2E origin validation]

key-files:
  created:
    - apps/web/e2e/harness-urls.ts
  modified:
    - apps/web/playwright.config.ts
    - apps/web/e2e/requestor-request-workflow.spec.ts
    - apps/web/e2e/questionnaire-workflow.spec.ts
    - apps/web/e2e/assessment-release-workflow.spec.ts
    - apps/web/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "Use runner PID modulo 10,000 to select matching ports from disjoint 20,000-29,999 and 40,000-49,999 ranges."
  - "Preserve inherited CSRM_E2E origins when Playwright workers re-evaluate the configuration."

patterns-established:
  - "Playwright runner authority: derive harness origins once and pass them to workers through environment variables."
  - "E2E URL trust boundary: reject missing, malformed, non-HTTP, non-loopback, path-bearing, or portless origins."

requirements-completed: [FOUND-05]

duration: 12min
completed: 2026-09-01
---

# Quick Task 260901-qri: Collision-Free Consecutive Playwright Runs Summary

**PID-isolated Strapi and Next origins shared across Playwright configuration, workers, direct health checks, and secondary browser contexts, with bounded managed-server shutdown.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-01T09:20:00Z
- **Completed:** 2026-09-01T09:32:00Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Replaced fixed E2E listener ports with one runner PID-derived slot mapped into disjoint valid high-port ranges.
- Threaded the authoritative Strapi and web origins through Playwright workers, server commands, readiness checks, API configuration, workflow health checks, and the assessment secondary context.
- Added strict loopback HTTP origin validation and bounded graceful shutdown without dependencies or custom process-killing logic.
- Proved teardown and rerun determinism with two consecutive complete Playwright passes.

## Task Commits

1. **Task 1: Isolate Playwright ports, thread harness origins, and prove clean reruns** - `2b9f7ff` (fix)

Planning artifacts remain uncommitted for orchestrator-managed close-out.

## Files Created/Modified

- `apps/web/playwright.config.ts` - Derives and distributes isolated origins and configures graceful managed-server shutdown.
- `apps/web/e2e/harness-urls.ts` - Validates inherited loopback HTTP origins and exports shared harness URLs.
- `apps/web/e2e/requestor-request-workflow.spec.ts` - Uses the shared Strapi health URL.
- `apps/web/e2e/questionnaire-workflow.spec.ts` - Uses the shared Strapi health URL.
- `apps/web/e2e/assessment-release-workflow.spec.ts` - Uses shared Strapi health and secondary-context web URLs.
- `apps/web/e2e/risk-register-workflow.spec.ts` - Uses the shared Strapi health URL.

## Verification

- `pnpm test:e2e` - PASS: 12 tests passed in 3.0m.
- `pnpm test:e2e` - PASS: 12 tests passed in 2.4m.
- `pnpm typecheck` - PASS: TypeScript completed with no errors.
- `pnpm test` - PASS: 33 files and 253 tests passed.
- `git diff --check` - PASS.
- Runtime/branch guard - PASS: Node `v24.19.0`, branch `dylan-test`.

## Decisions Made

- Used separate 20,000-29,999 and 40,000-49,999 ranges so Strapi and Next can never select each other's port or the protected development ports.
- Used nullish environment assignment so the runner derives the pair while worker config evaluation preserves the inherited authoritative origins.
- Used Playwright's supported `SIGTERM` graceful shutdown with a 5-second bound; Windows retains Playwright's documented forceful process-group fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved runner origins during worker config evaluation**

- **Found during:** Task 1 first E2E verification attempt
- **Issue:** Unconditional top-level derivation caused each Playwright worker to overwrite the runner-provided origins with ports based on its own PID, so browser and direct health requests targeted listeners that did not exist.
- **Fix:** Prefer inherited `CSRM_E2E_STRAPI_ORIGIN` and `CSRM_E2E_WEB_ORIGIN` values and assign derived values only when the runner environment does not already contain them.
- **Files modified:** `apps/web/playwright.config.ts`
- **Verification:** Restarted the required gate sequence; both consecutive full E2E invocations passed 12/12.
- **Committed in:** `2b9f7ff`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The fix enforces the plan's runner-to-worker trust boundary without expanding scope.

## Issues Encountered

- The initial E2E attempt failed because workers recomputed ports. This was resolved by the Rule 1 fix above before restarting the required verification sequence.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Consecutive complete Playwright invocations now pass without fixed-port reuse or address collisions.
- No blockers remain; Phase 5 re-verification can consume this harness behavior.

## Self-Check: PASSED

- All six task-owned files exist.
- Code commit `2b9f7ff` exists on `dylan-test`.
- Summary verification claims match the recorded command results.
- Unrelated dirty and untracked work remains preserved and unstaged.

---
*Phase: quick*
*Completed: 2026-09-01*
