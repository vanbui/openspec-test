import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Suspense, use, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('bounded deterministic draft job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('prevents duplicate generation while the start request is in flight', () => {
    const pending = deferred<never>();
    actionMocks.startAssessmentDraftAction.mockReturnValue(pending.promise);
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" />);

    const start = screen.getByRole('button', { name: 'Start deterministic draft assistance' });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(actionMocks.startAssessmentDraftAction).toHaveBeenCalledTimes(1);
    expect(start).toBeDisabled();
  });

  it('keeps one poll in flight and cleans up on unmount', async () => {
    const pending = deferred<never>();
    actionMocks.getAssessmentDraftJobAction.mockReturnValue(pending.promise);
    const { unmount } = render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" />);

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
    render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft assistance is running');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft assistance is ready for analyst review');
    expect(screen.getByRole('list', { name: 'Draft assistance lifecycle' })).toHaveTextContent('QueuedRunningCompleted');
    expect(screen.getByRole('link', { name: 'Open completed assessment' })).toHaveAttribute(
      'href',
      '/app/review/assessments/assessment%2Fid%20with%20spaces',
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(2);
  });

  it('offers retry only for failed jobs and resumes the same bounded lifecycle', async () => {
    actionMocks.retryAssessmentDraftJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    const { rerender } = render(<AssessmentDraftJob initialJob={runningJob} questionnaireId="questionnaire/id" />);
    expect(screen.queryByRole('button', { name: 'Retry draft assistance' })).not.toBeInTheDocument();

    rerender(<AssessmentDraftJob initialJob={failedJob} questionnaireId="questionnaire/id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft assistance' }));
    await vi.runAllTicks();
    expect(actionMocks.retryAssessmentDraftJobAction).toHaveBeenCalledWith({ jobId: 'job/id' });
  });

  it('stops after the 30-second budget with recoverable timeout guidance', async () => {
    actionMocks.getAssessmentDraftJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<AssessmentDraftJob initialJob={queuedJob} questionnaireId="questionnaire/id" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    const pollCount = actionMocks.getAssessmentDraftJobAction.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(pollCount);
  });
});
