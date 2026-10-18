---
phase: 11-navigation-landing-and-list-clarity
plan: 21
subsystem: testing
tags: [phase-gate, vitest, node-test, playwright, axe, static-checks]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: plans 11-01 to 11-20 (sectioned sidebar, both Homes, list clarity, quick find)
provides:
  - "The Phase 11 gate on the production build: api:check, typecheck, lint, web 3,280/3,280, Strapi 704/704, Playwright 156/156 (desktop 131, mobile 25, 0 flaky)"
  - "The D-01/D-02 static checks against PHASE_11_BASE=9f95575, all clean"
affects: [11-21 Task 2 browser walk, 11-21 Task 3 coverage, phase 11 verification]

tech-stack:
  added: []
  patterns:
    - "Gate record committed before the clean-tree check (D-58, G-6)"

key-files:
  created:
    - .planning/phases/11-navigation-landing-and-list-clarity/11-21-SUMMARY.md
  modified: []

key-decisions:
  - "The gate ran as the plan's chain step by step, with the Strapi suite and Playwright in the background, every figure taken from this one run at 9702d70"

requirements-completed: []  # UX-07, UX-08, UX-09, UX-10, DASH-03 complete only after Task 3 records the browser walk

duration: in progress (Task 1 took 43 min)
completed: in progress
status: in-progress
---

# Phase 11 Plan 21: Phase gate, browser walk and coverage Summary

**Task 1 recorded: the full Phase 11 gate is green on the production build at `9702d70`. `api:check`, typecheck and lint are clean. Web is 3,280/3,280, Strapi 704/704, and Playwright 156/156 (desktop 131, mobile 25, 0 flaky). All five static checks against `PHASE_11_BASE=9f95575` print nothing.**

Tasks 2 (the pilot's blocking browser walk) and 3 (browser checks, coverage, Manual-Only) are still to come. This file gains `## Browser checks`, `## Coverage`, `## Manual-Only` and `## Notes for the orchestrator` in Task 3.

## Performance

- **Task 1 started:** 2026-10-03T23:28:42Z
- **Task 1 gate finished:** 2026-10-04T00:10:46Z (43 min including this record)
- **Tasks:** 1 of 3 (Task 2 is a blocking-human checkpoint)
- **Files modified:** 1 (this summary)

## Phase gate

Run from the repository root in Git Bash under Node 24.19.0 (POST-DEMO-BRIEF §4's PATH and pnpm shim), at `HEAD` `9702d70762787117f7821d2e9204addd1a3c1e6c`. Before the run, and again before the Strapi suite and before Playwright, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing. `BASE` resolved from `11-01-SUMMARY.md` to `9f95575`.

| # | Command | Result | Duration | POST-DEMO-BRIEF §3 baseline (`ece1a25`, 2026-10-01) | Last Phase 11 figure |
|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/csrm api:check` | exit 0, clean. The only output besides the generator banner is git's `LF will be replaced by CRLF` notice on `schema.d.ts` | 3 s | clean | clean (11-20) |
| 1b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (no longer listed). Exit 1, only because git's refresh reports every stat-dirty entry whatever the pathspec: `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update`, the operator's two empty-diff line-ending items, left alone. Same behaviour as 10-23 and 11-02 to 11-20 | <1 s | (not in §3) | same |
| 2 | `pnpm --dir apps/csrm typecheck` | exit 0, clean (`next typegen && tsc --noEmit`) | 7 s | clean | clean |
| 3 | `pnpm --dir apps/csrm lint` | exit 0, clean (`next typegen && tsc --noEmit`; there is no ESLint) | 5 s | clean | clean |
| 4 | `pnpm --dir apps/csrm test` | exit 0. **146 files, 3,280 passed / 3,280, 0 failed.** No `EPERM: rename`, so no file was rerun | 60 s (vitest 58.63 s) | 2,046 / 2,048 (2 baseline failures, since fixed) | 3,280 / 3,280 (11-20) |
| 5 | `pnpm --dir apps/backend test` (background) | exit 0. **704 tests: pass 704, fail 0, cancelled 0, skipped 0, todo 0** | 995 s (16.6 min; `duration_ms` 984,563.5). 23:30:41Z to 23:47:16Z | 578 / 578 (10 min 45 s) | 704 / 704 (11-17, 11.1 min) |
| 6 | `pnpm --dir apps/csrm test:e2e` (background; both projects, production build) | exit 0. **156 passed: desktop 131, mobile 25. 0 failed, 0 flaky, 0 skipped.** `Running 156 tests using 1 worker`, closing `156 passed (19.3m)` | 1,160 s (19.3 min). 23:51:26Z to 00:10:46Z | 84 / 84 (11.1 min) | 156 / 156: desktop 131, mobile 25, 0 flaky (11-20, 18.0 min) |

**Playwright flaky count:** desktop 0, mobile 0 (no retry, no `flaky` line). §3's baseline records no flaky figure; its run was 84/84.

**Tree around the runs:** `git status --short` was identical before and after the Strapi suite, and identical before and after Playwright. Each time it showed only the three operator items (the two `apps/backend/types/generated/*.d.ts` files and `example-risk-assessment-questions/`). No restore step ran (G-6, Phase 8 D-12).

**Server log noise (not a failure):** the harness Next server prints `Invalid Server Actions request`, `The Server Reference ID did not match the expected format`, `x-forwarded-host ... does not match origin ... evil.example` and `The destination stream closed early`. These come from `production-hardening.spec.ts`'s deliberate negative requests and navigations, and the specs that make them pass. They appear in earlier Phase 10 and 11 runs too.

**Logs** are in the session scratchpad and are not committed: `g-apicheck.log`, `g-typecheck.log`, `g-lint.log`, `g-web.log`, `g-strapi.log`, `g-e2e.log`.

## Static checks

Each check runs against `BASE=9f95575` (`PHASE_11_BASE`, 150 commits before `HEAD`; the span changes 261 files, +25,976 / −3,311).

| Check | Command | Output | Result |
|---|---|---|---|
| Content-type freeze (D-01) | `git diff --name-only "$BASE"..HEAD -- 'apps/backend/src/api/*/content-types/*'` | (empty) | pass |
| Catalogue copies identical (D-02) | `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | (silent), exit 0 | pass |
| No Keycloak-named file changed | `git diff --name-only "$BASE"..HEAD \| grep -i keycloak` | (empty), grep exit 1 | pass |
| No Keycloak or dev-identity flag changed in any `.example` | `git diff "$BASE"..HEAD -- '*.example' \| grep -E '^[+-].*(CSRM_AUTH_OIDC_ENABLED\|CSRM_DEV_IDENTITY\|IDAMBOX_KEYCLOAK_PROVISIONING\|IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION)'` | (empty), grep exit 1. No `.example` file changed in the span | pass |
| No manifest or lockfile changed (T-11-SC) | `git diff --name-only "$BASE"..HEAD -- package.json apps/csrm/package.json apps/backend/package.json pnpm-lock.yaml` | (empty) | pass |
| No `CSRM_AI_` source line added or removed | `git diff "$BASE"..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml \| grep '^[+-].*CSRM_AI_'` | (empty), grep exit 1 | pass |

`api:check` was also clean (gate row 1), which with the silent `cmp` is D-02's whole proof.

## Task Commits

1. **Task 1: Run the full gate and the static checks, then commit the gate record.** This summary's commit, `docs(11-21): record the Phase 11 gate`.
2. **Task 2: the pilot's browser walk.** Pending (blocking-human checkpoint).
3. **Task 3: browser checks and coverage.** Pending.

## Deviations from Plan

**1. Gate chain run step by step, not as one `&&` line.**
- **Why:** the plan's action runs the Strapi and Playwright parts in the background. Its `git update-index --refresh` step also exits 1 for the operator's two files alone (gate row 1b), which would stop a literal `&&` chain with no fault in the code.
- **What ran:** every command in the chain, in its order, with each exit code checked and recorded. Every command except 1b exited 0, and 1b's only non-zero cause is the known operator-file stat report. The static checks were run before the suites finished; they are read-only git comparisons against `HEAD` `9702d70`, which did not move during the gate.

No code fix was needed. No `fix(11-21)` commit was made.

## Issues Encountered

None. No gate failure and no flaky test. The tree was clean after every run.

## Next Phase Readiness

The gate is green. The pilot can now restart the dev Strapi (1337) and Next (3000) on `post-demo` at the gate commit for Task 2's walk of three actors at 375 and 1440, including backstops B1 to B3. The executor has not started any server.
