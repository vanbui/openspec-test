---
phase: 03-strapi-scim-2-0-service
plan: "05"
subsystem: auth
tags: [scim, patch, transactions, source-isolation, rollback]
status: complete
requires:
  - phase: 03-04
    provides: Scoped identity queries and the existing fixed public projection
provides:
  - Ordered bounded PatchOp reduction over source-owned public fields
  - Typed server-only read/reduce/write seam inside the shared identity lock
  - Executable concurrency, atomicity, rollback and DTO compatibility checks
affects: [03-09, 03-10, 03-13, 03-14]
tech-stack:
  added: []
  patterns: [locked pure reduction, closed protocol failures, single validated mutation]
key-files:
  created:
    - apps/backend/src/iam/scim/patch.ts
    - apps/backend/tests/iam-scim-patch.unit.test.ts
    - apps/backend/tests/iam-scim-patch.integration.test.ts
  modified:
    - apps/backend/src/iam/identity/identity-service.ts
key-decisions:
  - Keep protocol path, noTarget and mutability failures distinct from identity invalidInput
  - Reduce only after the shared lock and fresh principal and ownership checks
  - Keep overloads preserving existing IdentityPatchInput callers and outcome types
requirements-completed: ["PROV-03"]
coverage:
  - id: ordered-patch-protocol
    description: Case-insensitive ordered operations, supported paths, selectors, exact values and bounded validation
    requirement: PROV-03
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-patch.unit.test.ts
        status: pass
    human_judgment: false
  - id: locked-source-mutation
    description: One mutation, fresh concurrent projections, scope isolation, retained Roles and DTO compatibility
    requirement: PROV-03
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-patch.integration.test.ts
        status: pass
    human_judgment: false
  - id: atomic-failure-and-leaver-path
    description: Failed operations and remote updates leave state unchanged; uniqueness follows rollback and deactivation commits pending outbox work
    requirement: PROV-03
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-patch.integration.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  files: 4
  commits: 2
duration: approximately 9 min
completed: "2026-10-15T15:57:53Z"
---

# Phase 3 Plan 05: Atomic SCIM PATCH summary

Ordered SCIM PATCH batches reduce against the fresh source projection under the existing database user lock, then validate and write one DTO delta through Document Service.

## Accomplishments

Executed only 03-05: one task and four owned implementation/test files. Earlier summaries were treated as completed work. Reviewed the current shared backend, source authority, user lock, write context, input parser and locked context. Reran structure checks on all 18 phase plans: valid, no errors or warnings.

- `patch.ts` validates the exact PatchOp URN and 1..100 operations. It supports add/remove/replace with case-insensitive operation/path spelling, pathless object values, name subattributes, Enterprise objects/qualified fields, email arrays and primary/value selectors with JSON string escaping. String values and source keys retain their exact contents. Optional removes clear values; required removes, changed source keys, unsupported/private paths, malformed values and unmatched selections return closed failures without a partial delta. Email operations must resolve to the single-primary projection; secondary addresses are not persisted or available to later selectors.
- `identity-service.ts` accepts a discriminated server-only reduction request alongside existing DTO callers. Only the locked, freshly authorized and scoped projection reaches the reducer, frozen and without private fields or Roles. The final shared patch parser validates its result before one `runSourceMutation` update. Existing DTO overloads retain their outcome types and malformed runtime inputs still fail safely. The reducer cannot widen the writer's allowlist.
- Real isolated Strapi/SQLite tests prove one accepted mutation, retained Roles, concurrent independent deltas using fresh projections, hidden foreign/manual/protected/tombstoned targets and revoked source refusal. Later failure leaves the whole user, timestamps and outbox unchanged. A real duplicate-email write probes uniqueness only after `inTransaction()` becomes false; blocking Keycloak failure rolls back all fields, while inactive PATCH commits durable pending disable/logout work through the existing outbox.

## Task commits

1. `97da83b1` — `test(iam): specify atomic source-scoped PATCH reduction`.
2. `669ba7c6` — `feat(iam): reduce ordered PATCH under the shared identity lock`.

Summary/state/roadmap updates are committed separately as plan metadata.

## Checks performed

Commands ran from repository root with the supplied Node/pnpm installation on PATH.

| Check | Result |
|---|---|
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| Test-first baseline | Compilation failed on the absent PATCH module; no compiled named unit test existed before implementation |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-05.json --pretty false` | Pass; final exit 0, both named compiled tests present |
| pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-patch.unit.test.js .tmp/tests-dist/tests/iam-scim-patch.integration.test.js | 13/13 pass: 7 unit, 6 real-persistence integration; zero failures/skips; final run about 16 seconds |
| Affected identity/input, wire/query and write-discipline regressions | 83/83 pass; zero failures/skips; about 75 seconds |
| Production Document Service write guard | Pass; 261 source files covered |
| `git diff --check` | Pass |
| Frozen schema/config scope | Only the four owned implementation/test files changed; activation examples remain false |

Regression command:

```sh
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-identity.integration.test.js .tmp/tests-dist/tests/iam-identity-input.unit.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js .tmp/tests-dist/tests/iam-scim-wire.unit.test.js .tmp/tests-dist/tests/iam-scim-query.unit.test.js .tmp/tests-dist/tests/iam-scim-query.integration.test.js
```

The ignored temporary compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. This is the requested WINDOWS.md entry 11 procedure, not a deviation. Neither excluded test nor the ordinary compiler config changed. The full backend gate remains with the orchestrator.

Acceptance checks pass for locked deciding reads, one accepted write, concurrency, ordered/cased operations and selectors, exact immutable keys, rollback, post-rollback uniqueness, blocking remote failure, retained Roles and existing DTO callers. No content-type schema, generated declaration, physical index, JDL, dependency, catalogue or committed configuration changed. `IDAMBOX_KEYCLOAK_PROVISIONING`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` and `CSRM_AUTH_OIDC_ENABLED` remain false in committed activation examples. No live credentials were used; `docker/.env` was never read, printed or written.

## Deviations from Plan

None in implementation or required acceptance. The explicit execution request overrides the plan's worker-only instruction to leave STATE.md and ROADMAP.md untouched; both are updated for 03-05 only. No tests were weakened and no unrelated modules or tests were changed.

## Remaining gates and stop boundary

03-06 through 03-18 remain unstarted. This plan does not claim mounted HTTP lifecycle, live connector capture/replay, browser/refusal, review/security audit, PostgreSQL concurrency evidence or full backend acceptance. PROV-03 remains pending in REQUIREMENTS.md because its sibling implementation and evidence plans remain incomplete. Phase 3 remains in progress at 5/18 plans. Stopped after 03-05 as requested.

## Self-Check

Passed: all four owned artifacts exist, both implementation commits are present, required compilation and named PATCH checks pass, and the workstream records stop after 03-05.
