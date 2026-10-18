import { createWithQuestionnaireNumber } from "./questionnaire-number";
import { deterministicQuestionnaireGenerationProvider } from "./deterministic-questionnaire-generation-provider";
import { openaiCompatibleQuestionnaireGenerationProvider } from "./openai-compatible-questionnaire-generation-provider";
import { createQuestionnaireGenerationRegistry, QuestionnaireGenerationJobFailure, QuestionnaireGenerationRegistryError, type QuestionnaireGenerationJobActor, type QuestionnaireGenerationJobRecord } from "./questionnaire-generation-registry";
import { validatedGenerationQuestions } from "./questionnaire-generation-provider";
import { activeQuestionnaireDefinition, parseQuestionnaireDefinition, QuestionnaireDefinitionError } from "./questionnaire-definition";
import { appendGovernanceEvent, countAnalystChangesSinceGeneration, GovernanceLogError } from "./questionnaire-governance-log";
import { lockRequestAndQuestionnaire } from "./questionnaire-row-locks";
import { openProposalSummary } from "./questionnaire-proposal-gates";
import { CSRM_AI_PROVIDER_MODE } from "../../../csrm/ai-provider-selection";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { latestAssessmentDraftJobForQuestionnaire, projectAssessmentDraftJob } from "../../csrm-assessment/services/assessment-workflow";
import { generationJobViewerFacts, resolveGenerationJobInitiators, type GenerationJobViewerFacts } from "../../../csrm/generation-job-viewer";
import { buildAssessmentContextFor, failureAttachmentIds, failureAttachmentsEntry, resolveContextAttachments, type ContextAttachmentReader, type ResolvedContextAttachment } from "../../../csrm/ai/assessment-context-loader";
import { AssessmentContextTooLargeError } from "../../../csrm/ai/assessment-context";
import { aiPolicyRefusalMessage, evaluateAiDataPolicy, readAiDataPolicyConfiguration } from "../../../csrm/ai/data-policy";
import { createRunningAiRun, completeAiRun, failAiRun, runProposalEnvelope } from "../../csrm-ai-run/services/ai-run-record";
import type { Core } from "@strapi/strapi";
import { InstructionShapeError, parseAnalystInstruction, repeatsRequestorText, type SlotInstruction } from "../../../csrm/ai/analyst-instruction";
import { loadRequestorTextCorpus } from "./questionnaire-proposals-workflow";

type RecordValue = Record<string, unknown>; const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
type Documents = { findOne: (query: RecordValue) => Promise<RecordValue | null>; findMany: (query: RecordValue) => Promise<RecordValue[]>; create: (query: { data: RecordValue }) => Promise<RecordValue>; update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>; delete: (query: { documentId: string }) => Promise<void> };
type Strapi = { documents: (uid: string) => Documents; config: { get: (key: string) => unknown }; db: { transaction: <T>(fn: (arg: { trx: unknown }) => Promise<T>) => Promise<T>; queryBuilder: (uid: string) => { select: (items: string[]) => unknown; where: (items: RecordValue) => unknown; forUpdate: () => unknown; transacting: (trx: unknown) => unknown; execute: <T>() => Promise<T> } } };
export class QuestionnaireGenerationWorkflowError extends Error { constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) { super(message); } }
const registryByStrapi = new WeakMap<object, ReturnType<typeof createQuestionnaireGenerationRegistry>>();
const activeQuestionnaireGenerationProvider = CSRM_AI_PROVIDER_MODE === "openai-compatible" ? openaiCompatibleQuestionnaireGenerationProvider : deterministicQuestionnaireGenerationProvider;
const relationId = (value: unknown) => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
/**
 * Who reads or acts on a generation job: the resolved IdamBox User's documentId and, from the policy (13-03), whether
 * the route admitted them through the human Security Analyst role. D-18: that fact, never a constant, opens every job to
 * the human analyst, so a later route that reuses this workflow cannot widen by accident; without it a caller stays with
 * the jobs they started (fail closed).
 */
export type QuestionnaireJobViewer = { analystDocumentId: string; humanAnalyst?: boolean };
function actor(documentId: string, humanAnalyst?: boolean): QuestionnaireGenerationJobActor { if (!documentId) throw new QuestionnaireGenerationWorkflowError(403, "Questionnaire generation is denied."); return { documentId, canReadAllQuestionnaireGenerationJobs: humanAnalyst === true }; }
function hasAnswerEvidence(answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;
  if (!record(answer)) return true;
  const value = answer.value;
  if (typeof value === "string" && value.trim().length > 0) return true;
  if (Array.isArray(value) && value.length > 0) return true;
  if (value !== null && value !== undefined && typeof value !== "string" && !Array.isArray(value)) return true;
  return answer.state === "draft" || answer.state === "submitted";
}
export function hasQuestionnaireAnswerEvidence(questions: unknown): boolean { return Array.isArray(questions) && questions.some((question) => record(question) && hasAnswerEvidence(question.answer)); }
const RELEASED_REPLACEMENT_MESSAGE = "Released questionnaires cannot be replaced.";
const ANSWERED_REPLACEMENT_MESSAGE = "Answered questionnaires cannot be regenerated.";
const CHANGED_REPLACEMENT_MESSAGE = "Questionnaires an analyst has changed since generation cannot be replaced.";
const OPEN_PROPOSALS_REPLACEMENT_MESSAGE = "Decide every AI proposal on the questionnaire before replacing it.";

/*
 * Phase 15 D-09 (narrowing Phase 10 D-08) and Q-1: the reason an existing questionnaire may not be replaced, or null.
 * In order: released (the Requestor can see it), answered (a draft answer counts), changed by an analyst since the
 * latest generation (a confirmed AI change or its Undo counts; an unreadable log is not a change and falls through to
 * the job's HISTORY_UNAVAILABLE), then an open AI proposal or an active proposal job (D-08). The same order runs before
 * queueing and inside the job's locked transaction.
 */
export async function replacementRefusal(strapi: Strapi, questionnaire: RecordValue): Promise<{ reason: ConflictReason; message: string } | null> {
  if (isReleased(questionnaire)) return { reason: "QUESTIONNAIRE_RELEASED", message: RELEASED_REPLACEMENT_MESSAGE };
  if (hasQuestionnaireAnswerEvidence(questionnaire.questions)) return { reason: "QUESTIONNAIRE_ANSWERED", message: ANSWERED_REPLACEMENT_MESSAGE };
  const changes = countAnalystChangesSinceGeneration(questionnaire.governanceLog, questionnaire.generatedDate as string | Date | null | undefined);
  if (changes !== null && changes > 0) return { reason: "QUESTIONNAIRE_HAS_ANALYST_CHANGES", message: CHANGED_REPLACEMENT_MESSAGE };
  if (typeof questionnaire.documentId === "string") {
    const summary = await openProposalSummary(strapi as never, questionnaire.documentId);
    if (summary.openCount > 0 || summary.activeJob) return { reason: "AI_PROPOSALS_OPEN", message: OPEN_PROPOSALS_REPLACEMENT_MESSAGE };
  }
  return null;
}
/* The dedicated release fact, never the narrative log, says whether the Requestor can see the questionnaire (06.8 D-14). */
function isReleased(questionnaire: RecordValue): boolean { const releasedAt = questionnaire.releasedAt; return releasedAt instanceof Date || (typeof releasedAt === "string" && releasedAt.length > 0); }
/* The questions a replacement discards: every question not already removed. */
function replacedQuestionCount(questions: unknown): number {
  try {
    return activeQuestionnaireDefinition(parseQuestionnaireDefinition(questions)).length;
  } catch (error) {
    if (!(error instanceof QuestionnaireDefinitionError)) throw error;
    return Array.isArray(questions) ? questions.filter((row) => record(row) && !(record(row.options) && row.options.deleted !== undefined)).length : 0;
  }
}
/* The regenerated event's explanation, fixed by UI-SPEC §3.4 because the analyst timeline shows it verbatim. */
function replacementExplanation(existing: RecordValue): string {
  const replaced = replacedQuestionCount(existing.questions);
  const discarded = countAnalystChangesSinceGeneration(existing.governanceLog, existing.generatedDate as string | Date | null | undefined);
  // An unreadable log cannot say what the replacement discards, and cannot take the event either.
  if (discarded === null) throw new GovernanceLogError();
  const discardedSentence = discarded === 0 ? "No analyst changes were discarded." : discarded === 1 ? "1 analyst change was discarded." : `${discarded} analyst changes were discarded.`;
  return `A newly generated questionnaire replaced ${replaced} ${replaced === 1 ? "question" : "questions"}. ${discardedSentence}`;
}
const HISTORY_UNAVAILABLE_MESSAGE = "The questionnaire’s change history cannot record a replacement.";
/*
 * The regenerated event appended to the stored log. A log that cannot take it (full at 1,000 entries, or
 * unreadable) fails the job with HISTORY_UNAVAILABLE, the reason every governance path gives for the same
 * condition (WR-102, D-22), rather than the generic generation failure.
 */
function appendRegeneratedEvent(existing: RecordValue, at: string, by: string, instruction: string | null) {
  try {
    // Phase 15 D-12: the event names the analyst's instruction, or the default task when none was given.
    return appendGovernanceEvent(existing.governanceLog, { schemaVersion: 1, kind: "regenerated", at, by, explanation: replacementExplanation(existing), ...(instruction ? { instruction } : { instructionSource: "default-task" }) });
  } catch (error) {
    if (error instanceof GovernanceLogError) throw new QuestionnaireGenerationJobFailure("HISTORY_UNAVAILABLE", HISTORY_UNAVAILABLE_MESSAGE);
    throw error;
  }
}
export async function persistGeneratedQuestionnaire(strapi: Strapi, requestId: string, analystId: string, replaceUnansweredQuestionnaire: boolean, jobId?: string, attempt?: number, instruction: string | null = null): Promise<{ questionnaireId: string }> {
  const requests = strapi.documents("api::csrm-assessment-request.csrm-assessment-request"); const questionnaires = strapi.documents("api::csrm-questionnaire.csrm-questionnaire"); const questions = strapi.documents("api::csrm-question.csrm-question");
  const request = await requests.findOne({ documentId: requestId, populate: { questionnaire: { populate: { questions: true } } } });
  if (!request) throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_FOUND", "Assessment request was not found.");
  if (request.requestStatus !== "submitted") throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_ELIGIBLE", "Assessment request is not eligible for questionnaire generation.");
  const initialQuestionnaire = record(request.questionnaire) ? request.questionnaire : null;
  if (initialQuestionnaire && !replaceUnansweredQuestionnaire) throw new QuestionnaireGenerationJobFailure("QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED", "Unanswered questionnaire replacement requires acknowledgement.");
  const initialRefusal = initialQuestionnaire ? await replacementRefusal(strapi, initialQuestionnaire) : null;
  if (initialRefusal) throw new QuestionnaireGenerationJobFailure(initialRefusal.reason, initialRefusal.message);
  let built: Awaited<ReturnType<typeof buildAssessmentContextFor>>;
  // Phase 15 D-12, D-17: the analyst's instruction reaches the provider in its one slot, recorded as the analyst's.
  try { built = await buildAssessmentContextFor(strapi, { operation: "questionnaire-generation", requestId, instruction: instruction as SlotInstruction | null, instructionSource: instruction ? "analyst" : "default-task" }); }
  // D-33: the failure keeps the files the refused context included, which the analyst's job reads name.
  catch (error) { if (error instanceof AssessmentContextTooLargeError) throw new QuestionnaireGenerationJobFailure(error.code, error.safeMessage, error.attachmentDocumentIds); throw error; }
  if (built.policy.status === "refused") throw new QuestionnaireGenerationJobFailure(built.policy.reason ?? "AI_POLICY_NOT_CONFIGURED", aiPolicyRefusalMessage(built.policy) ?? "The request cannot be sent to the provider.");
  const core = strapi as unknown as Core.Strapi;
  const run = await createRunningAiRun(core, { operation: "questionnaire-generation", initiatedBy: analystId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version, assessmentRequest: requestId, contextSummary: built.context.summary, ...(jobId ? { jobId } : {}), ...(attempt ? { attempt } : {}), ...(instruction ? { instruction } : {}) });
  try {
  const proposal = await activeQuestionnaireGenerationProvider.generate({ context: built.context, records: built.records });
  const definition = validatedGenerationQuestions(proposal); const generatedDate = new Date().toISOString();
  // IN-109 (D-16): a question generated without help text is stored with none; the run records that the provider left it out.
  const adjustments = proposal.questions.some((question) => typeof question.helpText !== "string" || question.helpText.trim().length === 0) ? ["help-text-missing"] : [];
  // WR-104 (D-06): a proposal the run record cannot keep (over 1 MB) is invalid provider output, refused before anything is saved.
  const envelope = runProposalEnvelope(proposal as unknown as RecordValue, adjustments);
  if (!envelope) throw new QuestionnaireGenerationJobFailure("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.");
  const helpTextByKey = new Map(proposal.questions.map((question) => [question.options.questionKey, question.helpText ?? null]));
  return await strapi.db.transaction(async ({ trx }) => {
    /*
     * CR-101: the request row, then its questionnaire's row, the order every questionnaire mutation takes
     * (questionnaire-row-locks.ts). The questionnaire, its questions and its governance log are read only once
     * both are held, so no release, return to review or question change can commit between this read and the
     * writes below, and none that read before this job can write a stale log over its regenerated event.
     */
    await lockRequestAndQuestionnaire(strapi, requestId, trx);
    const current = await requests.findOne({ documentId: requestId, populate: { questionnaire: { populate: { questions: true } } } });
    if (!current || current.requestStatus !== "submitted") throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_ELIGIBLE", "Assessment request is not eligible for questionnaire generation.");
    const existing = record(current.questionnaire) ? current.questionnaire : null;
    if (existing && !replaceUnansweredQuestionnaire) throw new QuestionnaireGenerationJobFailure("QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED", "Unanswered questionnaire replacement requires acknowledgement.");
    // D-09, re-checked under both locks: a release, an answer, an analyst change or an AI proposal that landed while this job waited is seen here (06.8 D-15: no implicit backward transition; Phase 15 D-08, D-09).
    const refusal = existing ? await replacementRefusal(strapi, existing) : null;
    if (refusal) throw new QuestionnaireGenerationJobFailure(refusal.reason, refusal.message);
    let questionnaireId: string; if (existing && typeof existing.documentId === "string") {
      questionnaireId = existing.documentId;
      /*
       * D-10: the replacement's record is appended in memory before anything is written (10-06's
       * log-first rule), so a full or unreadable log fails the job and leaves every question in place.
       * It is dated by the new generation, which also moves generatedDate: the D-17 resolution window
       * and the D-16 change count both start again from here.
       */
      const governanceLog = appendRegeneratedEvent(existing, generatedDate, analystId, instruction);
      for (const row of Array.isArray(existing.questions) ? existing.questions : []) if (record(row) && typeof row.documentId === "string") await questions.delete({ documentId: row.documentId });
      await questionnaires.update({ documentId: questionnaireId, data: { title: proposal.title, ...(proposal.description ? { description: proposal.description } : {}), generatedDate, generatedBy: analystId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version, governanceLog } });
    } else { const created = await createWithQuestionnaireNumber((questionnaireNumber) => questionnaires.create({ data: { questionnaireNumber, title: proposal.title, ...(proposal.description ? { description: proposal.description } : {}), assessmentRequest: requestId, generatedDate, generatedBy: analystId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version } })); if (typeof created.documentId !== "string") throw new Error("Questionnaire persistence failed."); questionnaireId = created.documentId; }
    for (const question of definition) await questions.create({ data: { questionnaire: questionnaireId, questionText: question.questionText, helpText: helpTextByKey.get(question.questionKey) ?? null, answerType: question.answerType, options: { schemaVersion: 1, questionKey: question.questionKey, section: question.section, order: question.order, required: question.required, ...(question.visibility ? { visibility: question.visibility } : {}), ...(question.choices ? { choices: question.choices } : {}) }, answer: null } });
    await completeAiRun(core, run.documentId, { proposal: envelope, questionnaire: questionnaireId });
    return { questionnaireId }; });
  } catch (error) {
    const failure = error instanceof QuestionnaireGenerationJobFailure ? error : new QuestionnaireGenerationJobFailure("QUESTIONNAIRE_GENERATION_FAILED", "Questionnaire generation failed.");
    await failAiRun(core, run.documentId, { code: failure.code, message: failure.safeMessage });
    throw error;
  }
}
function registry(strapi: Strapi) { const existing = registryByStrapi.get(strapi as object); if (existing) return existing; const created = createQuestionnaireGenerationRegistry({ execute: ({ requestId, initiatingAnalystDocumentId, replaceUnansweredQuestionnaire, jobId, attempt, instruction }) => persistGeneratedQuestionnaire(strapi, requestId, initiatingAnalystDocumentId, replaceUnansweredQuestionnaire, jobId, attempt, instruction ?? null) }); registryByStrapi.set(strapi as object, created); return created; }
/*
 * The registry's initiatingAnalystDocumentId field is never projected as such. D-18: every analyst on the request
 * follows its jobs, so the projection names who started the job (initiatedBy, a documentId and a display name resolved
 * at read time), whether the viewer did, and whether the viewer may retry it (generation-job-viewer.ts). The closed
 * client schema rejects any other key.
 */
/* Phase 14 D-33: a CONTEXT_TOO_LARGE failure also names the files it counted (failureAttachments), by their current names in `names`. */
export function projectQuestionnaireGenerationJob(job: QuestionnaireGenerationJobRecord, questionnaire: RecordValue | null | undefined, viewer: GenerationJobViewerFacts, names: ReadonlyMap<string, ResolvedContextAttachment> = new Map()): RecordValue { return { jobId: job.jobId, requestId: job.requestId, providerName: job.providerName, providerVersion: job.providerVersion, status: job.status, attempt: job.attempt, queuedAt: job.queuedAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.completedAt ? { completedAt: job.completedAt } : {}), ...(job.failure ? { failureCode: job.failure.code, failureMessage: job.failure.message, ...failureAttachmentsEntry(job.failure, names) } : {}), ...(job.status === "completed" && questionnaire ? { questionnaire: projectGeneratedQuestionnaire(questionnaire) } : {}), canRetry: viewer.canRetry, initiatedBy: viewer.initiatedBy, initiatedByViewer: viewer.initiatedByViewer }; }
/** The D-18 facts of one questionnaire generation job for `viewer`, with its initiator's name from one bounded read. */
async function questionnaireJobViewerFacts(strapi: Strapi, job: QuestionnaireGenerationJobRecord, viewer: QuestionnaireGenerationJobActor): Promise<GenerationJobViewerFacts> {
  const initiators = await resolveGenerationJobInitiators(strapi, [job.initiatingAnalystDocumentId]);
  const request = job.instruction ? await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: job.requestId, populate: { requestor: { fields: ["documentId"] } } }) : null;
  return generationJobViewerFacts({ initiatorDocumentId: job.initiatingAnalystDocumentId, viewerDocumentId: viewer.documentId, canRetry: registry(strapi).mayRetry(job, viewer) && !instructedOwnRequest(job, request, viewer.documentId), initiators });
}

function instructedOwnRequest(job: QuestionnaireGenerationJobRecord, request: RecordValue | null, viewerId: string): boolean {
  return Boolean(job.instruction) && (!request || relationId(request.requestor) === viewerId);
}

/*
 * Project a bounded questionnaire rather than handing back the raw document.
 * The client parses this response with a closed schema, so returning the whole
 * record makes every future attribute on CsrmQuestionnaire a breaking change:
 * the reversal facts added in the previous phase were already enough to fail
 * the parse and report a completed generation as a failure. Only what the
 * analyst needs to identify and open the questionnaire crosses the boundary.
 */
export function projectGeneratedQuestionnaire(questionnaire: RecordValue): RecordValue {
  const generatedBy = questionnaire.generatedBy;
  return {
    documentId: questionnaire.documentId,
    questionnaireNumber: questionnaire.questionnaireNumber,
    title: questionnaire.title,
    generatedDate: typeof questionnaire.generatedDate === "string" ? questionnaire.generatedDate : null,
    generatedBy: record(generatedBy) && typeof generatedBy.documentId === "string"
      ? { documentId: generatedBy.documentId, displayName: typeof generatedBy.displayName === "string" ? generatedBy.displayName : null }
      : null,
  };
}
/* D-28: the AI data policy a generation for this request would face, refused with a 409 and its reason before any job is queued. */
function refuseGenerationByAiDataPolicy(strapi: Strapi, request: RecordValue): void {
  const assets = Array.isArray(request.informationAssets) ? request.informationAssets.filter(record) : [];
  const policy = evaluateAiDataPolicy({ assets, ...readAiDataPolicyConfiguration(strapi) });
  if (policy.status === "refused") throw new QuestionnaireGenerationWorkflowError(409, aiPolicyRefusalMessage(policy) ?? "The request cannot be sent to the provider.", policy.reason ?? undefined);
}
/*
 * Phase 15 D-12, D-18, D-19 and D-32: the optional instruction, validated as the proposals' is. A requesting Security
 * Analyst may still generate (Phase 12) but never steer the AI on their own request (403 OWN_REQUEST), and an
 * instruction may not repeat the Requestor's text, which the AI already reads (400).
 */
async function validatedGenerationInstruction(strapi: Strapi, request: RecordValue, requestId: string, analystId: string, raw: unknown): Promise<string | null> {
  let parsed: ReturnType<typeof parseAnalystInstruction>;
  try {
    parsed = parseAnalystInstruction(raw);
  } catch (error) {
    if (error instanceof InstructionShapeError) throw new QuestionnaireGenerationWorkflowError(400, "Questionnaire generation data is invalid.");
    throw error;
  }
  if (!parsed.ok) throw new QuestionnaireGenerationWorkflowError(400, "CSRM analyst instruction is not allowed.", parsed.reason);
  if (parsed.instruction === null) return null;
  if (relationId(request.requestor) === analystId) throw new QuestionnaireGenerationWorkflowError(403, "Questionnaire generation cannot be steered on a request you raised.", "OWN_REQUEST");
  const questionnaireId = record(request.questionnaire) && typeof request.questionnaire.documentId === "string" ? request.questionnaire.documentId : "";
  const corpus = await loadRequestorTextCorpus(strapi as never, { requestId, questionnaireId });
  if (repeatsRequestorText(parsed.instruction, corpus)) {
    throw new QuestionnaireGenerationWorkflowError(400, "The instruction repeats the Requestor’s text, which the AI already reads.", "INSTRUCTION_REPEATS_REQUESTOR_TEXT");
  }
  return parsed.instruction;
}
export async function generateQuestionnaire(input: { strapi: Strapi; requestId: string; replaceUnansweredQuestionnaire?: boolean; instruction?: unknown } & QuestionnaireJobViewer): Promise<RecordValue> { const request = await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: input.requestId, populate: { questionnaire: true, informationAssets: true, requestor: { fields: ["documentId"] } } }); if (!request) throw new QuestionnaireGenerationWorkflowError(404, "Assessment request was not found."); if (request.requestStatus !== "submitted") throw new QuestionnaireGenerationWorkflowError(409, "Assessment request is not eligible for questionnaire generation.", "REQUEST_NOT_ELIGIBLE");
  const instruction = await validatedGenerationInstruction(input.strapi, request, input.requestId, input.analystDocumentId, input.instruction);
  // D-09: the Requestor can already see a released questionnaire, so it is never replaced; the analyst returns it to analyst review first. Refused before a job is queued.
  if (record(request.questionnaire) && isReleased(request.questionnaire)) throw new QuestionnaireGenerationWorkflowError(409, RELEASED_REPLACEMENT_MESSAGE, "QUESTIONNAIRE_RELEASED");
  // Phase 15 D-08, D-09 and Q-1: an acknowledged replacement meets the same refusals before a job is queued as it does in the job.
  if (record(request.questionnaire) && input.replaceUnansweredQuestionnaire === true && typeof request.questionnaire.documentId === "string") {
    const existing = await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({ documentId: request.questionnaire.documentId, populate: { questions: true } });
    const refusal = existing ? await replacementRefusal(input.strapi, existing) : null;
    if (refusal) throw new QuestionnaireGenerationWorkflowError(409, refusal.message, refusal.reason);
  }
  refuseGenerationByAiDataPolicy(input.strapi, request);
  const viewer = actor(input.analystDocumentId, input.humanAnalyst);
  // A start may hand back the request's active job, which another analyst started; the projection says so (D-18).
  const queued = registry(input.strapi).enqueue({ requestId: input.requestId, initiatingAnalystDocumentId: viewer.documentId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version, replaceUnansweredQuestionnaire: input.replaceUnansweredQuestionnaire === true, instruction });
  return projectQuestionnaireGenerationJob(queued, null, await questionnaireJobViewerFacts(input.strapi, queued, viewer)); }
async function job(input: { strapi: Strapi; jobId: string; retry?: boolean } & QuestionnaireJobViewer): Promise<RecordValue> { const viewer = actor(input.analystDocumentId, input.humanAnalyst); const result = input.retry ? registry(input.strapi).retry(input.jobId, viewer) : registry(input.strapi).get(input.jobId, viewer); const questionnaire = result.questionnaireId ? await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({ documentId: result.questionnaireId, populate: { generatedBy: true, assessmentRequest: true, questions: true } }) : null; if (result.status === "completed" && !questionnaire) throw new QuestionnaireGenerationWorkflowError(409, "Generated questionnaire could not be loaded."); const names = await resolveContextAttachments(input.strapi as unknown as ContextAttachmentReader, failureAttachmentIds(result.failure)); return projectQuestionnaireGenerationJob(result, questionnaire, await questionnaireJobViewerFacts(input.strapi, result, viewer), names); }
/* D-18: any human Security Analyst reads a retained job by id (the humanAnalyst fact); without it, only its initiator. */
export const getQuestionnaireGenerationJob = (input: { strapi: Strapi; jobId: string } & QuestionnaireJobViewer) => job(input);
/*
 * D-25, D-18: a request's current generation jobs, for any human analyst who may
 * review it (the route's grant and human-analyst guard decide who that is).
 * Each job keeps its closed projection with the D-18 viewer facts: who started
 * it, whether this viewer did, and whether this viewer may retry it (also the
 * entry's `canRetry`, which 10-13's parser reads). Both initiators are resolved
 * with one bounded people read. Jobs are process-local (R-08-36), so after a
 * restart both entries are null. A completed job whose questionnaire can no
 * longer be loaded is no current job at all, so it reads as null rather than
 * failing the whole read.
 */
export async function getRequestGenerationJobs(input: { strapi: Strapi; requestId: string; viewerDocumentId: string; humanAnalyst?: boolean }): Promise<RecordValue> {
  const viewer = actor(input.viewerDocumentId, input.humanAnalyst);
  const request = await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: input.requestId, populate: { questionnaire: true, informationAssets: true, requestor: { fields: ["documentId"] } } });
  if (!request) throw new QuestionnaireGenerationWorkflowError(404, "Assessment request was not found.");
  const latest = registry(input.strapi).latestForRequest(input.requestId, viewer);
  let generation: { job: QuestionnaireGenerationJobRecord; canRetry: boolean; questionnaire: RecordValue | null } | null = null;
  if (latest) {
    const questionnaire = latest.job.status === "completed" && latest.job.questionnaireId
      ? await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({ documentId: latest.job.questionnaireId, populate: { generatedBy: true } })
      : null;
    if (latest.job.status !== "completed" || questionnaire) generation = { ...latest, questionnaire, canRetry: latest.canRetry && !instructedOwnRequest(latest.job, request, viewer.documentId) };
  }
  // The draft registry is keyed by questionnaire, so the request's own questionnaire names its draft job.
  const questionnaireId = record(request.questionnaire) && typeof request.questionnaire.documentId === "string" ? request.questionnaire.documentId : null;
  const draft = questionnaireId ? latestAssessmentDraftJobForQuestionnaire(input.strapi as never, questionnaireId, { analystDocumentId: viewer.documentId, humanAnalyst: viewer.canReadAllQuestionnaireGenerationJobs }) : null;
  const initiators = await resolveGenerationJobInitiators(input.strapi, [generation?.job.initiatingAnalystDocumentId, draft?.job.initiatingAnalystDocumentId].filter((id): id is string => typeof id === "string"));
  const facts = (initiatorDocumentId: string, canRetry: boolean) => generationJobViewerFacts({ initiatorDocumentId, viewerDocumentId: viewer.documentId, canRetry, initiators });
  // D-33: both jobs' failures name their files with one read.
  const names = await resolveContextAttachments(input.strapi as unknown as ContextAttachmentReader, [...failureAttachmentIds(generation?.job.failure), ...failureAttachmentIds(draft?.job.failure)]);
  const questionnaireGeneration = generation ? { job: projectQuestionnaireGenerationJob(generation.job, generation.questionnaire, facts(generation.job.initiatingAnalystDocumentId, generation.canRetry), names), canRetry: generation.canRetry } : null;
  const assessmentDraft = draft ? { job: projectAssessmentDraftJob(draft.job, facts(draft.job.initiatingAnalystDocumentId, draft.canRetry), names), canRetry: draft.canRetry } : null;
  // D-29: the policy the next enqueue would apply, so the hub never offers a generation the server would refuse.
  const assets = Array.isArray(request.informationAssets) ? request.informationAssets.filter(record) : [];
  const aiPolicy = evaluateAiDataPolicy({ assets, ...readAiDataPolicyConfiguration(input.strapi) });
  return { questionnaireGeneration, assessmentDraft, aiPolicy };
}
/*
 * IN-104 and WR-308 (D-28): a retry is a new attempt, so the AI data policy that refuses an enqueue refuses a retry the
 * same way, with the same 409 reason, before anything is queued: no new attempt and no run. The registry first answers
 * for the job (404, or 403 for a caller who may not follow it), and a job that has not failed keeps its own 409. A
 * request that can no longer be read is left to the job's execution, which re-checks everything before any run or
 * provider call. D-18: the retry is the retrying analyst's attempt (the registry re-attributes it).
 */
export async function retryQuestionnaireGenerationJob(input: { strapi: Strapi; jobId: string } & QuestionnaireJobViewer): Promise<RecordValue> {
  const current = registry(input.strapi).get(input.jobId, actor(input.analystDocumentId, input.humanAnalyst));
  if (current.status === "failed") {
    const request = await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: current.requestId, populate: { informationAssets: true, requestor: { fields: ["documentId"] } } });
    // Phase 15 D-32: retrying an instructed job would steer the AI too, so its requesting analyst may not.
    if (instructedOwnRequest(current, request, input.analystDocumentId)) throw new QuestionnaireGenerationWorkflowError(403, "Questionnaire generation cannot be steered on a request you raised.", "OWN_REQUEST");
    if (request) refuseGenerationByAiDataPolicy(input.strapi, request);
  }
  return job({ ...input, retry: true });
}
/*
 * The review queues bind the active request ids into an IN / NOT IN predicate,
 * so the snapshot is bounded. One job runs per request and generation is an
 * analyst action, so the cap is unreachable in practice; exceeding it means
 * something is wrong, and the read fails closed rather than binding an
 * unbounded parameter list.
 */
export const MAX_ACTIVE_GENERATION_REQUEST_IDS = 1_000;
export class QuestionnaireGenerationCapacityError extends Error {
  constructor() {
    super("Active questionnaire generation exceeds the review queue bound.");
    this.name = "QuestionnaireGenerationCapacityError";
  }
}
export function assertActiveGenerationCapacity(ids: readonly string[]): readonly string[] {
  if (ids.length > MAX_ACTIVE_GENERATION_REQUEST_IDS) throw new QuestionnaireGenerationCapacityError();
  return ids;
}
/** A sorted, bounded snapshot of the request ids with a queued or running generation job in this process. */
export function activeQuestionnaireGenerationRequestIds(strapi: Strapi): readonly string[] {
  return assertActiveGenerationCapacity(registry(strapi).activeRequestIds());
}
export { QuestionnaireGenerationRegistryError };
