---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
workstream: iam
verified: 2026-10-19T10:25:00Z
head: 0073e353
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-01-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-01-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-02-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-02-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-03-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-03-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-04-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-04-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-05-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-05-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-06-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-06-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-07-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-07-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-08-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-08-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-09-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-09-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-10-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-10-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-11-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-11-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-12-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-12-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-13-PLAN.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-13-SUMMARY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-GATE-EVIDENCE.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-POSTGRES-EVIDENCE.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-REVIEW.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-SECURITY.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-UAT.md"
  - ".planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-VALIDATION.md"
  - "apps/backend/package.json"
  - "apps/backend/scripts/idambox-user-write-guard.ts"
  - "apps/backend/src/api/csrm-administration/services/administration-repository.ts"
  - "apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts"
  - "apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts"
  - "apps/backend/src/api/csrm-risk/services/risk-workflow.ts"
  - "apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json"
  - "apps/backend/src/api/identity-source/content-types/identity-source/schema.json"
  - "apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json"
  - "apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json"
  - "apps/backend/src/bootstrap/seed-csrm-data.ts"
  - "apps/backend/src/bootstrap/seed-iam-data.ts"
  - "apps/backend/src/csrm/people/eligible-person.ts"
  - "apps/backend/src/iam/identity/database-invariants.ts"
  - "apps/backend/src/iam/identity/identity-input.ts"
  - "apps/backend/src/iam/identity/identity-service.ts"
  - "apps/backend/src/iam/identity/keycloak-linkage.ts"
  - "apps/backend/src/iam/identity/register-identity-writes.ts"
  - "apps/backend/src/iam/identity/source-principal.ts"
  - "apps/backend/src/iam/identity/source-registration.ts"
  - "apps/backend/src/iam/identity/user-lock.ts"
  - "apps/backend/src/iam/identity/write-context.ts"
  - "apps/backend/src/iam/keycloak-sync/config.ts"
  - "apps/backend/src/iam/keycloak-sync/outbox.ts"
  - "apps/backend/src/iam/keycloak-sync/worker.ts"
  - "apps/backend/src/index.ts"
  - "apps/backend/src/keycloak/admin-client.ts"
  - "apps/backend/src/keycloak/register-idambox-user-provisioning.ts"
  - "apps/backend/src/policies/csrm-authorization.ts"
  - "apps/backend/tests/ai-run-boot.unit.test.ts"
  - "apps/backend/tests/analyst-insight-authorization.unit.test.ts"
  - "apps/backend/tests/authorization-policy.unit.test.ts"
  - "apps/backend/tests/fixtures/authorization.ts"
  - "apps/backend/tests/helpers/fake-keycloak-server.ts"
  - "apps/backend/tests/helpers/iam-gate-harness.ts"
  - "apps/backend/tests/helpers/iam-live-keycloak-gate.ts"
  - "apps/backend/tests/helpers/iam-postgres-gate.ts"
  - "apps/backend/tests/helpers/iam-process-runner.ts"
  - "apps/backend/tests/helpers/idambox-write-discipline.ts"
  - "apps/backend/tests/helpers/strapi-http-harness.ts"
  - "apps/backend/tests/iam-database-invariants.integration.test.ts"
  - "apps/backend/tests/iam-gates.unit.test.ts"
  - "apps/backend/tests/iam-human-selectors.integration.test.ts"
  - "apps/backend/tests/iam-identity-input.unit.test.ts"
  - "apps/backend/tests/iam-identity.integration.test.ts"
  - "apps/backend/tests/iam-keycloak-client.unit.test.ts"
  - "apps/backend/tests/iam-keycloak-sync-worker.unit.test.ts"
  - "apps/backend/tests/iam-keycloak-sync.integration.test.ts"
  - "apps/backend/tests/iam-ownership.integration.test.ts"
  - "apps/backend/tests/iam-schema-contract.unit.test.ts"
  - "apps/backend/tests/iam-service-isolation.integration.test.ts"
  - "apps/backend/tests/iam-source-registration.integration.test.ts"
  - "apps/backend/tests/iam-write-discipline.integration.test.ts"
  - "apps/backend/tests/iam-write-discipline.unit.test.ts"
  - "apps/backend/tests/keycloak-identity.integration.test.ts"
  - "apps/backend/tests/keycloak-identity.unit.test.ts"
  - "apps/backend/tests/keycloak-provisioning.integration.test.ts"
  - "apps/backend/tests/keycloak-provisioning.unit.test.ts"
  - "apps/backend/tests/served-operations.integration.test.ts"
  - "apps/backend/types/generated/contentTypes.d.ts"
  - "docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md"
  - "docs/contract-gaps/iam-identity-model-and-leaver-sync.md"
  - "docs/references/idambox-csrm-role-function-api-catalogue.json"
  - "docs/references/served-operations.json"
covered_digest: "v2:sha256:44269539accd141a511d99136eedb93100303ba532f6a4c79d00fa24436285c4"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Identity model and leaver-safe Keycloak sync Verification Report

**Phase Goal:** The shared backend knows which Identity Source owns each IdamBox User and enforces that ownership, and a leaver's deactivation commits in Strapi even while Keycloak is unavailable.
**Verified:** 2026-10-19 (against HEAD `0073e353`)
**Status:** passed
**Re-verification:** No. This is the first VERIFICATION.md for this phase. The phase was executed and gated on 2026-10-15 at `58e9f1ea`. This verification runs against current HEAD, after Phase 3 to 5 and other workstreams' commits.

## Method

The SUMMARY files were not taken as evidence. I read these directly: the three content-type schemas, the contract-gap record, ADR 0002, both catalogue copies, `src/iam/identity/*`, `src/iam/keycloak-sync/*`, the Keycloak provisioning middleware, `csrm-authorization.ts`, the IAM seed, `src/index.ts` wiring, the write-guard script, and the Phase 2 test files. I ran these in this verifier's own process at HEAD:

- **Unfiltered `ENV_PATH=/nonexistent pnpm --dir apps/backend test`** (so only committed defaults applied): exit 0, **2577/2577 pass, 0 fail, 0 cancelled, 0 skipped**, 3240 s of test time and 54 min wall time (09:18 to 10:12 UTC). The maintenance-switch guard, the source `tsc` and the unfiltered test `tsc -p tests/tsconfig.json` all passed first. The POSIX-mode test that was a platform skip at the Windows gate ran and passed on this macOS host.
- **The 18 Phase 2 test files, each run on its own** with `node --test --test-concurrency=1 --test-timeout=600000`: **217/217 pass, 0 fail, 0 skipped** (per-file counts are in Behavioral Spot-Checks).
- **Compatibility** (`contract-catalogue`, `served-operations` and `authorization-matrix` integration tests): **238/238 pass, 0 skipped**.
- **`node .tmp/tests-dist/scripts/idambox-user-write-guard.js --check`** on `apps/backend/src`: exit 0, "IdamBox user write inventory passed". The unit-suite copy of the same check covered 313 files.
- **Static comparisons:** the landed schemas against the approved record field by field; the catalogue before and after Phase 2 (`90a91942` against `58e9f1ea`); the two catalogue copies (`cmp`: identical); the git history of the approval and the schema commit; and every change to Phase 2 code after the gate (`58e9f1ea..HEAD`).

I did not start Docker, Keycloak, PostgreSQL or Strapi servers. I did not run the deliberate write-guard probe, because it edits a source file. The two live-only gates are judged from the published evidence plus today's human UAT, and I say so wherever they are used:

- the live Keycloak outage and recovery (`02-GATE-EVIDENCE.md` §3, UAT item 5);
- the two-process PostgreSQL gate (`02-POSTGRES-EVIDENCE.md`, `02-GATE-EVIDENCE.md` §4, UAT item 6).

The UAT passed 18/18 on 2026-10-19.

## Goal Achievement

### Observable Truths (roadmap success criteria, the contract)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | **Approval checkpoint:** a `docs/contract-gaps/` record for `IdentitySource`, the new `IdamBoxUser` fields and `KeycloakSyncOutbox` names `csrm` as a reader of `IdamBoxUser`, is checked against the JDL and `CONTEXT.md` terms, and is approved before any content-type change. The landed schema matches the approved record | ✓ VERIFIED | **Record and readers:** `docs/contract-gaps/iam-identity-model-and-leaver-sync.md` uses the `iam-` prefix the roadmap notes ask for. Its "Gap and domain check" section checks the frozen JDL and `CONTEXT.md` terms, and "Affected workstreams" names `csrm` as a reader of IdamBoxUser. The record carries "Approved by the operator on 2026-10-14", and its Approval section lists `csrm` as a reader.<br>**Order:** git history shows approval commit `a92bcc88` (2026-10-14 08:28 +1100) before the only schema commit `d2caa1c0` (2026-10-14 10:05 +1100).<br>**Schema match:** each attribute of `identity-source/schema.json`, `keycloak-sync-outbox/schema.json` and the nine new `idambox-user` attributes matches the record's tables exactly: types, required, unique, private, min/max lengths, enums, defaults, relation kinds and one-way relations with no inverse. Draft & Publish is off and no localization is set.<br>**No later change:** the three schemas are unchanged from `d2caa1c0` to HEAD.<br>**Tests passed here:** `iam-schema-contract.unit` ("… matches every approved attribute and collection option", "internal collections introduce no content API router"), 4/4. |
| 2 | The dev seed registers "midPoint (dev)" with its own non-human service identity, which holds only the Identity Provisioning Function in both catalogue copies. Every IdamBox User reads as sourced (Identity Source and source key) or manual, and as protected or not. Existing users read as manual and unprotected, with CSRM access unchanged | ✓ VERIFIED | **Seed:** `seed-iam-data.ts` runs only when `NODE_ENV=development` and `IDAMBOX_SEED_IAM=true` (`.env.example:137` is `false`). It calls `registerIdentitySource` with "midPoint (dev)" / `midpoint-dev-provisioning`, and `index.ts:66` calls it in bootstrap.<br>**Atomic registration:** `runSourceRegistration` (`write-context.ts`) runs under the user lock in one transaction. It creates a protected, active, manual user with no password and no subject, binds the source, grants exactly the role whose single Function is "Identity Provisioning" under active `idambox-iam` with no menuPath, then re-asserts the full invariant. A rerun reuses the source or refuses a collision.<br>**Catalogue:** both copies are byte-identical. `role.identity_provisioning` has `functionIds: ["function.identity_provisioning.api"]` only, and that Function's only role is that Role.<br>**Sourced or manual, protected or not:** `identitySource`, `sourceExternalId`, `sourceIdentityKey` and `protected` (required, default false) are present. A partial tuple is refused (`register-identity-writes.ts` `IAM_IDENTITY_INVALID_INPUT`).<br>**Service users get no human access:** `csrm-authorization.ts:379` gives them no Requestor birthright, and `:486` refuses them CSRM access. They are excluded from human selectors and owner and assignee writes (request-assignment, risk-workflow, control-implementation, administration-repository).<br>**Tests passed here:** "legacy schema migration preserves identity, roles and CSRM references" (asserts `protected` false, every source field null, roles and requestor references kept); "opt-in seed, token/activity preservation and restart do not modify people"; "registration, rollback and collision safety …"; "protected humans and ordinary role holders retain human birthright; unbound provisioning grants are refused"; 7/7 `iam-human-selectors`.<br>**UAT:** items 2 and 3 passed. |
| 3 | Through the identity upsert service, a source changes only the users it owns, or an unowned and unprotected manual user it claims once. It can never read or change another source's users or a protected user. An admin's edit of a sourced user's HR-owned fields through the Strapi user APIs is refused, while role changes still succeed | ✓ VERIFIED | **Read scope:** `identity-service.ts:49` `visibleScope` filters to `protected=false`, no tombstone, and either own source or a fully manual tuple. It applies before count and paging. Writes check `accessible()` (`:91`) under `withIdentityUserLock` after a fresh `validateSourcePrincipal`.<br>**Claims:** only `replaceFromSource` with an explicit documentId can claim (`allowManual` is true only for a string target). Each operation is logged with source, service user, target and outcome (`:252`).<br>**Guard on every write:** the always-on Document Service middleware (`register-identity-writes.ts:162`, registered in `index.ts:40` whatever the provisioning flag) checks source ownership again inside the transaction. It refuses a protected target and a foreign source. It recomputes the SHA-256 tuple key and refuses any change to a sourced tuple. Without source authority, it refuses changed HR fields on a sourced user (`:134`). A role-only change passes, apart from the reserved Identity Provisioning role (CR-01).<br>**Admin path:** the core IdamBoxUser content routes are not mounted, so the Strapi admin path is the Content Manager, which goes through the Document Service and this middleware.<br>**Tests passed here:** "locked source ownership through Document Service and content-manager, provisioning=false/true", "one-time manual claims preserve roles …", "competing source claims, same-source key claims and duplicate tuples have exactly one persisted winner", "explicit PUT claims once …", "persisted principal revocation is checked on every operation", "reserved provisioning role rejects …". `iam-ownership` 11/11, `iam-identity` 8/8.<br>**UAT:** item 4 passed (live admin edit refused, role save accepted). |
| 4 | With Keycloak stopped and provisioning on, deactivating a user commits in Strapi and the person is refused on their next request. When Keycloak returns, the `KeycloakSyncOutbox` worker disables their Keycloak user and ends their sessions, and each outbox row is claimed once even with two Strapi instances. The ADR 0002 amendment records this | ✓ VERIFIED (code and tests here; live halves from published gate evidence and UAT) | **Commit with no remote call:** the provisioning middleware skips every remote call for an inactive update (`register-idambox-user-provisioning.ts:78`). The identity middleware enqueues `disableAndEndSessions` in the same transaction, under the user lock (`register-identity-writes.ts:198`, `outbox.ts:57`). Reactivation cancels old work first (`:189`).<br>**Refusal on the next request:** `csrm-authorization.ts:374` refuses any user whose status is not active, and it re-reads the user on every request.<br>**Claim and fence:** the worker (`worker.ts:30`) claims with one conditional UPDATE in its own transaction (`outbox.ts:91`). It takes the user lock and renews the claim behind a fence on id, generation, owner and lease (`:119`). It rechecks inactivity and subject before calling disable and then logout. It retries with capped exponential backoff. It is started in bootstrap and stopped in destroy (`index.ts:80,91`).<br>**ADR:** ADR 0002 has an "Amended: 2026-10-15" line and the sections "Approved existing-user deactivation exception" and "Serialized, fenced retry".<br>**Tests passed here:** "existing inactive PUT commits even when the remote server is unreachable", "an already signed-in identity is refused on the next request after internal deactivation", "simultaneous polls have one lease winner; expired restart and every stale transition are fenced", "partial disable/logout retries the complete pair …", "reactivation before/after worker lock …", "queue failure after persistence rolls back …". `iam-keycloak-sync` 17/17, `keycloak-identity.integration` 8/8.<br>**Live-only, not re-run here:** the real Keycloak outage, recovery and two-process PostgreSQL behaviour come from published evidence. `02-GATE-EVIDENCE.md` §3: live gate exit 0, all 9 stages in order, `enabled=false`, session count 0. `02-POSTGRES-EVIDENCE.md`: 31/31 stages passed on fresh and reused schemas in both time zones, including `one-claim-and-execution` and `dead-process-crash-before-ack`. UAT items 5 and 6 passed today. Those gates ran at `58e9f1ea`; `outbox.ts`, `worker.ts`, `user-lock.ts` and the schemas are unchanged since then. |
| 5 | A test fails any `IdamBoxUser` write that bypasses the Document Service (for example through `strapi.db.query`), and `pnpm --dir apps/backend test` passes with every existing `csrm` endpoint and grant unchanged | ✓ VERIFIED | **Static guard:** the AST guard `scripts/idambox-user-write-guard.ts` runs in the ordinary suite ("production src writes IdamBox users only through the Document Service", which requires more than 100 files; 313 here). Its `--check` exits 0 here. The 43/43 unit tests include deliberate direct, aliased, computed, bulk and unresolved-helper bypass fixtures.<br>**Runtime guard:** `iam-write-discipline.integration` 13/13. It rejects `strapi.db.query(USER).update`, an aliased repository, `updateMany`, the query builder, raw SQL, an inverse grant and a link-table delete. It rejects each one outside a transaction, inside a transaction, inside a middleware and inside a lifecycle hook, and checks the victim row is unchanged.<br>**Full suite:** 2577/2577 pass, 0 skipped, exit 0 (run here).<br>**CSRM grants unchanged by this phase:** the catalogue at `90a91942` and `58e9f1ea`, with IAM entries removed, is identical: 3 roles, 62 functions, 143 FunctionApis. The authorization diff changes behaviour only when `registeredSourceService` is true.<br>**Compatibility tests:** `contract-catalogue`, `served-operations` and `authorization-matrix` pass 238/238. |

**Score:** 5/5 roadmap truths verified (0 present-but-behavior-unverified)

### Plan must-haves (merged; they add detail and remove nothing)

| Plan | Must-have truths | Status | Evidence |
| ---- | ---------------- | ------ | -------- |
| 02-01 | P2-01 approval satisfied, schemas match; P2-02..06 additive fields, JDL terms kept; P2-05 real unique constraints across schema-sync restarts | ✓ VERIFIED | Truth 1. `iam-database-invariants` 5/5 here ("reused database rejects concurrent source targets, source keys and outbox keys", "a second schema-sync boot restores inverse-target indexes …", "a fresh database enforces the same physical constraints"). The PostgreSQL physical indexes come from published evidence (4 `iam_unique_*` indexes on fresh and reused schemas). |
| 02-02 | P2-25/29 pinned PostgreSQL driver | ✓ VERIFIED | `apps/backend/package.json` is in the phase diff. The `iam-gates.unit` driver and pool checks pass (27/27). The driver is exercised by the published PostgreSQL gate. |
| 02-03 | P2-08/09 catalogue partition, `idambox-iam`, no menuPath, CSRM grants kept | ✓ VERIFIED | `seed-csrm-data.ts:10,44,904` partitions the IAM Function under the `idambox-iam` Application. The catalogue diff leaves CSRM entries unchanged. Note that P2-09's "unserved" SCIM reservations were deliberately served by Phase 3 (21 FunctionApis). |
| 02-04 | P2-07 atomic registration and final invariant; P2-10 idempotent opt-in seed that never touches a token | ✓ VERIFIED | `runSourceRegistration` checks the persisted `tokenHash`, `tokenRotatedAt` and `lastActivityAt` are null on create. `iam-source-registration` 5/5. |
| 02-05 | P2-07/08 fresh principal validation; services get no Requestor or analyst access; seed runs in bootstrap with both flags off | ✓ VERIFIED | `validateSourcePrincipal` re-reads the binding on every call. `iam-service-isolation` 3/3 ("normal opt-in bootstrap reuses one source with provisioning off and on without remote calls"). |
| 02-06 | P2-08 services absent from human selectors and counts; submitted owners and assignees refused | ✓ VERIFIED | `iam-human-selectors` 7/7. |
| 02-07 | P2-05/16/17/11/12/07/19 guard after the lock; HR refusal; DTO contract; service bypass only by verified binding | ✓ VERIFIED | `register-identity-writes.ts`, `identity-input.ts`. `iam-identity-input` 7/7, `iam-ownership` 11/11. |
| 02-08 | P2-11..15 six typed methods, scope before count, one-time claim, tombstone | ✓ VERIFIED | `identity-service.ts`. `iam-identity` 8/8 ("owned deletion retains tuple, roles and references; repeated deletion is safe and cannot restore"). P2-13's full-replacement clearing was later amended by Phase 3's P3-34 (merge of asserted attributes). The Phase 2 test still passes for direct DTO replacements. |
| 02-09 | P2-26/27 nested linkage, password never kept; P2-18 atomic inactive commit and outbox; P2-19 blocking creates and reactivation; P2-20 next-request refusal | ✓ VERIFIED | `keycloak-provisioning.integration` 6/6, `keycloak-provisioning.unit` 31/31, `iam-keycloak-sync` 17/17, `keycloak-identity.integration` 8/8. |
| 02-10 | P2-21..25 conditional claim, fences, disable-then-logout, capped retry; P2-20 off mode is inert | ✓ VERIFIED | `outbox.ts`, `worker.ts`, `config.ts` (poll 5 s, lease 60 s, attempt 30 s, call ≤5 s). `iam-keycloak-client.unit` 6/6, `iam-keycloak-sync-worker.unit` 4/4. |
| 02-11 | P2-23/25/05/21/22/29/30 two-process PostgreSQL gate | ✓ VERIFIED (published evidence and UAT) | `02-POSTGRES-EVIDENCE.md` run logs; `02-GATE-EVIDENCE.md` §4, rerun after the review fixes, including the new `stop-worker-held-user-lock` stage; UAT item 6. The gate harness's own fail-closed logic is unit-tested here (`iam-gates.unit` 27/27). |
| 02-12 | P2-26/27/28/29 AST and runtime write discipline | ✓ VERIFIED | Truth 5. |
| 02-13 | ADR amendment; live outage; green suite and compatibility; schema still matches the approved record | ✓ VERIFIED | Truths 1, 4 and 5. The gate's full suite (1802 pass, 1 Windows platform skip) is superseded here by 2577/2577 with 0 skipped. |

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/api/{identity-source,keycloak-sync-outbox}/…/schema.json`, `idambox-user` schema additions | ✓ VERIFIED | Match the approved record exactly; unchanged since `d2caa1c0` |
| `docs/contract-gaps/iam-identity-model-and-leaver-sync.md` | ✓ VERIFIED | Approved 2026-10-14; names `csrm` as a reader |
| `src/iam/identity/{write-context,source-registration,source-principal,register-identity-writes,identity-input,identity-service,user-lock,database-invariants,keycloak-linkage}.ts` | ✓ VERIFIED | Substantive. Registered in `index.ts` `register` and `bootstrap`, and imported by SCIM and CSRM services |
| `src/iam/keycloak-sync/{config,outbox,worker}.ts` | ✓ VERIFIED | Worker started and stopped in `index.ts`; enqueue and cancel called from the identity middleware |
| `src/keycloak/register-idambox-user-provisioning.ts` | ✓ VERIFIED | Inactive-update skip; blocking create and update kept |
| `src/bootstrap/seed-iam-data.ts` | ✓ VERIFIED | Opt-in and called in bootstrap |
| Both role-function catalogue copies | ✓ VERIFIED | Byte-identical; Identity Provisioning isolated |
| `scripts/idambox-user-write-guard.ts`, `tests/helpers/idambox-write-discipline.ts` | ✓ VERIFIED | Run in the ordinary suite |
| `tests/helpers/{iam-live-keycloak-gate,iam-postgres-gate,iam-gate-harness,iam-process-runner}.ts` | ✓ VERIFIED | Compile in the test build; their logic is unit-tested; live runs are published |
| `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md` | ✓ VERIFIED | Amendment present |
| 18 Phase 2 test files | ✓ VERIFIED | 217/217 pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `index.ts` `register` | `registerIdentityWrites` | `strapi.documents.use`, always on, whatever the provisioning flag | WIRED |
| `index.ts` `bootstrap` | `seedIamData` → `registerIdentitySource` → `runSourceRegistration` | after `seedCsrmData`, which seeds the IAM Role and Function | WIRED |
| `identity-service.ts` | `write-context.runSourceMutation` | each write runs under a frozen authority that the middleware checks | WIRED |
| `register-identity-writes.ts` | `keycloak-sync/outbox.enqueueDeactivation` / `cancelPendingDeactivation` | same `trx` under `withIdentityUserLock` | WIRED |
| `worker.ts` | `outbox.claimDueDeactivation` → `KeycloakAdminClient.disableUser` / `endUserSessions` | claim committed, then user lock, renewal and recheck before the calls | WIRED |
| `csrm-authorization.ts` | `source-principal.isRegisteredSourceServiceUser` | denies services; no Requestor birthright for them | WIRED |
| CSRM selectors and owner writes | `registeredSourceServiceUserDocumentIds` / `isRegisteredSourceServiceUser` | four services exclude services from selectors and refuse them as owners or assignees | WIRED |
| Ordinary unit suite | `checkIdamboxUserWrites(src)` | test in `iam-write-discipline.unit` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| `readForSource` / `listForSource` | users | `strapi.documents(USER).findMany/count` with `visibleScope` | Yes | ✓ FLOWING |
| guard ownership decision | current user, source, roles | Document Service `findOne` after the user lock | Yes | ✓ FLOWING |
| worker | outbox row, user status, subject | raw conditional update, then Document Service reads under the lock | Yes | ✓ FLOWING |
| `loadEffectiveGrants` | `accountStatus`, service binding | Document Service on every request | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unfiltered backend suite | `ENV_PATH=/nonexistent pnpm --dir apps/backend test` | 2577/2577 pass, 0 skipped, exit 0 | ✓ PASS |
| Schema contract | `node --test … iam-schema-contract.unit.test.js` | 4/4 | ✓ PASS |
| Physical constraints and legacy migration | `… iam-database-invariants.integration.test.js` | 5/5 | ✓ PASS |
| Registration and seed | `… iam-source-registration.integration.test.js` | 5/5 | ✓ PASS |
| Service isolation | `… iam-service-isolation.integration.test.js` | 3/3 | ✓ PASS |
| Human selectors | `… iam-human-selectors.integration.test.js` | 7/7 | ✓ PASS |
| Ownership guard | `… iam-ownership.integration.test.js` | 11/11 | ✓ PASS |
| Identity service | `… iam-identity.integration.test.js` / `iam-identity-input.unit` | 8/8 / 7/7 | ✓ PASS |
| Leaver outbox and worker | `… iam-keycloak-sync.integration` / `iam-keycloak-sync-worker.unit` / `iam-keycloak-client.unit` | 17/17 / 4/4 / 6/6 | ✓ PASS |
| Provisioning and identity regression | `keycloak-provisioning.{integration,unit}` / `keycloak-identity.{integration,unit}` | 6/6, 31/31 / 8/8, 12/12 | ✓ PASS |
| Write discipline | `iam-write-discipline.{unit,integration}` | 43/43 / 13/13 | ✓ PASS |
| Gate harness logic | `iam-gates.unit` | 27/27 | ✓ PASS |
| CSRM compatibility | `contract-catalogue`, `served-operations`, `authorization-matrix` integration | 238/238 | ✓ PASS |
| Write inventory CLI | `node .tmp/tests-dist/scripts/idambox-user-write-guard.js --check` | exit 0 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| Live Keycloak outage gate | `node .tmp/tests-dist/tests/helpers/iam-live-keycloak-gate.js --timeout-seconds 600` | Not run (needs Docker and Keycloak). Published run: exit 0, 9/9 stages. UAT item 5: pass | judged from published evidence |
| Two-process PostgreSQL gate | `node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 1800` | Not run (needs PostgreSQL). Published: exit 0, 31/31 stages on fresh and reused schemas in two time zones. UAT item 6: pass | judged from published evidence |

### Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| MODEL-01 | 01, 02, 03, 04, 05, 06, 11, 12, 13 | An operator registers an Identity Source with its own non-human service identity, which holds only the Identity Provisioning Function (D15) | ✓ SATISFIED | Truth 2. Atomic `runSourceRegistration`. Catalogue isolation in both copies. Services denied CSRM access and excluded from selectors. `iam-source-registration` 5/5, `iam-service-isolation` 3/3, `iam-human-selectors` 7/7. |
| MODEL-03 | 01, 02, 03, 04, 07, 08, 09, 11, 12, 13 | Each IdamBox User records whether it is sourced (Identity Source and source key) or manual, and whether it is protected (D13, D14) | ✓ SATISFIED | Truths 1 and 2. Tuple fields and `protected` landed exactly as approved. All-or-nothing tuple enforced. Legacy users read manual and unprotected (`iam-database-invariants` 5/5). |
| PROV-05 | 05, 06, 07, 08, 09, 10, 11, 12, 13 | An Identity Source cannot read or change another source's users, and cannot change protected users (D13, D15) | ✓ SATISFIED | Truth 3. `visibleScope` and `accessible` in the service, plus the always-on Document Service guard inside the transaction. `iam-ownership` 11/11, `iam-identity` 8/8. |
| PROV-07 | 07, 08, 09, 11, 12, 13 | An admin cannot edit a sourced user's HR-owned fields through the Strapi user APIs (D6) | ✓ SATISFIED | Truth 3. `register-identity-writes.ts:134`. Content Manager test with provisioning off and on; role-only change accepted. UAT item 4. |
| LIFE-02 | 01, 02, 09, 10, 11, 12, 13 | A leaver's deactivation commits in Strapi while Keycloak is unavailable; their Keycloak account is disabled and sessions ended once Keycloak returns (D16) | ✓ SATISFIED | Truth 4. Atomic outbox enqueue with zero remote I/O, next-request refusal, fenced worker. `iam-keycloak-sync` 17/17 and `keycloak-identity.integration` 8/8 passed here. Live recovery and two-instance claim come from published gate evidence and UAT items 5 and 6. |

REQUIREMENTS.md maps exactly these five IDs to Phase 2 (lines 88-100, all "Complete"). Every one is declared by at least one plan, so there are no orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| All 64 implementation, test and doc files changed in Phase 2 | — | No TBD, FIXME, XXX, TODO, HACK or placeholder markers | — | none |
| `.planning/.../02-SECURITY.md` | 85, 104-105 | The body still says "T-02-28 is open and blocks advancement", and two sign-off boxes are unchecked. This contradicts the frontmatter (`status: secured`, `threats_open: 0`), the register row at line 71 (CLOSED) and the verdict paragraph | ⚠️ Warning | Documentation only. The closure is supported by `02-GATE-EVIDENCE.md` and by the green suite run here. A reader of the body gets the wrong state. Not rewritten here, as instructed |
| `.planning/.../02-REVIEW.md` | 50 | Frontmatter `status: issues_found`, while its Fixes section records CR-01, WR-01 and WR-02 as fixed (commits `cf557fae`, `f9abf97f`, `58e9f1ea`, all present) | ℹ️ Info | Stale status field; the fixes are in code and tested |
| `src/bootstrap/seed-iam-data.ts` | 8 | The IAM dev seed needs the Identity Provisioning Role and Function, which only `seedCsrmData` creates (when `IDAMBOX_SEED_CSRM=true`). With `IDAMBOX_SEED_IAM=true` and `IDAMBOX_SEED_CSRM=false`, registration throws `IAM_SOURCE_PROVISIONING_GRANT` | ℹ️ Info | Fails closed. The committed default is `IDAMBOX_SEED_CSRM=true`, and UAT item 1 booted cleanly. An undocumented ordering dependency |
| `src/keycloak/register-idambox-user-provisioning.ts` | 78 | Every update to a user already inactive skips Keycloak, including HR-only edits | ℹ️ Info | Matches the approved ADR text ("an update whose effective accountStatus is inactive commits … with no Keycloak … call"). Mirrored HR edits of a leaver reach Keycloak only after reactivation |
| Database support | — | MySQL is accepted by config but has not been verified (`02-POSTGRES-EVIDENCE.md` Observations). The PostgreSQL concurrent `client.query()` deprecation warning is untraced | ℹ️ Info | Recorded limits, not a Phase 2 criterion |

### Human Verification Required

None outstanding. The live-only behaviour was exercised by a human in 02-UAT.md (18/18 pass, 2026-10-19):

- Keycloak stopped and restarted with provisioning on (item 5);
- the two-process PostgreSQL gate (item 6);
- Content Manager HR refusal (item 4);
- the deliberate write-guard probe (item 7).

That UAT is backed by the published gate evidence above.

### Notes and carried items (not gaps)

- **Post-gate changes to Phase 2 code** (`58e9f1ea..HEAD`) are confined to these:
  - `identity-service.ts`: Phase 3 SCIM work, PUT merge (P3-34), and the set-password dispatch after a sourced create (`a877fd7b`);
  - `register-identity-writes.ts`: `4ed899ef` drops Content Manager's empty `{connect:[],disconnect:[]}` identitySource delta before the checks. It is a true no-op, so ownership is unchanged;
  - `admin-client.ts` and the provisioning log line: `db3b05f6` removes remote messages from the log.

  `outbox.ts`, `worker.ts`, `user-lock.ts`, `config.ts` and all three schemas are unchanged since the live gates ran. The Phase 2 tests pass at HEAD.
- **"Every existing csrm grant unchanged"** is judged against this phase's own effect (`90a91942` to `58e9f1ea`). Later CSRM workstream phases have since added Functions (the catalogue now holds 74 Functions in total). Those changes are outside this phase and are covered by today's green compatibility tests.
- **The gate's platform skip is resolved:** the POSIX-mode test skipped on Windows at the gate ran and passed here on macOS (0 skipped).

### Gaps Summary

No gaps. All five roadmap success criteria and all five requirements (MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02) are supported by:

- code read at HEAD;
- 217/217 Phase 2 tests and 238/238 compatibility tests run in this verification;
- an unfiltered backend suite of 2577/2577 with 0 skipped, run here.

For the live-only halves of criterion 4 (real Keycloak outage and recovery, and two Strapi instances on PostgreSQL), the evidence is the published gate output plus today's human UAT. The code those gates exercised is unchanged since they ran.

One documentation warning remains: 02-SECURITY.md contradicts itself about T-02-28 (the body says open, the frontmatter and register say closed). The authoritative state is CLOSED, so the text should be corrected in a follow-up docs commit.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
