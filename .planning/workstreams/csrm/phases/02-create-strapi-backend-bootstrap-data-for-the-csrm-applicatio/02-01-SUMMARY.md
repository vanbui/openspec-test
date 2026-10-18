---
phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio
plan: 01
subsystem: backend
tags: [strapi, bootstrap, seed-data, authorization, verification]
requires:
  - phase: 01-strapi-backend-foundation
    provides: Core IdamBox Application, Application Role, Role, and IdamBox User content types
provides:
  - Opt-in CSRM bootstrap seed data controlled by IDAMBOX_SEED_CSRM
  - CSRM application roles and matching reusable IdamBox roles
  - Jane and Bob sample IdamBox users for later identity provider and CSRM phases
  - Static verification for CSRM seed constants, docs, bootstrap wiring, and idempotency patterns
affects: [phase-3-keycloak, phase-4-user-provisioning, phase-6-csrm-app]
tech-stack:
  added: []
  patterns:
    - Guarded Strapi bootstrap seed helper
    - Lookup-before-create seed idempotency
    - Static verifier for bootstrap seed contracts
key-files:
  created:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - scripts/verify-csrm-seed.mjs
  modified:
    - apps/backend/src/index.ts
    - apps/backend/.env.example
    - apps/backend/README.md
    - package.json
key-decisions:
  - IDAMBOX_SEED_CSRM controls CSRM bootstrap independently from IDAMBOX_SEED_CORE.
  - Jane Doe is seeded active with no roles; Bob Doe is seeded active with the reusable Security Analyst role.
  - Phase 2 remains backend bootstrap data only; Keycloak, CSRM collections, and the CSRM app stay deferred.
patterns-established:
  - CSRM bootstrap data uses explicit constants and lookup-before-create checks for each record family.
  - Seed verification scripts assert source, documentation, and relationship targets statically.
requirements-completed:
  - BOOT-01
  - BOOT-02
  - BOOT-03
  - BOOT-04
duration: 4 min
completed: 2026-05-24
---

# Phase 2 Plan 1: CSRM Seed Data, Documentation, And Verification Summary

**Opt-in Strapi CSRM bootstrap seed data with reusable role relationships and static idempotency verification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-24T04:02:19Z
- **Completed:** 2026-05-24T04:06:06Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Added `seedCsrmData(strapi)` with the exact `IDAMBOX_SEED_CSRM` guard and lookup-before-create behavior for CSRM application, application roles, reusable roles, and users.
- Wired CSRM seeding into the existing Strapi bootstrap path after core sample seeding.
- Documented the CSRM seed flag, seeded records, Jane/Bob behavior, and later-phase boundaries.
- Added `yarn verify:csrm-seed` to check seed constants, docs, bootstrap wiring, relationships, and idempotency-oriented source patterns.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CSRM seed helper** - `70c4974` (`feat(02-01): add CSRM seed helper`)
2. **Task 2: Wire CSRM seed into Strapi bootstrap** - `94dfbc4` (`feat(02-01): wire CSRM seed bootstrap`)
3. **Task 3: Document CSRM seed configuration** - `44e600a` (`docs(02-01): document CSRM seed flag`)
4. **Task 4: Add CSRM seed verifier** - `75256ee` (`test(02-01): verify CSRM seed data`)

## Files Created/Modified

- `apps/backend/src/bootstrap/seed-csrm-data.ts` - Adds the guarded CSRM seed helper.
- `apps/backend/src/index.ts` - Calls `seedCsrmData(strapi)` during Strapi bootstrap.
- `apps/backend/.env.example` - Adds `IDAMBOX_SEED_CSRM=false`.
- `apps/backend/README.md` - Documents CSRM seed behavior and deferred later-phase work.
- `scripts/verify-csrm-seed.mjs` - Adds static verification for the CSRM seed contract.
- `package.json` - Adds `verify:csrm-seed`.

## Verification

- `yarn verify:csrm-seed` - passed
- `yarn verify:schema` - passed
- `yarn check-types` - passed
- `yarn build` - passed

## Decisions Made

None beyond the locked Phase 2 context decisions. Implementation followed the planned separate flag, canonical CSRM application identity, role names, user assignments, and phase boundaries.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first verifier implementation compared Bob's lookup against Jane's earlier `userService.create` call. The verifier was corrected to inspect Jane and Bob user blocks separately before the verification commit.
- The backend README initially omitted the expanded `Cybersecurity Risk Manager` phrase. Documentation was updated before the docs commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 can use the seeded Jane and Bob identities as the source values for Keycloak bootstrap users. The backend now has the CSRM application, roles, and representative product users that later Keycloak, provisioning, and CSRM application phases can build against.

---
*Phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio*
*Completed: 2026-05-24*
