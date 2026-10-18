---
phase: 13-request-pick-up-and-notes
plan: 02
subsystem: contract
tags: [contract-gap, request-notes, read-state, ai-input-mark, governance]
requires:
  - phase: 12-ai-context-suggestions-and-provenance
    provides: the context summary v1 (CsrmAiRun.contextSummary) that the notes record extends with a v2 notes section, and the Affected Workstreams model record
provides:
  - The approved request notes compatibility extension (G-6, approved by the pilot on 2026-10-09)
  - The names later plans use: CsrmRequestNote, CsrmRequestNoteReadState, the four link tables, the four operations, notes_api and note_ai_input_api, NOTES_CLOSED, NOTES_LIMIT_REACHED, REQUEST_HAS_NOTES, CONTEXT_TOO_LARGE, HISTORY_UNAVAILABLE, acceptsNotes, canUseRequestNotes, authorPartFor, isUnreadNote
  - The generatedDate fallback rule for an unreadable or empty aiInputLog (counts as changed)
affects: [13-05, 13-06, 13-07, 13-08, 13-12, 13-13, 13-14, 13-15, 13-16, 13-17, 13-18, 13-19, 14, 15, 16, 17, 17.1, 17.2, 19, 19.1]
actuals:
  tokens: 8200
  tasks: 3
  commits: 3
plan_head_before: 42db8c10742545277efc9343cb1c1e7923773599
plan_head_after: c590869a78f954626a5584818cc74bd11538a5e7
tech-stack:
  added: []
  patterns: [append-only records with a per-request sequence assigned under the request lock; personal read state advanced monotonically by an explicit mark-read; current fact (changesAiInputs) beside an append-only, capped, versioned log (aiInputLog), the 06.8 split]
key-files:
  created:
    - docs/contract-gaps/phase-13-request-notes.md
  modified: []
key-decisions:
  - "Request notes are exactly two new content types, CsrmRequestNote and CsrmRequestNoteReadState, with no inverse attribute on CsrmAssessmentRequest or IdamBoxUser and no core router, approved by the pilot on 2026-10-09 (G-6); plan 13-05 may create them."
  - "Unread is computed from the note's sequence against the reader's lastReadSequence, never from post times; no GET has a side effect."
  - "The AI-inputs-changed signal's generatedDate fallback counts a marked note as changed when its aiInputLog cannot be parsed or holds no event setting the mark (orchestrator, 454b03d): the signal is advisory and analyst-only, so it fails toward showing a possibly changed input."
  - "The pilot's approval line is kept verbatim (lower case, bold); the plans' approval checks accept it case- and bold-insensitively (c9b091d)."
requirements-completed: []  # COLLAB-01 is traced by this plan but delivered by the phase; it is marked complete at the 13-19 gate (the 12-01 and 13-01 precedent)
coverage:
  - id: D1
    description: "The request notes contract-gap record in JDL terms, with sequence and lastReadSequence, the readers, read state, AI-input mark, AI context and Affected Workstreams sections"
    requirement: COLLAB-01
    verification:
      - kind: other
        ref: "Task 1 <verify> grep chain (exit 0 at a92debc); acceptance strings re-checked at c590869"
        status: pass
    human_judgment: false
  - id: D2
    description: "The record approved by the pilot and carrying its dated approval"
    requirement: COLLAB-01
    verification:
      - kind: other
        ref: "Task 3 <verify> (approved heading plus dated approval status line, case- and bold-insensitive): exit 0"
        status: pass
    human_judgment: true
    rationale: "Governance approval (G-6) is a human decision; the pilot gave it on 2026-10-09 and wrote it into the record."
duration: 20min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 02: Request Notes Record Summary

**The request notes extension (two append-only content types, `CsrmRequestNote` with a per-request `sequence` and `CsrmRequestNoteReadState` with `lastReadSequence`, four link tables, no inverse attribute, no core router, four operations, the `acceptsNotes` window, the `canUseRequestNotes` readers with 404 for everyone else, and the analyst-only AI-input mark with its capped log) is approved by the pilot on 2026-10-09, so plan 13-05 may create the notes content types.**

PHASE_13_BASE=ab000f6

## Performance

- **Duration:** about 20 min of executor time across two sessions (Task 1 committed 2026-10-09 01:50 +11:00; Task 3 and this summary at about 02:03 +11:00 after the pilot's approval)
- **Completed:** 2026-10-09
- **Tasks:** 3 of 3 (Task 2 was the pilot's checkpoint)
- **Files modified:** 1

## Accomplishments

- Wrote `docs/contract-gaps/phase-13-request-notes.md` in the 06.8 record's style: the gap (no comment or activity entity in the JDL; catalogue design note 6), the compatibility extension in JDL terms with its attribute table and link tables, write discipline (append-only, lock-assigned `sequence`, 500-note cap, `REQUEST_HAS_NOTES` on delete), the posting window, the readers, the read state, the AI-input mark, notes in the AI context (the v2 notes section, the 50-marked-note bound, the AI-inputs-changed signal), what it does not add, Affected Workstreams (only `csrm` today; every existing-endpoint change named), migration, audit semantics and later phases.
- The orchestrator settled the `generatedDate` fallback for an unreadable mark history (`454b03d`) before approval.
- The pilot approved the record (G-6); it now carries `## Approved Compatibility Extension` and the pilot's dated approval line.

## Task Commits

1. **Task 1: Write the request notes contract-gap record**: `a92debc` (record); `454b03d` (orchestrator: the `generatedDate` fallback rule for an unreadable or empty `aiInputLog`)
2. **Task 2: The pilot approves the request notes record (G-6)**: checkpoint:decision, no executor commit; the pilot's approval is in `ef0fcc9`
3. **Task 3: Write the approval into the record**: `c590869` (the heading rename only)

Commit count measured with `git log --oneline 42db8c1..HEAD --grep="(13-02)"` (3: `a92debc`, `454b03d`, `c590869`). `plan_head_before` is `42db8c1`, the parent of the plan's first commit; the range also holds 13-01 and orchestrator commits (`93f100c`, `ef0fcc9`, `c9b091d`, `27b3c03`, `56338e7`), so the plan's own commits are counted by their `(13-02)` scope.

## Checkpoint: decision

Task 2, the pilot's answer, verbatim: `approved`

Approval date: 2026-10-09.

The approval line was written by the pilot, in commit `ef0fcc9` ("docs(13): approve the request assignment and notes contract gaps"), and is kept verbatim:

> Status: **approved by the pilot on 2026-10-09** (G-6), for the two content types exactly as the "Compatibility Extension" section states them.

In the same commit the pilot added "What the pilot checked" (JDL and catalogue design note 6, API contract, role-function catalogue, and more) and corrected the record's notification references: G-19 moved the "new notes" event to Phase 19.1. Phase 13 still sends nothing.

Task 3 changed only the heading `## Compatibility Extension (awaiting approval)` to `## Approved Compatibility Extension`, which is not a line the pilot wrote. No status line was added or rewritten.

## Verification

- Task 1 verify: exit 0 (at `a92debc`). Its awaiting-approval grep no longer applies, because the pilot's approval replaced that line; every other acceptance string (`entity CsrmRequestNote`, `entity CsrmRequestNoteReadState`, `CsrmRequestNotePart`, `sequence Integer required`, `lastReadSequence`, `changesAiInputs`, `aiInputLog`, `csrm_request_note_read_states_assessment_request_lnk`, `acceptsNotes`, `canUseRequestNotes`, `NOTES_CLOSED`, `NOTES_LIMIT_REACHED`, `REQUEST_HAS_NOTES`, `CONTEXT_TOO_LARGE`, `contextSummary`, `R-08-37`, `## Affected Workstreams`, `## Approval`) is present at `c590869`.
- Task 3 verify (`^## Approved Compatibility Extension` and the dated approval status line, case- and bold-insensitive): exit 0.
- `git ls-files -- apps/backend/src/api/csrm-request-note` prints nothing, and the folder does not exist.
- Content-type freeze: `git diff --name-only ab000f6 -- 'apps/backend/src/api/*/content-types/*'` prints nothing.
- `git diff --check ab000f6 -- docs/contract-gaps/phase-13-request-notes.md`: clean.
- No tests, Strapi source, specification or Playwright touched (as planned).

## Files Created/Modified

- `docs/contract-gaps/phase-13-request-notes.md`: the approved request notes compatibility extension.

## Decisions Made

- The notes schema change is exactly the two content types and four link tables the record names (`csrm_request_notes_assessment_request_lnk`, `csrm_request_notes_author_lnk`, `csrm_request_note_read_states_reader_lnk`, `csrm_request_note_read_states_assessment_request_lnk`), approved by the pilot (G-6). Any other content-type change in Phase 13 needs its own record and checkpoint.
- COLLAB-01 is not marked complete here: this plan writes only the record the notes work builds on, and no one can post a note yet. It stays Pending until the phase gate (the 12-01 and 13-01 precedent).

## Deviations from Plan

1. **[Orchestrator] The `generatedDate` fallback for an unreadable mark history (`454b03d`).** Before approval the orchestrator added to `## Notes in the AI Context` that a currently marked note whose `aiInputLog` cannot be parsed, or holds no event setting the mark to `true`, counts as changed since generation. The signal is advisory and analyst-only, so it fails toward showing a possibly changed input; plan 13-17 implements it. The pilot approved the record with this rule in it.
2. **[Orchestrator] Approval checks accept the pilot's verbatim line (`c9b091d`).** The pilot wrote `Status: **approved by the pilot on 2026-10-09** (G-6)` (lower case, bold) rather than the plan's `Status: Approved by the pilot on YYYY-MM-DD (G-6)`. The orchestrator made the plans' approval checks (13-01 and 13-02 Task 3 verify, must_haves, and the 13-03 and 13-05 preconditions) case- and bold-insensitive, so the pilot's line is kept verbatim; Task 3's verify passes against it.
3. **Task 3 scope.** The pilot had written the approval line but not renamed the heading, so Task 3 made the one remaining edit (the heading rename) and committed it, per the plan's "write only what is missing" branch.

**Impact on plan:** none on scope; the approval and freeze guarantees hold.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 13-05's precondition holds: the record carries `## Approved Compatibility Extension` and the dated approval line; it may create exactly the two approved notes content types.
- Wave 1 (13-01 and 13-02) is complete; 13-03 runs next.

## Self-Check: PASSED

- FOUND: docs/contract-gaps/phase-13-request-notes.md (contains "by the pilot on 20" and "## Approved Compatibility Extension")
- FOUND: a92debc, 454b03d, ef0fcc9, c9b091d, c590869

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*
