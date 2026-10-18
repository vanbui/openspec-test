import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ExportFileFormat } from '../../lib/files/file-response';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, type ExportResult } from '../exports/export-file-check';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type { ReportKey } from './report-copy';
import {
  parseReportDefinitionListPayload,
  parseReportPayload,
  reportDefinitionListResponseSchema,
  reportRequestSchema,
  reportResponseSchemas,
  type ReportDefinition,
  type ReportFor,
  type ReportPeriod,
} from './report-schema';

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

const REPORT_PATH = '/v1/reports/{reportKey}';

/**
 * The index and every report branch are parsed closed, with no narrowing, and
 * guarded against the published contract. Each report names the branch of the
 * discriminated union it parses.
 */
export const responseParserModule = {
  modulePath: 'features/reports/report-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'reports.listReportDefinitions', component: 'ReportDefinitionListResponse', parser: reportDefinitionListResponseSchema },
    { label: 'reports.getReport.riskExposure', path: REPORT_PATH, method: 'get', branch: 'RiskExposureReport', parser: reportResponseSchemas['risk-exposure'] },
    {
      label: 'reports.getReport.treatmentPerformance',
      path: REPORT_PATH,
      method: 'get',
      branch: 'TreatmentPerformanceReport',
      parser: reportResponseSchemas['treatment-performance'],
      // The most-overdue rows are alert rows; their free-text source title is
      // unbounded in the contract and capped at 65,535 characters by the
      // client, the narrowing registered on alerts.listAlerts (D-02, D-05).
      narrowedPaths: ['data.mostOverdue.rows.0.source.title'],
    },
    { label: 'reports.getReport.assessmentThroughput', path: REPORT_PATH, method: 'get', branch: 'AssessmentThroughputReport', parser: reportResponseSchemas['assessment-throughput'] },
    { label: 'reports.getReport.controlEffectiveness', path: REPORT_PATH, method: 'get', branch: 'ControlEffectivenessReport', parser: reportResponseSchemas['control-effectiveness'] },
  ] as const satisfies readonly ContractResponseParser[],
  // Phase 19 D-22: a report's export is a file, checked by the shared validator's export rule instead of a zod parser.
  fileResponses: [
    { label: 'reports.exportReport', path: '/v1/reports/{reportKey}/export', method: 'post' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
  ],
};

/** The parser label of each report, so a contract mismatch names the branch that refused it. */
const reportOperations = {
  'risk-exposure': 'reports.getReport.riskExposure',
  'treatment-performance': 'reports.getReport.treatmentPerformance',
  'assessment-throughput': 'reports.getReport.assessmentThroughput',
  'control-effectiveness': 'reports.getReport.controlEffectiveness',
} as const satisfies Record<ReportKey, string>;

async function request<T>(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
  parse: (payload: unknown) => T,
  operation: string,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    // A refusal keeps its status, so a 403 reaches the screen as permission denied and a 404 as not found.
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError(operation);
    return normalizeTransportError(error);
  }
}

/** The analyst report definitions, in the server's display order (D-13). */
export async function listReportDefinitions(): Promise<TransportResult<ReportDefinition[]>> {
  return request((client) => client.GET('/v1/reports'), parseReportDefinitionListPayload, 'reports.listReportDefinitions');
}

export type ReportOptions = {
  /** assessment-throughput only; absent reads the server's default of six months. */
  period?: ReportPeriod;
};

/**
 * One server-computed report. Only the throughput report sends a period; a
 * period for any other report, or a key outside the closed set, is refused
 * before any read.
 */
export async function getReport<K extends ReportKey>(key: K, options: ReportOptions = {}): Promise<TransportResult<ReportFor<K>>> {
  const input = reportRequestSchema.parse({ key, ...options });
  return request(
    (client) => (input.key === 'assessment-throughput' && input.period !== undefined
      ? client.GET(REPORT_PATH, { params: { path: { reportKey: input.key }, query: { period: input.period } } })
      : client.GET(REPORT_PATH, { params: { path: { reportKey: input.key } } })),
    (payload) => parseReportPayload(key, payload),
    reportOperations[key],
  );
}

/** A report export's body (D-22, UI-D5): no columns; one table for CSV only; the report's own query as strings. */
export type ReportExportInput = {
  format: ExportFileFormat;
  /** One of the report's table keys, CSV only. */
  table?: string;
  timeZone?: string;
  /** The report's own query: only assessment-throughput takes one, its period. */
  query: Readonly<Record<string, string>>;
};

/**
 * Exports one report (D-22): a workbook of its tables, or one table as CSV, through the generated path with a binary
 * parse. Strapi authorises the export, parses the report's query with the report's own parser and builds the file;
 * the shared validator checks it before any byte is returned. The table and the viewer's zone are sent only when given.
 */
export async function exportReport(reportKey: ReportKey, input: ReportExportInput): Promise<ExportResult> {
  try {
    const client = await createStrapiClient();
    const exported = await client.POST('/v1/reports/{reportKey}/export', {
      params: { path: { reportKey } },
      body: {
        format: input.format,
        ...(input.table ? { table: input.table } : {}),
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        query: { ...input.query },
      },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}
