---
phase: 12-ai-context-suggestions-and-provenance
plan: 01
subsystem: design-and-contract
tags: [design-direction, provenance, contract-gap]
requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: X-6 to X-10 and the passed Phase 11 gate
provides:
  - X-11 to X-14 recorded verbatim in the design direction
  - The approved run-record and per-field provenance contract (G-6, 2026-10-05)
  - PHASE_12_BASE for the content-type freeze check
affects: [12-04, 12-12, 12-13, 12-19, 15, 16, 17, 21]
actuals:
  tokens: 3200
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [current provenance fact beside the aggregate with append-only decision history in the run]
key-files:
  created:
    - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
  modified:
    - docs/design/csrm-design-direction.md
key-decisions:
  - "One run-record content type and two optional per-field JSON attributes, approved by the pilot on 2026-10-05 (G-6)."
requirements-completed: []
status: complete
completed: 2026-10-05
---

# Phase 12 Plan 01 Summary

PHASE_12_BASE=7e4fa02

## Accomplishments

- Verified the existing X-11 to X-14 entries against the UI specification: all four are verbatim, in the specified sections, and the diff from `PHASE_12_BASE` has additions only.
- Wrote the contract-gap record with the proposed schema, closed envelopes, run lifecycle, write discipline, mutability guard, migration proof and limitations.
- Confirmed that no content-type schema file changed from `PHASE_12_BASE`.

## Task Commits

1. `docs(12-01): record the AI provenance, source citation, side sheet and Undo toast extensions` — `30d29e1`
2. `docs(12-01): record the AI run record and per-field provenance contract gap` — `da01ba0` (record and approval in one commit)
3. `docs(12-01): record the pilot's approval of the AI run record` — `da01ba0`

## Verification

- Exact wording comparison: 4/4 pass.
- Required contract terms and 20 risk plus four assessment fields: pass.
- Content-type freeze diff: empty.
- `git diff --check`: pass.

## Checkpoint: decision

Task 2, the pilot's answer, verbatim: `approved` (2026-10-05).

Before approving, the pilot added the `## Affected Workstreams` section the shared-backend rule requires (`.planning/PROJECT.md`, "GSD Workstreams"): `csrm` is the only workstream and the only reader of the affected content types, and the change is backward compatible.

Task 3 was done by the pilot: the heading reads `## Approved Compatibility Extension` and the `## Approval` section carries `Approved by the pilot on 2026-10-05 (G-6)` with what was checked. Plan 12-04 may change the three schema files.

## Deviations

The four design entries were already uncommitted in the working tree. They were verified and left in place without duplication. The executor had no git write access; the pilot reviewed the diff and committed it in the groups above.
