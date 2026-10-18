---
phase: 12-ai-context-suggestions-and-provenance
plan: 05
subsystem: backend-questionnaire-generation
requirements: [QUES-10, INT-05, INT-06]
requirements-completed: [QUES-10, INT-05, INT-06]
status: complete
completed: 2026-10-05
coverage:
  - id: questionnaire-context
    description: Contextual seven-question questionnaire with persisted help text and choice uncertainty
    requirement: QUES-10
    verification:
      - kind: integration
        ref: apps/backend/tests/questionnaire-generation.integration.test.ts#UAT-like request produces contextual questions and a safe completed run summary
        status: pass
    human_judgment: false
  - id: questionnaire-wire
    description: Bounded version 2 wire format, portable schema and closed adapter
    requirement: INT-05
    verification:
      - kind: unit
        ref: apps/backend/tests/ai-provider-questionnaire.unit.test.ts#questionnaire wire v2 is portable and sends the complete bounded context
        status: pass
    human_judgment: false
  - id: questionnaire-run-record
    description: One run record per call, including safe failure and retry records
    requirement: INT-06
    verification:
      - kind: integration
        ref: apps/backend/tests/questionnaire-generation.integration.test.ts#failed questionnaire provider calls have separate run records for each retry
        status: pass
    human_judgment: false
---

# Phase 12 Plan 05 Summary

Questionnaire generation now uses the assessment context, persists help text, supplies a final Not sure choice where needed, and records each call through completion or failure.

## Accomplishments

- The deterministic questionnaire has seven questions in two sections, with help text on each. Its keys are `security-objectives`, `business-criticality`, `third-party-involvement`, `third-party-details`, `regulatory-obligations`, `asset-protection` and `recovery-tested`.
- The version 2 wire adapter assigns `q-1` through `q-N`, refuses Boolean and out-of-range question counts, and normalises blank help text to null. The schema uses the portable keyword subset.
- Questionnaire persistence creates a running record after eligibility, context and policy checks; completes it within the questionnaire transaction; and records safe failures outside that transaction. Retry creates another run.
- Added six wire fixtures, context and integration coverage, and a distinct namespace for the UAT fixture's Risk Types so it can coexist with the assessment workflow fixtures.

## Verification

- Node 24.21.0 and pnpm 11.24.0: pass.
- Backend source TypeScript compile: pass.
- Backend test TypeScript compile: pass.
- Final focused run across six directly affected files: 53 passed, 0 failed, 0 skipped. The earlier `questionnaire-workflow.integration.test.js` run passed its cases within the initial focused run.
- `git diff --check`: pass.
- Earlier focused runs: 54 passed and 2 failed before updating existing assertions and the answered-replacement check; then 50 passed and 1 failed before removing a unique fixture-name collision. Both issues were corrected before the final passing run.

## Deviations from Plan

- `assessment-context-loader.ts` now returns its already-loaded records so both providers use the same bounded context. A shared test fixture and the directly affected failure and context tests were updated as well.
- The UAT fixture's Risk Type names gained a `UAT` prefix to avoid a unique-name collision in the combined integration run.
- The full backend suite command was replaced by the required focused test run. The orchestrator runs the full suite.
- Task commits were skipped under the run's git read-only rule: commit pending (orchestrator).

## Remaining Work

- The orchestrator will review and commit the working-tree changes. Later plans handle questionnaire read projections and policy refusal at enqueue time.
