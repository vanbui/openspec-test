---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "04"
subsystem: authorization-ui-preflight
tags: [typescript, nextjs, vitest, capabilities, route-access]
requires:
  - phase: 06-02
    provides: Runnable CSRM Next.js foundation route and workspace verification commands
provides:
  - Exact 23-Function capability vocabulary with Requestor birthright and additive analyst grants
  - Central enabled/planned CSRM route registry and UI-only direct-route preflight
  - Server-gated non-production Jane/Bob fixture identity seam
affects: [06-07-app-shell, 13-integration-and-hardening]
actuals:
  tokens: 5983
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [catalogue-parity capability registry, server-only development fixtures, UI-only protected-work preflight]
key-files:
  created:
    - apps/csrm/src/config/capabilities.ts
    - apps/csrm/src/config/routes.ts
    - apps/csrm/src/lib/fixtures/resolve-identity.ts
    - apps/csrm/src/domain/route-access.ts
  modified: []
key-decisions:
  - "Use all 23 committed Function IDs as the only frontend capability vocabulary; role labels and FunctionApi URLs never authorize UI decisions."
  - "Make Requestor capabilities an unconditional effective-capability birthright and add Security Analyst Functions explicitly for Bob."
  - "Treat route access as a UI preflight before protected work, while retaining Phase 13 backend FunctionApi and record-level enforcement."
patterns-established:
  - "Keep future routes as readonly planned registry data, absent from visible navigation and unavailable to direct access."
  - "Keep deterministic fixture selection server-only, runtime-gated, and cookie-validated so production cannot enable it through browser input."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Catalogue-parity Function capability registry with Requestor birthright and additive analyst grants.
    requirement: APP-06
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/config/capabilities.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Server-only development/test Jane and Bob fixture resolver with production rejection.
    requirement: APP-06
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/lib/fixtures/resolve-identity.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Allowed, forbidden, and unavailable route preflight that blocks protected callbacks for denied paths.
    requirement: APP-06
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/domain/route-access.test.ts
        status: pass
    human_judgment: false
duration: 14 min
completed: 2026-08-09
status: complete
---

# Phase 06 Plan 04: Function Capability and Access Contracts Summary

**Typed 23-Function capability and route contracts with server-gated development identities and protected-work preflight.**

## Performance

- **Duration:** 14 min
- **Completed:** 2026-08-09T09:39:11Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Mirrored all 23 committed catalogue Function IDs and both exact role assignments; Requestor has 8 birthright Functions and Bob’s Analyst elevation produces all 23 effective Functions.
- Added a central route registry with only `/` enabled under `function.dashboard.dashboard`; its 22 future definitions stay planned, hidden, and unavailable.
- Added a server-only development/test fixture seam that defaults to Jane, allows only the validated Bob key through an httpOnly SameSite=Strict cookie, and has no production selector or snapshot.
- Added pure UI preflight that distinguishes allowed, forbidden, and unavailable paths before any protected callback; backend authorization remains authoritative.

## Task Commits

1. **Task 1: Resolve the foundation route from exact Function IDs** — `ff9f14f` (test), `dac805a` (feat)
2. **Task 2: Resolve Jane and Bob only through a non-production server boundary** — `55fc4f0` (test), `2ec0c65` (feat)
3. **Task 3: Distinguish allowed, forbidden, and unavailable before protected work** — `9bb8c2e` (test), `0a38af4` (feat)

## Files Created

- `apps/csrm/src/config/capabilities.ts` — exact Function ID union and effective-capability resolver.
- `apps/csrm/src/config/routes.ts` — typed enabled/planned navigation registry and plural UI group labels.
- `apps/csrm/src/domain/identity.ts` — serializable fixture identity contract.
- `apps/csrm/src/lib/fixtures/identities.ts` — deterministic Jane/Bob source data with server-derived grants.
- `apps/csrm/src/lib/fixtures/resolve-identity.ts` — non-production resolver and validated cookie selection logic.
- `apps/csrm/src/lib/fixtures/select-development-identity.ts` — server action selector boundary.
- `apps/csrm/src/domain/route-access.ts` — protected-work preflight classifier.
- `apps/csrm/src/config/capabilities.test.ts`, `apps/csrm/src/lib/fixtures/resolve-identity.test.ts`, `apps/csrm/src/domain/route-access.test.ts` — parity, boundary, and callback-order tests.

## Decisions Made

- Preserved the source catalogue’s singular `Questionnaire:*` values while defining the independent UI group label `Questionnaires`.
- Used a short-lived (eight-hour) strict httpOnly cookie only after server runtime and exact-key validation; arbitrary cookie content falls back safely to Jane.
- Kept preflight results intentionally free of protected service data and documented them as non-authoritative UI guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected runtime argument typing for the fixture gate**
- **Found during:** Task 2
- **Issue:** TypeScript inferred `process.env.NODE_ENV` too narrowly for the injectable production/test resolver boundary.
- **Fix:** Explicitly accepted `string | undefined` runtime input while retaining an exact development/test allow-list.
- **Files modified:** `apps/csrm/src/lib/fixtures/resolve-identity.ts`
- **Verification:** Fixture unit suite and `yarn workspace @idambox/csrm check-types` pass.
- **Committed in:** `2ec0c65`

**Total deviations:** 1 auto-fixed (Rule 1)

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/config/capabilities.test.ts src/lib/fixtures/resolve-identity.test.ts src/domain/route-access.test.ts` — pass (3 files, 12 tests).
- `yarn workspace @idambox/csrm check-types` — pass.
- Source catalogue and backend seed contract — unchanged.
- Catalogue parity evidence: 23 Function IDs; Requestor 8; explicit Security Analyst 17; union 23; 1 enabled and 22 planned routes.

## Known Stubs

None.

## Next Phase Readiness

Plan 06-07 can consume `IdentitySnapshot`, `visibleRoutes`, and `resolveRouteAccess` for shell rendering and direct-route state handling. Phase 13 remains responsible for real OIDC, FunctionApi, and record-level backend authorization.

## Self-Check: PASSED

- All ten plan-owned source/test files exist.
- All six task commits are present in git history.
