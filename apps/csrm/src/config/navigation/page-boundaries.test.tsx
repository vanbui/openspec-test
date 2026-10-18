import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState, type ComponentType } from 'react';
import { ErrorBoundaryHandler } from 'next/dist/client/components/error-boundary';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import AssessmentsError from '../../../app/(app)/app/assessments/error';
import AssessmentsLoading from '../../../app/(app)/app/assessments/loading';
import QuestionnairesError from '../../../app/(app)/app/questionnaires/error';
import QuestionnairesLoading from '../../../app/(app)/app/questionnaires/loading';
import NewRequestLoading from '../../../app/(app)/app/requests/new/loading';
import RequestsError from '../../../app/(app)/app/requests/error';
import RequestsLoading from '../../../app/(app)/app/requests/(my-requests)/loading';
import AssessmentReviewsError from '../../../app/(app)/app/review/assessments/error';
import AssessmentReviewsLoading from '../../../app/(app)/app/review/assessments/loading';
import QuestionnaireReviewsError from '../../../app/(app)/app/review/questionnaires/error';
import QuestionnaireReviewsLoading from '../../../app/(app)/app/review/questionnaires/loading';
import AssignedRequestsError from '../../../app/(app)/app/review/assigned/error';
import AssignedRequestsLoading from '../../../app/(app)/app/review/assigned/loading';
import AssessmentRequestsError from '../../../app/(app)/app/review/requests/error';
import AssessmentRequestsLoading from '../../../app/(app)/app/review/requests/loading';
import RisksError from '../../../app/(app)/app/risks/error';
import RisksLoading from '../../../app/(app)/app/risks/(register)/loading';

/*
 * UI-SPEC §2.1: a route's loading and error boundaries repeat its page header, so they carry the
 * heading the navigation label names (D-09). The expected headings are the contract's literals.
 */
const errorProps = { error: Object.assign(new Error('boom'), { digest: 'd' }), reset: () => undefined, retry: () => undefined };

const boundaries: readonly (readonly [route: string, Boundary: ComponentType, heading: string])[] = [
  ['requests/loading', RequestsLoading, 'My requests'],
  ['requests/error', () => <RequestsError {...errorProps} />, 'My requests'],
  ['questionnaires/loading', QuestionnairesLoading, 'My questionnaires'],
  ['questionnaires/error', () => <QuestionnairesError {...errorProps} />, 'My questionnaires'],
  ['assessments/loading', AssessmentsLoading, 'My risk assessments'],
  ['assessments/error', () => <AssessmentsError {...errorProps} />, 'My risk assessments'],
  ['review/assigned/loading', AssignedRequestsLoading, 'Assigned to me'],
  ['review/assigned/error', () => <AssignedRequestsError {...errorProps} />, 'Assigned to me'],
  ['review/requests/loading', AssessmentRequestsLoading, 'Requests'],
  ['review/requests/error', () => <AssessmentRequestsError {...errorProps} />, 'Requests'],
  ['review/questionnaires/loading', QuestionnaireReviewsLoading, 'Questionnaires'],
  ['review/questionnaires/error', () => <QuestionnaireReviewsError {...errorProps} />, 'Questionnaires'],
  ['review/assessments/loading', AssessmentReviewsLoading, 'Risk assessments'],
  ['review/assessments/error', () => <AssessmentReviewsError {...errorProps} />, 'Risk assessments'],
  ['risks/loading', RisksLoading, 'Risk register'],
  ['risks/error', () => <RisksError {...errorProps} />, 'Risk register'],
];

beforeAll(() => installTestResizeObserver());
afterEach(() => vi.clearAllMocks());

const recoveryBoundaries = [RequestsError, QuestionnairesError, AssessmentsError, AssignedRequestsError, AssessmentRequestsError, QuestionnaireReviewsError, AssessmentReviewsError, RisksError];

describe('route recovery re-fetches the rejected server render', () => {
  it.each(recoveryBoundaries)('%s recovers after the next server read succeeds', async (Boundary) => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function ServerPayload({ refreshed }: { refreshed: boolean }) {
      if (!refreshed) throw new Error('The original server payload rejected');
      return <h1>Recovered server content</h1>;
    }
    function Route() {
      const [refreshed, setRefreshed] = useState(false);
      const router: AppRouterInstance = {
        back: vi.fn(), forward: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(),
        experimental_gesturePush: vi.fn(), bfcacheId: 'recovery-test', refresh: () => setRefreshed(true),
      };
      return <AppRouterContext value={router}><ErrorBoundaryHandler errorComponent={({ error, retry }) => <Boundary error={error instanceof Error ? error : new Error('Server render failed')} retry={retry} />} pathname="/app"><ServerPayload refreshed={refreshed} /></ErrorBoundaryHandler></AppRouterContext>;
    }
    try {
      render(<Route />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Recovered server content' })).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      errorLog.mockRestore();
    }
  });
});

describe('route boundaries repeat the page heading (UI-SPEC §2.1)', () => {
  it.each(boundaries)('%s is headed with its navigation label', (_route, Boundary, heading) => {
    render(<Boundary />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
  });

  it('describes My requests the same way in its page, loading and error boundaries', () => {
    const view = render(<RequestsLoading />);
    expect(screen.getByText('Requests you raised, and what happens next on each.')).toBeInTheDocument();
    view.unmount();
    render(<RequestsError {...errorProps} />);
    expect(screen.getByText('Requests you raised, and what happens next on each.')).toBeInTheDocument();
  });

  it('names the New request form while it loads', () => {
    render(<NewRequestLoading />);
    expect(screen.getByRole('status', { name: 'Loading new request' })).toBeInTheDocument();
  });

  it('names the Risk register in sentence case when it cannot load (UI-SPEC §2.2)', () => {
    render(<RisksError {...errorProps} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the Risk register');
  });
});
