---
phase: 11-navigation-landing-and-list-clarity
plan: 21
subsystem: testing
tags: [phase-gate, vitest, node-test, playwright, axe, static-checks]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: plans 11-01 to 11-20 (sectioned sidebar, both Homes, list clarity, quick find)
provides:
  - "The Phase 11 gate on the production build: api:check, typecheck, lint, web 3,280/3,280, Strapi 704/704, Playwright 156/156 (desktop 131, mobile 25, 0 flaky)"
  - "The D-01/D-02 static checks against PHASE_11_BASE=9f95575, all clean"
  - "The pilot's browser walk of the Requestor, the Secondary Requestor and the Security Analyst at 375 and 1440, approved 2026-10-04 and recorded verbatim: backstops B1 to B3 pass, W1 to W26 pass, W27 (the UAT baselines) pending"
  - "Five walk fixes, each test-first in its own commit: 08d850f, cea169e, 601d2e3, 3117ba9 and 82d2b20"
  - "Coverage of UX-07, UX-08, UX-09, UX-10 and DASH-03, the six ROADMAP success criteria and the nine findings, each mapped to plans and to test labels found in the test source"
  - "The Manual-Only results (two pass, three pending for the operator's UAT) and the notes for the orchestrator"
affects: [phase 11 code review and regression gates, phase 11 verification and final gate, Phase 20 (the G-16 switch point), Phase 21 fresh plan check (the Reports description)]

tech-stack:
  added: []
  patterns:
    - "Gate record committed before the clean-tree check (D-58, G-6)"

key-files:
  created:
    - .planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-21-SUMMARY.md
  modified:
    - apps/csrm/src/features/alerts/alert-schema.ts
    - apps/csrm/src/features/alerts/alert-schema.test.ts
    - apps/csrm/src/features/alerts/alerts-page.test.tsx
    - apps/csrm/src/features/reports/reports-page-header.tsx
    - apps/csrm/src/features/reports/reports-pages.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/app/globals.css
    - apps/csrm/src/components/shell/capability-navigation.tsx
    - apps/csrm/src/components/shell/mobile-navigation.test.tsx
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/requests/request-table.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-list.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review-list.tsx
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/components/csrm/data-table.test.tsx
    - apps/csrm/e2e/accessibility.spec.ts

key-decisions:
  - "The gate ran as the plan's chain step by step, with the Strapi suite and Playwright in the background, every figure taken from this one run at 9702d70"
  - "11-21 Task 2: the walk's five defects were fixed inside this plan, each test-first in its own fix(11-21) commit, before the pilot approved the walk; the gate figures predate them, and the pilot re-runs the full gate after them and records the result"
  - "11-21 Task 3: requirements-completed lists all five requirements; the Manual-Only items the walk could not run (NVDA, ⌘K on macOS Safari and Firefox, the UAT-A, UAT-B and UAT-C baselines) stay pending for the operator's UAT and are not recorded as passes"
  - "11-21 Task 3: the browser checks are the pilot's approved table, inserted by script and checked with diff; every test label cited in the coverage was found in the test source"

requirements-completed: [UX-07, UX-08, UX-09, UX-10, DASH-03]

duration: 43 min (Task 1) plus the pilot's walk with its five fixes and Task 3, 2026-10-04
completed: 2026-10-04
status: complete
---

# Phase 11 Plan 21: Phase gate, browser walk and coverage Summary

**Phase 11 closed by evidence: the full gate green on the production build at `9702d70` (`api:check`, typecheck and lint clean; web 3,280/3,280, Strapi 704/704, Playwright 156/156 with desktop 131, mobile 25 and 0 flaky; every static check against `PHASE_11_BASE=9f95575` empty), then the pilot's approved walk of the Requestor, the Secondary Requestor and the Security Analyst at 375 and 1440. Backstops B1 to B3 and surfaces W1 to W26 pass after five test-first fixes, and W27 (the UAT baselines) is pending. Every requirement (UX-07 to UX-10, DASH-03), success criterion and finding maps to its plans and tests.**

Status: complete. Task 1 (the gate, `6785116`), Task 2 (the pilot's walk, approved on 2026-10-04 with its five fixes) and Task 3 (this record) are done. The gate figures were taken at `9702d70`, before the five fixes; the pilot re-runs the full gate after them and records the result. The post-execution gates follow: code review, regression, `verify:post`, verification and the final gate.

## Performance

- **Task 1 started:** 2026-10-03T23:28:42Z
- **Task 1 gate finished:** 2026-10-04T00:10:46Z (43 min including this record)
- **Task 2:** the pilot's walk on the restarted dev servers, 2026-10-04. Its five fixes were committed from 05:41Z to 06:36Z, and the pilot approved the walk the same day
- **Task 3:** 2026-10-04, from about 06:45Z (this record)
- **Tasks:** 3 of 3
- **Files modified:** 17: this summary and the 16 files of the five fix commits (`key-files`)

## Phase gate

Run from the repository root in Git Bash under Node 24.19.0 (POST-DEMO-BRIEF §4's PATH and pnpm shim), at `HEAD` `9702d70762787117f7821d2e9204addd1a3c1e6c`. Before the run, and again before the Strapi suite and before Playwright, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing. `BASE` resolved from `11-01-SUMMARY.md` to `9f95575`.

| # | Command | Result | Duration | POST-DEMO-BRIEF §3 baseline (`ece1a25`, 2026-10-01) | Last Phase 11 figure |
|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/csrm api:check` | exit 0, clean. The only output besides the generator banner is git's `LF will be replaced by CRLF` notice on `schema.d.ts` | 3 s | clean | clean (11-20) |
| 1b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (no longer listed). Exit 1, only because git's refresh reports every stat-dirty entry whatever the pathspec: `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update`, the operator's two empty-diff line-ending items, left alone. Same behaviour as 10-23 and 11-02 to 11-20 | <1 s | (not in §3) | same |
| 2 | `pnpm --dir apps/csrm typecheck` | exit 0, clean (`next typegen && tsc --noEmit`) | 7 s | clean | clean |
| 3 | `pnpm --dir apps/csrm lint` | exit 0, clean (`next typegen && tsc --noEmit`; there is no ESLint) | 5 s | clean | clean |
| 4 | `pnpm --dir apps/csrm test` | exit 0. **146 files, 3,280 passed / 3,280, 0 failed.** No `EPERM: rename`, so no file was rerun | 60 s (vitest 58.63 s) | 2,046 / 2,048 (2 baseline failures, since fixed) | 3,280 / 3,280 (11-20) |
| 5 | `pnpm --dir apps/backend test` (background) | exit 0. **704 tests: pass 704, fail 0, cancelled 0, skipped 0, todo 0** | 995 s (16.6 min; `duration_ms` 984,563.5). 23:30:41Z to 23:47:16Z | 578 / 578 (10 min 45 s) | 704 / 704 (11-17, 11.1 min) |
| 6 | `pnpm --dir apps/csrm test:e2e` (background; both projects, production build) | exit 0. **156 passed: desktop 131, mobile 25. 0 failed, 0 flaky, 0 skipped.** `Running 156 tests using 1 worker`, closing `156 passed (19.3m)` | 1,160 s (19.3 min). 23:51:26Z to 00:10:46Z | 84 / 84 (11.1 min) | 156 / 156: desktop 131, mobile 25, 0 flaky (11-20, 18.0 min) |

**Playwright flaky count:** desktop 0, mobile 0 (no retry, no `flaky` line). §3's baseline records no flaky figure; its run was 84/84.

**Tree around the runs:** `git status --short` was identical before and after the Strapi suite, and identical before and after Playwright. Each time it showed only the three operator items (the two `apps/backend/types/generated/*.d.ts` files and `example-risk-assessment-questions/`). No restore step ran (G-6, Phase 8 D-12).

**Server log noise (not a failure):** the harness Next server prints `Invalid Server Actions request`, `The Server Reference ID did not match the expected format`, `x-forwarded-host ... does not match origin ... evil.example` and `The destination stream closed early`. These come from `production-hardening.spec.ts`'s deliberate negative requests and navigations, and the specs that make them pass. They appear in earlier Phase 10 and 11 runs too.

**Logs** are in the session scratchpad and are not committed: `g-apicheck.log`, `g-typecheck.log`, `g-lint.log`, `g-web.log`, `g-strapi.log`, `g-e2e.log`.

## Static checks

Each check runs against `BASE=9f95575` (`PHASE_11_BASE`, 150 commits before `HEAD`; the span changes 261 files, +25,976 / −3,311).

| Check | Command | Output | Result |
|---|---|---|---|
| Content-type freeze (D-01) | `git diff --name-only "$BASE"..HEAD -- 'apps/backend/src/api/*/content-types/*'` | (empty) | pass |
| Catalogue copies identical (D-02) | `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | (silent), exit 0 | pass |
| No Keycloak-named file changed | `git diff --name-only "$BASE"..HEAD \| grep -i keycloak` | (empty), grep exit 1 | pass |
| No Keycloak or dev-identity flag changed in any `.example` | `git diff "$BASE"..HEAD -- '*.example' \| grep -E '^[+-].*(CSRM_AUTH_OIDC_ENABLED\|CSRM_DEV_IDENTITY\|IDAMBOX_KEYCLOAK_PROVISIONING\|IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION)'` | (empty), grep exit 1. No `.example` file changed in the span | pass |
| No manifest or lockfile changed (T-11-SC) | `git diff --name-only "$BASE"..HEAD -- package.json apps/csrm/package.json apps/backend/package.json pnpm-lock.yaml` | (empty) | pass |
| No `CSRM_AI_` source line added or removed | `git diff "$BASE"..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml \| grep '^[+-].*CSRM_AI_'` | (empty), grep exit 1 | pass |

`api:check` was also clean (gate row 1), which with the silent `cmp` is D-02's whole proof.

## Browser checks

Walked on 2026-10-04 on the dev servers the pilot restarted on the working branch at the gate's code (`6785116`; later commits change only planning paths and one script path until the walk fixes). The seeded Strapi start added the accepted analyst-insights Risk (D-45). The first pass was made by an independent agent with the Playwright MCP browser (Chromium, headed, classic 15px scrollbar), read-only, injecting axe-core 4.11.4 from the workspace on every surface. The pilot re-verified every issue after its fix in the same browser. Nothing was submitted, released, generated, answered or saved.

The walk found five defects, each fixed test-first in its own commit before approval:

| Fix | Defect | Commit |
|---|---|---|
| 1 | Alerts failed on every URL in dev: `alertListUrlQuerySchema` was a top-level `z.record`, which refuses Next's dev `searchParams` proxy (a 11-09 regression; the production build passed) | `08d850f` |
| 2 | The Reports index read "in your authorised scope", a UI-SPEC D-54 term; the copy guard now lists `authorised scope` and `bucket` | `cea169e` |
| 3 | `body { min-width: 320px }` made every shell page scroll sideways by 15px at a 320px viewport with a classic scrollbar (WCAG 1.4.10 at 400% zoom on Windows) | `601d2e3` |
| 4 | A React key warning from `CapabilityNavigation` on every page (`key` after a spread) | `3117ba9` |
| 5 | The Requests queue phone card's status badge overran its card at a 305px content box | `82d2b20` |

| ID | Backstop | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| B1 | Each accepted link sits beneath its row's count; no exposure row overflows its widget | Security Analyst | 375 | pass | Home Risk exposure widget x 17–343 (scrollWidth 327 = clientWidth 327); the Moderate count link spans y 3821–3865 and "1 accepted" starts at y 3865 (x 246–323); every row link x 29–331 inside the widget; page 360/360 |
| B2 | Five Risk exposure tiles wrap into rows of three, then five, without clipping | Security Analyst | 1024 | pass | /app/reports/risk-exposure: rows of 3 + 2, tiles 208×141 at y 266 and 431; each tile scrollWidth 207 = clientWidth 207; no ellipsis; page 1009/1009; axe 0 |
| B2 | Five Risk exposure tiles wrap into rows of three, then five, without clipping | Security Analyst | 1280 | pass | one row of five, tiles 167×173 at y 246, each scrollWidth 165 = clientWidth 165; no clip; page 1265/1265; axe 0 |
| B3 | At 320px the header shows Menu, the search icon and the role tag with no horizontal scroll; the role tag truncates only below 375px | Security Analyst, Requestor, Secondary Requestor | 320, 340, 375 | pass | Menu x 16–101, icon-only Search x 117–161, role tag ending x 304; header 320/320. Tag truncates at 320 (Security Analyst 150/134, Secondary Requestor 175/134) and 340 (150/139), never at 375 (150/150, 175/175, 93/93). Page: after fixes 3 and 5, with a real 15px classic scrollbar, document scrollWidth 305 = clientWidth 305 on /app, /app/risks, /app/reports/risk-exposure, /app/review/requests and /app/alerts (first pass: 320 > 305 from `body { min-width: 320px }`) |

| ID | Surface | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| W1 | Sidebar and drawer | Requestor | 1440, 375 | pass | New request, Home, My work (My requests, My questionnaires, My risk assessments); names "My requests, 1 needs your action", "My questionnaires, 1 to answer"; drawer fits 812 (last item bottom 363); axe 0 |
| W2 | Home | Requestor | 1440 | pass | page 1425/1425; Needs your action, With the Security Analyst ("The Security Analyst is …"; 5 of 6, "View all 6 in My requests"), Released assessments; rating chips link "{Rating}: 1 released risk assessment", zero ratings plain; h1 Home; axe 0 |
| W3 | Home | Requestor | 375 | pass | page 360/360; Needs your action h2 at y 255 (first screen), then With the Security Analyst (629), Released assessments (1589); axe 0 |
| W4 | My requests | Requestor | 1440 | pass | page 1425/1425; columns Request ID, Title, Status, Next step, Due date, Updated; Show filter (All requests, Needs your action, With the Security Analyst, No action needed); table scrolls only inside "My assessment requests, scrolls horizontally" (1332/1087), permitted by UI-SPEC §7; released requests read "Released"; axe 0 |
| W5 | My requests | Requestor | 375 | pass | page 360/360; cards show the holder label and next-step sentence; axe 0 |
| W6 | Request page (RAR-DEV-QUES-DRAFT-001) | Requestor | 375 | pass | Step 4 of 8 (bottom y 322) and "Next action: Answer and submit the questionnaire." (y 370) in the first screen; Show all steps toggles aria-expanded and reads Hide all steps; 8 steps; axe 0 |
| W7 | Released request (RAR-E2E-NAV-OWNER-001) | Requestor | 375 | pass | badge "Released", "Step 8 of 8", "No action is required."; page 360/360; axe 0 |
| W8 | Request page, New request, My questionnaires, My risk assessments | Requestor | 1440 | pass | no page overflow; on /app/requests/new My requests is current (UI-D43); axe 0 |
| W9 | My questionnaires, My risk assessments | Requestor | 375 | pass | page 360/360; axe 0 |
| W10 | Quick find (Ctrl+K) | Requestor | 375, 1440 | pass | "RAR-E2E-NAV-OWNER-001": My requests 1, live region "1 match"; "password": My requests 1 + My risk assessments 1, "2 matches"; dialog 375 / 640 wide; no overflow; axe 0 |
| W11 | Quick find for the Requestor's records | Secondary Requestor | 375, 1440 | pass | both searches: "No matches for …" with "Only records you can open are searched."; live region "No matches for …"; the Requestor's request URL shows "You don't have access to this area" |
| W12 | Sidebar, drawer, Home, My requests | Secondary Requestor | 1440, 375 | pass | Requestor items only, no analyst items, no counts at zero; banner SECONDARY REQUESTOR; no overflow; axe 0 |
| W13 | Sidebar | Security Analyst | 1440 | pass | Home; Assessment work (Requests "8 need attention", Questionnaires, Risk assessments); Oversight (Risk register, Alerts "5 overdue", Reports); Reference data (4); My own requests button with aria-expanded=false and aria-controls, no count at zero (§1.3); axe 0 |
| W14 | Drawer | Security Analyst | 375 | pass | every navigation item fits without scrolling (My own requests bottom 745 of 812); only the dev role switcher below (765) |
| W15 | Home | Security Analyst | 1440 | pass | page fits; Your own requests last; Risk exposure "Released Risks only", Critical 1, Moderate 1 with "1 accepted", Under assessment 4 apart ("Not yet released, so not counted above."); axe 0 |
| W16 | Home | Security Analyst | 375 | pass | tiles two by two at (16,182), (188,182), (16,387), (188,387), 156 wide; Review queue starts at y 645 (< 812); Your own requests last (y 5703); axe 0 |
| W17 | /app/review | Security Analyst | 1440 | pass | 307 to /app |
| W18 | Requests queue | Security Analyst | 1440, 375, 320 | pass | columns Request, Title, Requestor, Assessment type, Business criticality, Status, Due date, Age, Submitted; All requests (`queue=all`) + "RAR-E2E-P7-RELEASED-001" gives 1 row; table region scrolls inside its label (1522/1103); after fix 5 the phone card's badge stays within its card at a 305px content box (first pass: overran by up to 17px, page 306 > 305); axe 0 |
| W19 | Risk assessments | Security Analyst | 1440, 375 | pass | columns Assessment, Request title, Status, Risks, Highest residual rating, Draft initiated by, Released; "password" gives 1 row (ASM-E2E-NAV-OWNER-001); no overflow; axe 0 |
| W20 | Risk register | Security Analyst | 1440, 375 | pass | Released / Under assessment markers on every row; RSK-E2E-P7-ACCEPTED-001 (D-45) shown Accepted; More filters (aria-expanded) with Risk state, Stage, Treatment action, Due state; axe 0 with the dialog open; accepted link opens 1 row, Under assessment 4; no overflow |
| W21 | Questionnaires | Security Analyst | 1440, 375 | pass | no overflow; axe 0 |
| W22 | Reports index | Security Analyst | 1440, 375 | pass | after fix 2 the description reads "Read-only reports computed from the current records you can open." (first pass: "authorised scope"); no overflow; axe 0 |
| W23 | The four reports | Security Analyst | 1440, 375 | pass | no overflow; Risk exposure five tiles; Treatment performance "Due within 14 days"; figures equal their lists: released open 2 = 2, under assessment 4 = 4, no target date 2 = 2, released in period 3 = 3, mitigation controls 3 = 3, Questionnaire in progress 4 = 4, queue 8 = 8; after fix 1 (pilot): treatment Overdue 2 = 2 (`kind=risk-treatment-overdue`), Due within 14 days 1 = 1 (`kind=risk-treatment-due-soon`), Rated Ineffective 1 = 1 (`kind=ineffective-control`) |
| W24 | Quick find, five groups | Security Analyst | 1440, 375 | pass | "Customer portal": Requests 5, Questionnaires 3, Risk assessments 2, Risk register 1, My requests 2, live region "13 matches"; "E2E": "Show all 6 in Requests", "Show all 6 in Risk register"; no overflow |
| W25 | Alerts | Security Analyst | 1440, 320 | pass | after fix 1 every URL loads (first pass: "We couldn't load alerts", ZodError); Urgency Overdue gives 5 results = the sidebar's "5 overdue"; page 305/305 at 320 with a classic scrollbar |
| W26 | Every shell route | Security Analyst, Requestor | 320 | pass | pilot sweep after fixes 3 and 5 with a 15px classic scrollbar: 17 analyst routes (Home, both queue views, questionnaires, assessments, register, alerts, reports index and four reports, My requests, four reference data lists) and 8 Requestor routes (Home, My requests and its Needs your action view, questionnaires, assessments, New request, two request pages): scrollWidth = clientWidth, no badge or link outside its card; no console error or key warning across the sweep |
| W27 | UAT-A, UAT-B, UAT-C baselines (REPORT.md §12) | all | — | pending | the UAT records are not in this host's development database (an All requests search for RAR-2026-5WWFVQ returns 0; the database holds the seed only); the seeded stand-ins pass (W7, W15, W16, W18, W20); handed to the operator's UAT |

### Manual-Only results

| Item | Result | Note |
|---|---|---|
| NVDA reads each count with its meaning, the disclosure state and one quick-find announcement per search | pending | NVDA cannot run in this session. Supporting evidence: each count is in its link's accessible name with its meaning ("Requests, 8 need attention", "Alerts, 5 overdue", "My requests, 1 needs your action"); the disclosure exposes aria-expanded and aria-controls; quick find's polite live region announces "1 match", "2 matches", "13 matches" and "No matches for …" |
| ⌘K on macOS Safari and Firefox | pending | no Mac available; Ctrl+K passes in Chromium on Windows |
| UAT-A, UAT-B, UAT-C baselines | pending | W27 |
| The accepted seed Risk after the Strapi restart (D-45) | pass | W15, W20 |

## Coverage

Each requirement, ROADMAP success criterion and finding, with the plans that deliver it and the tests that prove it. The test labels and titles are the ones the plans' SUMMARYs name, each found in the test source with grep on 2026-10-04: Playwright specs in `apps/csrm/e2e/`, web unit tests in `apps/csrm/src/`, Strapi tests in `apps/backend/tests/`. Every one passed in the Task 1 gate (`## Phase gate`: Playwright 156/156, web 3,280/3,280, Strapi 704/704). Walk rows refer to `## Browser checks`.

### Requirements

| Requirement | Plans | Playwright | Unit and Strapi tests | Walk rows | Manual-Only |
|---|---|---|---|---|---|
| UX-07: sidebar sections named by job, labels that match page headings, counts on items that hold work | 11-04, 11-05, 11-13 | `navigation-and-home.spec.ts`: `UX07_LABEL_EQUALS_HEADING` (11-04); `UX07_SECTIONS_PER_ACTOR`, `UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW`, `UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE`, `UX07_DRAWER_SAME_SECTIONS` (11-05); `UX07_COUNT_EQUALS_LIST`, `UX07_ANALYST_COUNTS_EQUAL_LISTS`, `UX07_REQUESTOR_NO_ANALYST_COUNTS`, `UX07_COUNTS_REFRESH_AFTER_SUBMIT`, `UX07_DRAWER_COUNTS` (11-13) | `navigation.test.ts` "navigation profiles (D-06 to D-08, UI-SPEC §1.1)", "navigation labels equal their page headings (D-09)", "navigation counts (D-10, UI-SPEC §1.3)"; `page-boundaries.test.tsx` "route boundaries repeat the page heading (UI-SPEC §2.1)"; `mobile-navigation.test.tsx` "the Security Analyst’s sections (D-08, UI-SPEC §1.1, §1.2)", "the drawer renders the same profile (D-12)", "navigation counts (D-10, UI-SPEC §1.2, §1.3)"; `navigation-counts.test.ts` "loadNavigationCounts for a Requestor (D-10, D-11)", "loadNavigationCounts for a Security Analyst (D-10, D-11)"; `assessment-service.test.ts` "countReviewQueue: the sidebar’s one-row queue count (D-11)" | W1, W12, W13, W14, W25 | NVDA reading each count with its meaning: pending |
| UX-08: one Home per actor that leads with their next actions, on a phone as on a desktop | 11-02, 11-03, 11-08, 11-09, 11-10, 11-12 | `navigation-and-home.spec.ts`: "Home and navigation @journey" and `UX08_REVIEW_REDIRECTS_TO_HOME` (11-02); `UX08_ANALYST_PHONE_FIRST_SCREEN` (11-03); `UX08_REQUESTOR_PHONE_FIRST_SCREEN`, `UX08_REQUESTOR_HOME_SPLIT`, `UX08_ANALYST_OWN_REQUESTS` (11-12). `requestor-request-workflow.spec.ts`: `UX08_NEXT_ACTION_NAMES_HOLDER` (11-08). `request-relationship-states.spec.ts`: `UX08_PHONE_STEPPER` (11-09) | `home-page.test.tsx` "Home at /app" and `next-config-redirects.test.ts` "the /app/review redirect" (11-02); `analyst-dashboard-presentation.test.ts` "leads with the queue, then deadlines and alerts, then exposure and activity (D-18, UI-SPEC §5.3)" (11-03); `request-lifecycle.unit.test.ts` "holderFor gives the D-20 holder of every lifecycle step" and `request-hub.test.tsx` "links the next action only when the viewer holds the step and the server supplies an href (D-27)" (11-08); `request-lifecycle-stepper.test.tsx` "reads Step n of m, then the next action, then the disclosure below 768px (X-9, UI-SPEC §6.3)", "reveals the full ordered list from the disclosure and keeps focus on it (D-26)" (11-09); `my-requests.integration.test.ts` "each of my requests names who holds it, equal to the lifecycle's holder at every step (D-20)" and `request-status-summary.integration.test.ts` "mounted request status summary counts the caller's own requests by holder, equal to the my requests holder totals" (11-10); `requestor-home.test.tsx` "Requestor Home: Needs your action", "Requestor Home: With the Security Analyst" and `own-requests-panel.test.tsx` "OwnRequestsPanel" (11-12) | W2, W3, W6, W7, W15, W16, W17 | NVDA announcing the disclosure state: pending. The UAT-A and UAT-B baselines (Bob's Home, Jane's Home at 375): pending (W27) |
| UX-09: review lists with the columns to triage, figures that open their records, statuses in user terms | 11-01, 11-06, 11-07, 11-11, 11-15, 11-17, 11-18 | `assessment-navigation-lifecycle.spec.ts`: `UX09_RELEASED_REQUEST_LABEL` (11-01). `review-lists.spec.ts`: `UX09_QUEUE_TRIAGE_COLUMNS`, `UX09_QUEUE_SEARCH_BY_TITLE` (11-06); `UX09_ASSESSMENT_COLUMNS` (11-07); `UX09_MY_REQUESTS_NEXT_STEP`, `UX09_MY_REQUESTS_HOLDER_FILTER` (11-11). `risk-register-workflow.spec.ts`: `UX09_PICKER_FINDS_BY_REQUEST_TITLE` (11-07); `UX09_REGISTER_FIGURE_FILTERS`, `UX09_REGISTER_FIGURE_FILTERS_SHEET` (11-15). `analyst-insights.spec.ts`: `DASH03_REPORT_SCOPE`, whose Due within 14 days figure equals the due-soon alerts (11-17); `UX09_FIGURE_DUE_LATER`, `UX09_FIGURE_EXPOSURE_CELL`, `UX09_FIGURE_THROUGHPUT_MONTH`, `UX09_FIGURE_LIFECYCLE_ROW`, `UX09_FIGURE_CONTROL_ROW_HEADER` (11-18) | `status-badge.test.tsx` "the request and assessment labels" and `request-table.test.tsx` "labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)" (11-01); `review-queue.unit.test.ts` "a queue item carries the requestor's name, type, criticality, due date and days since submission", `review-queue-buckets.integration.test.ts` "the queue search finds a request by its number or a word of its title, literally" and `assessment-list.test.tsx` "the request queue triage columns" (11-06); `assessment-workflow.integration.test.ts` "assessment lists carry the request title, the Risk count and the highest residual rating", "both assessment lists find an assessment by a word of its request title" and `assessment-list.test.tsx` "the risk assessment list columns" (11-07); `request-table.test.tsx` "shows whose turn each request is above the server’s next step, linking only the viewer’s own step (D-34, UI-D25)" (11-11); `risk-register.integration.test.ts` "mounted Risk Register lists each due state exactly as the one due-state rule derives it (D-35, G-16)" (11-15); `analyst-reports.integration.test.ts` "every treatment due-state figure equals its alert list or its Risk register dueState list (D-38, G-16)" (11-17); `figure-link-audit.test.ts` "figure link audit (UX-09 criterion 2, D-35 to D-39, X-10)" and `report-table.test.tsx` "ReportTable figure links" (11-18) | W4, W5, W7, W18, W19, W20, W23, W25 | The UAT-A, UAT-B and UAT-C baselines (the queue columns, "Released" on Jane's requests): pending (W27) |
| UX-10: quick find opens any record the user may read, by number or title | 11-19, 11-20 | `quick-find.spec.ts`: `UX10_FIND_AND_OPEN`, `UX10_ANALYST_GROUPS`, `UX10_SHOW_ALL` (11-19); `UX10_SCOPE_SECONDARY_REQUESTOR`, `UX10_KEYBOARD_PHONE`, `UX10_ESCAPE_RESTORES_FOCUS`, `UX10_GUARD_BLOCKS`, `UX10_AXE_OPEN_DIALOG` (11-20). `app-shell.spec.ts`: "keeps the authorised shell responsive at ${viewport.width}px", six widths with no page overflow (cited by 11-19). `performance.spec.ts`: "quick find’s dialog code is requested only after the Search control is focused or the shortcut is pressed" (11-20) | `quick-find-actions.test.ts` "quickFindAction for a Requestor", "quickFindAction for a Security Analyst" (11-19); `quick-find-trigger.test.tsx` "the shortcut (D-47, UI-SPEC §3)", with its case "⌘K (meta) works too, on any platform" (11-19); `quick-find-dialog.test.tsx` "one search at a time, the latest term winning (D-50)" (11-19), "what quick find searched (D-53, UI-SPEC §4.2, §4.4)", "when a list cannot be searched (D-53, T-11-47, T-11-48)", "the phone sheet and the desktop frame (X-8, UI-D42, UI-SPEC §4.1)" (11-20); `navigation-guard.test.tsx` "the programmatic entry point, navigate (D-51, UI-SPEC §4.6)" (11-19) | B3, W10, W11, W24 | ⌘K on macOS Safari and Firefox: pending (no Mac). NVDA's quick-find announcement: pending |
| DASH-03: exposure figures state their scope and separate released Risks from Risks under assessment | 11-14, 11-16, 11-17 | `risk-register-workflow.spec.ts`: `DASH03_REGISTER_STAGE`, `DASH03_REGISTER_STAGE_CARDS` (11-14). `analyst-insights.spec.ts`: `DASH03_UNDER_ASSESSMENT_APART`, `DASH03_ACCEPTED_SEED` and "the accepted link sits beneath its row’s count without overflow at a 375 viewport" (11-16); `DASH03_REPORT_SCOPE` (11-17) | `risk-register.integration.test.ts` "mounted Risk Register partitions its scope into released and under-assessment stages (D-40)" and `risk-register.test.tsx` "marks each row’s stage in text under its Related assessment link and on its card (D-44, UI-D36)" (11-14); `analyst-dashboard.integration.test.ts` "Risk exposure counts released open Risks apart from those under assessment, with the accepted released Risks, each equal to its Risk Register list (D-40, D-41, D-42)", `analyst-insights-seed.integration.test.ts` "the Phase 7 fixture seeds exactly one released, open, accepted Moderate Risk, however often it runs (D-45)" and `analyst-dashboard-presentation.test.ts` "says in words which stage each Risk figure counts, and never says contextual (D-42, D-43, D-54)" (11-16); `analyst-reports.integration.test.ts` "every exposure figure equals the Risk Register total of the stage-filtered list it links to (D-40 to D-42)" and `report-views.test.tsx` "opens with the as-at line and a Summary strip of tiles that open equal lists, then the sections" (11-17) | B1, B2 at 1024 and 1280, W15, W20, W23 | The accepted seed Risk after the Strapi restart (D-45): pass (W15, W20). UAT-C's Risks as under assessment: pending (W27) |

### ROADMAP success criteria

| # | Criterion | Plans | Tests | Walk rows |
|---|---|---|---|---|
| 1 | The analyst's sidebar has headed sections, no personal items above the review work, and every label matches its page heading; the phone drawer shows the same sections | 11-04, 11-05, 11-13 | `UX07_SECTIONS_PER_ACTOR`, `UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW`, `UX07_LABEL_EQUALS_HEADING`, `UX07_DRAWER_SAME_SECTIONS`, `UX07_DRAWER_COUNTS`; `navigation.test.ts` "navigation labels equal their page headings (D-09)"; `mobile-navigation.test.tsx` "the drawer renders the same profile (D-12)" | W13, W14; W1 and W12 for the Requestors |
| 2 | The analyst lands on their queue and deadlines; the Requestor's first screen on a 375px phone shows what needs their action | 11-02, 11-03, 11-12 | `UX08_REVIEW_REDIRECTS_TO_HOME`, `UX08_ANALYST_PHONE_FIRST_SCREEN`, `UX08_REQUESTOR_PHONE_FIRST_SCREEN`; `home-page.test.tsx` "Home at /app"; `analyst-dashboard-presentation.test.ts` "leads with the queue, then deadlines and alerts, then exposure and activity (D-18, UI-SPEC §5.3)" | W3, W15, W16, W17 |
| 3 | The Requestor's Home separates "Needs your action" from "With the Security Analyst", naming who holds each item | 11-08, 11-10, 11-11, 11-12 | `UX08_REQUESTOR_HOME_SPLIT`, `UX08_NEXT_ACTION_NAMES_HOLDER`, `UX09_MY_REQUESTS_HOLDER_FILTER`; `request-lifecycle.unit.test.ts` "each step's next action names its holder in the UI-SPEC §6.1 sentence for both viewers, linking only the holder's own step"; `my-requests.integration.test.ts` "each of my requests names who holds it, equal to the lifecycle's holder at every step (D-20)"; `requestor-home.test.tsx` "Requestor Home: Needs your action", "Requestor Home: With the Security Analyst" | W2, W3, W4 |
| 4 | The request queue shows requestor, assessment type, criticality, due date and age, and every dashboard and report figure opens its records | 11-06 (the columns); 11-12, 11-13, 11-15, 11-16, 11-17, 11-18 (the figures) | `UX09_QUEUE_TRIAGE_COLUMNS`; `review-queue.unit.test.ts` "a queue item carries the requestor's name, type, criticality, due date and days since submission"; `figure-link-audit.test.ts` "figure link audit (UX-09 criterion 2, D-35 to D-39, X-10)", which walks every figure of the four reports and both Homes; `UX09_FIGURE_DUE_LATER`, `UX09_FIGURE_EXPOSURE_CELL`, `UX09_FIGURE_THROUGHPUT_MONTH`, `UX09_FIGURE_LIFECYCLE_ROW`, `UX09_FIGURE_CONTROL_ROW_HEADER`; `analyst-insights.spec.ts` "analyst dashboard shows what needs attention and every tile equals the list it opens"; `UX09_REGISTER_FIGURE_FILTERS`, `DASH03_ACCEPTED_SEED`, `DASH03_REPORT_SCOPE`, `UX08_REQUESTOR_HOME_SPLIT`, `UX08_ANALYST_OWN_REQUESTS`, `UX07_COUNT_EQUALS_LIST`, `UX07_ANALYST_COUNTS_EQUAL_LISTS` | W18, W23, W15, W20, W25 |
| 5 | Exposure widgets and reports say whether they include unreleased risks, and a released request reads "Released" | 11-14, 11-16, 11-17 (scope); 11-01 (Released) | `DASH03_UNDER_ASSESSMENT_APART`, `DASH03_REPORT_SCOPE`, `DASH03_REGISTER_STAGE_CARDS`, `UX09_RELEASED_REQUEST_LABEL`; `analyst-dashboard-presentation.test.ts` "says in words which stage each Risk figure counts, and never says contextual (D-42, D-43, D-54)"; `report-presentation.test.ts` "says the treatment and control figures include Risks under assessment, in the mitigation-control term"; `status-badge.test.tsx` "the request and assessment labels" | W4, W7, W15, W20, W23 |
| 6 | Ctrl+K or ⌘K finds a request, questionnaire, assessment or risk by number or title and opens it, showing only records the user may read | 11-19, 11-20 | `UX10_FIND_AND_OPEN`, `UX10_ANALYST_GROUPS`, `UX10_SHOW_ALL`, `UX10_SCOPE_SECONDARY_REQUESTOR`, `UX10_KEYBOARD_PHONE`; `quick-find-trigger.test.tsx` "the shortcut (D-47, UI-SPEC §3)"; `quick-find-actions.test.ts` "quickFindAction for a Requestor", "quickFindAction for a Security Analyst" | W10, W11, W24 |

- **Criterion 3:** items name the holder as "the Security Analyst" until Phase 13 adds the assignee's name (11-CONTEXT D-21).
- **Criterion 4:** five figures stay plain by cited exception: a system's Total and the coverage note's figure (D-37), the two mitigation-control counts (D-36) and the implementation-status Not provided row header (`11-18-SUMMARY.md`, "Audit exception list"). A zero is always plain (X-10).
- **Criterion 6:** ⌘K is proven by the unit test above and Ctrl+K in Chromium (W10, W11, W24). ⌘K on macOS Safari and Firefox is pending (`## Manual-Only`).

### Findings

| Finding | Plans | Tests | Walk rows | Left for later phases |
|---|---|---|---|---|
| UAT-001: the analyst lands on a requestor dashboard that shows none of their review work | 11-02, 11-03, 11-12 | `UX08_REVIEW_REDIRECTS_TO_HOME`, `UX08_ANALYST_PHONE_FIRST_SCREEN`, `UX08_ANALYST_OWN_REQUESTS`; `home-page.test.tsx` "Home at /app"; `analyst-dashboard-presentation.test.ts` "leads with the queue, then deadlines and alerts, then exposure and activity (D-18, UI-SPEC §5.3)" | W15, W16, W17; the UAT-A baseline pending (W27) | Team job health (failed jobs in the last seven days) stays with Phase 21 (DASH-04; 11-CONTEXT D-18). Until then the queue's Generation in progress row is the jobs figure |
| UAT-002: the analyst sidebar mixes personal and review items in one ungrouped list, with labels that differ from their pages | 11-04, 11-05, 11-13 | `UX07_LABEL_EQUALS_HEADING`, `UX07_SECTIONS_PER_ACTOR`, `UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW`, `UX07_DRAWER_SAME_SECTIONS`, `UX07_ANALYST_COUNTS_EQUAL_LISTS`; `navigation.test.ts` "navigation labels equal their page headings (D-09)" | W13, W14 | "Assigned to me" and its count arrive with Phase 13 |
| UAT-003: the requestor's tiles count work waiting on the analyst as if it were the requestor's | 11-08, 11-10, 11-11, 11-12 | `UX08_REQUESTOR_HOME_SPLIT`, `UX08_NEXT_ACTION_NAMES_HOLDER`, `UX09_MY_REQUESTS_HOLDER_FILTER`; `request-lifecycle.unit.test.ts` "each step's next action names its holder in the UI-SPEC §6.1 sentence for both viewers, linking only the holder's own step"; `my-requests.integration.test.ts` "each of my requests names who holds it, equal to the lifecycle's holder at every step (D-20)" | W2, W4 | The assignee's name replaces "the Security Analyst" with Phase 13 (D-21) |
| UAT-004: on a phone the requestor dashboard fills two screens with status tiles before anything actionable | 11-12 | `UX08_REQUESTOR_PHONE_FIRST_SCREEN`; `requestor-home.test.tsx` "Requestor Home: Needs your action" | W3; Jane's Home at 375 on the UAT records pending (W27) | none |
| UAT-035: review queues lack the columns an analyst needs to triage | 11-06, 11-07 | `UX09_QUEUE_TRIAGE_COLUMNS`, `UX09_ASSESSMENT_COLUMNS`; `review-queue.unit.test.ts` "a queue item carries the requestor's name, type, criticality, due date and days since submission"; `assessment-workflow.integration.test.ts` "assessment lists carry the request title, the Risk count and the highest residual rating" | W18, W19; the UAT queue columns pending (W27) | The assignee column (Phase 13) and column choice (Phase 18, D-33) |
| UAT-038: on a phone the request's lifecycle stepper takes more than a screen before the next action | 11-09, on 11-08's holder | `UX08_PHONE_STEPPER`; `request-lifecycle-stepper.test.tsx` "reads Step n of m, then the next action, then the disclosure below 768px (X-9, UI-SPEC §6.3)", "reveals the full ordered list from the disclosure and keeps focus on it (D-26)" | W6, W7 | none |
| UAT-048: some oversight views stop short of the records behind them | 11-07, 11-15, 11-18; 11-19, 11-20 | `UX09_FIGURE_EXPOSURE_CELL`, `UX09_FIGURE_THROUGHPUT_MONTH`, `UX09_FIGURE_LIFECYCLE_ROW`, `UX09_FIGURE_DUE_LATER`, `UX09_FIGURE_CONTROL_ROW_HEADER`, `UX09_PICKER_FINDS_BY_REQUEST_TITLE`, `UX09_REGISTER_FIGURE_FILTERS`, `UX10_FIND_AND_OPEN`, `UX10_ANALYST_GROUPS`; `figure-link-audit.test.ts` "figure link audit (UX-09 criterion 2, D-35 to D-39, X-10)"; `assessment-workflow.integration.test.ts` "both assessment lists find an assessment by a word of its request title" | W19, W20, W23, W24 | Trend charts (Phase 21, DASH-05) |
| UAT-060: risk exposure counts unreleased draft and in-review Risks as open exposure without saying so | 11-14, 11-16, 11-17 | `DASH03_REGISTER_STAGE`, `DASH03_UNDER_ASSESSMENT_APART`, `DASH03_ACCEPTED_SEED`, `DASH03_REPORT_SCOPE`; `analyst-dashboard.integration.test.ts` "Risk exposure counts released open Risks apart from those under assessment, with the accepted released Risks, each equal to its Risk Register list (D-40, D-41, D-42)"; `analyst-reports.integration.test.ts` "risk exposure counts released open Risks by rating, treatment status and Information System, with accepted Risks and Risks under assessment apart (D-40 to D-42)" | B1, B2, W15, W20, W23; the UAT-C baseline pending (W27) | The treatment, control and alert figures keep both stages and say so; moving them to released Risks only, with an alert stage filter, is Phase 21 (D-43) |
| UAT-065: the requestor sees "Approved" for a request whose assessment is "Released" | 11-01 | `UX09_RELEASED_REQUEST_LABEL`; `status-badge.test.tsx` "the request and assessment labels"; `request-table.test.tsx` "labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)" | W4, W7; "Released" on Jane's UAT requests pending (W27) | none |

**Unmapped: none.** Every requirement, criterion and finding maps to at least one plan, one test found in the source and one walk row. The last column lists what 11-CONTEXT's decisions defer to later phases; none of it is in Phase 11's scope.

## Manual-Only

Each Manual-Only item of `11-VALIDATION.md` ("Manual-Only Verifications"), with its result from the pilot's walk (`### Manual-Only results` above) or the reason it is pending. Nothing pending is recorded as a pass.

| Item | Requirement | Result | Evidence, or why it is pending |
|---|---|---|---|
| The premium experience bar for both Homes, the sectioned sidebar, the lists and quick find at 375 and 1440, with backstops B1 (11-16), B2 (11-17) and B3 (11-19) | G-4; UX-07, UX-08, UX-09, UX-10 | pass | The pilot approved the walk on 2026-10-04: B1 to B3 pass at their widths, and W1 to W26 pass for the three actors after the five walk fixes. The evidence column records measured geometry, overflow and axe results; no screenshot is committed |
| Screen-reader output for the sidebar counts, the stepper disclosure and the quick-find announcements (NVDA with Chrome) | UX-07, UX-08, UX-10 | pending | NVDA could not run in the walk's session. The walk checked the sources NVDA reads from: each count is in its link's accessible name with its meaning, the disclosure exposes aria-expanded and aria-controls, and quick find's polite live region announces "1 match", "2 matches", "13 matches" and "No matches for …" |
| ⌘K on macOS Safari and Firefox | UX-10 (A4) | pending | No Mac was available. Ctrl+K passes in Chromium on Windows (W10, W11, W24), and `quick-find-trigger.test.tsx` "⌘K (meta) works too, on any platform" passes. Recorded as pending, as `11-VALIDATION.md` requires, not as a pass |
| The UAT-A, UAT-B and UAT-C baselines in the operator's development database | UAT-001, UAT-003, UAT-035, UAT-060, UAT-065 | pending | W27: the UAT records are not in this host's development database, which holds the seed only (an All requests search for RAR-2026-5WWFVQ returns 0). The seeded stand-ins pass (W7, W15, W16, W18, W20). Handed to the operator's UAT |
| The accepted seed Risk after the Strapi restart | D-45 | pass | W15 (the Moderate row's "1 accepted" on the Risk exposure widget) and W20 (RSK-E2E-P7-ACCEPTED-001 shown Accepted in the Risk register) |

Three items stay pending for the operator's UAT: NVDA, ⌘K on macOS Safari and Firefox, and the UAT baselines.

## Notes for the orchestrator

1. **E2E sign-in helpers.** The standing instruction "E2E sign-in helpers assert the Dashboard heading" now reads "E2E sign-in helpers assert the level-one Home heading and the role in the banner" (11-02). `apps/csrm/e2e/helpers/navigation.ts` asserts it, and `apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts` pins `HOME_HEADING`.
2. **Two Phase 7 decisions are reversed.** D-13's 30-day treatment report window is now the product's 14-day due-soon window (`TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS`; 11-17, D-38). D-15's "`/app` stays the personal dashboard" is reversed for analysts: `/app` is Home for every actor, and `/app/review` redirects there (11-02, D-16, D-17).
3. **The G-16 switch point** is `apps/backend/src/csrm/insights/treatment-due-state.ts`. `deriveTreatmentDueState` and its SQL mirror `applyTreatmentDueStatePredicate` both read `TREATMENT_DUE_DATE_COLUMN`. The Risk register's `dueState` filter (11-15), the treatment report and the two risk-treatment alert kinds (11-17) all filter through the predicate, so Phase 20 switches the governing date in one place.
4. **The G-13 label mapping** is `statusPresentation` in `apps/csrm/src/components/csrm/status-badge.tsx`, the only source of request status labels (11-01). Phase 17.1 adds a request status by adding one entry; a value without one renders through the sentence-case fallback.
5. **The walk's five fixes.** The walk found five defects, fixed test-first in `08d850f`, `cea169e`, `601d2e3`, `3117ba9` and `82d2b20` (the fix table under `## Browser checks`). `## Phase gate` was measured at `9702d70`, before them, and `82d2b20` records that its `accessibility.spec.ts` change was not run when committed. The pilot's full gate re-runs after them, and the pilot records that result.
6. **A planning conflict for Phase 21.** Walk fix 2 (`cea169e`) added `authorised scope` to the copy guard's internal terms (`apps/csrm/src/lib/performance/interface-copy-guard.test.ts`). Phase 21 specifies a Reports description ending "Read-only, from recorded history in your authorised scope." in `.planning/workstreams/csrm/phases/21-management-dashboards-and-metrics/21-UI-SPEC.md` (line 193) and `21-17-PLAN.md` (line 31), which the guard now refuses. Phase 21's fresh plan check must revise that copy.
7. **The Keycloak-name static check in the re-run.** Measured against `PHASE_11_BASE=9f95575`, 50 Keycloak-named paths now differ, all last changed by the operator's workstream commits `5a3c94b` (48 planning paths the move placed under `.planning/workstreams/csrm/`: 24 renamed, 24 added) and `90cbe89` (`docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md` and `docs/adr/0003-production-only-keycloak-oidc-sign-in.md`). The check was empty at `9702d70`, and the five fixes touch only `apps/csrm`, so a non-empty Keycloak line in the re-run comes from those commits, not from Phase 11. At HEAD the other static checks (content types, catalogue copies, flags, manifests, `CSRM_AI_`) are still empty.

## Task Commits

1. **Task 1: Run the full gate and the static checks, then commit the gate record.** This summary's commit, `docs(11-21): record the Phase 11 gate` (`6785116`).
2. **Task 2: the pilot's browser walk.** Approved by the pilot on 2026-10-04. The walk found five defects, and each was fixed test-first in its own commit before approval (the fix table under `## Browser checks`):
   - `08d850f` fix(11-21): read the Alerts URL from any object, not only a plain one
   - `cea169e` fix(11-21): drop "authorised scope" from the Reports index copy
   - `601d2e3` fix(11-21): let the body fit a 320px viewport beside a classic scrollbar
   - `3117ba9` fix(11-21): pass the navigation link key before its spread
   - `82d2b20` fix(11-21): let phone-card rows wrap so a long badge stays in its card
3. **Task 3: browser checks and coverage.** This record, `docs(11-21): record the Phase 11 browser checks and coverage`.

## Deviations from Plan

**1. Gate chain run step by step, not as one `&&` line.**
- **Why:** the plan's action runs the Strapi and Playwright parts in the background. Its `git update-index --refresh` step also exits 1 for the operator's two files alone (gate row 1b), which would stop a literal `&&` chain with no fault in the code.
- **What ran:** every command in the chain, in its order, with each exit code checked and recorded. Every command except 1b exited 0, and 1b's only non-zero cause is the known operator-file stat report. The static checks were run before the suites finished; they are read-only git comparisons against `HEAD` `9702d70`, which did not move during the gate.

No code fix was needed. No `fix(11-21)` commit was made.

**2 to 6. [Rule 1 - Bug] The five walk fixes (Task 2).** They came after Task 1's record, so its "No `fix(11-21)` commit was made" covers Task 1 alone.
- **Found during:** Task 2, the pilot's walk on the restarted dev servers.
- **Issues:** listed in the fix table under `## Browser checks`. The Alerts URL schema refused Next's dev `searchParams` proxy (an 11-09 regression the production build did not show). The Reports index said "authorised scope". `body { min-width: 320px }` scrolled every shell page sideways at 320px beside a classic scrollbar. `CapabilityNavigation` logged a React key warning on every page. The Requests queue phone card's badge overran its card at a 305px content box.
- **Fixes:** each landed with its test first, in its own commit (`08d850f`, `cea169e`, `601d2e3`, `3117ba9`, `82d2b20`), within the 16 files under `key-files.modified`, all in `apps/csrm`.
- **Verification:** the pilot re-verified each issue in the walk's browser after its fix (B3, W18, W22, W23, W25, W26). `82d2b20` records that its `accessibility.spec.ts` change was not run when committed, so the pilot's full gate re-run is that change's first run.

**Total deviations:** 6: one procedural (Task 1's step-by-step gate chain) and five bugs fixed test-first (Task 2).
**Impact on plan:** the fixes stay inside Phase 11's web surfaces, with no content-type, contract, catalogue, manifest, lockfile, Keycloak or `CSRM_AI_` change. The figures in `## Phase gate` predate them; the pilot's re-run records the gate after them.

## Issues Encountered

- **Task 1:** none. No gate failure and no flaky test. The tree was clean after every run.
- **Task 2:** the walk found the five defects above, all fixed before approval. W27 could not run: the UAT-A, UAT-B and UAT-C records are not in this host's development database, so the operator's UAT holds them.
- **Task 3:** none. By instruction, no suite, typecheck, lint or `api:check` ran and no server was started or stopped, because the pilot's full gate re-run was in progress.

## Next Phase Readiness

- Plan 11-21 is complete: Tasks 1 to 3 are done, and all 21 Phase 11 plans have a summary.
- The gate in `## Phase gate` ran at `9702d70`, before the five walk fixes. The pilot's full gate re-runs after them, and the pilot records that result.
- Next come the post-execution gates, as for Phase 10: the code review diffed from `9f95575`, the regression gate, `verify:post`, the verifier, and the final full gate, recorded here as `## Phase gate (final run, after the code review)`. The phase is not marked complete here.
- Phase 21's fresh plan check must revise its Reports description (`## Notes for the orchestrator`, note 6).
- Three Manual-Only items stay pending for the operator's UAT (`## Manual-Only`).
- The executor started and stopped no server.

## Self-Check: PASSED

- `## Browser checks` matches the pilot's approved file line for line (`diff` printed nothing).
- All 44 Playwright labels and every unit and Strapi test title cited in `## Coverage` were found in the test source with grep; none is cited from memory.
- Task 3's verify command exits 0: B1, B2 and B3 read pass, and no B row reads issue or pending.
- Commits `6785116`, `08d850f`, `cea169e`, `601d2e3`, `3117ba9` and `82d2b20` exist, and each fix touches only `apps/csrm`: no content type, contract, catalogue, manifest, lockfile, Keycloak-named file or `CSRM_AI_` line.
- Before this commit, `git status --short` listed only this summary. None of the brief's three operator items appears in this checkout: `example-risk-assessment-questions/` is absent, and the two generated type files show no change.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Gate recorded: 2026-10-04; walk approved and plan completed: 2026-10-04*

## Phase gate (rerun after the walk fixes)

Run by the pilot on 2026-10-04 at `82d2b20`, after the walk fixes `08d850f`, `cea169e`, `601d2e3`, `3117ba9` and `82d2b20`, from the repository root with Node v24.21.0 and pnpm 11.24.0, the dev servers stopped.

| Gate | Result | Duration |
|---|---|---|
| `api:check` | clean | 13 s |
| Typecheck | clean | 21 s |
| Lint | clean | 9 s |
| Web (Vitest) | 3,288 / 3,288 (146 files) | 3.1 min |
| Strapi (node:test) | exit 0 (ℹ tests 704 ℹ pass 704 ℹ fail 0) | 40.4 min |
| Playwright (desktop and mobile, production build) | 156 passed, 0 failed, 0 flaky; the first run of the `82d2b20` reflow check | 32.7 min |

Static checks against `PHASE_11_BASE` (`9f95575`): no content-type change; the catalogue copies are identical; no flag change in any `.example` file; no manifest or lockfile change; no `CSRM_AI_` source line changed; `git status --short` was empty afterwards. The Keycloak-name check lists 50 paths, all planning records and ADRs 0002 and 0003 moved by the operator workstream commits `5a3c94b` and `90cbe89` (note 7); no Keycloak code or flag changed.

## Phase gate (final run, after the code review)

Run by the pilot on 2026-10-05 after every code-review fix (`11-REVIEW-DISPOSITION.md`), from the repository root with Node v24.20.0 and pnpm 11.24.0, the dev servers stopped. Web and Strapi ran at `d545b43`; Playwright ran at `7f4f9ec`, which changes only `apps/csrm/playwright.config.ts` from `d545b43`.

| Gate | Result | Duration |
|---|---|---|
| `api:check` | clean | under 1 min |
| Typecheck and lint (one script, `next typegen && tsc --noEmit`) | clean | under 1 min |
| Web (Vitest) | 3,328 / 3,328 (148 files) | 74.7 s |
| Strapi (node:test) | exit 0 (ℹ tests 710 ℹ pass 710 ℹ fail 0) | 13.3 min |
| Playwright (desktop and mobile, production build) | 159 passed (desktop 134, mobile 25), 0 failed, 0 flaky | 22.7 min |

- **Harness fix found by this gate (`7f4f9ec`):** the first Playwright attempt refused every signed-in read, because the harness Strapi inherited `IDAMBOX_KEYCLOAK_PROVISIONING=true` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true` from this host's local `apps/backend/.env`. The webServer env now pins both flags to false, as it already pins the deterministic AI provider and the web's OIDC flag. No Keycloak code or `.env` changed. That attempt was stopped and is not counted; the run above is the whole suite.
- **Static checks against `PHASE_11_BASE` (`9f95575`):** no content-type change; the catalogue copies are identical; no flag change in any `.example` file; no manifest or lockfile change; no `CSRM_AI_` source line changed; no change under `apps/backend/src/keycloak/` or `idp/`. `git status --short` listed only planning files afterwards.
- **Disclosed exception:** the review fix `cf372e9` (SH-01) changed `apps/csrm/src/lib/auth/oidc-session-adapter.ts` and `session-adapter.ts`. OIDC sessions now carry an opaque `identityKey`, a SHA-256 of the encrypted cookie's subject, so quick find discards its caches when the identity changes. Sign-in, the token flow and the flag are unchanged. It is kept because reverting it would reopen the cross-identity cache defect in OIDC mode. It is listed for the operator's review.
