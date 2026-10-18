---
phase: 11-navigation-landing-and-list-clarity
plan: 14
subsystem: api
tags: [risk-register, strapi, knex, openapi, zod, nextjs, vitest, playwright, dash-03, uat-060]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-04: the 'Risk register' heading and page-headings.ts; 11-07: the Related assessment picker; 11-13: openFromNavigation and the search-first E2E pattern"
  - phase: 07-analyst-insights
    provides: "applyDisclosableParent (the register's scope), the D-36 state filter, seed-analyst-insights.ts (the Phase 7 in-review and released Risks)"
provides:
  - "risk-register.ts: applyReleasedParent and applyUnderAssessmentParent (the two named branches of the register's scope), built from private mutableParent and releasedParent bodies; applyDisclosableParent is their union with an unchanged signature"
  - "risk-register.ts: RiskRegisterStage, RiskRegisterItem.stage and .treatmentAction; parentLockOf shared by the detail gate and each row"
  - "risk-register-query.ts: RISK_REGISTER_STAGES (released, under-assessment) and RISK_REGISTER_TREATMENT_ACTIONS (Accept, Treat) as closed filters"
  - "Spec: /v1/risks parameters stage and treatmentAction; RiskRegisterItem.stage (required enum) and .treatmentAction (required, Accept|Treat|null)"
  - "risk-domain.ts: riskRegisterStages, riskRegisterStageLabels, riskTreatmentActions, isAcceptedRiskRow, riskRegisterStageMarker, riskRegisterCardMarker"
  - "Web: the Stage and Treatment action selects and chips, the stage caption under each Related assessment link, Accepted under a released Accept Risk's treatment status, 'Released · Accepted' on its card"
  - "Copy: the register's new description and sheet description; the register page, table and filters in the copy guard"
  - "E2E: DASH03_REGISTER_STAGE (1440) and DASH03_REGISTER_STAGE_CARDS (375, @journey)"
affects: [11-15, 11-16, 11-17, 11-18, 11-21, 17.1, 20]

actuals:
  tokens: 15778
  tasks: 3
  commits: 5
plan_head_before: 60ec627394d047bd0fc667b9d560cfda1f73a424
plan_head_after: 88f3182f2d848b08b686f58c1279cfc4bbaf8a7e

tech-stack:
  added: []
  patterns:
    - "A scope's branches are named once beside it: private branch bodies (mutableParent, releasedParent) feed one parent-subquery builder (whereParent), the union is the scope, and a filter applies one branch on top of the union, so it can only narrow"
    - "A row's derived field reads its populated parent with the same function the detail gate uses (parentLockOf), so the list and detail can never disagree on a parent"
    - "A partition proof pages through the whole register for each branch and asserts disjointness, coverage and summed totals, besides the fixture-level cases"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-risk/services/risk-register.ts
    - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
    - apps/backend/tests/risk-register.unit.test.ts
    - apps/backend/tests/risk-register.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/risks/risk-domain.ts
    - apps/csrm/src/features/risks/risk-domain.test.ts
    - apps/csrm/src/features/risks/risk-schema.ts
    - apps/csrm/src/features/risks/risk-schema.test.ts
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/features/risks/risk-register.test.tsx
    - apps/csrm/src/features/risks/risk-register-filters.tsx
    - apps/csrm/src/features/risks/risk-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/app/(app)/app/risks/page.tsx
    - apps/csrm/app/(app)/app/risks/loading.tsx
    - apps/csrm/app/(app)/app/risks/error.tsx
    - apps/csrm/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "11-14: the stage and treatmentAction parameters sit after asset and before mitigationStatus, so the Phase 7 regexes (state directly after mitigationStatus, the target-date pair directly before sort) still hold; only the exact parameter list in contract-catalogue.integration.test.ts changed"
  - "11-14: a row's stage comes from parentLockOf, the function the detail gate now also uses; a parent in neither branch is a 400 data defect on the list (never a partial page) and stays a 404 on the detail"
  - "11-14: a stored treatmentAction outside Accept/Treat is refused as a 400 data defect, rather than passed through like the unvalidated treatmentStatus"
  - "11-14: hydrate populates the assessment's approvedBy only to decide the stage; the projection never discloses it"
  - "11-14: riskRegisterCardMarker gives the card one caption line ('Released · Accepted'), and the desktop row keeps two (the stage under Related assessment, Accepted under Treatment status), per UI-SPEC 9.5"
  - "11-14: DASH-03 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Named-branch scope: export applyXParent per branch beside the union, and keep the union's exported signature for its other readers (alerts, reports, dashboard)"
  - "E2E for seeded Risks: search by the seeded risk-number prefix (q=RSK-E2E-P7) so records other journeys add never push them off the page"

requirements-completed: []

coverage:
  - id: D1
    description: "The register's scope is exactly two named branches beside it: applyReleasedParent and applyUnderAssessmentParent; applyDisclosableParent is their union, so the register, alerts, reports and dashboard keep the same scope"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register partitions its scope into released and under-assessment stages (D-40)"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (full suite, 695/695, including the alert, report and dashboard suites that call applyDisclosableParent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Released plus under assessment equals the register and the two are disjoint; a partly released assessment's Risks are in neither"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register partitions its scope into released and under-assessment stages (D-40)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#DASH03_REGISTER_STAGE"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /v1/risks accepts stage and treatmentAction as closed filters (anything else is 400) and each row carries its stage and treatment action"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/backend/tests/risk-register.unit.test.ts#the Risk Register parser accepts exactly the released and under-assessment stages (D-40, D-44)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/risk-register.unit.test.ts#the Risk Register parser accepts exactly the Accept and Treat treatment actions (D-44)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register filters by treatment action and serves each row's action (D-44)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the Risk register row with its stage / its treatment action"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each row says Released or Under assessment under its Related assessment link, and Accepted under the treatment status of a released Accept Risk; the card says the same ('Released · Accepted'); never colour alone"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx#marks each row’s stage in text under its Related assessment link and on its card (D-44, UI-D36)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx#marks a released Accept Risk as Accepted under its treatment status and on its card, and no Risk under assessment (D-41, D-44)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#DASH03_REGISTER_STAGE_CARDS ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D5
    description: "More filters and the phone Filters sheet offer Stage (All, Released, Under assessment) and Treatment action (All, Accept, Treat) with chips 'Stage: Released' and 'Treatment action: Accept'; by default every Risk in scope is listed"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx#offers Stage in More filters with its chip, in the phone sheet, and clears it with every filter"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx#offers Treatment action in More filters with its chip, in the phone sheet, and clears it with every filter"
        status: pass
    human_judgment: false
  - id: D6
    description: "The register's description and sheet description name the two stages, and the register files are in the interface copy guard"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts (the three register files)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#Bob filters the Risk Register (E20) and DASH03_REGISTER_STAGE_CARDS (sheet description)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The stage and Accepted captions read well beside the link and the badge at both widths"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx (caption classes text-xs text-foreground-secondary, order after the link and badge)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the caption tokens, order and words; how the two-line cells look in the dense table and on the card is a visual judgment no test asserts"

duration: 1h 3m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 14: Risk register stage and treatment action Summary

**The Risk register now shows, row by row, whether each Risk is released or still under assessment, and marks a released Risk whose treatment action is Accept as "Accepted". It can filter on both. On the server, the register's scope is now two named branches defined next to it. `applyReleasedParent` and `applyUnderAssessmentParent` are built from the same two branch bodies that `applyDisclosableParent` now combines. So the alerts, reports and dashboard keep exactly the scope they had. A stage filter can only narrow the list, and no Risk leaves the register. `GET /v1/risks` accepts the closed `stage` and `treatmentAction` filters, and each row carries both fields. The web shows the stage on a caption line under the Related assessment link, shows Accepted under the treatment status, and adds both filters with their chips. The page description and the sheet description now name the two stages.**

## Performance

- **Duration:** 1h 3m, including two Playwright runs (one full), the full Strapi suite and three full web suites
- **Started:** 2026-10-03T15:03:31Z
- **Completed:** 2026-10-03T16:06:46Z
- **Tasks:** 3 of 3
- **Files changed:** 21 (none created, none deleted)

## Accomplishments

- **Scope branches (`risk-register.ts`):**
  - Private `approverLink`, `mutableParent` and `releasedParent` hold each branch's SQL once.
  - `whereParent(query, eligible)` adds the one parent subquery (`csrm_risks_assessment_lnk` joined to `csrm_assessments`, correlated on `r.id`).
  - `applyReleasedParent` and `applyUnderAssessmentParent` each apply one branch.
  - `applyDisclosableParent` applies `mutableParent OR releasedParent` and keeps its exported signature (`DisclosableParentQuery`). `alert-repository.ts`, `report-repository.ts` and `dashboard-summary.ts` are unchanged.
  - `applyFilters` applies the union first, then the chosen branch, so the stage only narrows (T-11-34).
- **Row fields:**
  - `stage` comes from `parentLockOf`, the parent reading that the detail gate (`parentLock`) now also uses.
  - `treatmentAction` is `Accept`, `Treat` or `null`, and any other stored value is a 400.
  - `hydrate` populates the assessment's `approvedBy` so the stage can be read; the field is never projected.
- **Parser (`risk-register-query.ts`):** adds `RISK_REGISTER_STAGES` and `RISK_REGISTER_TREATMENT_ACTIONS`, and allows the keys `stage` and `treatmentAction`. Any other value, a repeat or an array is a `RiskRegisterQueryError` (400). The treatment action filter is a bound `where('r.treatment_action', value)` from the closed enum (T-11-08).
- **Contract:**
  - `stage` and `treatmentAction` parameters on `/v1/risks`, after `asset`.
  - `RiskRegisterItem.stage` (required enum) and `.treatmentAction` (required, `Accept|Treat|null`).
  - `schema.d.ts` regenerated, and `api:check` is clean.
  - The operation, route and grant are unchanged. `served-operations.json` is unchanged and its drift check passes. Both catalogue copies are byte-identical (`cmp`).
- **Web (`risk-domain.ts`, zod-free):**
  - `riskRegisterStages` and `riskRegisterStageLabels` (`Released`, `Under assessment`), and `riskTreatmentActions`.
  - `isAcceptedRiskRow(row) = stage === 'released' && treatmentAction === 'Accept'`.
  - `riskRegisterStageMarker` and `riskRegisterCardMarker`.
  - `readRiskRegisterQuery` reads both new filters exactly as the zod schema does.
- **Web (schemas and UI):**
  - `riskRegisterQuerySchema` and `serializeRiskRegisterQuery` carry `stage` and `treatmentAction`, and `riskRegisterItemSchema` requires both fields.
  - `RelatedAssessment` shows the link and the stage caption. `TreatmentStatusCell` shows the badge, plus the `Accepted` caption for a released Accept Risk.
  - The card ends with one caption line: `Released`, `Under assessment` or `Released · Accepted`.
  - The `Stage` and `Treatment action` selects follow `Risk state` in More filters and in the phone sheet. Chips read `Stage: Released` and `Treatment action: Accept`, and Clear filters resets both.
- **Copy (D-54):**
  - `page.tsx`, `loading.tsx` and `error.tsx` read "Search and manage Risks from released risk assessments and from those still under assessment."
  - The sheet reads "Search and filter Risks."
  - The copy guard scans `app/(app)/app/risks/page.tsx`, `risk-register.tsx` and `risk-register-filters.tsx`, and its header no longer excludes the Risk register.

## Task Commits

1. **Task 1: The Risk register filters by stage and says each row's stage (tracer, TDD)**
   - `a913681`: test(11-14), RED
   - `15b8551`: feat(11-14), GREEN
2. **Task 2: Filter by treatment action and mark accepted Risks (TDD)**
   - `917a1a0`: test(11-14), RED
   - `979d9b9`: feat(11-14), GREEN
3. **Task 3: Replace the "contextual" description, guard the copy, prove the stage in the browser, run the Strapi suite**
   - `88f3182`: feat(11-14)

The ledger count is `git rev-list --count 60ec627..88f3182` = 5. Every commit ends with the `Co-Authored-By` trailer (checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `a913681` comes before GREEN `15b8551`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) on a TAP run of the two register files. The target was "mounted Risk Register partitions its scope into released and under-assessment stages (D-40)".
  - It failed on `RISK_STAGE_PAGE_FAILED_{"stage":"released"}: 400 CSRM Risk Register query is invalid.`
  - The run failed 5 of 30: the partition, the row key list, the stage parser, the projection allowlist and the stage projection.
  - The web RED run failed 9 of 288 tests across the schema, the parity guard, the register render and filter cases and the service fixture, each on an assertion.
- **Task 2:** RED `917a1a0` comes before GREEN `979d9b9`.
  - `RED_EVIDENCE_OK` for "mounted Risk Register filters by treatment action and serves each row's action (D-44)". It failed on `RISK_ACTION_ROWS`, because the rows carried no `treatmentAction`.
  - The Strapi run failed 5 of 33. The web run failed 16 of 299: `isAcceptedRiskRow` and `riskRegisterCardMarker` were not yet functions, and the rest were assertions.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree, and it exited 0: web 288/288, `api:check` clean, typecheck clean, Strapi files 30/30. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED, web (`src/features/risks`, parity) | 9 failed, 279 passed (288) |
| Task 1 RED, Strapi (register unit and integration) | 5 failed, 25 passed (30) |
| Task 1 GREEN verify | web 9 files, 288/288; `api:check` 0; typecheck clean; Strapi 30/30, plus `contract-catalogue` (47/47 with it, 62 s) |
| Task 1 full web suite | 141 files, 3,101/3,101 |
| Task 2 RED | web 16 failed of 299; Strapi 5 failed of 33 |
| Task 2 GREEN verify | web 299/299; `api:check` 0; typecheck clean; Strapi 50/50 with `contract-catalogue` |
| Task 2 full web suite | 141 files, 3,112/3,112 |
| Task 3 guard and register (`interface-copy-guard`, `src/features/risks`) | 9 files, 222/222 |
| Playwright `risk-register-workflow.spec.ts` | **6 passed: desktop 4, mobile 2; 0 failed, 0 flaky, 0 skipped; 2.2 min.** Tree identical before and after |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **695/695, 0 fail, 0 cancelled, 0 skipped; 822.6 s (13.7 min)**. 11-10 ended at 689, and this plan adds 6. Tree identical before and after |
| **Final full web suite** (`pnpm --dir apps/csrm test`) | **141 files, 3,115/3,115** (11-13 ended at 3,096) |
| `typecheck` and `lint` | clean |
| `api:check` | exit 0; `schema.d.ts` matches the committed contract after `git update-index --refresh` |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`) | **131 passed: desktop 111, mobile 20; 0 failed, 0 flaky, 0 skipped; 16.3 min** (11-13: 128, desktop 109 and mobile 19). `git status --short` identical before and after the run |

The production server in the full run logged 174 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-13 logged 132 and 1). Every test passed.

## E2E Assertions Changed

- **E20:** `risk-register-workflow.spec.ts:382` (the plan said 376) now reads the new description.
- **New proofs:**
  - `DASH03_REGISTER_STAGE`, at 1440 and desktop only. As the Security Analyst it loads `/app/risks?stage=under-assessment&q=RSK-E2E-P7`, which lists the four seeded in-review Risks, each with `Under assessment` and no `Released`, plus the `Stage: Under assessment` chip. `?stage=released&q=RSK-E2E-P7` lists `RSK-E2E-P7-RELEASED-001` with `Released` and none of the four. The released and under-assessment totals sum to the unfiltered `/app/risks` total.
  - `DASH03_REGISTER_STAGE_CARDS` (`@journey`, which sets 375 itself, so it runs in both projects). The cards say `Under assessment` and `Released`, and the Filters sheet holds `Stage` = `under-assessment` and the description "Search and filter Risks."
- **Search, not position:** the seeded rows are found by their risk-number prefix (`q=RSK-E2E-P7`), so records other journeys add cannot push them off the page (11-13's lesson).
- **Grep for the old copy:** no other E2E assertion names the register description or the sheet description. The remaining "contextual" strings in `analyst-insights.spec.ts:599` and `design-system-conformance.spec.ts:237` belong to the exposure list, which plans 11-16 and 11-17 own.

## Files Created/Modified

- `apps/backend/src/api/csrm-risk/services/risk-register.ts`: the branch bodies, `whereParent`, the two branch functions, the union, `parentLockOf`, the stage and treatment action projections, the filters, and the `approvedBy` populate
- `apps/backend/src/api/csrm-risk/services/risk-register-query.ts`: the two vocabularies, the filter keys and their parsing
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the parameters and row fields
- `apps/csrm/src/features/risks/risk-domain.ts`, `risk-schema.ts`, `risk-register.tsx`, `risk-register-filters.tsx`: vocabularies, helpers, schemas, markers, selects and chips
- `apps/csrm/app/(app)/app/risks/page.tsx`, `loading.tsx`, `error.tsx`: the description
- Tests:
  - Strapi: `risk-register.unit.test.ts`, `risk-register.integration.test.ts`, `contract-catalogue.integration.test.ts`
  - Web: `risk-domain.test.ts`, `risk-schema.test.ts`, `risk-register.test.tsx`, `risk-service.test.ts`, `contract-response-parity.test.ts`, `interface-copy-guard.test.ts`
  - E2E: `risk-register-workflow.spec.ts`

## Decisions Made

- **Where the parameters sit.** `stage` and `treatmentAction` follow `asset`. Two Phase 7 regexes in `contract-catalogue.integration.test.ts` pin `state` directly after `mitigationStatus` and the target-date pair directly before `sort` in the generated query type. Placing the new filters before `mitigationStatus` keeps both regexes intact. Only the exact parameter-list assertion changed.
- **One parent reading.** `parentLock` (detail, 404) and the row's `stage` (list, 400 on a defect) both call `parentLockOf`. This is the in-memory twin of `mutableParent` and `releasedParent`, as the plan's "as `parentLock` decides" asks.
- **Strict treatment action.** The row refuses a stored value outside the JDL enumeration rather than passing it through. The client parser is closed on `Accept|Treat|null`, so passing it through would turn a data defect into a broken page.
- **Card marker.** One caption line, `Released · Accepted` (UI-SPEC §9.5). The desktop row keeps the stage under Related assessment and Accepted under Treatment status.
- **DASH-03 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] A contract test outside the plan's file list pinned the old parameter list**
- **Found during:** Task 1, while grepping for every assertion on the register's shape before GREEN.
- **Issue:** `contract-catalogue.integration.test.ts:566` asserts the exact `/v1/risks` parameter names, so adding `stage` and `treatmentAction` would fail the full Strapi suite.
- **Fix:** The expected list gains `stage` (in the Task 1 RED commit) and `treatmentAction` (in the Task 2 RED commit), and its comment says why they sit after `asset`. That placement also keeps the file's two Phase 7 regexes green, unedited.
- **Files modified:** `apps/backend/tests/contract-catalogue.integration.test.ts`
- **Verification:** It ran with each GREEN verify (47/47, 50/50) and in the full suite (695/695).
- **Committed in:** `a913681`, `917a1a0`

**2. [Rule 3: blocking] Register fixtures outside the plan's file list lacked the new row fields**
- **Issue:**
  - The unit test's `riskDocument` fixture had no parent status, which the projection now needs to decide the stage.
  - `risk-service.test.ts`'s register payload would fail the closed row parser without `stage` and `treatmentAction`.
  - `risk-domain.test.ts` holds `readRiskRegisterQuery` and the zod schema to the same results, so it needed both new filters in its cases.
- **Fix:**
  - `riskDocument` carries an in-review parent with no release facts.
  - The service payload carries `stage: 'under-assessment'` and `treatmentAction: null`.
  - The domain cases carry valid and invalid values of both filters. That file also gained the `isAcceptedRiskRow` and card-marker cases.
- **Committed in:** `a913681`, `917a1a0`

**3. [Rule 1: consistency] The register's unit fixtures still rendered the old page description**
- **Issue:** `risk-register.test.tsx` renders `PageHeader` with the page's description in 7 places, and all of them carried the retired "contextual" sentence.
- **Fix:** They carry the new description, committed with the copy change in Task 3.
- **Committed in:** `88f3182`

**4. [Plan line drift] E20's line**
- The description assertion was at `risk-register-workflow.spec.ts:382`, not 376. It was changed there.

---

**Total deviations:** 4: 2 blocking fixes outside the file list, 1 fixture consistency fix and 1 line-number drift.
**Impact on plan:** No added scope. No content-type change, no new operation, Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC). The route, the grant and the analyst-only scope are unchanged.

## Issues Encountered

- A Python heredoc swallowed one backslash-escaped apostrophe in a vitest title, so the first RED run of `risk-schema.test.ts` failed at transform. It was fixed before the RED evidence run, and the evidence comes from the clean run.
- `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files (CRLF/LF stat). They stay untouched and unstaged.
- The session scratchpad held a `red1-strapi.log` from an earlier plan. It was deleted before this plan's evidence runs, so no stale log was read as evidence.

## Known Stubs

None. Every marker and filter reads a real server field. `Accepted` here marks the recorded decision on a released Risk. Phase 17.1 refines it with acceptance facts (D-41), and the exposure counts in 11-16 and 11-17 add the open-Risk condition on the server.

## Threat Flags

None. No new endpoint, route, grant or table. The two new query values are closed enums that map to branch functions or a bound `where` (T-11-08). The union stays the first predicate, so a stage only narrows the scope, and the partition test proves that a partly released assessment's Risks stay out (T-11-34). The row discloses only the stage and the treatment action. The approver it reads is never projected.

## User Setup Required

None.

## Next Phase Readiness

- **11-15 (the other figure filters):**
  - Add each filter beside `stage` and `treatmentAction` in `RISK_REGISTER_*`, `assertOnlyKeys`, `applyFilters`, the spec (after `treatmentAction` keeps the Phase 7 regexes green), `riskRegisterQuerySchema`, `readRiskRegisterQuery`, `filterKeys`, the chips and `clearFilters`.
  - Then update the exact parameter list in `contract-catalogue.integration.test.ts`.
- **11-16 and 11-17 (exposure):**
  - Count released Risks with `applyReleasedParent` and Risks under assessment with `applyUnderAssessmentParent`, each followed by `whereNull('r.closure_date')`. The branches accept knex's builder through `DisclosableParentQuery`.
  - An "Accepted" figure is `applyReleasedParent` + `r.treatment_action = 'Accept'` + open, and it links to `/app/risks?stage=released&treatmentAction=Accept&state=open`. That list total is proved equal in the integration test.
  - UI-SPEC §9.5's accepted browser proof still needs the released, open, accepted seed Risk (D-45).
- **Quick find (11-18/11-19):** a Risk line can show `riskRegisterStageLabels[row.stage]`.

## Self-Check: PASSED

- Commits `a913681`, `15b8551`, `917a1a0`, `979d9b9` and `88f3182` exist on `post-demo`, and each carries the trailer.
- Task 1 acceptance re-ran PASS:
  - `risk-register.ts` exports `applyReleasedParent` and `applyUnderAssessmentParent`, and `applyDisclosableParent<T extends DisclosableParentQuery>(query: T): T` is unchanged (3 matches).
  - `RiskRegisterItem.required` contains `stage`, and `/v1/risks` `stage` is `["released","under-assessment"]`.
  - `risk-register.tsx` reads `riskRegisterStageLabels`.
  - The verify exited 0, twice (GREEN and the tracer re-run).
- Task 2 acceptance re-ran PASS:
  - `risk-register-query.ts` exports `RISK_REGISTER_TREATMENT_ACTIONS` and allows `"treatmentAction"`.
  - `risk-domain.ts` exports `isAcceptedRiskRow`, and `risk-register.tsx` renders `Accepted` from it.
  - The verify passed.
- Task 3 acceptance re-ran PASS:
  - `page.tsx` contains the new description (1 match).
  - The guard lists the three register files (3 matches).
  - The spec contains `DASH03_REGISTER_STAGE` (2 matches).
  - The full Strapi suite passed (695/695), and the tree was clean.
- The plan's verification passed:
  - `api:check` clean;
  - the parity guard and copy guard pass;
  - web 3,115/3,115, typecheck and lint clean;
  - Strapi 695/695;
  - full Playwright 131/131;
  - the tree is clean after every run.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because DASH-03 is not ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
