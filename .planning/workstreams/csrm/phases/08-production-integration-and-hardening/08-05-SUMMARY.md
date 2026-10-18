---
phase: 08-production-integration-and-hardening
plan: 05
subsystem: api
tags: [strapi, authorization, idor, node-test, koa-helmet, helmet, users-permissions, error-envelope, logging]

requires:
  - phase: 08-production-integration-and-hardening
    provides: docs/references/served-operations.json and the harness accessors from 08-03 (listMountedContentApiRoutes, readUsersPermissionsAdvancedSettings); registration disabled at every boot (D-37, 08-03); the identifier bounds 08-04 declared in the contract
provides:
  - tests/authorization-policy.unit.test.ts: the fifteen policy proofs Node had been skipping, compiled and run on every suite run, plus three D-17 cases (a birthright-only Requestor is denied explicit analyst operations; a mis-granted Security Analyst Agent is refused the release a Security Analyst with the same grant is permitted; the My routes are owner-scoped for an analyst exactly as for a Requestor)
  - the Strapi test script runs only the compiled .tmp/tests-dist glob (the dead dist/tests argument is gone); the CommonJS policy file is deleted
  - tests/fixtures/authorization-matrix.ts and tests/authorization-matrix.integration.test.ts: 113 rows (76 served operations, 37 plugin routes) with 4 query variants, each stating the outcome for owner, other, analyst, serviceAgent, noIdentity and noToken; the completeness guard keyed to served-operations.json; the provenBy citation guard; the human-analyst-only guard; before/after persistence equality around every denied mutation; disclosure checks; owner-scoped totals for the three count-only My summaries
  - MISSING_TOKEN_STATUS_BY_FAMILY (D-51): 401 on a content-api-token route, 403 on a default-strategy route
  - harness additions: snapshot(getters), countUsersPermissionsUsers(), and the opt-in internal-error middleware keyed on x-csrm-test-internal-error (D-38)
  - tests/http-hardening.integration.test.ts: the bare 500 envelope from a forced error and from a production error path, helmet's headers on a 200, a 403 and a 500, X-Powered-By absent, and the sentinel proven absent from apps/strapi/src
  - config/middlewares.ts without strapi::poweredBy (D-39)
  - docs/security/strapi-http-hardening.md: the strapi::security review with a reason per setting, the error envelope, the body limits, CORS, the plugin surface and the logging review
affects: [08-10-web-headers, 08-11-browser-idor, 08-13-verification, 08-14-residual-register-and-gate, 08-SECURITY, any plan that mounts a Strapi route]

tech-stack:
  added: []
  patterns:
    - "Authorization matrix: one row per served operation keyed by its catalogue URL and one per mounted plugin route; a denial is always issued, a success only when the row may make it (exercisesAllowed), and every unexercised allowed path cites an existing test by file and title (provenBy)."
    - "A denied mutation is bracketed by a persistence snapshot of the records it targets, and the two halves must deep-equal."
    - "A count-only summary proves owner scoping through data.total (zero for an actor who owns nothing), because it carries no identifier a disclosure check could find."
    - "Test-only failure plumbing lives in the harness, keyed on a sentinel header, and a guard test scans apps/strapi/src for the sentinel."

key-files:
  created:
    - apps/strapi/tests/authorization-policy.unit.test.ts
    - apps/strapi/tests/fixtures/authorization-matrix.ts
    - apps/strapi/tests/authorization-matrix.integration.test.ts
    - apps/strapi/tests/http-hardening.integration.test.ts
    - docs/security/strapi-http-hardening.md
  modified:
    - apps/strapi/package.json
    - apps/strapi/config/middlewares.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/fixtures/authorization.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - .planning/phases/08-production-integration-and-hardening/deferred-items.md
  deleted:
    - apps/strapi/tests/authorization.policy.test.js

key-decisions:
  - "Every plugin route in the inventory gets a matrix row (37), not only the three D-37 names: deferred-items assigned 'a probe per pluginRoutes row' to 08-05, so the completeness guard keys all of them and a newly mounted plugin route fails the suite."
  - "The missing-token status is recorded per token family, not per route (D-51): the inventory's authStrategies decides it, 401 for the 52 content-api-token operations and 403 for the 24 default-strategy ones."
  - "An allowed path that would consume a one-shot fixture is not exercised; the row cites the existing mounted proof, and the guard checks the file contains the cited test title."
  - "The logging review records, but does not change, the operator's opt-in AI transcript diagnostic (CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS, default false), which logs prompts and responses carrying request and questionnaire content. Changing CSRM_AI_* behaviour is outside this plan; it goes to the residual register for an operator decision."
  - "CORS stays at Strapi's defaults (any Origin reflected with credentials) and is recorded, not changed: no browser calls Strapi, every CSRM route needs the server-held bearer token, and D-39 scopes this plan to strapi::security and strapi::poweredBy."
  - "INT-04 is listed as the plan's requirement but stays unchecked in REQUIREMENTS.md, following the 08-01 to 08-04 convention that the phase gate verifies it."

patterns-established:
  - "A new served operation or plugin route needs a matrix row stating all six outcomes, or the suite fails with MATRIX_ROW_MISSING_ or MATRIX_PLUGIN_ROW_MISSING_."
  - "A matrix denial of a mutation names the records it could have changed, through a persistence getter."

requirements-completed: [INT-04]

duration: about 1h 45m over two sessions
completed: 2026-09-25
---

# Phase 08 Plan 05: Authorization matrix and Strapi HTTP hardening Summary

**Every one of the 76 served operations and 37 plugin routes now has a stated, mounted-HTTP outcome for six callers, and a completeness guard fails on any route without one. Jane's request, questionnaire and assessment answer the other Requestor 403, 403 and 404 with nothing changed. The My routes count nothing for an analyst who owns nothing. The policy proofs Node had been silently skipping now run. Strapi answers an internal error with the bare 500 envelope only, no longer sends `X-Powered-By`, and its security middleware is documented setting by setting.**

## Performance

- **Duration:** about 1h 45m over two sessions: about 72 min in the first (2026-09-25T15:15Z after the 08-04 close, to the Task 3 RED commit `62accfb` at 16:27:33Z), then about 32 min to close (17:02:58Z to the metadata commit `d57fbcf` at 17:35Z)
- **Started:** 2026-09-25T15:15:18Z
- **Completed:** 2026-09-25T17:35Z (the metadata commit)
- **Tasks:** 3 of 3, each test-first (RED, then GREEN)
- **Files modified:** 12 source, test and doc files (5 created, 6 modified, 1 deleted), plus `deferred-items.md`

## Accomplishments

- **The dead policy proofs run.** `authorization-policy.unit.test.ts` ports all fifteen cases of the CommonJS file that `node --test` had been handed under a `dist/` path no build emits. It imports the policy and the collection helpers from `src`. Three D-17 cases are added: 18 cases, 18 passing, 0.25 s. The `test` script now runs only `.tmp/tests-dist/tests/*.test.js`: 40 compiled files for 40 source files, the policy unit titles present in the full-suite output.
- **The six-actor matrix.** 113 rows (8 assessment-request, 18 questionnaire, 12 assessment, 6 Risk, 3 ControlImplementation, 22 Administration, 2 reference-data, 5 analyst-insight, 37 plugin) and 4 query variants on the dual picker and Administration routes. 50 rows exercise their allowed path; 60 cite an existing proof through `provenBy`; 35 carry disclosure checks; 37 of the 41 served non-GET rows carry a persistence snapshot. The other four target a non-existent job in the in-memory registry (the two retries) or are reads sent over POST (the two `selected` selectors). 116 tests (113 rows and 3 guards), 116 passing, 29 to 33 s in isolation on this host (55 s on the first session's host).
- **Record-level rows (D-16, D-18 server half).** As the other Requestor: `GET /api/csrm-assessment-requests/{id}` 403, `PUT` 403, `GET /api/v1/questionnaires/{id}` 403, `PATCH …/answers` 403, `GET /api/v1/risk_assessments/{id}` **404** (never 403), `POST …/release` 403 (the policy refuses before the record is read). Every denial leaves the targets deep-equal, and no denial echoes a fixture title, an internal detail or another actor's documentId.
- **Birthright and agent scope (D-17).** The My list rows (`/csrm-assessment-requests`, `/v1/my_questionnaires`, `/v1/my_risk_assessments`) disclose no other actor's record to any actor, the analyst included. The three count-only summaries (`/v1/my_requests/status_summary`, `/v1/my_questionnaires/status_summary`, `/v1/my_risk_assessments/rating_summary`) answer the analyst and the service agent `total: 0` while both Requestors' totals are positive. Every human-analyst-only operation refuses the service agent, the owner and the other Requestor (11 operations, the literals checked against the policy source). The Risk Register and the Administration reads refuse the service agent as well.
- **The error envelope and headers (D-20, D-39).** A forced `Error` answers exactly `{ data: null, error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } }`, with no `stack` key at any depth and no internal text. So do the email plugin's provider failure and the assessment release's injected write failure. `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `nosniff`, `no-referrer` and the CSP are present on a 200, a 403 and a 500; `X-Powered-By` is gone.
- **Full gate.** Strapi 496 of 496 in 8.6 min; web 73 files and 884 tests; web typecheck, `api:check` and `cmp` clean; no content-type schema, policy, catalogue, specification or inventory change.

## Task Commits

1. **Task 1: Port the never-running policy proofs and add the D-17 cases (RED, then GREEN)**: `b5215dd` (test: the port, the three D-17 cases, the deleted CommonJS file, the test script; first run 17 of 18), `491d362` (test: the stale fail-closed expectation aligned with the error class it has thrown since 02-05; 18 of 18), `5be55c4` (test: the header comment no longer names the dead build path)
2. **Task 2: The six-actor matrix with its completeness guard and persistence proofs (RED, then GREEN)**: `78dd368` (test: the Phase 7 contract-catalogue literals aligned with the bounds 08-04 declared, found on the suite run the port triggered), `98bc34d` (test, RED: the row type, the guards, the first nine rows; the completeness and human-analyst guards failing on the missing rows), `e06a274` (feat, GREEN: every served operation and plugin route; 116 of 116), `539b66f` (test: owner-scoped totals for the three count-only My summaries, closing a gap found while verifying Task 2 in this session)
3. **Task 3: The bare 500 envelope, helmet headers, X-Powered-By and the security record (RED, then GREEN)**: `62accfb` (test, RED: the harness middleware, `http-hardening.integration.test.ts`, the exact envelope in the release failure; failing only on `X_POWERED_BY_SENT_200`), `7916838` (test: the sentinel pinned and scanned for under `apps/strapi/src`), `91cdac4` (feat, GREEN: `strapi::poweredBy` removed and `docs/security/strapi-http-hardening.md`)

**Plan metadata:** the `docs(08-05): complete authorization matrix and Strapi hardening plan` commit that carries this summary.

## TDD Gate Compliance

- **Task 1:** `b5215dd` is a port, not a new behaviour. The RED this task closes is the compiled-file gap itself (the file never ran). The first run was 17 of 18: one ported case expected wording that 02-05 had replaced. The three D-17 cases passed on first run, which the plan accepts for a port, because the policy already implemented them. No production code changed; `491d362` corrected the stale expectation (see Deviations).
- **Task 2:** `98bc34d` was observed RED for the right reason (`MATRIX_ROW_MISSING_…` for the unwritten rows and the human-analyst guard's missing rows; the nine written rows passing), then `e06a274` GREEN 116 of 116 with no source change: the matrix proves existing behaviour.
- **Task 3:** `62accfb` was observed RED in this session, on the plan's stated reason alone: `X_POWERED_BY_SENT_200`, actual `Strapi <strapi.io>`, with the two envelope cases passing. `91cdac4` is the GREEN: hardening 4 of 4, assessment-workflow 22 of 22, full suite 496 of 496.

## The matrix, against the inventory

| Measure | Value |
|---------|-------|
| Served operations in `served-operations.json` | 76 |
| Matrix rows keyed to a served operation | 76 (one each; `MATRIX_ROW_MISSING_`, `MATRIX_ROW_DUPLICATE_`, `MATRIX_ROW_UNSERVED_` all empty) |
| Plugin routes in the inventory | 37 |
| Matrix rows keyed to a plugin route | 37 (one each; `MATRIX_PLUGIN_ROW_MISSING_`, `MATRIX_PLUGIN_ROW_UNMOUNTED_` empty) |
| Query variants | 4 (`GET /v1/risk_types`, `/v1/controls`, `/v1/information_systems`, `/v1/information_assets` with the canonical Administration query) |
| Runtime in isolation | 29 to 33 s on this host (116 tests) |

**Missing-token status per family (D-51, observed on the first run and asserted since):**

| Token family (inventory `authStrategies`) | Served operations | Status without the token |
|------------------------------------------|-------------------|--------------------------|
| `["content-api-token"]` | 52 | 401 (no strategy left to answer) |
| `null` (Strapi's default strategies) | 24 | 403 (falls through to the users-permissions public role, which holds no CSRM permission) |

**Plugin route statuses (token holder / caller without the token, as recorded in the rows):**

| Route | Token holder | No token |
|-------|--------------|----------|
| `POST /api/auth/local/register` (well-formed body) | 400, user count unchanged | 400, user count unchanged |
| `POST /api/auth/local` (well-formed body) | 400 | 400 |
| `GET /api/users/me` | 401 | 403 |
| `GET /api/users`, `GET /api/users/count` | 200 | 403 |
| `POST /api/users` (with the Authenticated role) | **201** (an account is created in the throwaway database) | 403 |
| `GET /api/users/:id`, `DELETE /api/users/:id` (missing id) | 204 | 403 |
| `PUT /api/users/:id` (missing id) | 404, user count unchanged | 403 |
| `GET /api/users-permissions/permissions`, `GET /api/users-permissions/roles` | 200 | 403 |
| `POST /api/users-permissions/roles` | **200** (a role is created) | 403 |
| `GET`, `PUT`, `DELETE /api/users-permissions/roles/…` (missing id) | 404 | 403 |
| `POST /api/auth/forgot-password`, `POST /api/auth/send-email-confirmation` | 200 (no enumeration) | 200 |
| `GET /api/auth/:provider/callback`, `GET /api/connect/(.*)`, `GET /api/auth/email-confirmation`, `POST /api/auth/refresh`, `POST /api/auth/reset-password` | 400 | 400 |
| `POST /api/auth/change-password` | 400 | 403 |
| `POST /api/auth/logout`, `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:sessionId` | 401 | 403 |
| `GET /api/content-type-builder/components`, `…/content-types`, `GET /api/i18n/locales`, `GET /api/upload/files`, `GET /api/upload/files/page` | 200 | 403 |
| `GET /api/content-type-builder/components/:uid`, `…/content-types/:uid`, `GET`/`DELETE /api/upload/files/:id` (unknown) | 404 | 403 |
| `POST /api/upload` (no file) | 400 | 403 |
| `POST /api/email` (empty body) | 500, the bare envelope | 403 |

The bold rows are the measured D-37 residual: the full-access token can create users-permissions accounts and roles. It never leaves the web server, INT-02 replaces the surface, and the row is in `deferred-items.md` for the 08-14 residual register.

## The policy port

- **First-run result:** 17 of 18. Of the fifteen ported cases, fourteen passed as written. "Strapi fails closed when collection authorization state is absent or invalid" expected the Error wording "collection scope is denied", which commit `97a2f9e` (02-05) replaced with `AssessmentRequestQueryError` ("CSRM assessment request query is invalid.", answered as a safe 400). The three D-17 cases passed.
- **Policy drift:** none in `csrm-authorization.ts`. The one failure was a stale expectation in the file that never ran. The fail-closed behaviour it asserts is unchanged, and the case now asserts the error class and its constant message (`491d362`).

## The logging sweep (T-08-R10)

`grep -rn "strapi.log" apps/strapi/src` finds thirteen call sites; `console.*` finds none. Twelve write a constant, or a constant plus a seed identifier, a date or a count, and none writes a request body, token or personal data. The thirteenth is `logCompletionDiagnostic` in `csrm/openai-compatible-client.ts`. When an operator sets `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS=true` (default `false`, quick task 260917-kel), it logs the full prompts and model responses. Those carry request and questionnaire content, which can include personal data, but never credentials. It is recorded, not changed (see Decisions and Issues). Framework logging was reviewed too: `strapi::logger` writes query strings, so a user search term reaches the log, and `strapi::errors` logs unexpected errors in full on the server only. Every row is tabled in `docs/security/strapi-http-hardening.md` § Logging review.

## Files Created/Modified

- `apps/strapi/tests/authorization-policy.unit.test.ts`: the compiled port and the D-17 cases
- `apps/strapi/tests/authorization.policy.test.js`: deleted (never ran)
- `apps/strapi/package.json`: the `test` script runs only the compiled glob
- `apps/strapi/tests/fixtures/authorization.ts`: the fake assessment-request option widened to plain strings for strict typing
- `apps/strapi/tests/fixtures/authorization-matrix.ts`: the rows, the actor helpers, `MISSING_TOKEN_STATUS_BY_FAMILY`, `HUMAN_ANALYST_ONLY_OPERATIONS`, the leak and fixture-title patterns, `ownedRecordTotal`
- `apps/strapi/tests/authorization-matrix.integration.test.ts`: the guards and the per-row, per-actor loop
- `apps/strapi/tests/helpers/strapi-http-harness.ts`: `snapshot`, `countUsersPermissionsUsers`, the opt-in internal-error middleware and `INTERNAL_ERROR_HEADER`
- `apps/strapi/tests/http-hardening.integration.test.ts`: the sentinel guard, the two envelope proofs and the header proof
- `apps/strapi/tests/assessment-workflow.integration.test.ts`: the failed release asserts the exact envelope
- `apps/strapi/tests/contract-catalogue.integration.test.ts`: the Phase 7 component literals carry the bounds 08-04 declared
- `apps/strapi/config/middlewares.ts`: `strapi::poweredBy` removed
- `docs/security/strapi-http-hardening.md`: the Strapi section of the phase security record
- `.planning/phases/08-production-integration-and-hardening/deferred-items.md`: four 08-05 rows for the residual register

## Decisions Made

See `key-decisions` above. In short: every plugin route gets a row; the missing-token status is per token family; one-shot allowed paths are cited, not exercised; the AI transcript diagnostic and the CORS defaults are recorded for the residual register rather than changed; INT-04 stays unchecked until the phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Phase 7 contract-catalogue literals no longer matched the contract** (first session)
- **Found during:** Task 1 (the first full Strapi run after the port)
- **Issue:** 08-04 declared `minLength 1`/`maxLength 255` on five Phase 7 identifier properties but did not run the Strapi suite (dev servers were up), so two `contract-catalogue.integration.test.ts` cases still asserted the bare string shapes: 374 of 376.
- **Fix:** the literals state the declared bounds. **Files:** `apps/strapi/tests/contract-catalogue.integration.test.ts`. **Verification:** 16 of 16 in the file; the full suite green. **Commit:** `78dd368`

**2. [Rule 1 - Stale test] The ported fail-closed case expected pre-02-05 wording** (first session)
- **Found during:** Task 1 RED. **Issue:** see "The policy port". **Fix:** assert `AssessmentRequestQueryError` and its constant message; the fail-closed proof is unchanged. **Commit:** `491d362`

**3. [Rule 3 - Blocking] Strict typing of an owned fake request, and a stale path in a comment** (first session)
- **Issue:** `createAuthorizationStrapi` typed its option as the restricted request's literal type, so the port could not build an owned request under strict mode; the new file's header named the dead `dist/` path the acceptance check forbids.
- **Fix:** a `FakeAssessmentRequest` type in `tests/fixtures/authorization.ts` (outside the plan's file list); the header reworded. **Commits:** `b5215dd`, `5be55c4`

**4. [Rule 2 - Missing evidence] The count-only My summaries had no owner-scoping proof inside their bodies** (this session)
- **Found during:** the verification of Task 2 that this session began with
- **Issue:** the matrix asserted only a 200 for `my_requests/status_summary`, `my_questionnaires/status_summary` and `my_risk_assessments/rating_summary`; a count carries no identifier for `mustNotDisclose`, so "the analyst's My response contains only records the analyst owns" was unproven for the questionnaire and released-assessment summaries (the request summary had an existing every-actor proof).
- **Fix:** an `ownedRecordTotal` row field; the test reads `data.total` from every successful response: zero for the analyst and the service agent, positive for both Requestors.
- **Verification:** 116 of 116; sensitivity checked on the compiled output (expecting records for the analyst fails all three rows with `total: 0`; expecting none for the owner fails all three with a positive total). **Commit:** `539b66f`

**5. [Rule 3 - Acceptance] The hardening proof never named its sentinel header** (this session)
- **Issue:** the test imported `INTERNAL_ERROR_HEADER`, so the acceptance check for the literal `x-csrm-test-internal-error` in the file found nothing, and "no test-only middleware under `apps/strapi/src`" rested on a one-off grep.
- **Fix:** a case pins the header name and scans all 172 files under `apps/strapi/src` for it. **Verification:** 4 of 4; the scan was checked to read content (a known string finds 12 files). **Commit:** `7916838`

### Other deviations

- **Plugin rows: 37, not 3.** The acceptance count "served rows plus the three plugin rows" is exceeded by design: `deferred-items.md` (08-03 Task 2) assigned a probe per `pluginRoutes` row to 08-05, so the matrix has 76 + 37 = 113 rows and the guard keys all 37.
- **The logging fix is recorded, not applied.** The threat register's mitigation for T-08-05-05 says a body, token or email echo is "fixed". The one call site that echoes content is the operator's opt-in AI transcript diagnostic. Neutering it would reverse an operator-requested feature and change `CSRM_AI_*` behaviour, which the build-out rules put out of bounds. It is recorded in the security doc and `deferred-items.md` (owner 08-14, operator decision). The plan's own fail condition ("left unrecorded") does not trip.
- **The RED commit message overstated the 403.** `62accfb` says `X-Powered-By` was sent "on a 200 and a 403". A probe with the old configuration shows it rode only on responses that completed without a thrown error (200, 401, 404), never on the thrown policy 403 or the 500. The security doc records the observed set; history is left unchanged.
- **Record location.** D-39 names `08-SECURITY.md`; the plan (and 08-10, 08-14) use `docs/security/strapi-http-hardening.md`, which the phase security record cites.
- **Windows host.** The plan's `/opt/node24/bin` prefix and Linux port checks were run as `/c/ProgramData/nvm/v24.19.0` and `Get-NetTCPConnection`; `cmp` ran in Git Bash.

**Total deviations:** 5 auto-fixed (2 Rule 1, 2 Rule 3, 1 Rule 2) and 5 recorded. **Impact on plan:** all test-side; no production source changed apart from the one-line middleware removal the plan specifies.

## Issues Encountered

- Checking the matrix fix's sensitivity meant editing compiled output. `tsc` then skipped re-emitting it, because its incremental build info recorded the sources as unchanged. Deleting `apps/strapi/.tmp/tests-dist/tsconfig.tsbuildinfo` (gitignored) and recompiling restored it, and the matrix re-ran 116 of 116 on the restored build.
- The full Strapi suite exceeds the 10-minute foreground limit of this session's shell, so it ran as a background command logging to the scratchpad and was awaited before anything else touched `apps/strapi`.

## Residuals recorded for the 08-14 register

These are new observations, not new code surface; each is in `deferred-items.md` and the security doc:

| Observation | Where recorded |
|-------------|----------------|
| The full-access token can create users-permissions accounts (201) and roles (200), and reach the email and upload handlers | matrix plugin rows; security doc § Plugin routes |
| `strapi::cors` reflects any `Origin` with credentials allowed (not exploitable today; restrict `origin` for production) | security doc § CORS |
| The opt-in AI transcript diagnostic logs request and questionnaire content when enabled | security doc § Logging review |
| `strapi::logger` writes query strings, so search terms reach the log | security doc § Logging review |

## Known Stubs

None.

## User Setup Required

None: no external service configuration required.

## Next Phase Readiness

- 08-06 (one shared Risk Type ordering rule; the revision timeline names the acting analyst) can start. It edits Strapi, so the dev servers stay stopped and the Strapi suite, now 496 tests in about 8.6 min on this host, is its regression gate.
- Any plan that mounts a route must add its matrix row, or `authorization-matrix.integration.test.ts` fails.
- The operator decision on the AI transcript diagnostic, and a production CORS origin, are open for the residual register.

## Self-Check: PASSED

- Created files present: `authorization-policy.unit.test.ts`, `fixtures/authorization-matrix.ts`, `authorization-matrix.integration.test.ts`, `http-hardening.integration.test.ts`, `docs/security/strapi-http-hardening.md`; `authorization.policy.test.js` absent.
- Commits present on `dev`: `b5215dd`, `491d362`, `5be55c4`, `78dd368`, `98bc34d`, `e06a274`, `62accfb`, `539b66f`, `7916838`, `91cdac4`.
- Acceptance re-run on the final tree: Task 1 (18 `test(` calls, no `dist/`, the agent release denial, the script glob); Task 2 (the two exports, 76 + 37 rows, the seven required strings, the three record-level rows at 404/403/403, 116 of 116 in about 30 s, `cmp` exit 0, no policy diff); Task 3 (no `strapi::poweredBy`, the six literals in the hardening test, the envelope literal in the release case, the doc's table, `D-39`, `## Logging review` and test citations, no sentinel under `apps/strapi/src`); plan verification (Strapi 496/496, web 884/884, typecheck and `api:check` clean, no schema or policy diff since `d410a75`, no `keycloak` in the diff, no tool attribution).

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-25*
