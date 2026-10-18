---
phase: 15-steerable-questionnaire-ai
plan: 06
subsystem: api
tags: [strapi, ai-proposals, jobs, registry, governance-lock, ai-run, question-rewrite, ai-inputs-signal, own-request, data-policy, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-02's instruction validator, guard and item fold; 15-03's ai-proposal event; 15-04's context loader with the questionnaire part; 15-05's providers and adapter
  - phase: 13-request-pick-up-and-notes
    provides: OWN_REQUEST, job access through humanAnalyst and retry attribution (13-08), CONTEXT_WIDE_AI_OPERATIONS and loadAiInputsChanged (13-17)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: the run record lifecycle, the AI data policy, withProviderCallRecorder
provides:
  - apps/backend/src/csrm/ai/proposal-job-registry.ts (createProposalJobRegistry, ProposalJobFailure, ProposalJobRegistryError, ProposalJob)
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts (starts, job read and retry, execution, completion, the state helper, the corpus)
  - withQuestionnaireGovernanceLock (questionnaire-governance-workflow.ts)
  - latestCompletedQuestionnaireContextRun (questionnaire-scope.ts), the AI-inputs signal's questionnaire baseline in both served reads
  - the harness's proposal job fixtures, held proposal provider, questionnaire runs list and proposals()/rewrites() counts
affects: [15-07, 15-08, 15-09, 15-10, 15-11, 15-14, 16]
actuals:
  tokens: 34000
  tasks: 3
  commits: 6
plan_head_before: afdb02c8ac657e2012a0f61cc7362dd2a658ce7a
plan_head_after: fd45890903bf90868ff154c1c59a6005afc67d9d
tech-stack:
  added: []
  patterns:
    - "A generic in-process proposal job registry keyed by target (`questionnaire:{id}`, `question:{id}`), one per Strapi, which Phase 16 can instantiate for risks"
    - "Enqueue refusals in a leak-safe order (body, 404, OWN_REQUEST, state, target, instruction, guard, run cap, policy, log slot); execution re-checks state, target, cap and policy before any run"
    - "The provider call outside any lock; the run's completion, supersession or lapse and the ai-proposal event inside withQuestionnaireGovernanceLock"
    - "The adapter's context is built from the questionnaire the context loader read (buildAssessmentContextFor's questionnaireSource), never a second read"
key-files:
  created:
    - apps/backend/src/csrm/ai/proposal-job-registry.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts
    - apps/backend/tests/proposal-job-registry.unit.test.ts
    - apps/backend/tests/questionnaire-ai-proposals.integration.test.ts
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/csrm/ai/ai-inputs-signal.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
key-decisions:
  - "Every proposal start, read and retry requires the policy's humanAnalyst fact (fail closed); the routes and grants arrive in 15-09"
  - "The submitted state reads the active questions the Requestor is shown (the submit stamps visible questions only), as the plan states"
  - "A rewrite's target re-check, the run cap and the policy run again in the job before any run; an unknown target at execution fails QUESTION_NOT_FOUND"
  - "The job record keeps a failure object (code, message, attachmentDocumentIds) like the generation registry; the projection flattens it to failureCode, failureMessage and failureAttachments"
  - "The job projection carries initiatedByViewer as the generation job does (the plan check's I-4 advisory, taken)"
  - "A retry is refused by the AI data policy before it is queued, as a generation retry is"
requirements-completed: []  # QUES-11 and QUES-12 are traced by this plan but delivered by the phase; they are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "A questionnaire-wide proposal job: one run with the instruction, analyst and provider, the offshore proposal and one ai-proposal event, nothing else changed; the served signal cleared in both reads"
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-proposals.integration.test.ts (Task 1's 3 cases)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/proposal-job-registry.unit.test.ts (4), apps/backend/tests/ai-inputs-signal.unit.test.ts (13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rewrites, D-06 state rules, OWN_REQUEST, the instruction validator and guard, the slot, the policy twice, the run cap, CONTEXT_TOO_LARGE (questions and files), single flight, supersession and lapse"
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-proposals.integration.test.ts (Task 2's 12 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Job read and retry by any eligible analyst, retry attribution, failureAttachments, interrupted runs and no lost governance write"
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-ai-proposals.integration.test.ts (Task 3's 5 cases)"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,583 tests: 1,582 pass, 0 fail, 1 skipped by platform)"
        status: pass
    human_judgment: false
duration: 47min
completed: 2026-10-12
status: complete
---

# Phase 15 Plan 06: The Proposal Jobs and Workflow Summary

**A human Security Analyst can now ask the AI for questionnaire-wide proposals or a plain-language rewrite of one question, and gets a job. The job records one run with the instruction, the analyst and the provider, and stores the proposal. It appends one `ai-proposal` timeline event in the same locked transaction and changes nothing else on the questionnaire. Starts follow D-06 and G-1. Instructions are validated and guarded, the data policy is checked twice, the run cap and context bounds hold, newer rewrites supersede older ones, and late runs lapse. Any eligible analyst can follow and retry a job. A completed questionnaire-wide run clears the "AI inputs changed" signal in both served reads; `generation.runId` stays on the generation run.**

## Performance

- **Duration:** about 47 min, of which the full Strapi suite took about 24
- **Started:** 2026-10-11T12:27:57Z
- **Completed:** 2026-10-11T13:15:26Z (2026-10-12 local)
- **Tasks:** 3 of 3 (Task 1 the tracer)
- **Files:** 13 changed (4 created), 1,922 insertions and 41 deletions

## Accomplishments

- **The registry** (`createProposalJobRegistry<TInput>({ execute, now?, createJobId?, maxTerminal?, terminalTtlMs? })`):
  - single flight per key;
  - `get`, `retry(jobId, analystDocumentId)` (attempt + 1, initiated by the retrier), `mayRetry`, `activeFor(questionnaireId)`, `settled(jobId)` and `cleanup`;
  - safe failure codes; a `CONTEXT_TOO_LARGE` failure keeps up to 20 file ids;
  - terminal jobs kept for 1 hour, at most 500, the least recently touched evicted first.
- **The workflow** (`questionnaire-proposals-workflow.ts`):
  - `startQuestionnaireProposals` and `startQuestionRewrite`;
  - `getQuestionnaireProposalJob` and `retryQuestionnaireProposalJob`;
  - `activeQuestionnaireProposalJobs`, `deriveProposalQuestionnaireState`, `projectQuestionnaireProposalJob` and `loadRequestorTextCorpus`;
  - `QuestionnaireProposalWorkflowError` and `QUESTIONNAIRE_PROPOSAL_RUN_LIMIT` (100);
  - `settledQuestionnaireProposalJob`, for the harness only.
- **The lock:** `withQuestionnaireGovernanceLock(strapi, questionnaireDocumentId, work)` is exported. It is `runGovernanceMutation`'s actor-free core: the same tail, then the request row and the questionnaire row in one transaction. `runGovernanceMutation` calls it.
- **The signal (S-2):**
  - `questionnaire-proposals` joins `CONTEXT_WIDE_AI_OPERATIONS`; `question-rewrite` does not.
  - `latestCompletedQuestionnaireContextRun` filters `$in` both operations, because a draft run also names the questionnaire.
  - Both producers pass it: `generationFacts` (which keeps `latestCompletedGenerationRun` for `generation.runId`) and `requestQuestionnaireAiInputs`.
  - The doc comments on the signal module, `loadAiInputsChanged` and `questionnaireAiInputsChanged` say so.
- **The job failure (S-3):** too much included file text fails `CONTEXT_TOO_LARGE` with no run and keeps both file ids in upload order. The job read serves `failureAttachments` by current name, as the generation job does.
- **The recorder (H-1):** `withProviderCallRecorder` counts `proposals()` and `rewrites()`. Every zero-call assertion sits beside a passing run whose count is non-zero in the same recorder.

## Enqueue and execution order

| Step | Start (refused before anything is queued) | Job (fails before any run) |
| --- | --- | --- |
| 1 | closed body `{ instruction? }` (400); human analyst (403) | the questionnaire still exists on the job's request |
| 2 | questionnaire exists (404) | D-06 state (its reason) |
| 3 | requesting analyst: 403 `OWN_REQUEST` | rewrite target: `QUESTION_REMOVED`, `QUESTION_ANSWERED` |
| 4 | D-06 state: `QUESTIONNAIRE_NOT_SUBMITTED`, `ASSESSMENT_DRAFT_IN_PROGRESS`, `ASSESSMENT_STARTED` | `AI_PROPOSAL_RUN_LIMIT` |
| 5 | rewrite target: 404, `QUESTION_REMOVED`, `QUESTION_ANSWERED` | AI data policy (nothing sent) |
| 6 | instruction validator (400 with its reason) | context: `CONTEXT_TOO_LARGE` with the files' ids |
| 7 | Requestor-text guard: 400 `INSTRUCTION_REPEATS_REQUESTOR_TEXT` | run created; provider and adapter outside any lock |
| 8 | 100 completed proposal runs: 409 `AI_PROPOSAL_RUN_LIMIT` | in the lock: re-read state; supersede or lapse; `completeAiRun`; the `ai-proposal` event |
| 9 | AI data policy: 409 with Phase 12's reason | any failure after the run: `failAiRun` with the safe code |
| 10 | governance log has a free slot: 409 `HISTORY_UNAVAILABLE` | |

## Harness helpers for 15-07 to 15-09

All are in `apps/backend/tests/helpers/strapi-http-harness.ts`. The workflow calls run through the mounted (`dist`) module, so they share the instance's registry.

```ts
type ProposalFixtureResponse = { status: number; data?: Record<string, unknown>; reason?: string; message?: string };
type HeldQuestionnaireProposalProvider = { reached: Promise<void>; release: () => void; captured: () => ReadonlyArray<Record<string, unknown>> };

startQuestionnaireProposalsFixture(analystId: string, questionnaireId: string, body?: unknown): Promise<ProposalFixtureResponse>; // 202 + job projection
startQuestionRewriteFixture(analystId: string, questionnaireId: string, questionId: string, body?: unknown): Promise<ProposalFixtureResponse>; // 202
getProposalJobFixture(analystId: string, jobId: string): Promise<ProposalFixtureResponse>; // 200
retryProposalJobFixture(analystId: string, jobId: string): Promise<ProposalFixtureResponse>; // 202
waitForProposalJobFixture(jobId: string): Promise<Record<string, unknown>>; // the registry record once the attempt ended (status, attempt, runId, failure, initiatingAnalystDocumentId)
activeProposalJobsFixture(questionnaireId: string): Promise<Array<Record<string, unknown>>>;
withHeldQuestionnaireProposalProvider<T>(action: (hold: HeldQuestionnaireProposalProvider) => Promise<T>, options?: { capture?: boolean; failWith?: { code: string; message: string } }): Promise<T>;
listQuestionnaireRunsFixture(questionnaireId: string): Promise<Array<Record<string, unknown>>>; // oldest first, initiatedBy/questionnaire/assessmentRequest populated
withProviderCallRecorder<T>(action: (counts: { questionnaire(): number; assessment(): number; proposals(): number; rewrites(): number }) => Promise<T>): Promise<T>;
```

- `analystId` is an IdamBox User documentId (`harness.users.analyst`, `harness.users.secondAnalyst`). The fixtures pass `humanAnalyst: true`.
- A refusal comes back as `{ status, reason?, message }`, never thrown.
- `failWith` throws the hosted providers' `QuestionnaireGenerationJobFailure` after the hold releases. `capture` records each provider input, including `context.userPrompt`.

The workflow functions take `{ strapi, questionnaireId, questionId?, body?, analystDocumentId, humanAnalyst }` for starts and `{ strapi, jobId, analystDocumentId, humanAnalyst }` for reads and retries. Each returns the projection:

```
jobId, questionnaireId, operation, questionId, status, attempt, queuedAt, startedAt, completedAt, runId, failureCode,
failureMessage, failureAttachments?, initiatedBy, initiatedByViewer, canRetry
```

`startedAt`, `completedAt`, `runId`, `failureCode` and `failureMessage` are null until set. Errors throw `QuestionnaireProposalWorkflowError(status, message, reason?)`, which 15-09's controllers map.

## Task Commits

1. **Task 1 (tracer): a questionnaire-wide proposal job end to end**: `8aea586a` (test, RED) and `5a860cc8` (feat, GREEN). Tracer gate: auto mode is off and the verify is automated only. It re-ran green (20/20 across the three files), so expansion continued.
2. **Task 2: rewrites, the state rules, G-1, instructions, the policy, the caps, supersession and lapse**: `d3227e82` (test, RED) and `114f1b21` (feat, GREEN).
3. **Task 3: job read and retry, interrupted runs, completion racing an edit**: `d18f4b2b` (test, RED) and `fd458909` (feat, GREEN).

`git rev-list --count afdb02c8..fd458909` is 6.

How each RED step failed:

- **Task 1:** TS2307, because `src/csrm/ai/proposal-job-registry` did not exist.
- **Task 2:** 12 of 15 integration cases failed. Either `startQuestionRewrite` was not a function, or the refusals and supersession or lapse events were missing (for example, a 202 where `OWN_REQUEST` was expected).
- **Task 3:** 3 of 5 failed, because `getQuestionnaireProposalJob` was not a function. The interrupted-run and no-lost-write cases passed at RED: Task 1 had already built the lock and the failure handling, and these cases pin it.

## Verification

- **Task 1 verify:** `tsc`, `tsc -p tests`, then three files with 20/20 passing:
  - `proposal-job-registry.unit`: 4;
  - `ai-inputs-signal.unit`: 13;
  - `questionnaire-ai-proposals.integration`: 3.
- **Task 2 verify:** `questionnaire-ai-proposals.integration`, 15/15.
- **Task 3 focused:** the three files 37/37 (integration 20, registry 4, signal 13).
- **Task 3 verify, the full Strapi suite** (`pnpm --dir apps/backend test`): 1,583 tests ran, 1,582 passed, 0 failed and 1 was skipped (the POSIX-modes test, skipped on Windows). Exit 0, 1,439 s.
  - It ran with the dev servers stopped, both Keycloak flags false, the classification ceiling empty and the deterministic providers.
  - 13-17's served-signal cases in `questionnaire-workflow.integration.test.ts` and `request-notes.integration.test.ts` pass in it.
- **Question rows:** deep-equal (every row, every answer and `releasedAt`) before and after the tracer job, the rewrites, the lapsed job and the interrupted job.
- **Acceptance criteria:**
  - `withQuestionnaireGovernanceLock` is exported, and `runGovernanceMutation` calls it.
  - `latestCompletedQuestionnaireContextRun` filters `$in` both operations and both controllers call it. `latestCompletedGenerationRun` still filters `questionnaire-generation` only.
  - The test names include `deep-equal`, `AI inputs changed`, `OWN_REQUEST`, `QUESTIONNAIRE_NOT_SUBMITTED`, `INSTRUCTION_REPEATS_REQUESTOR_TEXT`, `AI_PROPOSAL_RUN_LIMIT`, `CONTEXT_TOO_LARGE`, `superseded`, `lapsed`, `retry`, `no lost write` and `failureAttachments`.
  - The workflow calls `parseAnalystInstruction` and `repeatsRequestorText` before `enqueue`. It passes `attachmentDocumentIds` to `ProposalJobFailure`.
- **Not run here:**
  - No web file, specification or catalogue changed, so the web suite, `api:check` and Playwright were not run, as planned.
  - The content-type freeze is empty (`git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'`).
  - No route was added or measured.

## Files Created/Modified

- `proposal-job-registry.ts` (new): the generic registry.
- `questionnaire-proposals-workflow.ts` (new): the starts, execution, completion, job read and retry, the projection and the corpus.
- `questionnaire-governance-workflow.ts`: exports `withQuestionnaireGovernanceLock`; `runGovernanceMutation` calls it.
- `questionnaire-scope.ts`: adds `latestCompletedQuestionnaireContextRun`; `questionnaireAiInputsChanged` takes the baseline run.
- `csrm-questionnaire.ts` and `csrm-assessment-request.ts` (controllers): pass the baseline run.
- `ai-inputs-signal.ts`: `questionnaire-proposals` is context-wide; doc comments updated.
- `assessment-context-loader.ts`: `buildAssessmentContextFor` also returns `steering` and `questionnaireSource`.
- `assessment-context.ts`: exports `REQUEST_FIELDS`.
- Tests:
  - the registry unit file (new);
  - the integration file (new, 20 cases);
  - the signal unit case;
  - the harness helpers.

## Decisions Made

- **Human analyst only, in the service too.** Every start, read and retry needs the policy's `humanAnalyst` fact, so a future route that forgets the grant still fails closed (D-31).
- **"Submitted" is what the Requestor submitted.** The submit stamps only the questions shown, so the state reads the shown active questions, as the plan says. A conditional questionnaire therefore reaches "submitted" after its submission. 15-04's answer-content rule still reads every active question: a hidden, unstamped question withholds answer content. That is the safe direction, and it is recorded here for 15-08.
- **The job re-checks the target, the cap and the policy.** Each can change between the start and the call. A failure there creates no run.
- **The failure shape.** The registry keeps `failure: { code, message, attachmentDocumentIds? }`, the generation registry's shape, so the 14-10 helpers (`failureAttachmentIds`, `failureAttachmentsEntry`) read it unchanged. The projection flattens it.
- **I-4 taken.** The projection carries `initiatedByViewer` from 13-08's `generationJobViewerFacts`, so the card can say "you started this", as the generation card does.
- **A retry checks the AI data policy** before it is queued (Phase 12 IN-104's rule for generation retries).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The context loader returns what the adapter needs**
- **Found during:** Task 1 (GREEN)
- **Issue:** 15-05's adapter needs the context-time rows (stored answers, removed questions), `generatedDate`, and the open and rejected item texts. `buildAssessmentContextFor` read them but returned only `{ context, policy, records }`. A second read could disagree with what the model saw.
- **Fix:** `buildAssessmentContextFor` also returns `steering` and `questionnaireSource` (`QuestionnaireProposalSource`). This is additive; no existing caller changes.
- **Files modified:** `apps/backend/src/csrm/ai/assessment-context-loader.ts` (not in the plan's file list)
- **Committed in:** `5a860cc8`

**2. [Rule 3 - Blocking] The request field table, exported**
- **Found during:** Task 2 (GREEN)
- **Issue:** The guard's corpus reads "the request's text fields from Phase 12's field table", which was module-private.
- **Fix:** `REQUEST_FIELDS` is exported from `assessment-context.ts`, so there is one list and no copy.
- **Committed in:** `114f1b21`

**3. [Rule 3 - Blocking] Harness additions beyond the plan's list, and their timing**
- **Issue:** The helpers need an auth-free way to wait for a job, and Task 3 needs the active jobs.
- **Fix:**
  - `waitForProposalJobFixture` awaits the registry's `settled(jobId)` through a workflow export, `settledQuestionnaireProposalJob`, instead of polling. No route may serve it.
  - `activeProposalJobsFixture` was added.
  - The held helper's `capture` and `failWith`, and the recorder's `proposals()` and `rewrites()`, landed in Task 1's RED commit rather than Task 2's, because the harness type is one change.
- **Committed in:** `8aea586a`, `5a860cc8`

**4. [Rule 3 - Blocking] Test fixtures the written-ahead plan assumed**
- **Issue:** The UAT-A-like questionnaire is not AI-generated, so it has no `generation` block. A Requestor's file upload after submission needs a note (Phase 14's `ATTACHMENT_NOTE_REQUIRED`).
- **Fix:**
  - The signal cases seed one completed `questionnaire-generation` run that included no note, plus the generation facts.
  - The file cases post Jane's note with each file, as 14-10's test does.
- **Committed in:** `8aea586a`, `d3227e82`

---

**Total deviations:** 4 auto-fixed (all blocking)
**Impact on plan:** none on scope. No content type, contract, route or grant changed.

## Identifier differences from the written-ahead plan

- `registry.retry(jobId, analystDocumentId)` throws `ProposalJobRegistryError(404 | 409)`.
- The registry also has `mayRetry(job)` and `settled(jobId)`. Its `execute(job, report)` gets `report.recordRun(runId)`, so a failed attempt still names its run.
- `projectQuestionnaireProposalJob(job, viewerFacts, names)` takes 13-08's `GenerationJobViewerFacts`, which carry `initiatedBy`, instead of a separate initiator name.
- The job holds `input: { requestId, instruction }`, and its failure as `failure`, not flat `failureCode` and `failureMessage`.
- A rewrite's target that is gone when the job runs fails `QUESTION_NOT_FOUND`. The start answers 404 for it.

## Issues Encountered

- Two Task 2 test assertions were wrong at first, and both were fixed before the RED commit:
  - the slot wraps the escaped text in `<instruction>` inside `<analystInstruction>`;
  - a Requestor upload after submission needs her note.
- One Bash heredoc failed to parse. The edit was redone through a scratchpad script.

## Known Stubs

None. The routes and grants that serve these functions are 15-09's, as planned.

## Threat Flags

None. No endpoint, grant or schema changed. The new service functions are reachable only in-process until 15-09 mounts them. T-15-18 to T-15-22 are mitigated as the threat register states, and each has a mounted case.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **15-07 (decisions):**
  - Decide inside `withQuestionnaireGovernanceLock`.
  - Read runs with `parseRunProposalFor` and `parseRunDecisionsFor`, and fold them.
  - A superseded item carries `cause: { kind: "newer-rewrite", runId }` and `by` the newer run's analyst. A lapsed item carries `by: "system"` and `cause: { kind: "questionnaire-frozen" }`. Both are final.
- **15-08:** `latestCompletedQuestionnaireContextRun` is the signal's baseline; keep it there. `deriveProposalQuestionnaireState` is the one D-06 helper the gates and reads can share.
- **15-09 (routes):**
  - Map `QuestionnaireProposalWorkflowError` to HTTP. Pass the policy's `humanAnalyst`.
  - Starts answer 202 with the projection; the read answers 200; a retry answers 202.
  - The job routes need no questionnaire ownership scope: the service decides `OWN_REQUEST` after loading the job.
- **15-10 and 15-11 (cards):** the job projection's `failureAttachments`, `initiatedBy`, `initiatedByViewer` and `canRetry` match the generation job's.
- **Phase 16:** `createProposalJobRegistry` is generic and can be instantiated for risk targets.

## Self-Check: PASSED

- FOUND: `proposal-job-registry.ts`, `questionnaire-proposals-workflow.ts`, `proposal-job-registry.unit.test.ts` and `questionnaire-ai-proposals.integration.test.ts` (`[ -f ]` on each), and every modified file listed.
- FOUND: 8aea586a, 5a860cc8, d3227e82, 114f1b21, d18f4b2b, fd458909. `git rev-list --count afdb02c8..HEAD` is 6 before this summary.
- Acceptance criteria re-run: all pass. Plan verification: the focused files 37/37, the full Strapi suite green, `tsc` clean, the content-type freeze empty.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
