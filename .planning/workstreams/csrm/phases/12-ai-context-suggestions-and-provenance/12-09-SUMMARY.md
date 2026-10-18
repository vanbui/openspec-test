---
phase: 12-ai-context-suggestions-and-provenance
plan: 09
subsystem: assessment reads and contract
tags: [contract, provenance, assessment, risk]
requires:
  - phase: 12-06
    provides: per-field aiProvenance written with the draft
  - phase: 12-08
    provides: AiGenerationFacts
provides:
  - analyst-only generation facts and resolved AI provenance on the assessment detail and each risk
  - aiAssisted on the Requestor's released assessment detail, and nothing else of the AI facts
affects: [12-10, 12-15, 12-17, 16, 17, 18]
tech-stack:
  added: []
  patterns: [bounded batched lookups, closed nested parsers]
key-files:
  created:
    - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
  modified:
    - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
key-decisions:
  - "Citations resolve against the proposing run's stored context summary: request fields read as their form labels (for example Regulatory requirements), answers as the question text, systems and assets by name. A key the catalogue does not hold, or a run that cannot be read, reads Source no longer available."
  - "Actors are named only while active, as the timeline names them; a suggested control that no longer exists projects with its control number as its name."
  - "The assessment envelope records no adjustments, so AssessmentAiProvenance.adjustments is always empty for now."
  - "AiGenerationFacts moved to features/ai-assistance so the questionnaire and assessment parsers share one closed schema; the questionnaire module re-exports it."
requirements-completed: [INT-06]
status: complete
completed: 2026-10-06
---

# Phase 12 Plan 09 Summary

## Accomplishments

- The analyst's assessment detail carries `generation` (who, when, provider and version, and the run from the assessment's provenance, null before run records existed; null when never generated) and `aiProvenance` (the four assessment fields with their state, actor and citations, and the count still proposed).
- Each analyst risk carries `aiProvenance`: every AI-written field's state, deciding actor and time, citations resolved to kind and label, uncited claims, suggestions with their control summary and state (`present` when the control already mitigates the risk), adjustments and the outstanding count.
- Runs, actors and suggested controls are each resolved in one bounded read per assessment.
- A null or malformed envelope projects null; the read never fails on it.
- The Requestor's released detail carries `aiAssisted` and nothing else: no generation, provenance, run id, provider name or version.
- The specification gains `AiSourceCitation`, `AiFieldReview`, `AiSuggestionReview`, `RiskAiProvenance` and `AssessmentAiProvenance`; the generated client and the closed web parsers follow.

## Verification

- Strapi: `ai-provenance.unit.test.ts` 3/3 (new projection case: resolution, inactive actors, present suggestions, missing controls, malformed envelopes, unreadable runs); `assessment-workflow.integration.test.ts` 32/32 (analyst provenance after edits, seeded and malformed provenance, Requestor `aiAssisted` and its absences).
- Web: the full suite 3,344/3,344; typecheck clean; `api:check` clean once committed.

## Deviations

- Executed by the pilot while the execution tool's 5-hour window cooled.
- The RED and GREEN commits were folded into one feature commit, with the tests in it.
- The Requestor's assertions extend the existing owner-scope test, which already holds a drafted and released assessment.

## Self-Check: PASSED
