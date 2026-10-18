---
phase: 12-ai-context-suggestions-and-provenance
plan: 08
subsystem: questionnaire reads and contract
tags: [contract, provenance, help-text, questionnaire]
requires:
  - phase: 12-05
    provides: generation runs and persisted help text
provides:
  - helpText on every QuestionnaireQuestion producer, for both actors
  - aiAssisted on every questionnaire summary, governance and release result
  - analyst-only generation facts (AiGenerationFacts) on the questionnaire header
  - analyst-only per-question aiOrigin derived from the governance log
affects: [12-09, 12-15, 12-18]
tech-stack:
  added: []
  patterns: [actor-aware projection, read-time run resolution]
key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
key-decisions:
  - "aiAssisted is also required on QuestionnaireGovernanceResult and QuestionnaireReleaseResult, because both serve the same summary projection and their schemas are closed."
  - "The run and generator lookups run only for an analyst and only for a questionnaire that was generated, so a hand-built questionnaire's read keeps its one bounded actor lookup."
  - "The web question parser keeps helpText optional in its output (present only when non-empty), so hand-built client definitions and fixtures stay valid; every server read still carries the key."
requirements-completed: [QUES-10, INT-06]
status: complete
completed: 2026-10-06
---

# Phase 12 Plan 08 Summary

## Accomplishments

- Every question read, the answer-save, submit and revert results carry `helpText` (a string of at most 2,000 characters, or null). The mutation results read it from the stored question, because the parsed definition does not carry it.
- Every questionnaire summary, and the governance and release results, carry `aiAssisted`: true only when the questionnaire has a generation date and a provider name.
- The analyst's header carries `generation` (`AiGenerationFacts`: generated at, by whom while active, provider name and version, and the latest completed generation run, or null for a questionnaire generated before run records existed).
- The analyst's question read carries `aiOrigin` (`generated`, `generated-edited`, `analyst-added`) from the governance log after the latest generation, only when that generation has a run. An unreadable log gives no origin and the read still succeeds.
- The Requestor's reads carry none of `generation`, `aiOrigin` or a run id, and another Requestor is still refused.
- The specification gains `AiGenerationFacts` and the new fields; the generated client, the closed web parsers and five summary fixtures follow.

## Verification

- Mounted: `questionnaire-generation.integration.test.ts` 20/20, including the two new provenance tests (analyst facts and origins through edit, add and replacement; the Requestor's reads and answer-save; legacy, unreadable-log and seeded questionnaires).
- Questionnaire workflow and governance integration 19/19; questionnaire unit suites 31/31 (the one-lookup actor test stays unchanged).
- Web: `src/features/questionnaires`, the response parity guard and the operation chain, 434/434; web typecheck clean.
- `api:generate` regenerated the client; `api:check` is clean once the spec and client are committed together.

## Deviations

- Executed by the pilot rather than the execution tool, because the tool's 5-hour window was at 65% and one more plan would have passed the 90% line.
- The RED and GREEN commits were folded into one feature commit, with the tests in it.
- The full Strapi suite runs at the phase gate rather than per plan.

## Self-Check: PASSED
