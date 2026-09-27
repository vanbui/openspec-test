import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Suspense, use, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssessmentRequestQueueItem, AssessmentSummary } from './assessment-schema';

const actionMocks = vi.hoisted(() => ({
  startAssessmentDraftAction: vi.fn(),
  getAssessmentDraftJobAction: vi.fn(),
  retryAssessmentDraftJobAction: vi.fn(),
}));
vi.mock('./assessment-actions', () => actionMocks);
vi.mock('@/features/requests/request-actions', () => ({ revertRequestToDraftAction: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/app/review/assessments', useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));

import {
  AssessmentRequestList,
  AssessmentRequestListSkeleton,
  AssessmentList,
  AssessmentListSkeleton,
} from './assessment-list';
import { AssessmentDetail, AssessmentDetailSkeleton } from './assessment-detail';
import { AssessmentDraftJob } from './assessment-draft-job';

const request: AssessmentRequestQueueItem = {
  documentId: 'request/id with spaces',
  requestNumber: 'RAR-0042',
  title: 'Customer portal review',
  requestStatus: 'submitted',
  submittedDate: '2026-08-30T01:00:00.000Z',
};

const assessment: AssessmentSummary = {
  documentId: 'assessment/id with spaces',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'draft',
  summary: 'Reviewable deterministic draft.',
  overallRating: 'High',
  generatedDate: '2026-08-30T01:01:00.000Z',
  generatedBy: { documentId: 'bob-id', displayName: 'Bob Doe' },
  approvalDate: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

async function renderSuspended(node: ReactNode, fallback: ReactNode) {
  await act(async () => { render(<Suspense fallback={fallback}>{node}</Suspense>); });
}

function DeferredView<T>({ promise, children }: { promise: Promise<T>; children: (value: T) => ReactNode }) {
  return children(use(promise));
}

describe('analyst review Server Component boundaries', () => {
  it('shows the request queue skeleton before its deferred read resolves', async () => {
    const result = deferred<readonly AssessmentRequestQueueItem[]>();

    await renderSuspended(<DeferredView promise={result.promise}>{(requests) => <AssessmentRequestList requests={requests} />}</DeferredView>, <AssessmentRequestListSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading assessment requests for review' })).toBeInTheDocument();
    await act(async () => { result.resolve([request]); await result.promise; });
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading assessment requests for review' })).not.toBeInTheDocument());
    expect(screen.getAllByText('RAR-0042').length).toBeGreaterThan(0);
  });

  it('shows the request detail skeleton before its deferred read resolves', async () => {
    const result = deferred<'permission'>();

    await renderSuspended(
      <DeferredView promise={result.promise}>{(state) => <AssessmentDetail state={state} />}</DeferredView>,
      <AssessmentDetailSkeleton />,
    );
    expect(screen.getByRole('status', { name: 'Loading assessment request review' })).toBeInTheDocument();
    await act(async () => { result.resolve('permission'); await result.promise; });
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading assessment request review' })).not.toBeInTheDocument());
    expect(screen.getByText(/permission/i)).toBeInTheDocument();
  });

  it('shows the assessment list skeleton before its deferred read resolves', async () => {
    const result = deferred<readonly AssessmentSummary[]>();

    await renderSuspended(<DeferredView promise={result.promise}>{(assessments) => <AssessmentList assessments={assessments} />}</DeferredView>, <AssessmentListSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading risk assessments for review' })).toBeInTheDocument();
    await act(async () => { result.resolve([assessment]); await result.promise; });
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading risk assessments for review' })).not.toBeInTheDocument());
    expect(screen.getAllByText('ASM-0042').length).toBeGreaterThan(0);
  });

  it('keeps all three route shells synchronous with explicit Suspense fallbacks', () => {
    const routes = [
      'app/(app)/app/review/requests/page.tsx',
      'app/(app)/app/review/requests/[documentId]/page.tsx',
      'app/(app)/app/review/assessments/page.tsx',
    ].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'));
    for (const route of routes) {
      expect(route).toContain('<Suspense fallback=');
      expect(route).toMatch(/export default function/);
      expect(route).not.toMatch(/export default async function/);
    }
  });
});

describe('analyst review presentations', () => {
  it('renders deliberate queue states and responsive populated layouts', () => {
    const { rerender } = render(<AssessmentRequestList requests={[]} />);
    expect(screen.getByRole('heading', { name: 'No assessment requests yet' })).toBeInTheDocument();

    rerender(<AssessmentRequestList requests={[]} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to assessment requests');

    rerender(<AssessmentRequestList requests={[]} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');

    rerender(<AssessmentRequestList requests={[request]} />);
    expect(document.querySelector('[data-slot="data-table-mobile"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-desktop"]')).toBeInTheDocument();
  });

  it('renders deliberate assessment states and encoded editor navigation', () => {
    const { rerender } = render(<AssessmentList assessments={[]} />);
    expect(screen.getByRole('heading', { name: 'No risk assessments yet' })).toBeInTheDocument();

    rerender(<AssessmentList assessments={[]} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to risk assessments');

    rerender(<AssessmentList assessments={[]} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');

    rerender(<AssessmentList assessments={[assessment]} />);
    expect(screen.getAllByRole('link', { name: 'ASM-0042' })[0]).toHaveAttribute(
      'href',
      '/app/review/assessments/assessment%2Fid%20with%20spaces',
    );
  });

  it('renders submitted request detail, shared questionnaire navigation, and safe failures', () => {
    const detail = {
      documentId: 'request-1',
      requestNumber: 'RAR-0042',
      title: 'Customer portal review',
      description: 'Submitted request context.',
      requestStatus: 'submitted' as const,
      submittedDate: '2026-08-30T01:00:00.000Z',
      dueDate: null,
      updatedAt: null,
      dueDateLabel: null,
      updatedDateLabel: null,
      informationSystems: [],
      informationAssets: [],
      questionnaire: { documentId: 'questionnaire/id', title: 'Portal questionnaire' },
      assessment: null,
      // The server sends the relationships on every authorised detail read, so
      // the fixture carries them and the hub is what states the questionnaire.
      relationships: {
        questionnaire: { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: null, title: 'Portal questionnaire', state: 'submitted' },
        assessment: { availability: 'absent' as const },
      },
    };
    const { rerender } = render(<AssessmentDetail request={detail} state="populated" />);
    expect(screen.getByRole('link', { name: 'Portal questionnaire' })).toHaveAttribute(
      'href',
      '/app/review/questionnaires/questionnaire%2Fid',
    );

    rerender(<AssessmentDetail state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('permission');

    rerender(<AssessmentDetail state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');
  });

  /*
   * A submitted request with no questionnaire is the only state a reversal is
   * allowed from, so the analyst must still see the request and the action.
   * Treating a missing questionnaire as an empty screen hid both.
   */
  it('offers the analyst reversal on a submitted request that has no questionnaire yet', () => {
    const detail = {
      documentId: 'request-2',
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
    render(<AssessmentDetail request={detail} state="populated" />);

    expect(screen.getAllByText('RAR-0043').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Return to draft' })).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('No questionnaire is linked to this request.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /questionnaire/i })).not.toBeInTheDocument();
  });

  it('withholds the analyst reversal once the request is no longer submitted', () => {
    const detail = {
      documentId: 'request-3',
      requestNumber: 'RAR-0044',
      title: 'Reverted vendor review',
      description: 'Already returned to draft.',
      requestStatus: 'draft' as const,
      submittedDate: null,
      dueDate: null,
      updatedAt: null,
      dueDateLabel: null,
      updatedDateLabel: null,
      informationSystems: [],
      informationAssets: [],
      questionnaire: null,
      assessment: null,
      revertReason: 'Business unit was wrong.',
      revertedAt: '2026-09-03T04:55:00.000Z',
      revertedBy: { documentId: 'user-bob', displayName: 'Bob Doe' },
    };
    render(<AssessmentDetail request={detail} state="populated" />);

    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    expect(screen.getByText('Business unit was wrong.')).toBeInTheDocument();
    expect(screen.getByText('Bob Doe')).toBeInTheDocument();
  });
});

/*
 * WR-06: draft generation needs the linked questionnaire's submitted answers, so the draft card offers no
 * action until the questionnaire is submitted and says so in the draft generation vocabulary (D-08). Strapi
 * still refuses an early start with 409; this is what the card shows.
 */
describe('draft generation before the questionnaire is submitted', () => {
  const precondition = 'Draft generation can begin only after the linked questionnaire is submitted.';

  function requestWithQuestionnaire(state: string) {
    return {
      documentId: 'request-4',
      requestNumber: 'RAR-0045',
      title: 'Payments platform review',
      description: 'Submitted request with a linked questionnaire.',
      requestStatus: 'questionnaire-in-progress' as const,
      submittedDate: '2026-08-30T01:00:00.000Z',
      dueDate: null,
      updatedAt: null,
      dueDateLabel: null,
      updatedDateLabel: null,
      informationSystems: [],
      informationAssets: [],
      questionnaire: { documentId: 'questionnaire/id', title: 'Payments questionnaire' },
      assessment: null,
      relationships: {
        questionnaire: { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: 'QNR-2026-000001', title: 'Payments questionnaire', state },
        assessment: { availability: 'absent' as const },
      },
    };
  }

  function draftCard() {
    const card = screen.getByRole('heading', { level: 2, name: 'Assessment draft generation' }).closest<HTMLElement>('[data-slot="card"]');
    expect(card).not.toBeNull();
    return card!;
  }

  it.each(['analyst-review', 'released'])('withholds the action while the linked questionnaire is %s, and says why', (state) => {
    render(<AssessmentDetail request={requestWithQuestionnaire(state)} state="populated" />);

    expect(within(draftCard()).getByText(precondition)).toBeInTheDocument();
    expect(within(draftCard()).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate assessment draft' })).not.toBeInTheDocument();
  });

  it('offers the action once the linked questionnaire is submitted', () => {
    render(<AssessmentDetail request={requestWithQuestionnaire('submitted')} state="populated" />);

    expect(within(draftCard()).getByRole('button', { name: 'Generate assessment draft' })).toBeEnabled();
    expect(screen.queryByText(precondition)).not.toBeInTheDocument();
  });

  it('keeps the draft generation action off paper while its advisory copy prints (X-4, W-14)', () => {
    render(<AssessmentDetail request={requestWithQuestionnaire('submitted')} state="populated" />);

    expect(within(draftCard()).getByRole('button', { name: 'Generate assessment draft' })).toHaveAttribute('data-print', 'hidden');
    expect(within(draftCard()).getByText(/The draft is advisory/).closest('[data-print="hidden"]')).toBeNull();
  });

  /*
   * W-1: a request has at most one assessment, and Strapi refuses a second draft (409). Once one exists,
   * released or not, and whether or not this actor may open it, the card offers nothing to generate.
   */
  it.each([
    ['released', { availability: 'available' as const, documentId: 'assessment-1', assessmentNumber: 'ASM-2026-33SAEN', assessmentStatus: 'approved', residualRiskCounts: { Low: 0, Moderate: 1, High: 0, Critical: 0, total: 1 } }],
    ['in draft', { availability: 'available' as const, documentId: 'assessment-2', assessmentNumber: 'ASM-2026-MWQA7E', assessmentStatus: 'draft', residualRiskCounts: { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 } }],
    ['not openable', { availability: 'unavailable' as const }],
  ])('offers no draft generation once the request has an assessment %s', (_label, assessment) => {
    const request = requestWithQuestionnaire('submitted');
    render(<AssessmentDetail request={{ ...request, requestStatus: 'approved', relationships: { ...request.relationships, assessment } }} state="populated" />);

    expect(screen.queryByRole('heading', { name: 'Assessment draft generation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate assessment draft' })).not.toBeInTheDocument();
  });

  /*
   * Starting a draft revalidates the review pages, so the server re-renders this page while the card is
   * on screen, and with an in-process provider the new assessment already exists by then. The card of
   * the session that generated the draft must survive that re-render with its state and its link.
   */
  it('keeps the generating session\'s card and its link when the page re-renders with the new assessment', async () => {
    actionMocks.startAssessmentDraftAction.mockResolvedValueOnce({ ok: true, data: completedJob });
    const request = requestWithQuestionnaire('submitted');
    const view = render(<AssessmentDetail request={request} state="populated" />);

    fireEvent.click(within(draftCard()).getByRole('button', { name: 'Generate assessment draft' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Open assessment draft' })).toBeInTheDocument());

    const assessment = { availability: 'available' as const, documentId: 'assessment/id with spaces', assessmentNumber: 'ASM-2026-MWQA7E', assessmentStatus: 'draft', residualRiskCounts: { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 } };
    view.rerender(<AssessmentDetail request={{ ...request, requestStatus: 'risk-assessment-drafted', relationships: { ...request.relationships, assessment } }} state="populated" />);

    expect(screen.getByRole('link', { name: 'Open assessment draft' })).toBeInTheDocument();
    // The state line and its live announcement both carry the ready text.
    expect(within(draftCard()).getAllByText('Draft generation is ready for Security Analyst review').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Generate assessment draft' })).not.toBeInTheDocument();
  });

  it('keeps the review empty state in the draft generation vocabulary', () => {
    render(<AssessmentDetail state="populated" />);

    expect(screen.getByText(precondition)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/assistance/i);
  });
});

const queuedJob = {
  jobId: 'job/id',
  questionnaireId: 'questionnaire/id',
  attempt: 1,
  queuedAt: '2026-08-30T01:00:00.000Z',
  status: 'queued' as const,
};
const runningJob = {
  ...queuedJob,
  status: 'running' as const,
  startedAt: '2026-08-30T01:00:01.000Z',
};
const completedJob = {
  ...runningJob,
  status: 'completed' as const,
  completedAt: '2026-08-30T01:00:02.000Z',
  assessmentId: 'assessment/id with spaces',
};
const failedJob = {
  ...runningJob,
  status: 'failed' as const,
  completedAt: '2026-08-30T01:00:02.000Z',
  failureCode: 'provider-failed',
  failureMessage: 'Draft assistance could not be prepared.',
};

/**
 * The card's own copy names neither a provider nor the old "assistance" framing (D-08). Text a server
 * supplies, such as a failure message, is data and passes through verbatim, so it is excluded.
 */
function expectProviderNeutralCopy(container: HTMLElement, serverText: readonly string[] = []) {
  const labels = [...container.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label') ?? '');
  let copy = [container.textContent ?? '', ...labels].join('\n');
  for (const fragment of serverText) copy = copy.split(fragment).join('');
  expect(copy).not.toMatch(/deterministic|assistance/i);
}

describe('bounded assessment draft generation job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('prevents duplicate generation while the start request is in flight', () => {
    const pending = deferred<never>();
    actionMocks.startAssessmentDraftAction.mockReturnValue(pending.promise);
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted />);

    const start = screen.getByRole('button', { name: 'Generate assessment draft' });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(actionMocks.startAssessmentDraftAction).toHaveBeenCalledTimes(1);
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Starting draft generation…');
  });

  it('describes the action, the reviewing Security Analyst and the advisory draft before generation', () => {
    const { container } = render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('heading', { level: 2, name: 'Assessment draft generation' })).toBeInTheDocument();
    expect(screen.getByText('Generate a draft Risk Assessment from the submitted questionnaire. The draft is advisory: it is recorded as initiated by you and is released only by a Security Analyst after review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate assessment draft' })).toBeEnabled();
    expectProviderNeutralCopy(container);
  });

  it.each([
    ['queued', queuedJob, 'Draft generation is queued', 'The job is waiting to begin. This page will remain available while its status is checked.'],
    ['running', runningJob, 'Draft generation is running', 'A reviewable draft is being prepared from the questionnaire answers.'],
    ['completed', completedJob, 'Draft generation is ready for Security Analyst review', 'The generated draft is advisory and has not been released.'],
  ] as const)('keeps the %s state advisory and provider-neutral', (_status, job, title, body) => {
    const { container } = render(<AssessmentDraftJob initialJob={job} questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('status')).toHaveTextContent(title);
    expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Draft generation lifecycle' })).toBeInTheDocument();
    expectProviderNeutralCopy(container);
  });

  it('names a failed generation without claiming a provider, passing the server message through', () => {
    const { container } = render(<AssessmentDraftJob initialJob={failedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('status')).toHaveTextContent('Draft generation failed');
    expect(screen.getByText('Draft generation failed', { selector: '[data-slot="alert-title"]' })).toBeInTheDocument();
    expect(screen.getByText(failedJob.failureMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry draft generation' })).toBeEnabled();
    expectProviderNeutralCopy(container, [failedJob.failureMessage]);
  });

  it('announces start, status and retry failures in the draft generation vocabulary', async () => {
    actionMocks.startAssessmentDraftAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable.' });
    const idle = render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate assessment draft' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation could not be started');
    idle.unmount();

    actionMocks.getAssessmentDraftJobAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable.' });
    const polling = render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation status could not be checked');
    polling.unmount();

    const pendingRetry = deferred<{ ok: false; formError: string }>();
    actionMocks.retryAssessmentDraftJobAction.mockReturnValueOnce(pendingRetry.promise);
    const { container } = render(<AssessmentDraftJob initialJob={failedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft generation' }));
    expect(screen.getByRole('button', { name: 'Retrying draft generation…' })).toBeDisabled();
    await act(async () => { pendingRetry.resolve({ ok: false, formError: 'The assessment service is unavailable.' }); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation could not be retried');
    expectProviderNeutralCopy(container, [failedJob.failureMessage]);
  });

  it('keeps one poll in flight and cleans up on unmount', async () => {
    const pending = deferred<never>();
    actionMocks.getAssessmentDraftJobAction.mockReturnValue(pending.promise);
    const { unmount } = render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(1);
  });

  it('announces meaningful transitions and stops at completion', async () => {
    actionMocks.getAssessmentDraftJobAction
      .mockResolvedValueOnce({ ok: true, data: runningJob })
      .mockResolvedValueOnce({ ok: true, data: completedJob });
    render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation is running');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation is ready for Security Analyst review');
    expect(screen.getByRole('list', { name: 'Draft generation lifecycle' })).toHaveTextContent('QueuedRunningCompleted');
    // A completed draft is still a draft: the link opens it for review and never calls it complete.
    expect(screen.queryByRole('link', { name: 'Open completed assessment' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open assessment draft' })).toHaveAttribute(
      'href',
      '/app/review/assessments/assessment%2Fid%20with%20spaces',
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(2);
  });

  it('offers retry only for failed jobs and resumes the same bounded lifecycle', async () => {
    actionMocks.retryAssessmentDraftJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    const { rerender } = render(<AssessmentDraftJob initialJob={runningJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);
    expect(screen.queryByRole('button', { name: 'Retry draft generation' })).not.toBeInTheDocument();

    rerender(<AssessmentDraftJob initialJob={failedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft generation' }));
    await vi.runAllTicks();
    expect(actionMocks.retryAssessmentDraftJobAction).toHaveBeenCalledWith({ jobId: 'job/id' });
  });

  it('stops after the 30-second budget with recoverable timeout guidance', async () => {
    actionMocks.getAssessmentDraftJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" questionnaireSubmitted />);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation polling timed out');
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    const pollCount = actionMocks.getAssessmentDraftJobAction.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(pollCount);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checking the current draft generation status');
  });
});
