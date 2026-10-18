# Phase 21 Plan Check

## Iteration 1

**Result:** ISSUES FOUND (0 blockers, 2 warnings, 0 info)
**Plans checked:** 18 (21-01 to 21-18), waves 1 to 15, acyclic, no forward references.

### Probes
- verify-command-paths: not_applicable (no unresolvable targets).
- verify-failure-directions: ok, 59 of 59 commands carry a `<fails_when>`.

### Coverage
| Item | Plans | Status |
|---|---|---|
| DASH-04 | 01, 02, 04, 06-11, 14-18 | Covered |
| DASH-05 | 01-13, 15-18 | Covered |
| Stage-history record + Phase 16 seed-path amendment before G-6 checkpoint | 21-01 (Task 2 blocking-human); 21-03 depends on 21-01 | Pass |
| One recorder (`withStageRecording`) in every stage act, incl. response, acceptance, rework (17, 17.1, 17.2 shared reopening path) | 21-03, 21-05 (twelve acts, coverage + oracle tests, static guards) | Pass |
| Delete with stage history refused 409 (`REQUEST_HAS_STAGE_HISTORY`) | 21-03 | Pass |
| Job history from Phase 12 run record | 21-01 record, 21-02, 21-06, 21-14 | Pass |
| Human analysts only; Requestors and service identity refused in API and UI | 21-09, 21-12 (matrix rows, both refusal sets), 21-10, 21-13, 21-18 | Pass |
| Every figure opens its records, list total equals figure | 21-06, 21-09, 21-10, 21-13, 21-14, 21-18 | Pass |
| Heat map readable without colour | 21-12, 21-13 | Pass |
| Playwright leaves tree clean (`git status --short`) | 21-18 Task gate with fails_when | Pass |
| Pre-rename app paths | none found | Pass |
| Plans above 15 files carry scope notes | 03, 07, 08, 09, 11, 12, 14 | Pass |

### Warnings (recorded notes, per stage2-rules 3a)

**1. [verification_derivation] Threat-model mitigations name the plan that actually runs the phase gate**
- Plan: 21-01 (threat T-21-01)
- Evidence: T-21-01 says "the phase gate (21-17) re-checks them and the content-type freeze since PHASE_21_BASE"; the phase gate is 21-18 (21-17 is the leadership view and print).
- Example fix (non-binding): correct the reference to 21-18 and make sure 21-18's gate includes the approval-line and content-type-freeze re-check.

**2. [scope_sanity] Plans with four tasks record why they stay whole**
- Plans: 21-02, 21-04, 21-05, 21-06, 21-16, 21-18 (4 tasks each; files at most 15)
- Evidence: 4 tasks is the warning threshold; none of these plans carries a scope note.
- Example fix (non-binding): add a one-line scope note to each; do not re-split.

### Structured Issues
```yaml
issues:
  - plan: "21-01"
    dimension: verification_derivation
    severity: warning
    required_property: "Threat mitigations cite the plan that performs the check"
    description: "T-21-01 cites 'the phase gate (21-17)'; the gate is 21-18"
    fix_hint: "Change to 21-18 and confirm 21-18 re-checks approvals and the content-type freeze"
  - plan: "21-02, 21-04, 21-05, 21-06, 21-16, 21-18"
    dimension: scope_sanity
    severity: warning
    required_property: "Plans at the 4-task threshold record a scope note"
    description: "Six plans have 4 tasks without a scope note"
    fix_hint: "Add a scope note per plan"
```

### Recommendation
0 blockers, 2 warnings. Address with recorded notes in the plans (3a); no re-planning needed.

---

## Orchestrator disposition (2026-10-02)

Both warnings are settled the way this report prescribes. T-21-01 in 21-01 now names the phase gate as 21-18. Scope notes are recorded at the top of the objectives of 21-02, 21-04, 21-05, 21-06, 21-16 and 21-18 (four tasks each). Under the pilot's economy rule, no re-check runs. **Verdict: PASSED, iteration 1, with the warnings settled by recorded notes.**
