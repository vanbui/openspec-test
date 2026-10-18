---
phase: 15-steerable-questionnaire-ai
plan: 04
subsystem: api
tags: [strapi, ai-run-record, context-builder, context-summary-v4, questionnaire-proposals, question-rewrite, analyst-instruction, prompt-slot, contract, zod, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-01's approved run-record amendment (context summary v4, the two operations, dispatch by operation); 15-02's envelope v1, decision events v2, the fold, isAnsweredValue, SlotInstruction and PLAIN_LANGUAGE_PRESET
  - phase: 12-ai-context-suggestions-and-provenance
    provides: the run record, buildAssessmentContext and its loader, the prompt sections and the run read
  - phase: 13-request-pick-up-and-notes
    provides: marked notes in the context (summary v2) and contextTooLargeMessage
  - phase: 14-request-attachments
    provides: included file text in the context (summary v3) and ATTACHMENT_CONTEXT_BOUNDS
provides:
  - The run record holds questionnaire-proposals and question-rewrite runs, parsing each run's proposal and decisions by its operation (parseRunProposalFor, parseRunDecisionsFor)
  - Context summary v4 (questionnaire and instruction sections) in Strapi, the run read, the specification and the web parser
  - buildQuestionnaireProposalContext and QUESTIONNAIRE_CONTEXT_BOUNDS (the pure questionnaire part, its allowed sets and its summary section)
  - buildAssessmentContextFor for both operations, with the instruction and its source for generation and both operations
  - renderAnalystInstructionSlot(instruction SlotInstruction | null) and ANALYST_INSTRUCTION_TAG
affects: [15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12, 16, 17]
actuals:
  tokens: 25700
  tasks: 3
  commits: 6
plan_head_before: 2e1bc543ec0dbb3d2b74e8d9e274a0c030acd8ba
plan_head_after: 75844745707603cc4f32669240deda8f05a080f5
tech-stack:
  added: []
  patterns:
    - "Dispatch by the run's operation, never by schemaVersion: one function per column chooses the envelope family"
    - "A pure context part returns Phase 12's own section types plus the adapter's allowed sets and its summary section"
    - "Closed summary sections cross-checked against the operation (which sections may be null, which scope, which instruction sources)"
key-files:
  created:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-context.ts
    - apps/backend/tests/questionnaire-proposal-context.unit.test.ts
  modified:
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/csrm/ai/prompt-sections.ts
    - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/ai-run.integration.test.ts
    - apps/backend/tests/assessment-context.integration.test.ts
    - apps/backend/tests/assessment-context.unit.test.ts
    - apps/backend/tests/ai-provider-guardrails.unit.test.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/backend/tests/attachment-ai-input.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
    - apps/csrm/src/features/ai-assistance/test-fixtures.ts
key-decisions:
  - "Context summary version: v4, the number 15-01 recorded. Every context built now writes v4; v1 to v3 read with questionnaire and instruction null."
  - "The v4 parser checks both sections against the operation. questionnaire is set exactly for the two proposal operations, and its scope matches the operation (a rewrite is question-scoped and withheld). instruction is analyst or default-task for generation and proposals, analyst or plain-language-preset for a rewrite, and null for the draft. The two new operations read v4 only."
  - "QUESTIONNAIRE_CONTEXT_BOUNDS (150 active, 200 open, 100 rejected listed, 200 removed) is defined in assessment-context.ts beside the other bounds, and questionnaire-proposal-context.ts re-exports it, so the summary parser and the part read one constant."
  - "Source refs follow the amendment's names and the allowed set: Q{n} for an answered question (never answer.{questionKey}), request.{field}, note-{sequence}, file-{n} and instruction. An answered Qn can be cited only when its answer was sent. instruction can be cited only when an analyst instruction or the preset steered the run."
  - "A rewrite sends no systems or assets (D-14), but the data policy still reads the request's assets, so the classification ceiling applies to it. Its summary lists none, and its classification comes from the policy."
  - "The submitted-batch rule is projectQuestions' rule: every active question holds a submitted envelope. Answer labels are then sent only for visible, valid, answered questions, as the draft context sends them."
  - "Instruction steering is resolved once (resolveInstructionSteering). A rewrite defaults to the preset. A source that disagrees with the instruction throws, and the draft refuses any instruction."
  - "A visibility rule renders as the controller's Qn, the operator code and the value's label (`Q2 equals Yes`), never a key or a stored value."
requirements-completed: []  # QUES-11 and QUES-12 are traced here and delivered by the phase; they are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "Questionnaire proposal runs are stored, completed with the envelope v1 and decided by v2 events, dispatched by operation. The other family's envelope or event is refused and nothing is written. The run read serves both operations, the instruction and both v4 sections; v1 and v3 read with both null."
    requirement: QUES-11
    verification:
      - kind: integration
        ref: "apps/backend/tests/ai-run.integration.test.ts#mounted questionnaire proposal run is stored, completed with its envelope, decided by v2 events and read back"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/ai-run.integration.test.ts#mounted run read serves a v1 or v3 summary with both Phase 15 sections null"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts (the four Phase 15 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pure questionnaire part: Q1…Qn with answered flags, answers by Qn only for a submitted batch, P, X and R lists, the rewrite scope, the allowed sets and bounds, and nothing identifying in the rendered text"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-proposal-context.unit.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The loader for both operations on the UAT-A-like fixture: the request part, systems, assets, Risk Types, the marked note as untrusted data. Answers are included, then withheld once they are drafts. One open and one rejected item are listed, and a damaged run adds nothing. A rewrite has no Risk Type library and no answers."
    requirement: QUES-12
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-context.integration.test.ts (the three Phase 15 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The instruction in its own escaped slot, its source in the summary, the preset, default-task and null. A hostile closing tag stays inert. Requestor text can never open the slot."
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts (the five builder cases)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts (the two slot guards)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every contextTooLargeMessage form that names marked notes carries 'marked as changing the AI inputs', and no other form does (D-29)"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts#every contextTooLargeMessage form that names notes says marked as changing the AI inputs, and no other form does"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,527 tests: 1,526 pass, 0 fail, 1 skipped by platform)"
        status: pass
    human_judgment: false
duration: 75min
completed: 2026-10-11
status: complete
---

# Phase 15 Plan 04: The Run Record and the Questionnaire Proposal Context Summary

**The run record now stores questionnaire proposal and rewrite runs. It parses each run's envelope and decision events by the run's operation, and serves context summary v4 on the run read, the contract and the web parser. The AI context for both operations reads the request, the marked notes and files, and the questionnaire with its answered questions fixed. Answers are sent only for a submitted batch, the proposal history comes from the run fold, and the analyst's instruction (or CSRM's preset) goes only in its own escaped slot.**

Summary version used: **v4** (the number plan 15-01 recorded).

## Performance

- **Duration:** about 75 min, of which the full Strapi suite took about 23 min
- **Started:** 2026-10-11T09:55Z (approximately)
- **Completed:** 2026-10-11T11:12Z
- **Tasks:** 3 of 3 (Task 1 the tracer)
- **Files:** 21 changed (2 created), 1,214 insertions and 81 deletions

## Accomplishments

- **The run record** (`ai-run-record.ts`):
  - `AI_RUN_OPERATIONS` and `AiRunOperation` gain `questionnaire-proposals` and `question-rewrite`. Both attachment bounds are 30,000 (X-1).
  - `parseRunProposalFor` and `parseRunDecisionsFor` dispatch by operation, never by `schemaVersion`. A questionnaire envelope must name its own run's operation.
  - `completeAiRun` and `appendAiRunDecisions` check against the stored run's operation. Either family on the other's run is refused with `AiRunRecordError` and writes nothing.
  - `parseContextSummary` reads v4 closed and projects v1 to v3 with both new sections null.
- **The run read contract:**
  - `AiRun.operation` and `AiRunContextSummary.operation` list four operations, and `schemaVersion` lists 1 to 4.
  - New components: `AiRunContextQuestionnaire` and `AiRunContextInstruction`, both with `additionalProperties: false`. `AiRunContextAttachments.bound` is unchanged.
  - The generated client is regenerated. The web's shared `operationSchema` and summary parser are widened.
- **The questionnaire part** (`questionnaire-proposal-context.ts`, pure, no Strapi import):
  - It renders Phase 12's section types: Q1…Qn, P1… (already proposed), X1… (rejected by the analyst, the 100 most recent first) and R1… (removed by the analyst), plus an `answers` section by Qn.
  - It returns the allowed sets (`questionDocumentIds`, `sourceRefs`, `refs`, `answeredRefs`, `removedDocumentIds`, `controllerChoiceLabels`) and the summary section.
  - More than 150 active questions, 200 open items or 200 removed questions is `CONTEXT_TOO_LARGE`.
- **The builder:**
  - New inputs: `instruction`, `instructionSource` and `questionnaire` (X-2). The part's allowed sets come back on `context.questionnaire`.
  - A rewrite offers no Risk Type library, and every operation writes v4.
  - New exports: `contextSourceRefs(records)` and `resolveInstructionSteering`.
- **The loader:**
  - `questionnaireContextQuestions` reads the answered flags with `isAnsweredValue`, and answer content under the submitted-batch rule.
  - `loadQuestionnaireProposalHistory` reads at most 101 completed runs of both operations, parses and folds each, and skips a damaged run.
  - `buildAssessmentContextFor` accepts `targetQuestionId`, `instruction` and `instructionSource`, and passes generation's instruction through the same path (D-12).
- **The slot:** `renderAnalystInstructionSlot(instruction: SlotInstruction | null)` keeps its shipped output around the new `ANALYST_INSTRUCTION_TAG`.

## Task Commits

1. **Task 1 (tracer): a questionnaire proposal run end to end at the record and read layers**: `f2596223` (test, RED) and `e7bc7108` (feat, GREEN). Tracer gate: auto mode is off and the verify is automated only. Its parts were run after GREEN (`tsc`, `ai-run.integration` 8/8, `api:check`, the web files 363/363, typecheck), all green, so expansion continued.
2. **Task 2: the questionnaire part**: `4223d9d4` (test, RED) and `33f25d4e` (feat, GREEN).
3. **Task 3: the builder's inputs, the loader and the slot**: `6da8ba83` (test, RED) and `75844745` (feat, GREEN).

`git rev-list --count 2e1bc543..75844745` is 6.

How each RED step failed:

- **Task 1:**
  - The web cases failed on their assertions (5 of 14).
  - The Strapi test build failed with TS2322 and TS2345: the operation and the widened fixtures did not exist yet.
- **Task 2:** TS2307. The module did not exist.
- **Task 3:**
  - The test build failed with TS2339 and TS2353, because the builder took no instruction or questionnaire part, and the loader took no `targetQuestionId`.
  - The slot guards and the notes-phrase assertion pass on the shipped code. They are kept as regression guards, as the plan says.

## Verification

- **Task 1 verify:** `tsc` and `tsc -p tests` are clean. `ai-run.integration` passed 8/8 and `api:check` exits 0. The web files passed 363/363 (`ai-assistance` and `contract-response-parity`). Typecheck is clean.
- **Task 2 verify:** `questionnaire-proposal-context.unit` passed 7/7.
- **Task 3 focused:** these seven files passed 94/94 together:
  - `assessment-context.unit`
  - `ai-provider-guardrails.unit`
  - `ai-provenance.unit`
  - `ai-inputs-signal.unit`
  - `questionnaire-proposal-context.unit`
  - `assessment-context.integration`
  - `ai-run.integration`
- **Task 3 verify, the full Strapi suite** (`pnpm --dir apps/backend test`): 1,527 tests ran, 1,526 passed, 0 failed and 1 was skipped (the POSIX-modes test, skipped on Windows). Exit 0, 1,394 s. It ran with the dev servers stopped, both Keycloak flags false and the classification ceiling empty.
- **Full web unit suite** (`pnpm --dir apps/csrm test`, before the last code commit): 214 files, 5,082 tests, all pass, 63 s.
- **Web checks:** lint and typecheck are clean. `api:check` exits 0, and `git update-index --refresh` leaves `schema.d.ts` clean.
- **Acceptance criteria:**
  - `parseRunProposalFor` and `parseRunDecisionsFor` are exported. Both operations are in `AI_RUN_OPERATIONS`, and both attachment bounds are 30,000.
  - The spec enums list four operations and versions 1 to 4. Bound `[30000, 60000]` is unchanged. Both new components are closed.
  - The fixtures accept both families.
  - `questionnaire-proposal-context.ts` imports nothing from `@strapi`.
  - There are cases named with `withheld` and `rewrite`. The slot file names `SlotInstruction` and `promptDataTag("instruction"`. The builder's summary is `ContextSummaryV4`. The loader calls `buildQuestionnaireProposalContext(`.
  - There is a unit case named with `marked as changing the AI inputs`.
- **Not run here:**
  - Playwright and route budgets are not part of this plan.
  - The content-type freeze is empty (`git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'`).
  - No catalogue or served-operations file changed.

## Files Created/Modified

- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-context.ts` (new): the questionnaire part, its allowed sets, bounds and summary section.
- `apps/backend/src/csrm/ai/assessment-context.ts`:
  - the operations, `ContextSummaryV4` and `ContextSummaryRead`, and `QUESTIONNAIRE_CONTEXT_BOUNDS`;
  - the builder's inputs, `contextSourceRefs` and `resolveInstructionSteering`.
- `apps/backend/src/csrm/ai/assessment-context-loader.ts`: `questionnaireContextQuestions`, `loadQuestionnaireProposalHistory`, and the part and steering in `buildAssessmentContextFor`.
- `apps/backend/src/csrm/ai/prompt-sections.ts`: the narrowed slot and `ANALYST_INSTRUCTION_TAG`.
- `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts`: the operations, the v4 parser, the per-operation parsers, and the completion and append checks.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the run read.
- `apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts`: `operationSchema` and the v4 sections.
- Tests: the new unit file, the harness, and the files listed under the deviations.

## Decisions Made

The frontmatter's key decisions, with their reasons:

- **The parser checks the sections against the operation.** A stored summary is a fail-safe record. A questionnaire section on a generation run, or a preset source on a proposals run, would mean the summary and the run disagree, so it reads as damaged (null).
- **One bounds constant.** `QUESTIONNAIRE_CONTEXT_BOUNDS` lives beside `CONTEXT_BOUNDS` and `ATTACHMENT_CONTEXT_BOUNDS`. The summary parser and the part then read one value, and the part module re-exports it as the plan names it.
- **Source refs: `Q{n}`, as the amendment names them** (the carry-forward note). Phase 12's `answer.{questionKey}` would put a question key in model-facing ids, which Phase 12 D-04 forbids for this context. A withheld answer is not citable, because the model never saw it.
- **The rewrite and the data policy.** D-14 does not list systems or assets for a rewrite, so none are sent. The policy still evaluates the request's assets, so a rewrite cannot slip under the classification ceiling (D-30).
- **The over-255 fallback of `contextTooLargeMessage`.** Its text carries the phrase, but no list of safe-integer sequences reaches it: one run plus "and {n} more" always fits within 255 characters. The new assertion therefore covers every reachable notes form, with 0, 1 and 3 files, and the three forms that name no notes. `contextTooLargeMessage` is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Six test files outside the plan's list pinned summary v3 or built legacy summaries from the builder's output**
- **Found during:** Task 3 (RED). These were found by grep before GREEN, then confirmed by the full suite.
- **Issue:** each file failed once the builder wrote v4 for every operation.
  - `ai-provenance.unit`, `assessment-workflow.integration` and `questionnaire-generation.integration` asserted v3.
  - `ai-inputs-signal.unit` and `attachment-ai-input.integration` built v1 or v2 summaries that kept the two new keys.
  - In `ai-provenance.unit`, the envelope test listed `schemaVersion: 4` as an unknown version.
- **Fix:**
  - The pinned versions now read 4.
  - The legacy constructions strip `questionnaire` and `instruction`.
  - The unknown-version case reads 5, and a v3 that keeps the v4 keys is refused.
- **Committed in:** `6da8ba83` and `75844745`

**2. [Rule 3 - Blocking] The web fixture and the v4-as-unknown case**
- **Found during:** Task 1 (RED)
- **Issue:**
  - `apps/csrm/src/features/ai-assistance/test-fixtures.ts`, not in the plan's list, needed the two null sections every served summary now has.
  - The service test treated `schemaVersion: 4` as unknown.
- **Fix:** the fixture gains `questionnaire: null` and `instruction: null`. The unknown version reads 5.
- **Committed in:** `f2596223`

**3. [Rule 1 - Bug in a new test] An answer's words also appear in the request description**
- **Found during:** Task 3 (GREEN)
- **Issue:** the UAT-A-like request description reads "Unsigned payment files could be altered.". The new "no answer sent" checks searched for "Unsigned payment files", so they failed even though no answer was sent.
- **Fix:** those checks now look for the answer values (`<value>Unsigned payment files</value>`, `.answer</field>`, "Partial segregation of duties").
- **Committed in:** `75844745`

**4. [Rule 3 - Blocking] Task 1's unsupported-operation arm**
- **Issue:** no switch became non-exhaustive, so there was no arm to add.
- **Fix:** the loader refused the two operations with a plain `Error` until Task 3, which replaced the refusal.
- **Committed in:** `e7bc7108`, removed in `75844745`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug in a new test)
**Impact on plan:** none on scope. Each change keeps an existing pin true to the v4 builder.

## Issues Encountered

- After `api:generate`, the index already held the regenerated `schema.d.ts`. The working tree had not been staged by hand. The content was the intended contract change, so it was committed with the contract in `e7bc7108`. Afterwards `api:check` and `git update-index --refresh` were clean.

## Known Stubs

None. The questionnaire part has no caller beyond the loader yet. The proposal job (15-06, 15-09) calls `buildAssessmentContextFor` with the two operations, as planned.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **15-05 (the adapter):**
  - Read `context.questionnaire` (the allowed sets) and `parseQuestionnaireProposal(envelope, { questionDocumentIds, sourceRefs })`.
  - `refs` maps `Qn` to a documentId. `answeredRefs` drives `answered-target`. `removedDocumentIds` drives `removed-target`. `controllerChoiceLabels` checks a visibility value.
  - Its system instructions must name the ids the model may cite: `Q{n}`, `request.{field}`, `note-{n}` (the `note.sequence` value), `file-{n}` (the attachment block's `n`) and `instruction`.
- **15-06 and 15-09 (the jobs):**
  - Call `buildAssessmentContextFor(strapi, { operation, requestId, questionnaireId, targetQuestionId?, instruction, instructionSource? })`.
  - A rewrite with no instruction defaults to `PLAIN_LANGUAGE_PRESET`.
  - The loader reads at most 101 completed runs. The run-limit refusal belongs to the jobs.
- **15-08:** wire generation's instruction into `buildAssessmentContextFor`, which already accepts it. `CONTEXT_WIDE_AI_OPERATIONS` is unchanged here. The signal baseline (item 6 of the amendment) is 15-08's.
- **15-10:** the notes-phrase rule is pinned, so the job cards can recognise a notes-caused refusal by the phrase alone.

## Self-Check: PASSED

- FOUND: `questionnaire-proposal-context.ts` and `questionnaire-proposal-context.unit.test.ts`, and every modified file listed.
- FOUND: f2596223, e7bc7108, 4223d9d4, 33f25d4e, 6da8ba83 and 75844745. `git rev-list --count 2e1bc543..HEAD` is 6 before this summary.
- Acceptance criteria re-run: all pass. Plan verification: the record, context, guardrail and web parser tests, `api:check`, both full suites.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-11*
