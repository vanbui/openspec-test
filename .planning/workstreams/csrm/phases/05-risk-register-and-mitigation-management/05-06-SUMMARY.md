---
phase: 05-risk-register-and-mitigation-management
plan: 06
subsystem: api
tags: [strapi, development-seed, risk-register, idempotence, workflow-preservation]

requires:
  - phase: 03-questionnaire-workflow
    provides: Triple-gated development seed and stable-key reconciliation pattern
  - phase: 04-assessment-generation-and-review
    provides: Deterministic RiskTypes, reusable Controls, and released assessment invariants
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised Risk Register list and detail repository paths
provides:
  - Triple-gated mutable Bob-owned Risk Register development aggregate
  - Stable request, assessment, and Risk domain keys with one contextual ControlImplementation
  - Concurrent and repeated reseed serialization that preserves live workflow and analyst-entered facts
  - Full invariant coverage for the 2,646-Control catalogue and released ASM-2026-33SAEN fixture
affects: [05-07, 05-08, 05-09, risk-register-browser-acceptance]

tech-stack:
  added: []
  patterns: [creation-only workflow facts, relationship-only mutable aggregate reconciliation, in-process seed serialization, stable-domain-key seeding]

key-files:
  created:
    - apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
    - apps/strapi/tests/risk-register-seed.integration.test.ts
  modified:
    - apps/strapi/src/index.ts

key-decisions:
  - "Activate the mutable Risk fixture only when IDAMBOX_SEED_CSRM=true and the complete established development identity predicate passes."
  - "Assign request, assessment, Risk, and ControlImplementation workflow facts only on creation; reseeds repair stable presentation and relationship fields without normalising live state or analyst-entered content."
  - "Serialize seed reconciliation in process so concurrent bootstrap calls cannot create duplicate stable aggregates."

patterns-established:
  - "Mutable seed preservation: advanced request/assessment states, dates, Risk treatment facts, and mitigation evidence survive every reseed."
  - "Seed invariant snapshots: reusable Control data and released assessment aggregates are compared before and after gate, repeat, concurrent, and repair executions."

requirements-completed: [RISK-01, RISK-02]

duration: 15min
completed: 2026-09-01
---

# Phase 5 Plan 6: Mutable Risk Register Development Fixture Summary

**A stable Bob-owned unreleased Risk aggregate now appears in isolated development only, with concurrent idempotent reconciliation that never regresses live workflow or analyst-entered facts.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-31T17:01:08Z
- **Completed:** 2026-08-31T17:16:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added exact triple-gate enforcement using the seed flag plus the established development runtime, environment, and identity predicate.
- Created stable `RAR-DEV-RISK-001`, `ASM-DEV-RISK-001`, and `RSK-DEV-MUTABLE-001` records owned by Bob and linked to the existing Internet Exposure RiskType, customer records, customer portal, and reusable `E8-PATCH_APPLICATIONS-003` Control.
- Added one contextual planned ControlImplementation while leaving the 2,646 reusable Controls and all RiskTypes untouched.
- Serialized concurrent reconciliations and proved sequential repeats do not change aggregate counts.
- Proved reseeding repairs safe fixture presentation and relationships while preserving closed/advanced request and assessment states, workflow dates, completed Risk treatment, closure date, implemented mitigation state, and analyst evidence.
- Proved the stable mutable Risk is discoverable through the production list and detail repository paths with `parentLock: mutable`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Specify triple-gated fixture idempotence and repair** - `cf621d1` (test)
2. **Task 2 GREEN: Reconcile the mutable Risk workflow fixture** - `d21344f` (feat)

## Files Created/Modified

- `apps/strapi/src/bootstrap/seed-risk-register-workflow.ts` - Triple-gated stable aggregate reconciliation with creation-only workflow facts and concurrent-call serialization.
- `apps/strapi/tests/risk-register-seed.integration.test.ts` - Gate-off, fresh, concurrent repeat, list/detail discovery, repair, workflow-preservation, Control inventory, and released-fixture invariant coverage.
- `apps/strapi/src/index.ts` - Runs the Risk Register seed after core, questionnaire, and assessment seeds.

## Decisions Made

- The established `developmentIdentityEnabled()` predicate remains the sole runtime/environment/identity authority and is combined with the exact seed flag before any query or write.
- Request and assessment workflow facts, Risk treatment and date fields, and ControlImplementation state/evidence are present only in create payloads. Existing records receive only explicitly safe presentation and relationship repairs.
- Stable unique request, assessment, and Risk numbers identify managed records; the contextual implementation is identified through its stable Risk relationship and existing reusable Control.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- One full-suite invocation exceeded its command timeout while child tests were still running. Only the orphaned test-runner processes from that invocation were stopped; existing development servers were left untouched. The isolated seed test then passed, followed by a clean full suite pass.

## User Setup Required

None - the fixture remains inert unless all existing local development gates are explicitly enabled.

## Known Stubs

None.

## Self-Check: PASSED

- Both created files and the modified bootstrap entrypoint exist.
- RED commit `cf621d1` and GREEN commit `d21344f` exist in order.
- The complete Strapi suite passes all 93 tests under Node 24.19.0.
- All three dedicated seed tests pass against a process-isolated SQLite database.
- Gate-off cases create no managed request, assessment, or Risk.
- Concurrent and repeated enabled calls retain exactly one stable aggregate and one contextual implementation.
- Production list/detail repository paths return the mutable Risk and its mitigation with `parentLock: mutable`.
- Advanced workflow facts and analyst-entered Risk/mitigation values remain unchanged after repair reseeding.
- The complete 2,646-Control projection and released `ASM-2026-33SAEN` aggregate remain data-equivalent.
- No content-type schema, catalogue copy, package manifest, lockfile, RED escape hatch, focused test, or test skip changed.

## Next Phase Readiness

- Plan 05-07 can freeze generated detail DTOs against the real mutable aggregate.
- Plan 05-08 and browser acceptance can exercise Risk and mitigation editing without depending on released fixtures.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
