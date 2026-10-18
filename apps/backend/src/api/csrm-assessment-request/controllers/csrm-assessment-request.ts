import { factories } from "@strapi/strapi";

import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import {
  AssessmentRequestQueryError,
  buildAssessmentRequestCollectionQuery,
  parseAnalystReviewQuery,
  projectAnalystReviewRequest,
  reviewQueueViewer,
} from "../services/collection-scope";
import { createWithAssessmentRequestNumber } from "../services/request-number";
import {
  REQUEST_RELATIONSHIP_POPULATE,
  projectRequestRelationships,
} from "../services/relationship-scope";
import { assignmentPeopleIds, projectAnalystAssignment, type AssignmentStrapi } from "../services/request-assignment";
import { projectRequestLifecycle } from "../services/request-lifecycle";
import {
  REQUEST_PEOPLE_POPULATE,
  filterRequestReadPopulate,
  projectPerson,
  projectRequestorAssignment,
  resolvePeople,
} from "../services/request-people";
import { createReviewQueueRepository } from "../services/review-queue-repository";
import { utcToday } from "../../../csrm/insights/utc-date";
import { activeQuestionnaireGenerationRequestIds } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import { latestCompletedQuestionnaireContextRun, questionnaireAiInputsChanged } from "../../csrm-questionnaire/services/questionnaire-scope";
import type { AiInputsChanged } from "../../../csrm/ai/ai-inputs-signal";
import { assessmentAiInputsChanged } from "../../csrm-assessment/services/assessment-scope";
import { countRequestNotes, loadNotesRequest, summarizeRequestNotes, type NotesStrapi } from "../../csrm-request-note/services/request-notes";
import { canUseRequestNotes } from "../../csrm-request-note/services/request-notes-policy";
import { readersCallerFacts, readersRequestFacts } from "../../csrm-request-attachment/services/attachment-rules";
import {
  countStoredRequestAttachments,
  requestAttachmentSummary,
  type AttachmentsStrapi,
  type RequestAttachmentSummary,
} from "../../csrm-request-attachment/services/request-attachments";
import { withRequestLock, type RequestLockStrapi } from "../services/request-lock";
import {
  AssessmentRequestWorkflowError,
  isRecord,
  prepareAnalystUpdate,
  prepareRequestorCreate,
  prepareRequestorUpdate,
  revertRequestToDraft,
  type AssessmentRequestActor,
} from "../services/request-workflow";
import { requestsExportView } from "../../../csrm/exports/export-views";
import { runListExport } from "../../../csrm/exports/run-export";
import { resolveExportActor, sendExportError, sendExportFile } from "../../../csrm/exports/send-export";
import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";

const UID = "api::csrm-assessment-request.csrm-assessment-request" as const;

type RequestAiInputs = { questionnaire: AiInputsChanged | null; assessment: AiInputsChanged | null };

/*
 * Phase 13 D-29 and Phase 14 D-36: the request's questionnaire's signal (the notes and the files that changed its AI
 * inputs), read from the questionnaire the relationship read populated, against the same baseline its questionnaire read
 * measures: the questionnaire's newest completed context-wide run (Phase 15 D-29, S-2). It goes through the
 * questionnaire's own loader, so the request read and the questionnaire read serve the same one value.
 */
async function requestQuestionnaireAiInputs(strapi: unknown, requestDocumentId: string, questionnaire: unknown): Promise<AiInputsChanged | null> {
  if (!isRecord(questionnaire) || typeof questionnaire.documentId !== "string") return null;
  const baseline = await latestCompletedQuestionnaireContextRun(strapi as never, questionnaire.documentId);
  return questionnaireAiInputsChanged(strapi as never, { ...questionnaire, assessmentRequest: { documentId: requestDocumentId } }, baseline);
}

/*
 * Phase 13 D-29 and Phase 14 D-36: the request's assessment's signal (notes and files), against the assessment's newest
 * completed draft or "Suggest more risks" run (Phase 16 D-28), through the assessment's own loader, as its assessment
 * read does.
 */
async function requestAssessmentAiInputs(strapi: unknown, requestDocumentId: string, assessment: unknown): Promise<AiInputsChanged | null> {
  if (!isRecord(assessment) || typeof assessment.documentId !== "string") return null;
  return assessmentAiInputsChanged(strapi as never, { ...assessment, assessmentRequest: { documentId: requestDocumentId } });
}

type ErrorContext = {
  badRequest?: (message: string) => unknown;
  conflict?: (message: string, details?: { reason: ConflictReason }) => unknown;
  forbidden?: (message: string, details?: { reason: ConflictReason }) => unknown;
  status: number;
};

type AssessmentRequestDocuments = {
  count: (query: Record<string, unknown>) => Promise<number>;
  create: (input: { data: Record<string, unknown> }) => Promise<unknown>;
  findMany: (query: Record<string, unknown>) => Promise<unknown[]>;
  findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<unknown>;
};

function denyBadRequest(ctx: ErrorContext, message: string): unknown {
  if (ctx.badRequest) return ctx.badRequest(message);
  ctx.status = 400;
  return { data: null, error: { status: 400, name: "BadRequestError", message } };
}

/** A 403 that names the identity-relative rule which refused the operation (Phase 13 D-20: NOT_REQUEST_REQUESTOR). */
function denyForbidden(ctx: ErrorContext, message: string, reason?: ConflictReason): unknown {
  const details = conflictDetails(reason);
  if (ctx.forbidden) return ctx.forbidden(message, details);
  ctx.status = 403;
  return { data: null, error: { status: 403, name: "ForbiddenError", message, ...(details ? { details } : {}) } };
}

/** A 409 that names the rule which refused the operation, when the workflow knows it (D-22). */
function denyConflict(ctx: ErrorContext, message: string, reason?: ConflictReason): unknown {
  const details = conflictDetails(reason);
  if (ctx.conflict) return ctx.conflict(message, details);
  ctx.status = 409;
  return { data: null, error: { status: 409, name: "ConflictError", message, ...(details ? { details } : {}) } };
}

/* Whether the request's assessment relation is set; a missing request has none (the core delete answers for it). */
async function requestHasAssessment(strapi: unknown, documentId: string): Promise<boolean> {
  const request = await ((strapi as { documents: (uid: string) => AssessmentRequestDocuments }).documents(UID)).findOne({
    documentId,
    populate: { assessment: { fields: ["documentId"] } },
  });
  const assessment = request?.assessment;
  return isRecord(assessment) && typeof assessment.documentId === "string" && assessment.documentId.length > 0;
}

export default factories.createCoreController(
  UID,
  ({ strapi }) => ({
    /*
     * Phase 19 (D-04, D-05, D-13): GET /api/v1/assessment_requests/export, the review queue whole, through the queue's
     * own parser, repository and projection (requestsExportView), as one file and one security event line.
     */
    async exportReviewRequests(ctx) {
      try {
        const file = await runListExport({
          view: requestsExportView(strapi),
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
    },

    async find(ctx) {
      try {
        if (ctx.state.csrmAuthorization?.assessmentReviewCollectionScope === "all") {
          const reviewQuery = parseAnalystReviewQuery(ctx.query, ctx.state);
          /*
           * Phase 13 (D-13; 13-12): the read names its viewer, the resolved IdamBox User as a documentId and a display
           * name, because the queue's Pick up sends the viewer's documentId and no web session carries it (13-09).
           */
          const queueViewer = reviewQueueViewer(ctx.state);
          const viewer = (await resolvePeople(strapi as unknown as AssignmentStrapi, [queueViewer.documentId])).get(queueViewer.documentId)
            ?? { documentId: queueViewer.documentId, displayName: "" };
          if (reviewQuery.kind === "outside-queue") {
            /*
             * The requested status is one the selected queue does not read, so
             * the intersection is empty. Answer that directly: nothing is read,
             * and no query that could return a record outside the queue is issued.
             */
            return { data: [], meta: { pagination: { ...reviewQuery.pagination, pageCount: 0, total: 0 }, viewer } };
          }
          /*
           * Each queue is a database predicate (review-queue-repository.ts), so
           * the page and its total are exact at any volume. Only the two queues
           * that read active questionnaire generation take the registry's
           * bounded snapshot; a snapshot beyond its bound fails closed.
           */
          const activeIds = reviewQuery.bucket === "generation-in-progress" || reviewQuery.bucket === "requires-attention"
            ? activeQuestionnaireGenerationRequestIds(strapi as never)
            : [];
          const repository = createReviewQueueRepository(strapi);
          const [total, pageIds] = await Promise.all([
            repository.count(reviewQuery, activeIds),
            repository.selectPage(reviewQuery, activeIds),
          ]);
          const page = await repository.hydrate(pageIds);
          // D-24: the viewer's unread notes for the whole page in one grouped read, by the request read's rule.
          const unread = queueViewer.id === null
            ? new Map<string, number>()
            : await repository.countUnreadNotes(pageIds, { id: queueViewer.id, humanAnalyst: queueViewer.humanAnalyst });
          // One clock reading per read: every row's age counts to the same UTC today (D-29).
          const today = utcToday(new Date());
          const projected = page.map((document) => projectAnalystReviewRequest(document, today, queueViewer, unread));
          const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(projected, ctx) : projected;
          const { pagination } = reviewQuery;
          return { data: sanitized, meta: { pagination: { ...pagination, pageCount: Math.ceil(total / pagination.pageSize), total }, viewer } };
        }
        const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
        const { dataQuery, countQuery, pagination } = buildAssessmentRequestCollectionQuery(ctx.query, ctx.state);
        const [output, total] = await Promise.all([documents.findMany(dataQuery), documents.count(countQuery)]);
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(output, ctx) : output;
        const pageCount = Math.ceil(total / pagination.pageSize);
        const meta = { pagination: { ...pagination, pageCount, total } };
        return this.transformResponse
          ? this.transformResponse(sanitized, meta)
          : { data: sanitized, meta };
      } catch (error) {
        if (error instanceof AssessmentRequestQueryError) return denyBadRequest(ctx, error.message);
        throw error;
      }
    },

    /**
     * The core handler still serves the request itself; this attaches the
     * related-record summary alongside it. The relationship facts are read with
     * the server's own bounded populate rather than anything the caller asked
     * for, and availability is decided here, so the browser never infers a link
     * from an identifier that happens to be present in a payload.
     *
     * Phase 13 D-04: the caller's populate is limited to the four non-person
     * relations before the core handler runs, so no IdamBox User record crosses
     * this read; the people it names (revertedBy and the assignment) are
     * projected here as a documentId and a display name. The assignment is the
     * analyst view for a human Security Analyst reading through the analyst
     * grant (D-09, D-16), and the assignee's display name alone otherwise (D-17).
     *
     * T-13-F1: the read names one request by its id, so the caller's predicates (`filters` and the `_q` search)
     * decide nothing and are dropped before the core handler runs. A relation filter (on the requestor or the
     * sponsor) would otherwise answer yes or no about that person on a request the caller may read.
     */
    async findOne(ctx) {
      const query = isRecord(ctx.query) ? { ...ctx.query } : {};
      delete query.filters;
      delete query._q;
      const populate = filterRequestReadPopulate(query.populate);
      if (populate === undefined) delete query.populate;
      else query.populate = populate;
      ctx.query = query;
      const response = await super.findOne(ctx);
      if (!isRecord(response) || !isRecord(response.data)) return response;
      const documentId = ctx.params?.id;
      if (typeof documentId !== "string" || documentId.length === 0) return response;

      const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
      const related = await documents.findOne({ documentId, populate: REQUEST_RELATIONSHIP_POPULATE });
      if (!related) return response;
      const people = await documents.findOne({
        documentId,
        fields: ["requestStatus", "assignedAt", "assignmentLog"],
        populate: REQUEST_PEOPLE_POPULATE,
      });
      if (!people) return response;
      const facts = ctx.state.csrmAuthorization;
      const viewerDocumentId = ctx.state.idamboxUser?.documentId;
      const assignment = facts?.assessmentRequestActor === "analyst" && facts?.humanAnalyst === true && typeof viewerDocumentId === "string"
        ? projectAnalystAssignment(
          people,
          // WR-101: actions are offered to an eligible human analyst only, as the assignment operation takes them.
          { documentId: viewerDocumentId, humanAnalyst: facts?.eligibleHumanAnalyst === true },
          await resolvePeople(strapi as unknown as AssignmentStrapi, assignmentPeopleIds(people, viewerDocumentId)),
        )
        : projectRequestorAssignment(people.assignedAnalyst);
      // D-24, D-25: the viewer's notes figures, for the requestor and the human Security Analysts only (T-13-24).
      const notesRequest = await loadNotesRequest(strapi as unknown as NotesStrapi, documentId);
      const notes = notesRequest && typeof viewerDocumentId === "string"
        ? await summarizeRequestNotes(strapi as unknown as NotesStrapi, notesRequest, {
          documentId: viewerDocumentId,
          humanAnalyst: facts?.humanAnalyst === true,
        })
        : null;
      // Phase 14 D-04 item 7, D-18 (T-14-31): the viewer's file summary, for a reader of the request's attachments only;
      // anyone else's read carries no `attachments` key, so not even the count of the files reaches them.
      let attachments: RequestAttachmentSummary | null = null;
      if (notesRequest && typeof viewerDocumentId === "string") {
        const attachmentsCaller = { documentId: viewerDocumentId, humanAnalyst: facts?.humanAnalyst === true };
        if (canUseRequestNotes(readersRequestFacts(notesRequest), readersCallerFacts(attachmentsCaller))) {
          attachments = await requestAttachmentSummary(strapi as unknown as AttachmentsStrapi, notesRequest, attachmentsCaller);
        }
      }
      // D-29, D-36 (T-13-54, T-14-41): which notes and files changed each target's AI inputs, for a human Security Analyst
      // reading through the analyst grant only.
      const aiInputs: RequestAiInputs | null = facts?.assessmentRequestActor === "analyst" && facts?.humanAnalyst === true
        ? {
          questionnaire: await requestQuestionnaireAiInputs(strapi, documentId, related.questionnaire),
          assessment: await requestAssessmentAiInputs(strapi, documentId, related.assessment),
        }
        : null;

      return {
        ...response,
        data: {
          ...response.data,
          requestor: isRecord(related.requestor) && typeof related.requestor.displayName === "string"
            ? { displayName: related.requestor.displayName }
            : undefined,
          relationships: projectRequestRelationships(related, ctx.state),
          // D-17: the Requestor's next step names the assigned analyst by the display name PERSON_FIELDS read.
          lifecycle: projectRequestLifecycle(related, ctx.state, { assigneeName: projectPerson(people.assignedAnalyst)?.displayName ?? null }),
          revertedBy: projectPerson(people.revertedBy),
          assignment,
          notes,
          aiInputs,
          ...(attachments ? { attachments } : {}),
        },
      };
    },

    /**
     * One create path for every actor (T-08-A1). The policy's actor decision says which grant
     * admitted the caller, not whose request this is: an analyst or the service agent creates as
     * a Requestor, so the request is theirs, and a body naming another owner or a server-owned
     * fact changes nothing. prepareRequestorCreate refuses a caller with no trusted identity.
     */
    async create(ctx) {
      try {
        const actor = ctx.state.csrmAuthorization?.assessmentRequestActor;
        const input = ctx.request.body?.data;
        if (!actor || !isRecord(input)) {
          return denyBadRequest(ctx, "CSRM assessment request data is invalid.");
        }

        const identityDocumentId: unknown = ctx.state.idamboxUser?.documentId;
        const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
        const document = await createWithAssessmentRequestNumber((requestNumber) =>
          documents.create({ data: prepareRequestorCreate(input, identityDocumentId, requestNumber) }));
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(document, ctx) : document;
        ctx.status = 200;
        return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
      } catch (error) {
        if (error instanceof AssessmentRequestWorkflowError) return denyBadRequest(ctx, error.message);
        throw error;
      }
    },

    async update(ctx) {
      try {
        const actor = ctx.state.csrmAuthorization?.assessmentRequestActor;
        const documentId = ctx.params.id;
        const input = ctx.request.body?.data;
        if (!actor || !documentId || !isRecord(input)) {
          return denyBadRequest(ctx, "CSRM assessment request data is invalid.");
        }

        const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
        const persisted = await documents.findOne({ documentId, populate: { requestor: true } });
        if (!persisted) return denyBadRequest(ctx, "CSRM assessment request workflow is denied.");
        // Both actors write only the published update body; neither can name an owner (T-08-A2). Only the
        // request's own requestor submits it (D-20, O-5), decided against the resolved IdamBox User.
        const data = actor === "requestor"
          ? prepareRequestorUpdate(persisted, input)
          : prepareAnalystUpdate(persisted, input, new Date(), ctx.state.idamboxUser?.documentId);
        const document = await documents.update({ documentId, data });
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(document, ctx) : document;
        return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
      } catch (error) {
        if (error instanceof AssessmentRequestWorkflowError) {
          return error.status === 403 ? denyForbidden(ctx, error.message, error.reason) : denyBadRequest(ctx, error.message);
        }
        throw error;
      }
    },

    /**
     * Phase 13 D-21 (T-13-22): a request that holds a note is never deleted, so no note is orphaned. The note count
     * and the core delete run inside one withRequestLock call, the lock every note create takes: a create that took
     * the lock first makes the count non-zero (409 REQUEST_HAS_NOTES, nothing deleted), and a create waiting behind
     * the delete finds the request gone and answers 404. Phase 14 (D-04 item 11) adds REQUEST_HAS_ATTACHMENTS after
     * it, counting every attachment, removed and blocked ones included, under the same lock every attachment write
     * takes. A missing request keeps the core delete's answer. This is the only lock holder on the delete path, so the
     * lock is never nested.
     */
    async delete(ctx) {
      const documentId = ctx.params?.id;
      if (typeof documentId !== "string" || documentId.length === 0) return super.delete(ctx);
      return withRequestLock(strapi as unknown as RequestLockStrapi, documentId, async () => {
        // Phase 16 D-16 (the Orchestrator Confirmation "Request deletion"): a request that has a Risk Assessment, in any
        // state, is never deleted, so no assessment, Risk or Risk history row loses its request. It comes first, so a
        // request with an assessment, notes and files reports REQUEST_HAS_ASSESSMENT.
        if (await requestHasAssessment(strapi, documentId)) {
          return denyConflict(ctx, "CSRM assessment request has a risk assessment.", "REQUEST_HAS_ASSESSMENT");
        }
        if (await countRequestNotes(strapi as unknown as NotesStrapi, documentId) > 0) {
          return denyConflict(ctx, "CSRM assessment request holds notes and cannot be deleted.", "REQUEST_HAS_NOTES");
        }
        // Phase 14 D-04 item 11 (T-14-32): every attachment counts, removed and blocked ones included, so no file is
        // ever left referencing a deleted request; an upload waiting behind this lock finds the request gone (404).
        if (await countStoredRequestAttachments(strapi as unknown as AttachmentsStrapi, documentId) > 0) {
          return denyConflict(ctx, "CSRM assessment request holds attachments and cannot be deleted.", "REQUEST_HAS_ATTACHMENTS");
        }
        return super.delete(ctx);
      });
    },

    async revertToDraft(ctx) {
      try {
        const documentId = ctx.params.requestId;
        const actorDocumentId = ctx.state.idamboxUser?.documentId;
        if (!documentId || !actorDocumentId) return denyBadRequest(ctx, "CSRM request reversal is denied.");
        const reverted = await revertRequestToDraft({
          strapi: strapi as never,
          requestDocumentId: documentId,
          actorDocumentId,
          body: ctx.request.body,
        });
        // D-04: the reverting person crosses as a documentId and a display name only.
        const document = { ...reverted, revertedBy: projectPerson(reverted.revertedBy) };
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(document, ctx) : document;
        return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
      } catch (error) {
        if (error instanceof AssessmentRequestWorkflowError) {
          return error.status === 409 ? denyConflict(ctx, error.message, error.reason) : denyBadRequest(ctx, error.message);
        }
        throw error;
      }
    },
  }),
);
