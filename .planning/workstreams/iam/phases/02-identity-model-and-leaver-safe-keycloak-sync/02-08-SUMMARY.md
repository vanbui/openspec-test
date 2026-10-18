---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "08"
status: complete
subsystem: identity
tags: [iam, strapi, ownership, transactions, validation]
requires:
  - phase: "02-07"
    provides: Validated source principals, operation-scoped write authority and shared user locks
provides:
  - Six typed internal source operations with scoped, allowlisted reads
  - Atomic explicit manual claims, immutable tuple reservations and retained tombstones
  - Development fixture reseeding that preserves sourced identity values, roles and references
affects: [iam, csrm]
tech-stack:
  added: []
  patterns: [Document Service transactions, shared user locks, closed outcomes, scoped projections]
key-files:
  created:
    - apps/backend/src/iam/identity/identity-service.ts
    - apps/backend/tests/iam-identity.integration.test.ts
  modified:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
key-decisions:
  - "Only an explicit documentId PUT replacement can claim a manual user; upstream correlation confirmation is trusted."
  - "Internal filters are bounded normalized eq/and expressions, with zero-based start and limit paging; transport translation remains Phase 3."
  - "Retained development fixture subjects identify sourced fixtures after HR changes both email and username; ambiguous matches refuse reseeding."
  - "Blocking provisioning rollback is retained here; transactional inactive-user enqueue remains 02-09."
requirements-completed: [MODEL-03, PROV-05, PROV-07]
actuals:
  tasks: 2
  commits: 0
coverage:
  - id: D1
    description: Scoped source reads, validated creates and owned patches with safe projections
    verification:
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#scoped create/patch and correlation reads preserve roles and project only approved fields"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#persisted principal revocation is checked on every operation"
        status: pass
    human_judgment: false
  - id: D2
    description: Atomic explicit claims, immutable tuple conflicts, retained tombstones and blocking rollback
    verification:
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#competing source claims, same-source key claims and duplicate tuples have exactly one persisted winner"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#owned deletion retains tuple, roles and references; repeated deletion is safe and cannot restore"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#blocking Keycloak failure rolls back a manual claim and HR update, returning only the safe outcome"
        status: pass
    human_judgment: false
  - id: D3
    description: Claimed development fixtures survive repeat seeding and ambiguous matches fail closed
    verification:
      - kind: integration
        ref: "apps/backend/tests/iam-identity.integration.test.ts#development reseed preserves a claimed fixture's HR values, roles, subject and references"
        status: pass
    human_judgment: false
duration: approximately 23min of implementation and verification
completed: 2026-10-14
---

# Phase 2 Plan 08: Internal source identity service

Six typed source methods enforce scoped reads, explicit one-time claims and retained tombstones through the existing transaction-bound ownership pipeline.

## Accomplishments

- Added `createIdentityService` and named exports for `createFromSource`, `replaceFromSource`, `patchFromSource`, `deactivateFromSource`, `readForSource` and `listForSource`. Every operation revalidates persisted source/service binding and grants. Reads use transactions; mutations use the shared user lock, deciding reads and exact private source authority around Document Service writes. No public route or generic save was added.
- Read/list apply ownership, protection and tombstone predicates before filtering, counting and paging. Manual unprotected people are available only for correlation reads, without sourceExternalId. Results contain documentId and the approved identity fields, with no roles, password, subject, digest, populated source or other private data. Hidden and missing targets give the same notFound outcome. Normalized eq/and filters reject unknown/private fields; pagination is bounded and deterministic.
- Creates require an exact opaque source key, derive ownership/timestamps through the trusted pipeline, and start with roles=[]. Duplicate usernames/emails conflict rather than claiming a manual user. Patches resolve only an explicit documentId or exact owned tuple, change supplied fields only, preserve Roles and reject a changed source key.
- Full replacement is the sole manual claim operation. It locks and re-reads the target before claiming; only explicit documentId targets may claim. Same-source/key replay updates lastSyncedAt, omitted optional HR fields clear, and IdamBox-owned Roles and subjects remain. Other sources cannot claim an owned record; another key cannot replace its reservation. Constraint failures are translated only after rollback and comparison of the underlying source tuple.
- Deactivation changes only status and the server-selected timestamps. Source deletion sets sourceDeletedAt once, retains the user, tuple, Roles and owner references, and permits repeated deletion only by the owning source. Ordinary reads and create/replace/patch cannot restore the tombstone.
- Source mutation logs contain only source/service identity, operation, target documentId and a closed outcome. No source key, HR values, credentials or upstream body is included.
- CSRM reseeding reads fixture ownership and skips sourced Jane/Bob entirely. It can identify moved fixtures by their retained imported development subject when both email and username change. Conflicting matches refuse reseeding instead of selecting another person. Real persistence tests compare both complete records across two seeds and retain an existing owner reference; a reused old fixture email is tested as an ambiguous-match refusal.

## Verification

Every plan-named command was run, with successful compilation immediately before the final named runs.

| Command | Final result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | PASS, exit 0, before both final integration commands. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-identity.integration.test.js .tmp/tests-dist/tests/iam-ownership.integration.test.js` | PASS, exit 0: 16 tests, 16 pass, 0 fail, 0 skipped; approximately 144 seconds. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-identity.integration.test.js .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js` | PASS, exit 0: 10 tests, 10 pass, 0 fail, 0 skipped; approximately 139 seconds. |

Final logs, relative to apps/backend: `.tmp/iam-08-task1-verified.log` and `.tmp/iam-08-task2-verified.log`. The ownership run includes provisioning off/on and content-manager guards; the Keycloak run retains the existing create/update rollback and password cleanup checks.

The source tests exercise two registered sources, protected/manual/foreign/missing/tombstoned targets, count/page isolation, rejected Role/private inputs, copied and revoked principals, opaque tuple keys, optional-field replacement, preserved Roles, independent competing claim transactions, duplicate claims/creates, source deletion and retained references. The duplicate-tuple test temporarily disables only the test instance's friendly tuple uniqueness preflight; the real database index remains in place and decides the loser. No schema file or persisted user bypass is used for this test.

Development verification exposed and resolved missing-module/nullable-field compilation errors and test typing errors. One early named integration attempt was blocked by compilation and is not counted as verification. A filtered attempt reported only a file-level result without required cases and was discarded. The subsequent PUT RED run failed against the placeholder outcome as expected, then passed with the implementation.

A later complete Keycloak verification attempt exited 1 with 9/10 passing: the new collision fixture accidentally supplied a sourceExternalId on a manual create, correctly triggering IAM_IDENTITY_FORBIDDEN before the collision assertion. The fixture now creates a manual person without source fields. Both final full named runs passed after that correction. The failed attempt remains in `.tmp/iam-08-task2-final.log`; it is not relabelled as a pass.

`git diff --check` passed. Strict TypeScript remains enabled. No dependency, content-type, catalogue grant, public route or provisioning default changed.

## Decisions and scope

1. Followed the approved contract-gap record and P2-11 through P2-17. An explicit first PUT is the confirmed-correlation signal; Strapi cannot independently prove the upstream operator click. No extra claim header, token or confirmation screen was introduced. Operator confirmation evidence remains Phase 4.
2. Used a typed normalized internal filter tree and zero-based paging rather than introducing SCIM wire parsing in this plan. Field allowlisting and bounds apply before Document Service calls; Phase 3 owns wire translation.
3. Extended fixture lookup to the already imported development subjects because email-only lookup would fail after an authorized HR mover changed a fixture's email. Ambiguous identities fail closed, and sourced fixture Roles are preserved by skipping the whole fixture update.
4. Kept the existing blocking provisioner in this plan, including rollback of failed manual claims and HR updates. The source deletion flag is an internal server-selected argument, never a DTO field. Atomic inactive-user enqueue belongs to 02-09, which reruns these source tests.

## Remaining gates and handoff

- No unmet verification gate remains within 02-08. This summary records the plan's contribution to MODEL-03, PROV-05 and PROV-07; no requirement or phase tracking file was updated.
- SQLite persistence and separate local claim transactions do not prove independent-process PostgreSQL serialization. The required shared-PostgreSQL proof remains 02-11; no MySQL integration claim is made here.
- Outage-safe deactivation, durable remote work and worker delivery remain 02-09 and subsequent plans. This plan does not claim that deactivation already commits without remote calls or queues work.
- The full backend suite was not run; the orchestrator owns that gate and baseline comparison.
- Only 02-08 was executed. Changes are uncommitted and unstaged. No Git write commands were performed, no Docker containers were started, and STATE.md/ROADMAP.md remain unchanged.
- Ready for orchestrator review and 02-09. Later plans remain incomplete, so phase-level verification and completion were not run.
