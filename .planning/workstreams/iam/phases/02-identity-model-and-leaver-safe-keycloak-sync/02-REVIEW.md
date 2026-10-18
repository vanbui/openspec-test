---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
workstream: iam
reviewed: 2026-10-14T19:31:11Z
depth: deep
diff_base: 90a91942
reviewed_head: fc18356798779eb54fef5af71ae140f1384eb752
files_reviewed: 35
files_reviewed_list:
  - apps/backend/scripts/idambox-user-write-guard.ts
  - apps/backend/src/api/csrm-administration/services/administration-repository.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
  - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
  - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
  - apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json
  - apps/backend/src/api/identity-source/content-types/identity-source/schema.json
  - apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/bootstrap/seed-csrm-data.ts
  - apps/backend/src/bootstrap/seed-iam-data.ts
  - apps/backend/src/csrm/people/eligible-person.ts
  - apps/backend/src/iam/identity/database-invariants.ts
  - apps/backend/src/iam/identity/identity-input.ts
  - apps/backend/src/iam/identity/identity-service.ts
  - apps/backend/src/iam/identity/keycloak-linkage.ts
  - apps/backend/src/iam/identity/register-identity-writes.ts
  - apps/backend/src/iam/identity/source-principal.ts
  - apps/backend/src/iam/identity/source-registration.ts
  - apps/backend/src/iam/identity/user-lock.ts
  - apps/backend/src/iam/identity/write-context.ts
  - apps/backend/src/iam/keycloak-sync/config.ts
  - apps/backend/src/iam/keycloak-sync/outbox.ts
  - apps/backend/src/iam/keycloak-sync/worker.ts
  - apps/backend/src/index.ts
  - apps/backend/src/keycloak/admin-client.ts
  - apps/backend/src/keycloak/register-idambox-user-provisioning.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/tests/helpers/fake-keycloak-server.ts
  - apps/backend/tests/helpers/iam-gate-harness.ts
  - apps/backend/tests/helpers/iam-live-keycloak-gate.ts
  - apps/backend/tests/helpers/iam-postgres-gate.ts
  - apps/backend/tests/helpers/iam-process-runner.ts
  - apps/backend/tests/helpers/idambox-write-discipline.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# IAM Phase 2: Code Review

## Scope and assessment

Reviewed every changed production source/script file and changed test helper in the requested directories, using the committed range `90a91942..fc183567`. The base is the merge preceding the first Phase 2 context commit, `d5b1ff36`. There are 28 production files and seven helpers; no configuration file changed in that range. Review covered changed hunks, surrounding implementation, and the ownership, provisioning, authorization and outbox call chains. Relevant integration and unit tests were read as supporting evidence.

One release-blocking contract violation and two robustness/verification defects remain. Source-target isolation and the user-first outbox serialization are otherwise coherent on inspection. This report does not establish a passing backend suite or live outage gate.

## Narrative Findings

### CR-01: Identity Provisioning can be assigned outside trusted source registration

**Severity:** BLOCKER (Critical)

**File:** `apps/backend/src/iam/identity/register-identity-writes.ts:58`

**Additional evidence:** `apps/backend/src/iam/identity/register-identity-writes.ts:122`, `:132`, `:156`–`:162`; `apps/backend/src/iam/identity/write-context.ts:107`–`:112`.

**Issue:** P2-07 reserves attachment of the Identity Provisioning Role to trusted registration/seed code and to a registered, protected source service identity. The only general `roles` refusal in `guardUser` is inside the source-authority branch. Ordinary creates and updates therefore accept that Role for an unregistered person. The post-write `isRegisteredSourceService` call checks only users already bound to a source; it returns false for an ordinary person, and the result is ignored. The inverse Role-write path similarly verifies only the service users already registered, so adding an ordinary person through `Role.idamboxUsers` is accepted. Neither path checks that a newly attached provisioning grant came from `isSourceRegistrationGrant`.

**Reproduction:** A focused in-memory execution of the actual ownership middleware, with transaction/lock plumbing replaced and Document Service reads supplying an active, unprotected manual user and no source bindings, reached `next()` for both inputs:

```ts
// Ordinary user update; the identifier represents the seeded provisioning Role.
{ uid: USER, action: "update", params: {
  documentId: "ordinary-person",
  data: { roles: ["identity-provisioning-role"] },
} }

// Ordinary inverse membership update of that Role.
{ uid: ROLE, action: "update", params: {
  documentId: "identity-provisioning-role",
  data: { idamboxUsers: ["ordinary-person"] },
} }
```

The existing ownership integration test also uses the provisioning Role as a successful ordinary roles-only edit. That exercises the gap rather than proving the dedicated-grant restriction.

**Impact:** The reserved source capability can be persisted on human and sourced-person records through ordinary administration, violating the required registration-only grant boundary. The current principal resolver still requires a valid protected service binding, so this finding does **not** demonstrate authentication as another source. The defect is the unenforced grant invariant and must be corrected before exposing the reserved provisioning operations.

**Fix:** Resolve the dedicated Role and compare effective memberships before and after both user-side and inverse Role-side relation writes. Refuse any new attachment outside the exact trusted registration grant step, and require the target's persisted protected service binding. Normalize supported `set`/`connect`/`disconnect` relation forms. Preserve legitimate analyst-role edits and same-value submissions for existing valid services. Add negative coverage for ordinary manual/sourced user creates and updates, content-manager writes, and inverse Role assignments; use a harmless ordinary Role for the existing roles-preservation tests.

### WR-01: Computed repository mutations bypass the write-discipline inventory

**Severity:** WARNING

**File:** `apps/backend/scripts/idambox-user-write-guard.ts:261`

**Additional evidence:** `apps/backend/scripts/idambox-user-write-guard.ts:265`–`:266`, `:280`–`:282`.

**Issue:** For element-access calls, the scanner obtains the method from the argument's source text instead of its resolved symbol facts. Consequently `repo[op]` becomes the method name `op`, even when `op` is the literal constant `"update"`. The mutation check misses it. The unresolved-helper check looks only for a protected persistence target in arguments, so it also misses this call when the protected target is the receiver and the argument is an ordinary data object. This defeats the required fail-closed inventory for unresolved helpers on the user persistence path.

**Reproduction:** Loaded the current scanner in memory and created virtual TypeScript programs, without writing a fixture or invoking the backend suite:

```ts
declare const strapi: any;
const repo = strapi.db.query("api::idambox-user.idambox-user");
const op = "update";
repo[op]({ data: {} }); // Inventory returns [].
```

The control case using `.update({ data: {} })` produced a violation. An unresolved `repo.customWrite({ data: {} })` also returned an empty inventory, confirming the receiver-only gap.

**Impact:** A low-level user mutation introduced using a computed method can pass the production source inventory and bypass ownership/provisioning middleware. No such production bypass was found in the reviewed changes. Runtime discipline instrumentation is test-only and does not protect arbitrary future paths merely because the source inventory passes.

**Fix:** Resolve computed member names through the existing symbol/fact machinery and inspect every possible literal mutation name. Fail closed on unresolved calls whose receiver carries a protected database persistence target, while retaining explicit safe reads and Document Service allowances. Add virtual fixtures for constant/computed member access and unresolved receiver-bound helpers.

### WR-02: Worker shutdown has no bound while database coordination is blocked

**Severity:** WARNING

**File:** `apps/backend/src/iam/keycloak-sync/worker.ts:86`

**Additional evidence:** `apps/backend/src/iam/keycloak-sync/worker.ts:20`, `:24`–`:25`, `:37`–`:38`; `apps/backend/src/iam/identity/user-lock.ts:12`.

**Issue:** `stopKeycloakSyncWorker` aborts the controller and then awaits `worker.inFlight` without a deadline. The controller bounds remote revocation calls, but neither the claim transaction nor the user-lock query receives it. The remote attempt deadline is constructed only after database locking and deciding reads. A worker waiting in `SELECT ... FOR UPDATE`, an outbox conditional update, or another stalled database operation therefore prevents `destroy()` from completing despite the advertised bounded shutdown. PostgreSQL row-lock waits have no timeout configured by this path; connection acquisition timeout does not bound a query on an acquired connection.

**Reproduction:** An in-memory execution of the actual worker with a deferred claim dependency showed that shutdown remained pending after abort and completed only when the claim dependency was released. Source inspection establishes the same missing cancellation at the real user-row lock.

**Impact:** A long-lived competing database transaction can stall graceful shutdown and delay subsequent lifecycle cleanup. Durable lease recovery remains available after process termination, but the promised bounded in-flight teardown is absent.

**Fix:** Bound database coordination as well as network work. Use transaction-local lock/statement timeouts or cancellable queries for the worker, check cancellation between coordination steps, and ensure timed-out transactions are rolled back before destroying database resources. Add a shutdown test that holds a real user lock in another PostgreSQL connection and verifies bounded teardown with recoverable durable work. A bare `Promise.race` that leaves database work running is insufficient.

## Security and correctness coverage

| Area | Assessment from source and supporting tests |
| --- | --- |
| Source reads and one-time claims | Read/list share source-scoped, unprotected, nontombstoned filters, including counts. P2-13 explicitly permits read-only correlation of unowned manual users. Only replacement with an explicit documentId can claim; target ownership/protection is re-read under the user lock. PATCH/deactivation cannot claim. |
| Protected users and source ownership | Source writes reject protected targets. The complete ownership tuple and exact source key remain immutable after claim. Tombstones stay reserved and hidden. Projection uses an allowlist and omits private ownership digests and credentials. |
| HR field refusal | Always-on middleware rejects differing source-owned fields for ordinary administration and content-manager writes; role edits remain separate. Trusted linkage is restricted to subject/password cleanup and still crosses the ownership boundary. |
| Birthright and service isolation | New sourced people are created with no explicit Roles and receive implicit Requestor access. Existing manual-human birthright is retained for backward compatibility, as P2-08 requires. Persisted service bindings suppress service birthright and human selectors. Dedicated Role attachment has the CR-01 gap. |
| Passwords and deletion | Source DTOs refuse password/Role/ownership-field inputs. Enabled human provisioning strips transient passwords and uses nested Document Service cleanup. Source deletion sets inactive/tombstone rather than hard-deleting; sourced/protected/service users and users retaining outbox work cannot be hard-deleted. Legacy manual off-mode behavior remains. |
| Leaver during remote outage | Effective-inactive updates skip remote provisioning and atomically enqueue work after persistence in the same transaction. Enqueue errors propagate for rollback. Authorization reloads active status on the next request. Creates/reactivation remain blocking when enabled. |
| Claim, fencing and reactivation | Claim eligibility is a conditional update using database time, generation and fresh owner. Worker commits the claim separately, takes the user lock before the outbox, renews with an unexpired fence, and revalidates inactivity/subject before remote calls. Reactivation shares the user lock and cancels pending work transactionally. A lost fence cannot complete/retry work. |
| Retry and recovery | Disable then logout must both succeed; missing remote subjects are safe no-ops. Partial failure retries the pair with safe error codes and capped exponential backoff/jitter. Worker configuration validates remote attempt/lease headroom; database/shutdown waiting has WR-02. |
| Existing CSRM grants and endpoints | Semantic comparison against the phase base found zero changes to existing Role, Function and FunctionApi entries. Additions are one Role, one Function and 21 reserved FunctionApis. Executable/reference catalogue copies match. No route file changed in scope; the two new collections contain schemas only. Active-human authorization and selector behavior retain existing contracts. |
| Test helpers and write discipline | Reviewed isolation, child lifecycle, fake disable/logout/session behavior, virtual inventory fixtures and runtime persistence instrumentation. The shared-PostgreSQL helper exercises separate processes, stale fences, death/replay and reactivation interleavings. Its existence is not evidence of a gate run in this review; WR-01 limits the source guard's assurance. |

## Validation and limits

- Performed read-only Git range/diff inspection and semantic catalogue comparison.
- Ran only short in-memory probes for middleware admission, scanner detection and worker shutdown. These did not boot Strapi, persist records, contact Keycloak, start containers, compile the application, or modify source/test files.
- Did not run the backend suite or either live gate. The backend suite already running elsewhere is outside this report; no pass/fail result is inferred from it.
- Reviewed the existing PostgreSQL evidence as prior evidence, not as a newly reproduced result. PostgreSQL datetime coordination assumes every Strapi instance sharing the database uses the same process time zone; the existing evidence documents this prerequisite and recommends UTC. No new MySQL support claim is made.
- The only intended workspace write is this report. No fixes, staging, commits, or other Git writes were performed.

**Disposition:** Address CR-01 before release; address WR-01 and WR-02 to restore the intended verification and shutdown guarantees. Required live/suite gates remain separate completion criteria.


## Fixes

### CR-01

User writes compare canonical effective Role memberships across ids/documentIds, objects, arrays and `set`/`connect`/`disconnect`. A new dedicated grant requires the exact trusted registration step, a protected persisted user and one persisted source binding. Inverse Role writes check membership before persistence and validate dedicated members afterwards, including Role creates/Function changes. Post-write service results are enforced; valid same-value submissions pass and service Role removal remains forbidden.

Added negative tests for manual create/update, sourced update, content-manager, inverse set/connect/numeric references and dedicated Role creation; added valid-service and disconnect controls. Both roles-preservation fixtures now use an ordinary analyst Role. The service-isolation birthright fixture also uses an ordinary Role and explicitly refuses an unbound provisioning grant. Tests first: both new reserved-grant tests failed before the fix. The first focused rerun passed 71/72; its remaining reserved-Role fixture was then corrected.

Fail-closed decision: malformed references and existing reserved memberships without a valid persisted service invariant are refused; post-write failures roll back.

### WR-01

Computed methods resolve through symbol facts, including literal unions and aliases, and every literal mutation is checked. Unknown methods on protected database receivers fail with `unresolved-helper`; safe reads and Document Service allowances remain.

Added virtual fixtures for computed constants/unions/aliases, unknown receiver helpers, unresolved computed methods and safe reads. The production test enforces >100 files and <60 seconds. Fail-closed decision: ordinary data arguments do not exempt an unknown method on a protected persistence receiver.

### WR-02

Worker-only PostgreSQL claim/lock transactions use `SET LOCAL` lock and statement timeouts: `max(1, min(1000, floor((leaseMs - attemptMs) / 16)))` milliseconds. Cancellation checks between coordination steps force normal transaction rollback. Ordinary user writes receive no timeout options. Shutdown waits at most this budget plus 1000 milliseconds (at most 2000); a stopped worker stays registered until settlement, preventing overlap after a stalled dependency or connection acquisition.

Added unit tests for stalled-claim teardown, overlap prevention, idle shutdown/restart, worker-only timeout SQL and cancellation/timeout rollback. Shutdown integration now expires/replays the retained lease. The two-process PostgreSQL helper now holds a user lock, stops the worker, verifies its lock wait ended within the teardown bound and then recovers the work. That live gate was not run.

Fail-closed decision: cancellation rolls back rather than acknowledging or persisting a retry. Uncommitted claims remain pending; committed claims recover through lease expiry.

### Fix verification

- `pnpm --dir apps/backend exec tsc --pretty false`: final run exit 0, no diagnostics.
- `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false`: final run exit 0, no diagnostics.
- Requested 22-file run using `node --test --test-concurrency=1 --test-timeout=600000`: 286 tests, 285 passed, 1 failed, 0 cancelled/skipped/todo. The failure was the obsolete service-isolation fixture granting the reserved Role to an unbound person; that fixture was corrected as described above.
- Final rerun with the same runner options: `iam-gates.unit`, `iam-keycloak-sync-worker.unit`, `iam-keycloak-sync.integration` and `iam-service-isolation.integration`: 51 tests passed, 0 failed/cancelled/skipped/todo, exit 0. This includes the additional idle shutdown/restart test and the strengthened compiled gate helper.
- Latest per-file results: 22 files, 287 distinct tests passed (236 from the other 18 files plus the final 51-test rerun); no unresolved failures. The 22-file set comprised all 14 IAM test files, both provisioning tests, both identity tests, both administration tests, contract-catalogue integration and served-operations integration. Worker and outbox paths are covered by the sync unit/integration files.
- Production inventory: 250 files, 7853 ms, no violations, below the 60-second bound.
- `git diff --check`: exit 0.
- Detailed runner output is retained locally at `apps/backend/.tmp/iam-review-verification.log` and `apps/backend/.tmp/iam-review-final-rerun.log`; the selected file list is in `apps/backend/.tmp/iam-review-test-files.txt`.

 No content-type schema, catalogue copy or OpenAPI contract was changed. No staging, commits, Git writes, Docker startup, live gate execution or full backend-suite invocation was performed.
