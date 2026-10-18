---
phase: 12-ai-context-suggestions-and-provenance
plan: 06
subsystem: assessment-draft
requirements: [ASSESS-08, INT-05, INT-06]
requirements-completed: [ASSESS-08, INT-05, INT-06]
status: complete
completed: 2026-10-06
coverage:
  - id: contextual-draft
    description: Context-built draft with selected records, derived ratings, citations, suggestions, provenance and a completed run
    requirement: ASSESS-08
    verification:
      - kind: integration
        ref: apps/backend/tests/assessment-workflow.integration.test.ts#mounted full-context draft records linked risks, provenance and a completed run
        status: pass
      - kind: unit
        ref: apps/backend/tests/assessment-workflow.unit.test.ts#deterministic draft uses selected systems and assets, repeated types, and an untyped risk
        status: pass
    human_judgment: false
  - id: draft-wire
    description: Portable version 2 wire schema with context mapping and a closed adapter
    requirement: INT-05
    verification:
      - kind: unit
        ref: apps/backend/tests/ai-provider-assessment.unit.test.ts#portable wire schema contains only supported structure and excludes derived values
        status: pass
      - kind: unit
        ref: apps/backend/tests/ai-provider-assessment.unit.test.ts#wire adapter records Accept, source and suggestion adjustments
        status: pass
    human_judgment: false
  - id: draft-run
    description: Draft completion and failure use separate run records, with retry linked to attempt two
    requirement: INT-06
    verification:
      - kind: integration
        ref: apps/backend/tests/assessment-workflow.integration.test.ts#mounted assessment draft generation exposes a bounded analyst-owned lifecycle
        status: pass
    human_judgment: false
  - id: release-journey
    description: Release journey completes all four deterministic risks
    verification: []
    human_judgment: true
    rationale: Browser execution was reserved for the orchestrator by the run instructions.
---

# Phase 12 Plan 06 Summary

Assessment drafts now use the full request context. Each proposal carries bounded sources and control suggestions, server-derived ratings, selected record links and per-field provenance.

## Accomplishments

- The UAT-like mounted case produced four risks in order: Internet Exposure, Personal Information Handling, Personal Information Handling, Third-Party Dependency. The first links to the selected payroll system; both personal-information risks link to the Restricted asset. A unit case with an untested-recovery answer also produced an untyped fifth risk last.
- The closed parser accepts repeated or absent Risk Types and refuses unknown record references, sources, controls, invalid ratings and an Accept action with suggested controls. The wire adapter maps context keys, filters suggestions and citations, records adjustments and derives server-owned values.
- Draft persistence stores assessment and risk provenance, suggested controls as proposals, and a completed run in the draft transaction. The mounted retry case checks a failed first run and a completed second attempt.
- The release journey now completes a fourth risk. Its expected draft list is Internet Exposure, Personal Information Handling, Personal Information Handling, Third-Party Dependency; that browser list was not observed in this run.

## Verification

- Runtime version check: Node 24.21.0 and pnpm 11.24.0 passed.
- Backend source and test TypeScript compiles: passed.
- Web typecheck: passed.
- Final focused backend run across five directly affected test files: 81 passed, 0 failed, 0 skipped.
- Final post-edit adapter test rerun: 6 passed, 0 failed, 0 skipped.
- `git diff --check`: passed.
- Browser journey: not run under the orchestrator's instructions. The full backend and web suites were also left to the orchestrator.

## Deviations from Plan

- The UAT-like mounted case now seeds the assessment workflow's Risk Types explicitly, so it can run alone while retaining the earlier fixture's distinct names.
- The harness assessment read populates linked risk records for persistence assertions.
- The RED commit sequence and all task commits were skipped under the git read-only rule. The tests were completed and verified in the working tree; commit pending (orchestrator).
- The plan's full-suite and browser verification commands were replaced by the focused compiles and affected test files required for this run.

## Remaining Work

- The orchestrator should run the release browser journey and full suites, review the working tree, and commit. No later plan or phase verification was started.
