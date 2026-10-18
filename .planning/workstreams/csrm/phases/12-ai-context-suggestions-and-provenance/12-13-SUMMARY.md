---
phase: 12-ai-context-suggestions-and-provenance
plan: 13
subsystem: assessment decisions, control implementations and refusal copy
tags: [assessment, provenance, controls, server-action, copy]
requires:
  - phase: 12-12
    provides: the decision operation, the G-14 check and the typed web service
  - phase: 12-04
    provides: the suggestion envelope (state, implementation, implementationSnapshot)
provides:
  - suggested controls added as Planned implementations in one decision, with the guarded Undo (UI-D12)
  - dismiss and restore of suggestions without a review transition (Phase 16 D-23)
  - the shared in-mutation create and remove helpers for control implementations
  - decideAiProposalsAction, the one batch Server Action every editor surface calls
  - family J refusal copy, with the G-14 addition
affects: [12-16, 12-17, 16, 17, 17.1]
status: complete
completed: 2026-10-06
commits:
  red: e284b36
  green: 436e99d
  docs: (this commit)
---

# Phase 12 Plan 13 Summary

Executed by the pilot while the execution tool's 5-hour window cooled (94% after 12-12).

## Accomplishments

- `control-implementation-workflow.ts` exports `createControlImplementationWithinMutation`, `removeControlImplementationWithinMutation` and `controlImplementationWritableSnapshot` (plus two small reads, `findControlImplementationForSnapshot` and `implementedControlIdsForRisk`). The public create and delete call the helpers inside their own mutation, so the manual path validates and writes exactly as before.
- `ai-proposal-decisions.ts` implements the suggestion state table in the pure `applySuggestionDecision`: accept adds a Planned implementation and stores its snapshot; a suggestion whose control is already on the risk is a no-op; restore of an added suggestion removes the implementation only while it still equals the snapshot (else 409 `AI_SUGGESTION_CONTROL_CHANGED`), and returns the suggestion to proposed without deleting anything when the analyst already removed it; dismiss and its restore change only the review record. Conflicts are 409 `AI_PROPOSAL_ALREADY_DECIDED`, unknown keys 400.
- The transition function now follows the batch's content change, not its count: field decisions and suggestion add or remove take the accepted-edit transition; dismissals and their restores take none. The internal `contentChanged` flag never reaches the response, which stays `{ applied, unchanged }`.
- G-14 still runs after the whole batch, so a control just added from a suggestion blocks confirming an AI Accept on the same risk in either order; a Planned control on another risk does not.
- Control-implementation helper errors are re-raised as `AssessmentWorkflowError` so the assessment controller answers them with their status instead of a 500.
- Web: `decideAiProposalsAction` validates strictly (assessment id, 1 to 200 decisions), calls `decideAiProposals` once, revalidates `/app/review/assessments/{id}` on success, and returns the family J sentence, its kind and the served reason on failure. `aiDecisionRefusalCopy` in `refusal-copy.ts` holds the seven §6.3 rows, UI-D12's sentence and the G-14 addition (marked in a comment).

## Verification

- `ai-proposal-decisions.integration.test.ts`: 10/10 (four new cases: add and guarded Undo, dismissals without review change on a draft and on an in-review release-ready assessment, conflicts and the all-or-nothing batch, G-14 in both orders plus the other-risk case).
- Web `src/features/ai-assistance`, `src/lib/api` and the zod client-boundary test: 191/191. Web typecheck clean.
- Full Strapi suite: 754/754.

## Decisions

- The harness gains `updateFixtureDocument(uid, documentId, data)`, the direct document write the plan's G-14 case uses to seed a suggestion on the AI-Accept risk (and the present-control case on a Treat risk). Test-only.
- The new cases are ordered around the file's existing shared fixture: the add-and-Undo case runs before "restoring a confirmed field withdraws a release-ready review" and leaves the risk as it found it; the dismissal, conflict and G-14 cases run after it, starting from the draft state it leaves.
- The 404 row of family J reads Phase 10's assessment refusal, `This assessment is no longer available.` (the assessment actions' 404 copy).
- A validation failure in the action reads the 400 row (blocked) without calling the service.

## Deviations

- Tests and implementation were written in one pass rather than a separate observed RED run; the new mounted cases exercise behaviour that 12-12 answered with 400, so they could not have passed before.
- `ai-assistance-service.test.ts`'s transport mock now forwards a 409's served reason, mirroring the real `normalizeTransportError`.

## Self-Check: PASSED
