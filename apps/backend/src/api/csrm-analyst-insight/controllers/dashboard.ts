import { AlertQueryError, assertEmptyInsightQuery } from "../services/alert-query";
import { computeDashboardSummary } from "../services/dashboard-summary";
import { AnalystInsightError, assertAnalystInsightScope } from "../services/insight-scope";
import { ALERT_DUE_SOON_WINDOW_DAYS } from "../../../csrm/insights/insight-constants";
import { utcToday } from "../../../csrm/insights/utc-date";

/*
 * GET /api/v1/dashboard/summary (DASH-01, D-05, D-34). The route policy grants
 * the analyst insight scope only to a human Security Analyst; the handler
 * asserts it before anything is read, refuses any query key, then reads the
 * clock once, so every due state and alert window in the summary shares one
 * today.
 */

type RecordValue = Record<string, unknown>;

const DASHBOARD_QUERY_INVALID = "CSRM dashboard query is invalid.";

function safeError(ctx: RecordValue, status: 400 | 403 | 404, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : ctx.notFound;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  // The summary takes no query, so the shared empty-query check's refusal is named for the dashboard.
  if (error instanceof AlertQueryError) return safeError(ctx, 400, DASHBOARD_QUERY_INVALID);
  if (error instanceof AnalystInsightError) return safeError(ctx, error.status, error.message);
  throw error;
}

const dashboardController = {
  async summary(ctx: RecordValue) {
    try {
      assertAnalystInsightScope(ctx.state);
      assertEmptyInsightQuery(ctx.query);
      const today = utcToday(new Date());
      const summary = await computeDashboardSummary(globalThis.strapi, today);
      return { data: { today, dueSoonWindowDays: ALERT_DUE_SOON_WINDOW_DAYS, ...summary } };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
};

export default dashboardController;
