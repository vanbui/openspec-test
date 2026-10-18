---
phase: 15-steerable-questionnaire-ai
plan: 09
subsystem: api
tags: [strapi, routes, catalogue, human-analyst-only, own-request, contract, served-operations, authorization-matrix, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-06's jobs, 15-07's decisions, 15-08's gates and replacement order
provides:
  - six served operations: POST and GET /api/v1/questionnaires/{questionnaireId}/ai_proposals, POST /api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite, GET /api/v1/questionnaire_proposal_jobs/{jobId}, POST /api/v1/questionnaire_proposal_jobs/{jobId}/retry, POST /api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-read.ts (readQuestionnaireAiProposals, DECIDED_ITEMS_LISTED)
  - five function.questionnaire_ai.* Functions (propose_api with two FunctionApis, job_read_api, retry_api, proposals_read_api, decide_api), granted both ways, in both catalogue copies, and a Phase 15 design note
  - QUESTIONNAIRE_AI_OPERATIONS in the human-only set with its own refusal sentence
  - spec components QuestionnaireProposalJob(Response), QuestionnaireAiAction, QuestionnaireAiQuestionValues, QuestionnaireAiRunFacts, QuestionnaireAiProposalItem, QuestionnaireAiProposals(Response), QuestionnaireAiInstructionRequest, QuestionnaireAiProposalDecisionRequest, QuestionnaireAiProposalDecisionResponse; tag questionnaire-ai
  - six humanAnalystOnly matrix rows
affects: [15-10, 15-11, 15-12, 15-13, 15-14]
actuals:
  tasks: 3
  commits: 6
plan_head_before: f93fedc
plan_head_after: 506d514
requirements-completed: []
completed: 2026-10-12
status: complete
---

# Phase 15 Plan 09: The Questionnaire AI Routes Summary

**The six questionnaire AI operations are served, each through its own human Security Analyst-only, API-only Function granted to `role.security_analyst` both through the Function's `roleIds` and the role's `functionIds`, byte-identical in both catalogue copies, and listed among the human-only operations with their own refusal sentence. The Requestor, the Secondary Requestor and the service agent are refused every route with 403 and nothing changes; an analyst on a request they raised is refused with 403 `OWN_REQUEST`. The proposals read serves open items with their staleness, the 50 most recent decided items, the run facts, the active jobs, the fixed questions where D-06 shows them and what the viewer may do now.**

## What was built

- **Routes and handlers** (`csrm-questionnaire.ts`): the four questionnaire-scoped routes use `policies(operation, "resource")`; the two job routes use `generationPolicies(operation)` (the record check happens in the service after loading the job). Handlers pass `proposalViewer(ctx)` (`analystDocumentId`, the policy's `humanAnalyst`) and map `QuestionnaireProposalWorkflowError` and `QuestionnaireGovernanceError` through `safeError` with their closed reason (15-08 made `safeError` carry a reason on 400 and 403 too). Starts and retry answer 202, reads 200, decisions 200 with `{ applied, unchanged }`.
- **The read** (`readQuestionnaireAiProposals`): 403 without the human-analyst fact, 404, 403 `OWN_REQUEST`; state from `proposalQuestionnaireState`; up to 101 completed runs, newest first; open items first in run and item order, then the 50 most recently decided by their last event; `stale` from `isItemStale` against the live questions, null while the Requestor answers and for decided items; `target.available: false` with the stored snapshot when the question row is gone; `current` and `proposed` values; addition placement with the controller's text; sources by label (request field labels from Phase 12's `REQUEST_FIELD_LABELS`, now exported; `Note {n}` with its part and time; file names from the run's summary; the analyst's instruction; an answered question generically); decisions with the actor's name; `canUndo` by 15-07's rules; run facts (instruction or its source, target question from the run's `ai-proposal` event, outcome, counts, adjustments by code, sources dropped); `actions` per D-06, `confirm` only in analyst review, `reject` until the draft, `replace` by 15-08's `replacementRefusal` (now exported) then the request's eligibility; `jobs` (`projectedActiveProposalJobs`, new export); `fixedQuestions` in analyst review and on a submitted questionnaire.
- **Policy:** `QUESTIONNAIRE_AI_OPERATIONS` (six literals) spread into `HUMAN_ANALYST_ONLY_OPERATIONS`; `humanAnalystDenialMessage` answers `Asking the AI about a questionnaire or deciding its proposals requires a human Security Analyst.`
- **Contract:** the six paths (tag `questionnaire-ai`, the plan's operationIds, path parameters 1 to 255) with closed request and response components; `api:generate`; `served-operations.json` regenerated with exactly one entry per operation.
- **Matrix:** six `humanAnalystOnly` rows; the mirror holds six; the count reads `23 + insightOperations.size`.

## Task commits

1. Task 1 (tracer): `efbf913` (test, RED: no route, 404; catalogue Function missing) and `20fd96a` (feat).
2. Task 2: `43d55c7` (test, RED: 6 failures) and `4c228b6` (feat).
3. Task 3: `d38a6b7` (test, RED: the fixture's `optionalQuestion` missing, a compile error) and `506d514` (the fixture; matrix and provenance 147/147).

## Verification

- Task 1: the read cases and the Phase 15 catalogue case 4/4; `api:check` clean; `cmp` silent.
- Task 2: proposals integration, catalogue and policy unit files 79/80 on the first run; the one failure was the 15-06 two-files case with a transient `fetch failed … ECONNRESET` during its upload, which re-ran green (3/3 with the two other file cases); served-operations 9/9 after the regeneration; `api:check` clean; `cmp` silent; the catalogue both-ways check true.
- Task 3: `authorization-matrix.integration` and `authorization-matrix-provenance.unit` 147/147.
- Full Strapi suite at `506d514` (Linux host, dev servers stopped, Keycloak flags false, deterministic providers): 1,623 tests, 1,622 pass, 0 skipped, 1 fail, the host's IN-306 heap-limit case (Node worker `resourceLimits` are not enforced on this host; 15-07 summary), 1,966 s.
- Web: typecheck clean; full unit suite 214 files, 5,084/5,084.

## Deviations and decisions

- **Matrix statuses for the job rows and the decision row.** The job read and retry rows probe an unknown job (`humanAnalystOnly(404)`, the AI run read's pattern: the human analyst passes the guard and meets a 404 with no enumeration), and the decision row sends an empty batch (`humanAnalystOnly(400)`), so no row depends on a live job or can change a questionnaire. The successful paths (202, 200) are proven by the mounted HTTP tests the rows cite. The start, rewrite and read rows issue their allowed requests (`exercisesAllowed`).
- **Answered-question citations** carry a generic label: the run keeps no map from its `Q` refs to questions, and an answer is never shown. A later phase can store the map on the run if the labels need the question text.
- **The read's `replace`** adds `REQUEST_NOT_ELIGIBLE` after 15-08's four reasons when the request is no longer `submitted`, since generation itself refuses then.

## Next Phase Readiness

- **15-10 (the web service layer):** the six operations, their closed bodies and components are in the generated client; `QuestionnaireAiProposals.actions` gives each control's reason; the job projection matches the generation job's.
- **15-11 to 15-13:** the read's items carry everything the cards need (staleness, comparison values, placement, cited sources, decision and `canUndo`); `fixedQuestions` is null while the Requestor answers.

## Self-Check: PASSED

- FOUND: `questionnaire-proposals-read.ts`; commits `efbf913` to `506d514`.
- Acceptance: both catalogue copies hold the five Functions with `roleIds` exactly `["role.security_analyst"]`, each in that role's `functionIds` and no other role's; `HUMAN_ANALYST_ONLY_OPERATIONS` holds the six literals through `QUESTIONNAIRE_AI_OPERATIONS` with its own sentence; `served-operations.json` has exactly one entry per new `catalogueUrl`; the integration file names a `Secondary Requestor` test and a `service agent` test; the policy unit file has the sentence case; the matrix has six Phase 15 `humanAnalystOnly` rows and the count `23 + insightOperations.size`.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
