import { factories } from "@strapi/strapi";

import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import {
  buildQuestionnaireCollectionQuery,
  governanceActorIds,
  governanceActorNames,
  isRecord,
  loadCompleteQuestionnaireScope,
  projectQuestionnaireCollection,
  projectQuestionnaire,
  projectGovernanceEvents,
  projectQuestions,
  questionnaireActor,
  questionnaireState,
  QuestionnaireQueryError,
  type QuestionnaireActor,
} from "../services/questionnaire-scope";
import {
  saveAnswers,
  submitQuestionnaire,
  revertQuestionnaireToDraft,
  QuestionnaireWorkflowError,
} from "../services/questionnaire-workflow";
import {
  QuestionnaireGovernanceError,
  addQuestionnaireQuestion,
  editQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
  releaseQuestionnaire,
  returnQuestionnaireToAnalystReview,
} from "../services/questionnaire-governance-workflow";
import {
  AssessmentDraftWorkflowError,
  generateAssessment,
} from "../../csrm-assessment/services/assessment-workflow";
import { AssessmentDraftRegistryError } from "../../csrm-assessment/services/assessment-draft-registry";
import { generateQuestionnaire, getQuestionnaireGenerationJob, QuestionnaireGenerationRegistryError, QuestionnaireGenerationWorkflowError, retryQuestionnaireGenerationJob } from "../services/questionnaire-generation-workflow";

const UID = "api::csrm-questionnaire.csrm-questionnaire" as const;
const QUESTION_UID = "api::csrm-question.csrm-question" as const;
const USER_UID = "api::idambox-user.idambox-user" as const;
type RecordValue = Record<string, unknown>;
type Documents = {
  count: (query: RecordValue) => Promise<number>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
};

function answerTimestamp(question: RecordValue, key: "updatedAt" | "submittedAt"): string | null {
  const answer = isRecord(question.answer) ? question.answer : null;
  return answer && typeof answer[key] === "string" ? answer[key] : null;
}

function mutationQuestion(question: RecordValue): RecordValue {
  const options: RecordValue = {
    schemaVersion: isRecord(question.options) && (question.options.schemaVersion === 1 || question.options.schemaVersion === 2)
      ? question.options.schemaVersion
      : 1,
    questionKey: question.questionKey,
    section: question.section,
    order: question.order,
    required: question.required,
  };
  if (question.visibility !== undefined) options.visibility = question.visibility;
  if (question.choices !== undefined) options.choices = question.choices;
  if (isRecord(question.options) && question.options.deleted !== undefined) options.deleted = question.options.deleted;
  return {
    documentId: question.documentId,
    questionText: question.questionText,
    answerType: question.answerType,
    options,
    answer: question.answer ?? null,
  };
}

function projectMutation(result: RecordValue): RecordValue {
  const questions = Array.isArray(result.questions) ? result.questions.filter(isRecord) : [];
  const persistedShape = questions.map(mutationQuestion);
  const submittedAt = questions.map((question) => answerTimestamp(question, "submittedAt")).find(Boolean);
  const updatedAt = questions
    .map((question) => answerTimestamp(question, "updatedAt"))
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);
  const summary = projectQuestionnaire({ ...result, questions: persistedShape });
  return {
    questionnaireId: result.documentId,
    state: submittedAt ? "submitted" : "draft",
    progress: summary.progress,
    answers: persistedShape,
    updatedAt: updatedAt ?? result.updatedAt,
    ...(submittedAt ? { submittedAt } : {}),
    ...(typeof result.revertReason === "string" && typeof result.revertedAt === "string" ? {
      revert: {
        reason: result.revertReason,
        revertedAt: result.revertedAt,
        ...(typeof result.revertedBy === "string" ? { revertedBy: { documentId: result.revertedBy } } : {}),
      },
    } : {}),
  };
}

/** A safe error response; a conflict also names the rule that refused it when one is known (D-22). */
function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400
    ? ctx.badRequest
    : status === 403
      ? ctx.forbidden
      : status === 404
        ? ctx.notFound
        : ctx.conflict;
  const details = status === 409 ? conflictDetails(reason) : undefined;
  if (typeof responder === "function") return responder.call(ctx, message, details);
  ctx.status = status;
  return { data: null, error: { status, message, ...(details ? { details } : {}) } };
}

function questionnaireId(ctx: RecordValue): string | null {
  const params = isRecord(ctx.params) ? ctx.params : {};
  return typeof params.questionnaireId === "string" && params.questionnaireId.length > 0
    ? params.questionnaireId
    : null;
}

function routeId(ctx: RecordValue, name: string): string | null {
  const params = isRecord(ctx.params) ? ctx.params : {};
  return typeof params[name] === "string" && params[name].length > 0 ? params[name] : null;
}

type ControllerStrapi = { documents: (uid: string) => unknown };

export function questionnaireControllerExtension({ strapi }: { strapi: ControllerStrapi }) {
  const questionnaires = () => strapi.documents(UID) as unknown as Documents;
  const questions = () => strapi.documents(QUESTION_UID) as unknown as Documents;
  const users = () => strapi.documents(USER_UID) as unknown as Documents;

  /*
   * Phase 8 D-31: the analyst revision timeline names each acting analyst. The
   * distinct actor ids are resolved in one bounded lookup that reads only the
   * documentId and display name of active IdamBox users. It runs only for an
   * analyst reader: a Requestor's timeline never carries the actor, so their
   * read looks no one up.
   */
  async function timelineActorNames(document: RecordValue, actor: QuestionnaireActor) {
    if (actor !== "analyst") return undefined;
    const ids = governanceActorIds(document);
    if (ids.length === 0) return undefined;
    return governanceActorNames(await users().findMany({
      filters: { documentId: { $in: ids }, accountStatus: { $eq: "active" } },
      fields: ["documentId", "displayName"],
      limit: ids.length,
    }));
  }

  async function collection(ctx: RecordValue) {
    try {
      const { dataQuery, pagination, sort, status } = buildQuestionnaireCollectionQuery(ctx.query, ctx.state);
      const documents = await loadCompleteQuestionnaireScope(
        (query) => questionnaires().findMany(query),
        dataQuery,
      );
      const candidates = projectQuestionnaireCollection(documents, status, sort);
      const total = candidates.length;
      const start = (pagination.page - 1) * pagination.pageSize;
      return {
        data: candidates.slice(start, start + pagination.pageSize),
        meta: { pagination: { ...pagination, pageCount: Math.ceil(total / pagination.pageSize), total } },
      };
    } catch (error) {
      if (error instanceof QuestionnaireQueryError) return safeError(ctx, 400, error.message);
      throw error;
    }
  }

  async function summary(ctx: RecordValue, analyst: boolean) {
    try {
      const { dataQuery } = buildQuestionnaireCollectionQuery({}, ctx.state);
      const documents = await loadCompleteQuestionnaireScope(
        (query) => questionnaires().findMany(query),
        dataQuery,
      );
      const states = documents.map(questionnaireState);
      return analyst
        ? { data: { awaitingSubmission: states.filter((state) => state !== "submitted").length, readyForReview: states.filter((state) => state === "submitted").length, total: states.length } }
        : { data: { notStarted: states.filter((state) => state === "not-started").length, draft: states.filter((state) => state === "draft").length, submitted: states.filter((state) => state === "submitted").length, total: states.length } };
    } catch (error) {
      if (error instanceof QuestionnaireQueryError) return safeError(ctx, 400, error.message);
      throw error;
    }
  }

  async function mutate(ctx: RecordValue, mutation: typeof saveAnswers | typeof submitQuestionnaire | typeof revertQuestionnaireToDraft) {
    try {
      const documentId = questionnaireId(ctx);
      if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
      const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
      const result = await mutation({
        strapi: strapi as never,
        questionnaireDocumentId: documentId,
        actor: questionnaireActor(ctx.state),
        actorDocumentId: isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) && typeof ctx.state.idamboxUser.documentId === "string"
          ? ctx.state.idamboxUser.documentId
          : undefined,
        body: request.body,
      });
      return { data: projectMutation(result) };
    } catch (error) {
      if (error instanceof QuestionnaireWorkflowError) return safeError(ctx, error.status, error.message, error.reason);
      if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire mutation is denied.");
      throw error;
    }
  }

  return {
    listMine: collection,
    listAll: collection,
    statusSummary: (ctx: RecordValue) => summary(ctx, false),
    reviewSummary: (ctx: RecordValue) => summary(ctx, true),
    /*
     * Release is an analyst governance operation rather than an answer
     * mutation, so it has its own thin handler. It resolves the questionnaire
     * identifier and the acting identity, delegates the whole decision to the
     * transactional workflow, and maps the workflow's status through the same
     * `safeError` helper every other questionnaire operation uses so the error
     * envelopes stay identical.
     */
    async release(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!identity || typeof identity.documentId !== "string") {
          return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        }
        const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
        const released = await releaseQuestionnaire({
          strapi: strapi as never,
          questionnaireDocumentId: documentId,
          actor: questionnaireActor(ctx.state),
          actorDocumentId: identity.documentId,
          body: request.body,
        });
        return { data: projectQuestionnaire(released) };
      } catch (error) {
        if (error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        throw error;
      }
    },
    async returnToReview(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!identity || typeof identity.documentId !== "string") {
          return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        }
        const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
        const returned = await returnQuestionnaireToAnalystReview({
          strapi: strapi as never,
          questionnaireDocumentId: documentId,
          actor: questionnaireActor(ctx.state),
          actorDocumentId: identity.documentId,
          body: request.body,
        });
        return { data: returned };
      } catch (error) {
        if (error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        throw error;
      }
    },
    async addQuestion(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!documentId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        const request = isRecord(ctx.request) ? ctx.request : {};
        return { data: await addQuestionnaireQuestion({ strapi: strapi as never, questionnaireDocumentId: documentId, actor: questionnaireActor(ctx.state), actorDocumentId: identity.documentId, body: request.body }) };
      } catch (error) {
        if (error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        throw error;
      }
    },
    async editQuestion(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx); const questionId = routeId(ctx, "questionId");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!documentId || !questionId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        const request = isRecord(ctx.request) ? ctx.request : {};
        return { data: await editQuestionnaireQuestion({ strapi: strapi as never, questionnaireDocumentId: documentId, questionDocumentId: questionId, actor: questionnaireActor(ctx.state), actorDocumentId: identity.documentId, body: request.body }) };
      } catch (error) {
        if (error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        throw error;
      }
    },
    async deleteQuestion(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx); const questionId = routeId(ctx, "questionId");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!documentId || !questionId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        const request = isRecord(ctx.request) ? ctx.request : {};
        if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).length > 0)) return safeError(ctx, 400, "CSRM questionnaire question deletion data is invalid.");
        return { data: await deleteQuestionnaireQuestion({ strapi: strapi as never, questionnaireDocumentId: documentId, questionDocumentId: questionId, actor: questionnaireActor(ctx.state), actorDocumentId: identity.documentId, body: request.body }) };
      } catch (error) {
        if (error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 403, "CSRM questionnaire governance is denied.");
        throw error;
      }
    },
    saveAnswers: (ctx: RecordValue) => mutate(ctx, saveAnswers),
    submitQuestionnaire: (ctx: RecordValue) => mutate(ctx, submitQuestionnaire),
    revertToDraft: (ctx: RecordValue) => mutate(ctx, revertQuestionnaireToDraft),
    async generateAssessment(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        if (!identity || typeof identity.documentId !== "string") {
          return safeError(ctx, 403, "CSRM assessment draft generation is denied.");
        }
        const request = isRecord(ctx.request) ? ctx.request : {};
        if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).length > 0)) {
          return safeError(ctx, 400, "CSRM assessment draft generation data is invalid.");
        }
        const data = await generateAssessment({
          strapi: strapi as never,
          questionnaireDocumentId: documentId,
          analystDocumentId: identity.documentId,
        });
        ctx.status = 202;
        return { data };
      } catch (error) {
        if (error instanceof AssessmentDraftWorkflowError || error instanceof AssessmentDraftRegistryError) {
          return safeError(ctx, error.status, error.message);
        }
        throw error;
      }
    },
    async generateQuestionnaire(ctx: RecordValue) {
      try {
        const requestId = routeId(ctx, "requestId");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        const request = isRecord(ctx.request) ? ctx.request : {};
        if (!requestId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation is denied.");
        if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).some((key) => key !== "replaceUnansweredQuestionnaire") || ("replaceUnansweredQuestionnaire" in request.body && typeof request.body.replaceUnansweredQuestionnaire !== "boolean"))) return safeError(ctx, 400, "Questionnaire generation data is invalid.");
        ctx.status = 202;
        return { data: await generateQuestionnaire({ strapi: strapi as never, requestId, analystDocumentId: identity.documentId, replaceUnansweredQuestionnaire: isRecord(request.body) && request.body.replaceUnansweredQuestionnaire === true }) };
      } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async getGenerationJob(ctx: RecordValue) {
      try { const jobId = routeId(ctx, "jobId"); const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null; if (!jobId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation job access is denied."); return { data: await getQuestionnaireGenerationJob({ strapi: strapi as never, jobId, analystDocumentId: identity.documentId }) }; } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async retryGenerationJob(ctx: RecordValue) {
      try { const jobId = routeId(ctx, "jobId"); const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null; const request = isRecord(ctx.request) ? ctx.request : {}; if (!jobId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation job access is denied."); if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).length > 0)) return safeError(ctx, 400, "Questionnaire generation data is invalid."); ctx.status = 202; return { data: await retryQuestionnaireGenerationJob({ strapi: strapi as never, jobId, analystDocumentId: identity.documentId }) }; } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async findWorkflowOne(ctx: RecordValue) {
      const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
      if (request.method === "PATCH") return mutate(ctx, saveAnswers);
      if (request.method === "POST") return mutate(ctx, submitQuestionnaire);
      const documentId = questionnaireId(ctx);
      if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
      const document = await questionnaires().findOne({
        documentId,
        populate: { assessmentRequest: true, questions: true, revertedBy: true, releasedBy: true },
      });
      if (!document) return safeError(ctx, 404, "CSRM questionnaire was not found.");
      const actor = questionnaireActor(ctx.state);
      const resolveDisplayName = await timelineActorNames(document, actor);
      return { data: { ...projectQuestionnaire(document), events: projectGovernanceEvents(document, actor, resolveDisplayName) } };
    },
    async listQuestions(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const questionnaire = await questionnaires().findOne({ documentId });
        if (!questionnaire) return safeError(ctx, 404, "CSRM questionnaire was not found.");
        const output = await questions().findMany({
          filters: { questionnaire: { documentId: { $eq: documentId } } },
          limit: 1_000,
        });
        return { data: projectQuestions(output, questionnaireActor(ctx.state)) };
      } catch (error) {
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 400, error.message);
        throw error;
      }
    },
  };
}

export default factories.createCoreController(UID, questionnaireControllerExtension as never);
