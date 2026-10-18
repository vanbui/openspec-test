# Phase 16 Plan Check: Iteration 1

**Phase:** 16, Risk curation and targeted AI re-runs
**Plans checked:** 15 (16-01 to 16-15, waves 1 to 15, a linear chain)
**Result:** ISSUES FOUND: 0 blockers, 2 warnings, 0 info

## Deterministic probes
- verify-command-paths: 45 commands checked, 0 blockers, 0 warnings.
- verify-failure-directions: 45 checked, 0 blockers, 0 warnings.

## Requirement coverage
| Requirement | Plans | Status |
|---|---|---|
| ASSESS-09 (withdraw and curate risks) | 01-07, 10-12, 14, 15 | Covered |
| ASSESS-10 (targeted AI rewrite and suggest) | 01, 02, 08-11, 13-15 | Covered |

ROADMAP success criteria 1 to 4 are proven in 16-15's `risk-curation.spec.ts` (1440 and 375, axe) and in the Strapi integration tests of 16-04 to 16-10. The UAT-A-like payment-file case appears in 16-02, 08-11, 13 and 15.

## Confirmations and stage-2 section 3 rules
- The contract-gap record `phase-16-risk-withdrawal-and-history.md` names `undo: true`. It is followed by a blocking `checkpoint:decision` in 16-01 (autonomous: false) before any schema change: PASS.
- There is one proposal model (Phase 15's `proposal-items`). `itemStates` and `openProposals` appear only as negations or as the existing header prop, and `AI_PROPOSAL_NOT_OPEN` is grep-forbidden in 16-03: PASS.
- Phase 12's `AI_ACCEPT_WITH_PLANNED_CONTROL` and `riskHasPlannedControl` are reused, not duplicated. `AI_ACCEPT_NOT_PERMITTED` is the separate decision-8 rating rule: PASS.
- One editable guard and one active-risk rule (with a static test) run through the plans: PASS.
- No delete operation is served, and `REQUEST_HAS_ASSESSMENT` refuses deleting a request that has an assessment (16-04, API test and UI state): PASS.
- An analyst who raised the request gets `OWN_REQUEST`, enforced in the API (16-10) and in the UI (16-13, 16-14): PASS.
- Released risks are refused for withdraw and re-run: PASS.
- The deterministic provider is used in every suite that invokes AI. Playwright leaves a clean tree (16-15): PASS.
- No pre-rename app paths appear. `type="tracer"` is accepted. The journey spec is untouched (Phase 17 creates it): PASS.

## Warnings (section 3a: handled with recorded notes in the plans, no re-split)
1. [scope_sanity] Each plan stays within the per-plan task budget. 16-02 has 4 tasks (tracer plus 3 auto): borderline.
2. [scope_sanity] Same property. 16-04 has 4 tasks (tracer plus 3 auto): borderline.

## Structured Issues
```yaml
issues:
  - plan: "16-02"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget (2-3 tasks target)"
    description: "16-02 has 4 tasks (tracer + 3 auto)"
    fix_hint: "Record a scope note in the plan per stage-2 section 3a; no re-split required"
  - plan: "16-04"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget (2-3 tasks target)"
    description: "16-04 has 4 tasks (tracer + 3 auto)"
    fix_hint: "Record a scope note in the plan per stage-2 section 3a; no re-split required"
```

## Recommendation
0 blockers. The 2 warnings need only recorded notes in 16-02 and 16-04 (section 3a). Execution may proceed after the notes are added.

---

## Orchestrator disposition (2026-10-01)

Both warnings (plans 16-02 and 16-04, four tasks each, at the border) are settled the way this report prescribes: a scope note is recorded at the top of each plan's objective. Under the pilot's economy rule (warnings are handled with recorded notes, and blockers are fixed), no re-check runs. **Verdict: PASSED, iteration 1, with the two warnings settled by recorded notes.**
