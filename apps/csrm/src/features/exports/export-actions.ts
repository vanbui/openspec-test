'use server';

import { z } from 'zod';

import { administrationKinds } from '@/features/administration/administration-config';
import { parseAdministrationQuery } from '@/features/administration/administration-schema';
import { exportReferenceList } from '@/features/administration/administration-service';
import { alertListQuerySchema } from '@/features/alerts/alert-schema';
import { exportAlerts } from '@/features/alerts/alert-service';
import { documentIdSchema } from '@/features/assessments/assessment-schema';
import {
  exportMyRiskAssessments,
  exportReleasedAssessment,
  exportReviewRequests,
  exportRiskAssessments,
  parseAssessmentCollectionQuery,
  parseAssessmentRequestReviewQuery,
} from '@/features/assessments/assessment-service';
import type { ExportResult } from '@/features/exports/export-file-check';
import { exportReport as reportExportSpec, exportViewColumns, exportVocabulary } from '@/features/exports/export-vocabulary';
import { exportRefusal, type ExportRefusalCopy, type ExportViewKind } from '@/features/exports/export-refusal-copy';
import { exportMyQuestionnaires, exportQuestionnaires, parseQuestionnaireListQuery } from '@/features/questionnaires/questionnaire-service';
import { reportKeys } from '@/features/reports/report-copy';
import { reportPeriods } from '@/features/reports/report-periods';
import { exportReport } from '@/features/reports/report-service';
import { requestListQuerySchema } from '@/features/requests/request-schema';
import { exportMyRequests } from '@/features/requests/request-service';
import { riskRegisterQuerySchema } from '@/features/risks/risk-schema';
import { exportRiskRegister } from '@/features/risks/risk-service';
import { readViewerTimeZone } from '@/lib/time/viewer-time-zone';

/*
 * One Server Action per export view (Phase 19 D-19, X-30). Each parses its input before the typed service is called:
 * the view's own query schema, a closed format and a unique subset of the view's export vocabulary. It reads the
 * viewer's zone for the file name's local date, and words a refusal with family S1. Strapi re-parses and authorises
 * every export (T-19-19); the action is not the boundary. No Route Handler and no raw `fetch`: the action is the
 * export's only path. It sets no cookie and revalidates nothing, because an export changes nothing (D-20).
 */

/** What an export returns to the dialog: the checked file with the server's name and count, or family S1's copy. */
export type ExportActionResult =
  | { ok: true; fileName: string; contentType: string; bytes: Uint8Array; rowCount: number }
  | { ok: false; refusal: ExportRefusalCopy };

const formatSchema = z.enum(['csv', 'xlsx']);

/** A unique subset of a view's export columns, 1 to 40 keys (the specification's `columns` bound). */
function columnsSchema(viewKey: string) {
  const keys = exportViewColumns(viewKey).map((column) => column.key);
  return z.array(z.string().refine((key) => keys.includes(key)))
    .min(1)
    .max(40)
    .refine((columns) => new Set(columns).size === columns.length);
}

/**
 * The register's query exactly as the page parses it, without its page and page size: the export is every page (D-13),
 * so a caller that names either is refused rather than having it silently dropped.
 */
const riskRegisterExportQuerySchema = z.record(z.string(), z.unknown())
  .refine((query) => !Object.hasOwn(query, 'page') && !Object.hasOwn(query, 'pageSize'))
  .pipe(riskRegisterQuerySchema)
  .transform(({ page: _page, pageSize: _pageSize, ...query }) => query);

const riskRegisterExportInputSchema = z.object({
  query: riskRegisterExportQuerySchema,
  format: formatSchema,
  columns: columnsSchema('risk-register').optional(),
}).strict();

const invalidExport: ExportActionResult = { ok: false, refusal: exportRefusal({ status: 400 }) };

/** The labels of a view's columns, by key: what EXPORT_CELL_TOO_LONG's closed key is named by in S1's copy. */
type ColumnLabels = readonly { readonly key: string; readonly label: string }[];

/**
 * The service's result for the dialog: the checked file, or family S1's words for the refusal, for the view exported.
 * A cell too long for Excel names its column by the view's own export vocabulary label.
 */
function toActionResult(result: ExportResult, view: ExportViewKind = 'list', columns: ColumnLabels = []): ExportActionResult {
  if (!result.error) return { ok: true, ...result.data };
  if (result.error.kind === 'file-check') return { ok: false, refusal: exportRefusal({}) };
  const { column, reason, rowCount, status } = result.error;
  const columnLabel = column === undefined ? undefined : columns.find((entry) => entry.key === column)?.label;
  return {
    ok: false,
    refusal: exportRefusal({
      ...(status === undefined ? {} : { status }),
      ...(reason ? { reason } : {}),
      ...(rowCount === undefined ? {} : { rowCount }),
      ...(columnLabel === undefined ? {} : { columnLabel }),
      view,
    }),
  };
}

/** The viewer's zone as a service option: present only when the shell has recorded a valid one. */
async function viewerZone(): Promise<{ timeZone?: string }> {
  const timeZone = await readViewerTimeZone();
  return timeZone ? { timeZone } : {};
}

/** Exports the Risk register's filtered view as the chosen format and columns, for the browser to save. */
export async function exportRiskRegisterAction(input: unknown): Promise<ExportActionResult> {
  const parsed = riskRegisterExportInputSchema.safeParse(input);
  if (!parsed.success) return invalidExport;
  const { columns, format, query } = parsed.data;
  return toActionResult(await exportRiskRegister({ query, format, ...(columns ? { columns } : {}), ...(await viewerZone()) }), 'list', exportViewColumns('risk-register'));
}

/*
 * A report is a fixed-table view (D-22, UI-D5): no columns; a workbook of its tables, or one of its tables (the export
 * vocabulary's keys) as CSV. Its query is the report's own: the throughput period alone, as the page's URL carries it.
 */
const reportKeySchema = z.enum(reportKeys);

const reportExportInputSchema = z.object({
  query: z.object({ period: z.enum(reportPeriods.map(String) as [string, ...string[]]).optional() }).strict(),
  format: formatSchema,
  table: z.string().optional(),
}).strict();

/**
 * Exports one report, bound on the page to its key: `reportKey` is that key, `input` what the dialog sends. A CSV
 * names one of the report's tables, a workbook none, and only the throughput report takes a period.
 */
export async function exportReportAction(reportKey: unknown, input: unknown): Promise<ExportActionResult> {
  const key = reportKeySchema.safeParse(reportKey);
  const parsed = reportExportInputSchema.safeParse(input);
  if (!key.success || !parsed.success) return invalidExport;
  const { format, query, table } = parsed.data;
  const tables = reportExportSpec(key.data).tables.map((entry) => entry.key);
  if (format === 'csv' ? table === undefined || !tables.includes(table) : table !== undefined) return invalidExport;
  if (query.period !== undefined && key.data !== 'assessment-throughput') return invalidExport;
  return toActionResult(await exportReport(key.data, {
    format,
    ...(table ? { table } : {}),
    query: query.period === undefined ? {} : { period: query.period },
    ...(await viewerZone()),
  }), 'report', reportExportSpec(key.data).tables.flatMap((entry) => entry.columns));
}

/*
 * The other list views (19-11, D-04). Each list's URL is strings, read by the list's own parser; the export's query is
 * that parser's result without its page and page size. A key the list does not read, a page or a page size is refused
 * rather than silently dropped.
 */
function urlQuerySchema<T extends { page: number; pageSize: number }>(keys: readonly string[], parse: (value: Record<string, string | undefined>) => T) {
  return z.record(z.string(), z.string().max(200).optional())
    .refine((query) => Object.keys(query).every((key) => keys.includes(key)))
    .transform((query) => {
      const { page: _page, pageSize: _pageSize, ...rest } = parse(query);
      return rest;
    });
}

/** A list view's input: its query, a closed format and a unique subset of the view's columns. */
function listExportInputSchema<Q extends z.ZodType>(query: Q, viewKey: string) {
  return z.object({ query, format: formatSchema, columns: columnsSchema(viewKey).optional() }).strict();
}

/** Parses a list view's input, then calls its service with the viewer's zone; a refusal names the view's columns. */
async function exportListView<Q>(
  schema: z.ZodType<{ query: Q; format: 'csv' | 'xlsx'; columns?: string[] }>,
  input: unknown,
  service: (options: { query: Q; format: 'csv' | 'xlsx'; columns?: readonly string[]; timeZone?: string }) => Promise<ExportResult>,
  viewKey: string,
): Promise<ExportActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalidExport;
  const { columns, format, query } = parsed.data;
  return toActionResult(await service({ query, format, ...(columns ? { columns } : {}), ...(await viewerZone()) }), 'list', exportViewColumns(viewKey));
}

const reviewRequestsExportInputSchema = listExportInputSchema(
  urlQuerySchema(['q', 'queue', 'status', 'assignee', 'notes', 'sort'], (query) => parseAssessmentRequestReviewQuery(query, 'requires-attention')),
  'requests',
);

/** Exports Requests, or Assigned to me with its assignee scope and Phase 13's filters, as the queue chooses it. */
export async function exportReviewRequestsAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(reviewRequestsExportInputSchema, input, exportReviewRequests, 'requests');
}

const myRequestsExportInputSchema = listExportInputSchema(
  z.record(z.string(), z.unknown())
    .refine((query) => !Object.hasOwn(query, 'page') && !Object.hasOwn(query, 'pageSize'))
    .pipe(requestListQuerySchema)
    .transform(({ page: _page, pageSize: _pageSize, ...query }) => query),
  'my-requests',
);

/** Exports My requests, with its holder and notes filters, as the list chooses them. */
export async function exportMyRequestsAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(myRequestsExportInputSchema, input, exportMyRequests, 'my-requests');
}

const questionnaireQueryKeys = ['q', 'status', 'sort'] as const;

const questionnairesExportInputSchema = listExportInputSchema(urlQuerySchema(questionnaireQueryKeys, parseQuestionnaireListQuery), 'questionnaires');
const myQuestionnairesExportInputSchema = listExportInputSchema(urlQuerySchema(questionnaireQueryKeys, parseQuestionnaireListQuery), 'my-questionnaires');

/** Exports the analyst's Questionnaires list as its search and status choose it. */
export async function exportQuestionnairesAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(questionnairesExportInputSchema, input, exportQuestionnaires, 'questionnaires');
}

/** Exports My questionnaires as its search and status choose them. */
export async function exportMyQuestionnairesAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(myQuestionnairesExportInputSchema, input, exportMyQuestionnaires, 'my-questionnaires');
}

const assessmentQueryKeys = ['q', 'status', 'overallRating', 'approvedFrom', 'approvedTo', 'sort'] as const;

const riskAssessmentsExportInputSchema = listExportInputSchema(urlQuerySchema(assessmentQueryKeys, parseAssessmentCollectionQuery), 'risk-assessments');
const myRiskAssessmentsExportInputSchema = listExportInputSchema(urlQuerySchema(assessmentQueryKeys, parseAssessmentCollectionQuery), 'my-risk-assessments');

/** Exports the analyst's Risk assessments list as its filters choose it. */
export async function exportRiskAssessmentsAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(riskAssessmentsExportInputSchema, input, exportRiskAssessments, 'risk-assessments');
}

/** Exports My risk assessments as its filters choose them. */
export async function exportMyRiskAssessmentsAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(myRiskAssessmentsExportInputSchema, input, exportMyRiskAssessments, 'my-risk-assessments');
}

const alertsExportInputSchema = listExportInputSchema(alertListQuerySchema.omit({ page: true, pageSize: true }).strict(), 'alerts');

/** Exports the analyst's alerts as the kind and urgency filters choose them. */
export async function exportAlertsAction(input: unknown): Promise<ExportActionResult> {
  return exportListView(alertsExportInputSchema, input, exportAlerts, 'alerts');
}

/*
 * The released assessment (D-21, UI-D5): a fixed-table record export, bound on the page to the assessment's id, which
 * is validated as the assessment pages validate it. No query and no columns; a CSV names one of the two tables a CSV
 * can hold (the summary travels in the workbook only), a workbook none.
 */
const releasedAssessmentExportInputSchema = z.object({
  query: z.object({}).strict().optional(),
  format: formatSchema,
  table: z.enum(['risks', 'mitigation-controls']).optional(),
}).strict();

/** Exports one released assessment, bound on the page to its id: `assessmentId` is that id, `input` what the dialog sends. */
export async function exportReleasedAssessmentAction(assessmentId: unknown, input: unknown): Promise<ExportActionResult> {
  const id = documentIdSchema.safeParse(assessmentId);
  const parsed = releasedAssessmentExportInputSchema.safeParse(input);
  if (!id.success || !parsed.success) return invalidExport;
  const { format, table } = parsed.data;
  if (format === 'csv' ? table === undefined : table !== undefined) return invalidExport;
  const releasedColumns = Object.values(exportVocabulary.tables['released-assessment'] ?? {}).flatMap((entry) => entry.columns);
  return toActionResult(await exportReleasedAssessment(id.data, { format, ...(table ? { table } : {}), ...(await viewerZone()) }), 'released-assessment', releasedColumns);
}

/*
 * A reference list (D-04, D-33; 19-UI-SPEC §2.4): bound on the admin page to its collection, its query read by the admin
 * list's own parser (the URL's strings), without its page and page size, and the collection's export columns. The file
 * is the list in its import shape, so it can be edited and imported again.
 */
const administrationKindSchema = z.enum(administrationKinds);

/** The URL keys each admin list reads (administration-schema.ts), so a key it does not read is refused, not dropped. */
const administrationQueryKeys = {
  'risk-types': ['q', 'sort'],
  controls: ['q', 'sort', 'framework', 'controlType'],
  'information-systems': ['q', 'sort', 'environment', 'deploymentModel', 'lifecycleState', 'internetFacing'],
  'information-assets': ['q', 'sort', 'dataClassification', 'containsPersonalData', 'containsLegalData', 'containsCreditCardData'],
} as const satisfies Record<(typeof administrationKinds)[number], readonly string[]>;

/** Exports one reference list, bound on the page to its collection: `kind` is that collection, `input` what the dialog sends. */
export async function exportReferenceListAction(kind: unknown, input: unknown): Promise<ExportActionResult> {
  const collection = administrationKindSchema.safeParse(kind);
  if (!collection.success) return invalidExport;
  const schema = listExportInputSchema(
    z.record(z.string(), z.string().max(255).optional())
      .refine((query) => Object.keys(query).every((key) => (administrationQueryKeys[collection.data] as readonly string[]).includes(key)))
      .transform((query, context) => {
        try {
          const { page: _page, pageSize: _pageSize, ...rest } = parseAdministrationQuery(collection.data, query);
          return rest;
        } catch {
          context.addIssue({ code: 'custom', message: 'The reference list query is invalid.' });
          return z.NEVER;
        }
      }),
    collection.data,
  );
  return exportListView(schema, input, (options) => exportReferenceList(collection.data, options), collection.data);
}
