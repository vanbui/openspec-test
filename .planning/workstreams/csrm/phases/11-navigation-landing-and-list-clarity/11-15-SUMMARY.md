---
phase: 11-navigation-landing-and-list-clarity
plan: 15
subsystem: api
tags: [risk-register, strapi, knex, openapi, zod, nextjs, vitest, playwright, ux-09, uat-048, g-16]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-14: applyReleasedParent and applyUnderAssessmentParent, the stage and treatmentAction filters and their place in the parameter list; 11-07: the Related assessment picker's '{number} · {request title}' labels"
  - phase: 07-analyst-insights
    provides: "deriveTreatmentDueState (D-04), ALERT_DUE_SOON_WINDOW_DAYS, the report repository's notRated and notProvided populations, seed-analyst-insights.ts"
provides:
  - "treatment-due-state.ts: TREATMENT_DUE_DATE_COLUMN ('r.target_date') and applyTreatmentDueStatePredicate(query, state, { today, windowDays }), the SQL mirror of deriveTreatmentDueState, with the Phase 20 (G-16) switch comment beside both"
  - "GET /v1/risks: dueState (the five due states, on the list's UTC today, 14-day window); 'none' for inherentRating, residualRating and treatmentStatus; mitigationStatus=any; mitigationEffectiveness (the four ratings and none); impactedSystem=none (400 beside system)"
  - "RiskRegisterRepository.count(filters, today) and selectPage({ ..., today }): the count and the page read the same today"
  - "The assessment selected label reads '{assessment number} · {request title}', or the number alone (D-32)"
  - "risk-register-query.ts: RISK_REGISTER_DUE_STATES, RISK_REGISTER_RATING_FILTERS, RISK_REGISTER_TREATMENT_STATUS_FILTERS, RISK_REGISTER_EFFECTIVENESS_RATINGS, RISK_REGISTER_MITIGATION_EFFECTIVENESS, RISK_REGISTER_IMPACTED_SYSTEM; 'any' in RISK_REGISTER_MITIGATION_STATUSES"
  - "risk-domain.ts: riskTreatmentDueStateLabels, riskRegisterRatingFilterValues and riskRegisterRatingFilterLabel, riskRegisterTreatmentStatusFilterValues, riskRegisterMitigationStatusLabels, riskRegisterEffectivenessValues and labels, riskRegisterImpactedSystemValues"
  - "Web: Not rated and Not provided options and chips, the Due state and Mitigation-control effectiveness selects, Any mitigation control, the No impacted system checkbox, their chips, and a chip label that falls back to the picker's option"
  - "Harness: createRiskRegisterMitigationFixture takes extra fields; writeStoredValueFixture writes a legacy value off the JDL vocabulary"
  - "E2E: UX09_REGISTER_FIGURE_FILTERS (1440) and UX09_REGISTER_FIGURE_FILTERS_SHEET (375, @journey)"
affects: [11-16, 11-17, 11-18, 11-21, 20]

actuals:
  tokens: 31947
  tasks: 3
  commits: 6
plan_head_before: 92cb17d9088d97b0a5155f51a208a740f30b07ab
plan_head_after: d267bf6ccc27bc4f11b0ccfb5316a4d093095660

tech-stack:
  added: []
  patterns:
    - "One rule, two forms: the per-record rule and its SQL mirror live in one module and read one governing-date constant, and an integration test proves the SQL lists exactly what the rule derives over every boundary"
    - "A 'none' filter value means null or off the vocabulary, the same population the report counts as notRated or notProvided, proved equal to the report figure over the whole open register"
    - "A value that cannot share a key with an id (no impacted system) gets its own key with a one-value enum, refused beside the id key"

key-files:
  created: []
  modified:
    - apps/backend/src/csrm/insights/treatment-due-state.ts
    - apps/backend/src/api/csrm-risk/services/risk-register.ts
    - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
    - apps/backend/tests/analyst-insights.unit.test.ts
    - apps/backend/tests/risk-register.unit.test.ts
    - apps/backend/tests/risk-register.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/risks/risk-domain.ts
    - apps/csrm/src/features/risks/risk-domain.test.ts
    - apps/csrm/src/features/risks/risk-schema.ts
    - apps/csrm/src/features/risks/risk-schema.test.ts
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/features/risks/risk-register.test.tsx
    - apps/csrm/src/features/risks/risk-register-filters.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "11-15: applyTreatmentDueStatePredicate takes any builder with whereRaw (TreatmentDueStateQuery), so 11-17's report and alert repositories can call it on knex directly; it validates today and windowDays as deriveTreatmentDueState does and refuses a state outside the vocabulary"
  - "11-15: the new parameters sit after treatmentAction and before mitigationStatus (dueState, mitigationEffectiveness, impactedSystem), so the Phase 7 state-position assertion and the target-date regex hold; the Phase 7 generated-query regex gains '| \"any\"'"
  - "11-15: the rating parameters inline ['Low','Moderate','High','Critical','none'] instead of $ref AssessmentRating, so the AssessmentRating component (and every response that uses it) keeps its four values"
  - "11-15: the web parser drops impactedSystem when a system is chosen (zod .overwrite keeps the ZodObject shape), so the client never sends the pair Strapi refuses; the No impacted system checkbox and the system picker clear each other"
  - "11-15: no impacted system means no link to an existing Information System, read as the report reads risksWithoutSystem"
  - "11-15: UX-09 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Seam proof: a unit test asserts the module exports the rule, its SQL mirror and the governing-date constant, and that the source carries the switch comment; the integration test asserts equality on real SQLite"
  - "Off-vocabulary fixtures: writeStoredValueFixture writes past the Document Service's enum validation, so a 'none' filter is proved on legacy values, not only on nulls"

requirements-completed: []

coverage:
  - id: D1
    description: "The due state keeps one shared rule: deriveTreatmentDueState for one Risk and applyTreatmentDueStatePredicate for a list or count, in treatment-due-state.ts, both reading TREATMENT_DUE_DATE_COLUMN, with the Phase 20 (G-16) switch comment"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/backend/tests/analyst-insights.unit.test.ts#the due-state rule and its SQL mirror share one module and one governing date (G-16)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /v1/risks?dueState lists exactly the Risks deriveTreatmentDueState gives each state on the server's UTC today, with the 14-day window, under both stages, with exact totals"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register lists each due state exactly as the one due-state rule derives it (D-35, G-16)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/risk-register.unit.test.ts#the Risk Register parser accepts exactly the five treatment due states (D-35, G-16)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#UX09_REGISTER_FIGURE_FILTERS"
        status: pass
    human_judgment: false
  - id: D3
    description: "The none values for both ratings and treatment status list null or off-vocabulary values and equal the reports' notRated and notProvided over the open register"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register lists the Risks with no rating or treatment status, as the reports count them (D-35)"
        status: pass
    human_judgment: false
  - id: D4
    description: "mitigationStatus=any, mitigationEffectiveness (and none) and impactedSystem=none list exactly their Risks; impactedSystem beside system is a 400; system=none stays an id search; the assessment label reads its number and request title"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/risk-register.integration.test.ts#mounted Risk Register lists Risks by mitigation control, its effectiveness and no impacted system (D-35)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/risk-register.unit.test.ts#the Risk Register parser accepts the none, any, effectiveness and no-system figure filters (D-35)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The specification publishes the five new or widened /v1/risks parameters, the client is regenerated, and the web parser keeps exactly each published value"
    requirement: "UX-09"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#reads each Risk register figure filter closed on its published values (D-02 item 3, D-35)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts (exact /v1/risks parameter list, Phase 7 regexes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The register offers Not rated, Not provided, Due state, Mitigation-control effectiveness, Any mitigation control and the No impacted system checkbox, with the UI-SPEC §9.5 chips, in More filters and the phone sheet"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx (the Due state, core none options, effectiveness and any, and no impacted system cases)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#UX09_REGISTER_FIGURE_FILTERS and UX09_REGISTER_FIGURE_FILTERS_SHEET ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Related assessment chip reads 'Related assessment: {number} · {request title}', and the long chip wraps inside its box at 375"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx#names the Related assessment chip by its number and request title (D-32)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#UX09_REGISTER_FIGURE_FILTERS_SHEET (UX09_SHEET_LONG_CHIP_WRAPS_INSIDE_ITS_BOX)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The new controls read well in the More filters popover and the phone sheet (order, spacing, the checkbox under the picker)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx (control order after Treatment action and Due state)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the controls' order, words and values; how the longer More filters panel and the checkbox under the picker look is a visual judgment no test asserts"

duration: 1h 19m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 15: Risk register figure filters and the shared due-state rule Summary

**The Risk register can now list exactly the Risks behind each figure that counts them. `GET /v1/risks` accepts `dueState`, plus "none" for both ratings and the treatment status, `mitigationStatus=any`, `mitigationEffectiveness` and `impactedSystem=none`. The `dueState` filter is the SQL mirror of the one due-state rule. It sits beside `deriveTreatmentDueState` in `treatment-due-state.ts` and reads the one governing-date column, so Phase 20 changes every due or overdue figure in one place. An integration test proves the filter lists exactly what the rule derives at every boundary date. Each "none" list equals the report figure that counts it. The register shows the new options, controls and chips, and the Related assessment chip reads "{number} · {request title}".**

## Performance

- **Duration:** 1h 19m. This includes two spec runs, the full Strapi suite, the full Playwright suite and two full web suites.
- **Started:** 2026-10-03T16:11:24Z
- **Completed:** 2026-10-03T17:30:41Z
- **Tasks:** 3 of 3
- **Files changed:** 19 (none created, none deleted)

## Accomplishments

- **The shared rule (`treatment-due-state.ts`, the G-16 switch point):**
  - `TREATMENT_DUE_DATE_COLUMN = "r.target_date"`.
  - `applyTreatmentDueStatePredicate(query, state, { today, windowDays = ALERT_DUE_SOON_WINDOW_DAYS })` follows the rule's order:
    - `complete-or-closed` is `(r.closure_date IS NOT NULL OR r.treatment_status = 'Complete')`.
    - Every other state starts from the open condition `(r.closure_date IS NULL AND (r.treatment_status IS NULL OR r.treatment_status <> 'Complete'))`.
    - It then adds one of four conditions on the date: `IS NULL`, `< today`, `>= today AND <= today+window`, or `> today+window`.
    - `Complete`, `today` and the window end are bound parameters.
  - It validates `today` and `windowDays` exactly as `deriveTreatmentDueState` does (shared `assertRuleInputs`), and refuses a state outside the vocabulary.
- **The G-16 comment, as written** (above both functions):
  > G-16 seam. Phase 20 (G-16) switches this rule's governing date from targetDate to treatmentResolveDate (falling back to targetDate for a treated Risk without one). Every due or overdue figure reads it here: deriveTreatmentDueState for one Risk, applyTreatmentDueStatePredicate for a list or a count.

  `deriveTreatmentDueState`'s own comment adds: "applyTreatmentDueStatePredicate below is this rule in SQL. Phase 20 (G-16) switches this rule's governing date from targetDate to treatmentResolveDate, here and in that predicate together." The predicate's comment carries the matching sentence.
- **Register (`risk-register.ts`, `risk-register-query.ts`):**
  - `applyFilters(query, filters, today)` calls the predicate with `ALERT_DUE_SOON_WINDOW_DAYS`. `listRiskRegister` passes its `today` to `count(filters, today)` and `selectPage({ …, today })`, so the total always equals the rows.
  - **None values:** a rating "none" is `(col IS NULL OR col NOT IN ('Low','Moderate','High','Critical'))`. A treatment status "none" is the same over the JDL's four statuses. Both vocabularies are bound.
  - **Mitigation controls:**
    - `mitigationStatus=any` is `EXISTS` on an implementation, so a Risk with several controls is listed once.
    - `mitigationEffectiveness={rating}` is `EXISTS` on an implementation with that rating.
    - `mitigationEffectiveness=none` is `EXISTS` on an implementation whose rating is null or off the vocabulary.
  - **No impacted system:** `impactedSystem=none` is `NOT EXISTS` on a link to an existing Information System. The parser refuses it beside `system`.
  - The assessment selected label populates the request title and reads `{number} · {title}`, or the number alone.
- **Contract:**
  - **Specification:**
    - `dueState` takes the five states.
    - `none` is added to `treatmentStatus`, `inherentRating` and `residualRating` (the ratings inline the ladder plus `none`).
    - `any` is added to `mitigationStatus`.
    - `mitigationEffectiveness` and `impactedSystem` are new. Each new or widened parameter has a description.
  - `schema.d.ts` is regenerated, and `api:check` is clean.
  - The operation, route and grant are unchanged. The served-operations drift check passes, `served-operations.json` is unchanged, and both catalogue copies are byte-identical (`cmp`).
- **Web:**
  - **Vocabularies and labels** (zod-free `risk-domain.ts`):
    - Due state: `Overdue`, `Due soon`, `Due later`, `No target date`, `Complete or closed`.
    - Effectiveness: the four JDL ratings, then `Not provided`.
    - Mitigation status: `No mitigation controls`, `Any mitigation control`.
    - `Not rated` and `Not provided`.
  - **Parsers:** `readRiskRegisterQuery` and `riskRegisterQuerySchema` read every new key the same way. A chosen system wins over `impactedSystem`.
  - **Core selects:** both ratings gain `Not rated`, and treatment status gains `Not provided`.
  - **More filters and the phone sheet:**
    - `Due state` and `Mitigation-control effectiveness` follow `Treatment action`.
    - `Mitigation-control status` gains `Any mitigation control`.
    - The `No impacted system` checkbox (shadcn `Checkbox`) sits under the Impacted system picker. Each clears the other.
  - **Chips:** `Due state: Due later`, `Mitigation-control effectiveness: Effective`, `Mitigation-control status: Any mitigation control`, `Impacted system: None`, `Residual rating: Not rated` and `Treatment status: Not provided`. Clear filters resets every new key.
  - **Assessment chip:** when the server sends no label, it falls back to the picker option's `{number} · {title}`.

## Task Commits

1. **Task 1: dueState through the one due-state rule (tracer, TDD)**
   - `d4f21dd`: test(11-15), RED
   - `5b0bf79`: feat(11-15), GREEN
2. **Task 2: none, any, effectiveness, no system and the assessment label (TDD)**
   - `18ee925`: test(11-15), RED
   - `dca0580`: feat(11-15), GREEN
3. **Task 3: browser proofs and the Strapi suite**
   - `ce03852`: test(11-15), the two E2E tests
   - `d267bf6`: test(11-15), the long-chip wrap proof (deviation 6)

The ledger count is `git rev-list --count 92cb17d..d267bf6` = 6. Every commit ends with the `Co-Authored-By` trailer (6 of 6, checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `d4f21dd` comes before GREEN `5b0bf79`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed). The target was "mounted Risk Register lists each due state exactly as the one due-state rule derives it (D-35, G-16)".
  - It failed on `RISK_DUE_PAGE_FAILED_{"dueState":"overdue"}: 400 CSRM Risk Register query is invalid`.
  - The Strapi run failed 4 of 70: the seam case (`THE_SQL_MIRROR_IS_NOT_BESIDE_THE_RULE`), the equivalence case, the parser case and the today-passing case.
  - The web run failed 4 of 302, each on an assertion: the contract enum, the labels, the parity guard and the Due state control.
- **Task 2:** RED `18ee925` comes before GREEN `dca0580`.
  - `RED_EVIDENCE_OK` for "mounted Risk Register lists Risks by mitigation control, its effectiveness and no impacted system (D-35)". It failed with a 400 on `mitigationStatus=any`.
  - The Strapi run failed 5 of 55: the two integration cases, the parser case, the catalogue's exact parameter list and the Phase 7 generated-query regex.
  - The web run failed 7 of 309, each on an assertion or a missing control.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree, and it exited 0: web 302/302, `api:check` clean, typecheck clean, Strapi files 70/70. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED | web 4 failed of 302; Strapi 4 failed of 70 |
| Task 1 GREEN verify | web 9 files, 302/302; `api:check` 0; typecheck clean; Strapi 87/87 with `contract-catalogue` (57.9 s); served-operations 8/8 |
| Task 1 tracer re-run | exit 0 (web 302/302, Strapi 70/70) |
| Task 2 RED | web 7 failed of 309; Strapi 5 failed of 55 |
| Task 2 GREEN verify | web 309/309; `api:check` 0; typecheck clean; Strapi 90/90 with `contract-catalogue` and `analyst-insights` (67.6 s); served-operations 8/8 |
| Full web suite after Task 2 | 141 files, 3,125/3,125 |
| Playwright `risk-register-workflow.spec.ts` | **9 passed: desktop 6, mobile 3; 0 failed, 0 flaky, 0 skipped; 2.3 min.** Tree identical before and after |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **701/701, 0 fail, 0 cancelled, 0 skipped; 821.1 s (13.7 min)**. 11-14 ended at 695, and this plan adds 6. The run changed no file. The before and after listings differ only by my own two test edits made while it ran (see Issues) |
| Playwright, the sheet journey alone (`--grep UX09_REGISTER_FIGURE_FILTERS_SHEET`) | 2 passed (desktop and mobile), 58.3 s. Tree identical |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`) | **134 passed: desktop 113, mobile 21; 0 failed, 0 flaky, 0 skipped; 15.0 min** (11-14: 131, desktop 111 and mobile 20). `git status --short` identical before and after |
| **Final full web suite** (`pnpm --dir apps/csrm test`) | **141 files, 3,125/3,125** (11-14 ended at 3,115) |
| `typecheck` and `lint` | clean |
| `api:check` | exit 0; `schema.d.ts` matches the committed contract after `git update-index --refresh` |

The production server in the full run logged 140 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-14 logged 174 and 1). Every test passed.

## E2E Assertions Added

- **`UX09_REGISTER_FIGURE_FILTERS`** (1440, Security Analyst, desktop only):
  - `/app/risks?dueState=overdue&q=RSK-E2E-P7` lists `RSK-E2E-P7-OVERDUE-001` with the chip `Due state: Overdue`, and not the due-soon Risk. `dueState=due-soon` is the reverse, with `Due state: Due soon`.
  - Choosing `Any mitigation control` and `No impacted system` in More filters shows both chips and a total at or below the register's. `Clear filters` restores the exact total.
  - Choosing the seeded assessment in the picker shows `Related assessment: ASM-DEV-RISK-001 · Customer portal penetration test findings`.
- **`UX09_REGISTER_FIGURE_FILTERS_SHEET`** (`@journey`, 375, so it runs in both projects):
  - The Filters sheet scrolls to `Due state`, sets `Overdue`, and lists the overdue card but not the due-soon card, with the chip.
  - The long Related assessment chip stays inside its box and the viewport, and the page does not overflow horizontally.
- **Search, not position:** the seeded rows are found by `q=RSK-E2E-P7`, as 11-13 and 11-14 do.
- **No existing E2E assertion changed.** The grep found no other assertion on the register's chips, the old mitigation-status option or the parameter list.

## Files Created/Modified

- `apps/backend/src/csrm/insights/treatment-due-state.ts`: the column constant, the predicate, the shared input check and the G-16 comment
- `apps/backend/src/api/csrm-risk/services/risk-register-query.ts`: the vocabularies, keys, parsing and the impactedSystem/system refusal
- `apps/backend/src/api/csrm-risk/services/risk-register.ts`: today through count and page, the due-state, none, any, effectiveness and no-system predicates, and the assessment label
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the parameters
- `apps/csrm/src/features/risks/risk-domain.ts`, `risk-schema.ts`, `risk-register.tsx`, `risk-register-filters.tsx`: the vocabularies, labels, parsers, controls and chips
- Tests:
  - Strapi: `analyst-insights.unit.test.ts`, `risk-register.unit.test.ts`, `risk-register.integration.test.ts`, `contract-catalogue.integration.test.ts`, `helpers/strapi-http-harness.ts`
  - Web: `risk-domain.test.ts`, `risk-schema.test.ts`, `risk-register.test.tsx`, `contract-response-parity.test.ts`
  - E2E: `risk-register-workflow.spec.ts`

## Decisions Made

- **Builder type.** The predicate takes `TreatmentDueStateQuery` (`whereRaw(sql, bindings?)`). Both the register's `QueryBuilder` and knex's builder satisfy it, so 11-17 can call it in `report-repository.ts` and `alert-repository.ts` unchanged.
- **Parameter placement.** `dueState`, `mitigationEffectiveness` and `impactedSystem` follow `treatmentAction`. The Phase 7 assertion that `state` follows `mitigationStatus`, and the regex that puts the target-date pair before `sort`, therefore still hold. Only the exact list and the generated-query regex (`| "any"`) changed.
- **Inline rating enums.** The rating parameters inline the ladder plus `none`, so the shared `AssessmentRating` component keeps exactly four values for every response that uses it. The catalogue test pins that component (`contract-catalogue.integration.test.ts:429`).
- **System wins.** The web parser drops `impactedSystem` when a system is chosen. It uses zod's `.overwrite`, which keeps the object's `.shape` that the contract test reads. A hand-written URL with both therefore lists by the system instead of failing on Strapi's 400.
- **No impacted system** means no link to an existing Information System, as `report-repository.ts` counts `risksWithoutSystem`.
- **Chip fallback (D-32).** A chip names its record by the server's selected label, else by the picker option's label, else by the id. The assessment chip therefore reads `{number} · {title}` before the server answers, for example in the loading state.
- **UX-09 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] The catalogue contract test pinned the old parameter list and the Phase 7 mitigationStatus regex**
- **Found during:** Tasks 1 and 2, grepping before each GREEN.
- **Issue:** `contract-catalogue.integration.test.ts:566` asserts the exact `/v1/risks` parameter names. Its Phase 7 regex pins `mitigationStatus?: … | "none";` directly before `state`.
- **Fix:**
  - The list gains `dueState` (Task 1 RED), then `mitigationEffectiveness` and `impactedSystem` (Task 2 RED).
  - The regex gains `| "any"`.
  - The comment says where the new filters sit.
- **Files modified:** `apps/backend/tests/contract-catalogue.integration.test.ts`
- **Verification:** It ran in each GREEN verify (87/87, 90/90) and in the full suite (701/701).
- **Committed in:** `d4f21dd`, `18ee925`

**2. [Rule 3: blocking] The off-vocabulary fixtures need a raw write, and the mitigation fixture needed an effectiveness rating**
- **Issue:**
  - `treatmentStatus` and `effectivenessRating` are enumerations, so the Document Service refuses a legacy value like `Deferred` or `Unrated`. The plan's "null or off the vocabulary" cannot be proved through it.
  - `createRiskRegisterMitigationFixture` took no rating.
- **Fix:**
  - The fixture takes optional extra fields.
  - `writeStoredValueFixture(table, documentId, column, value)` writes one value straight to its column. The table and column are closed unions, and the helper throws if no row matched.
- **Files modified:** `apps/backend/tests/helpers/strapi-http-harness.ts`
- **Committed in:** `18ee925`

**3. [Rule 3: consistency] The zod-free URL reader must read the new keys exactly as the schema does**
- **Issue:** `risk-domain.test.ts` holds `readRiskRegisterQuery` and `parseRiskRegisterQuery` to the same results. Without the new keys in its cases, it would not hold them to it.
- **Fix:** The valid and invalid cases carry `dueState`, `mitigationEffectiveness` and `impactedSystem`. Two new cases cover the none and any values, and a chosen system beside `impactedSystem`.
- **Committed in:** `d4f21dd`, `18ee925`

**4. [Acceptance grep against the design] "Any mitigation control" lives in `risk-domain.ts`, not literally in `risk-register-filters.tsx`**
- **Criterion:** Task 2's acceptance greps `risk-register-filters.tsx` for `No impacted system`, `Any mitigation control` and `Mitigation-control effectiveness`.
- **Conflict:** The select and the chip must say the same words. The register's vocabularies and labels live in the zod-free `risk-domain.ts` (plan 08-13, D-24), as `riskRegisterStageLabels` does. The filters file renders `riskRegisterMitigationStatusLabels[status]`.
- **Evidence:**
  - `No impacted system` and `Mitigation-control effectiveness` are in the filters file.
  - `risk-register.test.tsx` proves the select offers `Any mitigation control` and the chip reads `Mitigation-control status: Any mitigation control`.
  - `UX09_REGISTER_FIGURE_FILTERS` selects it by that label in the browser.

**5. [Order] Task 3 committed before the full Strapi suite ran**
- **What:** The E2E tests were committed (`ce03852`) once the spec passed, and then the full Strapi suite ran (701/701).
- **Why:** The next proof (deviation 6) edits the same spec file, and Task 3's commit had to hold the planned tests alone. The suite reads no web file, so the commit order does not change what it proves.

**6. [Investigated, no code change] Whether the long Related assessment chip wraps at 375**
- **Finding:** The shared `DataTable` chip has a fixed `h-8`. The new chip label is long, and the plan's must-haves require chips that wrap.
- **Test-first:** I wrote a unit assertion and an E2E geometry check. The E2E check passed on the unchanged code (2 passed): the chip already wraps inside its box and the viewport.
- **Outcome:**
  - The unit edit was discarded (my own uncommitted change, restored with `git checkout --` on that one file). `DataTable` is unchanged.
  - The E2E check stays, as proof of the must-have, in `d267bf6`.

---

**Total deviations:** 6: 2 blocking fixes outside the file list, 1 consistency fix outside it, 1 acceptance-grep conflict recorded with evidence, 1 commit-order note, and 1 investigation that needed no code change.
**Impact on plan:** No added scope. No content-type change, no new operation, Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC). The route, the grant and the analyst-only scope are unchanged.

## Issues Encountered

- **Bash and heredocs.** A bash heredoc that carried a long Python patch failed to parse (`unexpected EOF`). The later patches were written to the scratchpad with the Write tool and run from there.
- **An escaped middle dot.** One patch left `·` as an escape in a TypeScript template string. It was valid, but inconsistent with the web's literal `·`, so it was replaced with the character before GREEN.
- **The full Strapi run's before and after listings differ** by `apps/csrm/e2e/risk-register-workflow.spec.ts` and `apps/csrm/src/components/csrm/data-table.test.tsx`. Those were my own edits made while it ran (deviation 6), not files the run wrote. The run reads no web file. Every Playwright run left the tree identical.
- **The CRLF warnings** (`LF will be replaced by CRLF`) are `core.autocrlf` notices on the files I wrote, as in earlier plans. `git update-index --refresh` still reports the operator's two `apps/backend/types/generated/*.d.ts` files as "needs update", and they stay untouched and unstaged.

## Known Stubs

None. Every new option, control and chip reads a real server filter. Each filter is proved against fixtures, and the "none" values are also proved against the report figures.

## Threat Flags

None.
- No new endpoint, route, grant or table.
- **T-11-35:** every new value is a closed enum mapped to a constant SQL fragment. The vocabularies, `today` and the window end are bound parameters, and `impactedSystem` is its own key, refused beside `system`.
- **T-11-36:** every filter runs after `applyDisclosableParent`, so it only narrows the scope.
- The selected label adds the request title the row already discloses (`assessment.title`).

## User Setup Required

None.

## Next Phase Readiness

- **11-16 and 11-17:**
  - Call `applyTreatmentDueStatePredicate(query, state, { today, windowDays })` on knex with csrm_risks aliased as `r`.
  - 11-17's report counts pass `windowDays: ALERT_DUE_SOON_WINDOW_DAYS` once `TREATMENT_REPORT_DUE_WINDOW_DAYS` aligns to it (D-38). The register's `dueState` list then equals each count.
  - The rule's input check and the closed state are already inside the predicate.
- **11-18 (figure links):** every target filter now exists:
  - `dueState=later`, `dueState=no-target-date`
  - `treatmentStatus=none`, `inherentRating=none`, `residualRating=none`
  - `mitigationStatus=any`, `mitigationStatus={status}`
  - `mitigationEffectiveness={rating}` and `none`
  - `impactedSystem=none`
  - Each is closed in the web parser and the spec.
- **Phase 20 (G-16):** switch `TREATMENT_DUE_DATE_COLUMN` and `deriveTreatmentDueState`'s date read together in `treatment-due-state.ts`. The equivalence integration test then proves the switch on both.

## Self-Check: PASSED

- Commits `d4f21dd`, `5b0bf79`, `18ee925`, `dca0580`, `ce03852` and `d267bf6` exist on `post-demo`, and each carries the trailer.
- **Task 1 acceptance re-ran PASS:**
  - `treatment-due-state.ts` exports `applyTreatmentDueStatePredicate` and `TREATMENT_DUE_DATE_COLUMN` (2 matches), and contains the exact Phase 20 (G-16) sentence (2 matches).
  - `risk-register.ts` calls `applyTreatmentDueStatePredicate`. Its other `target_date` uses are the date-range filter and the sort, not due state.
  - The spec's `dueState` enum is the five values.
  - The verify exited 0, twice (GREEN and the tracer re-run).
- **Task 2 acceptance re-ran PASS:**
  - `risk-register-query.ts` allows `mitigationEffectiveness` and `impactedSystem`, and lists `none` in `RISK_REGISTER_RATING_FILTERS`.
  - `risk-register-filters.tsx` contains `No impacted system` and `Mitigation-control effectiveness`, and renders `Any mitigation control` from `risk-domain.ts` (deviation 4).
  - The verify passed.
- **Task 3 acceptance re-ran PASS:**
  - The spec contains `UX09_REGISTER_FIGURE_FILTERS`.
  - The full Strapi suite passed (701/701), and the run changed no file.
- **The plan's verification passed:**
  - `api:check` clean, and the parity guard passes;
  - web 3,125/3,125, typecheck and lint clean;
  - Strapi 701/701, and the spec 9/9;
  - full Playwright 134/134;
  - the tree is clean after every run.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because UX-09 is not ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
