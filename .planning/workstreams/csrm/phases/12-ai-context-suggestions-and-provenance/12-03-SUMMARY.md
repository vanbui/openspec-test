---
phase: 12-ai-context-suggestions-and-provenance
plan: 03
subsystem: backend
tags: [assessment-context, data-minimisation, ranking, provenance]
requires:
  - phase: 12-ai-context-suggestions-and-provenance
    provides: classification policy and shared prompt escaping
provides:
  - One request and draft context entry point with a closed summary and policy decision
  - Deterministic Risk Type and control ranking with hard bounds
  - One submitted-answer rule for the existing draft workflow and the new context
affects: [12-05, 12-06, 12-15, 13, 14]
actuals:
  tokens: 8500
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns: [pure context builder, bounded lexical ranking, delimited data sections]
key-files:
  created:
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/csrm/ai/library-ranking.ts
    - apps/backend/src/csrm/ai/prompt-sections.ts
    - apps/backend/tests/fixtures/uat-a-like-context.ts
    - apps/backend/tests/assessment-context.unit.test.ts
    - apps/backend/tests/assessment-context.integration.test.ts
    - apps/backend/tests/library-ranking.unit.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
key-decisions:
  - "All request fields and submitted answers pass through tagged values in a single request data block."
  - "The existing draft path maps the shared answer rule back to its established shape."
requirements-completed: [INT-05, QUES-10, ASSESS-08]
coverage:
  - id: context
    description: Minimized request and draft contexts with source catalogue, classification decision, and digest
    verification:
      - kind: unit
        ref: apps/backend/tests/assessment-context.unit.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/assessment-context.integration.test.ts
        status: pass
    human_judgment: false
  - id: bounds
    description: Bounded Risk Type and control candidates with deterministic ranking
    verification:
      - kind: unit
        ref: apps/backend/tests/library-ranking.unit.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/assessment-context.unit.test.ts
        status: pass
    human_judgment: false
  - id: answers
    description: Shared active, visible, submitted-answer rule with choice labels
    verification:
      - kind: unit
        ref: apps/backend/tests/assessment-context.unit.test.ts
        status: pass
    human_judgment: false
status: complete
completed: 2026-10-05
---

# Phase 12 Plan 03: Assessment Context Summary

The shared context loader reads request records and reference libraries, then produces a minimized prompt, source catalogue, closed summary, and classification decision for both operations.

## Accomplishments

- Included request fields, selected systems and assets, Risk Types, and draft questions with submitted answers; excluded identities, record numbers, dates, owners, and asset comments.
- Escaped every tagged value, kept the instruction slot empty, and digested the exact prompt.
- Ranked reference libraries deterministically and enforced record and prompt limits before any downstream operation.
- Moved the submitted-answer rule into the loader while preserving the existing draft workflow shape and 409 response.

## Verification

- Backend source and test TypeScript compilations: passed.
- Focused unit tests: 12 passed, 0 failed.
- Mounted context tests within the final full run: 2 passed, 0 failed. An earlier focused run had 1 pass and 1 failure because the test expected 12 total controls when the mounted database includes 2,646 seeded controls. The assertion was corrected to cover the whole library.
- Full backend suite: 732 passed, 0 failed (42 minutes, 2 seconds).
- UAT-A-like pure fixture draft prompt: 7,045 characters.
- Static acceptance checks and `git diff --check`: passed.

## Deviations

- The full suite's first run was interrupted before its final report. The captured repeat passed in full.
- commit pending (orchestrator).

## Self-Check: PASSED

Both tasks, the complete backend test command, TypeScript compilations, and static acceptance checks passed. No content-type schema changed.
