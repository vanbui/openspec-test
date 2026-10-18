---
phase: 16-risk-curation-and-targeted-ai-re-runs
verified: 2026-10-16T08:34:34Z
status: passed
score: "4/4 roadmap success criteria verified; ASSESS-09 and ASSESS-10 satisfied; 15/15 plans' must-haves delivered (53/55 artifact and 34/35 key-link pattern checks pass, the 3 misses are placement deviations with the wiring found elsewhere); 0 gaps; 6 human checks; 7 operator checks stay open as deferred follow-ups in 16-UAT.md (pilot status ruling, 2026-10-16)"
covered_files:
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-01-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-01-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-02-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-02-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-03-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-03-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-04-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-04-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-05-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-05-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-06-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-06-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-07-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-07-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-08-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-08-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-09-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-09-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-10-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-10-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-11-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-11-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-12-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-12-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-13-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-13-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-14-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-14-SUMMARY.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-15-PLAN.md
  - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-15-SUMMARY.md
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts
  - apps/backend/src/api/csrm-risk/controllers/risk-curation.ts
  - apps/backend/src/api/csrm-risk/routes/risk-curation.ts
  - apps/backend/src/api/csrm-risk/services/risk-curation.ts
  - apps/backend/src/api/csrm-risk/services/risk-register.ts
  - apps/backend/src/csrm/active-risk.ts
  - apps/backend/src/csrm/ai/risk-proposals/deterministic-risk-proposal-provider.ts
  - apps/backend/src/csrm/ai/risk-proposals/field-units.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-duplicates.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-adapter.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts
  - apps/backend/src/csrm/risk-curation-rules.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/csrm/e2e/risk-curation.spec.ts
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/risk-curation/risk-curation-service.ts
  - apps/csrm/src/features/risk-curation/risk-rewrite.tsx
covered_digest: "v2:sha256:e54d1330b819c00efa7df463b6b432d23757ab7fa16d1a9ee391d29c54293733"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A withdrawn Risk of a released assessment shows no live treatment due state in the Risk Register's Withdrawn view (16-REVIEW BE1-02)"
    addressed_in: "Phase 20"
    evidence: "deferred-items.md and 16-REVIEW-DISPOSITION.md route BE1-02 to Phase 20 (treatment tracking and the overdue rule). Outside the four success criteria: every count, alert and report already excludes withdrawn Risks."
  - truth: "The history read checks kind, sourceKind and reason against the closed contract before serving (16-REVIEW BE1-04)"
    addressed_in: "Phase 18"
    evidence: "deferred-items.md routes BE1-04 to Phase 18, which opens the history vocabulary for bulk curation. The only writer, recordRiskHistory, writes closed values today."
human_verification:
  - test: "Live provider quality on UAT-A-like seeded fictitious data with an approved hosted model"
    expected: "Suggest more risks proposes payment-file integrity (and segregation of duties) without repeating the drafted risks, flags near-matches as similar, and Rewrite this risk sharpens one risk with citations and an uncited claim marked."
    why_human: "Every suite pins the deterministic provider. Sending request data to a hosted model is the operator's decision and cannot be judged by deterministic tests."
  - test: "NVDA speech and keyboard-only operation on Windows (16-UI-REVIEW UI-05)"
    expected: "The withdraw and reinstate forms, Undo toasts, the history sheet, the proposals section and the rewrite comparison announce once and keep focus on the next action. Every control can be reached and operated with the keyboard."
    why_human: "DOM assertions and axe cannot establish real screen-reader speech or keyboard usability."
  - test: "Visual review at 375, 768 and 1440 (16-UI-REVIEW UI-07)"
    expected: "The editor's Identified Risks with the Show filter, withdrawn cards, the history sheet, the proposals section (phone sheet below 768), the rewrite comparison, and the Risk Register's Withdrawn filter and detail meet 16-UI-SPEC: hierarchy, wrapping, popover at the viewport edge, long toast at 375."
    why_human: "The UI audit was code-only (no screenshots). Rendered appearance needs a person."
  - test: "The operator's development database migrates 16-03's schema change on the next Strapi start"
    expected: "csrm_risks gains withdrawn_at and withdrawal_reason (plus the withdrawn_by link), csrm_risk_history_events exists, the new Functions are granted to role.security_analyst, and UAT-A's existing risks read as active with 'History recorded from' shown."
    why_human: "The operator's database changes only when the operator restarts Strapi. The verifier may not start servers."
  - test: "Production schema and catalogue acceptance"
    expected: "The new CsrmRisk attributes, the CsrmRiskHistoryEvent type and the catalogue's new API-only Functions load in deployment. Legacy Risks read as active."
    why_human: "Needs a deployment against the production schema and catalogue."
  - test: "Safari and Firefox for the Show filter's address change (?risks=withdrawn)"
    expected: "Choosing Withdrawn or Active updates the address without a reload or a scroll jump. Back and forward restore the filter. Undo keeps the restored card in view."
    why_human: "Playwright runs Chromium only, so history and scroll behaviour in other engines is unproved."
---

# Phase 16: Risk curation and targeted AI re-runs: Verification Report

**Phase Goal:** As a Security Analyst, I want to withdraw wrong risks and ask the AI to rewrite one risk or propose missing ones, so that the draft ends up complete and correct without rebuilding it by hand.
**Verified:** 2026-10-16T08:34:34Z
**Status:** passed (pilot status ruling, 2026-10-16; see Gaps Summary)
**Re-verification:** No. This is the initial verification, at HEAD `e91eece4` against PHASE_16_BASE `01dc4118`. The IAM workstream paths merged at `d1518c5f` are excluded.

## User Flow Coverage

The roadmap goal is a valid user story (`user-story.validate`: `true`). The outcome clause is: "the draft ends up complete and correct without rebuilding it by hand".

| Step | Expected | Evidence in code | Status |
|---|---|---|---|
| Withdraw a wrong Risk with a reason | The Risk leaves the assessment and release readiness. Its number, fields, controls and AI provenance are kept, and it gets one `withdrawn` history row with the reason. | `withdrawRisks` (`risk-curation.ts:169-204`) runs under `withMutableAssessmentMutation`, writes the three facts and calls `recordRiskHistory`. Readiness filters with `releaseReadinessRisks` → `activeRisks` (`assessment-workflow.ts:328-331, 428`). The editor's Show filter is `?risks=withdrawn`. E2E `PH16_SC1_WITHDRAW_LEAVES_READINESS` and `PH16_SC1_HISTORY`. | ✓ VERIFIED |
| Reinstate or Undo a withdrawal | The facts are cleared with a `reinstated` row. Undo applies only to the actor's own latest act. | `reinstateRisks` (`risk-curation.ts:211-245`) and `assertUndoOfOwnLatestAct` (`:152-163`). Integration tests on undo both ways and BE1-03 a/b/c pass. | ✓ VERIFIED |
| Ask the AI for missing Risks | The missing payment-file Risk is proposed and existing Risks are not duplicated. | Deterministic S1 trigger (`deterministic-risk-proposal-provider.ts:118-123`). Adapter drops near-identical entries with `classifyProposedRisk` (`risk-proposal-adapter.ts:181-183`) over the active, withdrawn, rejected, open and same-run pools. | ✓ VERIFIED |
| Rewrite one Risk and decide each change | Changes appear field by field, and each one is confirmed or rejected separately. | `RISK_UNIT_DEFINITIONS` (`field-units.ts:37-54`) makes one unit per field (ratings travel with their derivation). The decisions module checks staleness (`AI_PROPOSAL_STALE`) and supports Undo. Web `risk-rewrite.tsx` uses `field-comparison.tsx`. E2E `PH16_SC3_REWRITE_DIFF` confirms one change and rejects another. | ✓ VERIFIED |
| Release and keep the released record immutable | After release, nothing can be withdrawn, reinstated, re-run or deleted. | One editable guard, `assertAssessmentEditable` (`assessment-workflow.ts:165-170`), serves every curation, start, job and decision path. No DELETE route exists. E2E `PH16_SC4_RELEASED_NO_CONTROLS` reads 409 `ASSESSMENT_NOT_MUTABLE` from Strapi for withdraw, reinstate, suggest and rewrite. | ✓ VERIFIED |
| Live model quality, assistive technology, rendered visuals, schema migration in real environments | These hold for the operator. | Not provable from code. See Human Verification Required. | ? HUMAN NEEDED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A withdrawn risk leaves the assessment and release readiness but stays in history with its reason. | ✓ VERIFIED | **Code:** `withdrawRisks` sets `withdrawnAt`, `withdrawnBy` and `withdrawalReason`, then appends a `withdrawn` row with `reason` (`risk-curation.ts:182-199`). Both readiness functions iterate only active Risks (`assessment-workflow.ts:328-331, 428-432`), and so does the release path, which calls `validateReleaseReadiness`. The analyst list and Requestor readers use `ACTIVE_RISK_FILTER` / `activeRiskSql` (`csrm-assessment.ts:117, 368, 395`). The register, dashboard, alerts and reports use `applyActiveRisk` (`risk-register.ts:268, 591`) and `activeRiskTable` (insight repositories). `getRiskHistory` still serves a withdrawn Risk's history. **Behaviour (run here):** `risk-curation.integration.test.js` 39/39 passed, including "a withdrawn incomplete Risk leaves release readiness … and the assessment releases", "withdrawing the last active Risk leaves 'At least one Risk' outstanding", "a human Security Analyst withdraws a Risk with a reason that keeps its number, fields…, and records one withdrawn row", and "reads … a withdrawn Risk's included". |
| 2 | "Suggest more risks" on UAT-A-like input proposes the missing payment-file risk without duplicating the existing ones. | ✓ VERIFIED | **Code:** S1 fires when an answer, request field, marked note, included file text or instruction mentions `payment file` and no listed entry already does (`deterministic-risk-proposal-provider.ts:110-123`). The context lists existing, withdrawn, rejected and open entries with "Do not propose any of them again" (`risk-proposal-context.ts:207-226`). The adapter drops near-identical candidates against every pool and flags similar ones (`risk-proposal-adapter.ts:136-204`, `risk-duplicates.ts`). **Behaviour (run here):** `ai-provider-risk-proposals.unit.test.js` on `uatALikeRecords` with **no instruction**: "a UAT-A-like context yields the payment-file integrity risk … the payment-file answer cited", "a near-duplicate restatement of an existing risk is dropped with near-duplicate-active", "a similar rewording is kept, flagged similar", and "the payment-file risk is not proposed again when a rejected suggestion already names it" all pass. `risk-proposals.integration.test.js` passes "the proposals read folds the open suggestions with the payment-file risk, a similar flag…". E2E `PH16_SC2_SUGGEST_PAYMENT_FILE` asserts the payment-file card, "1 left out", and that no proposed card repeats a drafted statement. |
| 3 | "Rewrite this risk" shows a field-by-field diff the analyst accepts or rejects. | ✓ VERIFIED | **Code:** a rewrite becomes per-field change units, each with `base` and `proposed` (`field-units.ts:37-71`). Fields that derive from one another stay together: ratings with their rating, asset with its classification, AI Accept with its plan. Each unit is a separate item that is accepted (only while its base still holds), rejected (optional reason) or restored (`risk-proposal-decisions.ts`, routed by `ai-proposal-decisions.ts:208`). Web `risk-rewrite.tsx` renders the units through `field-comparison.tsx` with per-unit Confirm and Reject plus "Reject remaining". **Behaviour (run here):** `risk-proposal-decisions.integration.test.js` passes "confirming two changes of a rewrite … a rejection with a reason changes nothing", "AI_PROPOSAL_STALE", and "Undo of a confirmed change restores its base". The web `risk-rewrite.test.tsx` and `field-comparison.test.tsx` pass (in the 418/418 run). E2E `PH16_SC3_REWRITE_DIFF` confirms the statement and rejects the cause. |
| 4 | Released risks cannot be withdrawn, deleted or re-run. | ✓ VERIFIED | **Withdraw/reinstate:** `withMutableAssessmentMutation` calls `assertAssessmentEditable` inside the lock (`assessment-workflow.ts:603-604`), and `isMutableAssessment` refuses any release fact (`:142-146`). **Re-run:** `startRiskProposalJob` calls `assertEditable` under the lock (`risk-proposal-workflow.ts` start path). The job re-checks with `isAssessmentEditable` before it creates any run, and `completeRiskProposalRun` records every item `lapsed` if the assessment was released meanwhile. **Decisions:** they run inside the same mutation wrapper. **Delete:** `csrm-risk.ts` routes have no DELETE, the history router is `only: []`, and `risk-no-delete.unit.test.js` scans every source (passed). **Server-side, not navigation:** the 409 comes from Strapi. **Behaviour (run here):** "on a released assessment withdrawal and reinstatement answer 409 ASSESSMENT_NOT_MUTABLE and change nothing (success criterion 4)", "ASSESSMENT_NOT_MUTABLE: on a released assessment both starts are refused with no job or run", "lapsed: a run that completes after the assessment was released…", and "on a released assessment every proposal decision is ASSESSMENT_NOT_MUTABLE" all pass. E2E `PH16_SC4_RELEASED_NO_CONTROLS` asserts 409 on the API for all four acts. |

**Score:** 4/4 truths verified (0 present, behavior-unverified).

### Project non-negotiables touched by the phase

| Rule | Status | Evidence |
|---|---|---|
| Authorisation in Strapi; navigation visibility is not security | ✓ | Every route carries the `global::csrm-authorization` policy with its operation. All 9 new operations are granted in the catalogue to `role.security_analyst` only (checked with a script) and are listed in `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts`). Handlers also call `assertAnalystAssessmentScope`. Requestor, Secondary Requestor and service agent get 403 (integration tests pass). |
| Requestor isolation | ✓ | Requestor risk list uses `ACTIVE_RISK_FILTER`. A withdrawn Risk's control implementations return the unknown-Risk 404 (`csrm-assessment.ts:395`). Integration: "a Requestor's released reads exclude a withdrawn Risk …" and "the Secondary Requestor gets the missing-record refusal … with identical bodies" pass. E2E `PH16_REQUESTOR_EXCLUDES_WITHDRAWN` and `PH16_NEG_UNRELATED_REQUESTOR`. |
| AI output is advisory and never releases | ✓ | A run writes only itself (`completeRiskProposalRun`). No Risk or assessment field changes until a human accepts an item. Release is human-only and refuses while any risk proposal is open (`assessment-workflow.ts:691-693`, D-42). `OWN_REQUEST` keeps the requesting analyst out of targeted AI actions. |
| No hard delete | ✓ | An unsaved row is discarded (`discardNewRisk`, `assessment-editor.tsx:555`). A persisted Risk is withdrawn. A rejected proposal is recorded as rejected. The `risk-no-delete` scanner passes. |
| JDL terminology | ✓ | No new status on `CsrmRisk`. `closureDate` and `treatmentStatus` keep their meanings. The withdrawal facts and `CsrmRiskHistoryEvent` are documented in `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, which the pilot approved (G-6) on 2026-10-15, with amendments on 2026-10-16. |
| Typed API layer, no raw fetch | ✓ | `risk-curation-service.ts` is `server-only` and calls the typed client (`client.POST('/v1/risk_assessments/{assessmentId}/risk_withdrawals', …)` and the others). `risk-curation-actions.ts` is `'use server'`. No `fetch(` in `features/risk-curation`. |

## Required Artifacts

`verify.artifacts` was run on all 15 plans: 53/55 pass. The two misses are placement deviations; the export exists in another file.

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/backend/src/csrm/active-risk.ts` | The one active-risk rule in three forms | ✓ VERIFIED | Used by readiness, readers, register, insights, context loader, workflow and decisions (grep shows 20+ call sites). |
| `apps/backend/src/csrm/risk-curation-rules.ts` | Closed body and partitions | ✓ VERIFIED | Pure. Unit test passes. |
| `apps/backend/src/api/csrm-risk/{routes,controllers,services}/risk-curation.ts` | Withdraw, reinstate and history operations | ✓ VERIFIED | Routed, policy-guarded, transactional. 39 integration tests pass. |
| `apps/backend/src/api/csrm-risk-history-event/**` | Append-only history and its only writer | ✓ VERIFIED | Core router `only: []`. `recordRiskHistory` and `readRiskHistory`. |
| `apps/backend/src/csrm/ai/risk-proposals/*` | Context, providers, adapter, duplicates, units, envelope, workflow, decisions, read | ✓ VERIFIED | All substantive. The 76 proposal integration tests pass. |
| `apps/csrm/src/features/risk-curation/*` | Schema, service, actions, domain and UI pieces | ✓ VERIFIED | Wired into `assessment-editor.tsx` (imports at lines 62-94) and `risk-details.tsx`. |
| `apps/csrm/src/lib/api/refusal-copy.ts` (16-11) | Exports `riskCurationRefusal`, `riskAiStartRefusal`, `riskDecisionRefusal`, `riskProposalJobFailureCopy`, `requestDeletionRefusal` | ⚠️ DEVIATION (info) | All five are exported from `apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts` (lines 51-206), which has its own test (`risk-curation-refusal-copy.test.ts`, passes). Same intent, feature-local module. |
| `apps/csrm/src/features/risk-curation/risk-history-sheet.tsx` (16-12) | Exports `RiskHistoryTrigger` | ⚠️ DEVIATION (info) | `RiskHistoryTrigger` is exported from `risk-history-trigger.tsx:103` and loaded dynamically by `risk-details.tsx:38` and the editor. The sheet itself is in `risk-history-sheet.tsx`. |
| `apps/csrm/e2e/risk-curation.spec.ts` | E2E journey at 375 and 1440 | ✓ VERIFIED | 658 lines. Steps PH16_SC1 to SC4, Requestor exclusion, register filter, negative cases. Listed in `playwright.config.ts`. |

## Key Link Verification

`verify.key-links` was run on all 15 plans: 34/35 verified.

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web risk-curation actions | Strapi curation and AI routes | `'use server'` actions → `server-only` typed service → `client.POST/GET` | ✓ WIRED | Paths match `risk-curation.ts` routes and `specification.json`. |
| Curation routes | Editable guard and history writer | `withMutableAssessmentMutation` → `assertAssessmentEditable` → `recordRiskHistory` | ✓ WIRED | In one transaction. |
| Withdrawal | Open rewrite proposals | `supersedeOpenChanges` → `appendAiRunDecisionsWithinMutation` | ✓ WIRED | Integration test "withdrawing a risk records its two open rewrite changes superseded" passes. |
| Proposal start/job | Provider and adapter | `selectRiskProposalProvider` → `toRiskSuggestionsProposal` / `toRiskRewriteProposal` → `completeRiskProposalRun` | ✓ WIRED | Deterministic provider unless `openai-compatible` is configured. |
| Decisions | Risk create and update | `applyRiskProposalDecisions` → `createRiskWithinMutation` / `updateRiskWithinMutation` | ✓ WIRED | Inside Phase 12's decision operation. |
| Release | Open proposal count | `openRiskProposalSummary` → `validateReleaseReadiness({ openAiProposals })` | ✓ WIRED | D-42. Integration test passes. |
| `risk-register-filters.tsx` | `risk-schema.ts` (16-15, pattern `withdrawn`) | State filter value | ⚠️ DEVIATION (info) | The literal is in neither file. Both import `riskRegisterStates` from `risk-domain.ts:68` (`['open','closed','withdrawn']`): the filter renders it (`:151`) and the schema validates it with `optionalEnum(riskRegisterStates)` (`:83`). Wired through the shared constant. E2E `PH16_REGISTER_WITHDRAWN_FILTER` passes. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Editor withdrawn card / Show filter | `risk.withdrawal` (`at`, `by`, `reason`) | `projectRiskWithdrawal` over persisted `withdrawnAt`, `withdrawnBy` and `withdrawalReason` (`assessment-scope.ts:469-476`) | Yes | ✓ FLOWING |
| History sheet | `RiskHistoryEventView[]` | `readRiskHistory` over `csrm_risk_history_events` | Yes | ✓ FLOWING |
| Release readiness panel | `releaseReadiness` | `projectReleaseReadiness({ ...document, risks }, { openAiProposals })` from Strapi rows and run records (`csrm-assessment.ts:263`) | Yes | ✓ FLOWING |
| AI proposals section / rewrite comparison | Proposals read | `GET /v1/risk_assessments/{id}/ai_proposals` → `risk-proposals-read.ts` folds run proposal and decision events | Yes | ✓ FLOWING |
| Risk Register Withdrawn view | Register page | `registerQuery` → `applyWithdrawnRisk` SQL over `csrm_risks` | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

Run by this verifier with node v24.19.0 on focused files only. The full Strapi suite and Playwright were not run; the final gate runs after this verification.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Curation rules, no-delete scan, provider on UAT-A-like context, duplicates, active-risk readers, units, history changes, envelope | `node --test` on 8 compiled unit files | 88/88 pass | ✓ PASS |
| SC1, SC4 (curation), Requestor isolation, history, authorisation | `node --test .tmp/tests-dist/tests/risk-curation.integration.test.js` | 39/39 pass | ✓ PASS |
| SC2, SC3, SC4 (AI and decisions), lapse/supersede, OWN_REQUEST, D-42 | `node --test risk-proposals.integration.test.js risk-proposal-decisions.integration.test.js` | 37/37 pass | ✓ PASS |
| Web feature and editor | `pnpm --dir apps/csrm exec vitest run src/features/risk-curation …/assessment-editor.test.tsx …/risk-editor.test.tsx …/field-comparison.test.tsx …/risk-details.test.tsx …/risk-register.test.tsx` | 17 files, 418/418 pass | ✓ PASS |
| Last full regression gate (stage A, before the UI-01 and UI-03 fixes) | Reported in 16-15-SUMMARY / dispatch | web 5,842/5,842; Strapi 2,022 passed, 1 skipped; Playwright 248/248 at 375 and 1440 | ℹ INFO (not re-run here) |

## Probe Execution

No phase-declared or conventional `scripts/*/tests/probe-*.sh` probes apply to this application feature phase.

## Requirements Coverage

All 15 plan frontmatters name only ASSESS-09 and/or ASSESS-10. No other requirement ID is claimed, and REQUIREMENTS.md maps no further ID to Phase 16.

| Requirement | Source plans | Description | Status | Evidence |
|---|---|---|---|---|
| ASSESS-09 | 16-01 to 16-07, 16-10 to 16-12, 16-14, 16-15 | A Security Analyst can withdraw an unreleased risk with a reason. | ✓ SATISFIED | Truths 1 and 4. Closes UAT-027. |
| ASSESS-10 | 16-01, 16-02, 16-08 to 16-11, 16-13 to 16-15 | A Security Analyst can re-run the AI for one risk or to propose additional risks. | ✓ SATISFIED (live-model quality is a human check) | Truths 2, 3 and 4. Closes UAT-028. |

REQUIREMENTS.md still shows both as `[ ]` / Pending. Updating them is the orchestrator's phase-close step, not a code gap.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Phase 16 `apps/**/*.ts(x)` files (IAM paths excluded) | — | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, "not yet implemented" | — | None found. |
| `apps/backend/src/api/csrm-risk/services/risk-register.ts` | 424 / due state | BE1-02: a withdrawn released Risk keeps a live `treatmentDueState` in the analyst-only Withdrawn view | ℹ Info (deferred to Phase 20) | Not in any count, alert or report. Outside the success criteria. |
| `apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts` | read projection | BE1-04: off-contract row values are not checked on read | ℹ Info (deferred to Phase 18) | The only writer writes closed values. |

## Human Verification Required

1. **Live provider quality on UAT-A-like seeded fictitious data with an approved hosted model.** Run Suggest more risks and Rewrite this risk. Confirm the payment-file risk is proposed, drafted risks are not repeated, similar flags are sensible, and rewrites are cited.
2. **NVDA and keyboard-only on Windows (UI-05).** Check the withdraw and reinstate forms, Undo toasts, the history sheet, the proposals section and the rewrite comparison: announcements happen once and focus moves to the next action.
3. **Visual review at 375, 768 and 1440 (UI-07).** Check the editor with the Show filter, withdrawn cards, the history sheet, the proposals section and phone sheet, the rewrite popover at the viewport edge, a long toast at 375, and the register's Withdrawn filter and detail.
4. **Operator development database migrates 16-03's schema change on the next Strapi start.** Expect the `withdrawn_at` and `withdrawal_reason` columns, the `withdrawn_by` link, `csrm_risk_history_events`, and the new Functions. UAT-A's risks should read as active.
5. **Production schema and catalogue acceptance.** Deploy the new attributes, the history type and the API-only Functions. Legacy Risks should read as active.
6. **Safari and Firefox for the Show filter's address change (`?risks=withdrawn`).** Check that there is no reload or scroll jump, that back and forward restore the filter, and that Undo keeps the card in view.

## Gaps Summary

No success criterion, requirement or plan must-have fails in code. Every success criterion is enforced in Strapi and was shown by focused tests that this verifier ran: 88 unit, 76 integration and 418 web tests. The criteria were traced through the real code paths: the one active-risk rule, the one editable guard, the duplicate classifier, the per-field change units, and the absence of any delete route. The three must-have pattern misses are placement deviations; the wiring was found elsewhere and is exercised by tests. Two code-review findings are deferred with named routes (BE1-02 to Phase 20, BE1-04 to Phase 18) and do not touch the success criteria. The status is `human_needed` only because live-model quality, assistive technology, rendered visuals, cross-browser address handling and real database or deployment migration cannot be proved from source or deterministic tests.

---

_Verified: 2026-10-16T08:34:34Z_
_Verifier: Claude (gsd-verifier)_

**Pilot status ruling (2026-10-16):** `passed`. Verification found 0 gaps: 4/4 criteria, ASSESS-09 and ASSESS-10 satisfied, 43/43 threats closed, Nyquist-compliant, and 54 review findings dispositioned with 0 open. The final gate is green at `fa0cf7a4` (web 5,847/5,847; Strapi 2,022 passed, 1 skipped; Playwright 248/248, 0 flaky). In that gate, `risk-curation.spec.ts` runs every Phase 16 state at 375 and 1440 with axe, including both negative cases. As in Phases 10 to 14, the seven checks in `16-UAT.md` that need a person, a hosted model, the operator's records or a deployment stay open as deferred operator follow-ups. They do not block completion. The pilot also accepts the stage B leave-warning copy (16-UI-SPEC §7 amendment) and keeps UI-02, UI-04 and UI-06 unchanged, as `16-UI-REVIEW-DISPOSITION.md` records.

The covered digest was recomputed on 2026-10-16 with `gsd-tools query verification.fingerprint`, after `aa811b73` recorded the final gate in `16-15-SUMMARY.md`. No source file changed after the verifier ran (`git diff --name-only fa0cf7a4 aa811b73` lists only that summary and STATE.md).
