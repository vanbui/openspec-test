---
phase: 05-sign-in-and-end-to-end-journey
plan: "02"
subsystem: identity
tags: [password-setup, transactions, scim, testing]
status: complete
completed: "2026-10-17"
duration: 7min
requires:
  - phase: 05-01
    provides: Post-outer-commit invitation dispatch and bounded read-only email service
provides:
  - Real transaction commit-rejection and rollback acceptance tests
  - Mounted SCIM success through optional scheduling, registration, client and diagnostic failures
  - Live caller-context detachment, instance isolation and late eligibility tests
affects: [05-03, 05-10, 05-11, 05-12]
tech-stack:
  added: []
  patterns: [instance-specific scheduler injection, application-compiled module loading]
actuals:
  tokens: 5234
  tasks: 2
  commits: 0
requirements-addressed: [SIGN-01]
requirements-completed: []
key-files:
  created:
    - .planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-02-SUMMARY.md
  modified:
    - apps/backend/src/iam/password-setup/dispatcher.ts
    - apps/backend/tests/iam-password-setup.integration.test.ts
    - apps/backend/tests/iam-password-setup.unit.test.ts
key-decisions:
  - Inject scheduling per dispatcher instance without replacing the process scheduler.
  - Load private source authority modules from the running application's compiled directory.
  - Future-start people retain the existing inactive accountStatus representation.
---

# Phase 5 Plan 02: Transaction and eligibility acceptance matrix

Real Strapi/SQLite tests now reject the actual outer Knex commit operation, confirm rollback of nested Document Service linkage and prove zero invitation attempts. Optional invitation failures preserve the mounted SCIM 201 and committed source/subject linkage.

## Completed tasks

1. Expanded real transaction/failure tests: pending outer transaction sends nothing; successful outer commit sends once; rollback, failed linkage, validation, duplicate reservation and rejected actual commit send nothing. The commit-rejection case preserves the transaction error and asserts that it produces no email-failure event. Mounted SCIM cases preserve durable linkage and 201 through scheduling exceptions, onCommit registration exceptions, rejected clients, bounded client timeout with late rejection, and throwing identity/invitation diagnostics.
2. Expanded exclusions and isolation tests: manual/claimed users, duplicates, movers/reconciliation, reactivation, inactive/future-start, protected/service, tombstoned, missing source binding and missing subject remain excluded. A queued callback re-reads after deactivation. A real source mutation and independent request sentinel deliberately remain alive while dispatch runs; the callback sees neither source write authority, request sentinel nor inherited database transaction. Separate backend instances retain independent registration/shutdown. Bounded read/client work, cancellation, rejected deferred work and raw-error/URL/token/password canaries retain closed diagnostics and no automatic retry.

## Verification

- `pnpm --dir apps/backend exec tsc --pretty false`: passed.
- `pnpm --dir apps/backend exec tsc -p tests/tsconfig.password-setup.tmp.json --pretty false`: passed. The temporary configuration extended the existing test configuration and excluded only `tests/risk-curation-rules.unit.test.ts` and `tests/risk-history-changes.unit.test.ts` in addition to the existing generated/dependency exclusions. It was deleted before the final test invocation.
- `node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js`: **27 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**, 21.617 seconds. Breakdown: **16 unit tests and 11 integration tests**.
- Temporary unhandledRejection listeners were restored; no unhandled rejection was observed in the final run. Runtime environment and injected transport are restored, and the disposable SQLite database is removed by teardown.
- `git diff --check`: passed. No temporary configuration remains. No dependency, schema, generated declaration, JDL, activation default, endpoint, grant, capability catalogue or OpenAPI change was made by this plan. Invitation dispatch performs no IdamBoxUser writes.
- The unfiltered backend gate was not rerun in this selected-wave task. Its inherited WINDOWS.md entry 11 compilation blocker remains open; filtered compilation and these focused tests do not establish full-suite success.

## Deviations and execution corrections

1. Existing plan 05-01 behavior already passed the new transaction, authority and eligibility assertions; no artificial failing behavior or complete test-first cycle is claimed. Changes are primarily acceptance coverage, plus a backwards-compatible optional scheduler argument used by the instance bootstrap test seam.
2. An initial process-wide scheduler replacement disturbed unrelated Strapi scheduling: the first run reported 24 passed and 1 failed. The final injection is scoped to the invitation dispatcher instance.
3. A subsequent run reported 15 passed and 11 setup failures because the inherited helper hardcoded the application output directory. The harness now loads source/authority modules from `compileStrapi`'s returned directory, as required by the plan.
4. A broad logger injection exposed an unrelated existing SCIM request logger exception; that intermediate run reported 26 passed and 1 failed. The final mounted test targets the optional identity/invitation diagnostics covered by this plan. Broader SCIM request-log failure isolation remains outside this change.
5. Future-start status uses the existing inactive contract; no unsupported start-date field or schema was introduced. Operator resend guards remain owned by plan 05-03 rather than being implemented in wave 2.
6. User-directed execution leaves all changes uncommitted. No git write, commit, network operation, Docker action, live stack, SMTP delivery or browser acceptance was attempted. Shared workstream state and phase completion were left to the selected-wave coordinator. Actual token estimate is the 20,936-character implementation/test diff divided by four; it excludes this execution record.

## Remaining acceptance

SIGN-01 stays open pending later operator and live contract/mail/browser acceptance. Existing false activation defaults, source authority and Document Service write enforcement are preserved. No phase completion or later-wave execution is implied.

## Self-Check: PASSED

All three changed source/test files and this summary exist. The final compiled suites passed, the temporary configuration is absent and whitespace validation passed. Commit verification is inapplicable because commits were explicitly prohibited.
