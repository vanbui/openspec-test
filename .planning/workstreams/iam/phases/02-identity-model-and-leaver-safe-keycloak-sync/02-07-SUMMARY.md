---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "07"
status: complete
subsystem: identity
tags: [iam, strapi, ownership, transactions, validation]
requires:
  - phase: "02-06"
    provides: Registered-service exclusion and human-selector compatibility
provides:
  - Always-on transaction-bound identity ownership and inverse-grant guards
  - Private operation-scoped source, linkage and human-protection capabilities
  - Shared source identity DTO validation, immutable tuple derivation and safe outcomes
affects: [iam, csrm]
tech-stack:
  added: []
  patterns: [Database serialization before deciding reads, Revocable private operation contexts, Post-rollback conflict resolution]
actuals:
  tasks: 2
  commits: 0
key-files:
  created:
    - apps/backend/src/iam/identity/user-lock.ts
    - apps/backend/src/iam/identity/register-identity-writes.ts
    - apps/backend/src/iam/identity/identity-input.ts
    - apps/backend/tests/iam-ownership.integration.test.ts
    - apps/backend/tests/iam-identity-input.unit.test.ts
  modified:
    - apps/backend/src/iam/identity/write-context.ts
    - apps/backend/src/index.ts
    - apps/backend/src/keycloak/register-idambox-user-provisioning.ts
    - apps/backend/tests/iam-source-registration.integration.test.ts
    - apps/backend/tests/iam-database-invariants.integration.test.ts
    - apps/backend/tests/iam-service-isolation.integration.test.ts
    - apps/backend/tests/iam-human-selectors.integration.test.ts
key-decisions:
  - "Registration alone establishes a service binding; generic unbinding, deletion and invalid grants are refused."
  - "Human protection is a concrete maintenance operation that refuses sourced and registered-service targets."
  - "Source capabilities expire when the operation settles, including in detached descendant promises."
  - "Physical-index races use an isolated schema fixture; production ownership enforcement remains unconditional."
requirements-completed: [MODEL-03, PROV-05, PROV-07]
coverage:
  - id: identity-ownership
    description: Locked ownership, administrative paths, inverse grants and context isolation
    requirement: PROV-07
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-ownership.integration.test.ts
        status: pass
    human_judgment: false
  - id: source-identity-input
    description: Approved DTO fields, opaque keys, literal digests and safe conflict outcomes
    requirement: MODEL-03
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-identity-input.unit.test.ts
        status: pass
    human_judgment: false
completed: 2026-10-14
---

# 02-07: Transactional identity ownership and shared input contracts

Both tasks are complete. The identity guard registers before provisioning and remains active when provisioning is disabled. All changes are uncommitted for review; STATE.md and ROADMAP.md were not updated.

## Delivered behavior

- Existing-user mutations begin their transaction and acquire the shared lock before reading ownership, protection or grants. PostgreSQL/MySQL select the real user row FOR UPDATE. SQLite performs a transaction-bound no-op UPDATE on the outbox table before deciding reads, with bounded retries of the entire outer transaction. Nested transactions propagate busy failures to their outer owner; driver error codes are recognized even when the message omits the code.
- Changed sourced HR fields are refused through Document Service and the real content-manager document-manager service, with provisioning both off and on. Equal-value and roles-only writes succeed. Source writes revalidate issued principals under the lock, enforce ownership/protection, derive the digest from the persisted source documentId and exact external key, and reject partial tuples, reassignment and tombstone resurrection. Inactive/deleted users retain their reservation and references.
- Source operations carry an exact action, target and field allowlist. Caller data, params and headers cannot assert authority. Capabilities are revoked after the operation settles, preventing delayed descendant promises from retaining privilege. Normalization copies operation data so caller DTOs do not acquire generated digests or replacement defaults.
- Initial service creation and binding require the exact validated registration manifest. Existing services are revalidated before and after writes. Direct and inverse Role writes cannot remove required grants or add unrelated ones. Function/Application writes also preserve the service's complete grant invariant. Generic source binding changes/deletion and protected/service user deletion are refused.
- `runManualProtection` changes only the protected field of an explicitly targeted manual human. `runKeycloakLinkage` changes only externalSubject and password cleanup; it still passes the ownership guard. The provisioner now uses that nested Document Service update and skips only recursive provisioning. The named rollback tests verify null password cleanup on the pinned runtime.
- The shared parser permits exactly the ten approved source identity fields. Create/replace require the mandatory fields; replacement clears omitted optional HR fields, while patch changes supplied fields only. Opaque external keys preserve case, spaces and leading zeros. Literal SHA-256 fixtures cover tuple derivation. Closed failures omit private details; transient remote failure carries retryAfterSeconds=30. `resolveIdentityUniqueness` refuses transaction-active lookups and compares the underlying tuple after rollback, returning a safe conflict rather than adopting a hash match.

## Verification

Every plan-named command was run. Final results:

| Command | Result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | PASS, exit 0; run before the named tests for both tasks, including the final revision. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-ownership.integration.test.js .tmp/tests-dist/tests/iam-source-registration.integration.test.js .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js` | PASS, exit 0; 17 tests, 17 pass, 0 fail, 0 skipped. Final run approximately 100.5 seconds. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-identity-input.unit.test.js` | PASS, exit 0; 7 tests, 7 pass, 0 fail, 0 skipped. |

Additional compatibility verification:

`pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-database-invariants.integration.test.js .tmp/tests-dist/tests/iam-service-isolation.integration.test.js .tmp/tests-dist/tests/iam-human-selectors.integration.test.js`

This run exited 1: 14/15 passed. Database invariants passed 5/5 and service isolation passed 3/3. The HTTP selectors passed 6/7; the 200-candidate test failed with `fetch failed`, caused by `read ECONNRESET`. This failed attempt is retained in `.tmp/iam-07-compatibility.log`. It has the same transport symptom as the documented backend baseline, but is not being identified as that baseline's specific failing case.

The isolated retry command was:

`pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-human-selectors.integration.test.js`

It passed, exit 0: 7/7 tests, 0 fail, 0 skipped, approximately 101.9 seconds. Its log is `.tmp/iam-07-human-selectors-retry.log`. Final named integration output is `.tmp/iam-07-task1-final.log`. Log paths in this section are relative to apps/backend.

Development runs also exposed and resolved: accepted forged ownership/inverse grants, duplicate compiled private-context modules in fixtures, caller-data mutation during normalization, and a detached promise retaining operation authority. The initial mixed development run also encountered compilation errors while implementation was in progress. A filtered context test initially lacked its preceding fixture and failed for that reason; the full ownership run then reproduced the actual expired-authority failure before the fix. Final verification contains no skipped required cases. The SQLite ordering assertion distinguishes the guard's documentId deciding read from lingering framework id-based relation-population queries after an earlier rejected operation.

`git diff --check` passed. No dependencies, schemas, public routes, catalogue grants or provisioning defaults were changed.

## Decisions and scope adjustments

1. Followed the approved contract-gap record and 02-CONTEXT.md: registration is the sole binding workflow; existing fixtures that removed service protection, grants or bindings now expect refusal. Protected human fixtures use the narrow maintenance operation. Fixtures load registration/context functions from the same compiled server modules as Strapi; separate private context copies do not share authority.
2. Included the provisioner's Document Service linkage call now, because sourced writes need a trusted linkage operation that continues through the new ownership guard. The rest of the provisioner/outbox work remains assigned to later plans; no worker or lifecycle delivery work was added here.
3. Added inverse Function/Application checks because those relations can invalidate the service's approved sole Function without changing its user-side Role membership.
4. Updated the three affected earlier IAM test files, in addition to the named source-registration tests. Physical constraint races intentionally boot a copied schema-only fixture with the real invariant bootstrap, allowing those tests to exercise the database indexes independently of workflow authority. Migration compatibility still boots the real application. No production switch disables the ownership guard.
5. Introduced the shared parser alongside the guard to avoid a duplicate field mapping, then completed its focused DTO/outcome verification in Task 2.

## Remaining gates and handoff

- No unmet gate remains within 02-07. This summary covers the plan's contribution to MODEL-03, PROV-05 and PROV-07; it does not mark the whole phase or its requirements complete in tracking files.
- SQLite evidence does not establish distributed serialization. The mandatory independent-process shared-PostgreSQL proof remains 02-11; MySQL behavior has not been integration-tested here.
- The typed source service and source-scoped projections remain 02-08. Outbox/lifecycle behavior and the remaining transient-password handling remain later-plan work. No claim is made here that deactivation already queues durable remote work.
- The full backend suite was not run, as instructed; the orchestrator owns that gate and comparison with the known baseline.
- No commits, staging or Git write commands were performed. No Docker containers were started. Phase completion, STATE.md and ROADMAP.md updates remain with the orchestrator.
