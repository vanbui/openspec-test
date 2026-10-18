---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 10
subsystem: backend-ai-risk-proposals
tags: [ai-proposals, decisions, risk-suggestions, risk-rewrite, provenance, release-readiness, ai-inputs, supersession, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's item core and units (nextState, foldItemStates, isUnitStale, aiAcceptCheck, residualRatingAfter, normaliseRiskValues, unitApplyValues); 16-04's lock core and inner Risk functions (withMutableAssessmentMutation, createRiskWithinMutation, updateRiskWithinMutation); 16-05's withdrawRisks; 16-09's loadRiskProposalRuns, openRiskProposalSummary and the proposals read"
  - phase: 15-steerable-questionnaire-ai
    provides: "decision event v2 and the leak-safe decision check order (15-07)"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "decideAiProposals, parseAiProposalDecisionBatch, riskHasPlannedControl, appendAiRunDecisions, RiskAiProvenanceV1, initialRiskAiProvenance, the aiProposalsReviewed requirement"
provides:
  - "risk-proposal-decisions.ts: applyRiskProposalDecisions, loadRiskProposalDecisionRuns, RISK_PROPOSAL_REASON_MAX_LENGTH, types RiskProposalDecision, RiskProposalDecisionAction, RiskProposalDecisionOutcome, RiskProposalDecisionRun"
  - "ai-proposal-decisions.ts: the closed proposal entry in parseAiProposalDecisionBatch, routing to applyRiskProposalDecisions inside the same mutation, OWN_REQUEST for proposal batches, decideAiProposals' humanAnalyst input"
  - "ai-provenance.ts: markFieldsConfirmedFromRun, fieldRunId, emptyRiskAiProvenance, the optional runId on a Risk field fact, per-field citations against the proposing run"
  - "assessment-workflow.ts: ReleaseReadinessFacts, validateReleaseReadiness(value, facts?) and projectReleaseReadiness(value, facts?) with aiProposalsDecided, the release gate, exported initialRiskAiProvenance(risk, runId, options?), AssessmentWorkflowError 403"
  - "assessment-scope.ts: latestCompletedAssessmentContextRun; assessmentAiInputsChanged on it"
  - "ai-inputs-signal.ts: risk-suggestions in CONTEXT_WIDE_AI_OPERATIONS"
  - "risk-curation.ts: withdrawRisks supersedes a withdrawn Risk's open changes (cause risk-withdrawn, by the withdrawing analyst)"
  - "risk-workflow.ts / risk-history.ts: an ai-run source skips Phase 12's edited marking; undo on an ai-run updated row"
  - "Spec: AiProposalRunDecision; AiProposalDecisionRequest entries oneOf the Phase 12 entry and it"
affects: [16-11, 16-12, 16-15, phase-17]

actuals:
  tokens: 28300  # chars/4 over the added lines of the realized diff (113,240 characters, generated client excluded)
  tasks: 3
  commits: 6  # git rev-list --count ce513083..HEAD before the docs commit

plan_head_before: ce51308391b31e1f332f7a568d3b2e72bcbea5b2
plan_head_after: baa1ab0755ceaddc529a079619609cf9854702b1

tech-stack:
  added: []
  patterns:
    - "One decision operation, closed per target kind: Phase 12's field and suggested-control entries, then the run-scoped entries in the order sent, in one mutation and one transaction"
    - "Item state folded from the stored and this batch's decision events; one append per run after every check"
    - "Accept rule checked against each Risk as the whole batch leaves it"

key-files:
  created:
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts
    - apps/backend/tests/risk-proposal-decisions.integration.test.ts
    - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/deferred-items.md
  modified:
    - apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts
    - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-risk/services/risk-curation.ts
    - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
    - apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts
    - apps/backend/src/csrm/ai/ai-inputs-signal.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposals-read.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/backend/tests/ai-proposal-decisions.unit.test.ts
    - apps/backend/tests/ai-proposal-decisions.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/risk-curation.integration.test.ts

key-decisions:
  - "Within one batch, Phase 12's entries apply first (with their own writes and G-14 check) and the run-scoped entries after them, in the order sent, against the Risks as those left them; every named run is read and checked (404, 400) before either"
  - "The Accept rule runs after the batch against each Risk as the batch leaves it: a confirmed AI Accept unit needs a Low or Moderate residual, a plan and no Planned control; and a confirmed residual unit may not leave High or Critical under an Accept a person confirmed from an AI proposal (the reverse order across batches)"
  - "A suggestion naming a Risk Type, system or asset that is gone is AI_PROPOSAL_STALE (a RiskWorkflowError 400 from the create or update path maps to it)"
  - "A confirmed statement field cites the unit's own sources (none when it has none); its earlier citations belonged to the earlier run. The analyst read resolves each field's citations against fieldRunId's run"
  - "The Undo row of a confirmed change is an updated row with source ai-run (the run and the unit) and undo: true; risk-history.ts now allows undo on exactly that row"
  - "The proposals read offers canUndo on a confirmed change while the assessment is editable and its active Risk still holds the confirmed values; never on an added Risk"
  - "A run whose proposal, decisions or fold do not read takes no decision: 409 AI_RUN_RECORD_UNAVAILABLE"
  - "decideAiProposals refuses a proposal batch 403 unless the policy's humanAnalyst fact is true (defence in depth; the route is already human-analyst only)"

requirements: [ASSESS-09, ASSESS-10]
requirements-completed: []  # shared IDs: marked complete by the phase's last plan
closes: [UAT-028]

duration: 150min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 10: Human Decisions on Risk AI Proposals Summary

**Phase 12's decision operation now takes run-scoped `{ kind: "proposal", runId, item }` entries. "Add to assessment" creates a reviewable Risk through the create path. Each rewrite change is confirmed (stale and Accept checked in the transaction, per-field run references written), rejected with a reason, or undone where that is honest. Withdrawal supersedes open changes, release waits for "Decisions on AI proposals", and a completed "Suggest more risks" run becomes the assessment's AI-inputs baseline.**

## Performance

- **Duration:** about 150 minutes, about 100 of them two full Strapi suite runs
- **Started:** 2026-10-15T12:34:11Z
- **Completed:** 2026-10-15T14:52Z
- **Tasks:** 3 (each RED then GREEN)
- **Files:** 3 created, 19 modified

## Accomplishments

- **The executed shape of 12-12's entries, as extended.** `parseAiProposalDecisionBatch` reads each entry by its target kind:
  - `{ kind: "assessment" }` or `{ kind: "risk", riskId }` with `accept | dismiss | restore`, `fields?` or `suggestion?`. This is Phase 12's entry, unchanged; `reject` or a `reason` on it is a 400.
  - `{ kind: "proposal", runId (1 to 255), item (^(s-[1-8]|u-[a-z-]{3,40})$) }` with `accept | reject | restore` and `reason?`. The reason is allowed only with `reject`, is trimmed, and must be 1 to 500 characters. `dismiss` on this entry is a 400.
  - A batch holds 1 to 200 entries.
- **Order.** The checks run in this order:
  1. Parse (400).
  2. For a batch that names a proposal: the human analyst fact (403), then OWN_REQUEST (403, with its reason). Both are read-only and run before the wrapper.
  3. `withMutableAssessmentMutation`: its editable guard returns ASSESSMENT_NOT_MUTABLE, and it takes the transition `contentChanged ? accepted-edit : none`.
  4. Every named run must exist, be completed, be `risk-suggestions` or `risk-rewrite`, and belong to this assessment (404 for the whole batch otherwise). A damaged run returns AI_RUN_RECORD_UNAVAILABLE, and an unknown item returns 400.
  5. Phase 12's entries apply.
  6. The run-scoped decisions apply in the order sent. For each one, the fold over the stored events plus this batch's events gives `nextState`. A no-op counts as `unchanged`; a not-open item returns AI_PROPOSAL_ALREADY_DECIDED. A change also needs an active Risk (RISK_WITHDRAWN), and a confirm needs a fresh base (AI_PROPOSAL_STALE). Restoring a confirmed change needs the Risk to still hold the confirmed values (AI_PROPOSAL_UNDO_UNAVAILABLE), and restoring an added Risk always returns AI_PROPOSAL_UNDO_UNAVAILABLE.
  7. The Accept rule (AI_ACCEPT_NOT_PERMITTED or AI_ACCEPT_WITH_PLANNED_CONTROL).
  8. One append per run.

  Any refusal rolls back the whole batch.
- **Add (D-33).** `createRiskWithinMutation` creates the Risk with the proposed values (the Risk Type resolved by name, `treatmentStatus: "Not Started"` as a draft) and its `created` row with source `ai-run`, the run and `proposalItem`. Its `aiProvenance` comes from `initialRiskAiProvenance(proposed, runId, { fieldRunIds: true, proposalKey: item })`: every field is `proposed` and names the run, and the suggested controls become Phase 12 suggestions. The event is `accepted` with `applied: { riskDocumentId }`. The proposals read shows `addedRisk`.
- **Confirm and Undo (D-25, D-36, D-37).** Each unit is applied through `updateRiskWithinMutation` with an `ai-run` source, which now skips Phase 12's `edited` marking and its v1 event. That writes one `updated` row listing only the unit's fields. `markFieldsConfirmedFromRun` then sets each field to `accepted`, by the analyst, with the run's `runId`. A Risk created by hand gains `emptyRiskAiProvenance(run, unit)`. The event keeps `before: { values: base, fieldFacts }` and `applied: { values: proposed }`. Undo writes `before.values` back with an `undo: true` row and restores `before.fieldFacts`.
- **Readiness (D-42).** `aiProposalsDecided` ("Decisions on AI proposals", destination `ai-proposals`) is outstanding while `openRiskProposalSummary(...).openCount > 0`. The analyst detail passes the fact. `releaseAssessment` computes it inside its transaction. The pre-edit transition still calls `validateReleaseReadiness(assessment)` without facts.
- **Supersession on withdrawal (D-40).** `withdrawRisks` appends `superseded` with `{ kind: "risk-withdrawn", riskDocumentId }`, by the withdrawing analyst, to every open change of each applied Risk, in the same transaction. A repeated withdrawal adds nothing.
- **AI-inputs baseline (D-28, the pilot ruling of 2026-10-15).** `CONTEXT_WIDE_AI_OPERATIONS` gains `risk-suggestions`. `latestCompletedAssessmentContextRun` reads the newest completed `assessment-draft` or `risk-suggestions` run of the assessment (one `findMany`, limit 1). `assessmentAiInputsChanged` uses it, falling back to the aiProvenance run and then to `generatedDate`. `generation.runId` still names the draft run, and the request read follows through the same function.

## Task Commits

1. Task 1 RED: `04419ef0` test(16-10): expect adding a proposed risk and readiness waiting for every decision
2. Task 1 GREEN: `57d0e192` feat(16-10): decide proposed risks and gate release on AI proposal decisions
3. Task 2 RED: `668ec987` test(16-10): expect per-change confirmation, staleness, Undo and the Accept rule
4. Task 2 GREEN: `f8ccadc1` feat(16-10): confirm or reject rewrite changes with stale, Undo and Accept checks
5. Task 3 RED: `2fc45f27` test(16-10): expect the decision refusals, supersession on withdrawal and the AI-inputs baseline
6. Task 3 GREEN: `baa1ab07` feat(16-10): close the decision rules and supersede a withdrawn risk's open changes

**Plan metadata:** the `docs(16-10)` commit adding this summary with STATE.md, ROADMAP.md and deferred-items.md.

## Verification

| Command | Result |
| --- | --- |
| Task 1 RED: `tsc -p tests/tsconfig.json` | fails: `validateReleaseReadiness`/`projectReleaseReadiness` take one argument; `AiFieldFact` has no `runId` (RED) |
| Task 1 verify: both `tsc`; `risk-proposal-decisions`, `assessment-workflow`, `ai-proposal-decisions` integration (+ its unit) | 3/3; 43/43 (after the served-readiness assertion took the fact); 23/23 |
| `pnpm --dir apps/csrm api:check` + `git update-index --refresh` (after Task 1's commit) | exit 0 |
| `pnpm --dir apps/csrm typecheck` (after the spec change) | exit 0 |
| Task 2 RED: `tsc -p tests/tsconfig.json` | fails: no `fieldRunId`, `markFieldsConfirmedFromRun`, `emptyRiskAiProvenance` (RED) |
| Task 2 verify: both `tsc`; `ai-provenance` unit + `risk-proposal-decisions` integration | 18/18 |
| Task 3 RED: `ai-inputs-signal` unit, `ai-proposal-decisions` unit and integration, `risk-proposal-decisions` | 49 pass, 4 fail (the context-wide list, OWN_REQUEST's missing reason, no supersession on withdrawal, the baseline) |
| Task 3 GREEN: the same files + `active-risk-readers.unit` | 56/56 |
| Task 3 verify, first FULL Strapi suite | 2,001 passed, 1 failed, 1 skipped of 2,003: `risk-curation.integration` pinned the pre-16-10 assessment readiness keys; fixed (36/36) |
| Task 3 verify, FULL Strapi suite on the committed tree (`pnpm --dir apps/backend test`) | 2,002 passed, 0 failed, 1 skipped of 2,003 (exit 0, 2,076 s), including `active-risk-readers.unit`, `risk-no-delete.unit` and `served-operations.integration` |
| No decision-path test ran to the 600,000 ms timeout (Pitfall 1): the longest 16-10 case took about 33 s (first boot) and every other one under 2 s | pass |

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OWN_REQUEST lost its reason on the assessment controller's 403**
- **Found during:** Task 3 RED
- **Issue:** `safeError` in `csrm-assessment.ts` sent `details.reason` only for a 409, so the decision's 403 OWN_REQUEST arrived with no reason.
- **Fix:** a 403 with a reason names it, as `risk-proposals.ts` already does.
- **Commit:** `baa1ab07`

**2. [Rule 1 - Bug] Existing tests pinned the pre-16-10 readiness**
- `assessment-workflow.integration` compared the served readiness with `projectReleaseReadiness(...)` called without facts, and `risk-curation.integration` pinned the assessment requirement keys. Both now include `aiProposalsDecided`, which is met while no proposal is open (commits `57d0e192`, `baa1ab07`).

**3. [Rule 2 - Missing critical] History `undo` on the Undo of a confirmed change**
- The plan asks for an `updated` row with `undo: true`, but `recordRiskHistory` refused `undo` outside withdrawal and reinstatement. It now also allows `undo` on an `updated` row from an `ai-run` source (`57d0e192`). The Phase 16 record's column note in `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` still reads "withdrawal or reinstatement". That wording needs the pilot's touch (see Issues).

### Plan-shape notes (followed the executed code)

- `updateRiskWithinMutation` did not skip Phase 12's `edited` marking for an AI source, so 16-10 added that, and the optional `undo` flag.
- `AssessmentWorkflowError` admits 403. `appendAiRunDecisionsWithinMutation` takes any `AiRunDecisionEvent`, so v2 events go through the same WR-103 refusal.
- `initialRiskAiProvenance` was private. It is exported, with `options` for the per-field run and the proposal key, and draft persistence is unchanged.
- The run checks live in `loadRiskProposalDecisionRuns` (exported beside `applyRiskProposalDecisions`), so they run before Phase 12's entries.
- `riskHasPlannedControl` is imported from `ai-proposal-decisions.ts`. That is a function-level import cycle, and it is safe at load.
- The request controller's comment on the assessment signal was updated. There is no code change there, as the plan said.
- The proposals read's `canUndo` now covers a confirmed change. The analyst provenance projection cites each field against its own run.
- A mounted case per plan file lives where the plan names it. `ai-proposal-decisions.unit.test.ts` also gained the parser's closed-entry cases.

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical), 9 plan-shape notes. No scope creep.

## Issues Encountered

- **Needs the pilot (G-6): an added Risk's AI fields cannot be reviewed or edited.** Its envelope names the `risk-suggestions` run, as the amendment requires. Phase 12's field confirm (`Confirm remaining`) and a human edit of a proposed field both append a v1 event to that run. The same amendment refuses a v1 event on a risk proposal run, so both answer 409 `AI_RUN_RECORD_UNAVAILABLE` (a mounted probe, not committed). The assessment then cannot be released unless the added Risk is withdrawn. It fails closed and was not fixed here, because every fix amends approved contract text. The options are in `deferred-items.md`: the recommended one accepts Phase 12's v1 field events on `risk-suggestions` runs beside the v2 item events. 16-11 and 16-15's E1 journey depend on the ruling.
- Bash heredocs holding template literals failed again, so multi-line edits were written as scratchpad scripts.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- T-16-28: run ancestry is checked in the transaction, with a 404 for the whole batch, and an unknown item is a 400.
- T-16-29: `isUnitStale` is checked in the transaction, and a stale decision writes nothing.
- T-16-30: the Accept rule is checked after the batch, in either order and across batches, against the planned control.
- T-16-31: OWN_REQUEST is checked before the wrapper. Supersession carries `by` and a cause, and decisions are append-only.

## Next Phase Readiness

- 16-11 can call the decision operation with `AiProposalRunDecision` entries and read `aiProposalsDecided` in readiness. The web parser takes readiness keys as free strings.
- The ruling above is needed before the web "Add to assessment" journey can reach release with the added Risk kept.
- ASSESS-09 and ASSESS-10 are not marked complete: they are shared IDs gated to the phase's last plan.

## Self-Check: PASSED

## Addendum (2026-10-16): pilot ruling 729ef6e0

- **The ruling.** The pilot approved option 1 of `deferred-items.md` (G-6, `729ef6e0`; item 1 of the "Phase 16 execution amendment (2026-10-16)" in `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`). A `risk-suggestions` run accepts Phase 12's v1 field and suggested-control events when their `target` is a Risk the run added, beside its v2 item events. Still refused with nothing written: a v1 event for any other target, any v1 event on a `risk-rewrite` run, and a v2 event on a Phase 12 run. Release stays gated by `aiProposalsReviewed`. The pilot also approved two things as built: the `over-limit` adjustment code for suggestions past eight (item 2), and `undo: true` on the `ai-run` `updated` row that restores a confirmed change (the Phase 16 record's amendment).
- **The fix.** `parseRiskSuggestionsDecisionLog` in `ai-run-record.ts` parses a suggestions run's log entry by entry, using `schemaVersion`. It keeps the stored order in `events`, the v2 family in `items` and the v1 family in `fieldReview`. A v1 event that targets the assessment, or any other `schemaVersion`, damages the log. `parseRunDecisionsFor("risk-suggestions")` now returns only `items`, so every item fold (the decisions, the proposals read, the context loader) reads v2 only. `appendAiRunDecisions` takes a v1 event on a suggestions run only when `aiRunCreatedItem` (new in `risk-history.ts`) finds the target's `created` row naming this run and a suggestion item. If it does not, the whole append is refused. No other writer of the log exists. No read shape, spec or schema changed, so `api:check` was not needed.
- **Commits.** RED `488e3d2e` test(16-10): expect an added risk's field review and edits on its suggestion run. GREEN `68706176` fix(16-10): review and edit an added risk's fields on its suggestion run (G-6, 729ef6e0).
- **Tests.**
  - RED: `ai-provider-risk-proposals.unit` and `risk-proposal-decisions.integration` gave 39 of 41. The two failures were assertions: the item fold returned null on a mixed log, and the added Risk's edit answered `EDIT_409_AI_RUN_RECORD_UNAVAILABLE`. The refusal case passed in RED, as a regression guard.
  - GREEN: the same two files passed 41 of 41.
  - Neighbouring files passed 221 of 221: `ai-proposal-decisions` unit and integration, `ai-run.integration`, `ai-run-boot.unit`, `ai-provenance.unit`, `authorization-matrix-provenance.unit`, `risk-proposal-envelope.unit`, `risk-proposals.integration`, `risk-curation` integration and rules unit, `risk-history-changes.unit`, `assessment-workflow` integration and unit, and `active-risk-readers.unit`.
  - The full Strapi suite at `68706176` passed 2,004 of 2,005, with 0 failed and 1 skipped (exit 0, 1,969 s).
- The E1 journey now reaches release with the added Risk kept: Add to assessment, an edit, Confirm remaining, then reject the rest. The integration case covers it. 16-11 and 16-15 are unblocked.
