---
phase: 12-ai-context-suggestions-and-provenance
plan: 16
subsystem: assessment review and release readiness
tags: [review, provenance, readiness, editor]
requires:
  - phase: 12-13
    provides: proposal decision action and refusal copy
  - phase: 12-15
    provides: served field facts and provenance header
provides:
  - server-side release requirement for proposed fields at assessment and Risk scope
  - per-field markers, review bars, Confirm remaining, Undo and refusal recovery
  - release journey assertion and keyboard review sequence
affects: [12-17, 12-18, 12-19]
tech-stack:
  added: []
  patterns: [record-scoped optimistic decisions with server-owned readiness]
key-files:
  created:
    - apps/csrm/src/features/ai-assistance/ai-field-marker.tsx
    - apps/csrm/src/features/ai-assistance/ai-review-bar.tsx
    - apps/csrm/src/features/ai-assistance/use-ai-decisions.ts
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/csrm/src/features/assessments/risk-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
requirements-completed: [INT-06, ASSESS-08]
coverage:
  - id: readiness
    description: Release waits for review of proposed fields on each record.
    requirement: ASSESS-08
    verification:
      - kind: unit
        ref: apps/backend/tests/assessment-workflow.unit.test.ts#release readiness requires review of proposed fields at each record scope
        status: pass
    human_judgment: false
  - id: editor-review
    description: The editor marks proposals, protects unsaved edits and handles confirmation, Undo and refusal.
    requirement: INT-06
    verification:
      - kind: unit
        ref: apps/csrm/src/features/ai-assistance/use-ai-decisions.test.tsx
        status: pass
      - kind: unit
        ref: apps/csrm/src/features/assessments/assessment-editor.test.tsx#keeps an unsaved value while another field is confirmed
        status: pass
    human_judgment: false
  - id: release-journey
    description: The browser journey confirms remaining proposals before release and stays within its route budget.
    requirement: ASSESS-08
    verification:
      - kind: e2e
        ref: apps/csrm/e2e/assessment-release-workflow.spec.ts
        status: pass
      - kind: e2e
        ref: apps/csrm/e2e/performance.spec.ts
        status: pass
    human_judgment: false
status: complete
completed: 2026-10-07
commits:
  red: 380674b
  green: ec08693
  docs: (this commit)
---

# Phase 12 Plan 16 Summary

The release gate now requires a Security Analyst to confirm or edit each proposed field, with record-level review controls and Undo in the editor.

## Accomplishments

- Readiness projects `Review of AI proposals` at assessment and Risk scope only when parsed field facts exist, and release refuses while any remains proposed.
- The editor shows field markers, record review bars, a Risk header badge and contextual pre-fill notes. Confirm and Confirm remaining send one guarded decision each, preserve unsaved input, and expose Undo and refusal recovery.
- The release journey now asserts the outstanding requirement and uses keyboard confirmation before its readiness assertion.

## Verification

- Web full suite 3,496/3,496 (157 files); typecheck clean.
- Strapi full suite 756/756.
- Playwright: `assessment-release-workflow.spec.ts` 1/1, `accessibility.spec.ts` green, `performance.spec.ts` 11/11 with the editor route override below.

## Decisions

- **Editor route budget.** With the AI review UI the editor measured 304,218 delivered bytes. Per the spec's rule for an inherent cost it gets its own budget, 460,000 bytes (1.5 x the median, rounded up), with the reason beside it; the duplicated chunk group that 12-15 had caused was already removed (quick 261007-jbs).

- Extended the existing relation picker with a label suffix and description target so its two generated relation fields have the same marker and accessible description as text and select fields.
- Kept release readiness sourced from the server response; optimistic decisions change marker and bar state only.

## Deviations from Plan

- The execution run did not run the browser checks; the pilot ran them. They found two defects, fixed before commit: each Risk form's selects shared one id (`risk-{field}`), so with several Risks on the page a label named only the first form's select; ids are now unique per Risk. The release journey's confirmation loop used position-based locators, which a re-read of the assessment can reorder; it now confirms until no `Confirm remaining` is left, waiting for each server answer.
