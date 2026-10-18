---
phase: 07-requestor-request-workflow
plan: "03"
subsystem: api
tags: [nextjs, strapi, openapi, msw, vitest, server-only, security]
requires:
  - phase: 07-requestor-request-workflow
    provides: 105-operation generated request-workflow OpenAPI contract and protected backend routes.
provides:
  - Server-only typed request and catalogue adapters with internal-token and actor assertion headers.
  - Runtime envelope guards, safe transport/validation results, and HTTP-level MSW parity.
  - A deterministic coverage gate for all Phase 7 affected operations and FunctionApi traceability.
affects: [07-04-server-actions, 07-05-request-form, 07-06-request-details, 07-07-dashboard-list, 07-08-hardening]
actuals:
  tokens: 9018
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Generated paths-derived request/response aliases and server-only authenticated request execution.
    - MSW HTTP doubles preserve production method, prefix, JSON envelope, and internally controlled authentication headers.
    - Coverage verification inspects the committed OpenAPI, service exports, coverage matrix, and FunctionApi catalogue without mutating them.
key-files:
  created:
    - apps/csrm/scripts/verify-request-api-coverage.mjs
  modified:
    - apps/csrm/src/config/env.ts
    - apps/csrm/src/domain/service-result.ts
    - apps/csrm/src/lib/api/client.ts
    - apps/csrm/src/lib/api/csrm-service.ts
    - apps/csrm/src/lib/api/csrm-service.test.ts
    - apps/csrm/src/test/handlers.ts
    - apps/csrm/src/test/fixtures.ts
key-decisions:
  - "Enforce the approved 105-operation contract because generic assessment-request DELETE is deliberately prohibited."
  - "Build Authorization and actor-email headers only in server-only transport, with no caller-supplied header API."
  - "Keep FunctionApi URLs as catalogue traceability, never as a second frontend endpoint contract."
patterns-established:
  - "Focused service methods accept a server-derived actor email and use generated path aliases with runtime envelope guards."
  - "Write failures expose only approved global or field-safe messages; response bodies, URLs, headers, tokens, and actor details are discarded."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Authenticated typed request service supports every approved request and catalogue operation with no delete adapter.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Coverage gate reconciles the 105-operation OpenAPI, coverage decisions, service exports, and FunctionApi rows.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: node apps/csrm/scripts/verify-request-api-coverage.mjs
        status: pass
      - kind: integration
        ref: yarn workspace @idambox/csrm verify:openapi
        status: pass
    human_judgment: false
duration: 27m
completed: 2026-08-23
status: complete
---

# Phase 07 Plan 03: Typed Request Service and Coverage Summary

**Server-only, generated-type request and catalogue transport with internal actor authentication, runtime-safe envelopes, MSW parity, and a 105-operation coverage gate.**

## Performance

- **Duration:** 27m
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added nine focused request/catalogue adapters, keeping mutations internally authenticated and generated contracts as the transport source of truth.
- Added safe configuration, HTTP, network, timeout, malformed-response, and field-validation outcomes that discard sensitive transport detail.
- Added HTTP-level MSW request parity and a non-mutating verifier for the approved coverage matrix, FunctionApi reconciliation, and absent request DELETE operation.

## Task Commits

1. **Task 1: Carry every integrated operation through the authenticated typed CSRM service** — `8bdfde1` (RED tests), `c07da3d` (implementation).
2. **Task 2: Enforce the API coverage matrix with exact HTTP-level MSW parity** — `00433a7` (coverage gate).

## Files Created/Modified

- `apps/csrm/src/config/env.ts`, `src/domain/service-result.ts`, and `src/lib/api/client.ts` — server-only configuration, protected headers, timeout/content/runtime checks, and safe results.
- `apps/csrm/src/lib/api/csrm-service.ts` — generated type aliases and focused request/catalogue adapters.
- `apps/csrm/src/test/{fixtures,handlers}.ts` and `src/lib/api/csrm-service.test.ts` — HTTP-level MSW fixtures for lifecycle, catalogue, safe errors, and unhandled requests.
- `apps/csrm/scripts/verify-request-api-coverage.mjs` — contract and coverage matrix enforcement.

## Decisions Made

- Preserved the secure 105-operation contract: dashboard, submit, and withdraw are present while generic request DELETE is absent.
- Used only server-only internal token and actor-email construction; public/browser callers cannot inject arbitrary transport headers.
- Limited catalogue reads to a result bound of 25 and encoded each query once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the stale 106-operation target to the accepted 105-operation contract**
- **Found during:** Task 2
- **Issue:** The plan and older coverage prose retained a 106-operation total, which conflicts with the deliberately removed generic request DELETE operation.
- **Fix:** The coverage gate asserts 105 operations, all nine approved adapters, and the absence of DELETE.
- **Files modified:** `apps/csrm/scripts/verify-request-api-coverage.mjs`
- **Verification:** Coverage gate and OpenAPI drift check passed.

**2. [Rule 3 - Blocking] Corrected the coverage-verifier root-relative path**
- **Found during:** Task 2
- **Issue:** The first verifier lookup resolved `.planning` beneath `apps/` and could not load the coverage matrix.
- **Fix:** Resolved the matrix from the repository root relative to the script location.
- **Files modified:** `apps/csrm/scripts/verify-request-api-coverage.mjs`
- **Verification:** The final verifier passed with 105 operations, 9 adapters, and 16 reconciled FunctionApi rows.

**Total deviations:** 2. Both preserve the approved request-workflow security boundary without expanding scope or changing dependencies.

## Issues Encountered

- The shared worktree Git index was briefly held by another executor while committing Task 2. The parent executor committed the final verified gate as `00433a7`; no files were reverted or lost.
- `yarn workspace @idambox/csrm verify` remains blocked by three unrelated stale tests that assert 23 capabilities although the committed catalogue contains 27. The Plan 07-03 service tests, type check, coverage gate, OpenAPI drift check, and backend type check all pass.

## Known Stubs

None.

## Verification

- `node apps/csrm/scripts/verify-request-api-coverage.mjs` — passed (105 operations, 9 adapters, 1 prohibited DELETE, 16 FunctionApi rows).
- `yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts` — passed (3 tests).
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm verify:openapi` — passed.
- `yarn workspace backend check-types` — passed.
- `yarn workspace @idambox/csrm verify` — known unrelated 23-vs-27 capability-count failures; no Plan 07-03 test failure.

## TDD Gate Compliance

Task 1 has both a failing `test(07-03)` commit and succeeding `feat(07-03)` commit. Task 2's initial failing coverage script ran, but its separate RED commit could not be recorded because the shared Git index lock was held; the final green coverage gate was committed as `00433a7`.

## Next Phase Readiness

Plan 07-04 can resolve a trusted server actor and call save, submit, and withdraw through this safe generated service boundary.

## Self-Check: PASSED

Confirmed all eight implementation artifacts and the summary exist; commits `8bdfde1`, `c07da3d`, and `00433a7` are present in Git history.
