import createClient from 'openapi-fetch';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { paths } from '../../lib/api/generated/schema';

const get = vi.hoisted(() => vi.fn());
const createStrapiClient = vi.hoisted(() => vi.fn());
const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient,
  normalizeTransportError: (_error: unknown, status?: number) => ({
    data: null,
    error: { message: 'The CSRM service is unavailable. Please try again later.', ...(status ? { status } : {}) },
  }),
  normalizeResponseParserError: (operation: string) => ({
    data: null,
    error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation },
  }),
}));

import * as service from './report-service';

afterEach(() => {
  get.mockReset();
  createStrapiClient.mockReset();
});

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ GET: get });
}

const response = (data: unknown, status = 200) => ({ data, response: { status } });

const definitions = [
  { key: 'risk-exposure', title: 'Risk exposure', description: 'Open contextual Risks by rating and treatment status, and the Information Systems carrying the most High and Critical residual Risks.' },
  { key: 'treatment-performance', title: 'Treatment performance', description: 'Risk treatments by due state and treatment status, and the most overdue treatments.' },
  { key: 'assessment-throughput', title: 'Assessment throughput', description: 'Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.' },
  { key: 'control-effectiveness', title: 'Control effectiveness', description: 'Control Implementations on open contextual Risks by implementation status and effectiveness rating.' },
];
const controlEffectiveness = {
  key: 'control-effectiveness',
  today: '2026-09-24',
  implementationStatus: { existing: 1, planned: 1, implemented: 2, retired: 0, notProvided: 1, total: 5 },
  effectivenessRating: { effective: 1, partiallyEffective: 1, ineffective: 1, notAssessed: 1, notProvided: 1, total: 5 },
};
const riskExposure = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
  byInherentRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
  residualByTreatmentStatus: Object.fromEntries(['Critical', 'High', 'Moderate', 'Low', 'notRated'].map((rating) => [
    rating,
    { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
  ])),
  exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
};
const assessmentThroughput = (period: 6 | 12) => ({
  key: 'assessment-throughput',
  today: '2026-09-24',
  period,
  periodStart: period === 6 ? '2026-04-01' : '2025-10-01',
  released: { months: [{ monthStart: '2026-09-01', count: 0, partial: true }], total: 0 },
  medianDaysToRelease: { value: null, sampleSize: 0, truncated: false },
  requestsByStatus: { submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, closed: 0, total: 0 },
});

describe('report service', () => {
  it('lists the report definitions through the generated path with no parameters', async () => {
    useMockClient();
    get.mockResolvedValueOnce(response({ data: definitions }));
    await expect(service.listReportDefinitions()).resolves.toEqual({ data: definitions, error: null });
    expect(get).toHaveBeenCalledWith('/v1/reports');
  });

  it('reads the throughput report with its period, and every other report with no query', async () => {
    useMockClient();
    get.mockResolvedValueOnce(response({ data: assessmentThroughput(12) }));
    await expect(service.getReport('assessment-throughput', { period: 12 })).resolves.toEqual({ data: assessmentThroughput(12), error: null });
    expect(get).toHaveBeenLastCalledWith('/v1/reports/{reportKey}', {
      params: { path: { reportKey: 'assessment-throughput' }, query: { period: 12 } },
    });

    get.mockResolvedValueOnce(response({ data: riskExposure }));
    await expect(service.getReport('risk-exposure')).resolves.toEqual({ data: riskExposure, error: null });
    expect(get).toHaveBeenLastCalledWith('/v1/reports/{reportKey}', { params: { path: { reportKey: 'risk-exposure' } } });

    // Without a period the server's default of six months applies.
    get.mockResolvedValueOnce(response({ data: assessmentThroughput(6) }));
    await service.getReport('assessment-throughput');
    expect(get).toHaveBeenLastCalledWith('/v1/reports/{reportKey}', { params: { path: { reportKey: 'assessment-throughput' } } });
  });

  it('serialises the period only for the throughput report', async () => {
    const urls: string[] = [];
    createStrapiClient.mockResolvedValue(createClient<paths>({
      baseUrl: 'http://127.0.0.1:43111/api',
      fetch: async (request) => {
        urls.push(request.url);
        const key = new URL(request.url).pathname.split('/').at(-1);
        return Response.json({ data: key === 'assessment-throughput' ? assessmentThroughput(12) : controlEffectiveness });
      },
    }));
    await expect(service.getReport('assessment-throughput', { period: 12 })).resolves.toEqual({ data: assessmentThroughput(12), error: null });
    await expect(service.getReport('control-effectiveness')).resolves.toEqual({ data: controlEffectiveness, error: null });

    const throughput = new URL(urls[0] ?? '');
    expect(throughput.pathname).toBe('/api/v1/reports/assessment-throughput');
    expect([...throughput.searchParams.entries()]).toEqual([['period', '12']]);
    const control = new URL(urls[1] ?? '');
    expect(control.pathname).toBe('/api/v1/reports/control-effectiveness');
    expect(control.search).toBe('');
  });

  it('refuses a key or a period the contract does not accept before any read', async () => {
    useMockClient();
    const refused: Array<[unknown, unknown]> = [
      ['risk-exposure', { period: 6 }],
      ['control-effectiveness', { period: 12 }],
      ['assessment-throughput', { period: 3 }],
      ['assessment-throughput', { period: '12' }],
      ['assessment-throughput', { months: 6 }],
      ['unknown', {}],
    ];
    for (const [key, options] of refused) {
      await expect(service.getReport(key as never, options as never), JSON.stringify([key, options])).rejects.toThrow();
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps a 404 and a 403 as their statuses, and turns a malformed body into an error result', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status: 404 } });
    await expect(service.getReport('risk-exposure')).resolves.toEqual({
      data: null,
      error: { message: 'The CSRM service is unavailable. Please try again later.', status: 404 },
    });

    get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status: 403 } });
    await expect(service.listReportDefinitions()).resolves.toEqual({
      data: null,
      error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 },
    });

    // A report served for another key is a contract mismatch, never another report.
    get.mockResolvedValueOnce(response({ data: controlEffectiveness }));
    await expect(service.getReport('risk-exposure')).resolves.toEqual({
      data: null,
      error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation: 'reports.getReport.riskExposure' },
    });

    get.mockResolvedValueOnce(response({ data: [...definitions, { key: 'forged', title: 'Forged', description: 'Forged.' }] }));
    await expect(service.listReportDefinitions()).resolves.toEqual({
      data: null,
      error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation: 'reports.listReportDefinitions' },
    });

    get.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.getReport('control-effectiveness')).resolves.toEqual(unavailable);
  });

  it('registers one closed parser per report branch with the contract parity guard, narrowing only the alert rows\' source title', () => {
    expect(service.responseParserModule.modulePath).toBe('features/reports/report-service.ts');
    expect(service.responseParserModule.mode).toBe('parsers');
    expect(service.responseParserModule.parsers.map((parser) => [
      parser.label,
      'component' in parser ? parser.component : null,
      'path' in parser ? parser.path : null,
      'branch' in parser ? parser.branch : null,
    ])).toEqual([
      ['reports.listReportDefinitions', 'ReportDefinitionListResponse', null, null],
      ['reports.getReport.riskExposure', null, '/v1/reports/{reportKey}', 'RiskExposureReport'],
      ['reports.getReport.treatmentPerformance', null, '/v1/reports/{reportKey}', 'TreatmentPerformanceReport'],
      ['reports.getReport.assessmentThroughput', null, '/v1/reports/{reportKey}', 'AssessmentThroughputReport'],
      ['reports.getReport.controlEffectiveness', null, '/v1/reports/{reportKey}', 'ControlEffectivenessReport'],
    ]);
    // The exposed-system bounds are the contract's own (minLength/maxLength on
    // ExposedSystem); the treatment report reuses the alert rows, whose
    // free-text source title carries the client's 65,535-character cap (D-05).
    expect(service.responseParserModule.parsers.map((parser) => [
      parser.label,
      'narrowedPaths' in parser ? [...parser.narrowedPaths] : null,
    ])).toEqual([
      ['reports.listReportDefinitions', null],
      ['reports.getReport.riskExposure', null],
      ['reports.getReport.treatmentPerformance', ['data.mostOverdue.rows.0.source.title']],
      ['reports.getReport.assessmentThroughput', null],
      ['reports.getReport.controlEffectiveness', null],
    ]);
    for (const parser of service.responseParserModule.parsers) {
      expect(parser.label.startsWith('reports.'), parser.label).toBe(true);
      if ('path' in parser) expect(parser.method, parser.label).toBe('get');
    }
  });
});
