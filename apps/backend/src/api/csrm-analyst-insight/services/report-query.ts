import { THROUGHPUT_DEFAULT_PERIOD, THROUGHPUT_PERIODS } from "../../../csrm/insights/insight-constants";
import { isReportKey, type ReportKey } from "./report-definitions";

/*
 * The closed report request (D-13). A report is chosen by its key alone; the
 * only query parameter is the throughput period, one of THROUGHPUT_PERIODS,
 * so no caller-supplied grouping, filter or scope can reach a report. Anything
 * else is one safe 400, and a key outside the closed set is a 404.
 */

type RecordValue = Record<string, unknown>;

export type ThroughputPeriod = typeof THROUGHPUT_PERIODS[number];

export type ReportRequest =
  | { key: "assessment-throughput"; period: ThroughputPeriod }
  | { key: Exclude<ReportKey, "assessment-throughput">; period: null };

export class ReportQueryError extends Error {
  readonly status = 400;

  constructor() {
    super("CSRM report query is invalid.");
    this.name = "ReportQueryError";
  }
}

export class ReportNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("CSRM report was not found.");
    this.name = "ReportNotFoundError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** GET /api/v1/reports takes no query: any key is refused before anything is read. */
export function assertEmptyReportQuery(query: unknown): void {
  if (!isRecord(query) || Object.keys(query).length > 0) throw new ReportQueryError();
}

/** `period` is exactly "6" or "12" (or the numbers), once. A list, an operator object or any other form is refused. */
function parsePeriod(value: unknown): ThroughputPeriod {
  if (value === undefined) return THROUGHPUT_DEFAULT_PERIOD;
  const period = THROUGHPUT_PERIODS.find((candidate) => value === candidate || value === String(candidate));
  if (period === undefined) throw new ReportQueryError();
  return period;
}

/**
 * GET /api/v1/reports/{reportKey}: the key must name a report, and only
 * assessment-throughput takes a query, `period`, which defaults to six months.
 */
export function parseReportRequest(reportKey: unknown, query: unknown): ReportRequest {
  if (!isReportKey(reportKey)) throw new ReportNotFoundError();
  if (!isRecord(query)) throw new ReportQueryError();
  const keys = Object.keys(query);
  if (reportKey === "assessment-throughput") {
    if (keys.some((key) => key !== "period")) throw new ReportQueryError();
    return { key: reportKey, period: parsePeriod(query.period) };
  }
  if (keys.length > 0) throw new ReportQueryError();
  return { key: reportKey, period: null };
}

/** The keys a report export body may hold (D-16; UI-D5: no `columns`). */
const REPORT_EXPORT_BODY_KEYS: ReadonlySet<string> = new Set(["format", "table", "timeZone", "query"]);
/** The most query parameters a report export may pass to its report, and the longest value. */
export const REPORT_EXPORT_QUERY_MAX_KEYS = 16;
export const REPORT_EXPORT_QUERY_VALUE_MAX = 200;

/** The report export's body once parsed: the report request, and the export controls the export pipeline validates. */
export type ReportExportBody = {
  readonly request: ReportRequest;
  readonly format: unknown;
  readonly table: unknown;
  readonly timeZone: unknown;
};

/** The body's `query`: absent, or an object of at most 16 text values of at most 200 characters each. */
function reportExportQuery(value: unknown): RecordValue {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new ReportQueryError();
  const entries = Object.entries(value);
  if (entries.length > REPORT_EXPORT_QUERY_MAX_KEYS) throw new ReportQueryError();
  if (entries.some(([, entry]) => typeof entry !== "string" || entry.length > REPORT_EXPORT_QUERY_VALUE_MAX)) throw new ReportQueryError();
  return value;
}

/**
 * POST /api/v1/reports/{reportKey}/export (Phase 19 D-16, D-22; UI-D5): the key must name a report (404 otherwise).
 * The body is a closed object of `format`, `table`, `timeZone` and `query`; any other key, `columns` included, is a
 * 400. `query` holds the report's own query parameters as text, parsed by parseReportRequest unchanged, so the export
 * runs the report its read would. `format`, `table` and `timeZone` are validated by the export pipeline, which knows
 * the report's tables.
 */
export function parseReportExportBody(reportKey: unknown, body: unknown): ReportExportBody {
  if (!isReportKey(reportKey)) throw new ReportNotFoundError();
  if (!isRecord(body)) throw new ReportQueryError();
  if (Object.keys(body).some((key) => !REPORT_EXPORT_BODY_KEYS.has(key))) throw new ReportQueryError();
  const request = parseReportRequest(reportKey, reportExportQuery(body.query));
  return { request, format: body.format, table: body.table, timeZone: body.timeZone };
}
