---
phase: 1
plan: "05"
subsystem: web-quality-and-ci
tags: [vitest, testing-library, playwright, axe, turborepo, github-actions]
requires:
  - phase: 01-02
    provides: responsive App Router shell and development fixture session
  - phase: 01-04
    provides: reproducible OpenAPI drift check and typed shell service
provides:
  - finite Vitest and Testing Library test harness for the web workspace
  - responsive Playwright and axe smoke coverage for the protected shell
  - CI ordering that checks the generated Strapi contract before downstream quality tasks
affects: [phase-02, phase-08]
tech-stack:
  added: []
  patterns: [test-first web coverage, finite browser harness, contract-first CI ordering]
key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/src/test/setup.ts
    - apps/web/playwright.config.ts
    - apps/web/e2e/app-shell.spec.ts
    - apps/web/e2e/accessibility.spec.ts
    - .github/workflows/ci.yml
  modified:
    - apps/web/package.json
    - turbo.json
key-decisions:
  - "CI provisions the pinned Playwright Chromium binary and runs OpenAPI drift checking before typecheck, unit tests, build, and E2E coverage."
  - "Browser tests use the development-only fixture sign-in path, while production session behavior remains fail-closed."
requirements-completed: [FOUND-05]
coverage:
  - id: D1
    description: Development capability projection, normalized shell-service failures, and locked state copy have runnable unit and component coverage.
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: pnpm --filter @csrm/web test --run
        status: pass
    human_judgment: false
  - id: D2
    description: The authorised shell is checked at 375, 390, 430, 768, 1024, and 1440px for responsive navigation, focus restoration, and horizontal overflow.
    requirement: FOUND-05
    verification:
      - kind: e2e
        ref: apps/web/e2e/app-shell.spec.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The signed-in shell waits for its stable non-empty workspace document title before axe runs, and the CI quality sequence remains finite.
    requirement: FOUND-05
    verification:
      - kind: e2e
        ref: apps/web/e2e/accessibility.spec.ts
        status: pass
    human_judgment: false
duration: 37min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 05: Web Quality and CI Summary

**Finite Vitest, Playwright, axe, and contract-first CI checks now demonstrate responsive and accessible CSRM shell quality.**

## Accomplishments

- Configured jsdom, Testing Library matchers, cleanup, and the workspace alias for finite `vitest run` execution.
- Added capability, transport-error, state-copy, six-viewport responsive-shell, keyboard-focus, horizontal-overflow, and axe coverage.
- Added a Playwright dev-server harness that exercises the development-only fixture sign-in boundary without weakening production authentication behavior.
- Gated the axe scan on the completed `/app` navigation and its stable `Workspace | IdamBox CSRM` document title.
- Added GitHub Actions CI that installs the already-pinned Chromium binary, verifies committed OpenAPI output, and executes the Turbo quality graph in dependency order.

## Task Commits

1. **Task 1 (RED): Add web unit/component/browser coverage** — `14f153d`
2. **Task 1 (GREEN): Configure the finite test and CI harness** — `0dd8530`
3. **Task 1 correction: Provision the pinned browser on clean CI runners** — `ee40588`
4. **Task 1 correction: Await the signed-in document title before axe scans** — `afbdce5`
5. **Execution environment: Record Next-generated agent guidance** — `e438212`

## Verification

- `pnpm --filter @csrm/web api:check` — passed.
- `pnpm --filter @csrm/web test --run` — passed (13 tests across 5 files).
- `pnpm --filter @csrm/web test:e2e` — passed (8 tests: six viewports, focus restoration, and axe).
- `pnpm turbo run lint typecheck test build` — passed (7 tasks).
- `git diff --check` — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the Playwright dev-server invocation**
- **Found during:** Task 1 browser verification.
- **Issue:** Forwarding `--hostname` through the package script added an extra separator, which Next interpreted as a project directory.
- **Fix:** Invoked the documented Next CLI through `pnpm exec next dev --hostname 127.0.0.1 --port 3100`.
- **Files modified:** `apps/web/playwright.config.ts`.
- **Verification:** All eight Playwright tests pass.
- **Committed in:** `0dd8530`.

**2. [Rule 2 - Missing critical functionality] Provisioned the pinned Chromium binary in CI**
- **Found during:** Task 1 browser verification.
- **Issue:** A clean Playwright installation does not include the browser executable required by the E2E command.
- **Fix:** Added the official Playwright Chromium installation step before the CI quality suite.
- **Files modified:** `.github/workflows/ci.yml`.
- **Verification:** The browser suite passes with the pinned local Chromium binary.
- **Committed in:** `ee40588`.

**3. [Rule 1 - Bug] Waited for signed-in metadata before the axe scan**
- **Found during:** Post-wave E2E rerun.
- **Issue:** The accessibility scan could begin after the session redirect rendered the application shell but before the routed document title had settled, producing an axe `document-title` violation.
- **Fix:** Asserted completion of the `/app` redirect and the exact non-empty workspace title before invoking axe.
- **Files modified:** `apps/web/e2e/accessibility.spec.ts`.
- **Verification:** Focused accessibility test and the complete eight-test Playwright suite pass.
- **Committed in:** `afbdce5`.

**4. [Rule 3 - Blocking] Recorded Next-generated local agent guidance**
- **Found during:** Post-wave browser verification.
- **Issue:** Next 16 generated `apps/web/AGENTS.md` and its `CLAUDE.md` pointer during `next dev`; leaving them untracked would dirty every subsequent development run.
- **Fix:** Committed the generated guidance without changing application behavior or project engineering rules.
- **Files modified:** `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`.
- **Committed in:** `e438212`.

## Known Stubs

None.

## Self-Check: PASSED

- All declared harness, unit/component, browser, and CI files exist.
- Commits `14f153d`, `0dd8530`, `ee40588`, `afbdce5`, and `e438212` exist in Git history.
- No stub markers were found in Plan 01-05 files.
