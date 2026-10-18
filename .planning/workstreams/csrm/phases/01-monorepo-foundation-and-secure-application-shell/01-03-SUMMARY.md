---
phase: 1
plan: "03"
subsystem: strapi-authorization
tags: [strapi, authorization, function-api, idor, node-test]
requires:
  - phase: 01-02
    provides: development session and capability adapters that remain separate from backend authorization
  - phase: 01-04
    provides: explicit Strapi authorization-boundary ownership in the transport contract
provides:
  - fail-closed Strapi FunctionAPI policy using IdamBox Role to Function to FunctionAPI grants
  - record-level assessment request ownership enforcement for Requestors
  - executable two-identity backend authorization tests independent of browser fixtures
affects: [phase-01-05, phase-08-keycloak, csrm-assessment-request-api]
tech-stack:
  added: []
  patterns: [compiled-strapi-policy-tests, implicit-requestor-role, fail-closed-record-authorization]
key-files:
  created:
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/tests/fixtures/authorization.ts
    - apps/strapi/tests/authorization.integration.test.js
  modified:
    - apps/strapi/package.json
    - apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
key-decisions:
  - "The Requestor role is resolved implicitly from Strapi role data even when it is not assigned directly to an IdamBox user."
  - "Strapi denies requests without a trusted server-side IdamBox identity; browser development-role cookies are never read by authorization policy."
requirements-completed: [FOUND-04, FOUND-05]
coverage:
  - id: D1
    description: Two backend identities prove a Requestor is denied an ungranted FunctionAPI operation while an explicitly assigned Security Analyst is allowed.
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: pnpm --filter @csrm/strapi test
        status: pass
    human_judgment: false
  - id: D2
    description: A Requestor cannot retrieve another identity's restricted CSRM Assessment Request by substituting its document ID.
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: apps/strapi/tests/authorization.integration.test.js#Strapi denies a URL-substituted restricted assessment request
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 03: Strapi Authorization Harness Summary

**Compiled Strapi authorization policies now resolve effective IdamBox grants and deny both ungranted FunctionAPI operations and cross-Requestor assessment request access.**

## Accomplishments

- Added a fail-closed Strapi policy that combines the implicit Requestor role with explicit IdamBox roles, then matches the requested FunctionAPI operation.
- Protected CSRM assessment request routes with operation-specific policy configuration and Requestor ownership checks.
- Added an executable Node test harness with two server-side identities and a restricted assessment request; it does not read or send frontend development-role cookies.

## Task Commits

1. **Task 1: Build the backend authorization integration harness (RED)** — `2d13708` (`test`)
2. **Task 1: Build the backend authorization integration harness (GREEN)** — `d11a1a4` (`feat`)

## Files Created/Modified

- `apps/strapi/src/policies/csrm-authorization.ts` — evaluates effective grants and record ownership at the Strapi boundary.
- `apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` — applies operation and record-ownership policy configuration to assessment request routes.
- `apps/strapi/tests/fixtures/authorization.ts` — supplies seeded backend identities, grants, and a restricted record for policy tests.
- `apps/strapi/tests/authorization.integration.test.js` — proves FunctionAPI and substituted-record denial after compiling Strapi source.
- `apps/strapi/package.json` — provides a finite Strapi test command without adding a new dependency.

## Decisions Made

- The authorization policy accepts only a trusted server-side `idamboxUser` identity hand-off; without one it denies access. Keycloak integration must populate that state at the Strapi boundary in the future.
- Requestors receive their birthright role through the authorization resolver rather than a persisted duplicate assignment.
- Record-level denials return Strapi's forbidden semantics, which the plan explicitly allows and the tests assert.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The available Node runtime is 22.19.0 while the workspace declares Node 24.19.0 or newer. pnpm emitted its expected engine warning, but compilation and all authorization checks passed. No runtime configuration was changed.

## Next Phase Readiness

- Plan 01-05 can call the finite Strapi test command from its broader CI harness.
- Phase 8 Keycloak work must bind validated Keycloak identity claims to the trusted `idamboxUser` server state; no frontend fixture is accepted as authorization input.

## Self-Check: PASSED

- `2d13708` and `d11a1a4` exist in Git history.
- The compiled policy, route configuration, fixtures, and authorization test exist at their documented paths.
- `pnpm --filter @csrm/strapi test` and `pnpm --filter @csrm/strapi exec tsc --noEmit` passed.
