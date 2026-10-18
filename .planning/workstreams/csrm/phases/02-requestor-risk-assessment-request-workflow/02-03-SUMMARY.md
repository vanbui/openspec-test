---
phase: 02-requestor-risk-assessment-request-workflow
plan: 03
subsystem: auth
tags: [nextjs, openapi-fetch, development-auth, typed-transport]

requires:
  - phase: 02-requestor-risk-assessment-request-workflow
    provides: Development session roles and the fail-closed Strapi development identity bridge
provides:
  - Closed Requestor and Security Analyst fixture email mapping
  - Server-derived development identity header on the typed Strapi client
  - Negative test matrix for runtime, flag, session, and role gates
affects: [02-04, 02-05, 02-06, requestor-workflow, analyst-workflow]

tech-stack:
  added: []
  patterns: [server-only identity derivation, exact environment gates, async typed client factory]

key-files:
  created: []
  modified:
    - apps/web/src/lib/auth/development-session-adapter.ts
    - apps/web/src/lib/api/transport/server-client.ts
    - apps/web/src/lib/api/transport/server-client.test.ts
    - apps/web/src/features/shell/shell-service.ts
    - apps/web/.env.local.example

key-decisions:
  - "Fixture identity is derived inside the server-only Strapi client factory and cannot be supplied by callers."
  - "The identity header is omitted unless NODE_ENV is development, CSRM_DEV_IDENTITY is exactly true, and a mapped session role exists."

patterns-established:
  - "Trusted development identity: resolve the validated server session and closed role mapping at the transport boundary."
  - "Fail-closed transport configuration: omit development credentials whenever any exact gate is absent or invalid."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 4min
completed: 2026-08-29
---

# Phase 2 Plan 3: Server-Derived Development Identity Summary

**Typed Strapi requests now carry a closed, server-derived Jane or Bob fixture identity only when every development gate succeeds.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T12:20:11Z
- **Completed:** 2026-08-29T12:23:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added exact Requestor-to-Jane and Security-Analyst-to-Bob fixture identity mapping in a server-only module.
- Made the typed Strapi client factory async so it can derive identity from the trusted server session without caller input.
- Proved exact mapping plus fail-closed behavior for missing or false flags, non-development runtime, missing session, and invalid role.
- Preserved canonical Strapi base URL validation and existing shell transport behavior.

## TDD Cycle

- **RED:** Added the focused trusted-session header contract and confirmed it failed only with `PHASE2_RED_02_03_01_DEV_IDENTITY_HEADER_ABSENT`.
- **GREEN:** Added the closed fixture mapping, exact environment gates, async typed client creation, and awaited server caller.
- **REFACTOR:** No separate refactor was needed; the minimal implementation remained clear and fully typed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify closed development fixture identity mapping** - `0da2e76` (test)
2. **Task 2: Attach server-derived identity in createStrapiClient** - `a6e810a` (feat)

## Files Created/Modified

- `apps/web/src/lib/auth/development-session-adapter.ts` - Exports the closed role-to-fixture identity mapping.
- `apps/web/src/lib/api/transport/server-client.ts` - Derives and attaches the gated identity header while preserving `Client<paths>`.
- `apps/web/src/lib/api/transport/server-client.test.ts` - Covers exact identities, all omission gates, base URL behavior, and the async factory.
- `apps/web/src/features/shell/shell-service.ts` - Awaits typed Strapi client creation before issuing a request.
- `apps/web/.env.local.example` - Documents the development identity bridge as disabled by default.

## Decisions Made

- Kept fixture mapping in the server-only development session module so it cannot enter client component bundles.
- Used openapi-fetch client headers after trusted session resolution; no identity or header override was added to the factory signature.
- Validated the Strapi base URL before session resolution so invalid configuration still fails immediately and safely.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Strict TypeScript caught an initial import from the session interface module instead of the development adapter; the import and isolated module mock were corrected before the GREEN gate.
- The missing-flag test helper initially treated explicit `undefined` as its default enabled value; a distinct missing-value case corrected the negative branch.

## User Setup Required

None - the example configuration keeps `CSRM_DEV_IDENTITY=false` by default.

## Next Phase Readiness

- Server-only typed services can now authenticate deterministic Requestor and Security Analyst fixture calls in development.
- Ready for Plan 02-04 workflow service and screen integration.
- No blockers.

## Self-Check: PASSED

- All five modified implementation files and this summary exist.
- Task commits `0da2e76` and `a6e810a` are present in repository history.
- Strict TypeScript and the complete 24-test web suite pass.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
