import { AlertQueryError, assertEmptyInsightQuery, parseAlertListQuery } from "../services/alert-query";
import { createAlertRepository, projectAlertRow, summariseAlertCounts } from "../services/alert-repository";
import { AnalystInsightError, assertAnalystInsightScope } from "../services/insight-scope";
import { ALERT_DUE_SOON_WINDOW_DAYS } from "../../../csrm/insights/insight-constants";
import { utcToday } from "../../../csrm/insights/utc-date";

/*
 * GET /api/v1/alerts and GET /api/v1/alerts/summary (D-05, D-10, D-12). The
 * route policy grants the analyst insight scope only to a human Security
 * Analyst; each handler asserts it before anything is read, then reads the
 * clock once, so the list, its total and its day offsets share one today.
 */

type RecordValue = Record<string, unknown>;

function safeError(ctx: RecordValue, status: 400 | 403 | 404, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : ctx.notFound;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AlertQueryError) return safeError(ctx, 400, error.message);
  if (error instanceof AnalystInsightError) return safeError(ctx, error.status, error.message);
  throw error;
}

const alertsController = {
  async list(ctx: RecordValue) {
    try {
      assertAnalystInsightScope(ctx.state);
      const query = parseAlertListQuery(ctx.query);
      const today = utcToday(new Date());
      const repository = createAlertRepository(globalThis.strapi);
      const [total, rows] = await Promise.all([
        repository.count({ kinds: query.kinds, urgency: query.urgency, today }),
        repository.listPage({ ...query, today }),
      ]);
      return {
        data: rows.map((row) => projectAlertRow(row, today)),
        meta: {
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            pageCount: Math.ceil(total / query.pageSize),
            total,
          },
          today,
          dueSoonWindowDays: ALERT_DUE_SOON_WINDOW_DAYS,
        },
      };
    } catch (error) {
      return handleError(ctx, error);
    }
  },

  async summary(ctx: RecordValue) {
    try {
      assertAnalystInsightScope(ctx.state);
      assertEmptyInsightQuery(ctx.query);
      const today = utcToday(new Date());
      const counts = summariseAlertCounts(await createAlertRepository(globalThis.strapi).countByKindAndUrgency(today));
      return { data: { ...counts, today, dueSoonWindowDays: ALERT_DUE_SOON_WINDOW_DAYS } };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
};

export default alertsController;
