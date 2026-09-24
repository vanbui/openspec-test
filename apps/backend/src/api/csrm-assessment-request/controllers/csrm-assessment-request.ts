import { factories } from "@strapi/strapi";

import {
  AssessmentRequestQueryError,
  buildAnalystReviewCollectionQuery,
  buildAssessmentRequestCollectionQuery,
  projectAnalystReviewRequest,
  selectReviewQueueBucket,
} from "../services/collection-scope";
import { createWithAssessmentRequestNumber } from "../services/request-number";
import {
  REQUEST_RELATIONSHIP_POPULATE,
  projectRequestRelationships,
} from "../services/relationship-scope";
import { projectRequestLifecycle } from "../services/request-lifecycle";
import { hasActiveQuestionnaireGeneration } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import {
  AssessmentRequestWorkflowError,
  isRecord,
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
        const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
        const analystReview = ctx.state.csrmAuthorization?.assessmentReviewCollectionScope === "all";
        const reviewQuery = analystReview ? buildAnalystReviewCollectionQuery(ctx.query, ctx.state) : null;
        const { dataQuery, countQuery, pagination } = reviewQuery ?? buildAssessmentRequestCollectionQuery(ctx.query, ctx.state);
        const boundedDataQuery = analystReview ? { ...dataQuery, populate: { requestor: true, questionnaire: { populate: { questions: true } }, assessment: true } } : dataQuery;
        let output: unknown[];
        let total: number;
        if (reviewQuery) {
          /*
           * Three of the four buckets are decided by facts no Strapi filter can
           * express: a derived lifecycle step and the volatile generation-job
           * registry. The reviewable scope is therefore read and classified in
           * the application, under an explicit bound rather than an open scan,
           * so one queue read can never become an unbounded query. Beyond the
           * bound the queue reports what it read; pushing the classification
           * into the database belongs with the Phase 8 hardening work.
           */
          const scope: unknown[] = [];
          const pageSize = 100;
          const scanLimit = 1_000;
          for (let start = 0; start < scanLimit; start += pageSize) {
            const page = await documents.findMany({ ...boundedDataQuery, start, limit: pageSize });
            scope.push(...page);
            if (page.length < pageSize) break;
          }
          const filtered = scope.filter((document) => selectReviewQueueBucket(
            reviewQuery.bucket,
            document as Record<string, unknown>,
            (requestId) => hasActiveQuestionnaireGeneration(strapi as never, requestId),
          ));
          total = filtered.length;
          output = filtered.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
        } else {
          [output, total] = await Promise.all([documents.findMany(boundedDataQuery), documents.count(countQuery)]);
        }
        const projected = analystReview
          ? output.map((document) => projectAnalystReviewRequest(document as Record<string, unknown>))
          : output;
        const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(projected, ctx) : projected;
        const pageCount = Math.ceil(total / pagination.pageSize);
        const meta = { pagination: { ...pagination, pageCount, total } };
        if (analystReview) return { data: sanitized, meta };
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

    async create(ctx) {
      try {
        const actor = ctx.state.csrmAuthorization?.assessmentRequestActor;
        const identityDocumentId = ctx.state.idamboxUser?.documentId;
        const input = ctx.request.body?.data;
        if (!actor || !isRecord(input) || (actor === "requestor" && !identityDocumentId)) {
          return denyBadRequest(ctx, "CSRM assessment request data is invalid.");
        }

        const documents = strapi.documents(UID) as unknown as AssessmentRequestDocuments;
        const document = await createWithAssessmentRequestNumber((requestNumber) => {
          const data = actor === "requestor"
            ? prepareRequestorCreate(input, identityDocumentId as string, requestNumber)
            : { ...input, requestNumber };
          return documents.create({ data });
        });
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
        const data = actor === "requestor"
          ? prepareRequestorUpdate(persisted, input)
          : { ...input, requestNumber: persisted.requestNumber };
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
