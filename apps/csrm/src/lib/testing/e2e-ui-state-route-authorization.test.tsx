import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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
  resolveE2eUiState: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/app', useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }) }));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/features/assessments/assessment-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/assessments/assessment-service')>(), listMyReleasedAssessments: mocks.listMyReleasedAssessments, listAssessmentRequests: mocks.listAssessmentRequests, listAnalystAssessments: mocks.listAnalystAssessments }));
vi.mock('@/features/questionnaires/questionnaire-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/questionnaires/questionnaire-service')>(), listMyQuestionnaires: mocks.listMyQuestionnaires, listQuestionnairesForReview: mocks.listQuestionnairesForReview }));
vi.mock('@/features/administration/administration-service', async (importOriginal) => ({ ...await importOriginal<typeof import('@/features/administration/administration-service')>(), listAdministrationControls: mocks.listAdministrationControls }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import { AssessmentListContent } from '../../../app/(app)/app/review/assessments/page';
import AssessmentsPage from '../../../app/(app)/app/assessments/page';
import QuestionnairesPage from '../../../app/(app)/app/questionnaires/page';
import { AssessmentRequestListContent } from '../../../app/(app)/app/review/requests/page';
import QuestionnaireReviewsPage from '../../../app/(app)/app/review/questionnaires/page';
import AdministrationCollectionPage from '../../../app/(app)/app/admin/[collection]/page';

const params = Promise.resolve({ __e2eState: 'error' });
const success = { data: { records: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } }, error: null };

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
  ] as const)('keeps authoritative %s denial outside a fixture boundary', async (_name, route, service) => {
    service.mockResolvedValueOnce({ data: null, error: { status: 403, message: 'Forbidden' } });
    render(await route());
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
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
