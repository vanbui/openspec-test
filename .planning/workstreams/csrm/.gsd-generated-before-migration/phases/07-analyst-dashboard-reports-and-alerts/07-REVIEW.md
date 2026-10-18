---
phase: 07-analyst-dashboard-reports-and-alerts
reviewed: 2026-09-24T20:02:46Z
depth: standard
files_reviewed: 148
files_reviewed_list:
  - apps/strapi/src/api/csrm-analyst-insight/controllers/alerts.ts
  - apps/strapi/src/api/csrm-analyst-insight/controllers/dashboard.ts
  - apps/strapi/src/api/csrm-analyst-insight/controllers/reports.ts
  - apps/strapi/src/api/csrm-analyst-insight/operations.ts
  - apps/strapi/src/api/csrm-analyst-insight/routes/alerts.ts
  - apps/strapi/src/api/csrm-analyst-insight/routes/dashboard.ts
  - apps/strapi/src/api/csrm-analyst-insight/routes/reports.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/alert-query.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/alert-repository.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/dashboard-summary.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/insight-scope.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/recent-activity-repository.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/report-definitions.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/report-query.ts
  - apps/strapi/src/api/csrm-analyst-insight/services/report-repository.ts
  - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/strapi/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts
  - apps/strapi/src/api/csrm-assessment-request/operations.ts
  - apps/strapi/src/api/csrm-assessment-request/routes/my-request-status-summary.ts
  - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/strapi/src/api/csrm-assessment-request/services/request-status-summary.ts
  - apps/strapi/src/api/csrm-assessment-request/services/review-queue-repository.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/strapi/src/api/csrm-risk/services/risk-register-query.ts
  - apps/strapi/src/api/csrm-risk/services/risk-register.ts
  - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/src/bootstrap/seed-analyst-insights.ts
  - apps/strapi/src/bootstrap/seed-csrm-data.ts
  - apps/strapi/src/csrm/insights/alert-rules.ts
  - apps/strapi/src/csrm/insights/insight-constants.ts
  - apps/strapi/src/csrm/insights/recent-activity.ts
  - apps/strapi/src/csrm/insights/report-math.ts
  - apps/strapi/src/csrm/insights/treatment-due-state.ts
  - apps/strapi/src/csrm/insights/utc-date.ts
  - apps/strapi/src/index.ts
  - apps/strapi/src/policies/csrm-authorization.ts
  - apps/strapi/tests/analyst-alert-query.unit.test.ts
  - apps/strapi/tests/analyst-alerts.integration.test.ts
  - apps/strapi/tests/analyst-dashboard.integration.test.ts
  - apps/strapi/tests/analyst-insight-authorization.unit.test.ts
  - apps/strapi/tests/analyst-insight-catalogue-seed.integration.test.ts
  - apps/strapi/tests/analyst-insight-routes.unit.test.ts
  - apps/strapi/tests/analyst-insights-seed.integration.test.ts
  - apps/strapi/tests/analyst-insights.unit.test.ts
  - apps/strapi/tests/analyst-reports.integration.test.ts
  - apps/strapi/tests/contract-catalogue.integration.test.ts
  - apps/strapi/tests/helpers/strapi-http-harness.ts
  - apps/strapi/tests/questionnaire-generation.unit.test.ts
  - apps/strapi/tests/request-status-summary.integration.test.ts
  - apps/strapi/tests/review-queue-buckets.integration.test.ts
  - apps/strapi/tests/review-queue.unit.test.ts
  - apps/strapi/tests/risk-register-seed.integration.test.ts
  - apps/strapi/tests/risk-register.integration.test.ts
  - apps/strapi/tests/risk-register.unit.test.ts
  - apps/web/app/(app)/app/alerts/error.tsx
  - apps/web/app/(app)/app/alerts/loading.tsx
  - apps/web/app/(app)/app/alerts/page.tsx
  - apps/web/app/(app)/app/reports/(report-index)/error.tsx
  - apps/web/app/(app)/app/reports/(report-index)/loading.tsx
  - apps/web/app/(app)/app/reports/(report-index)/page.tsx
  - apps/web/app/(app)/app/reports/[reportKey]/error.tsx
  - apps/web/app/(app)/app/reports/[reportKey]/loading.tsx
  - apps/web/app/(app)/app/reports/[reportKey]/not-found.tsx
  - apps/web/app/(app)/app/reports/[reportKey]/page.tsx
  - apps/web/app/(app)/app/review/(analyst-dashboard)/error.tsx
  - apps/web/app/(app)/app/review/(analyst-dashboard)/loading.tsx
  - apps/web/app/(app)/app/review/(analyst-dashboard)/page.tsx
  - apps/web/app/globals.css
  - apps/web/e2e/accessibility.spec.ts
  - apps/web/e2e/analyst-insights.spec.ts
  - apps/web/e2e/design-contract.spec.ts
  - apps/web/e2e/design-system-conformance.spec.ts
  - apps/web/src/components/csrm/alert-urgency-badge.test.tsx
  - apps/web/src/components/csrm/alert-urgency-badge.tsx
  - apps/web/src/components/csrm/bar-chart.test.tsx
  - apps/web/src/components/csrm/bar-chart.tsx
  - apps/web/src/components/csrm/kpi-tile.test.tsx
  - apps/web/src/components/csrm/kpi-tile.tsx
  - apps/web/src/components/csrm/segmented-control.test.tsx
  - apps/web/src/components/csrm/segmented-control.tsx
  - apps/web/src/components/shell/capability-navigation.tsx
  - apps/web/src/components/shell/mobile-navigation.test.tsx
  - apps/web/src/components/shell/role-switcher.test.tsx
  - apps/web/src/components/shell/role-switcher.tsx
  - apps/web/src/components/states/retryable-error-state.tsx
  - apps/web/src/components/states/states.test.tsx
  - apps/web/src/components/states/states.tsx
  - apps/web/src/config/navigation/navigation.ts
  - apps/web/src/features/alerts/alert-list.test.tsx
  - apps/web/src/features/alerts/alert-list.tsx
  - apps/web/src/features/alerts/alert-presentation.test.ts
  - apps/web/src/features/alerts/alert-presentation.ts
  - apps/web/src/features/alerts/alert-row.tsx
  - apps/web/src/features/alerts/alert-schema.test.ts
  - apps/web/src/features/alerts/alert-schema.ts
  - apps/web/src/features/alerts/alert-service.test.ts
  - apps/web/src/features/alerts/alert-service.ts
  - apps/web/src/features/alerts/alerts-page-header.tsx
  - apps/web/src/features/alerts/alerts-page.test.tsx
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-page-header.tsx
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-schema.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx
  - apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx
  - apps/web/src/features/contract-response-parity.test.ts
  - apps/web/src/features/dashboard/requestor-dashboard-service.ts
  - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
  - apps/web/src/features/reports/assessment-throughput-report.tsx
  - apps/web/src/features/reports/control-effectiveness-report.tsx
  - apps/web/src/features/reports/report-copy.json
  - apps/web/src/features/reports/report-copy.ts
  - apps/web/src/features/reports/report-detail.tsx
  - apps/web/src/features/reports/report-index.tsx
  - apps/web/src/features/reports/report-period-control.tsx
  - apps/web/src/features/reports/report-presentation.test.ts
  - apps/web/src/features/reports/report-presentation.ts
  - apps/web/src/features/reports/report-schema.test.ts
  - apps/web/src/features/reports/report-schema.ts
  - apps/web/src/features/reports/report-section.tsx
  - apps/web/src/features/reports/report-service.test.ts
  - apps/web/src/features/reports/report-service.ts
  - apps/web/src/features/reports/report-table.tsx
  - apps/web/src/features/reports/report-views.test.tsx
  - apps/web/src/features/reports/reports-page-header.tsx
  - apps/web/src/features/reports/reports-pages.test.tsx
  - apps/web/src/features/reports/risk-exposure-report.tsx
  - apps/web/src/features/reports/treatment-performance-report.tsx
  - apps/web/src/features/requests/request-schema.ts
  - apps/web/src/features/requests/request-service.test.ts
  - apps/web/src/features/requests/request-service.ts
  - apps/web/src/features/risks/risk-details.test.tsx
  - apps/web/src/features/risks/risk-details.tsx
  - apps/web/src/features/risks/risk-register-filters.tsx
  - apps/web/src/features/risks/risk-register.test.tsx
  - apps/web/src/features/risks/risk-register.tsx
  - apps/web/src/features/risks/risk-schema.test.ts
  - apps/web/src/features/risks/risk-schema.ts
  - apps/web/src/features/risks/risk-service.test.ts
  - apps/web/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
  - apps/web/src/lib/testing/e2e-ui-state.test.ts
  - apps/web/src/lib/testing/e2e-ui-state.ts
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/specification.json
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-24T20:02:46Z
**Depth:** standard
**Files Reviewed:** 148
**Status:** issues_found

## Summary

**Scope.** The review covers `git diff eb28084..HEAD` at HEAD `755114b`, excluding `.planning/` and docs prose.
- HEAD includes the two 07-09 browser-test commits (`c6f5249`, `755114b`) that landed while the review was running.
- The generated `apps/web/src/lib/api/generated/schema.d.ts` is excluded as generated output; contract drift belongs to the `api:check` gate.
- Product code, Strapi policy and bootstrap code, and both contract files were read in full.
- Test files were reviewed for reliability only, as the role requires. The checks were focus and skip markers, clock handling, polling loops, and whether assertions depend on global totals.
- No test suite was run.
- Driver behaviour was confirmed by reading `node_modules`, with no probe:
  - knex's better-sqlite3 binding turns a JS `Date` into epoch milliseconds;
  - Strapi's PostgreSQL dialect returns `DATE` columns as text;
  - Strapi's `DatetimeField.toDB` stores a `Date`.

**Result: no BLOCKER.**
- **Authorization:** only a holder of the role named exactly `Security Analyst` can reach an insight figure. That role must also hold all four underlying list reads, and each controller asserts the policy's scope before it reads a key, a query or a row.
- **Scope:** every insight reuses the Risk Register's `applyDisclosableParent`, the reviewable request statuses or the complete release triple. No insight widens scope to partial-release parents, drafts, or another Requestor's records.
- **Requestor summary:** strictly owner-scoped.
- **SQL:** injection-free and NULL-correct. It binds datetime values as JS `Date`, respects UTC day and month boundaries, and caps every list honestly.
- **Contract:** every served shape matches its component in the specification field for field, and the parity guard registers every new parser.

**Findings.**
- **WR-01 (one warning):** the "Questionnaires · Ready for review" figure counts finished work as waiting.
- **IN-01 to IN-03 (three info):** a mis-ordered register link, missing explicit list roles, and parser narrowings that contradict their own comments.

## Warnings

### WR-01: "Ready for review" counts questionnaires whose work has already moved on, so the figure never drains

**File:** `apps/strapi/src/api/csrm-analyst-insight/services/dashboard-summary.ts:231-233`; `apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts:161,270`

**Issue:** `questionnairesReadyForReview` counts every row of `csrm_questionnaires` that holds at least one submitted answer.

Answers stay `submitted` after the analyst drafts the Risk Assessment, after its review and after release. The figure therefore also includes questionnaires whose request is at `assessment-drafted` or `assessment-reviewed`, or is `approved` or `closed`. The widget labels the row "Ready for review" and states its predicate as "Work waiting in each analyst review list."

The mounted fixture pins the failure:
- `apps/strapi/tests/analyst-dashboard.integration.test.ts:165-169` gives Q3, Q4 and Q5 an existing Risk Assessment each (one draft, two in review).
- Line 398 pins `questionnairesReadyForReview: 3` for exactly those three.

So one Review queue widget reports the same three requests under three rows at once: "Requires my attention", "Ready for review", and "Draft" or "In review". On a live system every released request adds one to "Ready for review" permanently, which defeats the dashboard's "what needs me now?" purpose.

The figure still equals the list it links to (`/app/review/questionnaires?status=submitted`), and the row follows UI-SPEC widget 1 as written. This is a meaning defect, not a parity defect.

**Fix:** This needs a UI-SPEC decision. There are two options.

**(a) Narrow both sides to the questionnaire-submitted lifecycle step.** Count only submitted questionnaires whose request is still reviewable and has no Risk Assessment yet:

```ts
// dashboard-summary.ts
readRow(whereQuestionnaireHasSubmittedAnswer(connection.queryBuilder().from("csrm_questionnaires as q"), "q.id")
  .whereExists((request) => {
    request.from("csrm_questionnaires_assessment_request_lnk as q_request")
      .join("csrm_assessment_requests as rq", "rq.id", "q_request.csrm_assessment_request_id")
      .whereRaw("q_request.csrm_questionnaire_id = q.id")
      .whereIn("rq.request_status", [...REVIEWABLE_REQUEST_STATUSES])
      .whereNotExists((assessment) => {
        assessment.from("csrm_assessments_assessment_request_lnk as a_request")
          .whereRaw("a_request.csrm_assessment_request_id = rq.id")
          .select("a_request.id");
      })
      .select("q_request.id");
  })
  .countDistinct({ total: "q.id" })),
```

Then give the questionnaire review list an equal closed filter through the contract path: a spec enum value, a server predicate in `questionnaire-scope.ts`, the parser and the URL. Point the row at that filter, and update the pinned expectation at `analyst-dashboard.integration.test.ts:398`.

**(b) Keep the predicate but correct the words.** Relabel the row "Submitted" and change the widget description so it no longer claims the count is waiting work.

## Info

### IN-01: The High and Critical widget's register link lists unrated Risks first

**File:** `apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts:182-183` (with `apps/strapi/src/api/csrm-risk/services/risk-register.ts:393`)

**Issue:** The footer link is `/app/risks?state=open&sort=residualRating:desc`, and its comment promises "every open Risk, High and Critical first." The register's rating sort maps a missing or off-ladder rating to 5 (`... WHEN 'Critical' THEN 4 ELSE 5 END`). Descending order therefore puts every unrated open Risk above the Critical ones. When unrated Risks exist, the analyst leaves a High/Critical widget and lands on a page of unrated Risks.

**Fix:** Either correct the comment, or give the register's rating sort a leading term that keeps unrated Risks last in both directions, as the target-date sort already does. For example: `CASE WHEN r.residual_rating IN ('Low','Moderate','High','Critical') THEN 0 ELSE 1 END ASC`, placed before the existing CASE. That second option changes the Phase 5 register order, so pin it with a register test.

### IN-02: The new lists lose list semantics in Safari with VoiceOver

**File:** `apps/web/src/components/csrm/kpi-tile.tsx:109`; `apps/web/src/components/csrm/bar-chart.tsx:139-143`; `apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx:170,241,249,278`; `apps/web/src/features/reports/treatment-performance-report.tsx:34`

**Issue:** `KpiTileStrip` documents that it is a list "so assistive technology announces how many there are." Tailwind's preflight sets `list-style: none` on every `ul`, and WebKit then drops list semantics unless `role="list"` is present.

`report-index.tsx:48-59` already adds the role for exactly this reason; these lists do not. As a result:
- VoiceOver on Safari announces neither the tile count nor the row count;
- the `aria-label` in `bar-chart.tsx` ends up naming a generic element.

axe does not detect this, so the UI audit's zero-violation result does not cover it.

**Fix:** Add `role="list"` to these `ul` elements, matching `ReportIndex`.

### IN-03: New parsers narrow the contract while their headers say they do not

**File:** `apps/web/src/features/reports/report-schema.ts:17-19,93`; `apps/web/src/features/analyst-dashboard/analyst-dashboard-schema.ts:17-19,55,68,84`; `apps/web/src/features/alerts/alert-schema.ts:58,65,76`

**Issue:** Both schema headers state that no schema "narrows the contract with a minimum length." Yet several parsers add `trim()`, `min(1)` and `max(255)` or `max(512)` bounds that `docs/references/specification.json` does not declare:
- `documentIdSchema`;
- `riskNumber`;
- the activity `identifier`;
- the alert `identifier` and `id`.

None of these is registered in `narrowedPaths`. The parity guard synthesises short non-empty strings, so it cannot see these narrowings.

The practical risk is low, because these values are generated, short and non-empty. Still, one whitespace-only identifier would fail the whole closed parse: the entire dashboard summary, or the entire alert page. The headers overstate the guarantee.

**Fix:** Declare the bounds in the contract and regenerate the client, or drop them from the parsers. Then correct the header comments.

## Verified sound

- **Human-analyst-only insights.**
  - All five operations are in `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:34-42`).
  - `requireAnalystInsightScope` (`:326-336`) requires the role named exactly `Security Analyst` to hold both the insight operation and the four underlying reads (the Risk Register, the review queue, the questionnaire review list and the assessment list).
  - Each controller calls `assertAnalystInsightScope` before it parses a key or query. A caller without the scope therefore gets 403 for every report key and cannot probe which keys exist.
  - A script over the catalogue confirmed the five grants go to `role.security_analyst` only, never to the agent or the Requestor, and that the docs and bootstrap catalogue copies are byte-identical.
- **Scope.**
  - Risk and Control Implementation alerts, reports and dashboard figures all reuse `applyDisclosableParent` and add `closure_date IS NULL`. Partial-release and `closed` parents therefore stay excluded, exactly as in the Risk Register.
  - Request alerts read only the four reviewable statuses; throughput reads only the complete release triple.
  - Recent-activity request events are restricted to review-scope statuses. Questionnaire and assessment events fall within the analyst's "all" review lists.
  - Drafts never appear.
- **Requestor status summary.** It joins `csrm_assessment_requests_requestor_lnk` on the numeric id the policy resolved (`request-status-summary.ts:68-80`), refuses any query key, and is owner-scoped for every actor, including analysts.
- **SQL safety.**
  - Every column, alias and `ORDER BY` fragment comes from a module constant or a closed map; every value is bound, and `LIKE` terms are escaped.
  - NULL treatment status is handled as `(IS NULL OR <> ?)` in every branch; there is no bare `<>`.
  - Datetime columns (`approval_date`) are bound as JS `Date`. That is consistent with how knex serialises dates for SQLite and PostgreSQL, where an ISO string would be wrong for a `timestamp without time zone` column.
  - Date columns compare as `YYYY-MM-DD` strings in both dialects.
- **UTC boundaries.**
  - Each handler reads the clock once.
  - `addUtcDays` and `addUtcMonths` handle month ends and leap years; throughput months are half-open `[start, next month start)` intervals at UTC midnight.
  - The due-soon window is inclusive at both ends, identically in the SQL and in `deriveTreatmentDueState`.
  - The report's four due-state `CASE` terms partition every row, so the parts-equal-total check cannot fire.
- **Counting and caps.**
  - `countDistinct` is used wherever a join could fan out.
  - Each alert branch yields one row per (kind, source), so `COUNT(*)` and paging are exact and the list order is total.
  - Every `truncated` flag is honest: it comes from a limit+1 read or an exact count, and recent activity reads `limit + 1` rows from each source.
- **Review-queue buckets.** A case-by-case derivation shows the SQL predicates equal `selectReviewQueueBucket` over the reviewable statuses. The only divergence is the recorded malformed-definition case (D-30). Count and page share one generation snapshot.
- **Contract.**
  - Every served DTO matches its component field for field: alerts, the alert summary, the four report branches, the dashboard summary, the Requestor summary, and the register's `treatmentDueState` and `state` filter.
  - The parity guard registers every new parser, including the per-branch report parsers via `branch`, and exercises the minimal, maximal and nullable instances.
- **Web.**
  - Every service is `server-only`, with no raw fetch.
  - No metric or date is derived in the client; `isRiskOverdue` is retired.
  - The capability check precedes every analyst read, and precedes the key read in `generateMetadata`. `params` and `searchParams` are awaited.
  - The `error.tsx` boundaries use the Next 16.3 `retry` prop.
  - E2E fixtures resolve only after a successful, authorised read.
  - Partial failure follows UI-SPEC §6.2.
- **Seed.**
  - `seedAnalystInsights` is gated on `IDAMBOX_SEED_CSRM` plus `NODE_ENV`, `CSRM_ENVIRONMENT` and `CSRM_DEV_IDENTITY`. It reconciles by stable key, serialises concurrent runs and never activates in production.
  - The `seed-csrm-data.ts` `$null` match stops API-only Functions from being re-created. Stale duplicates in older databases stay unlinked, because role Functions are replaced wholesale.

## Resolution

Worked on 2026-09-25 under the orchestrator's binding disposition for each finding. WR-01, IN-01 and IN-02 are fixed. Each has a RED test commit followed by a fix commit. IN-03 is deferred with no code change.

| Finding | Status | Commits |
|---|---|---|
| WR-01 | Fixed by relabelling (option b); contract unchanged | `182ff36` test, `5e8a396` fix |
| IN-01 | Fixed | `2c0f979` test, `155918e` fix |
| IN-02 | Fixed | `0248a85` test, `607b41b` fix |
| IN-03 | Deferred to Phase 8 contract parity (INT-01) | none |

### WR-01: fixed by relabelling

**Why the row was relabelled, not narrowed.**
- "Requires my attention" already counts the actionable request-level work, as a row and as a KPI tile.
- The Questionnaires row is therefore a navigational count of the submitted list, not an action count.
- Option (a) would need a new closed filter through the contract path. Keeping the predicate keeps the row equal to the list it opens (D-18, D-24) with no contract change.

**What changed.**
- The row reads `Submitted`, the questionnaire review list's own Status filter option.
  - Its accessible name is `Submitted: {n} {Questionnaire|Questionnaires}`, and its key is `submitted`.
  - Its count and its link, `/app/review/questionnaires?status=submitted`, are unchanged.
- The widget description `Work waiting in each analyst review list.` is now `Assessment Requests by queue, and Questionnaires and Risk Assessments by status.`, because not every row is waiting work.
- `07-UI-SPEC.md` §2.5 widget 1 and §7.2 carry the new copy, and the decision is recorded as UI-D21.
- The comments in `dashboard-summary.ts` describe the figure as a count of the submitted list.

**Tests.**
- Unit tests pin the label, the accessible name, the count and the link. They also check that no queue copy says "ready for review" or calls the figure waiting work.
- The dashboard browser journey in `analyst-insights.spec.ts` now opens the Submitted row. It asserts that the row equals the total of the submitted Questionnaire list, and that no queue copy calls the figure waiting work.

**Left unchanged by disposition.**
- The contract field is still named `questionnairesReadyForReview`.
- The `DashboardReviewQueue` description in `specification.json` still opens with "Work waiting in each analyst review list". The field's own sentence already states the true predicate.
- Rewording that description is a contract change. If it is wanted, it belongs to Phase 8 (INT-01).

### IN-01: fixed

**Where.** The rank is computed in `orderedQuery` in `risk-register.ts`; `risk-register-query.ts` only parses the query.

**What changed.**
- Each rating sort now leads with `CASE WHEN {column} IN ('Low', 'Moderate', 'High', 'Critical') THEN 0 ELSE 1 END ASC`.
- A Risk with no rating, or with a rating off the ladder, now follows every rated Risk in both directions, as an undated Risk does in the target-date sort.
- The inherent-rating sort shares the rule.
- `residualRating:desc` now leads with Critical. The dashboard's "Open Risk Register" link therefore lists High and Critical first, as its comment says.

**Tests.**
- A new mounted test places six Risks on a fresh parent.
  - Each rating column holds one Risk with no rating and one with an off-ladder rating.
  - The two columns rank the rated Risks differently, so each sort must read its own column.
  - It pins the exact order for `residualRating` and `inherentRating` in both directions.
  - It failed RED on `residualRating:desc`, which listed the two unrated Risks first.
- The Phase 5 ordering test was changed deliberately.
  - Its rank model gave an unrated Risk 5, which encoded unrated-first for descending sorts. Its fixture holds no unrated Risk, so that branch never ran.
  - The model now places unrated Risks after rated ones in both directions.
  - The check now covers `residualRating` as well as `inherentRating`.
  - Every earlier assertion still runs, so nothing was weakened.

### IN-02: fixed

**What changed.** `role="list"` was added, following `report-index.tsx`, to:
- `KpiTileStrip`: the dashboard's Needs action strip and every report's Summary strip;
- the `BarChart` bar-row list, which is the `labelled-values` presentation (inside a `figure-with-table` figure it stays hidden);
- the dashboard's three Review queue group lists, the High and Critical list, the three alert widget lists and the Recent activity list;
- the treatment-performance report's Most overdue treatments list, which the finding also names.

**Tests.** Unit assertions check that each list states the role and exposes the right item count. The dashboard test also asserts that no `ul` on the dashboard lacks the role.

**Left alone.**
- The `BarChart` column list renders only inside the `aria-hidden` figure, so it has no role to keep.
- Lists that predate Phase 7, such as the Requestor dashboard's, have the same WebKit behaviour. They are outside this review's scope.

### IN-03: deferred, no code change

This is deferred to Phase 8's contract-parity work (INT-01).
- The web parsers bound identifiers with `trim()`, `min(1)`, `max(255)` and `max(512)`. That follows the existing convention, but the specification does not declare the bounds.
- The parity guard generates only short, non-empty strings, so it cannot see the narrowing.
- Phase 8 should either declare the bounds in `specification.json` and regenerate the client, or drop them from the parsers. Either way, it should then correct the schema header comments.

### Verification

Run on 2026-09-25 at `607b41b`, with the dev servers stopped.

| Check | Result |
|---|---|
| Strapi typecheck and full suite (`pnpm --filter @csrm/strapi test`) | both `tsc` steps clean; 350 tests, 350 passed, 0 failed |
| Web unit suite (`pnpm --filter @csrm/web test`) | 69 files, 834 tests, all passed |
| Web typecheck (`pnpm --filter @csrm/web typecheck`) | clean |
| Contract drift (`pnpm --prefix apps/web api:check`) | clean |
| Playwright: `analyst-insights.spec.ts` and the Phase 7 test of `accessibility.spec.ts` | 10 tests, 10 passed; axe reports no violation with the new list roles and copy |

Each RED step failed for the expected reason before its fix:
- WR-01: four unit tests expected the new copy.
- IN-01: the mounted test failed on `residualRating:desc`.
- IN-02: four unit tests expected `role="list"`.

---

_Reviewed: 2026-09-24T20:02:46Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
