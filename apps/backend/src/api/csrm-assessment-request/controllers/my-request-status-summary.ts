import { ownRequestorId } from "../services/my-requests";
import { readOwnedRequestStatusSummary } from "../services/request-status-summary";

/*
 * GET /api/v1/my_requests/status_summary (D-05, D-28). The route's policy grants
 * every actor an owner scope with their own numeric user id
 * (`requireRequestCollectionScope`), so this handler counts only the caller's
 * requests, whatever roles the caller also holds. The operation takes no query:
 * any key is refused before a read, so nothing a caller sends reaches the SQL.
 */

type RecordValue = Record<string, unknown>;

const QUERY_INVALID = "CSRM assessment request query is invalid.";
const ACCESS_DENIED = "CSRM assessment request access is denied.";

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : ctx.forbidden;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

const myRequestStatusSummaryController = {
  async statusSummary(ctx: RecordValue) {
    if (!isRecord(ctx.query) || Object.keys(ctx.query).length > 0) return safeError(ctx, 400, QUERY_INVALID);
    const requestorId = ownRequestorId(ctx.state);
    if (requestorId === null) return safeError(ctx, 403, ACCESS_DENIED);
    const connection = globalThis.strapi.db.connection;
    return { data: await readOwnedRequestStatusSummary(connection, requestorId) };
  },
};

export default myRequestStatusSummaryController;
