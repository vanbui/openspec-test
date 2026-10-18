---
phase: 05-sign-in-and-end-to-end-journey
plan: "01"
subsystem: identity
tags: [keycloak, scim, transactions, password-setup]
status: complete
completed: "2026-10-17"
requires:
  - phase: 04-midpoint-configuration
    provides: Trusted source provisioning and immutable source ownership
provides:
  - One bounded post-outer-commit password-setup email attempt for newly sourced people
  - Detached instance lifecycle, fresh eligibility reads and closed diagnostics
affects: [05-02, 05-03, 05-11, 05-12]
tech-stack:
  added: []
  patterns: [public outer-commit hooks, boot-scoped detached execution, abort-bounded read-only dispatch]
actuals:
  tasks: 2
  commits: 0
requirements-addressed: [SIGN-01]
requirements-completed: []
key-files:
  created:
    - apps/backend/src/iam/password-setup/service.ts
    - apps/backend/src/iam/password-setup/dispatcher.ts
    - apps/backend/tests/iam-password-setup.unit.test.ts
    - apps/backend/tests/iam-password-setup.integration.test.ts
  modified:
    - apps/backend/src/iam/identity/identity-service.ts
    - apps/backend/src/keycloak/admin-client.ts
    - apps/backend/src/index.ts
key-decisions:
  - Dispatch has a total budget of at most 5000 ms, capped by the configured request timeout.
  - Only stored source/user documentIds cross the commit callback; eligibility and subject are read after commit.
  - Mounted Koa requests and injected transports avoid listener/network requirements in offline integration tests.
---

# Plan 05-01 execution summary

New trusted sourced creates now register one best-effort UPDATE_PASSWORD action-email attempt through the public transaction onCommit hook. The hook joins the original source lock transaction; nested Document Service completion does not send an email. Claims, manual creation, duplicate creates, updates and reactivation do not register invitations.

The enabled ordinary application creates its detached AsyncResource before requests exist. Each one-shot dispatch rechecks the committed source binding, active/unprotected/non-service/non-tombstoned status and stored externalSubject through Document Service. Eligibility reads, token acquisition, response handling and shutdown are bounded. Shutdown cancels pending handles and aborts active attempts. Disabled provisioning creates no email client, detached resource or timer; administration boot skips automatic dispatch.

The production transport sends one PUT to execute-actions-email with exactly [UPDATE_PASSWORD], no optional query parameters, credentials or application retry. Closed outcome events carry only documentIds, trigger, outcome and reason; logger and scheduling/registration failures are contained. Sent means endpoint acceptance, not mailbox delivery. No persistent email queue or delivery guarantee is introduced; crash/timeout uncertainty requires the later explicit operator recovery path.

## Verification

- Plan structure recheck: valid, two tasks, zero errors or warnings. Shared working tree was clean before execution.
- `pnpm --dir apps/backend exec tsc --pretty false`: passed.
- `pnpm --dir apps/backend test`: failed during test compilation with six inherited diagnostics in risk-curation-rules.unit.test.ts and risk-history-changes.unit.test.ts, including their missing production modules. No tests executed by that command; it is not a full-suite pass.
- A temporary ignored `.tmp/password-setup-tsconfig.json` extends the existing test configuration, selects the focused suites and generated declarations, and uses its own incremental metadata. `pnpm --dir apps/backend exec tsc -p .tmp/password-setup-tsconfig.json --pretty false`: passed. No tracked compiler configuration or exclusion was changed.
- From `apps/backend`, `node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-password-setup.unit.test.js .tmp/tests-dist/tests/iam-password-setup.integration.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js`: **61 passed, 0 failed, 0 cancelled, 0 skipped**, approximately 30.9 seconds. Breakdown: 12 password-setup unit tests, 6 real SQLite integration tests, 43 write-discipline checks. The production inventory covered 274 source files.
- Integration assertions cover mounted authenticated SCIM 201, passwordless remote payload, durable subject linkage, outer transaction delay and rollback, failed linkage, email rejection preserving durable creation, manual/claim/update/duplicate/reactivation exclusions, fresh inactive/tombstoned skips, absent transaction/request/write authority, and throwing diagnostics.
- Unit assertions cover inert disabled startup, queued/in-flight shutdown, registration/scheduling/logger failures, asynchronous logger rejection, unresolved and late-rejecting reads, eligibility exclusions, safe fields/identifiers, exact action-email transport, no retry, and token/body/fetch deadlines.
- After preserving asynchronous logger results through the final dispatcher adapters, source and focused compilation were rerun successfully and the unit suite passed again: **12 passed, 0 failed, 0 cancelled, 0 skipped**.
- `git diff --check`: passed.

## Deviations and execution corrections

1. Loopback listeners are prohibited by this sandbox: the initial HTTP harness boot reached `listen EPERM`. The final integration harness boots real Strapi/SQLite and mounts the real routes, policies and middleware, but supplies in-process IncomingMessage/ServerResponse objects and injected remote transports. No listener, external service, SMTP or browser result is claimed.
2. An initial compiler process overlapped a boot and that boot failed schema initialization. The run was discarded; subsequent compilation and application test processes were serialized. An initial write-inventory run used the repository root and failed its working-directory assertion (60 passed, 1 failed); rerunning from apps/backend passed all 61 checks.
3. The first failing observation was test compilation against the not-yet-created modules. The real SQLite integration cases were added after the initial implementation; this execution does not claim a fully observed test-first transaction sequence.
4. The existing identity audit logger could throw after a committed source mutation. Its synchronous and asynchronous failures are now contained alongside the new invitation diagnostics, with integration coverage. This prevents a successful durable create from being reported as failed because of diagnostic infrastructure.
5. The unfiltered compilation blocker remains open. Focused compilation is diagnostic validation only and does not waive the later unfiltered gate.
6. No commits were attempted. All seven implementation/test files and this summary remain in the working tree for review; the workstream state records the selected-wave stop.

## Boundaries and remaining work

Content-type schemas, generated declarations, JDL, disableAndEndSessions outbox operation, all three committed false activation defaults, existing CSRM endpoints/grants, both capability catalogue copies and OpenAPI are unchanged. No dependency was added and the invitation path performs no user writes.

Only wave 1 was executed. Plan 05-02's expanded failure matrix, the operator command, SMTP seed and remaining journey work are pending. SIGN-01 remains open until its later live acceptance. Endpoint assumptions A1–A4, actual Keycloak/Mailpit delivery and the responsive lifecycle remain unobserved. Phase verification, phase completion, requirement closure and automatic advancement were not run.
