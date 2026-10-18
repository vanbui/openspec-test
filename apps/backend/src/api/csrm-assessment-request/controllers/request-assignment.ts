import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import { AssignmentError, changeRequestAssignee, listAssignableAnalysts, type AssignmentStrapi } from "../services/request-assignment";

/*
 * PUT /api/v1/assessment_requests/{requestId}/assignee (Phase 13 D-05) and GET …/assignable_analysts (D-06). The
 * policy has resolved the caller and admitted only a human Security Analyst; these handlers pass the trusted identity
 * and the policy's facts to the service and map its refusals to actor-neutral responses: 400, 403 and 409 with their
 * closed reason, 404.
 */

type RecordValue = Record<string, unknown>;

type ErrorResponder = (message: string, details?: { reason: ConflictReason }) => unknown;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The eligible-analyst read's search term: the only query key, 1 to 100 characters after trimming. */
const ASSIGNABLE_SEARCH_MAX_LENGTH = 100;

function parseAssignableQuery(query: unknown): string | null {
  if (query === undefined || query === null) return null;
  if (!isRecord(query) || Object.keys(query).some((key) => key !== "q")) {
    throw new AssignmentError("CSRM assignable analyst search is invalid.", 400);
  }
  if (query.q === undefined) return null;
  const term = typeof query.q === "string" ? query.q.trim() : "";
  if (term.length < 1 || term.length > ASSIGNABLE_SEARCH_MAX_LENGTH) {
    throw new AssignmentError("CSRM assignable analyst search is invalid.", 400);
  }
  return term;
}

const ERROR_NAMES = { 400: "BadRequestError", 403: "ForbiddenError", 404: "NotFoundError", 409: "ConflictError" } as const;
const RESPONDERS = { 400: "badRequest", 403: "forbidden", 404: "notFound", 409: "conflict" } as const;

function refuse(ctx: RecordValue, error: AssignmentError): unknown {
  const details = conflictDetails(error.reason);
  const responder = ctx[RESPONDERS[error.status]];
  if (typeof responder === "function") return (responder as ErrorResponder).call(ctx, error.message, details);
  ctx.status = error.status;
  return { data: null, error: { status: error.status, name: ERROR_NAMES[error.status], message: error.message, ...(details ? { details } : {}) } };
}

const requestAssignmentController = {
  async changeAssignee(ctx: RecordValue) {
    const params = isRecord(ctx.params) ? ctx.params : {};
    const state = isRecord(ctx.state) ? ctx.state : {};
    const identity = isRecord(state.idamboxUser) ? state.idamboxUser : {};
    const facts = isRecord(state.csrmAuthorization) ? state.csrmAuthorization : {};
    const request = isRecord(ctx.request) ? ctx.request : {};
    const requestDocumentId = typeof params.requestId === "string" ? params.requestId : "";
    const actorDocumentId = typeof identity.documentId === "string" ? identity.documentId : "";
    try {
      if (!requestDocumentId || requestDocumentId.length > 255 || !actorDocumentId) {
        throw new AssignmentError("CSRM request assignment data is invalid.", 400);
      }
      const data = await changeRequestAssignee({
        strapi: globalThis.strapi as unknown as AssignmentStrapi,
        requestDocumentId,
        // WR-101: the acting analyst's own eligibility, the Agent role excluded whatever else is held.
        viewer: { documentId: actorDocumentId, humanAnalyst: facts.eligibleHumanAnalyst === true },
        body: request.body,
      });
      return { data };
    } catch (error) {
      if (error instanceof AssignmentError) return refuse(ctx, error);
      throw error;
    }
  },

  async listAssignableAnalysts(ctx: RecordValue) {
    const params = isRecord(ctx.params) ? ctx.params : {};
    const state = isRecord(ctx.state) ? ctx.state : {};
    const identity = isRecord(state.idamboxUser) ? state.idamboxUser : {};
    const facts = isRecord(state.csrmAuthorization) ? state.csrmAuthorization : {};
    const requestDocumentId = typeof params.requestId === "string" ? params.requestId : "";
    const callerDocumentId = typeof identity.documentId === "string" ? identity.documentId : "";
    try {
      if (!requestDocumentId || requestDocumentId.length > 255 || !callerDocumentId) {
        throw new AssignmentError("CSRM assignable analyst search is invalid.", 400);
      }
      const q = parseAssignableQuery(ctx.query);
      const data = await listAssignableAnalysts({
        strapi: globalThis.strapi as unknown as AssignmentStrapi,
        requestDocumentId,
        caller: { documentId: callerDocumentId, humanAnalyst: facts.eligibleHumanAnalyst === true },
        q,
      });
      return { data };
    } catch (error) {
      if (error instanceof AssignmentError) return refuse(ctx, error);
      throw error;
    }
  },
};

export default requestAssignmentController;
