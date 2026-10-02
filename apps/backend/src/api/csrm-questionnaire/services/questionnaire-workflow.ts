import {
  activeQuestionnaireDefinition,
  getVisibleQuestionKeys,
  isQuestionnaireValueValid,
  parseQuestionnaireDefinition,
  QuestionnaireDefinitionError,
  type QuestionnaireDefinitionQuestion,
  type QuestionnaireValue,
} from "./questionnaire-definition";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { parseRevertReason } from "../../csrm-assessment-request/services/revert-reason";
import { lockQuestionnaireAndRequest } from "./questionnaire-row-locks";

type RecordValue = Record<string, unknown>;
export type AnswerEnvelope = {
  schemaVersion: 1;
  value: QuestionnaireValue;
  state: "draft" | "submitted";
  updatedAt: string;
  submittedAt?: string;
};
type AnswerUpdate = { questionKey: string; value: QuestionnaireValue };

/**
 * The request stages that follow the questionnaire: the assessment draft moves the request to
 * `risk-assessment-drafted`, so from there on the questionnaire is evidence for an assessment.
 */
export const ASSESSMENT_STAGE_REQUEST_STATUSES = Object.freeze(["risk-assessment-drafted", "under-review", "approved", "closed"] as const);

export class QuestionnaireWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "QuestionnaireWorkflowError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function parseAnswerMutationPayload(input: unknown): AnswerUpdate[] {
  if (!isRecord(input) || !exactKeys(input, ["answers"]) || !Array.isArray(input.answers) || input.answers.length > 10_000) {
    throw new QuestionnaireWorkflowError(400, "CSRM questionnaire answers are invalid.");
  }
  const keys = new Set<string>();
  return input.answers.map((entry) => {
    if (!isRecord(entry)
      || !exactKeys(entry, ["questionKey", "value"])
      || typeof entry.questionKey !== "string"
      || entry.questionKey.trim().length === 0
      || keys.has(entry.questionKey)) {
      throw new QuestionnaireWorkflowError(400, "CSRM questionnaire answers are invalid.");
    }
    keys.add(entry.questionKey);
    return { questionKey: entry.questionKey, value: entry.value as QuestionnaireValue };
  });
}

export function parseAnswerEnvelope(value: unknown): AnswerEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== 1
    || (value.state !== "draft" && value.state !== "submitted")
    || typeof value.updatedAt !== "string"
    || Number.isNaN(Date.parse(value.updatedAt))) return null;
  const allowed = value.state === "submitted"
    ? ["schemaVersion", "value", "state", "updatedAt", "submittedAt"]
    : ["schemaVersion", "value", "state", "updatedAt"];
  if (!exactKeys(value, allowed)) return null;
  if (value.state === "submitted"
    && (typeof value.submittedAt !== "string" || Number.isNaN(Date.parse(value.submittedAt)))) return null;
  return value as AnswerEnvelope;
}

function currentValues(answers: Record<string, AnswerEnvelope>): Record<string, QuestionnaireValue> {
  return Object.fromEntries(Object.entries(answers).map(([key, answer]) => [key, answer.value]));
}

export function normalizeDraftAnswers(
  definition: QuestionnaireDefinitionQuestion[],
  current: Record<string, AnswerEnvelope>,
  updates: AnswerUpdate[],
  now = new Date(),
): Record<string, AnswerEnvelope> {
  assertMutableAnswerBatch(current);
  const activeDefinition = activeQuestionnaireDefinition(definition);
  const questions = new Map(activeDefinition.map((question) => [question.questionKey, question]));
  const next = { ...current };
  for (const update of updates) {
    const question = questions.get(update.questionKey);
    if (!question || !isQuestionnaireValueValid(question, update.value)) {
      throw new QuestionnaireWorkflowError(400, "CSRM questionnaire answers are invalid.");
    }
    next[update.questionKey] = {
      schemaVersion: 1,
      value: update.value,
      state: "draft",
      updatedAt: now.toISOString(),
    };
  }
  const visible = new Set(getVisibleQuestionKeys(definition, currentValues(next)));
  return Object.fromEntries(Object.entries(next).filter(([key]) => visible.has(key)));
}

export function nextRequestStatusAfterDraft(status: string): string {
  if (status === "submitted") return "questionnaire-in-progress";
  if (status === "questionnaire-in-progress") return status;
  throw new QuestionnaireWorkflowError(409, "CSRM questionnaire is not answerable.", "QUESTIONNAIRE_NOT_ANSWERABLE");
}

export function assertMutableAnswerBatch(answers: Record<string, unknown>): void {
  if (Object.values(answers).some((answer) => isRecord(answer) && answer.state === "submitted")) {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire has already been submitted.", "QUESTIONNAIRE_ALREADY_SUBMITTED");
  }
}

function hasValue(value: QuestionnaireValue): boolean {
  return value !== null && (typeof value !== "string" || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0);
}

export function buildSubmittedAnswerBatch(
  definition: QuestionnaireDefinitionQuestion[],
  answers: Record<string, AnswerEnvelope>,
  now = new Date(),
): Record<string, AnswerEnvelope> {
  assertMutableAnswerBatch(answers);
  if (activeQuestionnaireDefinition(definition).length === 0) {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire has no active questions.", "QUESTIONNAIRE_HAS_NO_QUESTIONS");
  }
  const values = currentValues(answers);
  const visible = new Set(getVisibleQuestionKeys(definition, values));
  for (const question of activeQuestionnaireDefinition(definition)) {
    if (!visible.has(question.questionKey)) continue;
    const value = values[question.questionKey] ?? null;
    if (!isQuestionnaireValueValid(question, value)
      || (question.required && (!hasValue(value) || question.answerType === "File upload"))) {
      throw new QuestionnaireWorkflowError(409, "CSRM questionnaire is incomplete.", "QUESTIONNAIRE_INCOMPLETE");
    }
  }
  const timestamp = now.toISOString();
  return Object.fromEntries(activeQuestionnaireDefinition(definition)
    .filter((question) => visible.has(question.questionKey))
    .map((question) => [question.questionKey, {
      schemaVersion: 1 as const,
      value: values[question.questionKey] ?? null,
      state: "submitted" as const,
      updatedAt: timestamp,
      submittedAt: timestamp,
    }]));
}

async function persistAnswerBatch(
  updates: Array<{ documentId: string; answer: unknown }>,
  update: (documentId: string, answer: unknown) => Promise<void>,
): Promise<void> {
  for (const answerUpdate of updates) await update(answerUpdate.documentId, answerUpdate.answer);
}

type DocumentService = {
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
type WorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: {
    transaction: <T>(work: (context: { trx: unknown }) => Promise<T>) => Promise<T>;
    queryBuilder: (uid: string) => {
      select: (columns: string[]) => unknown;
      where: (where: RecordValue) => unknown;
      forUpdate: () => unknown;
      transacting: (transaction: unknown) => unknown;
      execute: <T>() => Promise<T>;
    };
  };
};
type WorkflowInput = {
  strapi: WorkflowStrapi;
  questionnaireDocumentId: string;
  actor: "requestor" | "analyst";
  actorDocumentId?: string;
  body: unknown;
  now?: Date;
};

const questionnaireMutationTails = new Map<string, Promise<void>>();

async function serializeQuestionnaireMutation<T>(documentId: string, work: () => Promise<T>): Promise<T> {
  const previous = questionnaireMutationTails.get(documentId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  questionnaireMutationTails.set(documentId, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (questionnaireMutationTails.get(documentId) === tail) questionnaireMutationTails.delete(documentId);
  }
}

/*
 * An answer save writes the questions and then the request's status, so it takes the request row and then
 * the questionnaire row up front: the one order a replacement and every governance mutation take (CR-101),
 * so none of them can deadlock with it.
 */
async function lockQuestionnaire(strapi: WorkflowStrapi, documentId: string, transaction: unknown): Promise<void> {
  await lockQuestionnaireAndRequest(strapi, documentId, transaction);
}

async function runQuestionnaireMutation<T>(input: WorkflowInput, work: () => Promise<T>): Promise<T> {
  if (input.actor !== "requestor") throw new QuestionnaireWorkflowError(403, "CSRM questionnaire mutation is denied.");
  return serializeQuestionnaireMutation(input.questionnaireDocumentId, () =>
    input.strapi.db.transaction(async ({ trx }) => {
      await lockQuestionnaire(input.strapi, input.questionnaireDocumentId, trx);
      return work();
    }));
}

async function runQuestionnaireReversal<T>(input: WorkflowInput, work: () => Promise<T>): Promise<T> {
  if ((input.actor !== "requestor" && input.actor !== "analyst") || !input.actorDocumentId) {
    throw new QuestionnaireWorkflowError(403, "CSRM questionnaire reversal is denied.");
  }
  return serializeQuestionnaireMutation(input.questionnaireDocumentId, () =>
    input.strapi.db.transaction(async ({ trx }) => {
      await lockQuestionnaire(input.strapi, input.questionnaireDocumentId, trx);
      return work();
    }));
}

function answerMap(definition: QuestionnaireDefinitionQuestion[]): Record<string, AnswerEnvelope> {
  const answers: Record<string, AnswerEnvelope> = {};
  for (const question of activeQuestionnaireDefinition(definition)) {
    if (question.answer === null || question.answer === undefined) continue;
    const parsed = parseAnswerEnvelope(question.answer);
    if (!parsed || !isQuestionnaireValueValid(question, parsed.value)) {
      throw new QuestionnaireWorkflowError(400, "CSRM questionnaire answer data is invalid.");
    }
    answers[question.questionKey] = parsed;
  }
  return answers;
}

async function loadWorkflow(input: WorkflowInput): Promise<{
  questionnaire: RecordValue;
  request: RecordValue;
  definition: QuestionnaireDefinitionQuestion[];
}> {
  if (input.actor !== "requestor") throw new QuestionnaireWorkflowError(403, "CSRM questionnaire mutation is denied.");
  const questionnaire = await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
    documentId: input.questionnaireDocumentId,
    populate: { assessmentRequest: true, questions: true },
  });
  if (!questionnaire) throw new QuestionnaireWorkflowError(404, "CSRM questionnaire was not found.");
  const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  if (!request || typeof request.documentId !== "string" || typeof request.requestStatus !== "string") {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire is not answerable.", "QUESTIONNAIRE_NOT_ANSWERABLE");
  }
  try {
    return {
      questionnaire,
      request,
      definition: parseQuestionnaireDefinition(questionnaire.questions),
    };
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) {
      throw new QuestionnaireWorkflowError(400, error.message);
    }
    throw error;
  }
}

async function loadReversalWorkflow(input: WorkflowInput): Promise<{
  questionnaire: RecordValue;
  request: RecordValue;
  definition: QuestionnaireDefinitionQuestion[];
}> {
  const questionnaire = await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
    documentId: input.questionnaireDocumentId,
    populate: { assessmentRequest: { populate: { assessment: true } }, questions: true },
  });
  if (!questionnaire) throw new QuestionnaireWorkflowError(404, "CSRM questionnaire was not found.");
  const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  if (!request || typeof request.documentId !== "string") {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire cannot be reverted to draft.", "REQUEST_NOT_ELIGIBLE");
  }
  if (request.assessment || ASSESSMENT_STAGE_REQUEST_STATUSES.includes(request.requestStatus as never)) {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire cannot be reverted to draft.", "ASSESSMENT_STARTED");
  }
  if (request.requestStatus !== "questionnaire-in-progress") {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire cannot be reverted to draft.", "REQUEST_NOT_ELIGIBLE");
  }
  try {
    return { questionnaire, request, definition: parseQuestionnaireDefinition(questionnaire.questions) };
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) throw new QuestionnaireWorkflowError(400, error.message);
    throw error;
  }
}

async function persistAnswers(
  strapi: WorkflowStrapi,
  definition: QuestionnaireDefinitionQuestion[],
  answers: Record<string, AnswerEnvelope>,
): Promise<void> {
  await persistAnswerBatch(activeQuestionnaireDefinition(definition).map((question) => ({
    documentId: question.documentId,
    answer: answers[question.questionKey] ?? null,
  })), async (documentId, answer) => {
    await strapi.documents("api::csrm-question.csrm-question").update({
      documentId,
      data: { answer },
    });
  });
}

export async function saveAnswers(input: WorkflowInput): Promise<RecordValue> {
  const updates = parseAnswerMutationPayload(input.body);
  return runQuestionnaireMutation(input, async () => {
    const { questionnaire, request, definition } = await loadWorkflow(input);
    const requestStatus = nextRequestStatusAfterDraft(String(request.requestStatus));
    const answers = normalizeDraftAnswers(definition, answerMap(definition), updates, input.now);
    await persistAnswers(input.strapi, definition, answers);
    if (requestStatus !== request.requestStatus) {
      await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
        documentId: String(request.documentId),
        data: { requestStatus },
      });
    }
    return { ...questionnaire, assessmentRequest: { ...request, requestStatus }, questions: definition.map((question) => ({ ...question, answer: answers[question.questionKey] ?? null })) };
  });
}

export async function submitQuestionnaire(input: WorkflowInput): Promise<RecordValue> {
  const updates = input.body === undefined ? [] : parseAnswerMutationPayload(input.body);
  return runQuestionnaireMutation(input, async () => {
    const { questionnaire, request, definition } = await loadWorkflow(input);
    const requestStatus = nextRequestStatusAfterDraft(String(request.requestStatus));
    const current = answerMap(definition);
    const draft = updates.length ? normalizeDraftAnswers(definition, current, updates, input.now) : current;
    const submitted = buildSubmittedAnswerBatch(definition, draft, input.now);
    await persistAnswers(input.strapi, definition, submitted);
    if (requestStatus !== request.requestStatus) {
      await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
        documentId: String(request.documentId),
        data: { requestStatus },
      });
    }
    return { ...questionnaire, assessmentRequest: { ...request, requestStatus }, questions: definition.map((question) => ({ ...question, answer: submitted[question.questionKey] ?? null })) };
  });
}

export function buildDraftAnswerBatch(
  definition: QuestionnaireDefinitionQuestion[],
  answers: Record<string, AnswerEnvelope>,
  now = new Date(),
): Record<string, AnswerEnvelope> {
  const visible = new Set(getVisibleQuestionKeys(definition, currentValues(answers)));
  const active = activeQuestionnaireDefinition(definition).filter((question) => visible.has(question.questionKey));
  if (active.length === 0 || active.some((question) => answers[question.questionKey]?.state !== "submitted")) {
    throw new QuestionnaireWorkflowError(409, "CSRM questionnaire is not submitted.", "QUESTIONNAIRE_NOT_SUBMITTED");
  }
  const timestamp = now.toISOString();
  return Object.fromEntries(active.map((question) => {
    const submitted = answers[question.questionKey];
    return [question.questionKey, { schemaVersion: 1 as const, value: submitted.value, state: "draft" as const, updatedAt: timestamp }];
  }));
}

export async function revertQuestionnaireToDraft(input: WorkflowInput): Promise<RecordValue> {
  let reason: string;
  try {
    reason = parseRevertReason(input.body, "CSRM questionnaire");
  } catch (error) {
    throw new QuestionnaireWorkflowError(400, error instanceof Error ? error.message : "CSRM questionnaire reversal data is invalid.");
  }
  return runQuestionnaireReversal(input, async () => {
    const { questionnaire, request, definition } = await loadReversalWorkflow(input);
    const drafts = buildDraftAnswerBatch(definition, answerMap(definition), input.now);
    await persistAnswers(input.strapi, definition, drafts);
    await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").update({
      documentId: input.questionnaireDocumentId,
      data: {
        revertReason: reason,
        revertedAt: (input.now ?? new Date()).toISOString(),
        revertedBy: input.actorDocumentId as string,
      },
    });
    return {
      ...questionnaire,
      assessmentRequest: request,
      revertReason: reason,
      revertedAt: (input.now ?? new Date()).toISOString(),
      revertedBy: input.actorDocumentId,
      questions: definition.map((question) => ({ ...question, answer: drafts[question.questionKey] ?? null })),
    };
  });
}
