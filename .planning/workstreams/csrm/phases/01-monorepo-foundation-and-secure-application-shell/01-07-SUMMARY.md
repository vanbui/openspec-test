---
phase: 01-monorepo-foundation-and-secure-application-shell
plan: "07"
subsystem: strapi-authorization
tags: [strapi, authorization, idor, function-api, requestor-ownership]
requires:
  - phase: 01-03
    provides: compiled Strapi authorization policy and two-identity regression harness
provides:
  - active-account enforcement and explicit Security Analyst FunctionAPI exceptions
  - trusted Requestor collection scoping and create ownership derivation
  - canonical served assessment-request operation identifiers
affects: [01-08, 01-09, phase-08-keycloak]
actuals:
  tokens: 6583
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [explicit-analyst-grants, policy-produced-collection-scope, trusted-requestor-ownership]
key-files:
  created:
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/src/api/csrm-assessment-request/request-ownership.ts
    - apps/strapi/src/api/csrm-assessment-request/operations.ts
  modified:
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
    - apps/strapi/tests/fixtures/authorization.ts
    - apps/strapi/tests/authorization.integration.test.js
key-decisions:
  - "The implicit Requestor birthright grants only own-record and own-collection access; non-owner exceptions require the exact FunctionAPI on an explicitly assigned allowlisted analyst role."
  - "Assessment request ownership is always derived from trusted server state and cannot be selected from client JSON."
requirements-completed: [FOUND-04, FOUND-05]
coverage:
  - id: D1
    description: Active IdamBox identities require a matching FunctionAPI, with analyst naming alone unable to bypass record ownership.
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: apps/strapi/tests/authorization.integration.test.js#active-grant-and-ownership-cases
        status: pass
    human_judgment: false
  - id: D2
    description: Requestor collection reads are forced through an ANDed trusted ownership predicate, while authorised analysts receive all scope.
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: apps/strapi/tests/authorization.integration.test.js#collection-scope-cases
        status: pass
    human_judgment: false
  - id: D3
    description: Forged Requestor relations are replaced and the five served Strapi operation identifiers are exact.
    requirement: FOUND-05
    verification:
      - kind: integration
        ref: apps/strapi/tests/authorization.integration.test.js#create-ownership-and-operation-cases
        status: pass
    human_judgment: false
duration: 26min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 07: Authorization Gap Closure Summary

**Strapi now denies inactive identities, requires explicit grant-bearing analyst roles for non-owner access, scopes Requestor collections server-side, and overwrites forged Requestor ownership.**

## Accomplishments

- Separated implicit Requestor birthright grants from explicit analyst-role grants, with active-account enforcement before authorization evaluation.
- Added a policy-to-controller own/all collection decision that ANDs trusted Requestor identity with untrusted client filters.
- Bound assessment-request creation and all five served Strapi route-policy identifiers to trusted server facts.

## Task Commits

1. **Task 1: Enforce active identity and grant-bearing analyst scope** — `142df3a` (`fix`)
2. **Task 2: Apply the trusted collection scope before core find** — `603d2a5` (`fix`)
3. **Task 3: Bind create ownership and all served operation identifiers to trusted server facts** — `386e1f3` (`fix`)

## Files Created/Modified

- `apps/strapi/src/policies/csrm-authorization.ts` — active identity checks, separated grants, and trusted scope decisions.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` — fail-closed trusted query shaping.
- `apps/strapi/src/api/csrm-assessment-request/request-ownership.ts` — server-owned create relation replacement.
- `apps/strapi/src/api/csrm-assessment-request/operations.ts` — canonical GET, POST, PUT, and DELETE operation map.
- `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` — applies scope and ownership before core actions.
- `apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` — imports exact operation constants and enables collection scope.
- `apps/strapi/tests/fixtures/authorization.ts` and `apps/strapi/tests/authorization.integration.test.js` — grant, collection, ownership, and route regressions.

## Decisions Made

- The Requestor role remains implicit, but only gives `own` collection scope; an explicit Security Analyst role must itself contain the current FunctionAPI before it grants `all` scope or cross-owner access.
- The request body is not an authority source: create always overwrites `requestor` with `ctx.state.idamboxUser.documentId`.
- The current Strapi core router defines the source-of-truth operation strings under `/api`; Plan 01-09 owns synchronising the supplied FunctionAPI catalogue and its route matrix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed optional request body access in ownership helper**
- **Found during:** Task 3
- **Issue:** Strict TypeScript correctly identified that the optional request body could be absent after initial validation.
- **Fix:** Retained the validated body reference before replacing `data.requestor`.
- **Files modified:** `apps/strapi/src/api/csrm-assessment-request/request-ownership.ts`
- **Verification:** `pnpm --filter @csrm/strapi test && pnpm --filter @csrm/strapi exec tsc --noEmit`
- **Committed in:** `386e1f3`

**Total deviations:** 1 auto-fixed (Rule 1)

## Issues Encountered

The local runtime is Node 22.19.0 while the workspace root requests Node 24.19.0 or newer. pnpm emitted the expected engine warning, but the finite Strapi test suite and strict compilation passed without changing runtime configuration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-08 can prove the protected routes through the mounted Strapi HTTP boundary using these fail-closed policy, scope, and ownership seams.
- Plan 01-09 can align the supplied catalogue and grant matrix to the canonical served operation constants.

## Self-Check: PASSED

- `142df3a`, `603d2a5`, and `386e1f3` exist in Git history.
- All documented authorization, scoping, ownership, and operation files exist.
- `pnpm --filter @csrm/strapi test`, `pnpm --filter @csrm/strapi exec tsc --noEmit`, and `git diff --check` passed.
