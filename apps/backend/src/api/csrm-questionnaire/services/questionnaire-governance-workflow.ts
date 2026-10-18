/*
 * Analyst governance mutations for a questionnaire, starting with release.
 *
 * The transaction shape is deliberately identical to
 * `questionnaire-workflow.ts`: a per-documentId promise-tail queue serialises
 * mutations inside this process, a `db.transaction` wraps the work, and
 * `forUpdate()` row locks are taken before any read so two concurrent releases
 * cannot both observe an absent release fact. The locks are the request's row
 * and then the questionnaire's row, the order a replacement takes them too, so
 * a governance mutation and a replacement never interleave (CR-101,
 * questionnaire-row-locks.ts).
 *
 * The release fact and its governance event are written by a single update
 * inside that one locked transaction, so an authorised reader can never observe
 * a released questionnaire whose log does not record the release.
 */

import {
  QUESTIONNAIRE_ANSWER_TYPES,
  activeQuestionnaireDefinition,
  isQuestionnaireValueValid,
  parseQuestionnaireDefinition,
  QuestionnaireDefinitionError,
  type QuestionnaireAnswerType,
  type QuestionnaireDefinitionQuestion,
} from "./questionnaire-definition";
import { appendGovernanceEvent, GovernanceLogError, questionTextSnapshot } from "./questionnaire-governance-log";
import { parseRevertReason } from "../../csrm-assessment-request/services/revert-reason";
import { ASSESSMENT_STAGE_REQUEST_STATUSES, parseAnswerEnvelope, type AnswerEnvelope } from "./questionnaire-workflow";
import { projectAnalystRevision, projectQuestionnaire } from "./questionnaire-scope";
import { lockQuestionnaireAndRequest } from "./questionnaire-row-locks";
import { allocateQuestionKey, createBatchAllocation } from "./questionnaire-placement";
import { assertNoOpenProposals } from "./questionnaire-proposal-gates";
import type { ConflictReason } from "../../../csrm/conflict-reasons";

type RecordValue = Record<string, unknown>;

const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const QUESTION_UID = "api::csrm-question.csrm-question";

/** The request states in which an analyst-only questionnaire may be released. */
const RELEASABLE_REQUEST_STATUSES = Object.freeze(["submitted", "questionnaire-in-progress"] as const);

export class QuestionnaireGovernanceError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "QuestionnaireGovernanceError";
  }
}

const HISTORY_UNAVAILABLE_MESSAGE = "CSRM questionnaire governance history cannot be extended.";

/**
 * Why the request's stage no longer lets the analyst govern its questionnaire, or undefined while
 * it does. Work on the assessment has started once an assessment exists or the request has reached
 * an assessment stage; any other stage outside the releasable ones is not eligible.
 */
function requestStageConflict(request: RecordValue): ConflictReason | undefined {
  if (request.assessment || (ASSESSMENT_STAGE_REQUEST_STATUSES as readonly unknown[]).includes(request.requestStatus)) return "ASSESSMENT_STARTED";
  if (!(RELEASABLE_REQUEST_STATUSES as readonly unknown[]).includes(request.requestStatus)) return "REQUEST_NOT_ELIGIBLE";
  return undefined;
}

/** Appends one event, turning a log that cannot take it (full at 1,000 entries, or unreadable) into a conflict. */
function appendOrConflict(existing: unknown, event: unknown): ReturnType<typeof appendGovernanceEvent> {
  try {
    return appendGovernanceEvent(existing, event);
  } catch (error) {
    if (error instanceof GovernanceLogError) {
      throw new QuestionnaireGovernanceError(409, HISTORY_UNAVAILABLE_MESSAGE, "HISTORY_UNAVAILABLE");
    }
    throw error;
  }
}

type DocumentService = {
  create?: (query: { data: RecordValue }) => Promise<RecordValue>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};

export type QuestionMutationPayload = {
  questionText?: string;
  answerType?: QuestionnaireAnswerType;
  helpText?: string | null;
  required?: boolean;
  section?: RecordValue;
  order?: number;
  choices?: Array<{ value: string; label: string }>;
  visibility?: RecordValue | null;
};

function mutationError(message = "CSRM questionnaire question data is invalid."): never {
  throw new QuestionnaireGovernanceError(400, message);
}

function exactKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** Parses the published closed question-mutation envelope. */
export function parseQuestionMutationPayload(input: unknown, mode: "add" | "edit"): QuestionMutationPayload {
  if (!isRecord(input) || !exactKeys(input, ["questionText", "answerType", "helpText", "required", "section", "order", "choices", "visibility"])) mutationError();
  const required = ["questionText", "answerType", "required", "section", "order"];
  if ((mode === "add" && required.some((key) => !(key in input))) || (mode === "edit" && Object.keys(input).length === 0)) mutationError();
  if (input.questionText !== undefined && (typeof input.questionText !== "string" || input.questionText.trim().length === 0 || input.questionText.length > 65_535)) mutationError();
  if (input.answerType !== undefined && (!QUESTIONNAIRE_ANSWER_TYPES.includes(input.answerType as QuestionnaireAnswerType) || input.answerType === "File upload")) mutationError();
  if (input.helpText !== undefined && input.helpText !== null && (typeof input.helpText !== "string" || input.helpText.length > 2_000)) mutationError();
  if (input.required !== undefined && typeof input.required !== "boolean") mutationError();
  if (input.order !== undefined && (!Number.isInteger(input.order) || (input.order as number) < 0)) mutationError();
  if (input.section !== undefined && (!isRecord(input.section) || typeof input.section.key !== "string" || typeof input.section.title !== "string" || !Number.isInteger(input.section.order))) mutationError();
  if (input.choices !== undefined && (!Array.isArray(input.choices) || input.choices.length === 0 || input.choices.length > 1_000 || input.choices.some((choice) => !isRecord(choice) || typeof choice.value !== "string" || typeof choice.label !== "string" || choice.value.trim().length === 0 || choice.label.trim().length === 0))) mutationError();
  if (input.visibility !== undefined && input.visibility !== null && (!isRecord(input.visibility) || !exactKeys(input.visibility, ["questionKey", "operator", "value"]))) mutationError();
  return {
    ...(typeof input.questionText === "string" ? { questionText: input.questionText.trim() } : {}),
    ...(input.answerType !== undefined ? { answerType: input.answerType as QuestionnaireAnswerType } : {}),
    ...(input.helpText !== undefined ? { helpText: input.helpText === null ? null : (input.helpText as string).trim() } : {}),
    ...(input.required !== undefined ? { required: input.required as boolean } : {}),
    ...(input.section !== undefined ? { section: input.section as RecordValue } : {}),
    ...(input.order !== undefined ? { order: input.order as number } : {}),
    ...(input.choices !== undefined ? { choices: input.choices as Array<{ value: string; label: string }> } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility as RecordValue | null } : {}),
  };
}

export type GovernanceStrapi = {
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

export type GovernanceWorkflowInput = {
  strapi: GovernanceStrapi;
  questionnaireDocumentId: string;
  actor: "requestor" | "analyst";
  actorDocumentId?: string;
  body: unknown;
  now?: Date;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Governance is an explicit Security Analyst capability. The catalogue already
 * refuses every other identity at the FunctionAPI boundary and the policy
 * refuses an automation identity holding an analyst role name; this is the
 * service-level restatement so the workflow is not reachable by accident from a
 * future caller that forgets a policy.
 */
export function assertAnalystGovernanceActor(input: {
  actor?: unknown;
  actorDocumentId?: unknown;
}): void {
  if (input.actor !== "analyst"
    || typeof input.actorDocumentId !== "string"
    || input.actorDocumentId.trim().length === 0) {
    throw new QuestionnaireGovernanceError(403, "CSRM questionnaire governance is denied.");
  }
}

/**
 * Release takes no request body. D-16 scopes the mandatory reason to the three
 * standalone backward-transition actions, and release is not one of them, so
 * anything other than an absent or empty body is a client error.
 */
function assertEmptyGovernanceBody(body: unknown): void {
  if (body === undefined || body === null) return;
  if (isRecord(body) && Object.keys(body).length === 0) return;
  throw new QuestionnaireGovernanceError(400, "CSRM questionnaire release data is invalid.");
}

const governanceMutationTails = new Map<string, Promise<void>>();

async function serializeGovernanceMutation<T>(documentId: string, work: () => Promise<T>): Promise<T> {
  const previous = governanceMutationTails.get(documentId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  governanceMutationTails.set(documentId, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (governanceMutationTails.get(documentId) === tail) governanceMutationTails.delete(documentId);
  }
}

/**
 * The questionnaire's governance lock (Phase 15 D-16, D-22, D-26; W-8): the one in-process tail every governance write
 * on the questionnaire waits on, then one transaction holding the request's row and the questionnaire's row (CR-101's
 * order). Every append to the governance log happens inside it, so no two writers read the same log and one overwrites
 * the other's event (15-RESEARCH Pitfall 2). It is the actor-free core of `runGovernanceMutation`; an AI proposal job
 * completes inside it, never its provider call. Never nest it for one questionnaire (the tail would wait on itself), and
 * inside it use the Document Service or `strapi.db.query`, never raw knex, which the transaction does not bind.
 */
export async function withQuestionnaireGovernanceLock<T>(strapi: GovernanceStrapi, questionnaireDocumentId: string, work: () => Promise<T>): Promise<T> {
  if (typeof questionnaireDocumentId !== "string" || questionnaireDocumentId.length === 0) {
    throw new QuestionnaireGovernanceError(400, "CSRM questionnaire identifier is invalid.");
  }
  return serializeGovernanceMutation(questionnaireDocumentId, () =>
    strapi.db.transaction(async ({ trx }) => {
      // CR-101: the request row, then the questionnaire row, before the work reads anything.
      await lockQuestionnaireAndRequest(strapi, questionnaireDocumentId, trx);
      return work();
    }));
}

async function runGovernanceMutation<T>(input: GovernanceWorkflowInput, work: () => Promise<T>): Promise<T> {
  assertAnalystGovernanceActor(input);
  return withQuestionnaireGovernanceLock(input.strapi, input.questionnaireDocumentId, work);
}

const GOVERNANCE_POPULATE = {
  assessmentRequest: { populate: { assessment: true } },
  questions: true,
  revertedBy: true,
  releasedBy: true,
} as const;

async function loadGovernanceQuestionnaire(input: GovernanceWorkflowInput): Promise<RecordValue> {
  const questionnaire = await input.strapi.documents(QUESTIONNAIRE_UID).findOne({
    documentId: input.questionnaireDocumentId,
    populate: GOVERNANCE_POPULATE,
  });
  if (!questionnaire) throw new QuestionnaireGovernanceError(404, "CSRM questionnaire was not found.");
  return questionnaire;
}

function assertReleasable(questionnaire: RecordValue): void {
  if (typeof questionnaire.releasedAt === "string" && questionnaire.releasedAt.length > 0) {
    throw new QuestionnaireGovernanceError(409, "CSRM questionnaire has already been released.", "QUESTIONNAIRE_RELEASED");
  }
  const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  if (!request || typeof request.documentId !== "string" || typeof request.requestStatus !== "string") {
    throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be released.", "REQUEST_NOT_ELIGIBLE");
  }
  const stageConflict = requestStageConflict(request);
  if (stageConflict) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be released.", stageConflict);
  try {
    const definition = parseQuestionnaireDefinition(questionnaire.questions);
    if (activeQuestionnaireDefinition(definition).length === 0) {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be released without an active question.", "QUESTIONNAIRE_HAS_NO_QUESTIONS");
    }
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be released.", "DEFINITION_INVALID");
    }
    throw error;
  }
}

/**
 * The dedicated release fact, rather than the narrative governance log, is
 * the authoritative gate for analyst-only questionnaire changes.
 */
export function assertQuestionnaireInAnalystReview(questionnaire: RecordValue, request: RecordValue): void {
  if (typeof questionnaire.releasedAt === "string" && questionnaire.releasedAt.length > 0) {
    throw new QuestionnaireGovernanceError(409, "CSRM questionnaire is not in analyst review.", "QUESTIONNAIRE_RELEASED");
  }
  const stageConflict = requestStageConflict(request);
  if (stageConflict) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire is not in analyst review.", stageConflict);
}

/** Converts submitted answer envelopes back to editable drafts without changing values. */
export function returnAnswersToDraft(
  definition: Array<{ questionKey: string }>,
  answers: Record<string, AnswerEnvelope | null>,
  now = new Date(),
): Record<string, AnswerEnvelope | null> {
  const timestamp = now.toISOString();
  return Object.fromEntries(definition.map(({ questionKey }) => {
    const answer = answers[questionKey];
    if (!answer || answer.state !== "submitted") return [questionKey, answer] as const;
    return [questionKey, {
      schemaVersion: 1 as const,
      value: answer.value,
      state: "draft" as const,
      updatedAt: timestamp,
    }] as const;
  }));
}

function governanceAnswerMap(definition: Array<{ questionKey: string; answer: unknown }>): Record<string, AnswerEnvelope | null> {
  const answers: Record<string, AnswerEnvelope | null> = {};
  for (const question of definition) {
    if (question.answer === null || question.answer === undefined) {
      answers[question.questionKey] = null;
      continue;
    }
    const answer = parseAnswerEnvelope(question.answer);
    if (!answer) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire answer data is invalid.", "ANSWER_DATA_INVALID");
    answers[question.questionKey] = answer;
  }
  return answers;
}

export async function returnQuestionnaireToAnalystReview(input: GovernanceWorkflowInput): Promise<RecordValue> {
  let reason: string;
  try {
    reason = parseRevertReason(input.body, "CSRM questionnaire");
  } catch (error) {
    throw new QuestionnaireGovernanceError(400, error instanceof Error ? error.message : "CSRM questionnaire reversal data is invalid.");
  }
  return runGovernanceMutation(input, async () => {
    const questionnaire = await loadGovernanceQuestionnaire(input);
    const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
    if (!request || typeof request.requestStatus !== "string") {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be returned to review.", "REQUEST_NOT_ELIGIBLE");
    }
    if (!(typeof questionnaire.releasedAt === "string" && questionnaire.releasedAt.length > 0)) {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire is already in analyst review.", "ALREADY_IN_ANALYST_REVIEW");
    }
    const definition = parseQuestionnaireDefinition(questionnaire.questions);
    try {
      assertQuestionnaireInAnalystReview({ ...questionnaire, releasedAt: null }, request);
    } catch (error) {
      if (error instanceof QuestionnaireGovernanceError) {
        throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be returned to review.", error.reason);
      }
      throw error;
    }
    const now = input.now ?? new Date();
    const answers = returnAnswersToDraft(definition, governanceAnswerMap(definition), now);
    // The log is extended before any answer is written, so a log that cannot take the event
    // refuses the return without leaving answers returned to draft.
    const governanceLog = appendOrConflict(questionnaire.governanceLog, {
      schemaVersion: 1,
      kind: "returned-to-review",
      at: now.toISOString(),
      by: input.actorDocumentId as string,
      reason,
    });
    for (const question of definition) {
      await input.strapi.documents(QUESTION_UID).update({
        documentId: question.documentId,
        data: { answer: answers[question.questionKey] ?? null },
      });
    }
    await input.strapi.documents(QUESTIONNAIRE_UID).update({
      documentId: input.questionnaireDocumentId,
      data: { releasedAt: null, releasedBy: null, governanceLog },
    });
    // The published operation returns QuestionnaireGovernanceResult, the same
    // shape as every other governance mutation, so the typed client can parse
    // one response type for all of them.
    return resultForGovernance(await loadGovernanceQuestionnaire(input));
  });
}

/**
 * Releases an analyst-only questionnaire to its Requestor.
 *
 * One `update` writes the server-clock release timestamp, the acting analyst,
 * and the governance log with exactly one appended `released` event, inside the
 * locked transaction that established the questionnaire was releasable.
 */
export async function releaseQuestionnaire(input: GovernanceWorkflowInput): Promise<RecordValue> {
  assertAnalystGovernanceActor(input);
  assertEmptyGovernanceBody(input.body);
  return runGovernanceMutation(input, async () => {
    const questionnaire = await loadGovernanceQuestionnaire(input);
    assertReleasable(questionnaire);
    // Phase 15 D-08: nothing reaches the Requestor while an AI proposal is undecided or a proposal job is running.
    await assertNoOpenProposals(input.strapi as never, input.questionnaireDocumentId, (reason) => {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire cannot be released while AI proposals are open.", reason);
    });
    const releasedAt = (input.now ?? new Date()).toISOString();
    const actorDocumentId = input.actorDocumentId as string;
    let governanceLog;
    try {
      governanceLog = appendGovernanceEvent(questionnaire.governanceLog, {
        schemaVersion: 1,
        kind: "released",
        at: releasedAt,
        by: actorDocumentId,
      });
    } catch (error) {
      if (error instanceof GovernanceLogError) {
        /*
         * A stored log this appender cannot parse is never silently replaced:
         * appending onto it would drop entries the record is meant to retain.
         * Refusing keeps the log append-only at the cost of blocking release
         * until the envelope is repaired, and the release gate itself is
         * unaffected because it reads the dedicated facts instead.
         */
        throw new QuestionnaireGovernanceError(409, HISTORY_UNAVAILABLE_MESSAGE, "HISTORY_UNAVAILABLE");
      }
      throw error;
    }
    await input.strapi.documents(QUESTIONNAIRE_UID).update({
      documentId: input.questionnaireDocumentId,
      data: { releasedAt, releasedBy: actorDocumentId, governanceLog },
    });
    return loadGovernanceQuestionnaire(input);
  });
}

export function questionOptions(question: QuestionnaireDefinitionQuestion): RecordValue {
  return {
    schemaVersion: 2,
    questionKey: question.questionKey,
    section: question.section,
    order: question.order,
    required: question.required,
    ...(question.visibility ? { visibility: question.visibility } : {}),
    ...(question.choices ? { choices: question.choices } : {}),
    ...(question.deleted ? { deleted: question.deleted } : {}),
  };
}

/*
 * A definition error on add or edit is a placement or section clash, typically another analyst's
 * change saved first (D-06), so the analyst is told to reload; a log error is its own reason.
 */
export function governanceConflict(error: unknown): never {
  if (error instanceof QuestionnaireGovernanceError) throw error;
  if (error instanceof QuestionnaireDefinitionError) {
    throw new QuestionnaireGovernanceError(409, "CSRM questionnaire definition cannot be changed.", "DEFINITION_CONFLICT");
  }
  if (error instanceof GovernanceLogError) {
    throw new QuestionnaireGovernanceError(409, "CSRM questionnaire definition cannot be changed.", "HISTORY_UNAVAILABLE");
  }
  throw error;
}

/*
 * Exactly the published QuestionnaireGovernanceResult and nothing more. The
 * revised question set is read back through the questions route, which already
 * owns the analyst projection and its answer masking; returning it here as well
 * would put a field on the wire that the contract does not declare.
 */
function resultForGovernance(questionnaire: RecordValue, clearedAnswers: Array<{ questionKey: string; explanation: string }> = []): RecordValue {
  return {
    ...projectQuestionnaire(questionnaire),
    // Governance is analyst-only, so its result carries the D-16 change count the analyst read does.
    revision: projectAnalystRevision(questionnaire),
    events: Array.isArray(questionnaire.governanceLog) ? questionnaire.governanceLog : [],
    ...(clearedAnswers.length ? { clearedAnswers } : {}),
  };
}

export function questionByDocumentId(questionnaire: RecordValue, documentId: string): QuestionnaireDefinitionQuestion {
  const definition = parseQuestionnaireDefinition(questionnaire.questions);
  const question = definition.find((candidate) => candidate.documentId === documentId);
  if (!question) throw new QuestionnaireGovernanceError(404, "CSRM questionnaire question was not found.");
  return question;
}

/*
 * Every question event names its question by key and keeps a bounded snapshot of its text (D-18):
 * the text after the change for an added or edited question, the text it had when removed, and the
 * revised question's text for a cleared answer. The snapshot is appended with the event, before
 * any write, so a log that cannot take it leaves nothing behind.
 */
/**
 * The AI source a question event carries when a confirmed AI proposal, or the Undo of one, wrote it (Phase 15 D-26):
 * the run, the item and whether the analyst edited the proposal first; an Undo adds `aiUndo: true`.
 */
export type QuestionEventSource = { runId: string; itemKey: string; aiEdited: boolean; aiUndo?: true };

export function appendQuestionEvent(
  questionnaire: RecordValue,
  kind: "question-added" | "question-edited" | "question-deleted" | "question-restored" | "answer-cleared",
  questionKey: string,
  questionText: string,
  input: Pick<GovernanceWorkflowInput, "now" | "actorDocumentId">,
  explanation?: string,
  source?: QuestionEventSource,
): unknown {
  const snapshot = questionTextSnapshot(questionText);
  return appendOrConflict(questionnaire.governanceLog, {
    schemaVersion: 1,
    kind,
    at: (input.now ?? new Date()).toISOString(),
    by: input.actorDocumentId as string,
    questionKey,
    ...(snapshot ? { questionText: snapshot } : {}),
    ...(explanation ? { explanation } : {}),
    ...(source ? { runId: source.runId, itemKey: source.itemKey, aiEdited: source.aiEdited, ...(source.aiUndo ? { aiUndo: true } : {}) } : {}),
  });
}

function assertQuestionMutationStage(questionnaire: RecordValue): void {
  const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  if (!request) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire is not in analyst review.", "REQUEST_NOT_ELIGIBLE");
  assertQuestionnaireInAnalystReview(questionnaire, request);
}

export async function deleteQuestionnaireQuestion(input: GovernanceWorkflowInput & { questionDocumentId: string }): Promise<RecordValue> {
  return runGovernanceMutation(input, async () => {
    const questionnaire = await loadGovernanceQuestionnaire(input);
    assertQuestionMutationStage(questionnaire);
    let question: QuestionnaireDefinitionQuestion;
    try { question = questionByDocumentId(questionnaire, input.questionDocumentId); } catch (error) { return governanceConflict(error); }
    if (question.deleted) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire question has already been deleted.", "QUESTION_REMOVED");
    const definition = parseQuestionnaireDefinition(questionnaire.questions);
    if (activeQuestionnaireDefinition(definition).some((candidate) => candidate.visibility?.questionKey === question.questionKey)) {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire question cannot be deleted while an active question depends on it.", "QUESTION_HAS_DEPENDENTS");
    }
    if (activeQuestionnaireDefinition(definition).length <= 1) {
      throw new QuestionnaireGovernanceError(409, "CSRM questionnaire must retain an active question.", "LAST_ACTIVE_QUESTION");
    }
    const deleted = { ...question, schemaVersion: 2 as const, deleted: { deletedAt: (input.now ?? new Date()).toISOString(), deletedBy: input.actorDocumentId as string } };
    const governanceLog = appendQuestionEvent(questionnaire, "question-deleted", question.questionKey, question.questionText, input);
    await input.strapi.documents(QUESTION_UID).update({ documentId: question.documentId, data: { options: questionOptions(deleted) } });
    await input.strapi.documents(QUESTIONNAIRE_UID).update({ documentId: input.questionnaireDocumentId, data: { governanceLog } });
    const reloaded = await loadGovernanceQuestionnaire(input);
    return resultForGovernance(reloaded);
  });
}

export function candidateQuestion(question: QuestionnaireDefinitionQuestion, payload: QuestionMutationPayload): QuestionnaireDefinitionQuestion {
  const answerType = payload.answerType ?? question.answerType;
  const choices = payload.choices === undefined
    ? (answerType === "Single select" || answerType === "Multi select" ? question.choices : undefined)
    : payload.choices;
  if ((answerType === "Single select" || answerType === "Multi select") !== Boolean(choices)) mutationError();
  // Object spread cannot delete a key: any field a payload can explicitly
  // clear (an absent/falsy `choices`, or `visibility: null`) must be excluded
  // from the base spread below and rebuilt explicitly from the computed
  // value, or the prior question's value survives untouched underneath a
  // conditional `...(value ? { key: value } : {})` that only ever adds.
  const { choices: _priorChoices, visibility: _priorVisibility, ...questionWithoutOverridable } = question;
  return {
    ...questionWithoutOverridable,
    questionText: payload.questionText ?? question.questionText,
    answerType,
    required: payload.required ?? question.required,
    section: payload.section ? payload.section as QuestionnaireDefinitionQuestion["section"] : question.section,
    order: payload.order ?? question.order,
    ...(payload.visibility === undefined ? (question.visibility ? { visibility: question.visibility } : {}) : payload.visibility === null ? {} : { visibility: payload.visibility as QuestionnaireDefinitionQuestion["visibility"] }),
    ...(choices ? { choices } : {}),
    schemaVersion: 2,
  };
}

export function validateDefinition(definition: QuestionnaireDefinitionQuestion[]): QuestionnaireDefinitionQuestion[] {
  return parseQuestionnaireDefinition(definition.map((question) => ({
    documentId: question.documentId,
    questionText: question.questionText,
    answerType: question.answerType,
    helpText: null,
    options: questionOptions(question),
    answer: question.answer,
  })));
}

export async function addQuestionnaireQuestion(input: GovernanceWorkflowInput): Promise<RecordValue> {
  const payload = parseQuestionMutationPayload(input.body, "add");
  return runGovernanceMutation(input, async () => {
    const questionnaire = await loadGovernanceQuestionnaire(input);
    assertQuestionMutationStage(questionnaire);
    const definition = parseQuestionnaireDefinition(questionnaire.questions);
    // One key rule for manual and AI additions (Phase 15 D-13): unique among every key, removed questions included.
    const questionKey = allocateQuestionKey(payload.questionText as string, createBatchAllocation(definition));
    const question: QuestionnaireDefinitionQuestion = {
      documentId: `new-${questionKey}`,
      questionText: payload.questionText as string,
      answerType: payload.answerType as QuestionnaireAnswerType,
      questionKey,
      section: payload.section as QuestionnaireDefinitionQuestion["section"],
      order: payload.order as number,
      required: payload.required as boolean,
      ...(payload.visibility ? { visibility: payload.visibility as QuestionnaireDefinitionQuestion["visibility"] } : {}),
      ...(payload.choices ? { choices: payload.choices } : {}),
      schemaVersion: 2,
      answer: null,
    };
    try { validateDefinition([...definition, question]); } catch (error) { return governanceConflict(error); }
    const create = input.strapi.documents(QUESTION_UID).create;
    if (!create) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire question cannot be created.");
    // Extended before the question is created, so a log that cannot take the event adds nothing.
    const governanceLog = appendQuestionEvent(questionnaire, "question-added", question.questionKey, question.questionText, input);
    await create({ data: { questionText: question.questionText, helpText: payload.helpText ?? null, answerType: question.answerType, options: questionOptions(question), answer: null, questionnaire: input.questionnaireDocumentId } });
    await input.strapi.documents(QUESTIONNAIRE_UID).update({ documentId: input.questionnaireDocumentId, data: { governanceLog } });
    return resultForGovernance(await loadGovernanceQuestionnaire(input));
  });
}

export async function editQuestionnaireQuestion(input: GovernanceWorkflowInput & { questionDocumentId: string }): Promise<RecordValue> {
  const payload = parseQuestionMutationPayload(input.body, "edit");
  return runGovernanceMutation(input, async () => {
    const questionnaire = await loadGovernanceQuestionnaire(input);
    assertQuestionMutationStage(questionnaire);
    let question: QuestionnaireDefinitionQuestion;
    try { question = questionByDocumentId(questionnaire, input.questionDocumentId); } catch (error) { return governanceConflict(error); }
    if (question.deleted) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire question has been deleted.", "QUESTION_REMOVED");
    const revised = candidateQuestion(question, payload);
    const definition = parseQuestionnaireDefinition(questionnaire.questions);
    let validated: QuestionnaireDefinitionQuestion[];
    try { validated = validateDefinition(definition.map((candidate) => candidate.documentId === question.documentId ? revised : candidate)); } catch (error) { return governanceConflict(error); }
    const stored = validated.find((candidate) => candidate.documentId === question.documentId) as QuestionnaireDefinitionQuestion;
    const parsedAnswer = question.answer === null || question.answer === undefined ? null : parseAnswerEnvelope(question.answer);
    if (question.answer !== null && question.answer !== undefined && !parsedAnswer) throw new QuestionnaireGovernanceError(409, "CSRM questionnaire answer data is invalid.", "ANSWER_DATA_INVALID");
    // Only a stored answer can be cleared. An edit to a question nobody has
    // answered yet must not append an answer-cleared event, or the revision
    // timeline would claim a loss that never happened.
    const newlyRequiredWithoutValue = parsedAnswer !== null && !question.required && stored.required && parsedAnswer.value === null;
    const retained = parsedAnswer !== null && !newlyRequiredWithoutValue && isQuestionnaireValueValid(stored, parsedAnswer.value);
    const explanation = parsedAnswer === null || retained ? null : newlyRequiredWithoutValue
      ? "The answer was cleared because the question is now required."
      : payload.answerType && payload.answerType !== question.answerType
        ? "The answer was cleared because the answer type changed."
        : "The answer was cleared because the revised question no longer accepts it.";
    let governanceLog = appendQuestionEvent(questionnaire, "question-edited", question.questionKey, stored.questionText, input);
    if (explanation) governanceLog = appendQuestionEvent({ governanceLog }, "answer-cleared", question.questionKey, stored.questionText, input, explanation);
    await input.strapi.documents(QUESTION_UID).update({ documentId: question.documentId, data: {
      questionText: stored.questionText,
      ...(payload.helpText !== undefined ? { helpText: payload.helpText } : {}),
      answerType: stored.answerType,
      options: questionOptions(stored),
      ...(explanation ? { answer: null } : {}),
    } });
    await input.strapi.documents(QUESTIONNAIRE_UID).update({ documentId: input.questionnaireDocumentId, data: { governanceLog } });
    return resultForGovernance(await loadGovernanceQuestionnaire(input), explanation ? [{ questionKey: question.questionKey, explanation }] : []);
  });
}
