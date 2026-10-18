---
phase: 01-monorepo-foundation-and-secure-application-shell
plan: "10"
subsystem: strapi-authorization
tags: [strapi, function-api, least-privilege, sqlite, http, tdd]
requires:
  - phase: 01-09
    provides: canonical seeded Role to Function to FunctionAPI grant graph and mounted HTTP authorization harness
provides:
  - analyst-only API Function for canonical assessment-request deletion
  - mounted proof that an owning Requestor cannot delete and the record remains persisted
  - mounted proof that an exact-grant Security Analyst can delete the retained record
  - automated byte-parity enforcement for authoritative and bootstrap catalogues
affects: [phase-02, phase-04, phase-08-keycloak]
tech-stack:
  added: []
  patterns: [least-privilege-operation-split, catalogue-byte-parity, persisted-http-authorization-proof]
key-files:
  created: []
  modified:
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/tests/authorization.integration.test.ts
key-decisions:
  - "Canonical DELETE is granted through a separate API-only Function assigned only to Security Analyst and Security Analyst Agent."
patterns-established:
  - "Destructive operations can be separated from Requestor birthright grants while retaining the same mounted policy and route boundary."
requirements-completed: [FOUND-04]
duration: 5min
completed: 2026-08-29
---

# Phase 1 Plan 10: Least-Privilege Assessment Request Delete Summary

**Canonical assessment-request DELETE is now isolated behind an analyst-only API Function, with mounted HTTP proof of Requestor denial and analyst success.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T09:32:26Z
- **Completed:** 2026-08-29T09:37:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed canonical hard DELETE from the implicit Requestor grant while preserving list, create, item-read, and update access.
- Added reciprocal analyst-only Role, Function, and FunctionAPI links for the canonical DELETE operation without a navigation path.
- Proved through the mounted Strapi router, policy, controller, and SQLite persistence boundary that an owning Requestor receives 403 and retains the record before an exact-grant analyst receives 204 and removes it.
- Preserved exact-once coverage for all five canonical assessment-request operations and enforced byte identity between the authoritative and bootstrap catalogue copies in the automated suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Encode least-privilege DELETE grants and mounted denial as failing regressions** - `df0dcfc` (test)
2. **Task 2: Split DELETE into an analyst-only API Function and make the full suite green** - `990ec41` (fix)
3. **Post-wave correction: Enforce catalogue byte parity in the automated suite** - `cf87bd5` (test)

## Files Created/Modified

- `apps/strapi/tests/authorization.integration.test.ts` - Asserts catalogue byte parity, exact grant topology, and the mounted Requestor-denial/analyst-deletion sequence.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` - Defines the authoritative analyst-only delete Function and reciprocal links.
- `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` - Byte-identical runtime seed catalogue.

## Decisions Made

- Kept the existing policy and route contract unchanged because exact FunctionAPI matching already denies Requestor DELETE once the over-broad catalogue grant is removed.
- Kept the delete Function API-only with no `menuPath`, so the elevated grant cannot create a navigation item.

## Verification

- RED: the full `apps/strapi` `npm test` command compiled and started the mounted harness, then failed exactly the catalogue and mounted DELETE regressions with `RED_EXPECTED_CATALOGUE_REQUESTOR_DELETE_OVERGRANT` and `RED_EXPECTED_OWNER_REQUESTOR_DELETE_DENIED`.
- GREEN: the full `apps/strapi` `npm test` command passed 6/6 tests.
- Mounted DELETE observed Requestor `403`, persisted-record retention, analyst `204`, and record removal.
- The integration suite reads both catalogue files from paths resolved against the compiled test location and asserts byte-for-byte equality; both currently share SHA-256 `6CDAE19B7E3BAFE3EB28AB0DDCA73CFCF0C7BC51D710B2B05CA4A347F5076267`.
- Exact-once operation ownership and reciprocal Role/Function/FunctionAPI linkage checks passed.
- `git diff --check` passed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Node 24 selected its human-readable test reporter during the first RED run, and the TAP rerun still included formatting that prevented the plan's literal failure-name regex from collecting matches. Direct output inspection confirmed exactly the two required failing subtests, both required diagnostics, no unexpected-status diagnostic, and successful compilation/harness startup.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FOUND-04 least privilege is restored for assessment-request deletion.
- Phase 1 can be re-verified; no production authorization code, routes, schemas, package files, seeders, or OpenAPI artifacts changed.

## Self-Check: PASSED

- All three modified implementation/test artifacts exist.
- Task commits `df0dcfc`, `990ec41`, and `cf87bd5` exist in repository history.
- Full Strapi suite, catalogue hash parity, exact-once coverage, reciprocal links, and diff checks passed.

---
*Phase: 01-monorepo-foundation-and-secure-application-shell*
*Completed: 2026-08-29*
