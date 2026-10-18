import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import { readRiskAiProposals } from "../../../csrm/ai/risk-proposals/risk-proposals-read";
import { getRiskProposalJob, retryRiskProposalJob, RiskProposalWorkflowError, startRiskRewrite, startRiskSuggestions, type RiskProposalStrapi, type RiskProposalViewer } from "../../../csrm/ai/risk-proposals/risk-proposal-workflow";
import { assertAnalystAssessmentScope, AssessmentScopeError } from "../services/assessment-scope";
import { AssessmentWorkflowError } from "../services/assessment-workflow";

/*
 * Phase 16 risk AI proposal handlers (D-03 items 4 to 7, D-26, D-41, D-43). The route policy has already required the
 * operation's human-analyst-only grant; each handler requires the analyst assessment scope, takes the viewer from the
 * resolved IdamBox User (`ctx.state.idamboxUser`) and the policy's human analyst fact
 * (`ctx.state.csrmAuthorization.humanAnalyst`, never from the request), and answers every refusal with a safe message
 * and its closed reason in `error.details.reason` (a 409 always; a 400 or 403 when it has one: an instruction refusal,
 * OWN_REQUEST).
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  const details = status === 409 || reason !== undefined ? conflictDetails(reason) : undefined;
  if (typeof responder === "function") return details ? responder.call(ctx, message, details) : responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message, ...(details ? { details } : {}) } };
}

function routeId(ctx: RecordValue, name: "assessmentId" | "riskId" | "jobId"): string | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  return params && typeof params[name] === "string" && params[name].length > 0 ? params[name] as string : null;
}

function viewer(ctx: RecordValue): RiskProposalViewer {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  return { documentId: identity && typeof identity.documentId === "string" ? identity.documentId : "", humanAnalyst: authorization?.humanAnalyst === true };
}

function requestBody(ctx: RecordValue): unknown {
  return isRecord(ctx.request) ? ctx.request.body : undefined;
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
  if (error instanceof RiskProposalWorkflowError) return safeError(ctx, error.status, error.message, error.reason);
  // The lock core's own refusals (an unknown assessment, a blank identifier).
  if (error instanceof AssessmentWorkflowError) return safeError(ctx, error.status, error.message, error.reason);
  throw error;
}

const proposalStrapi = (): RiskProposalStrapi => globalThis.strapi as unknown as RiskProposalStrapi;

const riskProposalsController = {
  async startSuggestions(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const assessmentId = routeId(ctx, "assessmentId");
      if (!assessmentId) return safeError(ctx, 404, "CSRM assessment was not found.");
      const data = await startRiskSuggestions({ strapi: proposalStrapi(), assessmentId, body: requestBody(ctx), viewer: viewer(ctx) });
      ctx.status = 202;
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async startRewrite(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const riskId = routeId(ctx, "riskId");
      if (!riskId) return safeError(ctx, 404, "CSRM Risk was not found.");
      const data = await startRiskRewrite({ strapi: proposalStrapi(), riskId, body: requestBody(ctx), viewer: viewer(ctx) });
      ctx.status = 202;
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async retryJob(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const jobId = routeId(ctx, "jobId");
      if (!jobId) return safeError(ctx, 404, "CSRM risk AI proposal job was not found.");
      const body = requestBody(ctx);
      if (body !== undefined && body !== null && (!isRecord(body) || Object.keys(body).length > 0)) return safeError(ctx, 400, "CSRM risk AI proposal data is invalid.");
      const data = await retryRiskProposalJob({ strapi: proposalStrapi(), jobId, viewer: viewer(ctx) });
      ctx.status = 202;
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async getJob(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const jobId = routeId(ctx, "jobId");
      if (!jobId) return safeError(ctx, 404, "CSRM risk AI proposal job was not found.");
      return { data: await getRiskProposalJob({ strapi: proposalStrapi(), jobId, viewer: viewer(ctx) }) };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async listProposals(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const assessmentId = routeId(ctx, "assessmentId");
      if (!assessmentId) return safeError(ctx, 404, "CSRM assessment was not found.");
      return { data: await readRiskAiProposals({ strapi: proposalStrapi(), assessmentDocumentId: assessmentId, viewer: viewer(ctx) }) };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
};

export default riskProposalsController;
