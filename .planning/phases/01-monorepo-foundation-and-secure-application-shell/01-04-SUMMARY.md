---
phase: 1
plan: "04"
subsystem: web-api-transport
tags: [openapi, openapi-typescript, openapi-fetch, turborepo, strapi]
requires:
  - phase: 01-02
    provides: strict TypeScript web shell and server-side session boundary
provides:
  - committed OpenAPI-derived Strapi transport schema
  - server-only typed Strapi client and shell service seam
  - Turbo OpenAPI drift check and documented backend contract gaps
affects: [phase-01-03, phase-01-05, phase-08-keycloak]
tech-stack:
  added: []
  patterns: [generated-types-internal, server-only-typed-transport, feature-service-response-validation]
key-files:
  created:
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/web/src/lib/api/transport/server-client.ts
    - apps/web/src/features/shell/shell-service.ts
    - docs/contract-gaps/phase-01-openapi-gaps.md
  modified:
    - turbo.json
key-decisions:
  - "Generated OpenAPI types and client construction remain internal; feature code consumes domain services."
  - "Missing effective-capability and Keycloak contracts stay explicit backend gaps rather than becoming a Next.js facade."
requirements-completed: [FOUND-03, FOUND-04, FOUND-05]
coverage:
  - id: D1
    description: Committed OpenAPI types regenerate reproducibly and fail the drift check when they differ.
    requirement: FOUND-03
    verification:
      - kind: integration
        ref: pnpm --filter @csrm/web api:check
        status: pass
    human_judgment: false
  - id: D2
    description: Typed shell service validates transport data and hides raw transport failures behind a safe domain result.
    requirement: FOUND-03
    verification:
      - kind: unit
        ref: apps/web/src/lib/boundaries/alignment.test.ts#parses application transport data before constructing UI models
        status: pass
    human_judgment: false
  - id: D3
    description: Missing effective-capability and Keycloak callback contracts remain owned by the backend authentication and authorization boundaries.
    requirement: FOUND-04
    verification:
      - kind: other
        ref: docs/contract-gaps/phase-01-openapi-gaps.md
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 04: Typed Strapi Transport Summary

**Committed OpenAPI types, one server-only `openapi-fetch` construction point, a validated shell service, and explicit backend-contract gaps establish the web-to-Strapi boundary.**

## Accomplishments

- Preserved the existing `2095a28` transport implementation and its generated schema, server-only client, and shell feature-service seam.
- Added a finite Turbo `api:check` task alongside type checking, proving committed OpenAPI output has no drift.
- Expanded the contract-gap record with the owner, boundary, required operation, and Phase 1 behavior for effective capabilities and Keycloak callback/session exchange.

## Task Commits

1. **Task 1: Generate committed OpenAPI types and create the server transport contract** — `2095a28`, `733f2f7`
2. **Task 2: Add a tested domain service and document missing backend contracts** — `4d0a66b`

## Files Created/Modified

- `apps/web/src/lib/api/generated/schema.d.ts` — generated internal OpenAPI paths and schema types.
- `apps/web/src/lib/api/transport/server-client.ts` — sole server-only typed Strapi client construction and redacted error normalization.
- `apps/web/src/features/shell/shell-service.ts` — runtime-validated feature service mapping application transport data to shell models.
- `docs/contract-gaps/phase-01-openapi-gaps.md` — backend ownership and required operations for absent capability and Keycloak contracts.
- `turbo.json` — finite `api:check` task for CI/workspace orchestration.

## Decisions Made

- Generated transport types and `openapi-fetch` stay internal to the server transport; pages and components do not call raw `fetch` or import generated schema types.
- Strapi remains responsible for Role → Function → FunctionAPI and record-level decisions. Development role fixtures are never forwarded as Strapi authorization.
- The generic provider callback described by the current API contract is insufficient to model the future Keycloak authorization-code/session exchange, so the web adapter remains fail-closed until that server contract exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added OpenAPI drift verification to the Turbo task graph**
- **Found during:** Task 1
- **Issue:** The workspace had package-level generation/check scripts but no finite Turbo task to schedule the API drift check with type checking.
- **Fix:** Added the cacheable, output-free `api:check` task to `turbo.json`.
- **Files modified:** `turbo.json`
- **Verification:** `pnpm turbo run api:check typecheck --filter @csrm/web` passed.
- **Committed in:** `733f2f7`

**2. [Rule 2 - Missing critical functionality] Made contract-gap ownership and required operations traceable**
- **Found during:** Task 2
- **Issue:** The original gap note named absent functionality but did not separately identify the owner, boundary, future operation, and safe interim behavior.
- **Fix:** Replaced the prose note with a traceability table that preserves Strapi and Keycloak responsibility.
- **Files modified:** `docs/contract-gaps/phase-01-openapi-gaps.md`
- **Verification:** Contract document review and static boundary checks passed.
- **Committed in:** `4d0a66b`

**Total deviations:** 2 auto-fixed Rule 2 corrections. Both reinforce required transport integrity and authorization boundaries without expanding the frontend API surface.

## Verification

- `pnpm --filter @csrm/web api:generate` — passed; generated schema is reproducible.
- `pnpm --filter @csrm/web api:check` — passed; no schema drift.
- `pnpm turbo run api:check typecheck --filter @csrm/web` — passed.
- `pnpm --filter @csrm/web exec vitest run src/lib/boundaries/alignment.test.ts --environment jsdom` — passed (5 tests).
- `pnpm --filter @csrm/web typecheck` — passed.
- Static boundary checks confirmed `server-only` is present, `createClient` occurs only in the transport module, no `apps/web/app/api` facade exists, and no raw `fetch` occurs in web pages or source.

## Issues Encountered

- The repository declares Node 24 while the available Node runtime is 22.19.0. Commands emitted the expected engine warning but all required generation, tests, and type checks passed. No runtime or dependency configuration was changed.

## Next Phase Readiness

- Plan 01-03 can test Strapi authorization and record-level behavior against the explicit backend authority boundary.
- Plan 01-05 can expand the focused shell-service coverage into its owned full test and CI harness.

## Self-Check: PASSED

- `2095a28`, `733f2f7`, and `4d0a66b` exist in Git history.
- Generated schema, transport module, shell service, contract-gap record, and Turbo task configuration exist at their documented paths.
