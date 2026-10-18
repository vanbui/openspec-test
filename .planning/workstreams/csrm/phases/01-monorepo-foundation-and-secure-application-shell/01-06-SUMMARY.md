---
phase: 01-monorepo-foundation-and-secure-application-shell
plan: "06"
subsystem: web-api-transport
tags: [strapi, openapi-fetch, transport-validation, vitest]
requires:
  - phase: 01-04
    provides: server-only typed OpenAPI transport and shell service seam
provides:
  - validated canonical Strapi REST base ending in /api
  - loopback HTTP proof for generated path URL composition
  - documented CSRM_API_BASE_URL operator contract
affects: [phase-01-03, phase-01-05, phase-08-keycloak]
actuals:
  tokens: 1504
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [validated-server-transport-base, loopback-url-composition-test]
key-files:
  created:
    - apps/web/src/lib/api/transport/server-client.test.ts
  modified:
    - apps/web/src/lib/api/transport/server-client.ts
    - apps/web/.env.local.example
    - apps/web/README.md
key-decisions:
  - "CSRM_API_BASE_URL represents the complete Strapi REST base and must terminate in /api."
  - "Transport configuration errors use a stable redacted message and never reflect configured URL input."
patterns-established:
  - "Feature services use generated contract paths while the server-only transport owns canonical base validation."
requirements-completed: [FOUND-03, FOUND-05]
coverage:
  - id: D1
    description: The generated /applications path reaches the configured Strapi /api REST endpoint without doubled slashes.
    requirement: FOUND-03
    verification:
      - kind: integration
        ref: apps/web/src/lib/api/transport/server-client.test.ts#createStrapiClient
        status: pass
    human_judgment: false
  - id: D2
    description: Operator configuration and the server-only typed client share one validated Strapi REST base contract.
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: pnpm --filter @csrm/web exec vitest run src/lib/api/transport/server-client.test.ts src/features/shell/shell-service.test.ts
        status: pass
      - kind: integration
        ref: pnpm --filter @csrm/web api:check
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-08-28
status: complete
---

# Phase 01 Plan 06: Canonical Strapi REST Transport Summary

**Validated server-only Strapi REST base construction now proves generated `/applications` calls reach `/api/applications` over a real loopback HTTP connection.**

## Performance

- **Duration:** 6min
- **Started:** 2026-08-28T04:29:00Z
- **Completed:** 2026-08-28T04:35:34Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Required an absolute HTTP(S) `CSRM_API_BASE_URL` with no credentials, query string, or fragment, ending at the Strapi REST `/api` segment.
- Added real loopback transport coverage for `/api/applications`, trailing-slash normalization, and reverse-proxy REST prefixes.
- Documented the same canonical base contract in the local environment example and web README.

## Task Commits

1. **Task 1: Prove a generated path reaches the canonical Strapi REST URL** — `2655ee4` (fix)
2. **Task 2: Make the canonical API base contract explicit and regression-proof** — `07d2ef9` (test)

## Files Created/Modified

- `apps/web/src/lib/api/transport/server-client.ts` — validates and normalizes the canonical server-only Strapi REST base.
- `apps/web/src/lib/api/transport/server-client.test.ts` — uses a real Node loopback listener to verify final generated request paths and rejects unsafe configuration values.
- `apps/web/.env.local.example` — sets the local REST base to `http://localhost:1337/api`.
- `apps/web/README.md` — documents the exact operator configuration contract.

## Decisions Made

- `CSRM_API_BASE_URL` is the full Strapi REST base rather than the origin; reverse-proxy prefixes remain valid when the path ends in `/api`.
- Invalid configuration always emits the stable `CSRM API configuration is invalid.` message, which never reveals the configured source value or embedded credentials.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm --filter @csrm/web exec vitest run src/lib/api/transport/server-client.test.ts src/features/shell/shell-service.test.ts` — passed (12 tests).
- `pnpm --filter @csrm/web api:check` — passed; generated OpenAPI schema has no drift.
- `pnpm --filter @csrm/web typecheck` — passed.
- `git diff --check` — passed.

## Issues Encountered

- The repository requests Node 24 while the available runtime is Node 22.19.0. The package manager emitted its expected engine warning, but every required verification command passed.
- Loopback HTTP listening requires the execution environment's network permission; the integration test passed against a real local listener once enabled.

## Next Phase Readiness

- The typed service boundary now has a verified Strapi-compatible URL target and can remain the sole construction point for production API access.
- Phase 01 authorization and test/CI gap plans can rely on the canonical server transport base contract.

## Self-Check: PASSED

- `2655ee4` and `07d2ef9` exist in Git history.
- The transport module and its loopback integration test exist at their documented paths.

---
*Phase: 01-monorepo-foundation-and-secure-application-shell*
*Completed: 2026-08-28*
