import { AnalystInsightError, assertAnalystInsightScope } from "../services/insight-scope";
import { REPORT_DEFINITIONS } from "../services/report-definitions";
import {
  ReportNotFoundError,
  ReportQueryError,
  assertEmptyReportQuery,
  parseReportExportBody,
  parseReportRequest,
  type ReportExportBody,
  type ReportRequest,
} from "../services/report-query";
import { createReportRepository } from "../services/report-repository";
import { utcToday } from "../../../csrm/insights/utc-date";
import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import { reportExportAbout, reportExportTables, reportExportView, type ComputedReport } from "../../../csrm/exports/report-tables";
import { ExportQueryError, logRefusedFixedTableRequest, runFixedTableExport } from "../../../csrm/exports/run-export";
import { resolveExportActor, sendExportError, sendExportFile } from "../../../csrm/exports/send-export";

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

/** One report, chosen from the closed switch by its parsed key. The read and the export both compute it here. */
async function computeReport(request: ReportRequest, today: string): Promise<ComputedReport> {
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

  /*
   * Phase 19 (D-03, D-13, D-16 to D-18, D-22; UI-D5): POST /api/v1/reports/{reportKey}/export. The insight scope is
   * asserted first; the body's query goes to the report's own parser, the report is computed exactly as `get` computes
   * it, and its figures are shaped as the page's tables for the fixed-table pipeline (one file, one log line). A body
   * the report export does not take is a 400 with one export.refused line; an unknown report key is the read's 404.
   */
  async export(ctx: RecordValue) {
    const strapi = globalThis.strapi;
    const now = new Date();
    try {
      assertAnalystInsightScope(ctx.state);
      const actor = await resolveExportActor(strapi, ctx.state);
      const log = (strapi as unknown as { log: SecurityEventLogger }).log;
      const reportKey = isRecord(ctx.params) ? ctx.params.reportKey : undefined;
      const rawBody = isRecord(ctx.request) ? ctx.request.body : undefined;
      let body: ReportExportBody;
      try {
        body = parseReportExportBody(reportKey, rawBody);
      } catch (error) {
        if (!(error instanceof ReportQueryError)) throw error;
        // The key named a report (an unknown key is the 404 above), so the refusal names its view.
        logRefusedFixedTableRequest({ viewKey: `report:${String(reportKey)}`, actor, format: isRecord(rawBody) ? rawBody.format : undefined, now, log });
        throw new ExportQueryError();
      }
      const report = await computeReport(body.request, utcToday(now));
      const view = reportExportView(body.request.key);
      const file = await runFixedTableExport({
        viewKey: view.viewKey,
        slug: view.slug,
        heading: view.heading,
        tables: reportExportTables(report),
        format: body.format,
        table: body.table,
        timeZone: body.timeZone,
        actor,
        now,
        log,
        about: reportExportAbout(report),
      });
      sendExportFile(ctx as unknown as Parameters<typeof sendExportFile>[0], file);
      return undefined;
    } catch (error) {
      if (sendExportError(ctx as unknown as Parameters<typeof sendExportError>[0], error)) return undefined;
      return handleError(ctx, error);
    }
  },
};

export default reportsController;
