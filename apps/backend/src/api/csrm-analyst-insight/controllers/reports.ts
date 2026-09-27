import { AnalystInsightError, assertAnalystInsightScope } from "../services/insight-scope";
import { REPORT_DEFINITIONS } from "../services/report-definitions";
import {
  ReportNotFoundError,
  ReportQueryError,
  assertEmptyReportQuery,
  parseReportRequest,
  type ReportRequest,
} from "../services/report-query";
import { createReportRepository } from "../services/report-repository";
import { utcToday } from "../../../csrm/insights/utc-date";

/*
 * GET /api/v1/reports and GET /api/v1/reports/{reportKey} (D-05, D-13). The
 * route policy grants the analyst insight scope only to a human Security
 * Analyst; each handler asserts it before the key or the query is read, so a
 * caller without it learns nothing about which report keys exist. The clock is
 * read once per report, and the report carries that UTC date as `today`.
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : ctx.notFound;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof ReportQueryError) return safeError(ctx, 400, error.message);
  if (error instanceof ReportNotFoundError) return safeError(ctx, 404, error.message);
  if (error instanceof AnalystInsightError) return safeError(ctx, error.status, error.message);
  throw error;
}

/** One report, chosen from the closed switch by its parsed key. */
async function computeReport(request: ReportRequest, today: string): Promise<RecordValue> {
  const repository = createReportRepository(globalThis.strapi);
  switch (request.key) {
    case "risk-exposure":
      return { key: request.key, today, ...(await repository.riskExposure()) };
    case "control-effectiveness":
      return { key: request.key, today, ...(await repository.controlEffectiveness()) };
    case "treatment-performance":
      return { key: request.key, today, ...(await repository.treatmentPerformance(today)) };
    case "assessment-throughput":
      return { key: request.key, today, ...(await repository.assessmentThroughput(today, request.period)) };
    default: {
      const unreachable: never = request;
      throw new Error(`Unknown report request: ${JSON.stringify(unreachable)}`);
    }
  }
}

const reportsController = {
  async list(ctx: RecordValue) {
    try {
      assertAnalystInsightScope(ctx.state);
      assertEmptyReportQuery(ctx.query);
      return { data: REPORT_DEFINITIONS.map((definition) => ({ ...definition })) };
    } catch (error) {
      return handleError(ctx, error);
    }
  },

  async get(ctx: RecordValue) {
    try {
      assertAnalystInsightScope(ctx.state);
      const reportKey = isRecord(ctx.params) ? ctx.params.reportKey : undefined;
      const request = parseReportRequest(reportKey, ctx.query);
      const today = utcToday(new Date());
      return { data: await computeReport(request, today) };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
};

export default reportsController;
