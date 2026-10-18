---
phase: 19-csv-export-and-import-hardening
plan: 08
subsystem: exports
tags: [csv-export, xlsx, questionnaires, my-questionnaires, alerts, authorization, service-identity, function-catalogue, served-operations, authorization-matrix, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-04: runListExport, ListExportView, sendExportFile, sendExportError, resolveExportActor, the questionnaires, my-questionnaires and alerts vocabulary views; 19-05: SERVICE_IDENTITY_REFUSED_OPERATIONS, underlyingRead, the analyst-export branch of humanAnalystDenialMessage, the export test helpers; 19-07: the two export Functions, exportAt, readAllPages, mountedPolicyConfig, policyRefusal, withRoleGrantedFunction, the Phase 19 catalogue table, the human-only count at 33"
  - phase: "Phase 7 (derived analyst insights)"
    provides: "GET /api/v1/alerts (parseAlertListQuery, createAlertRepository listPage and count, projectAlertRow), requireAnalystInsightScope and its four underlying reads"
  - phase: "the served questionnaire lists"
    provides: "GET /api/v1/questionnaires and GET /api/v1/my_questionnaires (buildQuestionnaireCollectionQuery, loadCompleteQuestionnaireScope, projectQuestionnaireCollection, the policy's questionnaire collection scope)"
provides:
  - "GET /api/v1/questionnaires/export (exportQuestionnaires, operationId questionnaire-workflow/export-questionnaires-for-review), human Security Analyst only, underlyingRead GET:/api/v1/questionnaires"
  - "GET /api/v1/my_questionnaires/export (exportMyQuestionnaires, operationId questionnaire-workflow/export-my-questionnaires), every person through the Requestor birthright, owner-scoped, underlyingRead GET:/api/v1/my_questionnaires"
  - "GET /api/v1/alerts/export (exportAlerts, operationId analyst-insights/export-alerts), human Security Analyst only, requireAnalystInsightScope plus underlyingRead GET:/api/v1/alerts"
  - "CSRM_QUESTIONNAIRE_OPERATIONS.exportAll and .exportMine; CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS.exportAlerts (CSRM_ANALYST_INSIGHT_OPERATIONS keeps its five entries)"
  - "buildQuestionnaireExportQuery (questionnaire-scope.ts) and parseAlertExportQuery (alert-query.ts)"
  - "questionnairesExportView, myQuestionnairesExportView and alertsExportView in export-views.ts, registered for the vocabulary closure test"
  - "catalogue: function.analyst_exports.list_export_api .api.02 (Export Questionnaires) and .api.03 (Export Alerts); function.my_exports.list_export_api .api.02 (Export My Questionnaires)"
  - "matrix rows for all three exports; human-only count 35; all three URLs in the service-identity mirror"
affects: [19-09, 19-10, 19-11, 19-14, 19-15, phase-17, phase-19.1]

actuals:
  tokens: 25816
  tasks: 4
  commits: 7

plan_head_before: ee55cdfc9fe2700bf3f92dba062ad498416cdb35
plan_head_after: 5111fee1f427bdf56aca56c52794e13fbcbe176a

tech-stack:
  added: []
  patterns:
    - "A list that filters and sorts on its projection in memory (the questionnaire lists) exports through the list's own complete-scope read, read once per export, rather than a database order that could differ"
    - "A derived-on-read list (alerts) exports through its repository's own count and pages; the ids are the served stable keys and hydration returns the rows the pages derived"
    - "A router helper adds an optional policy key by spread only when given, so the existing routes' configs stay exactly equal"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-questionnaire/operations.ts
    - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-analyst-insight/operations.ts
    - apps/backend/src/api/csrm-analyst-insight/routes/alerts.ts
    - apps/backend/src/api/csrm-analyst-insight/controllers/alerts.ts
    - apps/backend/src/api/csrm-analyst-insight/services/alert-query.ts
    - apps/backend/src/csrm/exports/export-views.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/exports.integration.test.ts
    - apps/backend/tests/analyst-insight-routes.unit.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "The questionnaire views read the list's whole scope once through loadCompleteQuestionnaireScope and order it with projectQuestionnaireCollection, because the list filters by derived status and sorts on its projection in memory; the plan's findMany id read in database order would not equal the list"
  - "Without a status filter the questionnaire count is the database count of the scope, so a scope above the cap is refused before it is loaded; with one, the count is the derived rows' (the list loads the same scope on every page)"
  - "The questionnaire Status column reads analyst-review while the questionnaire is unreleased, then its served state, as the web's deriveQuestionnaireStatus does; Progress is '{answered} of {total} answered', the list's own text"
  - "All three export routes are content-api-token only, as every export is, so no token is 401 (the questionnaire list routes keep their default strategies)"
  - "The alert view pages through the repository's listPage at its largest page size (50), since listPage refuses a larger page; it does not add a repository method"
  - "The alert export's audit records kind only when narrower than every kind, and urgency when set; its About sheet names Alert type and Urgency (the screen's filter labels) and no Sorted by (the server owns the order, D-12)"
  - "Catalogue: the export Functions' sourceEntities gain the entities their new FunctionApis read (CsrmQuestionnaire; CsrmAssessment, CsrmRisk, CsrmControlImplementation)"
  - "CSV-01 is not marked complete here (the phase delivers CSV-01 to CSV-03 across 19-15)"

patterns-established:
  - "assertAnalystExportRefusals(harness, { exportPath, query, apiName, routePath, listRead, discloses }): every refusal of one analyst export, with the exact policy sentence, no export event and no persistence change"

requirements-completed: []

duration: 64min
completed: 2026-10-16
---

# Phase 19 Plan 08: The questionnaire and alert exports Summary

**Bob exports his questionnaire review list and his alerts, each equal to the list's pages in order (statuses, urgency and conditions in the screen's words, the alert dates as the list derives them); every person exports only their own released questionnaires; the service agent is refused all three, and no file ever holds a question, an answer or a description.**

## Performance

- **Duration:** 64 min (2026-10-16T18:42Z to 19:46Z UTC; the full Strapi suite was 32.8 min of it)
- **Tasks:** 4 of 4
- **Files:** 20 modified, 0 created

## Accomplishments

- `GET /api/v1/questionnaires/export` is the first route in the questionnaire router, before every `/v1/questionnaires/:questionnaireId` route. Its policy config is `{ operation: "GET:/api/v1/questionnaires/export", requireQuestionnaireCollectionScope: true, allowAnalystQuestionnaireReviewScope: true, underlyingRead: "GET:/api/v1/questionnaires" }` with `content-api-token`.
- `GET /api/v1/my_questionnaires/export` sits right before `/v1/my_questionnaires/status_summary`. Its config is `{ operation, requireQuestionnaireCollectionScope: true, underlyingRead: "GET:/api/v1/my_questionnaires" }`. The policy's owner scope gives every person, Bob included, only the released questionnaires of requests they raised, as the list does.
- `buildQuestionnaireExportQuery` sits beside `buildQuestionnaireCollectionQuery`. Both now share one internal parser for scope, search, status and sort, and the export variant refuses `page` and `pageSize`. The list's behaviour is unchanged.
- One questionnaire list view serves both exports, each with its own scope assertion. Each export reads the scope once with `loadCompleteQuestionnaireScope`, filters and orders it with `projectQuestionnaireCollection`, and projects with `projectQuestionnaire`. The extractors are Questionnaire ID, Title, Assessment request (the request number), Status (Analyst review until released) and, for My questionnaires, Progress.
- `GET /api/v1/alerts/export` is the first alert route. `insightPolicies(operation, underlyingRead?)` gives it `{ operation, requireAnalystInsightScope: true, underlyingRead: "GET:/api/v1/alerts" }`, and the two existing routes keep their exact two-key configs.
- `parseAlertExportQuery` reuses the list's closed `kind` and `urgency` parsing. `alertsExportView` counts with the repository's `count`, reads ids through `listPage` in the list's order, and projects with `projectAlertRow` and the pipeline's one `today`. The extractors are Urgency, Residual rating, Condition, Record (the source identifier) and Date (the governing date).
- Policy: `"GET:/api/v1/questionnaires/export"` and `"GET:/api/v1/alerts/export"` are quoted literals in both `HUMAN_ANALYST_ONLY_OPERATIONS` and `SERVICE_IDENTITY_REFUSED_OPERATIONS`. `"GET:/api/v1/my_questionnaires/export"` is in `SERVICE_IDENTITY_REFUSED_OPERATIONS` only.
- Contract chain: each spec path sits right after its list. It takes the list's parameters without pagination, plus `format`, `columns` and `timeZone`, and has the binary 200 under exactly `text/csv; charset=utf-8` and the XLSX type, with inline 400/403/422. `schema.d.ts` is regenerated, `api:check` is clean, both catalogue copies are byte-identical, and the served inventory lists all three.

## Alert ids used as export keys

The alert view's ids are the alerts' stable keys exactly as the list serves them, `alertId(kind, sourceDocumentId)`, which is `{kind}:{sourceDocumentId}` (for example `risk-treatment-overdue:<Risk documentId>`). `selectIds` keeps each derived row under its key, and `hydrate` returns those rows in id order. Because only alerts from the same pass are hydrated, a file never mixes two derivations.

## Matrix rows

| Operation | owner | other | analyst | serviceAgent | noIdentity | noToken | Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET:/api/v1/questionnaires/export` (`humanAnalystOnly(200)`, family `questionnaires`, request `?format=csv`) | 403 | 403 | 200 | 403 | 403 | 401 (content-api-token) | analyst provenBy `questionnaires: Bob's questionnaire review list exports whole…`; seeAlso the denial test and the 400 test |
| `GET:/api/v1/my_questionnaires/export` (family `questionnaires`, request `?format=csv`) | 200 | 200 | 200 | 403 | 403 | 401 | owner, other and analyst provenBy `my-questionnaires: Jane, the Secondary Requestor and Bob each export their own records only…`; seeAlso the refusal test and the 400 test |
| `GET:/api/v1/alerts/export` (`humanAnalystOnly(200)`, family `analyst-insights`, request `?format=csv`) | 403 | 403 | 200 | 403 | 403 | 401 | analyst provenBy `alerts: Bob's alert list exports whole as a CSV…`; seeAlso the denial test and the 400 test |

The `HUMAN_ANALYST_ONLY_OPERATIONS` mirror gained the two analyst exports, each as its own literal, so the guard now asserts `35 + insightOperations.size`. The `SERVICE_IDENTITY_REFUSED_OPERATIONS` mirror gained all three URLs.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | tests tsc + `--test-name-pattern="^questionnaires:"` exports.integration | 2 tests, 0 pass, 2 fail (404 from the detail route); the list half passed (23 over 3 pages) |
| 1 GREEN | the plan's verify: node 24.19 check, `api:check` (+ refresh), `cmp`, tests tsc, exports + questionnaire-workflow | 31 tests, 31 pass, 0 fail, 0 skipped; EXIT 0 |
| 1 tracer gate | the same verify, re-run after the commit | 31 / 31 pass, EXIT 0 |
| 1 extra | export-vocabulary, authorization-policy, questionnaire-governance, active-risk-readers, keycloak-identity (unit) | 83 / 83 pass |
| 2 RED | `--test-name-pattern="^my-questionnaires:"` | 2 tests, 0 pass, 2 fail (404; the agent not refused) |
| 2 GREEN | the plan's verify: node check, `api:check` (+ refresh), `cmp`, tests tsc, exports | 19 tests, 19 pass, 0 fail, 0 skipped; EXIT 0 |
| 2 extra | export-vocabulary, authorization-policy, keycloak-identity, questionnaire-governance (unit) | 79 / 79 pass |
| 3 RED | tests tsc (fails: `CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS` missing), then emitted with `--noEmitOnError false`: `^alerts:` exports and the insight route unit | 2 fail (404 at both exports); route inventory 1 fail |
| 3 GREEN | the plan's verify: node check, `api:check` (+ refresh), `cmp`, tests tsc, exports + analyst-alerts + analyst-insight-routes + active-risk-readers | 35 tests, 35 pass, 0 fail, 0 skipped; EXIT 0 |
| 3 extra | export-vocabulary, authorization-policy, keycloak-identity (unit) | 52 / 52 pass |
| 4 focused | exports + contract-catalogue + authorization-matrix.integration + authorization-matrix-provenance.unit | 217 / 217 pass |
| 4 | the plan's verify: node check, `cmp`, `api:check` (+ refresh), `pnpm --dir apps/backend test` (ports 1337 and 3000 free) | EXIT 0: 2,170 tests, 2,169 pass, 0 fail, 1 skipped (the existing POSIX-modes test on Windows), 1,970.2 s |
| sanity (web) | vitest contract-operation-chain, contract-response-parity | 2 files, 226 / 226 pass |

Served inventory: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` ran in Tasks 1, 2 and 3, each time 12 tests, 11 pass, 1 skipped.

Acceptance checks:
- In `routes/csrm-questionnaire.ts`, `/v1/questionnaires/export` is the first route, before every `/v1/questionnaires/:questionnaireId` route.
- A test name includes `own records only` (`my-questionnaires: …`).
- `git grep -n "deriveTreatmentDueState" -- apps/backend/src/csrm/exports` prints nothing, and the alert view calls the repository's `count`, `listPage` and `projectAlertRow`.
- `CSRM_ANALYST_INSIGHT_OPERATIONS` still has exactly five entries.
- `analyst-insight-routes.unit.test.ts`: `SERVED_INSIGHT_ROUTES` holds the alert export with `underlyingRead: CSRM_ANALYST_INSIGHT_OPERATIONS.listAlerts`. The policy assertion is still one `deepEqual`, and it adds `underlyingRead` only for an entry that declares it (an `"underlyingRead" in served` check). `UNSERVED_PATH_FRAGMENTS` no longer holds `'"/v1/alerts/export"'` and still holds `'"/v1/reports/:reportKey/export"'`, `'"/v1/alerts/:'`, `"/acknowledge"` and both dashboard aliases.
- `authorization-matrix.ts` contains the three export URLs, and `authorization-matrix.integration.test.ts` contains `35 + insightOperations.size`.
- `exports.integration.test.ts` asserts 19-05's exact strings `CSRM exports are refused to automation identities.`, `CSRM analyst exports require a human Security Analyst.` and `CSRM export requires the list read.` at the questionnaire and alert exports, and the first at My questionnaires.
- `csrm-authorization.ts` holds the three quoted literals (5 occurrences).
- `git diff --name-only bdd0f698` over `apps/backend/src/api/*/content-types/*` (less the three IAM exclusions) prints nothing.
- `active-risk-readers.unit` passes with no new exemption. The questionnaire views read no Risk, and the alert view reads only through the alert repository.

## Task Commits

1. **Task 1 (tracer): the questionnaire review list exported over HTTP.** `38b50590` (test, RED), `eeb845c2` (feat, GREEN)
2. **Task 2: My questionnaires exported for every person, own records only.** `c10dd598` (test, RED), `358c8e88` (feat, GREEN)
3. **Task 3: the alert list exported with its derived due state and labels.** `f6e688ea` (test, RED), `10c6eda9` (feat, GREEN)
4. **Task 4: refusals, matrix rows, catalogue proof, full suite.** `5111fee1` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's questionnaire id read would not equal the list**
- **Found during:** Task 1
- **Issue:** The plan reads ordered `documentId`s with `findMany`, using the builder's sort and `limit: cap + 1`, then hydrates in batches. The executed list does something else. It loads its whole scope (`loadCompleteQuestionnaireScope`), filters by the derived state, and sorts the projected rows with `localeCompare` (`projectQuestionnaireCollection`). A database order and a `status` filter applied in SQL would differ from the list.
- **Fix:** The view reads the scope once with the list's own complete-scope read and orders it with `projectQuestionnaireCollection`. Ids and hydration come from that one read. Without a status filter, the count is the database count of the same scope, so an over-cap scope is refused before it is loaded.
- **Files modified:** apps/backend/src/csrm/exports/export-views.ts
- **Commit:** eeb845c2

**2. [Rule 3 - Blocking] The Phase 19 catalogue test assumed one FunctionApi per Function**
- **Found during:** Task 4
- **Issue:** The test asserted `functionApiIds` equal to `[route.functionApiId]`, but the export Functions now hold two and three FunctionApis.
- **Fix:** Each Function must list exactly the table's FunctionApis for it, in id order.
- **Files modified:** apps/backend/tests/contract-catalogue.integration.test.ts
- **Commit:** 5111fee1

**3. [Rule 3 - Blocking] The alert fixture fit on one page**
- **Found during:** Task 3 RED
- **Issue:** Run alone, the alert list held five alerts or fewer, and the smallest page size is five, so the export could not be compared with several pages.
- **Fix:** The fixture adds three overdue requests (statuses under-review, submitted and questionnaire-in-progress), so the list runs to more than one page.
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commit:** f6e688ea

### Choices the plan left open, and executed names that differ from the plan

- **Route auth.** The plan wrote the questionnaire export configs "as the list route plus underlyingRead". The list routes use Strapi's default strategies, but the plan's matrix rows require no token to give 401. All three exports are therefore `content-api-token` only, as the 19-05 and 19-07 exports are.
- **Alert reads.** The plan names `listPage` and `count` for the alert view. `listPage` refuses a page above 50, so the view reads up to cap + 1 rows in pages of 50 rather than adding a repository method.
- **Mis-grant proofs.** The plan's Task 4 asks for the underlying-read refusal at the questionnaire export. The shared refusal helper also proves it at the alert export (Bob without `GET:/api/v1/alerts`), and it also covers the Secondary Requestor.
- **Task 4 extra 400 query.** `pageSize` was added beside the plan's `page=1`, `columns=nope` and `format=pdf`, at all three exports.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-19-26:** the owner scope comes from the policy's `questionnaireRequestorId`, never a query value. Jane's, the Secondary Requestor's and Bob's files each equal their own list and hold only their own released fixture questionnaires, with no cross-disclosure.
- **T-19-27:** the columns are closed, and the fixture's questions, answers and descriptions all hold `Secret`. Neither the CSV bytes nor any workbook cell contains it.
- **T-19-28:** the literals are in both refusal sets (My questionnaires in the service-identity set only), and the count guard is at 35. The agent is refused with and without the mis-grant, in the automation wording, never the governance or insight wording. The alert export also requires Phase 7's underlying reads.

## Self-Check: PASSED

All 20 modified files exist. Commits 38b50590, eeb845c2, c10dd598, 358c8e88, f6e688ea, 10c6eda9 and 5111fee1 are in the history.
