import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
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
  getRequest: vi.fn(),
  granted: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
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
vi.mock('@/features/requests/request-service', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/features/requests/request-actions', () => ({ revertRequestToDraftAction: vi.fn() }));
vi.mock('./assessment-actions', () => ({
  getAssessmentDraftJobAction: vi.fn(),
  getQuestionnaireGenerationJobAction: vi.fn(),
  retryAssessmentDraftJobAction: vi.fn(),
  retryQuestionnaireGenerationJobAction: vi.fn(),
  startAssessmentDraftAction: vi.fn(),
  startQuestionnaireGenerationAction: vi.fn(),
}));

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
});

describe('the analyst request route', () => {
  it('refuses a Requestor before reading the request and sends her to her own requests', async () => {
    signInAsRequestor();

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Assessment request review' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this request');
    expect(screen.getByRole('alert')).toHaveTextContent('Reviewing requests is for Security Analysts. Your own requests are in My Requests.');
    expect(screen.getByRole('link', { name: 'Go to My Requests' })).toHaveAttribute('href', '/app/requests');
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
    expect(screen.getByRole('link', { name: 'Go to My Requests' })).toHaveAttribute('href', '/app/requests');
  });

  it('reads the request once for an analyst and renders it as before', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: submittedRequest, error: null });

    render(await AssessmentRequestDetailContent(props()));

    expect(mocks.getRequest).toHaveBeenCalledTimes(1);
    expect(mocks.getRequest).toHaveBeenCalledWith('record-under-test');
    expect(screen.getByRole('heading', { level: 1, name: 'Vendor onboarding review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to My Requests' })).not.toBeInTheDocument();
  });

  it('renders the record variant when Strapi refuses an analyst the request', async () => {
    signInAsAnalyst();
    mocks.getRequest.mockResolvedValue({ data: null, error: { status: 403, message: 'Refused' } });

    render(await AssessmentRequestDetailContent(props()));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this request');
    expect(screen.getByRole('alert')).toHaveTextContent('You can’t review this request with your current access. Choose another from the assessment requests.');
    expect(screen.getByRole('link', { name: 'Back to assessment requests' })).toHaveAttribute('href', '/app/review/requests');
    expect(screen.queryByRole('link', { name: 'Go to My Requests' })).not.toBeInTheDocument();
  });
});
