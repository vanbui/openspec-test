---
phase: 03-dynamic-questionnaire-workflow
plan: 06
subsystem: development-fixtures
tags: [strapi, questionnaire, seed, permissions, sqlite, idempotence]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: Versioned questionnaire JSON contract and authoritative save/submit workflow from Plans 03-02 and 03-05
provides:
  - Triple-gated idempotent QUES-DEV-001 development questionnaire owned by Jane
  - Eight realistic versioned questions spanning every supported answer type and a conditional required path
  - Exact development users-permissions grants for all eight mounted questionnaire controller actions
affects: [03-07, 03-09, 03-10, 03-12, questionnaire-browser-workflow]

tech-stack:
  added: []
  patterns: [stable-business-key upsert, runtime-contract-validated seed, isolated SQLite integration fixture]

key-files:
  created:
    - apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts
    - apps/strapi/tests/questionnaire-seed.integration.test.ts
  modified:
    - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
    - apps/strapi/src/index.ts
    - apps/strapi/tests/authorization.integration.test.ts

key-decisions:
  - "Gate questionnaire fixtures on IDAMBOX_SEED_CSRM=true plus the exact development runtime and development identity gates."
  - "Reconcile the request, questionnaire, and questions by stable requestNumber, questionnaireNumber, and questionKey metadata rather than record counts."
  - "Validate the complete seed definition graph through the production schemaVersion 1 parser before persistence."

patterns-established:
  - "Development workflow fixtures use stable domain keys, restore managed fields and relations on rerun, and leave answers null."
  - "Seed integration tests compile and run unconditionally against disposable databases under apps/strapi/.tmp."

requirements-completed: [QUES-01, QUES-02, QUES-03, QUES-04, QUES-05]

duration: 8min
completed: 2026-08-30
---

# Phase 3 Plan 6: Questionnaire Workflow Seed Summary

**Jane now receives one deterministic, realistic questionnaire on a submitted request, with eight contract-validated questions and only the mounted development actions required to read, save, and submit it.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T17:43:00Z
- **Completed:** 2026-08-29T17:51:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a triple-gated seed that upserts Jane's `RAR-DEV-QUES-001` submitted request, `QUES-DEV-001`, and eight questions by stable business metadata.
- Covered Service context, Data and privacy, Hosting and access, and Third parties with Text, Long text, Boolean, Single select, Multi select, and Date inputs; File upload remains deliberately absent.
- Added a required personal-data category question whose visibility is controlled by the preceding Boolean answer.
- Validated the complete seed graph with the production schemaVersion 1 parser before any fixture persistence and reset every seeded answer to null.
- Extended the additive development permission reconciliation with only `saveAnswers` and `submitQuestionnaire`, completing the exact eight mounted questionnaire actions.
- Proved gate-off behavior, two-run idempotence, managed-definition restoration, relation ownership, additive permission preservation, and IAM exclusion against isolated SQLite databases.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify gated idempotence and permission least privilege** - `6054021` (test)
2. **Task 2: Seed Jane's realistic questionnaire and exact development actions** - `786a8dd` (feat)

## Files Created/Modified

- `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts` - Stable-key request, questionnaire, and definition reconciliation behind all development gates.
- `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` - Exact save and submit controller permissions added to the existing additive allowlist.
- `apps/strapi/src/index.ts` - Questionnaire fixture bootstrap runs after core CSRM data and before permission reconciliation.
- `apps/strapi/tests/questionnaire-seed.integration.test.ts` - Disposable-database gate, idempotence, definition, relation, and restoration coverage.
- `apps/strapi/tests/authorization.integration.test.ts` - Exact eight-action questionnaire permission assertion while retaining Phase 2 checks.

## Decisions Made

- Keep the fixture request in `submitted` so Jane can immediately enter the authoritative questionnaire workflow without inventing a questionnaire status field.
- Treat `questionKey` inside the locked versioned options envelope as the stable question business key and refresh all managed definition fields and relations on rerun.
- Keep permissions additive for operator-managed entries while removing only the declared managed actions whenever the development identity gates are disabled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking verifier] Used a case-sensitive RED output guard assessment**
- **Found during:** Task 1 RED verification
- **Issue:** The plan's case-insensitive `No test` matcher matched the existing legitimate test name “fails closed when no test identity is mapped,” even though the suite executed normally and emitted the required missing-seed sentinel.
- **Fix:** Verified the RED result from the actual assertion output and retained unconditional normal tests for GREEN.
- **Files modified:** None.
- **Verification:** RED failed on the absent seed module and missing save/submit actions; GREEN passes all 21 tests with no sentinel or missing-module wrapper.
- **Committed in:** `6054021`, `786a8dd`

**2. [Rule 3 - Blocking test fixture] Made the permission assertion independent of a stale harness allowlist copy**
- **Found during:** Task 2 GREEN verification
- **Issue:** The shared HTTP harness intentionally carried the pre-plan permission baseline, so comparing the production declaration to that stale copy rejected the two newly served actions.
- **Fix:** Asserted the production declaration and persisted permissions against an explicit exact expected set while preserving the unrelated-permission and gate-off checks.
- **Files modified:** `apps/strapi/tests/authorization.integration.test.ts`
- **Verification:** Full Strapi suite passes and the questionnaire subset contains exactly eight controller actions with no IAM, delete, or future Phase 4 action.
- **Committed in:** `786a8dd`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking verifier/test-fixture issues).
**Impact on plan:** Both fixes strengthened test integrity without changing production architecture or broadening permissions.

## Issues Encountered

- The package manager emitted a transient engine warning reporting Node 22 while direct PATH resolution before finalization reported Node v24.19.0. The full suite still compiled and executed successfully; no tooling or global configuration was changed.

## Verification Results

- `pnpm --filter @csrm/strapi test` - PASS (21/21 tests)
- Enabled two-run seed idempotence and managed-definition restoration - PASS
- Disabled development/identity/seed gates leave `QUES-DEV-001` absent - PASS
- Exact eight questionnaire controller actions, additive preservation, and IAM exclusion - PASS
- GREEN integrity scan - PASS (no Phase 3 RED sentinel, missing-module wrapper, file guard, execArgv gate, or early-return test escape hatch)
- Frozen questionnaire/question schema diff - PASS (no changes)
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)
- Developer `apps/strapi/.tmp/data.db` - untouched; test databases were isolated and removed

## Known Stubs

None.

## User Setup Required

None - the existing development gates activate the fixture and permissions.

## Next Phase Readiness

- Plan 03-07 can consume `QUES-DEV-001` through the typed web service layer.
- Plans 03-09, 03-10, and 03-12 have deterministic Jane/Bob workflow data for renderer, analyst review, and browser acceptance.
- No blocker remains for subsequent Phase 3 plans.

## Self-Check: PASSED

- All five created or modified implementation/test files and this summary exist.
- Task commits `6054021` and `786a8dd` are present in repository history.
- Full Strapi verification passes 21/21 tests; schema freeze, catalogue parity, GREEN integrity, isolated database cleanup, and branch cleanliness checks pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
