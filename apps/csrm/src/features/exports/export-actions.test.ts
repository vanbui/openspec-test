import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exportAlerts: vi.fn(),
  exportMyQuestionnaires: vi.fn(),
  exportMyRequests: vi.fn(),
  exportMyRiskAssessments: vi.fn(),
  exportQuestionnaires: vi.fn(),
  exportReleasedAssessment: vi.fn(),
  exportReport: vi.fn(),
  exportReviewRequests: vi.fn(),
  exportRiskAssessments: vi.fn(),
  exportRiskRegister: vi.fn(),
  exportReferenceList: vi.fn(),
  readViewerTimeZone: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/features/risks/risk-service', () => ({ exportRiskRegister: mocks.exportRiskRegister }));
vi.mock('@/features/reports/report-service', () => ({ exportReport: mocks.exportReport }));
vi.mock('@/features/alerts/alert-service', () => ({ exportAlerts: mocks.exportAlerts }));
vi.mock('@/features/requests/request-service', () => ({ exportMyRequests: mocks.exportMyRequests }));
vi.mock('@/features/assessments/assessment-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/assessments/assessment-service')>(),
  exportMyRiskAssessments: mocks.exportMyRiskAssessments,
  exportReleasedAssessment: mocks.exportReleasedAssessment,
  exportReviewRequests: mocks.exportReviewRequests,
  exportRiskAssessments: mocks.exportRiskAssessments,
}));
vi.mock('@/features/questionnaires/questionnaire-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/questionnaires/questionnaire-service')>(),
  exportMyQuestionnaires: mocks.exportMyQuestionnaires,
  exportQuestionnaires: mocks.exportQuestionnaires,
}));
vi.mock('@/lib/time/viewer-time-zone', () => ({ readViewerTimeZone: mocks.readViewerTimeZone }));
vi.mock('@/features/administration/administration-service', () => ({ exportReferenceList: mocks.exportReferenceList }));

import * as actions from './export-actions';
import { exportReportAction, exportRiskRegisterAction } from './export-actions';

/*
 * Phase 19 D-19 (T-19-19): the register export's Server Action parses its input with the register's own query schema,
 * a closed format and the register's export vocabulary before the typed service is called, passes the viewer's zone
 * when it is known, and words a refusal with family S1. Strapi re-parses and authorises; the action is not the boundary.
 */

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
const invalidCopy = { tone: 'warning', message: 'The current search or filters can’t be exported. Clear the filters, then export again.', retry: false };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.readViewerTimeZone.mockResolvedValue(null);
  mocks.exportRiskRegister.mockResolvedValue({ data: { fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 1 }, error: null });
  mocks.exportReport.mockResolvedValue({ data: { fileName: 'risk-exposure-report-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 4 }, error: null });
  for (const service of [mocks.exportReferenceList, mocks.exportAlerts, mocks.exportMyQuestionnaires, mocks.exportMyRequests, mocks.exportMyRiskAssessments, mocks.exportQuestionnaires, mocks.exportReleasedAssessment, mocks.exportReviewRequests, mocks.exportRiskAssessments]) {
    service.mockResolvedValue({ data: { fileName: 'list-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 2 }, error: null });
  }
});

describe('exportRiskRegisterAction', () => {
  it('exports the parsed register query with the chosen format and columns, and returns the server’s file and count', async () => {
    const result = await exportRiskRegisterAction({ query: { q: 'HYPERLINK', residualRating: 'High' }, format: 'xlsx', columns: ['riskNumber', 'riskStatement'] });

    expect(result).toEqual({ ok: true, fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 1 });
    expect(mocks.exportRiskRegister).toHaveBeenCalledWith({
      query: expect.objectContaining({ q: 'HYPERLINK', residualRating: 'High', sort: 'targetDate:asc' }),
      format: 'xlsx',
      columns: ['riskNumber', 'riskStatement'],
    });
  });

  it('passes the viewer’s time zone when it is known', async () => {
    mocks.readViewerTimeZone.mockResolvedValueOnce('Australia/Sydney');

    await exportRiskRegisterAction({ query: {}, format: 'csv' });

    expect(mocks.exportRiskRegister).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv', timeZone: 'Australia/Sydney' }));
    expect(mocks.exportRiskRegister.mock.calls[0]?.[0]).not.toHaveProperty('columns');
  });

  it.each([
    ['a page', { query: { page: 2 }, format: 'xlsx' }],
    ['a page size', { query: { pageSize: 50 }, format: 'xlsx' }],
    ['an unknown column key', { query: {}, format: 'xlsx', columns: ['riskNumber', 'secretField'] }],
    ['a repeated column key', { query: {}, format: 'xlsx', columns: ['riskNumber', 'riskNumber'] }],
    ['no column', { query: {}, format: 'xlsx', columns: [] }],
    ['format pdf', { query: {}, format: 'pdf' }],
    ['an invalid date range', { query: { targetDateFrom: '2026-12-31', targetDateTo: '2026-01-01' }, format: 'xlsx' }],
    ['an unknown property', { query: {}, format: 'xlsx', table: 'risks' }],
    ['no input', undefined],
  ])('refuses %s with the 400 copy without calling the service', async (_case, input) => {
    await expect(exportRiskRegisterAction(input)).resolves.toEqual({ ok: false, refusal: invalidCopy });
    expect(mocks.exportRiskRegister).not.toHaveBeenCalled();
  });

  it('words a 422 row limit with the server’s count', async () => {
    mocks.exportRiskRegister.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12_500, rowCap: 10_000 } });

    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual({
      ok: false,
      refusal: { tone: 'warning', message: 'This export would hold 12,500 rows, more than the 10,000 limit. Narrow the search or filters, then export again.', retry: false },
    });
  });

  it('words a 403, a 500 and a file the validator refused with family S1', async () => {
    mocks.exportRiskRegister.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 403 } });
    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual({ ok: false, refusal: { tone: 'danger', message: 'You don’t have access to export this list.', retry: false } });

    const failed = { ok: false, refusal: { tone: 'danger', message: 'We couldn’t create the file.', retry: true } };
    mocks.exportRiskRegister.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 500 } });
    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual(failed);
    mocks.exportRiskRegister.mockResolvedValueOnce({ data: null, error: { kind: 'file-check', failure: 'signature' } });
    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual(failed);
  });
});

/*
 * The exports record's code review amendment (2026-10-17, 3b5c66fa): EXPORT_CELL_TOO_LONG names its column by the
 * export vocabulary's label for the view exported. A key the view doesn't hold reads as the failed file.
 */
describe('a cell too long for Excel', () => {
  const tooLong = (column: string) => ({ data: null, error: { message: 'x', status: 422, reason: 'EXPORT_CELL_TOO_LONG', column, cellLimit: 32767 } });
  const listBody = (label: string) => `${label} holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export as CSV instead, or shorten the text in CSRM.`;
  const refused = (message: string) => ({ ok: false, refusal: { tone: 'warning', title: 'A value is too long for Excel', message, retry: false } });

  it('names a list column, a report column and a reference list column by their labels', async () => {
    mocks.exportRiskRegister.mockResolvedValueOnce(tooLong('riskStatement'));
    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual(refused(listBody('Statement')));

    mocks.exportReport.mockResolvedValueOnce(tooLong('informationSystem'));
    await expect(exportReportAction('risk-exposure', { query: {}, format: 'xlsx' })).resolves.toEqual(refused(listBody('Information System')));

    mocks.exportReferenceList.mockResolvedValueOnce(tooLong('description'));
    await expect(actions.exportReferenceListAction('information-systems', { query: {}, format: 'xlsx' })).resolves.toEqual(refused(listBody('Description')));
  });

  it('names a released assessment column and points to its tables and report', async () => {
    mocks.exportReleasedAssessment.mockResolvedValueOnce(tooLong('riskStatement'));
    await expect(actions.exportReleasedAssessmentAction('assessment-1', { query: {}, format: 'xlsx' })).resolves.toEqual(refused(
      'Risk statement holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export the Risks or Mitigation controls table as CSV, or use the print-ready report for the whole record.',
    ));
  });

  it('reads a column the view does not hold as the failed file', async () => {
    mocks.exportRiskRegister.mockResolvedValueOnce(tooLong('notAColumn'));
    await expect(exportRiskRegisterAction({ query: {}, format: 'xlsx' })).resolves.toEqual({ ok: false, refusal: { tone: 'danger', message: 'We couldn’t create the file.', retry: true } });
  });
});

/*
 * Phase 19 D-22 and UI-D5: a report is a fixed-table view. Its action is bound to the report key on the page, takes the
 * report's own query (the throughput period alone), a closed format and, for CSV only, one of the report's tables from
 * the export vocabulary; it never takes columns.
 */
describe('exportReportAction', () => {
  it('exports one CSV table of the report with the viewer’s zone, and returns the server’s file', async () => {
    mocks.readViewerTimeZone.mockResolvedValueOnce('Australia/Sydney');

    const result = await exportReportAction('risk-exposure', { query: {}, format: 'csv', table: 'residual-by-treatment-status' });

    expect(result).toEqual({ ok: true, fileName: 'risk-exposure-report-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 4 });
    expect(mocks.exportReport).toHaveBeenCalledWith('risk-exposure', { format: 'csv', table: 'residual-by-treatment-status', query: {}, timeZone: 'Australia/Sydney' });
  });

  it('exports the throughput workbook with its period and no table', async () => {
    await exportReportAction('assessment-throughput', { query: { period: '12' }, format: 'xlsx' });

    expect(mocks.exportReport).toHaveBeenCalledWith('assessment-throughput', { format: 'xlsx', query: { period: '12' } });
  });

  it.each([
    ['an unknown report key', 'not-a-report', { query: {}, format: 'xlsx' }],
    ['no report key', undefined, { query: {}, format: 'xlsx' }],
    ['a columns field', 'risk-exposure', { query: {}, format: 'xlsx', columns: ['ratings'] }],
    ['a CSV request without a table', 'risk-exposure', { query: {}, format: 'csv' }],
    ['a table of another report', 'risk-exposure', { query: {}, format: 'csv', table: 'due-state' }],
    ['a table with the workbook', 'risk-exposure', { query: {}, format: 'xlsx', table: 'ratings' }],
    ['a period for a report without one', 'risk-exposure', { query: { period: '12' }, format: 'xlsx' }],
    ['an unknown period', 'assessment-throughput', { query: { period: '3' }, format: 'xlsx' }],
    ['an unknown query key', 'assessment-throughput', { query: { from: '2026-01-01' }, format: 'xlsx' }],
    ['format pdf', 'risk-exposure', { query: {}, format: 'pdf' }],
    ['no input', 'risk-exposure', undefined],
  ])('refuses %s with the 400 copy without calling the service', async (_case, reportKey, input) => {
    await expect(exportReportAction(reportKey, input)).resolves.toEqual({ ok: false, refusal: invalidCopy });
    expect(mocks.exportReport).not.toHaveBeenCalled();
  });

  it('words a 403 with family S1', async () => {
    mocks.exportReport.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 403 } });

    await expect(exportReportAction('risk-exposure', { query: {}, format: 'xlsx' })).resolves.toEqual({
      ok: false,
      refusal: { tone: 'danger', message: 'You don’t have access to export this report.', retry: false },
    });
  });

  it('reads a 404 as the failed file, with Try again (R1 part 3)', async () => {
    mocks.exportReport.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 404 } });

    await expect(exportReportAction('risk-exposure', { query: {}, format: 'xlsx' })).resolves.toEqual({
      ok: false,
      refusal: { tone: 'danger', message: 'We couldn’t create the file.', retry: true },
    });
  });
});

/*
 * The eight other views (19-11, D-04, D-19; T-19-36): each action parses its list's own query without a page, a closed
 * format and that view's export columns (the released assessment: one of its tables for CSV, never columns), then calls
 * its service with the viewer's zone.
 */
type ListActionCase = {
  name: string;
  action: (input: unknown) => Promise<unknown>;
  service: ReturnType<typeof vi.fn>;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  column: string;
};

const listActions: ListActionCase[] = [
  {
    name: 'exportReviewRequestsAction (Requests and Assigned to me, with the assignee filter)',
    action: actions.exportReviewRequestsAction,
    service: mocks.exportReviewRequests,
    input: { query: { q: 'portal', queue: 'open', status: 'submitted', assignee: 'me', sort: 'dueDate:asc' }, format: 'xlsx', columns: ['requestNumber', 'assignee'] },
    expected: { query: { q: 'portal', queue: 'open', status: 'submitted', assignee: 'me', sort: 'dueDate:asc' }, format: 'xlsx', columns: ['requestNumber', 'assignee'] },
    column: 'requestNumber',
  },
  {
    name: 'exportMyRequestsAction (with the holder filter)',
    action: actions.exportMyRequestsAction,
    service: mocks.exportMyRequests,
    input: { query: { q: 'portal', holder: 'analyst', sort: 'updatedAt:desc' }, format: 'csv', columns: ['requestNumber', 'nextStep'] },
    expected: { query: expect.objectContaining({ q: 'portal', holder: 'analyst', sort: 'updatedAt:desc' }), format: 'csv', columns: ['requestNumber', 'nextStep'] },
    column: 'nextStep',
  },
  {
    name: 'exportQuestionnairesAction',
    action: actions.exportQuestionnairesAction,
    service: mocks.exportQuestionnaires,
    input: { query: { q: 'portal', status: 'submitted', sort: 'title:asc' }, format: 'xlsx' },
    expected: { query: { q: 'portal', status: 'submitted', sort: 'title:asc' }, format: 'xlsx' },
    column: 'questionnaireNumber',
  },
  {
    name: 'exportMyQuestionnairesAction',
    action: actions.exportMyQuestionnairesAction,
    service: mocks.exportMyQuestionnaires,
    input: { query: { sort: 'updatedAt:desc' }, format: 'xlsx', columns: ['progress'] },
    expected: { query: { sort: 'updatedAt:desc' }, format: 'xlsx', columns: ['progress'] },
    column: 'progress',
  },
  {
    name: 'exportRiskAssessmentsAction',
    action: actions.exportRiskAssessmentsAction,
    service: mocks.exportRiskAssessments,
    input: { query: { q: '', status: 'approved', overallRating: 'High', sort: 'generatedDate:desc' }, format: 'xlsx', columns: ['assessmentNumber', 'riskCount'] },
    expected: { query: expect.objectContaining({ q: '', status: 'approved', overallRating: 'High', sort: 'generatedDate:desc' }), format: 'xlsx', columns: ['assessmentNumber', 'riskCount'] },
    column: 'riskCount',
  },
  {
    name: 'exportMyRiskAssessmentsAction',
    action: actions.exportMyRiskAssessmentsAction,
    service: mocks.exportMyRiskAssessments,
    input: { query: { q: '', sort: 'generatedDate:desc', approvedFrom: '2026-01-01' }, format: 'csv' },
    expected: { query: expect.objectContaining({ q: '', sort: 'generatedDate:desc', approvedFrom: '2026-01-01' }), format: 'csv' },
    column: 'overallRating',
  },
  {
    name: 'exportAlertsAction',
    action: actions.exportAlertsAction,
    service: mocks.exportAlerts,
    input: { query: { kinds: ['risk-treatment-overdue'], urgency: 'overdue' }, format: 'xlsx', columns: ['urgency', 'record'] },
    expected: { query: { kinds: ['risk-treatment-overdue'], urgency: 'overdue' }, format: 'xlsx', columns: ['urgency', 'record'] },
    column: 'urgency',
  },
];

describe('the list export actions', () => {
  it.each(listActions)('$name parses its view and calls its service with the viewer’s zone', async ({ action, expected, input, service }) => {
    mocks.readViewerTimeZone.mockResolvedValueOnce('Australia/Sydney');

    await expect(action(input)).resolves.toEqual({ ok: true, fileName: 'list-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 2 });
    expect(service).toHaveBeenCalledTimes(1);
    expect(service).toHaveBeenCalledWith({ ...expected, timeZone: 'Australia/Sydney' });
    expect(service.mock.calls[0]?.[0].query).not.toHaveProperty('page');
    expect(service.mock.calls[0]?.[0].query).not.toHaveProperty('pageSize');
  });

  it.each(listActions)('$name refuses a page, a page size, an unknown column, a repeated column and an unknown format with the 400 copy', async ({ action, column, input, service }) => {
    const query = input.query as Record<string, unknown>;
    for (const refused of [
      { ...input, query: { ...query, page: 2 } },
      { ...input, query: { ...query, pageSize: 50 } },
      { ...input, columns: [column, 'secretField'] },
      { ...input, columns: [column, column] },
      { ...input, columns: [] },
      { ...input, format: 'pdf' },
      { ...input, table: 'risks' },
      undefined,
    ]) {
      await expect(action(refused), JSON.stringify(refused)).resolves.toEqual({ ok: false, refusal: invalidCopy });
    }
    expect(service).not.toHaveBeenCalled();
  });

  it('words a 403 from any list export with family S1', async () => {
    mocks.exportAlerts.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 403 } });

    await expect(actions.exportAlertsAction({ query: {}, format: 'xlsx' })).resolves.toEqual({
      ok: false,
      refusal: { tone: 'danger', message: 'You don’t have access to export this list.', retry: false },
    });
  });
});

/* The released assessment (D-21, UI-D5): bound to the assessment's id; no query, no columns; a table for CSV only. */
describe('exportReleasedAssessmentAction', () => {
  it('exports one CSV table of the released assessment with the viewer’s zone', async () => {
    mocks.readViewerTimeZone.mockResolvedValueOnce('Australia/Sydney');

    await actions.exportReleasedAssessmentAction('assessment-1', { query: {}, format: 'csv', table: 'mitigation-controls' });

    expect(mocks.exportReleasedAssessment).toHaveBeenCalledWith('assessment-1', { format: 'csv', table: 'mitigation-controls', timeZone: 'Australia/Sydney' });
  });

  it('exports the workbook without a table', async () => {
    await actions.exportReleasedAssessmentAction('assessment-1', { query: {}, format: 'xlsx' });

    expect(mocks.exportReleasedAssessment).toHaveBeenCalledWith('assessment-1', { format: 'xlsx' });
  });

  /* Review amendment R1 part 3 (FE4-09): the released assessment's 403 and 404 name the risk assessment. */
  it.each([
    [403, 'You don’t have access to export this risk assessment.'],
    [404, 'We couldn’t find this risk assessment. It may no longer be available to you.'],
  ])('words a %s for the risk assessment', async (status, message) => {
    mocks.exportReleasedAssessment.mockResolvedValueOnce({ data: null, error: { message: 'x', status } });

    await expect(actions.exportReleasedAssessmentAction('assessment-1', { query: {}, format: 'xlsx' })).resolves.toEqual({
      ok: false,
      refusal: { tone: 'danger', message, retry: false },
    });
  });

  it.each([
    ['an empty id', '', { query: {}, format: 'xlsx' }],
    ['no id', undefined, { query: {}, format: 'xlsx' }],
    ['an over-long id', 'a'.repeat(256), { query: {}, format: 'xlsx' }],
    ['a columns field', 'assessment-1', { query: {}, format: 'xlsx', columns: ['riskNumber'] }],
    ['a query value', 'assessment-1', { query: { q: 'x' }, format: 'xlsx' }],
    ['a CSV request without a table', 'assessment-1', { query: {}, format: 'csv' }],
    ['the summary table as CSV', 'assessment-1', { query: {}, format: 'csv', table: 'summary' }],
    ['a table with the workbook', 'assessment-1', { query: {}, format: 'xlsx', table: 'risks' }],
    ['format pdf', 'assessment-1', { query: {}, format: 'pdf' }],
  ])('refuses %s with the 400 copy without calling the service', async (_case, assessmentId, input) => {
    await expect(actions.exportReleasedAssessmentAction(assessmentId, input)).resolves.toEqual({ ok: false, refusal: invalidCopy });
    expect(mocks.exportReleasedAssessment).not.toHaveBeenCalled();
  });
});

describe('the export actions module', () => {
  it('words every refusal with family S1 from the feature-only module, never the shared refusal copy', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/features/exports/export-actions.ts'), 'utf8');
    expect(source).toContain("from '@/features/exports/export-refusal-copy'");
    expect(source).not.toContain('lib/api/refusal-copy');
    expect(Object.keys(actions).sort()).toEqual([
      'exportAlertsAction',
      'exportMyQuestionnairesAction',
      'exportMyRequestsAction',
      'exportMyRiskAssessmentsAction',
      'exportQuestionnairesAction',
      'exportReferenceListAction',
      'exportReleasedAssessmentAction',
      'exportReportAction',
      'exportReviewRequestsAction',
      'exportRiskAssessmentsAction',
      'exportRiskRegisterAction',
    ]);
  });
});

/*
 * 19-15 (D-04, D-33): a reference list's export is bound on the admin page to its collection, reads its query with the
 * admin list's own parser, takes that collection's export columns and refuses a page, a key the list does not read or a
 * collection that is not one.
 */
describe('exportReferenceListAction', () => {
  it('exports the parsed list query with every chosen column of the collection', async () => {
    mocks.readViewerTimeZone.mockResolvedValueOnce('Australia/Sydney');
    const result = await actions.exportReferenceListAction('information-systems', {
      query: { q: 'Portal', environment: 'Production', sort: 'name:asc' },
      format: 'xlsx',
      columns: ['name', 'description', 'owner'],
    });
    expect(result).toEqual({ ok: true, fileName: 'list-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 2 });
    expect(mocks.exportReferenceList).toHaveBeenCalledWith('information-systems', {
      query: expect.objectContaining({ q: 'Portal', environment: 'Production', sort: 'name:asc' }),
      format: 'xlsx',
      columns: ['name', 'description', 'owner'],
      timeZone: 'Australia/Sydney',
    });
    expect(mocks.exportReferenceList.mock.calls[0]?.[1]?.query).not.toHaveProperty('page');
  });

  it.each([
    ['an unknown collection', 'risks', { query: {}, format: 'csv' }],
    ['a page', 'controls', { query: { page: '2' }, format: 'csv' }],
    ['a key the list does not read', 'risk-types', { query: { framework: 'NIST' }, format: 'csv' }],
    ['a filter of another collection', 'information-assets', { query: { environment: 'Production' }, format: 'csv' }],
    ['a column of another collection', 'risk-types', { query: {}, format: 'csv', columns: ['controlNumber'] }],
    ['an unknown format', 'risk-types', { query: {}, format: 'xls' }],
  ] as const)('refuses %s before any call', async (_case, kind, input) => {
    await expect(actions.exportReferenceListAction(kind, input)).resolves.toEqual({ ok: false, refusal: invalidCopy });
    expect(mocks.exportReferenceList).not.toHaveBeenCalled();
  });
});
