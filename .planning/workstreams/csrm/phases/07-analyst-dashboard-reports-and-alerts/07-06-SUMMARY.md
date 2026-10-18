---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 06
subsystem: analyst-reports
tags: [strapi, knex, sqlite, openapi, openapi-typescript, zod, vitest, node-test, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 01)
    provides: the report-math partitions, throughputMonths and medianDays, utcToday and the calendar helpers, the named caps and windows, the report grants and requireAnalystInsightScope
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 02)
    provides: the Risk Register state=open filter that the exposure figures equal, and the served-shape pinning pattern
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 03)
    provides: REVIEWABLE_REQUEST_STATUSES, RELEASED_REQUEST_STATUSES and the harness createFixtureDocument seam
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 04)
    provides: createAlertRepository, projectAlertRow, applyDisclosableParent, the AlertItem component and parser, the AnalystInsight 400 and 403 responses and the insight route inventory
provides:
  - GET /api/v1/reports, the four closed report definitions in display order, and GET /api/v1/reports/{reportKey} for risk-exposure, treatment-performance, assessment-throughput and control-effectiveness, human Security Analyst only
  - createReportRepository (riskExposure, controlEffectiveness, treatmentPerformance, assessmentThroughput), REPORT_KEYS, REPORT_DEFINITIONS, isReportKey, parseReportRequest, assertEmptyReportQuery, ReportQueryError and ReportNotFoundError
  - report-math treatmentDueStateCounts and throughputReleased
  - the published report contract (two operations, 21 components, the ReportNotFound response) and the regenerated client
  - the web canonical copy map (report-copy.json with reportKeys, isReportKey, reportCopy and reportCopyEntries), closed per-branch parsers (report-schema.ts) and typed reads (report-service.ts: listReportDefinitions, getReport), registered with the parity guard
affects: [07-07, 07-08, 07-09, reports-screens, analyst-dashboard]

tech-stack:
  added: []
  patterns:
    - "A report is one closed branch of a union discriminated by its key. The web parses each key with that branch's own strict parser, so a report can never be read as another, and each parity guard entry names the branch it exercises."
    - "A mounted report read is walked against the published schema: every object's keys against its closed component, the union through its discriminator, and every leaf's type, enumeration, date format and bounds."
    - "The web owns canonical copy as JSON. Strapi restates the strings, and a mounted test reads the JSON and asserts the served strings equal it."

key-files:
  created:
    - apps/strapi/src/api/csrm-analyst-insight/services/report-definitions.ts
    - apps/strapi/src/api/csrm-analyst-insight/services/report-query.ts
    - apps/strapi/src/api/csrm-analyst-insight/services/report-repository.ts
    - apps/strapi/src/api/csrm-analyst-insight/controllers/reports.ts
    - apps/strapi/src/api/csrm-analyst-insight/routes/reports.ts
    - apps/strapi/tests/analyst-reports.integration.test.ts
    - apps/web/src/features/reports/report-copy.json
    - apps/web/src/features/reports/report-copy.ts
    - apps/web/src/features/reports/report-schema.ts
    - apps/web/src/features/reports/report-schema.test.ts
    - apps/web/src/features/reports/report-service.ts
    - apps/web/src/features/reports/report-service.test.ts
  modified:
    - apps/strapi/src/csrm/insights/report-math.ts
    - apps/strapi/tests/analyst-insights.unit.test.ts
    - apps/strapi/tests/analyst-insight-routes.unit.test.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/web/src/features/contract-response-parity.test.ts

key-decisions:
  - "riskExposure() and controlEffectiveness() take no today: neither figure depends on the date, so the controller stamps today on every report. treatmentPerformance(today) and assessmentThroughput(today, period) take it."
  - "The median sample is bounded on both sides by the period, approval_date >= the first month start and < the end of the current month, so it covers exactly the releases the month counts cover."
  - "Exposed systems count COUNT(DISTINCT CASE WHEN ... THEN r.id END), and risksWithoutSystem is a NOT EXISTS over the link joined to an existing system, so every open High or Critical Risk is in exactly one system row or in risksWithoutSystem, and a duplicated link row can never double count."
  - "The key is checked before the query: an unknown key is 404 whatever its query. period is exactly \"6\" or \"12\" once; \"06\", \"6.0\", an empty value, a list or an operator object is 400."
  - "getReport(key, { period }) refuses a period for any report other than assessment-throughput, and any unknown key, before a read, and its result type narrows to the requested branch (ReportFor<K>)."

patterns-established:
  - "Report contract pinning: the catalogue block pins every report component's properties exactly, the partitions against the frozen datamodel vocabularies, each list's maxItems against its named cap, and the union's oneOf and discriminator mapping."

requirements-completed: [DASH-02]

duration: "about 47 minutes (16:13:02Z to about 17:00Z), including one full Strapi suite of 7 min 21 s"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 7
---

# Phase 7 Plan 06: Analyst Report Index, Four Server-Computed Reports and Their Contract Summary

**The human Security Analyst now reads the report index from `GET /api/v1/reports` and four exact, read-only reports from `GET /api/v1/reports/{reportKey}`, each computed on read by database aggregates over the open contextual Risk scope or the review scope: risk exposure, treatment performance, assessment throughput over six or twelve UTC months, and control effectiveness. Every figure that a report tile links to equals that list's total. The contract is a closed union discriminated by the report key, the client is regenerated, and the web parses each report with its own strict branch parser against a canonical copy map that Strapi's definitions must equal.**

This is plan 6 of 9 (D-35), wave 4. It delivers D-13 end to end, with D-01, D-03, D-04, D-14, D-24 and D-36 on the server, D-08 and D-09 for both report operations, and UI-D19 for the copy map. Plan 07 renders the reports.

## Performance

- **Duration:** about 47 minutes, from 16:13:02Z to about 17:00Z. This includes one full Strapi suite (7 min 21 s), one full web suite, three RED and three GREEN rounds of the mounted report file, the catalogue file twice, 11 mounted mutation runs and one web parity mutant.
- **Started:** 2026-09-24T16:13:02Z
- **Completed:** 2026-09-24, at the docs commit that carries this summary
- **Tasks:** 3 of 3, each a RED commit followed by a GREEN commit, plus one refactor commit
- **Files:** 19 (12 created, 7 modified), plus this summary

## Accomplishments

- **The report index (D-13, UI-D19).**
  - `GET /api/v1/reports` returns the four definitions `{ key, title, description }` in display order: risk-exposure, treatment-performance, assessment-throughput, control-effectiveness.
  - `report-definitions.ts` restates the strings of `apps/web/src/features/reports/report-copy.json`, and the mounted test reads that JSON and asserts the served list deep-equals its projection.
- **risk-exposure (D-14, D-36).** Every figure counts open contextual Risks: the Risk Register's `applyDisclosableParent` plus `r.closure_date IS NULL`, the register's own `state=open` predicate.
  - `byResidualRating` and `byInherentRating` fold one grouped read each through `ratingCounts`.
  - `residualByTreatmentStatus` splits the residual-rating by treatment-status rows into one `treatmentStatusCounts` partition per rating, `notRated` last.
  - `exposedSystems`: at most `EXPOSED_SYSTEMS_LIMIT` (10) systems by open High and Critical residual Risks, most Critical first, then most in total, then by name and documentId. A `COUNT(DISTINCT)` gives the full `total`, the cap plus one gives `truncated`, and a `NOT EXISTS` gives `risksWithoutSystem`.
- **treatment-performance (D-04, D-13, D-31).**
  - `dueState` is one aggregate read over open treatments that are not Complete. A NULL status counts as not Complete through `(r.treatment_status IS NULL OR r.treatment_status <> ?)`. The window of `TREATMENT_REPORT_DUE_WINDOW_DAYS` (30) is inclusive at both ends, bound as `YYYY-MM-DD` strings because target dates are date columns.
  - `treatmentStatus` counts every open contextual Risk by its recorded status.
  - `mostOverdue` is the `risk-treatment-overdue` alert branch itself: `createAlertRepository(strapi).listPage` at `MOST_OVERDUE_TREATMENTS_LIMIT` (5) with its `count`, projected with `projectAlertRow`. The rows are the served `AlertItem`s, oldest target date first.
- **assessment-throughput (D-03, D-13).**
  - `throughputMonths(today, period)` gives the months, oldest first, with the current month partial. One read sums releases per month with `approval_date >= ? AND approval_date < ?`, each bound as a JS `Date`, over the complete release triple.
  - The median reads the releases in the period whose request records a submission, newest first, capped at `THROUGHPUT_SAMPLE_CAP + 1` (5,001), and `medianDays` flags a capped sample as truncated.
  - `requestsByStatus` counts only the six review-scope statuses; a draft never counts.
  - `period` is 6 or 12 and defaults to 6.
- **control-effectiveness.** Control Implementations on open contextual Risks (the `ineffective-control` alert scope), by implementation status and by effectiveness rating.
- **Closed request and denial (D-09).**
  - The policy runs before the key or the query is read, so the Requestor, the second Requestor, the service agent, the analyst-named identity without a role, the inactive analyst and a missing identity all get 403 on both routes, for known and unknown keys alike. A missing token gets 401.
  - For the analyst, an unknown key is 404 ("CSRM report was not found."), and any query a report does not take is 400 ("CSRM report query is invalid.").
- **Contract and client (D-08).**
  - Both operations are published under the `analyst-insights` tag with the closed `ReportKey`, the `period` parameter (integer, enum [6, 12], minimum 6, default 6) and the `ReportNotFound` response.
  - `ReportResponse.data` is a `oneOf` of the four report components with discriminator `key`. Every component is closed.
  - The client is regenerated and `api:check` is clean.
  - The web parses the index and each branch with strict Zod schemas, registered with the parity guard (one entry per branch), and `getReport` sends `period` only for the throughput report.

## Task Commits

1. **Task 1 RED: pin the report index and the exposure and control reports against controlled fixtures.** `1aac5ac` (test)
2. **Task 1 GREEN: serve the report index and the exposure and control effectiveness reports.** `cf3277d` (feat)
3. **Task 2 RED: pin treatment performance and assessment throughput to literal fixture values.** `b62ea91` (test)
4. **Task 2 GREEN: serve the treatment performance and assessment throughput reports.** `5f26a04` (feat)
5. **Task 3 RED: pin the published report contract and its closed branch parsers.** `083e4ba` (test)
6. **Task 3 GREEN: publish the report operations and parse each report branch closed.** `a7404a0` (feat), with the spec and the regenerated `schema.d.ts` together
7. **Refactor: name the report scopes once and share the throughput period type.** `e9d0e75` (refactor), a header comment and a type-only import

**Plan metadata:** the `docs(07-06)` commit that carries this summary.

## Files Created/Modified

- **Strapi, reports** (`apps/strapi/src/api/csrm-analyst-insight/`):
  - `services/report-definitions.ts`: `REPORT_KEYS`, `REPORT_DEFINITIONS` and `isReportKey`.
  - `services/report-query.ts`: `parseReportRequest`, `assertEmptyReportQuery`, `ReportQueryError` (400), `ReportNotFoundError` (404) and `ThroughputPeriod`.
  - `services/report-repository.ts`: `createReportRepository` with the four report reads, over the scope builders `openContextualRisks`, `implementationsOnOpenContextualRisks` and `releasedAssessments`.
  - `controllers/reports.ts`: the plain-object `list` and `get` handlers, with the closed switch over the parsed key.
  - `routes/reports.ts`: both routes, token-only, app-gated, with the insight scope.
- **Strapi, shared:** `apps/strapi/src/csrm/insights/report-math.ts` gains `treatmentDueStateCounts` and `throughputReleased` with their types.
- **Contract:** `docs/references/specification.json` (two paths, 21 components, one response) and `apps/web/src/lib/api/generated/schema.d.ts` (regenerated).
- **Web** (`apps/web/src/features/reports/`): `report-copy.json` and `report-copy.ts`, `report-schema.ts` and `report-service.ts`, and their tests; `contract-response-parity.test.ts` gains the module.
- **Tests:**
  - `analyst-reports.integration.test.ts` (new): 11 mounted tests.
  - `analyst-insights.unit.test.ts`: 2 new tests.
  - `analyst-insight-routes.unit.test.ts`: the report router and its two routes join the inventory.
  - `contract-catalogue.integration.test.ts`: 1 new block.
  - `report-schema.test.ts` (9) and `report-service.test.ts` (6).

## Report Fixture Reference

The mounted file builds these with `createFixtureDocument`. D(n) is n days from the test's UTC today, and M(n) is the first day of the UTC month n months from this one.

| Record | Facts | Counted by |
| --- | --- | --- |
| AM | assessment `in-review`, request `under-review` | parent of A to I and G |
| AR | released, approved at M(-20), request `approved`, submitted 15 days before | parent of RR; outside every throughput period |
| AP | approved at D(-30) with no approver, request `approved`, submitted D(-40) | parent of H; never in scope |
| A | Critical / High / Not Started / target D(-2) / Alpha system | exposure, overdue |
| B | High / Critical / In Progress / target D(10) / Alpha system | exposure, due within the window |
| C | High / High / no status / target D(40) / Beta system | exposure, later |
| D | Moderate / Low / Complete / target D(-5) | exposure; not in the due state |
| E | Low / "Extreme" / stored Overdue / no target | exposure, no target date |
| F | no ratings / Not Started / target D(30) | exposure, due within the window (the inclusive edge) |
| I | High / Moderate / Not Started / no target / no system | exposure, no target date, `risksWithoutSystem` |
| G | Critical, closed at D(-1), target D(-4), Alpha system | nothing |
| H | Critical on AP, target D(-6), Beta system | nothing |
| RR | Critical / High / In Progress / target D(-12) / Beta system, on AR | exposure, overdue, released alert row |
| Control Implementations | A Planned/Not Assessed, B Implemented/Effective, C Implemented/Ineffective, RR Existing/Partially Effective, I none/none; G and H Implemented or Planned/Ineffective | control-effectiveness counts the first five |
| AR1, AR4 | released at M(0) plus one and two hours; AR1 submitted 10 days before, AR4 with no submission | this month |
| AR2 | released at M(-2) plus five days, submitted 30 days before | two months back |
| AR3 | released at M(-8) plus five days, submitted 5 days before, request `closed` | twelve-month period only |
| APX, AIR | approval facts at M(0) plus three and four hours, but APX has no approver and AIR is still `in-review` | never |
| QS, QQ1, QQ2, QD, QDRAFT | requests in `submitted`, `questionnaire-in-progress` (two), `risk-assessment-drafted` and `draft` | request counts, except the draft |

A script evaluated the throughput month buckets for every day of 2027 and 2028, including each month's first day, the year boundaries and the 2028 leap day. It found no day on which the literal counts `[0, 0, 0, 1, 0, 2]` and `[0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 2]` would change.

## Verification

**RED, per task:**

| Check | Result |
| --- | --- |
| Task 1: `tsc -p tests/tsconfig.json` | exit 1: TS2307 for `routes/reports` in the route inventory |
| Task 1: `analyst-reports.integration`, emitted with `--noEmitOnError false` | 0 passed, 7 failed: every read 404 `NotFoundError` (no route), and the denial test got 404 instead of 403 |
| Task 2: `tsc -p tests/tsconfig.json` | exit 1: TS2305 `throughputReleased`, TS2724 `treatmentDueStateCounts`, and one TS7031 knock-on |
| Task 2: `analyst-insights.unit`, emitted | 27 passed, 2 failed: "`treatmentDueStateCounts` is not a function" and "`throughputReleased` is not a function" |
| Task 2: `analyst-reports.integration` | 8 passed, 3 failed: both new reports answered 500. The period-closure test passed, because Task 1's parser already refused those forms (deviation 5). |
| Task 3: `contract-catalogue.integration` | 14 passed, 1 failed: `UNEXPECTED_MISSING_GET_/v1/reports` |
| Task 3: `analyst-reports.integration` | 3 passed, 8 failed: `REPORT_SPEC_COMPONENT_MISSING_ReportResponse` (7) and `..._ReportDefinitionListResponse` (1) |
| Task 3: web (`vitest run src/features/reports src/features/contract-response-parity.test.ts`) | 3 files failed: "Failed to resolve import" for `./report-schema`, `./report-service` and `./reports/report-service` |

**GREEN, per task:**

| Check | Result |
| --- | --- |
| Task 1: root `tsc`, tests `tsc` | both exit 0 |
| Task 1: `analyst-insight-routes.unit` + `analyst-reports.integration` | 9 passed, 0 failed (re-run after the mutants: 7 of 7 mounted) |
| Task 2: root `tsc`, tests `tsc` | both exit 0 |
| Task 2: `analyst-insights.unit` | 29 passed, 0 failed |
| Task 2: `analyst-reports.integration` | 11 passed, 0 failed (re-run after the mutants: 11 of 11) |
| Task 3: web targeted (`src/features/reports`, parity) | 78 passed across 3 files; the guard ran all five report entries against the minimal, maximal and nullable instances |
| Task 3: web typecheck | exit 0 |
| Task 3: `contract-catalogue.integration` + `analyst-reports.integration` + `analyst-insight-routes.unit` | 28 passed, 0 failed |
| Task 3: `api:check` after the commit | exit 0 |

**Mounted mutants** (`analyst-reports.integration`). Each was applied to `report-repository.ts`, run through the harness (which recompiles `dist` from `src`), and restored. The sha256 was identical before and after every one.

| Mutant | Killed by |
| --- | --- |
| open-Risk scope without `r.closure_date IS NULL` (the plan's `fails_when`) | `RISK_EXPOSURE_BY_RESIDUAL_RATING`, `REGISTER_TOTAL_DIFFERS_Critical`, `EXPOSED_SYSTEMS_ORDER` |
| open-Risk scope without `applyDisclosableParent` | the same three |
| Control Implementation scope without the closure predicate | `CONTROL_EFFECTIVENESS_IMPLEMENTATION_STATUS` |
| Control Implementation scope without `applyDisclosableParent` | `CONTROL_EFFECTIVENESS_IMPLEMENTATION_STATUS` |
| `risksWithoutSystem` with `EXISTS` for `NOT EXISTS` | `RISK_EXPOSURE_EXPOSED_SYSTEMS`, `RISKS_WITHOUT_SYSTEM_CHANGED` |
| month bounds bound as ISO strings (the plan's `fails_when`) | `THROUGHPUT_MONTH_COUNTS`, `THROUGHPUT_TWELVE_AR3_COUNT` |
| window end exclusive, so F counts as later (the plan's `fails_when`) | `TREATMENT_DUE_STATE` |
| a bare `treatment_status <> ?` that drops NULL | `TREATMENT_DUE_STATE` |
| the median sample without its period start | `THROUGHPUT_MEDIAN`, `THROUGHPUT_TWELVE_MEDIAN` |
| releases without the approver | `THROUGHPUT_MONTH_COUNTS`, `THROUGHPUT_TWELVE_MONTH_COUNTS` |
| releases without the approved status | `THROUGHPUT_MONTH_COUNTS`, `THROUGHPUT_TWELVE_MONTH_COUNTS` |

**Parity guard mutant (web).** Naming `RiskExposureReport` as the treatment-performance entry's branch fails the guard: "reports.getReport.treatmentPerformance rejected the minimal GET /v1/reports/{reportKey} payload permitted by the contract". The file was restored byte-exact. The new entries are not vacuous.

**Acceptance checks:**

| Check | Result |
| --- | --- |
| `routes/reports.ts` contains `requireAnalystInsightScope` | yes |
| `report-repository.ts`: `closure_date IS NULL` / `applyDisclosableParent` / `treatment_status IS NULL OR` / `toISOString` | 3 / 4 / 1 / 0 |
| `approval_date` bounds | `month.start` and `month.end` from `throughputMonths`, and `months[0].start` and the last month's `end`: all `Date` objects |
| `report-copy.json` entries | 4 |
| `specification.json` contains `"/v1/reports/{reportKey}"` and `"ReportResponse"` | yes; `ReportResponse.properties.data.discriminator.propertyName` is `"key"` |
| `contract-response-parity.test.ts` contains `features/reports/report-service.ts` | yes |

**Plan gate** (final tree `e9d0e75`):

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 335 passed, 0 failed, 0 cancelled, 0 skipped, exit 0 (16:48:19Z to 16:55:43Z, 7 min 21 s). This is 321 at the 07-05 gate plus 14 new: 11 mounted report tests, 2 unit tests and 1 catalogue block. |
| `pnpm --filter @csrm/web test` (full) | 643 passed across 63 files, exit 0. This is 623 across 61 at the 07-05 gate, plus 20 new: 9 schema, 6 service and 5 parity entries. |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0 |
| `git diff --name-only 4bcd4ac HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| `cmp` of the two catalogue copies | identical; neither changed in this plan |
| Deleted files across the plan | none |
| Commit messages and added lines scanned for attribution trailers and tool or assistant names | none |

The web suite, typecheck and `api:check` ran while the Strapi suite was running. None of them reads `apps/strapi/dist`.

## Orchestrator Amendments Applied

- **Served-shape pinning (plan check issue 1).**
  - Tasks 1 and 2 pinned the literal key set of every served level: the index envelope and each definition; each report envelope and report; every rating, status, effectiveness, due-state and request partition; the residual-by-status matrix and each of its rows; the exposed-systems object and each system row; the most-overdue object and each alert row with its `source` and `link`; the released object, each month and the median.
  - Task 3's RED added the spec comparisons, because the components are published in Task 3 (deviation 1).
    - Every one of those levels is also compared with `specKeys(component)` of its published component.
    - Every served body in the file (the index, every report read, both throughput periods and the truncated exposure) is walked by `assertMatchesSpec` against its published schema. The walk resolves the report union through its discriminator, requires the branch to be one of the union's, and checks every leaf's type, enumeration, date format, minimum, length and `maxItems`.
    - `readReport` also asserts the discriminator maps the served key to that report's component.
- **Route inventory (plan check issue 10).** `analyst-insight-routes.unit.test.ts` now lists `routes/reports.ts` and both report routes, with their handlers and operations. Two assertions were generalised:
  - an operation names its route with `:param` written `{param}`, as the catalogue writes `GET:/api/v1/reports/{reportKey}`;
  - each path must be declared only by its own router file, which is now named per route rather than always `alerts.ts`.
  The static scan still refuses any D-06 path, including `/export`, in every router.

## Decisions Made

- **No `today` for exposure and control effectiveness.** Neither figure depends on the date, so `riskExposure()` and `controlEffectiveness()` take no argument. The controller reads the clock once per report and stamps `today` on every report, as the contract requires.
- **The median covers exactly the period.** The sample is `approval_date >= ` the first month start and `< ` the end of the current month, both `Date` values, so an approval dated beyond this month can never enter the median without entering a month count.
- **Exposed systems are exact.** Each system counts `COUNT(DISTINCT CASE WHEN r.residual_rating = ? THEN r.id END)` per rating, so a duplicated link row could never double count. `risksWithoutSystem` is a `NOT EXISTS` over the link joined to an existing system. Every open High or Critical Risk is therefore in exactly one system row or in `risksWithoutSystem`.
- **The key before the query.** An unknown key is 404 whatever its query. `period` is exactly `"6"` or `"12"` once. `"06"`, `"6.0"`, an empty value, a repeated value, an operator object and any other key are 400.
- **Messages.** "CSRM report query is invalid." (400) and "CSRM report was not found." (404). Error bodies are asserted free of `SQL`, `stack`, `database` and fixture data.
- **Invariants fail loudly.** `treatmentDueStateCounts` throws a RangeError when the parts do not add up to the total. `throughputReleased` throws when there is not exactly one count per month. The repository refuses a malformed `today` or a period outside the closed set. Each of these would surface as a generic 500, never as a wrong figure.
- **Contract details beyond the plan.**
  - Descriptions on every operation and component.
  - `MedianDaysToRelease.value` declares `minimum: 0`.
  - `ExposedSystem.name` declares `minLength: 1` and `maxLength: 255`, as the Information System administration contract does.
  - `ReportDefinition.title` and `description` declare `minLength: 1`, and the list declares `maxItems: 4`.
  - The period declares `default: 6`.
  - The catalogue block pins every component exactly, the partitions against the frozen datamodel vocabularies, and each `maxItems` against its named constant.
- **Web.**
  - `getReport(key, { period })` validates `{ key, period }` with a closed union before any read. It refuses a period for any report except assessment-throughput, an unknown key and a string period.
  - The result type narrows to the requested branch (`ReportFor<K>`), and a contract mismatch names that branch (for example `reports.getReport.riskExposure`).
  - `reportPeriodSchema` reads exactly `12` (or `"12"`, or the first of a list) as twelve and anything else as six.
  - `reportSchema` (the discriminated union) and the `Report` types are exported for plan 07.
  - The copy map's tests live in `report-schema.test.ts`, because the plan lists no separate copy test file.
- **Spec editing.** `specification.json` is hand-formatted CRLF text, not stringify output. The three blocks were inserted as text at unique anchors, and the result was checked to parse and to contain no lone LF.
- **`requirements-completed`** lists DASH-02, copied from the plan. It completes with the phase. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed.

## Deviations from Plan

1. **[Amendment] Spec-pinned shapes were added in Task 3.** The components are published in Task 3, so Tasks 1 and 2 pinned literal key sets. Task 3's RED added `specKeys` to every level and the recursive walk; they failed on the missing components and pass now. This is the same resolution 07-04 recorded. **Commits:** `083e4ba`, `a7404a0`.
2. **[Amendment] The route inventory was extended in Task 1's RED**, a file outside the task lists, and two of its assertions were generalised (see above). **Commits:** `1aac5ac`, `cf3277d`.
3. **[Plan detail] `riskExposure()` and `controlEffectiveness()` take no `today`.** See Decisions Made.
4. **[Additional proof] Beyond the behaviour lists.**
   - **Fixtures:**
     - G and H carry Information Systems and past target dates, so each exclusion is proved on every report.
     - AR's and AP's requests carry submission dates, so the period bound and the approver are proved on the median.
     - AIR carries release facts but is in review, so the status is proved on its own.
     - Five standalone requests give every review-scope status a distinct count and add one more draft.
   - **Mounted assertions:**
     - the due state agrees with `deriveTreatmentDueState` on every in-scope fixture;
     - the most-overdue rows are the literal served `AlertItem`s, and their total equals the overdue count;
     - the register totals are checked for all four ratings and in total;
     - key case variants are 404, and eight period forms are 400;
     - every denial path, including an unknown key, is 403 for six identities, and a missing token is 401;
     - the truncated exposure pins the ten literal rows and the rating counts after the extra Risks.
   - **Unit:** zero and NULL sums, and both invariant failures.
5. **[Plan detail] One RED test passed before its GREEN.** At Task 2's RED, "the throughput period is closed to six or twelve months" already passed, because Task 1's GREEN implemented `parseReportRequest` with the period rule, as the plan's Task 1 action specifies. It pins behaviour Task 1 delivered, not a missing feature, so it is not the fail-fast case. The three tests on the new reports failed as expected.
6. **[TDD intermediate] Between `cf3277d` and `5f26a04`**, treatment-performance and assessment-throughput answered a generic 500. Task 2's RED observed it, and Task 2's GREEN closed it. No stub remains.
7. **[Refactor] `e9d0e75`.** It changes only the repository's header comment and makes `ThroughputPeriod` a type import from `report-query.ts`. Both compiles are clean, and the plan gate ran on that tree.
8. **STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.** The orchestrator owns them, so the executor's state-update steps were skipped.

**Total deviations:** 8. Items 1 and 2 apply the binding amendments. Item 3 is a small interface refinement. Items 4 to 6 add proof or record TDD facts without changing planned behaviour. Item 7 is a comment and type-only cleanup, and item 8 follows the orchestrator's instruction.

## Issues Encountered

- **Targeted vitest runs.** `pnpm --filter @csrm/web test -- <patterns>` runs the whole suite, as 07-02 recorded. Targeted runs used `pnpm --filter @csrm/web exec vitest run <files>`.
- **RED runtime evidence under `noEmitOnError`.** The strict tests `tsc` emits nothing while a test imports a missing module or export, so RED runs were observed by emitting once with `--noEmitOnError false`. Every GREEN run used the strict compile.
- **Line endings.** New files were written with LF, and git warns they become CRLF in the working copy (`core.autocrlf=true`). Edited CRLF files kept their endings, and the spec insertion wrote CRLF only. `api:check` shows no content diff.
- **pnpm engine warning.** pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix. `node` resolved to v24.19.0 for every run.

## Deferred Issues

- **PostgreSQL portability (research A2).** The report SQL orders by output aliases (`critical`, `total`), sums CASE terms, and binds `Date` values against `approval_date`. Each is portable by construction, and every count and sum is read as a number or a digit string. It is unverified because `pg` is not installed, so it joins the Phase 8 notes.
- **An equivalent mutant.** Dropping the SQL status filter on the request counts would survive, because `requestStatusCounts` also ignores a draft. The two layers agree, so the served figure cannot change.
- **Items recorded by 07-01 to 07-05 are unchanged.**
  - `authorization.policy.test.js` never runs.
  - `verify-phase-06-integrity.mjs` has stale counts.
  - The Risk Register's parity entry is vacuous.
  - Error envelopes carry an undeclared `data: null`, and the report 400, 403 and 404 bodies are Strapi's standard envelope too.

## Known Stubs

None. Both operations are served, published, parsed and registered with the parity guard, and every report field is computed from the database. Plan 07 renders them.

## Threat Flags

None beyond the plan's threat model.
- **T-07-06-01:** there are no grouping parameters; the only query parameter is `period`, in {6, 12}. The SQL reuses `applyDisclosableParent`, the open predicate, the release triple and the review status sets. G, H, AP, APX, AIR and the drafts prove the exclusions, and a mutant is killed for each scope rule.
- **T-07-06-02:** the policy runs before key validation. The mounted matrix gives 403 for an unknown key to all six identities.
- **T-07-06-03:** the key and period are closed enums, the report comes from a closed switch, every value is bound, and every alias and order fragment is a constant.
- **T-07-06-04:** aggregates run in SQL, the lists are capped at 10 and 5, and the median sample at 5,001 is flagged as truncated.
- **T-07-06-05:** the service agent and the analyst-named identity without a role are refused on both routes.

## Next Phase Readiness

- **Plan 07 (Reports screens):**
  - Use `listReportDefinitions()`, `getReport(key, { period })` (result `TransportResult<ReportFor<K>>`), `reportPeriodSchema`, and `reportCopy`, `isReportKey`, `reportKeys` and `reportCopyEntries` from `report-copy.ts`.
  - The DTO fields are exactly those in plan 07's interfaces block. `mostOverdue.rows` are `AlertItem`s for `AlertRow`, and `dueWindowDays` is served (30).
  - A 403 keeps 403 and a 404 keeps 404.
  - Throughput months arrive oldest first with only the last `partial`, and the months are always served, zero or not.
  - The literal fixture values in `report-schema.test.ts` can seed the view tests.
- **Plan 08 (dashboard):**
  - `RatingCounts` is the published component for `riskExposure`.
  - The open-scope residual aggregate is `openContextualRisks` in `report-repository.ts` (private), to mirror or export.
  - Extend `analyst-insight-routes.unit.test.ts` with the dashboard route; the inventory now handles `:param` paths.
- **Orchestrator:**
  - The dev Strapi must restart to mount the report routes.
  - Browser checks, as Bob:
    - `GET /api/v1/reports` returns the four definitions;
    - each of the four reports returns 200, and `assessment-throughput?period=12` returns twelve months;
    - on the development database, the risk-exposure residual counts equal `/app/risks?residualRating={rating}&state=open`.
  - As Jane, both routes answer 403.

## TDD Gate Compliance

Each task has a `test(07-06)` RED commit followed by its `feat(07-06)` GREEN commit: `1aac5ac` then `cf3277d`, `b62ea91` then `5f26a04`, and `083e4ba` then `a7404a0`. The REFACTOR step is `e9d0e75`.

## Self-Check: PASSED

- The 12 created files exist and are tracked at HEAD.
- Commits `1aac5ac`, `cf3277d`, `b62ea91`, `5f26a04`, `083e4ba`, `a7404a0` and `e9d0e75` exist on `dev`.
- No tracked file was deleted between `4bcd4ac` and HEAD.
- `git status` showed only the pre-existing untracked `.planning/debug/` and this summary before the docs commit.
