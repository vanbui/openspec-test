---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "03"
subsystem: api
tags: [openapi, openapi-typescript, msw, vitest, nextjs, strapi]
requires:
  - phase: 06-02
    provides: Audited CSRM Next.js workspace and runnable server-rendered foundation
provides:
  - Full committed TypeScript transport representation for the 103-operation Strapi OpenAPI contract
  - Prefix-safe, server-only applications service with safe discriminated failures
  - Reproducible OpenAPI drift gate and fail-closed Node MSW coverage
affects: [06-04-capabilities, CSRM-workflow-phases, Phase-13-integration]
actuals:
  tokens: 144540
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [committed-openapi-transport-types, server-only-focused-service, fail-closed-msw-node-tests]
key-files:
  created: [apps/csrm/src/lib/api/generated/openapi.ts, apps/csrm/src/lib/api/client.ts, apps/csrm/src/lib/api/csrm-service.ts, apps/csrm/scripts/generate-openapi.mjs, apps/csrm/scripts/check-openapi-drift.mjs]
  modified: [apps/csrm/package.json, apps/csrm/src/lib/api/csrm-service.test.ts, apps/csrm/vitest.config.ts]
key-decisions:
  - "Commit generated OpenAPI types and fail verification on byte-level drift from specification.json."
  - "Preserve CSRM_STRAPI_BASE_URL path prefixes and keep transport configuration and services server-only."
  - "Expose only listApplications in Phase 6; backend authorization remains authoritative."
patterns-established:
  - "Focused API services return ServiceResult and never surface raw HTTP, header, body, timeout, or network details."
  - "Node MSW uses centralized lifecycle hooks with onUnhandledRequest set to error."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Committed generated TypeScript types for all 103 Strapi OpenAPI operations with deterministic, non-mutating drift detection
    requirement: APP-06
    verification:
      - kind: integration
        ref: yarn workspace @idambox/csrm generate:openapi && yarn workspace @idambox/csrm verify:openapi
        status: pass
    human_judgment: false
  - id: D2
    description: Server-only prefix-safe GET /applications service with typed responses and fail-closed HTTP interception
    requirement: APP-06
    verification:
      - kind: unit
        ref: apps/csrm/src/lib/api/csrm-service.test.ts
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm test && yarn workspace @idambox/csrm check-types
        status: pass
    human_judgment: false
duration: 6 min
completed: 2026-08-09
status: complete
---

# Phase 06 Plan 03: Typed Strapi Transport Boundary Summary

**A committed 103-operation Strapi transport type artifact, prefix-safe server-only applications service, non-mutating drift gate, and fail-closed MSW regression suite.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-09T19:34:01+10:00
- **Completed:** 2026-08-09T19:40:28+10:00
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Generated and committed TypeScript definitions for all 103 operations from the Phase 5 `specification.json` transport authority; `COVERAGE.md` continues to restrict the sole Phase 6 runtime adapter to `GET /applications`.
- Added a server-only fetch client that retains a configured Strapi URL prefix, requires production configuration, times out safely, and returns a discriminated `ServiceResult` without leaking response or transport details.
- Added deterministic generation and byte-level drift verification using an OS-temporary comparison artifact, plus centralized MSW interception that rejects undeclared outbound traffic.

## Task Commits

1. **Task 1: Carry GET /applications through generated types, server transport, and MSW** — `3215847` (test), `0708d64` (feat)
2. **Task 2: Commit reproducible full-contract generation and drift detection** — `49e0c64` (feat)
3. **Task 3: Fail closed on HTTP errors, malformed data, timeouts, and network escape** — `24bb90a` (test)

## Files Created/Modified

- `apps/csrm/src/lib/api/generated/openapi.ts` — Reviewable generated types for every committed transport operation.
- `apps/csrm/src/config/env.ts` and `src/lib/api/client.ts` — Server-only non-public configuration, prefix-safe joining, abort timeout, and safe normalization.
- `apps/csrm/src/lib/api/csrm-service.ts` — The only Phase 6 runtime service method, `listApplications`.
- `apps/csrm/scripts/generate-openapi.mjs` and `check-openapi-drift.mjs` — Allowlisted deterministic generation and temporary byte-comparison gate.
- `apps/csrm/src/test/*` and `csrm-service.test.ts` — Centralized fail-closed MSW setup and 11 focused success/failure assertions.

## Decisions Made

- Generated OpenAPI output is committed as reviewable source and checked for byte-identical drift; this is reversible and no assumption-delta detector fired.
- `specification.json`, not the FunctionApi capability catalogue, remains the sole transport authority.
- The client provides display/data preflight only; Strapi remains the authorization and record-level enforcement authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the package script routing required by the planned generation scripts**
- **Found during:** Task 2
- **Issue:** `package.json` still invoked the generator directly and implemented drift verification by rewriting the committed artifact, so it could not call the planned non-mutating scripts.
- **Fix:** Routed only `generate:openapi` and `verify:openapi` to the planned scripts; dependency versions and the lockfile were unchanged.
- **Files modified:** `apps/csrm/package.json`
- **Verification:** Generation, temporary drift comparison, and clean generated-artifact diff passed.
- **Committed in:** `49e0c64`

**2. [Rule 1 - Bug] Canonicalized the temporary-directory path used by the drift gate**
- **Found during:** Task 2
- **Issue:** macOS `/var` and `/private/var` path aliasing caused an approved temporary output to fail the output allowlist.
- **Fix:** Resolved the temporary directory once before building the temporary artifact path.
- **Files modified:** `apps/csrm/scripts/check-openapi-drift.mjs`
- **Verification:** The controlled altered artifact failed drift detection; regeneration restored it and the normal byte-identical check passed.
- **Committed in:** `49e0c64`

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).

## Issues Encountered

- The Task 3 RED suite passed immediately because Task 1’s shared client already implemented the planned safe error categories. The additional tests were committed as regression coverage; the plan-level TDD sequence remains present (`3215847` RED before `0708d64` GREEN).

## Known Stubs

None.

## User Setup Required

None. Development and test use the explicit local `http://localhost:1337/api` default; production requires non-public `CSRM_STRAPI_BASE_URL`.

## Next Phase Readiness

Later CSRM phases can add focused server-only services from the generated contract without exposing raw transport access or inventing a second route catalogue.

## Self-Check: PASSED

- Confirmed all 15 declared implementation/test files exist.
- Confirmed task commits `3215847`, `0708d64`, `49e0c64`, and `24bb90a` exist.
- Confirmed 23 total unit tests, strict type-checking, the 103-operation generator, and the non-mutating drift gate pass.
