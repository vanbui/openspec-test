---
phase: 15-steerable-questionnaire-ai
plan: 01
subsystem: design-and-contract
tags: [design-direction, contract-gap, ai-run-record, governance-log, questionnaire-proposals, g-6]
requires:
  - phase: 14-request-attachments
    provides: X-19 to X-23 in the design direction, the context summary v3 (attachments), and the passed Phase 14 gate
  - phase: 12-ai-assistance-and-provenance
    provides: the approved run record (CsrmAiRun instruction, contextSummary, proposal, decisions), decision event v1, context summary v1
  - phase: 10-questionnaire-governance
    provides: the Phase 10 amendments to the questionnaire governance log envelope
provides:
  - X-24 (AI proposal items), X-25 (AI instruction field) and X-26 (Answered question note) recorded verbatim in the design direction
  - The approved Phase 15 amendment to the run record (two operations, questionnaire proposal envelope v1, decision event v2, context summary v4, bounds, twelve new closed reasons, Affected Workstreams)
  - The approved Phase 15 amendment to the questionnaire governance log (ai-proposal and question-restored kinds, ten optional AI keys, Requestor projection, change count)
  - PHASE_15_BASE for every later Phase 15 freeze check and the 15-14 gate
affects: [15-02, 15-03, 15-04, 15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12, 15-13, 15-14, 16, 17, 21]
actuals:
  tokens: 12000
  tasks: 3
  commits: 4
plan_head_before: 6243d564eac75d657a75d3a1596ce23294c481b4
plan_head_after: 96e6d309d1fdcc0a55e0afc8c096ae584b8944ea
tech-stack:
  added: []
  patterns: [versioned, closed, fail-safe envelopes in existing JSON attributes, dispatched by the run's operation rather than schemaVersion; append-only governance events with an analyst-only projection]
key-files:
  created: []
  modified:
    - docs/design/csrm-design-direction.md
    - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
    - docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md
key-decisions:
  - "Both Phase 15 amendments are approved by the pilot on 2026-10-11 (G-6, 96e6d309); plan 15-02 and every later Phase 15 plan may write the new shapes."
  - "The Phase 15 context summary version is v4 (Phase 12 v1, Phase 13 v2, Phase 14 v3); the closed parser accepts v1 to v4."
  - "The notes-aware CONTEXT_TOO_LARGE copy shows the served failureMessage, with no contract change (D-29), confirmed by the pilot."
  - "QUESTIONNAIRE_ANSWERED becomes a closed 409 reason refused at enqueue by the narrowed replacement (Q-1), confirmed by the pilot."
  - "C-1 is a blocker: each new Function is granted through both its roleIds and the role's functionIds, in both catalogue copies."
  - "For the questionnaire, the AI-inputs signal's baseline is its newest completed questionnaire-generation or questionnaire-proposals run (S-2), recorded by the pilot's dated note in phase-13-request-notes.md."
requirements-completed: []  # QUES-11 and QUES-12 are traced by this plan but delivered by the phase; they are marked complete at the 15-14 gate
duration: 25min
completed: 2026-10-11
status: complete
---

# Phase 15 Plan 01: AI Proposal Patterns and the Approved Phase 15 Envelope Amendments Summary

**X-24 to X-26 are in the design direction, and the Phase 15 amendments to the run record (questionnaire proposal envelope v1, decision event v2, context summary v4, the two new operations and twelve new closed reasons) and to the questionnaire governance log (`ai-proposal`, `question-restored` and ten optional AI keys) are approved by the pilot on 2026-10-11, so plan 15-02 onwards may write the new shapes. No Strapi source and no content type changed.**

PHASE_15_BASE=15eb830b

## Performance

- **Duration:** about 25 min of executor time across two sessions (Task 1 on 2026-10-11 18:54 to 19:07 +11:00, from the phase-start commit `6243d564` to `88a23ee5`; Task 2 was the pilot's checkpoint, answered in `96e6d309` at 19:14; Task 3 and this summary at about 19:20 to 19:30 +11:00)
- **Completed:** 2026-10-11
- **Tasks:** 3 of 3 (Task 2 was the pilot's checkpoint; Task 3 changed nothing)
- **Files modified:** 3 by the executor (264 lines added, 0 removed); the pilot's `96e6d309` added 32 lines to the two records and 1 to `docs/contract-gaps/phase-13-request-notes.md`

## Accomplishments

- Recorded X-24 "AI proposal items" and X-26 "Answered question note" directly after the AI provenance bullet in `### Status & risk badges`, and X-25 "AI instruction field" at the end of `### Forms`, each verbatim from 15-UI-SPEC. The direction diff since `15eb830b` adds 5 lines and removes none.
- Appended `## Phase 15 amendment (2026-10-01): questionnaire proposals, decisions and instructions` to the Phase 12 run record, with its ten subsections (run operations and the instruction, questionnaire proposal envelope v1, bases and staleness, decision event v2 and item states, open items with the 100-run bound and the fail-open direction, the context summary's questionnaire and instruction sections, bounds, closed reasons in two lists, Affected Workstreams with its eleven changes, migration).
- Appended `## Phase 15 amendment (2026-10-01): AI proposal events and restored questions` to the 06.8 governance record, with its `### Affected Workstreams`.
- The pilot approved both amendments (G-6) and wrote the dated approvals and "What the pilot checked" into each record.

**Context summary version fixed by the amendment: v4** (from the Phase 12 record's Phase 15 amendment: "Phase 12's v1, Phase 13's v2 ... and Phase 14's v3 ... are followed by **the context summary v4**").

## Task Commits

1. **Task 1: Record X-24 to X-26 in the direction, then write both dated amendments awaiting approval**: `138c6718` (direction), `88a23ee5` (both amendments)
2. **Task 2: The pilot approves both Phase 15 amendments (G-6)**: checkpoint:decision, no executor task commit. The orchestrator's checkpoint record is `5428731f`; the pilot's approval is `96e6d309` ("docs(15-01): approve the Phase 15 amendments to the run record and the governance log").
3. **Task 3: Confirm the pilot's approvals in both records**: no commit; both records are unchanged since `96e6d309`.

Commit count: `git rev-list --count 6243d564..96e6d309` is 4 (`138c6718`, `88a23ee5`, `5428731f`, `96e6d309`), all with the `(15-01)` scope; two are the executor's task commits, one the orchestrator's checkpoint record and one the pilot's approval. `plan_head_before` is `6243d564`, the parent of the plan's first commit. The metadata commit for this summary follows.

## Checkpoint: decision

Task 2, the pilot's answer, verbatim:

> approved

Approval date: **2026-10-11**, from both records' status lines.

Both approvals were written by the pilot, in `96e6d309`, and are kept verbatim (approval written by the pilot):

- `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`:

  > Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6), for the operations, envelopes, bounds, closed reasons and changes to existing endpoints exactly as this amendment states them. Plan 15-02 and every later Phase 15 plan write these shapes only after this line.

- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`:

  > Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6), for the two kinds, the ten keys and the kinds they may appear on, the Requestor projection and the change count exactly as this amendment states them. Plan 15-02 and every later Phase 15 plan write these events only after this line.

In the same commit the pilot added "What the pilot checked" to each record (JDL, API contract, role-function catalogue, AGENTS.md and decisions 4 to 6, audit, backward compatibility, the Requestor projection, the change count, and the residual of the log's 1,000-event bound) and a dated note to `docs/contract-gaps/phase-13-request-notes.md` ("The baseline run").

### The pilot's confirmed decisions

- **D-29:** the notes-aware `CONTEXT_TOO_LARGE` copy shows the served message, with no contract change.
- **Q-1:** `QUESTIONNAIRE_ANSWERED` becomes a closed 409 reason refused at enqueue, the rule unchanged.
- **C-1 is a blocker:** each new Function is granted through both its `roleIds` and the role's `functionIds`.
- **The executor's five envelope choices, accepted as the approval lists them:** an adjustment's `detail` is CSRM's own sentence of at most 500 characters, never model or Requestor text; `section` and `visibility` only on an addition, so a change never moves its question (D-13); a change's `proposed` holds every value the question will have; a run that completes on a frozen questionnaire lapses its items (D-24) rather than failing; "never Boolean or File upload" binds only an answer type the AI proposes, so a change or a rewrite may keep the target's own type.
- **S-2, the Phase 13 record's dated baseline note (2026-10-11):** for the questionnaire, the AI-inputs signal's baseline is its newest completed `questionnaire-generation` or `questionnaire-proposals` run, so a completed proposal run clears the signal and a rewrite never does; `generation.runId` still names the latest completed generation run.

## Verification

- Task 1 verify: exit 0 (at `88a23ee5`).
- Task 2 acceptance: `git diff --name-only 15eb830b -- apps/backend/src` prints nothing (run at `96e6d309`).
- Task 3 verify (both Phase 15 sections read case- and bold-insensitively hold a dated approval, and neither holds a `status: awaiting` line): exit 0 at `96e6d309`.
- Content-type freeze: `git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'` prints nothing.
- `git diff 15eb830b HEAD -- docs/design/csrm-design-direction.md`: additions only (0 removed lines).
- No tests, Strapi source, specification, catalogue or Playwright touched (as planned: "Runs tests? No").

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-24 to X-26 as CSRM extensions dated 2026-10-01.
- `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: the approved Phase 15 amendment.
- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the approved Phase 15 amendment.
- (The pilot's `96e6d309` also touched `docs/contract-gaps/phase-13-request-notes.md`.)

## Decisions Made

- The approvals stand exactly as the pilot wrote them; Task 3 wrote no line, because each Phase 15 section already held a dated approval.
- QUES-11 and QUES-12 are not marked complete here: this plan writes only the records the phase builds on. They complete at the phase gate (15-14).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Both records carry the pilot's dated approval and no awaiting line in their Phase 15 sections, so 15-02's precondition holds and every later Phase 15 plan may write the new envelopes and events.
- X-24 to X-26 are recorded, so plans 15-11 to 15-13 may use them.
- Every later freeze check and the 15-14 gate diff from `PHASE_15_BASE=15eb830b`.

## Self-Check: PASSED

- FOUND: docs/design/csrm-design-direction.md (contains "AI proposal items (CSRM extension, 2026-10-01)", "AI instruction field (CSRM extension, 2026-10-01)", "Answered question note (CSRM extension, 2026-10-01)")
- FOUND: docs/contract-gaps/phase-12-ai-run-record-and-provenance.md (contains "## Phase 15 amendment (2026-10-01)" and "approved by the pilot on 2026-10-11")
- FOUND: docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md (contains "## Phase 15 amendment (2026-10-01)" and "approved by the pilot on 2026-10-11")
- FOUND: 138c6718, 88a23ee5, 5428731f, 96e6d309

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-11*
