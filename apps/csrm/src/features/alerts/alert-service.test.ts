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

import * as service from './alert-service';

afterEach(() => {
  get.mockReset();
  createStrapiClient.mockReset();
});

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ GET: get });
}

const response = (data: unknown, status = 200) => ({ data, response: { status } });

const alert = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-B2QDZ6', title: 'A risk.', released: false },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'High',
};
const listPayload = {
  data: [alert],
  meta: { pagination: { page: 1, pageSize: 5, pageCount: 1, total: 1 }, today: '2026-09-24', dueSoonWindowDays: 14 },
};
const summary = {
  byKind: {
    'risk-treatment-overdue': 1,
    'risk-treatment-due-soon': 0,
    'request-overdue': 0,
    'request-due-soon': 0,
    'control-implementation-overdue': 0,
    'assessment-review-due': 0,
    'critical-residual-risk-untreated': 0,
    'ineffective-control': 0,
  },
  byUrgency: { overdue: 1, 'due-soon': 0, attention: 0 },
  total: 1,
  today: '2026-09-24',
  dueSoonWindowDays: 14,
};

describe('alert service', () => {
  it('lists alerts through the generated path with a repeated kind parameter', async () => {
    useMockClient();
    get.mockResolvedValueOnce(response(listPayload));
    await expect(service.listAlerts({
      kinds: ['risk-treatment-overdue', 'risk-treatment-due-soon'],
      page: 1,
      pageSize: 5,
    })).resolves.toEqual({ data: listPayload, error: null });
    expect(get).toHaveBeenCalledWith('/v1/alerts', {
      params: { query: { kind: ['risk-treatment-overdue', 'risk-treatment-due-soon'], page: 1, pageSize: 5 } },
    });

    get.mockResolvedValueOnce(response({ ...listPayload, data: [] }));
    await service.listAlerts({ urgency: 'due-soon', page: 3, pageSize: 25 });
    expect(get).toHaveBeenLastCalledWith('/v1/alerts', { params: { query: { urgency: 'due-soon', page: 3, pageSize: 25 } } });

    // A caller may hold its kinds as a constant tuple.
    const treatmentKinds = ['risk-treatment-overdue', 'risk-treatment-due-soon'] as const;
    get.mockResolvedValueOnce(response(listPayload));
    await service.listAlerts({ kinds: treatmentKinds, page: 1, pageSize: 5 });
    expect(get).toHaveBeenLastCalledWith('/v1/alerts', {
      params: { query: { kind: ['risk-treatment-overdue', 'risk-treatment-due-soon'], page: 1, pageSize: 5 } },
    });
  });

  it('serialises the kinds as one kind parameter each, in the order given', async () => {
    const urls: string[] = [];
    createStrapiClient.mockResolvedValue(createClient<paths>({
      baseUrl: 'http://127.0.0.1:43111/api',
      fetch: async (request) => {
        urls.push(request.url);
        return Response.json(listPayload);
      },
    }));
    await expect(service.listAlerts({ kinds: ['risk-treatment-overdue', 'risk-treatment-due-soon'], page: 1, pageSize: 5 }))
      .resolves.toEqual({ data: listPayload, error: null });
    const url = new URL(urls[0] ?? '');
    expect(url.pathname).toBe('/api/v1/alerts');
    expect(url.searchParams.getAll('kind')).toEqual(['risk-treatment-overdue', 'risk-treatment-due-soon']);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('5');
    expect([...url.searchParams.keys()].sort()).toEqual(['kind', 'kind', 'page', 'pageSize']);
  });

  it('refuses a query the contract does not accept before any read', async () => {
    useMockClient();
    const refused: unknown[] = [
      { kinds: ['request-overdue', 'request-overdue'], page: 1, pageSize: 25 },
      { kinds: ['not-a-kind'], page: 1, pageSize: 25 },
      { kinds: [], page: 1, pageSize: 25 },
      { urgency: 'soon', page: 1, pageSize: 25 },
      { page: 0, pageSize: 25 },
      { page: 1, pageSize: 7 },
    ];
    for (const query of refused) {
      await expect(service.listAlerts(query as never), JSON.stringify(query)).rejects.toThrow();
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps a 403 as a 403 and turns a malformed body into an error result', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status: 403 } });
    const denied = await service.listAlerts({ page: 1, pageSize: 25 });
    expect(denied).toEqual({ data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 } });

    get.mockResolvedValueOnce(response({ ...listPayload, data: [{ ...alert, kind: 'forged' }] }));
    const malformed = await service.listAlerts({ page: 1, pageSize: 25 });
    expect(malformed.data).toBeNull();
    expect(malformed.error).toEqual({
      message: 'The response did not match the expected CSRM contract.',
      kind: 'response-contract-mismatch',
      operation: 'alerts.listAlerts',
    });

    get.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.listAlerts({ page: 1, pageSize: 25 })).resolves.toEqual(unavailable);
  });

  it('reads the summary with no parameters and parses it closed', async () => {
    useMockClient();
    get.mockResolvedValueOnce(response({ data: summary }));
    await expect(service.getAlertSummary()).resolves.toEqual({ data: summary, error: null });
    expect(get).toHaveBeenCalledWith('/v1/alerts/summary');

    get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status: 403 } });
    await expect(service.getAlertSummary()).resolves.toEqual({
      data: null,
      error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 },
    });

    get.mockResolvedValueOnce(response({ data: { ...summary, byKind: { ...summary.byKind, forged: 1 } } }));
    await expect(service.getAlertSummary()).resolves.toEqual({
      data: null,
      error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation: 'alerts.getAlertSummary' },
    });
  });

  it('registers both closed parsers with the contract parity guard, narrowing only the free-text source title', () => {
    expect(service.responseParserModule.modulePath).toBe('features/alerts/alert-service.ts');
    expect(service.responseParserModule.mode).toBe('parsers');
    expect(service.responseParserModule.parsers.map(({ label, component }) => [label, component])).toEqual([
      ['alerts.listAlerts', 'AlertListResponse'],
      ['alerts.getAlertSummary', 'AlertSummaryResponse'],
    ]);
    // The identifier bounds are the contract's own (minLength/maxLength on
    // AlertSource, AlertLink and AlertItem); the client's 65,535-character cap
    // on the unbounded source title is the one declared narrowing (D-05).
    expect(service.responseParserModule.parsers.map((parser) => [
      parser.label,
      'narrowedPaths' in parser ? [...parser.narrowedPaths] : null,
    ])).toEqual([
      ['alerts.listAlerts', ['data.0.source.title']],
      ['alerts.getAlertSummary', null],
    ]);
  });
});
