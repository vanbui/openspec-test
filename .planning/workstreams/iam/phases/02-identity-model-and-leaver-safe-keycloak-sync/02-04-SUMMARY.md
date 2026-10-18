---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "04"
status: complete
requirements: [MODEL-01, MODEL-03]
completed: 2026-10-14
---

# 02-04 Summary: Atomic source service registration

Executed only plan 02-04 (wave 4). Implementation and summary remain uncommitted for orchestrator review. No Git write commands, Docker commands or listening network services were started. ROADMAP.md, STATE.md, schemas, dependency manifests and provisioning defaults remain unchanged.

## Delivered

- `apps/backend/src/iam/identity/write-context.ts` owns a private AsyncLocalStorage registration capability. Its public workflow takes only an exact, validated source/service manifest; it accepts no callback, role, credential or privilege flag. It copies and freezes the manifest before creating the context.
- `apps/backend/src/iam/identity/source-registration.ts` exposes `registerIdentitySource`. One transaction validates the seeded provisioning grant, refuses unrelated username/email collisions, creates an active protected manual user with no roles or credentials, creates its source binding, attaches exactly Identity Provisioning, and rereads the final source/user invariant before commit. All user writes use Document Service.
- `apps/backend/src/bootstrap/seed-iam-data.ts` exposes `seedIamData`, gated by both `NODE_ENV=development` and `IDAMBOX_SEED_IAM=true`, using the exact approved midPoint fixture names. Repeated seeds validate the persisted service and preserve the source's token, rotation time, activity, status and binding. Initial registration seeds no token.
- `apps/backend/src/keycloak/register-idambox-user-provisioning.ts` recognizes only the exact intended initial create inside the private registration workflow. Later updates qualify through the persisted source binding and complete service invariant. Protection alone and caller-supplied flags do not grant an exemption.
- `apps/backend/tests/iam-source-registration.integration.test.ts` uses real Strapi Document Service persistence and isolated SQLite databases without listening on a port. The enabled-mode branch installs the production provisioning middleware with an injected rejecting client; ordinary protected-user creation reaches that client, while source registration, repeated seed and valid registered-service updates make zero remote calls.

## Decisions and deviations

- Kept the context constructor private by putting the entire create-bind-grant transaction inside `runSourceRegistration`; no exported generic privileged callback runner exists. This follows P2-07/P2-17 and leaves later ownership contexts to their plans.
- Source labels and service fields must already be trimmed, nonblank, at most 255 characters and free of control characters. Invalid or extra manifest fields fail closed rather than being silently dropped. Existing source/service name mismatches are collisions, never adoption candidates.
- Reused inactive sources retain their status and credentials/activity; registration does not reactivate a source. A reused service with invalid protection, status, ownership tuple, credentials or grants fails closed instead of being repaired. These choices follow P2-07/P2-10 and the approved contract-gap record.
- The provisioning Role must contain exactly the Identity Provisioning Function, with no menuPath, attached to the active `idambox-iam` Application. Registration refuses a missing or expanded grant instead of creating or repairing catalogue data.
- Updated the existing `apps/backend/tests/keycloak-provisioning.unit.test.ts` fixture to make `documents` callable and return an empty source-binding lookup for ordinary users. The existing linked role-only update test initially failed with `strapi.documents is not a function`; the fixture update restores the test without weakening its assertions.
- Tests were written first. Initial compilation failed on the not-yet-created modules and fixture typing errors, which were corrected. No commit-based test-cycle evidence is claimed because all Git writes were prohibited.
- Bootstrap wiring, service birthright exclusion and people filtering remain plan 02-05 responsibilities; no later plan was executed.

## Verification

Commands ran from the repository root with installed dependencies.

| Check | Final outcome |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Pass, exit 0; named integration test emitted |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-source-registration.integration.test.js` | Pass, exit 0; 5 tests, 5 passed, 0 failed/cancelled/skipped; final run about 25 seconds |
| Selected existing provisioning tests, command below | Pass, exit 0; 9 selected tests, 9 passed, 0 failed/cancelled/skipped |
| `pnpm --dir apps/backend exec node --test .tmp/tests-dist/tests/iam-schema-contract.unit.test.js` | Pass, exit 0; 4 tests, 4 passed, 0 failed/cancelled/skipped |
| `git diff --check` | Pass |

Existing provisioning regression command:

```powershell
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 --test-name-pattern="provisioning is disabled|unrecognised flag|complete configuration|invalid base URL|Strapi register|enabled provisioning registers|an update that|other content" .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js
```

The five registration tests cover:

1. Provisioning disabled: first registration and seed, repeated seed, complete service invariant, create/bind/grant/final-verification rollback, and unrelated username/email collisions.
2. Provisioning middleware enabled: the same cases, plus valid registered-service updates without remote calls and rollback of attempted role removal/password assignment.
3. Seed gating, initial null token, restart, stable service binding, and preservation of tokenHash, tokenRotatedAt, lastActivityAt and inactive source status.
4. Unsafe/extra manifest fields, reused-name mismatch and refusal of an invalid persisted service grant.
5. Protected people and forged caller flags cannot bypass ordinary blocking provisioning; a rejected remote call leaves no user behind.

## Remaining gates

All plan 02-04 targeted gates passed. The complete backend suite and HTTP/fake-server provisioning tests were not run because they start listening network services, prohibited for this execution. No full-suite pass or resolution of its recorded baseline failures is claimed. Live Keycloak and shared PostgreSQL gates remain later phase/orchestrator obligations.

Plans 02-05 through 02-13 remain incomplete. Phase verification and completion were not performed. Next scoped execution: `$gsd-execute-phase 2 --ws iam --wave 5`.
