---
phase: 05-sign-in-and-end-to-end-journey
plan: "09"
status: complete
subsystem: journey-contract-and-conflict
tags: [endpoint-contract, retry-later, offline-verification]
requires: [05-06]
provides:
  - Default private source-person, operator, Mailpit and browser bindings for the A1–A4 probe
  - Default native CSV, SCIM, audit and retry-scanner observations for IN-03
affects: [05-08, 05-10, 05-11]
tech-stack:
  added: []
  patterns: [injected-transports, request-local-observations, closed-outcomes, independent-cleanup-deadline]
completed: 2026-10-17
actuals:
  tasks: 2
  commits: 0
---

# Phase 05 Plan 09: Endpoint contract and conflict recovery

Both documented implementation gaps are closed and verified offline. This status covers the plan's implementation deliverables only. Actual A1–A4 and IN-03 acceptance remains pending for the orchestrator in 05-11; no live evidence was produced.

## Implementation gaps closed

1. **Default contract binding:** `--probe-keycloak` now constructs its source-person/operator, local administration transport, Mailpit mailbox and installed browser consumer without an injected runtime. The private/disposable gate runs before construction. It checks listener/compiler exclusivity before remote mutation, requires observed Keycloak 26.6.1, and uses a separate administration process with seeds/workers/listening suppressed. The controlled source person is created through the existing identity service; resend uses the guarded password-setup service with its stored local documentId. Cleanup uses identity-service deactivation, the actual `disableUser`/`endUserSessions` methods, ownership-checked remote removal and process shutdown.
2. **Default conflict binding:** the named `in03-conflict` stage now constructs native CSV/task, read-only local/SCIM, native audit, owned remote collision and persistent retry observations. `--in03-conflict` exposes the same stage after the existing eight setup stages, allowing an independent orchestrator run before the later browser work is complete. It retains one shared setup deadline, the 1500-second conflict deadline and independent cleanup.

The probe measures the default action-token lifetime from the delivered private Mailpit action and checks explicit 60-second lifetimes from subsequent delivered tokens. It retains all seven valid/invalid client/redirect/lifespan combinations. Production action-email parameters remain omitted by default. Query-validation callbacks are never consumed as action completion redirects. The real password form is driven only with a validated private mail link; its generated password, browser diagnostics and mail body never enter public observations. SMTP restoration and the original failure survive cleanup failure.

Mailbox freshness is tied to the pre-command recipient/count/message-ID baseline and timestamp, including delivery that completes before the first polling request. Stale, substituted, ambiguous and truncated mail fail closed. Action links remain in private memory behind receipt objects.

IN-03 publishes validated whole snapshots and triggers native reconciliation/live-sync tasks. It requires connector PUT 503 / Retry-After 30, local rollback, stable source/native/local/remote identity, no adoption/duplicates and unchanged invitation count. It checks actual native failure statuses, including handled subresults, rather than searching diagnostic text. Retry observation reads the person's linked HR/target shadows and the configured five/fifteen-minute intervals; the handler URI was corrected against the local pinned 4.8.14 implementation. It observes recovery through the native scanner without issuing a recovery task run or shortening a schedule.

Audit reads join native `ma_audit_event` with `m_object` for the task name and pair REQUEST/EXECUTION records. The former query's nonexistent audit `taskname` column was removed. Identity, time window, scanner/task attribution and the SCIM timestamp must agree. CSV and SQL stdout is captured privately; runtime shadow reads are now permitted. Cleanup terminates the sourced person through validated CSV/native work, observes remote disable/session removal, and restores the original snapshot. Partial preparation still invokes independent cleanup.

The listener's SCIM observer uses request-local storage so concurrent requests to the same target cannot exchange request IDs. It records only requests authenticated with the private source bearer, paired with the ordinary SCIM boundary's source/status/request log. It adds no SCIM identity-header authentication. Local uniqueness and remote-only membership checks remain read-only Document Service `findMany` operations.

## Browser fixture and scope

The previously failing process-browser test now supplies the listener's `access-prepare` proof, checks that the imported person's employee number reaches that request, checks the exact private control input, and retains the authenticated observation, session and start-order assertions. The missing fixture input was corrected without relaxing the session check.

The restored access helper and later-stage control seams remain, with offline coverage for catalogue operation equality, ordinary API credentials, original-token retention, foreign-record refusal and immediate pre-expiry refusal. The catalogue parameter spelling was corrected to `{id}`. The default browser advertises only password setup and sign-in, matching the delivered spec; later 05-08 stages remain unavailable by default. No 05-08 completion is claimed.

## Files in this working-tree change

All code/test paths below are under `docker/midpoint/e2e/`:

- Added: `journey-bindings.mjs`, `journey-bindings.test.mjs`.
- Added: `journey-observations.mjs`, `journey-observations.test.mjs`.
- Retained and reviewed from the restored work: `journey-access.mjs`, with new `journey-access.test.mjs`.
- Modified: `journey-contract.mjs`, `journey-conflict.mjs`, `journey-conflict.test.mjs`, `journey-runtime.mjs`, `journey.mjs`, `journey.test.mjs`.
- Rewritten: this summary.

## Verification

Node v24.20.0. Tests used injected transports, native responses, clocks, administration-module stubs and browser doubles. No network calls, live services, Docker commands or real browser sessions were executed.

| Command | Final result |
|---|---|
| `node --test docker/midpoint/e2e/*.test.mjs` | 172 passed, 0 failed, 0 skipped, 0 cancelled |
| `node docker/midpoint/e2e/journey.mjs --check` | Passed, exit 0 |
| `git diff --check` | Passed |

Coverage includes complete default-probe A1–A4 orchestration, the concrete IN-03 binding from CSV publication through scanner recovery and cleanup, the embedded administration service calls, browser consumption/closure, mail freshness failures, concurrent SCIM observation isolation, refusal of non-source credentials as connector evidence, and an AST guard requiring direct IdamBoxUser Document Service accesses in the embedded programs/access helper to remain read-only.

No `apps/backend` files changed, so the conditional backend test command was not run. No backend full-suite pass is claimed; the inherited compilation issue in WINDOWS.md entry 11 was not re-evaluated here. No frontend source/configuration, content-type/schema, generated types, JDL, dependency or committed activation default changed. The inert check verifies all three committed activation flags remain false.

## Remaining orchestrator obligations

- Run the actual pinned-service A1–A4 probe, including measured query semantics, SMTP restoration, real action consumption, guarded resends and fixture cleanup, in 05-11. Optional local source references remain separate from observed server facts. Offline doubles do not establish endpoint behavior.
- Run the actual IN-03 collision and native scanner recovery in 05-11. Confirm native audit pairing/serialization, linked-shadow trigger shape, connector 503/Retry-After 30, rollback and recovery against the real stack. A persistent collision requires correcting the owned remote fixture or validated source input; retain the normal five/fifteen-minute retry schedule.
- Supply each live CLI invocation with the existing private/disposable environment contract. The probe uses its own fresh private SQLite database and leaves the inactive/tombstoned local fixture in that disposable database for inspection; remove the private probe directory after shutdown and use a fresh run/database for subsequent reset-owning commands. `--in03-conflict` owns the usual reset, runtime teardown and private handoff cleanup. No developer environment file is used as a token export destination.
- Finish 05-08 browser behavior and 05-10 operating/evidence integration separately. Full passing journey evidence, both viewport lifecycles and phase/requirement closure remain later work.

No git commit, stash, reset or checkout was run. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited. Changes remain in the working tree for orchestrator review.
