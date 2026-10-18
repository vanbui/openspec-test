---
phase: 05-risk-register-and-mitigation-management
plan: 03
subsystem: api
tags: [openapi, openapi-fetch, zod, risk-register, server-only]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised mounted Risk Register read and closed backend query/projection from Plan 05-02
provides:
  - Closed GET /v1/risks OpenAPI operation with generated openapi-fetch types
  - Canonical browser query parsing and exact server-only query serialization
  - Strict hostile-response validation and bounded picker option contracts
  - Exact catalogue, route, operation, response, and generated-client parity proof
affects: [05-04, 05-05, 05-06, 05-09, risk-register-ui]

tech-stack:
  added: []
  patterns: [generated OpenAPI transport, strict Zod trust boundary, selected-label preservation]

key-files:
  created:
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-service.ts
    - apps/web/src/features/risks/risk-schema.test.ts
    - apps/web/src/features/risks/risk-service.test.ts
  modified:
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "Keep targetDate as a projected and sortable field while browser canonicalization discards targetDateFrom/targetDateTo and generated transport cannot express them."
  - "Use closed selectedLabels to preserve active off-page picker selections without widening bounded inventory responses."
  - "Apply the existing server inventory bounds as explicit client trust-boundary caps, with cap-plus-one payloads failing closed."

patterns-established:
  - "Risk Register transport: browser input is stripped to the canonical allowlist before a server-only generated client call."
  - "Picker safety: every authorised inventory response has a named bound and selected records are restored only from the closed list-response label projection."

requirements-completed: [RISK-01]

duration: 18min
completed: 2026-09-01
---

# Phase 5 Plan 3: Risk Register Contract and Typed Transport Summary

**A reproducible closed OpenAPI Risk Register contract now feeds a server-only generated client with strict canonical query, response, and bounded picker validation.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-31T15:58:13Z
- **Completed:** 2026-08-31T16:16:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added the exact 13-parameter `GET /v1/risks` contract, all 16 supported sort values, safe 400/403 responses, and closed item, pagination, metadata, assessment, user, and selected-label schemas.
- Generated `openapi-fetch` declarations from the authoritative specification and proved regeneration produces no diff.
- Asserted byte-identical catalogue copies, the exact Risk Register FunctionAPI link, Security Analyst effective access, Requestor absence, generated path parity, and no users-permissions public exposure.
- Added pure browser canonicalization that strips unknown keys and unsupported date filters while preserving every approved filter, sort, and pagination value.
- Added strict Risk Register response parsing, semantic rating/date helpers, six bounded picker projections, off-page selected-label preservation, and normalized safe failures.

## Task Commits

Each task was committed through its TDD sequence:

1. **Task 1 RED: Specify Risk Register list contract** - `dbd7664` (test)
2. **Task 1 GREEN: Freeze Risk Register contract** - `c6b4ce3` (feat)
3. **Task 2 RED: Specify Risk Register web boundary** - `bdc2d8e` (test)
4. **Task 2 GREEN: Add typed Risk Register transport** - `33023b3` (feat)

## Files Created/Modified

- `docs/references/specification.json` - Closed Risk Register list operation, DTOs, parameters, and safe responses.
- `apps/web/src/lib/api/generated/schema.d.ts` - Reproducible generated list path, operation, response, and query types.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Exact OpenAPI, generated-client, catalogue, grant, and public-surface parity assertions.
- `apps/web/src/features/risks/risk-schema.ts` - Canonical browser parsing, exact serialization, strict response/picker schemas, and semantic helpers.
- `apps/web/src/features/risks/risk-service.ts` - Server-only generated Risk Register and picker transport.
- `apps/web/src/features/risks/risk-schema.test.ts` - Complete query, sort, hostile-response, selected-label, cap-overflow, and date-helper coverage.
- `apps/web/src/features/risks/risk-service.test.ts` - Exact generated calls, serialization, inventory paths, and normalized failure coverage.

## Decisions Made

- The upstream broad-date wording remains explicit contract debt in `docs/contract-gaps/phase-05-risk-register-date-filter.md`; no unsupported date parameter was introduced.
- The browser boundary discards unsupported URL state, while the mounted Strapi parser independently rejects unsupported request parameters.
- Selected picker values absent from bounded inventory pages are restored only from the closed `selectedLabels` response, never from unvalidated client state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first focused Strapi command executed a previously compiled test artifact. Rebuilding the test bundle produced the intended RED failure on the missing `/v1/risks` contract before implementation.
- The PowerShell `pnpm` shim does not preserve the required runtime. All package commands used the active Node 24.19.0 executable with its bundled Corepack pnpm entry point.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Self-Check: PASSED

- All four created files and three modified contract files exist.
- TDD commits `dbd7664`, `c6b4ce3`, `bdc2d8e`, and `33023b3` exist in order.
- The complete Strapi suite passes all 83 tests.
- The focused web suite passes all 24 tests and strict TypeScript typecheck passes.
- `api:check` and a repeated generation diff both pass.
- Catalogue copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- No raw fetch, `PHASE5_RED`, `execArgv`, `expectsFocused`, file guard, early-return escape hatch, TODO, FIXME, placeholder, or known stub remains in the Plan 05-03 owned test/implementation surface.

## Next Phase Readiness

- Plan 05-04 can build Risk Register route state and server-rendered presentation directly on the canonical parser and typed list service.
- The unresolved broad-date requirements wording remains documented without widening the approved Phase 5 transport.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
