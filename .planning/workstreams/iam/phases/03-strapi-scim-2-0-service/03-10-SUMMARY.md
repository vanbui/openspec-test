---
phase: 03-strapi-scim-2-0-service
plan: "10"
subsystem: testing
tags: [scim, conformance, lifecycle, source-isolation, security]
status: complete
requires:
  - phase: 03-09
    provides: Mounted source-scoped SCIM operations and the real HTTP harness
provides:
  - Persisted HTTP lifecycle, mapping, query, claim, rollback and retained-reference conformance
  - Fresh credential and binding enforcement with safe parser, activity, throttle and request-log ordering
  - Regression proof for connector compatibility, provisioning and worker fencing
affects: [03-11, 03-13, 03-14, 03-15, 03-16, 03-18]
tech-stack:
  added: []
  patterns: [isolated mounted HTTP conformance, in-memory event observation, fake-Keycloak HTTP]
key-files:
  created:
    - apps/backend/tests/iam-scim-lifecycle.integration.test.ts
    - apps/backend/tests/iam-scim-security.integration.test.ts
  modified:
    - apps/backend/tests/helpers/iam-scim-http-harness.ts
key-decisions:
  - Preserve P3-33 through P3-35, including asserted-attribute PUT and string-primary email PATCH
  - Compare complete persisted user state and source binding separately from independently committed source activity
  - Prove the existing database binding constraint without altering an index or schema
requirements-completed: ["MODEL-02","PROV-01","PROV-02","PROV-03","PROV-04","LIFE-03"]
coverage:
  - id: persisted-http-lifecycle
    description: Mapping, birthright, source visibility, claims, ordered and concurrent PATCH, bounded queries, conflicts, rollback and retained references
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-lifecycle.integration.test.ts
        status: pass
    human_judgment: false
  - id: security-boundary-ordering
    description: Fresh binding/grants/tokens, safe errors and exactly-one request log, independent activity, sync/token timestamps and both throttle budgets
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-security.integration.test.ts
        status: pass
    human_judgment: false
  - id: compatibility-and-fencing
    description: Existing connector behavior, source ownership, provisioning, durable outbox and stale-worker fencing remain green
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-keycloak-sync.integration.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-identity.integration.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-routes.integration.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/keycloak-provisioning.unit.test.ts
        status: pass
      - kind: command
        ref: pnpm --dir apps/backend exec tsc --pretty false
        status: pass
    human_judgment: false
actuals:
  tasks: 2
  files: 3
  commits: 3
duration: approximately 18 min
completed: "2026-10-15T20:54:35Z"
---

# Phase 3 Plan 10: HTTP conformance summary

Real mounted HTTP and persistence assertions prove the source lifecycle and security boundary while preserving the pinned connector's current behavior.

## Accomplishments

- Lifecycle suite: fixed Core/Enterprise mapping, persisted roles=[] with effective birthright Requestor, private write/projection refusals, source/protected/manual visibility, explicit keyed PUT claim, id echo validation, immutable keys, omitted-field preservation and explicit clearing. PATCH covers casing, pathless/name/Enterprise changes, primary/value email selectors, string-primary remove-then-add, one persisted mutation, later-operation rollback and concurrent deltas. Queries cover escaped opaque keys, case-insensitive supported fields, exact externalId, eq/and, 20/21-term and value/text bounds, paging normalization, repeated/unknown/sort parameters and safe projections.
- Fake-Keycloak HTTP verifies active/inactive creates, mirrored updates, safe blocking failures with Retry-After 30 and unchanged user/ownership/lastSyncedAt/outbox, failed reactivation and cancelled work on success. Inactive PUT/PATCH commits HR and pending work with zero synchronous remote calls. Queue failure rolls back deletion. Tombstones retain their original deletion time, tuple, roles, subject and real request/risk/system-owner relations without invoking delete.
- Security suite withdraws persisted source/service/application invariants and operation grants between successful requests, proves rotation/revocation freshness and human/development/API-token isolation, and exercises malformed JSON, 1 MiB overflow, 101 PATCH operations, 415/406/500/404/501 and both 429 budgets. Every tested SCIM response has the safe envelope/media or bodyless 204 and exactly one closed request event. Mutation and token events remain separate. Activity commits before later refusals and rollback, stays unchanged for invalid credentials/preauth IP denial, and fails closed on storage failure. Clock-injected cap cleanup, trusted socket IP behavior and the unchanged CSRM form parser are asserted.

Only 03-10 was executed. Current shared-backend history and the live-probe amendments were reviewed; all 18 phase plan structures were rechecked and passed without errors or warnings. The three owned test/helper files are the only implementation changes. No production, schema, generated declaration, physical index, JDL, dependency or configuration changes were needed.

## Task commits

| Task | Commit | Result |
| --- | --- | --- |
| 1 — Lifecycle and persisted observation | `384faaa5` — test(iam): prove scoped SCIM lifecycle and persisted rollback | 9/9 pass |
| 2 — Security boundary and ordering | `851af80b` — test(iam): verify SCIM security freshness and boundary ordering | 8/8 pass |

The plan adds conformance over landed behavior, so no production implementation change or manufactured failing production commit was necessary. Initial test runs exposed fixture assumptions: populated source activity must not be part of an unchanged-user snapshot; a manual claim fixture must be created with the isolated provisioning middleware off before faulting its first remote create; upstream email retry recovery is established Phase 2 behavior. Final assertions retain complete user state and separately prove committed activity. Editing test files also triggered the running development server's shared-output rebuild; finishing edits before serial test startup resolved transient missing-module setup failures. Failed test processes were cleaned up; the development server and identity stack were not stopped.

## Verification

Commands ran from the repository root with the supplied Node/pnpm directory prepended to PATH.

| Check | Result |
| --- | --- |
| All 18 phase plan structure checks | Valid; zero errors/warnings |
| `pnpm --dir apps/backend exec tsc --pretty false` | Pass, exit 0 |
| `pnpm --dir apps/backend exec tsc -p .tmp/iam-03-10-tests.json --pretty false` | Pass, exit 0; both named compiled tests exist |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-lifecycle.integration.test.js` | 9/9 pass, zero failures/skips; approximately 41 seconds |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-security.integration.test.js` | 8/8 pass, zero failures/skips; approximately 64 seconds |
| Focused unit selection below | 117/117 pass, zero failures/skips; approximately 15 seconds |
| Persistence/provisioning selection below | 65/65 pass, zero failures/skips; approximately 102 seconds |
| Production Document Service write inventory | Pass; 271 source files covered |
| `git diff --check` | Pass |
| Committed activation defaults | Provisioning, token verification and OIDC flags remain false; configuration unchanged |

The ignored compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. This is not a deviation. The ordinary config and both tests remain untouched. All 199 selected tests pass without skips; the full backend gate remains with the orchestrator.

Focused unit files, each run from `.tmp/tests-dist/tests/` using the same Node test flags: `iam-scim-wire.unit.test.js`, `iam-scim-query.unit.test.js`, `iam-scim-patch.unit.test.js`, `iam-scim-boundary.unit.test.js`, `iam-scim-limiter.unit.test.js`, `iam-scim-auth.unit.test.js`, `iam-scim-discovery.unit.test.js`, `iam-keycloak-sync-worker.unit.test.js`, `iam-schema-contract.unit.test.js`, `iam-write-discipline.unit.test.js`.

Persistence/provisioning files with the same flags: `iam-scim-routes.integration.test.js`, `iam-identity.integration.test.js`, `iam-keycloak-sync.integration.test.js`, `keycloak-provisioning.unit.test.js`. These retain roles-only/nonmirrored/off-mode behavior, lease generations, stale transitions, retries, reactivation ordering and shutdown recovery.

## Deviations and contract reconciliation

1. The owned HTTP helper already existed from 03-09. Extended it instead of recreating it: isolated limits, raw bodies, safe event observation and failed-setup cleanup; all persistence continues through the existing running backend.
2. The original P3-13 clearing rule is superseded. PUT tests follow P3-34 asserted-attribute merging and explicit null clearing; P3-33 compatibility and P3-35 email PATCH behavior remain green.
3. The existing unique service-binding constraint prevents persisting a duplicate binding. The suite asserts that database rejection and preserves the original valid binding, rather than changing the frozen schema/index. Withdrawable binding invariants still prove next-request generic 401 over HTTP.
4. Source-record username/email/tuple conflicts return 409 after rollback. A remote-only username collision remains the existing Phase 2 `keycloakUnavailable` outcome (safe 503/Retry-After 30), with no local persistence or adoption of the unrelated remote account. Existing email-based remote retry recovery remains unchanged.

No production deviation was required. STATE.md and the ROADMAP.md checkbox/count were updated as explicitly requested. The frontmatter records this plan's six requirement contributions; the readiness query returned 0/6 because later sibling plans still declare them, so REQUIREMENTS.md remains pending.

## Self-Check: PASSED

Both named suites exist, compile and pass with no skipped behavior; both task commits are present. Only the three owned test/helper files and this plan's requested tracking artifacts changed. Inputs are authored fictitious conformance data, never connector captures. No token, secret, binary or attribution trailer was committed.

## Stop point

03-10 is complete. Phase 3 is 10/18 plans complete. 03-11 through 03-18 remain unstarted; live capture/replay, refusal/outage/browser proof, inventory/contract changes, review/security audit and the final full gate remain pending their later plans. No live checkpoint or port-1337 test listener was started. Stop before 03-11.
