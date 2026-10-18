---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 07
subsystem: analyst-reports-ui
tags: [nextjs, react, tailwind, container-queries, radix, vitest, testing-library, playwright, axe, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 02)
    provides: the Risk Register state=open filter that every exposure tile opens
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 05)
    provides: KpiTile, KpiTileStrip, KpiTileSkeleton, BarChart (figure-with-table), SegmentedControl, AlertRow, EmptyState kind="cleared", RetryableErrorState, navigationGroups and activeNavigationHref
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 06)
    provides: listReportDefinitions, getReport, reportPeriodSchema, the closed report parsers and the report copy map
provides:
  - /app/reports, the data-driven report index, in the (report-index) route group with its own loading and error boundaries
  - /app/reports/[reportKey], with capability-first generateMetadata, loading, error and not-found boundaries, and the four report views
  - report-presentation.ts, the pure module that words every tile, row, note, month, date and section of a report
  - ReportSection, ReportTable (client) and the report detail frame, layout, skeletons and not-found state
  - the URL-backed Period control, sharing one navigation transition with an aria-busy report body
  - the Reports navigation item, after Alerts in the Reports group
  - the Reports slice of e2e/analyst-insights.spec.ts, the report axe scans and the report routes in the Phase 7 conformance matrix
affects: [07-08, 07-09, analyst-dashboard, e2e-analyst-insights, accessibility, design-system-conformance]

tech-stack:
  added: []
  patterns:
    - "Report words live in one pure module: every caption, description, table row, note, tile and month label comes from report-presentation.ts, and the views only place them."
    - "A report section is a container: chart first, then its table, side by side once the section itself is wide enough; a table-only matrix scrolls in a labelled, focusable region whose first column sticks only where it can overflow."
    - "A route that must not disclose which keys exist resolves the capability before it reads the key, in the page and in generateMetadata, and gives every refused URL the same header, state and title."
    - "URL-backed controls in a page header share one navigation transition with the content they reload, so the old content stays on screen, marked aria-busy, until the new render arrives."
    - "Page tests resolve async server components before rendering, so jsdom sees what the server streams."

key-files:
  created:
    - apps/web/app/(app)/app/reports/(report-index)/page.tsx
    - apps/web/app/(app)/app/reports/(report-index)/loading.tsx
    - apps/web/app/(app)/app/reports/(report-index)/error.tsx
    - apps/web/app/(app)/app/reports/[reportKey]/page.tsx
    - apps/web/app/(app)/app/reports/[reportKey]/loading.tsx
    - apps/web/app/(app)/app/reports/[reportKey]/error.tsx
    - apps/web/app/(app)/app/reports/[reportKey]/not-found.tsx
    - apps/web/src/features/reports/report-presentation.ts
    - apps/web/src/features/reports/report-index.tsx
    - apps/web/src/features/reports/reports-page-header.tsx
    - apps/web/src/features/reports/report-detail.tsx
    - apps/web/src/features/reports/report-section.tsx
    - apps/web/src/features/reports/report-table.tsx
    - apps/web/src/features/reports/report-period-control.tsx
    - apps/web/src/features/reports/risk-exposure-report.tsx
    - apps/web/src/features/reports/treatment-performance-report.tsx
    - apps/web/src/features/reports/assessment-throughput-report.tsx
    - apps/web/src/features/reports/control-effectiveness-report.tsx
    - apps/web/src/features/reports/reports-pages.test.tsx
    - apps/web/src/features/reports/report-views.test.tsx
    - apps/web/src/features/reports/report-presentation.test.ts
  modified:
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/src/components/shell/mobile-navigation.test.tsx
    - apps/web/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
    - apps/web/e2e/analyst-insights.spec.ts
    - apps/web/e2e/accessibility.spec.ts
    - apps/web/e2e/design-system-conformance.spec.ts

key-decisions:
  - "A refused viewer's report key is never read: the capability resolves first in the page and in generateMetadata, every refused URL gets the Reports header, the permission state and the title Reports | IdamBox CSRM, and no breadcrumb or report title renders."
  - "Tiles show the report's own figure (dueState.overdue, byResidualRating.Critical), not the linked list's count, so the tile-to-list browser proofs compare two independently computed predicates."
  - "ReportTable is a client module: tableHeaderMicroClassName lives in the client DataTable module, and a server component cannot read a plain value from a client module."
  - "Report tables sit flush with the section text, use the smaller 4px step between columns below the @md section width, wrap their headers, and draw row hairlines on cells; the cross-tab's sticky first column and its hairline apply only below @2xl, so no vertical rule shows where the matrix fits."
  - "Not rated appears in both rating charts when either has an unrated Risk, so the small multiples always compare row for row on one scale."
  - "A section is empty only when its population is: exposure and treatment sections on no open contextual Risk, the system ranking on no open High or Critical residual Risk, most overdue on none overdue; months never, lifecycle as first-use."
  - "The Period control checks the chosen segment at once through useOptimistic, replaces the URL inside a transition shared with the report body through context, and keeps its width beside the title from md."
  - "The guarded E2E empty fixture renders zeroedReport (the served report with every count at zero, months kept), so each section shows its own empty state."

patterns-established:
  - "Report presentation: asAtLabel, formatReportMonth, throughputRangeLabel, reportKpiTiles, the row builders, exposedSystemsNotes, mostOverdueNote, reportSectionCopy and reportEmptyStates are the only way report copy reaches a screen."
  - "Phase 7 conformance: phase7PopulatedContent(page, route) names the content a route must show before its type scan; plan 08 adds a branch for /app/review."

requirements-completed: [DASH-02]

duration: "56 minutes (17:00:03Z to 17:56:12Z), including three iteration runs of the new browser slice, a 3.2-minute targeted Playwright run and a 7.4-minute Strapi suite"
completed: 2026-09-24
status: complete
actuals:
  tasks: 4
  commits: 8
---

# Phase 7 Plan 07: Report Index, Four Report Screens and the Period Control Summary

**A Security Analyst now opens Reports from the Reports navigation group, after Alerts, and reaches four calm, printable reports from a data-driven index. Each report opens with a breadcrumb, a serif title, a UTC as-at line and a Summary strip of tiles, and every linked tile opens a list whose total equals it. The micro-label sections follow, each chart hidden from assistive technology beside a captioned, scoped table. Assessment throughput switches between six and twelve months with a keyboard-operable Period control that updates the URL, keeps the old report on screen marked busy, and marks the current month partial with a dash, a legend and "(to date)". Requestors and Secondary Requestors see no Reports navigation. Every Reports URL, including an invented key, gives them the same header, state and document title, with no read issued.**

This is plan 7 of 9 (D-35), wave 5. It delivers DASH-02's Reports screens (D-13, D-15 to D-20, D-24, D-25, D-36, D-37) on the plan 05 primitives and the plan 06 contract.

## Performance

- **Duration:** 56 minutes. This includes three iteration runs of `analyst-insights.spec.ts`, two screenshot captures for visual review, the targeted Playwright run (3.2 minutes), the full web suite and the full Strapi suite (7 minutes 24 seconds).
- **Started:** 2026-09-24T17:00:03Z (plan base `6cf6622`)
- **Completed:** 2026-09-24T17:56:12Z
- **Tasks:** 4 of 4
- **Files:** 27 (21 created, 6 modified), plus this summary

## Accomplishments

- **The index (Task 1, D-13, D-15, D-16, UI-D20).**
  - `/app/reports` checks `can('assessment:review')` before `listReportDefinitions`. A Strapi 403 renders the same permission state, and any other failure renders "We couldn’t load reports" with "Try again".
  - It renders one card per served definition, in server order, as a `role="list"` named "Reports". Each card holds:
    - an `h2` link whose box stretches over the card, so the link is its one tab stop;
    - a chevron cue and the description.
  - Hover darkens the hairline to ink and lifts the card. Keyboard focus draws the focus ring around the whole card.
  - An empty list is the cleared "No reports". The guarded E2E fixture resolves only after a successful read.
  - The index lives in `reports/(report-index)/` with its own `loading.tsx` (four card skeletons, "Loading reports") and `error.tsx` (`retry`). No report detail inherits them.
  - The Reports item (`FileChartColumnIcon`) follows Alerts in the Reports group, and `activeNavigationHref` makes it the only current item on `/app/reports/{key}`.
- **The detail frame (Task 2, D-16 to D-19, UI-D15, UI-D19).**
  - `generateMetadata` and the page resolve the capability before they read the key. A refused viewer gets "Reports | IdamBox CSRM", the Reports header and "You don’t have access to reports" for every key. A tracked params promise proves the key is never read.
  - An analyst's unknown key calls `notFound()` before any read. `not-found.tsx` renders "Report not found", "Choose a report from the Reports list." and the outline link "View reports".
  - A valid key renders the reading-width page:
    - the breadcrumb "Reports" › title;
    - the copy-map header;
    - "Computed from current records as at {date}." with `<time dateTime>`;
    - the "Summary" region of tiles;
    - the sections.
  - The page's Suspense fallback is the key's own skeleton. `loading.tsx` draws the Reports root, a title bar and a generic report. `error.tsx` keeps the Reports header.
- **Risk exposure and control effectiveness (Task 2, D-19, D-36, UI-D5, UI-D17).**
  - **Exposure tiles:** "Open contextual Risks", "Critical residual" and "High residual" link to the register with `state=open`.
  - **Inherent and residual rating:** small multiples on one scale, with severity `fg` fills and badge labels, beside one Rating, Inherent, Residual table.
  - **Residual rating by treatment status:** a table only, in the labelled, focusable region "Residual rating by treatment status, scrolls horizontally".
  - **Most exposed Information Systems:** ranked ink bars with plain names, a table, and the truncation and without-system notes.
  - **Control effectiveness:** a plain "Control Implementations" tile and "Rated Ineffective" linked to its alert kind, with two ink sections beside tables.
- **Treatment performance and throughput (Task 3, D-13, UI-D8, X-7).**
  - **Treatment tiles:** "Overdue" links to `/app/alerts?kind=risk-treatment-overdue`. The "Due within {M} days" (from `dueWindowDays`) and "No target date" tiles are plain.
  - **Treatment sections:** ink due-state and treatment-status bars beside tables, and the most overdue treatments as shared `AlertRow`s. "Showing n of total" appears only when truncated, followed by "View overdue treatments".
  - **Throughput tiles:** "Released in period" names its range, for example "April 2026 to September 2026". "Median days to release" names its sample, or shows "Not available" with "No release in this period has a submission date."
  - **Released per month:** columns from `@md` and bars below it. The current month is a dashed outline explained by the "Current month to date" legend and marked "(to date)" in the table. Zero months stay.
  - **Lifecycle:** ink bars in `requestStatuses` order without Draft, beside a table.
  - **The Period control:** a `SegmentedControl` in the header's action slot.
    - It checks the chosen segment at once and replaces the URL with `?period=12` inside a transition shared with the report body. The body is `aria-busy="true"` until the new report renders.
    - The navigation does not remount the control, so focus stays on the checked segment.
- **Browser proof (Task 4, D-24, D-25).** `analyst-insights.spec.ts` gains four tests, and the report routes join the accessibility scans and the Phase 7 conformance matrix. One real defect found on the way was fixed (Deviation 1).

## Task Commits

1. **Task 1 RED: pin the report index states and the Reports navigation item.** `9e1ad65` (test)
2. **Task 1 GREEN: add the data-driven report index and Reports navigation.** `96aeaaa` (feat)
3. **Task 2 RED: pin the report detail frame, secure key handling and two report views.** `1ccd5f6` (test)
4. **Task 2 GREEN: render the report detail frame with exposure and control effectiveness reports.** `a8f91b4` (feat)
5. **Task 3 RED: pin the treatment performance and throughput views and the period control.** `618af2f` (test)
6. **Task 3 GREEN: render treatment performance and throughput reports with a period control.** `c5070c4` (feat)
7. **Task 4 fix: keep the Period control's labels whole beside the report title.** `6e50ca5` (fix). Its browser check failed before the fix.
8. **Task 4: prove the report screens, their tiles and their denial in the browser.** `9971a48` (test)

**Plan metadata:** the `docs(07-07)` commit that carries this summary.

## Files Created/Modified

- **Routes** (`apps/web/app/(app)/app/reports/`):
  - `(report-index)/page.tsx`, `loading.tsx` and `error.tsx`;
  - `[reportKey]/page.tsx`, `loading.tsx`, `error.tsx` and `not-found.tsx`.
- **Reports feature** (`apps/web/src/features/reports/`):
  - `report-presentation.ts`: the pure copy, row, tile, month, note and empty-fixture module.
  - `report-index.tsx` and `reports-page-header.tsx`: the index cards, their skeleton and the shared Reports header.
  - `report-detail.tsx`: the breadcrumb, layout, frame, skeletons, loading page and not-found state.
  - `report-section.tsx`: the section card and its skeleton. `report-table.tsx` is the client table.
  - `report-period-control.tsx`: the transition provider, the busy report body and the Period control.
  - The four views: `risk-exposure-report.tsx`, `treatment-performance-report.tsx`, `assessment-throughput-report.tsx` and `control-effectiveness-report.tsx`.
  - Tests: `reports-pages.test.tsx` (40), `report-views.test.tsx` (24) and `report-presentation.test.ts` (22).
- **Navigation:** `config/navigation/navigation.ts` (the Reports item) and `components/shell/mobile-navigation.test.tsx`.
- **Harness:** `lib/testing/e2e-ui-state-route-authorization.test.tsx` gains the index and detail rows and the Requestor gates.
- **Browser specs:**
  - `e2e/analyst-insights.spec.ts`: four tests and two helpers.
  - `e2e/accessibility.spec.ts`: report scans and the Requestor's report permission renders.
  - `e2e/design-system-conformance.spec.ts`: five routes and `phase7PopulatedContent`.

## Verification

**RED, per task:**

| Check | Result |
| --- | --- |
| Task 1 | 3 files failed: `reports-pages` and route authorization failed to resolve `(report-index)/page`; `mobile-navigation` had 3 failed and 32 passed, all three on the missing Reports item |
| Task 2 | 4 files failed to resolve `./report-presentation`, `./control-effectiveness-report` and `[reportKey]/page` (twice); no test ran |
| Task 3 | 13 failed, 69 passed across 6 files: 9 presentation tests (functions missing) and 4 page period tests. `report-views` failed to resolve `./assessment-throughput-report`. |
| Deviation 1, in the browser | `analyst-insights` had 1 failed and 6 passed: "the 6 months segment shows its whole label at 768px. Expected: true. Received: false" |

At Task 3's RED, "offers no period control, and sends no period, for any other report" already passed. It pins an absence that Task 2's page already satisfied, not the new feature (Deviation 6).

**GREEN and the plan gate:**

| Check | Result |
| --- | --- |
| Task 1 targeted (`reports-pages`, `mobile-navigation`, route authorization) | 72 passed across 3 files; typecheck exit 0 |
| Task 2 targeted (`src/features/reports`, route authorization, navigation) | 134 passed across 7 files; typecheck exit 0 |
| Task 3 targeted (`src/features/reports`, `segmented-control`, route authorization, navigation) | 167 passed across 8 files; typecheck exit 0 |
| `pnpm --filter @csrm/web test` (full) | 738 passed across 66 files, exit 0. This is 643 across 63 at the 07-06 gate, plus 95 new tests: 86 in the three new files, 2 in navigation and 7 in route authorization. |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters`, filtered to the new files | no finding |
| `pnpm --prefix apps/web api:check` | exit 0; `schema.d.ts` unchanged |
| `pnpm --filter @csrm/strapi test` (full, serial) | 335 passed, 0 failed, 0 cancelled, 0 skipped, exit 0 (17:48:32Z to 17:56:00Z). No Strapi code changed. |
| `git diff --name-only 6cf6622 HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| Strapi, `docs/` or specification files changed | none |
| Files deleted across the plan | none |
| Commit messages and added lines scanned for tool, assistant or model names and attribution trailers | none |
| `git status --porcelain -- apps/web/next-env.d.ts apps/web/tsconfig.json` after every Playwright run | empty (restored with `git checkout --` each time) |

**Targeted Playwright run.** The plan names two specs, and the amendment adds two more. Port 1337 was confirmed free first. The run went from 17:44:48Z to 17:48:00Z.

| Spec | Passed | Failed |
| --- | --- | --- |
| `e2e/accessibility.spec.ts` | 5 | 0 |
| `e2e/analyst-insights.spec.ts` | 7 | 0 |
| `e2e/app-shell.spec.ts` | 7 | 0 |
| `e2e/design-system-conformance.spec.ts` | 4 | 0 |
| **Total** | **23** | **0** (no retries, no flaky tests; 3.2 min) |

- Both of the plan's `fails_when` conditions stayed clear:
  - the Critical residual tile equalled its register list, and the Overdue tile equalled its alert list;
  - the Requestor's two report titles were identical.
- The Phase 7 matrix ran all six routes through the type scan, the five states at 375 and 1440 and the Requestor denial in 45.7 s.
- Earlier iteration runs of `analyst-insights.spec.ts` alone:
  - 1 failed and 6 passed (Deviation 4, the key press);
  - 1 failed and 6 passed (Deviation 1, before the fix);
  - 7 passed.

**Visual review.** A scratch spec, never committed and deleted afterwards, captured the index and all four reports at 375, 768, 1024 and 1440. It also captured the twelve-month throughput, the not-found page, the refused Requestor, the four fixture states and a print-media render and PDF of risk exposure. Every capture reported zero page overflow. The review found Deviation 1.

**Acceptance criteria, rerun before this summary:**
- **Task 1.**
  - The three `(report-index)` files exist, and there is no `reports/loading.tsx` or `reports/error.tsx`.
  - `navigation.ts` contains `/app/reports`.
  - The tests pass.
- **Task 2.**
  - `[reportKey]` has `page.tsx`, `loading.tsx`, `error.tsx` and `not-found.tsx`.
  - `page.tsx` contains `generateMetadata`, and `can('assessment:review'` precedes `isReportKey(` (asserted by test).
  - Both views render `figure-with-table` charts beside tables.
  - The new files contain no hex, px, rem or ms literal. The only match is the phrase "4px-scale step" in a comment.
- **Task 3.**
  - `assessment-throughput-report.tsx` names "(to date)" and "Current month to date". The copy itself lives in `report-presentation.ts` (Deviation 9).
  - `report-period-control.tsx` contains `router.replace` and sets `aria-busy`.
- **Task 4.**
  - All targeted specs pass, and the two Next files are restored.
  - The full suites, the typecheck and `api:check` are green.
  - There is no content-type diff and no attribution.

## Orchestrator Amendments Applied

- **Accessibility and conformance land with the screens.**
  - **`accessibility.spec.ts`:** "has no axe violations on phase 07 analyst surfaces" now also scans the following at 1440 and 375:
    - `/app/reports`, after asserting the four card links and no `[data-state-kind="error"]`;
    - each `/app/reports/{key}`, after asserting a visible section table and no error state;
    - the Requestor's permission renders of `/app/reports` and `/app/reports/risk-exposure`.

    Its ceiling is now 420 s.
  - **`design-system-conformance.spec.ts`:** `phase7AuditedRoutes` was extended, not re-created, with `/app/reports` and the four report routes.
    - The type scan's precondition is now `phase7PopulatedContent(page, route)`: a record link on Alerts, a report card link on the index and a section table on each report. It runs before the "no error state" check.
    - The five-state matrix and the Requestor `__e2eState=error` denial run for every route.
    - The test's ceiling rose from 600 s to 900 s (Deviation 7).
- **Assert real content before each scan:** done as above, in both specs.
- **Chart sections only.** Test 1 asserts a visible table in every chart section, and in the table-only cross-tab, by section and table name. The "Most overdue treatments" section is asserted by its `RSK-E2E-P7-*` record link, its shared alert rows and its "View overdue treatments" link.
- **The `signIn` helper:** it already asserted the Dashboard heading (07-05). It is unchanged.
- **The navigation item lands with its route:** in Task 1's GREEN commit, after Alerts, with `FileChartColumnIcon`, as UI-SPEC §1.2 orders it.

## Decisions Made

1. **Key secrecy.**
   - `generateMetadata` and the page share one capability check, which runs before the key is read.
   - A refused viewer gets, for every key:
     - the Reports header ("Reports" and its §7.1 description);
     - the permission state;
     - the title "Reports | IdamBox CSRM";
     - no breadcrumb and no report title.
   - An analyst's unknown key also gets that metadata title, and `notFound()` renders the not-found state.
2. **Tile figures.** "Overdue" shows `dueState.overdue` and "Critical residual" shows `byResidualRating.Critical`: the report's own figures, not the linked list's `mostOverdue.total` or a register count. The browser proofs therefore compare two independently computed predicates, as the plan's `fails_when` intends.
3. **Client table module.**
   - `ReportTable` lives in `report-table.tsx` with `'use client'`, because `tableHeaderMicroClassName` is exported by the client `data-table.tsx`, and a server component cannot read a plain value from a client module.
   - Every prop is plain data. The shadcn `Table` family was already a client module.
4. **Table geometry.**
   - The first column sits flush with the section's text and the last figure with its end.
   - Columns are 8px apart below the `@md` section width and 16px from it, and headers wrap. This keeps every non-matrix table within a 375px section.
   - The tables use the separate border model, with hairlines on cells, so a sticky cell keeps its row line.
   - The cross-tab's sticky first column and its right hairline apply only below `@2xl`, where the matrix can overflow. At 768 to 1440 it fits and shows no vertical rule (direction §4 DataTable: no vertical rules).
5. **Small multiples.** "Not rated" appears in both rating charts when either has an unrated Risk, so the two charts compare row for row on one shared `scaleMax`.
6. **Section emptiness.**
   - **Risk exposure:** the two rating sections are empty on no open contextual Risk. The Information System ranking is empty only on no open High or Critical residual Risk; with such Risks but no ranked system, it shows the note alone.
   - **Treatment performance:** the due-state and status sections are empty only on no open contextual Risk. All-Complete treatments show zero due-state bars rather than a misleading "No open contextual Risks". "Most overdue" is cleared, with no link, when none is overdue.
   - **Throughput:** months never collapse, and the lifecycle section is first-use.
7. **Copy the UI-SPEC left open.**
   - **Section descriptions,** each stating the measure and the population:
     - "Open contextual Risks by inherent and residual rating."
     - "Information Systems carrying the most open High and Critical residual Risks, highest first."
     - "Open contextual Risks whose treatment is not Complete, by target date."
     - "All open contextual Risks, by the treatment status recorded on each Risk."
     - "Open Risks past their treatment target date, oldest target date first."
     - "Control Implementations on open contextual Risks by implementation status." and "… by effectiveness rating."
   - **The cross-tab** keeps the UI-SPEC's added sentences after "Open contextual Risks by residual rating and treatment status."
   - **A capped median sample** reads "Across the {k} most recent releases with a submission date", because the server caps the sample to the newest releases.
   - **Singulars:** "Due within 1 day", "Across 1 release …" and "1 High or Critical residual Risk has no impacted Information System."
8. **Period control.**
   - `ReportTransitionProvider` shares one `useTransition` between the header control and `ReportBody`.
   - `useOptimistic` checks the chosen segment at once, and the URL is written explicitly as `?period=6` or `?period=12`, with `scroll: false`.
   - Next.js 16.3 keys a page segment without its search params, so the navigation reuses the rendered tree. The control keeps focus, and the already-revealed Suspense content stays until the new report arrives. This was verified in the browser.
9. **Guarded empty fixture.** `zeroedReport(report)` keeps the key, the dates, the window, the period and the months, and zeroes every count. Each section then shows its own empty state.
10. **Reading width.** The whole detail (breadcrumb, header and body) is left-aligned in `w-full max-w-container-max`. At 1440 and below the cap has no effect, and every page title keeps its position.
11. **Index semantics.** The card list has an explicit `role="list"` and the name "Reports". Its markers are removed, and some screen readers drop list semantics without the role.
12. **Card focus.** The ring is the card's own outline, `has-focus-visible:outline-2 outline-offset-2 outline-ring`, and the link's own outline is suppressed. An outline rather than a box shadow survives forced-colours mode.
13. **Test seam for pages.** jsdom cannot await a server component, so `reports-pages.test.tsx` resolves async components in the page's tree (`resolveServerTree`) before rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Period control was squeezed below its labels at 768 and 1024.**
- **Found during:** Task 4, visual review of the 768 and 1024 captures ("6 mon" and "12 mo" were clipped, and "12 months" spilled past its pill).
- **Issue:** From `md` the page header is one row. The control's segments are equal `minmax(0, 1fr)` tracks, so its flex item shrank below its content. The overflow check could not see this, because nothing overflowed the page.
- **Fix:** `ReportPeriodControl` passes `className="md:shrink-0"` to the `SegmentedControl` root. The control keeps its width, and the description wraps instead.
- **Files modified:** `apps/web/src/features/reports/report-period-control.tsx`, and `report-views.test.tsx` (a class guard).
- **Verification:** the new browser check, that each segment's `scrollWidth` is at most its `clientWidth` at 768 and 1024, failed before the fix ("the 6 months segment shows its whole label at 768px. Expected: true. Received: false") and passes after it. The re-captured 1024 view shows both labels whole.
- **Committed in:** `6e50ca5` (fix). The browser check itself is in `9971a48`.

### Plan-detail notes

2. **Files beyond the plan's lists.**
   - `reports-page-header.tsx` holds the shared Reports header, following the 07-05 `alerts-page-header.tsx` precedent. The index, both error boundaries and every refused report URL render it.
   - `report-table.tsx` is the client table (Decision 3).
3. **Route-authorization rows for the report detail** were added in Task 2. That file is listed only in Task 1.
4. **The browser keyboard step holds the key.** Radix checks a radio when roving focus lands while an arrow key is still down, and focus moves in a timeout. Playwright's `keyboard.press` releases first, so the first iteration moved focus without checking ("Expected pattern: /[?&]period=12(&|$)/ Received string: …/app/reports/assessment-throughput"). The test now holds ArrowRight until "12 months" is focused, as a physical key press does, and as 07-05's unit test records.
5. **[TDD intermediate] Between `a8f91b4` and `c5070c4`,** treatment performance and throughput rendered only their as-at line and an empty tile strip: `reportKpiTiles` returned no tiles and the section switch returned nothing for them. Task 3's GREEN closed it, and no stub remains.
6. **One RED test passed before its GREEN.** "Offers no period control … for any other report" pins an absence Task 2 already satisfied. The feature tests beside it failed as expected.
7. **The Phase 7 matrix ceiling** rose from 600 s to 900 s for six routes. The run took 45.7 s, so the ceiling is headroom for plan 08's route.
8. **Proof beyond the behaviour lists:**
   - the tracked params promise that proves a refused viewer's key is never read;
   - the Reports group's link order;
   - focus on the checked segment and the body not busy after the change;
   - the sticky first column after a keyboard scroll;
   - the Period labels at 768 and 1024;
   - the "View reports" link's destination.
9. **Acceptance wording.** Task 3 asks `assessment-throughput-report.tsx` to contain "(to date)" and "Current month to date". The copy lives in `report-presentation.ts`, because copy is never assembled in JSX. The view names both in its doc comment and passes them from the copy map, and the view tests assert both rendered strings.

**Total deviations:** 9.
- 1 is an auto-fixed bug (Rule 1), proved by a failing browser check first.
- 3 are file-list or amendment notes.
- 1 records the browser key-press technique, and 1 the TDD intermediate.
- 1 is a RED fact, 1 a ceiling change, and 1 a note on acceptance wording.

**Impact:** the fix was needed for the must-have "keyboard-operable segmented control" to be usable at 768 and 1024. There is no scope creep, no Strapi change and no contract change.

## Issues Encountered

- **Targeted vitest runs.** `pnpm --filter @csrm/web test -- <patterns>` runs the whole suite, so targeted runs used `pnpm --filter @csrm/web exec vitest run <files>`.
- **Async server components in jsdom.** A probe confirmed that React's client renderer never resolves an async component under Suspense: it logs errors and shows the fallback indefinitely. The page tests therefore resolve the tree first (Decision 13).
- **Line endings.** New files were written with LF, and git warns they become CRLF in the working copy (`core.autocrlf=true`). Edited CRLF files kept their endings.
- **pnpm engine warning.** pnpm prints "Unsupported engine … current: v22.19.0" even with the Node 24 PATH prefix. Node resolved to v24.19.0 for every run.

## Deferred Issues

- **`next build` was not run.** Production-build verification is deferred to Phase 8, as in 07-05.
- **Cross-tab discoverability at 375.** The matrix's cut happened to fall on a column boundary, so Complete, Not provided and Total have no visual hint beyond the region itself. Headless Chromium hides scrollbars; a desktop browser shows one, and touch browsers show an overlay while scrolling. The direction's DataTable rule allows a hairline, not a shadow, so no fade was added. Orchestrator backstop 2.
- **An analyst's unknown-key title.** The analyst's document title on an unknown key is "Reports | IdamBox CSRM" in unit tests, but the browser proof asserts only the not-found content.
- **Items recorded by 07-01 to 07-06 are unchanged.**

## Known Stubs

None. Every figure comes from `getReport` or `listReportDefinitions`, and every word from `report-presentation.ts` or the copy map. `zeroedReport` feeds only the guarded, attested E2E `empty` fixture after a successful read.

## Threat Flags

None beyond the plan's threat model:
- **T-07-07-01:**
  - the capability resolves before the key in the page and in `generateMetadata`;
  - a refused viewer's key is never read (unit test);
  - both Requestor identities get one header, state and title for a real and an invented key (browser test).
- **T-07-07-02:** no report read is issued without `assessment:review` (unit tests and the route-authorization Requestor gates). A Strapi 403 renders the permission state.
- **T-07-07-03:** keys are checked by `isReportKey` and the period by `reportPeriodSchema`, which reads anything but 12 as 6. `getReport` validates `{ key, period }` again before any read.
- **T-07-07-04:** the fixture resolves only after a successful read. This is proved by the call order in `reports-pages.test.tsx` and by the route-authorization rows (no fixture on a 403 or at the gate).

## Browser Backstops for the Orchestrator

1. **The reports at 768 and 1024.** At 768 the drawer is used; at 1024 the sidebar makes the content narrower.
   - The Period control sits beside the throughput title with whole labels.
   - The small multiples sit side by side, with each chart above its table.
   - Month columns show from the section's `@md` width.
   - Tiles sit in one row, and there is no page overflow.
2. **The cross-tab region at 375** (`/app/reports/risk-exposure`).
   - Tab to "Residual rating by treatment status, scrolls horizontally" and confirm the focus ring shows.
   - Arrow right and confirm the rating column stays put with its hairline.
   - Judge whether the hidden Complete, Not provided and Total columns are discoverable enough (Deferred Issues).
3. **Print legibility of a report.** Print `/app/reports/risk-exposure` and `/app/reports/assessment-throughput` from the browser.
   - The scratch PDF of risk exposure printed its tables, notes and captions legibly, split across two A4 pages.
   - The app shell (header and navigation) prints too. Print styling is not a deliverable (export is deferred, D-06).
4. **Suggested: the period change on the dev server.** Choose "12 months" with the keyboard.
   - The old report stays visible and marked busy, with no skeleton flash.
   - "12 months" is checked at once and keeps focus.
   - The month table then shows twelve rows ending "(to date)".
5. **Suggested: an index card's focus.** Tab onto a report card and confirm the ring surrounds the whole card, not the title text.

## Next Phase Readiness

- **Plan 08 (analyst dashboard):**
  - Reuse `KpiTile`, `KpiTileStrip`, `BarChart` (`labelled-values`), `AlertRow` and `EmptyState kind="cleared"`. `ReportSection` and `ReportTable` are available if a widget needs a text-equivalent table.
  - Add the Analyst dashboard item above Assessment Requests.
  - Append `/app/review` to `phase7AuditedRoutes` and give `phase7PopulatedContent` a branch for it (the four KPI tiles).
  - Extend "has no axe violations on phase 07 analyst surfaces".
- **Plan 09:**
  - `design-contract.spec.ts` still lacks the Alerts entry that 07-05 noted.
  - The Phase 7 matrix now has a 900 s ceiling.
- **Orchestrator:** `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed. DASH-02 completes with the phase.

## TDD Gate Compliance

- Tasks 1, 2 and 3 each have a `test(07-07)` RED commit followed by its `feat(07-07)` GREEN commit:
  - Task 1: `9e1ad65` then `96aeaaa`;
  - Task 2: `1ccd5f6` then `a8f91b4`;
  - Task 3: `618af2f` then `c5070c4`.
- Task 4's fix (`6e50ca5`) was driven by a browser check observed failing before the fix.
- Task 4 is `type="auto"` and ends with `9971a48`.

## Self-Check: PASSED

- The 21 created files exist and are tracked at HEAD, and there is no `reports/loading.tsx`.
- Commits `9e1ad65`, `96aeaaa`, `1ccd5f6`, `a8f91b4`, `618af2f`, `c5070c4`, `6e50ca5` and `9971a48` exist on `dev`.
- No tracked file was deleted between `6cf6622` and HEAD.
- The scratch screenshot spec was removed and never staged.
- `git status` showed only the pre-existing untracked `.planning/debug/` before this summary.
