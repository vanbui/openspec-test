---
phase: quick
plan: 260828-gvj
subsystem: web-auth-and-shell
tags: [nextjs, typescript, radix-ui, vitest, authorization]
requires:
  - phase: 01-02
    provides: initial App Router shell and development role fixture
provides:
  - development-only session adapter selection with fail-closed unavailable runtime behavior
  - validated shell transport response mapping and server presentation capability guard
  - server-rendered shell with a Radix modal navigation Sheet
affects: [phase-01-03, phase-01-04, phase-01-05]
actuals:
  tokens: 8238
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [runtime-validated server boundaries, presentation-layer capability guard, narrow client navigation island]
key-files:
  created:
    - apps/web/src/lib/capabilities/server-guard.ts
    - apps/web/src/components/ui/primitives.tsx
    - apps/web/src/lib/boundaries/alignment.test.ts
    - apps/web/src/components/shell/mobile-navigation.test.tsx
  modified:
    - apps/web/src/lib/auth/session-adapter.ts
    - apps/web/src/features/shell/shell-service.ts
    - apps/web/app/(app)/layout.tsx
key-decisions:
  - "Only NODE_ENV=development selects the local role fixture; all other runtimes use an unavailable adapter until Keycloak is implemented."
  - "The web capability guard is defense-in-depth presentation gating; Strapi remains authoritative for FunctionAPI and record authorization."
  - "Focused tests use direct Vitest invocation and relative imports, leaving Phase 01-05 test-harness configuration ownership intact."
requirements-completed: [QUICK-GVJ]
coverage:
  - id: D1
    description: Development session runtime and role input boundaries fail closed outside development.
    requirement: QUICK-GVJ
    verification:
      - kind: unit
        ref: apps/web/src/lib/boundaries/alignment.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Shell application response validation and route capability denial are executable server boundaries.
    requirement: QUICK-GVJ
    verification:
      - kind: unit
        ref: apps/web/src/lib/boundaries/alignment.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Route-correct mobile navigation provides labelled modal focus and close behavior.
    requirement: QUICK-GVJ
    verification:
      - kind: automated_ui
        ref: apps/web/src/components/shell/mobile-navigation.test.tsx
        status: pass
    human_judgment: false
duration: 22min
completed: 2026-08-28
status: complete
---

# Quick Task 260828-gvj: Web Engineering Alignment Summary

**Development-only session fixtures, validated server trust boundaries, and a server-rendered accessible navigation shell now reinforce the CSRM web engineering rules.**

## Accomplishments

- Replaced direct development-session consumption with a runtime-selected adapter that rejects fixture access outside a development build and hides the fixture sign-in page.
- Added shared runtime parsing for role inputs and shell transport data, plus a typed server-side capability-denial guard that does not replace Strapi authorization.
- Reduced the shell client boundary to pathname-aware navigation and Radix Sheet interaction, with local CVA/Radix primitives and focused modal-navigation tests.

## Task Commits

1. **Task 1: Make the development session boundary explicit and fail-closed** - `b87575d`
2. **Task 2: Validate server trust boundaries and add route capability semantics** - `bdeef42`
3. **Task 3: Convert the shell to a pathname-aware accessible Sheet composition** - `1f45646`

## Verification

- `pnpm --filter @csrm/web exec vitest run src/lib/boundaries/alignment.test.ts src/components/shell/mobile-navigation.test.tsx --environment jsdom` — passed (7 tests).
- `pnpm --filter @csrm/web typecheck` — passed.
- `pnpm --filter @csrm/web build` — passed; `/app` is deliberately dynamic so the unavailable production session adapter remains fail-closed at request time.
- `git diff --check -- apps/web` — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept focused Vitest files configuration-free**
- **Found during:** Tasks 2 and 3
- **Issue:** The Phase 01-05-owned Vitest configuration does not exist yet, so direct Vitest execution could not resolve the app alias or jest-dom matchers.
- **Fix:** Used relative imports and native assertions in the two focused quick-task tests, without adding configuration, scripts, packages, Turbo tasks, or CI changes.
- **Verification:** Both focused files pass with the plan-prescribed direct commands.

**2. [Rule 3 - Blocking] Prevented the production build from prerendering the unavailable adapter**
- **Found during:** Task 3 verification
- **Issue:** Static prerendering invoked the intentionally unavailable production session adapter and failed the production build.
- **Fix:** Marked the protected layout dynamic so session resolution happens per request and continues to fail closed when no production adapter exists.
- **Verification:** `pnpm --filter @csrm/web build` passes and reports `/app` as dynamic.

## Known Stubs

None. A production Keycloak adapter remains intentionally unimplemented; the selected unavailable adapter is an explicit fail-closed boundary rather than a UI stub.

## Next Phase Readiness

Phase 01-04 can retain ownership of generated transport, client construction, and contract gaps; Phase 01-03 retains Strapi authorization testing; Phase 01-05 retains the comprehensive test/CI harness. No package, lockfile, Turbo, CI, generated OpenAPI, or Strapi source was changed.

## Self-Check: PASSED

- Summary and all three implementation commits exist.
- The implementation commit range contains only the quick task's declared `apps/web` source and focused test files.
- The pre-existing `pnpm-workspace.yaml` change remains unstaged and unchanged.
