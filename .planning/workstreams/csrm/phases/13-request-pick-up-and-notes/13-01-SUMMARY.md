---
phase: 13-request-pick-up-and-notes
plan: 01
subsystem: design-and-contract
tags: [design-direction, contract-gap, request-assignment, governance]
requires:
  - phase: 12-ai-context-suggestions-and-provenance
    provides: X-11 to X-14 in the design direction, the passed Phase 12 gate, and the Affected Workstreams model record
provides:
  - X-15 (Assignee control), X-16 (Notes thread), X-17 (Unread) and X-18 (AI input mark) recorded verbatim in the design direction
  - The approved request assignment compatibility extension (G-6, approved by the pilot on 2026-10-09)
  - PHASE_13_BASE for the 13-19 content-type freeze check
affects: [13-03, 13-04, 13-06, 13-08, 13-09, 13-10, 13-11, 13-12, 13-13, 13-14, 13-15, 13-16, 13-17, 13-18, 13-19, 17, 17.1, 19.1, 20, 21, 22]
actuals:
  tokens: 5800
  tasks: 3
  commits: 3
plan_head_before: e7fe39314b92c49678c2756db4b0330cb17c2080
plan_head_after: 27b3c032e5888bc00e368e6b6ee1e7cd53641e53
tech-stack:
  added: []
  patterns: [current assignment fact on the request with an append-only, capped, versioned assignment log beside it (the 06.1 and 06.8 posture)]
key-files:
  created:
    - docs/contract-gaps/phase-13-request-assignment.md
  modified:
    - docs/design/csrm-design-direction.md
key-decisions:
  - "Request assignment is four optional, private attributes on CsrmAssessmentRequest (assignedAnalyst, assignedAt, assignedBy, assignmentLog) and two link tables, approved by the pilot on 2026-10-09 (G-6); plan 13-03 may change the request schema."
  - "The pilot's approval line is kept verbatim (lower-case, bold); the plans' approval checks were made case- and bold-insensitive to accept it rather than rewriting it."
requirements-completed: []  # REQ-08 is traced by this plan but delivered by the phase; it is marked complete at the 13-19 gate (the 12-01 precedent)
coverage:
  - id: D1
    description: "X-15 to X-18 recorded in the design direction with the 13-UI-SPEC wording, additions only"
    requirement: REQ-08
    verification:
      - kind: other
        ref: "Task 1 <verify> grep chain; git diff ab000f6 -- docs/design/csrm-design-direction.md shows 0 removed lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "The request assignment contract-gap record, approved by the pilot and carrying its dated approval"
    requirement: REQ-08
    verification:
      - kind: other
        ref: "Task 3 <verify> (approved heading plus dated approval status line, case- and bold-insensitive)"
        status: pass
    human_judgment: true
    rationale: "Governance approval (G-6) is a human decision; the pilot gave it on 2026-10-09 and wrote it into the record."
duration: 20min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 01: Design Extensions and Request Assignment Record Summary

**X-15 to X-18 are in the design direction, and the request assignment extension (four optional private request attributes, two link tables, compare-and-set writes under the request lock, an append-only capped log and the `assertAssignedAnalyst` predicate) is approved by the pilot on 2026-10-09, so plan 13-03 may change the request schema.**

PHASE_13_BASE=ab000f6

## Performance

- **Duration:** about 20 min of executor time across two sessions (Task 1 on 2026-10-09 01:41 to 01:45 +11:00; Task 3 and this summary after the pilot's approval)
- **Completed:** 2026-10-09
- **Tasks:** 3 of 3 (Task 2 was the pilot's checkpoint)
- **Files modified:** 2

## Accomplishments

- Recorded the four Phase 13 interface patterns in `docs/design/csrm-design-direction.md` before any implementing task: `### Assignee control` and `### Notes thread` between `### Record links` and `### Iconography`, and the Unread and AI input mark bullets under `### Status & risk badges` (the latter after the AI provenance bullet). The diff from `PHASE_13_BASE` adds lines only.
- Wrote `docs/contract-gaps/phase-13-request-assignment.md` in JDL terms: the gap, the compatibility extension, write discipline, eligibility and separation of duties, change rules, the assigned analyst predicate, the people projection (closing the `revertedBy` populate leak), what it does not add, affected workstreams, migration, audit semantics and later phases.
- The pilot approved the record (G-6); the record now carries the heading `## Approved Compatibility Extension` and the pilot's dated approval line.

## Task Commits

1. **Task 1: Record X-15 to X-18 in the direction, then write the request assignment contract-gap record**: `b971c73` (direction), `42db8c1` (record)
2. **Task 2: The pilot approves the request assignment record (G-6)**: checkpoint:decision, no executor commit; the pilot's approval is in `ef0fcc9`
3. **Task 3: Write the approval into the record**: `27b3c03` (the heading rename only)

Commit count measured with `git log --oneline e7fe393..HEAD --grep="(13-01)"` (3). `plan_head_before` is `e7fe393`, the commit before the plan's first commit; the range also holds 13-02 and orchestrator commits, so the plan's own commits are counted by their `(13-01)` scope.

## Checkpoint: decision

Task 2, the pilot's answer, verbatim: `approved`

Approval date: 2026-10-09.

The approval line was written by the pilot, in commit `ef0fcc9` ("docs(13): approve the request assignment and notes contract gaps"), and is kept verbatim:

> Status: **approved by the pilot on 2026-10-09** (G-6), for the four attributes exactly as the "Compatibility Extension" section states them.

In the same commit the pilot added "What the pilot checked" (JDL, API contract, role-function catalogue, AGENTS.md, CONTEXT.md and 13-CONTEXT.md, audit) and corrected the record's notification references: G-19 moved the "assignment" event to Phase 19.1 (they had read Phase 17). Phase 13 still sends nothing.

Task 3 changed only the heading `## Compatibility Extension (awaiting approval)` to `## Approved Compatibility Extension`, which is not a line the pilot wrote. No status line was added or rewritten.

## Verification

- Task 1 verify: exit 0 (at `42db8c1`).
- Task 3 verify (`^## Approved Compatibility Extension` and the dated approval status line, case- and bold-insensitive): exit 0.
- `git diff ab000f6 -- docs/design/csrm-design-direction.md`: additions only (0 removed lines).
- `git diff --check ab000f6` on both documents: clean.
- Content-type freeze: `git diff --name-only ab000f6 -- 'apps/backend/src/api/*/content-types/*'` prints nothing.
- No tests, Strapi source, specification or Playwright touched (as planned).

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-15 to X-18 as CSRM extensions dated 2026-10-01.
- `docs/contract-gaps/phase-13-request-assignment.md`: the approved request assignment compatibility extension.

## Decisions Made

- Request assignment is exactly the four optional, private attributes and two link tables the record names (`csrm_assessment_requests_assigned_analyst_lnk`, `csrm_assessment_requests_assigned_by_lnk`), approved by the pilot (G-6). Any other content-type change in Phase 13 needs its own record and checkpoint.
- REQ-08 is not marked complete here: this plan writes only the records that the pick-up and assignment work builds on, and a Security Analyst cannot yet pick up a request. It stays Pending until the phase gate (the 12-01 precedent, whose summary also left its traced requirements open).

## Deviations from Plan

1. **[Orchestrator] Approval checks accept the pilot's verbatim line.** The pilot wrote `Status: **approved by the pilot on 2026-10-09** (G-6)` (lower case, bold) rather than the plan's `Status: Approved by the pilot on YYYY-MM-DD (G-6)`. The orchestrator made the plans' approval checks case- and bold-insensitive (`c9b091d`) so the pilot's line is kept verbatim; Task 3's verify passes against it.
2. **[Orchestrator] PHASE_13_BASE supplied.** The plan records `PHASE_13_BASE` from `git rev-parse --short HEAD` before the first commit. HEAD had moved past the plan-check commit (`e7fe393`, "begin Phase 13 execution", sits between), so the orchestrator supplied `PHASE_13_BASE=ab000f6`, the revised plan-check commit, and it is recorded as given.
3. **Task 3 scope.** Because the pilot had written the approval line but not renamed the heading, Task 3 made the one remaining edit (the heading rename) and committed it, per the plan's "write only what is missing" branch.

**Impact on plan:** none on scope; the approval and freeze guarantees hold.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 13-03's precondition holds: the record carries `## Approved Compatibility Extension` and the dated approval line; it may apply exactly the approved request schema change.
- X-15 to X-18 are recorded, so plans 13-09 to 13-18 may use them.

## Self-Check: PASSED

- FOUND: docs/design/csrm-design-direction.md (contains "Assignee control (CSRM extension, 2026-10-01)")
- FOUND: docs/contract-gaps/phase-13-request-assignment.md (contains "by the pilot on 20")
- FOUND: b971c73, 42db8c1, ef0fcc9, c9b091d, 27b3c03

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*
