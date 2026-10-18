# Phase 15: Steerable questionnaire AI - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 44 (new and modified, from 15-CONTEXT D-01 to D-37 and 15-RESEARCH "Recommended project structure", §R and "Plan grouping")
**Analogs found:** 40 / 44 (4 are seams into Phase 12 or 13 modules that do not exist yet; their analog is the planned module, cited by plan)

**Written ahead.** Today's code is `72a59b8` (`post-demo`). Phases 10 to 14 execute first. Every file an earlier phase changes is marked **[Prior: plan]**, and the Phase 15 planner builds on that planned state, not today's lines. Phase 12 plans are under revision and Phase 13 plans are being written: re-check every **[Prior]** marker at Stage 3. Phase 14 has no plans yet (CONTEXT and UI-SPEC only); its seam is the opted-in file text through Phase 12 D-08's extension point. Line numbers below are today's and will move once 10 and 12 land.

## File Classification

### Strapi: new pure modules (wave 1 to 3)

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `apps/backend/src/csrm/ai/analyst-instruction.ts` | utility (validator) | transform | `questionnaire-governance-log.ts` `boundedString`/`exactKeys` (lines 69-95); `apps/csrm/src/lib/schemas/revert-reason` (500-char reason) | role-match |
| `apps/backend/src/csrm/ai/text-similarity.ts` | utility | transform | Phase 12 `apps/backend/src/csrm/ai/library-ranking.ts` **[Prior: 12-03]** | role-match (planned) |
| `apps/backend/src/csrm/ai/proposal-items.ts` | utility (fold, decision event parser) | event-driven fold | `questionnaire-governance-log.ts` parse/append (lines 104-150) + Phase 12 run `decisions` envelope **[Prior: 12-04 `ai-run-record.ts`, 12-11 `ai-proposal-decisions.ts`]** | role-match |
| `apps/backend/src/csrm/ai/proposal-job-registry.ts` | service (in-process registry) | event-driven | `questionnaire-generation-registry.ts` (whole file, 34 lines) **[Prior: 10-11, 10-13, 12-05]** | exact |
| `.../csrm-questionnaire/services/questionnaire-answer-preservation.ts` | utility | transform | `questionnaire-scope.ts` `hasValue` (lines 148-151); `questionnaire-governance-workflow.ts` `editQuestionnaireQuestion` retained-answer logic (lines 389-395 of the file, `isQuestionnaireValueValid`) | role-match |
| `.../services/questionnaire-placement.ts` | utility | transform | `questionnaire-governance-workflow.ts` `questionKeyFromText` (lines 402-409 of the file) | exact |
| `.../services/questionnaire-proposal-envelope.ts` | model (closed parsers) | transform | `questionnaire-governance-log.ts` `parseGovernanceEvent` | exact |
| `.../services/questionnaire-proposal-context.ts` | service (context part) | transform | Phase 12 `src/csrm/ai/assessment-context.ts`, `prompt-sections.ts` **[Prior: 12-03]** | role-match (planned) |
| `.../services/questionnaire-proposal-adapter.ts` | utility (wire to internal) | transform | `openai-compatible-questionnaire-generation-provider.ts` `toQuestionnaireGenerationProposal` (lines 55+) | exact |
| `.../services/deterministic-questionnaire-proposal-provider.ts` | service (provider) | request-response | `deterministic-questionnaire-generation-provider.ts` (15 lines) **[Prior: 12-05]** | exact |
| `.../services/openai-compatible-questionnaire-proposal-provider.ts` | service (provider) | request-response | `openai-compatible-questionnaire-generation-provider.ts` **[Prior: 12-03, 12-05]** | exact |

### Strapi: new workflows (wave 4 to 5)

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `.../services/questionnaire-proposals-workflow.ts` | service (start, rewrite, job, execute, complete) | event-driven job + CRUD | `questionnaire-generation-workflow.ts` (`registry`, `generateQuestionnaire`, `job`, `persistGeneratedQuestionnaire`) **[Prior: 10-06, 10-09, 10-11..14, 12-05, 12-07, 12-12, 12-16, 12-17]** | exact |
| `.../services/questionnaire-proposal-decisions.ts` | service (batch decisions, apply, Undo) | CRUD in one transaction | `questionnaire-governance-workflow.ts` add/edit/delete (lines 449-574 today) + Phase 12 `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts` **[Prior: 12-11]** | exact |
| `.../services/questionnaire-proposal-gates.ts` | service (gate reads) | request-response | `questionnaire-generation-workflow.ts` `hasQuestionnaireAnswerEvidence` + registry `hasActiveJob` | role-match |

### Strapi: modified hot files

| Modified file | Change | Prior owners |
|---|---|---|
| `.../services/questionnaire-governance-workflow.ts` | export `withQuestionnaireGovernanceLock` (actor-free core of `runGovernanceMutation`); D-08 gate in `releaseQuestionnaire`; question events carry run/item source; `question-restored` writer | **[Prior: 10-01, 10-05, 10-06, 10-09, 10-10, 10-11, 12-16]** |
| `.../services/questionnaire-governance-log.ts` | kinds `ai-proposal`, `question-restored`; AI source keys; Requestor projection drops them | **[Prior: 10-10, 10-11, 12-04, 12-08, 13-03, 13-05]** |
| `.../services/questionnaire-generation-workflow.ts` | `instruction?` (D-12); D-09 refusals at enqueue and in the locked transaction | **[Prior: 10-06, 10-09, 10-11..10-14, 12-05, 12-07, 12-12, 12-16, 12-17]** |
| `.../services/questionnaire-generation-registry.ts` | carries the instruction on the job record (or generalised by `proposal-job-registry.ts`) | **[Prior: 10-11, 10-13, 12-05]** |
| `.../services/questionnaire-workflow.ts` | D-25 in-transaction `releasedAt` re-check in `saveAnswers`/`submitQuestionnaire` | **[Prior: 10-05, 10-06, 12-06]** |
| `.../services/questionnaire-scope.ts` | analyst `answered` flag (D-30), `openProposals` on the `generation` block, `aiOrigin` confirmed/edited | **[Prior: 10-09, 10-10, 10-11, 12-08, 12-09]** |
| `.../csrm-questionnaire/controllers/csrm-questionnaire.ts` | six handlers | **[Prior: 10-06, 10-10, 10-11, 10-13, 12-07, 12-08]** |
| `.../csrm-questionnaire/routes/csrm-questionnaire.ts` | six routes | **[Prior: 10-13]** |
| `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts` | D-08 draft-generation gate | **[Prior: 10-13, 10-15, 10-17, 10-18, 12-02..12-04, 12-06, 12-07, 12-09, 12-11, 12-14, 13-03..13-06]** |
| `conflict-reasons.ts` (created by Phase 10) | new closed reasons (D-03 item 9) | **[Prior: 10-06, 10-07, 12-02, 12-03, 12-07, 12-11, 13-03, 13-05, 13-06]** (does not exist today) |
| `apps/backend/src/policies/csrm-authorization.ts` | `HUMAN_ANALYST_ONLY_OPERATIONS` gains six URLs; G-1 `OWN_REQUEST` | **[Prior: 10-13, 12-10, 12-11, 13-03, 13-05, 13-06]** |
| `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts`, `operations.ts` | `AI_RUN_OPERATIONS` + two; context summary questionnaire section | **[Prior: 12-04, 12-10]** (does not exist today) |
| both catalogue copies, `docs/references/specification.json`, `served-operations.json`, `apps/backend/tests/authorization-matrix.integration.test.ts` | five Functions, six operations, matrix rows | **[Prior: 10-13, 12-10, 12-11, 13-03..13-06]** |
| `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` | dated amendment | **[Prior: 12-01 creates]** |
| `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` | dated amendment | **[Prior: Phase 10 amendment, 10-01]** |

### Web

| File | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `apps/csrm/src/features/questionnaire-ai/questionnaire-ai-schema.ts` (new) | model (closed zod parsers) | request-response | `features/questionnaires/questionnaire-schema.ts`; `features/ai-assistance/ai-assistance-schema.ts` **[Prior: 12-10, 12-11]** | exact |
| `.../questionnaire-ai/questionnaire-ai-service.ts` (new) | service (typed API layer) | request-response | `features/questionnaires/questionnaire-service.ts` (lines 331-343, parity list 389-394) | exact |
| `.../questionnaire-ai/questionnaire-ai-actions.ts` (new) | Server Actions | request-response | `features/questionnaires/questionnaire-actions.ts` (lines 1-40, 126-151); batch: `ai-assistance-actions.ts` **[Prior: 12-10, 12-11, 12-15]** | exact |
| `.../questionnaire-ai/questionnaire-ai-domain.ts` (new, zod-free) | utility | transform | `features/questionnaires/questionnaire-domain.ts`; `ai-assistance-domain.ts` **[Prior: 12-12..12-16]** | exact |
| `.../questionnaire-ai/*panel*.tsx`, item card, instruction field, rewrite control (new) | component | event-driven (optimistic) | `features/questionnaires/questionnaire-governance.tsx`; `ai-assistance/ai-review-bar.tsx`, `use-ai-decisions.ts` **[Prior: 12-14, 12-15]** | role-match |
| `apps/csrm/src/features/ai-assistance/field-comparison{,-domain}.tsx/ts` (new, shared with 16) | component | transform | `ai-assistance/ai-field-marker.tsx` **[Prior: 12-14]** | partial |
| `ai-assistance/ai-run-sheet.tsx` (Instruction group) | component | read | itself **[Prior: 12-13]** | modify |
| `features/questionnaires/questionnaire-service.ts`, `questionnaire-schema.ts`, `questionnaire-actions.ts`, `questionnaire-review.tsx`, `questionnaire-governance.tsx`, `questionnaire-revision-timeline.tsx` | modify | — | itself | **[Prior: service 10-08..10-12, 12-08, 12-15, 12-16; schema 10-05, 12-08, 12-13, 12-16; actions 10-02, 10-07..10-09, 12-16; review 10-02, 10-05, 10-09, 12-13, 12-16; governance 10-02, 10-09, 12-16; timeline 10-01, 10-02, 10-05, 10-10, 10-11]** |
| `features/assessments/questionnaire-generation-job.tsx`, `assessment-detail.tsx` (hub: instruction on Generate/Replace, open count) | modify | — | itself | **[Prior: job 10-12, 10-14, 12-12; detail 10-02, 10-04, 10-12, 10-14, 10-21, 12-12..12-15]** |
| `refusal-copy.ts` (created by Phase 10) | modify | — | itself | **[Prior: 10-07, 12-07, 12-11, 12-12, 12-14, 13-04..13-06]** |
| `features/contract-response-parity.test.ts`, `contract-operation-chain.test.ts`, `lib/performance/zod-client-boundary.test.ts` | test guards | — | themselves | register new parsers |

### Tests

| File | Analog |
|---|---|
| `apps/backend/tests/analyst-instruction.unit.test.ts`, `proposal-items.unit.test.ts`, `questionnaire-proposal-*.unit.test.ts` | `apps/backend/tests/questionnaire-governance.unit.test.ts`, `ai-provider-questionnaire.unit.test.ts` |
| `apps/backend/tests/questionnaire-proposals.integration.test.ts`, `questionnaire-proposal-decisions.integration.test.ts` | `questionnaire-governance.integration.test.ts`, `questionnaire-generation.integration.test.ts`; Phase 12 `ai-proposal-decisions.integration.test.ts` **[Prior: 12-11, 12-14]**; fake server `tests/helpers/fake-openai-compatible-server.ts` **[Prior: 12-01..12-17]** |
| `apps/csrm/e2e/questionnaire-ai-proposals.spec.ts` (new) | `apps/csrm/e2e/questionnaire-governance-workflow.spec.ts`; `ai-context-provenance.spec.ts` **[Prior: 12-17]** |
| `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts` (changed) | itself **[Prior: 10-09, 10-12, 10-14, 12-05, 12-12, 12-16, 12-17]** |

## Pattern Assignments

### `proposal-job-registry.ts` and `questionnaire-proposals-workflow.ts`

**Analog:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` (lines 3-11, 13-34) and `questionnaire-generation-workflow.ts`.

Job record, errors and safe failure (registry lines 3-12):
```ts
export type QuestionnaireGenerationJobStatus = "queued" | "running" | "completed" | "failed";
export class QuestionnaireGenerationRegistryError extends Error { constructor(public readonly status: 400 | 403 | 404 | 409, message: string) { super(message); } }
export class QuestionnaireGenerationJobFailure extends Error { constructor(public readonly code: string, public readonly safeMessage: string) { super(safeMessage); } }
const safeFailure = (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) && nonBlank(error.safeMessage) ? { code: error.code, message: error.safeMessage } : { code: "QUESTIONNAIRE_GENERATION_FAILED", message: "Questionnaire generation failed safely." };
```
Single flight: `enqueue` returns the active job when `activeByRequest.get(key)` exists; key it by questionnaire for `questionnaire-proposals` and by `questionnaireId:questionId` for `question-rewrite` (D-16). `retry` requires `status === "failed"` and no active job; D-16 changes attribution so the retrying analyst becomes the initiator and a new run is created (today `authorize` limits reads to the initiator unless `canReadAllQuestionnaireGenerationJobs`; Phase 13 D-18 widens that, check 13's plans). `hasActiveJob(key)` feeds the D-08 gate.

Per-Strapi registry and provider selection (workflow lines 36-37 of the file, shown at 12-13 above):
```ts
const registryByStrapi = new WeakMap<object, ReturnType<typeof createQuestionnaireGenerationRegistry>>();
const activeQuestionnaireGenerationProvider = CSRM_AI_PROVIDER_MODE === "openai-compatible" ? openaiCompatibleQuestionnaireGenerationProvider : deterministicQuestionnaireGenerationProvider;
```
Provider call outside the lock, then one transaction with a `forUpdate` row lock (workflow `persistGeneratedQuestionnaire`): copy the shape, but take the lock through the new `withQuestionnaireGovernanceLock` (below), and complete the Phase 12 run there (`createRunningAiRun`/`completeAiRun`, **[Prior: 12-04, 12-05]**). Job projection must be closed (comment at workflow lines 63-90: "Project a bounded questionnaire rather than handing back the raw document").

### `questionnaire-governance-workflow.ts` lock export (modify)

**Analog:** itself, lines 150-190 today.
```ts
async function runGovernanceMutation<T>(input: GovernanceWorkflowInput, work: () => Promise<T>): Promise<T> {
  assertAnalystGovernanceActor(input);
  ...
  return serializeGovernanceMutation(input.questionnaireDocumentId, () =>
    input.strapi.db.transaction(async ({ trx }) => {
      await lockQuestionnaire(input.strapi, input.questionnaireDocumentId, trx);
      return work();
    }));
}
```
Export the actor-free core as `withQuestionnaireGovernanceLock(strapi, id, work)` (15-RESEARCH "Governance lock export"). Release gate: add the D-08 `AI_PROPOSALS_OPEN` check inside `releaseQuestionnaire` after `assertReleasable` (lines 177-200 today), reading `questionnaire-proposal-gates.ts`.

### `questionnaire-proposal-decisions.ts`

**Analog:** `questionnaire-governance-workflow.ts` add/edit/delete (today lines 449-574) and Phase 12's `ai-proposal-decisions.ts` [12-11] for the batch, all-or-nothing and the "no longer open" code.

Apply an addition (copy from `addQuestionnaireQuestion`):
```ts
const definition = parseQuestionnaireDefinition(questionnaire.questions);
const question: QuestionnaireDefinitionQuestion = { documentId: `new-${key}`, questionText, answerType, questionKey: key, section, order, required, ...(visibility ? { visibility } : {}), ...(choices ? { choices } : {}), schemaVersion: 2, answer: null };
try { validateDefinition([...definition, question]); } catch (error) { return governanceConflict(error); }
await create({ data: { questionText, helpText: payload.helpText ?? null, answerType, options: questionOptions(question), answer: null, questionnaire: input.questionnaireDocumentId } });
const governanceLog = appendQuestionEvent(questionnaire, "question-added", question.questionKey, input);
await input.strapi.documents(QUESTIONNAIRE_UID).update({ documentId: input.questionnaireDocumentId, data: { governanceLog } });
```
Change: `candidateQuestion` + `validateDefinition` (edit path); never reach the `answer-cleared` branch (D-05: the preservation predicate refuses first). Removal: soft removal `{ ...question, schemaVersion: 2, deleted: { deletedAt, deletedBy } }` with the dependency and last-question refusals (delete path). `candidateQuestion`, `validateDefinition`, `questionOptions`, `appendQuestionEvent`, `questionByDocumentId` and `governanceConflict` are module-private today: export them (or move to a shared module) in the plan that owns this hot file. `appendQuestionEvent` gains the run/item/edited source keys (D-26). Edit-then-confirm edits go through `parseQuestionMutationPayload(input, "edit")` (line 70).

### `questionnaire-placement.ts`

**Analog:** `questionKeyFromText` (governance workflow):
```ts
const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "question";
const existing = new Set(definition.map((question) => question.questionKey));
for (let suffix = 1; ; suffix += 1) { const candidate = suffix === 1 ? base : `${base}-${suffix}`; if (!existing.has(candidate)) return candidate; }
```
Extend: the `existing` set also includes keys allocated earlier in the batch (D-22, Phase 12 D-18's allocator seam; check whether 12-05/12-16 already generalise it). `definition` includes removed questions, so removed keys are never reused.

### `questionnaire-answer-preservation.ts`

**Analog:** `questionnaire-scope.ts` lines 144-151 (the progress rule D-05 must match):
```ts
function answerValue(answer: unknown): unknown { return isRecord(answer) ? answer.value : null; }
function hasValue(answer: unknown): boolean {
  const value = answerValue(answer);
  return value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}
```
Export one `isAnsweredValue` and have `questionnaire-scope.ts` use it (one rule, D-05). Validity: `isQuestionnaireValueValid(stored, parsedAnswer.value)` and `parseAnswerEnvelope`, as `editQuestionnaireQuestion` does. Do not reuse `hasQuestionnaireAnswerEvidence` (generation workflow): it counts a stateful empty envelope as evidence, which is the replacement rule, not D-05's.

### `questionnaire-proposal-envelope.ts`, `proposal-items.ts` and the governance log amendment

**Analog:** `questionnaire-governance-log.ts` (lines 23-56, 104-150):
```ts
export const GOVERNANCE_EVENT_KINDS = Object.freeze(["released","returned-to-review","question-added","question-edited","question-deleted","answer-cleared"] as const);
export function parseGovernanceEvent(value: unknown): GovernanceEvent {
  if (!isRecord(value)) throw new GovernanceLogError();
  exactKeys(value, GOVERNANCE_EVENT_KEYS);
  if (value.schemaVersion !== GOVERNANCE_LOG_SCHEMA_VERSION) throw new GovernanceLogError();
  ...
  return Object.freeze({ ... });
}
export function appendGovernanceEvent(existing: unknown, event: unknown): GovernanceEvent[] { ... if (current.length + 1 > GOVERNANCE_LOG_MAX_ENTRIES) throw new GovernanceLogError(); return [...current, appended]; }
```
Closed keys, frozen results, versioned envelope, single writer. Fail-safe direction for the open-item fold (D-20): mirror `summariseGovernanceLog`'s "a malformed stored log summarises as empty; it never throws out of a read path". Instruction snapshot bound reuses `MAX_REASON_LENGTH = 500` (Pitfall 12: one constant shared with `analyst-instruction.ts`). Note: Phase 10 [10-10, 10-11] and 12/13 [12-04, 12-08, 13-03, 13-05] change this file's kinds and keys first; add to their list.

### Providers and adapter

**Analog:** `openai-compatible-questionnaire-generation-provider.ts`:
```ts
function userPrompt(context: QuestionnaireGenerationContext): string {
  return ["title", "description", ...].map((key) => promptDataTag(key, promptValue(context[key as keyof QuestionnaireGenerationContext]))).join("\n");
}
// Builds the stored definition from the model's wire shape. Keys and orders are assigned here ...
export function toQuestionnaireGenerationProposal(raw: unknown): unknown {
  if (!isRecord(raw) || !hasExactKeys(raw, PROPOSAL_KEYS) ...
```
The adapter copies this "wire to server-owned values, closed parser after" split; `<analystInstruction>` is a second `promptDataTag` slot (Phase 12 D-05, **[Prior: 12-03 `prompt-sections.ts`]**). Deterministic provider: same interface as `deterministic-questionnaire-generation-provider.ts`; mode chosen by `CSRM_AI_PROVIDER_MODE`.

### `questionnaire-workflow.ts` D-25 re-check (modify)

**Analog:** itself, `saveAnswers`/`submitQuestionnaire` (lines 305-339) run inside `runQuestionnaireMutation` (row lock, line 205). Add the `releasedAt` check right after `loadWorkflow` in both, throwing `QuestionnaireWorkflowError(409, ...)` mapped to `QUESTIONNAIRE_NOT_ANSWERABLE` (Phase 10's reason). The policy pre-check stays (`csrm-authorization.ts` line 383: `if (config.requireQuestionnaireReleasedForRequestor && !isReleased(questionnaire))`). Pitfall 11: existing tests that save to unreleased questionnaires must be fixed in the same plan.

### Routes, policy and catalogue

**Analog:** `routes/csrm-questionnaire.ts` lines 61-78:
```ts
{ method: "POST", path: "/v1/assessment_requests/:requestId/generate_questionnaire",
  handler: "api::csrm-questionnaire.csrm-questionnaire.generateQuestionnaire",
  config: { policies: generationPolicies(CSRM_QUESTIONNAIRE_OPERATIONS.generate, true) } },
{ method: "GET", path: "/v1/questionnaire_generation_jobs/:jobId", ... getGenerationJob ... },
{ method: "POST", path: "/v1/questionnaire_generation_jobs/:jobId/retry", ... retryGenerationJob ... },
```
`csrm-authorization.ts` lines 41-49: append the six `METHOD:/api/v1/...` strings to `HUMAN_ANALYST_ONLY_OPERATIONS`. Catalogue Function pattern (15-RESEARCH §R): `"id": "function.questionnaire_generation.generate_api"`, `"description": "Human analyst-only generation grant. This API-only Function intentionally has no menuPath."`, `"roleIds": ["role.security_analyst"]`; both copies byte-identical.

### Web service, schema and actions

**Analog:** `apps/csrm/src/features/questionnaires/questionnaire-service.ts` lines 331-343:
```ts
export async function returnQuestionnaireToAnalystReview(documentId: string, reason: string): Promise<TransportResult<QuestionnaireGovernanceResult>> {
  return read((client) => client.POST('/v1/questionnaires/{questionnaireId}/return_to_review', { params: { path: { questionnaireId: documentIdSchema.parse(documentId) } }, body: { reason: revertReasonSchema.parse(reason) } }), parseGovernance);
}
```
and the parity registration list (lines 389-394): `{ label: 'releaseQuestionnaire', component: 'QuestionnaireReleaseResponse', parser: releaseResponseSchema }`. Every new parser gets a row there and in `contract-response-parity.test.ts`.

**Actions analog:** `questionnaire-actions.ts` lines 1-40 (`'use server'`, `revalidatePath`, strict zod input like `governanceDocumentSchema = z.object({ documentId: z.string().trim().min(1).max(255) }).strict()`), wrappers at lines 126-151. The edit-then-confirm `edits` schema reuses `governanceQuestionSchema`'s `input` object (lines 32-36). Decisions go through one batch action, following Phase 12's `ai-assistance-actions.ts` [12-11, 12-15].

### Web components

**Analogs:** `questionnaire-governance.tsx` (in-place edit form, X-5) and Phase 12's `use-ai-decisions.ts`, `ai-review-bar.tsx` [12-14] for optimistic decisions, rollback, Undo toast (X-14) and focus moving; `ai-citations.tsx` [12-15] for X-12; `ai-run-sheet.tsx` [12-13] for X-13; job polling from `features/assessments/questionnaire-generation-job.tsx` [10-12, 10-14, 12-12]. Client pieces import only the zod-free domain module (`lib/performance/zod-client-boundary.test.ts`; `features/parser-free-modules.ts`).

## Shared Patterns

### Lock and serialisation
**Source:** `questionnaire-governance-workflow.ts` `serializeGovernanceMutation` + `lockQuestionnaire` (lines 150-178). **Apply to:** run completion, decisions, gates inside release and replacement. Requestor saves keep their own tail in `questionnaire-workflow.ts` (lines 179-212) but take the same row lock (D-25).

### Closed parsers, versioned envelopes, fail-safe reads
**Source:** `questionnaire-governance-log.ts`. **Apply to:** proposal envelope, decision events, context summary section, job projection.

### Error shape
**Source:** `QuestionnaireGovernanceError(status, message)` and `governanceConflict` (governance workflow lines 37, 394); `QuestionnaireGenerationJobFailure(code, safeMessage)` for job failures; closed reasons from Phase 10's `conflict-reasons.ts` [10-06, 10-07].

### Authorisation chain
Grant in both catalogues, `HUMAN_ANALYST_ONLY_OPERATIONS`, record check against the resolved IdamBox User (`OWN_REQUEST` from Phase 13 [13-03, 13-05, 13-06]), matrix row in `authorization-matrix.integration.test.ts`, spec + `api:generate`, `served-operations.json`.

### Typed API layer
Web calls Strapi only through `read((client) => client.POST(...), parser)` in a `*-service.ts`, from Server Actions; no raw `fetch`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `src/csrm/ai/text-similarity.ts` | utility | Only Phase 12's planned `library-ranking.ts` [12-03]; use 15-RESEARCH §F |
| `questionnaire-proposal-context.ts` | service | Builds on Phase 12's planned context builder [12-03]; use 15-RESEARCH §I |
| `ai-assistance/field-comparison*.tsx` | component | No before-and-after comparison exists; UI-SPEC defines it (shared with Phase 16 D-46) |
| Requestor-text guard in `analyst-instruction.ts` | utility | No verbatim-overlap guard exists; use 15-RESEARCH §E |

## Metadata

**Analog search scope:** `apps/backend/src/api/csrm-questionnaire/`, `apps/backend/src/policies/`, `apps/backend/tests/`, `apps/csrm/src/features/questionnaires/`, `apps/csrm/src/features/assessments/`, `apps/csrm/e2e/`; earlier plans `.planning/workstreams/csrm/phases/10-*`, `12-*`, `13-*` (files_modified and body greps).
**Files scanned:** about 30. All named current analogs are git-tracked.
**Pattern extraction date:** 2026-10-01
