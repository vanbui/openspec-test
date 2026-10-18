---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 09
subsystem: phase-7-browser-evidence-and-gate
tags: [playwright, axe, e2e, accessibility, design-contract, design-system-conformance, contract-gaps, phase-gate]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 04)
    provides: the boot-relative Phase 7 fixture (seed-analyst-insights.ts) whose keys the browser proofs duplicate by value
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 05)
    provides: the Alerts slice of analyst-insights.spec.ts with signIn and findAlertRow, the Phase 7 accessibility test and phase7AuditedRoutes with its matrix
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 07)
    provides: the Reports slice, the reports table-section map and the report routes in the Phase 7 scans
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 08)
    provides: the dashboard slice with tileValue and displayedResultTotal, /app/review in the Phase 7 scans, and the attested analyst-top-alerts-error partial selector
  - phase: 07-analyst-dashboard-reports-and-alerts (plans 01 to 08)
    provides: the deviations, deferrals and follow-ups the contract-gap record collects
provides:
  - one cross-screen analyst journey (D-25) - dashboard, Top alerts, every alert, a filtered alert, its source Risk on the analyst route, the Needs attention tile and its equal list, then every report and each of its sections
  - one denial matrix for the Requestor and the Secondary Requestor over five Phase 7 URLs, each requested plainly and with the guarded populated fixture
  - /app/alerts in the cross-surface design contract's collection surfaces
  - the analyst dashboard's Top alerts partial fixture in the conformance dashboard state matrix
  - a proven permission render before every Requestor axe scan, and literal report routes in the accessibility spec
  - docs/contract-gaps/phase-07-derived-insights.md
  - the full Phase 7 gate - Strapi 349/349, web 832/832, typecheck, api:check, Playwright 49/49
affects: [phase-07-verification, phase-07-code-review, phase-8-hardening, contract-gaps]

tech-stack:
  added: []
  patterns:
    - "A journey test owns the walk it proves: a proof that runs in the journey is removed from the slice test that used to carry it, and every moved assertion keeps its message."
    - "A denial matrix requests each protected URL twice, plainly and with the guarded populated fixture, so the absence of a fixture boundary means the fixture resolves only after authorisation."
    - "Every absence assertion in a denial proof uses a selector that the suite proves positive for the analyst elsewhere, so none can pass vacuously."
    - "A Requestor axe scan first proves one main alert with its permission heading, the permission state and no error state."

key-files:
  created:
    - docs/contract-gaps/phase-07-derived-insights.md
  modified:
    - apps/web/e2e/analyst-insights.spec.ts
    - apps/web/e2e/accessibility.spec.ts
    - apps/web/e2e/design-contract.spec.ts
    - apps/web/e2e/design-system-conformance.spec.ts

key-decisions:
  - "The three per-screen Requestor denial tests are folded into one matrix, and the per-report walk moves from the report tile test into the journey, so no proof runs twice. Every moved assertion is kept."
  - "The matrix requests every Phase 7 URL with ?__e2eState=populated as well as plainly, which is what makes its no-fixture-boundary assertion meaningful."
  - "The journey filters Alerts through the real select and waits for the server-rendered Alert type chip before reading rows, because the unfiltered list also holds a row for the same Risk (its Control Implementation alert)."
  - "The partial fixture is its own test in the dashboard state matrix. Its populated-scan precondition is that Top alerts holds the page's only error state and both named siblings show their content."
  - "The contract-gap record lists every place the stored Overdue treatment status is shown as recorded, rather than the plan's 'only in the treatment-status breakdown', which the code contradicts."

patterns-established:
  - "Phase 7 route table: phase7Routes in analyst-insights.spec.ts names each URL's header, UI-SPEC §7.5 permission heading and document title for denial proofs."

requirements-completed: [DASH-01, DASH-02]

duration: "about 35 minutes (19:39:28Z to 20:14Z), including a 4.5-minute isolated pre-gate Playwright run, an 8.7-minute Strapi suite and a 7.2-minute full Playwright suite"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 4
---

# Phase 7 Plan 09: Dual-Actor Browser Evidence, Contract Coverage, the Gap Record and the Phase Gate Summary

**One browser journey now carries a Security Analyst through all of Phase 7:**
- from the analyst dashboard's Top alerts to every alert, a filtered overdue treatment and its source Risk on the analyst route;
- from the Needs attention tile to an alert list whose total equals it;
- through every report and each of its ten sections.

**The rest of the coverage:**
- One denial matrix refuses the Requestor and the Secondary Requestor on every Phase 7 URL, including an invented report key, with and without the guarded fixture.
- Alerts joins the cross-surface design contract, and the analyst dashboard's partial-failure fixture joins the conformance dashboard matrix.
- `docs/contract-gaps/phase-07-derived-insights.md` records every fact the phase could not derive, every accepted divergence and every Phase 8 follow-up.
- The full gate is green: Strapi 349/349, web 832/832, the typecheck, `api:check` and Playwright 49/49.

This is plan 9 of 9 (D-35), wave 7. It closes DASH-01 and DASH-02 with browser evidence (D-16, D-17, D-24, D-25) and the gap record (D-01, D-06, D-27, D-30).

## Performance

- **Duration:** about 35 minutes. That includes:
  - a 4.5-minute isolated pre-gate Playwright run;
  - the full web suite, the typecheck and `api:check`;
  - an 8.7-minute Strapi suite;
  - a 7.2-minute full Playwright suite.
- **Started:** 2026-09-24T19:39:28Z (plan base `2db13a7`)
- **Completed:** 2026-09-24, at the `docs(07-09)` commit that carries this summary
- **Tasks:** 3 of 3
- **Files:** 5 (1 created, 4 modified), plus this summary

## Accomplishments

- **The dual-actor journey (Task 1, D-25).** `analyst-insights.spec.ts` gains "a Security Analyst goes from the dashboard to an alert to its source record, and from a tile to its equal list". It proves, in order:
  - "Analyst dashboard" from the navigation, then Top alerts' "View all alerts" to `/app/alerts` and the Alerts table;
  - "Treatment overdue" chosen in "Filter by alert type" and its chip rendered, then the `RSK-E2E-P7-OVERDUE-001` treatment row found by paging. Its link is `/app/risks/{id}` with no hash, and clicking it lands on that path with the Risk number as the h1;
  - back through the navigation to the dashboard, with four tiles and no error state. The Needs attention figure is read (above zero), then the tile opens `/app/alerts?urgency=attention`. The list's result total equals the figure, and `RSK-E2E-P7-CRITICAL-001` is on the list, marked "Urgency: Needs attention";
  - the Reports group link to the index, then each report opened from its card. Each shows its h1, document title, as-at line, tile count and no error state. Its report-section count equals the declared sections, every table section shows its named table, and "Most overdue treatments" shows alert rows with an `RSK-E2E-P7-*` Risk. The breadcrumb returns to the index.
- **The denial matrix (Task 1, D-16, D-25, UI-SPEC §6.3).** "Requestor and Secondary Requestor see no analyst navigation and are refused every Phase 7 route":
  - For each identity, the navigation has no "Analyst dashboard", "Alerts" or "Reports" link and no "Reports" group.
  - It visits `/app/review`, `/app/alerts`, `/app/reports`, `/app/reports/risk-exposure` and `/app/reports/not-a-report`, each plainly and with `?__e2eState=populated` (20 page loads). Every load shows:
    - the page's h1;
    - exactly one alert in the main region, headed with its §7.5 permission copy and holding "Return to workspace";
    - the route's document title;
    - no table, no result count, no `/app/risks/`, `/app/review/requests/` or `/app/review/assessments/` link, and no "Filter by" control;
    - no KPI tile, dashboard widget or report section, no breadcrumb, no "Risk exposure" title and no `[data-ui-state]` boundary.
- **Contract coverage (Task 2, D-17, UI-SPEC verification contract).**
  - **Design contract:** `design-contract.spec.ts` adds `{ name: 'alerts', route: '/app/alerts', actor: 'Security Analyst' }`. Alerts passed RecordLink parity with the requests reference at 1440 and 375, the desktop table and mobile card list, no placeholder anchors, no overflow, no serious axe violation and no console error. It also passed the shared empty, error and permission headings with "Try again" and "Return to workspace".
  - **Partial fixture:** `design-system-conformance.spec.ts` adds "renders the analyst dashboard Top alerts failure beside intact sibling widgets" to the dashboard state matrix. At 375 and 1440 it asserts:
    - the attested populated boundary;
    - Top alerts' shared error state and no record link there;
    - one error state on the whole page;
    - the Review queue with its six links and Risk exposure with its labelled list;
    - no serious axe violation.
  - **Accessibility:** the Phase 7 scans name the four report routes literally. Each Requestor refusal passes `expectPermissionRender` before its scan.
- **The gap record (Task 3, D-01, D-06, D-27, D-30).** `docs/contract-gaps/phase-07-derived-insights.md` has twelve items, each with its gap, decision and consequences:
  - post-release treatment tracking;
  - the activity events the datamodel does not record, and the seven column-backed events;
  - persisted alerts and acknowledgement;
  - report export;
  - the five unserved operations and the reserved Requestor summary;
  - the stored Overdue status;
  - the single-process generation bucket;
  - the malformed-definition divergence;
  - the PostgreSQL constructs to verify;
  - the widget 3 and widget 4 footers;
  - input reliability;
  - the findings recorded for Phase 8.
- **The full phase gate (Task 3).** It is green, run once after an isolated pre-gate run that found nothing to fix.

## Task Commits

1. **Task 1:** prove the dual-actor analyst journey and every Phase 7 denial in the browser. `c6f5249` (test)
2. **Task 2:** hold every Phase 7 surface to the accessibility, design and five-state contracts. `755114b` (test)
3. **Task 3:** record the facts the analyst insights could not derive and the accepted divergences. `3b80182` (docs)

**Plan metadata:** the `docs(07-09)` commit that carries this summary.

## Files Created/Modified

- `apps/web/e2e/analyst-insights.spec.ts`:
  - the journey and the matrix;
  - `phase7Routes`;
  - `alertSections` beside `tableSections`;
  - the report tile test, renamed and trimmed;
  - three per-screen denial tests removed, because the matrix carries them.
- `apps/web/e2e/accessibility.spec.ts`: `phase7ReportRoutes`, `phase7Refusals` and `expectPermissionRender`.
- `apps/web/e2e/design-contract.spec.ts`: the Alerts surface, and a sign-in helper that asserts the Dashboard heading.
- `apps/web/e2e/design-system-conformance.spec.ts`:
  - the partial fixture test;
  - the explicit single-alert and permission-state checks in the Phase 7 Requestor loop;
  - sign-in helpers that assert the Dashboard heading instead of the URL.
- `docs/contract-gaps/phase-07-derived-insights.md` (new): the Phase 7 contract-gap record.

## Verification

**Acceptance criteria, rerun before this summary.**

- **Task 1.**
  - Both new test titles are in the spec, and "Secondary Requestor" appears 3 times.
  - `signIn` contains no `toHaveURL`.
  - The typecheck exits 0, and `playwright test --list` shows 9 tests, including both new titles.
- **Task 2.**
  - `/app/reports/control-effectiveness` is in `accessibility.spec.ts` (1 match), and `route: '/app/alerts'` is in `design-contract.spec.ts` (1 match).
  - `design-system-conformance.spec.ts` contains `phase7AuditedRoutes` (5 matches) and `analyst-top-alerts-error` (1 match).
  - No sign-in helper in the three specs contains `toHaveURL`.
  - The typecheck exits 0, and the three specs list 12 tests.
- **Task 3.**
  - The record contains "post-release treatment tracking" (1), "single Strapi process" (1), "malformed" (2) and "PostgreSQL" (7).
  - The gate below is green.
  - Both Next files are restored.
  - There is no content-type diff and no attribution.

**Isolated pre-gate run (amendment).** The four named specs ran on their own. Port 1337 was confirmed free first, and the run went from 19:51:02Z to 19:55:33Z.

| Spec | Passed | Failed |
| --- | --- | --- |
| `e2e/accessibility.spec.ts` | 5 | 0 |
| `e2e/analyst-insights.spec.ts` | 9 | 0 |
| `e2e/design-contract.spec.ts` | 2 | 0 |
| `e2e/design-system-conformance.spec.ts` | 5 | 0 |
| **Total** | **21** | **0** (no retries, no flaky tests; 4.5 min) |

It found nothing to fix, so no product or test change followed it. Some timings:
- the journey took 7.4 s and the matrix 4.5 s;
- the Alerts design-contract comparison took 26.0 s, and the partial fixture 2.5 s;
- the Phase 7 conformance matrix took 1.0 min.

**Full phase gate.**

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 349 tests, 349 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo, exit 0 (19:56:04Z to 20:04:52Z; `duration_ms` 524431). No Strapi code changed in this plan. |
| `pnpm --filter @csrm/web test` (full) | 832 passed across 69 files, exit 0 (16.2 s). No web source changed. |
| `pnpm --filter @csrm/web typecheck` (covers `e2e/**`) | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0; `schema.d.ts` unchanged |
| `pnpm --filter @csrm/web test:e2e` (the full suite, once; port 1337 free first) | **49 passed, 0 failed, 0 flaky, 0 skipped** (7.2 min; 20:05:00Z to 20:12:15Z; 1 worker, no retries) |
| `git status --porcelain -- apps/web/next-env.d.ts apps/web/tsconfig.json` after each Playwright run | empty; both restored with `git checkout --` after the listing runs, the pre-gate run and the full run |
| `git diff --name-only eb28084 HEAD -- 'apps/strapi/src/api/*/content-types'` | empty. `eb28084` is the parent of `30c6945`, the first `(07-01)` commit. |
| `cmp` of the two catalogue copies | identical |
| Phase commit messages (`eb28084..HEAD`) and added lines scanned for tool, assistant or model names and attribution trailers | 0 matches for both |
| Files deleted across the plan | none |

The web suite, typecheck and `api:check` ran while the Strapi suite ran; none of them reads `apps/strapi/dist`. The Strapi suite and both Playwright runs never overlapped.

**Full-suite breakdown by spec:**

| Spec | Passed |
| --- | --- |
| `accessibility` | 5 |
| `administration-workflow` | 4 |
| `analyst-insights` | 9 |
| `app-shell` | 7 |
| `assessment-navigation-lifecycle` | 3 |
| `assessment-release-workflow` | 1 |
| `design-contract` | 2 |
| `design-system-conformance` | 5 |
| `questionnaire-generation-workflow` | 1 |
| `questionnaire-governance-workflow` | 1 |
| `questionnaire-workflow` | 1 |
| `request-relationship-states` | 8 |
| `requestor-request-workflow` | 1 |
| `risk-register-workflow` | 1 |
| **Total** | **49** |

That is 12 more than the 37 at the pre-Phase 7 baseline:
- 9 from `analyst-insights`;
- 2 Phase 7 conformance tests;
- 1 Phase 7 accessibility test.

**Why the new absence checks are not vacuous.** The new tests passed on their first run, and no product mutant was run against them. Every selector the matrix asserts absent is proved present for the analyst elsewhere in the same suite:
- `getByRole('table')`;
- the result count, from `displayedResultTotal`;
- the three link prefixes;
- the "Filter by" controls;
- `kpi-tile`, `dashboard-widget` and `report-section`;
- the breadcrumb, in the journey;
- "Risk exposure", as a report title and widget heading;
- `[data-ui-state]`, in the conformance matrix.

## Orchestrator Amendments Applied

- **Isolated pre-gate run.** `accessibility.spec.ts`, `design-system-conformance.spec.ts`, `design-contract.spec.ts` and `analyst-insights.spec.ts` ran on their own first, with 21 of 21 passing. The full suite then ran once, with 49 of 49 passing.
- **Report sections.** The journey asserts:
  - a named table in every table section of every report (the chart sections and the table-only cross-tab);
  - an `RSK-E2E-P7-*` Risk among "Most overdue treatments"' alert rows, in place of a table;
  - that the report-section count equals the declared sections, so no section is skipped.
- **Gap record.** Item 10 records the "Treatments due" footer (widget 4) next to widget 3's "Open Risk Register". Its total covers two alert kinds, and each footer link opens one kind. Each list equals its own part of the summary, and the two parts add up to the widget total. The Alerts URL and filter take one kind at a time.
- **Populated scans.**
  - Every analyst scan still asserts populated content and no `[data-state-kind="error"]` first.
  - Each Requestor scan now proves one main alert with its permission heading, the permission state and no error state.
  - The partial fixture deliberately shows an error state. Its precondition before the axe scan is that Top alerts holds the page's only error state and both named siblings show their content.
  - `signIn` in `accessibility.spec.ts` already asserted the Dashboard heading and role (07-05).

## Decisions Made

1. **No proof runs twice.** The orchestrator asked for coverage to be extended, not duplicated.
   - The matrix replaces the three per-screen denial tests from 07-05, 07-07 and 07-08. Every one of their assertions is kept:
     - the Workspace link;
     - the absent links and group;
     - the h1;
     - the permission copy and "Return to workspace";
     - no table, Risk link, filter, tile, request link or widget;
     - no breadcrumb and no "Risk exposure";
     - the Reports document title for a real and an invented key.
   - The journey takes over the per-report walk from the report tile test: the heading, document title, breadcrumb link, as-at line, tile count, no error state and every section's table. It also takes the "Most overdue treatments" fixture row.
   - That test keeps the navigation group order, the index cards, both tile-to-list equalities, the "View overdue treatments" link and the Period control. It is renamed "analyst reaches the report index from Reports navigation, and report tiles equal the lists they open".
   - `analyst-insights.spec.ts` goes from 10 tests to 9.
2. **Two requests per URL.** The matrix requests every URL with `?__e2eState=populated` as well as plainly. Without the fixture query, "no `[data-ui-state]`" would hold trivially.
3. **Waiting for the filtered render.** After choosing "Treatment overdue", the journey waits for the server-rendered "Remove Alert type filter" chip before it reads rows. The unfiltered list also holds `RSK-E2E-P7-OVERDUE-001`, as its Control Implementation alert. The journey then checks the row's own sentence ("Treatment overdue by n days") and a hash-free href.
4. **Membership and equality only.** Needs attention is asserted above zero, so the equality is not 0 against 0, and the fixture's untreated Critical Risk is asserted present. No global total is asserted (D-24).
5. **Partial fixture placement.** It is a separate test in the dashboard state matrix with its own 300 s ceiling, rather than a third phase of the existing 600 s test.
6. **Gap record content.**
   - Twelve items follow the Gap, Decision and Consequences format.
   - The export item states no reason beyond the phase's own "deferred beyond this milestone"; none is invented.
   - The stored Overdue item lists every place the value is shown as recorded: the Risk Register column and filter, the Risk detail and both report breakdowns. The plan's wording ("only in the treatment-status breakdown") does not match the code.
   - The activity item adds the Phase 06.1 latest-only reversal facts. A return to draft also clears `submittedDate`.
   - The PostgreSQL item lists the concrete constructs from the 07-02, 07-03, 07-04 and 07-06 code and summaries.

## Deviations from Plan

### Auto-fixed Issues

None. The isolated pre-gate run and the full run found no product or test defect.

### Plan-detail notes

1. **[Orchestrator instruction] Consolidation instead of addition.** Decision 1. Three tests were removed and two added in `analyst-insights.spec.ts`. The removed tests' assertions all moved into the matrix or the journey, and none was dropped. Commit `c6f5249`.
2. **[Test-writing rule] Sign-in helpers.** The environment rule says sign-in helpers assert the Dashboard heading and the role, never the URL.
   - The two conformance helpers asserted the URL, and the design-contract helper asserted the role only.
   - All three now assert the Dashboard heading (exact) and the role. The conformance helpers no longer assert the URL.
   - Commit `755114b`.
3. **[Already delivered] Existing Phase 7 coverage.** `phase7AuditedRoutes`, its matrix test and the Phase 7 accessibility test already existed from 07-05, 07-07 and 07-08. They cover seven routes, a superset of the plan's five.
   - They were extended, not re-created.
   - The matrix keeps 07-07's 900 s ceiling rather than the plan's 600 s.
   - Its Requestor loop now asserts exactly one main alert and the permission state. It previously relied on a strict-mode `toBeVisible`.
4. **[Acceptance wording] Literal report routes.** The accessibility spec built report URLs from keys, so the literal `/app/reports/control-effectiveness` the acceptance check looks for was absent. `phase7ReportRoutes` now names the four routes.
5. **[Beyond the behaviour lists] Extra proof.** The journey also proves:
   - the report-section count;
   - the return to the index through the breadcrumb;
   - the Risk detail URL equal to the alert's href;
   - Needs attention above zero;
   - the fixture row's urgency.

   The matrix also proves no result count, filter, tile, widget, section, breadcrumb or report title on every URL for both identities.
6. **[Gap record] Content beyond the plan's eleven items.** Item 12 carries the findings the orchestrator named: `authorization.policy.test.js`, the undeclared `data: null` and the parity guard's register entry. It also carries the stale integrity-script counts, the old duplicate Function rows and the unrun `next build`, each marked for Phase 8.

**Total deviations:** 6, all plan-detail notes. There is no auto-fixed bug, no product change, no Strapi change and no contract change.

**Impact:** Browser coverage of Phase 7 is complete, and nothing is proved twice. The gap record is complete, and the full gate is green.

## Issues Encountered

- **Files that are not this plan's.** Two untracked files appeared during the run: `.planning/phases/07-analyst-dashboard-reports-and-alerts/07-UI-REVIEW.md` and `07-REVIEW.md`. This plan did not create them, and they were never staged. The pre-existing `.planning/debug/` was also left alone.
- **Noise.** pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix, and Node resolved to v24.19.0 for every run. Git warns that LF files become CRLF in the working copy.

## Deferred Issues

- **One inline sign-in check still asserts the URL.** "has no axe violations in the signed-in CSRM shell", the first test in `accessibility.spec.ts`, asserts `toHaveURL(/\/app$/)` after sign-in. Its `toHaveTitle('Dashboard | IdamBox CSRM')` guards it. It is pre-existing and was left unchanged. Sign-in helpers outside the four specs this plan edits were not audited.
- **Everything else is in the gap record.** Every other open item from 07-01 to 07-08 is now recorded in `docs/contract-gaps/phase-07-derived-insights.md` (items 7, 9 and 12 are Phase 8).

## Known Stubs

None. The plan adds tests and a document only.

## Threat Flags

None. The threat model's mitigations are in place:
- **T-07-09-01:** the matrix covers five URLs for two identities, plainly and with the populated fixture. It asserts no table, count, record link, filter, tile, widget, section or fixture boundary.
- **T-07-09-02:** this summary records exact counts for every suite. There was no failure to quote.
- **T-07-09-03:** both Next files were restored after every Playwright invocation, and the `git status --porcelain` check is empty.

## Browser Backstops for the Orchestrator

These are the plan's backstops (UI-SPEC "UI considerations"). None of them is fully provable by the suites.

1. **Overflow.**
   - At 768 and 1024, the Alerts table fits its content column without horizontal scrolling. Condition and Record wrap; Urgency, rating and Date stay on one line.
   - At 375, the risk-exposure cross-tab region "Residual rating by treatment status, scrolls horizontally" is labelled and focusable, and scrolls inside itself while the page does not. The suite proves this at 375; the 768 and 1024 Alerts table is not browser-proven.
2. **Responsive.** Check the §2.6 (dashboard), §3.6 (Alerts) and §4.6 (reports) layout tables at 375, 768, 1024 and 1440. The content column is narrower at 1024 than at 768, because the sidebar appears from `lg`.
3. **Mobile sheet.** At 375×667, as the analyst holding Administration, every navigation item and the "Development role" switcher must be reachable by touch and keyboard. The suite proves scrolling and keyboard focus; touch is not proven.
4. **Print.** A report printed from the browser stays legible, with no hover-only content. Try `/app/reports/risk-exposure` and `/app/reports/assessment-throughput`. The app shell prints too, and print is not a deliverable (gap record item 4).
5. **Deep link.** A Control Implementation alert, from `/app/alerts?kind=control-implementation-overdue`, lands at `#mitigation-controls` below the sticky header. The suite proves it at 1440. Check 375, where the header is `--header-h-sm`.

**Also check:**
- the analyst dashboard answers "what needs me now" at a glance (four tiles first, then the review queue and exposure);
- the console has no errors, read in a fresh tab;
- the development database shows the Phase 7 fixture after a dev Strapi restart (`RSK-E2E-P7-*`, `RAR-E2E-P7-*`, `ASM-E2E-P7-*`);
- **carried from 07-08, now with `2db13a7`:** in the half-width Treatments due and Top alerts widgets at 1440, the record identifier and its "Risk · statement" description now stack. Judge whether the rows read well.

## Next Phase Readiness

- **Phase 7:** all nine plans have summaries. DASH-01 and DASH-02 are proven end to end in the browser for both actors, the gap record is committed, and the full gate is green.
- **Next steps:** the orchestrator's code review, verification, security and UI review, and the browser backstops above.
- **Phase 8 inherits:**
  - PostgreSQL verification (gap record item 9);
  - a shared generation job store (item 7);
  - the findings in item 12;
  - production-build E2E.
- **State files:** `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed.

## TDD Gate Compliance

Not applicable. The plan is `type: execute`, and its three tasks add browser proofs and a document without changing product behaviour. The new browser tests first ran in the isolated pre-gate run and passed on that run. There was no product defect to drive a failing-first test.

## Self-Check: PASSED

- `docs/contract-gaps/phase-07-derived-insights.md` exists and is tracked at HEAD, and the four modified specs are committed.
- Commits `c6f5249`, `755114b` and `3b80182` exist on `dev`.
- No tracked file was deleted between `2db13a7` and HEAD.
- `git status` showed only the untracked `.planning/debug/`, `07-REVIEW.md` and `07-UI-REVIEW.md` (none of them this plan's) before this summary.
