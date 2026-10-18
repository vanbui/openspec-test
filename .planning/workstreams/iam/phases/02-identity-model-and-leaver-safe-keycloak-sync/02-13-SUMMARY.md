---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "13"
wave: 13
status: partial
subsystem: identity
requirements: ["MODEL-01", "MODEL-03", "PROV-05", "PROV-07", "LIFE-02"]
tasks-completed: [1]
tasks-pending: [2]
actuals:
  tasks: 1
  commits: 0
key-files:
  created:
    - apps/backend/tests/helpers/iam-live-keycloak-gate.ts
  modified:
    - docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md
    - apps/backend/tests/helpers/iam-gate-harness.ts
    - apps/backend/tests/iam-gates.unit.test.ts
updated: 2026-10-15
---

# Plan 02-13: Task 1 only

Task 1 is implemented and its two verification commands pass. **Task 2 is pending orchestrator execution.** This summary does not establish a passing live gate or full backend suite. No `02-GATE-EVIDENCE.md` was written. All changes remain uncommitted; no Git writes, container operations, Keycloak requests, STATE.md updates or ROADMAP.md updates were performed.

## Delivered behavior

ADR 0002 now records the approved existing-user effective-inactive exception: the Document Service write and outbox enqueue commit atomically without remote calls, while creates, other mirrored updates and reactivation remain blocking. Ownership/enqueue stay active with provisioning off; remote clients and worker remain opt-in. The amendment records user-first locking, owner/generation fencing, 5-second polling, 60-second leases, 30-second attempts, calls bounded to 5 seconds, indefinite capped backoff, disable then logout, and at-least-once remote delivery. ADR 0004 subject matching is unchanged.

The standalone compiled helper exports `runIamLiveKeycloakGate`. It creates a random gate-owned transient Keycloak human through the configured service-account Admin API, holds its random password only in memory, and links a manual IdamBoxUser through the trusted Document Service linkage seam in a disposable Strapi child process. It signs in through the ordinary `idambox-csrm` authorization endpoint and login form, carrying cookies, state and an S256 PKCE challenge, then exchanges the authorization code with its verifier. There is no direct-password grant, realm/client mutation or grant fallback.

Before any outage, the gate requires a linked active record, a successfully verified signed-token request to the mounted `/api/v1/me/access` operation, and a positive Admin session count containing the CSRM client. It then stops only compose project `idp` service `keycloak`, proves connection refusal, commits inactivity through the internal Document Service, checks pending subject-bound work, and requires the same still-valid signed token to receive 403 on its next request. It executes a real worker attempt during the outage and requires durable retry, then starts Keycloak and polls the actual worker until the remote account is disabled, sessions are empty and work is completed.

The compose boundary is fixed to `docker/docker-compose.yaml`, project `idp`, and service `keycloak`, using only `docker compose ... stop keycloak` and `docker compose ... start keycloak`. Restoration is registered before the stop attempt and always runs in `finally` after an outage attempt, including stop timeout/failure. Separate restoration and cleanup budgets prevent a stalled restoration from suppressing fixture teardown. Cleanup closes the child and removes only the exact random gate-owned remote identity and disposable local directory. Restoration or cleanup failure fails the gate.

The harness supplies reusable isolated child launch/IPC, closed failure reporting, environment isolation, fixed compose arguments and bounded cleanup. Child stdout/stderr are suppressed, remote bodies are not logged, and emitted evidence contains only closed stage names and pass/fail booleans. Parent/product environment flags are never modified; enabled provisioning and verification settings exist only in the child. No dependency, schema, frozen JDL, production default or committed realm setting changed.

## Required live environment

Every value below is read from the invoking environment. No committed secret or fixture credential is used, and the helper does not load the developer's dotenv or realm-import credentials.

| Variable | Meaning |
| --- | --- |
| `KEYCLOAK_BASE_URL` | Existing local compose Keycloak root URL, HTTP on `localhost:8080` or `127.0.0.1:8080`. |
| `KEYCLOAK_REALM` | Existing realm name. |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Existing service-account Admin API client with user read/manage permissions. |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret for that service-account client; uses `client_credentials`. |
| `KEYCLOAK_ISSUER` | Exact issuer, matching the base URL plus `/realms/{realm}`. |
| `IAM_LIVE_CLIENT_ID` | Must be `idambox-csrm`. |
| `IAM_LIVE_CLIENT_SECRET` | Existing confidential CSRM client secret. |
| `IAM_LIVE_REDIRECT_URI` | Already registered loopback HTTP callback, without query or fragment. The helper captures the code redirect without invoking the web callback. |
| `IAM_LIVE_FIXTURE_PREFIX` | Gate-owned username prefix matching `iam-gate-` followed by 1–32 lowercase letters, digits or hyphens. A random UUID is appended. |
| `IAM_LIVE_FIXTURE_EMAIL_DOMAIN` | Domain for the transient gate user's unique email. |

Missing/invalid configuration fails before an outage. Do not supply existing users' passwords: the gate generates its own transient password in memory. The standalone CLI requires exactly `--timeout-seconds N`, with 135–3600 seconds accepted for this live gate. Of the requested total, 120 seconds are reserved for restoration and cleanup; the plan's 600-second invocation remains supported.

## Decisions within the approved contract

- Use a newly created transient human rather than mutate any existing fixture user. Register its exact random identity before the create request so cleanup can find it even if creation fails after a remote commit.
- Use the existing service-account Admin client rather than bootstrap-admin username/password authentication. Human authentication remains authorization-code plus PKCE with direct grants disabled.
- Use disposable SQLite for this single-process live account/session gate. It establishes no distributed-database support claim; the independent shared-PostgreSQL evidence remains a separate required orchestrator check.
- Create and link the isolated local fixture with remote provisioning off, then enable the actual provisioning middleware for the tested leaver write. Exercise the real outage attempt and production polling worker without resetting outbox due dates or backoff.
- Leave the whole plan partial because Task 2, live verification and the full backend gate are deliberately outside this execution scope.

## Task 1 verification

| Command | Final result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Exit 0, no diagnostics. Named compiled helper exists at `apps/backend/.tmp/tests-dist/tests/helpers/iam-live-keycloak-gate.js`. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-gates.unit.test.js` | Exit 0; 27 tests passed, 0 failed, 0 cancelled, 0 skipped, 0 todo. |
| `git diff --check` | Exit 0. Read-only check. |

The initial compiler run rejected an unsupported property in `ForkOptions`; it was removed and compilation rerun successfully. Review also corrected the Windows SQLite filename to be relative to the application root. Final verification includes failure injection at every stage, required-session and recovery assertions, stop/restoration timeouts, independent cleanup after stalled restoration, child launch/startup/exit failures, credential/token redaction, environment/compose boundaries, and mocked login-form/state/cookie/PKCE exchanges. These are unit proofs; they do not claim successful real Strapi/Keycloak execution. No full backend suite was run.

## Task 2 (orchestrator, 2026-10-15)

Done. The live Keycloak outage gate, the two-process PostgreSQL gate (rerun after the review fixes), the schema, catalogue and served-operation compatibility tests, and the full backend suite all passed. The suite exited 0: 1803 tests, 1802 pass, 0 fail, 1 platform skip. The recorded ECONNRESET baseline failure was fixed at its cause in the shared test harness (`fc183567`), not accepted. Results and commands are in `02-GATE-EVIDENCE.md`.

The code-review fixes for CR-01, WR-01 and WR-02 are committed (`cf557fae`, `f9abf97f`, `58e9f1ea`); see `02-REVIEW.md`. `02-SECURITY.md` is SECURED with 22 of 22 threats closed. Plan 02-13 is complete.
