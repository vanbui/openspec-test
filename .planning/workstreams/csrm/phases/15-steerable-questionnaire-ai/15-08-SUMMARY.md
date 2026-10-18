---
phase: 15-steerable-questionnaire-ai
plan: 08
subsystem: api
tags: [strapi, ai-proposals, gates, release, assessment-draft, replacement, instruction, analyst-reads, contract, web-parser, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-02's fold and answered rule, 15-06's jobs and state helper, 15-07's decisions and AI-sourced governance events
provides:
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-gates.ts (openProposalSummary, assertNoOpenProposals, OpenProposalSummary)
  - AI_PROPOSALS_OPEN on release (in the lock), assessment draft (enqueue and transaction) and replacement (enqueue and transaction)
  - the narrowed replacement (QUESTIONNAIRE_ANSWERED and QUESTIONNAIRE_HAS_ANALYST_CHANGES as closed 409s at enqueue, job failure codes in the transaction)
  - the optional generation instruction (body, job input, run, regenerated event)
  - analyst reads: QuestionnaireQuestion.answered, AiGenerationFacts.openProposals, aiOrigin proposal-confirmed and proposal-edited
  - web: questionnaireQuestionSchema.answered, the widened questionAiOriginSchema, aiGenerationFactsSchema.openProposals, questionOriginMarker and questionOriginIcon for the new origins
affects: [15-09, 15-10, 15-11, 15-12, 15-13, 15-14]
actuals:
  tasks: 4
  commits: 9
plan_head_before: c40e932
plan_head_after: f6b3728
requirements-completed: []  # QUES-11 and QUES-12 are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "Release refused with AI_PROPOSALS_OPEN while an item is open or a job runs, allowed after Reject remaining; a damaged run fails open and is logged once"
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts (three release-gate cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The draft gate at enqueue and in the transaction; the narrowed replacement at enqueue and in the held job"
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts (draft gate); apps/backend/tests/questionnaire-generation.integration.test.ts (two replacement-gate cases and four changed Phase 10/12 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An instruction on generation and on an allowed replacement; its refusals and OWN_REQUEST"
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts (two instruction cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Answered flags, the open proposal count, confirmed AI origins, the generation run guard; web parsers and markers"
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts (three read cases)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts; apps/csrm/src/features/ai-assistance/ai-assistance-domain.test.ts"
        status: pass
    human_judgment: false
completed: 2026-10-12
status: complete
---

# Phase 15 Plan 08: Gates, Narrowed Replacement, Generation Instruction and Analyst Reads Summary

**Nothing moves on while an AI proposal is undecided: release, assessment draft generation and questionnaire replacement are refused with `AI_PROPOSALS_OPEN` while an item is open or a proposal job is running, before queueing and again inside their transactions. A replacement can no longer discard anyone's work: it is refused once the questionnaire is answered or an analyst has changed it since the latest generation. Generation and an allowed replacement take the same optional instruction as the proposals. The analyst's reads now say which questions are answered (only in analyst review and on a submitted questionnaire), how many proposal items are open, and which questions came from confirmed AI proposals.**

## What was built

- **Gates** (`questionnaire-proposal-gates.ts`): `openProposalSummary(strapi, questionnaireId)` folds at most 101 completed proposal runs (`parseRunProposalFor`, `parseRunDecisionsFor`, `foldItemStates`); a damaged run holds no open item and is logged once per process through `strapi.log.warn`; `activeJob` reads the proposal registry. `assertNoOpenProposals(strapi, questionnaireId, refuse)` refuses through the caller's own error. The module never reads `releasedAt`.
- **Release:** `releaseQuestionnaire` calls the gate inside its locked transaction after `assertReleasable`.
- **Draft:** `generateAssessment` refuses before queueing (`AssessmentDraftWorkflowError(409, …, "AI_PROPOSALS_OPEN")`); `persistAssessmentDraft` refuses inside its transaction with the job failure code `AI_PROPOSALS_OPEN`. The draft path still locks only the request row.
- **Replacement** (`replacementRefusal`, one order before queueing, before the job's provider call and under both locks): released → `QUESTIONNAIRE_RELEASED`; answer evidence → `QUESTIONNAIRE_ANSWERED`; `countAnalystChangesSinceGeneration` above 0 → `QUESTIONNAIRE_HAS_ANALYST_CHANGES`; open item or active job → `AI_PROPOSALS_OPEN`. A null count (unreadable log) is not a change and still ends in the job's `HISTORY_UNAVAILABLE`; the full-log and unreadable-log cases pass unchanged.
- **Instruction:** the controller's closed body takes `instruction`; `generateQuestionnaire` runs `parseAnalystInstruction` (400 with its reason), then for a non-null instruction `OWN_REQUEST` (403) and `repeatsRequestorText` (400) before queueing; the registry job carries it; `persistGeneratedQuestionnaire` passes it to `buildAssessmentContextFor` (`instructionSource` `analyst` or `default-task`) and to `createRunningAiRun`; a replacement's `regenerated` event carries `instruction` or `instructionSource: "default-task"`. The spec body gains `instruction` (`maxLength: 500`, `additionalProperties: false` kept).
- **Reads:** `projectQuestions(…, answeredVisible)` adds `answered: isAnsweredValue(answer)` for analysts when `proposalQuestionnaireState` is `analyst-review` or `submitted`; the progress count uses `isAnsweredValue`; the header's `generation.openProposals` is the open count for a human analyst who did not raise the request, else null (absent from the assessment's generation facts, which another projection builds); `deriveQuestionAiOrigins` cancels each confirmation with its Undo and lets the latest remaining content event decide.
- **Web:** the parsers and `questionOriginMarker` (`Confirmed AI proposal`, `Edited AI proposal`) with `questionOriginIcon` (`Check`, `PenLine`, `UserRoundPen`), used by the governance row; `questionnaireProvenanceHeaderProps` takes the widened origin type.

## Phase 10 (and 12) tests changed deliberately (W-6)

All in `apps/backend/tests/questionnaire-generation.integration.test.ts`, names kept:

1. `mounted replacement records one regenerated event naming the analyst and what it discarded`: the second replacement now runs before any edit (discarding nothing); after two edits the replacement is refused before queueing with `QUESTIONNAIRE_HAS_ANALYST_CHANGES` and the questionnaire is deep-equal; the analyst timeline keeps both `regenerated` events with their explanation and the Requestor sees each as `{ at, kind }` only. The first event's deep-equal gains `instructionSource: "default-task"` (D-12).
2. `mounted CR-101 a replacement reaching a question add's transaction window waits for it and keeps both events`: still a lock-order proof: the replacement is reported `blocked` on the add's row lock; run again after the add commits (`replaceQuestionnaireFixture`, the mounted job body) it fails with `QUESTIONNAIRE_HAS_ANALYST_CHANGES`, and the log holds only `question-added`.
3. `mounted analyst reads count question changes since the latest generation and Requestor reads never do`: the replacement runs before the edits (count 0, then 1, then 2); a replacement after the edits is refused and the count stays 2 through the release; the Requestor still never gets the count.
4. Not named by W-6, found by the run: `mounted generation serves help text and the AI-assisted flag to both actors and provenance to the analyst only` (Phase 12) replaced after an analyst edit. Its replacement now runs before the edits (still proving a new run and all-generated origins); after the edits the replacement is refused; the Requestor reads keep help text on every question but the analyst's own, which now survives and carries none.

## Task commits

1. Task 1 (tracer): `2c20541` (test, RED: 3 failures, release answered 200 and no warning) and `63f88f5` (feat).
2. Task 2: `f2320bf` (test, RED: 6 failures) and `01cc82b` (feat).
3. Task 3: `5e0925a` (test, RED: 2 failures) and the GREEN `feat(15-08): let the analyst steer questionnaire generation with an instruction` (spec and generated client included).
4. Task 4: `8497222` (test, RED: 3 mounted and 3 web failures) and `f457471` (feat, spec, client, parsers).

## Verification

- Task 1: governance integration 14/14. Task 2: assessment-workflow + generation integration 70/70. Task 3: generation integration 30/30, `api:check` clean after the commit, web typecheck clean. Task 4: governance integration 17/17; web schema, ai-assistance and parity 403/403; typecheck (lint is the same `next typegen && tsc --noEmit`) clean; `api:check` clean.
- Full web unit suite: 214 files, 5,084/5,084.
- Full Strapi suite at `f457471` (Linux host): 1,608 tests, 1,604 pass, 3 fail and 1 cancelled by its 600 s timeout. Two failures and the timeout were this plan's: the generation enqueue read's new populate shape broke two `questionnaire-generation.unit.test.ts` fakes (one hung until the timeout), and 15-07's released-state case released with an open item, which a release now refuses. Both fixed in `f6b3728` (the enqueue read keeps its Phase 10 shape and reads a replaced questionnaire's questions on their own; the case asks for its rewrite on the submitted questionnaire); the three files re-ran green, 57/57. The third failure is the host's IN-306 heap-limit case (15-07 summary), unchanged.

## Deviations and decisions

- **Reasons on 400 and 403.** The questionnaire controller's `safeError` sent `details.reason` only on a 409; it now sends it on any status that has a closed reason, so the instruction refusals (400) and `OWN_REQUEST` (403) reach the client as the spec's shared error schema already declares. A 409 is unchanged.
- **Retry of an instructed generation job.** A requesting analyst may not retry a failed generation job that carries an instruction (403 `OWN_REQUEST`), since the retry would steer the AI on their own request (D-32); plain jobs retry as before.
- **The draft retry.** A failed draft job stays the questionnaire's job until retried (13-08), so the draft-gate test retries it rather than starting a new one.
- **Instruction order at enqueue:** 404 → eligibility → instruction (400) → `OWN_REQUEST` (403) → Requestor-text guard (400) → released → replacement refusals → AI data policy → enqueue.
- **Origins fold.** "The latest remaining content event decides": an AI-sourced add or edit reads `proposal-confirmed` or `proposal-edited`; a manual edit reads `generated-edited` except on a question an analyst added by hand, which stays `analyst-added` (Phase 12's rule). A confirmation and its Undo cancel by `runId` and `itemKey`.
- **15-04/15-06 reconciliation (STATE note).** The answered rule is now one function everywhere (`isAnsweredValue`); the "submitted" state keeps 15-06's reading (every shown active question submitted), which is the only state rule the gates and reads share (`proposalQuestionnaireState`); 15-04's answer-content inclusion is a context rule, not a state rule, and is left as it is.
- **The assessment header's `openProposals`.** Not asserted mounted: the assessment's generation facts are built by a different projection that this plan does not touch, and the field is optional in the shared schema.

## Next Phase Readiness

- **15-09:** routes for the proposal starts, job read and retry, and decisions; map `QuestionnaireProposalWorkflowError`. `openProposalSummary` can feed the list read's counts.
- **15-10 to 15-13:** `generation.openProposals`, `answered` and the new origins are served and parsed; `questionOriginIcon` gives the icon; `questionnaireProvenanceHeaderProps` still counts Phase 12's three origins (15-12 adds the `from AI proposals` part).
- **E2E:** three specs click Replace questionnaire (`request-pick-up`, `request-attachments`, `questionnaire-generation-workflow`); each replaces a fresh questionnaire, but the 15-14 browser run is the proof.

## Self-Check: PASSED

- FOUND: `questionnaire-proposal-gates.ts`; all eight commits.
- Acceptance: `releaseQuestionnaire` calls `assertNoOpenProposals`; the gates read no `releasedAt`; the generation workflow refuses the three reasons at enqueue and in the transaction; the assessment workflow calls the gate in both places and adds no questionnaire lock; the spec's body lists `instruction` (500) with `additionalProperties: false`; `parseAnalystInstruction` runs before enqueueing; the scope contains `proposal-confirmed`, `proposal-edited` and `isAnsweredValue(`; `latestCompletedGenerationRun` still filters `questionnaire-generation` only and `latestCompletedQuestionnaireContextRun` is still the signal's baseline; the spec's `aiOrigin` enum lists five values and `openProposals` is outside `required`.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
