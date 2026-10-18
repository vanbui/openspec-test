---
phase: 07-analyst-dashboard-reports-and-alerts
verified: 2026-09-24T20:40:00Z
verified_commit: be64f63
status: passed
score: "3/3 roadmap success criteria, 2/2 requirements, 37/37 locked decisions (D-32 superseded by D-36), 50/50 plan must-have truths"
overrides_applied: 0
advisory:
  - finding: "WR-01: at be64f63 the Review queue widget labelled every questionnaire with a submitted answer 'Ready for review' and described the widget as 'Work waiting in each analyst review list', although answers stay submitted after the Risk Assessment is drafted, reviewed and released."
    category: other
    reason: "A meaning defect, not a parity or scope defect: the figure equals the list it opens (/app/review/questionnaires?status=submitted). Fixed after the verified commit in 182ff36 and 5e8a396, which relabel the row 'Submitted' and keep the predicate, the link and the contract field."
    evidence_status: "fixed after be64f63; the orchestrator re-runs the full gate"
  - finding: "IN-01: the Risk Register rating sort put unrated Risks first in a descending sort, so the High and Critical widget's 'Open Risk Register' footer landed on unrated Risks."
    category: other
    reason: "Navigation ordering only. Fixed after the verified commit in 2c0f979 and 155918e (unrated last in both directions, constant SQL fragment). Gap record item 10's wording ('High and Critical first') holds once that fix is in."
    evidence_status: "fixed after be64f63; the orchestrator re-runs the full gate"
  - finding: "IN-02: the new tile, bar and row lists lacked an explicit list role, so VoiceOver on Safari drops their list semantics and counts. axe does not report this."
    category: other
    reason: "Fixed after the verified commit in 0248a85 and 607b41b (markup only)."
    evidence_status: "fixed after be64f63; the orchestrator re-runs the full gate"
  - finding: "IN-03: report-schema.ts, analyst-dashboard-schema.ts and alert-schema.ts add trim, min(1) and max(255/512) bounds the contract does not declare, while their headers say no schema narrows the contract. None is in narrowedPaths, and the parity guard cannot see them."
    category: other
    reason: "Deferred with no code change to Phase 8 contract parity (INT-01) by the orchestrator's disposition, recorded in 07-REVIEW.md by 07e5a8e. Low risk: the values are server-generated and non-empty. A whitespace-only identifier would fail the whole closed parse, so the dashboard or the alert page would show its error state (fail closed)."
    evidence_status: "deferred to Phase 8 (INT-01), info"
  - finding: "Planning-state drift: ROADMAP.md still shows 07-08 and 07-09 unchecked with 'Plans: 7/9 plans complete'; 07-VALIDATION.md is status draft with every per-task row pending; REQUIREMENTS.md lists DASH-01 and DASH-02 as Pending."
    category: other
    reason: "Tracking only; the orchestrator owns these files."
    evidence_status: "confirmed by direct reading"
  - finding: "The MVP goal fails gsd-sdk user-story.validate only because it reads 'I want a' rather than 'I want to'."
    category: other
    reason: "The role says to refuse MVP verification on an invalid story. The session cannot ask, so verification proceeded against the unambiguous outcome clause and the decision is recorded here. Rewording the goal is optional."
    evidence_status: "confirmed by running user-story.validate"
---

# Phase 7: Analyst Dashboard, Reports, and Alerts Verification Report

**Phase Goal:** As a Security Analyst, I want a data-driven dashboard, reports, and alerts covering my review queues, high and critical risks, and overdue treatments, so that I can prioritise analyst work from live workload signals.
**Verified:** 2026-09-24T20:40Z (2026-09-25 AEST)
**Verified commit:** `be64f63`, which is the 07-09 gate commit `d3c6150` plus the code review and UI review documents
**Status:** passed
**Re-verification:** No, initial verification

## Method

- **Goal-backward, anchored to one commit.** Every citation is `path:line` at `be64f63`, read with `git show be64f63:<path>` where a file changed afterwards. SUMMARY claims were checked against the code, not accepted.
- **Must-haves.** The sources are:
  - the three roadmap success criteria, taken from the roadmap section text, because `roadmap.get-phase 7` returned an empty `success_criteria` array;
  - DASH-01 and DASH-02;
  - decisions D-01 to D-37;
  - the 50 plan frontmatter truths.
- **Read-only, as instructed.** No test suite, `api:check`, build or dev server was run. The gate figures are the ones plan 07-09 recorded on `d3c6150`. The browser figures are the orchestrator's, from `07-UI-REVIEW.md`.
- **Independent checks run in this session.** All were read-only:
  - a script over the catalogue JSON that traces every Phase 7 FunctionAPI to its Function and roles;
  - `cmp` of the two catalogue copies;
  - a walk of every response component the six operations reach;
  - the content-type diff since `eb28084`;
  - grep sweeps for debt markers, hard-coded colours, raw `fetch`, secrets, Keycloak and attribution;
  - `gsd-sdk query verify.artifacts` and `verify.key-links` on all nine plans;
  - reads of Strapi's error formatter and Next 16.3's caching guide.
- **MVP mode.** The roadmap marks the phase `mode: mvp`. The goal fails the strict user-story format only on wording (see `advisory`), so the User Flow Coverage below follows the outcome clause.
- **Concurrent fixes.** Seven commits landed after `be64f63` while this verification ran: six test and fix commits, and `07e5a8e`, which records the resolution in `07-REVIEW.md`. They are listed and read for regressions below. The orchestrator re-runs the full gate after them.

## User Flow Coverage (MVP)

User story: «As a Security Analyst, I want a data-driven dashboard, reports, and alerts covering my review queues, high and critical risks, and overdue treatments, so that I can prioritise analyst work from live workload signals.»

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| 1. Sign in as the Security Analyst | The shell shows the analyst role, "Analyst dashboard" and the Reports group | `navigation.ts:61,66,67` gate each item on `assessment:review`. The E2E `signIn` asserts the Dashboard heading and the role, never the URL (`analyst-insights.spec.ts:85-96`). | ✓ |
| 2. Open the analyst dashboard | Four "Needs action" tiles, then seven widgets | `(analyst-dashboard)/page.tsx:26-49`; E2E `analyst-insights.spec.ts:387`, `:515`; UI review: all eight sections at four widths | ✓ |
| 3. Read the review queues | Queue counts, each equal to the list it opens | `dashboard-summary.ts:228-238` uses the queue pages' own counter (`review-queue-repository.ts:257-263`). Mounted `analyst-dashboard.integration.test.ts:388`; browser "Requires my attention" 9 = 9. | ✓ |
| 4. Read High and Critical Risks | Open residual exposure and the High and Critical widget | `dashboard-summary.ts:143-149, 203-212, 239-245`; mounted `:430`, `:448`, `:737` | ✓ |
| 5. Read overdue treatments and due dates | Overdue and "Due within 14 days" tiles, Treatments due, Upcoming due dates | `dashboard-summary.ts:246-248`; `analyst-dashboard-service.ts:140-146`; mounted `:465`; browser Overdue 6 = 6, Due within 14 days 2 = 2 | ✓ |
| 6. Open an alert and its source record | Top alerts, then Alerts, a filtered row and the analyst Risk route | E2E journey `analyst-insights.spec.ts:515-599`; `alert-presentation.ts:105-117` | ✓ |
| 7. Open each report | The index lists four reports; each shows its as-at line, tiles, and a table per chart | E2E journey per-report walk; UI review: 20 report page loads, every chart with its table | ✓ |
| 8. Read recent activity | The newest workflow events; generated drafts attributed to no one | `recent-activity-repository.ts:80-159`; mounted `:635`; `analyst-dashboard-presentation.ts:390-409` | ✓ |
| **Outcome:** "prioritise analyst work from live workload signals" | Strapi computes every figure on read for the request's UTC today. Action counts come first, alerts list most urgent first, and every tile equals its list. | Each controller reads the clock once (`controllers/alerts.ts:34`, `dashboard.ts:38`, `reports.ts:76`). Alert order: `alert-repository.ts:119-126`. Tile equality holds in the mounted tests, in the E2E journey and in the orchestrator's browser measurements. | ✓ |

## Goal Achievement

### Roadmap success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Analysts see data-driven review queues, high/critical risks, overdue treatments, due dates, recent activity, and alerts. | ✓ VERIFIED | **Queues:** the queue pages and the dashboard share one database counter (`review-queue-repository.ts:217-232, 257-263`; `dashboard-summary.ts:228-230`). The 1,000-row scan is gone (`csrm-assessment-request.ts:59-86`), and the queues are exact beyond 1,000 requests (`review-queue-buckets.integration.test.ts:383`). **High/Critical:** open contextual Risks only (`dashboard-summary.ts:143-149`); each rating equals the `?state=open` register total (`analyst-dashboard.integration.test.ts:430`). **Overdue treatments:** the D-04 rule in SQL (`alert-repository.ts:299-314`) and in TypeScript (`treatment-due-state.ts:54-69`); mounted `:465`. **Due dates:** request, treatment, Control Implementation and review kinds (`alert-rules.ts:17-26`; `alert-repository.ts:315-369`). **Recent activity:** `recent-activity-repository.ts:80-201`; mounted `:635`. **Alerts:** `alert-repository.ts:298-413`; the literal 14-alert list (`analyst-alerts.integration.test.ts:440`). |
| 2 | Reports and alerts are accessible through capability-controlled, responsive screens with useful empty and error states. | ✓ VERIFIED | **Capability-controlled:** navigation is gated on `assessment:review` (`navigation.ts:61,66,67`). Each page checks the capability before any read (`alerts/page.tsx:25`; `(report-index)/page.tsx:25`; `[reportKey]/page.tsx:42,67`; `(analyst-dashboard)/page.tsx:30`). Strapi re-authorises every read, and its 403 renders the same permission state (`alerts/page.tsx:36`; `[reportKey]/page.tsx:53`). **Responsive:** `analyst-insights.spec.ts:342` covers 375 to 1440; axe is clean at 375 and 1440 (`accessibility.spec.ts:184`); the UI review found zero overflow at four widths. **Empty and error states:** every route has its own `loading.tsx` and `error.tsx`; the five-state matrix is `design-system-conformance.spec.ts:242`; independent widget failure is `:195` and `analyst-insights.spec.ts:490`. |
| 3 | Dashboard widgets reuse established metrics, status, layout, and service patterns rather than hard-coded values. | ✓ VERIFIED | **Metrics:** the queue counter, the alert branches (`dashboard-summary.ts:246-248`; `report-repository.ts:337-338`), the Risk Register's `applyDisclosableParent` (`risk-register.ts:137-164`) and the one D-04 rule (`risk-register.ts:277`; `dashboard-summary.ts:176`). **Status and layout:** the shared state primitives, `DataTable`, `RecordLink`, `RiskRatingBadge` and `PageHeader`; the new `KpiTile` and `BarChart` sit in `components/csrm`, with tests, and are used by the dashboard and the reports. **Service pattern:** `server-only` typed openapi-fetch services with closed Zod parsers registered in the parity guard (`contract-response-parity.test.ts:216,217,223`), and no raw `fetch`. **No hard-coded values:** zero hex, rgb or hsl literals in the 148 phase files; no fabricated delta (`kpi-tile.tsx:73`). |

**Score:** 3/3 roadmap criteria verified.

### Requirements coverage

| Requirement | Source plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DASH-01 | 01, 02, 03, 04, 08, 09 | A Security Analyst dashboard presents data-driven review queues, high/critical risks, overdue treatments, due dates, recent activity, and alerts. | ✓ SATISFIED | Criterion 1 above; `/app/review` route; mounted `analyst-dashboard.integration.test.ts`; E2E `analyst-insights.spec.ts:387,515`; UI review tile-to-list equality |
| DASH-02 | 01, 04, 05, 06, 07, 09 | A Security Analyst can view reports and alerts through authorised, responsive screens. | ✓ SATISFIED | Criterion 2 above; `/app/alerts`, `/app/reports` and `/app/reports/[reportKey]`; mounted alert and report suites; E2E denial matrix `analyst-insights.spec.ts:601` |

REQUIREMENTS.md maps only DASH-01 and DASH-02 to Phase 7 (line 107). Both are claimed, so no requirement is orphaned.

### Every figure is derived by Strapi and authorised by Strapi

| Surface element | Derived by Strapi in | Authorised by | What the web does |
|-----------------|----------------------|---------------|-------------------|
| KPI "Requires my attention" | `countReviewQueueBucket` (`dashboard-summary.ts:228`; `review-queue-repository.ts:257-263`) | route policy `requireAnalystInsightScope` (`routes/dashboard.ts:10-13`) plus `assertAnalystInsightScope` (`controllers/dashboard.ts:36`) | renders the value (`analyst-dashboard-service.ts:121-130`) |
| KPI Overdue, Due soon, Needs attention | `countByKindAndUrgency` (`alert-repository.ts:519-529`) | `routes/alerts.ts:10-25`; `controllers/alerts.ts:60` | renders `byUrgency` |
| Review queue widget | the three bucket counts, submitted questionnaires, and assessments by status (`dashboard-summary.ts:228-238`) | dashboard policy and assertion | renders the rows |
| Risk exposure widget | open contextual Risks by residual rating (`dashboard-summary.ts:239-242`) | as above | renders the rows |
| High and Critical widget | at most 5 rows, a total and a truncated flag (`dashboard-summary.ts:203-212, 244-245, 263-267`) | as above | renders the rows |
| Treatments due, Upcoming due dates, Top alerts | alert counts and bounded alert pages (`dashboard-summary.ts:246-248`; `alert-repository.ts:504-518`) | alert policy and assertion | renders the rows |
| Recent activity | up to 8 events and a truncated flag (`recent-activity-repository.ts:80-201`; `recent-activity.ts:87-94`) | dashboard policy and assertion | renders words only (`analyst-dashboard-presentation.ts:390-409`) |
| Alerts list and summary | one `UNION ALL` over eight branches (`alert-repository.ts:298-413`) | `controllers/alerts.ts:32,60` | renders |
| Reports index | the closed definitions (`report-definitions.ts:10-41`) | `controllers/reports.ts:63` | renders cards |
| Each report | knex aggregates (`report-repository.ts:251-398`) | `controllers/reports.ts:73-77` | renders charts with their tables |
| Requestor lifecycle cards on `/app` | owner group-by (`request-status-summary.ts:68-80`) | owner scope (`csrm-authorization.ts:381-384`; `routes/my-request-status-summary.ts:23`) | renders |
| Risk Register overdue marker | `deriveTreatmentDueState` per row (`risk-register.ts:277`) | existing Risk Register policy | renders `treatmentDueState` (`risk-register.tsx:130`) |

The web derives no figure:
- `isRiskOverdue` is gone (no match in `apps/web/src`).
- The presentation modules compute only a chart scale maximum (`report-presentation.ts:174`), copy from the server's day offsets, and date formatting.

### Locked decisions (D-01 to D-37)

| Group | Decision | Status | Evidence |
|-------|----------|--------|----------|
| Derivation | D-01 computed on read; no schema change; gaps recorded | ✓ | `git diff --name-only eb28084 be64f63 -- 'apps/strapi/src/api/*/content-types'` is empty. No Alert, Report or Activity entity exists. `docs/contract-gaps/phase-07-derived-insights.md` has 12 items. |
| | D-02 pure rules with an explicit `today` | ✓ | `apps/strapi/src/csrm/insights/*` has no `@strapi` import (grep 0); `analyst-insights.unit.test.ts` pins literal cases; each handler reads the clock once |
| | D-03 database aggregates, named caps, truncated flags | ✓ | `insight-constants.ts:10-36`; `countDistinct`, `SUM(CASE)` and `COUNT(*)` run in SQL; flags at `report-repository.ts:296,353`, `dashboard-summary.ts:266`, `recent-activity.ts:94` and `report-math.ts:249` |
| | D-04 one treatment due-state rule | ✓ | `treatment-due-state.ts:39-69` counts NULL as not Complete; the SQL restates it as `(IS NULL OR <> ?)` (`alert-repository.ts:302,310`; `report-repository.ts:179`); the stored "Overdue" status is never read (gap item 6) |
| Endpoints and grants | D-05 exactly six served operations | ✓ | All six are in the spec (script) and each is mounted exactly once (`analyst-insight-routes.unit.test.ts:102`; `routes/my-request-status-summary.ts`) |
| | D-06 five operations catalogued but unserved | ✓ | All five are absent from the spec and from every router (`analyst-insight-routes.unit.test.ts:81,128`); catalogue design note 7 gives the reasons; gap item 5 |
| | D-07 API-only Functions, human-only guard, identical copies | ✓ | Five API-only Functions have no `menuPath` and `roleIds: ["role.security_analyst"]` (script); the guard is at `csrm-authorization.ts:34-42, 270-273`; `cmp` shows the copies identical; `contract-catalogue.integration.test.ts:1101` |
| | D-08 closed contract, regenerated client, closed Zod, parity guard | ✓ | The 48 reachable components have 0 open objects and 0 unbounded arrays (script). Every response object is `.strict()`; the one `.strip()` is the URL-input parser (`alert-schema.ts:162-173`). Parity guard: `contract-response-parity.test.ts:216-225`. `api:check` is clean (gate). |
| | D-09 denial for three identities; owner scoping | ✓ | Six-identity matrices at `analyst-alerts.integration.test.ts:560`, `analyst-reports.integration.test.ts:618` and `analyst-dashboard.integration.test.ts:491`; owner scoping at `request-status-summary.integration.test.ts:85,112` |
| Alerts | D-10 eight kinds, deterministic id, source reference | ✓ | `alert-rules.ts:17-26,129`; the projection at `alert-repository.ts:459-480`; the literal list at `analyst-alerts.integration.test.ts:440` |
| | D-11 urgency apart from severity | ✓ | three urgencies (`alert-rules.ts:30`); badge icons disjoint from severity icons (`alert-urgency-badge.test.tsx:66`); residual rating carried separately (`alert-repository.ts:53-54,478`) |
| | D-12 paged, filtered, sorted; the summary uses the same predicate | ✓ | `alert-query.ts:23,41-84`; `alert-repository.ts:91,119-126,405-413,504-529`; `analyst-alerts.integration.test.ts:500,537` |
| Reports | D-13 four keys; data-driven index | ✓ | `report-definitions.ts:10-41`; the served definitions equal the web copy map (`analyst-reports.integration.test.ts:526`) |
| | D-14 never widens scope | ✓ | `requireAnalystInsightScope` requires the four underlying reads (`csrm-authorization.ts:50-55,326-336`). The SQL uses `applyDisclosableParent` with the open predicate, the reviewable statuses and the release triple. Exclusion fixtures prove it in the alerts, reports and dashboard suites. |
| Web surfaces | D-15 route placement; `/app` unchanged | ✓ | `/app/review` sits in its own `(analyst-dashboard)` group; `/app/alerts`; `/app/reports` and `[reportKey]`; the Requestor dashboard copy is frozen (`requestor-dashboard.test.tsx`) |
| | D-16 capability-gated presentation; no read on denial | ✓ | `alerts-page.test.tsx:106,121`; `reports-pages.test.tsx:187,393`; E2E `analyst-insights.spec.ts:601` |
| | D-17 five states, 375 to 1440, axe-clean | ✓ | per-route boundaries; `accessibility.spec.ts:184`; `design-system-conformance.spec.ts:242`; UI review at four widths |
| | D-18 KPI anatomy; no fabricated delta; tiles link to equal lists | ✓ | `kpi-tile.tsx:73`; no caller passes a delta. Tile equality is proven mounted, in E2E and in the browser. The widget 3 and widget 4 footers are recorded exceptions (gap item 10). |
| | D-19 ink charts with text equivalents; no chart dependency | ✓ | `package.json` is unchanged in the phase; `bar-chart.test.tsx:247`; the E2E journey asserts a visible table in every chart section |
| | D-20 reuse; new primitives in `components/csrm` | ✓ | `KpiTile` is used by the dashboard and `report-detail.tsx`; `BarChart` by the dashboard and all four reports; each primitive has its own tests |
| Carried forward | D-21 exact buckets as database predicates | ✓ | `review-queue-repository.ts:137-186`; the bounded id set (`questionnaire-generation-workflow.ts:78-91`); `review-queue-buckets.integration.test.ts:383,418` |
| | D-22 one Requestor summary read | ✓ | `requestor-dashboard-service.ts:164-170`; `requestor-dashboard.test.tsx:245,253` |
| Testing and fixtures | D-23 boot-relative seed fixture | ✓ | `seed-analyst-insights.ts:333-344`; `analyst-insights-seed.integration.test.ts:147,169,262,340,371` |
| | D-24 exact server values; no global totals in the browser | ✓ | literal mounted assertions; the E2E checks membership and same-test equality, for example "Needs attention" above zero, then equal to its list (`analyst-insights.spec.ts:547-563`) |
| | D-25 dual-actor journey, accessibility, shell-asserting sign-in | ✓ | `analyst-insights.spec.ts:515,601,85-96`; `accessibility.spec.ts:184` |
| Post-research | D-26 server `treatmentDueState`; `isRiskOverdue` retired | ✓ | `risk-register.ts:277`; `risk-schema.ts:149`; `risk-register.test.tsx:138` |
| | D-27 released-work alerts state facts | ✓ | `source.released` (`alert-repository.ts:134-156,475`); "Released · read-only" copy; gap item 1 |
| | D-28 serve the reserved `my_requests/status_summary` | ✓ | granted through `function.risk_assessment_requests.my_requests.api.02` to `role.requestor` (script); `contract-catalogue.integration.test.ts:1183` |
| | D-29 request alerts for reviewable statuses only | ✓ | `alert-repository.ts:252-255`; `alert-rules.ts:48`; fixtures Q5 to Q7 are excluded |
| | D-30 semantic bucket rule; equivalence test | ✓ | `review-queue-buckets.integration.test.ts:207`; gap item 8 |
| | D-31 NULL handling; open parent for Control Implementation overdue | ✓ | `alert-repository.ts:302,310,375,242-249` |
| | D-32 superseded by D-36 | ✓ | verified under D-36 |
| | D-33 distinct API-only names; idempotent seed | ✓ | `function.dashboard.summary_api` and siblings (script); `analyst-insight-catalogue-seed.integration.test.ts:110,130` |
| | D-34 dashboard composition; independent widgets | ✓ | `analyst-dashboard-service.ts:138-178`; `analyst-dashboard-service.test.ts:276-365`; `design-system-conformance.spec.ts:195` |
| | D-35 at most nine vertical plans | ✓ | nine plans, each with its summary |
| | D-36 open exposure and the register `state` filter | ✓ | `risk-register-query.ts:7,142`; `risk-register.ts:349-350`; `analyst-reports.integration.test.ts:573`; `analyst-dashboard.integration.test.ts:430` |
| | D-37 extensions recorded in the direction document | ✓ | `csrm-design-direction.md:284,361,371,382,415,422` (commit `583a811`) |

**Score:** 37/37 decisions verified.

### Plan must-have truths

| Plan | # | Truth (short form) | Status | Evidence |
|------|---|--------------------|--------|----------|
| 07-01 | 1 | Only the human analyst holds the five insight operations | ✓ | catalogue trace; `contract-catalogue.integration.test.ts:1101`; `analyst-insight-catalogue-seed.integration.test.ts:142` |
| | 2 | A mis-granted automation identity, or an analyst missing an underlying read, is refused | ✓ | `csrm-authorization.ts:270-273,326-336`; `analyst-insight-authorization.unit.test.ts:131,137` |
| | 3 | Seeding twice leaves one Function and one FunctionAPI per API-only name | ✓ | `analyst-insight-catalogue-seed.integration.test.ts:110,130` |
| | 4 | Every rule returns the literal expected value for an explicit UTC today | ✓ | `analyst-insights.unit.test.ts`; `treatment-due-state.ts:54-69` |
| | 5 | The five unserved operations stay catalogued, unpublished and explained | ✓ | script; design note 7; `analyst-insight-routes.unit.test.ts:128` |
| 07-02 | 1 | The Requestor dashboard makes one summary read; copy unchanged | ✓ | `requestor-dashboard-service.ts:164-170`; `requestor-dashboard.test.tsx:245,253` |
| | 2 | The summary counts only the caller's own requests, for every actor | ✓ | `request-status-summary.ts:68-80`; `request-status-summary.integration.test.ts:85,112` |
| | 3 | Register rows carry `treatmentDueState`; the marker shows exactly when it is overdue | ✓ | `risk-register.ts:277`; `risk-register.tsx:130`; `risk-register.test.tsx:138` |
| | 4 | Closed `state` filter whose total equals its rows | ✓ | `risk-register-query.ts:7,142`; `risk-register.ts:349-350`; `contract-catalogue.integration.test.ts:1288` |
| | 5 | Contract, client and closed parsers carry all three changes | ✓ | spec script; `risk-schema.ts:149`; `api:check` in the gate |
| 07-03 | 1 | Exact pages and totals beyond 1,000 requests | ✓ | `review-queue-buckets.integration.test.ts:383` |
| | 2 | Lifecycle-step equivalence; a running job means "Generation in progress" | ✓ | `review-queue-buckets.integration.test.ts:207,418` |
| | 3 | The 06.9-04 queue contract is unchanged | ✓ | `csrm-assessment-request.ts:59-67`; status bound at `review-queue-repository.ts:175`; `collection-scope.ts:45-52` |
| | 4 | One bucket definition serves the page, the total and the dashboard | ✓ | `review-queue-repository.ts:217-232,257-263`; `dashboard-summary.ts:228-230`; `analyst-dashboard.integration.test.ts:388` |
| 07-04 | 1 | Every current condition of eight kinds, most urgent first, fully described | ✓ | `alert-repository.ts:298-385,459-480`; `analyst-alerts.integration.test.ts:440` |
| | 2 | Paged 5/10/25/50 and filtered; the summary uses the same predicate | ✓ | `insight-constants.ts:16`; `alert-query.ts:41-84`; `analyst-alerts.integration.test.ts:500` |
| | 3 | Exact at window boundaries; NULL handling; scope exclusions | ✓ | fixtures `analyst-alerts.integration.test.ts:79-146`; tests `:440,458` |
| | 4 | Six non-analyst identities are refused both operations | ✓ | `analyst-alerts.integration.test.ts:560` |
| | 5 | Closed Zod parsers registered; `api:check` clean | ✓ | `alert-schema.ts` (11 strict response objects); `contract-response-parity.test.ts:216`; gate |
| | 6 | A boot-relative fixture produces all eight kinds | ✓ | `analyst-insights-seed.integration.test.ts:262`; `index.ts:26` |
| 07-05 | 1 | Alerts from the Reports group, fully described rows | ✓ | `navigation.ts:66`; `alert-presentation.ts`; E2E `analyst-insights.spec.ts:155` |
| | 2 | "Released · read-only"; the Control Implementation deep link lands below the sticky header | ✓ | `alert-presentation.ts:105-111`; UI review: 64px at 1440, 56px at 375 |
| | 3 | Filters, chips, pagination and five states at 375 and 1440 | ✓ | `alert-list.test.tsx`; `design-contract.spec.ts:21`; UI review |
| | 4 | A Requestor gets no Alerts navigation and no read | ✓ | `alerts/page.tsx:25`; `alerts-page.test.tsx:106`; E2E `:601` |
| | 5 | One current item; the sheet scrolls at 375×667 | ✓ | `mobile-navigation.test.tsx`; E2E `:238`; UI review |
| | 6 | Primitives with their own tests; the register marker uses the urgency badge | ✓ | the four primitive tests; key link `risk-register.tsx` to `AlertUrgencyBadge` verified |
| 07-06 | 1 | Four definitions equal to the web copy map | ✓ | `analyst-reports.integration.test.ts:526` |
| | 2 | Server-computed projections inside the scopes | ✓ | `report-repository.ts:162-195`; `analyst-reports.integration.test.ts:549,589` |
| | 3 | Report figures agree with the lists they link to | ✓ | `analyst-reports.integration.test.ts:573,677` |
| | 4 | Throughput is 6 or 12 months in UTC months, with a flagged median sample | ✓ | `report-query.ts:47-67`; `report-repository.ts:358-397`; tests `:737,762,783` |
| | 5 | Unknown key is 404 to the analyst; other queries 400; non-analysts refused | ✓ | `analyst-reports.integration.test.ts:618,652` |
| | 6 | Closed per-branch parsers registered | ✓ | `report-schema.ts` (25 of 25 objects strict); `contract-response-parity.test.ts:223` |
| 07-07 | 1 | Reports navigation opens one card per server definition | ✓ | `(report-index)/page.tsx:27-38`; E2E `:266` |
| | 2 | Frame, as-at line, KPI strip and sections with visible tables | ✓ | E2E journey per-report walk; `report-views.test.tsx` |
| | 3 | Linked tiles open equal lists | ✓ | E2E `:266`; mounted `analyst-reports.integration.test.ts:573` |
| | 4 | Keyboard period control; partial month marked in text | ✓ | `segmented-control.test.tsx`; UI review period control |
| | 5 | A denied viewer gets one state and one title for every key; an analyst's unknown key shows "Report not found" | ✓ | `[reportKey]/page.tsx:41-45,66-77`; `reports-pages.test.tsx:393`; E2E `:328,601` |
| | 6 | Own boundaries and five states; only the cross-tab scrolls | ✓ | route files; E2E `:342`; UI review |
| 07-08 | 1 | Four tiles, then seven widgets | ✓ | E2E `:387`; UI review |
| | 2 | Every tile and linked row opens an equal list | ✓ | mounted `analyst-dashboard.integration.test.ts:388,430`; E2E `:387,515`; UI review 9/9, 6/6, 2/2, 2/2. The footer exceptions are recorded in gap item 10. |
| | 3 | Strapi computes every figure; the web derives none | ✓ | `dashboard-summary.ts:193-270`; `analyst-dashboard-service.ts:132-178` |
| | 4 | Up to eight events, UTC dates, advisory wording for drafts | ✓ | `recent-activity.ts:87-94`; `recent-activity-repository.ts:80-159`; `analyst-dashboard-presentation.ts:390-409`; mounted `:635` |
| | 5 | Widgets fail independently; the page error only when the summary fails | ✓ | `analyst-dashboard-service.ts:148-151`; `analyst-dashboard-service.test.ts:336,345,365`; E2E `:490` |
| | 6 | `/app/review` boundaries never wrap the queues; one current item | ✓ | the `(analyst-dashboard)` route group; UI review nested-route check |
| 07-09 | 1 | One journey: dashboard, alert, source, tile, list, every report | ✓ | `analyst-insights.spec.ts:515-599` |
| | 2 | Both Requestor identities refused on every Phase 7 URL | ✓ | `analyst-insights.spec.ts:601-680` |
| | 3 | Zero axe violations and no overflow at 375 and 1440 | ✓ | `accessibility.spec.ts:184`; `design-system-conformance.spec.ts:242` |
| | 4 | Alerts in the collection design contract; the partial fixture | ✓ | `design-contract.spec.ts:21`; `design-system-conformance.spec.ts:195` |
| | 5 | The gap record lists every underivable fact and divergence | ✓ | `docs/contract-gaps/phase-07-derived-insights.md` |
| | 6 | The full phase gate is green | ✓ | recorded figures below |

**Score:** 50/50 plan truths verified.

### Required artifacts and key links

- **`verify.artifacts`:** 45 of 46 pass. The one miss is a false positive. `reports/[reportKey]/not-found.tsx` lacks the literal "Report not found" because it renders `ReportNotFoundState`, whose title sits at `report-detail.tsx:164`. `reports-pages.test.tsx:585` and E2E `analyst-insights.spec.ts:328` both assert the heading.
- **`verify.key-links`:** 24 of 24 wired.

### Data-flow trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|----------|------|--------|--------------------|--------|
| `analyst-dashboard.tsx` | `state.dashboard.units` | `getAnalystDashboard`: the summary, the alert summary and three alert pages | knex aggregates and bounded reads (`dashboard-summary.ts:214-250`) | ✓ FLOWING |
| `alert-list.tsx` | `alerts`, `pagination` | `listAlerts` → `GET /v1/alerts` | `UNION ALL` over eight branches (`alert-repository.ts:406-413, 504-518`) | ✓ FLOWING |
| `report-index.tsx` | `definitions` | `listReportDefinitions` → `GET /v1/reports` | the closed server set (`report-definitions.ts:20-41`), static by design (D-13) | ✓ FLOWING |
| report views | `report` | `getReport` → `GET /v1/reports/{reportKey}` | knex aggregates (`report-repository.ts:251-398`) | ✓ FLOWING |
| Requestor lifecycle cards | `lifecycleCounts` | `getMyRequestStatusSummary` | owner group-by (`request-status-summary.ts:68-80`) | ✓ FLOWING |
| Risk Register marker | `risk.treatmentDueState` | `GET /v1/risks` | per-row rule (`risk-register.ts:277`) | ✓ FLOWING |

`emptyAnalystDashboard` and `zeroedReport` feed only the attested E2E `empty` fixture, after a successful read (`(analyst-dashboard)/page.tsx:46-47`; `[reportKey]/page.tsx:60`). They are not hollow props.

### Gate evidence (recorded from plan 07-09 on `d3c6150`; not re-run here)

| Check | Result |
|-------|--------|
| Playwright, full suite | 49 passed, 0 failed, 0 flaky, 0 skipped; 7.2 min; 1 worker; no retries |
| Strapi suite (full, serial) | 349/349 pass |
| Web unit suite | 832 passed across 69 files |
| Web typecheck | clean (exit 0) |
| `api:check` | clean (exit 0; `schema.d.ts` unchanged) |
| Isolated pre-gate run of the four Phase 7 browser specs | 21/21 |

Consistency checks on the tree at `be64f63`, run in this session:
- **Web tests:** 69 unit test files, which matches the reported count.
- **Browser tests:** 14 spec files with 40 static `test(` declarations. The loops in `app-shell` (7) and `request-relationship-states` (8) generate the rest, which gives the reported 49.
- **Hygiene:** the two catalogue copies are identical; the content-type diff is empty; no `package.json` changed.

### Browser verification (orchestrator, `07-UI-REVIEW.md` "Measured Evidence")

- **Alerts at 1440, 1024, 768 and 375:**
  - populated with 10 results, no error state, zero axe violations, zero horizontal overflow;
  - the mobile sheet at 375×667 scrolls (864px of content in a 667px sheet), and all 14 items and the "Development role" select are reachable;
  - the Control Implementation deep link lands the heading exactly at the sticky header's edge (64px at 1440, 56px at 375);
  - Requestor and Secondary Requestor: no Alerts item, the permission state alone, axe-clean.
- **Reports:**
  - 20 page loads (the index and four reports at four widths) with zero axe violations, zero overflow and zero error states; every chart section carries its table;
  - choosing 12 months sets `?period=12`, keeps focus, shows no skeleton flash and renders 12 month rows;
  - an analyst's unknown key shows "Report not found";
  - a Requestor gets the same permission state and document title on the index, a known key and an unknown key.
- **Analyst dashboard at four widths:**
  - all eight sections render, with no error state, zero axe violations and zero overflow, and exactly one current navigation item;
  - tile against list: Requires my attention 9 = 9, Overdue 6 = 6, Due within 14 days 2 = 2, Needs attention 2 = 2;
  - on `/app/review/requests` only "Assessment Requests" is current;
  - a Requestor gets no item and the permission state with no tiles;
  - no console errors on any audited page.
- **Scores and open findings:**
  - Score: 22/24.
  - One warning: shorter widgets stretch at 1440, a Phase 8 polish item.
  - Two info items: the cross-tab scroll cue at 375, and printing includes the app shell.
  - One carried item: the mobile "Menu" button's accessible name does not contain its visible label (WCAG 2.5.3), for the Phase 8 sweep.

### Behavioral spot-checks (read-only)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Insight grants reach the human analyst only | node script over the catalogue | each of the five sits in its own API-only Function with `roleIds: ["role.security_analyst"]` and no `menuPath` | ✓ PASS |
| The Requestor summary is granted through My Requests | same script | `my_requests.api.02` belongs to `function.risk_assessment_requests.my_requests`, held by `role.requestor` | ✓ PASS |
| The five unserved operations stay unpublished and unmounted | spec script and a route grep | absent from the spec; no router mounts them | ✓ PASS |
| Catalogue copies | `cmp` | identical | ✓ PASS |
| Published responses are closed | node walk over the spec | 48 components; 0 open objects; 0 unbounded arrays | ✓ PASS |
| Frozen datamodel | `git diff --name-only eb28084 be64f63 -- 'apps/strapi/src/api/*/content-types'` | 0 files | ✓ PASS |
| Debt markers and hard-coded colours in the 148 phase files | grep, with a positive control of 43 hits | 0 and 0 | ✓ PASS |
| Raw `fetch` in Phase 7 routes and features | grep | 0 | ✓ PASS |
| Plan artifacts and key links | `gsd-sdk query verify.artifacts` / `verify.key-links` | 45/46 (plus one false positive) / 24/24 | ✓ PASS |
| Test suites | not run | skipped by instruction: a concurrent fixer runs its own and the dev servers are stopped | ? SKIP |

### Probe execution

No plan or summary declares a probe, and the repository has no `scripts/*/tests/probe-*.sh`. This is not a migration or tooling phase. Step 7c: SKIPPED.

### Anti-patterns found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts` | 161, 270 | WR-01: "Ready for review" counts finished work | ⚠️ Warning, fixed after `be64f63` (`5e8a396`) | The figure equals its list; only the label overstated waiting work |
| `apps/strapi/src/api/csrm-risk/services/risk-register.ts` | 393 | IN-01: unrated Risks sort first when descending | ℹ️ Info, fixed (`155918e`) | The widget 3 footer led with unrated Risks |
| `kpi-tile.tsx`, `bar-chart.tsx`, `analyst-dashboard.tsx`, `treatment-performance-report.tsx` | see 07-REVIEW IN-02 | `ul` without `role="list"` | ℹ️ Info, fixed (`607b41b`) | VoiceOver on Safari lost the counts |
| `report-schema.ts`, `analyst-dashboard-schema.ts`, `alert-schema.ts` | see 07-REVIEW IN-03 | undeclared parser narrowings | ℹ️ Info, deferred to Phase 8 (INT-01) | Fails closed; the parity guard cannot see it |
| `apps/web/e2e/accessibility.spec.ts` | 113 | an inline `toHaveURL(/\/app$/)` after sign-in, guarded by `toHaveTitle` | ℹ️ Info, pre-existing | Not a sign-in helper; outside the Phase 7 edits |
| gap record item 12 | – | `authorization.policy.test.js` never runs; the parity guard's register entry is vacuous; the integrity script is stale; `next build` has not run | ℹ️ Info, pre-existing, Phase 8 | None affects a Phase 7 figure |

No `TBD`, `FIXME`, `XXX`, `TODO` or `HACK` marker appears in any of the 148 phase files, so the debt-marker gate passes.

### Disconfirmation pass

1. **A requirement only partly met.** At `be64f63`, DASH-01's "review queues" row for questionnaires labelled finished work as ready for review (WR-01, now fixed). DASH-01's "due dates" also has recorded limits: a request without a due date never alerts, and an alert on released work can never clear. Both are gap items 11 and 1, accepted in `07-SECURITY.md`.
2. **A test that passes without testing the behaviour.** The parity guard synthesises short non-empty strings and minimum integers. It therefore cannot see the IN-03 narrowings and cannot exercise the Risk Register parser (gap item 12). Direct pins in `risk-schema.test.ts` cover the register.
3. **An error path with no test.** An unexpected repository error, for example "CSRM alert data is invalid.", is re-thrown (`controllers/alerts.ts:26`). Strapi's `formatInternalError` then serves a generic 500. No Phase 7 test exercises this path. Reading `@strapi/core` 5.51.0 `dist/services/errors.js` confirms the body is generic.

### Concurrent review fixes (after the verified commit)

| Commits | Finding | Change | Regression read |
|---------|---------|--------|-----------------|
| `182ff36` test, `5e8a396` fix | WR-01 | "Ready for review" becomes "Submitted"; the widget description names what each group counts; UI-SPEC widget 1 updated | The predicate (`dashboard-summary.ts:232`) and the link (`?status=submitted`) are unchanged. The contract field `questionnairesReadyForReview` is unchanged, so the spec and the generated client are untouched. |
| `2c0f979` test, `155918e` fix | IN-01 | The rating sorts list unrated Risks last in both directions | A constant `ORDER BY` fragment over a closed column and a parsed direction; no bound value added |
| `0248a85` test, `607b41b` fix | IN-02 | `role="list"` on the KPI strip, bar chart, dashboard lists and treatment report | markup only |

`07e5a8e` records the resolution in `07-REVIEW.md`:
- IN-03 is deferred with no code change to Phase 8 contract parity (INT-01).
- The `DashboardReviewQueue` description in `specification.json` still opens with "Work waiting in each analyst review list". Rewording it is a contract change, left to Phase 8 by the same disposition.

The orchestrator re-runs the full gate after these fixes and records the figures.

### Human verification required

None outstanding. The orchestrator's browser audit performed the eight manual-only checks in `07-VALIDATION.md` and recorded them in `07-UI-REVIEW.md`:

| Manual check (07-VALIDATION) | Measured in 07-UI-REVIEW | Result |
|------------------------------|--------------------------|--------|
| Alerts table fits at 768 and 1024 | Alerts at four widths | zero overflow |
| Cross-tab region scrolls at 375 | Reports, 20 loads; remaining finding 2 | scrolls in its own labelled, focusable region; the missing scroll cue is recorded as info |
| Responsive layout at four widths | all three surfaces | zero overflow, populated, no error state |
| Mobile navigation sheet | 375×667 | scrolls; all 14 items and the role select are reachable |
| Report print legibility | remaining finding 3 | the body prints legibly; the shell prints too (print is not a deliverable, D-06) |
| Deep link below the sticky header | Alerts | lands at 64px (1440) and 56px (375) |
| Three-second read | pillars 2 and 6 | clear hierarchy; one spacing warning |
| Console clean | every audited page | no errors |

### Deferred items

None. The gap record marks four items for Phase 8: PostgreSQL execution, a shared generation job store, `next build`, and the pre-existing test-infrastructure findings. None is a Phase 7 must-have, and `07-SECURITY.md` records each as an accepted risk.

### Gaps summary

No gaps. At `be64f63` every roadmap success criterion, both requirements, every locked decision and all 50 plan truths are met:
- Strapi derives every tile, list, alert and report on read.
- Strapi authorises each through the human-analyst guard and the insight scope, and each handler asserts that scope before reading anything.
- The web renders closed, parsed server figures only.

The code review's warning and two of its info items were fixed while this verification ran. The third info item, IN-03, is deferred to Phase 8 contract parity by the orchestrator's disposition and blocks nothing. The orchestrator's re-run of the full gate after those fixes is the remaining step.

---

_Verified: 2026-09-24T20:40Z_
_Verifier: gsd-verifier_
