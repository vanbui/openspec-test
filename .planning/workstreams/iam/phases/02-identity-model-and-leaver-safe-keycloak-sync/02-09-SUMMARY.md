---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "09"
status: complete
subsystem: identity
tags: [iam, keycloak, credentials, outbox, transactions]
requires:
  - phase: "02-08"
    provides: Scoped source operations, ownership guards and shared user locks
provides:
  - Transient enabled-mode passwords and narrowly trusted Document Service cleanup
  - Atomic existing-user deactivation and generation-aware durable outbox work
  - Blocking reactivation with transactional cancellation and immediate request refusal
affects: [iam, csrm]
tech-stack:
  added: []
  patterns: [Document Service persistence, shared user locks, generation and owner fences]
key-files:
  created:
    - apps/backend/src/iam/identity/keycloak-linkage.ts
    - apps/backend/src/iam/keycloak-sync/outbox.ts
    - apps/backend/tests/iam-keycloak-sync.integration.test.ts
  modified:
    - apps/backend/src/keycloak/register-idambox-user-provisioning.ts
    - apps/backend/src/iam/identity/register-identity-writes.ts
    - apps/backend/src/iam/identity/write-context.ts
    - apps/backend/tests/keycloak-provisioning.integration.test.ts
    - apps/backend/tests/keycloak-identity.integration.test.ts
key-decisions:
  - "Subjectless inactive legacy users receive narrowly trusted null credential cleanup without remote adoption."
  - "Reactivation cancels pending/processing work before the blocking enable, in the same user-locked transaction."
  - "Users referenced by durable outbox work cannot be hard-deleted, preserving the required matching relation."
  - "Generation advancement refuses the signed 32-bit integer limit rather than wrapping."
requirements-completed: [MODEL-03, PROV-05, PROV-07, LIFE-02]
completed: 2026-10-14
---

# Plan 02-09: Transient credentials and atomic leaver enqueue

Executed only plan 02-09 (wave 9). All source/test changes and this summary remain uncommitted for review. No Git write commands were run. STATE.md and ROADMAP.md were not updated. No containers were started; integration fixtures used local Strapi processes, isolated SQLite databases and localhost fake servers.

## Delivered

- Enabled-mode writes validate the original password type and minLength=6 before omitting it from persisted input. The transient value is passed only to the provisioner. Nested subject/password cleanup uses writeKeycloakLinkage and the existing exact-field runKeycloakLinkage capability; ownership guards still execute, and recursive provisioning is skipped. The prerequisite already used nested Document Service linkage; this plan retains that boundary and removes password hashing from the outer enabled write. No application raw user mutation remains in the provisioner.
- Credential tests inspect downstream Document Service input and the exact nested cleanup call. They prove password-null persistence, omitted-password creation, invalid original password refusal, create/update remote rollback, nested cleanup rollback, retry adoption without recursion, and rollback of a sourced claim when cleanup fails. Ordinary sourced-subject edits still fail.
- Every authorized existing-user update whose resulting status is inactive commits the Document Service user change and durable enqueue in the same shared-lock transaction, with zero remote calls. Creates, including inactive creates, retain blocking provisioning. The always-on ownership middleware also enqueues while provisioning is false/unset.
- Outbox work has one durable user-keyed row, a required matching IdamBox User relation and a subject snapshot. New deactivation advances generation and resets retry/error/lease/completion fields. Inactive replay preserves the existing row and its backoff/completion; absent work is repaired. Initial due time comes from database time. Outbox coordination locks existing work after the user lock on row-lock dialects.
- Reactivation cancels pending/processing work before the blocking enable call. Cancellation uses the row id, generation and lease owner fence and clears the old lease without deleting history. A failed enable restores both inactive user state and the old processing row. The next deactivation rearms the same durable row with a new generation.
- The mounted signed-token transport test reuses an already accepted token after internal deactivation and gets 403 on both current-user access and an ordinary protected operation. Restoring active status restores access with that same token; subject matching is unchanged.

## Verification

Every plan-named command was run. Compilation passed immediately before each final named integration command.

| Command | Final result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | PASS, exit 0, before both final named runs. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js .tmp/tests-dist/tests/iam-identity.integration.test.js .tmp/tests-dist/tests/iam-ownership.integration.test.js` | PASS, exit 0: 22 tests, 22 pass, 0 fail, 0 skipped, 0 cancelled; approximately 135 seconds. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-keycloak-sync.integration.test.js .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js .tmp/tests-dist/tests/keycloak-identity.integration.test.js .tmp/tests-dist/tests/iam-identity.integration.test.js` | PASS, exit 0: 29 tests, 29 pass, 0 fail, 0 skipped, 0 cancelled; approximately 336 seconds. |
| `pnpm --dir apps/backend exec tsc --noEmit --pretty false` | PASS, exit 0, including the backend's own generated-type compilation context. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js` | PASS, exit 0: 30 tests, 30 pass, 0 fail, 0 skipped. |
| `git diff --check` | PASS. |

Final logs, relative to apps/backend: `.tmp/iam-09-task1-verified.log`, `.tmp/iam-09-task2-verified.log` and `.tmp/iam-09-provisioning-unit.log`.

The outbox suite boots real Strapi and verifies off-mode legacy password behavior and HR ownership, subjectless enqueue, enabled legacy credential cleanup, full inactive PUT HR edits, matching relation/subject, retained retries, failure after user persistence but before enqueue, tombstone rollback, cancellation before enable and rollback after failed enable, linked Role/nonmirrored skips, second-generation reset, missing-work repair, retained completion, integer overflow rollback, inactive-create blocking, bearer-only source services, and inactive PUT/replay after shutting down the remote server. The ownership/source suites retain their existing administration, claim, uniqueness, tombstone and reseeding coverage.

## Development failures and corrections

- The initial task-1 development run passed 21 tests. It preceded the additional sourced-cleanup case and is not the final verification: `.tmp/iam-09-task1-initial.log`.
- Early compilation exposed an unavailable transitive utility import and missing required fields in a test fixture; these were corrected without adding a dependency. Later integration attempts exposed generated nullable-attribute typing differences and then a missing required-field typing shape in outbox creation. The failed runs remain in `.tmp/iam-09-task1-compile-failure.log` (7 pass, 2 file-level failures) and `.tmp/iam-09-prequeue.log` (2 compilation-blocked file failures). They are not counted as passes.
- The compiled pre-queue run returned exit 1 with 13 tests, 6 pass and 7 fail: six outbox/outage cases failed before middleware wiring, and the new sourced-cleanup fixture incorrectly expected an unexpected persistence failure to become a returned outcome. The latter was corrected to expect rejection, preserving the source service's existing contract. Log: `.tmp/iam-09-prequeue-compiled.log`.
- The final complete named runs above passed after all corrections. No required case was skipped.

## Decisions and scope

1. Followed the approved contract-gap record and P2-18 through P2-20, P2-26/P2-27 and P2-29. Schemas, catalogue grants, routes, dependencies and committed provisioning/token-verification defaults are unchanged.
2. Extended the exact linkage capability to accept a null subject solely for trusted credential cleanup of an existing inactive legacy user without a subject. This retains the approved optional subject and avoids creating/adopting a remote account on the leaver path. It still accepts only externalSubject and password:null, with no callback or public bypass flag.
3. Used Document Service for enqueue/rearm and all user persistence. Only cancellation directly mutates an outbox row through the transaction-bound, generation/owner-fenced query. Generated optional attribute input types omit runtime-supported null values; an internal cleanup record supplies those nulls while the required enqueue fields retain their concrete types and runtime schema validation.
4. Added a scoped deletion refusal for any user referenced by durable work, including manual users. Otherwise a successful deletion could orphan the required outbox relation and fail the next invariant check. The integration suite verifies that both records remain; users without durable work retain the prior deletion rules.
5. Used the signed 32-bit maximum for generation overflow protection. Unexpected persistence/overflow faults propagate and roll back; they are not disguised as client conflicts or remote availability errors.

## Remaining phase gates

No plan-02-09 verification gate remains unmet. Requirement identifiers above record this plan's contribution, not full phase completion. Worker disable/logout delivery, retry/lease recovery, shared-PostgreSQL multi-process proof and live remote recovery remain later phase-plan obligations. SQLite/fake-server evidence does not establish production-dialect concurrency or live session revocation.

The full backend suite (`pnpm --dir apps/backend test`) was deliberately not run, as instructed; the orchestrator owns that gate and comparison against the recorded pre-existing baseline. No later wave or phase completion was executed.

## Self-Check: PASSED

Declared implementation/test artifacts exist; both complete named integration commands and strict compilation pass. The final diff contains only this plan's implementation, regression tests and summary, with all changes left uncommitted.

## Orchestrator re-verification

Full backend suite after 02-09: 1699 tests, 1696 pass, 1 skipped, 2 fail. One is the known CONTEXT_TOO_LARGE ECONNRESET baseline. The other was a real regression: with provisioning enabled, the inner provisioning middleware now strips a transient password before the service invariant check, so a password on a source service user was silently dropped instead of refused (nothing persisted). The outer identity guard now refuses any password on a registered source service before inner middleware runs; the registration, ownership and outbox suites pass (22/22).
