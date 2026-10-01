# Phase 15 Plan Check

## Iteration 1

**Phase:** 15 (Steerable questionnaire AI). **Plans checked:** 14 (15-01 to 15-14, waves 1 to 14, strictly sequential; 15-14 depends on all).
**Result:** ISSUES FOUND: 0 blockers, 1 warning, 0 info.

### Deterministic probes
- `check verify-command-paths 15`: 45 commands, all ok or not_applicable, no severity.
- `check verify-failure-directions 15`: status ok; every automated command carries a failing statement.

### Coverage
| Requirement / criterion | Plans | Status |
|---|---|---|
| QUES-11 (steerable additions/changes, instruction slot) | 15-01 to 15-14 (frontmatter all); 15-04 slot, 15-06 jobs, 15-11/12 UI | Covered |
| QUES-12 (answered untouched, nothing to Requestor before release) | 15-02 preservation predicate, 15-05/08 confirmation re-check, 15-12 release gate | Covered |
| SC1 offshore note follow-ups, answered untouched | 15-06, 15-14 journey (D-36) | Covered |
| SC2 plain-language rewrite confirm/reject | 15-12, 15-14 | Covered |
| SC3 instruction, time, analyst in timeline | 15-03 governance events, 15-12/13 | Covered |
| SC4 nothing reaches the Requestor before release | 15-08, 15-12, 15-14 | Covered |

### Gate rules (stage2-rules section 3) and 15-CONTEXT confirmations
- Pre-rename app paths: none found in any phase file. Pass.
- Dated amendments to `phase-12-ai-run-record-and-provenance.md` and `phase-06.8-questionnaire-governance-facts.md` (15-01 Task 1), checkpoint:decision stop, approvals written (Task 3) before any code; no content-type change asserted (15-01 truths, 15-14 gate against PHASE_15_BASE). Pass.
- Answered questions never changed: pure answer-preservation predicate (15-02), confirmation re-check, deep-equal tests (15-08). Pass.
- Visible "Confirm", never "Accept": no visible "Accept" in any plan. Pass.
- Shared instruction slot (15-04 `analyst-instruction.ts`, `INSTRUCTION_MAX_LENGTH`), proposal machinery (15-02), job registry (15-06), text similarity (15-02) built for 16 and 17. Pass.
- Phase 13 `CONTEXT_WIDE_AI_OPERATIONS` gains `questionnaire-proposals`, not `question-rewrite` (15-06, unit-tested). Pass.
- Deterministic provider referenced in every plan. Pass.
- Grants and refusals in the API: five `function.questionnaire_ai.*` Functions for `role.security_analyst` only plus `HUMAN_ANALYST_ONLY_OPERATIONS`; integration tests for Requestor, Secondary Requestor, service agent (403) and an analyst on their own request (403 `OWN_REQUEST`) (15-09). In the UI: `OWN_REQUEST` view (15-11), rewrite control hidden (15-12), action refusal copy (15-10), Requestor sees nothing before release (15-12/14). Pass.
- Playwright leaves the tree clean, no restore step (15-14, T-15-50; every verify ends with `git status --short`). Pass.
- Written-ahead notes naming earlier plans (e.g. 15-06 cites 10-13, 12-02..12-07, 13-03..13-17). Pass.
- Dependencies acyclic, waves consistent. `tracer` tasks accepted as a recognised type.

### Warnings
**1. [scope_sanity] Each plan stays within the per-plan context budget.**
- Plans: 15-02, 15-08, 15-11, 15-13 (4 tasks each, one a tracer); 15-08 lists 15 files, 15-11 and 15-13 list 14.
- Per stage2-rules 3a, handle with a recorded scope note in those plans (tracer tasks are thin and most files are tests); no re-split needed. Not a hidden gap.

### Structured Issues
```yaml
issues:
  - plan: "15-08"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget, or records why its size is safe"
    description: "15-02, 15-08, 15-11 and 15-13 carry 4 tasks (one tracer each); 15-08 lists 15 files_modified, 15-11 and 15-13 list 14. No plan records a scope note."
    fix_hint: "Add a one-line scope note to each (tracer is thin, files are mostly tests), per stage2-rules 3a."
```

### Recommendation
0 blockers, 1 warning. Address the warning with recorded notes (rules 3a); no re-planning required.

---

## Orchestrator disposition (2026-10-01)

The scope warning (plans 15-02, 15-08, 15-11 and 15-13, four tasks each, one of them a tracer) is settled the way this report prescribes: a scope note is recorded at the top of each plan's objective. Under the pilot's economy rule, no re-check runs. **Verdict: PASSED, iteration 1, with the warning settled by recorded notes.**
