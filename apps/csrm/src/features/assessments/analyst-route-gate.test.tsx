import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The analyst detail routes check `assessment:review` before any record read (10-CONTEXT D-23, UI-SPEC §11.1),
 * as the analyst dashboard does (07 D-16). A Requestor who opens one gets the route's permission state and the
 * route's static title, and no record read runs, so an existing and a missing id look the same. The check is
 * presentation only: Strapi still authorises every read, and an analyst's refused read renders the record
 * variant of the same state (UI-SPEC §11.2).
 */

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  getAnalystAssessment: vi.fn(),
  getQuestionnaire: vi.fn(),
  getQuestionnaireGovernanceQuestions: vi.fn(),
  getRequest: vi.fn(),
  getRequestGenerationJobs: vi.fn(),
  granted: vi.fn(),
  listControlImplementations: vi.fn(),
  listControls: vi.fn(),
  listInformationAssets: vi.fn(),
  listInformationSystems: vi.fn(),
  listRiskTypes: vi.fn(),
  notFound: vi.fn(),
}));

/** Every record read an analyst route can make; a refused viewer must reach none of them. */
const recordReads = [
  'getAnalystAssessment',
  'getQuestionnaire',
  'getQuestionnaireGovernanceQuestions',
  'getRequest',
  'getRequestGenerationJobs',
  'listControlImplementations',
  'listControls',
  'listInformationAssets',
  'listInformationSystems',
  'listRiskTypes',
] as const;

vi.mock('server-only', () => ({}));
// Phase 19 (19-12): the released header's Export is bound to this Server Action; its module reads services this file mocks.
vi.mock('@/features/exports/export-actions', () => ({ exportReleasedAssessmentAction: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/review',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: mocks.current,
    capabilitiesFor: () => ({ granted: mocks.granted }),
  }),
}));
vi.mock('@/features/requests/request-service', () => ({
  getRequest: mocks.getRequest,
  listInformationAssets: mocks.listInformationAssets,
  listInformationSystems: mocks.listInformationSystems,
}));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({
  getQuestionnaire: mocks.getQuestionnaire,
  getQuestionnaireGovernanceQuestions: mocks.getQuestionnaireGovernanceQuestions,
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  getRequestGenerationJobs: mocks.getRequestGenerationJobs,
  listControlImplementations: mocks.listControlImplementations,
  listControls: mocks.listControls,
  listRiskTypes: mocks.listRiskTypes,
}));
vi.mock('@/features/requests/request-actions', () => ({ revertRequestToDraftAction: vi.fn() }));
// Phase 16 (16-14): the assessment page's AI proposals read; the gate refuses before any read, so it is never reached then.
vi.mock('@/features/risk-curation/risk-curation-service', () => ({ listRiskAiProposals: vi.fn(async () => ({ data: null, error: { status: 503 } })) }));
vi.mock('@/features/questionnaire-ai/questionnaire-ai-service', () => ({ listQuestionnaireAiProposals: vi.fn(async () => ({ data: null, error: { status: 503 } })) }));
vi.mock('@/features/questionnaire-ai/questionnaire-ai-actions', () => ({ getQuestionnaireProposalJobAction: vi.fn(), retryQuestionnaireProposalJobAction: vi.fn(), startQuestionnaireAiProposalsAction: vi.fn() }));
vi.mock('@/features/questionnaires/questionnaire-actions', () => ({
  addQuestionnaireQuestionAction: vi.fn(),
  deleteQuestionnaireQuestionAction: vi.fn(),
  editQuestionnaireQuestionAction: vi.fn(),
  releaseQuestionnaireAction: vi.fn(),
  returnQuestionnaireToAnalystReviewAction: vi.fn(),
  revertQuestionnaireToDraftAction: vi.fn(),
  saveQuestionnaireDraftAction: vi.fn(),
  submitQuestionnaireAction: vi.fn(),
}));
vi.mock('@/features/assessments/assessment-actions', () => ({
  createControlImplementationAction: vi.fn(),
  createRiskAction: vi.fn(),
  deleteControlImplementationAction: vi.fn(),
  getAssessmentDraftJobAction: vi.fn(),
  getQuestionnaireGenerationJobAction: vi.fn(),
  getRequestGenerationJobsAction: vi.fn(),
  refreshAnalystAssessmentAction: vi.fn(),
  releaseAssessmentAction: vi.fn(),
  retryAssessmentDraftJobAction: vi.fn(),
  retryQuestionnaireGenerationJobAction: vi.fn(),
  saveAssessmentAction: vi.fn(),
  searchActiveUsersAction: vi.fn(),
  startAssessmentDraftAction: vi.fn(),
  startQuestionnaireGenerationAction: vi.fn(),
  updateControlImplementationAction: vi.fn(),
  updateRiskAction: vi.fn(),
}));

import {
  AssessmentEditorContent,
  generateMetadata as assessmentRouteMetadata,
} from '../../../app/(app)/app/review/assessments/[documentId]/page';
import QuestionnaireReviewPage, {
  generateMetadata as questionnaireRouteMetadata,
} from '../../../app/(app)/app/review/questionnaires/[documentId]/page';
import {
  AssessmentRequestDetailContent,
  generateMetadata as requestRouteMetadata,
} from '../../../app/(app)/app/review/requests/[documentId]/page';

const props = () => ({ params: Promise.resolve({ documentId: 'record-under-test' }) });

const requestorCapabilities = new Set(['assessment-request:read', 'assessment-request:create']);
const analystCapabilities = new Set(['assessment-request:read', 'assessment-request:create', 'assessment:review', 'risk:manage']);

function signInAsRequestor() {
  mocks.current.mockResolvedValue({ displayName: 'Jane Doe' });
  mocks.granted.mockResolvedValue(requestorCapabilities);
}

function signInAsAnalyst() {
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.granted.mockResolvedValue(analystCapabilities);
}

function expectNoLinkIntoAnalystRoutes() {
  for (const link of screen.queryAllByRole('link')) expect(link.getAttribute('href') ?? '').not.toMatch(/^\/app\/review(\/|$)/);
}

const submittedRequest = {
  documentId: 'record-under-test',
  requestNumber: 'RAR-0043',
  title: 'Vendor onboarding review',
  description: 'Submitted request awaiting a questionnaire.',
  requestStatus: 'submitted' as const,
  submittedDate: '2026-08-30T01:00:00.000Z',
  dueDate: null,
  updatedAt: null,
  dueDateLabel: null,
  updatedDateLabel: null,
  informationSystems: [],
  informationAssets: [],
  questionnaire: null,
  assessment: null,
  relationships: {
    questionnaire: { availability: 'absent' as const },
    assessment: { availability: 'absent' as const },
  },
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  // The Requestor's own request: Strapi would let her read it, which is why the gate must come first.
  mocks.getRequest.mockResolvedValue({ data: submittedRequest, error: null });
  const refused = { data: null, error: { status: 403, message: 'Refused' } };
  mocks.getQuestionnaire.mockResolvedValue(refused);
  mocks.getQuestionnaireGovernanceQuestions.mockResolvedValue(refused);
  mocks.getAnalystAssessment.mockResolvedValue(refused);
  mocks.getRequestGenerationJobs.mockResolvedValue({ data: { questionnaireGeneration: null, assessmentDraft: null }, error: null });
  for (const list of [mocks.listControlImplementations, mocks.listControls, mocks.listInformationAssets, mocks.listInformationSystems, mocks.listRiskTypes]) {
    list.mockResolvedValue({ data: [], error: null });
  }
});

function expectNoRecordRead() {
  for (const read of recordReads) expect(mocks[read], `${read} must not run for a refused viewer`).not.toHaveBeenCalled();
}

describe('the analyst request route', () => {
  it('refuses a Requestor before reading the request and sends her to her own requests', async () => {
    signInAsRequestor();

    render(await AssessmentRequestDetailContent(props()));

    // IN-405: no record read at all, as on the questionnaire and assessment routes.
    expectNoRecordRead();
    expect(screen.getByRole('heading', { level: 1, name: 'Assessment request review' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this request');
    expect(screen.getByRole('alert')).toHaveTextContent('Reviewing requests is for Security Analysts. Your own requests are in My requests.');
    expect(screen.getByRole('link', { name: 'Go to My requests' })).toHaveAttribute('href', '/app/requests');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expectNoLinkIntoAnalystRoutes();
  });

  it('gives a Requestor the static title without reading the request', async () => {
    signInAsRequestor();

    await expect(requestRouteMetadata(props())).resolves.toEqual({ title: 'Assessment Request Review | IdamBox CSRM' });
    expect(mocks.getRequest).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('treats a viewer with no session as a Requestor', async () => {
    mocks.current.mockResolvedValue(null);

    render(await AssessmentRequestDetailContent(props()));
    await expect(requestRouteMetadata(props())).resolves.toEqual({ title: 'Assessment Request Review | IdamBox CSRM' });

    expect(mocks.granted).not.toHaveBeenCalled();
    expect(mocks.getRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Go to My requests' })).toHaveAttribute('href', '/app/requests');
  });

  it('reads the request once for an analyst and renders it as before', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: submittedRequest, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getRequest).toHaveBeenCalledTimes(1);
    expect(mocks.getRequest).toHaveBeenCalledWith('record-under-test');
    expect(screen.getByRole('heading', { level: 1, name: 'Vendor onboarding review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to My requests' })).not.toBeInTheDocument();
  });

  /*
   * UAT-019 (D-08, D-16): the Replace confirmation states how many analyst changes it discards, read from
   * the analyst questionnaire summary on the server, so the client card receives a number and no schema.
   */
  const requestInAnalystReview = {
    ...submittedRequest,
    questionnaire: { documentId: 'questionnaire-under-review', title: 'Vendor questionnaire' },
    relationships: {
      questionnaire: { availability: 'available' as const, documentId: 'questionnaire-under-review', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Vendor questionnaire', state: 'analyst-review' },
      assessment: { availability: 'absent' as const },
    },
  };

  /* Phase 15 (15-UI-SPEC §8.3; D-09; U3): the count decides whether a replacement is offered at all. */
  it('reads the questionnaire summary for the change count, and offers no Replace once analysts changed it', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: requestInAnalystReview, error: null });
    mocks.getQuestionnaire.mockResolvedValue({ data: { documentId: 'questionnaire-under-review', revision: { eventCount: 3, lastEventAt: '2026-09-03T00:00:00.000Z', analystChangesSinceGeneration: 2 } }, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getQuestionnaire).toHaveBeenCalledWith('questionnaire-under-review');
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.getByText('Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.')).toBeInTheDocument();
  });

  it('offers no Replace when the questionnaire summary cannot be read', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: requestInAnalystReview, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
  });

  /*
   * UAT-041 (D-26, D-47): after the gate and the request read, the page reads the request's generation jobs
   * and seeds the hub, so an analyst who comes back mid-generation sees the job instead of a second Generate.
   */
  it('reads the request generation jobs after the request and shows a running job in place of Generate', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: submittedRequest, error: null });
    const running = { jobId: 'generation-job', requestId: 'record-under-test', providerName: 'Context provider', providerVersion: '1.0', attempt: 1, queuedAt: '2026-09-03T00:00:00.000Z', status: 'running' as const, startedAt: '2026-09-03T00:00:01.000Z' };
    mocks.getRequestGenerationJobs.mockResolvedValue({ data: { questionnaireGeneration: { job: running, canRetry: true }, assessmentDraft: null }, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getRequestGenerationJobs).toHaveBeenCalledTimes(1);
    expect(mocks.getRequestGenerationJobs).toHaveBeenCalledWith('record-under-test');
    expect(mocks.getRequest.mock.invocationCallOrder[0]).toBeLessThan(mocks.getRequestGenerationJobs.mock.invocationCallOrder[0]);
    expect(screen.getByText('Questionnaire generation is running', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('You can leave this page. The status shows here when you come back.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
  });

  /* Phase 15 (15-UI-SPEC §12; D-32): a requesting analyst generates without an instruction, before any questionnaire exists. */
  it('gives a requesting analyst §12’s caption and no instruction field before the questionnaire exists', async () => {
    signInAsAnalyst();
    const viewer = { documentId: 'bob-id', displayName: 'Bob Doe' };
    mocks.getRequest.mockResolvedValue({ data: { ...submittedRequest, assignment: { assignee: null, assignedBy: null, assignedAt: null, actions: [], ownRequest: true, history: [], viewer } }, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(screen.getByText('You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).not.toBeInTheDocument();
  });

  it('does not read the generation jobs when Strapi refuses an analyst the request', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: null, error: { status: 403, message: 'Refused' } });

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getRequestGenerationJobs).not.toHaveBeenCalled();
  });

  it('renders the record variant when Strapi refuses an analyst the request', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: null, error: { status: 403, message: 'Refused' } });

    render(await AssessmentRequestDetailContent(props()));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this request');
    expect(screen.getByRole('alert')).toHaveTextContent('You can’t review this request with your current access. Choose another from the assessment requests.');
    expect(screen.getByRole('link', { name: 'Back to assessment requests' })).toHaveAttribute('href', '/app/review/requests');
    expect(screen.queryByRole('link', { name: 'Go to My requests' })).not.toBeInTheDocument();
  });
});

describe('the analyst questionnaire review route', () => {
  it('refuses a Requestor before reading the questionnaire and sends her to her own questionnaires', async () => {
    signInAsRequestor();

    render(await QuestionnaireReviewPage(props()));

    expectNoRecordRead();
    expect(screen.getByRole('heading', { level: 1, name: 'Questionnaire review' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this questionnaire');
    expect(screen.getByRole('alert')).toHaveTextContent('Reviewing questionnaires is for Security Analysts. To answer a questionnaire sent to you, open it from My questionnaires.');
    expect(screen.getByRole('link', { name: 'Go to My questionnaires' })).toHaveAttribute('href', '/app/questionnaires');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expectNoLinkIntoAnalystRoutes();
  });

  it('gives a Requestor, or a viewer with no session, the static title without a read', async () => {
    signInAsRequestor();
    await expect(questionnaireRouteMetadata(props())).resolves.toEqual({ title: 'Questionnaire Review | IdamBox CSRM' });
    mocks.current.mockResolvedValue(null);
    await expect(questionnaireRouteMetadata(props())).resolves.toEqual({ title: 'Questionnaire Review | IdamBox CSRM' });

    expectNoRecordRead();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('renders the record variant when Strapi refuses an analyst the questionnaire', async () => {
    signInAsAnalyst();

    render(await QuestionnaireReviewPage(props()));

    expect(mocks.getQuestionnaire).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this questionnaire');
    expect(screen.getByRole('alert')).toHaveTextContent('You can’t review this questionnaire with your current access. Choose another from the questionnaire reviews.');
    expect(screen.getByRole('link', { name: 'Back to questionnaire reviews' })).toHaveAttribute('href', '/app/review/questionnaires');
    expect(screen.queryByRole('link', { name: 'Go to My questionnaires' })).not.toBeInTheDocument();
  });
});

describe('the analyst assessment review route', () => {
  it('refuses a Requestor before any read and sends her to her released assessments', async () => {
    signInAsRequestor();

    render(await AssessmentEditorContent(props()));

    expectNoRecordRead();
    expect(screen.getByRole('heading', { level: 1, name: 'Risk assessment review' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this assessment');
    expect(screen.getByRole('alert')).toHaveTextContent('Reviewing assessments is for Security Analysts. Assessments released to you are in My risk assessments.');
    expect(screen.getByRole('link', { name: 'Go to My risk assessments' })).toHaveAttribute('href', '/app/assessments');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expectNoLinkIntoAnalystRoutes();
  });

  it('gives a Requestor, or a viewer with no session, the static title without a read', async () => {
    signInAsRequestor();
    await expect(assessmentRouteMetadata(props())).resolves.toEqual({ title: 'Risk Assessment Review | IdamBox CSRM' });
    mocks.current.mockResolvedValue(null);
    await expect(assessmentRouteMetadata(props())).resolves.toEqual({ title: 'Risk Assessment Review | IdamBox CSRM' });

    expectNoRecordRead();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('renders the record variant with a way back when Strapi refuses an analyst the assessment', async () => {
    signInAsAnalyst();

    render(await AssessmentEditorContent(props()));

    expect(mocks.getAnalystAssessment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this assessment');
    expect(screen.getByRole('alert')).toHaveTextContent('You can’t review this assessment with your current access. Choose another from the risk assessments.');
    expect(screen.getByRole('link', { name: 'Back to risk assessments' })).toHaveAttribute('href', '/app/review/assessments');
    expect(screen.queryByRole('link', { name: 'Go to My risk assessments' })).not.toBeInTheDocument();
  });
});
