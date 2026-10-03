import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  granted: vi.fn(),
  can: vi.fn(),
  listMyQuestionnaires: vi.fn(),
  listMyReleasedAssessments: vi.fn(),
  listAssessmentRequests: vi.fn(),
  listAnalystAssessments: vi.fn(),
  listQuestionnairesForReview: vi.fn(),
  listAdministrationControls: vi.fn(),
  listAlerts: vi.fn(),
  listReportDefinitions: vi.fn(),
  getReport: vi.fn(),
  getAnalystDashboard: vi.fn(),
  getRequestorDashboard: vi.fn(),
  notFound: vi.fn(),
  resolveE2eUiState: vi.fn(),
  resolveE2eDashboardPartial: vi.fn(),
  resolveE2eAnalystDashboardPartial: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, usePathname: () => '/app', useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }) }));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/features/assessments/assessment-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/assessments/assessment-service')>(), listMyReleasedAssessments: mocks.listMyReleasedAssessments, listAssessmentRequests: mocks.listAssessmentRequests, listAnalystAssessments: mocks.listAnalystAssessments }));
vi.mock('@/features/questionnaires/questionnaire-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/questionnaires/questionnaire-service')>(), listMyQuestionnaires: mocks.listMyQuestionnaires, listQuestionnairesForReview: mocks.listQuestionnairesForReview }));
vi.mock('@/features/administration/administration-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/administration/administration-service')>(), listAdministrationControls: mocks.listAdministrationControls }));
vi.mock('@/features/alerts/alert-service', () => ({ listAlerts: mocks.listAlerts }));
vi.mock('@/features/reports/report-service', () => ({ getReport: mocks.getReport, listReportDefinitions: mocks.listReportDefinitions }));
vi.mock('@/features/analyst-dashboard/analyst-dashboard-service', () => ({ getAnalystDashboard: mocks.getAnalystDashboard }));
vi.mock('@/features/dashboard/requestor-dashboard-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/dashboard/requestor-dashboard-service')>(), getRequestorDashboard: mocks.getRequestorDashboard }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eAnalystDashboardPartial: mocks.resolveE2eAnalystDashboardPartial,
  resolveE2eDashboardPartial: mocks.resolveE2eDashboardPartial,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import { AssessmentListContent } from '../../../app/(app)/app/review/assessments/page';
import AssessmentsPage from '../../../app/(app)/app/assessments/page';
import QuestionnairesPage from '../../../app/(app)/app/questionnaires/page';
import { AssessmentRequestListContent } from '../../../app/(app)/app/review/requests/page';
import QuestionnaireReviewsPage from '../../../app/(app)/app/review/questionnaires/page';
import AdministrationCollectionPage from '../../../app/(app)/app/admin/[collection]/page';
import { AlertsContent } from '../../../app/(app)/app/alerts/page';
import { ReportIndexContent } from '../../../app/(app)/app/reports/(report-index)/page';
import ReportPage, { ReportDetailContent } from '../../../app/(app)/app/reports/[reportKey]/page';
import HomePage from '../../../app/(app)/app/page';
import { AnalystHomeContent } from '@/features/home/analyst-home';
import { emptyAnalystDashboard } from '../../features/analyst-dashboard/analyst-dashboard-presentation';
import { deriveRequestorDashboard } from '../../features/dashboard/requestor-dashboard-service';

const params = Promise.resolve({ __e2eState: 'error' });
const success = { data: { records: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } }, error: null };
const alertSuccess = { data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, today: '2026-09-24', dueSoonWindowDays: 14 } }, error: null };
const reportDefinitionsSuccess = { data: [{ key: 'risk-exposure', title: 'Risk exposure', description: 'Open contextual Risks by rating.' }], error: null };
const reportSuccess = {
  data: {
    key: 'control-effectiveness',
    today: '2026-09-24',
    implementationStatus: { existing: 1, planned: 0, implemented: 0, retired: 0, notProvided: 0, total: 1 },
    effectivenessRating: { effective: 0, partiallyEffective: 0, ineffective: 1, notAssessed: 0, notProvided: 0, total: 1 },
  },
  error: null,
};

/*
 * jsdom renders client React, which cannot await a server component. This resolves every async
 * component in a server-rendered tree first, so a test sees what the server streams to the page.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveServerTree(child)));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    return resolveServerTree(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = await resolveServerTree(element.props.children);
  return cloneElement(element, undefined, ...(Array.isArray(children) ? children : [children]));
}

beforeEach(() => {
  calls.length = 0;
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.current.mockResolvedValue({ displayName: 'Security Analyst' });
  mocks.granted.mockResolvedValue(new Set(['administration:manage']));
  mocks.can.mockImplementation(() => { calls.push('capability'); return true; });
  mocks.listMyQuestionnaires.mockImplementation(async () => { calls.push('my-questionnaires'); return { data: { questionnaires: [], pagination: success.data.pagination }, error: null }; });
  mocks.listMyReleasedAssessments.mockImplementation(async () => { calls.push('my-assessments'); return success; });
  mocks.listAssessmentRequests.mockImplementation(async () => { calls.push('review-requests'); return success; });
  mocks.listAnalystAssessments.mockImplementation(async () => { calls.push('assessments'); return success; });
  mocks.listQuestionnairesForReview.mockImplementation(async () => { calls.push('questionnaires'); return { data: { questionnaires: [], pagination: success.data.pagination }, error: null }; });
  mocks.listAdministrationControls.mockImplementation(async () => { calls.push('controls'); return { data: { data: [], meta: { pagination: success.data.pagination } }, error: null }; });
  mocks.listAlerts.mockImplementation(async () => { calls.push('alerts'); return alertSuccess; });
  mocks.listReportDefinitions.mockImplementation(async () => { calls.push('report-definitions'); return reportDefinitionsSuccess; });
  mocks.getReport.mockImplementation(async () => { calls.push('report'); return reportSuccess; });
  mocks.getAnalystDashboard.mockImplementation(async () => { calls.push('analyst-dashboard'); return { kind: 'ready', dashboard: emptyAnalystDashboard(14) }; });
  mocks.getRequestorDashboard.mockImplementation(async () => { calls.push('requestor-dashboard'); return { kind: 'ready', dashboard: deriveRequestorDashboard([], []) }; });
  mocks.resolveE2eDashboardPartial.mockImplementation(() => { calls.push('requestor-partial'); return false; });
  mocks.resolveE2eAnalystDashboardPartial.mockImplementation(() => { calls.push('analyst-partial'); return false; });
  mocks.notFound.mockImplementation(() => { calls.push('not-found'); throw new Error('NEXT_NOT_FOUND'); });
  mocks.resolveE2eUiState.mockImplementation(() => { calls.push('fixture'); return 'error'; });
});

describe('guarded route presentation fixtures', () => {
  it.each([
    ['my questionnaires', async () => QuestionnairesPage({ searchParams: params }), 'my-questionnaires'],
    ['my released assessments', async () => AssessmentsPage({ searchParams: params }), 'my-assessments'],
    ['assessment request review', async () => AssessmentRequestListContent({ searchParams: params }), 'review-requests'],
    ['assessment review', async () => AssessmentListContent({ searchParams: params }), 'assessments'],
    ['questionnaire review', async () => QuestionnaireReviewsPage({ searchParams: params }), 'questionnaires'],
    ['administration', async () => AdministrationCollectionPage({ params: Promise.resolve({ collection: 'controls' }), searchParams: params }), 'controls'],
    ['alerts', async () => AlertsContent({ searchParams: params }), 'alerts'],
    ['reports index', async () => ReportIndexContent({ searchParams: params }), 'report-definitions'],
    ['report detail', async () => ReportDetailContent({ reportKey: 'control-effectiveness', searchParams: params }), 'report'],
    ['analyst dashboard', async () => AnalystHomeContent({ searchParams: params }), 'analyst-dashboard'],
  ] as const)('authorizes and loads %s before resolving its fixture', async (_name, route, service) => {
    render(await route());
    expect(calls.indexOf(service)).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('fixture')).toBeGreaterThan(calls.indexOf(service));
    expect(document.querySelector('[data-ui-state="error"]')).toBeTruthy();
  });

  it.each([
    ['my questionnaires', async () => QuestionnairesPage({ searchParams: params }), mocks.listMyQuestionnaires],
    ['my released assessments', async () => AssessmentsPage({ searchParams: params }), mocks.listMyReleasedAssessments],
    ['assessment request review', async () => AssessmentRequestListContent({ searchParams: params }), mocks.listAssessmentRequests],
    ['assessment review', async () => AssessmentListContent({ searchParams: params }), mocks.listAnalystAssessments],
    ['questionnaire review', async () => QuestionnaireReviewsPage({ searchParams: params }), mocks.listQuestionnairesForReview],
    ['administration', async () => AdministrationCollectionPage({ params: Promise.resolve({ collection: 'controls' }), searchParams: params }), mocks.listAdministrationControls],
    ['alerts', async () => AlertsContent({ searchParams: params }), mocks.listAlerts],
    ['reports index', async () => ReportIndexContent({ searchParams: params }), mocks.listReportDefinitions],
    ['report detail', async () => ReportDetailContent({ reportKey: 'control-effectiveness', searchParams: params }), mocks.getReport],
  ] as const)('keeps authoritative %s denial outside a fixture boundary', async (_name, route, service) => {
    service.mockResolvedValueOnce({ data: null, error: { status: 403, message: 'Forbidden' } });
    render(await route());
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
  });

  it('keeps authoritative analyst dashboard denial outside a fixture boundary and its partial selector', async () => {
    // Any refused read makes the composed dashboard permission denied (D-34).
    mocks.getAnalystDashboard.mockResolvedValueOnce({ kind: 'permission-denied' });
    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'error', __e2ePartial: 'analyst-top-alerts-error' }) }));
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the analyst dashboard');
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
  });
});

describe('Requestor isolation on restricted routes', () => {
  const restrictedRecord = 'Restricted analyst record';

  function signInAsRequestor() {
    mocks.current.mockResolvedValue({ displayName: 'Requestor' });
    mocks.granted.mockResolvedValue(new Set());
    // The real adapter grants only what the session holds; a Requestor holds no analyst or
    // Administration capability.
    mocks.can.mockImplementation((capability: string, granted: Set<string>) => {
      calls.push('capability');
      return granted.has(capability);
    });
  }

  it('denies Administration at its capability gate before any service read or fixture', async () => {
    signInAsRequestor();
    render(await AdministrationCollectionPage({ params: Promise.resolve({ collection: 'controls' }), searchParams: params }));
    expect(mocks.listAdministrationControls).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toBeVisible();
  });

  it('denies Alerts at its capability gate before any alert read or fixture', async () => {
    signInAsRequestor();
    render(await AlertsContent({ searchParams: params }));
    expect(calls).toEqual(['capability']);
    expect(mocks.listAlerts).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.querySelector('a[href^="/app/risks/"], a[href^="/app/review/"]')).toBeNull();
  });

  it('denies the analyst dashboard at its capability gate before any analyst read, fixture or partial selector', async () => {
    signInAsRequestor();
    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'error', __e2ePartial: 'analyst-top-alerts-error' }) }));
    expect(calls).toEqual(['capability']);
    expect(mocks.getAnalystDashboard).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the analyst dashboard');
    expect(document.querySelector('[data-slot="kpi-tile"]')).toBeNull();
    expect(document.querySelector('a[href^="/app/risks/"], a[href^="/app/review/"]')).toBeNull();
  });

  it('gives a Requestor at /app the Requestor Home before any analyst read, analyst fixture or partial selector', async () => {
    signInAsRequestor();
    render(await resolveServerTree(await HomePage({ searchParams: Promise.resolve({ __e2eState: 'error', __e2ePartial: 'analyst-top-alerts-error' }) })));
    // The variant is chosen from the session's capabilities first; only the Requestor's own read
    // follows, and its fixture resolves after that read succeeded (T-11-01).
    expect(calls[0]).toBe('capability');
    expect(calls).not.toContain('analyst-dashboard');
    expect(calls).not.toContain('analyst-partial');
    expect(calls.indexOf('fixture')).toBeGreaterThan(calls.indexOf('requestor-dashboard'));
    expect(mocks.getAnalystDashboard).not.toHaveBeenCalled();
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot="kpi-tile"], [data-slot="analyst-dashboard"]')).toBeNull();
    expect(document.querySelector('a[href^="/app/risks/"], a[href^="/app/review/"]')).toBeNull();
  });

  it('denies the Reports index at its capability gate before any report read or fixture', async () => {
    signInAsRequestor();
    render(await ReportIndexContent({ searchParams: params }));
    expect(calls).toEqual(['capability']);
    expect(mocks.listReportDefinitions).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
  });

  it.each(['control-effectiveness', 'not-a-report'])('denies the %s report URL at its capability gate before key validation, any read or fixture', async (reportKey) => {
    signInAsRequestor();
    render(await ReportPage({ params: Promise.resolve({ reportKey }), searchParams: params }));
    expect(calls).toEqual(['capability']);
    expect(mocks.getReport).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each([
    ['assessment request review', async () => AssessmentRequestListContent({ searchParams: params }), mocks.listAssessmentRequests],
    ['assessment review', async () => AssessmentListContent({ searchParams: params }), mocks.listAnalystAssessments],
    ['questionnaire review', async () => QuestionnaireReviewsPage({ searchParams: params }), mocks.listQuestionnairesForReview],
  ] as const)('renders the %s denial for a Requestor without a fixture boundary or restricted records', async (_name, route, service) => {
    signInAsRequestor();
    // These routes have no page-level gate: Strapi is the authority and denies the analyst
    // collection operation to a Requestor. The fixture selector must never override that.
    service.mockResolvedValue({ data: null, error: { status: 403, message: 'Forbidden' } });
    render(await route());
    expect(service).toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText(restrictedRecord)).toBeNull();
  });
});
