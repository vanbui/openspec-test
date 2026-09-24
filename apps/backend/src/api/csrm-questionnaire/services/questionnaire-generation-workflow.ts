import { createWithQuestionnaireNumber } from "./questionnaire-number";
import { deterministicQuestionnaireGenerationProvider } from "./deterministic-questionnaire-generation-provider";
import { openaiCompatibleQuestionnaireGenerationProvider } from "./openai-compatible-questionnaire-generation-provider";
import { createQuestionnaireGenerationRegistry, QuestionnaireGenerationJobFailure, QuestionnaireGenerationRegistryError, type QuestionnaireGenerationJobActor, type QuestionnaireGenerationJobRecord } from "./questionnaire-generation-registry";
import { validatedGenerationQuestions } from "./questionnaire-generation-provider";
import { CSRM_AI_PROVIDER_MODE } from "../../../csrm/ai-provider-selection";

type RecordValue = Record<string, unknown>; const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
type Documents = { findOne: (query: RecordValue) => Promise<RecordValue | null>; findMany: (query: RecordValue) => Promise<RecordValue[]>; create: (query: { data: RecordValue }) => Promise<RecordValue>; update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>; delete: (query: { documentId: string }) => Promise<void> };
type Strapi = { documents: (uid: string) => Documents; db: { transaction: <T>(fn: (arg: { trx: unknown }) => Promise<T>) => Promise<T>; queryBuilder: (uid: string) => { select: (items: string[]) => unknown; where: (items: RecordValue) => unknown; forUpdate: () => unknown; transacting: (trx: unknown) => unknown; execute: <T>() => Promise<T> } } };
export class QuestionnaireGenerationWorkflowError extends Error { constructor(public readonly status: 400 | 403 | 404 | 409, message: string) { super(message); } }
const registryByStrapi = new WeakMap<object, ReturnType<typeof createQuestionnaireGenerationRegistry>>();
const activeQuestionnaireGenerationProvider = CSRM_AI_PROVIDER_MODE === "openai-compatible" ? openaiCompatibleQuestionnaireGenerationProvider : deterministicQuestionnaireGenerationProvider;
const relationId = (value: unknown) => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
function actor(documentId: string): QuestionnaireGenerationJobActor { if (!documentId) throw new QuestionnaireGenerationWorkflowError(403, "Questionnaire generation is denied."); return { documentId, canReadAllQuestionnaireGenerationJobs: false }; }
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
async function lock(strapi: Strapi, documentId: string, trx: unknown) { const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request"); query.select(["id"]); query.where({ documentId }); query.forUpdate(); query.transacting(trx); await query.execute(); }
export async function persistGeneratedQuestionnaire(strapi: Strapi, requestId: string, analystId: string, replaceUnansweredQuestionnaire: boolean): Promise<{ questionnaireId: string }> {
  const requests = strapi.documents("api::csrm-assessment-request.csrm-assessment-request"); const questionnaires = strapi.documents("api::csrm-questionnaire.csrm-questionnaire"); const questions = strapi.documents("api::csrm-question.csrm-question");
  const request = await requests.findOne({ documentId: requestId, populate: { questionnaire: { populate: { questions: true } } } });
  if (!request) throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_FOUND", "Assessment request was not found.");
  if (request.requestStatus !== "submitted") throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_ELIGIBLE", "Assessment request is not eligible for questionnaire generation.");
  const proposal = await activeQuestionnaireGenerationProvider.generate({ title: String(request.title ?? "Assessment request"), description: typeof request.description === "string" ? request.description : null, assessmentType: typeof request.assessmentType === "string" ? request.assessmentType : null, businessPurpose: typeof request.businessPurpose === "string" ? request.businessPurpose : null, businessCriticality: typeof request.businessCriticality === "string" ? request.businessCriticality : null, thirdPartyInvolvement: request.thirdPartyInvolvement === true, thirdPartyDetails: typeof request.thirdPartyDetails === "string" ? request.thirdPartyDetails : null });
  const definition = validatedGenerationQuestions(proposal); const generatedDate = new Date().toISOString();
  return strapi.db.transaction(async ({ trx }) => { await lock(strapi, requestId, trx); const current = await requests.findOne({ documentId: requestId, populate: { questionnaire: { populate: { questions: true } } } }); if (!current || current.requestStatus !== "submitted") throw new QuestionnaireGenerationJobFailure("REQUEST_NOT_ELIGIBLE", "Assessment request is not eligible for questionnaire generation."); const existing = record(current.questionnaire) ? current.questionnaire : null; if (existing && !replaceUnansweredQuestionnaire) throw new QuestionnaireGenerationJobFailure("QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED", "Unanswered questionnaire replacement requires acknowledgement."); if (existing && hasQuestionnaireAnswerEvidence(existing.questions)) throw new QuestionnaireGenerationJobFailure("QUESTIONNAIRE_ANSWERED", "Answered questionnaires cannot be regenerated.");
    let questionnaireId: string; if (existing && typeof existing.documentId === "string") { questionnaireId = existing.documentId; for (const row of Array.isArray(existing.questions) ? existing.questions : []) if (record(row) && typeof row.documentId === "string") await questions.delete({ documentId: row.documentId }); await questionnaires.update({ documentId: questionnaireId, data: { title: proposal.title, ...(proposal.description ? { description: proposal.description } : {}), generatedDate, generatedBy: analystId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version } }); } else { const created = await createWithQuestionnaireNumber((questionnaireNumber) => questionnaires.create({ data: { questionnaireNumber, title: proposal.title, ...(proposal.description ? { description: proposal.description } : {}), assessmentRequest: requestId, generatedDate, generatedBy: analystId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version } })); if (typeof created.documentId !== "string") throw new Error("Questionnaire persistence failed."); questionnaireId = created.documentId; }
    for (const question of definition) await questions.create({ data: { questionnaire: questionnaireId, questionText: question.questionText, answerType: question.answerType, options: { schemaVersion: 1, questionKey: question.questionKey, section: question.section, order: question.order, required: question.required, ...(question.visibility ? { visibility: question.visibility } : {}), ...(question.choices ? { choices: question.choices } : {}) }, answer: null } }); return { questionnaireId }; });
}
function registry(strapi: Strapi) { const existing = registryByStrapi.get(strapi as object); if (existing) return existing; const created = createQuestionnaireGenerationRegistry({ execute: ({ requestId, initiatingAnalystDocumentId, replaceUnansweredQuestionnaire }) => persistGeneratedQuestionnaire(strapi, requestId, initiatingAnalystDocumentId, replaceUnansweredQuestionnaire) }); registryByStrapi.set(strapi as object, created); return created; }
/*
 * The initiating analyst is held in the registry for actor scoping and is not
 * projected, matching projectAssessmentDraftJob. Only that analyst can read the
 * job at all, so echoing their own identifier back adds nothing and the closed
 * client schema rejects the unrecognised key.
 */
export function projectQuestionnaireGenerationJob(job: QuestionnaireGenerationJobRecord, questionnaire?: RecordValue | null): RecordValue { return { jobId: job.jobId, requestId: job.requestId, providerName: job.providerName, providerVersion: job.providerVersion, status: job.status, attempt: job.attempt, queuedAt: job.queuedAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.completedAt ? { completedAt: job.completedAt } : {}), ...(job.failure ? { failureCode: job.failure.code, failureMessage: job.failure.message } : {}), ...(job.status === "completed" && questionnaire ? { questionnaire: projectGeneratedQuestionnaire(questionnaire) } : {}) }; }

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
export async function generateQuestionnaire(input: { strapi: Strapi; requestId: string; analystDocumentId: string; replaceUnansweredQuestionnaire?: boolean }): Promise<RecordValue> { const request = await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: input.requestId }); if (!request) throw new QuestionnaireGenerationWorkflowError(404, "Assessment request was not found."); if (request.requestStatus !== "submitted") throw new QuestionnaireGenerationWorkflowError(409, "Assessment request is not eligible for questionnaire generation."); return projectQuestionnaireGenerationJob(registry(input.strapi).enqueue({ requestId: input.requestId, initiatingAnalystDocumentId: actor(input.analystDocumentId).documentId, providerName: activeQuestionnaireGenerationProvider.name, providerVersion: activeQuestionnaireGenerationProvider.version, replaceUnansweredQuestionnaire: input.replaceUnansweredQuestionnaire === true })); }
async function job(input: { strapi: Strapi; jobId: string; analystDocumentId: string; retry?: boolean }): Promise<RecordValue> { const result = input.retry ? registry(input.strapi).retry(input.jobId, actor(input.analystDocumentId)) : registry(input.strapi).get(input.jobId, actor(input.analystDocumentId)); const questionnaire = result.questionnaireId ? await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({ documentId: result.questionnaireId, populate: { generatedBy: true, assessmentRequest: true, questions: true } }) : null; if (result.status === "completed" && !questionnaire) throw new QuestionnaireGenerationWorkflowError(409, "Generated questionnaire could not be loaded."); return projectQuestionnaireGenerationJob(result, questionnaire); }
export const getQuestionnaireGenerationJob = (input: { strapi: Strapi; jobId: string; analystDocumentId: string }) => job(input);
export const retryQuestionnaireGenerationJob = (input: { strapi: Strapi; jobId: string; analystDocumentId: string }) => job({ ...input, retry: true });
export function hasActiveQuestionnaireGeneration(strapi: Strapi, requestId: string): boolean {
  return registry(strapi).hasActiveJob(requestId);
}
export { QuestionnaireGenerationRegistryError };
