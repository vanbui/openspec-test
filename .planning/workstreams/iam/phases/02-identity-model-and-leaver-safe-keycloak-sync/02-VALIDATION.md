---
phase: "02"
slug: identity-model-and-leaver-safe-keycloak-sync
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-14"
validated: "2026-10-19"
---

# Phase 2 — Validation Strategy

Planning defined the checks; execution evidence is in `02-GATE-EVIDENCE.md` and was audited on 2026-10-19 (see Validation Audit below). The operator approved the exact contract-gap record on 2026-10-14. No additional human approval checkpoint is required.

## Test Infrastructure

Use the existing node:test harness and strict TypeScript compilation in apps/backend/tests/tsconfig.json. Run commands from the repository root. Compile tests before targeted compiled test commands:

- Compile: `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false`.
- Full suite: `pnpm --dir apps/backend test`.
- Quick feedback: the relevant compiled unit test, under 30 seconds where measured; boot/integration tests have separate bounded deadlines.

After each task run its named verification; after each wave run its requirement integration checks and relevant existing regressions. Every runnable plan command must have an immediately following `fails_when` sibling. Helpers and tests must be created before invocation. Compilation alone never proves a material workflow.

## Final Task Verification Matrix

Thirteen sequential plans preserve the original 21 tasks. Plan 02-01 has two tasks; plans 02-02 through 02-06 each contain one existing task split from the oversized plans; plans 02-07 through 02-13 each retain two tasks. Every task changes at most five paths. The split plans have 8, 2, 5, 5, 5 and 5 declared paths respectively. Waves preserve the requested ordered groups: 1–6 schemas/catalogue/seed and source-service isolation; 7–8 ownership/upsert; 9–11 outbox/worker and PostgreSQL proof; 12 Document Service discipline; 13 ADR amendment/live/final gate.

All rows are planned and unexecuted. Test names below are relative to apps/backend; tests are new deliverables unless an existing regression is named. Each PLAN task owns its tests/helpers and specifies compilation, concrete commands and immediate fails_when siblings. Helpers are created before use. Evidence-file tasks run the production checks instead of treating document creation as proof.

| Task | Wave | Requirements | Required proof / task | Owned test or runnable gate |
|---|---|---|---|---|
| 02-01-01 | 1 | MODEL-01, MODEL-03, LIFE-02 | Reconcile approved schemas and declarations before any schema-sync boot | tests/iam-schema-contract.unit.test.ts |
| 02-01-02 | 1 | MODEL-01, MODEL-03, LIFE-02 | Enforce metadata-derived database constraints through repeated schema sync | tests/iam-database-invariants.integration.test.ts; tests/iam-schema-contract.unit.test.ts |
| 02-02-01 | 2 | MODEL-01, MODEL-03, LIFE-02 | Supply the verified pinned PostgreSQL runtime driver | Exact pg/backend+Knex resolution |
| 02-03-01 | 3 | MODEL-01, MODEL-03 | Seed IAM catalogue ownership and reserve unserved operations | tests/contract-catalogue.integration.test.ts; tests/served-operations.integration.test.ts |
| 02-04-01 | 4 | MODEL-01, MODEL-03 | Register and seed source services atomically without premature binding dependencies | tests/iam-source-registration.integration.test.ts |
| 02-05-01 | 5 | MODEL-01, PROV-05 | Validate bound service principals and suppress human grants | tests/iam-service-isolation.integration.test.ts; tests/iam-source-registration.integration.test.ts; tests/authorization.integration.test.ts |
| 02-06-01 | 6 | MODEL-01, PROV-05 | Exclude bound services before every human selection and count | tests/iam-human-selectors.integration.test.ts; tests/request-assignment.integration.test.ts; tests/risk-register.integration.test.ts; tests/administration.integration.test.ts |
| 02-07-01 | 7 | MODEL-03, PROV-05, PROV-07 | Guard every user and inverse membership write inside the transaction | tests/iam-ownership.integration.test.ts; tests/iam-source-registration.integration.test.ts; tests/keycloak-provisioning.integration.test.ts |
| 02-07-02 | 7 | MODEL-03, PROV-05, PROV-07 | Define shared validated identity input and safe conflict outcomes | tests/iam-identity-input.unit.test.ts |
| 02-08-01 | 8 | MODEL-03, PROV-05, PROV-07 | Expose scoped reads and owned create/patch operations | tests/iam-identity.integration.test.ts; tests/iam-ownership.integration.test.ts |
| 02-08-02 | 8 | MODEL-03, PROV-05, PROV-07 | Implement atomic PUT claims and owned deactivation tombstones | tests/iam-identity.integration.test.ts; tests/keycloak-provisioning.integration.test.ts |
| 02-09-01 | 9 | MODEL-03, PROV-05, PROV-07, LIFE-02 | Capture credentials transiently and remove query-layer linkage | tests/keycloak-provisioning.integration.test.ts; tests/iam-identity.integration.test.ts; tests/iam-ownership.integration.test.ts |
| 02-09-02 | 9 | MODEL-03, PROV-05, PROV-07, LIFE-02 | Commit inactive updates with one atomic generation-aware outbox row | tests/iam-keycloak-sync.integration.test.ts; tests/keycloak-provisioning.integration.test.ts; tests/keycloak-identity.integration.test.ts; tests/iam-identity.integration.test.ts |
| 02-10-01 | 10 | LIFE-02, PROV-05 | Bound the whole disable/logout attempt and prove real fake-session effects | tests/iam-keycloak-client.unit.test.ts; tests/keycloak-provisioning.unit.test.ts |
| 02-10-02 | 10 | LIFE-02, PROV-05 | Poll and execute fenced work under the shared user lock | tests/iam-keycloak-sync.integration.test.ts; tests/iam-keycloak-client.unit.test.ts; tests/keycloak-provisioning.integration.test.ts; tests/keycloak-identity.integration.test.ts |
| 02-11-01 | 11 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Create bounded independent-process PostgreSQL gate helpers | tests/iam-gates.unit.test.ts |
| 02-11-02 | 11 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Run the production-dialect ownership, lease and reactivation scenarios | tests/helpers/iam-postgres-gate.ts (two processes, PostgreSQL) |
| 02-12-01 | 12 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Reject semantic user-write bypasses and prove the guard's failure cases | tests/iam-write-discipline.unit.test.ts; scripts/idambox-user-write-guard.ts |
| 02-12-02 | 12 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Prove narrow framework persistence provenance across every workflow | tests/iam-write-discipline.integration.test.ts; tests/iam-write-discipline.unit.test.ts; tests/keycloak-provisioning.integration.test.ts |
| 02-13-01 | 13 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Amend the accepted ADR and create the live outage gate before invoking it | tests/iam-gates.unit.test.ts |
| 02-13-02 | 13 | MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02 | Run live recovery and the mandatory green full backend/compatibility gate | tests/helpers/iam-live-keycloak-gate.ts; schema/catalogue/inventory regressions; full backend suite |

02-02-01 is an execution-only dependency task: exact runtime pg 8.23.1 is [VERIFIED] in 02-RESEARCH.md's Package Legitimacy Audit, with official ownership, MIT licence and Node >=16 compatibility. It is currently missing in backend/Strapi/Knex resolution contexts. Only the backend manifest and necessary root lockfile entries change. No PostgreSQL invocation precedes successful driver resolution; early schema checks use SQLite and the fresh/reused distributed reproduction uses PostgreSQL in 02-11.

Commands in each task are conjunctive: successful compilation never replaces a failing workflow test. Unit/AST feedback is bounded at 60 seconds; real Strapi integration checks use named 180/600-second test deadlines. Standalone live/PostgreSQL helpers bound the whole run at 600 seconds. Executors poll long-running commands and report progress without hiding timeouts.

## Orchestrator-Run Verification

Live Keycloak outage/recovery: with provisioning enabled only in the isolated execution environment, stop Keycloak, deactivate a linked user, prove the committed inactive state and next-request refusal, restart Keycloak, and observe both disabled account and ended sessions before completed outbox status. Restore stack state after the bounded gate.

Two independent Strapi processes on shared PostgreSQL: record process IDs and nonsecret database identity; prove simultaneous claims, expired-lease crash recovery, lost-owner/generation fencing, partial disable/logout retry, reactivation lock interleavings, new generation, unchanged inactive replay backoff, atomic enqueue rollback and fresh/reused indexes. SQLite or two calls in one process cannot satisfy this gate. Create the standalone compiled gate helper before calling it. Missing infrastructure or failed assertions remain execution failures, never a human checkpoint or a skipped pass.

## Wave 0 and Sign-Off

Extend the existing fake Keycloak server with controlled disable/logout outcomes and barriers; create test fixtures and gate orchestration before use. Reuse existing dependencies. Keep private fields, credentials, remote bodies and personal information out of evidence.

The recorded backend baseline in .planning/WINDOWS.md is 1581 pass, 1 fail, 1 skipped, with a known context-size attachment ECONNRESET failure. Record actual final counts and distinguish baseline from regressions. Repeating a baseline failure is not a green full-suite pass.

- [x] Every task has behavioral verification and an observable failure direction.
- [x] Every helper exists before invocation.
- [x] Fresh and reused schema constraints are verified.
- [x] All ownership and write-discipline scenarios pass.
- [x] Outage and two-process PostgreSQL evidence pass.
- [x] Full backend suite passes; CSRM endpoints and grants retain compatibility.
- [x] Runtime evidence justifies setting compliance fields; planning leaves them false.

## Multi-Source Coverage Audit

Coverage is of the written tasks, not of executed behavior. Every required source item is planned; runtime success remains pending.

| Source | ID | Required item | Plan coverage | Status |
|---|---|---|---|---|
| GOAL | Phase 2 | Owned identities and outage-safe local deactivation | 02-01–02-13 | COVERED |
| GOAL | SC-1 | Approved exact schemas and preserved frozen domain | 02-01, 02-13 | COVERED |
| GOAL | SC-2 | Atomic opt-in source/service identity; manual/protected migration and preserved CSRM access | 02-01, 02-03–02-06 | COVERED |
| GOAL | SC-3 | Scoped six-method service, one-time claim and administrative HR refusal | 02-07–02-08 | COVERED |
| GOAL | SC-4 | Live outage commit/refusal, disable/logout, two-instance claim proof and ADR amendment | 02-09–02-11, 02-13 | COVERED |
| GOAL | SC-5 | Document Service bypass failures and green compatible full backend suite | 02-12–02-13 | COVERED |
| REQ | MODEL-01 | Source registration and provisioning-only service capability | 02-01, 02-03–02-06 | COVERED |
| REQ | MODEL-03 | Complete manual/sourced tuple, protected status and physical constraints | 02-01, 02-07–02-09 | COVERED |
| REQ | PROV-05 | Fresh principal and owned/protected/foreign visibility/mutation rules | 02-05–02-08, 02-11–02-12 | COVERED |
| REQ | PROV-07 | Always-on HR refusal with roles-only/equal-value success | 02-07–02-08, 02-12 | COVERED |
| REQ | LIFE-02 | Atomic local leaver commit and durable disable/session termination | 02-02, 02-09–02-11, 02-13 | COVERED |
| CONTEXT | P2-01 | Satisfied 2026-10-14 approval; first task exact reconciliation | 02-01, 02-13 | COVERED |
| CONTEXT | P2-02 | Additive gaps, frozen JDL and narrow ADR amendment | 02-01, 02-13 | COVERED |
| CONTEXT | P2-03 | Exact IdentitySource and physical target uniqueness | 02-01 | COVERED |
| CONTEXT | P2-04 | Exact additive user fields and legacy preservation | 02-01 | COVERED |
| CONTEXT | P2-05 | Complete immutable tuple, exact digest and DB uniqueness | 02-01, 02-07–02-08, 02-11 | COVERED |
| CONTEXT | P2-06 | Exact internal durable outbox schema and generations | 02-01, 02-09 | COVERED |
| CONTEXT | P2-07 | Atomic protected manual source identity, binding and exact Role invariants | 02-04–02-05, 02-07 | COVERED |
| CONTEXT | P2-08 | IAM Application/Function and no source-service human birthright/selection | 02-03, 02-05–02-06 | COVERED |
| CONTEXT | P2-09 | Unserved standards-operation reservations and compatible catalogues | 02-03 | COVERED |
| CONTEXT | P2-10 | Opt-in idempotent collision-safe seed, no tokens/reset | 02-04–02-05 | COVERED |
| CONTEXT | P2-11 | Six typed internal methods and fresh principal/DTO | 02-05, 02-07–02-08 | COVERED |
| CONTEXT | P2-12 | Exact source fields, Role preservation and safe closed outcomes | 02-07–02-08 | COVERED |
| CONTEXT | P2-13 | Own/manual scope, safe projection, counts and indistinguishable hidden targets | 02-08 | COVERED |
| CONTEXT | P2-14 | Explicit PUT-only atomic one-time claim and upstream confirmation boundary | 02-08, 02-11 | COVERED |
| CONTEXT | P2-15 | Owned idempotent tombstone deactivation with retained tuple/references | 02-08–02-09 | COVERED |
| CONTEXT | P2-16 | Unconditional locked HR guard for administrative/content-manager/internal paths | 02-07 | COVERED |
| CONTEXT | P2-17 | Private exact operation contexts and sourced-fixture reseed skip | 02-04, 02-07–02-08 | COVERED |
| CONTEXT | P2-18 | Existing-inactive zero-network local update plus atomic enqueue | 02-09 | COVERED |
| CONTEXT | P2-19 | Blocking creates/other changes/reactivation and binding-only service exemption | 02-04, 02-07, 02-09–02-10 | COVERED |
| CONTEXT | P2-20 | Off-mode guards/queue and inert worker; safe absent-subject completion | 02-09–02-10 | COVERED |
| CONTEXT | P2-21 | Short conditional database claim, not process-local ownership | 02-10–02-11 | COVERED |
| CONTEXT | P2-22 | Owner/generation fences, database time, deadlines and expiry recovery | 02-10–02-11 | COVERED |
| CONTEXT | P2-23 | All writes and workers share database user lock; safe two-stage order | 02-07, 02-09–02-11 | COVERED |
| CONTEXT | P2-24 | Subject-only disable/logout, capped perpetual retry and bounded destroy | 02-10, 02-13 | COVERED |
| CONTEXT | P2-25 | Independent-process PostgreSQL required proof and at-least-once remote semantics | 02-02, 02-10–02-11 | COVERED |
| CONTEXT | P2-26 | Document Service-only user mutations, raw linkage removal | 02-09, 02-12 | COVERED |
| CONTEXT | P2-27 | Validated transient capture, nested null cleanup and no retained hash | 02-09, 02-12 | COVERED |
| CONTEXT | P2-28 | Semantic AST fixtures and narrow actual persistence provenance | 02-12 | COVERED |
| CONTEXT | P2-29 | Real Strapi behavior, rollback, signed-token refusal and live/distributed evidence | 02-02, 02-07–02-13 | COVERED |
| CONTEXT | P2-30 | Latest shared-backend recheck, compatibility and mandatory green suite; baseline separate | 02-01, 02-11, 02-13 | COVERED |
| RESEARCH | R-1 | Installed 5.51 outer-transaction ordering and ambient nested binding | 02-07, 02-09 | COVERED |
| RESEARCH | R-2 | OneToOne pair uniqueness is insufficient; actual inverse-target constraint persists across sync | 02-01, 02-11 | COVERED |
| RESEARCH | R-3 | Source registration manifest resolves create-before-binding dependency | 02-04, 02-07 | COVERED |
| RESEARCH | R-4 | Catalogue Application partition and ordinary served-inventory recheck | 02-03 | COVERED |
| RESEARCH | R-5 | Binding-based service discriminator preserves protected people | 02-05–02-06 | COVERED |
| RESEARCH | R-6 | Shared allowlisted DTO, exact digest, post-rollback conflict read and safe projection | 02-07–02-08 | COVERED |
| RESEARCH | R-7 | Validated password omission/null succeeds; preserve original validation/off mode | 02-09 | COVERED |
| RESEARCH | R-8 | Claim transaction commits before user-first execution lock; current DB clock after waits | 02-10–02-11 | COVERED |
| RESEARCH | R-9 | Whole attempt includes token/body/refresh/waiters; safe closed error codes | 02-10 | COVERED |
| RESEARCH | R-10 | Real fake logout/session effects, deterministic barriers and fault injection | 02-09–02-11 | COVERED |
| RESEARCH | R-11 | AST alias/generic/inverse paths plus actual pinned persistence caller permit | 02-12 | COVERED |
| RESEARCH | R-12 | No SQLite substitution; two independent processes and isolated backend PostgreSQL | 02-11 | COVERED |
| RESEARCH | R-13 | pg 8.23.1 exact verified driver install before PostgreSQL; no unrelated upgrades | 02-02 | COVERED |
| RESEARCH | R-14 | Live Keycloak proof, off defaults, restoration, sanitized evidence and required green suite | 02-13 | COVERED |

P2-01's old approval-pending/checkpoint text is superseded by explicit operator approval on 2026-10-14 and the approved record. The first task reconciles schemas exactly; no new human checkpoint is introduced. All P2-01 through P2-30 appear verbatim in the relevant PLAN frontmatter must_haves.truths. The current native decision-coverage parser only accepts D-NN/D4-NN, so its correctly invoked check reports could-not-parse for the authoritative P2 grammar; explicit P2 coverage is 30/30 and allocated requirement coverage is 5/5. The context is not renamed to work around that parser limitation.

Excluded source items are expressly deferred: Phase 3 SCIM routes/bearer tooling/wire errors/connector replay; Phase 4 operator-confirmed midPoint correlation, refresh and engine audit; Phase 5 password email and CSRM sign-in/UI journey. Source restoration/reassignment, additional HR fields, source UI and central change log are also deferred. None is delivered by these tasks.

## Dependency and Reachability Audit

Each plan depends on the immediately preceding plan and occupies its own wave; same-wave file collisions therefore cannot occur. No plan references a prior SUMMARY merely for chronology.

- 02-01 needs existing Phase 1 GO and the approved record; produces approved schemas and verified physical constraints.
- 02-02 supplies the verified exact PostgreSQL runtime driver before any PostgreSQL helper invocation.
- 02-03 uses the approved schemas; produces the IAM catalogue/Application partition and intentionally unserved operation reservations.
- 02-04 uses that catalogue; produces directly runnable atomic registration and the opt-in source seed.
- 02-05 wires the tested seed to ordinary bootstrap and consumes persisted bindings for principal/grant isolation.
- 02-06 consumes the binding helpers to exclude source services from human selector counts, paging and chosen-ID validation.
- 02-07 registers the always-on pipeline and publishes exact private operation/DTO/lock contracts.
- 02-08 imports those contracts for all six internal methods; callers trigger real Document Service mutations without mounting a public route.
- 02-09 routes local inactive writes to the durable queue and uses nested Document Service for blocking linkage.
- 02-10 consumes that queue from opt-in bootstrap polling; destroy bounds cleanup.
- 02-11 creates helpers before launching two real backend processes and proves database arbitration.
- 02-12 invokes AST checks and narrow runtime instrumentation against every material user-write seam.
- 02-13 creates the live helper before orchestration and amends ADR 0002; final acceptance requires both live proofs and the complete green backend suite.

Private source contexts, registration manifests and linkage authority cannot be asserted by HTTP headers/data/params. Runtime instrumentation is test-only and grants no production bypass. All new paths and symbols are listed in each plan's Artifacts this phase produces inventory. Existing edited source paths are tracked; new paths are declared execution deliverables.

## Planning Checks

All thirteen PLAN files passed frontmatter schema and task-structure validation with no errors or warnings. Every task has read_first, action, acceptance_criteria, automated verification, immediate fails_when and done. Estimates retain the measured calibration factor 1 and low confidence from zero historical samples; split-plan tokens/raw_tokens and task counts are partitioned proportionally without recalibration.

All 45 automated commands passed failure-direction checks with zero blockers/warnings. The native command-path probe reports not_applicable for pnpm syntax; an explicit path/order audit instead confirmed every named compiled test/helper has an existing tracked source or an owner task creating it before invocation, every task path is declared, and every existing edited path is Git-tracked. There are no duplicate numeric threat IDs or same-wave file conflicts. No attribution notices or absolute checkout paths appear in the plans.

Planning performed no schema change, dependency installation, live outage, migration, execution or Git commit. nyquist_compliant and wave_0_complete remain false until execution evidence satisfies every required gate.

Independent final planning review passed with zero findings after one revision; see 02-PLAN-CHECK.md. All 13 plans, 21 tasks and 45 commands retain five-requirement and 30-decision coverage. This draft validation contract becomes validated only after its execution evidence is audited.

## Validation Audit 2026-10-19

Every row in the Final Task Verification Matrix is COVERED: the owned test file or gate helper exists under `apps/backend`, and it passed in the recorded execution evidence.

- Unit and integration tests (all 19 test files in the matrix) ran in the full backend suite on 2026-10-15: 1803 tests, 1802 pass, 0 fail, 1 platform skip unrelated to IAM (`02-GATE-EVIDENCE.md` §1). The operator re-ran `pnpm --dir apps/backend test` green during UAT on 2026-10-19 (`02-UAT.md` test 8).
- 02-11-02: two-process PostgreSQL gate exited 0 on fresh and reused schemas (§4), and passed again during UAT (test 6).
- 02-12-01/02: the write guard passed over 250 files and caught a deliberate `updateMany` probe (§5), confirmed again in UAT (test 7).
- 02-13-02: live Keycloak outage and recovery gate exited 0 with every stage passing (§3), confirmed again in UAT (test 5).
- 02-02-01: `pg` is pinned at `8.23.1` in `apps/backend/package.json`.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
