---
phase: 03-strapi-scim-2-0-service
plan: "07"
subsystem: api
tags: [scim, throttling, parsing, authentication, logging]
status: complete
requires:
  - phase: 03-06
    provides: Private source bearer authority and independently committed activity
provides:
  - Bounded per-IP and per-source fixed-window budgets with strict startup settings
  - Pre-parser namespace boundary with safe media negotiation and SCIM errors
  - One canonical closed request event per namespace request
affects: [03-08, 03-09, 03-10]
tech-stack:
  added: []
  patterns: [bounded fixed windows, request-local media adaptation, closed structured events]
key-files:
  created:
    - apps/backend/src/iam/scim/config.ts
    - apps/backend/src/iam/scim/limiter.ts
    - apps/backend/src/middlewares/scim-boundary.ts
    - apps/backend/tests/iam-scim-limiter.unit.test.ts
    - apps/backend/tests/iam-scim-boundary.unit.test.ts
  modified:
    - apps/backend/config/middlewares.ts
    - docker/README.md
key-decisions:
  - Authenticate and independently persist activity once before source throttling and parsing
  - Reuse the installed parser and its existing 1 MiB JSON default without changing CSRM settings
  - Adapt only the request-local JSON media predicate because the installed parser has a fixed media list
requirements-completed: [MODEL-02, PROV-04, PROV-08]
coverage:
  - id: bounded-scim-budgets
    description: Strict startup settings, exact default budgets, fixed windows and bounded live buckets
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-limiter.unit.test.ts
        status: pass
    human_judgment: false
  - id: namespace-parser-error-boundary
    description: Authentication/activity ordering, media negotiation, body bounds and closed errors
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-boundary.unit.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-auth.integration.test.ts
        status: pass
    human_judgment: false
  - id: canonical-safe-request-events
    description: One safe request event including refusals with validated source, operation and target
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-boundary.unit.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 2
  files: 7
  commits: 4
duration: approximately 15 min
completed: "2026-10-15T16:20:05Z"
---

# Phase 3 Plan 07: Bounded SCIM namespace summary

SCIM requests now pass through bounded IP/source budgets, authentication and independent source activity before parsing, with safe protocol errors and exactly one canonical request event.

## Accomplishments

Executed only 03-07: two tasks, seven owned implementation/test/documentation files. Reconciled the shared middleware, source authority, activity, error and parser contracts against the locked context. Phase plan structure checks pass for all 18 plans with zero errors or warnings.

- Startup settings accept only positive safe integer decimal values. Defaults are 1200 requests/IP and 600 requests/verified source over 60 seconds. Live buckets are capped at 10,000 IPs and 1,000 sources; expired entries are removed, active entries are never evicted, and capacity refusal returns an integer ceil-seconds Retry-After to the earliest reset. Source budgets span operations. Docker documentation states the per-process single-instance scope and required aggregate enforcement before multi-instance deployment.
- The boundary follows the existing outer error middleware and precedes identity, security, CORS, query and body middleware. It covers the exact namespace, including unknown routes, and bypasses unrelated CSRM/lookalike paths. Ordering is IP budget, existing fresh bearer authentication plus independent activity, source budget, media checks, parser, then explicit route policy/handler. Existing source authority and grant policy are reused; no alternate authority or activity writer is introduced.
- The installed koa-body JSON media list is fixed and does not recognize application/scim+json through a configuration option. A request-local type predicate adds that recognition while preserving actual headers and URLs. POST/PUT/PATCH retain the existing parser and its 1 MiB default; other methods with bodies use the same installed parser through a local method view. This also bounds chunked GET/DELETE/OPTIONS bodies without changing the real method or CSRM parser configuration. The predicate is restored in finally.
- Safe errors cover malformed syntax, oversize 413, media 415/406, credentials 401, grants 403, hidden/unknown targets 404, throttling 429, unsupported writes 501 and unexpected 500/503. Known SCIM error types are reconstructed from a closed vocabulary. Nonempty responses use application/scim+json, and 204 responses are empty. Logs contain only the fixed event, verified source or null, safe method/template or namespace, allowlisted target, closed outcome, status and a server-generated requestId. Activity failure retains its distinct event.

The requirement identifiers in frontmatter describe this plan's contributions. Shared requirement acceptance remains pending the sibling implementation/evidence plans; REQUIREMENTS.md is unchanged.

## Task commits

1. `bd3e5487` — `test(iam): specify bounded SCIM rate limits and startup settings`.
2. `5ee57812` — `feat(iam): bound SCIM budgets and validate startup limits`.
3. `7cad2d78` — `test(iam): specify SCIM parser ordering errors and safe request logs`.
4. `cfb6bf35` — `feat(iam): wrap SCIM parsing errors throttling and request logs`.

Summary and tracking updates are committed separately. The first task commit was recorded at 2026-10-15T16:11:41Z; completion is the timestamp above.

## Verification

Commands ran from repository root with the supplied Node/pnpm installation prepended to PATH.

| Check | Result |
| --- | --- |
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| Production `pnpm --dir apps/backend exec tsc --pretty false` | Pass; exit 0 |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-07.json --pretty false` | Pass; exit 0; both named compiled outputs exist |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-limiter.unit.test.js` | 5/5 pass; zero failures/skips |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-boundary.unit.test.js` | 13/13 pass; zero failures/skips |
| Affected regression command below | 84/84 pass; zero failures/skips; about 61 seconds |
| Production Document Service write inventory | Pass; 267 source files covered |
| `git diff --check` | Pass |

```sh
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-auth.unit.test.js .tmp/tests-dist/tests/iam-scim-auth.integration.test.js .tmp/tests-dist/tests/iam-scim-wire.unit.test.js .tmp/tests-dist/tests/keycloak-identity.unit.test.js .tmp/tests-dist/tests/cors-allowed-origins.unit.test.js .tmp/tests-dist/tests/cors-allowlist.integration.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js
```

The ignored compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. This is not a deviation. The normal compiler config and excluded tests are unchanged. The full backend gate remains with the orchestrator.

Boundary tests use the installed Strapi body middleware with real Koa HTTP streams and isolated source persistence doubles. They prove exact 1 MiB acceptance and one-byte overflow; chunked overflow on POST/PUT/PATCH/GET/DELETE/OPTIONS; activity before parser/media/grant/source-limit refusals; no activity before invalid authentication/IP refusal; closed error types; one safe event; malicious token/source hints and query rejection from logs; validated target/schema identifiers; compatible JSON; DELETE 204; and unchanged CSRM JSON/form behavior. Existing real-persistence authentication and CORS integration suites also pass. This is namespace middleware evidence, not mounted SCIM lifecycle or live connector evidence.

## Deviations and implementation notes

- The tests were committed before implementation. Their initial baselines failed compilation on the absent planned modules, rather than producing semantic red assertions. Final required behavior checks all pass; this is a test-first process limitation, not a weakened acceptance test.
- The installed parser requires request-local media adaptation rather than an extendTypes setting. Its method enum excludes OPTIONS; a local parser view bounds those bodies while preserving the actual method. Both choices preserve P3-06 and the existing CSRM parser contract; no dependency was added.
- The explicit execution request overrides the plan's worker-only instruction to leave STATE.md and ROADMAP.md untouched. Both are updated for 03-07 only.

Initial boundary runs exposed an overly broad lookalike-path predicate in the test harness and the installed parser's restricted method enum. Both were corrected without reducing any assertion or required behavior.

No content-type schema, generated content-type declaration, physical index, JDL, dependency or catalogue changed. Committed activation examples retain false IDAMBOX_KEYCLOAK_PROVISIONING, IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION and CSRM_AUTH_OIDC_ENABLED. No live credential was used, and the local Docker environment file was never read, printed or written.

## Remaining gates and stop boundary

Phase 3 remains in progress at 7/18 plans. 03-08 through 03-18 remain unstarted. Root route registration, discovery handlers, mounted lifecycle/security integration, genuine connector capture/replay, live outage/browser proof, later review/security audits and the full final gate remain pending their assigned plans. Stopped after 03-07 as requested.

## Self-check

All seven owned artifacts exist, the four task commits are present, required scoped compilation and both named behavior suites pass, affected regressions pass, and tracking stops before 03-08.
