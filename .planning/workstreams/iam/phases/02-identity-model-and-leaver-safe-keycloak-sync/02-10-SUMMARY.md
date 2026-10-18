---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "10"
status: complete
subsystem: identity
tags: [iam, keycloak, outbox, leases, transactions]
requires:
  - phase: "02-09"
    provides: Atomic leaver enqueue, blocking reactivation and shared user locks
provides:
  - Subject-only deadline-aware account disabling and session termination
  - Database-time atomic leases and owner/generation-fenced outbox transitions
  - Lifecycle-managed polling with capped indefinite retries and inert off mode
affects: [iam, csrm]
actuals:
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns: [short outbox claim transaction, user-first execution transaction, at-least-once remote delivery]
key-files:
  created:
    - apps/backend/src/iam/keycloak-sync/config.ts
    - apps/backend/src/iam/keycloak-sync/worker.ts
    - apps/backend/tests/iam-keycloak-client.unit.test.ts
  modified:
    - apps/backend/src/keycloak/admin-client.ts
    - apps/backend/src/iam/keycloak-sync/outbox.ts
    - apps/backend/src/index.ts
    - apps/backend/tests/helpers/fake-keycloak-server.ts
    - apps/backend/tests/iam-keycloak-sync.integration.test.ts
key-decisions:
  - "Renew an unexpired owned lease under the user lock immediately before remote delivery; never revive an expired owner."
  - "Saturate attempts at the signed 32-bit maximum while continuing capped retries indefinitely."
  - "Apply zero-to-twenty-percent positive jitter after capping base backoff at one hour."
  - "Keep the existing provisioning config parser and validate worker-specific timeout/lease compatibility separately."
requirements-completed: [LIFE-02, PROV-05]
completed: 2026-10-14
---

# Plan 02-10: Bounded Keycloak revocation and fenced delivery

Executed only plan 02-10 (wave 10). Both tasks are complete and every change remains uncommitted for orchestrator review. No Git write commands were run. STATE.md and ROADMAP.md were not updated. No containers were started. Verification used the existing local test harnesses, isolated SQLite persistence and localhost fake servers.

## Delivered

- Task 1 adds disableUser and endUserSessions using only the stored, encoded subject. Disable sends exactly enabled=false; logout clears the fake server's actual session map. An absent subject makes no client/token request, and HTTP 404 is successful absent-user revocation. No lookup, creation or email adoption occurs on this path.
- Each revocation call includes token acquisition, a shared-token waiter, one 401 refresh, request send and response cleanup inside the smaller of the remaining attempt budget, configured request timeout and 5000 ms. The worker passes one deadline and cancellation signal across both operations, capped at 30000 ms. Cancellation reaches a token request owned by the revocation caller; other shared-token waiters retain their own deadlines. Remote error bodies do not become revocation error text, stored lastErrorCode or worker logs. Existing create/update behavior and its regressions remain intact.
- The fake server has real session removal, one-shot request barriers and delayed-header/body controls. Unsupported implemented-user operations return 501 rather than accidentally pretending that logout succeeded through an unimplemented 404.
- Task 2 claims work in a short outbox-only transaction. Candidate selection is a hint; one conditional id/generation/eligibility update sets a fresh UUID owner, expiry and bounded incremented attempts. Exactly one affected row wins. The owned attempts count is reread after that update, rather than inferred from a potentially stale hint. SQLite reserves its write transaction before deciding reads and reuses the existing bounded whole-transaction busy retry helper.
- After the claim commits, execution uses the existing shared user lock in a separate transaction. It reloads the current user and work, checks inactive status, matching subject/relation, generation and owner, then conditionally renews the still-unexpired lease and locks the outbox before network I/O. The user lock stays held through disable, logout and acknowledgement. Completion, retry, cancellation and renewal all match id/generation/owner and an unexpired processing lease. Lost fences cannot acknowledge or reschedule.
- Eligibility, expiry, renewal, acknowledgement and retry scheduling use current database time. PostgreSQL uses clock_timestamp(), not transaction-start now(); SQLite uses millisecond epoch time matching persisted datetime storage. The MySQL expression is implemented but has no production-dialect proof from this run.
- Bootstrap validates settings and starts one poller per enabled instance; destroy clears its timer, aborts owned remote work and awaits its in-flight operation. Off/unset provisioning creates no worker client, timer or network request and leaves durable work unchanged. Subjectless work completes before client construction. Only a successful disable/logout pair completes linked work; partial failure, expired leases and crash-before-acknowledgement recover through replay.

## Verification

Every plan-named command was run. Compilation passed immediately before each final named test command.

| Command | Final outcome |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | PASS, exit 0; all named compiled test artifacts exist. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-keycloak-client.unit.test.js .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js` | PASS, exit 0: 36 tests, 36 pass, 0 fail, 0 skipped, 0 cancelled. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-keycloak-sync.integration.test.js .tmp/tests-dist/tests/iam-keycloak-client.unit.test.js .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js .tmp/tests-dist/tests/keycloak-identity.integration.test.js` | PASS, exit 0: 37 tests, 37 pass, 0 fail, 0 skipped, 0 cancelled; approximately 146 seconds. |
| `git diff --check` | PASS. |

The worker suite proves local single-winner claims, expiry/reclaim with a fresh owner, rejection of stale owners/generations across every transition, partial logout retry, preserved backoff, real session termination, subjectless completion, simulated crash-before-ack replay, saturated attempts with continued authentication-failure retry, cancellation before the worker lock, serialization of reactivation after that lock, expired-owner refusal, per-instance startup and bounded remote shutdown. Existing suites retain blocking provisioning rollback, transient credential cleanup and next-request refusal of a previously accepted signed token after deactivation.

## Decisions and deviations

1. Followed the approved contract-gap record and P2-20 through P2-25. Defaults are poll 5000 ms, lease 60000 ms and attempt 30000 ms. Worker configuration rejects calls above 5000 ms, attempts above 30000 ms and leases without more than 1000 ms of attempt headroom before polling. Environment overrides use IDAMBOX_KEYCLOAK_SYNC_POLL_MS, IDAMBOX_KEYCLOAK_SYNC_LEASE_MS and IDAMBOX_KEYCLOAK_SYNC_ATTEMPT_MS.
2. Renew before remote execution only while the owner/generation is still valid and unexpired. A claim that expires while waiting cannot revive itself. Remote delivery remains at least once: an expired/crashed attempt may replay both idempotent operations.
3. Attempts saturate at 2147483647 without wrapping or introducing a permanent cutoff. Base backoff is min(3600, 5 * 2^(attempts-1)) seconds, computed with a bounded exponent; positive jitter is at most 20%, giving a maximum delay of 4320 seconds.
4. apps/backend/src/keycloak/config.ts required no edit: its existing required-value and positive-timeout parsing is retained. Worker-specific compatibility validation lives in the new sync config module. No schema, generated declaration, dependency, route, catalogue grant or committed flag default changed.
5. Tests and implementation were developed together; no pre-implementation RED run was recorded. Initial Task 2 test compilation failed on a fixture missing required protected and an environment override union containing undefined. Both fixture typings were corrected; subsequent compilation and named runs passed.
6. Final review corrected token-owner cancellation and the post-update attempts reread. The named checks were rerun after those corrections. Earlier successful runs contained 35 tests before the additional cancellation and saturated-authentication cases; they are not the final verification total.

## Remaining phase gates

No plan-02-10 named verification gate remains unmet. Requirement identifiers above record this plan's contribution, not completion of the whole phase. Shared PostgreSQL with two independent processes remains the mandatory 02-11 gate; real remote outage/session recovery remains the 02-13 gate. This run does not claim distributed PostgreSQL or MySQL support based on SQLite evidence. The full backend suite was deliberately not run, as instructed; the orchestrator owns that gate and comparison against the existing baseline.


## Orchestrator review note

Re-verified: compilation and 62 of 62 tests across the client, outbox, provisioning and boot suites. On PostgreSQL the worker's Keycloak calls run under one user's row lock. On the development SQLite database the same lock is SQLite's single write lock, so while Keycloak hangs (rather than refuses connections) other writes wait up to the per-call bound (5 s, two calls per attempt). This is development-only; it is accepted because production and the 02-11 gate use PostgreSQL. 02-13's live outage gate should still confirm that a deactivation commits promptly while Keycloak is stopped.
