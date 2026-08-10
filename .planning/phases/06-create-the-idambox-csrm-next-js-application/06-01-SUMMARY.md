---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "01"
subsystem: frontend-infra
tags: [nextjs, typescript, yarn, tailwind, shadcn, vitest, eslint]
requires:
  - phase: 05-csrm-backend-content-model
    provides: CSRM documentation and committed OpenAPI reference artifacts
provides:
  - Audited @idambox/csrm Yarn workspace with exact direct dependency pins
  - Strict Next.js, Tailwind/PostCSS, ESLint, shadcn, and test command seams
affects: [06-02-runnable-tracer, CSRM frontend plans]
actuals:
  tokens: 176000
  tasks: 2
  commits: 2
tech-stack:
  added: [Next.js 16.3.0, React 19.2.8, TypeScript 5.9.2, ESLint 9.39.2, Tailwind 4, Vitest 4, MSW 2, Playwright]
  patterns: [strict TypeScript aliases, local shadcn configuration, exact Yarn pins]
key-files:
  created: [apps/csrm/package.json, apps/csrm/tsconfig.json, apps/csrm/components.json, apps/csrm/src/lib/utils.ts]
  modified: [yarn.lock, .planning/phases/06-create-the-idambox-csrm-next-js-application/06-01-PLAN.md]
key-decisions:
  - "Use user-audited exact package pins, including Vite and Testing Library DOM direct dependencies."
  - "Use TypeScript 5.9.2 and ESLint 9.39.2 for eslint-config-next compatibility."
  - "Set NODE_PATH in the package lint script because Yarn 1 hoists eslint-config-next outside the workspace-local Next package."
patterns-established:
  - "CSRM package scripts run through @idambox/csrm and retain port 3001."
  - "Frontend dependency changes are locked at exact versions after package audit."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Audited CSRM workspace configuration and exact Yarn lockfile
    requirement: APP-06
    verification:
      - kind: other
        ref: yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm lint
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm run next --version && yarn workspaces info
        status: pass
    human_judgment: false
duration: 1h 43m
completed: 2026-08-09
status: complete
---

# Phase 06 Plan 01: Audited CSRM Workspace Summary

**Exact-pinned Next.js CSRM workspace with strict TypeScript, Tailwind/shadcn configuration, and reproducible test, lint, OpenAPI, capability, and runtime command seams.**

## Performance

- **Duration:** 1h 43m
- **Completed:** 2026-08-09T09:14:32Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Recorded the blocking human package audit and its corrected approved dependency set before installation.
- Added the strict `@idambox/csrm` workspace without changing backend, Keycloak, or CSRM reference artifacts.
- Locked the reviewed graph in Yarn and verified Next, TypeScript, linting, test baseline, aliases, and workspace discovery.

## Task Commits

1. **Task 1: Approve every direct package before installation** — `4de1685` (docs)
2. **Task 2: Install and configure the audited CSRM workspace** — `a6b60cb` (feat)

## Files Created/Modified

- `apps/csrm/package.json` — exact runtime/tooling pins and stable package scripts.
- `apps/csrm/tsconfig.json` — strict App Router TypeScript and `@/*` alias.
- `apps/csrm/components.json` and `src/lib/utils.ts` — shadcn registry contract and `cn` helper.
- `apps/csrm/next.config.ts`, `postcss.config.mjs`, and `eslint.config.mjs` — application tool configuration.
- `yarn.lock` — approved resolved dependency graph.

## Decisions Made

- Kept `jsdom@29.1.1`, added direct `vite@8.2.1` and `@testing-library/dom@10.4.1`, and retained all other audited direct dependencies as exact pins.
- Replaced audit candidates `typescript@7.0.2` and `eslint@10.8.1` with user-approved compatible pins `typescript@5.9.2` and `eslint@9.39.2` after live lint verification.
- Used `NODE_PATH=./node_modules` only in the CSRM lint script to bridge Yarn 1 hoisting of `eslint-config-next` to the workspace-local Next package.

## Deviations from Plan

### User-approved compatibility corrections

1. `jsdom@29.1.1`, direct `vite@8.2.1`, and direct `@testing-library/dom@10.4.1` replaced the initial audit assumptions before installation.
2. Direct `typescript@5.9.2` replaced `7.0.2` after `eslint-config-next` could not load TypeScript 7.
3. Direct `eslint@9.39.2` replaced `10.8.1` after Next's lint plugins failed under ESLint 10.

All corrections were explicitly approved by the user and preserved the plan's audited exact-pin boundary.

## Issues Encountered

- Yarn encountered two corrupt pre-existing cache entries and temporary disk pressure while resolving platform compiler packages. Removing only the affected cache directories and using a persistent terminal session allowed the normal Yarn 1 install to complete with all optional compiler packages retained.

## User Setup Required

None.

## Next Phase Readiness

Plan 06-02 can add the runnable tracer to this configured workspace. The unit-test command intentionally passes with no files until that plan creates the first tracer tests.

## Self-Check: PASSED

- Confirmed task commits `4de1685` and `a6b60cb` exist.
- Confirmed the declared CSRM configuration files and `yarn.lock` exist.
