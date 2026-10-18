---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 07
subsystem: backend-risk-readers
status: complete
tags: [active-risk-rule, risk-register, analyst-insights, exposure, static-guard, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's active-risk.ts (activeRiskSql, ACTIVE_RISK_FILTER, WITHDRAWN_RISK_FILTER, activeRisks, isActiveRisk); 16-03's withdrawal facts; 16-05's withdrawal and reinstatement operations; 16-06's projectRiskWithdrawal, RiskWithdrawal component and riskWithdrawalSchema"
  - phase: 11-navigation-landing-and-list-clarity
    provides: "applyDisclosableParent, applyReleasedParent, applyUnderAssessmentParent; the register's stage, treatmentAction and state filters; the dashboard and report exposure sections and their register equality"
provides:
  - "risk-register.ts: applyActiveRisk and applyWithdrawnRisk (exported, beside applyDisclosableParent, which does not name withdrawn_at); registerQuery picks the branch for the count and the page; the detail serves withdrawal through projectRiskWithdrawal and populates withdrawnBy"
  - "risk-register-query.ts: RISK_REGISTER_STATES = open, closed, withdrawn"
  - "dashboard-summary.ts and report-repository.ts: activeRiskTable (applyActiveRisk at the csrm_risks table) for every Risk figure; alert-repository.ts and the report's control join apply applyActiveRisk in place"
  - "Spec: /v1/risks state enum gains withdrawn (description rewritten); RiskDetail.withdrawal required, RiskWithdrawal or null; generated client"
  - "Web: riskRegisterStates and riskRegisterStateLabels gain withdrawn / Withdrawn (risk-domain.ts); riskDetailSchema.withdrawal = riskWithdrawalSchema.nullable(); parity case"
  - "apps/backend/tests/active-risk-readers.unit.test.ts: findRiskReaderSites, EXEMPT_READERS, staleExemptions (the static guard Phases 17 to 21 inherit)"
affects: [16-08, 16-09, 16-15, 17, 17.1, 18, 19, 20, 21]

actuals:
  tokens: 15300
  tasks: 3
  commits: 7

plan_head_before: c3e27be2792df5458c79b6756beb705b77250bea
plan_head_after: 9ac34eef0008cd5dce98df7bb5dbb7365e546b94

tech-stack:
  added: []
  patterns:
    - "Every Risk table read names the rule beside the table: applyActiveRisk(connection.queryBuilder().from(\"csrm_risks as r\")) or registerQuery's branch"
    - "A static guard scans the Strapi source with comments blanked and fails on any Risk reader site without the rule within 25 lines, unless its file is exempt with a reason and its exact unruled site count"

key-files:
  created:
    - apps/backend/tests/active-risk-readers.unit.test.ts
  modified:
    - apps/backend/src/api/csrm-risk/services/risk-register.ts
    - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
    - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
    - apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts
    - apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/risks/risk-schema.ts
    - apps/csrm/src/features/risks/risk-domain.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/risks/risk-schema.test.ts
    - apps/csrm/src/features/risks/risk-service.test.ts
    - apps/csrm/src/features/risks/risk-details.test.tsx
    - apps/csrm/src/features/risks/risk-register.test.tsx
    - apps/backend/tests/risk-register.unit.test.ts
    - apps/backend/tests/risk-register.integration.test.ts
    - apps/backend/tests/analyst-dashboard.integration.test.ts
    - apps/backend/tests/analyst-alerts.integration.test.ts
    - apps/backend/tests/analyst-reports.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "A withdrawn Risk can sit on a released assessment (withdrawn before release, 16-06), so every released figure (exposure, accepted, High and Critical, exposed systems) needs the rule, not only the under-assessment ones. Each insight test proves both: one Risk withdrawn through the API on an unreleased assessment and one on the released fixture assessment with the facts set through the fixture."
  - "EXEMPT_READERS entries carry the exact count of unruled sites they cover. A new unruled reader in an exempt file, or a fixed one, changes the count and fails the suite, so an exemption can never silently cover a later reader. risk-number.ts is listed with 0 sites: it reads no Risk today, and any future read there must count withdrawn Risks (numbers are never reused, D-06)."
  - "The register's hydrate is exempt rather than filtered: it reads exactly the documentIds the ruled register query chose, and filtering it again would drop the explicit Withdrawn list's rows."
  - "The web state vocabulary gains withdrawn with the label Withdrawn, so the Risk state select already offers it after Open and Closed; 16-15 relabels the empty option to Open and closed and adds the notice and badges (UI-D9)."

requirements-completed: []

duration: 65min
completed: 2026-10-15
---

# Phase 16 Plan 07: Active-risk readers in the register and every insight figure Summary

**The Risk Register hides withdrawn Risks except under an explicit `state=withdrawn` filter. Its detail names who withdrew a Risk, when and why. The dashboard, alerts, reports and exposure count active Risks only. A static guard fails the Strapi suite when any Risk reader skips the rule.**

## Performance

- **Duration:** about 65 min, including the 33-minute full Strapi suite
- **Started:** 2026-10-15T08:49:31Z
- **Completed:** 2026-10-15T09:54:26Z
- **Tasks:** 3
- **Files modified:** 21 (1 created)

## Accomplishments

- **Register (D-08, D-13, D-45).** `applyActiveRisk` and `applyWithdrawnRisk` sit beside `applyDisclosableParent`, which still never names `withdrawn_at`. `registerQuery` picks the branch from the parsed closed enum. With no state, and with `open` or `closed`, the register reads active Risks; `withdrawn` reads withdrawn Risks only. The count and the page share that one query, so every total equals its rows. The detail serves `withdrawal: { at, by, reason }`, or null on an active Risk, with `parentLock` unchanged.
- **Insights (D-13, D-14, decision 11).** Every Risk figure starts from `activeRiskTable`:
  - the dashboard's released, accepted and under-assessment exposure, its High and Critical list and its treatments due;
  - the report's exposure, exposed systems, under-assessment, accepted, treatment-performance and control-effectiveness figures;
  - both alert scopes, the Risks and the Control Implementations on them.
- **Contract (D-02).** The spec's `state` enum and `RiskDetail.withdrawal`, the generated client, the web vocabulary, the detail parser and the parity guard changed in one plan.
- **Static guard.** `active-risk-readers.unit.test.ts` scans 100+ source files. It flags a synthetic reader without the rule and passes the same reader with the rule. It refuses a stale exemption.

## Task Commits

1. **Task 1 (tracer): Risk Register without withdrawn Risks by default**
   - `cc038376` test(16-07): expect the Risk Register to hide withdrawn risks unless filtered (RED)
   - `110192ce` feat(16-07): keep withdrawn risks out of the Risk Register except under the Withdrawn filter (GREEN)
   - `c1e20cea` test(16-07): pin the published withdrawn Risk state in the contract catalogue (deviation 1)
2. **Task 2: Insight figures count active Risks only**
   - `75e228da` test(16-07): expect insight figures to exclude withdrawn risks (RED)
   - `78b3ef46` feat(16-07): exclude withdrawn risks from the dashboard, alerts, reports and exposure (GREEN)
3. **Task 3: The static reader guard**
   - `c3cfb28b` refactor(16-07): name the active-risk rule at every Risk table read
   - `9ac34eef` test(16-07): fail the build when a risk reader skips the active-risk rule

The tracer gate passed: Task 1's verify was re-run end to end before Task 2.

## Reader sites the guard found (apps/backend/src)

| Site | Kind | Status |
|---|---|---|
| `api/csrm-analyst-insight/services/alert-repository.ts:239` | SQL | ruled (`applyActiveRisk`) |
| `api/csrm-analyst-insight/services/alert-repository.ts:249` | SQL join | ruled |
| `api/csrm-analyst-insight/services/dashboard-summary.ts:193` (`activeRiskTable`) | SQL | ruled |
| `api/csrm-analyst-insight/services/report-repository.ts:186` (`activeRiskTable`) | SQL | ruled |
| `api/csrm-analyst-insight/services/report-repository.ts:213` | SQL join | ruled |
| `api/csrm-assessment/controllers/csrm-assessment.ts:113` (`riskSummariesFor`) | SQL join | ruled (`activeRiskSql`, 16-06) |
| `api/csrm-assessment/controllers/csrm-assessment.ts:362` (risk list) | Document | ruled (`ACTIVE_RISK_FILTER`, 16-06) |
| `api/csrm-risk/services/risk-register.ts:589` (`registerQuery`) | SQL | ruled |
| `api/csrm-risk/services/risk-workflow.ts:102` (`listAssessmentRiskDocuments`) | Document | ruled (16-06) |
| `api/csrm-risk/services/risk-curation.ts:89` (`loadBatch`) | Document | exempt |
| `api/csrm-risk/services/risk-register.ts:680` (`hydrate`) | Document | exempt |
| `api/csrm-risk/services/risk-workflow.ts:131` (`loadAnalystAssessmentRiskDetails`) | Document | exempt |
| `bootstrap/seed-risk-register-workflow.ts:190` | Document | exempt |

## Exemptions (EXEMPT_READERS)

| File | Sites | Reason |
|---|---|---|
| `api/csrm-risk/services/risk-number.ts` | 0 | Risk numbers are never reused (D-06). Any future allocation or uniqueness read here must count withdrawn Risks. |
| `api/csrm-risk/services/risk-curation.ts` | 1 | Withdrawal and reinstatement load the named Risks by documentId with their current fact. A reinstatement reads withdrawn Risks by design. |
| `api/csrm-risk/services/risk-workflow.ts` | 1 | The analyst assessment detail lists every Risk, withdrawn ones marked (D-08). Readiness drops them in memory (16-06). |
| `api/csrm-risk/services/risk-register.ts` | 1 | `hydrate` reads the ids the ruled register query chose. Filtering again would empty the Withdrawn list. |
| `bootstrap/seed-risk-register-workflow.ts` | 1 | The seed reconciles its fixture Risk by its stable number, withdrawn or not. |

The plan also named `risk-history.ts` and the seed modules in general. Neither holds a Risk reader site, so no entry was added for them. The history service reads history rows, not Risks, and the other seeds only create Risks.

**Readers fixed beyond this plan's files (scope note):** none. The guard found no unruled reader outside the plan's files. The only source changes in Task 3 are the restructuring in the plan's own register, dashboard and report files.

## Verification

| Command | Result |
|---|---|
| Task 1 verify: backend tsc ×2; `risk-register.unit` + `risk-register.integration`; `api:check`; vitest parity + `src/features/risks` | 45/45 Strapi; api:check clean (after staging); 365/365 vitest (9 files) |
| `contract-catalogue.integration` (deviation 1) | 27/27 |
| Task 2 verify: tsc ×2; dashboard, alerts and reports integration | 33/33 |
| Register + insight suites after the Task 3 refactor | 78/78 |
| `active-risk-readers.unit` | 4/4 |
| Task 3 verify: backend tsc; **full Strapi suite** (`pnpm --dir apps/backend test`) | 1926 tests, 1925 pass, **0 fail**, 1 skipped (the existing POSIX-mode case on Windows) |
| **Full web suite** (`pnpm --dir apps/csrm test`) | 222 files, 5421/5421 |
| `pnpm --dir apps/csrm typecheck` / `lint` | pass / pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: test kept true] The contract catalogue pinned the old state parameter**
- **Found during:** Task 1 GREEN (a grep for `RISK_REGISTER_STATES`)
- **Issue:** `contract-catalogue.integration.test.ts` pinned the `/v1/risks` `state` parameter literally (`["open", "closed"]`, the old description and the generated query type).
- **Fix:** The pin now reads the widened enum, the new description and the regenerated `state?: "open" | "closed" | "withdrawn"`.
- **Commit:** `c1e20cea`

**2. [Rule 3: blocking] Web fixtures and the register filter test**
- **Issue:** `RiskDetail.withdrawal` is now required. As a result, `risk-details.test.tsx`'s `satisfies RiskDetail` fixture failed typecheck and `risk-service.test.ts`'s detail fixture failed the parser. The `Risk state` select maps the vocabulary, so `risk-register.test.tsx`'s option list gained `Withdrawn`.
- **Fix:** Both fixtures now have `withdrawal: null`, and the option expectation includes `['withdrawn', 'Withdrawn']`. The empty option still reads `All`; 16-15 relabels it `Open and closed` (UI-SPEC §11.1).
- **Commit:** `110192ce`

**3. [Rule 1: test kept true] The insight withdrawal fixtures start in review**
- **Found during:** Task 2 GREEN
- **Issue:** A withdrawal is an accepted edit (D-23). It moved the fixture's draft assessment to in review and its request to under review. That changed the review queue and the throughput's request counts, which are not Risk figures.
- **Fix:** The dashboard and report fixtures start `in-review` / `under-review` with a reviewer, so the transition keeps them in review. The comparison then isolates the Risk figures. The alerts fixture was unaffected and stays a draft.
- **Commit:** `78b3ef46`

**4. [Plan detail] The rule moved next to each table read (Task 3)**
- At first the guard flagged the dashboard and report builders and the register's count and page. They applied the rule through a helper defined further up (`openRisks`, `applyFilters`), outside the 25-line window.
- Rather than widen the window or exempt them, the rule now sits at the table:
  - `activeRiskTable` in the dashboard and reports;
  - `registerQuery` in the register, which also moved the state branch out of `applyFilters`;
  - `applyActiveRisk` in place at the report's control join.
- Behaviour is unchanged (78/78 register and insight tests).
- **Commit:** `c3cfb28b`

**5. [Plan detail] Where the executed code differs from the written-ahead plan**
- The web state vocabulary lives in `risk-domain.ts` (`riskRegisterStates`), which `risk-schema.ts` re-exports. It was changed there.
- The register filter is the flat `state` query parameter, not `filters[state]`.
- `EXEMPT_READERS` maps each path to `{ reason, sites }` rather than to a bare reason, so an exemption covers its exact sites (see key decisions).
- The guard also finds `connection("csrm_risks as r")`, raw FROM/JOIN SQL, `service(strapi, uid)` and `documentsFor(uid)`, beyond the plan's `from(`/`join(` and `documents(`/`query(` forms, so it found the register's own reads and the seed.

**6. [Plan detail] The mounted register case uses two withdrawn Risks**
- One withdrawn Risk is open and one is closed. This proves that both `open` and `closed` exclude withdrawn Risks, so `state=withdrawn` lists two Risks with total 2.

**Total deviations:** 3 auto-fixed (two tests kept true, one blocking fixture update) and 3 plan-shape notes. None changes behaviour beyond the plan.

## Issues Encountered

- A Bash heredoc holding the reports test block failed to parse. The block was written to a scratch file and inserted by a script instead. The result was unaffected.
- `api:check` compares against the index, so it passes only once the regenerated client is staged. It was run after staging, as in earlier plans.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- **T-16-18:** covered by the one SQL helper at each table read, the per-figure mounted proofs (released and under assessment) and the static guard.
- **T-16-19:** covered by the closed enum. Unknown and wrong-case values such as `Withdrawn` are refused with 400 (unit and mounted).

## Next Phase Readiness

- 16-15 can build the Withdrawn filter UI, notice, badges and the read-only withdrawn detail over `state=withdrawn` and `RiskDetail.withdrawal`, which `riskDetailSchema` already parses.
- 16-08 and 16-09 can apply `activeRisks` to their proposal contexts. Any new Risk SQL or Document Service read they add must name the rule, or the Strapi suite fails.
- ASSESS-09 is not marked complete: it is a shared ID gated to the phase's last plan.

## Self-Check: PASSED
