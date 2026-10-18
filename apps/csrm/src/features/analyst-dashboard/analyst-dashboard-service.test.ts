import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const createStrapiClient = vi.hoisted(() => vi.fn());
const getAlertSummary = vi.hoisted(() => vi.fn());
const listAlerts = vi.hoisted(() => vi.fn());
const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };

vi.mock('server-only', () => ({}));
vi.mock('../alerts/alert-service', () => ({ getAlertSummary, listAlerts }));
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

import { dashboardSummaryResponseSchema } from './analyst-dashboard-schema';
import * as service from './analyst-dashboard-service';

afterEach(() => {
  get.mockReset();
  createStrapiClient.mockReset();
  getAlertSummary.mockReset();
  listAlerts.mockReset();
});

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ GET: get });
}

const response = (data: unknown, status = 200) => ({ data, response: { status } });

const criticalRow = {
  documentId: 'risk-c1',
  riskNumber: 'RSK-2026-C1ABCD',
  riskStatement: 'Unpatched payroll servers expose employee records.',
  residualRating: 'Critical',
  targetDate: '2026-09-29',
  treatmentDueState: 'due-soon',
};
const undatedHighRow = {
  documentId: 'risk-h2',
  riskNumber: 'RSK-2026-H2EFGH',
  riskStatement: null,
  residualRating: 'High',
  targetDate: null,
  treatmentDueState: 'no-target-date',
};
const releasedActivity = {
  kind: 'assessment-released',
  recordType: 'assessment',
  documentId: 'asm-1',
  identifier: 'ASM-2026-AB12CD',
  title: 'Payroll platform assessment request',
  actorDisplayName: 'Bob Doe',
  occurredAt: '2026-09-24T09:30:00.000Z',
};
// A questionnaire may have no number: its identifier is null and its title carries the row.
const numberlessActivity = {
  kind: 'questionnaire-returned-to-draft',
  recordType: 'questionnaire',
  documentId: 'ques-2',
  identifier: null,
  title: 'Payroll questionnaire',
  actorDisplayName: 'Jane Doe',
  occurredAt: '2026-09-24T09:00:00.000Z',
};
// A generated draft names no actor.
const generatedActivity = {
  kind: 'assessment-draft-generated',
  recordType: 'assessment',
  documentId: 'asm-1',
  identifier: 'ASM-2026-AB12CD',
  title: null,
  actorDisplayName: null,
  occurredAt: '2026-09-23T17:45:00.000Z',
};

const summary = {
  today: '2026-09-24',
  dueSoonWindowDays: 14,
  reviewQueue: {
    requiresAttention: 4,
    awaitingRequestor: 1,
    generationInProgress: 0,
    questionnairesReadyForReview: 3,
    assessmentsDraft: 1,
    assessmentsInReview: 2,
    // Phase 13 (D-15): the viewer's own counts, apart from the team's, and the team's pick-up pool.
    mine: { requiresAttention: 2, awaitingRequestor: 1, generationInProgress: 0, withUnreadNotes: 1 },
    unassigned: 3,
  },
  // D-40 to D-42: released, released and accepted, and under assessment, apart.
  riskExposure: {
    released: { Critical: 1, High: 2, Moderate: 1, Low: 0, notRated: 1, total: 5 },
    releasedAccepted: { Critical: 0, High: 1, Moderate: 1, Low: 0, notRated: 0, total: 2 },
    underAssessment: { Critical: 2, High: 0, Moderate: 0, Low: 1, notRated: 0, total: 3 },
  },
  highCriticalRisks: { rows: [criticalRow, undatedHighRow], total: 3, truncated: false },
  treatmentsDue: { overdue: 1, dueSoon: 1, total: 2 },
  recentActivity: { rows: [releasedActivity, numberlessActivity, generatedActivity], truncated: true },
};

const payload = { data: summary };
const parses = (data: unknown): boolean => dashboardSummaryResponseSchema.safeParse({ data }).success;

describe('analyst dashboard service', () => {
  it('reads the summary through the generated path with no parameters and parses it closed', async () => {
    useMockClient();
    get.mockResolvedValueOnce(response(payload));
    await expect(service.getDashboardSummary()).resolves.toEqual({ data: summary, error: null });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/v1/dashboard/summary');
  });

  it('keeps a 403 as a 403, reports a malformed body as a contract error and an outage as the generic error', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status: 403 } });
    await expect(service.getDashboardSummary()).resolves.toEqual({
      data: null,
      error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 },
    });

    get.mockResolvedValueOnce(response({ data: { ...summary, recentActivity: { ...summary.recentActivity, rows: [{ ...releasedActivity, kind: 'approved' }] } } }));
    await expect(service.getDashboardSummary()).resolves.toEqual({
      data: null,
      error: {
        message: 'The response did not match the expected CSRM contract.',
        kind: 'response-contract-mismatch',
        operation: 'analystDashboard.getDashboardSummary',
      },
    });

    get.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.getDashboardSummary()).resolves.toEqual(unavailable);
  });

  it('accepts every null the contract allows: identifier, title, actor, statement and target date', () => {
    expect(parses(summary)).toBe(true);
    expect(parses({
      ...summary,
      highCriticalRisks: { rows: [], total: 0, truncated: false },
      recentActivity: { rows: [], truncated: false },
    })).toBe(true);
    expect(parses({
      ...summary,
      recentActivity: {
        rows: [{ ...numberlessActivity, title: null, actorDisplayName: null }],
        truncated: false,
      },
    })).toBe(true);
  });

  it('refuses anything outside the closed contract', () => {
    const refused: Array<[string, unknown]> = [
      ['an unknown activity kind', { ...summary, recentActivity: { ...summary.recentActivity, rows: [{ ...releasedActivity, kind: 'assessment-approved' }] } }],
      ['an unknown record type', { ...summary, recentActivity: { ...summary.recentActivity, rows: [{ ...releasedActivity, recordType: 'risk' }] } }],
      ['a date without a time', { ...summary, recentActivity: { ...summary.recentActivity, rows: [{ ...releasedActivity, occurredAt: '2026-09-24' }] } }],
      ['an extra activity key', { ...summary, recentActivity: { ...summary.recentActivity, rows: [{ ...releasedActivity, actorDocumentId: 'bob' }] } }],
      ['nine activity rows', { ...summary, recentActivity: { rows: Array.from({ length: 9 }, () => releasedActivity), truncated: true } }],
      ['a Moderate row', { ...summary, highCriticalRisks: { ...summary.highCriticalRisks, rows: [{ ...criticalRow, residualRating: 'Moderate' }] } }],
      ['an unknown due state', { ...summary, highCriticalRisks: { ...summary.highCriticalRisks, rows: [{ ...criticalRow, treatmentDueState: 'overdue-soon' }] } }],
      ['six High and Critical rows', { ...summary, highCriticalRisks: { rows: Array.from({ length: 6 }, () => criticalRow), total: 6, truncated: true } }],
      ['a negative count', { ...summary, reviewQueue: { ...summary.reviewQueue, requiresAttention: -1 } }],
      ['a missing viewer block', { ...summary, reviewQueue: { ...summary.reviewQueue, mine: undefined } }],
      ['a missing pick-up pool', { ...summary, reviewQueue: { ...summary.reviewQueue, unassigned: undefined } }],
      ['an open count in the viewer block', { ...summary, reviewQueue: { ...summary.reviewQueue, mine: { ...summary.reviewQueue.mine, open: 4 } } }],
      ['a negative viewer count', { ...summary, reviewQueue: { ...summary.reviewQueue, mine: { ...summary.reviewQueue.mine, withUnreadNotes: -1 } } }],
      ['a fractional count', { ...summary, treatmentsDue: { ...summary.treatmentsDue, total: 2.5 } }],
      ['an extra section', { ...summary, alerts: [] }],
      ['a missing section', { ...summary, recentActivity: undefined }],
      ['an extra exposure key', { ...summary, riskExposure: { ...summary.riskExposure, unreleased: summary.riskExposure.underAssessment } }],
      ['an extra rating in a stage', { ...summary, riskExposure: { ...summary.riskExposure, released: { ...summary.riskExposure.released, Extreme: 0 } } }],
      ['a missing stage', { ...summary, riskExposure: { released: summary.riskExposure.released, releasedAccepted: summary.riskExposure.releasedAccepted } }],
      // The Phase 7 flat shape counted both stages as one total; it is refused, never read as released (D-42).
      ['the flat exposure of both stages', { ...summary, riskExposure: summary.riskExposure.released }],
      ['a window of zero days', { ...summary, dueSoonWindowDays: 0 }],
    ];
    for (const [label, data] of refused) expect(parses(data), label).toBe(false);
  });

  it('registers the closed parser with the contract parity guard, narrowing only the free-text fields', () => {
    expect(service.responseParserModule.modulePath).toBe('features/analyst-dashboard/analyst-dashboard-service.ts');
    expect(service.responseParserModule.mode).toBe('parsers');
    expect(service.responseParserModule.parsers.map(({ label, component }) => [label, component])).toEqual([
      ['analystDashboard.getDashboardSummary', 'DashboardSummaryResponse'],
    ]);
    // The identifier bounds are the contract's own (minLength/maxLength on
    // DashboardRiskRow and ActivityItem); the client's 65,535-character caps
    // on the unbounded free text are the only declared narrowings (D-05).
    expect(service.responseParserModule.parsers.map((parser) => [
      parser.label,
      'narrowedPaths' in parser ? [...parser.narrowedPaths] : null,
    ])).toEqual([
      ['analystDashboard.getDashboardSummary', [
        'data.highCriticalRisks.rows.0.riskStatement',
        'data.recentActivity.rows.0.title',
        'data.recentActivity.rows.0.actorDisplayName',
      ]],
    ]);
  });
});

/* ------------------------------------------------------------------ composition (D-34) */

const treatmentQuery = { kinds: ['risk-treatment-overdue', 'risk-treatment-due-soon'], page: 1, pageSize: 5 };
const dueSoonQuery = { urgency: 'due-soon', page: 1, pageSize: 5 };
const topAlertsQuery = { page: 1, pageSize: 5 };

function alertOf(id: string, kind: 'risk-treatment-overdue' | 'risk-treatment-due-soon' | 'request-due-soon', urgency: 'overdue' | 'due-soon') {
  return {
    id: `${kind}:${id}`,
    kind,
    urgency,
    governingDate: '2026-09-30',
    dayOffset: 6,
    source: { type: kind === 'request-due-soon' ? 'assessment-request' : 'risk', documentId: id, identifier: `RSK-${id}`, title: null, released: false },
    link: { type: kind === 'request-due-soon' ? 'assessment-request' : 'risk', documentId: id },
    residualRating: kind === 'request-due-soon' ? null : 'High',
  };
}
const overdueTreatment = alertOf('risk-h1', 'risk-treatment-overdue', 'overdue');
const dueSoonTreatment = alertOf('risk-c1', 'risk-treatment-due-soon', 'due-soon');
const dueSoonRequest = alertOf('request-7', 'request-due-soon', 'due-soon');

const alertSummary = {
  byKind: {
    'risk-treatment-overdue': 1,
    'risk-treatment-due-soon': 1,
    'request-overdue': 1,
    'request-due-soon': 4,
    'control-implementation-overdue': 1,
    'assessment-review-due': 0,
    'critical-residual-risk-untreated': 1,
    'ineffective-control': 1,
  },
  byUrgency: { overdue: 3, 'due-soon': 5, attention: 2 },
  total: 10,
  today: '2026-09-24',
  dueSoonWindowDays: 14,
};

function alertPage(rows: unknown[], total: number) {
  return {
    data: {
      data: rows,
      meta: { pagination: { page: 1, pageSize: 5, pageCount: Math.ceil(total / 5), total }, today: '2026-09-24', dueSoonWindowDays: 14 },
    },
    error: null,
  };
}

const failure = (status?: number) => ({ data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', ...(status ? { status } : {}) } });

type ReadResult = ReturnType<typeof failure> | ReturnType<typeof alertPage> | { data: unknown; error: null };
type Reads = { summary: unknown; alertSummary: ReadResult; treatments: ReadResult; dueSoon: ReadResult; topAlerts: ReadResult };

/* The treatment page's own total differs from the summary's on purpose: the widget's total is the summary's (D-34). */
const everyReadSucceeds: Reads = {
  summary: response(payload),
  alertSummary: { data: alertSummary, error: null },
  treatments: alertPage([overdueTreatment, dueSoonTreatment], 3),
  dueSoon: alertPage([dueSoonTreatment, dueSoonRequest], 7),
  topAlerts: alertPage([overdueTreatment, dueSoonTreatment, dueSoonRequest], 10),
};

function serve(overrides: Partial<Reads> = {}): void {
  const reads = { ...everyReadSucceeds, ...overrides };
  useMockClient();
  get.mockImplementation(async () => reads.summary);
  getAlertSummary.mockImplementation(async () => reads.alertSummary);
  listAlerts.mockImplementation(async (query: { kinds?: unknown; urgency?: unknown }) => {
    if (query.kinds) return reads.treatments;
    return query.urgency ? reads.dueSoon : reads.topAlerts;
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

const readyUnits = {
  // Phase 13 (D-15): tile 1 is the viewer's own Requires attention count (2), never the team's (4).
  kpi: { status: 'ready', data: { needsYourAction: 2, overdue: 3, dueSoon: 5, attention: 2 } },
  reviewQueue: { status: 'ready', data: summary.reviewQueue },
  riskExposure: { status: 'ready', data: summary.riskExposure },
  highCritical: { status: 'ready', data: summary.highCriticalRisks },
  treatmentsDue: { status: 'ready', data: { rows: [overdueTreatment, dueSoonTreatment], total: 2 } },
  upcomingDueDates: { status: 'ready', data: { rows: [dueSoonTreatment, dueSoonRequest], total: 7 } },
  topAlerts: { status: 'ready', data: { rows: [overdueTreatment, dueSoonTreatment, dueSoonRequest], total: 10 } },
  recentActivity: { status: 'ready', data: summary.recentActivity },
};

describe('getAnalystDashboard', () => {
  it('starts the summary, the alert summary and three bounded alert pages together, before any returns', async () => {
    useMockClient();
    const summaryRead = deferred<unknown>();
    const alertSummaryRead = deferred<unknown>();
    const pages = new Map<string, ReturnType<typeof deferred<unknown>>>();
    get.mockReturnValue(summaryRead.promise);
    getAlertSummary.mockReturnValue(alertSummaryRead.promise);
    listAlerts.mockImplementation((query: unknown) => {
      const page = deferred<unknown>();
      pages.set(JSON.stringify(query), page);
      return page.promise;
    });

    const state = service.getAnalystDashboard();

    // Nothing has answered yet, and every read is already in flight: the five run in parallel.
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1);
      expect(getAlertSummary).toHaveBeenCalledTimes(1);
      expect(listAlerts).toHaveBeenCalledTimes(3);
    });
    expect(get).toHaveBeenCalledWith('/v1/dashboard/summary');
    expect(getAlertSummary).toHaveBeenCalledWith();
    expect(listAlerts.mock.calls.map(([query]) => query)).toEqual(expect.arrayContaining([treatmentQuery, dueSoonQuery, topAlertsQuery]));

    summaryRead.resolve(everyReadSucceeds.summary);
    alertSummaryRead.resolve(everyReadSucceeds.alertSummary);
    pages.get(JSON.stringify(treatmentQuery))?.resolve(everyReadSucceeds.treatments);
    pages.get(JSON.stringify(dueSoonQuery))?.resolve(everyReadSucceeds.dueSoon);
    pages.get(JSON.stringify(topAlertsQuery))?.resolve(everyReadSucceeds.topAlerts);
    await expect(state).resolves.toMatchObject({ kind: 'ready' });
  });

  it('composes every unit from its own read when all five succeed', async () => {
    serve();
    await expect(service.getAnalystDashboard()).resolves.toEqual({
      kind: 'ready',
      dashboard: { dueSoonWindowDays: 14, units: readyUnits },
    });
  });

  it.each([
    ['the summary', { summary: { error: { message: 'forbidden' }, response: { status: 403 } } }],
    ['the alert summary', { alertSummary: failure(403) }],
    ['the treatment page', { treatments: failure(403) }],
    ['the due-soon page', { dueSoon: failure(403) }],
    ['the top alerts page', { topAlerts: failure(403) }],
  ] as const)('is permission denied when %s is refused', async (_read, overrides) => {
    serve(overrides as Partial<Reads>);
    await expect(service.getAnalystDashboard()).resolves.toEqual({ kind: 'permission-denied' });
  });

  it.each([
    ['an outage', { error: { message: 'down' }, response: { status: 500 } }],
    ['a contract mismatch', { data: { data: { ...summary, reviewQueue: { ...summary.reviewQueue, extra: 1 } } }, response: { status: 200 } }],
  ])('is the page error when the summary fails with %s, whatever the other reads return', async (_case, summaryResponse) => {
    serve({ summary: summaryResponse });
    await expect(service.getAnalystDashboard()).resolves.toEqual({ kind: 'error' });
  });

  it('is the page error when the summary transport throws', async () => {
    serve();
    get.mockRejectedValue(new Error('socket hang up'));
    await expect(service.getAnalystDashboard()).resolves.toEqual({ kind: 'error' });

    createStrapiClient.mockRejectedValue(new Error('no configuration'));
    await expect(service.getAnalystDashboard()).resolves.toEqual({ kind: 'error' });
  });

  it('keeps every other unit when the alert summary fails: only the KPI strip is unavailable', async () => {
    serve({ alertSummary: failure(500) });
    await expect(service.getAnalystDashboard()).resolves.toEqual({
      kind: 'ready',
      dashboard: { dueSoonWindowDays: 14, units: { ...readyUnits, kpi: { status: 'unavailable' } } },
    });
  });

  it.each([
    ['treatments', 'treatmentsDue'],
    ['dueSoon', 'upcomingDueDates'],
    ['topAlerts', 'topAlerts'],
  ] as const)('makes only its own widget unavailable when the %s page fails', async (read, unit) => {
    serve({ [read]: failure(500) });
    await expect(service.getAnalystDashboard()).resolves.toEqual({
      kind: 'ready',
      dashboard: { dueSoonWindowDays: 14, units: { ...readyUnits, [unit]: { status: 'unavailable' } } },
    });
  });

  it('treats an alert read that rejects outright as that widget alone being unavailable', async () => {
    serve();
    listAlerts.mockImplementation(async (query: { kinds?: unknown; urgency?: unknown }) => {
      if (query.kinds) return everyReadSucceeds.treatments;
      if (query.urgency) return everyReadSucceeds.dueSoon;
      throw new Error('socket hang up');
    });
    await expect(service.getAnalystDashboard()).resolves.toEqual({
      kind: 'ready',
      dashboard: { dueSoonWindowDays: 14, units: { ...readyUnits, topAlerts: { status: 'unavailable' } } },
    });
  });
});
