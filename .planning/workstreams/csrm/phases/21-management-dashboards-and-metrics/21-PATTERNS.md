# Phase 21: Management dashboards and metrics - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 44 (grouped where they share one analog)
**Analogs found:** 41 / 44
**Economy (stage2-rules §3a):** areas an earlier phase already mapped are cited to its PATTERNS, not re-surveyed. `B/` = `apps/backend/`, `W/` = `apps/csrm/`. "First changed by" names the earlier plan (or phase) that changes the file before Phase 21 (execution order 10 … 20, 21); Phase 21 plans build on that planned state and Stage 3 re-checks it. Every analog path below is git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match | First changed by |
|---|---|---|---|---|---|
| `docs/contract-gaps/phase-21-stage-history.md`, `phase-21-ai-job-history.md` (+ dated amendments to the 06.1, 06.8, 07, 12, 16, 17, 17.1, 17.2 records) | doc | — | `docs/contract-gaps/phase-06.1-revert-audit-facts.md`; 20-PATTERNS row 1 | exact | records 12..20 written by those phases |
| `B/src/api/csrm-stage-transition/content-types/csrm-stage-transition/schema.json` + `routes` (core router `only: []`), `controllers`, `services` | model | append-only | 16-PATTERNS rows for `csrm-risk-history-event` (schema, core router `only: []`), i.e. Phase 12's `B/src/api/csrm-ai-run/` | exact | 12-04, 16-03 (analogs) |
| `B/src/csrm/stage-history/stage-derivation.ts`, `stage-causes.ts` | utility (pure) | transform | `B/src/api/csrm-assessment-request/services/request-lifecycle.ts` (`highestMatchingStep`); 17-03's `deriveAssessmentStage` | exact | **17-03**, 17.1, 17.2 (widen `deriveAssessmentStage`) |
| `B/src/csrm/stage-history/stage-facts.ts` (load `StageFacts` in trx) | service | read | `review-queue-repository.ts` l.72-112 (questionnaire/assessment facts); `questionnaire-scope.ts` `questionnaireState` | role-match | Phases 11, 13 |
| `B/src/csrm/stage-history/stage-recorder.ts` (`withStageRecording`) | service | append-only, in-transaction | 19.1-PATTERNS §`notification-service.ts` (`notify`: `inTransaction()` guard, request row lock) + 13-PATTERNS §`request-lock.ts` l.107 (`forUpdate` shape) + 16-PATTERNS §`risk-history.ts` (only writer) | exact | **19.1-03**, 13-03, 16-03 |
| `B/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` (`update` wrapped in `withRequestLock`; `delete` refuses `REQUEST_HAS_STAGE_HISTORY`) | controller | request-response | itself l.162-185; 13-06's `delete(ctx)` override (13-PATTERNS) | exact | **13-03, 13-06**, 14, 16 (delete refusals) |
| `B/src/api/csrm-assessment-request/services/request-workflow.ts` (revert) | service | CRUD | itself (`revertRequestToDraft` l.107-115) | exact | 13-03 (`withRequestLock`) |
| `B/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts`, `questionnaire-workflow.ts` (request row lock first; recorder) | service | CRUD (trx) | themselves (l.186, 316-329; l.205-222, 358-385) | exact | 10, 15, **19.1-03** (notify) |
| Round/acceptance/contest act sites: `response-rounds.ts` (17), submit/recall/release-and-close (17.1), send back (17.2) | service | CRUD (trx) | 17-PATTERNS, 17.1-PATTERNS (l.199 lock order), 17.2-PATTERNS | exact | **Phase 17, 17.1, 17.2** (create them) |
| `B/src/csrm/insights/working-days.ts`, `stage-statistics.ts`, `trend-as-at.ts`, `ai-run-groups.ts`, `heat-map-fold.ts` | utility (pure) | transform | `B/src/csrm/insights/report-math.ts` (`throughputMonths` l.223-235, `medianDays` l.247-261) + `utc-date.ts` | exact | 11-17 (report-math), 20 |
| `B/src/csrm/insights/insight-constants.ts` (bands, week, caps, slowest-N, min sample) | config | — | itself l.27-36 | exact | 11-17, Phase 20 |
| `B/src/api/csrm-analyst-insight/services/report-definitions.ts` (3 keys) | config | — | itself l.10-48 | exact | 11-17, **Phase 20** (filters) |
| `B/src/api/csrm-analyst-insight/services/report-query.ts` (+ records parsers) | utility (closed parser) | validation | itself l.41-68 (`parsePeriod`, `parseReportRequest`) | exact | Phase 20 (report filters) |
| `B/src/api/csrm-analyst-insight/services/report-repository.ts` (+ `riskTrend`, `cycleTimes`, `aiAssistance`, additions, p90) | service | aggregate | itself `assessmentThroughput` l.358-399 | exact | 11-17, **Phase 20** |
| `B/src/api/csrm-analyst-insight/services/report-records.ts` (new: `{ figure, rows }` per key) | service | read (paginated) | `alert-repository.ts` (paginated list, `ALERT_PAGE_SIZES`) + `report-repository.ts` | role-match | 11-17 |
| `B/src/api/csrm-analyst-insight/routes/reports.ts`, `controllers/reports.ts`, `operations.ts` (`/v1/reports/:reportKey/records`) | route/controller | request-response | themselves (routes l.11-35; controller l.32-83) | exact | Phase 19 (export route), 20 |
| `B/src/api/csrm-analyst-insight/services/dashboard-summary.ts` (ageing, failed runs, reviews due) | service | aggregate | itself | exact | 11-17, 13, **Phase 20** |
| `B/src/api/csrm-assessment-request/services/review-queue-repository.ts` (`stage`, `ageBand`, `inStage`) | service | read | itself (link joins l.72-112) + RESEARCH R7 `latestStageRows` | exact | Phases 11, 13, 20 |
| `B/src/api/csrm-assessment-request/services/request-status-summary.ts` / My requests projection (`inStage`) | service | read | itself (19.1-PATTERNS cites l.34-80) | exact | 11, 17.1 |
| `B/src/api/csrm-risk/services/risk-register-query.ts`, `risk-register.ts` (4 position filters, heat-map aggregate); `routes/*.ts` (`/v1/risks/heat_map` before `:riskId`) | service/route | read | themselves; 19-05 export route ordering (19-PATTERNS); 20-PATTERNS register row | exact | 11-15, **18, 19-05, 20** |
| `B/src/policies/csrm-authorization.ts` (`HUMAN_ANALYST_ONLY_OPERATIONS` l.41, `ANALYST_INSIGHT_UNDERLYING_READS` l.57, scope l.334-343 per key) | middleware | request-response | itself; 19.1-PATTERNS §`csrm-authorization.ts` | exact | 12, 13, 14, 19, 19.1, 20 |
| `docs/references/specification.json`, both catalogue copies, `served-operations.json`, `W/src/lib/api` generated | config | — | prior contract tasks (20-PATTERNS row) | exact | every earlier phase |
| `B/src/bootstrap/seed-stage-history.ts` (or extension of `seed-analyst-insights.ts`) | seed | batch | `B/src/bootstrap/seed-analyst-insights.ts` l.100-146 (`reconcile`, day offsets) | exact | 20 (`seed-treatment-reminders.ts` precedent) |
| `B/src/index.ts` (seed call) | config | — | itself; 20-PATTERNS §`B/src/index.ts` | exact | 14, 17, 19.1, 20 |
| `docs/security/phase-08-residual-risks.md` (R-08-36, R-08-37) | doc | — | 13 D-19's update task (13 plans) | exact | Phase 13 |
| `B/tests/*.integration.test.ts` (stage-history, acts, oracle, cycle-times, risk-trend, heat-map, ai-assistance, queue ageing), `tests/fixtures/authorization-matrix.ts` | test | — | `analyst-insights-seed.integration.test.ts`, `review-queue-buckets.integration.test.ts`, `authorization-matrix.integration.test.ts`; 20-PATTERNS tests row | exact | 14-04, 19.1, 20 |
| `B/tests/*.unit.test.ts` (derivation, recorder, working days, statistics, as-at, groups, guards, records query) | test | — | `analyst-insights.unit.test.ts`, `analyst-insight-routes.unit.test.ts`; 16-RESEARCH static guard | exact | — |
| `W/src/components/csrm/risk-trend-chart.tsx` (X-68) | component | transform | `W/src/components/csrm/bar-chart.tsx` (types l.8-53, `BarChart` l.219) + `kpi-tile.tsx` | role-match | Phase 7 |
| `W/src/components/csrm/risk-matrix.tsx` (X-69) | component | transform | 18-PATTERNS matrix picker (X-57) + `report-table.tsx` | partial | **Phase 18** |
| `W/src/components/csrm/bar-chart.tsx`, `kpi-tile.tsx` (phone labelled rows; delta + sparkline) | component | transform | themselves | exact | — |
| `W/src/features/reports/{risk-trend,cycle-times,ai-assistance}-report.tsx`, `queue-ageing.tsx` | component | read | `assessment-throughput-report.tsx` (59 l.), `treatment-performance-report.tsx` | exact | 11, 20 |
| `W/src/features/reports/leadership-view.tsx`, `report-index.tsx` (h2s, 7 cards, Print) | component | read | `report-index.tsx` l.53-83 | exact | 11, 19 |
| `W/src/features/reports/report-drill-down.tsx` + `W/app/(app)/app/reports/[reportKey]/records/{page,loading,error}.tsx` | component/route | read (paginated) | `W/app/(app)/app/reports/[reportKey]/*` + `report-detail.tsx` (`ReportBreadcrumb` l.35, `ReportDetailLayout` l.58) + `features/alerts` list | exact | 11, 19 |
| `W/src/features/reports/{report-schema,report-service,report-detail,report-presentation,report-copy}.ts(x)`, `report-copy.json`, `metrics-format.ts` (new, zod-free) | service/utility | request-response | themselves (`reportSchema` discriminated union l.168; `getReport` l.100; switch l.71) | exact | 11, 19, 20 |
| `W/src/features/risks/*` (`Show as` heat map, position filters) | component | read | itself; 18-PATTERNS (toolbar, filters, views); 20-PATTERNS register row | exact | 11-15, **18, 20** |
| `W/src/features/requests/*` review queue (`In stage`, filters) | component | read | itself; 13-PATTERNS queue controls | exact | 11, **13** |
| `W/src/features/analyst-dashboard/**`, `features/home/*` (Failed row, Queue ageing, Reviews due) | component | read | 11-PATTERNS §Home; 20-PATTERNS Homes row | exact | 11, 13, **20** |
| `W/src/features/dashboard/requestor-dashboard.tsx`, My requests (`request-service.ts`) | component | read | 11-PATTERNS §`request-service.ts listMyRequests` | exact | 11, 17.1, 19.1 |
| `W/src/components/csrm/status-badge.tsx` (stage + run outcome values), `refusal-copy.ts` (family Z) | utility | transform | 11-PATTERNS §`status-badge.tsx`; 20-PATTERNS row | exact | 11, 14, 17.1, **19, 20** |
| `W/e2e/<phase-21 spec>.spec.ts`; `e2e/analyst-insights.spec.ts` (deliberate changes); `performance.spec.ts` | test | — | `W/e2e/analyst-insights.spec.ts` | exact | 11, 20 |
| `docs/design/csrm-design-direction.md` (X-68..X-73) | doc | — | prior X-n recording tasks | exact | every earlier phase (X-67 by 20) |
| Web Vitest beside each module | test | — | existing `features/reports/*.test.tsx` | exact | — |

## Pattern Assignments (only what earlier PATTERNS do not already map)

### Closed report key and parser — `report-definitions.ts` l.10-48, `report-query.ts` l.41-68
```ts
export const REPORT_KEYS = Object.freeze(["risk-exposure", "treatment-performance", "assessment-throughput", "control-effectiveness"] as const);
...
function parsePeriod(value: unknown): ThroughputPeriod {
  if (value === undefined) return THROUGHPUT_DEFAULT_PERIOD;
  const period = THROUGHPUT_PERIODS.find((candidate) => value === candidate || value === String(candidate));
  if (period === undefined) throw new ReportQueryError();
  return period;
}
export function parseReportRequest(reportKey: unknown, query: unknown): ReportRequest {
  if (!isReportKey(reportKey)) throw new ReportNotFoundError();
  ...
  if (keys.some((key) => key !== "period")) throw new ReportQueryError();
```
Apply: three new keys append to `REPORT_KEYS`/`REPORT_DEFINITIONS` (strings restate `report-copy.json`, mounted test asserts equality). `ReportRequest` union gains a member per key; `risk-trend` default period 12 (UI-D10) needs its own default, not `THROUGHPUT_DEFAULT_PERIOD`. A sibling `parseReportRecordsRequest(reportKey, query)` follows the same exact-key, single-valued style (RESEARCH R10 table); a key with no drill-down → `ReportNotFoundError`.

### Route + controller — `routes/reports.ts` l.11-35, `controllers/reports.ts` l.32-83
```ts
const insightPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystInsightScope: true } },
];
...
async get(ctx) {
  try {
    assertAnalystInsightScope(ctx.state);
    const reportKey = isRecord(ctx.params) ? ctx.params.reportKey : undefined;
    const request = parseReportRequest(reportKey, ctx.query);
    const today = utcToday(new Date());
    return { data: await computeReport(request, today) };
  } catch (error) { return handleError(ctx, error); }
}
```
Apply: add `GET /v1/reports/:reportKey/records` → `reports.records` with `insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.listReportRecords)`; `computeReport`'s exhaustive `switch` with `never` default gains the three keys; `handleError` maps new error classes (400/404). Clock read once; tests inject it (07 D-24).

### Aggregate + capped sample — `report-repository.ts` l.358-399
```ts
readRows(releasedAssessments(connection)
  .join("csrm_assessments_assessment_request_lnk as a_request", "a_request.csrm_assessment_id", "a.id")
  .join("csrm_assessment_requests as rq", "rq.id", "a_request.csrm_assessment_request_id")
  .where("a.approval_date", ">=", periodStart)   // bound JS Date, never ISO string
  .where("a.approval_date", "<", periodEnd)
  .whereNotNull("rq.submitted_date")
  .orderBy([{ column: "a.approval_date", order: "desc" }, { column: "a.id", order: "desc" }])
  .limit(THROUGHPUT_SAMPLE_CAP + 1)),
...
medianDaysToRelease: medianDays(sampleRows.map((row) => ({ from: normalizeDateTime(row.submitted_date), to: normalizeDateTime(row.approval_date) })), THROUGHPUT_SAMPLE_CAP),
```
Apply: episodes (R8), time to release with `MIN(entered_at)` left-join, trend Read 1 (R6) and failed-runs list (R9) all copy: `Date` bindings, `id` tie-breaker, `cap + 1` truncation, durations in code via `normalizeDateTime`. JSON (`changes`, `decisions`, `aiProvenance`) only via `strapi.db.query(...).findMany` (R6 Read 2). Replace `whereNotNull("rq.submitted_date")` with "has intake row or submitted date".

### Pure statistics — `report-math.ts` l.223-261 (`throughputMonths`, `medianDays`)
Shown above (sample slice → sort → middle; `Math.round(x*10)/10`; `{ value, sampleSize, truncated }`). Apply: extract `elapsedDaysSample(pairs, cap)` from `medianDays` body and have both `medianDays` and `nearestRank` (RESEARCH Code Examples) read it. Month instants via `throughputMonths(today, period)[m].end` for the as-at fold.

### Constants — `insight-constants.ts` l.27-36
One-line JSDoc + `Object.freeze([...] as const)` + typed default, e.g. `THROUGHPUT_PERIODS`/`THROUGHPUT_DEFAULT_PERIOD`. Add `AGEING_BAND_BOUNDS = [2, 5, 10]`, `WORKING_WEEKDAYS = [1..5]`, `STAGE_PERCENTILE_MIN_SAMPLE = 10`, `SLOWEST_ITEMS_LIMIT = 5`, `TREND_RISK_CAP`, `TREND_HISTORY_ROW_CAP`, `AI_HEALTH_RUN_CAP`, top-N 10.

### Queue facts and SQL predicates — `review-queue-repository.ts` l.72-112
```ts
function assessmentReleased(query: QueryBuilder): void {
  query.from("csrm_assessments_assessment_request_lnk as al")
    .join("csrm_assessments as a", "a.id", "al.csrm_assessment_id")
    .whereRaw("al.csrm_assessment_request_id = r.id")
    .where("a.assessment_status", "approved")
    .whereNotNull("a.approval_date")
    .whereExists((approver) => { ... })
```
Apply: `latestStageRows(connection)` (RESEARCH R7, correlated `NOT EXISTS` on sequence) as an exported helper used by the queue, dashboard ageing and Requestor projection; `leftJoin(latestStageRows(c).as("ls"), "ls.request_id", "r.id")`; band predicates bind `utcDateToInstant(cutoff)` Dates. Note `whereJsonPath` at l.104 is pre-existing; new code must not add JSON SQL.

### Recorder — no direct analog; compose from cited patterns
- In-trx guard + row lock: 19.1-PATTERNS §`notification-service.ts` and 13-PATTERNS l.107: `query.select(["id"]); query.where({ documentId }); query.forUpdate(); query.transacting(transaction);`
- Only-writer append discipline + static guard: 16-PATTERNS §`risk-history.ts`; 16-RESEARCH l.420 guard.
- Shape and steps: RESEARCH R3 (before/after, `at` from the act, `sequence + 1`). Never call `withRequestLock` inside it.

### Act sites (submit, questionnaire acts)
- Submit: `controllers/csrm-assessment-request.ts` l.162-185 (`prepareRequestorUpdate` then `documents.update` outside a lock) → wrap in `withRequestLock` (13-PATTERNS §`request-lock.ts`), re-read `persisted`, call recorder with `at = submittedDate`.
- Questionnaire acts: take request row lock first (Pitfall 2; 17-RESEARCH Pitfall 8), then existing questionnaire lock (`questionnaire-governance-workflow.ts` l.186).
- Round acts: insert recorder in the transaction bodies 17/17.1/17.2 plans create (cite their PATTERNS).

### Fixture — `seed-analyst-insights.ts` l.100-146
```ts
async function reconcile(documentService, filters, data) {
  const [existing] = await documentService.findMany({ filters, limit: 1 });
  return existing ? documentService.update({ documentId: existing.documentId, data }) : documentService.create({ data });
}
const today = utcToday(options.now?.() ?? new Date());
const day = (key: DayOffsetKey): string => addUtcDays(today, ANALYST_INSIGHTS_DAY_OFFSETS[key]);
```
Apply: stage rows reconciled by `(request number, sequence)` via `strapi.db.query(UID).update` of `enteredAt` (the one allow-listed exception, R5); same for Phase 16 history `occurredAt` (Orchestrator Confirmation); runs inside/outside the 7-day window.

### Web report frame — `report-detail.tsx` l.35-86, `report-schema.ts` l.168-188, `report-service.ts` l.100
`reportSchema = z.discriminatedUnion('key', [...])` + `reportResponseSchemas` map; `getReport<K>(key, options)`; `ReportDetailFrame` switches on `report.key` (l.71). Apply: add three schemas/branches; drill-down gets a parallel `reportRecordsSchema` discriminated on `kind` and `getReportRecords(key, query)`; page reuses `ReportBreadcrumb`/`ReportDetailLayout`. Zod stays in schema/service files; `metrics-format.ts` and chart/matrix props stay zod-free (R-08-34).

### Charts — `bar-chart.tsx` l.8-53, 219
`BarChartTone = 'ink' | 'risk-low' | 'risk-moderate' | 'risk-high' | 'risk-critical'`; `LabelledValuesBarChartProps | FigureWithTableBarChartProps` (`href` only on labelled form). Apply: `risk-trend-chart.tsx` composes one `figure-with-table` per rating with the rating tone, plus pointer-target `<a tabindex="-1">` (UI-D4); amendment 2 adds a labelled-rows form below 768px inside `BarChart` itself.

## Shared Patterns

- **Authorization:** `insightPolicies` (routes l.4-9) + `assertAnalystInsightScope` first in every handler; policy l.334-343 to compute required reads per operation and `params.reportKey` (run read for `ai-assistance`). Matrix rows per 19.1/20 tests rows.
- **Errors:** controller `safeError`/`handleError` (controllers/reports.ts l.15-26); family Z copy in `refusal-copy.ts`.
- **Portability (R-08-37):** bound `Date`s, `Number()` counts, `id` tie-breakers, JSON only through the Query Engine (RESEARCH R11).
- **Figure = list:** one service function returns `{ figure, rows }` (RESEARCH Pitfall 4).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `B/src/csrm/stage-history/stage-recorder.ts` | service | append-only before/after diff | No act-wrapping diff recorder exists; composed from 19.1/13/16 patterns + RESEARCH R3 |
| `B/src/csrm/insights/working-days.ts` | utility | transform | No working-day logic exists; use RESEARCH Code Examples |
| `W/src/components/csrm/risk-matrix.tsx` | component | transform | No counting matrix; 18's picker (X-57) is the nearest, plus UI-SPEC §2.2 |

## Metadata

**Analog search scope:** `B/src/api/csrm-analyst-insight/**`, `B/src/csrm/insights/**`, `B/src/api/csrm-assessment-request/**`, `B/src/bootstrap/seed-analyst-insights.ts`, `B/src/policies/csrm-authorization.ts`, `W/src/features/reports/**`, `W/src/components/csrm/{bar-chart,kpi-tile}.tsx`, `W/app/(app)/app/reports/**`; PATTERNS of 11, 12, 13, 16, 17, 17.1, 17.2, 18, 19, 19.1, 20.
**Files scanned:** ~35
**Pattern extraction date:** 2026-10-01
