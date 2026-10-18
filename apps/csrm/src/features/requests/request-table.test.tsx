import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeZoneProvider } from '@/components/csrm/local-time';
import type { MyRequestItem, MyRequestListQuery, RequestPagination } from './request-domain';
import { parseRequestListQuery } from './request-schema';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: 'view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20&owner=forged' }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/requests',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search.value),
}));

type RequestTableProps = {
  requests: readonly MyRequestItem[];
  query: MyRequestListQuery;
  pagination: RequestPagination;
  densityUserId: string;
  state?: 'populated' | 'loading' | 'empty' | 'error' | 'permission';
};

const query: MyRequestListQuery = {
  q: 'portal',
  status: 'submitted',
  holder: undefined,
  notes: undefined,
  sort: 'updatedAt:desc',
  page: 2,
  pageSize: 20,
};

const pagination: RequestPagination = { page: 2, pageSize: 20, pageCount: 3, total: 45 };

/* 13-UI-SPEC §12.1: a submitted request nobody has picked up yet. */
const analystSentence = 'Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.';

/** One served my requests item (D-02 item 6): submitted, so the Security Analyst holds it; nobody has picked it up. */
const request: MyRequestItem = {
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  requestStatus: 'submitted',
  submittedDate: '2026-08-20T10:00:00.000Z',
  dueDate: '2026-09-12',
  updatedAt: '2026-08-21T11:30:00.000Z',
  daysSinceSubmission: 1,
  holder: 'analyst',
  stage: { key: 'submitted', label: 'Submitted' },
  nextAction: { summary: analystSentence },
  returned: null,
  questionnaire: null,
  assignee: null,
  unreadNotes: 0,
};

/** The same request once Bob Doe has picked it up and written to the Requestor (D-17, D-24). */
const heldByBob: MyRequestItem = {
  ...request,
  documentId: 'request-5',
  requestNumber: 'RAR-2026-B0B5ZQ',
  title: 'Identity platform review',
  nextAction: { summary: 'Bob Doe is reviewing your request and will send you a questionnaire to answer.' },
  assignee: { displayName: 'Bob Doe' },
  unreadNotes: 1,
};

/** A released questionnaire: the Requestor's own step, which the server links. */
const answering: MyRequestItem = {
  ...request,
  documentId: 'request-2',
  requestNumber: 'RAR-2026-P3M8D1',
  title: 'Payroll platform answers',
  requestStatus: 'questionnaire-in-progress',
  holder: 'requestor',
  stage: { key: 'questionnaire-released', label: 'Questionnaire released' },
  nextAction: { summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/questionnaire-2' },
  questionnaire: { documentId: 'questionnaire-2', answered: 1, total: 3 },
};

/** A released assessment: nobody holds the work. */
const released: MyRequestItem = {
  ...request,
  documentId: 'request-3',
  requestNumber: 'RAR-2026-V9R2T5',
  title: 'Vendor onboarding review',
  requestStatus: 'approved',
  holder: 'none',
  stage: { key: 'assessment-released', label: 'Assessment released' },
  nextAction: { summary: 'No action is required.' },
};

async function loadRequestTable(): Promise<ComponentType<RequestTableProps>> {
  const sourcePath = resolve(process.cwd(), 'src/features/requests/request-table.tsx');
  if (!existsSync(sourcePath)) throw new Error('PHASE2_RED_W0_02B_REQUEST_TABLE_BEHAVIOR_ABSENT');

  const moduleName = './request-' + 'table';
  const module = await import(/* @vite-ignore */ moduleName) as { RequestTable?: ComponentType<RequestTableProps> };
  if (!module.RequestTable) throw new Error('PHASE2_RED_W0_02B_REQUEST_TABLE_BEHAVIOR_ABSENT');
  return module.RequestTable;
}

beforeEach(() => {
  replace.mockReset();
  search.value = 'view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20&owner=forged';
});

describe('RequestTable', () => {
  it('renders responsive request content and writes bounded controls to the URL', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    render(<RequestTable requests={[request]} query={query} pagination={pagination} densityUserId="requestor" />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('table', { name: 'My assessment requests' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Customer portal review/ })).toHaveLength(2);
    expect(screen.getAllByText('RAR-2026-X7K4Q2')).toHaveLength(2);
    expect(screen.getAllByText('Submitted').filter((element) => element.closest('[data-slot="data-table-mobile"], [data-slot="data-table-desktop"]'))).toHaveLength(2);
    expect(screen.getAllByText('Due 12 Sept 2026')).toHaveLength(1);
    expect(screen.getByText('45 results')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', { name: 'Search requests' });
    await user.clear(searchInput);
    await user.type(searchInput, 'identity');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=identity&status=submitted&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'draft');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=draft&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Title' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=title%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Due date' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=dueDate%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Updated' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=3&pageSize=20', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&pageSize=50', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Remove Search filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&status=submitted&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });
  });

  it('labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    search.value = 'sort=updatedAt%3Adesc&pageSize=20';
    const releasedRequest: MyRequestItem = { ...request, requestStatus: 'approved' };
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    const view = render(<RequestTable requests={[releasedRequest]} query={unfiltered} pagination={pagination} densityUserId="requestor" />);

    const releasedOption = [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')].find((option) => option.value === 'approved');
    expect(releasedOption?.textContent).toBe('Released');
    expect(screen.getAllByText('Released').filter((element) => element.closest('[data-slot="data-table-mobile"], [data-slot="data-table-desktop"]'))).toHaveLength(2);

    // Only the label changes: choosing Released still writes the stored value to the URL.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'approved');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?status=approved&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    view.rerender(<RequestTable requests={[releasedRequest]} query={{ ...unfiltered, status: 'approved' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('approved');
    expect(screen.getByText('Status: Released')).toBeInTheDocument();
    expect(screen.queryByText(/Approved/)).not.toBeInTheDocument();
  });

  it('shows whose turn each request is above the server’s next step, linking only the viewer’s own step (D-34, UI-D25)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    render(<RequestTable requests={[request, answering, released]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 3 }} densityUserId="requestor" />);

    const table = screen.getByRole('table', { name: 'My assessment requests' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Request ID', 'Title', 'Status', 'Security Analyst', 'Next step', 'Due date', 'Updated',
    ]);
    const nextStepCell = (title: string) => within(within(table).getByRole('link', { name: title }).closest('tr')!).getAllByRole('cell')[4]!;

    // The Security Analyst holds a submitted request: the holder line, then the sentence as plain text.
    const withAnalyst = nextStepCell('Customer portal review');
    expect(within(withAnalyst).getByText('With the Security Analyst')).toHaveClass('micro-label', 'text-foreground-secondary');
    expect(within(withAnalyst).getByText(analystSentence)).toHaveClass('line-clamp-2');
    expect(within(withAnalyst).queryByRole('link')).not.toBeInTheDocument();
    // A long-text column: the sentence wraps within the X-3 bounds, its full text in the DOM.
    expect(withAnalyst).toHaveClass('whitespace-normal', 'min-w-56', 'max-w-md');

    // The viewer holds a released questionnaire: the server's sentence opens it.
    const yours = nextStepCell('Payroll platform answers');
    expect(within(yours).getByText('Needs your action')).toHaveClass('micro-label', 'text-foreground-secondary');
    expect(within(yours).getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/questionnaire-2');

    const nobody = nextStepCell('Vendor onboarding review');
    expect(within(nobody).getByText('No action needed')).toBeInTheDocument();
    expect(within(nobody).getByText('No action is required.')).toBeInTheDocument();
    expect(within(nobody).queryByRole('link')).not.toBeInTheDocument();
  });

  it('links a next step only when the viewer holds it and the server supplies an href, and shows a closed request’s holder alone', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    // An href served for a step the viewer does not hold is never a link (UI-SPEC §6.1, T-11-29).
    const unheldHref: MyRequestItem = { ...request, nextAction: { summary: analystSentence, href: '/app/requests/request-1' } };
    const unlinkedOwnStep: MyRequestItem = { ...answering, nextAction: { summary: 'Answer and submit the questionnaire.' } };
    const closed: MyRequestItem = { ...released, documentId: 'request-4', title: 'Closed vendor review', requestStatus: 'closed', nextAction: null };
    render(<RequestTable requests={[unheldHref, unlinkedOwnStep, closed]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 3 }} densityUserId="requestor" />);

    const table = screen.getByRole('table', { name: 'My assessment requests' });
    const nextStepCell = (title: string) => within(within(table).getByRole('link', { name: title }).closest('tr')!).getAllByRole('cell')[4]!;
    expect(within(nextStepCell('Customer portal review')).queryByRole('link')).not.toBeInTheDocument();
    expect(within(nextStepCell('Payroll platform answers')).getByText('Answer and submit the questionnaire.')).toBeInTheDocument();
    expect(within(nextStepCell('Payroll platform answers')).queryByRole('link')).not.toBeInTheDocument();
    expect(nextStepCell('Closed vendor review')).toHaveTextContent(/^No action needed$/);
  });

  it('reads the holder from the URL and drops a value it does not know (D-34, T-11-28)', () => {
    expect(parseRequestListQuery({ holder: 'requestor' })).toMatchObject({ holder: 'requestor' });
    expect(parseRequestListQuery({ holder: 'analyst' })).toMatchObject({ holder: 'analyst' });
    expect(parseRequestListQuery({ holder: ['none', 'requestor'] })).toMatchObject({ holder: 'none' });
    expect(parseRequestListQuery({ holder: 'another-requestor' }).holder).toBeUndefined();
    expect(parseRequestListQuery({}).holder).toBeUndefined();
  });

  it('filters by who holds the request through the URL, with a Show chip that Clear filters clears (D-34, D-35)', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    search.value = 'q=portal&sort=updatedAt%3Adesc&page=2&pageSize=20';
    const searched = { ...query, status: undefined };
    const view = render(<RequestTable requests={[request]} query={searched} pagination={pagination} densityUserId="requestor" />);

    const show = screen.getByRole('combobox', { name: 'Show' });
    expect([...show.querySelectorAll('option')].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'All requests'],
      ['requestor', 'Needs your action'],
      ['analyst', 'With the Security Analyst'],
      ['none', 'No action needed'],
    ]);
    expect(show).toHaveValue('');

    // Choosing a holder writes it to the URL and returns to the first page.
    await user.selectOptions(show, 'requestor');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?q=portal&holder=requestor&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    view.rerender(<RequestTable requests={[request]} query={{ ...searched, holder: 'requestor' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('combobox', { name: 'Show' })).toHaveValue('requestor');
    expect(screen.getByText('Show: Needs your action')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Show filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?q=portal&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?sort=updatedAt%3Adesc&pageSize=20', { scroll: false });
  });

  it('counts the holder as a filter, so an empty Show view offers Clear filters', async () => {
    const RequestTable = await loadRequestTable();
    render(<RequestTable requests={[]} query={{ ...query, q: '', status: undefined, holder: 'none', page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" />);

    expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toBeInTheDocument();
    expect(screen.getByText('Show: No action needed')).toBeInTheDocument();
  });

  it('reads Updated in the viewer’s time zone, or No update date (D-55)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    const lateEvening: MyRequestItem = { ...request, updatedAt: '2026-09-27T20:00:00.000Z' };
    const undated: MyRequestItem = { ...answering, updatedAt: null };
    render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <RequestTable requests={[lateEvening, undated]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 2 }} densityUserId="requestor" />
      </TimeZoneProvider>,
    );

    const table = screen.getByRole('table', { name: 'My assessment requests' });
    const updatedCell = (title: string) => within(within(table).getByRole('link', { name: title }).closest('tr')!).getAllByRole('cell')[6]!;
    // 20:00 UTC on 27 September is 06:00 on 28 September in Brisbane.
    expect(updatedCell('Customer portal review')).toHaveTextContent(/^Updated 28 Sept 2026$/);
    expect(updatedCell('Customer portal review').querySelector('time')).toHaveAttribute('datetime', '2026-09-27T20:00:00.000Z');
    expect(updatedCell('Payroll platform answers')).toHaveTextContent(/^No update date$/);
  });

  it('shows the holder line and the sentence on the phone card, then the due and update dates (UI-SPEC §7.3)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    const undated: MyRequestItem = { ...answering, dueDate: null, updatedAt: null };
    render(<RequestTable requests={[request, undated]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 2 }} densityUserId="requestor" />);

    const [withAnalyst, yours] = within(screen.getByRole('list', { name: 'My assessment requests' })).getAllByRole('listitem');
    // The number and title with the status badge, then the holder line and the sentence, who holds it, then the dates.
    expect(withAnalyst).toHaveTextContent(new RegExp(
      `^RAR-2026-X7K4Q2Customer portal reviewSubmittedWith the Security Analyst${analystSentence}Not picked up yetDue 12 Sept 2026 · Updated 21 Aug 2026$`,
    ));
    expect(within(withAnalyst!).getByText('With the Security Analyst')).toHaveClass('micro-label', 'text-foreground-secondary');
    expect(within(yours!).getByText('Needs your action')).toBeInTheDocument();
    expect(within(yours!).getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/questionnaire-2');
    expect(yours).toHaveTextContent(/No due date · No update date$/);
  });

  it('names the Security Analyst who holds each request, or says nobody has picked it up yet (D-17, 13-UI-SPEC §12.4)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    render(<RequestTable requests={[heldByBob, request]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 2 }} densityUserId="requestor" />);

    const table = screen.getByRole('table', { name: 'My assessment requests' });
    const analystCell = (title: string) => within(within(table).getByRole('link', { name: title }).closest('tr')!).getAllByRole('cell')[3]!;
    expect(analystCell('Identity platform review')).toHaveTextContent(/^Bob Doe$/);
    expect(analystCell('Customer portal review')).toHaveTextContent(/^Not picked up yet$/);
    expect(within(analystCell('Customer portal review')).getByText('Not picked up yet')).toHaveClass('text-foreground-secondary');
    // The holder's next step names him too, as the server wrote it.
    expect(within(within(table).getByRole('link', { name: 'Identity platform review' }).closest('tr')!).getAllByRole('cell')[4]!)
      .toHaveTextContent('Bob Doe is reviewing your request and will send you a questionnaire to answer.');
  });

  it('flags the Requestor’s new notes under the title with a link to the thread, and nothing at zero (D-24, X-17)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    const many: MyRequestItem = { ...heldByBob, documentId: 'request-6', requestNumber: 'RAR-2026-M4NY01', title: 'Many notes review', unreadNotes: 3 };
    render(<RequestTable requests={[heldByBob, many, request]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 3 }} densityUserId="requestor" />);

    const table = screen.getByRole('table', { name: 'My assessment requests' });
    const titleCell = (title: string) => within(within(table).getByRole('link', { name: title }).closest('tr')!).getAllByRole('cell')[1]!;
    const one = within(titleCell('Identity platform review')).getByRole('link', { name: '1 new note on RAR-2026-B0B5ZQ' });
    expect(one).toHaveTextContent(/^1 new note$/);
    expect(one).toHaveAttribute('href', '/app/requests/request-5#notes');
    expect(within(titleCell('Many notes review')).getByRole('link', { name: '3 new notes on RAR-2026-M4NY01' })).toHaveTextContent(/^3 new notes$/);
    expect(within(titleCell('Customer portal review')).queryByText(/new note/)).not.toBeInTheDocument();
  });

  it('shows who holds the request and the new notes on the phone card, after the holder line (13-UI-SPEC §12.4)', async () => {
    const RequestTable = await loadRequestTable();
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    render(<RequestTable requests={[heldByBob]} query={unfiltered} pagination={{ page: 1, pageSize: 20, pageCount: 1, total: 1 }} densityUserId="requestor" />);

    const [card] = within(screen.getByRole('list', { name: 'My assessment requests' })).getAllByRole('listitem');
    expect(card).toHaveTextContent(new RegExp(
      '^RAR-2026-B0B5ZQIdentity platform reviewSubmittedWith the Security AnalystBob Doe is reviewing your request and will send you a questionnaire to answer.'
      + 'Security Analyst: Bob Doe1 new noteDue 12 Sept 2026 · Updated 21 Aug 2026$',
    ));
    expect(within(card!).getByRole('link', { name: '1 new note on RAR-2026-B0B5ZQ' })).toHaveAttribute('href', '/app/requests/request-5#notes');
  });

  it('reads the notes filter from the URL and drops a value it does not know (D-24, T-11-28)', () => {
    expect(parseRequestListQuery({ notes: 'unread' })).toMatchObject({ notes: 'unread' });
    expect(parseRequestListQuery({ notes: ['unread', 'read'] })).toMatchObject({ notes: 'unread' });
    expect(parseRequestListQuery({ notes: 'read' }).notes).toBeUndefined();
    expect(parseRequestListQuery({}).notes).toBeUndefined();
  });

  it('filters to the requests with new notes through the URL, with a Notes chip that Clear filters clears (D-24)', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    search.value = 'q=portal&holder=analyst&sort=updatedAt%3Adesc&pageSize=20';
    const searched = { ...query, status: undefined, holder: 'analyst' as const };
    const view = render(<RequestTable requests={[heldByBob]} query={searched} pagination={pagination} densityUserId="requestor" />);

    const notes = screen.getByRole('combobox', { name: 'Notes' });
    expect([...notes.querySelectorAll('option')].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'All requests'],
      ['unread', 'With new notes'],
    ]);
    expect(notes).toHaveValue('');

    await user.selectOptions(notes, 'unread');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?q=portal&holder=analyst&notes=unread&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    search.value = 'q=portal&holder=analyst&notes=unread&sort=updatedAt%3Adesc&pageSize=20';
    view.rerender(<RequestTable requests={[heldByBob]} query={{ ...searched, notes: 'unread' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('combobox', { name: 'Notes' })).toHaveValue('unread');
    expect(screen.getByText('Notes: New notes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Notes filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?q=portal&holder=analyst&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?sort=updatedAt%3Adesc&pageSize=20', { scroll: false });
  });

  it('counts the notes filter as a filter, so an empty New notes view offers Clear filters', async () => {
    const RequestTable = await loadRequestTable();
    render(<RequestTable requests={[]} query={{ ...query, q: '', status: undefined, notes: 'unread', page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" />);

    expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toBeInTheDocument();
    expect(screen.getByText('Notes: New notes')).toBeInTheDocument();
  });

  it('reflects canonical date sorting and recovers a stale page', async () => {
    const RequestTable = await loadRequestTable();
    const view = render(<RequestTable requests={[request]} query={{ ...query, sort: 'dueDate:desc' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('columnheader', { name: 'Due date' })).toHaveAttribute('aria-sort', 'descending');

    view.rerender(<RequestTable requests={[]} query={{ ...query, page: 5 }} pagination={{ page: 5, pageSize: 20, pageCount: 2, total: 35 }} densityUserId="requestor" />);
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20', { scroll: false });
    expect(screen.getByRole('status', { name: 'Loading assessment requests' })).toBeInTheDocument();
    expect(screen.queryByText('Create your first assessment request')).not.toBeInTheDocument();
    expect(screen.queryByText('35 results')).not.toBeInTheDocument();
  });

  it('distinguishes first-use, filtered, transport, and permission states', async () => {
    const RequestTable = await loadRequestTable();
    const view = render(<RequestTable requests={[]} query={{ ...query, q: '', status: undefined, page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" state="empty" />);

    expect(screen.getByRole('heading', { name: 'No assessment requests yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/app/requests/new');
    view.rerender(<RequestTable requests={[]} query={{ ...query, page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" state="empty" />);
    expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toBeInTheDocument();
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load assessment requests');
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to assessment requests');
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="loading" />);
    expect(screen.getByRole('status', { name: 'Loading assessment requests' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search requests' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Show' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Notes' })).toBeDisabled();
  });

  it('keeps the route server-owned and validates awaited search parameters', () => {
    const pagePath = resolve(process.cwd(), 'app/(app)/app/requests/(my-requests)/page.tsx');
    if (!existsSync(pagePath)) throw new Error('PHASE2_RED_W0_02B_REQUEST_PAGE_BEHAVIOR_ABSENT');
    const source = readFileSync(pagePath, 'utf8');
    expect(source).toContain('await searchParams');
    expect(source).toContain('parseRequestListQuery');
    // D-34: My requests reads GET /v1/my_requests; the core list read is retired from this page.
    expect(source).toContain('listMyRequests');
    expect(source).not.toMatch(/\blistRequests\b/);
    expect(source).not.toContain("'use client'");
  });
});
