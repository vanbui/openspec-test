import { afterEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  normalizeTransportError: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: transport.get, POST: transport.post })),
  normalizeTransportError: transport.normalizeTransportError,
  normalizeResponseParserError: vi.fn(),
}));

import * as alertService from '@/features/alerts/alert-service';
import * as assessmentService from '@/features/assessments/assessment-service';
import * as questionnaireService from '@/features/questionnaires/questionnaire-service';
import * as reportService from '@/features/reports/report-service';
import * as requestService from '@/features/requests/request-service';
import * as riskService from '@/features/risks/risk-service';

/*
 * Phase 19 D-19: every export service reads its file with a binary parse through the generated client, checks it with
 * the shared validator's export rule (type, the server's name, size, signature) and the row-count header, and returns
 * the server's file; a refusal is the transport error, with its reason. Each is registered with the parity guard as a
 * file response of the two export media types.
 */

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV = 'text/csv; charset=utf-8';
const PK = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const BOM_CSV = Uint8Array.from([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62, 0x0a]);

function fileResponse(fileName: string, contentType: string, bytes: Uint8Array, rowCount = '3') {
  return {
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    response: {
      status: 200,
      headers: new Headers({
        'content-type': contentType,
        'content-disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
        'x-csrm-row-count': rowCount,
      }),
    },
  };
}

afterEach(() => {
  transport.get.mockReset();
  transport.post.mockReset();
  transport.normalizeTransportError.mockReset();
});

describe('exportReport (D-22, UI-D5)', () => {
  it('posts the closed body for one CSV table and returns the checked bytes, name and row count', async () => {
    transport.post.mockResolvedValueOnce(fileResponse('risk-exposure-residual-rating-by-treatment-status-2026-10-01.csv', CSV, BOM_CSV, '5'));

    const result = await reportService.exportReport('risk-exposure', { format: 'csv', table: 'residual-by-treatment-status', query: {}, timeZone: 'Australia/Sydney' });

    expect(transport.post).toHaveBeenCalledWith('/v1/reports/{reportKey}/export', {
      params: { path: { reportKey: 'risk-exposure' } },
      body: { format: 'csv', table: 'residual-by-treatment-status', timeZone: 'Australia/Sydney', query: {} },
      parseAs: 'arrayBuffer',
    });
    expect(result).toEqual({
      data: { fileName: 'risk-exposure-residual-rating-by-treatment-status-2026-10-01.csv', contentType: 'text/csv', bytes: BOM_CSV, rowCount: 5 },
      error: null,
    });
  });

  it('sends the throughput period as the report’s own query, and no table or zone when none is given', async () => {
    transport.post.mockResolvedValueOnce(fileResponse('assessment-throughput-report-2026-10-01.xlsx', XLSX, PK));

    await reportService.exportReport('assessment-throughput', { format: 'xlsx', query: { period: '12' } });

    expect(transport.post.mock.calls[0]?.[1]).toEqual({
      params: { path: { reportKey: 'assessment-throughput' } },
      body: { format: 'xlsx', query: { period: '12' } },
      parseAs: 'arrayBuffer',
    });
  });

  it('returns a 403 as the transport error', async () => {
    const refusal = { data: null, error: { message: 'Forbidden', status: 403 } };
    const body = { error: { status: 403, name: 'PolicyError', message: 'Policy Failed' } };
    transport.post.mockResolvedValueOnce({ error: body, response: { status: 403, headers: new Headers() } });
    transport.normalizeTransportError.mockReturnValueOnce(refusal);

    await expect(reportService.exportReport('risk-exposure', { format: 'xlsx', query: {} })).resolves.toEqual(refusal);
    expect(transport.normalizeTransportError).toHaveBeenCalledWith(body, 403);
  });

  it('refuses bytes the export rule rejects and a missing row count, and never returns them', async () => {
    transport.post.mockResolvedValueOnce(fileResponse('risk-exposure-report-2026-10-01.xlsx', 'text/html', PK));
    await expect(reportService.exportReport('risk-exposure', { format: 'xlsx', query: {} })).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'type' } });
    transport.post.mockResolvedValueOnce(fileResponse('risk-exposure-report-2026-10-01.xlsx', XLSX, PK, 'many'));
    await expect(reportService.exportReport('risk-exposure', { format: 'xlsx', query: {} })).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'row-count' } });
  });

  it('registers the export with the parity guard as a file response of the two export media types', () => {
    expect(reportService.responseParserModule.fileResponses).toEqual([
      { label: 'reports.exportReport', path: '/v1/reports/{reportKey}/export', method: 'post', contentTypes: [CSV, XLSX] },
    ]);
  });
});

/*
 * The eight list and record exports (19-11, D-04): each sends its list's own parameters without a page, the format,
 * the columns and the zone, through its generated path with a binary parse.
 */
type ListExportCase = {
  name: string;
  run: () => Promise<unknown>;
  path: string;
  query: Record<string, unknown>;
  pathParams?: Record<string, string>;
};

const listExports: ListExportCase[] = [
  {
    name: 'exportReviewRequests',
    run: () => assessmentService.exportReviewRequests({
      query: { q: 'portal', queue: 'open', status: 'submitted', assignee: 'me', notes: 'unread', sort: 'dueDate:asc' },
      format: 'xlsx',
      columns: ['requestNumber', 'title'],
      timeZone: 'Australia/Sydney',
    }),
    path: '/v1/assessment_requests/export',
    query: {
      'filters[q]': 'portal', 'filters[queue]': 'open', 'filters[requestStatus]': 'submitted', 'filters[assignee]': 'me', 'filters[notes]': 'unread',
      sort: 'dueDate:asc', format: 'xlsx', columns: 'requestNumber,title', timeZone: 'Australia/Sydney',
    },
  },
  {
    name: 'exportRiskAssessments',
    run: () => assessmentService.exportRiskAssessments({
      query: { q: 'portal', status: 'approved', overallRating: 'High', approvedFrom: '2026-01-01', approvedTo: '2026-06-30', sort: 'generatedDate:desc' },
      format: 'xlsx',
      columns: ['assessmentNumber'],
    }),
    path: '/v1/risk_assessments/export',
    query: { q: 'portal', status: 'approved', overallRating: 'High', approvedFrom: '2026-01-01', approvedTo: '2026-06-30', sort: 'generatedDate:desc', format: 'xlsx', columns: 'assessmentNumber' },
  },
  {
    name: 'exportMyRiskAssessments',
    run: () => assessmentService.exportMyRiskAssessments({ query: { q: '', sort: 'generatedDate:desc' }, format: 'xlsx' }),
    path: '/v1/my_risk_assessments/export',
    query: { sort: 'generatedDate:desc', format: 'xlsx' },
  },
  {
    name: 'exportMyRequests',
    run: () => requestService.exportMyRequests({ query: { q: 'portal', status: 'submitted', holder: 'analyst', sort: 'updatedAt:desc' }, format: 'xlsx', timeZone: 'UTC' }),
    path: '/v1/my_requests/export',
    query: { q: 'portal', status: 'submitted', holder: 'analyst', sort: 'updatedAt:desc', format: 'xlsx', timeZone: 'UTC' },
  },
  {
    name: 'exportQuestionnaires',
    run: () => questionnaireService.exportQuestionnaires({ query: { q: 'portal', status: 'submitted', sort: 'updatedAt:desc' }, format: 'xlsx' }),
    path: '/v1/questionnaires/export',
    query: { q: 'portal', status: 'submitted', sort: 'updatedAt:desc', format: 'xlsx' },
  },
  {
    name: 'exportMyQuestionnaires',
    run: () => questionnaireService.exportMyQuestionnaires({ query: { sort: 'title:asc' }, format: 'xlsx', columns: ['questionnaireNumber'] }),
    path: '/v1/my_questionnaires/export',
    query: { sort: 'title:asc', format: 'xlsx', columns: 'questionnaireNumber' },
  },
  {
    name: 'exportAlerts',
    run: () => alertService.exportAlerts({ query: { kinds: ['risk-treatment-overdue'], urgency: 'overdue' }, format: 'xlsx' }),
    path: '/v1/alerts/export',
    query: { kind: ['risk-treatment-overdue'], urgency: 'overdue', format: 'xlsx' },
  },
  {
    name: 'exportReleasedAssessment',
    run: () => assessmentService.exportReleasedAssessment('assessment-1', { format: 'xlsx', timeZone: 'Australia/Sydney' }),
    path: '/v1/risk_assessments/{assessmentId}/export',
    pathParams: { assessmentId: 'assessment-1' },
    query: { format: 'xlsx', timeZone: 'Australia/Sydney' },
  },
];

describe('the list and record export services (D-04, D-19)', () => {
  it.each(listExports)('$name sends its parameters with a binary parse and returns the checked file', async ({ path, pathParams, query, run }) => {
    transport.get.mockResolvedValueOnce(fileResponse('list-2026-10-01.xlsx', XLSX, PK, '7'));

    const result = await run();

    expect(transport.get).toHaveBeenCalledWith(path, { params: { ...(pathParams ? { path: pathParams } : {}), query }, parseAs: 'arrayBuffer' });
    expect(result).toEqual({ data: { fileName: 'list-2026-10-01.xlsx', contentType: XLSX, bytes: PK, rowCount: 7 }, error: null });
  });

  it.each(listExports)('$name returns a 403 as the transport error', async ({ run }) => {
    const refusal = { data: null, error: { message: 'Forbidden', status: 403 } };
    const body = { error: { status: 403, name: 'PolicyError', message: 'Policy Failed' } };
    transport.get.mockResolvedValueOnce({ error: body, response: { status: 403, headers: new Headers() } });
    transport.normalizeTransportError.mockReturnValueOnce(refusal);

    await expect(run()).resolves.toEqual(refusal);
    expect(transport.normalizeTransportError).toHaveBeenCalledWith(body, 403);
  });

  it.each(listExports)('$name refuses bytes the export rule rejects', async ({ run }) => {
    transport.get.mockResolvedValueOnce(fileResponse('list-2026-10-01.xlsx', XLSX, new TextEncoder().encode('<html>')));

    await expect(run()).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'signature' } });
  });

  it('sends the released assessment’s table only for CSV', async () => {
    transport.get.mockResolvedValueOnce(fileResponse('asm-2026-0001-risks-2026-10-01.csv', CSV, BOM_CSV));
    await assessmentService.exportReleasedAssessment('assessment-1', { format: 'csv', table: 'risks' });
    expect(transport.get.mock.calls[0]?.[1]).toEqual({ params: { path: { assessmentId: 'assessment-1' }, query: { format: 'csv', table: 'risks' } }, parseAs: 'arrayBuffer' });

    transport.get.mockResolvedValueOnce(fileResponse('asm-2026-0001-risk-assessment-2026-10-01.xlsx', XLSX, PK));
    await assessmentService.exportReleasedAssessment('assessment-1', { format: 'xlsx', table: 'risks' });
    expect(transport.get.mock.calls[1]?.[1]).toEqual({ params: { path: { assessmentId: 'assessment-1' }, query: { format: 'xlsx' } }, parseAs: 'arrayBuffer' });
  });

  it('registers every export with the parity guard as a file response of the two export media types', () => {
    type Registered = { label: string; path: string; method: string; contentTypes: readonly string[] };
    const registered = [alertService, assessmentService, questionnaireService, reportService, requestService, riskService]
      .flatMap((service) => (service.responseParserModule as { fileResponses?: readonly Registered[] }).fileResponses ?? []);
    expect(registered.map(({ method, path }) => `${method.toUpperCase()} ${path}`).sort()).toEqual([
      'GET /v1/alerts/export',
      'GET /v1/assessment_requests/export',
      'GET /v1/my_questionnaires/export',
      'GET /v1/my_requests/export',
      'GET /v1/my_risk_assessments/export',
      'GET /v1/questionnaires/export',
      'GET /v1/risk_assessments/export',
      'GET /v1/risk_assessments/{assessmentId}/export',
      'GET /v1/risks/export',
      'POST /v1/reports/{reportKey}/export',
    ]);
    for (const entry of registered) expect(entry.contentTypes, entry.label).toEqual([CSV, XLSX]);
  });
});
