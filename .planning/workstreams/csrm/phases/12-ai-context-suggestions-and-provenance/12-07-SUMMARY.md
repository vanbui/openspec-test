---
phase: 12-ai-context-suggestions-and-provenance
plan: 07
subsystem: generation-policy-and-provenance
requirements: [INT-05, INT-06]
requirements-completed: [INT-05, INT-06]
status: complete
completed: 2026-10-06
coverage:
  - id: enqueue-policy
    description: Both generation operations refuse requests above the approved classification before queuing a job
    requirement: INT-05
    verification:
      - kind: integration
        ref: apps/backend/tests/ai-data-policy.integration.test.ts#mounted draft enqueue refuses Restricted data before a job or run exists
        status: pass
      - kind: integration
        ref: apps/backend/tests/ai-data-policy.integration.test.ts#mounted questionnaire enqueue refuses Restricted and default Internal, and allows Public
        status: pass
    human_judgment: false
  - id: execution-policy
    description: Execution refuses above-ceiling data before run creation or provider invocation
    requirement: INT-05
    verification:
      - kind: integration
        ref: apps/backend/tests/ai-data-policy.integration.test.ts#execution checks refuse before creating a run or calling either provider
        status: pass
    human_judgment: false
  - id: closed-reasons-and-copy
    description: Policy refusal reasons agree across the backend, specification and web, with plain refusal copy
    requirement: INT-05
    verification:
      - kind: unit
        ref: apps/backend/tests/conflict-reasons.unit.test.ts#the conflict reason list Strapi raises is the list both conflict response schemas publish
        status: pass
      - kind: unit
        ref: apps/csrm/src/lib/api/refusal-copy.test.ts#AI data policy refusal copy
        status: pass
    human_judgment: false
  - id: analyst-edits
    description: Changed AI values carry an attributed edited fact and an event in the proposing run
    requirement: INT-06
    verification:
      - kind: integration
        ref: apps/backend/tests/assessment-workflow.integration.test.ts#mounted full-context draft records linked risks, provenance and a completed run
        status: pass
    human_judgment: false
  - id: register-projection
    description: Drafted risk rows in the Risk Register omit provenance
    requirement: INT-06
    verification:
      - kind: integration
        ref: apps/backend/tests/assessment-workflow.integration.test.ts#mounted full-context draft records linked risks, provenance and a completed run
        status: pass
    human_judgment: false
---

# Phase 12 Plan 07 Summary

Both generation paths now check the request's classification before queuing work. Analyst changes to proposed risk and assessment values record attributed edits in the same transaction as the update.

## Accomplishments

- Added two closed policy refusal reasons to the backend, both specification enums, regenerated web types, and web refusal copy.
- Proved mounted enqueue and execution refusals under a Public ceiling, including unchanged persistence, empty run lists, zero provider calls, and successful Public generation.
- Marked changed AI fields edited on risk and assessment updates. The proposing run records each edit; unchanged fields and fields without AI facts remain unchanged.
- Checked that a drafted risk's Risk Register list row does not expose provenance.

## Verification

- Node 24.21.0 and pnpm 11.24.0: passed.
- Backend source compile and backend test compile: passed.
- Web typecheck: passed.
- Web conflict reason and refusal copy files: 103 passed, 0 failed.
- New policy integration and backend conflict reason files: 4 passed, 0 failed.
- Directly affected assessment, questionnaire generation, and Risk Register files: 67 passed, 0 failed.
- Focused rerun after the Public completion and relation edit assertions: 2 passed, 0 failed.
- Final drafted-risk register and edit case after recompiling: 1 passed, 0 failed.
- `git diff --check`: passed.
- `pnpm --dir apps/csrm api:generate`: passed. `api:check` exited 1 because its final step compares the intentionally changed generated type file with committed HEAD. The specification and generated type file contain the same two added enum values; both remain in the working tree for the orchestrator's commit.

## Deviations from Plan

- The run instructions replaced the plan's full backend and web suite commands with compiles and only the created or directly affected test files. No full suite or browser run was made.
- The RED and GREEN commits and metadata commit were skipped under the git read-only rule. Commit pending (orchestrator).
- A mounted development harness cannot exercise an absent nondevelopment ceiling; the policy decision grid from plan 12-02 covers that reason.

## Remaining Work

- The orchestrator reviews and commits these working-tree changes, then runs the full suites. No later plan or phase verification was started.
