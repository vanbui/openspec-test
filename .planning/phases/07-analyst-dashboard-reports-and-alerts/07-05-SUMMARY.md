---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 05
subsystem: analyst-alerts-ui
tags: [nextjs, react, tailwind, container-queries, radix, vitest, testing-library, playwright, axe, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 02)
    provides: the Risk Register treatmentDueState the overdue marker renders
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 04)
    provides: listAlerts, the closed alert parsers, alertListUrlQuerySchema, the alert vocabularies and the boot-relative Phase 7 fixture
provides:
  - KpiTile, KpiTileStrip, KpiTileSkeleton, BarChart and SegmentedControl in components/csrm, with the chart geometry tokens
  - AlertUrgencyBadge (badge and dense forms), EmptyState kind="cleared" and RetryableErrorState
  - generic navigation groups (Reports, then Administration), activeNavigationHref (one current item), a scrolling navigation sheet and html scroll-padding-top
  - the Alerts screen at /app/alerts with its own loading and error boundaries, gated by assessment:review before any read
  - alert-presentation (pure alert copy, dates and analyst routes), the shared AlertRow (default and agenda variants) and AlertList
  - the Alerts navigation item in the Reports group, the Risk Register dense urgency marker and the #mitigation-controls anchor, which a streamed Risk detail now lands on
  - the first slice of e2e/analyst-insights.spec.ts, the Phase 7 accessibility test and the Phase 7 conformance matrix
affects: [07-06, 07-07, 07-08, 07-09, analyst-dashboard, reports, e2e-analyst-insights, accessibility, design-system-conformance]

tech-stack:
  added: []
  patterns:
    - "Alert words live in one pure module: every sentence, label, date, route and note comes from alert-presentation.ts, and JSX only places them."
    - "A record row reused across surfaces is an @container: it stacks below the @md container size and becomes two end-aligned lines from it, whatever the viewport."
    - "A capability-gated list returns the shared permission state alone (no filters, count, table or record link) for the gate, for a Strapi 403 and for the permission fixture."
    - "A streamed detail page re-applies the URL hash once its content renders, because the router's own hash scroll runs against the loading boundary."
    - "Phase 7 routes join their own conformance matrix (phase7AuditedRoutes) and an analyst axe scan first proves populated content and no error state."

key-files:
  created:
    - apps/web/src/components/csrm/kpi-tile.tsx
    - apps/web/src/components/csrm/bar-chart.tsx
    - apps/web/src/components/csrm/segmented-control.tsx
    - apps/web/src/components/csrm/alert-urgency-badge.tsx
    - apps/web/src/components/states/retryable-error-state.tsx
    - apps/web/src/features/alerts/alert-presentation.ts
    - apps/web/src/features/alerts/alert-row.tsx
    - apps/web/src/features/alerts/alert-list.tsx
    - apps/web/src/features/alerts/alerts-page-header.tsx
    - apps/web/app/(app)/app/alerts/page.tsx
    - apps/web/app/(app)/app/alerts/loading.tsx
    - apps/web/app/(app)/app/alerts/error.tsx
    - apps/web/e2e/analyst-insights.spec.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/src/components/states/states.tsx
    - apps/web/src/config/navigation/navigation.ts
    - apps/web/src/components/shell/capability-navigation.tsx
    - apps/web/src/components/shell/role-switcher.tsx
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-details.tsx
    - apps/web/e2e/accessibility.spec.ts
    - apps/web/e2e/design-system-conformance.spec.ts

key-decisions:
  - "The Alerts URL always carries page and pageSize, so a filter change replaces it with page=1 literally; an out-of-range page moves to the last page, as the register does."
  - "The permission state renders alone: a denied viewer never sees the filters, the result count, the table or a record link, whether the gate, a Strapi 403 or the fixture denied them."
  - "Urgency labels have one source: AlertUrgencyBadge reads alertUrgencyLabels, so the badge, the urgency filter and its chip cannot drift apart."
  - "In a card, a rating shows as its badge; a Risk or Control Implementation with no rating shows Not rated with a hidden 'Residual rating:' prefix; Not applicable shows only in the table, where the column header names it."
  - "The agenda row leads with the date and drops the trailing date line; the condition sentence still says which date it is."
  - "A dated alert that arrives without a day count is worded as its alert type ('Treatment overdue'), never with an invented number."
  - "A streamed Risk detail scrolls the URL's hash target into view once it renders; scroll-padding-top keeps the section below the sticky header."
  - "Each role switcher copy takes its own useId, so the navigation sheet's select is named 'Development role' while the hidden sidebar copy exists."

patterns-established:
  - "Alert presentation: alertConditionSentence, alertDateLabel, formatAlertDate, alertSourceHref, alertSourceSecondaryText, alertResidualDisplay, alertReleasedNote and alertsClearedDescription are the only way alert copy reaches a screen."
  - "Phase 7 browser helpers: signIn asserts the Dashboard heading and the role banner; findAlertRow pages forward until the fixture row appears, so no test depends on a global total."

requirements-completed: [DASH-02]

duration: "about 55 minutes of recorded work: run one committed Tasks 1 and 2 from 15:08:21Z to 15:20:36Z; run two ran from 15:23:46Z to 16:02:50Z, including a 4.6-minute targeted Playwright run and an 8-minute Strapi suite"
completed: 2026-09-24
status: complete
actuals:
  tasks: 4
  commits: 11
---

# Phase 7 Plan 05: Shared Primitives, Navigation and the Alerts Screen Summary

**A Security Analyst now opens Alerts from a new Reports navigation group. The screen lists every derived alert most urgent first, each with an urgency badge, the Risk's residual rating beside it, the condition in words, an analyst record link and its governing date. Released work is marked read-only, and a Control Implementation alert opens its Risk at the Mitigation controls section, below the sticky header. Requestors see no Alerts navigation and get the permission state before any read. The KPI tile, bar chart, segmented control and urgency badge primitives are ready for the reports and the dashboard.**

This is plan 5 of 9 (D-35), wave 4. It delivers DASH-02's Alerts screen (D-10, D-11, D-12, D-15, D-16, D-17, D-27) and the shared primitives (D-18, D-19, D-20) and navigation mechanics (UI-D2, UI-D16) that plans 07 and 08 consume. It ran as two executor runs: Tasks 1 and 2, then Tasks 3 and 4 (plan-check amendment).

## Performance

- **Duration:** about 55 minutes of recorded work across the two runs.
  - Run one committed Tasks 1 and 2 between 15:08:21Z and 15:20:36Z.
  - Run two started at 15:23:46Z and finished at 16:02:50Z. It includes two short iteration runs of the new spec, the 4.6-minute targeted Playwright run, the full web suite and the 8-minute Strapi suite.
- **Started:** 2026-09-24T15:08:21Z (first commit)
- **Completed:** 2026-09-24T16:02:50Z
- **Tasks:** 4 of 4
- **Files:** 35 (21 created, 14 modified), plus this summary

## Accomplishments

- **Primitives (Task 1, D-18, D-19, D-20).**
  - `KpiTile` is a single link named by its caption, value and supporting line, with a trailing chevron. A plain tile is a still block.
    - Zero reads "0", a null value reads "Not available" at body size, and figures are en-AU.
    - `KpiTileStrip` aligns rows on a subgrid, and `KpiTileSkeleton` mirrors the frame.
  - `BarChart` is HTML, with direct labels and square marks, filled with ink or the severity `fg` tokens only.
    - `labelled-values` is a named list with one link per linked row.
    - `figure-with-table` is hidden from assistive technology and cannot link, by type.
    - A partial period is a dashed outline, and there is no motion.
  - `SegmentedControl` is a labelled Radix radio group drawn as a pill group.
  - `globals.css` gains the four §3.14 geometry tokens and their spacing utilities.
- **States and navigation (Task 2, D-11, UI-D2, UI-D12, UI-D16).**
  - `AlertUrgencyBadge` uses the danger, warning and info badges with CalendarX2, CalendarClock and Flag and a hidden "Urgency: " prefix. Its dense form keeps the icon inside the exact label.
  - `EmptyState kind="cleared"` reads "No {noun}" with no action, and `RetryableErrorState` refreshes the route.
  - `activeNavigationHref` marks exactly one item current by longest match. Groups render generically, Reports before Administration, only when they hold a visible item.
  - The navigation sheet scrolls, and `html` has `scroll-padding-top` at both header heights.
- **The Alerts screen (Task 3, D-10 to D-12, D-15 to D-17, D-27).**
  - `/app/alerts` checks `can('assessment:review')` before any read. It parses the URL with `alertListUrlQuerySchema`, calls `listAlerts`, and resolves the E2E fixture only after a successful read.
  - A Strapi 403 renders the permission state, and any other failure renders "We couldn’t load alerts" with "Try again".
  - The route has its own `loading.tsx` (the header plus the DataTable loading layout under disabled filters) and `error.tsx` (`ErrorState` with Next.js 16.3's `retry`).
  - `AlertList` provides:
    - the "Filter by alert type" and "Filter by urgency" selects, with the §3.3 options;
    - the chips "Alert type: {label}" and "Urgency: {label}", and "Clear filters";
    - the §3.4 columns (Urgency, Residual rating, Condition, Record, Date), with wrapping Condition and Record cells and no sortable header;
    - pages of 10, 25 and 50;
    - the cleared empty state ("No alerts" and the server's window) or the filtered empty state;
    - `AlertRow` as the mobile card.
  - `AlertRow` is the shared, server-compatible `@container` row, with a default and an agenda variant. Plans 07 and 08 reuse it.
  - `alert-presentation.ts` words every kind at zero, one and many days, and maps each source type to its analyst route, secondary text, residual display and released note.
  - The Alerts item joins the shipped navigation in the Reports group, immediately before Administration.
  - The Risk Register overdue marker is the dense urgency form (UI-D13), and the Mitigation controls section has `id="mitigation-controls"`.
- **Browser proof (Task 4).**
  - `e2e/analyst-insights.spec.ts` proves:
    - the Alerts slice for the analyst, with fixture membership and no global total;
    - the refusal of both Requestor identities;
    - the scrolling navigation sheet at 375×667.
  - The accessibility spec scans `/app/alerts` for the analyst and the Requestor at 1440 and 375, after proving populated content.
  - The conformance spec's new Phase 7 matrix covers the type scan, all five states and the Requestor denial for `/app/alerts`.
  - Two real defects found on the way were fixed (Deviations 1 and 2).

## Task Commits

1. **Task 1 RED: pin the KPI tile, bar chart and segmented control contracts.** `95dec73` (test)
2. **Task 1 GREEN: add the KPI tile, bar chart and segmented control primitives.** `db6ed0e` (feat)
3. **Task 2 RED: pin the urgency badge, cleared state and single current navigation item.** `ef5d467` (test)
4. **Task 2 GREEN: add urgency badges, the cleared empty state and a single current navigation item.** `b352f39` (feat)
5. **Task 3 RED: pin the Alerts screen, its copy and its denial before any read.** `b62af75` (test)
6. **Task 3 GREEN: add the Alerts screen with actor-correct source links and released markers.** `1b8320b` (feat)
7. **Task 4 fix: name the navigation sheet's role switcher with its own label.** `96ff22f` (fix; its test failed before the fix)
8. **Task 4 fix: open a Risk at the section its link names once the detail renders.** `a3d8f5c` (fix; its test failed before the fix)
9. **Task 4: prove the Alerts screen, its denial and the scrolling navigation in the browser.** `4e93440` (test)

**Plan metadata:** `724fe12` carries this summary, and a second `docs(07-05)` commit corrects its file and commit counts.

## Files Created/Modified

- **Primitives (Tasks 1 and 2).**
  - `components/csrm/kpi-tile.tsx`, `bar-chart.tsx`, `segmented-control.tsx` and `alert-urgency-badge.tsx`, each with its own test file.
  - `components/states/retryable-error-state.tsx` (new), and `states.tsx` with `states.test.tsx`.
  - `app/globals.css`: the chart geometry tokens and mappings, the scrolling `.sheet-content`, and `scroll-padding-top`.
- **Navigation.**
  - `config/navigation/navigation.ts`: `navigationGroups`, `NavigationGroup` and `activeNavigationHref` in Task 2; the Alerts item in Task 3.
  - `components/shell/capability-navigation.tsx`: generic groups and a single current item.
  - `components/shell/mobile-navigation.test.tsx`.
  - `components/shell/role-switcher.tsx` and a new `role-switcher.test.tsx`: its own id per copy.
- **Alerts.**
  - `features/alerts/alert-presentation.ts`, `alert-row.tsx`, `alert-list.tsx` and `alerts-page-header.tsx` (all new).
  - Tests: `alert-presentation.test.ts`, `alert-list.test.tsx` and `alerts-page.test.tsx`.
  - `app/(app)/app/alerts/page.tsx`, `loading.tsx` and `error.tsx`.
  - `lib/testing/e2e-ui-state-route-authorization.test.tsx`: the Alerts rows and the Requestor gate.
- **Risk surfaces.**
  - `features/risks/risk-register.tsx`: the dense urgency marker.
  - `features/risks/risk-details.tsx`: the anchor and the hash scroll once the Risk renders.
  - Both test files.
- **Browser specs.**
  - `e2e/analyst-insights.spec.ts` (new).
  - `e2e/accessibility.spec.ts`: the upgraded `signIn`, a `beforeScan` hook and the Phase 7 test.
  - `e2e/design-system-conformance.spec.ts`: `phase7AuditedRoutes`, a shared `typographyViolations` helper and the Phase 7 matrix.

All paths are under `apps/web/`.

## Verification

**RED, per task (run two):**

| Check | Result |
| --- | --- |
| Task 3: the four new or extended alert files | 4 files failed to resolve `./alert-list`, `./alert-presentation` and `app/(app)/app/alerts/page` |
| Task 3: navigation, Risk detail and Risk Register extensions | 5 failed, 46 passed across 3 files: 3 shipped-Alerts navigation tests, the anchor id (`_r_b_-heading` received) and the marker colour |
| Deviation 1: `role-switcher.test.tsx` | 1 failed: "Unable to find an accessible element with the role combobox and name Development role" |
| Deviation 2: the Risk detail hash test | 1 failed, 8 passed: "expected [] to deeply equal [ <h2 …(2)></h2> ]" |
| Deviation 2 in the browser, first iteration run | `analyst-insights` 1 failed, 2 passed: "the deep link lands on the Mitigation controls section … toBeInViewport() failed … Received: viewport ratio 0" |

Tasks 1 and 2 were verified by run one. Their test files pass in this run (below).

**GREEN and the plan gate:**

| Check | Result |
| --- | --- |
| Task 3 targeted (`src/features/alerts`, route authorization, Risk Register, Risk detail, navigation, urgency badge) | 161 passed across 10 files |
| Task 1 files (kpi-tile, bar-chart, segmented-control), rerun at the gate | 38 passed across 3 files |
| Task 2 files (alert-urgency-badge, states, mobile-navigation), rerun at the gate | 48 passed across 3 files (mobile-navigation now includes Task 3's shipped-Alerts tests) |
| Task 3 and 4 files (alert-presentation, alert-list, alerts-page, route authorization, risk-register, risk-details, role-switcher) | 112 passed across 7 files |
| `pnpm --filter @csrm/web test` (full) | 623 passed across 61 files, exit 0. This is 465 across 53 at the 07-04 gate, plus 158 new tests in 8 new test files and 5 extended ones. |
| `pnpm --filter @csrm/web typecheck` (it covers `e2e/**`) | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0 |
| `pnpm --filter @csrm/strapi test` (full, serial) | 321 passed, 0 failed, 0 cancelled, 0 skipped, exit 0 (15:54:09Z to 16:02:18Z, 8 min 4 s). No Strapi code changed in this plan. |
| `git diff --name-only fb706ca HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| Files deleted between `fb706ca` and HEAD | none |
| Commit messages and added lines scanned for tool, assistant or model names and attribution trailers | none |
| `git status --porcelain -- apps/web/next-env.d.ts apps/web/tsconfig.json` after every Playwright run | empty (restored with `git checkout --` each time) |

**Targeted Playwright run** (the plan's five specs plus the amendment's five; port 1337 confirmed free first; 15:49:01Z to 15:53:37Z):

| Spec | Passed | Failed |
| --- | --- | --- |
| `e2e/accessibility.spec.ts` | 5 | 0 |
| `e2e/analyst-insights.spec.ts` | 3 | 0 |
| `e2e/app-shell.spec.ts` | 7 | 0 |
| `e2e/assessment-navigation-lifecycle.spec.ts` | 3 | 0 |
| `e2e/assessment-release-workflow.spec.ts` | 1 | 0 |
| `e2e/design-contract.spec.ts` | 2 | 0 |
| `e2e/design-system-conformance.spec.ts` | 4 | 0 |
| `e2e/questionnaire-governance-workflow.spec.ts` | 1 | 0 |
| `e2e/requestor-request-workflow.spec.ts` | 1 | 0 |
| `e2e/risk-register-workflow.spec.ts` | 1 | 0 |
| **Total** | **28** | **0** (no retries, no flaky tests; 4.6 min) |

- `risk-register-workflow.spec.ts` passed its "Overdue treatment includes its warning icon" check (exact "Overdue" with one `svg`) and its total-versus-rows proof. Both of the plan's `fails_when` conditions stayed clear.
- Two earlier iteration runs of `analyst-insights.spec.ts` alone: 1 failed and 2 passed (Deviation 2), then 3 passed after the fix.

**Acceptance criteria, rerun before this summary:**
- **Task 1.**
  - All four chart tokens are in `globals.css`.
  - The three primitives contain no hex literal.
- **Task 2.**
  - `navigation.ts` exports `activeNavigationHref` and `navigationGroups`, and contains `/app/alerts`.
  - `capability-navigation.tsx` has no hard-coded `'Administration'`.
  - `.sheet-content` has `overflow-y: auto`, and `html` has `scroll-padding-top`.
- **Task 3.**
  - The three route files exist, and `error.tsx` passes `retry={retry}`.
  - `alert-presentation.ts` contains "Released · read-only" and `#mitigation-controls`.
  - `risk-details.tsx` contains `headingId="mitigation-controls"`.
  - `risk-register.tsx` uses `AlertUrgencyBadge`. `AlertTriangle` remains only for the stored "Overdue" treatment status badge, not for the target date.
  - The new alert files and route files contain no hex, px or rem literal.
- **Task 4.** All ten targeted specs pass, the two Next files are restored, the full suites are green, there is no content-type diff and there is no attribution.

## Orchestrator Amendments Applied

- **Accessibility and conformance land with the screen.**
  - **`accessibility.spec.ts`:**
    - `signIn` now asserts `getByRole('heading', { level: 1, name: 'Dashboard', exact: true })` before the role banner, once, for every test in the file.
    - `expectAccessibleAtBothWidths` gained an optional `beforeScan(width)` hook, called at each width after the page settles and before axe runs.
    - The new test "has no axe violations on phase 07 analyst surfaces" scans `/app/alerts?kind=risk-treatment-overdue&pageSize=50` at 1440 and 375. Before each scan it asserts the visible fixture link `RSK-E2E-P7-OVERDUE-001` and no `[data-state-kind="error"]`.
    - It then scans the Requestor's permission render of `/app/alerts` at both widths, after asserting the permission alert.
  - **`design-system-conformance.spec.ts`:**
    - `phase7AuditedRoutes = ['/app/alerts']`, and a separate test "Phase 7 audited route state, type, and authorization matrix" with its own 600 s ceiling.
    - The test runs the type scan at 375 and 1440, after asserting a visible record link and no error state. It then runs `expectStateMeaning` for all five states at both widths, and the Requestor `__e2eState=error` denial (no boundary, one `main` alert, no table, no analyst record link).
    - The type scan moved into a shared `typographyViolations(page)` helper, which the Phase 6 matrix now calls unchanged.
- **The `/app/alerts` item lands with its route.** The item was added to `navigation.ts` in Task 3's GREEN commit. `mobile-navigation.test.tsx` gained four tests against the shipped `navigation` list:
  - the exact item, immediately before Administration;
  - the analyst's Reports group, with Alerts alone current on `/app/alerts`;
  - the Requestor seeing neither the group nor the link;
  - Alerts in the Reports group of the mobile sheet.
  Task 2's test-local Phase 7 items remain, and still prove the group mechanics for the dashboard and Reports items that plans 07 and 08 add.
- **The wider targeted run** included `assessment-release-workflow`, `questionnaire-governance-workflow` and `design-contract`, plus `accessibility` and `design-system-conformance`, as the first amendment requires. All passed (table above).
- **Two executor runs.** Run one committed Tasks 1 and 2 with their tests green. This run (Tasks 3 and 4) did not change Tasks 1 and 2's work, except for the one-line label source in `alert-urgency-badge.tsx` (Decision 3).

## Decisions Made

1. **Canonical Alerts URL.**
   - The screen always writes `page` and `pageSize` after the optional `kind` and `urgency`. A filter, chip or page-size change therefore replaces the URL with `page=1` literally, as the behaviour list says.
   - An out-of-range page shows the loading layout and replaces the URL with the last page, as the register does.
2. **Denial shows nothing but the permission state.**
   - `AlertList` returns `PermissionDeniedState area="alerts"` alone for `state="permission"`, and the route renders the same component for the gate and for a 403.
   - A denied viewer therefore sees no filters, no "0 results", no table and no record link (§6.3).
3. **One source for the urgency words.**
   - `alertUrgencyLabels` lives in `alert-presentation.ts`, and `AlertUrgencyBadge` reads it. The badge, the urgency filter and its chip cannot disagree.
   - Task 2's badge tests pass unchanged.
4. **Residual rating in cards.**
   - The table shows the rating badge, "Not rated" or "Not applicable" under its column header.
   - A card has no header, so the row shows:
     - the badge when the Risk is rated;
     - "Not rated" with a visually hidden "Residual rating: " prefix for an unrated Risk or Control Implementation;
     - nothing for a request or assessment. "Not applicable" alone would not say what is not applicable.
5. **Agenda variant.** The date (`<time>`, `text-sm font-medium tabular-nums`) replaces the urgency badge as the first element, and the trailing date line is dropped so the date is not repeated. The residual badge stays for Risk sources. Plan 08's "Upcoming due dates" widget consumes it.
6. **Row order.**
   - `AlertRow` keeps the badges first in the DOM in every layout, so assistive technology hears the urgency first, which is the triage order.
   - From the `@md` container size, grid placement puts them at the end of the first line.
   - The record identifier is the row's only focusable element, so focus order is unaffected.
7. **Table fit.**
   - The Condition and Record content opts into `whitespace-normal`, as §3.4 requires.
   - The Record wrapper is capped at `max-w-80` (a spacing-scale utility), so a long Risk statement cannot starve the Condition column at 768 and 1024.
   - The statement stays whole in the DOM, clamped to one line in the table and two in cards.
8. **Touch height for the filters.** Below `md` the two selects are `h-11`, and from `md` they are the house `h-9` (§8 Targets). The widths follow §3.6: full width and stacked at 375, side by side from `sm`.
9. **Missing day count.** A dated kind with a null `dayOffset` reads as its alert type ("Treatment overdue", "Risk Assessment review due"). No number is invented. `assessment-review-due` follows the server's urgency, not the sign of the offset.
10. **Density key.** The alerts table persists density under `analyst-alerts`, which the loading layout also uses. Loaded and loading layouts therefore match.
11. **Page header.** The header lives in `alerts-page-header.tsx`, a server-compatible component the page, `loading.tsx` and `error.tsx` all render. The §7.1 description is written once.
12. **Loading boundary.** `AlertListLoading` reads the current URL with `useSearchParams`, as `RiskRegisterLoading` does, so the disabled filters show the values being loaded. The E2E loading fixture renders the same list in its loading state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The navigation sheet's role switcher had no accessible name.**
- **Found during:** Task 4, while writing the 375×667 sheet proof.
- **Issue:** The shell renders `RoleSwitcher` twice: in the sidebar, which is `display: none` below 1024px but still in the DOM, and in the navigation sheet. Both used `id="development-role"`. The sheet's `<label for>` therefore resolved to the hidden sidebar select, and the visible select was unnamed. It also duplicated an id.
- **Fix:** Each copy takes its own `useId()` for the label and the select. The id is hydration-stable, and no code or test referenced the old id.
- **Files modified:** `apps/web/src/components/shell/role-switcher.tsx` and the new `role-switcher.test.tsx`.
- **Verification:** the unit test failed before the fix (no combobox named "Development role") and passes after it. The browser proof finds `sheet.getByRole('combobox', { name: 'Development role' })`, focuses it, and passes at 375×667.
- **Committed in:** `96ff22f`.

**2. [Rule 1 - Bug] A Control Implementation alert did not land on Mitigation controls.**
- **Found during:** Task 4, first iteration run of `analyst-insights.spec.ts` ("viewport ratio 0").
- **Issue:** `/app/risks/[documentId]` streams behind its `loading.tsx` and its Suspense boundary. The router's hash scroll runs when the segment first commits, against the skeleton, so the page stayed at the top. The plan's must-have ("opens its Risk at the Mitigation controls section") was not met.
- **Fix:** Once the ready Risk is on screen, `RiskDetails` scrolls the element the URL's hash names into view. It ignores an absent hash, an unknown id and a malformed escape, and never scrolls in a safe state. `html` `scroll-padding-top` keeps the section below the sticky header.
- **Files modified:** `apps/web/src/features/risks/risk-details.tsx` and `risk-details.test.tsx`.
- **Verification:** the unit test failed before the fix and passes after it. In the browser the heading is in the viewport, and its top is at or below the banner's bottom (tolerance 1px), in both the iteration run and the targeted run.
- **Committed in:** `a3d8f5c`.

**3. [Amendment] Files outside the task file lists.** The amendments required these files, which the tasks do not list:
- `mobile-navigation.test.tsx` in Task 3, for the shipped Alerts item;
- `accessibility.spec.ts` and `design-system-conformance.spec.ts` in Task 4.

**4. [Plan detail] New or touched files beyond the lists.**
- `apps/web/src/features/alerts/alerts-page-header.tsx` (new, Decision 11).
- `apps/web/src/components/csrm/alert-urgency-badge.tsx` in Task 3 (the label source, Decision 3).

**5. [Plan detail] How the browser proof reads urgency.**
- Playwright's exact text match compares an element's whole text. The badge's hidden prefix sits inside the badge, so no element's whole text is "Overdue".
- The proof therefore asserts that `[data-slot="badge"][data-urgency="overdue"]` has the text "Urgency: Overdue", which is the urgency text "Overdue" with its accessible prefix.
- The dense marker, whose exact-text contract the register spec needs, is unchanged.

**6. [Plan detail] A stronger landing check.** Besides "not above the sticky header's bottom", the proof asserts that the Mitigation controls heading is in the viewport. That stronger assertion is what exposed Deviation 2.

**7. [Run one] The segmented-control arrow-key test.** Run one's GREEN commit (`db6ed0e`) records that the arrow-key test now holds the key until roving focus moves, then releases it, as a physical key press does. This run changed nothing there.

**Total deviations:** 7.
- 2 are auto-fixed bugs (Rule 1), each proven by a failing test first.
- 2 are amendment or file-list notes, and 2 are plan-detail refinements of the browser proof.
- 1 records a test adjustment from run one.

**Impact:** both fixes were needed for the plan's must-haves (a reachable, named role switcher in the sheet; an alert that opens its Risk at the Mitigation controls section). There is no scope creep and no Strapi change.

## Issues Encountered

- **Targeted vitest runs.** The plan's verify commands pass patterns after `--`, which the web script ignores. Targeted runs used `pnpm --filter @csrm/web exec vitest run <files>`, as run one did.
- **Line endings.** New files were written with LF, and git warns they become CRLF in the working copy (`core.autocrlf=true`). Edited CRLF files kept their endings. `api:check` shows no content diff.
- **pnpm engine warning.** pnpm prints "Unsupported engine … current: v22.19.0" even with the Node 24 PATH prefix. Node resolved to v24.19.0 for every run.
- **The first monitor filter missed per-test lines.** Playwright pads the test number once a run has ten or more tests (`ok  1`). The filter was widened. No result was affected.

## Deferred Issues

- **`next build` was not run.** `AlertListLoading` reads `useSearchParams` in `loading.tsx` and in the page's Suspense fallback, exactly as `RiskRegisterLoading` does. Production-build verification is deferred to Phase 8 with the rest of the build checks.
- **"0 results" beside an error state.** The shared `DataTable` shows its result count in the error state on every list, including Alerts. That is pre-existing house behaviour, left unchanged.
- **Items recorded by 07-01 to 07-04 are unchanged.**

## Known Stubs

None. Every value the Alerts screen renders comes from `listAlerts` or from the pure presentation module. The primitives are wired: `AlertUrgencyBadge` in Alerts and the Risk Register, `EmptyState kind="cleared"` in Alerts. `KpiTile`, `BarChart` and `SegmentedControl` are tested and wait for plans 07 and 08, as planned (D-20).

## Threat Flags

None beyond the plan's threat model:
- **T-07-05-01:** the gate precedes the read. This is proven in unit tests (the Requestor sees only `capability:assessment:review`, with no read and no fixture) and in the browser for both Requestor identities (no navigation, permission state, no table, no Risk link). A Strapi 403 renders the same state.
- **T-07-05-02:** `alertListUrlQuerySchema` maps unknown values to "all" and to the default page size (unit-tested with `not-a-kind`, `eventually`, `-4` and `7`).
- **T-07-05-03:** every href comes from `alertSourceHref`, which is tested per source type with escaped ids. Only analyst routes are used.
- **T-07-05-04:** the fixture resolves only after a successful read. This is proven in `alerts-page.test.tsx` (`capability`, `alerts`, `fixture`, in that order) and in the route-authorization table (no fixture on a 403 or at the gate).

The hash scroll (Deviation 2) reads only `location.hash` and calls `scrollIntoView` on an element the page itself rendered. It adds no new surface.

## Browser Backstops for the Orchestrator

1. **Alerts table at 768 and 1024.**
   - Open `/app/alerts` (unfiltered and `?kind=control-implementation-overdue`).
   - Confirm the five columns fit without horizontal scrolling inside the table, and that Condition and Record wrap.
   - Confirm Urgency, rating and Date stay on one line, and there is no page overflow. At 1024 the sidebar makes the content column narrower than at 768.
2. **The navigation sheet at 375×667.** Open "Open navigation" as the analyst. Scroll to the last Administration item and to the Development role select. Confirm each is reachable by touch and keyboard, and that the page behind does not scroll.
3. **`#mitigation-controls` landing.** From `/app/alerts?kind=control-implementation-overdue`, open the fixture row. Confirm the page lands with the "Mitigation controls" heading just below the sticky header at 1440 and at 375, where the header is `--header-h-sm`.
4. **Suggested:** the agenda and default `AlertRow` at a wide container (from `@md`), which only the dashboard (plan 08) will exercise in the browser.

## Next Phase Readiness

- **Plan 06 (reports server):** nothing new is needed from this plan.
- **Plan 07 (Reports screens):**
  - Use `KpiTile` and `KpiTileStrip`, `BarChart` (`figure-with-table`, `scaleMax` for the small multiples) and `SegmentedControl`.
  - Use `AlertRow` for "Most overdue treatments".
  - Add the Reports item (`FileChartColumnIcon`, group `'Reports'`) after Alerts in `navigation.ts`.
  - Append your routes to `phase7AuditedRoutes`, and extend "has no axe violations on phase 07 analyst surfaces".
- **Plan 08 (analyst dashboard):**
  - Use `AlertRow` (default and `variant="agenda"`), `KpiTile`, `BarChart` (`labelled-values`) and `EmptyState kind="cleared"`.
  - Use `RetryableErrorState` for widget failures.
  - Add the Analyst dashboard item (`ActivityIcon`) above Assessment Requests. `activeNavigationHref` already keeps `/app/review/requests/{id}` on Assessment Requests.
  - Extend the same two e2e lists.
- **Plan 09:**
  - `phase7AuditedRoutes` and its matrix test already exist. Extend them rather than create them, and add the `analyst-top-alerts-error` partial to the dashboard matrix.
  - `design-contract.spec.ts` still needs `{ name: 'alerts', route: '/app/alerts', actor: 'Security Analyst' }` in `collectionSurfaces`. The screen already uses `DataTable`, `RecordLink` and the shared state primitives.
- **Orchestrator:** `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed. DASH-02 completes with the phase.

## TDD Gate Compliance

- Tasks 1, 2 and 3 each have a `test(07-05)` RED commit followed by its `feat(07-05)` GREEN commit:
  - Task 1: `95dec73` then `db6ed0e`;
  - Task 2: `ef5d467` then `b352f39`;
  - Task 3: `b62af75` then `1b8320b`.
- Each of Task 4's fixes (`96ff22f`, `a3d8f5c`) was driven by a test observed failing before the fix. Test and fix share one `fix(07-05)` commit.
- Task 4 is `type="auto"` and ends with `4e93440`.

## Self-Check: PASSED

- The 13 key created files exist and are tracked at HEAD:
  - `kpi-tile.tsx`, `bar-chart.tsx`, `segmented-control.tsx`, `alert-urgency-badge.tsx` and `retryable-error-state.tsx`;
  - `alert-presentation.ts`, `alert-row.tsx`, `alert-list.tsx` and `alerts-page-header.tsx`;
  - the three `alerts` route files and `e2e/analyst-insights.spec.ts`.
- Commits `95dec73`, `db6ed0e`, `ef5d467`, `b352f39`, `b62af75`, `1b8320b`, `96ff22f`, `a3d8f5c` and `4e93440` exist on `dev`.
- No tracked file was deleted between `fb706ca` and HEAD.
- `git status` showed only the pre-existing untracked `.planning/debug/` before this summary.
