# Phase 2 Gate Evidence

**Run by:** orchestrator, 2026-10-15 (local, Windows 11, Node 24), on the branch checked out for the `iam` workstream.
**Final code under test:** commit `58e9f1ea` (02-13 Task 1 at `f9d57d59`, plus the code-review fixes `cf557fae`, `f9abf97f`, `58e9f1ea` and the test-harness fix `fc183567`).

Every result below was observed in this run. None is predicted.

## 1. Full backend suite (P2-30)

Command: `pnpm --dir apps/backend test` from the repository root, with no maintenance switches set and no Keycloak or gate variables in the environment.

| Result | Value |
| --- | --- |
| Exit status | 0 |
| Duration | 51 min |
| Tests | 1803 |
| Pass | 1802 |
| Fail | 0 |
| Cancelled | 0 |
| Skipped | 1: "the private local provider's directory is 0700 and its files 0600 on the disk (IN-209; POSIX modes)". This is a platform skip on Windows, which keeps ACLs rather than POSIX modes, and is unrelated to IAM. |

**Baseline comparison (`.planning/WINDOWS.md` entry 10).** The recorded baseline was 1581 pass, 1 fail, 1 skipped. The failure was `questionnaire-ai-proposals.integration.test.ts:458`, "with two 20,000-character files included, the job fails CONTEXT_TOO_LARGE…", failing with `fetch failed` / `read ECONNRESET`. It no longer fails.

- **Cause:** the 100-run and 147-question fixture test before it does synchronous SQLite work. That work blocked the event loop past Node's 5-second HTTP keep-alive timeout. The next multipart POST then reused a pooled socket that the server closed in the same loop turn, and `fetch` does not retry a POST.
- **Fix (test harness only, commit `fc183567`):** the shared harness server's `keepAliveTimeout` is raised to 120 s.
- **Proof:** the file alone failed 27/1 before the fix and passed 28/28 after it. The full suite above passes it in normal order.

No new regression was found.

## 2. Compatibility (P2-01, P2-30)

- `iam-schema-contract.unit.test.js`, `contract-catalogue.integration.test.js` and `served-operations.integration.test.js` (run before the review fixes): 42/42 pass. All three are also part of the green full suite above, which ran after the fixes.
- Schema diff against the default branch: one commit, `d2caa1c0`, changes content-type schemas. It touches only `idambox-user` (new source fields), `identity-source` (new) and `keycloak-sync-outbox` (new), as the approved record `docs/contract-gaps/iam-identity-model-and-leaver-sync.md` says. No JDL change.
- Committed defaults: `apps/backend/.env.example` keeps `IDAMBOX_KEYCLOAK_PROVISIONING=false` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`. The realm seed is unchanged; `idambox-csrm` direct grants stay disabled.

## 3. Live Keycloak outage and recovery (P2-29, success criterion 4)

Command: `pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-live-keycloak-gate.js --timeout-seconds 600`.

- **Stack:** compose project `idp`, service `keycloak`, realm `idambox`.
- **Configuration:** gate variables supplied from a file outside the repository. The admin client is the `idambox-strapi-admin` service account; the human session uses `idambox-csrm` with authorization code + PKCE.
- **Result:** exit 0 after 3 min 33 s. Stages passed in order: `live-setup`, `live-session`, `live-stop`, `live-inactive-refusal`, `live-outage-retry`, `live-start`, `live-recovery`, `live-restore`, `live-cleanup`.

What the stages assert (`tests/helpers/iam-live-keycloak-gate.ts`):

- **Before the outage:** the gate-owned human is linked and active, holds a real token, and has at least one Keycloak session (Admin API session count > 0).
- **During the outage:** Docker recorded `keycloak` stopping at 06:23:26.05 and starting at 06:23:26.97, local time (AEDT). In that window:
  - the OIDC discovery endpoint was unreachable;
  - the deactivation committed with `accountStatus=inactive`, pending outbox work with the right subject and 0 attempts;
  - the still-valid signed token was refused with 403 on the next request;
  - one worker attempt left the work pending with `attempts=1` and `lastErrorCode=KEYCLOAK_UNAVAILABLE`.
- **After the restart:** the production polling worker disabled the Keycloak user (`enabled=false`), ended every session (count 0), and marked the work `completed`.
- **Cleanup:** Keycloak availability and the gate-owned fixtures were restored in `finally`. Keycloak was left running.

## 4. Two-process PostgreSQL gate (P2-23, P2-27, success criterion 4)

Command: `pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 1800`.

- **Database:** the disposable `iam_pg_gate` service (compose profile `iam-pg-gate`, PostgreSQL 16, tmpfs, `127.0.0.1:15432`). It was rerun after the review fixes, with credentials generated for this run and kept outside the repository.
- **Result:** exit 0. Every stage passed on both the fresh and the reused schema:
  - two-process identity and physical unique indexes;
  - tuple, source-target, outbox-target and outbox-key races;
  - one claim and one execution;
  - partial-pair replay and backoff;
  - dead-process crash before acknowledgement;
  - reactivation before the lock and generation fencing;
  - expired owner before the user lock;
  - reactivation after the lock;
  - **`stop-worker-held-user-lock` (new, WR-02):** another connection holds the user row lock, worker shutdown completes within its bound, the worker backend has left the lock wait, no remote call is made, and the work completes after lease expiry;
  - subjectless completion;
  - enqueue and blocking rollback;
  - existing writes take the user lock.

The first run's evidence, and the two PostgreSQL-only defects it found, are in `02-POSTGRES-EVIDENCE.md`.

## 5. Write discipline (success criterion 5)

- `node .tmp/tests-dist/scripts/idambox-user-write-guard.js --check` passes on `apps/backend/src`: 250 files, about 8–15 s. The same check runs inside the ordinary unit suite, and it fails if fewer than 100 files are covered.
- **Probe:** a deliberate `strapi.db.query("api::idambox-user.idambox-user").updateMany(...)` added to `src/iam/keycloak-sync/worker.ts` was reported as `worker.ts:90 updateMany` with exit 1. It was then removed with no diff left.
- The first 02-12 inventory pass was vacuous on Windows, because its path filter matched no files. That is corrected and recorded in `02-12-SUMMARY.md`.

## 6. Review and security

- `02-REVIEW.md`: one blocker (CR-01) and two warnings (WR-01, WR-02), all fixed and committed with tests.
- `02-SECURITY.md`: 21 of 22 threats were closed at audit time. T-02-28 (gate evidence and baseline status) closes with this record.

## Verdict

All five Phase 2 success criteria are met, with the evidence above. The full backend command is green, and no baseline failure is accepted as a pass.
