---
phase: "02"
workstream: iam
slug: identity-model-and-leaver-safe-keycloak-sync
status: secured
verdict: SECURED
register_authored_at_plan_time: true
threats_total: 22
threats_closed: 22
threats_open: 0
asvs_level: 1
security_block_on: high
created: "2026-10-15"
audited_head: 58e9f1eadb8945fce5b9408b242cca181fe8655d
---

# Phase 02 — Security

**Verdict: SECURED.** All declared implementation controls were found in committed code. T-02-28 was open at audit time pending the final full backend-suite result; it closed on 2026-10-15 with `02-GATE-EVIDENCE.md`: the full suite exited 0 (1803 tests, 1802 pass, 0 fail, 1 platform skip), the recorded ECONNRESET baseline failure was fixed at its cause rather than accepted, and the live Keycloak outage and two-process PostgreSQL gates passed after the review fixes.

## Scope and method

Audited all 13 plan-time threat models in `02-01-PLAN.md` through `02-13-PLAN.md`: 34 entries, 22 distinct IDs. T-02-SC occurs in every plan with the same mitigation and is counted once. All dispositions are `mitigate`. All 13 summaries were read; none contains an explicit `## Threat Flags` section. Their failures, pending gates and subsequent corrections were considered rather than treating absence of flags as proof.

Static reading only, with recorded summary/review/PostgreSQL evidence and the orchestrator's supplied live Keycloak result. No compilation, tests, helper execution, database access, container operation, source/test changes, temporary backend writes, staging or commits were performed. The only audit write is this report. Read-only comparison with HEAD found no differences in the audited production source, test, script, package or lock files. The review report and latest plan-13 summary are working-tree evidence, separately identified from committed implementation.

`.planning/config.json` contains no security override; installed defaults are enforcement enabled, ASVS level 1 and blocking severity high. Verification was performed inline. Closures mean the declared control is present at this verification depth, supplemented by the attributed recorded results below; they do not claim fresh runtime execution or a comprehensive vulnerability scan.

## Trust boundaries

| Boundary | Required control |
| --- | --- |
| Approved schema → persistent identity data | Physical uniqueness, private fields, boot refusal on corrupt bindings. |
| Package audit → runtime driver | Exact audited driver pin and locked integrity. |
| Capability catalogue → application seed | IAM partition, unchanged human grants, unserved transport reservations. |
| Trusted registration → service identity/grant | Exact manifest and atomic create-bind-grant-verification. |
| Service binding → human access/selection | Fresh persisted exclusion and direct identifier refusal. |
| Source authority → Document Service mutation | Instance-bound capability, field allowlist, user lock before deciding reads. |
| Source read/claim → identity ownership | Scoped projection, explicit replacement claim, immutable tuple and conflict rollback. |
| User transaction → durable revocation work | No remote call for existing inactive writes; enqueue in the same transaction. |
| Queue lease → remote account/session | Database-time owner/generation/expiry fence, current user check, bounded retry/shutdown. |
| Application persistence → framework persistence | Semantic inventory and exact test-only framework permits. |
| Gate execution → phase acceptance | Isolated processes, sanitized outcomes, restoration and actual suite evidence. |

## Threat register

Paths are repository-relative. Each `path:line` identifies the implemented control, not merely its declaration in a plan. Plan numbers identify all originating registers.

| Threat ID | Plans | Category | Component | Severity | Disposition | Status | Mitigation and evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-02-01 | 01 | Tampering | Schema sync and relation indexes | high | mitigate | CLOSED | Four metadata-derived unique targets at `apps/backend/src/iam/identity/database-invariants.ts:46`; duplicate/inconsistent rows refused at `:60`; install and reassert after sync at `:96`, wired before seeds at `apps/backend/src/index.ts:49`. Fresh/reused physical-index and duplicate-race passes: `02-POSTGRES-EVIDENCE.md:17` and `:33`. |
| T-02-02 | 01 | Information Disclosure | New content types | high | mitigate | CLOSED | Token fields private at `apps/backend/src/api/identity-source/content-types/identity-source/schema.json:15`; key private at `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json:56`; lease fields private at `apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json:21`. Both new API directories contain schemas only; no routes/controllers/services. Negative route/grant coverage at `apps/backend/tests/served-operations.integration.test.ts:640`; recorded 47-test contract/inventory pass in `02-03-SUMMARY.md`. |
| T-02-SC | 01–13 | Tampering | Dependency supply | high | mitigate | CLOSED | Exact `pg` 8.23.1 pin at `apps/backend/package.json:30`, importer at `pnpm-lock.yaml:52`, audited integrity at `pnpm-lock.yaml:7043`. Recorded legitimacy audit and exact driver resolution at `02-02-SUMMARY.md:32`; semantic dependency comparison at `:46` records only pg plus its 13 transitive packages and necessary peer-context changes. No unrelated upgrade is inferred from peer-key churn. |
| T-02-03 | 02 | Tampering | PostgreSQL driver dependency | high | mitigate | CLOSED | Exact runtime pin and integrity at `apps/backend/package.json:30` and `pnpm-lock.yaml:7043`; recorded official package audit and backend/Knex resolution at `02-02-SUMMARY.md:32` and `:38`. |
| T-02-05 | 03 | Tampering | Catalogue seed | high | mitigate | CLOSED | Functions partitioned by Application at `apps/backend/src/bootstrap/seed-csrm-data.ts:913`; reservations/grant isolation tested at `apps/backend/tests/served-operations.integration.test.ts:640` and `:672`. Both catalogue copies have identical SHA-256 `AE9639CE89282D2F760D0BE786CD924561828CD10495105F92FA11FD7369FF03`. `02-03-SUMMARY.md` records zero changes to the prior three Roles, 62 Functions and 143 FunctionApis and explicit unserved Phase 3 reasons. |
| T-02-04 | 04 | Elevation of Privilege | Source registration context | high | mitigate | CLOSED | Exact manifest validation at `apps/backend/src/iam/identity/write-context.ts:92`; transaction, collision refusal, create-bind-grant and final invariant at `:135`. Initial-create matching at `:179`. Dedicated grants now require exact trusted grant plus protected persisted binding at `apps/backend/src/iam/identity/register-identity-writes.ts:80`; inverse/post-write checks at `:214` and `:227` close CR-01. Registration and grant negative results are recorded in `02-04-SUMMARY.md` and `02-REVIEW.md` fixes. |
| T-02-07 | 05 | Elevation of Privilege | Requestor birthright | high | mitigate | CLOSED | Persisted binding lookup at `apps/backend/src/iam/identity/source-principal.ts:26` applies even to inactive/malformed services. Fresh active-user read and service birthright suppression at `apps/backend/src/policies/csrm-authorization.ts:253` and `:262`; all CSRM access refused for services at `:370`; human analyst predicate excludes services at `:317`. Human/protected-human regressions recorded in `02-05-SUMMARY.md`; corrected service fixture and final 51-test rerun in `02-REVIEW.md`. |
| T-02-08 | 06 | Information Disclosure | People selectors | medium | mitigate | CLOSED | All bindings paged at `apps/backend/src/iam/identity/source-principal.ts:31`; excluded before candidate limits at `apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts:326` and `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:274`. Submitted services refused at `request-assignment.ts:205`, `risk-workflow.ts:74`, `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts:120` and `apps/backend/src/api/csrm-administration/services/administration-repository.ts:133`. `02-06-SUMMARY.md` establishes these selectors have bounded lists without total counts; ordinary entity counts/historical labels retain their contracts. |
| T-02-10 | 07 | Spoofing | Write contexts and source authority | high | mitigate | CLOSED | Private storage, active-context expiry and exact operation/target/field matching at `apps/backend/src/iam/identity/write-context.ts:26`, `:29` and `:50`; fresh principal validation at `:41` and in the locked guard at `apps/backend/src/iam/identity/register-identity-writes.ts:94`. Issued-object/instance binding and fresh persisted invariant at `apps/backend/src/iam/identity/source-principal.ts:70`. Concurrent/detached-context refusal recorded in `02-07-SUMMARY.md`. |
| T-02-11 | 07 | Tampering | Ownership reads and inverse grants | high | mitigate | CLOSED | Transaction-bound lock precedes deciding reads at `apps/backend/src/iam/identity/register-identity-writes.ts:164`; row lock at `apps/backend/src/iam/identity/user-lock.ts:31`. Ownership/HR changes refused at `register-identity-writes.ts:113` and `:125`; inverse/service catalogue checks at `:208`. CR-01 inverse attachment/create checks at `:214` and `:227`. Actual shared-lock interleavings recorded at `02-POSTGRES-EVIDENCE.md:72`. |
| T-02-13 | 08 | Information Disclosure | Read/list/count projection | high | mitigate | CLOSED | Allowlisted projection at `apps/backend/src/iam/identity/identity-service.ts:10` and `:20`; source/protection/tombstone scope at `:25`; shared filters applied before count and page at `:95`, read scope at `:83`. Unowned manual records are intentionally visible for read-only correlation under the approved contract; another source's records remain excluded. Scoped negative results recorded in `02-08-SUMMARY.md`. |
| T-02-14 | 08 | Tampering | Manual claim and source tuple | high | mitigate | CLOSED | Only replacement with explicit string documentId admits a manual target, under shared lock, at `apps/backend/src/iam/identity/identity-service.ts:143` and `:148`; PATCH refuses manual targets at `:128`. Immutable tuple/digest at `apps/backend/src/iam/identity/register-identity-writes.ts:138`; unique conflict translation after rollback at `identity-service.ts:65`. Duplicate and blocking-write rollback gate evidence at `02-POSTGRES-EVIDENCE.md:62` and `:71`. |
| T-02-16 | 09 | Information Disclosure | Transient password and linkage | high | mitigate | CLOSED | Original password validated before deletion at `apps/backend/src/keycloak/register-idambox-user-provisioning.ts:65`; transient local passed only to provisioner at `:90`; trusted Document Service cleanup at `:99` and `apps/backend/src/iam/identity/write-context.ts:59`. Source-service password refused before omission at `apps/backend/src/iam/identity/register-identity-writes.ts:177`. Enabled/off-mode and cleanup evidence in `02-09-SUMMARY.md` explicitly preserves legacy off-mode behavior. |
| T-02-17 | 09 | Denial of Service | Leaver commit and enqueue | high | mitigate | CLOSED | Effective-inactive existing update returns before any remote provisioning at `apps/backend/src/keycloak/register-idambox-user-provisioning.ts:78`; outbox enqueue after persistence within user transaction at `apps/backend/src/iam/identity/register-identity-writes.ts:183` and `:190`; failures propagate. Fresh inactive refusal at `apps/backend/src/policies/csrm-authorization.ts:258`. Recorded rollback at `02-POSTGRES-EVIDENCE.md:71`; orchestrator live inactive-refusal/outage-retry/recovery passes recorded below. |
| T-02-19 | 10 | Tampering | Lease and reactivation race | high | mitigate | CLOSED | Short conditional claim commits separately at `apps/backend/src/iam/keycloak-sync/outbox.ts:91`; current database-time fence at `:119`; worker user-first transaction, renewed fence and status/subject recheck at `apps/backend/src/iam/keycloak-sync/worker.ts:40`. Reactivation cancels before blocking enable at `apps/backend/src/iam/identity/register-identity-writes.ts:180`; owner/generation cancellation at `outbox.ts:158`. Fresh/reused race, expiry and replay results at `02-POSTGRES-EVIDENCE.md:65` through `:69`. |
| T-02-20 | 10 | Denial of Service | Remote delivery and shutdown | high | mitigate | CLOSED | Whole-attempt deadline at `apps/backend/src/iam/keycloak-sync/worker.ts:56`; per-call bound at `apps/backend/src/keycloak/admin-client.ts:120`; capped perpetual retry at `apps/backend/src/iam/keycloak-sync/outbox.ts:147`. WR-02 adds native PostgreSQL lock/statement timeouts at `apps/backend/src/iam/identity/user-lock.ts:15`, cancellation/rollback at `:41`, bounded stop and overlap prevention at `worker.ts:105` and `:80`. Fix unit/integration passes recorded in `02-REVIEW.md`. New real held-lock scenario at `apps/backend/tests/helpers/iam-postgres-gate.ts:189` has no recorded live run; prior PostgreSQL evidence does not prove that new scenario. Closure is static control presence plus targeted recorded evidence, not new live shutdown proof. |
| T-02-22 | 11 | Tampering | Gate evidence and environment | high | mitigate | CLOSED | Isolated database restrictions at `apps/backend/tests/helpers/iam-gate-harness.ts:105` and `:130`; distinct OS/database connection identities at `:118`; fresh/reused staged assertions and pass emission only after completion at `apps/backend/tests/helpers/iam-postgres-gate.ts:48` and `:63`. Actual isolated two-process fresh/reused results at `02-POSTGRES-EVIDENCE.md:15` and `:32`, not SQLite substitutes. |
| T-02-23 | 11 | Information Disclosure | IPC and evidence | medium | mitigate | CLOSED | Closed safe evidence keys/types at `apps/backend/tests/helpers/iam-gate-harness.ts:137`; sanitized failure class at `:10`; named child command dispatch and failure without body at `apps/backend/tests/helpers/iam-process-runner.ts:344` and `:346`. Live errors reduced to closed stages at `apps/backend/tests/helpers/iam-live-keycloak-gate.ts:105`. Recorded PostgreSQL evidence contains safe stages, identifiers and booleans; helper redaction tests recorded in `02-11-SUMMARY.md` and `02-13-SUMMARY.md`. |
| T-02-25 | 12 | Elevation of Privilege | Aliased/generic/inverse write paths | high | mitigate | CLOSED | Type/provenance inspection, computed symbol facts and all possible mutation names at `apps/backend/scripts/idambox-user-write-guard.ts:261`; unknown protected receivers fail closed at `:285`; non-vacuous production inventory at `:297`. Direct/alias/raw/unresolved fixtures at `apps/backend/tests/iam-write-discipline.unit.test.ts:25`; runtime bypass matrix at `apps/backend/tests/iam-write-discipline.integration.test.ts:107`. WR-01 committed; final 250-file zero-violation inventory recorded in `02-REVIEW.md`. |
| T-02-26 | 12 | Tampering | Runtime persistence permit | high | mitigate | CLOSED | Test-only exact framework entry/action/UID matching at `apps/backend/tests/helpers/idambox-write-discipline.ts:97`; target/field permit at `:129`; expiry at `:132`; lifecycle clears authority at `:80`; compiled-query permit/target checks at `:220`. Runtime refusal inside middleware/transactions/lifecycles at `apps/backend/tests/iam-write-discipline.integration.test.ts:107`. `02-12-SUMMARY.md` records 49 passing checks, real source coverage and a failing deliberate production mutation probe. Instrumentation is a test boundary, not a production access-control substitute. |
| T-02-28 | 13 | Repudiation | Gate evidence and baseline status | high | mitigate | CLOSED | Named outcome emission follows completed assertions at `apps/backend/tests/helpers/iam-live-keycloak-gate.ts:77`, `:85` and `:100`; cleanup failure overrides success at `:116`. Closed by `02-GATE-EVIDENCE.md`: actual full-suite command, exit 0 and counts, baseline failure resolved at its cause (`fc183567`), live outage and PostgreSQL gate stage results recorded from execution. |
| T-02-29 | 13 | Denial of Service | Live outage helper | medium | mitigate | CLOSED | Per-stage deadline at `apps/backend/tests/helpers/iam-live-keycloak-gate.ts:77`; restoration required before stop at `:92`; independent finally restore/cleanup budgets at `:106`; only owned fixtures cleaned at `:330`; reserved total cleanup budget at `:348`. Fixed compose service/action boundary at `apps/backend/tests/helpers/iam-gate-harness.ts:24`. Orchestrator reports all nine live stages passed, including restore and cleanup. |

## Recorded evidence and review fixes

- **PostgreSQL:** `02-POSTGRES-EVIDENCE.md:3` attributes the 2026-10-15 runs to the orchestrator. Fresh/reused schemas passed in Australia/Sydney and UTC process zones. The common process-time-zone prerequisite remains: all instances sharing a database must use the same zone, preferably UTC (`apps/backend/src/iam/keycloak-sync/outbox.ts:24`). No MySQL verification claim is made. The recorded stage list predates the new held-lock shutdown case.
- **Live Keycloak:** the orchestrator explicitly supplied today's successful run of the compiled `tests/helpers/iam-live-keycloak-gate.js`. Setup, session, stop, inactive-refusal, outage-retry, start, recovery, restore and cleanup all passed. This is accepted orchestrator evidence, not a run performed by this audit. It supersedes the summary's pending-live statement for that gate only. No raw log, credentials or remote response bodies were supplied or reproduced here.
- **CR-01:** committed in `cf557fae`; exact reserved-grant and inverse-membership checks are present in `register-identity-writes.ts:80`, `:214` and `:227`. The old finding is closed for this register.
- **WR-01:** committed in `f9abf97f`; computed methods and unresolved protected receivers are covered by `idambox-user-write-guard.ts:263` and `:285`.
- **WR-02:** committed in `58e9f1ea`; worker coordination is transaction-locally bounded, abort checks lead to rollback, and stop is bounded while retaining the stopped-worker entry until settlement. The live held-lock test's missing run is retained as a verification limit.
- **Targeted fix results:** `02-REVIEW.md` records 287 distinct passing tests across the selected 22 files after fixture correction, a final 51-test rerun, and a 250-file inventory with no violations. Earlier failed runs remain recorded. These are attributed prior results, not a full-suite pass.

## Open threat and closure requirement

**T-02-28 is open and blocks advancement.** Record the running suite's actual final command, exit status, total/pass/fail/skip/cancel counts and named failures, then compare with the recorded baseline. Do not relabel a baseline failure as green or substitute predicted/targeted results. Complete the consolidated gate evidence required by plan 02-13 and reconcile its pending summary. If the suite remains non-green, retain the failed required criterion and obtain an explicit disposition; none is accepted by this report. Reverify the threat after the evidence is available. This audit does not start another suite.

## Accepted risks log

No accepted risks. No mitigation was replaced with an assumed acceptance or transfer.

## Security audit trail

| Audit date | Register entries | Distinct threats | Closed | Open (blocking) | Open (non-blocking) | Method |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-15 | 34 | 22 | 21 | 1 | 0 | Static committed-code verification and attributed recorded evidence |

## Sign-off

- [x] All 13 plan registers covered, including every repeated T-02-SC entry.
- [x] Every threat has a disposition and file:line mitigation evidence or an explicit gap.
- [x] Review fixes checked in committed implementation.
- [x] Recorded and orchestrator-supplied live evidence attributed separately.
- [x] `threats_open: 0` confirmed (2026-10-15, after `02-GATE-EVIDENCE.md`).
- [ ] Final suite/baseline gate reconciled.
- [ ] Security status verified; phase advancement permitted.

**Approval:** blocked pending T-02-28 evidence. No phase-completion or release approval is given.

## Closure (2026-10-15)

T-02-28 closed by `02-GATE-EVIDENCE.md`. All 22 threats are closed; nothing is open, blocking or non-blocking.
