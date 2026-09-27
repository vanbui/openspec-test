import { factories } from "@strapi/strapi";

import {
  AssessmentRequestQueryError,
  buildAssessmentRequestCollectionQuery,
  parseAnalystReviewQuery,
  projectAnalystReviewRequest,
} from "../services/collection-scope";
import { createWithAssessmentRequestNumber } from "../services/request-number";
import {
  REQUEST_RELATIONSHIP_POPULATE,
  projectRequestRelationships,
} from "../services/relationship-scope";
import { projectRequestLifecycle } from "../services/request-lifecycle";
import { createReviewQueueRepository } from "../services/review-queue-repository";
import { activeQuestionnaireGenerationRequestIds } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import {
  AssessmentRequestWorkflowError,
  isRecord,
  prepareAnalystUpdate,
  prepareRequestorCreate,
  prepareRequestorUpdate,
  revertRequestToDraft,
  type AssessmentRequestActor,
} from "../services/request-workflow";

const UID = "api::csrm-assessment-request.csrm-assessment-request" as const;

type ErrorContext = {
  badRequest?: (message: string) => unknown;
  conflict?: (message: string) => unknown;
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

function denyConflict(ctx: ErrorContext, message: string): unknown {
  if (ctx.conflict) return ctx.conflict(message);
  ctx.status = 409;
  return { data: null, error: { status: 409, name: "ConflictError", message } };
}

export default factories.createCoreController(
  UID,
  ({ strapi }) => ({
    async find(ctx) {
      try {
        if (ctx.state.csrmAuthorization?.assessmentReviewCollectionScope === "all") {
          const reviewQuery = parseAnalystReviewQuery(ctx.query, ctx.state);
          if (reviewQuery.kind === "outside-queue") {
            /*
             * The requested status is one the selected queue does not read, so
             * the intersection is empty. Answer that directly: nothing is read,
             * and no query that could return a record outside the queue is issued.
             */
            return { data: [], meta: { pagination: { ...reviewQuery.pagination, pageCount: 0, total: 0 } } };
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
          const projected = page.map((document) => projectAnalystReviewRequest(document));
          const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(projected, ctx) : projected;
          const { pagination } = reviewQuery;
          return { data: sanitized, meta: { pagination: { ...pagination, pageCount: Math.ceil(total / pagination.pageSize), total } } };
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
     */
    async findOne(ctx) {
      const response = await super.findOne(ctx);
      if (!isRecord(response) || !isRecord(response.data)) return response;
      const documentId = ctx.params?.id;
      if (typeof documentId !== "string" || documentId.length === 0) return response;

      const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
      const related = await documents.findOne({ documentId, populate: REQUEST_RELATIONSHIP_POPULATE });
      if (!related) return response;

      return {
        ...response,
        data: {
          ...response.data,
          requestor: isRecord(related.requestor) && typeof related.requestor.displayName === "string"
            ? { displayName: related.requestor.displayName }
            : undefined,
          relationships: projectRequestRelationships(related, ctx.state),
          lifecycle: projectRequestLifecycle(related, ctx.state),
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
        // Both actors write only the published update body; neither can name an owner (T-08-A2).
        const data = actor === "requestor"
          ? prepareRequestorUpdate(persisted, input)
          : prepareAnalystUpdate(persisted, input);
        const document = await documents.update({ documentId, data });
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(document, ctx) : document;
        return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
      } catch (error) {
        if (error instanceof AssessmentRequestWorkflowError) return denyBadRequest(ctx, error.message);
        throw error;
      }
    },

    async revertToDraft(ctx) {
      try {
        const documentId = ctx.params.requestId;
        const actorDocumentId = ctx.state.idamboxUser?.documentId;
        if (!documentId || !actorDocumentId) return denyBadRequest(ctx, "CSRM request reversal is denied.");
        const document = await revertRequestToDraft({
          strapi: strapi as never,
          requestDocumentId: documentId,
          actorDocumentId,
          body: ctx.request.body,
        });
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(document, ctx) : document;
        return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
      } catch (error) {
        if (error instanceof AssessmentRequestWorkflowError) {
          return error.status === 409 ? denyConflict(ctx, error.message) : denyBadRequest(ctx, error.message);
        }
        throw error;
      }
    },
  }),
);
