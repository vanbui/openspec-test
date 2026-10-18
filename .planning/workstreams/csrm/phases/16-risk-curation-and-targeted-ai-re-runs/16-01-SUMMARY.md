---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 01
subsystem: contract-records
tags: [contract-gap, G-6, design-direction, risk-withdrawal, risk-history, ai-proposals, shared-backend]

requires:
  - phase: 15-steerable-questionnaire-ai
    provides: "X-24 to X-26 in the direction; the Phase 15 amendment to the Phase 12 run record (decision event v2, folded item states, context summary v4)"
  - phase: 13-request-notes-and-assignment
    provides: "the notes record's AI-inputs signal and its baseline rule"
provides:
  - "X-27 Withdrawn records, X-28 Field decisions and similar records, X-29 Record history in docs/design/csrm-design-direction.md"
  - "the approved Phase 16 contract-gap record docs/contract-gaps/phase-16-risk-withdrawal-and-history.md (withdrawal facts, CsrmRiskHistoryEvent, operations, reasons, active-risk rule, editable guard)"
  - "the approved Phase 16 amendments to the Phase 12 run record (risk proposal envelope v1, decision payloads, per-field runId, context summary v5), the Phase 04 draft-job contract and the Phase 13 notes record (assessment AI-inputs baseline)"
  - "PHASE_16_BASE=01dc4118 for every later freeze check and the 16-15 gate"
affects: [16-02, 16-03, 16-04, 16-05, 16-06, 16-07, 16-08, 16-09, 16-10, 16-11, 16-12, 16-13, 16-14, 16-15, phase-17, phase-17.1, phase-17.2, phase-18, phase-20, phase-21]

actuals:
  tokens: 20200
  tasks: 3
  commits: 3  # git rev-list --count 01dc4118..03e80ca6: two executor commits and the pilot's approval commit; the docs(16-01) metadata commit follows

plan_head_before: 01dc41183ff49a2c4c7d364f256d8566ab80fbef
plan_head_after: 03e80ca6bd899d5cf73d3d0be6d3edd272bd57ba

tech-stack:
  added: []
  patterns:
    - "Current fact plus append-only log for Risks: withdrawal facts on CsrmRisk, history in its own unidirectional entity"
    - "Risk proposals on Phase 15's one proposal model: immutable envelope, decision event v2, state folded, nothing stored"
    - "Per-field run references: readers resolve fact.runId ?? envelope.runId"

key-files:
  created:
    - docs/contract-gaps/phase-16-risk-withdrawal-and-history.md
  modified:
    - docs/design/csrm-design-direction.md
    - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
    - docs/contract-gaps/phase-04-deterministic-draft-jobs.md
    - docs/contract-gaps/phase-13-request-notes.md

key-decisions:
  - "Phase 16 contract records approved by the pilot on 2026-10-15 (G-6): withdrawal facts on CsrmRisk, CsrmRiskHistoryEvent, the risk proposal envelope v1, context summary v5 and the assessment AI-inputs baseline move to the newest completed assessment-draft or risk-suggestions run"
  - "History change envelope: created rows list initial values with from null, control-implementation-removed rows list removed values with to null, withdrawn and reinstated rows carry fields []"
  - "undo: true on a withdrawal of a Risk with no withdrawn history event is a 400; restoring an added suggestion and restoring a changed confirmed unit are AI_PROPOSAL_UNDO_UNAVAILABLE"
  - "Per-field runId is an optional key at Risk aiProvenance schemaVersion 1; a hand-created Risk gains the envelope at its first confirmed rewrite unit"
  - "The decision entry also gains the optional reason (additive); a requesting analyst gets 403 OWN_REQUEST on the risk proposals read, job read and retry"

patterns-established:
  - "Each Phase 16 record and amendment carries Affected Workstreams with the iam grep and every changed existing endpoint's compatibility position"

requirements-completed: [ASSESS-09, ASSESS-10]

coverage:
  - id: D1
    description: "X-27 to X-29 recorded verbatim from 16-UI-SPEC at the planned places in the design direction"
    requirement: ASSESS-09
    verification:
      - kind: other
        ref: "Task 1 <automated> verify (direction label greps) and git diff 01dc4118 -- docs/design/csrm-design-direction.md showing only added lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Phase 16 contract-gap record and the three dated amendments, each with Affected Workstreams, approved by the pilot (G-6)"
    requirement: ASSESS-10
    verification:
      - kind: other
        ref: "Task 1 <automated> verify; Task 3 <automated> verify (four approval lines, no awaiting line)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 01: Contract Records and Direction Entries Summary

**The approved Phase 16 contract: withdrawal facts on `CsrmRisk` and an append-only `CsrmRiskHistoryEvent`, risk proposals on Phase 15's one proposal model (envelope v1, decision event v2 payloads, per-field `runId`, context summary v5), the narrowed Phase 04 draft-job rule and the assessment's new AI-inputs baseline. The direction now records X-27 to X-29.**

PHASE_16_BASE=01dc4118

## Performance

- **Duration:** 14 min, with the pilot's review in between
- **Started:** 2026-10-15T02:48:00Z
- **Completed:** 2026-10-15T03:02:00Z
- **Tasks:** 3 (Task 1 executed, Task 2 the pilot's approval, Task 3 check-only)
- **Files modified:** 5

## Accomplishments

- **Direction.** X-27 "Withdrawn records" is a new `### Withdrawn records` heading after "Status & risk badges". X-28 "Field decisions and similar records" follows the X-24 bullet. X-29 "Record history" follows the Side sheet bullet. Each was copied verbatim from the 16-UI-SPEC by script, and the file has only added lines.
- **Record** `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, with all 17 planned sections. It covers:
  - `withdrawnAt`, `withdrawnBy` and `withdrawalReason`;
  - `csrm_risk_history_events`, with seven kinds, two sources and change envelope v1;
  - the eight operations and the closed `undo: true` flag;
  - the four new reasons;
  - no hard delete, including `REQUEST_HAS_ASSESSMENT`;
  - the active-risk rule in three forms;
  - the editable guard;
  - `## Affected Workstreams`, which lists ten changes, each with its compatibility position.
- **Phase 12 amendment.** It adds:
  - the `risk-suggestions` and `risk-rewrite` operations;
  - the risk proposal envelope v1;
  - Risk payloads on decision event v2, with the `risk-withdrawn` and `assessment-not-editable` causes;
  - the derived open set, which fails open;
  - the per-field `runId`;
  - **context summary v5** with `riskProposals`.
- **Phase 04 amendment.** Targeted proposal operations may invoke the provider again; the draft job keeps all of its rules.
- **Phase 13 notes amendment.** The assessment's baseline is now its newest completed `assessment-draft` or `risk-suggestions` run. One pointer sub-bullet was added; the Phase 15 sub-bullet is unchanged.

## The `iam` grep

Re-run on 2026-10-15 and recorded in the record and in all three amendments:

```
grep -rlE "csrm-risk|CsrmRisk|risk_assessments|assessment_requests|csrm-assessment-request|AiRun|ai_runs|ai_proposal|/v1/risks|REQUEST_HAS|aiInputsChanged|contextSummary" .planning/workstreams/iam/
```

Result: it printed nothing (exit status 1). The only backend references in `iam` are `/api/v1/info` and the `idambox-user` content type's schema, and neither changes.

## The pilot's answer (Task 2), verbatim

> G-6 approved: the pilot wrote the four dated approval lines (2026-10-15) and committed them in 03e80ca6. Your six open choices are all confirmed as written (recorded in the approval notes).

## Approval lines (approval written by the pilot, dated 2026-10-15, commit `03e80ca6`)

Copied verbatim:

- `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`: `Status: **approved by the pilot on 2026-10-15** (G-6).`
- `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: `Phase 16 amendment status: **approved by the pilot on 2026-10-15** (G-6).`
- `docs/contract-gaps/phase-04-deterministic-draft-jobs.md`: `Phase 16 amendment status: **approved by the pilot on 2026-10-15** (G-6).`
- `docs/contract-gaps/phase-13-request-notes.md`: `Phase 16 amendment status: **approved by the pilot on 2026-10-15** (G-6).`

**Task 3 check.** The plan's verify command (`tr -d '*'` and then the four date-agnostic greps, plus no `status: awaiting` line in any of the four files) exited 0. This task changed no file and made no commit. `git diff --name-only 01dc4118 -- apps/backend/src docs/references` prints nothing.

## Task Commits

1. **Task 1: direction entries.** `c7395277` (docs)
2. **Task 1: record and three amendments.** `79a38410` (docs)
3. **Task 2: the pilot's approval lines.** `03e80ca6` (docs, written and committed by the pilot)
4. **Task 3:** no commit (check-only)

**Plan metadata:** the `docs(16-01)` commit that adds this summary, STATE.md, state.json and ROADMAP.md.

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-27 to X-29
- `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`: the new Phase 16 record
- `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: the Phase 16 amendment
- `docs/contract-gaps/phase-04-deterministic-draft-jobs.md`: the Phase 16 amendment
- `docs/contract-gaps/phase-13-request-notes.md`: the Phase 16 amendment and the pointer sub-bullet

## Decisions Made

The plan did not fix six details. I chose them, and the pilot confirmed all six at the checkpoint:

1. **What the history's change envelope holds per kind.**
   - `created` lists the initial values, each with `from: null`.
   - `control-implementation-added` lists the implementation's values, each with `from: null`.
   - `control-implementation-removed` lists the removed values, each with `to: null`.
   - `withdrawn` and `reinstated` carry `fields: []`.
2. **`undo: true` on a withdrawal** of a Risk that has no `withdrawn` event is a 400.
3. **Restoring an added suggestion**, or a confirmed unit whose values have changed since, is refused with `AI_PROPOSAL_UNDO_UNAVAILABLE`.
4. **Per-field `runId`** is optional, and the envelope stays at `schemaVersion: 1`. A Risk created by hand gains the envelope at its first confirmed rewrite unit.
5. **The decision entry also gains the optional `reason`**, listed as additive.
6. **A requesting analyst** gets 403 `OWN_REQUEST` on the proposals read, the job read and the retry. This mirrors Phase 15's questionnaire code.

## Deviations from Plan

None. The plan was executed as written; the six choices above are within the planner's discretion and were confirmed by the pilot.

## Issues Encountered

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 16-02 can start: its precondition on the record's and the Phase 12 amendment's approval lines holds.
- Plan 16-03's schema task may change exactly the two approved schema files.
- Plan 16-10 implements the approved Phase 13 baseline amendment in `assessment-scope.ts`.

## Self-Check: PASSED

- Files present: `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` and the four modified files.
- Commits present: `c7395277`, `79a38410` and `03e80ca6`.
- Task 1's verify and Task 3's verify both exit 0.

---
*Phase: 16-risk-curation-and-targeted-ai-re-runs*
*Completed: 2026-10-15*
