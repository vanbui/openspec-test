---
phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio
plan: "02"
subsystem: backend-testing
tags: [strapi, sqlite, bootstrap, function-api, authorization, verification]
requires:
  - phase: 02-01
    provides: Guarded CSRM bootstrap entry point and initial catalogue
provides:
  - Independently runnable CSRM application, Function, FunctionApi, Role, and user bootstrap
  - Security Analyst Agent Role with the Security Analyst Function grant set
  - Real two-boot Strapi SQLite verification with path preflight and narrow cleanup
  - Static catalogue and core schema checks for the Function-based authorization model
affects: [phase-2-gap-closure, keycloak-provisioning, csrm-application]
actuals:
  tokens: 7771
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Disposable backend-relative SQLite integration verification
    - Catalogue-to-persisted-document-ID authorization graph assertions
key-files:
  created:
    - scripts/verify-csrm-seed-runtime.mjs
  modified:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - scripts/verify-csrm-seed.mjs
    - scripts/verify-core-model.mjs
    - package.json
key-decisions:
  - "CSRM bootstrap creates and canonicalizes its own Application without the core seed flag."
  - "Security Analyst Agent is a Function-backed reusable Role with the exact Security Analyst grant set."
  - "Runtime seed verification preflights the compiled database config before either Strapi boot."
patterns-established:
  - "Runtime bootstrap tests allocate a unique child under apps/backend/.tmp and revalidate ownership before cleanup."
  - "Authorization catalogue assertions compare persisted Role Function document IDs and FunctionApi signatures exactly."
requirements-completed: [BOOT-01, BOOT-02, BOOT-03, BOOT-04]
coverage:
  - id: D1
    description: "CSRM-only boot creates one active canonical IdamBox CSRM Application."
    requirement: BOOT-01
    verification:
      - kind: integration
        ref: yarn verify:csrm-seed
        status: pass
    human_judgment: false
  - id: D2
    description: "Security Analyst Agent and catalogue roles persist with exact Function and FunctionApi grants."
    requirement: BOOT-02
    verification:
      - kind: integration
        ref: yarn verify:csrm-seed
        status: pass
    human_judgment: false
  - id: D3
    description: "Jane remains role-free and Bob has only the Security Analyst Role across repeated boots."
    requirement: BOOT-04
    verification:
      - kind: integration
        ref: yarn verify:csrm-seed
        status: pass
    human_judgment: false
  - id: D4
    description: "Current Application, Function, FunctionApi, Role, and IdamBox User schemas preserve the Function authorization path."
    requirement: BOOT-03
    verification:
      - kind: other
        ref: yarn verify:schema
        status: pass
    human_judgment: false
duration: 18 min
completed: 2026-08-08
status: complete
---

# Phase 02 Plan 02: Function-Based CSRM Seed Runtime And Verification Gap Closure Summary

**Independent CSRM Strapi seeding with Function-backed analyst roles and a two-boot SQLite persistence verifier**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-08T14:19:00Z
- **Completed:** 2026-08-08T14:37:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Made `IDAMBOX_SEED_CSRM=true` create and canonicalize the CSRM Application without requiring core sample data.
- Added the reusable Security Analyst Agent Role with the complete Security Analyst Function grant set while retaining Requestor and the exact Jane/Bob assignments.
- Added a real two-boot Strapi verifier that preflights a verifier-owned backend-relative SQLite path, verifies persisted relations, and removes only its own temporary child.
- Replaced stale Entitlement/ApplicationRole source scans with Function/FunctionApi catalogue and schema assertions.

## Task Commits

1. **Task 1 RED: Add failing CSRM runtime seed verifier** - `c409d2b` (`test`)
2. **Task 1 GREEN: Seed CSRM independently with agent role** - `b3b9187` (`feat`)
3. **Task 2: Verify Function-based CSRM bootstrap** - `97970e0` (`test`)
4. **Task 1 verification strengthening: Assert exact CSRM seed relations** - `7d6e8d8` (`fix`)

## Files Created/Modified

- `apps/backend/src/bootstrap/seed-csrm-data.ts` — independently seeds the canonical application, functions, roles, and exact user assignments.
- `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` — declares Security Analyst Agent with copied analyst Function grants.
- `scripts/verify-csrm-seed-runtime.mjs` — executes and inspects two real Strapi loads against isolated SQLite storage.
- `scripts/verify-csrm-seed.mjs` — validates current catalogue references and role equivalence.
- `scripts/verify-core-model.mjs` — checks the five live Function-based authorization schemas.
- `package.json` — runs static and runtime CSRM verification through `verify:csrm-seed`.

## Decisions Made

- Kept the approved `IdamBoxUser -> Role -> Function -> Application` path and did not restore ApplicationRole.
- Matched Security Analyst Agent to Security Analyst through Function grants, not direct user assignments.
- Used a backend-relative database filename and compiled-config preflight to prevent the runtime verifier from targeting developer data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected compiled database-config invocation in the runtime verifier**
- **Found during:** Task 1
- **Issue:** The compiled Strapi database factory expects `{ env }`, so passing the adapter directly failed before the planned bootstrap assertion.
- **Fix:** Invoked the factory with an object carrying the configured environment adapter.
- **Files modified:** `scripts/verify-csrm-seed-runtime.mjs`
- **Verification:** The verifier reached the expected initial CSRM-only seed failure, then passed after the seed repair.
- **Committed in:** `c409d2b` (test) and `b3b9187` (feature)

**2. [Rule 2 - Missing Critical Verification] Compared all persisted authorization relations exactly**
- **Found during:** Task 1 final verification review
- **Issue:** Initial runtime checks counted Function and FunctionApi records but did not compare every catalogue Role Function document-ID set and FunctionApi grant signature.
- **Fix:** Added per-Function API signature and per-Role document-ID assertions.
- **Files modified:** `scripts/verify-csrm-seed-runtime.mjs`
- **Verification:** `yarn verify:csrm-seed && yarn verify:schema && yarn check-types` passed.
- **Committed in:** `7d6e8d8`

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical verification).

## Verification

- `yarn verify:csrm-seed` — passed (static catalogue plus two real Strapi boots)
- `yarn verify:schema` — passed
- `yarn check-types` — passed

## Issues Encountered

- The project state is currently positioned at Phase 06, so the generic Phase 02 plan-advance and progress handlers could not parse a Phase 02 counter. The execution metric and Phase 02 roadmap progress were recorded; Phase 06 state was intentionally left unchanged and the stale state-model issue is listed in `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Function-based CSRM authorization bootstrap is independently reproducible and protected by static and persistence-level checks. The separate Phase 2 documentation/traceability closeout plan can proceed.

## Self-Check: PASSED

- Summary file exists and all four task commits are present in Git history.

---
*Phase: 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio*
*Completed: 2026-08-08*
