import { factories } from "@strapi/strapi";

import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import {
  assertAnalystAssessmentScope,
  assertClosedAssessmentQuery,
  AssessmentScopeError,
} from "../../csrm-assessment/services/assessment-scope";
import { AssessmentWorkflowError } from "../../csrm-assessment/services/assessment-workflow";
import {
  createRiskControlImplementation,
  deleteControlImplementation,
  listRiskControlImplementationDocuments,
  projectControlImplementationSummary,
  ControlImplementationWorkflowError,
  updateControlImplementation,
} from "../services/control-implementation-workflow";

const UID = "api::csrm-control-implementation.csrm-control-implementation" as const;
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  // D-22: a workflow conflict names its closed reason, as the assessment and Risk controllers' do (CR-02, WR-103).
  const details = conflictDetails(status === 409 ? reason : undefined);
  if (typeof responder === "function") return details ? responder.call(ctx, message, details) : responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message, ...(details ? { details } : {}) } };
}

function routeId(ctx: RecordValue, name: "riskId" | "implementationId"): string | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  return params && typeof params[name] === "string" && params[name].length > 0 ? params[name] as string : null;
}

function analystDocumentId(ctx: RecordValue): string | null {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  return identity && typeof identity.documentId === "string" ? identity.documentId : null;
}

function mutationBody(ctx: RecordValue): unknown {
  return isRecord(ctx.request) ? ctx.request.body : undefined;
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AssessmentScopeError
    || error instanceof AssessmentWorkflowError
    || error instanceof ControlImplementationWorkflowError) {
    return safeError(ctx, error.status, error.message, error instanceof AssessmentWorkflowError ? error.reason : undefined);
  }
  throw error;
}

export function controlImplementationControllerExtension({ strapi }: { strapi: unknown }) {
  const workflowStrapi = strapi as never;
  return {
    async listRiskControlImplementations(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const riskId = routeId(ctx, "riskId");
        if (!riskId) return safeError(ctx, 400, "CSRM Risk identifier is invalid.");
        return {
          data: (await listRiskControlImplementationDocuments(workflowStrapi, riskId))
            .map(projectControlImplementationSummary),
        };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async createRiskControlImplementation(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const riskId = routeId(ctx, "riskId");
        const analystId = analystDocumentId(ctx);
        if (!riskId || !analystId) return safeError(ctx, 400, "CSRM ControlImplementation mutation data is invalid.");
        const document = await createRiskControlImplementation({
          strapi: workflowStrapi,
          riskDocumentId: riskId,
          analystDocumentId: analystId,
          body: mutationBody(ctx),
        });
        ctx.status = 201;
        return { data: projectControlImplementationSummary(document) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async updateControlImplementation(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const implementationId = routeId(ctx, "implementationId");
        const analystId = analystDocumentId(ctx);
        if (!implementationId || !analystId) return safeError(ctx, 400, "CSRM ControlImplementation mutation data is invalid.");
        const document = await updateControlImplementation({
          strapi: workflowStrapi,
          implementationDocumentId: implementationId,
          analystDocumentId: analystId,
          body: mutationBody(ctx),
        });
        return { data: projectControlImplementationSummary(document) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async deleteControlImplementation(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const implementationId = routeId(ctx, "implementationId");
        const analystId = analystDocumentId(ctx);
        if (!implementationId || !analystId) return safeError(ctx, 400, "CSRM ControlImplementation mutation data is invalid.");
        await deleteControlImplementation({
          strapi: workflowStrapi,
          implementationDocumentId: implementationId,
          analystDocumentId: analystId,
        });
        ctx.status = 204;
        return undefined;
      } catch (error) {
        return handleError(ctx, error);
      }
    },
  };
}

export default factories.createCoreController(UID, controlImplementationControllerExtension as never);
