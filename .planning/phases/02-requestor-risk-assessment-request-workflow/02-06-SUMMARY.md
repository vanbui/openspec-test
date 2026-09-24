---
phase: 02-requestor-risk-assessment-request-workflow
plan: 06
subsystem: api-authorization
tags: [strapi, openapi, openapi-typescript, authorization, contract-testing]

requires:
  - phase: 02-requestor-risk-assessment-request-workflow
    provides: owner-scoped assessment-request workflow and server-owned request facts
provides:
  - Typed assessment-request query, relation, pagination, create, and update contracts
  - Exact server-side information-system and information-asset reference-data grants
  - Mounted contract/catalogue parity and authorization boundary coverage
affects: [02-07, 02-08, 02-09, 02-12, request-services, request-dashboard]

tech-stack:
  added: []
  patterns:
    - API-only Function grants isolate supporting reads from broader administration CRUD
    - Authoritative OpenAPI JSON regenerates web request and response types deterministically

key-files:
  created:
    - apps/strapi/src/api/csrm-information-system/operations.ts
    - apps/strapi/src/api/csrm-information-asset/operations.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
  modified:
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts
    - apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts

key-decisions:
  - "Model request submission on PUT as the sole requestStatus value 'submitted'; omission remains draft-save intent."
  - "Grant supporting inventory reads through a dedicated API-only Function instead of administration Functions that include broader CRUD."
  - "Expose only the four Phase 2 populated relations needed by request detail and dashboard services."

patterns-established:
  - "Supporting read policy: csrm-app-enabled executes before csrm-authorization with an exact operation constant."
  - "Contract parity: parsed authoritative JSON, byte-identical bootstrap catalogue, generated types, and mounted authorization are one test boundary."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 10 min
completed: 2026-08-29
---

# Phase 02 Plan 06: Typed Contract and Reference-Data Authorization Summary

**Deterministic OpenAPI types now cover bounded request queries and client-writable mutations, while Strapi grants only the two supporting inventory reads through an exact API-only capability graph.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T13:07:30Z
- **Completed:** 2026-08-29T13:17:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Corrected the authoritative assessment-request contract for search, nested filters, explicit page parameters, sorting, relation population, pagination metadata, and document-ID relation writes.
- Removed server-owned create fields from generated callers and limited update workflow intent to `requestStatus: "submitted"`.
- Added exact `csrm-authorization` policies for information-system and information-asset collection reads without broadening IAM or inventory mutations.
- Added the reciprocal `function.risk_assessment_requests.reference_data_api` graph and kept authoritative/runtime catalogues byte-identical.
- Proved Requestor Jane and Security Analyst Bob can resolve the two reads while anonymous callers, IAM access, and unrelated CRUD remain denied.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add generated-contract and exact-grant assertions** - `c54d66d` (test)
2. **Task 2: Secure supporting reads and regenerate the authoritative typed contract** - `a418409` (feat)

## Files Created/Modified

- `docs/references/specification.json` - Authoritative Phase 2 request query, response, relation, and mutation shapes.
- `apps/web/src/lib/api/generated/schema.d.ts` - Regenerated `openapi-typescript` client contract.
- `apps/strapi/src/api/csrm-information-system/operations.ts` - Canonical information-system list operation.
- `apps/strapi/src/api/csrm-information-asset/operations.ts` - Canonical information-asset list operation.
- `apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts` - Exact authorization on the supporting system read.
- `apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts` - Exact authorization on the supporting asset read.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` - Canonical API-only Function and reciprocal role/API links.
- `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` - Byte-identical runtime catalogue.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Parsed contract, graph, parity, and mounted authorization assertions.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Correct compiled bootstrap resolution for mounted permission reconciliation.

## Decisions Made

- Submission is represented by the existing backend intent `requestStatus: "submitted"` on PUT; create callers cannot supply workflow-owned status or timestamps.
- Reference-data access uses a dedicated menu-less Function assigned reciprocally to Requestor, Security Analyst, and Security Analyst Agent, with exactly two FunctionAPIs.
- Generated populate unions are restricted to `informationSystems`, `informationAssets`, `questionnaire`, and `assessment` for the Phase 2 service projections.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected compiled harness bootstrap resolution**
- **Found during:** Task 1 RED verification
- **Issue:** The emitted test helper resolved the development-permission bootstrap under `.tmp/src`, so mounted supporting-read permissions could not be reconciled and RED failed before the planned sentinel.
- **Fix:** Resolve the already-built bootstrap module from the Strapi `dist/src/bootstrap` directory.
- **Files modified:** `apps/strapi/tests/helpers/strapi-http-harness.ts`
- **Verification:** Focused RED emitted only `PHASE2_RED_CONTRACT_REFERENCE_GRANTS_ABSENT`; the final full backend suite passed.
- **Committed in:** `c54d66d`

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The fix was limited to the mounted test harness and was necessary to exercise the production permission bootstrap; no production authorization scope was broadened.

## Issues Encountered

- The deterministic `api:check` command compares generated output against the staged index, so the regenerated schema was staged before running the clean-generation check.

## Verification

- `cd apps/strapi && npm test` - passed, 10 tests.
- `cd apps/web && pnpm api:check` - passed with deterministic generated output.
- `cd apps/web && pnpm typecheck` - passed under strict TypeScript.
- Authoritative and bootstrap catalogue SHA-256 hashes matched: `080C5785AC249818D89691AD8643CF69BFF741B7C6F5B9D494D8B38468ADCC8B`.
- No FunctionAPI grant targets `/api/idambox-users`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-07 can consume typed pagination, filtering, sorting, and the exact detail relation populate arrays.
- Plan 02-12 can build typed mutations without supplying request numbers, owners, workflow timestamps, or release-owned relations.
- No blockers remain for the next Phase 2 plan.

## Self-Check: PASSED

- All listed created files exist.
- Task commits `c54d66d` and `a418409` exist in history.
- The full plan verification and acceptance criteria pass.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
