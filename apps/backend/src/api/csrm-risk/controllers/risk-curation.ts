import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import { RiskCurationBodyError } from "../../../csrm/risk-curation-rules";
import { assertAnalystAssessmentScope, assertClosedAssessmentQuery, AssessmentScopeError } from "../../csrm-assessment/services/assessment-scope";
import { AssessmentWorkflowError } from "../../csrm-assessment/services/assessment-workflow";
import { RiskHistoryError } from "../../csrm-risk-history-event/services/risk-history";
import { getRiskHistory, reinstateRisks, RiskCurationError, withdrawRisks, type RiskCurationStrapi } from "../services/risk-curation";

/*
 * Phase 16 risk curation handlers (D-03 items 1 to 3, D-43). The route policy has already required the operation's
 * human-analyst-only grant; each handler requires the analyst assessment scope, takes the actor from the resolved
 * IdamBox User (`ctx.state.idamboxUser`, never from the auth mode or the body) and answers every refusal with a safe
 * message and, for a 409, its closed reason.
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  const details = conflictDetails(status === 409 ? reason : undefined);
  if (typeof responder === "function") return details ? responder.call(ctx, message, details) : responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message, ...(details ? { details } : {}) } };
}

function routeId(ctx: RecordValue, name: "assessmentId" | "riskId"): string | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  return params && typeof params[name] === "string" && params[name].length > 0 ? params[name] as string : null;
}

function actorDocumentId(ctx: RecordValue): string | null {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  return identity && typeof identity.documentId === "string" && identity.documentId.length > 0 ? identity.documentId : null;
}

function requestBody(ctx: RecordValue): unknown {
  return isRecord(ctx.request) ? ctx.request.body : undefined;
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof RiskCurationBodyError) return safeError(ctx, 400, error.message);
  // A malformed page is the reader's 400; any other history error is a writer bug and is not answered here.
  if (error instanceof RiskHistoryError && error.code === "RISK_HISTORY_PAGE_INVALID") return safeError(ctx, 400, "CSRM risk history query is invalid.");
  if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
  if (error instanceof RiskCurationError || error instanceof AssessmentWorkflowError) {
    return safeError(ctx, error.status, error.message, error.reason);
  }
  throw error;
}

const curationStrapi = (): RiskCurationStrapi => globalThis.strapi as unknown as RiskCurationStrapi;

/* The withdraw and reinstate handlers share one frame: the scope, a closed query, the path's assessment and the actor. */
async function curateBatch(ctx: RecordValue, operation: typeof withdrawRisks): Promise<unknown> {
  try {
    assertAnalystAssessmentScope(ctx.state);
    assertClosedAssessmentQuery(ctx.query);
    const assessmentId = routeId(ctx, "assessmentId");
    const actorId = actorDocumentId(ctx);
    if (!assessmentId || !actorId) return safeError(ctx, 400, "CSRM risk curation data is invalid.");
    return { data: await operation({ strapi: curationStrapi(), assessmentDocumentId: assessmentId, actorDocumentId: actorId, body: requestBody(ctx) }) };
  } catch (error) {
    return handleError(ctx, error);
  }
}

const riskCurationController = {
  async withdraw(ctx: RecordValue) {
    return curateBatch(ctx, withdrawRisks);
  },
  async reinstate(ctx: RecordValue) {
    return curateBatch(ctx, reinstateRisks);
  },
  async history(ctx: RecordValue) {
    try {
      assertAnalystAssessmentScope(ctx.state);
      const riskId = routeId(ctx, "riskId");
      if (!riskId) return safeError(ctx, 404, "CSRM Risk was not found.");
      return await getRiskHistory({ strapi: curationStrapi(), riskDocumentId: riskId, query: ctx.query });
    } catch (error) {
      return handleError(ctx, error);
    }
  },
};

export default riskCurationController;
