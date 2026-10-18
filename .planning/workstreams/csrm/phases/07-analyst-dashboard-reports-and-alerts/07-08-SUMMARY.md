---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 08
subsystem: analyst-dashboard
tags: [strapi, knex, document-service, openapi, zod, nextjs, react, tailwind, container-queries, vitest, testing-library, playwright, axe, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 01)
    provides: the dashboardSummary operation, its grant and the human-analyst guard; utcToday, deriveTreatmentDueState, ratingCounts and the named constants ALERT_DUE_SOON_WINDOW_DAYS, DASHBOARD_WIDGET_ROW_LIMIT and RECENT_ACTIVITY_LIMIT
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 02)
    provides: TreatmentDueState and the Risk Register state=open filter that every exposure row opens
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 03)
    provides: countReviewQueueBucket and whereQuestionnaireHasSubmittedAnswer, the definitions the review queues use
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 04)
    provides: createAlertRepository, getAlertSummary and listAlerts with the repeatable kind filter, applyDisclosableParent, and the boot-relative Phase 7 seed fixture
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 05)
    provides: KpiTile, KpiTileStrip, KpiTileSkeleton, BarChart (labelled-values), AlertRow (default and agenda), AlertUrgencyBadge, EmptyState kind="cleared", RetryableErrorState, navigationGroups and activeNavigationHref
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 06)
    provides: the RatingCounts component and the report schema's RatingCounts parser
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 07)
    provides: the route-group boundary precedent, the resolveServerTree page-test seam, and the Phase 7 accessibility and conformance entries with phase7PopulatedContent
provides:
  - GET /api/v1/dashboard/summary, human Security Analyst only, computed on read from the shared queue, Risk Register and alert definitions, with bounded recent activity
  - the pure activity merge (recent-activity.ts) and seven bounded activity reads that name the actor from the event's own relation
  - the closed DashboardSummaryResponse contract, the regenerated client and the closed web parser, registered with the parity guard
  - getAnalystDashboard, five parallel reads composed into eight independent failure units
  - analyst-dashboard-presentation.ts, the pure module that words every tile, row, link, note and activity phrase
  - AnalystDashboard, AnalystDashboardSkeleton and AnalystDashboardPageHeader
  - /app/review in app/(app)/app/review/(analyst-dashboard)/ with its own page, loading and error boundaries
  - resolveE2eAnalystDashboardPartial, the attested Top alerts partial selector
  - the Analyst dashboard navigation item, directly above Assessment Requests
  - the dashboard slice of e2e/analyst-insights.spec.ts, /app/review in the Phase 7 axe scans and in phase7AuditedRoutes
affects: [07-09, analyst-dashboard, e2e-analyst-insights, accessibility, design-system-conformance, contract-gaps]

tech-stack:
  added: []
  patterns:
    - "A composed dashboard is a set of failure units, each { status: 'ready', data } or { status: 'unavailable' }. A refused read is the page permission state, a failed summary is the page error, and any other failed read fails only its own unit."
    - "A read that rejects outright is settled into a failed result, so an unexpected rejection can fail only its own unit."
    - "A route's own loading and error boundaries live in a route group beside its sibling segments, so the siblings keep theirs."
    - "A bounded widget list says 'Showing n of total' only when the server's own total says there is more."
    - "An identifier keeps its natural width in a two-column row; the badges and dates beside it wrap at the end of the line instead."

key-files:
  created:
    - apps/strapi/src/api/csrm-analyst-insight/services/dashboard-summary.ts
    - apps/strapi/src/api/csrm-analyst-insight/services/recent-activity-repository.ts
    - apps/strapi/src/api/csrm-analyst-insight/controllers/dashboard.ts
    - apps/strapi/src/api/csrm-analyst-insight/routes/dashboard.ts
    - apps/strapi/src/csrm/insights/recent-activity.ts
    - apps/strapi/tests/analyst-dashboard.integration.test.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-schema.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-page-header.tsx
    - apps/web/app/(app)/app/review/(analyst-dashboard)/page.tsx
    - apps/web/app/(app)/app/review/(analyst-dashboard)/loading.tsx
    - apps/web/app/(app)/app/review/(analyst-dashboard)/error.tsx
  modified:
    - apps/strapi/tests/analyst-insight-routes.unit.test.ts
    - apps/strapi/tests/analyst-insights.unit.test.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/web/src/features/reports/report-schema.ts
    - apps/web/src/features/contract-response-parity.test.ts
    - apps/web/src/lib/testing/e2e-ui-state.ts
    - apps/web/src/lib/testing/e2e-ui-state.test.ts
    - apps/web/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/src/components/shell/mobile-navigation.test.tsx
    - apps/web/e2e/analyst-insights.spec.ts
    - apps/web/e2e/accessibility.spec.ts
    - apps/web/e2e/design-system-conformance.spec.ts

key-decisions:
  - "The page state is ready, error or permission-denied; the skeleton is its own export, which the route's Suspense fallback, loading.tsx and the loading fixture render."
  - "The KPI strip is one failure unit: it needs the summary's requires-attention count and the alert summary's urgency counts, so an alert-summary failure makes the whole strip unavailable, as UI-SPEC §6.2 defines it."
  - "Treatments due shows the bounded kinds page's rows with the summary's treatmentsDue.total (the plan's recorded decision); Upcoming due dates and Top alerts use their own page totals. The mounted Task 1 test proves the treatment totals equal."
  - "One due-soon window per page: every caption, description and cleared line states the summary's dueSoonWindowDays."
  - "A widget is cleared exactly when its population is zero (exposure total, High and Critical total, alert page total, no activity rows); the Review queue never is. A cleared or failed widget shows no footer, so no link and no count."
  - "emptyAnalystDashboard lives in the presentation module, as zeroedReport does for reports, so route tests mock the service with getAnalystDashboard alone."
  - "The partial selector applies only to a rendered ready dashboard after the real reads succeeded; it is never resolved on a refusal or a page error."
  - "A High or Critical Risk with no statement shows no statement line rather than invented copy; an activity row links by number, else title, else record type."

patterns-established:
  - "Dashboard presentation: dashboardKpiTiles, dashboardWidgetCopy, dashboardWidgetOrder, reviewQueueGroups, riskExposureRows, highCriticalRiskRows, alertWidgetNote, highCriticalNote, activityRows, activityPhrase and recentActivityNote are the only way dashboard copy reaches the screen."
  - "Widget frame: a Card whose section is the @container, fills the card and pushes its footer to the bottom, so paired widgets' footers align across a row."

requirements-completed: [DASH-01]

duration: "Tasks 3 and 4 took 46 minutes (18:48:25Z to 19:34:06Z), including three Playwright runs and an 8.7-minute Strapi suite. The whole plan ran from 18:00:35Z (plan base 5d67e50) over two executor runs."
completed: 2026-09-24
status: complete
actuals:
  tasks: 4
  commits: 8
---

# Phase 7 Plan 08: Analyst Dashboard Summary and the /app/review Screen Summary

**A Security Analyst now opens "Analyst dashboard", directly above the review queues, and sees what needs them first: four linked Needs action tiles (Requires my attention, Overdue, Due within 14 days, Needs attention), then Review queue, Risk exposure, High and Critical residual Risks, Treatments due, Upcoming due dates, Top alerts and Recent activity. Strapi computes every figure on read from the definitions of the lists they open, so every tile and linked row opens a list whose total equals it. Each widget fails on its own with a compact "Try again", and generated drafts read as drafts for Security Analyst review. Requestors and Secondary Requestors see no dashboard item and get the permission state at /app/review with no analyst read.**

This is plan 8 of 9 (D-35), wave 6. It delivers DASH-01 (D-02, D-03, D-05, D-08, D-14 to D-18, D-20, D-21, D-24, D-25, D-34, D-36). The orchestrator ran it as two executor runs (plan check issue 7): Tasks 1 and 2, then Tasks 3 and 4.

## Performance

- **Tasks 1 and 2:** plan base `5d67e50` at 2026-09-24T18:00:35Z; last commit `21073b4` at 18:34:56Z.
- **Tasks 3 and 4:** 18:48:25Z to 19:34:06Z, 46 minutes. This includes:
  - three Playwright runs: 4.0 min, 1.1 min for the RED check, then 4.0 min;
  - the full web suite, the typecheck and `api:check`;
  - the full Strapi suite (8.7 minutes).
- **Tasks:** 4 of 4.
- **Files:** 32 across the plan (17 created, 15 modified), plus this summary.

## Accomplishments

- **The summary server (Task 1, D-21, D-34, D-36).**
  - `GET /api/v1/dashboard/summary` is human Security Analyst only. It asserts the insight scope, refuses any query key with one safe 400, then reads the clock once.
  - `computeDashboardSummary(strapi, today)` runs every read in parallel:
    - the three D-21 bucket counts, through `countReviewQueueBucket` with the generation registry snapshot;
    - Questionnaires ready for review, from the submitted-answer fact;
    - Risk Assessments by `draft` and `in-review`;
    - open exposure by residual rating, under `applyDisclosableParent` plus `closure_date IS NULL`;
    - the High and Critical rows: Critical first, then target date with undated last, then Risk number, capped with `DASHBOARD_WIDGET_ROW_LIMIT + 1`, with an exact total and each row's D-04 due state;
    - treatments due from `createAlertRepository(...).count` over the alert list's own branches.
  - Every count is a database aggregate read through `wholeCount`.
- **Recent activity and the contract (Task 2, the AI advisory rule).**
  - `mergeRecentActivity(items, limit)` orders newest first, then kind, then documentId. It keeps the limit and flags truncation exactly.
  - Seven bounded Document Service reads, each `RECENT_ACTIVITY_LIMIT + 1` rows, name the actor from the event's own relation:
    - request events stay in the review scope;
    - a release needs the complete approved, dated and approver triple;
    - generated drafts name no one.
  - A numberless questionnaire serves a null identifier.
  - The contract was published with closed components (`RatingCounts` and `TreatmentDueState` by `$ref`), and the client regenerated. The closed web parser was registered with the parity guard.
- **The composition (Task 3, D-34, UI-SPEC §6.2).**
  - `getAnalystDashboard()` starts all five reads before any returns:
    - the summary;
    - the alert summary;
    - `listAlerts` for the two treatment kinds, for `urgency=due-soon`, and unfiltered, each page 1 of 5.
  - A 403 from any read is `permission-denied`, and a failed summary is `error`.
  - A failed alert summary makes the KPI strip unavailable, and a failed alert page makes only its own widget unavailable. A rejecting read is settled into a failure first.
- **The screen (Task 3, UI-SPEC §2).**
  - A visually hidden `h2` "Needs action" heads a `ul` of four linked `KpiTile`s: one column, two from `sm` and four from `xl`, on the strip's subgrid.
  - Seven `section` regions follow in §2.2 order, each labelled by its `h2`, in the Requestor widget card. Each is an `@container`, in a one-column grid that becomes two from `lg`, with Recent activity spanning both.
  - Review queue: three micro-label groups of 44px link rows, each named like "Requires my attention: 4 Assessment Requests", zeros included.
  - Risk exposure: the `labelled-values` `BarChart` with severity fills, rows named like "Critical residual rating: 2 open Risks" opening `/app/risks?residualRating=…&state=open`. Not rated is plain text and appears only above zero.
  - High and Critical: one `RecordLink` per row, a `RiskRatingBadge`, the target-date line, and the dense Overdue marker exactly when the server's due state says overdue. The footer holds the note and "Open Risk Register".
  - Treatments due and Top alerts use the shared `AlertRow`; Upcoming due dates uses its agenda variant. Each has its note and footer links.
  - Recent activity: "{identifier} {phrase}", an absolute en-AU UTC `<time>`, and a one-line "{record type} · {title}". The note reads "Showing the 8 most recent events".
  - Every widget has its cleared state (§7.2) and a compact per-widget error with "Try again". The page error, the permission state and the skeleton follow §6.1.
- **The route and navigation (Task 3, D-15, D-16, UI-SPEC §1.3, §1.5).**
  - `app/(app)/app/review/(analyst-dashboard)/` holds a synchronous page shell with the header and a `Suspense` around `AnalystDashboardContent`, which runs:
    - capability first;
    - then `getAnalystDashboard`;
    - then the fixture and the partial selector.
  - Its `loading.tsx` and `error.tsx` (`retry`) wrap the dashboard alone. `review/loading.tsx` does not exist.
  - "Analyst dashboard" (`ActivityIcon`) sits directly above Assessment Requests. The longest-match rule makes it the only current item on `/app/review`, and Assessment Requests the only current item on a request.
- **Browser proof (Task 4, D-24, D-25).** Three new tests pass, `/app/review` joins the Phase 7 axe scans and the Phase 7 conformance matrix, and one real layout defect was found and fixed on the way (Deviation 1).

## Task Commits

1. **Task 1 RED:** pin the analyst dashboard summary figures to the lists they open. `e769c9f` (test)
2. **Task 1 GREEN:** compute the analyst dashboard summary from the shared queue, Risk and alert definitions. `3aa9a9b` (feat)
3. **Task 2 RED:** pin recent activity and the published dashboard summary contract. `4d62432` (test)
4. **Task 2 GREEN:** add recent activity and publish the dashboard summary contract. `21073b4` (feat)
5. **Task 3 RED:** pin the analyst dashboard widgets, their independent failure and its navigation. `05f0e1c` (test)
6. **Task 3 GREEN:** add the analyst dashboard with independent, linked widgets. `b7aea71` (feat)
7. **Task 4 fix:** keep a High or Critical Risk identifier whole beside its badge and date. `7ef2fdc` (fix). Its browser check failed before the fix.
8. **Task 4:** prove the analyst dashboard, its tiles, its denial and its partial failure in the browser. `060e4f5` (test)

**Plan metadata:** the `docs(07-08)` commit that carries this summary.

## Files Created/Modified

- **Strapi** (`apps/strapi/`):
  - `src/api/csrm-analyst-insight/services/dashboard-summary.ts`: the figures.
  - `services/recent-activity-repository.ts`: the seven bounded reads.
  - `controllers/dashboard.ts` and `routes/dashboard.ts`: the operation.
  - `src/csrm/insights/recent-activity.ts`: the pure merge.
  - Tests:
    - `tests/analyst-dashboard.integration.test.ts` (new): figures, equalities, activity, denial and truncation;
    - `analyst-insights.unit.test.ts`: the merge;
    - `analyst-insight-routes.unit.test.ts`: the route inventory;
    - `contract-catalogue.integration.test.ts`: the contract block.
- **Contract:** `docs/references/specification.json` and `apps/web/src/lib/api/generated/schema.d.ts`.
- **Web feature** (`apps/web/src/features/analyst-dashboard/`):
  - `analyst-dashboard-schema.ts`: closed parsers;
  - `analyst-dashboard-service.ts`: the summary read and `getAnalystDashboard`;
  - `analyst-dashboard-presentation.ts`: words, links, rows and the empty fixture;
  - `analyst-dashboard.tsx`: the screen and skeleton;
  - `analyst-dashboard-page-header.tsx`: the shared header.
  - Tests: `analyst-dashboard-service.test.ts` (20), `analyst-dashboard-presentation.test.ts` (25) and `analyst-dashboard.test.tsx` (35).
  - `reports/report-schema.ts` now exports `ratingCountsSchema` for reuse.
- **Route** (`apps/web/app/(app)/app/review/(analyst-dashboard)/`): `page.tsx`, `loading.tsx` and `error.tsx`.
- **Harness:**
  - `lib/testing/e2e-ui-state.ts` (`resolveE2eAnalystDashboardPartial`) and its test (8);
  - `e2e-ui-state-route-authorization.test.tsx` (29): a fixture-order row, a denial-outside-boundary test and a Requestor gate test;
  - `contract-response-parity.test.ts`.
- **Navigation:** `config/navigation/navigation.ts` and `components/shell/mobile-navigation.test.tsx` (43).
- **Browser specs:** `e2e/analyst-insights.spec.ts` (three tests), `e2e/accessibility.spec.ts` and `e2e/design-system-conformance.spec.ts`.

## Verification

**RED, per task (Tasks 3 and 4, observed in this run):**

| Check | Result |
| --- | --- |
| Task 3 | 6 files failed, 22 tests failed and 49 passed. Presentation, component and route authorization failed to resolve their new modules; `getAnalystDashboard` and `resolveE2eAnalystDashboardPartial` were not functions; 5 navigation tests failed on the missing item. |
| Task 4 fix, in the browser | `analyst-insights` had 1 failed and 9 passed: "RSK-E2E-P7-RELEASED-001 sits on one line at 1440px. Expected: 1. Received: 2" |

At Task 3's RED, "shows a Requestor no Analyst dashboard link, even on /app/review" already passed. It pins an absence (Deviation 5).

**GREEN and the plan gate:**

| Check | Result |
| --- | --- |
| Task 3 targeted (`analyst-dashboard`, `e2e-ui-state`, route authorization, `mobile-navigation`) | 160 passed across 6 files; typecheck exit 0 |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters`, filtered to the new files | no finding |
| `pnpm --filter @csrm/web test` (full) | 832 passed across 69 files, exit 0. That is 744 across 67 after Task 2, plus 88 new tests from Task 3. |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0; `schema.d.ts` unchanged |
| `pnpm --filter @csrm/strapi test` (full, serial) | 349 tests, 349 pass, 0 fail, 0 cancelled, 0 skipped, exit 0 (19:24:25Z to 19:33:13Z). That is 335 at the 07-07 gate, plus Tasks 1 and 2. |
| `git diff --name-only 5d67e50 HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| Files deleted across the plan | none |
| Commit messages and added lines scanned for tool, assistant or model names and attribution trailers | none |
| `next-env.d.ts` and `tsconfig.json` after every Playwright run | restored with `git checkout --`; `git status` clean for both |

**Targeted Playwright run (final).** The plan names four specs, and the amendment adds `design-system-conformance.spec.ts`. Port 1337 was confirmed free first. The run went from 19:19:44Z to 19:23:46Z.

| Spec | Passed | Failed |
| --- | --- | --- |
| `e2e/accessibility.spec.ts` | 5 | 0 |
| `e2e/analyst-insights.spec.ts` | 10 | 0 |
| `e2e/app-shell.spec.ts` | 7 | 0 |
| `e2e/assessment-navigation-lifecycle.spec.ts` | 3 | 0 |
| `e2e/design-system-conformance.spec.ts` | 4 | 0 |
| **Total** | **29** | **0** (no retries, no flaky tests) |

- A scratch capture spec ran in the same invocation and passed (the 30th test). It was deleted afterwards and never staged.
- Both of the plan's `fails_when` conditions stayed clear:
  - `accessibility.spec.ts` scanned `/app/review/requests` and the other review queues with no dashboard skeleton;
  - every tile equalled its list: Requires my attention against the review queue, Overdue against `/app/alerts?urgency=overdue`, and the Critical exposure row against the open Critical register list.
- The Phase 7 matrix ran seven routes through the type scan, the five states at 375 and 1440 and the Requestor denial in 1.0 min.
- Earlier runs:
  - the first full targeted run had 29 passed and 1 failed, on my own over-broad assertion (Deviation 2);
  - the `analyst-insights` RED run had 9 passed and 1 failed (Deviation 1).

**Visual review.** The scratch spec captured `/app/review` at 375, 768, 1024 and 1440, plus the empty, loading and partial fixtures and the Requestor's permission render.
- Every capture measured zero page overflow.
- **Tile alignment:**
  - at 768, row one's captions, values and supporting lines sit at y = 191, 215 and 259, and row two's at 341, 365 and 409, with the wrapped supporting line 32px beside a 16px one;
  - at 1440, all four tiles share one line set.
- **Widget widths:** 330px at 1024 (rows stacked, below `@md`); 718px at 768, 538px at 1440 and 1102px for Recent activity at 1440 (end-aligned from `@md`).

**Acceptance criteria, rerun before this summary:**
- **Task 1.**
  - `dashboard-summary.ts` contains `countReviewQueueBucket`, `createAlertRepository` and `closure_date IS NULL`.
  - `routes/dashboard.ts` contains `requireAnalystInsightScope`.
  - The integration test passes in the full suite.
- **Task 2.**
  - Every activity source reads `RECENT_ACTIVITY_LIMIT + 1` rows and names the actor by `displayName`.
  - `specification.json` holds `"/v1/dashboard/summary"` and `"DashboardSummaryResponse"`.
  - The parity pinned list holds the module.
  - `api:check` is clean.
- **Task 3.**
  - The three `(analyst-dashboard)` files exist, and `review/loading.tsx` does not.
  - `navigation.ts` holds `'/app/review'` labelled "Analyst dashboard".
  - The presentation module contains "draft generated for Security Analyst review".
  - The tests pass.
- **Task 4.**
  - All targeted specs pass, and the two Next files are restored.
  - The full suites, the typecheck and `api:check` are green.
  - There is no content-type diff and no attribution.

## Orchestrator Amendments Applied

- **Served-shape pinning (issue 1).** Task 2's mounted test asserts the exact key set of every served level against the published component (`specKeys`). That covers the envelope, the summary, the queue, the exposure, the High and Critical block and rows, treatments due, the activity block and items. It also walks the whole body against `DashboardSummaryResponse`.
- **Route inventory (issue 10).** Task 1 extended `analyst-insight-routes.unit.test.ts` with `routes/dashboard.ts`. The route is mounted once, uses token auth, lists `global::csrm-app-enabled` first and sets `requireAnalystInsightScope`.
- **Accessibility and conformance (issues 3 and 4).**
  - **`accessibility.spec.ts`:** "has no axe violations on phase 07 analyst surfaces" now scans `/app/review` at 1440 and 375, after asserting four KPI tiles with figures and no `[data-state-kind="error"]`. It also scans the Requestor's `/app/review` permission render. Its ceiling rose from 420 s to 480 s; it took 15.2 s.
  - **`design-system-conformance.spec.ts`:** `phase7AuditedRoutes` was extended, not re-created, with `/app/review`. `phase7PopulatedContent` gained its branch (the fourth tile's figure), and the loop also counts the four tiles before the type scan.
  - **The `signIn` helper:** it already asserted the Dashboard heading and role banner (07-05), and is unchanged.
- **Activity fixture arithmetic (issue 11a).** The mounted test controls nine events, T1 to T9, and asserts `CONTROLLED_ACTIVITY_EVENTS - 1` rows, T9 down to T2, with `truncated: true`. T10 is only on the partially released assessment's `approvalDate`, and T11 is on the still-draft request's `revertedAt`; neither appears.
- **Nullable questionnaire identifier (issue 11b).** The identifier is nullable in the contract and the closed parser, and a numberless questionnaire serves `null` (Task 2). The UI links such a row by its title, or by the record type when there is none. The presentation and component tests cover both.
- **Execution (issue 7).** Two executor runs, as dispatched.

## Decisions Made

1. **State and units.**
   - `AnalystDashboardState` is `ready`, `error` or `permission-denied`.
   - The units are `kpi`, `reviewQueue`, `riskExposure`, `highCritical`, `treatmentsDue`, `upcomingDueDates`, `topAlerts` and `recentActivity`, each `{ status: 'ready', data } | { status: 'unavailable' }`.
   - Loading is the separate `AnalystDashboardSkeleton`, as the report screens do it.
2. **The KPI strip is one unit.** It needs the summary's requires-attention count and the alert summary's urgency counts. When the alert summary fails, the strip shows "We couldn’t load the summary counts", although one figure is known (UI-SPEC §6.2 makes the strip one unit).
3. **Totals.**
   - Treatments due takes its rows from the bounded two-kind page and its total from `summary.treatmentsDue.total`, per the plan's recorded decision.
   - Upcoming due dates and Top alerts take their totals from their own pages.
   - A note appears only when the total exceeds the rows shown. The High and Critical note follows the server's `truncated`.
4. **One window.** Every caption, description and cleared line states the summary's `dueSoonWindowDays`, the same constant the alert reads carry. It is singular at 1 ("Due within 1 day").
5. **Settled reads.** Each alert read is wrapped so that a rejection becomes a failed result, which fails only its own unit. The summary read already normalises its failures, and the outer `try` makes anything else the page error.
6. **Emptiness and footers.**
   - A widget is cleared exactly when its population is zero; the Review queue never is.
   - A cleared or failed widget renders no footer, so no link and no count ("no wall of competing CTAs", §6.2).
7. **Copy the UI-SPEC left open.**
   - A Risk with no statement shows no statement line; no copy is invented.
   - An activity row's link is the identifier, else the title, else the record type.
   - Its secondary line is "{type} · {title}", or the type alone when the title is the link or absent, and none when the link is the type.
   - The target-date line is "Target date {date}", or "No target date", as §2.5 writes it.
8. **Widget frame.**
   - The widget `section` is the `@container` and fills its `Card`; the body grows, so paired widgets' footers align along a row.
   - Queue groups are separated by a hairline, and queue rows use the bar rows' link-row treatment for consistency.
9. **One order.** `dashboardWidgetOrder` drives both the dashboard and its skeleton, so the skeleton's seventh card is the one that spans two columns.
10. **Empty fixture.** `emptyAnalystDashboard(window)` lives in the presentation module, like `zeroedReport`. The route tests therefore mock the service with `getAnalystDashboard` alone.
11. **Partial selector.** It applies only to a rendered ready dashboard, after the real reads succeeded. A refusal or a page error returns before any fixture or partial selector is resolved (proved in the component, route and route-authorization tests).
12. **Header module.** `analyst-dashboard-page-header.tsx` is shared by the page, `loading.tsx` and `error.tsx`, following the 07-05 and 07-07 precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A long Risk identifier broke mid-token in the High and Critical widget at 1440.**
- **Found during:** Task 4, visual review of the 1440 capture. `RSK-E2E-P7-RELEASED-001` wrapped as "RSK-E2E-P7-RELEASED-" / "001".
- **Issue:** From `@md` the row used `[minmax(0,1fr)_auto]`. The badge-and-date group took its full width (about 320px) at the end of line 1, leaving the identifier about 160px in a 498px widget.
- **Fix:** `[auto_minmax(0,1fr)]`. The identifier keeps its natural width, and the badge and date wrap at the end of the line, still end-aligned, when it is tight. At 768 everything still sits on one line.
- **Files modified:** `apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx`.
- **Verification:** a new browser check counts each identifier's line boxes. It failed at 1440 before the fix ("Expected: 1. Received: 2") and passes after it; the re-captured 1440 view shows the identifier whole.
- **Committed in:** `7ef2fdc` (fix). The check itself is in `060e4f5`.

### Plan-detail notes

2. **A test defect, caught before any commit.** The first full targeted run failed my own advisory assertion, not the product:
   - It read the whole activity row, whose secondary line carries the fixture request's title: `Expected pattern: not /approved|released/`, `Received string: "ASM-E2E-P7-RELEASED-001draft generated for Security Analyst review16 Sept 2026Risk Assessment · Phase 7 released review request"`.
   - The assertion now requires every generated phrase to read exactly "draft generated for Security Analyst review" (no actor, no other verb).
3. **Files beyond the plan's list:** `analyst-dashboard-page-header.tsx` (Decision 12).
4. **Where the route tests live.** They are in `analyst-dashboard.test.tsx`, beside the component tests, because the plan names no page test file. They use 07-07's `resolveServerTree` seam.
5. **One RED test passed before GREEN.** "Shows a Requestor no Analyst dashboard link, even on /app/review" pins an absence. The five feature tests beside it failed as expected.
6. **Ceiling.** The Phase 7 accessibility test's ceiling rose from 420 s to 480 s for two more surfaces at two widths.
7. **Conformance precondition.** `phase7PopulatedContent` returns one locator, so the `/app/review` branch returns the fourth tile's figure, and the loop adds an explicit count of four.
8. **Proof beyond the behaviour lists:**
   - the page title and a single current navigation item;
   - the `h2` order;
   - the queue select value, and Assessment Requests current on the queue;
   - a Phase 7 fixture Risk among the High and Critical rows, and the closed fixture Risk never listed;
   - a `datetime` on the release row;
   - the exact generated phrases;
   - the one-line identifier check.
9. **URL assertions.** Parameters are checked one by one rather than by exact URL, because the lists own their canonical query order.

**Total deviations:** 9.
- 1 is an auto-fixed bug (Rule 1), proved by a failing browser check first.
- 1 is a test defect fixed before commit.
- 7 are file-list, placement, ceiling or proof notes.

**Impact:** the fix was needed for the High and Critical widget to read correctly at 1440 with real-length identifiers. There is no scope creep, no Strapi change in Tasks 3 and 4, and no contract change.

## Issues Encountered

- **Targeted vitest runs.** `pnpm --filter @csrm/web test -- <patterns>` runs the whole suite, so targeted runs used `pnpm --filter @csrm/web exec vitest run <files>`.
- **Testing Library.** `ByRoleOptions` has no `exact` option, so the typecheck caught one test line; string names already match exactly there.
- **Sequencing.** The Strapi suite's `tsc` writes `apps/strapi/dist`, as the Playwright-run `strapi develop` does, so the suite ran only after the last Playwright run ended.
- **Noise.** New files were written with LF (git warns they become CRLF). pnpm prints an engine warning even with the Node 24 PATH prefix, and Node resolved to v24.19.0 for every run.

## Deferred Issues

- **`next build` was not run.** Production-build verification is deferred to Phase 8, as in 07-05 and 07-07.
- **The shared `AlertRow` at 1440.** In the two-column widgets its identifier line leaves the "Risk · {statement}" text a narrow column, clamped to two lines. This is plan 05's shared row (also in the Treatment performance report), and it was left unchanged here. It is orchestrator backstop 4.
- **Contract-gap notes for plan 09** (already recorded as plan decisions):
  - Widget 3's "Open Risk Register" lists every open Risk, High and Critical first, because the register has no multi-rating filter, so the browser proof checks membership only.
  - Questionnaire submission and `governanceLog` events are not in recent activity, because they have no column-level timestamp and actor.
- **Items recorded by 07-01 to 07-07 are unchanged.**

## Known Stubs

None. Every figure comes from `getDashboardSummary`, `getAlertSummary` or `listAlerts`, and every word from `analyst-dashboard-presentation.ts`. `emptyAnalystDashboard` feeds only the guarded, attested E2E `empty` fixture after a successful read.

## Threat Flags

None beyond the plan's threat model:
- **T-07-08-01:**
  - request activity is limited to the review scope, and releases need the triple;
  - Risk figures use `applyDisclosableParent` plus the open predicate, and the operation requires the insight scope;
  - the mounted exclusions pass in the 349-test suite.
- **T-07-08-02:**
  - the operation is analyst-only;
  - the web route renders the permission state with no read (unit and route-authorization tests, and the browser test for both Requestor identities);
  - actor names reach only the analyst route.
- **T-07-08-03:** reads are bounded at `RECENT_ACTIVITY_LIMIT + 1` per source and `DASHBOARD_WIDGET_ROW_LIMIT + 1` rows; each widget alert page is 5 rows.
- **T-07-08-04:** any query key returns 400; every value is bound, and every order fragment is a constant.
- **T-07-08-05:** `resolveE2eAnalystDashboardPartial` requires the attested runtime (unit tests for a missing harness, a missing attestation, a stale attestation and a nonce mismatch), and the route resolves it only after authorised reads.

## Browser Backstops for the Orchestrator

1. **The dashboard at 768 and 1024.** At 768 the drawer is used; at 1024 the sidebar makes the content narrower than at 768.
   - Tiles sit two by two, and widgets are one column at 768 and two at 1024.
   - The High and Critical rows sit on one line at 768 and stack at 1024.
   - There is no page overflow.
2. **KPI subgrid alignment.** At 768 and 1024 the "Needs attention" supporting line wraps to two lines. Confirm the captions, values and supporting lines of the tile beside it stay on the same lines, as the capture geometry shows.
3. **Widget container rows.** Recent activity spans both columns from `lg`, with its date at the end of each row. Every other widget's rows stack below the `@md` container width (1024) and end-align from it (768, 1440).
4. **The shared alert rows at 1440.** In Treatments due and Top alerts, judge whether the narrow "Risk · {statement}" column beside the identifier reads well enough (Deferred Issues).
5. **Suggested on the dev server.**
   - Hover a queue row, an exposure row and a tile: the row tint, and the tile's hairline and lift.
   - Tab through the page: one stop per tile, row and record link, and the focus ring is never hidden under the header.
   - The partial fixture cannot be shown there: it needs the attested E2E runtime.

## Next Phase Readiness

- **Plan 09:**
  - The dashboard's slice of `analyst-insights.spec.ts` is in place for the cross-screen journey (dashboard, then tile, then list; dashboard, then alert, then source record).
  - `design-contract.spec.ts` still lacks the Alerts entry that 07-05 noted.
  - The contract-gap note should record widget 3's register link and the excluded activity events.
- **Orchestrator:** `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed. DASH-01 is delivered by this plan.

## TDD Gate Compliance

- Every task has a `test(07-08)` RED commit followed by its `feat(07-08)` GREEN commit:
  - Task 1: `e769c9f` then `3aa9a9b`;
  - Task 2: `4d62432` then `21073b4`;
  - Task 3: `05f0e1c` then `b7aea71`.
- Task 4's fix (`7ef2fdc`) was driven by a browser check observed failing first.
- Task 4 is `type="auto"` and ends with `060e4f5`.

## Self-Check: PASSED

- The 17 created files exist and are tracked at HEAD, and `app/(app)/app/review/loading.tsx` does not exist.
- Commits `e769c9f`, `3aa9a9b`, `4d62432`, `21073b4`, `05f0e1c`, `b7aea71`, `7ef2fdc` and `060e4f5` exist on `dev`.
- No tracked file was deleted between `5d67e50` and HEAD.
- The scratch capture spec was removed and never staged.
- `git status` showed only the pre-existing untracked `.planning/debug/` before this summary.
