# Phase 17 Plan Check

## Iteration 1

**Plans checked:** 19 (17-01 to 17-19), waves 1 to 18
**Result:** ISSUES FOUND: 0 blockers, 1 warning, 1 info

### Deterministic probes
- `check verify-command-paths 17`: not_applicable for all 57 commands, with no unresolved target.
- `check verify-failure-directions 17`: ok for all 57 commands; every automated command states its failing direction.

### Gate rules (stage2-rules.md section 3)
- Requirement coverage: ASSESS-11, 12, 13, 21, 22 and 23 are each claimed by several plans, and 17-01 and 17-19 each claim all six.
- Contract gaps: 17-01 Task 1 writes `phase-17-response-rounds.md`, `phase-17-participant-read.md` and seven amendments, each marked as awaiting approval. The blocking `checkpoint:decision` task (17-01) comes before 17-03, the only plan that changes schemas.
- Participant read: 17-07 splits Phase 19's one record-read check (19-10) in place into "readable now", which is the participant predicate opened by the gate fact, and "released". It widens the detail, risks and control-implementation reads.
- Refusals: the API refusals (404 for Maya, 403 for Riley and Bob) and the in-shell not-found page in the UI are proven at every stage-changing step by the 17-19 `expectApiRefusals` and `expectNotFoundForMaya` helpers. Integration tests cover the refusals in 17-07 and other plans.
- People search (G-17): 17-04 allows 2 to 100 characters, returns at most 20 people through 19.1's `isEligiblePerson`, and writes one `csrm.people.search` line per search through Phase 14's security event log. Unit and integration tests cover it.
- Response notifications: 17-12 sends them through Phase 19.1's notification centre, which applies the "readable now" visibility.
- Fixtures: 17-02 adds Riley Chen to `development-fixture-subjects.ts` and to the realm import in one task. The existing unit test compares the two files and no Keycloak flag changes (T-17-04). Maya is the unrelated Requestor.
- Journey: in 17-19, `risk-owner-journey.spec.ts` has one `@journey` test, which runs on both the desktop and the mobile project because the mobile `testMatch` lists the spec. It holds four slice functions over one `JourneyContext`. The request is a `Project` request. The insertion comment for 17.1 (`submitFinalAssessment`), 17.2 and Phase 20 is present, and every slice carries the negative cases.
- Clean tree: every plan's hard rules require `git status --short` to show only the three operator items, and treat a Playwright change as a harness defect.
- Paths: no plan file contains a pre-rename app path.
- Dependencies: the graph is a linear chain after the two wave-1 plans, with no cycle and no forward reference.

### Warnings
**1. [scope_sanity] Plans above 15 files carry a scope note**
- Plan: 17-02
- Evidence: 16 files in `files_modified`, but the plan has no scope note. All the other plans above 15 files have one.
- Example fix (non-binding): add a one-line scope note to 17-02, as section 3a recommends.

### Advisories
**1. [scope_sanity] Four-task plans are noted**
- Plans: 17-10, 17-14
- Evidence: each has 4 tasks, which is a borderline count. Both carry scope notes, so no re-split is needed under section 3a.

### Structured Issues
```yaml
issues:
  - plan: "17-02"
    dimension: scope_sanity
    severity: warning
    required_property: "Every plan above 15 files carries a recorded scope note"
    description: "17-02 lists 16 files_modified and contains no scope note"
    fix_hint: "Add a scope note line to 17-02's context"
  - plan: "17-10, 17-14"
    dimension: scope_sanity
    severity: info
    required_property: "Borderline task counts are acknowledged"
    description: "4 tasks each; scope notes present"
    fix_hint: "None required"
```

### Recommendation
0 blockers. Record the warning as a note in 17-02. No re-plan is needed.

---

## Orchestrator disposition (2026-10-01)

The warning (17-02, 16 files, with no scope note) is settled the way this report prescribes: a scope note is recorded at the top of the plan's objective. The info item needs nothing. Under the pilot's economy rule, no re-check runs. **Verdict: PASSED, iteration 1, with the warning settled by a recorded note.**
