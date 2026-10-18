import { factories } from "@strapi/strapi";

import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import { myQuestionnairesExportView, questionnairesExportView, type ListExportView, type QuestionnaireListExportRow } from "../../../csrm/exports/export-views";
import { runListExport } from "../../../csrm/exports/run-export";
import { resolveExportActor, sendExportError, sendExportFile } from "../../../csrm/exports/send-export";
import {
  buildQuestionnaireCollectionQuery,
  deriveQuestionAiOrigins,
  governanceActorIds,
  governanceActorNames,
  isAiAssistedQuestionnaire,
  isRecord,
  latestCompletedGenerationRun,
  latestCompletedQuestionnaireContextRun,
  loadCompleteQuestionnaireScope,
  projectAiGenerationFacts,
  projectAnalystRevision,
  projectQuestionHelpText,
  projectQuestionnaireCollection,
  projectQuestionnaire,
  projectGovernanceEvents,
  projectQuestions,
  questionnaireActor,
  questionnaireAiInputsChanged,
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
import { loadAnalystRequestSummaryFacts } from "../../csrm-assessment-request/services/request-summary-facts";
import type { NotesStrapi } from "../../csrm-request-note/services/request-notes";
import { openProposalSummary } from "../services/questionnaire-proposal-gates";
import { readQuestionnaireAiProposals } from "../services/questionnaire-proposals-read";
import { getQuestionnaireProposalJob, QuestionnaireProposalWorkflowError, retryQuestionnaireProposalJob, startQuestionnaireProposals, startQuestionRewrite } from "../services/questionnaire-proposals-workflow";
import { decideQuestionnaireAiProposals } from "../services/questionnaire-proposal-decisions";
import { proposalQuestionnaireState } from "../services/questionnaire-proposals-workflow";
import { generateQuestionnaire, getQuestionnaireGenerationJob, getRequestGenerationJobs, QuestionnaireGenerationRegistryError, QuestionnaireGenerationWorkflowError, retryQuestionnaireGenerationJob } from "../services/questionnaire-generation-workflow";

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
  const schemaVersion = isRecord(question.options) && (question.options.schemaVersion === 1 || question.options.schemaVersion === 2)
    ? question.options.schemaVersion
    : question.schemaVersion === 1 || question.schemaVersion === 2 ? question.schemaVersion : 1;
  const options: RecordValue = {
    schemaVersion,
    questionKey: question.questionKey,
    section: question.section,
    order: question.order,
    required: question.required,
  };
  if (question.visibility !== undefined) options.visibility = question.visibility;
  if (question.choices !== undefined) options.choices = question.choices;
  if (isRecord(question.options) && question.options.deleted !== undefined) options.deleted = question.options.deleted;
  if (question.deleted !== undefined) options.deleted = question.deleted;
  return {
    documentId: question.documentId,
    questionText: question.questionText,
    helpText: projectQuestionHelpText(question),
    answerType: question.answerType,
    options,
    answer: question.answer ?? null,
  };
}

function projectMutation(result: RecordValue): RecordValue {
  const questions = Array.isArray(result.questions) ? result.questions.filter(isRecord) : [];
  const persistedShape = projectQuestions(questions.map(mutationQuestion), "requestor");
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
/*
 * D-18: whether the policy admitted the caller through the human Security Analyst role (13-03 sets
 * ctx.state.csrmAuthorization.humanAnalyst from the resolved IdamBox User). It opens every generation job to the
 * caller; it never comes from the request, and a missing fact is false.
 */
/* Phase 15 (D-31): who asks the AI or decides its proposals: the resolved IdamBox User and the policy's human analyst fact. */
function proposalViewer(ctx: RecordValue): { analystDocumentId: string; humanAnalyst: boolean } {
  const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
  return { analystDocumentId: identity && typeof identity.documentId === "string" ? identity.documentId : "", humanAnalyst: humanAnalystFact(ctx) };
}

/* The questionnaire AI operations' refusals, with their closed reason (W-8). */
function proposalError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof QuestionnaireProposalWorkflowError || error instanceof QuestionnaireGovernanceError) return safeError(ctx, error.status, error.message, error.reason);
  throw error;
}

function humanAnalystFact(ctx: RecordValue): boolean {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  return authorization?.humanAnalyst === true;
}

/* WR-101: the human analyst fact held by an eligible person (never the Agent role), which alone is offered a pick-up. */
function eligibleHumanAnalystFact(ctx: RecordValue): boolean {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  return authorization?.eligibleHumanAnalyst === true;
}
function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400
    ? ctx.badRequest
    : status === 403
      ? ctx.forbidden
      : status === 404
        ? ctx.notFound
        : ctx.conflict;
  // A 409 always answers in the conflict shape; a 400 or 403 carries its closed reason when it has one (Phase 15: the
  // instruction refusals and OWN_REQUEST).
  const details = status === 409 || reason !== undefined ? conflictDetails(reason) : undefined;
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
  /*
   * D-23 and D-25: the analyst header's generation facts, with the run behind the latest generation read
   * at request time. The generator is named only while their account is active, as the timeline names actors.
   */
  /*
   * Phase 13 D-29 (T-13-54): the AI-inputs signal joins the facts for a human Security Analyst only; any other
   * analyst-grant caller gets null. Phase 15 D-29 (S-2): it is measured against the questionnaire's newest completed
   * context-wide run (generation or questionnaire-wide proposals), while `generation.runId` keeps naming the latest
   * generation run (D-27).
   */
  async function generationFacts(document: RecordValue, humanAnalyst: boolean, viewerDocumentId: string | null) {
    if (!isAiAssistedQuestionnaire(document)) return null;
    const documentId = typeof document.documentId === "string" ? document.documentId : null;
    const run = documentId ? await latestCompletedGenerationRun(strapi as never, documentId) : null;
    const generator = isRecord(document.generatedBy) ? document.generatedBy : null;
    const name = generator && generator.accountStatus === "active" && typeof generator.displayName === "string" ? generator.displayName : null;
    const baseline = humanAnalyst && documentId ? await latestCompletedQuestionnaireContextRun(strapi as never, documentId) : null;
    const aiInputs = humanAnalyst ? await questionnaireAiInputsChanged(strapi, document, baseline) : null;
    // Phase 15 D-28, D-32: the open proposal items, for a human Security Analyst who did not raise the request.
    const request = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
    const requestorId = request && isRecord(request.requestor) && typeof request.requestor.documentId === "string" ? request.requestor.documentId : null;
    const mayCount = humanAnalyst && documentId !== null && viewerDocumentId !== null && requestorId !== viewerDocumentId;
    const openProposals = mayCount ? (await openProposalSummary(strapi as never, documentId as string)).openCount : null;
    return projectAiGenerationFacts(document, run, name, aiInputs, openProposals);
  }

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

  /*
   * Phase 19 (D-04, D-05, D-13): one questionnaire list export, through the list's own parser, scope, read and
   * projection (export-views.ts), as one file and one security event line.
   */
  async function exportList<P>(ctx: RecordValue, view: ListExportView<P, QuestionnaireListExportRow>) {
    try {
      const file = await runListExport({
        view,
        query: ctx.query,
        state: ctx.state,
        actor: await resolveExportActor(strapi, ctx.state),
        now: new Date(),
        log: (strapi as unknown as { log: SecurityEventLogger }).log,
      });
      sendExportFile(ctx as unknown as Parameters<typeof sendExportFile>[0], file);
      return undefined;
    } catch (error) {
      if (sendExportError(ctx as unknown as Parameters<typeof sendExportError>[0], error)) return undefined;
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
    // Phase 19: GET /api/v1/questionnaires/export, the analyst review list whole (human Security Analyst only).
    exportQuestionnaires: (ctx: RecordValue) => exportList(ctx, questionnairesExportView(strapi)),
    // Phase 19: GET /api/v1/my_questionnaires/export, the caller's own questionnaires whole, for every person.
    exportMyQuestionnaires: (ctx: RecordValue) => exportList(ctx, myQuestionnairesExportView(strapi)),
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
          humanAnalyst: humanAnalystFact(ctx),
        });
        ctx.status = 202;
        return { data };
      } catch (error) {
        if (error instanceof AssessmentDraftWorkflowError || error instanceof AssessmentDraftRegistryError) {
          return safeError(ctx, error.status, error.message, error instanceof AssessmentDraftWorkflowError ? error.reason : undefined);
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
        // Closed body (Phase 15 D-12): `replaceUnansweredQuestionnaire` and the optional `instruction`, which the workflow validates.
        if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).some((key) => key !== "replaceUnansweredQuestionnaire" && key !== "instruction") || ("replaceUnansweredQuestionnaire" in request.body && typeof request.body.replaceUnansweredQuestionnaire !== "boolean"))) return safeError(ctx, 400, "Questionnaire generation data is invalid.");
        const data = await generateQuestionnaire({ strapi: strapi as never, requestId, analystDocumentId: identity.documentId, humanAnalyst: humanAnalystFact(ctx), replaceUnansweredQuestionnaire: isRecord(request.body) && request.body.replaceUnansweredQuestionnaire === true, instruction: isRecord(request.body) ? request.body.instruction : undefined });
        ctx.status = 202;
        return { data };
      } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async getGenerationJob(ctx: RecordValue) {
      try { const jobId = routeId(ctx, "jobId"); const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null; if (!jobId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation job access is denied."); return { data: await getQuestionnaireGenerationJob({ strapi: strapi as never, jobId, analystDocumentId: identity.documentId, humanAnalyst: humanAnalystFact(ctx) }) }; } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async getRequestGenerationJobs(ctx: RecordValue) {
      try {
        const requestId = routeId(ctx, "requestId");
        const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null;
        if (!requestId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation job access is denied.");
        return { data: await getRequestGenerationJobs({ strapi: strapi as never, requestId, viewerDocumentId: identity.documentId, humanAnalyst: humanAnalystFact(ctx) }) };
      } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async retryGenerationJob(ctx: RecordValue) {
      try { const jobId = routeId(ctx, "jobId"); const identity = isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) ? ctx.state.idamboxUser : null; const request = isRecord(ctx.request) ? ctx.request : {}; if (!jobId || !identity || typeof identity.documentId !== "string") return safeError(ctx, 403, "Questionnaire generation job access is denied."); if (request.body !== undefined && (!isRecord(request.body) || Object.keys(request.body).length > 0)) return safeError(ctx, 400, "Questionnaire generation data is invalid."); ctx.status = 202; return { data: await retryQuestionnaireGenerationJob({ strapi: strapi as never, jobId, analystDocumentId: identity.documentId, humanAnalyst: humanAnalystFact(ctx) }) }; } catch (error) { if (error instanceof QuestionnaireGenerationWorkflowError || error instanceof QuestionnaireGenerationRegistryError) return safeError(ctx, error.status, error.message, error instanceof QuestionnaireGenerationWorkflowError ? error.reason : undefined); throw error; }
    },
    async findWorkflowOne(ctx: RecordValue) {
      const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
      if (request.method === "PATCH") return mutate(ctx, saveAnswers);
      if (request.method === "POST") return mutate(ctx, submitQuestionnaire);
      const documentId = questionnaireId(ctx);
      if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
      const actor = questionnaireActor(ctx.state);
      const document = await questionnaires().findOne({
        documentId,
        populate: {
          assessmentRequest: actor === "analyst" ? { populate: { requestor: { fields: ["documentId"] } } } : true, questions: true, revertedBy: true, releasedBy: true,
          // D-23: only an analyst's header names who generated the questionnaire.
          ...(actor === "analyst" ? { generatedBy: { fields: ["documentId", "displayName", "accountStatus"] } } : {}),
        },
      });
      if (!document) return safeError(ctx, 404, "CSRM questionnaire was not found.");
      const resolveDisplayName = await timelineActorNames(document, actor);
      const humanAnalyst = actor === "analyst" && humanAnalystFact(ctx);
      // D-16, D-25: the request summary's assignee and notes figures, for a human Security Analyst only.
      const requestFacts = humanAnalyst
        ? await loadAnalystRequestSummaryFacts(
          strapi as unknown as NotesStrapi,
          isRecord(document.assessmentRequest) && typeof document.assessmentRequest.documentId === "string" ? document.assessmentRequest.documentId : null,
          { documentId: isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) && typeof ctx.state.idamboxUser.documentId === "string" ? ctx.state.idamboxUser.documentId : null, humanAnalyst, eligibleHumanAnalyst: humanAnalyst && eligibleHumanAnalystFact(ctx) },
        )
        : undefined;
      return {
        data: {
          ...projectQuestionnaire(document, actor, actor === "analyst" ? await generationFacts(document, humanAnalyst, isRecord(ctx.state) && isRecord(ctx.state.idamboxUser) && typeof ctx.state.idamboxUser.documentId === "string" ? ctx.state.idamboxUser.documentId : null) : null, requestFacts),
          // D-16: only an analyst learns how many question changes a replacement would discard.
          ...(actor === "analyst" ? { revision: projectAnalystRevision(document) } : {}),
          events: projectGovernanceEvents(document, actor, resolveDisplayName),
        },
      };
    },
    async startAiProposals(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
        const data = await startQuestionnaireProposals({ strapi: strapi as never, questionnaireId: documentId, body: request.body, ...proposalViewer(ctx) });
        ctx.status = 202;
        return { data };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async startQuestionRewrite(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        const questionId = routeId(ctx, "questionId");
        if (!documentId || !questionId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
        const data = await startQuestionRewrite({ strapi: strapi as never, questionnaireId: documentId, questionId, body: request.body, ...proposalViewer(ctx) });
        ctx.status = 202;
        return { data };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async getProposalJob(ctx: RecordValue) {
      try {
        const jobId = routeId(ctx, "jobId");
        if (!jobId) return safeError(ctx, 400, "CSRM questionnaire AI proposal job identifier is invalid.");
        return { data: await getQuestionnaireProposalJob({ strapi: strapi as never, jobId, ...proposalViewer(ctx) }) };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async retryProposalJob(ctx: RecordValue) {
      try {
        const jobId = routeId(ctx, "jobId");
        if (!jobId) return safeError(ctx, 400, "CSRM questionnaire AI proposal job identifier is invalid.");
        const data = await retryQuestionnaireProposalJob({ strapi: strapi as never, jobId, ...proposalViewer(ctx) });
        ctx.status = 202;
        return { data };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async decideAiProposals(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const request: RecordValue = isRecord(ctx.request) ? ctx.request : {};
        return { data: await decideQuestionnaireAiProposals({ strapi: strapi as never, questionnaireId: documentId, body: request.body, ...proposalViewer(ctx) }) };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async listAiProposals(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        return { data: await readQuestionnaireAiProposals({ strapi: strapi as never, questionnaireId: documentId, ...proposalViewer(ctx) }) };
      } catch (error) {
        return proposalError(ctx, error);
      }
    },
    async listQuestions(ctx: RecordValue) {
      try {
        const documentId = questionnaireId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM questionnaire identifier is invalid.");
        const questionnaire = await questionnaires().findOne({ documentId, populate: { assessmentRequest: { populate: { assessment: true } } } });
        if (!questionnaire) return safeError(ctx, 404, "CSRM questionnaire was not found.");
        const output = await questions().findMany({
          filters: { questionnaire: { documentId: { $eq: documentId } } },
          limit: 1_000,
        });
        const actor = questionnaireActor(ctx.state);
        // Phase 15 D-30: an analyst learns which questions are answered only in analyst review and on a submitted questionnaire.
        const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
        const proposalState = actor === "analyst" && request ? proposalQuestionnaireState(strapi as never, documentId, { ...questionnaire, questions: output }, request) : null;
        const answeredVisible = proposalState === "analyst-review" || proposalState === "submitted";
        // D-22: only an analyst learns which questions are still the AI's, and only for a generation with a run.
        const origins = actor === "analyst" && isAiAssistedQuestionnaire(questionnaire)
          ? deriveQuestionAiOrigins(questionnaire, (await latestCompletedGenerationRun(strapi as never, documentId)) !== null, output)
          : null;
        return { data: projectQuestions(output, actor, origins, answeredVisible) };
      } catch (error) {
        if (error instanceof QuestionnaireQueryError) return safeError(ctx, 400, error.message);
        throw error;
      }
    },
  };
}

export default factories.createCoreController(UID, questionnaireControllerExtension as never);
