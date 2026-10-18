---
phase: 11-navigation-landing-and-list-clarity
plan: 17
subsystem: api
tags: [analyst-reports, analyst-alerts, strapi, knex, openapi, zod, nextjs, vitest, playwright, dash-03, ux-09, uat-060, uat-048, g-16]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-14: applyReleasedParent and applyUnderAssessmentParent, the stage and treatmentAction register filters; 11-15: applyTreatmentDueStatePredicate, TREATMENT_DUE_DATE_COLUMN, the register's dueState and none filters; 11-16: the dashboard's staged exposure (openReleasedRisks, openUnderAssessmentRisks), the accepted seed Risk"
  - phase: 07-analyst-insights
    provides: "the four analyst reports, report-copy.json and its mounted equality test, the alert branches, Phase 10's interface copy guard"
provides:
  - "report-repository.ts: every Risk exposure section reads the register's released branch with its open predicate; acceptedByResidualRating (released, bound treatment_action = 'Accept') and underAssessment.byResidualRating (the under-assessment branch) beside them; treatment and control figures keep both stages through openDisclosableRisks"
  - "Treatment performance: four counted queries, one per due state, each applyTreatmentDueStatePredicate over TREATMENT_REPORT_DUE_WINDOW_DAYS, total = their sum"
  - "insight-constants.ts: TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS (14), reversing Phase 7 D-13's 30 (D-38)"
  - "alert-repository.ts: risk-treatment-overdue and risk-treatment-due-soon call applyTreatmentDueStatePredicate on the alert window, with TREATMENT_DUE_DATE_COLUMN as the governing date and the Phase 20 (G-16) comment at each call"
  - "Spec: RiskExposureReport.acceptedByResidualRating and RiskExposureUnderAssessment (both required, closed); stage-accurate descriptions for the exposure, treatment and control components and the report operation"
  - "Web: the closed parser; five exposure tiles with stage links (2, 3 then 5 columns); the Accepted column; the Under assessment section with its severity chart; the released and under-assessment empty states; the §9.3 and §9.4 copy; Mitigation controls; report-copy.json and report-definitions.ts state each report's scope"
  - "Copy guard: every non-test module of features/reports and every string value of report-copy.json"
  - "E2E: DASH03_REPORT_SCOPE; E24 (five tiles, Under assessment); E21 (stage=released)"
affects: [11-18, 11-21, 20, 21]

actuals:
  tokens: 25048
  tasks: 3
  commits: 5
plan_head_before: 176010eb6ad70fb1be5106e3e8047505a502c7b8
plan_head_after: f80d09a34e0d586f29d03074bddf739f62a18c8e

tech-stack:
  added: []
  patterns:
    - "A report figure that opens a list is read with the list's own predicate: the register's named stage branch and its open predicate for exposure, the shared due-state rule for the due states; an integration test proves each figure equal to its register list or alert list"
    - "A due-state figure is a counted query per state through applyTreatmentDueStatePredicate, never a CASE over the target date, so Phase 20's one switch reaches it"
    - "The copy guard reads JSON copy files by parsing them and checking every string value, keys excluded"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts
    - apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts
    - apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts
    - apps/backend/src/csrm/insights/insight-constants.ts
    - apps/backend/tests/analyst-reports.integration.test.ts
    - apps/backend/tests/analyst-insights.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/risk-register.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/reports/report-schema.ts
    - apps/csrm/src/features/reports/report-presentation.ts
    - apps/csrm/src/features/reports/risk-exposure-report.tsx
    - apps/csrm/src/features/reports/treatment-performance-report.tsx
    - apps/csrm/src/features/reports/control-effectiveness-report.tsx
    - apps/csrm/src/features/reports/report-detail.tsx
    - apps/csrm/src/features/reports/report-copy.json
    - apps/csrm/src/features/reports/report-schema.test.ts
    - apps/csrm/src/features/reports/report-presentation.test.ts
    - apps/csrm/src/features/reports/report-views.test.tsx
    - apps/csrm/src/features/reports/reports-pages.test.tsx
    - apps/csrm/src/features/reports/report-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/analyst-insights.spec.ts

key-decisions:
  - "11-17: TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS (14). This reverses Phase 7 D-13's 30-day treatment report window (D-38), so 'due soon' has one meaning and the report's figure equals the due-soon alert list. For the orchestrator's decision record"
  - "11-17: the exposure report reads each stage with the register's own branch and open predicate (openReleasedRisks, openUnderAssessmentRisks, as 11-16's dashboard does); accepted adds a bound treatment_action = 'Accept' on the released branch only, so a draft's Accept never counts"
  - "11-17: the due states are four counted queries through applyTreatmentDueStatePredicate (one helper call site, one G-16 comment), and total is their sum; the population (both stages, open treatments) is unchanged (D-43)"
  - "11-17: the two risk-treatment alert branches call the shared predicate on the alert window and read TREATMENT_DUE_DATE_COLUMN as their governing date; their membership is unchanged (analyst-alerts.integration.test.ts passes unmodified)"
  - "11-17: RiskExposureReport gains acceptedByResidualRating after byInherentRating and underAssessment last; RiskExposureUnderAssessment is { byResidualRating } (closed)"
  - "11-17: the Under assessment table always reads five rows (Critical to Low, then Not rated), zeros included; the released ratings table keeps Not rated only when a count is above zero"
  - "11-17: the Information System and control 'Select a … to view …' sentences and every table-cell and row-header link stay with 11-18, where the links land; a sentence that invites a click with no link would mislead"
  - "11-17: DASH-03 and UX-09 stay open: requirements.ready-ids reports 0/2 ready, because 11-21 (and later plans) also declare them"

patterns-established:
  - "Stage-scoped report figures: openReleasedRisks and openUnderAssessmentRisks in report-repository.ts mirror dashboard-summary.ts, and the integration test proves every rating count (none for notRated) equal to its stage-filtered register list and the two stages a partition of the open register"
  - "Due-state equality proof: one integration test compares each report due-state figure with the alert summary and the register's dueState totals on the same fixtures"

requirements-completed: []

coverage:
  - id: D1
    description: "Every Risk exposure section counts released open Risks only; acceptedByResidualRating counts released open Accept Risks (a draft's Accept never); underAssessment.byResidualRating counts the open Risks under assessment; each count equals its stage-filtered register list, and the two stages partition the open register"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-reports.integration.test.ts#risk exposure counts released open Risks by rating, treatment status and Information System, with accepted Risks and Risks under assessment apart (D-40 to D-42)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/analyst-reports.integration.test.ts#every exposure figure equals the Risk Register total of the stage-filtered list it links to (D-40 to D-42)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register lists the Risks with no rating or treatment status, as the reports count them (D-35)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The specification publishes RiskExposureReport.acceptedByResidualRating and RiskExposureUnderAssessment, the client is regenerated, and the closed parser requires both"
    requirement: "DASH-03"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the risk exposure report with its accepted and under-assessment counts, refusing it without them (D-02 item 4, D-42)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 7 analyst reports are published closed and match the served report set"
        status: pass
    human_judgment: false
  - id: D3
    description: "The report shows five tiles (Released open Risks, Critical residual, High residual, Accepted, Under assessment), each a block link whose register list total equals it, on a strip of two, three then five columns; the Accepted column; the Under assessment section with its table and severity chart; the released and under-assessment empty states"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx (risk-exposure report and report detail frame cases)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#DASH03_REPORT_SCOPE"
        status: pass
    human_judgment: false
  - id: D4
    description: "The treatment report's window is 14 days (TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS); today+14 is due within the window and today+15 later; each due-state figure equals the due-soon or overdue alert list or the register's dueState list"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/backend/tests/analyst-insights.unit.test.ts#the insight thresholds and caps are named constants with pinned values"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/analyst-reports.integration.test.ts#every treatment due-state figure equals its alert list or its Risk register dueState list (D-38, G-16)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#DASH03_REPORT_SCOPE (Due within 14 days equals the due-soon alerts)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The report's due-state counts and the two risk-treatment alert kinds call applyTreatmentDueStatePredicate with the Phase 20 (G-16) comment at each call, the alerts read TREATMENT_DUE_DATE_COLUMN, and neither module writes its own target-date due comparison; the alert lists' membership is unchanged"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/backend/tests/analyst-insights.unit.test.ts#the treatment report and the risk-treatment alerts read the shared due-state rule, with the Phase 20 comment at each call (G-16)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/analyst-alerts.integration.test.ts (unmodified, passes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The report descriptions and section copy state each figure's scope (§9.3, §9.4), Mitigation controls replaces Control Implementations, report-copy.json equals the served definitions, and the copy guard scans features/reports and every string of report-copy.json"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-reports.integration.test.ts#the report index lists exactly the four reports with the web's canonical copy"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts (the fifteen report modules and report-copy.json)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-presentation.test.ts#says the treatment and control figures include Risks under assessment, in the mitigation-control term"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 1024px and 1280px the five Risk exposure tiles wrap into rows of three and then five without clipping a caption, value or supporting line"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx#opens with the as-at line and a Summary strip of tiles that open equal lists, then the sections (grid-cols-2, sm:grid-cols-3, xl:grid-cols-5)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this truth a walkthrough backstop (11-21 B2). The unit test pins the column classes; whether the wrapped captions and supporting lines read cleanly at 1024 and 1280 is a visual judgment"

duration: 1h 27m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 17: Released exposure and one due window in the reports Summary

**The Risk exposure report now counts released open Risks in every section and shows the accepted Risks and the Risks still under assessment as separate figures. Strapi reads each stage with the Risk register's named branches and its open predicate, so every figure equals the register list it opens. The report serves `acceptedByResidualRating` and `underAssessment.byResidualRating` beside the released sections, both published closed and required. The page shows five tiles: Released open Risks, Critical residual, High residual, Accepted and Under assessment. Each tile links to its own stage's list. The ratings table gains an Accepted column, and an Under assessment section with a severity chart closes the report. The treatment-performance window is now the product's 14-day due-soon window, reversing Phase 7 D-13's 30 days. Its four due-state counts, and the two risk-treatment alert kinds, read the one shared due-state rule. Phase 20's switch of the governing date therefore reaches the register, the alerts and the report together. Report copy says what each figure includes, "Mitigation controls" replaces "Control Implementations", and the copy guard now scans the reports and `report-copy.json`.**

## Performance

- **Duration:** 1h 27m. This includes two runs of the changed spec, the full Strapi suite, the full web suite and the full Playwright suite.
- **Started:** 2026-10-03T18:46:19Z
- **Completed:** 2026-10-03T20:13:14Z
- **Tasks:** 3 of 3
- **Files changed:** 25 (none created, none deleted)

## Accomplishments

- **Strapi exposure (`report-repository.ts`, D-40 to D-42):**
  - `openRisks` is the register's `state=open` predicate. `openReleasedRisks` and `openUnderAssessmentRisks` apply the register's two branch functions with it, as 11-16's dashboard does.
  - The ratings, residual-by-treatment-status, exposed-systems and risks-without-system reads now use the released branch.
  - `acceptedByResidualRating` reads the released branch plus a bound `r.treatment_action = 'Accept'`, so a draft's Accept is on the other branch and never counts.
  - `underAssessment.byResidualRating` reads the under-assessment branch.
  - `openDisclosableRisks` (both stages) remains only for treatment performance and control effectiveness (D-43). `openContextualRisks` is gone.
- **One due window (D-38, G-16 seam):**
  - `TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS` (14). Its comment says this reverses Phase 7 D-13's 30 days.
  - The report's due states are four counted queries. Each calls `applyTreatmentDueStatePredicate(openDisclosableRisks(…), state, { today, windowDays })`, and `total` is their sum. This replaces the `CASE` sums over `r.target_date`.
  - `risk-treatment-overdue` and `risk-treatment-due-soon` call the same predicate on the alert window and use `TREATMENT_DUE_DATE_COLUMN` as their governing date.
  - Each call carries the comment `Phase 20 (G-16) switches the governing date in treatment-due-state.ts; this figure follows it.` Neither module writes its own target-date due comparison any more.
- **Contract:**
  - `RiskExposureReport` gains the required `acceptedByResidualRating` (`RatingCounts`) and `underAssessment` (`RiskExposureUnderAssessment { byResidualRating }`, closed).
  - These descriptions now say which stage each figure counts and which list it equals: the report operation, `RiskExposureReport`, `ResidualByTreatmentStatus`, `ExposedSystems`, `ExposedSystem`, `TreatmentPerformanceReport`, `TreatmentDueStateCounts` and `ControlEffectivenessReport`.
  - `schema.d.ts` is regenerated, and `api:check` is clean. The operation, route and grant are unchanged. The served-operations drift check passes, `served-operations.json` is unchanged, and both catalogue copies are byte-identical (`cmp`).
- **Web:**
  - **Parser:** `riskExposureReportSchema` requires both new keys, and `underAssessment` is its own strict object.
  - **Tiles (UI-SPEC §9.3):**
    - `Released open Risks` (`Released Risks only`) → `/app/risks?state=open&stage=released`
    - `Critical residual` and `High residual` (`Released open Risks`) → the same list plus the rating
    - `Accepted` (`Released Risks with the treatment action Accept`) → the released list plus `treatmentAction=Accept`
    - `Under assessment` (`Not yet released`) → `/app/risks?state=open&stage=under-assessment`
    - The strip is `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5` (UI-D38). The three-tile and two-tile strips are unchanged. The exposure skeleton shape is now 5 tiles with supporting lines and 4 sections.
  - **Sections:**
    - The ratings table reads `Rating | Inherent | Residual | Accepted`. The small multiples chart inherent and residual only.
    - The new `Under assessment` section has a `Residual rating | Risks` table (Critical to Low, then Not rated) and a severity-toned `BarChart`.
    - When no released open Risk exists, the three released sections show `No released open Risks` · `Risks count here once their risk assessment is released.`. The under-assessment section shows `No Risks under assessment` · `Risks appear here while their risk assessment is a draft or in review.`
  - **Copy (§9.3, §9.4, §11.1):**
    - The three report descriptions are verbatim in `report-copy.json` and `report-definitions.ts`.
    - Due state and Treatment status say `Includes Risks under assessment.`
    - `Mitigation controls` is the tile caption, the column heading and the empty noun. The treatment empty noun is `open Risks`.
    - `grep -rn -i contextual` over `features/reports` and `report-definitions.ts` prints nothing.
  - **Copy guard (D-54):** it scans the fifteen non-test report modules and every string value of `report-copy.json`, which it parses with `JSON.parse`. Its header drops the reports exclusion.

## Task Commits

1. **Task 1: The Risk exposure report counts released Risks and shows Risks under assessment apart (tracer, TDD)**
   - `e26e727`: test(11-17), RED
   - `d863195`: feat(11-17), GREEN
2. **Task 2: One 14-day window on the shared due-state rule, the alert kinds on the same rule, and the scope copy (TDD)**
   - `4be9bda`: test(11-17), RED
   - `193f61d`: feat(11-17), GREEN
3. **Task 3: Browser proofs and the Strapi suite**
   - `f80d09a`: test(11-17)

The ledger count is `git rev-list --count 176010e..f80d09a` = 5. Every commit ends with the `Co-Authored-By` trailer (5 of 5, checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `e26e727` comes before GREEN `d863195`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed). The target was "risk exposure counts released open Risks by rating, treatment status and Information System, with accepted Risks and Risks under assessment apart (D-40 to D-42)".
  - It failed on `RISK_EXPOSURE_REPORT_KEYS`: the served report lacked both new keys.
  - The Strapi run failed 4 of 28 (analyst-reports and contract-catalogue). The fourth failure was `PHASE7_REPORT_COMPONENT_MISSING_RiskExposureUnderAssessment`.
  - The web run failed 18 of 260, each on an assertion or a missing export.
- **Task 2:** RED `4be9bda` comes before GREEN `193f61d`.
  - `RED_EVIDENCE_OK` for "every treatment due-state figure equals its alert list or its Risk register dueState list (D-38, G-16)". The 30-day report counted C (today+15) as due within the window, so its figure differed from the due-soon alerts.
  - The Strapi run failed 4 of 48: the constant, the G-16 source check (`report-repository.ts_DOES_NOT_READ_THE_SHARED_PREDICATE`), the window case and the equality case.
  - The web run failed 11 of 203, each on an assertion.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree and exited 0: web 260/260, `api:check` 0, typecheck clean, Strapi 11/11. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED | web 18 failed of 260; Strapi 4 failed of 28 |
| Task 1 GREEN verify | web 6 files, 260/260; `api:check` 0; typecheck clean; Strapi reports, catalogue, register and served-operations 53/53 (97.9 s); catalogue copies identical |
| Task 1 tracer re-run | exit 0 (web 260/260, Strapi 11/11) |
| Task 2 RED | web 11 failed of 203; Strapi 4 failed of 48 |
| Task 2 GREEN verify | web 7 files, 352/352 (with the parity guard); `api:check` 0; typecheck clean; Strapi unit, reports, dashboard, alerts, catalogue, served-operations and register 105/105 (146.4 s); backend `tsc` clean |
| Playwright `analyst-insights.spec.ts`, first run | 12 passed, 1 failed (the journey's systems table; deviation 3); 1.5 min. Tree identical before and after |
| Playwright `analyst-insights.spec.ts`, second run | **13 passed: desktop 13, mobile 0 (the file is desktop-only); 0 failed, 0 flaky, 0 skipped; 1.3 min.** Tree identical before and after |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **704/704, 0 fail, 0 cancelled, 0 skipped; 663.7 s (11.1 min)**. 11-16 ended at 702; this plan adds 2 (the G-16 source check and the due-state equality case), and the other cases changed in place. Tree identical before and after |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **141 files, 3,169/3,169** (11-16 ended at 3,140) |
| `typecheck` and `lint` | clean |
| `api:check` (final) | exit 0; `schema.d.ts` matches the committed contract after `git update-index --refresh` |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`) | **138 passed: desktop 117, mobile 21; 0 failed, 0 flaky, 0 skipped; 13.9 min** (11-16: 137, desktop 116 and mobile 21). `git status --short` identical before and after |

The production server in the full run logged 71 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-16 logged 85 and 1). Every test passed.

## E2E Assertions Changed

- **E24** (`analyst-insights.spec.ts`): risk-exposure now has `tiles: 5`, and `Under assessment` joins its table sections. `Most exposed Information Systems` moves to a new `coverageSections` list: it shows its table or its coverage note (deviation 3). The section count is the sum of the three lists.
- **E21:** the Critical residual tile's name is now `/^Critical residual [\d,]+ Released open Risks$/`, because the supporting line joins the link's name. Its URL also carries `stage=released`, and the tile-equals-list step is kept.
- **New `DASH03_REPORT_SCOPE`** (1440):
  - The `Released open Risks`, `Accepted` and `Under assessment` tiles are each above zero. Each opens its stage's list with its chip (`Stage: Released`, `Treatment action: Accept`, `Stage: Under assessment`), and each equals that list.
  - The four section headings are in order, and the Under assessment section shows its description and table headers.
  - The treatment report's tile and row read `Due within 14 days`, and no `Due within 30 days` remains. The due-state description says `Includes Risks under assessment.`, and the tile's value equals the `risk-treatment-due-soon` alert list.

## Files Created/Modified

- `apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts`: the staged exposure reads, the due states on the shared rule, both-stage treatment and control reads
- `apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts`: the two treatment branches on the shared rule
- `apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts` and `apps/csrm/src/features/reports/report-copy.json`: the three scoped descriptions
- `apps/backend/src/csrm/insights/insight-constants.ts`: the 14-day window
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the two fields, the new component and the descriptions
- `apps/csrm/src/features/reports/report-schema.ts`, `report-presentation.ts`, `risk-exposure-report.tsx`, `treatment-performance-report.tsx`, `control-effectiveness-report.tsx`, `report-detail.tsx`: the parser, tiles, rows, sections, copy, strip columns and skeleton shape
- Tests:
  - Strapi: `analyst-reports.integration.test.ts`, `analyst-insights.unit.test.ts`, `contract-catalogue.integration.test.ts`, `risk-register.integration.test.ts`
  - Web: `report-schema.test.ts`, `report-presentation.test.ts`, `report-views.test.tsx`, `reports-pages.test.tsx`, `report-service.test.ts`, `contract-response-parity.test.ts`, `interface-copy-guard.test.ts`
  - E2E: `analyst-insights.spec.ts`

## Decisions Made

- **Phase 7 D-13 is reversed (for the orchestrator's decision record).** The treatment-performance report's due window was 30 days. It is now `ALERT_DUE_SOON_WINDOW_DAYS`, 14 days (D-38). `dueWindowDays` stays a served field and now reads 14.
- **Fixtures by stage.** In `analyst-reports.integration.test.ts`, B, C, D, E and I move to the released assessment. A (Critical, a draft's Accept) and F (not rated) stay under assessment. C and D are released Accepts, and B is a released Treat. The treatment and control figures keep both stages, so they did not change. The truncation test's extra Risks are released.
- **Boundary fixtures without new Risks.** F's target moves to today+14 and C's to today+15. This proves both window ends without adding a Risk that would move every other figure.
- **One helper call site.** The four due-state counts go through one `dueStateCount` helper. It has one predicate call and one G-16 comment, and the unit check requires at least as many comments as calls.
- **Under assessment rows** always show all five ratings, zeros included (§9.3 lists them). The released ratings table keeps its Phase 7 rule: Not rated appears only when a count is above zero.
- **No "Select a …" sentences yet.** §9.3's systems sentence and §9.4's control sentences invite a click on a row header. Those links land in 11-18, which also adds the sentences. This plan's strings stop before them.
- **DASH-03 and UX-09 stay open.** `requirements.ready-ids` reports 0/2 ready, because later Phase 11 plans also declare them. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] Tests outside the file list pinned the old report shapes**
- **Found during:** Task 1, grepping every assertion on the risk-exposure and treatment-performance report shapes before GREEN.
- **Issue:**
  - `contract-catalogue.integration.test.ts` pins the closed `RiskExposureReport` keys and properties.
  - `risk-register.integration.test.ts` proved the register's `none` lists equal to `byResidualRating.notRated` over the whole open register. Its fixtures sit on a draft, so they now count under assessment.
- **Fix:**
  - The catalogue now lists `RiskExposureUnderAssessment` and the two new properties.
  - The register test compares `residualRating=none` and `inherentRating=none` with `stage=released` to the released figures, and `stage=under-assessment` to `underAssessment.byResidualRating.notRated`. Its non-vacuity check now reads the under-assessment figure.
- **Committed in:** `e26e727`
- **Verification:** the GREEN verify (53/53) and the full suite (704/704).

**2. [Rule 3: blocking] Web fixtures for the new keys sat in files the plan gives to Task 2**
- **Issue:** `reports-pages.test.tsx` and `report-service.test.ts` serve a risk-exposure report without the new keys, so Task 1's view and parser would crash or refuse them.
- **Fix:** their fixtures gained the two keys in Task 1 (`e26e727`, `d863195`). Their copy assertions changed in Task 2 as planned.

**3. [Rule 1: test assumption] The journey test required a table in the most exposed Information Systems section**
- **Found during:** Task 3's first spec run.
- **Issue:** the E2E seed's only released open Critical Risk impacts no Information System. Under released scoping, the section therefore shows its coverage note (`1 High or Critical residual Risk has no impacted Information System.`) and no table. That is the correct, unchanged behaviour for that population.
- **Fix:** the section joins a `coverageSections` list. It proves either the table or the coverage note, and the section count includes it.
- **Verification:** the second spec run passed 13/13, and the full run passed 138/138.
- **Committed in:** `f80d09a`

**4. [Rule 1: test defect] Two of my own test expectations were wrong**
- The Under assessment chart case expected a mark for each zero bar, but the `BarChart` draws no mark for zero. It was corrected in GREEN (`d863195`).
- The copy guard list put the report modules out of sort order. It was corrected before the RED commit.

**5. [Scope note] `report-detail.tsx` is outside the file list**
- The five-tile strip classes (UI-D38) live where the strip renders. The exposure skeleton shape moved to 5 tiles with supporting lines and 4 sections, so the per-key loading state matches the final layout.
- The route's own generic loading boundary is unchanged.

**6. [Acceptance wording] The literal `contextual` grep covers the test files too**
- To keep `grep -rn -i contextual apps/csrm/src/features/reports` empty, the report tests do not spell the word. The interface copy guard owns that term (D-54), and it now scans the reports and `report-copy.json`.

---

**Total deviations:** 6: 2 blocking fixes outside the file list, 1 environment-driven test assumption, 2 defects in my own tests, and 2 scope or wording notes.
**Impact on plan:** No added scope. There is no content-type change, no new operation, Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC). Both report operations keep `requireAnalystInsightScope` and the human-analyst grant (T-11-39).

## Issues Encountered

- **Bash heredocs.** A bash heredoc carrying a Python patch with nested quotes failed to parse (`unexpected EOF`), as in 11-15 and 11-16. The patches were written to the scratchpad with the Write tool and run from there, through a small helper that keeps each file's line endings.
- **A stray temporary file.** One verify re-run redirected output to `/tmp/null` by mistake. The file was outside the repository and was deleted at once.
- **Line-ending warnings.** The `LF will be replaced by CRLF` notices are `core.autocrlf` messages on the files I wrote. `git update-index --refresh` still reports the operator's two `apps/backend/types/generated/*.d.ts` files as "needs update". They stay untouched and unstaged.
- **The first spec run** kept its database and builds under the ignored `apps/backend/.tmp/` and `apps/csrm/.tmp/` after its failure, as the harness does. `git status --short` was identical before and after.

## Known Stubs

None. Every figure reads a server field. The treatment tiles `Due within 14 days` and `No target date` and the `Mitigation controls` tile stay plain until 11-18 links them, as UI-SPEC §8.2 and the plan's figure-link split intend. Each still shows a real served count.

## Threat Flags

None.
- There is no new endpoint, route, grant or query parameter. The report query stays closed (`period` only on throughput), and `today` and the window are bound server values (T-11-41).
- **T-11-39:** both partitions are the register's own branches inside its disclosable scope, so no new Risk becomes visible.
- **T-11-40:** the register, the alerts and the report share one predicate. The integration tests prove each due-state figure equal to its alert or register list, and the unmodified alert integration file proves the alert lists unchanged.

## User Setup Required

None.

## Next Phase Readiness

- **11-18 (figure links):**
  - The exposure table cells link with `stage=released`, and the Accepted cells add `treatmentAction=Accept`.
  - Link the Under assessment table cells too: `/app/risks?state=open&stage=under-assessment&residualRating={r}`, `none` for Not rated. §9.3 lists them, and 11-18's behaviour list does not name them.
  - Add the systems sentence `Select a system to view its released open Risks.` with the system links, and the control `Select a …` sentences with their row headers.
  - The treatment `Due within 14 days` tile and row should link to `/app/alerts?kind=risk-treatment-due-soon`. Its figure now equals that list.
- **11-21:**
  - The coverage table can cite `DASH03_REPORT_SCOPE` and the analyst-reports integration cases for DASH-03 and UX-09.
  - B2 stays the walkthrough backstop for the 1024 and 1280 tile wrapping.
- **Phase 20 (G-16):** switching `TREATMENT_DUE_DATE_COLUMN` and `deriveTreatmentDueState` in `treatment-due-state.ts` now also moves the alert kinds and the treatment report. Each of those call sites carries the switch comment.

## Self-Check: PASSED

- The five commits `e26e727`, `d863195`, `4be9bda`, `193f61d` and `f80d09a` exist on `post-demo`, and each carries the trailer.
- **Task 1 acceptance re-ran PASS:**
  - The spec's `RiskExposureReport.required` contains `acceptedByResidualRating` and `underAssessment`.
  - `report-repository.ts` reads exposure through `applyReleasedParent` and has no `openContextualRisks` (0 matches).
  - `report-presentation.ts` contains `Under assessment` and `stage=under-assessment`.
  - The verify exited 0, twice (GREEN and the tracer re-run).
- **Task 2 acceptance re-ran PASS:**
  - `insight-constants.ts` contains `TREATMENT_REPORT_DUE_WINDOW_DAYS = ALERT_DUE_SOON_WINDOW_DAYS`.
  - `report-repository.ts` has 1 predicate call and 1 switch comment; `alert-repository.ts` has 2 calls and 2 comments.
  - The `contextual` grep prints nothing.
  - The verify passed.
- **Task 3 acceptance re-ran PASS:**
  - `analyst-insights.spec.ts` contains `DASH03_REPORT_SCOPE` and `tiles: 5`.
  - The full Strapi suite passed (704/704), and the tree is clean.
- **The plan's verification passed:**
  - `api:check` clean, and the parity and copy guards pass;
  - web 3,169/3,169, typecheck and lint clean;
  - Strapi 704/704;
  - the spec passes 13/13, and full Playwright passes 138/138;
  - the tree is clean after every run;
  - `served-operations.json` is unchanged, and both catalogue copies are byte-identical.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because neither DASH-03 nor UX-09 is ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
