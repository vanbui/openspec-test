# Phase 18 Plan Check

## Iteration 1

**Phase:** 18 Risk table and spreadsheet interoperability
**Plans checked:** 19 (18-01 to 18-19)
**Issues:** 0 blockers, 2 warnings, 1 info

### Probes
- `verify-command-paths 18`: not_applicable over 57 commands (no unresolved targets).
- `verify-failure-directions 18`: ok over 57 commands (every `<automated>` has a stated failing direction).

### Coverage
| Requirement | Plans | Status |
|---|---|---|
| ASSESS-15 | 01-05, 10, 14-19 | Covered |
| ASSESS-16 | 01-04, 06, 07, 11-13, 15, 19 | Covered |
| ASSESS-17 | 01, 03, 05, 12, 13, 16, 18, 19 | Covered |
| ASSESS-18 | 01, 02, 04, 06-08, 12, 15, 19 | Covered |
| ASSESS-19 | 01, 02, 08, 09, 19 | Covered |

### Phase 18 specifics
- Records first: 18-01 Task 1 writes the three phase-18 records and five dated amendments (Phase 16 history, 19 import, 19 exports, 17 participant read, 17.1 rounds) awaiting approval; Task 2 is a `checkpoint:decision` stop; Task 3 writes the approvals; schema work (18-04) depends on 18-01. PASS.
- Grid spike: 18-05 Task 3 is decision 7's `checkpoint:decision` (pass / virtualise / exception), with the conditional dependency verification and virtualisation tasks. PASS.
- Bulk save: 18-07 one transaction through `withMutableAssessmentMutation`, guard once in 17.1 D-23 order, accepted-edit transition once (review withdrawn, 17.1 D-07), changed risks voided by fingerprint at resubmission and untouched kept (ASSESS-24, 17.1 D-38/D-40), all refusals decided before any write. PASS.
- Per-cell conflicts (18-02, 18-07 `RISK_CHANGES_CONFLICT`); bulk withdrawal through Phase 16's batch operation (18-12 Task 4). PASS.
- Copied cells neutralised (18-13, 18-08); `jsonLimit: '1mb'` pinned with a 413 proof (18-04). PASS.
- Phase 19 export module (`runFixedTableExport`) and Phase 14/19 reader and import modules reused (18-08). PASS.
- Released, paused and participant modes read-only but copyable, Maya refused (18-18). PASS.
- Grants and refusals: seven matrix rows per new operation incl. empty-body pre-parse check (18-07, 18-09, 18-10). PASS.
- Playwright: 150 risks at 1440px (18-05), phone card list (18-18), `git status --short` clean-tree checks in every e2e plan. PASS.
- No pre-rename app paths in any phase file. PASS.
- 17.1 citations checked against 17.1's written plans: `ACCEPTANCE_ROUND_OPEN`/`ACTOR_IS_EXECUTIVE_APPROVER` (17.1-01/06/07), `acceptance/readiness.ts` and `decision-fingerprint.ts` with `fingerprintVersion` (17.1-01/02), void cause `risk-changed` (17.1-01/07), "will be decided again" (17.1-09), "Mark reviewed" (17.1-01 onward). No mismatch found.

### Warnings

**1. [scope_sanity] Plans above 15 files carry a scope note**
- Plans: 18-04 (16), 18-06 (17), 18-07 (16), 18-11 (16), 18-15 (16), 18-17 (16)
- Evidence: none of these plans contains a scope note justifying the file count.
- Example fix (non-binding): add a one-line scope note per plan (most extra files are spec/schema/catalogue/parity companions of one change).

**2. [scope_sanity] Each plan stays at 3 or fewer executable tasks**
- Plan: 18-12 (4 auto tasks plus tracer counted within: Tasks 1-4)
- Evidence: four executable tasks over 15 files.
- Example fix (non-binding): record a note in 18-12 explaining why the four editor/row tasks share one plan (section 3a: note, not re-split).

### Advisories

**1. [scope_sanity] Conditional tasks are clearly gated**
- Plan: 18-05 has 5 tasks, but Tasks 4 and 5 run only on the "virtualise" choice and two are checkpoints; acceptable.

### Structured Issues
```yaml
issues:
  - plan: "18-04, 18-06, 18-07, 18-11, 18-15, 18-17"
    dimension: scope_sanity
    severity: warning
    required_property: "Plans above 15 files carry a scope note"
    description: "Six plans list 16-17 files_modified with no scope note"
    fix_hint: "Add a recorded scope note to each plan"
  - plan: "18-12"
    dimension: scope_sanity
    severity: warning
    required_property: "Plans with 4+ executable tasks record why they are not split"
    description: "18-12 has four executable tasks"
    fix_hint: "Add a recorded note per stage2-rules 3a"
  - plan: "18-05"
    dimension: scope_sanity
    severity: info
    required_property: "Conditional tasks are explicitly gated"
    description: "5 tasks, of which 2 conditional on the spike decision; gating is explicit"
    fix_hint: "None needed"
```

### Recommendation
0 blockers, 2 warnings: address with recorded notes in the plans (stage2-rules 3a); no re-planning needed.

---

## Orchestrator disposition (2026-10-02)

Both warnings are settled the way this report prescribes. Scope notes are recorded at the top of the objectives of 18-04, 18-06, 18-07, 18-11, 18-15 and 18-17 (16 to 17 files each), and of 18-12 (four tasks). The info item needs nothing. Under the pilot's economy rule, no re-check runs. **Verdict: PASSED, iteration 1, with the warnings settled by recorded notes.**
