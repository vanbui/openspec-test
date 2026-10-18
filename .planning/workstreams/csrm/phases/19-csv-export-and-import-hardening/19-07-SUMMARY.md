---
phase: 19-csv-export-and-import-hardening
plan: 07
subsystem: exports
tags: [csv-export, xlsx, review-queue, my-requests, authorization, service-identity, effective-access, function-catalogue, served-operations, authorization-matrix, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-04: runListExport, ListExportView, sendExportFile, sendExportError, resolveExportActor, the requests and my-requests vocabulary views; 19-05: SERVICE_IDENTITY_REFUSED_OPERATIONS, underlyingRead, the analyst-export branch of humanAnalystDenialMessage, exports.integration.test.ts and its helpers, the refusal-set mirror, the Phase 19 design note"
  - phase: 13-request-assignment-and-collaboration
    provides: "the review queue's assignee and notes filters, projectPerson, isEligiblePerson"
  - phase: 11-navigation-landing-and-list-clarity
    provides: "GET /api/v1/my_requests (parseMyRequestsQuery, ownedRequests, projectMyRequest, the holder predicate)"
provides:
  - "GET /api/v1/assessment_requests/export (exportReviewRequests, operationId assessment-workflow/export-assessment-request-queue), human Security Analyst only, underlyingRead GET:/api/v1/assessment_requests"
  - "GET /api/v1/my_requests/export (exportMyRequests, operationId assessment-workflow/export-my-requests), every person through the Requestor birthright, owner-scoped, underlyingRead GET:/api/v1/my_requests"
  - "exportAnalystReviewRequests and exportMyRequests in csrm-assessment-request/operations.ts"
  - "parseAnalystReviewExportQuery (collection-scope.ts) and parseMyRequestsExportQuery (services/my-requests.ts)"
  - "myRequestsReader and applyMyRequestsOrder: the list's owner-bound selection, order and hydration, shared by listMyRequests and the export"
  - "requestsExportView and myRequestsExportView in export-views.ts, registered for the vocabulary closure test"
  - "isOperationGranted withholds a SERVICE_IDENTITY_REFUSED_OPERATIONS member from an identity isEligiblePerson refuses"
  - "catalogue: function.analyst_exports.list_export_api (role.security_analyst) and function.my_exports.list_export_api (role.requestor), each with .api.01"
  - "matrix rows for both exports; human-only count 33; both URLs in the service-identity mirror"
  - "exports.integration.test.ts helpers: exportAt, readAllPages, mountedPolicyConfig, policyRefusal, withRoleGrantedFunction"
affects: [19-08, 19-09, 19-10, 19-11, 19-14, 19-15, phase-17, phase-19.1]

actuals:
  tokens: 25208
  tasks: 3
  commits: 5

plan_head_before: 82f05a52aa82428f29d6f048b1cb449fe972ff7b
plan_head_after: e85d1cd728f6276b8ae39e7a7bba3f983472b142

tech-stack:
  added: []
  patterns:
    - "An export's parser is the list's own parser behind a guard that refuses the list's page parameters (pagination for the queue; page and pageSize for My requests)"
    - "A list whose read was inline is split into a shared reader (selection, order, hydration) that the list pages through and the export reads whole, rather than copied"
    - "The exact policy sentence of an HTTP refusal is proven by running the mounted route's policy config (read from strapi.apis) through the real policy against the test database's grants"
    - "Effective access applies the policy's service-identity refusal with the same isEligiblePerson call, so /v1/me/access never offers an export the policy refuses"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment-request/operations.ts
    - apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
    - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
    - apps/backend/src/api/csrm-current-user/services/effective-access.ts
    - apps/backend/src/csrm/exports/export-views.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/exports.integration.test.ts
    - apps/backend/tests/keycloak-identity.unit.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "The queue export keeps the queue's executed parameter names: filters[queue] (values requires-attention, awaiting-requestor, generation-in-progress, open, released, all), filters[requestStatus], filters[q], filters[title], filters[requestNumber], filters[dueDate], filters[assignee] (me, unassigned), filters[notes] (unread) and sort; any pagination key is refused"
  - "The My requests export keeps q, status, holder, notes and sort; page and pageSize are refused"
  - "The queue's About-sheet chips use the web's words (Queue: Requires attention, All requests, and so on; Assigned to: Me or Not picked up; Notes: New notes); My requests' use Status, Show (the requestHolder words) and Notes"
  - "The audit line records the queue as filters.queue plus each set filter, search as q, sort as field:direction joined by commas"
  - "A request removed between the id read and hydration is left out of the file, as the list leaves it out; the row count header counts the rows written"
  - "Catalogue placement: function.analyst_exports.list_export_api after function.risk_register.export_api, function.my_exports.list_export_api after it; role.security_analyst lists the first after function.risk_register.export_api, role.requestor lists the second after function.questionnaire.revert_to_draft_api"
  - "CSV-01 is not marked complete here (the phase delivers CSV-01 to CSV-03 across 19-15)"

patterns-established:
  - "exportAt(harness, path, query, identity | null, omitApiToken) and readAllPages(list, query, pageParameter, identity) compare an export with its list"
  - "withRoleGrantedFunction(harness, roleName, functionName, action): a one-action mis-grant in the test database, restored in a finally"

requirements-completed: []

duration: 69min
completed: 2026-10-17
---

# Phase 19 Plan 07: The request lists' exports Summary

**Bob exports his review queue, filters and assignee column included, equal to the list's pages in order; every person exports only their own My requests, with Next step and the optional Holder column; the service agent is refused both (and is no longer offered the birthright export in `/v1/me/access`).**

## Performance

- **Duration:** 69 min (2026-10-16T17:30Z to 18:39Z UTC; the full Strapi suite was 32.4 min of it)
- **Tasks:** 3 of 3
- **Files:** 20 modified, 0 created

## Accomplishments

- `GET /api/v1/assessment_requests/export` is in the core request router beside the queue list and before every `/v1/assessment_requests/:requestId` route. Its policy config is `{ operation: "GET:/api/v1/assessment_requests/export", requireAnalystRequestCollectionScope: true, underlyingRead: "GET:/api/v1/assessment_requests" }` with `content-api-token`. `exportReviewRequests` runs `runListExport(requestsExportView(strapi))`.
- `requestsExportView` parses with `parseAnalystReviewExportQuery`, which runs the queue's own `parseAnalystReviewQuery` and the same closed filter parser. It counts and reads ordered ids through `createReviewQueueRepository`, reading the active-generation snapshot once per export. It hydrates in batches of `MAX_REVIEW_QUEUE_HYDRATION` (100) and projects with `projectAnalystReviewRequest`. A status outside the queue gives 0 rows.
- The queue's 10 extractors: Request, Title, Requestor, Assessment type, Business criticality, Status (labelled, so `approved` reads `Released`), Assigned to (display name, or empty), Due date, Age (`daysSinceSubmission`) and Submitted (an instant, written as the viewer's local date).
- `GET /api/v1/my_requests/export` is in `routes/my-requests.ts` with `requireRequestCollectionScope: true` and `underlyingRead: "GET:/api/v1/my_requests"`. `myRequestsExportView` takes its owner from `ownRequestorId(state)` (the policy's numeric id) and reads through `myRequestsReader`. That is the list's owner-bound selection and hydration, now shared with `listMyRequests` (behaviour unchanged). It orders with `applyMyRequestsOrder` and projects with `projectMyRequest`.
- My requests' 8 extractors: Request ID, Title, Status, Security Analyst (the 19-04 `assignee` column), Next step (`nextAction.summary`), Due date, Updated, and the hidden Holder (`requestHolder` words).
- Policy: `"GET:/api/v1/assessment_requests/export"` is a quoted literal in both `HUMAN_ANALYST_ONLY_OPERATIONS` and `SERVICE_IDENTITY_REFUSED_OPERATIONS`. `"GET:/api/v1/my_requests/export"` is in `SERVICE_IDENTITY_REFUSED_OPERATIONS` only.
- `effective-access.ts` imports `SERVICE_IDENTITY_REFUSED_OPERATIONS` and `isEligiblePerson`. `isOperationGranted` now returns false for a member when the explicit roles fail eligibility.
- Contract chain: both spec paths sit right after their lists. Each takes its list's parameters without pagination, plus `format`, `columns` and `timeZone`. Each has the binary 200 under exactly `text/csv; charset=utf-8` and the XLSX type, and inline 400/403/422. `schema.d.ts` was regenerated, `api:check` is clean, both catalogue copies are byte-identical, and the served inventory lists both under `served`.

## Matrix rows

| Operation | owner | other | analyst | serviceAgent | noIdentity | noToken | Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET:/api/v1/assessment_requests/export` (`humanAnalystOnly(200)`, family `assessment-requests`, request `?format=csv&filters[queue]=all`) | 403 | 403 | 200 | 403 | 403 | 401 (content-api-token family) | analyst provenBy `requests: Bob's review queue exports whole…`; seeAlso the Task 3 denial test |
| `GET:/api/v1/my_requests/export` (family `assessment-requests`, request `?format=csv`) | 200 | 200 | 200 | 403 | 403 | 401 | owner, other and analyst provenBy `my-requests: Jane, the Secondary Requestor and Bob each export their own records only…`; seeAlso the Task 2 refusal test |

The `HUMAN_ANALYST_ONLY_OPERATIONS` mirror gained the queue export, so the guard now asserts `33 + insightOperations.size`. The `SERVICE_IDENTITY_REFUSED_OPERATIONS` mirror gained both URLs.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | tests tsc + `node --test --test-name-pattern="^requests:"` exports.integration | 3 tests, 0 pass, 3 fail (404: no route). The list half passed: 27 rows over 3 pages |
| 1 GREEN | the plan's verify: node 24.19 check, `api:check` (+ refresh), `cmp`, tests tsc, exports + review-queue-buckets | 23 tests, 23 pass, 0 fail, 0 skipped; EXIT 0 |
| 1 tracer gate | the same verify, re-run after the commit | 23 / 23 pass, EXIT 0 |
| 1 extra | export-vocabulary.unit, authorization-policy.unit, active-risk-readers.unit, contract-catalogue.integration | 73 / 73 pass |
| 2 RED | name-pattern `^my-requests:` exports + the new keycloak-identity unit case | 4 tests, 0 pass, 4 fail (404, agent not refused, the agent offered the export) |
| 2 GREEN | the plan's verify: node check, `api:check` (+ refresh), `cmp`, tests tsc, exports + my-requests.integration + keycloak-identity.unit | 36 tests, 36 pass, 0 fail, 0 skipped; EXIT 0 |
| 2 extra | export-vocabulary, authorization-policy, contract-catalogue, keycloak-identity.integration | 89 / 89 pass |
| 3 focused | exports + contract-catalogue + authorization-matrix.integration + authorization-matrix-provenance.unit | 205 / 205 pass |
| 3 | the plan's verify: node check, `cmp`, `api:check` (+ refresh), `pnpm --dir apps/backend test` (ports 1337 and 3000 free) | EXIT 0: 2,158 tests, 2,157 pass, 0 fail, 1 skipped (the existing POSIX-modes test on Windows), 1,945.7 s; cap fixture 10,001 Risks in 311 ms |
| sanity (web) | vitest contract-operation-chain, contract-response-parity, src/lib/capabilities | 4 files, 237 / 237 pass |

Served inventory: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` ran twice (Tasks 1 and 2), each time 12 tests, 11 pass, 1 skipped.

Acceptance checks:
- `export-views.ts` contains `parseAnalystReviewExportQuery` and `projectAnalystReviewRequest`.
- `routes/my-requests.ts`'s export config has `requireRequestCollectionScope: true` and `underlyingRead`.
- A test name includes `own records only`.
- `effective-access.ts` imports `SERVICE_IDENTITY_REFUSED_OPERATIONS`.
- `keycloak-identity.unit.test.ts` asserts the agent excludes the export and Jane and Bob include it.
- `csrm-authorization.ts` holds both quoted literals (3 occurrences).
- `exports.integration.test.ts` asserts `CSRM exports are refused to automation identities.` at both exports, plus `CSRM analyst exports require a human Security Analyst.` and `CSRM export requires the list read.` at the Requests export.
- `git diff --name-only bdd0f698` over `apps/backend/src/api/*/content-types/*` (less the three IAM exclusions) prints nothing.
- `active-risk-readers.unit` passes with no new exemption; neither view reads a Risk.

## Task Commits

1. **Task 1 (tracer): Bob's review queue exported over HTTP.** `aa08720d` (test, RED), `52077e36` (feat, GREEN)
2. **Task 2: My requests exported for every person, own records only.** `946cb1ef` (test, RED), `7afd6e5a` (feat, GREEN)
3. **Task 3: refusals, matrix rows, catalogue proof, full suite.** `e85d1cd7` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The exact 403 sentences cannot be read over HTTP**
- **Found during:** Task 2 (already noted by 19-05)
- **Issue:** Strapi answers every policy denial over HTTP with a generic `Policy Failed` body. The plan wants `exports.integration.test.ts` to assert the three export sentences.
- **Fix:** `mountedPolicyConfig` reads the route's own policy config from the running Strapi (`strapi.apis[...].routes`). `policyRefusal` runs it through the real `csrm-authorization` policy against the test database's grants for one IdamBox User and captures the `forbidden` message. Each case also proves the HTTP 403, the JSON body, no disclosure and no export event.
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commits:** 946cb1ef, e85d1cd7

**2. [Rule 3 - Blocking] My requests had no reusable reader**
- **Found during:** Task 2
- **Issue:** `listMyRequests` built its owner-bound selection, order and hydration inline. Using them from the export meant either copying them or refactoring.
- **Fix:** I split out `myRequestsReader(strapi, requestorId, query)` (selection, hydration, viewer) and exported `applyMyRequestsOrder`. `listMyRequests` now pages through the same reader, and `my-requests.integration.test.ts` passes unchanged.
- **Files modified:** apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
- **Commit:** 7afd6e5a

**3. [Rule 3 - Blocking] The Phase 19 catalogue table assumed human-only, reserved Functions**
- **Found during:** Task 3
- **Issue:** The 19-05 test asserts that every entry is human analyst-only and moved from a reserved entry. My requests' Function belongs to the Requestor birthright, and neither new Function was reserved.
- **Fix:** Each entry now names its one `roleId` and an optional `reserved` source. The description pattern depends on the role, and the grant checks follow `roleId`. The design-note check also names both new Functions.
- **Files modified:** apps/backend/tests/contract-catalogue.integration.test.ts
- **Commit:** e85d1cd7

### Choices the plan left open, and executed names that differ from the plan

- The plan wrote `queue=all-requests` and "page or pageSize" for the queue. The executed queue parameters are `filters[queue]=all` and `pagination[page]` / `pagination[pageSize]`. The export refuses any `pagination` key, and a top-level `page` falls to the queue's closed key check. Both are 400s in the tests.
- The plan's example chip `Queue: Requires my attention` does not match the web, whose Requests queue label is `Requires attention` (13-UI-SPEC drops "my"). The web's words are used.
- `assertFileHeaders` takes a slug (default `risk-register`). `withAgentGrantedRegisterExport` is now a thin wrapper over `withRoleGrantedFunction`.
- The fixture gives Bob one request he raised (`REQ-EXPMY-BOB`), so his file proves a non-empty own-records export. The plan allowed an empty one.
- The queue view keeps the list's behaviour for a request removed between the id read and hydration: it is left out. The register view refuses in that case.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-19-23: the owner comes from `ownRequestorId` and hydration is bound to the requestor, and Jane's, the Secondary Requestor's and Bob's files each equal their own list with no cross-disclosure. T-19-24: both URLs are literals in the refusal set, the queue export is also human-only, the agent is refused with and without the mis-grant, and `isOperationGranted` withholds the export from the agent. T-19-25: the export is human-only, takes `underlyingRead` on the queue read, and uses the queue's own parser and repository; no notes column exists.

## Self-Check: PASSED

All 20 modified files exist. Commits aa08720d, 52077e36, 946cb1ef, 7afd6e5a and e85d1cd7 are in the history.
