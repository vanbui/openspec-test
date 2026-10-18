---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "05"
status: complete
requirements: [MODEL-01, PROV-05]
completed: 2026-10-14
verification: targeted-passed-full-suite-baseline-failure
---

# 02-05 Summary: Source service principal and human access isolation

Executed only plan 02-05 (wave 5). All changes remain uncommitted for orchestrator review. No Git write commands or Docker containers were started. STATE.md and ROADMAP.md were not updated.

## Delivered

- `apps/backend/src/iam/identity/source-principal.ts` provides a privately constructed, frozen SourcePrincipal. A module-private WeakMap binds issued object identities to their backend instance; copied, fabricated and cross-instance capabilities fail validation. Resolution and validation reread the active source, active protected manual service user, credential/subject absence, exact provisioning Role and Function, active IAM Application and unique persisted binding. Changed bindings invalidate existing principals.
- Persisted-binding helpers classify services independently of source activity, protection or grant validity. The bulk helper pages explicitly and deduplicates document IDs, so default query limits cannot silently admit registered services to future people selectors.
- `loadEffectiveGrants` freshly checks binding, suppresses Requestor birthright and unrelated explicit roles for services, and exposes the server-derived service discriminator. The CSRM policy denies registered services before route grants or scopes; the human analyst helper also refuses them. Protected people retain their existing birthright and explicit grants.
- The shared eligible-person predicate accepts the binding discriminator and excludes services without treating protection or the provisioning role name as proof of service status.
- Normal bootstrap awaits the existing opt-in source seed after catalogue seeding and before dependent fixtures. Committed provisioning, token-verification and seed defaults are unchanged.
- Real Strapi persistence tests cover stale/copied principals, inactive source/service, missing protection, credentials/subject, absent or multiple roles/functions, invalid Function menu or Application status, binding replacement/deletion, protected people, ordinary people and unbound provisioning-role holders. Four normal bootstrap/restart runs cover provisioning off/on, one reused source and zero remote requests.
- Existing direct-policy fixtures now explicitly return an empty source-binding result; existing effective-grant fixtures declare their human discriminator. Assertions and production fail-closed behavior remain intact.

## Decisions and scope

- Followed the approved contract and P2-07/P2-08/P2-10/P2-11: persisted IdentitySource.serviceUser binding determines non-human status, even when principal validation refuses that service. Neither protection nor role name alone determines it.
- Resolution is a trusted internal backend seam only. A null tokenHash authenticates no bearer request; this plan introduces no token authentication, HTTP route or identity-header population.
- Deny registered services at the entire CSRM policy boundary, including malformed extra human grants, while retaining their provisioning Role in the internal effective-grant calculation. Protected human access remains unchanged.
- People-selector query/count/paging exclusions and submitted-person validation remain plan 02-06 responsibilities. This plan supplies their binding helpers and shared discriminator without executing the next wave.
- Tests were written first. Initial compilation reported the absent principal module and new discriminator plus test fixture typing errors; the typing errors were corrected before successful compilation. No runtime red-stage or commit-based test-cycle proof is claimed.
- The first focused unit regression run exposed mocks that rejected the newly required source lookup. Those mocks were updated explicitly rather than catching persistence failures in production. The rerun passed all 74 tests.

## Verification

Commands ran from the repository root using installed dependencies and isolated local test databases/fake servers.

| Check | Actual outcome |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Pass, exit 0; named tests emitted |
| Plan's named three-file integration command below | Pass, exit 0; 29 tests, 29 passed, 0 failed/cancelled/skipped |
| Focused policy, identity and assignment unit regression command below | Pass, exit 0; 74 tests, 74 passed, 0 failed/cancelled/skipped |
| `pnpm --dir apps/backend test` | Non-green, exit 1; 1,657 tests, 1,655 passed, 1 failed, 1 skipped, 0 cancelled; about 70 minutes |
| `git diff --check` | Pass |

Named integration command:

```powershell
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-service-isolation.integration.test.js .tmp/tests-dist/tests/iam-source-registration.integration.test.js .tmp/tests-dist/tests/authorization.integration.test.js
```

Focused unit regression command (preceded by the successful test compilation):

```powershell
pnpm --dir apps/backend exec node --test .tmp/tests-dist/tests/authorization-policy.unit.test.js .tmp/tests-dist/tests/analyst-insight-authorization.unit.test.js .tmp/tests-dist/tests/keycloak-identity.unit.test.js .tmp/tests-dist/tests/request-assignment.unit.test.js
```

## Remaining gates

All named plan checks passed. The full backend suite ran ordinary CSRM policy, assignment, risk and administration regressions alongside the source tests. Its sole failure is the previously recorded attachment context-size case: two 20,000-character included files should produce CONTEXT_TOO_LARGE, but the upload reports fetch failed / read ECONNRESET. This matches the scenario and error in .planning/WINDOWS.md and the pre-phase STATE.md baseline. No new failing test was observed. The full-suite gate remains non-green; no waiver or baseline fix is claimed. Its existing skip does not affect the plan's named integration checks, which had zero skips.

Live outage and shared PostgreSQL concurrency proofs remain later phase obligations. No phase verification, phase completion or tracking update was performed. Changes are unstaged and uncommitted; no schemas, dependency manifests, defaults, STATE.md or ROADMAP.md changed.

Next scoped plan is 02-06 (wave 6); it was not started.
