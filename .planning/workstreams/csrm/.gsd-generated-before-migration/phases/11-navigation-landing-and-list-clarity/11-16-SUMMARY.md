---
phase: 11-navigation-landing-and-list-clarity
plan: 16
subsystem: api
tags: [analyst-dashboard, strapi, knex, openapi, zod, nextjs, vitest, playwright, dash-03, uat-060]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-14: applyReleasedParent and applyUnderAssessmentParent beside the register's scope, the stage and treatmentAction filters and the Accepted marker; 11-15: residualRating=none; 11-02, 11-03, 11-12: the analyst Home and its widget frame"
  - phase: 07-analyst-insights
    provides: "computeDashboardSummary, ratingCounts, BarChart labelled-values, seed-analyst-insights.ts; Phase 10's interface copy guard"
provides:
  - "dashboard-summary.ts: openReleasedRisks and openUnderAssessmentRisks (the register's named branches plus its open predicate); riskExposure as { released, releasedAccepted, underAssessment }, each a RatingCounts; High and Critical read the released branch only"
  - "Spec: DashboardRiskExposure (three required RatingCounts), referenced by DashboardSummary.riskExposure; the operation and the High and Critical descriptions say which register list each figure equals"
  - "Seed: RSK-E2E-P7-ACCEPTED-001, a released, open, accepted Moderate Risk with no target date (D-45)"
  - "BarChart: BarChartSecondaryLink and BarChartLinkedDatum.secondary, a record link after the row link in the same item, on a shared subgrid"
  - "Web: dashboardRiskExposureSchema (closed, refuses the flat shape); riskExposureRows with stage=released links and accepted links; underAssessmentRow; the High and Critical footer (View Critical Risks, View High Risks); the D-43 scope words; the analyst dashboard modules in the copy guard"
  - "E2E: DASH03_UNDER_ASSESSMENT_APART, DASH03_ACCEPTED_SEED (1440) and the 375 accepted-link geometry check (desktop project, sets its own viewport)"
affects: [11-17, 11-18, 11-21, 17.1, 20, 21]

actuals:
  tokens: 33045
  tasks: 3
  commits: 5
plan_head_before: f9b11b2e67d493778a22beed6428fb23234e1b99
plan_head_after: 1f5972c0e21d9a3bfca05345cd9bb5d5077405c7

tech-stack:
  added: []
  patterns:
    - "A staged figure reads the register's named branch function with the register's own open predicate, so every count equals its stage-filtered register list. The integration test proves this per rating, and proves that the two stages partition the open register"
    - "A chart row's second figure is a sibling link in the same list item on a shared subgrid, so no link nests in another and every mark keeps one scale"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
    - apps/backend/src/bootstrap/seed-analyst-insights.ts
    - apps/backend/tests/analyst-dashboard.integration.test.ts
    - apps/backend/tests/analyst-insights-seed.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-schema.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
    - apps/csrm/src/components/csrm/bar-chart.tsx
    - apps/csrm/src/components/csrm/bar-chart.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/analyst-insights.spec.ts
    - apps/csrm/e2e/design-system-conformance.spec.ts
    - apps/csrm/e2e/review-lists.spec.ts

key-decisions:
  - "11-16: riskExposure counts each stage with the register's own branch function and open predicate (applyReleasedParent, applyUnderAssessmentParent, r.closure_date IS NULL); the accepted count adds a bound treatment_action = 'Accept' on the released branch only, so a draft's Accept never counts"
  - "11-16: the summary no longer reads both stages at all: High and Critical reads the released branch, and Treatments due keeps both stages through the alert repository it already reads, so the planned openDisclosableRisks helper had no caller and is not kept"
  - "11-16: Not rated links to residualRating=none and shows only above zero; its accepted link is named '{n} accepted Not rated {Risk|Risks}', the §9.2 pattern with the row's label"
  - "11-16: the under-assessment row is a plain link row after a border-border hairline (not a one-item list), with its caption outside the link; it renders at zero and under the cleared released state"
  - "11-16: a BarChart list with any secondary link becomes one grid whose rows are subgrids, so every mark keeps one scale; lists without one keep the flex column"
  - "11-16: the accepted seed Risk has no treatment status and no target date, so it raises no alert and moves no alert figure; the seed's risk() helper takes an optional treatment action and a null status"
  - "11-16: DASH-03 stays open: requirements.ready-ids reports 0/1 ready, because 11-17 also declares it"

patterns-established:
  - "Exposure figures by stage: openReleasedRisks and openUnderAssessmentRisks in dashboard-summary.ts are the model for 11-17's report reads"
  - "E2E for a per-rating list that may be empty: group the widget's rows by their badge and read only the lists that must hold a row"

requirements-completed: []

coverage:
  - id: D1
    description: "riskExposure is released, releasedAccepted and underAssessment, each a RatingCounts equal to the register list filtered by rating (none for not rated), state=open and its stage; the stages partition the open register; a draft's Accept, a closed Risk, an off-ladder rating and a partly released assessment's Risk are each counted correctly"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-dashboard.integration.test.ts#Risk exposure counts released open Risks apart from those under assessment, with the accepted released Risks, each equal to its Risk Register list (D-40, D-41, D-42)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 7 analyst dashboard summary is published closed and matches the served summary"
        status: pass
    human_judgment: false
  - id: D2
    description: "The High and Critical residual Risks list and total count released open Risks only, equal to the released Critical and High register lists"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-dashboard.integration.test.ts#the High and Critical residual Risks list released open Risks only, Critical first, then the earliest target date, each with its treatment due state (D-42)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#analyst dashboard shows what needs attention and every tile equals the list it opens (E23)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The spec publishes DashboardRiskExposure; the client is regenerated; the closed parser requires the three counts and refuses the flat shape"
    requirement: "DASH-03"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the dashboard summary exposure as three rating counts, refusing the flat shape of both stages (D-02 item 4, D-42)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Risk exposure widget says 'Released Risks only…', lists 'Released open Risks by residual rating' with stage=released row links and '{n} accepted' links, and shows the Under assessment row with its caption, also under the cleared state"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx (released rows, accepted links and under-assessment row, cleared state cases)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#DASH03_UNDER_ASSESSMENT_APART"
        status: pass
    human_judgment: false
  - id: D5
    description: "The seeded accepted Risk is in the Moderate row's accepted link, whose list equals the figure, and the register marks it Released and Accepted"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-insights-seed.integration.test.ts#the Phase 7 fixture seeds exactly one released, open, accepted Moderate Risk, however often it runs (D-45)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#DASH03_ACCEPTED_SEED"
        status: pass
    human_judgment: false
  - id: D6
    description: "Treatments due, Upcoming due dates and Top alerts say they include Risks under assessment; the High and Critical footer offers View Critical Risks and View High Risks; no analyst Home copy says contextual, and the guard scans the analyst dashboard modules"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts#says in words which stage each Risk figure counts, and never says contextual (D-42, D-43, D-54)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts (the four analyst dashboard modules)"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 375px each accepted link sits beneath its row's count and no exposure row overflows its widget"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#the accepted link sits beneath its row’s count without overflow at a 375 viewport (desktop project, setViewportSize 375×812)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this truth a walkthrough backstop (11-21 B1). The geometry check supplements it, but how the wrapped link reads beside the count is a visual judgment"

duration: 1h 2m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 16: Released exposure on the analyst Home Summary

**The analyst Home's Risk exposure widget now counts released Risks only, marks the accepted ones and shows the Risks still under assessment as a separate figure. Strapi serves `riskExposure` as three rating counts: `released`, `releasedAccepted` and `underAssessment`. Each is read with the Risk register's named branches (`applyReleasedParent`, `applyUnderAssessmentParent`) and its open predicate, so every figure equals the register list it opens. The High and Critical residual Risks widget lists released Risks only. Its footer now opens the released Critical and High lists. The widget says "Released Risks only." in words. Each row opens `…&stage=released`, and Not rated now links to `none`. An "{n} accepted" link follows a row whose accepted figure is above zero, and an "Under assessment" row with its caption sits below the chart. Treatments due, Upcoming due dates and Top alerts now say they include Risks under assessment. No analyst Home copy says "contextual", and the copy guard scans the analyst dashboard modules. The seed gains one released, open, accepted Risk, and the browser proves it is marked Released and Accepted and is counted in its rating's accepted link.**

## Performance

- **Duration:** 1h 2m. This includes three Playwright runs (two of the changed specs, one full), the full Strapi suite and the full web suite.
- **Started:** 2026-10-03T17:40:01Z
- **Completed:** 2026-10-03T18:42:00Z
- **Tasks:** 3 of 3
- **Files changed:** 20 (none created, none deleted)

## Accomplishments

- **Strapi (`dashboard-summary.ts`):**
  - `openRisks(query)` is the register's `state=open` predicate (`r.closure_date IS NULL`).
  - `openReleasedRisks` and `openUnderAssessmentRisks` apply the register's two branch functions to `csrm_risks as r`, then that predicate.
  - `residualRatingRows` groups a population by its stored residual rating. `ratingCounts` folds null and off-ladder values into `notRated`, as the register's `residualRating=none` does.
  - `riskExposure` is:
    - `released`: the released open Risks;
    - `releasedAccepted`: the same read plus a bound `r.treatment_action = 'Accept'`;
    - `underAssessment`: the open Risks under assessment.

    A draft's Accept is on the other branch, so it never counts as accepted (D-41).
  - `openHighCriticalRisks` reads `openReleasedRisks`, so the High and Critical rows and their total are released only (D-42).
  - The summary no longer reads `applyDisclosableParent` (see Decisions Made).
- **Contract:**
  - `DashboardRiskExposure` has three required `RatingCounts` and is closed. `DashboardSummary.riskExposure` references it.
  - The operation's description says that each exposure count equals the register filtered by rating (`none` for not rated), `state=open` and its stage.
  - The High and Critical descriptions now say "released".
  - `schema.d.ts` is regenerated, and `api:check` is clean.
  - The operation, route and grant are unchanged. The served-operations drift check passes (8/8), `served-operations.json` is unchanged, and both catalogue copies are byte-identical (`cmp`).
- **Seed (`seed-analyst-insights.ts`, D-45):** `RSK-E2E-P7-ACCEPTED-001` is on the released fixture assessment:
  - residual Moderate, treatment action Accept, no closure date;
  - no treatment status and no target date, so it raises no alert;
  - a statement that starts `Accepted fixture:`;
  - keyed by its Risk number like its siblings, so reseeding is idempotent.
- **BarChart:**
  - `BarChartSecondaryLink` (`href`, `label`, `accessibleName`) and the optional `BarChartLinkedDatum.secondary`.
  - It renders as a `RecordLink` after the row's link, in the same `li`, never inside it.
  - A list with any secondary link is one grid (`grid-cols-1`, from `@md` `minmax(0,1fr)_auto`) whose rows are subgrids. Every mark therefore keeps one scale.
  - The link is `justify-self-end`, so it wraps beneath the count below `@md` and sits on the row's line from `@md`.
  - Lists without one keep `flex flex-col` and unclassed rows.
- **Web:**
  - `dashboardRiskExposureSchema` is strict on the three counts, so the parser refuses the flat shape.
  - **Risk exposure:**
    - `riskExposureRows(exposure)` gives each row `…&state=open&stage=released`. Not rated links to `none` and shows only above zero.
    - An `accepted` link (`{n} accepted`, `…&treatmentAction=Accept`, named `{n} accepted {Rating} {Risk|Risks}`) appears only above zero.
    - `underAssessmentRow(exposure)` gives `Under assessment`, its count, `/app/risks?state=open&stage=under-assessment`, the name `Under assessment: {n} open {Risk|Risks} not yet released` and the caption `Not yet released, so not counted above.`
    - The widget renders the released rows, or the cleared `No released open Risks` · `Risks count here once their risk assessment is released.`, then the under-assessment row after a `border-border` hairline, at zero too.
  - **High and Critical:** the description and empty state are the §9.2 strings, and the footer links are `View Critical Risks` and `View High Risks`, each to its released open list.
  - **D-43:** Treatments due, Upcoming due dates and Top alerts carry the §9.4 descriptions.
  - **UI-D33:** the attention tile reads `Untreated Critical Risks and ineffective mitigation controls`.
  - **Copy guard (D-54):** it scans `analyst-dashboard-presentation.ts`, `-schema.ts`, `-service.ts` and `analyst-dashboard.tsx`, and its header no longer excludes the dashboard. Reports stay excluded for 11-17.

## Task Commits

1. **Task 1: The analyst Home's exposure counts released Risks and says so (tracer, TDD)**
   - `c1766a6`: test(11-16), RED
   - `9a74b90`: feat(11-16), GREEN
2. **Task 2: Accepted links, the under-assessment row, released High and Critical, the seed and the scope words (TDD)**
   - `1c605b0`: test(11-16), RED
   - `b1856d3`: feat(11-16), GREEN
3. **Task 3: Browser proofs and the Strapi suite**
   - `1f5972c`: test(11-16)

The ledger count is `git rev-list --count f9b11b2..1f5972c` = 5. Every commit ends with the `Co-Authored-By` trailer (checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `c1766a6` comes before GREEN `9a74b90`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed). The target was "Risk exposure counts released open Risks apart from those under assessment, with the accepted released Risks, each equal to its Risk Register list (D-40, D-41, D-42)".
  - It failed on `DASHBOARD_RISK_EXPOSURE_KEYS`: the served exposure was the flat `RatingCounts`.
  - The Strapi file failed 7 of 8. The fixtures seeded, and every summary read failed on the same shape assertion; the denial test passed.
  - The catalogue file failed 1 of 17 (`PHASE7_DASHBOARD_COMPONENT_MISSING_DashboardRiskExposure`).
  - The web run failed 20 of 273, each on an assertion.
- **Task 2:** RED `1c605b0` comes before GREEN `b1856d3`.
  - `RED_EVIDENCE_OK` for "the High and Critical residual Risks list released open Risks only, Critical first, then the earliest target date, each with its treatment due state (D-42)". It failed on `DASHBOARD_HIGH_CRITICAL_RISKS`: five rows from both stages instead of the two released ones.
  - The Strapi run failed 4 of 15: both High and Critical cases, `FIXTURE_RISK_COUNT` and `FIXTURE_ACCEPTED_RISK_COUNT`.
  - The web run failed 16 of 188, on assertions and the missing `underAssessmentRow`.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree, and it exited 0: web 273/273, `api:check` clean, typecheck clean, Strapi 8/8. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED | web 20 failed of 273; Strapi dashboard 7 failed of 8; catalogue 1 failed of 17 |
| Task 1 GREEN verify | web 7 files, 273/273; `api:check` 0; typecheck clean; Strapi dashboard and catalogue 25/25; served-operations 8/8; catalogue copies identical |
| Task 1 tracer re-run | exit 0 (web 273/273, Strapi 8/8) |
| Task 2 RED | web 16 failed of 188; Strapi 4 failed of 15 |
| Task 2 GREEN verify | web 5 files, 188/188; typecheck clean; `api:check` 0; Strapi dashboard, seed and catalogue 32/32 |
| Playwright, the changed specs (`analyst-insights`, `design-system-conformance`, `review-lists`), first run | 30 passed, 1 failed (E23: the released High list was empty, so no table rendered; deviation 5); 4.1 min. Tree identical before and after |
| Playwright, the changed specs, second run | **31 passed: desktop 27, mobile 4; 0 failed, 0 flaky, 0 skipped; 3.6 min.** Tree identical before and after |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **702/702, 0 fail, 0 cancelled, 0 skipped; 729.5 s (12.2 min)**. 11-15 ended at 701; this plan adds 1 (the seed case), and the other cases changed in place. Tree identical before and after |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **141 files, 3,140/3,140** (11-15 ended at 3,125) |
| `typecheck` and `lint` | clean |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`) | **137 passed: desktop 116, mobile 21; 0 failed, 0 flaky, 0 skipped; 14.2 min** (11-15: 134, desktop 113 and mobile 21). `git status --short` identical before and after |
| `api:check` (final) | exit 0; `schema.d.ts` matches the committed contract after `git update-index --refresh` |

The production server in the full run logged 85 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-15 logged 140 and 1). Every test passed.

## E2E Assertions Changed

- **E22** (`analyst-insights.spec.ts`): the Critical exposure row now matches `/^Critical: [\d,]+ released open Risks? by residual rating$/`. Its URL also carries `stage=released`, and the row-equals-list step is kept. The list name in the partial-failure test and in `design-system-conformance.spec.ts` (line 237; the plan said 219) is now `Released open Risks by residual rating`.
- **E23:** `Open Risk Register` is gone, and a check asserts that. Each High and Critical row is grouped by its badge's rating, and `View Critical Risks` and `View High Risks` are each clicked and checked for `residualRating`, `state=open` and `stage=released`. Each row's identifier is then found in its own rating's list, read at `pageSize=50`. A rating with no row is not read, because its empty list renders no table (deviation 5).
- **New:**
  - `DASH03_UNDER_ASSESSMENT_APART` (1440): checks the description, the row and its caption. The row sits below the released list and outside it, its count is above zero, and it equals the `stage=under-assessment` list with the `Stage: Under assessment` chip.
  - `DASH03_ACCEPTED_SEED` (1440): the Moderate row's `{n} accepted` link holds its row's line. Its figure is at most the row's, and its list (residual rating, open, released, Accept) equals the figure. That list holds `RSK-E2E-P7-ACCEPTED-001`, whose row shows `Released` and `Accepted`.
  - The 375 check sets `{ width: 375, height: 812 }` itself and runs in the desktop project:
    - the accepted link's top is at or below the count's bottom;
    - every exposure row and the link sit inside the widget;
    - the under-assessment caption sits beneath its row;
    - the page does not overflow.

    It carries no `@journey` tag, and the file is not on the mobile project's list.
- **`review-lists.spec.ts`** (outside the plan's list, deviation 2): the seeded released assessment now holds two Risks. The table cell reads `2` and the card `2 Risks · Highest residual`; the highest rating is still Critical.

## Files Created/Modified

- `apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts`: the staged reads, the released High and Critical read, and the `DashboardRiskExposure` type
- `apps/backend/src/bootstrap/seed-analyst-insights.ts`: the accepted Risk, and the helper's optional treatment action and null status
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: `DashboardRiskExposure` and the descriptions
- `apps/csrm/src/components/csrm/bar-chart.tsx`: the secondary link and the subgrid
- `apps/csrm/src/features/analyst-dashboard/analyst-dashboard-schema.ts`, `-presentation.ts`, `analyst-dashboard.tsx`: the parser, the rows, the accepted links, the under-assessment row, the copy and the widget
- Tests:
  - Strapi: `analyst-dashboard.integration.test.ts`, `analyst-insights-seed.integration.test.ts`, `contract-catalogue.integration.test.ts`
  - Web: `analyst-dashboard-presentation.test.ts`, `analyst-dashboard.test.tsx`, `analyst-dashboard-service.test.ts`, `bar-chart.test.tsx`, `contract-response-parity.test.ts`, `interface-copy-guard.test.ts`
  - E2E: `analyst-insights.spec.ts`, `design-system-conformance.spec.ts`, `review-lists.spec.ts`

## Decisions Made

- **One definition per stage.** Each exposure count applies the register's own branch function and open predicate, which is what `GET /v1/risks?…&state=open&stage=…` applies after its union. The integration test proves every rating count of all three populations equal to its register list. It also proves that released plus under assessment equals the open register (T-11-38).
- **No both-stage read in the summary.** The plan kept a renamed `openDisclosableRisks` "only where a widget still needs both stages". After Task 2 no summary figure does: Treatments due keeps both stages through the alert repository it already reads (D-43). The helper and the `applyDisclosableParent` import are therefore gone rather than kept unused.
- **Not rated.** It links to `residualRating=none` (11-15) and shows only above zero. Its accepted link follows the §9.2 pattern with the row's label: `{n} accepted Not rated {Risk|Risks}`.
- **The under-assessment row** is a link row in the Review queue's pattern after a `border-border` hairline, with its caption outside the link (`text-xs text-foreground-secondary`). A one-item list would add list semantics around a single figure.
- **The secondary link's layout** uses a shared subgrid, so the bars stay on one scale whether or not a row has an accepted link. Callers without `secondary` render the old markup.
- **The accepted fixture** has no treatment status and no target date, because an accepted Risk has no treatment. It therefore raises no alert, which the seed test asserts. The only E2E figures it moves are the released Moderate exposure, the seeded assessment's Risk count (deviation 2) and the register's search results, which no test counts.
- **DASH-03 stays open.** `requirements.ready-ids` reports 0/1 ready, because 11-17 also declares it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] The catalogue contract test pinned the old summary shape**
- **Found during:** Task 1, grepping for assertions on `DashboardSummary` before GREEN, as earlier plans learned to.
- **Issue:** `contract-catalogue.integration.test.ts` asserts `DashboardSummary.riskExposure` as `ref("RatingCounts")` and lists the closed dashboard components.
- **Fix:**
  - `DashboardRiskExposure` joins the closed components (keys `released`, `releasedAccepted`, `underAssessment`, fully required).
  - `riskExposure` references it.
  - A new assertion pins its three properties to `RatingCounts`.
- **Files modified:** `apps/backend/tests/contract-catalogue.integration.test.ts`
- **Verification:** RED failed on the missing component; GREEN passed 25/25 with the dashboard file; the full suite passed 702/702.
- **Committed in:** `c1766a6`

**2. [Rule 3: blocking] A browser test outside the plan's list counted the seeded assessment's Risks**
- **Found during:** Task 2, grepping every consumer of the seed before adding the Risk. It was fixed with the Task 3 browser proofs, the plan's E2E commit.
- **Issue:** `review-lists.spec.ts` (`UX09_ASSESSMENT_COLUMNS`, desktop and mobile) pins `ASM-E2E-P7-RELEASED-001` at `1` Risk. The plan places the accepted Risk on that assessment.
- **Fix:** It now expects `2` and `2 Risks · Highest residual`, and its comment names the accepted Risk.
- **Files modified:** `apps/csrm/e2e/review-lists.spec.ts`
- **Verification:** both projects passed in both changed-spec runs and in the full run.
- **Committed in:** `1f5972c`

**3. [Rule 1: consistency] The spec still called the High and Critical Risks "open contextual"**
- **Issue:** Once the list became released only (Task 2), the `DashboardHighCriticalRisks` and `DashboardRiskRow` descriptions misstated it.
- **Fix:** Both descriptions now say released, and the client was regenerated. It is a description-only contract change, committed with the Task 2 GREEN, although Task 2's file list omits the spec.
- **Verification:** `api:check` 0; the catalogue test passes.
- **Committed in:** `b1856d3`

**4. [Rule 1: test defect] A Task 1 widget test expected row text without its word break**
- **Issue:** The new "never counts a Risk under assessment" case expected `Critical0`, but the rendered row is `Critical 0`. The break is deliberate (SC 2.5.3).
- **Fix:** The expectation was corrected in the GREEN commit.
- **Committed in:** `9a74b90`

**5. [Rule 1: test defect] E23's first form assumed both released lists hold Risks**
- **Issue:** The E2E database has no released open High Risk. That list therefore rendered the empty state (`0 results`, `No Risks match these filters`) and no table.
- **Fix:** Rows are grouped by their badge's rating. Both footer links are still clicked and their URLs checked, but only a list that must hold a row is read.
- **Verification:** the second changed-spec run passed 31/31, and the full run passed.
- **Committed in:** `1f5972c`

**6. [Plan line drift]** E22's conformance list name was at `design-system-conformance.spec.ts:237`, not 219.

---

**Total deviations:** 6: 2 blocking fixes outside the file list, 1 contract description fix, 2 defects in my own tests, and 1 line-number drift.
**Impact on plan:** No added scope. No content-type change, no new operation, Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC). The operation keeps `requireAnalystInsightScope` and its human-analyst grant, and both partitions sit inside the register's scope (T-11-37).

## Issues Encountered

- **Bash heredocs.** A bash heredoc carrying a Python patch with nested quotes failed to parse (`unexpected EOF`), as in 11-15. Those patches were written to the scratchpad with the Write tool and run from there.
- **Line-ending warnings.** The `LF will be replaced by CRLF` notices are `core.autocrlf` messages on the files I wrote. `git update-index --refresh` still reports the operator's two `apps/backend/types/generated/*.d.ts` files as "needs update". They stay untouched and unstaged.
- **The first changed-spec run.** It failed on E23 (deviation 5). As the harness does on a failure, it kept its database and builds under `apps/backend/.tmp/` and `apps/csrm/.tmp/` for debugging. Those directories are ignored, and `git status --short` was identical before and after.

## Known Stubs

None. Every figure, link and marker reads a server field: the three exposure counts, the High and Critical rows, and the seeded Risk's stage and treatment action. `Accepted` is the recorded decision on a released Risk; Phase 17.1's acceptance facts refine it (D-41).

## Threat Flags

None.
- No new endpoint, route, grant or table.
- **T-11-37:** both partitions are the register's own branches inside its disclosable scope, so no new Risk becomes visible. The operation stays analyst-only and takes no query.
- **T-11-38:** there is one definition per stage, proved equal to each register list and to partition the open register.
- The accepted value is a bound constant.

## User Setup Required

None.

## Notes for the orchestrator

- **D-45:** the accepted seed Risk `RSK-E2E-P7-ACCEPTED-001` reaches the operator's development database only on the next Strapi restart, when `seedAnalystInsights` reconciles. Until then the dev analyst Home may show no accepted link, and the seeded released assessment still lists one Risk. The Playwright database seeds it at boot.
- **11-21 B1** stays the walkthrough backstop for the 375 truth. The automated geometry check passed in the desktop project at a 375×812 viewport.

## Next Phase Readiness

- **11-17 (the Risk exposure report):**
  - Read the released sections with the same `applyReleasedParent` + `r.closure_date IS NULL` pair as `openReleasedRisks`. Read `acceptedByResidualRating` with the bound Accept on that branch, and `underAssessment.byResidualRating` with `applyUnderAssessmentParent`.
  - Each figure's link carries `stage=released` (plus `treatmentAction=Accept`) or `stage=under-assessment`, so the existing register filters equal them.
  - The report's E2E can read the seeded accepted Risk in its `Accepted` Moderate cell.
- **11-18 (figure links):** this plan delivers the analyst Home's exposure, accepted and under-assessment links, and the High and Critical footer (§8.2).
- **11-21:** the coverage table can cite `DASH03_UNDER_ASSESSMENT_APART`, `DASH03_ACCEPTED_SEED` and the 375 accepted-link check for DASH-03 on the analyst Home.

## Self-Check: PASSED

- Commits `c1766a6`, `9a74b90`, `1c605b0`, `b1856d3` and `1f5972c` exist on `post-demo`, and each carries the trailer.
- **Task 1 acceptance re-ran PASS:**
  - `dashboard-summary.ts` imports `applyReleasedParent` and `applyUnderAssessmentParent`.
  - The spec defines `DashboardRiskExposure` with the required `released`, `releasedAccepted` and `underAssessment`.
  - `analyst-dashboard-presentation.ts` contains `Released open Risks by residual rating` and `stage=released`.
  - The verify exited 0, twice (GREEN and the tracer re-run).
- **Task 2 acceptance re-ran PASS:**
  - `seed-analyst-insights.ts` seeds `treatmentAction: "Accept"` on the released fixture assessment.
  - `bar-chart.tsx` accepts `secondary` on labelled-values rows.
  - The presentation contains `Not yet released, so not counted above.`, `View Critical Risks` and `Includes Risks under assessment.`, and `grep -n -i "contextual"` on it prints nothing.
  - The verify passed.
- **Task 3 acceptance re-ran PASS:**
  - `analyst-insights.spec.ts` contains `DASH03_UNDER_ASSESSMENT_APART`, `DASH03_ACCEPTED_SEED` and `released open Risks? by residual rating`, and its 375 check sets `{ width: 375, height: 812 }` itself.
  - The full Strapi suite passed (702/702), and the tree is clean.
- **The plan's verification passed:**
  - `api:check` clean;
  - the parity guard and the copy guard pass;
  - web 3,140/3,140, typecheck and lint clean;
  - Strapi 702/702;
  - the two specs pass, and the full Playwright suite passes 137/137;
  - the tree is clean after every run.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because DASH-03 is not ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
