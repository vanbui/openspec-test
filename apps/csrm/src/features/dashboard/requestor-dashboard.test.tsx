import { cleanup, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleasedAssessmentSummary } from '../assessments/assessment-schema';
import { requestStatusPresentation, type CsrmAssessmentRequest, type RequestStatus } from '../requests/request-domain';
import type { QuestionnaireSummary } from '../questionnaires/questionnaire-service';

const listDashboardRequests = vi.hoisted(() => vi.fn());
const listMyQuestionnaires = vi.hoisted(() => vi.fn());
const getMyQuestionnaireSummary = vi.hoisted(() => vi.fn());
const listMyReleasedAssessments = vi.hoisted(() => vi.fn());
const getMyAssessmentRatingSummary = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('../requests/request-service', () => ({ listDashboardRequests }));
vi.mock('../assessments/assessment-service', () => ({
  getMyAssessmentRatingSummary,
  listMyReleasedAssessments,
}));
vi.mock('../questionnaires/questionnaire-service', () => ({
  getMyQuestionnaireSummary,
  listMyQuestionnaires,
}));

function requestFixture(
  documentId: string,
  title: string,
  requestStatus: RequestStatus,
  overrides: Partial<CsrmAssessmentRequest> = {},
): CsrmAssessmentRequest {
  return {
    documentId,
    requestNumber: `RAR-2026-${documentId.toUpperCase().padEnd(6, '0').slice(0, 6)}`,
    title,
    description: null,
    requestStatus,
    dueDate: null,
    updatedAt: '2026-08-30T01:00:00.000Z',
    dueDateLabel: null,
    updatedDateLabel: '30 Aug 2026',
    informationSystems: [],
    informationAssets: [],
    questionnaire: null,
    assessment: null,
    ...overrides,
  };
}

const authorisedRequests = [
  requestFixture('draft-1', 'Customer portal draft', 'draft'),
  requestFixture('questionnaire-1', 'Payments questionnaire', 'questionnaire-in-progress', {
    questionnaire: { documentId: 'questionnaire-document-1', title: 'Payments security questionnaire' },
  }),
  requestFixture('approved-1', 'Approved without release', 'approved', {
    assessment: { documentId: 'assessment-document-1', assessmentStatus: 'approved' },
  }),
] as const;

const authoritativeQuestionnaire: QuestionnaireSummary = {
  documentId: 'questionnaire/document-1',
  questionnaireNumber: 'QUE-2026-000001',
  title: 'Payments security questionnaire',
  description: null,
  state: 'draft',
  progress: { answered: 3, total: 5, percent: 60 },
  assessmentRequest: { availability: 'available' as const,
    documentId: 'questionnaire-1',
    requestNumber: 'RAR-2026-QUEST1',
    title: 'Payments questionnaire request',
    requestStatus: 'questionnaire-in-progress',
  },
  updatedAt: '2026-08-30T01:00:00.000Z',
};

const releasedAssessment: ReleasedAssessmentSummary = {
  documentId: 'assessment/id with spaces',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'approved',
  summary: 'Released customer portal assessment.',
  overallRating: 'High',
  generatedDate: '2026-08-29T23:00:00.000Z',
  generatedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' },
  approvalDate: '2026-08-30T01:30:00.000Z',
};

const ratingSummary = { Low: 1, Moderate: 2, High: 3, Critical: 4, total: 10 } as const;

function setDashboardRequestDefault() {
  listDashboardRequests.mockResolvedValue({
    data: { requests: [], pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } },
    error: null,
  });
}

beforeEach(() => setDashboardRequestDefault());

afterEach(() => {
  cleanup();
  listDashboardRequests.mockReset();
  listMyQuestionnaires.mockReset();
  getMyQuestionnaireSummary.mockReset();
  listMyReleasedAssessments.mockReset();
  getMyAssessmentRatingSummary.mockReset();
});

describe('Requestor dashboard contract', () => {
  it('shows questionnaire routes only for their mapped capabilities', async () => {
    const { CapabilityNavigation } = await import('@/components/shell/capability-navigation');
    const view = render(<CapabilityNavigation granted={new Set(['assessment-request:read'])} />);
    expect(screen.getByRole('link', { name: 'My Questionnaires' })).toHaveAttribute('href', '/app/questionnaires');
    expect(screen.queryByRole('link', { name: 'Questionnaires' })).not.toBeInTheDocument();

    view.rerender(<CapabilityNavigation granted={new Set(['assessment:review'])} />);
    expect(screen.getByRole('link', { name: 'Questionnaires' })).toHaveAttribute('href', '/app/review/questionnaires');
    expect(screen.queryByRole('link', { name: 'My Questionnaires' })).not.toBeInTheDocument();
  });

  it('derives authorised dashboard projections and distinct display states', async () => {
    expect(document.body, 'BASELINE_JSDOM_BODY').toBeDefined();
    expect(authorisedRequests, 'BASELINE_TYPED_REQUEST_FIXTURES').toHaveLength(3);

    const serviceModule = './requestor-dashboard-' + 'service';
    const componentModule = './requestor-' + 'dashboard';
    const { deriveRequestorDashboard, getRequestorDashboard } = await import(
      /* @vite-ignore */ serviceModule
    );
    const { RequestorDashboard } = await import(/* @vite-ignore */ componentModule);

    const projection = deriveRequestorDashboard(
      authorisedRequests,
      [authoritativeQuestionnaire],
      undefined,
      [releasedAssessment],
      ratingSummary,
      [],
    );
    expect(projection.draftRequests).toMatchObject({ count: 1 });
    // Every state is listed with a zero where there are none; counts that could
    // not be read are a different fact and are reported as unavailable.
    expect(deriveRequestorDashboard([], [], undefined, [], ratingSummary, null).requestLifecycleCounts).toBeNull();
    expect(projection.requestLifecycleCounts).toEqual([
      { status: 'draft', label: 'Draft', count: 0 },
      { status: 'submitted', label: 'Submitted', count: 0 },
      { status: 'questionnaire-in-progress', label: 'Questionnaire in progress', count: 0 },
      { status: 'risk-assessment-drafted', label: 'Risk assessment drafted', count: 0 },
      { status: 'under-review', label: 'Under review', count: 0 },
      { status: 'approved', label: 'Approved', count: 0 },
      { status: 'closed', label: 'Closed', count: 0 },
    ]);
    expect(projection.draftRequests.items[0]).toMatchObject({
      href: '/app/requests/draft-1',
      status: 'draft',
      title: 'Customer portal draft',
    });
    expect(projection.questionnaires).toMatchObject({ count: 1 });
    expect(projection.questionnaires.items[0]).toMatchObject({
      href: '/app/questionnaires/questionnaire%2Fdocument-1',
      state: 'draft',
      title: 'Payments security questionnaire',
      context: 'Payments questionnaire request · RAR-2026-QUEST1',
      progress: { answered: 3, total: 5, percent: 60, unanswered: 2 },
    });
    expect(projection.questionnaires.items[0]?.href).not.toBe('/app/requests/questionnaire-1');
    expect(projection.releasedAssessments).toMatchObject({
      kind: 'populated',
      count: 10,
      ratingSummary,
      items: [{
        documentId: 'assessment/id with spaces',
        assessmentNumber: 'ASM-0042',
        href: '/app/assessments/assessment%2Fid%20with%20spaces',
        overallRating: 'High',
        summary: 'Released customer portal assessment.',
      }],
    });
    const boundedReleasedProjection = deriveRequestorDashboard(
      [],
      [],
      undefined,
      Array.from({ length: 6 }, (_, index) => ({
        ...releasedAssessment,
        documentId: `assessment-${index}`,
        assessmentNumber: `ASM-${index}`,
      })),
      { ...ratingSummary, total: 6 },
    );
    expect(boundedReleasedProjection.releasedAssessments.items).toHaveLength(5);
    expect(JSON.stringify(projection.releasedAssessments)).not.toContain('Approved without release');

    listDashboardRequests.mockResolvedValueOnce({
      data: { requests: [authorisedRequests[0]], pagination: { page: 1, pageSize: 50, pageCount: 2, total: 81 } },
      error: null,
    });
    listMyQuestionnaires.mockResolvedValueOnce({ data: [authoritativeQuestionnaire], error: null });
    getMyQuestionnaireSummary.mockResolvedValueOnce({
      data: { notStarted: 2, draft: 61, submitted: 8, total: 71 },
      error: null,
    });
    listMyReleasedAssessments.mockResolvedValueOnce({ data: [releasedAssessment], error: null });
    getMyAssessmentRatingSummary.mockResolvedValueOnce({ data: ratingSummary, error: null });
    await expect(getRequestorDashboard()).resolves.toEqual({
      kind: 'ready',
      dashboard: deriveRequestorDashboard(
        [authorisedRequests[0]],
        [authoritativeQuestionnaire],
        { drafts: 81, questionnaires: 63 },
        [releasedAssessment],
        ratingSummary,
      [],
      ),
    });
    expect(listDashboardRequests).toHaveBeenNthCalledWith(1, {
      q: '',
      status: 'draft',
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: 50,
    });
    expect(listDashboardRequests).toHaveBeenCalledTimes(8);
    expect(listMyQuestionnaires).toHaveBeenCalledTimes(1);
    expect(getMyQuestionnaireSummary).toHaveBeenCalledTimes(1);
    expect(listMyReleasedAssessments).toHaveBeenCalledTimes(1);
    expect(getMyAssessmentRatingSummary).toHaveBeenCalledTimes(1);

    render(<RequestorDashboard state={{ kind: 'ready', dashboard: projection }} />);
    const lifecycleRegion = screen.getByRole('region', { name: 'My Assessment Requests' });
    expect(within(lifecycleRegion).getByRole('list', { name: 'My Assessment Requests by lifecycle state' })).toBeInTheDocument();
    for (const status of ['draft', 'submitted', 'questionnaire-in-progress', 'risk-assessment-drafted', 'under-review', 'approved', 'closed']) {
      expect(within(lifecycleRegion).getByRole('link', { name: new RegExp(requestStatusPresentation[status as RequestStatus].label) })).toHaveAttribute('href', `/app/requests?status=${status}`);
    }
    /*
     * Every lifecycle state is listed, including the ones with nothing in them,
     * and a state with no requests says so rather than showing a bare zero.
     * Asserted over every card so a state that loses its note, or gains one it
     * should not have, fails here.
     */
    const lifecycleCards = within(lifecycleRegion).getAllByRole('link');
    expect(lifecycleCards).toHaveLength(7);
    let emptyCards = 0;
    for (const card of lifecycleCards) {
      const count = Number(within(card).getByLabelText(/^\d+ requests?$/).textContent);
      const note = within(card).queryByText('There are none in this state.');
      expect(note === null).toBe(count > 0);
      if (count === 0) emptyCards += 1;
    }
    expect(emptyCards).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Draft requests' })).toHaveClass('text-heading-sm');
    expect(screen.getByRole('heading', { name: 'Questionnaires in progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently released assessments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Customer portal draft/ })).toHaveAttribute('href', '/app/requests/draft-1');
    expect(screen.getByRole('link', { name: /Customer portal draft/ })).toHaveClass('record-link');
    expect(screen.getByRole('link', { name: /Payments security questionnaire/ })).toHaveAttribute(
      'href',
      '/app/questionnaires/questionnaire%2Fdocument-1',
    );
    /*
     * The lifecycle cards name the same states, so the status-badge assertions
     * are scoped outside them. The rule they protect is unchanged: a status
     * badge carries an icon, so its meaning never depends on colour alone.
     */
    const draftBadges = screen.getAllByText('Draft', { exact: true }).filter((label) => !lifecycleRegion.contains(label));
    expect(draftBadges).toHaveLength(2);
    expect(draftBadges.every((label) => label.querySelector('svg'))).toBe(true);
    expect(screen.getByText('3 of 5 answered')).toBeInTheDocument();
    expect(screen.getByText('2 unanswered')).toBeInTheDocument();
    expect(screen.getByText(/Payments questionnaire request/)).toBeInTheDocument();
    const releasedWidget = screen.getByRole('region', { name: 'Recently released assessments' });
    expect(within(releasedWidget).getByRole('link', { name: 'ASM-0042' })).toHaveAttribute(
      'href',
      '/app/assessments/assessment%2Fid%20with%20spaces',
    );
    expect(within(releasedWidget).getByRole('link', { name: 'ASM-0042' })).toHaveClass('record-link');
    expect(within(releasedWidget).getByText('Released customer portal assessment.')).toBeInTheDocument();
    expect(within(releasedWidget).getByText('Released 30 Aug 2026')).toBeInTheDocument();
    for (const [rating, count] of Object.entries({ Low: 1, Moderate: 2, High: 3, Critical: 4 })) {
      const summaryItem = within(releasedWidget).getByLabelText(`${rating} released assessments: ${count}`);
      expect(summaryItem).toHaveTextContent(rating);
      expect(summaryItem).toHaveTextContent(String(count));
      expect(summaryItem.querySelector('svg')).toBeInTheDocument();
      expect(summaryItem.lastElementChild).toHaveClass('text-sm', 'font-medium', 'tabular-nums');
    }
    expect(within(releasedWidget).queryByText(/release information is not available/i)).not.toBeInTheDocument();
    expect(releasedWidget.querySelector('form, input, textarea, select, button')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved without release')).not.toBeInTheDocument();
    expect(document.querySelectorAll('section[aria-labelledby]')).toHaveLength(4);

    cleanup();
    // The mocked reads all succeed, so the lifecycle counts are available and
    // every state reads zero — which is a different projection from counts that
    // could not be read at all.
    const emptyProjection = deriveRequestorDashboard([], [], undefined, [], undefined, []);
    render(<RequestorDashboard state={{ kind: 'ready', dashboard: emptyProjection }} />);
    expect(screen.getByRole('heading', { name: 'No draft requests yet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No active questionnaires yet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No released risk assessments yet' })).toBeInTheDocument();

    cleanup();
    render(<RequestorDashboard state={{ kind: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state-kind', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…');

    cleanup();
    render(<RequestorDashboard state={{ kind: 'error' }} />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your dashboard');
    expect(screen.getByRole('link', { name: 'View My Requests' })).toHaveAttribute('href', '/app/requests');

    cleanup();
    render(<RequestorDashboard state={{ kind: 'permission-denied' }} />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', 'permission');
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to your dashboard');
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/sign-in');

    cleanup();
    render(<RequestorDashboard failedWidget="draft-requests" state={{ kind: 'ready', dashboard: projection }} />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load draft requests');
    expect(screen.getByRole('alert')).toHaveClass('p-4', 'text-left');
    expect(screen.getByRole('heading', { name: 'Recently released assessments' })).toHaveClass('text-heading-sm');

    const emptyRequestResult = { data: { requests: [], pagination: { page: 1, pageSize: 50, pageCount: 0, total: 0 } }, error: null };
    const emptyQuestionnaireResult = { data: [] as readonly QuestionnaireSummary[], error: null };
    const emptySummaryResult = { data: { notStarted: 0, draft: 0, submitted: 0, total: 0 }, error: null };
    const emptyReleasedResult = { data: [] as readonly ReleasedAssessmentSummary[], error: null };
    const emptyRatingResult = { data: { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 }, error: null };
    listDashboardRequests.mockResolvedValueOnce({ data: null, error: { message: 'Forbidden', status: 403 } });
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'permission-denied' });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult);
    listMyQuestionnaires.mockResolvedValueOnce({ data: null, error: { message: 'Forbidden questionnaire', status: 403 } });
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'permission-denied' });

    listDashboardRequests.mockResolvedValueOnce({ data: null, error: { message: 'Malformed response', status: 503 } });
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'error' });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult)
      .mockResolvedValueOnce(emptyRequestResult)
      .mockResolvedValueOnce({ data: null, error: { message: 'Forbidden lifecycle count', status: 403 } });
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'permission-denied' });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult);
    listMyQuestionnaires.mockRejectedValueOnce(new Error('transport failed'));
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'error' });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult);
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'ready', dashboard: emptyProjection });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult);
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce({ data: null, error: { message: 'Forbidden assessment', status: 403 } });
    getMyAssessmentRatingSummary.mockResolvedValueOnce(emptyRatingResult);
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'permission-denied' });

    listDashboardRequests.mockResolvedValueOnce(emptyRequestResult);
    listMyQuestionnaires.mockResolvedValueOnce(emptyQuestionnaireResult);
    getMyQuestionnaireSummary.mockResolvedValueOnce(emptySummaryResult);
    listMyReleasedAssessments.mockResolvedValueOnce(emptyReleasedResult);
    getMyAssessmentRatingSummary.mockResolvedValueOnce({ data: null, error: { message: 'Unavailable', status: 503 } });
    await expect(getRequestorDashboard()).resolves.toEqual({ kind: 'error' });

    expect(document.body).not.toHaveTextContent('Forbidden questionnaire');
  });
});
