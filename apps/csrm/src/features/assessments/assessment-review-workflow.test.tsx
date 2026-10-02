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
  getQuestionnaireGenerationJobAction: vi.fn(),
  getRequestGenerationJobsAction: vi.fn(),
  retryQuestionnaireGenerationJobAction: vi.fn(),
  startQuestionnaireGenerationAction: vi.fn(),
}));
vi.mock('./assessment-actions', () => actionMocks);
vi.mock('@/features/requests/request-actions', () => ({ revertRequestToDraftAction: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/app/review/assessments', useRouter: () => routerMocks }));

import {
  AssessmentRequestList,
  AssessmentRequestListSkeleton,
  AssessmentList,
  AssessmentListSkeleton,
} from './assessment-list';
import { AssessmentDetail, AssessmentDetailSkeleton } from './assessment-detail';
import { AssessmentDraftJob } from './assessment-draft-job';
import { questionnaireGenerationAction } from '@/features/requests/request-domain';

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

  /*
   * UAT-015 (D-20): the analyst reads everything the Requestor submitted, third-party involvement, its
   * details and the regulatory requirements included, in the same groups the request form uses.
   */
  it('shows the analyst every submitted request field in the request form’s groups', () => {
    const detail = {
      documentId: 'request-8',
      requestNumber: 'RAR-0048',
      title: 'Third-party hosting review',
      description: 'Move the portal to a hosting partner.',
      assessmentType: 'Project' as const,
      division: 'Digital Services',
      businessUnit: 'Customer Platforms',
      businessPurpose: 'Scale the portal.',
      businessCriticality: 'High' as const,
      thirdPartyInvolvement: true,
      thirdPartyDetails: 'Acme Hosting runs the platform.',
      regulatoryRequirements: 'Privacy Act 1988 and APP 11.',
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

    const context = screen.getByRole('region', { name: 'Request context' });
    expect(context).toHaveAccessibleDescription('The details submitted with this request.');
    expect(within(context).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['Request overview', 'Business context', 'Scope and timing']);
    const business = within(context).getByRole('heading', { level: 3, name: 'Business context' }).parentElement as HTMLElement;
    expect(within(business).getByText('Third-party involvement').nextElementSibling).toHaveTextContent('Yes');
    expect(within(business).getByText('Acme Hosting runs the platform.')).toBeInTheDocument();
    expect(within(business).getByText('Privacy Act 1988 and APP 11.')).toBeInTheDocument();
  });

  /*
   * jsdom computes no layout, so the class list stands in for it. A two-track column template around a
   * single child is what left the card at about two thirds of the row, with an empty track beside it.
   */
  it('lets the request context section span the full width of its container', () => {
    const detail = {
      documentId: 'request-5',
      requestNumber: 'RAR-0045',
      title: 'Full width context review',
      description: 'Draft request with no relationships.',
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
    };
    render(<AssessmentDetail request={detail} state="populated" />);

    const container = screen.getByRole('region', { name: 'Request context' }).parentElement;
    expect(container).toHaveClass('grid', 'gap-6');
    expect(container?.className).not.toMatch(/\bgrid-cols-/);
  });

  /*
   * jsdom computes no layout, so sharing one `grid gap-6` container with no child margins stands in for the
   * 24px rhythm. Blocks spaced by their own one-sided margins are what left the request relationships card
   * flush against the next block.
   */
  const verticalMargin = /(^|\s)(mt|mb|my)-/;

  it('keeps the shared section gap between the request relationships and the request context', () => {
    const detail = {
      documentId: 'request-6',
      requestNumber: 'RAR-0046',
      title: 'Section gap review',
      description: 'Draft request with relationships.',
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
      relationships: {
        questionnaire: { availability: 'absent' as const },
        assessment: { availability: 'absent' as const },
      },
    };
    render(<AssessmentDetail request={detail} state="populated" />);

    const container = screen.getByRole('region', { name: 'Request context' }).parentElement as HTMLElement;
    expect(container).toHaveClass('grid', 'gap-6');
    expect(container).toContainElement(screen.getByRole('region', { name: 'Request relationships' }));
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    for (const child of Array.from(container.children)) expect(child.className).not.toMatch(verticalMargin);
  });

  /*
   * D-22: a reversal is offered only before any questionnaire exists, so it shares the page with the
   * questionnaire generation card alone; once a questionnaire exists both generation cards show, and no
   * reversal.
   */
  function submittedDetail(questionnaire: 'absent' | 'available') {
    return {
      documentId: 'request-7',
      requestNumber: 'RAR-0047',
      title: 'Reversal gap review',
      description: 'Submitted request.',
      requestStatus: 'submitted' as const,
      submittedDate: '2026-08-30T01:00:00.000Z',
      dueDate: null,
      updatedAt: null,
      dueDateLabel: null,
      updatedDateLabel: null,
      informationSystems: [],
      informationAssets: [],
      questionnaire: questionnaire === 'available' ? { documentId: 'questionnaire/id', title: 'Portal questionnaire' } : null,
      assessment: null,
      relationships: {
        questionnaire: questionnaire === 'available'
          ? { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: null, title: 'Portal questionnaire', state: 'submitted' }
          : { availability: 'absent' as const },
        assessment: { availability: 'absent' as const },
      },
    };
  }

  it('keeps the same gap around the analyst reversal and the questionnaire generation card', () => {
    render(<AssessmentDetail request={submittedDetail('absent')} state="populated" />);

    const container = screen.getByRole('region', { name: 'Request context' }).parentElement as HTMLElement;
    const reversal = screen.getByRole('button', { name: 'Return to draft' });
    expect(container).toHaveClass('grid', 'gap-6');
    expect(container).toContainElement(screen.getByRole('region', { name: 'Request relationships' }));
    expect(container).toContainElement(reversal);
    expect(container).toContainElement(screen.getByText('Questionnaire generation'));
    expect(reversal.parentElement).not.toBe(container);
    for (const child of Array.from(container.children)) expect(child.className).not.toMatch(verticalMargin);
  });

  it('withholds the analyst reversal once a questionnaire exists, keeping the gap around both generation cards', () => {
    render(<AssessmentDetail request={submittedDetail('available')} state="populated" />);

    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    const container = screen.getByRole('region', { name: 'Request context' }).parentElement as HTMLElement;
    expect(container).toHaveClass('grid', 'gap-6');
    expect(container).toContainElement(screen.getByText('Questionnaire generation'));
    expect(container).toContainElement(screen.getByText('Assessment draft generation'));
    for (const child of Array.from(container.children)) expect(child.className).not.toMatch(verticalMargin);
  });

  it('withholds the analyst reversal when the questionnaire exists but is not open to the analyst', () => {
    const detail = submittedDetail('absent');
    render(<AssessmentDetail request={{ ...detail, relationships: { ...detail.relationships, questionnaire: { availability: 'unavailable' as const } } }} state="populated" />);
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
  });
});

/*
 * UAT-019 (D-08, D-09, D-22): which generation action the hub offers comes from the served questionnaire
 * relation alone. A questionnaire still in analyst review can be replaced; any other questionnaire that
 * exists, open to the analyst or not, is never offered for replacement, because Strapi would refuse it.
 */
describe('the questionnaire generation action the hub offers', () => {
  it.each([
    ['absent', { availability: 'absent' as const }, 'generate'],
    ['in analyst review', { availability: 'available' as const, documentId: 'q', questionnaireNumber: 'QNR-2026-AAAAAA', title: 'Q', state: 'analyst-review' }, 'replace'],
    ['released', { availability: 'available' as const, documentId: 'q', questionnaireNumber: 'QNR-2026-AAAAAA', title: 'Q', state: 'released' }, 'released'],
    ['submitted', { availability: 'available' as const, documentId: 'q', questionnaireNumber: 'QNR-2026-AAAAAA', title: 'Q', state: 'submitted' }, 'released'],
    ['available with no served state', { availability: 'available' as const, documentId: 'q', questionnaireNumber: null, title: 'Q', state: null }, 'released'],
    ['not open to the analyst', { availability: 'unavailable' as const }, 'released'],
  ] as const)('a questionnaire relation that is %s gives %s', (_label, relation, expected) => {
    expect(questionnaireGenerationAction(relation)).toBe(expected);
  });

  function requestWithQuestionnaire(state: 'analyst-review' | 'released') {
    return {
      documentId: 'request-9',
      requestNumber: 'RAR-0049',
      title: 'Replacement review',
      description: 'Submitted request with a questionnaire.',
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
      relationships: {
        questionnaire: { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Portal questionnaire', state },
        assessment: { availability: 'absent' as const },
      },
    };
  }

  it('offers Replace questionnaire with the served change count while the questionnaire is in analyst review', () => {
    render(<AssessmentDetail analystChangesSinceGeneration={2} request={requestWithQuestionnaire('analyst-review')} state="populated" />);

    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    expect(screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' }))
      .toHaveTextContent('discarding the 2 changes analysts made to its questions since it was generated');
  });

  it('says it cannot count the changes when the hub was given no count', () => {
    render(<AssessmentDetail request={requestWithQuestionnaire('analyst-review')} state="populated" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    expect(screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' }))
      .toHaveTextContent('discarding any changes analysts made to its questions since it was generated');
  });

  it('offers neither Generate nor Replace once the questionnaire is released', () => {
    render(<AssessmentDetail analystChangesSinceGeneration={2} request={requestWithQuestionnaire('released')} state="populated" />);

    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    // D-09 (UI-SPEC §3.3): the hint names the questionnaire to return to analyst review, linked.
    expect(screen.getByText(/To replace it, return/)).toHaveTextContent('This questionnaire has been released to the Requestor. To replace it, return QNR-2026-KX2AHV to analyst review first.');
    expect(within(screen.getByText(/To replace it, return/)).getByRole('link', { name: 'QNR-2026-KX2AHV' })).toHaveAttribute('href', '/app/review/questionnaires/questionnaire%2Fid');
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
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" requestId="request/id" questionnaireSubmitted />);

    const start = screen.getByRole('button', { name: 'Generate assessment draft' });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(actionMocks.startAssessmentDraftAction).toHaveBeenCalledTimes(1);
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Starting draft generation…');
  });

  it('describes the action, the reviewing Security Analyst and the advisory draft before generation', () => {
    const { container } = render(<AssessmentDraftJob questionnaireId="questionnaire/id" requestId="request/id" questionnaireSubmitted />);

    expect(screen.getByRole('heading', { level: 2, name: 'Assessment draft generation' })).toBeInTheDocument();
    expect(screen.getByText('Generate a draft Risk Assessment from the submitted questionnaire. The draft is advisory: it is recorded as initiated by you and is released only by a Security Analyst after review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate assessment draft' })).toBeEnabled();
    expectProviderNeutralCopy(container);
  });

  it.each([
    ['queued', queuedJob, 'Draft generation is queued', 'Generation is waiting to start. You can leave this page; the status shows here when you come back.'],
    ['running', runningJob, 'Draft generation is running', 'A reviewable draft is being prepared from the questionnaire answers.'],
    ['completed', completedJob, 'Draft generation is ready for Security Analyst review', 'The generated draft is advisory and has not been released.'],
  ] as const)('keeps the %s state advisory and provider-neutral', (_status, job, title, body) => {
    const { container } = render(<AssessmentDraftJob seededJob={{ job: job, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('status')).toHaveTextContent(title);
    expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Draft generation lifecycle' })).toBeInTheDocument();
    expectProviderNeutralCopy(container);
  });

  it('names a failed generation without claiming a provider, passing the server message through', () => {
    const { container } = render(<AssessmentDraftJob seededJob={{ job: failedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);

    expect(screen.getByRole('status')).toHaveTextContent('Draft generation failed');
    expect(screen.getByText('Draft generation failed', { selector: '[data-slot="alert-title"]' })).toBeInTheDocument();
    expect(screen.getByText(failedJob.failureMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry draft generation' })).toBeEnabled();
    expectProviderNeutralCopy(container, [failedJob.failureMessage]);
  });

  it('announces start, status and retry failures in the draft generation vocabulary', async () => {
    actionMocks.startAssessmentDraftAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable.' });
    const idle = render(<AssessmentDraftJob questionnaireId="questionnaire/id" requestId="request/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate assessment draft' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation could not be started');
    idle.unmount();

    actionMocks.getAssessmentDraftJobAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable.' });
    const polling = render(<AssessmentDraftJob seededJob={{ job: queuedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation status could not be checked');
    polling.unmount();

    const pendingRetry = deferred<{ ok: false; formError: string }>();
    actionMocks.retryAssessmentDraftJobAction.mockReturnValueOnce(pendingRetry.promise);
    const { container } = render(<AssessmentDraftJob seededJob={{ job: failedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft generation' }));
    expect(screen.getByRole('button', { name: 'Retrying draft generation…' })).toBeDisabled();
    await act(async () => { pendingRetry.resolve({ ok: false, formError: 'The assessment service is unavailable.' }); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation could not be retried');
    expectProviderNeutralCopy(container, [failedJob.failureMessage]);
  });

  it('keeps one poll in flight and cleans up on unmount', async () => {
    const pending = deferred<never>();
    actionMocks.getAssessmentDraftJobAction.mockReturnValue(pending.promise);
    const { unmount } = render(<AssessmentDraftJob seededJob={{ job: queuedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);

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
    render(<AssessmentDraftJob seededJob={{ job: queuedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);

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
    const { rerender } = render(<AssessmentDraftJob seededJob={{ job: runningJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);
    expect(screen.queryByRole('button', { name: 'Retry draft generation' })).not.toBeInTheDocument();

    rerender(<AssessmentDraftJob seededJob={{ job: failedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft generation' }));
    await vi.runAllTicks();
    expect(actionMocks.retryAssessmentDraftJobAction).toHaveBeenCalledWith({ jobId: 'job/id' });
  });

  it('stops after the 30-second budget with recoverable timeout guidance', async () => {
    actionMocks.getAssessmentDraftJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<AssessmentDraftJob seededJob={{ job: queuedJob, canRetry: true }} requestId="request/id" questionnaireId="questionnaire/id" questionnaireSubmitted />);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
    expect(screen.getByText('Automatic checks stopped after 30 seconds. Generation may still be running.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Draft generation polling timed out');
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    const pollCount = actionMocks.getAssessmentDraftJobAction.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(actionMocks.getAssessmentDraftJobAction).toHaveBeenCalledTimes(pollCount);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checking the current draft generation status');
  });
});

/*
 * UAT-041 (D-26, UI-SPEC §12.1): the page reads the request's generation jobs and the hub seeds the
 * questionnaire card with a queued, running or failed job, which takes the place of Generate or Replace.
 * A completed job is not seeded: the hub shows its normal action.
 */
describe('the hub seeded with the request’s generation jobs', () => {
  beforeEach(() => vi.clearAllMocks());

  const submittedWithoutQuestionnaire = {
    documentId: 'request-10',
    requestNumber: 'RAR-0050',
    title: 'Returning analyst review',
    description: 'Submitted request whose questionnaire is generating.',
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
  const generationBase = { jobId: 'generation-job', requestId: 'request-10', providerName: 'Context provider', providerVersion: '1.0', attempt: 1, queuedAt: '2026-09-03T00:00:00.000Z' };
  const runningGeneration = { ...generationBase, status: 'running' as const, startedAt: '2026-09-03T00:00:01.000Z' };
  const completedGeneration = {
    ...runningGeneration,
    status: 'completed' as const,
    completedAt: '2026-09-03T00:00:02.000Z',
    questionnaire: { documentId: 'questionnaire-10', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Generated questionnaire', generatedDate: '2026-09-03T00:00:02.000Z', generatedBy: null },
  };

  it('shows a running questionnaire job another analyst started instead of Generate questionnaire', () => {
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: { job: runningGeneration, canRetry: false }, assessmentDraft: null }} request={submittedWithoutQuestionnaire} state="populated" />);

    expect(screen.getByText('Questionnaire generation is running', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Started by another Security Analyst.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
  });

  it('does not seed a completed job, so the hub offers its normal action', () => {
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: { job: completedGeneration, canRetry: true }, assessmentDraft: null }} request={submittedWithoutQuestionnaire} state="populated" />);

    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(screen.queryByText('Questionnaire generation is ready for review')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review generated questionnaire' })).not.toBeInTheDocument();
  });
});

/*
 * D-26, D-27 (UI-SPEC §12.2): the draft card shows a job another analyst started and polls it by request;
 * only the analyst who started a failed job may retry it, and anyone else may generate a new draft.
 */
describe('the draft card seeded with another analyst’s job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a running draft job another analyst started and polls it by request, never by id', async () => {
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: null, assessmentDraft: { job: completedJob, canRetry: false } } });
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted requestId="request/id" seededJob={{ job: runningJob, canRetry: false }} />);

    expect(screen.getByText('Started by another Security Analyst.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate assessment draft' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getRequestGenerationJobsAction).toHaveBeenCalledWith({ requestId: 'request/id' });
    expect(actionMocks.getAssessmentDraftJobAction).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open assessment draft' })).toBeInTheDocument();
  });

  it('shows another analyst’s failed draft job with who may retry it, and offers Generate assessment draft', async () => {
    actionMocks.startAssessmentDraftAction.mockResolvedValue({ ok: true, data: { ...queuedJob, jobId: 'job/two' } });
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted requestId="request/id" seededJob={{ job: failedJob, canRetry: false }} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Only the Security Analyst who started it can retry it.');
    expect(screen.queryByRole('button', { name: 'Retry draft generation' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate assessment draft' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actionMocks.startAssessmentDraftAction).toHaveBeenCalledWith({ questionnaireId: 'questionnaire/id' });
  });

  it('says what starting does above Generate assessment draft when the jobs read failed', () => {
    render(<AssessmentDraftJob jobsReadFailed questionnaireId="questionnaire/id" questionnaireSubmitted requestId="request/id" />);

    const line = screen.getByText('We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.');
    expect(line).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(line.compareDocumentPosition(screen.getByRole('button', { name: 'Generate assessment draft' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('titles a refused draft start as a start that could not begin', async () => {
    actionMocks.startAssessmentDraftAction.mockResolvedValue({ ok: false, formError: 'The assessment service is unavailable.' });
    render(<AssessmentDraftJob questionnaireId="questionnaire/id" questionnaireSubmitted requestId="request/id" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate assessment draft' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('alert')).toHaveTextContent('Draft generation couldn’t start');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Status unavailable');
  });
});

/*
 * UI-SPEC §12.3: while a seeded or started job is queued or running, the hub's Next action line says
 * generation is in progress, as plain text; when the job completes or fails, the served next action returns.
 */
describe('the hub’s next action while a generation job runs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  const lifecycle = {
    currentKey: 'submitted' as const, currentLabel: 'Submitted', terminal: false,
    nextAction: { actor: 'analyst' as const, summary: 'Generate the questionnaire.', href: '/app/review/requests/request-11' },
    steps: [],
  };
  function hubRequest(overrides: Record<string, unknown> = {}) {
    return {
      documentId: 'request-11',
      requestNumber: 'RAR-0051',
      title: 'Next action review',
      description: 'Submitted request.',
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
      lifecycle,
      relationships: {
        questionnaire: { availability: 'absent' as const },
        assessment: { availability: 'absent' as const },
      },
      ...overrides,
    };
  }
  const generation = { jobId: 'generation-job', requestId: 'request-11', providerName: 'Context provider', providerVersion: '1.0', attempt: 1, queuedAt: '2026-09-03T00:00:00.000Z' };
  const runningGeneration = { ...generation, status: 'running' as const, startedAt: '2026-09-03T00:00:01.000Z' };
  const failedGeneration = { ...runningGeneration, status: 'failed' as const, completedAt: '2026-09-03T00:00:02.000Z', failureCode: 'provider-failed', failureMessage: 'The provider could not prepare a questionnaire.' };
  const completedGeneration = { ...runningGeneration, status: 'completed' as const, completedAt: '2026-09-03T00:00:02.000Z', questionnaire: { documentId: 'questionnaire-11', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Generated questionnaire', generatedDate: '2026-09-03T00:00:02.000Z', generatedBy: null } };

  function nextActionLine() {
    return screen.getByText('Next action:').closest('p') as HTMLElement;
  }

  /*
   * WR-201, WR-401: the served lifecycle was read before the job completed, so it still names the step the job
   * just did. The page refreshes once on completion, and until the refreshed request arrives the line names no
   * action rather than one the card beside it has already done (walkthrough fix 4).
   */
  it('says questionnaire generation is in progress, with no link, then refreshes once it completes and never names Generate again', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: completedGeneration });
    const { rerender } = render(<AssessmentDetail generationJobs={{ questionnaireGeneration: { job: runningGeneration, canRetry: true }, assessmentDraft: null }} request={hubRequest()} state="populated" />);

    expect(nextActionLine()).toHaveTextContent('Next action: Questionnaire generation is in progress. Review the questionnaire when it’s ready.');
    expect(within(nextActionLine()).queryByRole('link')).not.toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toBeInTheDocument();
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Next action:')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate the questionnaire.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Generate the questionnaire.' })).not.toBeInTheDocument();

    // The refreshed request holds the generated questionnaire, so the served next action returns.
    const refreshed = hubRequest({
      questionnaire: { documentId: 'questionnaire-11', title: 'Generated questionnaire' },
      lifecycle: { ...lifecycle, currentKey: 'questionnaire-generated' as const, currentLabel: 'Questionnaire generated', nextAction: { actor: 'analyst' as const, summary: 'Review and release the questionnaire.', href: '/app/review/questionnaires/questionnaire-11' } },
      relationships: {
        questionnaire: { availability: 'available' as const, documentId: 'questionnaire-11', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Generated questionnaire', state: 'analyst-review' },
        assessment: { availability: 'absent' as const },
      },
    });
    rerender(<AssessmentDetail generationJobs={null} request={refreshed} state="populated" />);
    expect(nextActionLine()).toHaveTextContent('Next action: Review and release the questionnaire.');
    expect(within(nextActionLine()).getByRole('link', { name: 'Review and release the questionnaire.' })).toHaveAttribute('href', '/app/review/questionnaires/questionnaire-11');
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes once an assessment draft completes and never names Draft the assessment. beside Open assessment draft', async () => {
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: null, assessmentDraft: { job: completedJob, canRetry: false } } });
    const questionnaire = { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: 'QNR-2026-000001', title: 'Payments questionnaire', state: 'submitted' };
    const draftLifecycle = { ...lifecycle, currentKey: 'questionnaire-submitted' as const, currentLabel: 'Questionnaire submitted', nextAction: { actor: 'analyst' as const, summary: 'Draft the assessment.', href: '/app/review/questionnaires/questionnaire%2Fid' } };
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: null, assessmentDraft: { job: runningJob, canRetry: false } }} request={hubRequest({ requestStatus: 'questionnaire-in-progress', lifecycle: draftLifecycle, relationships: { questionnaire, assessment: { availability: 'absent' as const } } })} state="populated" />);

    expect(nextActionLine()).toHaveTextContent('Next action: Assessment draft generation is in progress. Open the draft when it’s ready.');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('link', { name: 'Open assessment draft' })).toBeInTheDocument();
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Next action:')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft the assessment.')).not.toBeInTheDocument();
  });

  /* IN-207: returning the request to draft would make the running job fail, so it is not offered beside it. */
  it('offers no Return to draft while questionnaire generation runs, and offers it again once the job fails', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: failedGeneration });
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: { job: runningGeneration, canRetry: true }, assessmentDraft: null }} request={hubRequest()} state="populated" />);

    expect(nextActionLine()).toHaveTextContent('Next action: Questionnaire generation is in progress.');
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Questionnaire generation failed');
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it('keeps the served next action when the seeded job failed', () => {
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: { job: failedGeneration, canRetry: false }, assessmentDraft: null }} request={hubRequest()} state="populated" />);

    expect(nextActionLine()).toHaveTextContent('Next action: Generate the questionnaire.');
  });

  it('says assessment draft generation is in progress while a draft job runs', () => {
    const questionnaire = { availability: 'available' as const, documentId: 'questionnaire/id', questionnaireNumber: 'QNR-2026-000001', title: 'Payments questionnaire', state: 'submitted' };
    render(<AssessmentDetail generationJobs={{ questionnaireGeneration: null, assessmentDraft: { job: runningJob, canRetry: false } }} request={hubRequest({ requestStatus: 'questionnaire-in-progress', relationships: { questionnaire, assessment: { availability: 'absent' as const } } })} state="populated" />);

    expect(nextActionLine()).toHaveTextContent('Next action: Assessment draft generation is in progress. Open the draft when it’s ready.');
    expect(within(nextActionLine()).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Started by another Security Analyst.')).toBeInTheDocument();
  });

  /*
   * Walkthrough fix 4: the Phase 7 fixtures RAR-E2E-P7-OVERDUE-001 (under review) and RAR-E2E-P7-DUESOON-001
   * (questionnaire in progress) hold no questionnaire, so Strapi's lifecycle serves the Submitted step's
   * "Generate the questionnaire." Strapi generates only for a submitted request, so the page offers no Generate
   * control, and the line must not name it.
   */
  it.each(['under-review', 'questionnaire-in-progress'] as const)('names no questionnaire generation for a %s request with no questionnaire, because none is offered', (requestStatus) => {
    render(<AssessmentDetail request={hubRequest({ requestStatus })} state="populated" />);

    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByText('Next action:')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate the questionnaire.')).not.toBeInTheDocument();
  });

  it('names questionnaire generation for a submitted request with no questionnaire, beside the Generate control', () => {
    render(<AssessmentDetail request={hubRequest()} state="populated" />);

    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(nextActionLine()).toHaveTextContent('Next action: Generate the questionnaire.');
  });

  it('shows the failed-read line on the hub’s card when the jobs read failed', () => {
    render(<AssessmentDetail jobsReadFailed request={hubRequest()} state="populated" />);

    expect(screen.getByText('We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
  });
});
