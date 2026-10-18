import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeZoneProvider } from '@/components/csrm/local-time';
import type { MyRequestItem } from '../requests/request-domain';

/*
 * The Requestor Home (UX-08; D-19 to D-24; UI-SPEC §5.2, §5.4). Its sections come from GET /v1/my_requests's
 * holder, never from the stored status: Needs your action is holder=requestor, With the Security Analyst is
 * holder=analyst. The transport is mocked at the service boundary the Home reads through, so these cases prove
 * what the Home asks for and what it shows for what the server answers.
 */

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  listMyRequests: vi.fn(),
  getMyRequestStatusSummary: vi.fn(),
  listMyReleasedAssessments: vi.fn(),
  getMyAssessmentRatingSummary: vi.fn(),
  listAssessmentRequests: vi.fn(),
  listAnalystAssessments: vi.fn(),
  getAnalystDashboard: vi.fn(),
  resolveE2eUiState: vi.fn(),
  resolveE2eRequestorHomePartial: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/requests/request-service', () => ({
  listMyRequests: mocks.listMyRequests,
  getMyRequestStatusSummary: mocks.getMyRequestStatusSummary,
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  listMyReleasedAssessments: mocks.listMyReleasedAssessments,
  getMyAssessmentRatingSummary: mocks.getMyAssessmentRatingSummary,
  listAssessmentRequests: mocks.listAssessmentRequests,
  listAnalystAssessments: mocks.listAnalystAssessments,
}));
vi.mock('@/features/analyst-dashboard/analyst-dashboard-service', () => ({ getAnalystDashboard: mocks.getAnalystDashboard }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
  resolveE2eRequestorHomePartial: mocks.resolveE2eRequestorHomePartial,
}));

import { getRequestorHome } from './requestor-home-service';
import { RequestorHomeContent, RequestorHomeSkeleton } from './requestor-home';
import type { ReleasedAssessmentSummary } from '../assessments/assessment-schema';

function myRequest(overrides: Partial<MyRequestItem> = {}): MyRequestItem {
  return {
    documentId: 'req-draft',
    requestNumber: 'RAR-2026-000101',
    title: 'Payroll cloud migration',
    requestStatus: 'draft',
    submittedDate: null,
    dueDate: '2026-09-12',
    updatedAt: '2026-09-27T20:00:00.000Z',
    daysSinceSubmission: null,
    holder: 'requestor',
    stage: { key: 'draft', label: 'Draft' },
    nextAction: { summary: 'Complete and submit this request.', href: '/app/requests/req-draft' },
    returned: null,
    questionnaire: null,
    assignee: null,
    unreadNotes: 0,
    ...overrides,
  };
}

const returnedDraft = myRequest({
  documentId: 'req-returned',
  requestNumber: 'RAR-2026-000102',
  title: 'Supplier portal upgrade',
  nextAction: { summary: 'Complete and submit this request.', href: '/app/requests/req-returned' },
  // 20:00 UTC on 27 September is 28 September in Sydney (D-55).
  returned: { reason: 'Add the hosting provider.', at: '2026-09-27T20:00:00.000Z' },
});

const returnedWithoutReason = myRequest({
  documentId: 'req-returned-quiet',
  requestNumber: 'RAR-2026-000103',
  title: 'Contact centre telephony',
  nextAction: { summary: 'Complete and submit this request.', href: '/app/requests/req-returned-quiet' },
  returned: { reason: null, at: '2026-09-27T20:00:00.000Z' },
});

const questionnaireToAnswer = myRequest({
  documentId: 'req-questionnaire',
  requestNumber: 'RAR-2026-000104',
  title: 'Customer data platform',
  requestStatus: 'questionnaire-in-progress',
  submittedDate: '2026-09-20T01:00:00.000Z',
  dueDate: null,
  daysSinceSubmission: 13,
  stage: { key: 'questionnaire-released', label: 'Questionnaire released' },
  nextAction: { summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/q-104' },
  questionnaire: { documentId: 'q-104', answered: 3, total: 8 },
});

function page(items: readonly MyRequestItem[], total = items.length) {
  return { data: { items, pagination: { page: 1, pageSize: 10, pageCount: Math.ceil(total / 10), total } }, error: null };
}

const noReleased = { data: { records: [], pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } }, error: null };
const noRatings = { data: { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 }, error: null };
const failed = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
const refused = { data: null, error: { message: 'You do not have permission to view these requests.', status: 403 } };

/* 13-UI-SPEC §12.1: the sentence a submitted request nobody has picked up reads for its Requestor. */
const waitingSentence = 'Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.';

/** A parsed status summary whose only figure that matters here is the requests with new notes (D-24). */
function summaryWith(withUnreadNotes: number) {
  return { data: { statuses: [], byHolder: { requestor: 0, analyst: 0, none: 0 }, withUnreadNotes }, error: null };
}

function withSummary(summary: unknown) {
  mocks.getMyRequestStatusSummary.mockImplementation(async () => { calls.push('summary'); return summary; });
}

function withAnalystItem(overrides: Partial<MyRequestItem> = {}): MyRequestItem {
  return myRequest({
    documentId: 'req-analyst',
    requestNumber: 'RAR-2026-000201',
    title: 'Identity platform renewal',
    requestStatus: 'submitted',
    submittedDate: '2026-09-20T01:00:00.000Z',
    daysSinceSubmission: 13,
    holder: 'analyst',
    stage: { key: 'submitted', label: 'Submitted' },
    nextAction: { summary: waitingSentence },
    ...overrides,
  });
}

function releasedAssessment(overrides: Partial<ReleasedAssessmentSummary> = {}): ReleasedAssessmentSummary {
  return {
    documentId: 'asm-1',
    assessmentNumber: 'ASM-2026-000301',
    assessmentStatus: 'approved',
    summary: 'Three Risks were identified.',
    overallRating: 'High',
    generatedDate: '2026-09-25T01:00:00.000Z',
    generatedBy: null,
    approvalDate: '2026-09-27T20:00:00.000Z',
    requestTitle: 'Payments gateway replacement',
    riskCount: 3,
    highestResidualRating: 'High',
    ...overrides,
  };
}

function releasedPage(records: readonly ReleasedAssessmentSummary[], total = records.length) {
  return { data: { records, pagination: { page: 1, pageSize: 10, pageCount: Math.ceil(total / 10), total } }, error: null };
}

function withReleased(released: unknown, ratings: unknown = noRatings) {
  mocks.listMyReleasedAssessments.mockImplementation(async () => { calls.push('released'); return released; });
  mocks.getMyAssessmentRatingSummary.mockImplementation(async () => { calls.push('ratings'); return ratings; });
}

function withHolders(requestor: ReturnType<typeof page>, analyst: ReturnType<typeof page> = page([])) {
  mocks.listMyRequests.mockImplementation(async (query: { holder?: string }) => {
    calls.push(`my-requests:${query.holder}`);
    return query.holder === 'requestor' ? requestor : analyst;
  });
}

async function renderHome(searchParams: Record<string, string> = {}) {
  const content = await RequestorHomeContent({ searchParams: Promise.resolve(searchParams) });
  return render(<TimeZoneProvider zone="Australia/Sydney">{content}</TimeZoneProvider>);
}

function section(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  calls.length = 0;
  for (const mock of Object.values(mocks)) mock.mockReset();
  withHolders(page([myRequest()]));
  mocks.listMyReleasedAssessments.mockImplementation(async () => { calls.push('released'); return noReleased; });
  mocks.getMyAssessmentRatingSummary.mockImplementation(async () => { calls.push('ratings'); return noRatings; });
  withSummary(summaryWith(0));
  mocks.resolveE2eUiState.mockImplementation(() => { calls.push('fixture'); return undefined; });
  mocks.resolveE2eRequestorHomePartial.mockImplementation(() => { calls.push('partial'); return false; });
});

describe('getRequestorHome', () => {
  it('reads the Requestor’s own requests by holder, ten held by them and those with the Security Analyst, beside the released reads', async () => {
    await getRequestorHome();

    expect(mocks.listMyRequests).toHaveBeenCalledTimes(2);
    expect(mocks.listMyRequests).toHaveBeenCalledWith({ q: '', status: undefined, holder: 'requestor', sort: 'updatedAt:desc', page: 1, pageSize: 10 });
    expect(mocks.listMyRequests).toHaveBeenCalledWith(expect.objectContaining({ holder: 'analyst', sort: 'updatedAt:desc', page: 1 }));
    expect(mocks.listMyReleasedAssessments).toHaveBeenCalledTimes(1);
    expect(mocks.listMyReleasedAssessments).toHaveBeenCalledWith(expect.objectContaining({ sort: 'approvalDate:desc', page: 1 }));
    expect(mocks.getMyAssessmentRatingSummary).toHaveBeenCalledTimes(1);
  });

  it('issues no analyst read (T-11-01)', async () => {
    await getRequestorHome();

    for (const analystRead of [mocks.listAssessmentRequests, mocks.listAnalystAssessments, mocks.getAnalystDashboard]) {
      expect(analystRead).not.toHaveBeenCalled();
    }
  });
});

describe('Requestor Home: Needs your action', () => {
  it('leads the Home: its first section is Needs your action, described as the work waiting for them', async () => {
    await renderHome();

    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Needs your action');
    expect(within(section('Needs your action')).getByText('Requests and questionnaires waiting for you.')).toBeInTheDocument();
  });

  it('lists a draft by its title, its number and due date, and the server’s next step as plain text', async () => {
    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByRole('link', { name: 'Payroll cloud migration' })).toHaveAttribute('href', '/app/requests/req-draft');
    expect(within(needs).getByText('RAR-2026-000101 · Due 12 Sept 2026')).toBeInTheDocument();
    const nextStep = within(needs).getByText('Complete and submit this request.');
    // Its destination is the title's (UI-D17): the sentence is not a second link to the same page.
    expect(nextStep.closest('a')).toBeNull();
  });

  it('says when and why a draft was returned, in the viewer’s time zone, with or without a reason', async () => {
    withHolders(page([returnedDraft, returnedWithoutReason]));

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Returned to draft on 28 Sept 2026. Reason: Add the hosting provider.')).toBeInTheDocument();
    expect(within(needs).getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Returned to draft on 28 Sept 2026.')).toBeInTheDocument();
  });

  it('links a questionnaire to answer, with how many questions are answered and a named progress bar', async () => {
    withHolders(page([questionnaireToAnswer]));

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByText('RAR-2026-000104 · No due date')).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/q-104');
    expect(within(needs).getByText('3 of 8 answered')).toHaveClass('tabular-nums');
    expect(within(needs).getByRole('progressbar', { name: '3 of 8 questions answered' })).toBeInTheDocument();
    // Only a questionnaire item carries progress.
    expect(within(needs).getAllByRole('progressbar')).toHaveLength(1);
  });

  it('shows ten of eleven, says so, and opens My requests filtered to the same eleven', async () => {
    const eleven = Array.from({ length: 10 }, (_, index) => myRequest({
      documentId: `req-${index}`,
      requestNumber: `RAR-2026-0002${String(index).padStart(2, '0')}`,
      title: `Request ${index + 1}`,
      nextAction: { summary: 'Complete and submit this request.', href: `/app/requests/req-${index}` },
    }));
    withHolders(page(eleven, 11));

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getAllByRole('listitem')).toHaveLength(10);
    expect(within(needs).getByText('Showing 10 of 11')).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: 'View all 11 in My requests' })).toHaveAttribute('href', '/app/requests?holder=requestor');
  });

  it('carries request facts only: no Risk Assessment number or link on a request item (T-11-06)', async () => {
    withHolders(page([myRequest(), questionnaireToAnswer, returnedDraft]));

    await renderHome();

    const needs = section('Needs your action');
    expect(needs.querySelector('a[href^="/app/assessments/"], a[href^="/app/review/"]')).toBeNull();
    expect(within(needs).queryByText(/^RA-\d/)).toBeNull();
  });
});

describe('Requestor Home: With the Security Analyst', () => {
  it('follows Needs your action, then Released assessments, in DOM order', async () => {
    await renderHome();

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Needs your action',
      'With the Security Analyst',
      'Released assessments',
    ]);
    expect(within(section('With the Security Analyst')).getByText('Requests a Security Analyst is working on.')).toBeInTheDocument();
  });

  it('names how long each request has been submitted and shows the server’s sentence naming the Security Analyst', async () => {
    withHolders(page([myRequest()]), page([
      withAnalystItem({ documentId: 'today', requestNumber: 'RAR-2026-000211', title: 'Submitted today', daysSinceSubmission: 0 }),
      withAnalystItem({ documentId: 'yesterday', requestNumber: 'RAR-2026-000212', title: 'Submitted yesterday', daysSinceSubmission: 1 }),
      withAnalystItem(),
    ]));

    await renderHome();

    const withAnalyst = section('With the Security Analyst');
    expect(within(withAnalyst).getByRole('link', { name: 'Identity platform renewal' })).toHaveAttribute('href', '/app/requests/req-analyst');
    expect(within(withAnalyst).getByText('RAR-2026-000211 · Submitted today')).toBeInTheDocument();
    expect(within(withAnalyst).getByText('RAR-2026-000212 · Submitted 1 day ago')).toBeInTheDocument();
    expect(within(withAnalyst).getByText('RAR-2026-000201 · Submitted 13 days ago')).toBeInTheDocument();
    const sentences = within(withAnalyst).getAllByText(waitingSentence);
    expect(sentences).toHaveLength(3);
    // The Requestor does not hold this step, so the sentence is never a link (T-11-29).
    for (const sentence of sentences) expect(sentence.closest('a')).toBeNull();
  });

  it('shows five of six, says so, and opens My requests filtered to the Security Analyst’s six', async () => {
    const six = Array.from({ length: 6 }, (_, index) => withAnalystItem({ documentId: `analyst-${index}`, requestNumber: `RAR-2026-0003${index}0`, title: `With analyst ${index + 1}` }));
    withHolders(page([myRequest()]), page(six));

    await renderHome();

    const withAnalyst = section('With the Security Analyst');
    expect(within(withAnalyst).getAllByRole('listitem')).toHaveLength(5);
    expect(within(withAnalyst).getByText('Showing 5 of 6')).toBeInTheDocument();
    expect(within(withAnalyst).getByRole('link', { name: 'View all 6 in My requests' })).toHaveAttribute('href', '/app/requests?holder=analyst');
  });
});

describe('Requestor Home: Released assessments', () => {
  it('lists the counts by overall rating, linking each count above zero to My risk assessments for that rating', async () => {
    withReleased(releasedPage([releasedAssessment()], 3), { data: { Low: 0, Moderate: 0, High: 2, Critical: 1, total: 3 }, error: null });

    await renderHome();

    const released = section('Released assessments');
    expect(within(released).getByText('Your most recently released risk assessments.')).toBeInTheDocument();
    const chips = within(within(released).getByRole('list', { name: 'Released assessments by overall rating' })).getAllByRole('listitem');
    // The visible rating and count read as words, so the link's name contains its visible text (WCAG 2.5.3; axe
    // label-content-name-mismatch): a flex row draws no word break between the badge and the count.
    expect(chips.map((chip) => chip.textContent)).toEqual(['Low 0', 'Moderate 0', 'High 2', 'Critical 1']);
    expect(within(chips[2]!).getByRole('link', { name: 'High: 2 released risk assessments' })).toHaveAttribute('href', '/app/assessments?overallRating=High');
    expect(within(chips[3]!).getByRole('link', { name: 'Critical: 1 released risk assessment' })).toHaveAttribute('href', '/app/assessments?overallRating=Critical');
    // A zero is plain (X-10).
    expect(within(chips[0]!).queryByRole('link')).toBeNull();
    expect(within(chips[1]!).queryByRole('link')).toBeNull();
  });

  it('shows the newest five by number, request title, local release date and rating, and opens My risk assessments', async () => {
    const records = [
      releasedAssessment(),
      releasedAssessment({ documentId: 'asm-2', assessmentNumber: 'ASM-2026-000302', overallRating: null, requestTitle: 'Unrated change' }),
      ...Array.from({ length: 3 }, (_, index) => releasedAssessment({ documentId: `asm-${index + 3}`, assessmentNumber: `ASM-2026-00031${index}`, requestTitle: `Release ${index + 3}` })),
      releasedAssessment({ documentId: 'asm-6', assessmentNumber: 'ASM-2026-000399', requestTitle: 'Sixth, not shown' }),
    ];
    withReleased(releasedPage(records, 7), { data: { Low: 0, Moderate: 0, High: 6, Critical: 0, total: 7 }, error: null });

    await renderHome();

    const released = section('Released assessments');
    const items = within(within(released).getByRole('list', { name: 'Released risk assessments' })).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(items[0]!).getByRole('link', { name: 'ASM-2026-000301' })).toHaveAttribute('href', '/app/assessments/asm-1');
    expect(within(items[0]!).getByText('Payments gateway replacement')).toBeInTheDocument();
    // 20:00 UTC on 27 September is 28 September in Sydney (D-55).
    expect(within(items[0]!).getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Released 28 Sept 2026')).toBeInTheDocument();
    expect(within(items[0]!).getByText('High')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Not rated')).toBeInTheDocument();
    expect(within(released).queryByText('Sixth, not shown')).toBeNull();
    expect(within(released).getByText('Showing 5 of 7')).toBeInTheDocument();
    expect(within(released).getByRole('link', { name: 'View all 7 in My risk assessments' })).toHaveAttribute('href', '/app/assessments');
  });
});

describe('Requestor Home: new notes and the assigned Security Analyst (D-17, D-24; 13-UI-SPEC §12.3)', () => {
  it('reads the status summary once, beside the other four reads', async () => {
    await getRequestorHome();

    expect(mocks.getMyRequestStatusSummary).toHaveBeenCalledTimes(1);
    expect(mocks.getMyRequestStatusSummary).toHaveBeenCalledWith();
    expect(calls).toEqual(expect.arrayContaining(['my-requests:requestor', 'my-requests:analyst', 'released', 'ratings', 'summary']));
  });

  it.each([
    [2, 'New notes on 2 requests'],
    [1, 'New notes on 1 request'],
    [1_234, 'New notes on 1,234 requests'],
  ] as const)('with %i requests with new notes, shows one row under the header that opens My requests filtered to them', async (count, name) => {
    withSummary(summaryWith(count));

    await renderHome();

    const row = screen.getByRole('link', { name });
    expect(row).toHaveAttribute('href', '/app/requests?notes=unread');
    expect(row).toHaveTextContent(new RegExp(`^${name}$`));
    // A block link: the chevron is its at-rest cue, and both icons are hidden from the name (X-10).
    expect(row.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    // UI-08 (13-UI-SPEC token names): the chevron takes the contract's secondary text token.
    const chevron = row.querySelectorAll('svg[aria-hidden="true"]')[1]!;
    expect(chevron).toHaveClass('text-foreground-secondary');
    expect(chevron).not.toHaveClass('text-muted-foreground');
    // Directly under the page header: before Needs your action, at every width (DOM order equals visual order).
    const firstSection = screen.getAllByRole('heading', { level: 2 })[0]!;
    expect(firstSection).toHaveTextContent('Needs your action');
    expect(row.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.closest('[data-slot="requestor-home"]')).toBeNull();
    expect(screen.getAllByRole('link', { name: /^New notes on/ })).toHaveLength(1);
  });

  it('shows no new-notes row at zero (UI-D25)', async () => {
    withSummary(summaryWith(0));

    await renderHome();

    expect(screen.queryByRole('link', { name: /New notes on/ })).toBeNull();
    expect(screen.queryByText(/New notes on/)).toBeNull();
  });

  it.each([
    ['fails', async () => failed],
    ['is refused', async () => refused],
    ['rejects', async () => { throw new Error('internal connection detail'); }],
  ] as const)('leaves the row out and the Home exactly as at zero when the status summary read %s', async (_label, read) => {
    withHolders(page([myRequest()]), page([withAnalystItem()]));
    withSummary(summaryWith(0));
    const first = await renderHome();
    const atZero = first.container.innerHTML;
    first.unmount();

    mocks.getMyRequestStatusSummary.mockImplementation(async () => { calls.push('summary'); return read(); });
    const view = await renderHome();

    expect(screen.queryByRole('link', { name: /New notes on/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Needs your action',
      'With the Security Analyst',
      'Released assessments',
    ]);
    expect(view.container.innerHTML).toBe(atZero);
  });

  it('keeps the page error and the permission state to the other reads: the summary joins neither', async () => {
    withSummary(summaryWith(3));
    mocks.listMyRequests.mockResolvedValue(failed);
    withReleased(failed, failed);
    await expect(getRequestorHome()).resolves.toEqual({ kind: 'error' });

    withHolders(page([myRequest()]));
    withReleased(noReleased, noRatings);
    withSummary(refused);
    await expect(getRequestorHome()).resolves.toMatchObject({ kind: 'ready' });
  });

  it('names the assigned Security Analyst on line 2 of an item, and adds nothing when nobody holds it', async () => {
    withHolders(
      page([myRequest({ assignee: { displayName: 'Bob Doe' } }), questionnaireToAnswer]),
      page([
        withAnalystItem({ assignee: { displayName: 'Bob Doe' }, nextAction: { summary: 'Bob Doe is reviewing your request and will send you a questionnaire to answer.' } }),
        withAnalystItem({ documentId: 'req-waiting', requestNumber: 'RAR-2026-000202', title: 'Waiting for pick-up', daysSinceSubmission: 1 }),
      ]),
    );

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByText('RAR-2026-000101 · Due 12 Sept 2026 · Assigned to Bob Doe')).toBeInTheDocument();
    expect(within(needs).getByText('RAR-2026-000104 · No due date')).toBeInTheDocument();
    const withAnalyst = section('With the Security Analyst');
    expect(within(withAnalyst).getByText('RAR-2026-000201 · Submitted 13 days ago · Assigned to Bob Doe')).toBeInTheDocument();
    expect(within(withAnalyst).getByText('Bob Doe is reviewing your request and will send you a questionnaire to answer.')).toBeInTheDocument();
    expect(within(withAnalyst).getByText('RAR-2026-000202 · Submitted 1 day ago')).toBeInTheDocument();
    expect(within(withAnalyst).getByText(waitingSentence)).toBeInTheDocument();
    expect(screen.queryByText(/Assigned to $/)).toBeNull();
  });

  it('marks an item’s new notes below its last line, linking to the request’s thread, and nothing at zero (X-17)', async () => {
    withHolders(
      page([myRequest({ unreadNotes: 2 }), questionnaireToAnswer]),
      page([
        withAnalystItem({ unreadNotes: 1 }),
        withAnalystItem({ documentId: 'req-quiet', requestNumber: 'RAR-2026-000203', title: 'No new notes' }),
      ]),
    );

    await renderHome();

    const one = within(section('With the Security Analyst')).getByRole('link', { name: '1 new note on RAR-2026-000201' });
    expect(one).toHaveTextContent(/^1 new note$/);
    expect(one).toHaveAttribute('href', '/app/requests/req-analyst#notes');
    // The marker is the item's last line.
    expect(one.closest('li')!.lastElementChild!.contains(one)).toBe(true);
    const two = within(section('Needs your action')).getByRole('link', { name: '2 new notes on RAR-2026-000101' });
    expect(two).toHaveTextContent(/^2 new notes$/);
    expect(two).toHaveAttribute('href', '/app/requests/req-draft#notes');
    expect(two.closest('li')!.lastElementChild!.contains(two)).toBe(true);
    expect(screen.getAllByRole('link', { name: /new notes? on/ })).toHaveLength(2);
  });
});

describe('Requestor Home: empty states', () => {
  it('offers New request only on first use, when the Requestor has no request at all', async () => {
    withHolders(page([]), page([]));

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByRole('heading', { name: 'No requests yet' })).toBeInTheDocument();
    expect(within(needs).getByText('Start a request when you plan a change that needs a cyber risk assessment.')).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/app/requests/new');
    expect(within(section('With the Security Analyst')).getByRole('heading', { name: 'No requests with the Security Analyst' })).toBeInTheDocument();
    expect(within(section('With the Security Analyst')).getByText('Requests appear here while a Security Analyst works on them.')).toBeInTheDocument();
    const released = section('Released assessments');
    expect(within(released).getByRole('heading', { name: 'No released risk assessments yet' })).toBeInTheDocument();
    expect(within(released).getByText('Assessments appear here after a Security Analyst releases them.')).toBeInTheDocument();
    // The chips still show, plain.
    expect(within(within(released).getByRole('list', { name: 'Released assessments by overall rating' })).getAllByRole('listitem')).toHaveLength(4);
    expect(within(released).queryByRole('link')).toBeNull();
    // Only Needs your action carries a call to action (UI-D18).
    expect(screen.getAllByRole('link', { name: 'New request' })).toHaveLength(1);
  });

  it('says Needs your action is cleared, with no action, once the Requestor has requests elsewhere', async () => {
    withHolders(page([]), page([withAnalystItem()]));

    await renderHome();

    const needs = section('Needs your action');
    expect(within(needs).getByRole('heading', { name: 'No requests waiting for you' })).toBeInTheDocument();
    expect(within(needs).getByText('When a request or questionnaire needs you, it appears here.')).toBeInTheDocument();
    expect(within(needs).queryByRole('link')).toBeNull();
  });
});

describe('Requestor Home: errors, permission and loading', () => {
  it.each([
    ['Needs your action', 'requestor', 'We couldn’t load requests waiting for you'],
    ['With the Security Analyst', 'analyst', 'We couldn’t load requests with the Security Analyst'],
  ] as const)('fails %s on its own with a compact error and Try again', async (name, holder, message) => {
    mocks.listMyRequests.mockImplementation(async (query: { holder?: string }) => (query.holder === holder ? failed : page([myRequest()])));

    await renderHome();

    const failedSection = section(name);
    expect(within(failedSection).getByRole('alert')).toHaveTextContent(message);
    expect(within(failedSection).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(failedSection).queryByRole('link')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('fails Released assessments on its own when either released read fails', async () => {
    withReleased(releasedPage([releasedAssessment()]), failed);

    await renderHome();

    expect(within(section('Released assessments')).getByRole('alert')).toHaveTextContent('We couldn’t load released assessments');
    expect(within(section('Needs your action')).getByRole('link', { name: 'Payroll cloud migration' })).toBeInTheDocument();
  });

  it('shows the page error with Try again when every read fails', async () => {
    mocks.listMyRequests.mockResolvedValue(failed);
    withReleased(failed, failed);

    await renderHome({ __e2eState: 'populated' });

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your requests');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // The page error stands alone: no section renders beside it.
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['We couldn’t load your requests']);
    // A failed read is authoritative: no fixture or partial stands in for it (D-23).
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eRequestorHomePartial).not.toHaveBeenCalled();
  });

  it('shows the permission state with Return to sign in when Strapi refuses a read', async () => {
    withReleased(refused);

    await renderHome({ __e2eState: 'populated', __e2ePartial: 'requestor-home-with-analyst-error' });

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to your requests');
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eRequestorHomePartial).not.toHaveBeenCalled();
  });

  it('loads as three section skeletons in the final grid, a status named Loading Home', () => {
    render(<RequestorHomeSkeleton />);

    const status = screen.getByRole('status', { name: 'Loading Home' });
    const skeletons = status.querySelectorAll('[data-slot="dashboard-widget-skeleton"]');
    expect(skeletons).toHaveLength(3);
    expect(skeletons[2]).toHaveClass('lg:col-span-2');
    expect(skeletons[0]).not.toHaveClass('lg:col-span-2');
    expect(skeletons[0]!.parentElement).toHaveClass('lg:grid-cols-2');
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('Requestor Home: guarded fixtures', () => {
  it('fails With the Security Analyst alone under the partial selector, resolved only after the real reads succeeded', async () => {
    withHolders(page([myRequest()]), page([withAnalystItem()]));
    withReleased(releasedPage([releasedAssessment()]), { data: { Low: 0, Moderate: 0, High: 1, Critical: 0, total: 1 }, error: null });
    mocks.resolveE2eUiState.mockImplementation(() => { calls.push('fixture'); return 'populated'; });
    mocks.resolveE2eRequestorHomePartial.mockImplementation(() => { calls.push('partial'); return true; });

    await renderHome({ __e2eState: 'populated', __e2ePartial: 'requestor-home-with-analyst-error' });

    expect(calls.indexOf('partial')).toBeGreaterThan(Math.max(calls.indexOf('my-requests:requestor'), calls.indexOf('my-requests:analyst'), calls.indexOf('released'), calls.indexOf('ratings')));
    const withAnalyst = section('With the Security Analyst');
    expect(within(withAnalyst).getByRole('alert')).toHaveTextContent('We couldn’t load requests with the Security Analyst');
    expect(within(withAnalyst).queryByRole('link', { name: 'Identity platform renewal' })).toBeNull();
    expect(within(section('Needs your action')).getByRole('link', { name: 'Payroll cloud migration' })).toBeInTheDocument();
    expect(within(section('Released assessments')).getByRole('link', { name: 'ASM-2026-000301' })).toBeInTheDocument();
    expect(document.querySelector('[data-ui-state="populated"]')).not.toBeNull();
  });

  it.each([
    ['loading', () => expect(screen.getByRole('status', { name: 'Loading Home' })).toBeInTheDocument()],
    ['empty', () => expect(within(section('Needs your action')).getByRole('heading', { name: 'No requests yet' })).toBeInTheDocument()],
    ['error', () => expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your requests')],
    ['permission', () => expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to your requests')],
  ] as const)('renders the %s fixture inside its guarded boundary, never the records the reads returned', async (state, expectState) => {
    mocks.resolveE2eUiState.mockImplementation(() => { calls.push('fixture'); return state; });

    await renderHome({ __e2eState: state });

    expect(document.querySelector(`[data-ui-state="${state}"]`)).not.toBeNull();
    expectState();
    expect(screen.queryByRole('link', { name: 'Payroll cloud migration' })).toBeNull();
  });
});
