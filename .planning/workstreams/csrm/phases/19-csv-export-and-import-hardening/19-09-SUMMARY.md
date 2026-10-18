---
phase: 19-csv-export-and-import-hardening
plan: 09
subsystem: exports
tags: [csv-export, xlsx, reports, analyst-insights, authorization, service-identity, function-catalogue, served-operations, authorization-matrix, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-04: runFixedTableExport, ExportTable, the vocabulary's reports section, EXPORT_MEDIA_TYPES, sendExportFile, sendExportError, resolveExportActor; 19-05: SERVICE_IDENTITY_REFUSED_OPERATIONS, underlyingRead, the analyst-export branch of humanAnalystDenialMessage, the export test helpers; 19-07/19-08: mountedPolicyConfig, policyRefusal, withRoleGrantedFunction, the Phase 19 catalogue table, CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS, insightPolicies(operation, underlyingRead?), the human-only count at 35"
  - phase: "Phase 7 (derived analyst insights)"
    provides: "GET /api/v1/reports/{reportKey} (parseReportRequest, createReportRepository, the report figure types, ReportQueryError, ReportNotFoundError), requireAnalystInsightScope and its four underlying reads, the reserved FunctionApi function.reports.reports.api.03"
provides:
  - "POST /api/v1/reports/{reportKey}/export (reports.export, operationId analyst-insights/export-report), human Security Analyst only, requireAnalystInsightScope plus underlyingRead GET:/api/v1/reports/{reportKey}"
  - "CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS.exportReport (CSRM_ANALYST_INSIGHT_OPERATIONS keeps its five entries)"
  - "parseReportExportBody (report-query.ts): closed body { format, table?, timeZone?, query? }, no columns (UI-D5)"
  - "csrm/exports/report-tables.ts: reportExportTables, reportExportAbout, reportExportView, ComputedReport"
  - "logRefusedFixedTableRequest (run-export.ts): the export.refused INVALID_QUERY line for a fixed-table request its caller refused"
  - "catalogue: function.reports.export_api (Report Export API) with the moved function.reports.export_api.api.01; function.reports.reports carries no FunctionApi"
  - "matrix row; both mirrors; human-only count 36"
affects: [19-10, 19-11, 19-14, 19-15, phase-17, phase-19.1]

actuals:
  tokens: 22520
  tasks: 3
  commits: 5

plan_head_before: d27c067b40f58e5054caaeaea52b77a79ed70284
plan_head_after: 51554f31fb0f4b7595d18e7ac361dd4d1b1e1e06

tech-stack:
  added: []
  patterns:
    - "A fixed-table export computes its source with the read's own code (computeReport, shared by get and export) and only shapes the result, so no figure is recomputed and no Risk is read under src/csrm/exports"
    - "A POST export with a closed JSON body: body-shape refusals log one export.refused INVALID_QUERY line before the pipeline runs; the pipeline validates format, table and zone and logs its own"

key-files:
  created:
    - apps/backend/src/csrm/exports/report-tables.ts
  modified:
    - apps/backend/src/api/csrm-analyst-insight/operations.ts
    - apps/backend/src/api/csrm-analyst-insight/routes/reports.ts
    - apps/backend/src/api/csrm-analyst-insight/controllers/reports.ts
    - apps/backend/src/api/csrm-analyst-insight/services/report-query.ts
    - apps/backend/src/csrm/exports/run-export.ts
    - apps/backend/src/csrm/audit/security-event-log.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/exports.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/analyst-insight-routes.unit.test.ts
    - apps/backend/tests/analyst-insight-catalogue-seed.integration.test.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/security-event-log.unit.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts

key-decisions:
  - "No columns parameter on the report export (pilot ruling 2, UI-D5): a columns key in the body is a 400 like any other unknown key"
  - "The export computes the report through the same computeReport the read uses (now typed ComputedReport); report-tables.ts only shapes figures, with the page's row order and labels and the vocabulary's keys, headings and columns"
  - "As at is the report's today as the page shows it (en-AU medium date, e.g. 17 Oct 2026); Period is '{n} months, {first month} to {last month}' for assessment-throughput only"
  - "The report export's view is report:{reportKey} as the approved record names it; the event log's view pattern now admits exactly one colon-separated segment (all other identifiers unchanged)"
  - "An unknown report key is the report read's 404 (Strapi error envelope) with no export event, as the record says for 404s; every body refusal is the export envelope's 400 'CSRM export query is invalid.' with one export.refused INVALID_QUERY line"
  - "CSV-01 is not marked complete here (the phase delivers CSV-01 to CSV-03 across 19-15)"

patterns-established:
  - "exportReportAs(harness, reportKey, body, identity?, omitApiToken?): a POST export call in the exports integration file"

requirements-completed: []

duration: 59min
completed: 2026-10-16
---

# Phase 19 Plan 09: The report export Summary

**Bob exports any of the four reports at the URL Phase 7 reserved: a workbook with one sheet per page table, then About this export with As at (and Period for throughput), or one table as a BOM-led CSV, each value equal to the report read's figures. The reserved FunctionApi moved unchanged into the human-only Report Export API; the service agent, Requestors and callers without the report read are refused in the exports' words.**

## Performance

- **Duration:** 59 min (2026-10-16T19:49Z to 20:48Z UTC; the full Strapi suite was about 33 min of it)
- **Tasks:** 3 of 3
- **Files:** 1 created, 20 modified

## Accomplishments

- `POST /v1/reports/:reportKey/export` → `api::csrm-analyst-insight.reports.export`, `content-api-token` only. Its policy config is exactly `{ operation: "POST:/api/v1/reports/{reportKey}/export", requireAnalystInsightScope: true, underlyingRead: "GET:/api/v1/reports/{reportKey}" }`. `insightPolicies(operation, underlyingRead?)` adds the key only when given, so the two report reads keep their two-key configs.
- The handler asserts the insight scope, resolves the exporter, and parses the body with `parseReportExportBody`. It then computes the report with the same `computeReport` the `get` handler uses (through `createReportRepository`, ruled by `applyActiveRisk`). Last, it calls `runFixedTableExport` with `reportExportTables(report)` and `reportExportAbout(report)`.
- `parseReportExportBody(reportKey, body)`: an unknown key throws `ReportNotFoundError` (404). The body must be a plain object holding only `format`, `table`, `timeZone` and `query`. `query` holds at most 16 text values of at most 200 characters, and goes to `parseReportRequest` unchanged. `format`, `table` and `timeZone` are left to the pipeline, which knows the report's tables.
- File names: XLSX `{reportKey}-report-{local date}.xlsx`; CSV `{reportKey}-{table slug}-{local date}.csv`.
- Policy: `"POST:/api/v1/reports/{reportKey}/export"` is a quoted literal in both `HUMAN_ANALYST_ONLY_OPERATIONS` and `SERVICE_IDENTITY_REFUSED_OPERATIONS`. It is outside `ANALYST_INSIGHT_OPERATIONS`.
- Contract chain: the spec path `/v1/reports/{reportKey}/export` (`post`) declares:
  - the `reportKey` path parameter, as the report read does;
  - a required, closed JSON `requestBody` (`format` required; `table`, `timeZone` and `query` with `maxProperties: 16` and string values of `maxLength: 200`);
  - the binary 200 under exactly `text/csv; charset=utf-8` and the XLSX type, with the five file headers;
  - inline 400, 403 and 422, plus the 404 `ReportNotFound` response.

  `schema.d.ts` is regenerated and `api:check` is clean. The served inventory lists the operation and no longer lists the unserved reason.

## Each report's table keys (vocabulary order = page order)

| Report | XLSX file | Tables (`table` key → CSV slug) |
| --- | --- | --- |
| `risk-exposure` | `risk-exposure-report-{date}.xlsx` | `ratings` → `risk-exposure-inherent-and-residual-rating`; `residual-by-treatment-status` → `risk-exposure-residual-rating-by-treatment-status`; `exposed-systems` → `risk-exposure-most-exposed-information-systems`; `under-assessment` → `risk-exposure-under-assessment` |
| `treatment-performance` | `treatment-performance-report-{date}.xlsx` | `due-state` → `treatment-performance-due-state`; `treatment-status` → `treatment-performance-treatment-status` |
| `assessment-throughput` | `assessment-throughput-report-{date}.xlsx` | `released-per-month` → `assessment-throughput-released-per-month`; `request-lifecycle` → `assessment-throughput-assessment-requests-by-lifecycle-state` |
| `control-effectiveness` | `control-effectiveness-report-{date}.xlsx` | `implementation-status` → `control-effectiveness-implementation-status`; `effectiveness-rating` → `control-effectiveness-effectiveness-rating` |

The rows follow the page (`report-presentation.ts`):
- **Ratings:** Critical to Low. Not rated appears only when either chart has an unrated Risk.
- **Residual-by-treatment-status and under-assessment:** always five rows, with the Total column.
- **Exposed systems:** the report's rows.
- **Due states:** the label is "Due within {dueWindowDays} days", taken from the figures.
- **Months:** the full month name, with "(to date)" on the partial month.
- **Request statuses:** the vocabulary's request labels (approved reads Released).
- **Control statuses and ratings:** the page's words.

Sheet names are the headings cut to 31 characters.

## The moved catalogue entry

`function.reports.reports.api.03` became `function.reports.export_api.api.01`. Its name ("Export Report"), URL (`POST:/api/v1/reports/{reportKey}/export`), description and sourceEntities are unchanged.

The new Function `function.reports.export_api` ("Report Export API") has:
- the description "Human analyst-only report export grant. This API-only Function intentionally has no menuPath.";
- `roleIds: ["role.security_analyst"]` and no menuPath;
- the Reports menu Function's sourceEntities.

The new Function sits after `function.my_exports.list_export_api`, and `role.security_analyst` lists it after `function.analyst_exports.list_export_api`. `function.reports.reports` keeps its menu path and grants, with `functionApiIds: []`. Both copies are byte-identical (`cmp`).

## Matrix row

| Operation | owner | other | analyst | serviceAgent | noIdentity | noToken | Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST:/api/v1/reports/{reportKey}/export` (`humanAnalystOnly(200)`, family `analyst-insights`, body `{ "format": "xlsx" }` at `risk-exposure`) | 403 | 403 | 200 | 403 | 403 | 401 | analyst provenBy `reports: Bob's risk exposure report exports as a workbook…`; seeAlso the denial test and the body test |

The `HUMAN_ANALYST_ONLY_OPERATIONS` mirror gained the operation as its own literal, so the guard now asserts `36 + insightOperations.size`. The `SERVICE_IDENTITY_REFUSED_OPERATIONS` mirror gained it too.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | tests tsc + the four pinned test files | 47 tests, 38 pass, 9 fail, all at the move or the route (the Reports menu FunctionAPIs, `PHASE19_FUNCTION_MISSING_function.reports.export_api`, `UNSERVED_WITHOUT_REASON_POST…`, `INSIGHT_ROUTE_NOT_MOUNTED_ONCE_POST…`, served-inventory drift) |
| 1 RED | `--test-name-pattern="^reports:"` exports.integration | 2 tests, 0 pass, 2 fail (`RISK_EXPOSURE_XLSX_STATUS_405`, `THROUGHPUT_XLSX_STATUS_405`) |
| 1 GREEN | the plan's verify: node 24.19 check, `api:check` (+ refresh), `cmp`, tests tsc, exports + analyst-reports + contract-catalogue + analyst-insight-routes + analyst-insight-catalogue-seed + served-operations | 87 tests, 87 pass, 0 fail, 0 skipped; EXIT 0 |
| 1 tracer gate | the same verify, run end to end after the last change and before the commit | 87 / 87 pass, EXIT 0 |
| 1 extra | active-risk-readers, authorization-policy, security-event-log (unit) | 53 / 53 pass |
| 2 RED | `--test-name-pattern="^reports:"` exports.integration | 6 tests, 5 pass, 1 fail (`INVALID_REPORT_EXPORT_ADMITTED_COLUMNS`) |
| 2 GREEN | the plan's verify: node check, tests tsc, exports.integration | 30 tests, 30 pass, 0 fail, 0 skipped; EXIT 0 |
| 3 focused | authorization-matrix.integration | 157 / 157 pass |
| 3 | the plan's verify: node check, `cmp`, `api:check` (+ refresh), `pnpm --dir apps/backend test` (ports 1337 and 3000 free) | EXIT 0: 2,178 tests, 2,177 pass, 0 fail, 1 skipped (the existing POSIX-modes test on Windows) |

`SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` ran once, in Task 1, with the dev servers stopped.

Acceptance checks:
- Both catalogue copies hold `function.reports.export_api.api.01` with URL `POST:/api/v1/reports/{reportKey}/export`. Neither holds `function.reports.reports.api.03`.
- `report-tables.ts` does no figure arithmetic. Every value is read from the figures object; only labels and dates are formatted.
- `analyst-insight-routes.unit.test.ts`: `SERVED_INSIGHT_ROUTES` holds the report export with `underlyingRead: CSRM_ANALYST_INSIGHT_OPERATIONS.getReport`, compared by the same exact `deepEqual`. `UNSERVED_PATH_FRAGMENTS` no longer holds `'"/v1/reports/:reportKey/export"'` and still holds `'"/v1/alerts/:'`, `"/acknowledge"` and both dashboard aliases.
- `exports.integration.test.ts`:
  - has a report case whose name includes `no columns parameter`;
  - asserts `CSRM exports are refused to automation identities.`, `CSRM analyst exports require a human Security Analyst.` and `CSRM export requires the list read.` exactly at the report export;
  - asserts that neither the insight wording nor the questionnaire-governance wording is used.
- `authorization-matrix.ts` contains `POST:/api/v1/reports/{reportKey}/export`, and `authorization-matrix.integration.test.ts` contains `36 + insightOperations.size`.
- `csrm-authorization.ts` contains the quoted literal `"POST:/api/v1/reports/{reportKey}/export"` (2 occurrences).
- `git diff --name-only bdd0f698` over `apps/backend/src/api/*/content-types/*` (less the three IAM exclusions) prints nothing.
- `active-risk-readers.unit` passes with no new exemption.

## Task Commits

1. **Task 1 (tracer): the risk exposure report exported as a workbook of its tables over HTTP.** `fc6f1aef` (test, RED), `8efc5299` (feat, GREEN)
2. **Task 2: CSV tables and every refusal of the report export.** `88208c6a` (test, RED), `8dedc59e` (fix, GREEN)
3. **Task 3: the matrix row and the full suite.** `51554f31` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The event log turned the approved view `report:{reportKey}` into `INVALID_ID`**
- **Found during:** Task 1 GREEN
- **Issue:** `security-event-log.ts` closes `view` to `^[A-Za-z0-9_-]{1,128}$`, so the colon in the view the approved record names (`report:risk-exposure`) was logged as `INVALID_ID`.
- **Fix:** `view` alone now uses `EXPORT_VIEW = /^[A-Za-z0-9_-]{1,64}(:[A-Za-z0-9_-]{1,63})?$/`, and every other identifier keeps its rule. A unit test proves that `report:risk-exposure` and `released-assessment` pass, and that an empty segment, a second colon, a space or a stray character is `INVALID_ID`. No contract text changed: this brings the module in line with the approved record.
- **Files modified:** apps/backend/src/csrm/audit/security-event-log.ts, apps/backend/tests/security-event-log.unit.test.ts
- **Commit:** 8efc5299

**2. [Rule 2 - Missing critical functionality] A body refused before the pipeline wrote no export event**
- **Found during:** Task 1 GREEN
- **Issue:** `runFixedTableExport` logs its own format, table and zone refusals. A body the report export does not take (an unknown key or a bad query) is refused before the pipeline runs, so D-18's one line per admitted attempt was missing.
- **Fix:** `logRefusedFixedTableRequest` in `run-export.ts` reuses the pipeline's private `exportEvent`. It writes `export.refused` with `INVALID_QUERY`, names the view and the format only when the format is known, and never logs the body.
- **Files modified:** apps/backend/src/csrm/exports/run-export.ts
- **Commit:** 8efc5299

**3. [Rule 3 - Blocking] The Phase 19 catalogue table assumed every export is a GET with a `format` query parameter**
- **Found during:** Task 1 RED
- **Fix:** `Phase19ExportRoute.method` is now `"get" | "post"`, and the report export is a table entry with its `reserved` source. For a POST, the test checks a required, closed body with exactly `format`, `query`, `table` and `timeZone`, `format` required, and no `format` or `columns` parameter. The design-note check also names `function.reports.export_api`.
- **Files modified:** apps/backend/tests/contract-catalogue.integration.test.ts
- **Commit:** fc6f1aef

**4. [Rule 1 - Bug, test] Sheet names over 31 characters in the test's own expectations**
- **Found during:** Task 1 GREEN
- **Fix:** Every expected sheet name goes through the same 31-character cut. "Most exposed Information Systems" is 32 characters, and "Assessment Requests by lifecycle state" is longer still.
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commit:** 8efc5299

### Choices the plan left open, and executed names that differ from the plan

- **RED that compiles.** The RED commit referred to `exportReport` through a `Record<string, string>` cast, so the tests ran and failed on assertions rather than on a type error. GREEN restored the direct `CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS.exportReport`.
- **Helpers beyond `reportExportTables`.**
  - `reportExportAbout(report)` gives As at and Period.
  - `reportExportView(reportKey)` gives the view `report:{key}`, the slug and the heading.
  - The `ComputedReport` type lives in `report-tables.ts`, and `computeReport` now returns it.
- **Order of work.** The report is computed before `runFixedTableExport` checks `format`, `table` and the zone, because the pipeline checks them as it writes. A CSV without its table therefore costs one report computation before its 400. No file is written and one refusal is logged.
- **Matrix citation.** Task 3 changed the cited risk exposure test to pass `harness.identities.analyst` explicitly, because the citation check needs the actor's identity in the cited test.
- **Not changed: the Phase 7 design note.** It still says "POST /api/v1/reports/{reportKey}/export stays unserved because report export is deferred beyond this milestone". The plan did not ask for a change. The Phase 7 note check still passes for the four operations left unserved, and the Phase 19 design note already records the move.
- **Not exported: treatment performance's most overdue list.** 19-04's vocabulary gives that report two tables (due state, treatment status), so the export writes those two. The page's "most overdue" list (at most 5 alerts) is not a vocabulary table.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-19-29:** the body allows four keys and no others. `query` is bounded (16 text values of at most 200 characters) and passes to the report's own parser. `table` must be one of the vocabulary's tables. Anything else is a 400 with one refusal line.
- **T-19-30:**
  - The entry left `function.reports.reports`, which the agent holds, for the human-only Report Export API.
  - The quoted literal is in both refusal sets, and the count guard is at 36.
  - The agent is refused with and without the mis-grant, in the automation wording. A mis-granted Requestor is refused in the analyst-exports wording.
  - The matrix row exists.
- **T-19-31:** the policy requires the report read and the insight scope's underlying reads, and the figures come from the report's own code.

## Self-Check: PASSED

- FOUND: apps/backend/src/csrm/exports/report-tables.ts
- FOUND: .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-09-SUMMARY.md
- FOUND commits: fc6f1aef, 8efc5299, 88208c6a, 8dedc59e, 51554f31
