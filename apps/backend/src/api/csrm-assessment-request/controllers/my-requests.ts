import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import { myRequestsExportView } from "../../../csrm/exports/export-views";
import { runListExport } from "../../../csrm/exports/run-export";
import { resolveExportActor, sendExportError, sendExportFile } from "../../../csrm/exports/send-export";
import { utcToday } from "../../../csrm/insights/utc-date";
import { listMyRequests, MyRequestsQueryError, ownRequestorId, parseMyRequestsQuery } from "../services/my-requests";

/*
 * GET /api/v1/my_requests (D-02 item 6, D-03). The route's policy grants every
 * actor an owner scope with its own numeric user id
 * (`requireRequestCollectionScope`), so this handler lists only the caller's
 * requests, whatever roles the caller also holds. The query is closed: any key
 * or value outside the published parameters is refused before a read, and no
 * query value reaches the owner check.
 */

type RecordValue = Record<string, unknown>;

const QUERY_INVALID = "CSRM assessment request query is invalid.";
const ACCESS_DENIED = "CSRM assessment request access is denied.";

function safeError(ctx: RecordValue, status: 400 | 403, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : ctx.forbidden;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

const myRequestsController = {
  async list(ctx: RecordValue) {
    let query: ReturnType<typeof parseMyRequestsQuery>;
    try {
      query = parseMyRequestsQuery(ctx.query);
    } catch (error) {
      if (error instanceof MyRequestsQueryError) return safeError(ctx, 400, QUERY_INVALID);
      throw error;
    }
    const requestorId = ownRequestorId(ctx.state);
    if (requestorId === null) return safeError(ctx, 403, ACCESS_DENIED);
    return listMyRequests(globalThis.strapi, { requestorId, query, today: utcToday(new Date()) });
  },

  /*
   * Phase 19 (D-04, D-06, D-13): GET /api/v1/my_requests/export, every request the list pages through for the caller's
   * owner scope, through the list's own parser, reader and projection (myRequestsExportView), as one file and one log line.
   */
  async exportMyRequests(ctx: RecordValue) {
    const strapi = globalThis.strapi;
    try {
      const file = await runListExport({
        view: myRequestsExportView(strapi),
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
};

export default myRequestsController;
