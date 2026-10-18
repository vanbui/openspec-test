---
phase: 03-strapi-scim-2-0-service
plan: "06"
subsystem: auth
tags: [scim, source-authority, operation-grants, activity, transactions]
status: complete
requires:
  - phase: 03-05
    provides: Existing private source authority, source tokens and locked identity mutations
provides:
  - Request-local bearer authentication separate from CSRM identity
  - Explicit policy with fresh exact operation grants and current credential checks
  - Independently committed source activity with closed persistence failures
affects: [03-07, 03-09, 03-10]
tech-stack:
  added: []
  patterns: [private request authority, fresh persisted grants, independent Document Service transaction]
key-files:
  created:
    - apps/backend/src/iam/scim/source-context.ts
    - apps/backend/src/iam/scim/source-activity.ts
    - apps/backend/src/policies/scim-source-bearer.ts
    - apps/backend/tests/iam-scim-auth.unit.test.ts
    - apps/backend/tests/iam-scim-auth.integration.test.ts
  modified: []
key-decisions:
  - Reuse the existing principal validator without constructing or copying authority
  - Bind server-created authority to the request object and backend instance through a private WeakMap
  - Commit activity before grants and later user transactions; reject ambient transactions safely
requirements-completed: []
requirements-addressed: [MODEL-02, PROV-02, PROV-04]
coverage:
  - id: fresh-source-request-authority
    description: Exact bearer credentials, private source context, current binding and exact operation grants
    requirement: MODEL-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-auth.unit.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-auth.integration.test.ts
        status: pass
    human_judgment: false
  - id: independent-source-activity
    description: Persisted activity before grant denial and later rollback, unchanged user timestamps, closed storage failure
    requirement: PROV-04
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-auth.integration.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  files: 5
  commits: 2
duration: approximately 10 min
completed: "2026-10-15T16:08:41Z"
---

# Phase 3 Plan 06: Source bearer authentication and activity summary

Source bearer requests receive private request-local authority only after exact credential verification, fresh source/service validation and an independently committed activity update. The explicit policy rechecks current credentials, binding and the exact operation grant.

## Accomplishments

Executed only 03-06: one task and five owned implementation/test files. Reviewed the current shared backend, existing source validator, token service, CSRM authorization and locked context. All 18 phase plan structures were rechecked and passed without errors or warnings.

- `source-context.ts` accepts only the exact Bearer credential grammar and reuses token parsing/digest verification and `resolveSourcePrincipal`. Invalid, absent, revoked and broken-binding credentials share one closed 401 envelope and `WWW-Authenticate: Bearer`. Authority lives in a private WeakMap keyed by the server request, bound to the backend instance. The Koa context and policy wrapper can share that request; caller-controlled state and copied requests cannot mint authority. Authentication never populates `idamboxUser` or reads source hints as authority.
- `requireSourceOperation` rereads the token hash and validates the privately issued principal, then loads Role → Function → FunctionAPI with the active `idambox-iam` Application and matches the configured canonical method/template exactly. Both original and current digest checks use the existing fixed-buffer verifier. Missing operation grants produce closed 403 responses. Direct policy calls without verified request context fail with 401, even when a bearer is supplied.
- `source-activity.ts` updates only `lastActivityAt` through Document Service in its own transaction before grants, parsing or source-user work. It refuses an ambient transaction rather than accidentally joining a later rollback. Persistence failure rolls back its own update, logs only a closed failure event, returns safe 500 and issues no request authority. Authentication never updates user `lastSyncedAt` or token lifecycle metadata.
- Tests cover invalid credential grammar, unrelated human/API credentials and development headers, source/service invariants, copied/forged context, instance binding, exact operation grants, token rotation/revocation, current grant revocation, inactive binding/application, cross-source refusal and CSRM service/person separation. Real isolated Strapi/SQLite persistence proves activity survives later grant denial and source-mutation rollback while the whole user, including its sync timestamp, remains unchanged.

## Task commits

1. `4413a391` — `test(iam): specify source bearer authority and independent activity`.
2. `b09eed0e` — `feat(iam): authenticate source requests and commit activity independently`.

Summary and tracking updates are committed separately after these task commits.

## Checks performed

Commands ran from repository root with the supplied Node/pnpm installation prepended to PATH.

| Check | Result |
|---|---|
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| Test-first baseline | Failed on absent source-context/policy modules before implementation; fixture typing was corrected during implementation |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-06.json --pretty false` | Pass; exit 0; both named compiled tests present |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-auth.unit.test.js .tmp/tests-dist/tests/iam-scim-auth.integration.test.js` | 13/13 pass: 7 unit and 6 real-persistence integration tests; zero failures/skips; about 19 seconds |
| Affected source-registration, service-isolation, token, authorization, identity and write-discipline regressions | 99/99 pass; zero failures/skips; about 116 seconds |
| Production Document Service write guard | Pass; 264 source files covered |
| `git diff --check` | Pass |
| Frozen schema/generated declarations/JDL and committed activation examples | Unchanged |

Regression command:

```sh
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-source-registration.integration.test.js .tmp/tests-dist/tests/iam-service-isolation.integration.test.js .tmp/tests-dist/tests/iam-scim-token.unit.test.js .tmp/tests-dist/tests/iam-scim-token.integration.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js .tmp/tests-dist/tests/authorization-policy.unit.test.js .tmp/tests-dist/tests/iam-identity.integration.test.js
```

The ignored temporary compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. This is not a deviation. The ordinary compiler config and excluded tests were not edited. The full backend gate remains with the orchestrator.

Downstream 400/404/429 failures are injected around a real source PATCH transaction to prove independent activity and user rollback. Actual parser/IP-budget/source-budget HTTP sequencing is verified after those boundaries exist, in the later namespace plans as specified by 03-06. This summary claims helper/policy and persisted-state evidence, not mounted HTTP or live-stack evidence. Existing token lifecycle regressions also pass without modifying activity.

Early integration runs exposed the existing protection against corrupting registered services through ordinary writers. The final fixtures deliberately corrupt only their isolated database, restore the binding/application/service before later tests, and retain every refusal assertion. No production protection or test expectation was weakened.

## Deviations from Plan

None in implementation or required scoped acceptance. The explicit execution request overrides the plan's worker-only instruction to leave STATE.md and ROADMAP.md untouched; both are updated for 03-06 only.

No content-type schema, generated declaration, physical index, JDL, dependency, catalogue or committed configuration changed. `IDAMBOX_KEYCLOAK_PROVISIONING`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` and `CSRM_AUTH_OIDC_ENABLED` remain false in committed activation examples. No live credentials were used. The local Docker environment file was never read, printed or written.

## Remaining gates and stop boundary

03-07 through 03-18 remain unstarted. HTTP namespace routing, pre-auth IP rejection, real source throttling/parser failures, connector capture/replay, live refusal/browser evidence, review/security audit and the full regression gate remain assigned to their later plans. The shared requirements remain pending until their sibling implementation and evidence plans complete. Phase 3 remains in progress at 6/18 plans. Stopped after 03-06 as requested.

## Self-Check

Passed: all five owned artifacts exist; both task commits are present; required scoped compilation and named behavior tests pass; affected regressions and the production write guard pass. Tracking records stop before 03-07.
