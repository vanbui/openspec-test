---
phase: 05-sign-in-and-end-to-end-journey
plan: "03"
subsystem: identity
tags: [password-setup, administration, recovery, strapi]
requires:
  - phase: "05-02"
    provides: Bounded password setup dispatch and sourced-human eligibility
provides:
  - Guarded documentId-only password setup administration command
  - Explicit operator dispatch with closed results and bounded cleanup
  - Offline command and Document Service recovery tests
affects: ["05-10", "05-11", "05-12"]
tech-stack:
  added: []
  patterns: [administration boot, stored subject lookup, injected remote boundary]
key-files:
  created:
    - apps/backend/src/iam/password-setup/resend-cli.ts
  modified:
    - apps/backend/package.json
    - apps/backend/src/iam/password-setup/service.ts
    - apps/backend/tests/iam-password-setup.unit.test.ts
    - apps/backend/tests/iam-password-setup.integration.test.ts
key-decisions:
  - Resend requires valid enabled provisioning configuration before application boot.
  - Source discovery and fresh eligibility share one bounded deadline and use only the stored subject.
  - Only the command entrypoint terminates the process after failed bounded destruction.
requirements-completed: []
requirements-addressed: [SIGN-01]
actuals:
  tokens: 10116
  tasks: 2
  commits: 0
plan_head_before: 0e6c95178b8c182b1def14bd6f83b10b5928a023
plan_head_after: 0e6c95178b8c182b1def14bd6f83b10b5928a023
duration: not-recorded
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 3: Guarded password setup resend Summary

**A documentId-only administration command performs one explicit guarded invitation attempt without user mutation.**

Both implementation tasks are complete within the offline execution scope. SIGN-01 live acceptance remains pending, and the unfiltered backend regression gate remains blocked by inherited compilation errors.

## Accomplishments

- Added `pnpm --dir apps/backend iam:password-setup -- <documentId>`. The parser rejects missing, malformed or additional selectors before configuration or boot; it accepts the package-manager separator.
- Required enabled provisioning and valid administration configuration before compiling/loading the application once. Administration boot suppresses ordinary seeds/workers and opens no listener.
- Reused the existing bounded dispatch and eligibility read. Resend discovers the stored source binding, rechecks eligibility, and sends exactly `UPDATE_PASSWORD` to the exact stored external subject. Missing, manual, protected, registered service, inactive, tombstoned and subjectless targets refuse. No user write or remote create/adopt/update/reset operation is part of resend.
- Added closed operator events and command outcomes, with no remote details, addresses, action links or credentials. Framework output is suppressed during the command and restored in `finally`.
- Bounded destruction to two seconds. On cleanup failure the entrypoint restores output streams, allows a bounded output flush and exits with failure even if handles remain open.
- Added nine unit tests and three integration tests. The full focused files now contain 25 unit and 14 integration tests.

## Verification

Commands used installed tooling under Node 24.20.0 with `pnpm_config_verify_deps_before_run=false`; no dependency installation was performed. Compilation and application tests ran sequentially because they share output directories. Test processes disabled framework telemetry.

| Check | Result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc --pretty false --incremental false` | Passed, exit 0 |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false --incremental false` | Blocked, exit 1: six inherited diagnostics in two unrelated test files |
| `pnpm --dir apps/backend exec tsc -p .tmp/iam-wave3-tsconfig.json --pretty false --incremental false` | Passed, exit 0; diagnostic configuration excludes only the two inherited failing files |
| `node --test --test-concurrency=1 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js` | 25 passed, 0 failed, 0 skipped; 1900.046205 ms |
| `node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js` | 14 passed, 0 failed, 0 skipped; 23279.185141 ms |
| Scoped `git diff --check` | Passed |

The integration tests used a fresh local SQLite application, real Document Service reads and existing identity-service/Document Service fixture writes. Remote behavior was injected. They verified explicit repeat recovery, unchanged records, refusal, eligibility changing after discovery, timeout and observed late rejection. Command entrypoint checks ran in child processes so output suppression could not hide test-runner results.

## Inherited Regression Blocker

The unfiltered test compilation produced exactly these six diagnostics, matching the existing cross-phase defect register entry 11:

- `tests/risk-curation-rules.unit.test.ts`: missing `../src/csrm/risk-curation-rules` at line 17; unknown `error` at lines 124 and 125.
- `tests/risk-history-changes.unit.test.ts`: missing `../src/csrm/risk-history-changes` at line 15; implicit-any `change` at lines 92 and 125.

Those files were left unchanged. Passing focused checks under a diagnostic exclusion does not establish a passing unfiltered backend suite. No broad suite, live service, Docker operation, actual mail delivery or browser journey was claimed or run for this plan.

## Task and Metadata Writes

1. Task 1: documentId-only command and shared operator dispatch implemented.
2. Task 2: command isolation, guards and recovery behavior covered by passing focused tests.

Git writes were prohibited for this execution. No staging, commit, worktree or branch mutation occurred. The measured head range contains zero commits; all implementation edits remain in the shared working tree. Shared state/roadmap changes are outside this plan's assigned ownership.

Actual token accounting uses characters divided by four over the scoped tracked patch plus the complete new command and this summary; it does not use runtime consumption. Five implementation/test files and this summary were written. An overall start timestamp was not captured; the exact final test durations are recorded above.

## Deviations from Plan

- The requested pre-implementation RED cycle was not run while compilation was reserved for another backend check. Tests and implementation were subsequently compiled and verified together. No failing-test-first claim is made.
- Entrypoint stream-suppression checks were moved into child processes after an initial in-process run suppressed three test-reporting events. That initial count was discarded; the final run reports all 25 tests.
- The task verification chain could not pass unfiltered because of the inherited six-diagnostic blocker. Diagnostic compilation and focused checks are recorded separately.
- Explicit execution constraints prohibited task and metadata commits.

## Remaining Acceptance

Explicit resend recovers unsent, uncertain or expired invitations. It adds no automatic retry or durable email queue. Remote acceptance is not evidence of mailbox delivery. Prior invitation invalidation/replacement behavior still requires the planned version-specific contract probe; this command makes no promise about it. Live activation and the complete sign-in journey remain pending their separate gates.

## Self-Check: PASSED

All five assigned implementation/test files exist, the focused files report all 39 tests passing with no skips, and the measured head range has zero commits as required by the execution constraints. No unfinished production stubs were introduced.
