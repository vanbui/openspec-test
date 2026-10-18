---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 02
subsystem: backend-pure-rules
tags: [risk-withdrawal, risk-history, ai-proposals, proposal-item-core, field-units, accept-rule, duplicates, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-01's approved record (withdrawal facts, history envelope v1, curation body) and the Phase 16 amendment to the Phase 12 run record (risk proposal envelope v1, decision payloads, causes)"
  - phase: 15-steerable-questionnaire-ai
    provides: "proposal-items.ts (decision event v2, the fold) and text-similarity.ts (isNearDuplicate, tokenSetSimilarity)"
  - phase: 12-ai-assisted-assessment
    provides: "risk-scale.ts (deriveRating, acceptProposalAllowed), ai-provenance.ts (RISK_AI_FIELDS, per-field facts), the internal draft risk v2 parser"
provides:
  - "apps/backend/src/csrm/active-risk.ts: isActiveRisk, activeRisks, ACTIVE_RISK_FILTER, WITHDRAWN_RISK_FILTER, activeRiskSql"
  - "apps/backend/src/csrm/risk-curation-rules.ts: RISK_CURATION_BATCH_MAX, RISK_CURATION_ID_MAX_LENGTH, UNDO_WITHDRAWAL_REASON, RiskCurationBodyError, parseRiskCurationBody, partitionWithdrawal, partitionReinstatement"
  - "revert-reason.ts: parseReasonText (parseRevertReason calls it)"
  - "apps/backend/src/csrm/risk-history-changes.ts: RISK_HISTORY_KINDS, RISK_HISTORY_SOURCES, RISK_HISTORY_CHANGES_SCHEMA_VERSION, RISK_HISTORY_MAX_FIELDS, RISK_HISTORY_FIELDS, CONTROL_IMPLEMENTATION_HISTORY_FIELDS, normaliseHistoryValue, riskChanges, controlImplementationChanges, buildRiskHistoryChanges, parseRiskHistoryChanges"
  - "proposal-items.ts: optional DecisionPayloadParsers.itemKey; causes risk-withdrawn (superseded only) and assessment-not-editable (lapsed only)"
  - "apps/backend/src/csrm/ai/risk-proposals/risk-proposal-envelope.ts: parseRiskProposal, riskDecisionPayloads, parseRiskDecisionEvents, RISK_PROPOSAL_ADJUSTMENT_CODES and the envelope types"
  - "apps/backend/src/csrm/ai/risk-proposals/field-units.ts: RISK_UNIT_DEFINITIONS, FOCUS_PARTS, normaliseRiskValues, diffIntoUnits, isUnitStale, unitApplyValues, aiAcceptCheck, residualRatingAfter"
  - "apps/backend/src/csrm/ai/risk-proposals/risk-duplicates.ts: RISK_SIMILARITY_THRESHOLD, riskComparisonText, classifyProposedRisk"
affects: [16-03, 16-04, 16-05, 16-06, 16-08, 16-09, 16-10, phase-17]

actuals:
  tokens: 29500
  tasks: 4
  commits: 46  # git rev-list --count 5202ba4b..HEAD (the ledger base, 16-01's last commit): it counts the IAM and main merge commits that landed on csrm during the pause too; the plan's own commits are the nine listed under "Task Commits"

plan_head_before: 5202ba4b8bc664ad6e77338da3f44d4880f590c5
plan_head_after: 7175b7944e318834f93450fd72e4e3494c26dc12

tech-stack:
  added: []
  patterns:
    - "One rule in three forms (predicate, Document Service filter, SQL fragment) for the active-risk rule"
    - "Closed, frozen, never-throwing read parsers for every stored JSON shape (history envelope, risk proposal, decision payloads)"
    - "Target-specific item keys through one optional hook on Phase 15's item core; the fold is unchanged"
    - "Field-change units with a normalised base, derived ratings and an Accept that travels with its plan"

key-files:
  created:
    - apps/backend/src/csrm/active-risk.ts
    - apps/backend/src/csrm/risk-curation-rules.ts
    - apps/backend/src/csrm/risk-history-changes.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-envelope.ts
    - apps/backend/src/csrm/ai/risk-proposals/field-units.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-duplicates.ts
    - apps/backend/tests/risk-curation-rules.unit.test.ts
    - apps/backend/tests/risk-history-changes.unit.test.ts
    - apps/backend/tests/risk-proposal-envelope.unit.test.ts
    - apps/backend/tests/risk-field-units.unit.test.ts
    - apps/backend/tests/risk-duplicates.unit.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/revert-reason.ts
    - apps/backend/src/csrm/ai/proposal-items.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts
    - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
    - apps/backend/tests/proposal-items.unit.test.ts

key-decisions:
  - "partitionWithdrawal and partitionReinstatement take an optional order (the request's riskIds); rows follow it, unknown rows last; a reinstatement with no withdrawn row (an empty batch included) refuses RISK_NOT_WITHDRAWN"
  - "parseRiskCurationBody messages: 'CSRM risk curation reason is invalid.' for a bad reason, 'CSRM risk curation data is invalid.' for everything else; ids are not trimmed (an unknown id is the caller's 404)"
  - "History normalisation: a relation label is the caller's relationLabel first, then the record's own displayName/name/title/label, else null; a relation compares by documentId only; exemptionReviewDate (a datetime) is kept as its ISO string, date fields cut to YYYY-MM-DD"
  - "The history envelope parser also refuses a repeated field and a field name over 64 characters; control.name may be any string"
  - "RISK_UNIT_DEFINITIONS is keyed by the item key (u-risk-type ... u-treatment-plan), sixteen units"
  - "Risk envelope v1 parse rules beyond the record: u-treatment must propose Accept and carry aiAccept: true; u-treatment-action proposes Treat only; rating units must hold the derived rating; one riskDocumentId per rewrite and no field in two units; sources only on units with a statement field; similarTo.itemKey is a suggestion key"
  - "diffIntoUnits re-derives each rating unit's rating from the proposed likelihood and consequence (D-36), treats a field the proposal does not name as unchanged, returns an extra dropped list beside units and adjustments, and aggregates adjustments as one no-change and one outside-focus entry with a count"
  - "aiAcceptCheck treats a missing residual rating as accept-not-permitted; residualRatingAfter falls back to the stored rating when the likelihood or consequence is missing"
  - "classifyProposedRisk compares Risk Types by the caller's identity string (name or documentId, the same form in every pool); a tie between similar scores keeps the earlier pool"

patterns-established:
  - "Phase 17's reassessment reuses field-units.ts unchanged (it names no operation; grep risk-rewrite is 0)"

requirements: [ASSESS-09, ASSESS-10]
requirements-completed: []  # shared IDs: marked complete by the phase's last plan

duration: 55min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 02: Pure Curation, History and Risk Proposal Rules Summary

**The deep pure modules every later Phase 16 plan calls: the active-risk rule in three forms, the closed withdraw/reinstate body with its batch partitions, the history change diff and closed envelope v1, Phase 15's item core extended to Risk targets with the risk proposal envelope v1, the generic field-change units with staleness and the one Accept rule, and the two-tier duplicate classifier. No Strapi, and no workflow calls them yet.**

## Performance

- **Duration:** about 55 min this session, 33 of them the full Strapi suite (RED of Task 1 at 14:07 +11:00 before the operator's pause; resumed 15:07, finished 16:00 +11:00)
- **Tasks:** 4, each RED then GREEN
- **Files:** 11 created, 5 modified

## Accomplishments

- **Active-risk rule** (`active-risk.ts`, D-05, D-13): `isActiveRisk` reads `withdrawnAt` only; `ACTIVE_RISK_FILTER` / `WITHDRAWN_RISK_FILTER` are frozen; `activeRiskSql(alias)` refuses an alias outside `/^[a-z_][a-z0-9_]{0,30}$/`.
- **Curation rules** (`risk-curation-rules.ts`, D-06, D-09 to D-11): exactly `{ riskIds, reason }` or `{ riskIds, undo: true }`; 1 to 200 unique ids of 1 to 255 characters; the reason through `parseReasonText` (the revert bound, 500); `RiskCurationBodyError` carries `status: 400`. `UNDO_WITHDRAWAL_REASON = "Withdrawal undone"`; a typed reason never marks an undo.
- **History** (`risk-history-changes.ts`, D-18, D-19): the seven kinds and two sources (frozen); `riskChanges` and `controlImplementationChanges` list only fields whose normalised value differs, a relation as `{ documentId, label }`; `buildRiskHistoryChanges` throws on more than 40 fields; `parseRiskHistoryChanges` returns a frozen envelope or null and never throws.
- **Item core** (`proposal-items.ts`): `parseEvent` validates the item through `parsers.itemKey ?? isProposalItemKey`; `DecisionPayloadParsers` gains only the optional `itemKey` (its `editFields` is reused, no `edits` member); `parseCause` accepts `risk-withdrawn` only with `superseded` and `assessment-not-editable` only with `lapsed`. The fold and `nextState` are unchanged.
- **Risk envelope** (`risk-proposal-envelope.ts`, D-39 to D-41): `parseRiskProposal(value, allowed?)` (suggestions `s-1` to `s-8` through Phase 12's draft risk parser, rewrite units against `RISK_UNIT_DEFINITIONS`, at most 60 adjustments from the thirteen codes); `riskDecisionPayloads` (item keys, `editFields: []`, `before` `{ riskDocumentId, values, fieldFacts }`, `applied` `{ riskDocumentId, values? }`); `parseRiskDecisionEvents`. No `itemStates`.
- **Units** (`field-units.ts`, D-34 to D-38): sixteen units over the twenty AI-writable fields; `diffIntoUnits`, `isUnitStale`, `unitApplyValues`; `aiAcceptCheck` over `acceptProposalAllowed` with the caller's planned-control boolean; `residualRatingAfter` applies units in order, so a High residual and an Accept are refused in either order.
- **Duplicates** (`risk-duplicates.ts`, D-32): near-identical (types match, both null counts, `isNearDuplicate` on statement plus cause), else the best similar match at 0.5 or above, else distinct; pools in the order active, withdrawn, rejected, open, sameRun.

## Task Commits

Earlier session (before the operator's pause):

1. Task 1 RED: `aa14dc26` test(16-02): pin the active-risk rule, the curation body and the history change envelope
2. Task 1 WIP: `b097f2de` wip(16-02): partial active-risk module and curation reason parser (kept in history; reviewed on resume against the recorded planning decisions and Task 1's behaviour, no change needed)

This session:

3. Task 1 GREEN: `77fb9c04` feat(16-02): add the active-risk rule, the curation rules and the history change envelope
4. Task 2 RED: `288c3783` test(16-02): pin risk proposal envelope v1 on the shared item core
5. Task 2 GREEN: `76edf454` feat(16-02): extend the proposal item core to risk targets and add the risk proposal envelope
6. Task 3 RED: `227c47be` test(16-02): pin field-change units, staleness and the Accept rule
7. Task 3 GREEN: `7f597901` feat(16-02): add the generic field-change units with staleness and the Accept rule
8. Task 4 RED: `24eb1f70` test(16-02): pin the duplicate tiers on UAT-A-like fixtures
9. Task 4 GREEN: `7175b794` feat(16-02): add the two-tier duplicate classifier

**Plan metadata:** the `docs(16-02)` commit adding this summary with STATE.md, state.json and ROADMAP.md.

## Verification

| Command | Result |
| --- | --- |
| Task 1 verify (both tsc, `risk-curation-rules`, `risk-history-changes`, `questionnaire-workflow` unit files) | 36/36 pass |
| Task 2 verify (`proposal-items`, `risk-proposal-envelope`, `questionnaire-proposal-envelope`) | 41/41 pass |
| Extra after Task 2 (changed Phase 12 modules): `ai-provenance`, `ai-provider-assessment`, `ai-provider-failures`, `ai-provider-guardrails`, `assessment-workflow` unit files | 88/88 pass |
| Task 3 verify (`risk-field-units`, plus `risk-proposal-envelope` and `proposal-items` re-run) and `grep -c risk-rewrite field-units.ts` = 0 | 33/33 pass; grep 0 |
| Task 4 focused (`risk-duplicates`) | 12/12 pass |
| Task 4 verify: `tsc` and the FULL Strapi suite (`pnpm --dir apps/backend test`) | 1,860 passed, 0 failed, 1 skipped of 1,861 (exit 0, 1,966 s) |
| Freeze diff: `git diff --name-only 01dc4118 -- 'apps/backend/src/api/*/content-types/*'` with the three IAM exclusions | empty (pass) |
| Acceptance greps: no `@strapi` in the three Task 1 modules; `parseDecisionEventsV2` imported by the envelope, no `itemStates`; `parsers.itemKey ?? isProposalItemKey` in `parseEvent` | pass |

## Decisions Made

See `key-decisions` above. The ones a later plan must know:

- `RISK_UNIT_DEFINITIONS` keys are the item keys (`u-…`); `RiskUnitKey` is that union.
- `diffIntoUnits(base, proposed, { focus })` returns `{ units, dropped, adjustments }` (`dropped` is extra: `{ key, code }` per dropped unit). Its `adjustments` are `{ code, count, detail }` with CSRM's own sentence, ready for the envelope.
- `parseRiskProposal`'s optional `allowed` is `{ context: AssessmentContextAllowedSets, riskDocumentId? }`.
- `classifyProposedRisk` returns `against: { kind, ref }` with kinds `active | withdrawn | rejected | open | sameRun`; the envelope's `similarTo` has no `sameRun` kind, so 16-08's adapter maps a similar same-run match (or leaves it unflagged) when it builds `similarTo`.

## Deviations from Plan

### Auto-fixed / plan-shape adjustments

**1. [Rule 3 - Blocking] `field-units.ts` created in Task 2 (definitions only), completed in Task 3**
- **Found during:** Task 2 GREEN
- **Issue:** `riskDecisionPayloads.itemKey` and `parseRiskProposal` need `RISK_UNIT_DEFINITIONS`, which the plan places in Task 3's module.
- **Fix:** Task 2's commit created `field-units.ts` with `FOCUS_PARTS`, `RISK_UNIT_DEFINITIONS`, `RiskUnitKey` and `isRiskUnitKey`; Task 3 added the functions.
- **Commits:** `76edf454`, `7f597901`

**2. [Rule 3 - Blocking] Phase 12's draft risk parser exported for one risk (`assessment-draft-provider.ts`, not in `files_modified`)**
- **Issue:** the plan parses each suggestion's `proposed` with "Phase 12's internal draft risk parser for one risk", which was module-private and required the context's allowed sets.
- **Fix:** exported `parseAssessmentRiskDraft(value, allowed | null, index)`. With allowed sets it is the existing parser unchanged; with null (a stored envelope read back) the record links are checked for shape only (type name, system and asset ids bounded strings, classification one of `DATA_CLASSIFICATIONS` and only with an asset, control ids bounded strings). The Phase 12 unit files that cover it pass (88/88).
- **Commit:** `76edf454`

**3. [Rule 3 - Blocking] `isRiskAiFieldFact` exported from `ai-provenance.ts` (not in `files_modified`)**
- **Issue:** the decision `before.fieldFacts` must be "parsed with 12-04's field-fact parser", which was module-private.
- **Fix:** a four-line exported wrapper over the existing `fieldFact` check; no behaviour change. When a later plan adds the per-field `runId`, `before.fieldFacts` accepts it with no change here.
- **Commit:** `76edf454`

**4. [Plan detail] UAT-A fixtures as object literals**
- No code fixture defines UAT-A's "offshore administrator access" risk (`uat-a-like-context.ts` has the request, systems, asset and four Risk Types; the deterministic draft provider drafts none about offshore access). The test writes the three drafted risks as literals (offshore administrator access, personal information handling, the external payroll processor), as the task's action allows. The reworded restatement scores 0.577 against the offshore risk (asserted in [0.5, 0.8)); the payment-file integrity risk scores 0.09, 0.03 and 0 against the three.

**Total deviations:** 3 blocking adjustments plus one fixture note. No scope creep: every extra export exists for a plan-named caller.

## Issues Encountered

- A Bash heredoc carrying a large Python edit hit a quoting error; the module was written with the file tool instead. No effect on the result.

## Known Stubs

None. The modules have no caller yet by design (plan objective: "No workflow calls them yet").

## Next Phase Readiness

- 16-03 onwards can import every listed export. 16-08 uses `diffIntoUnits`, `aiAcceptCheck`, `classifyProposedRisk`, `normaliseRiskValues` and `parseRiskProposal(envelope, { context, riskDocumentId })`; 16-10 uses `isUnitStale`, `residualRatingAfter` and `aiAcceptCheck`.

## Self-Check: PASSED

- All eleven created files exist; the five modified files carry the changes listed.
- All nine plan commits exist: `aa14dc26`, `b097f2de`, `77fb9c04`, `288c3783`, `76edf454`, `227c47be`, `7f597901`, `24eb1f70`, `7175b794`.
- The full Strapi suite exited 0; the freeze diff is empty.

---
*Phase: 16-risk-curation-and-targeted-ai-re-runs*
*Completed: 2026-10-15*
