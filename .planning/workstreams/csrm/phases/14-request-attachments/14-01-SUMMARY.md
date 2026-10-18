---
phase: 14-request-attachments
plan: 01
subsystem: design-and-contract
tags: [design-direction, glossary, contract-gap, request-attachments, governance]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: X-15 to X-18 in the design direction, the approved request notes record (acceptsNotes, canUseRequestNotes, CsrmRequestNotePart), withRequestLock, and the passed Phase 13 gate
provides:
  - X-19 (File field), X-20 (Upload queue), X-21 (File list), X-22 (AI input files) and X-23 (File names and sizes) recorded verbatim in the design direction
  - The Attachment glossary entry in the root CONTEXT.md
  - The approved request attachments compatibility extension (G-6, approved by the pilot on 2026-10-10)
  - PHASE_14_BASE for the 14-17 content-type freeze check
affects: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 15, 16, 17, 17.1, 19, 19.1, 20, 22]
actuals:
  tokens: 16700
  tasks: 4
  commits: 3
plan_head_before: 67186fb792ffc8427f03d9f66a7a81395596f56b
plan_head_after: 3e5b52abf0b484d2cd7c7bfeaa0fde182a9de1b4
tech-stack:
  added: []
  patterns: [request-scoped attachment record with current scan, removal and AI-inclusion facts beside an append-only, capped, versioned event log (the 06.1 and 06.8 posture)]
key-files:
  created:
    - docs/contract-gaps/phase-14-request-attachments.md
  modified:
    - docs/design/csrm-design-direction.md
    - CONTEXT.md
key-decisions:
  - "Request attachments are one new content type, CsrmRequestAttachment (csrm_request_attachments, four link tables, no inverse attribute, no core router), with six operations and two Functions, approved by the pilot on 2026-10-10 (G-6); plan 14-06 may create its schema file and plans 14-04 onwards may change the contract."
  - "The pilot's approved record is kept exactly as committed in 3e5b52a, including the heading `## Compatibility Extension (awaiting approval)`, on the pilot's instruction to change nothing else in the record; Task 4 made no commit."
requirements-completed: []  # COLLAB-02 is traced by this plan but delivered by the phase; it is marked complete at the 14-17 gate (the 13-01 and 13-02 precedent)
coverage:
  - id: D1
    description: "X-19 to X-23 recorded in the design direction with the 14-UI-SPEC wording, additions only"
    requirement: COLLAB-02
    verification:
      - kind: other
        ref: "Task 1 <verify> grep chain; git diff 67186fb HEAD -- docs/design/csrm-design-direction.md CONTEXT.md shows 0 removed lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Attachment glossary entry in the root CONTEXT.md"
    requirement: COLLAB-02
    verification:
      - kind: other
        ref: "grep -q '^\\*\\*Attachment\\*\\*:' CONTEXT.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "The request attachments contract-gap record, approved by the pilot and carrying its dated approval"
    requirement: COLLAB-02
    verification:
      - kind: other
        ref: "Task 4 <verify> parts 2 and 3 (dated approval status line, case- and bold-insensitive; no awaiting line) pass; part 1 (approved heading) fails by the pilot's instruction"
        status: unknown
    human_judgment: true
    rationale: "Governance approval (G-6) is a human decision; the pilot gave it on 2026-10-10, wrote it into the record and left the heading unrenamed, so the plan's heading check needs the pilot's ruling."
duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 01: File Design Extensions, Attachment Glossary and Request Attachments Record Summary

**X-19 to X-23 are in the design direction, the glossary names the Attachment (shown as a "file"), and the request attachments extension (one new `CsrmRequestAttachment` content type with four link tables, six operations, two Functions, private storage, content screening, ClamAV scanning with quarantine, soft removal and opt-in AI text) is approved by the pilot on 2026-10-10, so plans 14-04 onwards may change the contract and 14-06 may create the schema.**

PHASE_14_BASE=e50053f

## Performance

- **Duration:** about 15 min of executor time across two sessions (Tasks 1 and 2 on 2026-10-10 02:47 to 02:53 +11:00; Task 4 and this summary at 2026-10-10 02:59 +11:00, after the pilot's approval)
- **Completed:** 2026-10-10
- **Tasks:** 4 of 4 (Task 3 was the pilot's checkpoint)
- **Files modified:** 3 (456 lines added, 0 removed)

## Accomplishments

- Recorded the five Phase 14 interface patterns in `docs/design/csrm-design-direction.md` before any implementing task: X-19 File field and X-20 Upload queue as the last bullets of `### Forms`, a new `### File list` (X-21) after `### Notes thread` and before `### Iconography`, X-22 AI input files after X-18 under `### Status & risk badges`, and X-23 File names and sizes after X-3's "Dates and times" bullet in §2. The diff adds lines only.
- Added `**Attachment**:` to the root `CONTEXT.md` after `**Note (request)**:`, saying visible copy calls it a "file".
- Wrote `docs/contract-gaps/phase-14-request-attachments.md` in JDL terms: the gap, the compatibility extension (entity, two enumerations, four relations, the `file` media attribute, link tables, no inverse, no core router), operations and Functions with every closed reason and status (422 new for malware), storage, content limits and refusals, scanning and quarantine with the ClamAV requirements and the ISM-2059 reading, write discipline, window and notes, readers and actors, removal and retention, downloads, AI inclusion and extracted text, the run summary v3, security events, what it does not add, affected workstreams, migration, audit semantics and later phases.
- The pilot approved the record (G-6) and wrote the dated approval and "What the pilot checked" into it.

## Task Commits

1. **Task 1: Record X-19 to X-23 in the direction and the Attachment glossary entry**: `c776946` (direction), `c8bda80` (glossary)
2. **Task 2: Write the request attachments contract-gap record**: `a4edd08`
3. **Task 3: The pilot approves the request attachments record (G-6)**: checkpoint:decision, no executor commit; the pilot's approval is in `3e5b52a` ("docs(14): approve the request attachments contract gap"). The orchestrator's checkpoint record is `c1e8ab8`.
4. **Task 4: Write the approval into the record**: no commit; the record is unchanged (`git diff 3e5b52a -- docs/contract-gaps/phase-14-request-attachments.md` is empty).

Commit count: `git rev-list --count 67186fb..3e5b52a` is 5, which includes the orchestrator's `c1e8ab8` and the pilot's `3e5b52a`; the plan's own commits, counted by their `(14-01)` scope (`git log --oneline 67186fb..HEAD --grep="(14-01)"`), are 3. `plan_head_before` is `67186fb`, the parent of the plan's first commit.

## Checkpoint: decision

Task 3, the pilot's answer, verbatim:

> The Phase 14 attachments record is approved: the dated approval is written into docs/contract-gaps/phase-14-request-attachments.md, committed as 3e5b52a and pushed.

The pilot also directed: "Finish 14-01 at Task 4: keep the pilot's approval verbatim, change nothing else in the record, and write 14-01-SUMMARY.md."

Approval date: **2026-10-10**, from the record's status line.

The approval was written by the pilot, in `3e5b52a`, and is kept verbatim:

> Status: **approved by the pilot on 2026-10-10** (G-6), for the one content type and the operations exactly as this record states them.

In the same commit the pilot added the D-40 sentence and "What the pilot checked" (JDL and the catalogue's design note 6, the API contract, the one removal of existing routes, the role-function catalogue, AGENTS.md, security, audit) and the closing note that new runtime dependencies are governed by their own plans.

## Verification

- Task 1 verify: exit 0 (at `c8bda80`).
- Task 2 verify: exit 0 (at `a4edd08`).
- Task 4 verify, run part by part on the record at `3e5b52a`:
  - `grep -q "^## Approved Compatibility Extension"`: **exit 1 (fails)**. The heading reads `## Compatibility Extension (awaiting approval)` (line 11), as the pilot committed it.
  - the `## Approval` section's status line matches `^Status: \*{0,2}approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2}\*{0,2} \(G-6\)` (case-insensitive): exit 0 (passes).
  - `! grep -q "awaiting the pilot's approval"`: exit 0 (passes).
  - the full chained command: exit 1, because of the heading part.
- `git diff 3e5b52a -- docs/contract-gaps/phase-14-request-attachments.md`: empty.
- `git diff 67186fb HEAD -- docs/design/csrm-design-direction.md CONTEXT.md`: additions only (0 removed lines).
- Content-type freeze: `git diff --name-only e50053f -- 'apps/backend/src/api/*/content-types/*'` prints nothing; `git ls-files -- apps/backend/src/api/csrm-request-attachment` prints nothing.
- No tests, Strapi source, specification, catalogue or Playwright touched (as planned).

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-19 to X-23 as CSRM extensions dated 2026-10-01.
- `CONTEXT.md`: the `Attachment` glossary entry.
- `docs/contract-gaps/phase-14-request-attachments.md`: the approved request attachments compatibility extension.

## Decisions Made

- Request attachments are exactly the one content type, four link tables, six operations and two Functions the record names, approved by the pilot (G-6). Any other content-type change in Phase 14 needs its own record and checkpoint.
- COLLAB-02 is not marked complete here: this plan writes only the records the attachment work builds on, and no file can be attached yet. It completes at the phase gate (14-17), as REQ-08 and COLLAB-01 did in Phase 13.

## Deviations from Plan

1. **[Pilot instruction] Task 4 verify: the heading check fails by the pilot's instruction (change nothing in the approved record); the pilot may rename the heading.** The plan's Task 4 would rename `## Compatibility Extension (awaiting approval)` to `## Approved Compatibility Extension` when the pilot had not. The pilot directed "change nothing else in the record", and the orchestrator ruled that the instruction overrides the rename. Task 4 changed no file and made no commit. The dated status line and the "no awaiting line" checks pass; the `^## Approved Compatibility Extension` check fails. The plan's artifact `contains: "Approved by the pilot on"` matches only case-insensitively (see the note for 14-06 below).
2. **[Task 2 wording] "New notes" is credited to Phase 19.1 (G-19).** Task 2's action put the "new notes" event covering files under Phase 17. G-19 moved notifications (NOTIFY-01) to Phase 19.1, so the record's "Later Phases" credits Phase 19.1's `note-added` event, as the Phase 13 records were corrected to do.
3. **[Task 2 wording] Files-only `AiInputsChanged` changes carry an empty `notes` list.** Task 2's action said the value is present when either list is non-empty; the record adds that a files-only change therefore carries an empty `notes` list (and a notes-only change an empty `files` list), so both lists are always present when the value is.
4. **[Orchestrator] PHASE_14_BASE supplied.** The plan records `PHASE_14_BASE` from `git rev-parse --short HEAD` before the first commit; the orchestrator supplied `e50053f`, the revised plan-check commit (the phase-start commit `67186fb` sits between), and it is recorded as given.

**Impact on plan:** none on scope; the approval and freeze guarantees hold. The heading is the one open item, for the pilot.

## Note for 14-06

14-06's precondition reads `Approved by the pilot on YYYY-MM-DD`, but the pilot's line is bold lower case: `Status: **approved by the pilot on 2026-10-10** (G-6)`. It satisfies the precondition read case- and bold-insensitively, as Phase 13's approved records (the same format) were read after `c9b091d`. 14-06 must not treat the lower-case, bold line as a missing approval, and must not look for `## Approved Compatibility Extension` as proof of approval, since the heading was left unrenamed.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- The record carries the pilot's dated approval, so plans 14-04 onwards may change the specification, catalogues and inventory, and 14-06 may create exactly `apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json`.
- X-19 to X-23 are recorded, so plans 14-12 onwards may use them.
- Open for the pilot: whether to rename the record's heading to `## Approved Compatibility Extension`.

## Self-Check: PASSED

- FOUND: docs/design/csrm-design-direction.md (contains "File field (CSRM extension, 2026-10-01)")
- FOUND: CONTEXT.md (contains "**Attachment**:")
- FOUND: docs/contract-gaps/phase-14-request-attachments.md (contains "approved by the pilot on 2026-10-10")
- FOUND: c776946, c8bda80, a4edd08, c1e8ab8, 3e5b52a

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
