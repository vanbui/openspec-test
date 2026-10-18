---
phase: 15-steerable-questionnaire-ai
plan: 07
subsystem: api
tags: [strapi, ai-proposals, decisions, undo, governance-lock, staleness, answer-preservation, own-request, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-02's fold, staleness, preservation and placement; 15-03's governance AI keys; 15-06's jobs, lock and harness helpers
provides:
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-decisions.ts (decideQuestionnaireAiProposals, parseQuestionnaireProposalDecisionBatch, QUESTIONNAIRE_DECISION_BATCH_MAX, QuestionnaireProposalDecision, QuestionnaireDecisionEdits)
  - exported governance helpers (candidateQuestion, validateDefinition, questionOptions, questionByDocumentId, governanceConflict, appendQuestionEvent with an AI source, QuestionEventSource)
  - proposalQuestionnaireState (questionnaire-proposals-workflow.ts) and fingerprintInput (questionnaire-proposal-adapter.ts)
  - the Requestor's in-transaction release re-check in saveAnswers and submitQuestionnaire
  - harness helpers decideQuestionnaireProposalsFixture, questionnaireSnapshotFixture, saveAnswersServiceFixture, submitQuestionnaireServiceFixture
affects: [15-08, 15-09, 15-10, 15-11, 15-12, 15-14]
actuals:
  tasks: 3
  commits: 6
plan_head_before: f06811d
plan_head_after: 89c624e
requirements-completed: []  # QUES-11 and QUES-12 are delivered by the phase and marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "One confirmed addition: a new unanswered question first in a new section after the last, one accepted v2 decision naming it, one question-added event with the AI source; a repeat is a counted no-op"
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-decisions.integration.test.ts (Task 1's case)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changes, removals, edit then confirm, reject with reason, every Undo, staleness, the state rule before staleness, the batch rules, ALREADY_DECIDED, ANSWERED_QUESTION_AFFECTED, OWN_REQUEST"
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-decisions.integration.test.ts (Task 2's 10 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Requestor's release re-check at the service, the answer race, answers unchanged across confirmations and a release"
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-decisions.integration.test.ts (Task 3's 3 cases); questionnaire-workflow.integration.test.ts unchanged and green"
        status: pass
    human_judgment: false
completed: 2026-10-12
status: complete
---

# Phase 15 Plan 07: The Questionnaire Decision Operation Summary

**A Security Analyst now decides each AI proposal on its own: Confirm (optionally after editing it), Reject with an optional reason, or Undo either. A batch of 1 to 200 decisions is all or nothing, runs inside the questionnaire's governance lock against an in-memory working copy, and writes the questions, every run's decision log and the governance log only once every decision has passed. Confirmations apply through the manual edit's validation, never write an answer, and are refused when they would change or hide an answered question. The Requestor's save and submit now re-read the release fact inside their locked transaction.**

## What was built

- `decideQuestionnaireAiProposals({ strapi, questionnaireId, analystDocumentId, humanAnalyst, body, now? })` → `{ applied, unchanged }`. Errors throw `QuestionnaireProposalWorkflowError(status, message, reason?)`, the class 15-06's jobs throw, so 15-09 maps one error type; governance helper errors are converted.
- Check order: closed body (400) → human analyst (403) → questionnaire (404) → `OWN_REQUEST` (403, before the lock) → in the lock: every named run is this questionnaire's completed proposal run, else 404 for the batch → every item key is in its run's proposal (400) → `ASSESSMENT_STARTED` / `ASSESSMENT_DRAFT_IN_PROGRESS` (409, through `proposalQuestionnaireState`) → per decision in the order sent: the state rule (accept, and restore of an accepted item, need analyst review: `QUESTIONNAIRE_RELEASED` or the stage reason) → the fold (damaged run or not-open → `AI_PROPOSAL_ALREADY_DECIDED`; identical repeat → unchanged) → staleness against the working copy (`AI_PROPOSAL_STALE`) → apply (invalid edits 400; `DEFINITION_INVALID`; `ANSWERED_QUESTION_AFFECTED`; `QUESTION_HAS_DEPENDENTS`; `LAST_ACTIVE_QUESTION`).
- Apply: an addition is placed by `placeAddition` on one `createBatchAllocation` per batch and keyed by `allocateQuestionKey`; a change goes through `candidateQuestion` with the proposal overlaid by the edits; a removal is the soft removal with the manual rules. Each accept records `applied` (documentId, key, fingerprint), `before` for a change or removal, and `edits` (the fields whose value differs from the proposal).
- Undo: allowed only while the question's fingerprint equals `applied.fingerprint` and it is unanswered, else `AI_PROPOSAL_UNDO_UNAVAILABLE`; addition → soft removal (`question-deleted`), change → `before` written back (`question-edited`), removal → restored (`question-restored`); each with `runId`, `itemKey`, `aiEdited` and `aiUndo: true`. Restoring a rejection returns the item to open with no governance event.
- Writes happen once, after all checks: created questions first, so the accepted events' `applied.questionDocumentId` names the real documentId (placeholders are resolved); then changed rows (never `answer`); one `appendAiRunDecisions` per run; the governance log.
- `addQuestionnaireQuestion` now allocates its key with `allocateQuestionKey` (the same rule; the governance suite's key cases stay green). `questionKeyFromText` is gone.
- `saveAnswers` and `submitQuestionnaire` refuse with `QuestionnaireWorkflowError(409, "CSRM questionnaire is not answerable.", "QUESTIONNAIRE_NOT_ANSWERABLE")` right after `loadWorkflow` when the questionnaire is not released. `questionnaire-workflow.unit.test.ts` is unchanged.

## Mounted cases proving the Requestor's re-check

- `QUESTIONNAIRE_NOT_ANSWERABLE: once Bob returns the released questionnaire to analyst review, Jane's save and submit, called at the service past the policy, are refused …`: before the return both service fixtures answer 200; after it both answer 409 with the served reason and message, `questionnaireSnapshotFixture` deep-equal; the same save over HTTP still meets the policy's 403, deep-equal.
- `a Requestor answer between the proposal and the confirmation …`: Bob's rewrite of the MFA question is held; Jane reverts to draft and answers it; the job completes with its change; after the return to analyst review confirming it is `AI_PROPOSAL_STALE`, deep-equal.
- `Jane's answers unchanged: …`: across confirming all three offshore additions and a release, every answered question is deep-equal, and Jane's questions read shows the three new unanswered questions and her earlier answers.

## Task commits

1. Task 1 (tracer): `0e97577` (test, RED: the decision module did not exist) and `b691269` (feat, GREEN).
2. Task 2: `b9bc90d` (test, RED: 8 of 11 failed with the 400 the tracer's stubs returned; the ALREADY_DECIDED and OWN_REQUEST cases already passed on the tracer's checks) and `356594c` (feat, GREEN).
3. Task 3: `32edb2d` (test, RED: the re-check case failed with 200; the race and answers-unchanged cases passed at RED, because staleness and the no-answer rule already hold them, and they now pin it) and `89c624e` (feat, GREEN).

## Verification

- Task 1 verify: `tsc`, `tsc -p tests`, decisions + governance integration 12/12.
- Task 2 verify: decisions integration 11/11.
- Task 3 focused: decisions + questionnaire-workflow integration 27/27.
- Full Strapi suite (`pnpm --dir apps/backend test`, Linux host, dev servers stopped): 1,597 tests, 1,596 pass, 0 skipped, **1 fail**: `attachment-extraction.unit.test.ts` "an extraction over its heap limit is unavailable … (IN-306)", a Phase 14 test this plan does not touch. Cause, measured on this host: Node's worker `resourceLimits` are not enforced here (a worker with `maxOldGenerationSizeMb: 32` reports a 192 MB limit and allocates 418 MB without error, on Node 22.22, 24.19 and 24.21), so no input can provoke the overrun the test needs; the POSIX-modes test that was skipped on Windows now runs and passes. Carried to the 15-14 gate (below).

## Deviations and decisions

- **Signature.** The plan named `decideQuestionnaireAiProposals({ strapi, questionnaireId, analyst, body })`; the executed 15-06 convention is `{ analystDocumentId, humanAnalyst }` (fail closed without the policy's human-analyst fact), so the service takes those.
- **Fixture shape.** `decideQuestionnaireProposalsFixture` returns 15-06's `ProposalFixtureResponse` (`{ status, data?, reason?, message? }`) rather than `{ status, body }`, so one refusal shape serves every Phase 15 fixture.
- **Placement order.** A new section's first question sits at order 0 (15-02's executed `placeAddition`), not order 1 as the plan's tracer text said; the test asserts order 0 and section order 2.
- **Two small exports outside the plan's file list:** `proposalQuestionnaireState` from `questionnaire-proposals-workflow.ts` (the one D-06 helper, with the process's draft job read) and `fingerprintInput` from `questionnaire-proposal-adapter.ts` (one fingerprint input rule for staleness and `applied`).
- **Working copy, then one write.** Every check runs on an in-memory copy and nothing is written until the whole batch passes, so all-or-nothing does not depend on transaction rollback alone.
- **Released-fact type.** The re-check accepts a `Date` or a non-empty string, as `deriveProposalQuestionnaireState` does.
- **`questionnaire-workflow.integration.test.ts`** was not changed: the mounted re-check, the HTTP policy refusal and the race live in the decisions file with the fixtures they share; the workflow suite stays green unchanged.

## Next Phase Readiness

- **15-08:** `assertNoOpenProposals` can fold runs exactly as `loadRuns` does here (`parseRunProposalFor`, `parseRunDecisionsFor`, `foldItemStates`; damaged = no open item). Confirmed events carry `runId`, `itemKey`, `aiEdited` (and `aiUndo` on the reverse event), which `deriveQuestionAiOrigins` must pair to ignore a confirmation and its Undo.
- **15-09:** map `QuestionnaireProposalWorkflowError` for `POST /api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions`; answer 200 with `{ applied, unchanged }`; pass `analystDocumentId` and the policy's `humanAnalyst`. Body as parsed by `parseQuestionnaireProposalDecisionBatch` (edits keys `questionText`, `helpText`, `answerType`, `choices`, `required`, `section` `{ kind: "existing", key } | { kind: "new", title }`).
- **15-14 gate:** settle the IN-306 heap-limit failure, which comes from this host's runtime, not from Phase 15.

## Self-Check: PASSED

- FOUND: `questionnaire-proposal-decisions.ts`, `questionnaire-ai-decisions.integration.test.ts`.
- FOUND: 0e97577, b691269, b9bc90d, 356594c, 32edb2d, 89c624e.
- Acceptance criteria: the service calls `withQuestionnaireGovernanceLock` and `appendAiRunDecisions` and creates questions with `answer: null`; the governance workflow exports `appendQuestionEvent` and `addQuestionnaireQuestion` calls `allocateQuestionKey`; the test names include `QUESTIONNAIRE_RELEASED before staleness`, `deep-equal`, `question-restored`, `AI_PROPOSAL_UNDO_UNAVAILABLE`, `AI_PROPOSAL_ALREADY_DECIDED`, `OWN_REQUEST`, `Requestor answer between`, `answers unchanged` and `QUESTIONNAIRE_NOT_ANSWERABLE`; `questionnaire-workflow.ts` holds the re-check in both functions; no content-type file changed.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
