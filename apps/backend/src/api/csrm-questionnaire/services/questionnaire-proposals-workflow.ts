import type { Core } from "@strapi/strapi";
import { createProposalJobRegistry, ProposalJobFailure, ProposalJobRegistryError, type ProposalJob, type ProposalJobReport } from "../../../csrm/ai/proposal-job-registry";
import { parseAnalystInstruction, InstructionShapeError, repeatsRequestorText, type InstructionSource, type SlotInstruction } from "../../../csrm/ai/analyst-instruction";
import { AssessmentContextTooLargeError, REQUEST_FIELDS } from "../../../csrm/ai/assessment-context";
import { buildAssessmentContextFor, failureAttachmentIds, failureAttachmentsEntry, resolveContextAttachments, type AssessmentContextStrapi, type ContextAttachmentReader, type QuestionnaireProposalSource, type ResolvedContextAttachment } from "../../../csrm/ai/assessment-context-loader";
import { aiPolicyRefusalMessage, evaluateAiDataPolicy, readAiDataPolicyConfiguration } from "../../../csrm/ai/data-policy";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { generationJobViewerFacts, resolveGenerationJobInitiators, type GenerationJobViewerFacts } from "../../../csrm/generation-job-viewer";
import { foldItemStates } from "../../../csrm/ai/proposal-items";
import { appendAiRunDecisions, completeAiRun, createRunningAiRun, failAiRun, parseRunDecisionsFor, parseRunProposalFor } from "../../csrm-ai-run/services/ai-run-record";
import { latestAssessmentDraftJobForQuestionnaire } from "../../csrm-assessment/services/assessment-workflow";
import { isAnsweredValue, type PreservationRow } from "./questionnaire-answer-preservation";
import { activeQuestionnaireDefinition, getVisibleQuestionKeys, parseQuestionnaireDefinition, QuestionnaireDefinitionError, type QuestionnaireValue } from "./questionnaire-definition";
import { QuestionnaireGenerationJobFailure } from "./questionnaire-generation-registry";
import { appendGovernanceEvent, GovernanceLogError, questionTextSnapshot } from "./questionnaire-governance-log";
import { withQuestionnaireGovernanceLock, type GovernanceStrapi } from "./questionnaire-governance-workflow";
import { toQuestionnaireProposal, toQuestionRewriteProposal, type QuestionnaireAdapterContext } from "./questionnaire-proposal-adapter";
import type { QuestionnaireDecisionEvent, QuestionnaireProposalOperation, QuestionnaireProposalV1 } from "./questionnaire-proposal-envelope";
import { activeQuestionnaireProposalProviders, providerQuestionViews } from "./questionnaire-proposal-provider";
import { ASSESSMENT_STAGE_REQUEST_STATUSES } from "./questionnaire-workflow";

/*
 * Phase 15 questionnaire proposals and question rewrites as jobs (D-10, D-11, D-16, D-19, D-24, D-26, D-29; 15-RESEARCH §K).
 *
 * A human Security Analyst starts a questionnaire-wide proposal (`questionnaire:{id}`) or a rewrite of one question
 * (`question:{id}`), optionally with an instruction, and gets a job from the generic registry. The job:
 *  1. re-checks the questionnaire's state (D-06) and fails, with no run, when it no longer allows a start;
 *  2. reads the AI data policy and fails, with nothing sent and no run, when it refuses (Phase 12 D-28);
 *  3. builds the context (a context over its bounds fails with CONTEXT_TOO_LARGE and no run, keeping the files it
 *     counted, Phase 14 D-33);
 *  4. creates the run just before the one provider call, which runs outside any lock;
 *  5. passes the provider's wire output through the one adapter (15-05);
 *  6. completes the run with the proposal and appends one `ai-proposal` timeline event in one transaction, inside the
 *     questionnaire's governance lock, so no governance write can lose the event (15-RESEARCH Pitfall 2).
 * Any failure after the run exists closes it as failed with a safe code. A job writes only the run and the timeline
 * event: no question, answer or release fact changes until an analyst confirms an item (D-04, D-07).
 */

type Row = Record<string, unknown>;
type Documents = {
  findOne: (query: Row) => Promise<Row | null>;
  findMany: (query: Row) => Promise<Row[]>;
  update: (query: { documentId: string; data: Row }) => Promise<Row>;
};
export type ProposalWorkflowStrapi = {
  documents: (uid: string) => Documents;
  config: { get: (key: string) => unknown };
  db: GovernanceStrapi["db"];
};

const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const RUN_UID = "api::csrm-ai-run.csrm-ai-run";

export class QuestionnaireProposalWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "QuestionnaireProposalWorkflowError";
  }
}

/** What a job carries beyond its key: the request it reads, and the analyst's validated instruction (null for none). */
export type ProposalJobInput = { requestId: string; instruction: string | null };
export type QuestionnaireProposalJob = ProposalJob<ProposalJobInput>;

/**
 * Who starts, reads or retries a proposal job: the resolved IdamBox User's documentId and, from the policy (13-03),
 * whether the route admitted them through the human Security Analyst role. Every Phase 15 operation is human analyst
 * work (D-31), so without that fact the workflow refuses (fail closed), whatever route reaches it.
 */
export type ProposalViewer = { analystDocumentId: string; humanAnalyst?: boolean };

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
const instant = (value: unknown): string | null => {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" && value.length > 0 ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/* ---------------------------------------------------------------------------------------------------------------------
 * The questionnaire's state for a start (D-06)
 * ------------------------------------------------------------------------------------------------------------------- */

export type ProposalQuestionnaireState = "analyst-review" | "submitted" | "awaiting-submission" | "draft-in-progress" | "assessment-started";

function isReleased(questionnaire: Row): boolean {
  const releasedAt = questionnaire.releasedAt;
  return releasedAt instanceof Date || (typeof releasedAt === "string" && releasedAt.length > 0);
}

const isSubmittedEnvelope = (answer: unknown): boolean => record(answer) && answer.state === "submitted" && typeof answer.submittedAt === "string";

/* The Requestor has submitted: every active question the questionnaire shows them holds a submitted answer envelope. */
function everyVisibleQuestionSubmitted(questions: unknown): boolean {
  try {
    const definition = parseQuestionnaireDefinition(questions);
    const active = activeQuestionnaireDefinition(definition);
    const values = Object.fromEntries(active.map((question) => [question.questionKey, record(question.answer) && question.answer.value !== undefined ? question.answer.value : null])) as Record<string, QuestionnaireValue>;
    const visible = new Set(getVisibleQuestionKeys(definition, values));
    const shown = active.filter((question) => visible.has(question.questionKey));
    return shown.length > 0 && shown.every((question) => isSubmittedEnvelope(question.answer));
  } catch (error) {
    // A definition that cannot be read is never "submitted": the start is refused rather than guessed (fail closed).
    if (error instanceof QuestionnaireDefinitionError) return false;
    throw error;
  }
}

/**
 * D-06: where the questionnaire stands for an AI proposal. An assessment exists (or the request has reached an
 * assessment stage): `assessment-started`. Its draft job is queued or running: `draft-in-progress`. Never released, or
 * returned to analyst review: `analyst-review`. Released and every shown question holds a submitted answer: `submitted`.
 * Otherwise the Requestor is still answering: `awaiting-submission`.
 */
export function deriveProposalQuestionnaireState(input: { questionnaire: Row; request: Row; questions: unknown; draftJobActive: boolean }): ProposalQuestionnaireState {
  if (input.request.assessment || (ASSESSMENT_STAGE_REQUEST_STATUSES as readonly unknown[]).includes(input.request.requestStatus)) return "assessment-started";
  if (input.draftJobActive) return "draft-in-progress";
  if (!isReleased(input.questionnaire)) return "analyst-review";
  return everyVisibleQuestionSubmitted(input.questions) ? "submitted" : "awaiting-submission";
}

const STATE_REFUSALS: Readonly<Partial<Record<ProposalQuestionnaireState, { reason: ConflictReason; message: string }>>> = Object.freeze({
  "awaiting-submission": { reason: "QUESTIONNAIRE_NOT_SUBMITTED", message: "The Requestor has not submitted the questionnaire yet." },
  "draft-in-progress": { reason: "ASSESSMENT_DRAFT_IN_PROGRESS", message: "An assessment draft is being generated for this questionnaire." },
  "assessment-started": { reason: "ASSESSMENT_STARTED", message: "Work on the assessment has started, so the questionnaire can no longer change." },
});

/* The draft registry's job for the questionnaire, read only for whether it is queued or running (never authorised on). */
function draftJobActive(strapi: ProposalWorkflowStrapi, questionnaireId: string): boolean {
  const latest = latestAssessmentDraftJobForQuestionnaire(strapi as never, questionnaireId, { analystDocumentId: "proposal-state", humanAnalyst: true });
  return latest !== null && (latest.job.status === "queued" || latest.job.status === "running");
}

type LoadedQuestionnaire = { questionnaire: Row; request: Row; requestId: string };

async function loadProposalQuestionnaire(strapi: ProposalWorkflowStrapi, questionnaireId: string): Promise<LoadedQuestionnaire | null> {
  const questionnaire = await strapi.documents(QUESTIONNAIRE_UID).findOne({
    documentId: questionnaireId,
    populate: { questions: true, assessmentRequest: { populate: { assessment: true, informationAssets: true, requestor: { fields: ["documentId"] } } } },
  });
  if (!questionnaire) return null;
  const request = record(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  const requestId = request ? relationId(request) : null;
  return request && requestId ? { questionnaire, request, requestId } : null;
}

function stateOf(strapi: ProposalWorkflowStrapi, loaded: LoadedQuestionnaire, questionnaireId: string): ProposalQuestionnaireState {
  return proposalQuestionnaireState(strapi, questionnaireId, loaded.questionnaire, loaded.request);
}

/**
 * D-06 for a caller that has already read the questionnaire (with its questions) and its request (with its assessment)
 * inside its own lock, such as the decision operation (15-07): the one state helper, with this process's draft job read.
 */
export function proposalQuestionnaireState(strapi: ProposalWorkflowStrapi, questionnaireId: string, questionnaire: Row, request: Row): ProposalQuestionnaireState {
  return deriveProposalQuestionnaireState({ questionnaire, request, questions: questionnaire.questions, draftJobActive: draftJobActive(strapi, questionnaireId) });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The registry, one per Strapi
 * ------------------------------------------------------------------------------------------------------------------- */

const registryByStrapi = new WeakMap<object, ReturnType<typeof createProposalJobRegistry<ProposalJobInput>>>();
function registry(strapi: ProposalWorkflowStrapi) {
  const existing = registryByStrapi.get(strapi as object);
  if (existing) return existing;
  const created = createProposalJobRegistry<ProposalJobInput>({ execute: (job, report) => executeProposalJob(strapi, job, report) });
  registryByStrapi.set(strapi as object, created);
  return created;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The rules a start meets (15-RESEARCH §K), each read again by the job where it can change
 * ------------------------------------------------------------------------------------------------------------------- */

/* D-20: a questionnaire holds at most 100 completed proposal runs of both operations; the next start is refused. */
export const QUESTIONNAIRE_PROPOSAL_RUN_LIMIT = 100;
const RUN_LIMIT_MESSAGE = "This questionnaire has reached its limit of AI proposal runs.";
const PROPOSAL_RUN_OPERATIONS: readonly QuestionnaireProposalOperation[] = ["questionnaire-proposals", "question-rewrite"];

async function runLimitReached(strapi: ProposalWorkflowStrapi, questionnaireId: string): Promise<boolean> {
  const runs = await strapi.documents(RUN_UID).findMany({
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: [...PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId"],
    limit: QUESTIONNAIRE_PROPOSAL_RUN_LIMIT,
  });
  return runs.length >= QUESTIONNAIRE_PROPOSAL_RUN_LIMIT;
}

/* G-1 (D-32): the request's Requestor, a Security Analyst included, never steers the AI on it. */
function raisedTheRequest(request: Row, analystId: string): boolean {
  return relationId(request.requestor) === analystId;
}

/* The AI data policy a run for this request would face (Phase 12 D-28): its refusal reason and message, or null. */
function policyRefusal(strapi: ProposalWorkflowStrapi, request: Row): { reason: ConflictReason; message: string } | null {
  const assets = Array.isArray(request.informationAssets) ? request.informationAssets.filter(record) : [];
  const policy = evaluateAiDataPolicy({ assets, ...readAiDataPolicyConfiguration(strapi) });
  if (policy.status !== "refused") return null;
  return { reason: policy.reason ?? "AI_POLICY_NOT_CONFIGURED", message: aiPolicyRefusalMessage(policy) ?? "The request cannot be sent to the provider." };
}

type RewriteTarget = { documentId: string; questionKey: string; questionText: string };

/*
 * D-11: a rewrite's target is an active, unanswered question of the questionnaire. Unknown is 404; removed is
 * QUESTION_REMOVED; answered (the one answered rule, a draft answer included, which only analyst review shows) is
 * QUESTION_ANSWERED. The state was checked first, so this never speaks while the Requestor is still answering.
 */
function rewriteTarget(questionnaire: Row, questionId: string): RewriteTarget | { refusal: { status: 404 | 409; reason?: ConflictReason; message: string } } {
  let definition: ReturnType<typeof parseQuestionnaireDefinition>;
  try {
    definition = parseQuestionnaireDefinition(questionnaire.questions);
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) return { refusal: { status: 409, reason: "DEFINITION_INVALID", message: "CSRM questionnaire definition is invalid." } };
    throw error;
  }
  const question = definition.find((candidate) => candidate.documentId === questionId);
  if (!question) return { refusal: { status: 404, message: "CSRM questionnaire question was not found." } };
  if (question.deleted !== undefined) return { refusal: { status: 409, reason: "QUESTION_REMOVED", message: "This question has been removed." } };
  if (isAnsweredValue(question.answer)) return { refusal: { status: 409, reason: "QUESTION_ANSWERED", message: "This question has been answered, so the AI cannot change it." } };
  return { documentId: question.documentId, questionKey: question.questionKey, questionText: question.questionText };
}

const NOTE_UID = "api::csrm-request-note.csrm-request-note";
const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
/* Every note a request can hold (NOTES_PER_REQUEST_MAX), and every file (ATTACHMENT_LIMITS.maxActivePerRequest) and one more. */
const CORPUS_NOTES_READ_LIMIT = 500;
const CORPUS_FILES_READ_LIMIT = 21;

/**
 * D-18: the Requestor-originated text an instruction may not repeat: the request's text fields (the fields a context
 * sends), every note in the Requestor's part, the answer values of submitted envelopes only, and the text of the files
 * included in the AI inputs. Draft answers and analyst notes are never in it, so a refusal can never reveal a draft
 * answer (T-15-22).
 */
export async function loadRequestorTextCorpus(strapi: ProposalWorkflowStrapi, input: { requestId: string; questionnaireId: string | null }): Promise<string[]> {
  const corpus: string[] = [];
  const request = await strapi.documents(REQUEST_UID).findOne({ documentId: input.requestId, fields: [...REQUEST_FIELDS] });
  for (const field of REQUEST_FIELDS) if (request && typeof request[field] === "string") corpus.push(request[field] as string);
  const notes = await strapi.documents(NOTE_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: input.requestId } }, authorPart: { $eq: "requestor" } },
    fields: ["body"], sort: ["sequence:asc", "id:asc"], limit: CORPUS_NOTES_READ_LIMIT,
  });
  for (const note of notes) if (typeof note.body === "string") corpus.push(note.body);
  // A request with no questionnaire (a risk proposal on such a request, 16-REVIEW BE2-15) contributes no answer.
  const questionnaire = input.questionnaireId === null ? null : await strapi.documents(QUESTIONNAIRE_UID).findOne({ documentId: input.questionnaireId, populate: { questions: { fields: ["answer"] } } });
  for (const question of Array.isArray(questionnaire?.questions) ? questionnaire.questions : []) {
    if (!record(question) || !isSubmittedEnvelope(question.answer)) continue;
    const value = (question.answer as Row).value;
    if (typeof value === "string") corpus.push(value);
    if (Array.isArray(value)) for (const entry of value) if (typeof entry === "string") corpus.push(entry);
  }
  const files = await strapi.documents(ATTACHMENT_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: input.requestId } }, aiTextIncluded: { $eq: true }, scanStatus: { $eq: "clean" }, removedAt: { $null: true } },
    fields: ["aiText"], limit: CORPUS_FILES_READ_LIMIT,
  });
  for (const file of files) if (typeof file.aiText === "string") corpus.push(file.aiText);
  return corpus;
}

const HISTORY_UNAVAILABLE_MESSAGE = "The questionnaire’s change history cannot record this AI request.";

/* The governance log has room for the run's `ai-proposal` event (D-26; at most 1,000 entries), checked before queuing. */
function logHasFreeSlot(questionnaire: Row, analystId: string): boolean {
  try {
    appendGovernanceEvent(questionnaire.governanceLog, {
      schemaVersion: 1, kind: "ai-proposal", at: new Date().toISOString(), by: analystId, runId: "pending", scope: "questionnaire",
      instructionSource: "default-task", providerName: "pending", providerVersion: "pending", itemCount: 0,
    });
    return true;
  } catch (error) {
    if (error instanceof GovernanceLogError) return false;
    throw error;
  }
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Execution
 * ------------------------------------------------------------------------------------------------------------------- */

const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/* Any failure as the job keeps it: the closed failures of the loader, the adapter and the hosted providers by their own code. */
function toProposalJobFailure(error: unknown): ProposalJobFailure {
  if (error instanceof ProposalJobFailure) return error;
  if (error instanceof AssessmentContextTooLargeError) return new ProposalJobFailure(error.code, error.safeMessage, error.attachmentDocumentIds);
  if (error instanceof QuestionnaireGenerationJobFailure && SAFE_CODE.test(error.code)) return new ProposalJobFailure(error.code, error.safeMessage, error.attachmentDocumentIds);
  return new ProposalJobFailure("AI_PROPOSAL_FAILED", "The AI proposal failed safely.");
}

/* The adapter checks the model's output against the questionnaire the context was built from (15-05). */
function adapterContext(allowed: QuestionnaireAdapterContext["allowed"], source: QuestionnaireProposalSource): QuestionnaireAdapterContext {
  const definition = parseQuestionnaireDefinition(source.questionnaire.questions);
  const helpTexts = new Map((Array.isArray(source.questionnaire.questions) ? source.questionnaire.questions : []).filter(record).map((row) => [row.documentId, row.helpText]));
  const rows: PreservationRow[] = definition.map((question) => {
    const helpText = helpTexts.get(question.documentId);
    return { question, helpText: typeof helpText === "string" ? helpText : null, answer: question.answer };
  });
  return {
    allowed,
    rows,
    generatedDate: instant(source.questionnaire.generatedDate),
    openItemTexts: source.openItems.map(({ questionText }) => questionText),
    rejectedItemTexts: source.rejectedItems.map(({ questionText }) => questionText),
  };
}

async function executeProposalJob(strapi: ProposalWorkflowStrapi, job: QuestionnaireProposalJob, report: ProposalJobReport): Promise<{ runId: string }> {
  const operation = job.operation as QuestionnaireProposalOperation;
  const rewrite = operation === "question-rewrite";
  const core = strapi as unknown as Core.Strapi;
  const loaded = await loadProposalQuestionnaire(strapi, job.questionnaireId);
  if (!loaded || loaded.requestId !== job.input.requestId) throw new ProposalJobFailure("QUESTIONNAIRE_NOT_FOUND", "The questionnaire was not found.");
  // 1. The state, the target and the run cap may have moved since the start: no run is created when one refuses.
  const stateRefusal = STATE_REFUSALS[stateOf(strapi, loaded, job.questionnaireId)];
  if (stateRefusal) throw new ProposalJobFailure(stateRefusal.reason, stateRefusal.message);
  let target: RewriteTarget | null = null;
  if (rewrite) {
    const resolved = rewriteTarget(loaded.questionnaire, String(job.questionId));
    if ("refusal" in resolved) throw new ProposalJobFailure(resolved.refusal.reason ?? "QUESTION_NOT_FOUND", resolved.refusal.message);
    target = resolved;
  }
  if (await runLimitReached(strapi, job.questionnaireId)) throw new ProposalJobFailure("AI_PROPOSAL_RUN_LIMIT", RUN_LIMIT_MESSAGE);
  // 2. The AI data policy again, before anything is built or sent (Phase 12 D-28).
  const refusedByPolicy = policyRefusal(strapi, loaded.request);
  if (refusedByPolicy) throw new ProposalJobFailure(refusedByPolicy.reason, refusedByPolicy.message);
  // 3. The context; one over its bounds fails before any run, keeping the files it counted (S-3).
  let built: Awaited<ReturnType<typeof buildAssessmentContextFor>>;
  try {
    built = await buildAssessmentContextFor(strapi as unknown as AssessmentContextStrapi, {
      operation, requestId: loaded.requestId, questionnaireId: job.questionnaireId, ...(target ? { targetQuestionId: target.documentId } : {}),
      instruction: job.input.instruction as SlotInstruction | null,
    });
  } catch (error) {
    throw toProposalJobFailure(error);
  }
  if (built.policy.status === "refused") throw new ProposalJobFailure(built.policy.reason ?? "AI_POLICY_NOT_CONFIGURED", aiPolicyRefusalMessage(built.policy) ?? "The request cannot be sent to the provider.");
  const source = built.questionnaireSource;
  const allowed = built.context.questionnaire;
  if (!source || !allowed) throw new ProposalJobFailure("AI_PROPOSAL_FAILED", "The AI proposal failed safely.");
  const instructionSource = built.steering.source as InstructionSource;
  const providers = activeQuestionnaireProposalProviders();
  const provider = rewrite ? providers.rewrite : providers.proposals;
  // 4. The run, just before the one provider call (Phase 12 D-19, D-20).
  const run = await createRunningAiRun(core, {
    operation, initiatedBy: job.initiatingAnalystDocumentId, providerName: provider.name, providerVersion: provider.version,
    assessmentRequest: loaded.requestId, questionnaire: job.questionnaireId, contextSummary: built.context.summary,
    jobId: job.jobId, attempt: job.attempt, ...(job.input.instruction ? { instruction: job.input.instruction } : {}),
  });
  const runId = String(run.documentId);
  report.recordRun(runId);
  try {
    // 5. The provider, outside any lock, and the one adapter.
    const markedNotes = (built.records.notes ?? []).map(({ sequence, body }) => ({ ref: `note-${sequence}`, body }));
    const views = providerQuestionViews(source.questions);
    const adapter = adapterContext(allowed, source);
    let proposal: QuestionnaireProposalV1;
    if (target) {
      const targetId = target.documentId;
      const view = views.find(({ ref }) => allowed.refs.get(ref) === targetId);
      if (!view) throw new ProposalJobFailure("QUESTION_REMOVED", "This question has been removed.");
      proposal = toQuestionRewriteProposal(await providers.rewrite.rewrite({ context: built.context, target: view, markedNotes, instruction: built.steering.instruction, instructionSource }), adapter);
    } else {
      proposal = toQuestionnaireProposal(await providers.proposals.propose({ context: built.context, questions: views, markedNotes, instruction: built.steering.instruction, instructionSource }), adapter);
    }
    // 6. The run and its timeline event, in one transaction inside the governance lock.
    await completeProposalRun(strapi, { job, runId, proposal, target, providerName: provider.name, providerVersion: provider.version, instructionSource });
    return { runId };
  } catch (error) {
    const failure = toProposalJobFailure(error);
    // A run another path already closed (interrupted at a restart) keeps that status; the job still fails with its code.
    try { await failAiRun(core, runId, { code: failure.code, message: failure.safeMessage }); } catch { /* already closed */ }
    throw failure;
  }
}

type Completion = {
  job: QuestionnaireProposalJob;
  runId: string;
  proposal: QuestionnaireProposalV1;
  target: RewriteTarget | null;
  providerName: string;
  providerVersion: string;
  instructionSource: InstructionSource;
};

const decision = (event: Omit<QuestionnaireDecisionEvent, "schemaVersion">): QuestionnaireDecisionEvent => ({ schemaVersion: 2, ...event }) as QuestionnaireDecisionEvent;

/*
 * D-24: a newer rewrite that completes with an item supersedes the item each older completed rewrite of the same question
 * still has open, recorded with the newer run's initiating analyst and the newer run as its cause. A damaged older run
 * (a proposal, decisions or fold that does not read) is left as it is: nothing may decide it anyway.
 */
async function supersedeOlderRewrites(strapi: ProposalWorkflowStrapi, completion: Completion, at: string): Promise<void> {
  const { job, runId, target } = completion;
  if (!target) return;
  const core = strapi as unknown as Core.Strapi;
  const runs = await strapi.documents(RUN_UID).findMany({
    filters: { questionnaire: { documentId: { $eq: job.questionnaireId } }, operation: { $eq: "question-rewrite" }, status: { $eq: "completed" } },
    fields: ["documentId", "proposal", "decisions"], sort: ["completedAt:asc", "id:asc"], limit: QUESTIONNAIRE_PROPOSAL_RUN_LIMIT + 1,
  });
  for (const run of runs) {
    if (typeof run.documentId !== "string" || run.documentId === runId) continue;
    const proposal = parseRunProposalFor("question-rewrite", run.proposal);
    const events = parseRunDecisionsFor("question-rewrite", run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    if (!proposal || !states) continue;
    const superseded = proposal.items
      .filter((item) => item.kind !== "add" && item.target.questionDocumentId === target.documentId && states.get(item.key) === "open")
      .map((item) => decision({ at, by: job.initiatingAnalystDocumentId, item: item.key, action: "superseded", cause: { kind: "newer-rewrite", runId } }));
    if (superseded.length) await appendAiRunDecisions(core, run.documentId, superseded);
  }
}

/*
 * D-16 and D-26: the run's proposal and its `ai-proposal` event in one transaction, inside the questionnaire's governance
 * lock. The event is appended in memory first (10-06's log-first rule), so a log that cannot take it fails the job and
 * leaves the run to be closed as failed. The event names the initiating analyst, the run, the scope (and for a rewrite
 * its question), the instruction or the preset or default task's label, the provider, and how many items the run kept.
 * D-24: a run that completes once the questionnaire can no longer change (a draft job or an assessment) records every
 * item lapsed, by `system`; otherwise a rewrite with an item supersedes the older open rewrite of its question.
 */
async function completeProposalRun(strapi: ProposalWorkflowStrapi, completion: Completion): Promise<void> {
  const { job, runId, proposal, target } = completion;
  const core = strapi as unknown as Core.Strapi;
  await withQuestionnaireGovernanceLock(strapi as unknown as GovernanceStrapi, job.questionnaireId, async () => {
    const current = await loadProposalQuestionnaire(strapi, job.questionnaireId);
    if (!current) throw new ProposalJobFailure("QUESTIONNAIRE_NOT_FOUND", "The questionnaire was not found.");
    if (await runLimitReached(strapi, job.questionnaireId)) throw new ProposalJobFailure("AI_PROPOSAL_RUN_LIMIT", RUN_LIMIT_MESSAGE);
    const state = stateOf(strapi, current, job.questionnaireId);
    const frozen = state === "draft-in-progress" || state === "assessment-started";
    const at = new Date().toISOString();
    const event = {
      schemaVersion: 1, kind: "ai-proposal", at, by: job.initiatingAnalystDocumentId, runId,
      ...(target ? { scope: "question", questionKey: target.questionKey, questionText: questionTextSnapshot(target.questionText) } : { scope: "questionnaire" }),
      ...(job.input.instruction ? { instruction: job.input.instruction } : { instructionSource: completion.instructionSource }),
      providerName: completion.providerName, providerVersion: completion.providerVersion, itemCount: proposal.items.length,
    };
    let governanceLog: unknown;
    try {
      governanceLog = appendGovernanceEvent(current.questionnaire.governanceLog, event);
    } catch (error) {
      if (error instanceof GovernanceLogError) throw new ProposalJobFailure("HISTORY_UNAVAILABLE", HISTORY_UNAVAILABLE_MESSAGE);
      throw error;
    }
    if (!frozen && proposal.items.length > 0) await supersedeOlderRewrites(strapi, completion, at);
    await completeAiRun(core, runId, { proposal, questionnaire: job.questionnaireId });
    if (frozen && proposal.items.length > 0) {
      await appendAiRunDecisions(core, runId, proposal.items.map((item) => decision({ at, by: "system", item: item.key, action: "lapsed", cause: { kind: "questionnaire-frozen" } })));
    }
    await strapi.documents(QUESTIONNAIRE_UID).update({ documentId: job.questionnaireId, data: { governanceLog } });
  });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Starts
 * ------------------------------------------------------------------------------------------------------------------- */

function humanAnalyst(viewer: ProposalViewer): string {
  if (!viewer || viewer.humanAnalyst !== true || typeof viewer.analystDocumentId !== "string" || viewer.analystDocumentId.trim().length === 0) {
    throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposals are denied.");
  }
  return viewer.analystDocumentId;
}

const BODY_INVALID = "CSRM questionnaire AI proposal data is invalid.";

/* The closed body `{ instruction? }`: absent, null or an object with only that key, the instruction a string or null. */
function parseProposalBody(body: unknown): { instruction: unknown } {
  if (body === undefined || body === null) return { instruction: undefined };
  if (!record(body) || Object.keys(body).some((key) => key !== "instruction")) throw new QuestionnaireProposalWorkflowError(400, BODY_INVALID);
  if (body.instruction !== undefined && body.instruction !== null && typeof body.instruction !== "string") throw new QuestionnaireProposalWorkflowError(400, BODY_INVALID);
  return { instruction: body.instruction };
}

function validatedInstruction(raw: unknown): string | null {
  let parsed: ReturnType<typeof parseAnalystInstruction>;
  try {
    parsed = parseAnalystInstruction(raw);
  } catch (error) {
    if (error instanceof InstructionShapeError) throw new QuestionnaireProposalWorkflowError(400, BODY_INVALID);
    throw error;
  }
  if (!parsed.ok) throw new QuestionnaireProposalWorkflowError(400, "CSRM analyst instruction is not allowed.", parsed.reason);
  return parsed.instruction;
}

type StartInput = { strapi: ProposalWorkflowStrapi; questionnaireId: string; body?: unknown } & ProposalViewer;

/*
 * 15-RESEARCH §K, in this order, so a refusal never reveals a draft answer (Pitfall 1): the closed body (400) → the
 * questionnaire exists (404) → the analyst did not raise the request (403 OWN_REQUEST) → the state allows a start
 * (409) → a rewrite's target is active and unanswered (404, 409) → the instruction is valid (400) and repeats no
 * Requestor text (400) → the run cap (409) → the AI data policy (409) → the governance log has room (409) → enqueue.
 * A start while a job is active on the same key returns that job.
 */
async function startProposalJob(input: StartInput, operation: QuestionnaireProposalOperation, questionId: string | null): Promise<Row> {
  const body = parseProposalBody(input.body);
  const analystId = humanAnalyst(input);
  if (typeof input.questionnaireId !== "string" || !input.questionnaireId) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
  let ownsReservation = false;
  let reserved: QuestionnaireProposalJob | undefined;
  try {
    await withQuestionnaireGovernanceLock(input.strapi as unknown as GovernanceStrapi, input.questionnaireId, async () => {
      const loaded = typeof input.questionnaireId === "string" && input.questionnaireId ? await loadProposalQuestionnaire(input.strapi, input.questionnaireId) : null;
      if (!loaded) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
      if (raisedTheRequest(loaded.request, analystId)) throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposals are denied on a request you raised.", "OWN_REQUEST");
      const stateRefusal = STATE_REFUSALS[stateOf(input.strapi, loaded, input.questionnaireId)];
      if (stateRefusal) throw new QuestionnaireProposalWorkflowError(409, stateRefusal.message, stateRefusal.reason);
      if (questionId !== null) {
        const target = rewriteTarget(loaded.questionnaire, questionId);
        if ("refusal" in target) throw new QuestionnaireProposalWorkflowError(target.refusal.status, target.refusal.message, target.refusal.reason);
      }
      const instruction = validatedInstruction(body.instruction);
      if (instruction !== null && repeatsRequestorText(instruction, await loadRequestorTextCorpus(input.strapi, { requestId: loaded.requestId, questionnaireId: input.questionnaireId }))) {
        throw new QuestionnaireProposalWorkflowError(400, "The instruction repeats the Requestor’s text, which the AI already reads.", "INSTRUCTION_REPEATS_REQUESTOR_TEXT");
      }
      const key = questionId === null ? `questionnaire:${input.questionnaireId}` : `question:${questionId}`;
      const active = registry(input.strapi).activeFor(input.questionnaireId);
      const existing = active.find((job) => job.key === key);
      if (!existing) await assertRunCapacity(input.strapi, input.questionnaireId, active.length);
      const refusedByPolicy = policyRefusal(input.strapi, loaded.request);
      if (refusedByPolicy) throw new QuestionnaireProposalWorkflowError(409, refusedByPolicy.message, refusedByPolicy.reason);
      if (!logHasFreeSlot(loaded.questionnaire, analystId)) throw new QuestionnaireProposalWorkflowError(409, HISTORY_UNAVAILABLE_MESSAGE, "HISTORY_UNAVAILABLE");
      ownsReservation = !existing;
      reserved = existing ?? registry(input.strapi).enqueue({
        key,
        questionnaireId: input.questionnaireId, operation, questionId,
        input: { requestId: loaded.requestId, instruction }, initiatingAnalystDocumentId: analystId,
      }, true);
    });
  } catch (error) {
    if (ownsReservation && reserved) registry(input.strapi).discardReserved(reserved.jobId);
    throw error;
  }
  const job = reserved as QuestionnaireProposalJob;
  registry(input.strapi).launchReserved(job.jobId);
  return projectedJob(input.strapi, job, humanAnalyst(input));
}

async function assertRunCapacity(strapi: ProposalWorkflowStrapi, questionnaireId: string, reservations: number): Promise<void> {
  const completed = await strapi.documents(RUN_UID).findMany({ filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: [...PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } }, fields: ["documentId"], limit: QUESTIONNAIRE_PROPOSAL_RUN_LIMIT });
  if (completed.length + reservations >= QUESTIONNAIRE_PROPOSAL_RUN_LIMIT) throw new QuestionnaireProposalWorkflowError(409, RUN_LIMIT_MESSAGE, "AI_PROPOSAL_RUN_LIMIT");
}

/** D-10: a questionnaire-wide proposal, optionally steered by an instruction (the default task without one). */
export function startQuestionnaireProposals(input: StartInput): Promise<Row> {
  return startProposalJob(input, "questionnaire-proposals", null);
}

/** D-11: a rewrite of one active, unanswered question, in plain language by default or as the instruction asks. */
export function startQuestionRewrite(input: StartInput & { questionId: string }): Promise<Row> {
  if (typeof input.questionId !== "string" || input.questionId.length === 0) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire question was not found.");
  return startProposalJob(input, "question-rewrite", input.questionId);
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Job read and retry
 * ------------------------------------------------------------------------------------------------------------------- */

type JobRequest = { strapi: ProposalWorkflowStrapi; jobId: string } & ProposalViewer;

/*
 * Phase 13 D-18 and D-32: any human Security Analyst follows and retries a retained job, except on a request they raised
 * (403 OWN_REQUEST), whoever started it. An unknown or expired job, or one whose questionnaire is gone, is 404.
 */
async function accessibleJob(input: JobRequest): Promise<{ job: QuestionnaireProposalJob; analystId: string; loaded: LoadedQuestionnaire }> {
  const analystId = humanAnalyst(input);
  const job = typeof input.jobId === "string" && input.jobId ? registry(input.strapi).get(input.jobId) : null;
  if (!job) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire AI proposal job was not found.");
  const loaded = await loadProposalQuestionnaire(input.strapi, job.questionnaireId);
  if (!loaded) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire AI proposal job was not found.");
  if (raisedTheRequest(loaded.request, analystId)) throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposals are denied on a request you raised.", "OWN_REQUEST");
  return { job, analystId, loaded };
}

/* The projection with the files a too-large failure counted, named by what their records say now (Phase 14 D-33). */
async function projectedJob(strapi: ProposalWorkflowStrapi, job: QuestionnaireProposalJob, analystId: string): Promise<Row> {
  const names = await resolveContextAttachments(strapi as unknown as ContextAttachmentReader, failureAttachmentIds(job.failure));
  return projectQuestionnaireProposalJob(job, await jobViewerFacts(strapi, job, analystId), names);
}

/** D-16: a proposal job as the analyst reading it sees it. */
export async function getQuestionnaireProposalJob(input: JobRequest): Promise<Row> {
  const { job, analystId } = await accessibleJob(input);
  return projectedJob(input.strapi, job, analystId);
}

/**
 * D-16 and Phase 13 D-18: a failed job's new attempt, initiated by the retrying analyst, so its run and its timeline entry
 * name them. Only a failed job whose key has no active job is retried (409 otherwise). A retry is a new attempt, so the
 * AI data policy that refuses a start refuses it the same way, before anything is queued (Phase 12 IN-104); the job's
 * execution re-checks everything else before any run.
 */
export async function retryQuestionnaireProposalJob(input: JobRequest): Promise<Row> {
  const { job, analystId } = await accessibleJob(input);
  let retried: QuestionnaireProposalJob | undefined;
  try {
    await withQuestionnaireGovernanceLock(input.strapi as unknown as GovernanceStrapi, job.questionnaireId, async () => {
      const current = await loadProposalQuestionnaire(input.strapi, job.questionnaireId);
      if (!current) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
      const stateRefusal = STATE_REFUSALS[stateOf(input.strapi, current, job.questionnaireId)];
      if (stateRefusal) throw new QuestionnaireProposalWorkflowError(409, stateRefusal.message, stateRefusal.reason);
      await assertRunCapacity(input.strapi, job.questionnaireId, registry(input.strapi).activeFor(job.questionnaireId).length);
      if (!registry(input.strapi).mayRetry(job)) throw new QuestionnaireProposalWorkflowError(409, "Only a failed AI proposal job can be retried.");
      const refusedByPolicy = policyRefusal(input.strapi, current.request);
      if (refusedByPolicy) throw new QuestionnaireProposalWorkflowError(409, refusedByPolicy.message, refusedByPolicy.reason);
      try {
        retried = registry(input.strapi).retry(job.jobId, analystId, true);
      } catch (error) {
        if (error instanceof ProposalJobRegistryError) throw new QuestionnaireProposalWorkflowError(error.status, error.message);
        throw error;
      }
    });
  } catch (error) {
    // 16-REVIEW BE2-16: the failed job stays as it was, so its failure is still read and it may be retried.
    if (retried) registry(input.strapi).restoreFailed(job);
    throw error;
  }
  registry(input.strapi).launchReserved((retried as QuestionnaireProposalJob).jobId);
  return projectedJob(input.strapi, retried as QuestionnaireProposalJob, analystId);
}


/* ---------------------------------------------------------------------------------------------------------------------
 * The job projection
 * ------------------------------------------------------------------------------------------------------------------- */

async function jobViewerFacts(strapi: ProposalWorkflowStrapi, job: QuestionnaireProposalJob, viewerId: string): Promise<GenerationJobViewerFacts> {
  const initiators = await resolveGenerationJobInitiators(strapi, [job.initiatingAnalystDocumentId]);
  return generationJobViewerFacts({ initiatorDocumentId: job.initiatingAnalystDocumentId, viewerDocumentId: viewerId, canRetry: registry(strapi).mayRetry(job), initiators });
}

/**
 * The job as an analyst reads it: never the registry's input or initiator field as such. `initiatedBy` names who started
 * the job or its latest retry, resolved at read time, and `initiatedByViewer` whether that is the viewer (Phase 13 D-18,
 * as the generation job reads); `canRetry` is whether this viewer may retry it now. A CONTEXT_TOO_LARGE failure that kept
 * files names them by their current names (`failureAttachments`, Phase 14 D-33; S-3); any other job carries no such key.
 */
export function projectQuestionnaireProposalJob(job: QuestionnaireProposalJob, viewer: GenerationJobViewerFacts, names: ReadonlyMap<string, ResolvedContextAttachment> = new Map()): Row {
  return {
    jobId: job.jobId,
    questionnaireId: job.questionnaireId,
    operation: job.operation,
    questionId: job.questionId,
    status: job.status,
    attempt: job.attempt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    runId: job.runId ?? null,
    failureCode: job.failure?.code ?? null,
    failureMessage: job.failure?.message ?? null,
    ...failureAttachmentsEntry(job.failure, names),
    initiatedBy: viewer.initiatedBy,
    initiatedByViewer: viewer.initiatedByViewer,
    canRetry: viewer.canRetry,
  };
}

/** The questionnaire's queued and running proposal jobs as `analystId` reads them (15-09's proposals read). */
export async function projectedActiveProposalJobs(strapi: ProposalWorkflowStrapi, questionnaireId: string, analystId: string): Promise<Row[]> {
  const jobs = registry(strapi).activeFor(questionnaireId);
  const projected: Row[] = [];
  for (const job of jobs) projected.push(await projectedJob(strapi, job, analystId));
  return projected;
}

/** The questionnaire's queued and running proposal jobs in this process, oldest first (D-16; R-08-36). */
export function activeQuestionnaireProposalJobs(strapi: ProposalWorkflowStrapi, questionnaireId: string): readonly QuestionnaireProposalJob[] {
  return registry(strapi).activeFor(questionnaireId);
}

/**
 * The job once its current attempt has ended, as the registry holds it, or null when no such job is retained. For the
 * harness and in-process callers that must wait for a job; it authorises nothing, so no route may serve it.
 */
export async function settledQuestionnaireProposalJob(strapi: ProposalWorkflowStrapi, jobId: string): Promise<QuestionnaireProposalJob | null> {
  await registry(strapi).settled(jobId);
  return registry(strapi).get(jobId);
}

export { ProposalJobFailure };
