import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const assignmentMocks = vi.hoisted(() => ({ changeAssigneeAction: vi.fn(), successToast: vi.fn(), toastError: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review/assessments',
  useRouter: () => navigationMocks,
}));
vi.mock('@/features/request-assignment/assignment-actions', () => ({ changeAssigneeAction: assignmentMocks.changeAssigneeAction }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: assignmentMocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: assignmentMocks.toastError } }));

afterEach(() => {
  assignmentMocks.changeAssigneeAction.mockReset();
  assignmentMocks.successToast.mockReset();
  assignmentMocks.toastError.mockReset();
  navigationMocks.refresh.mockReset();
});

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { AssessmentList, AssessmentRequestList, AssessmentRequestListHeader, AssessmentRequestListSkeleton, AssignedRequestListHeader } from './assessment-list';
import type { AssessmentRequestQueueItem, AssessmentSummary } from './assessment-schema';

const assessmentRequest: AssessmentRequestQueueItem = {
  documentId: 'request-id',
  requestNumber: 'REQ-0042',
  title: 'Customer portal assessment',
  requestStatus: 'submitted',
  submittedDate: '2026-08-30T01:01:00.000Z',
  requestorName: 'Jane Doe',
  assessmentType: 'BAU',
  businessCriticality: 'Moderate',
  dueDate: '2026-10-15',
  daysSinceSubmission: 2,
  assignee: null,
  pickUp: 'allowed',
  unreadNotes: 0,
};

const viewer = { documentId: 'bob-id', displayName: 'Bob Doe' };

const assessment: AssessmentSummary = {
  documentId: 'assessment/id with spaces',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'draft',
  summary: 'Reviewable deterministic draft.',
  overallRating: 'High',
  generatedDate: '2026-08-30T01:01:00.000Z',
  generatedBy: { documentId: 'bob-id', displayName: 'Bob Doe' },
  approvalDate: null,
  requestTitle: 'Customer portal assessment',
  riskCount: 0,
  highestResidualRating: null,
};

/* W-3: a refused list is the page header (the route's) and the permission state alone, as the Risk Register's is. */
function expectOnlyTheRefusal(heading: string) {
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText(/^Queue:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^\d+ results?$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(Previous page|Next page|Use (compact|default) density)$/ })).not.toBeInTheDocument();
}

describe('the analyst review lists refused to their reader', () => {
  it('shows only the refusal on the assessment request queue', () => {
    render(<AssessmentRequestList requests={[assessmentRequest]} state="permission" />);
    expectOnlyTheRefusal('You don’t have access to assessment requests');
    expect(screen.queryByText(assessmentRequest.title)).not.toBeInTheDocument();
  });

  it('shows only the refusal on the risk assessment list', () => {
    render(<AssessmentList assessments={[assessment]} state="permission" />);
    expectOnlyTheRefusal('You don’t have access to risk assessments');
    expect(screen.queryByText(assessment.assessmentNumber)).not.toBeInTheDocument();
  });
});

/*
 * Verdict 4a: both analyst review lists show the direction's filter chips (section 4 DataTable) for their status and
 * search filters, so a filtered list never looks, or prints, like an unfiltered one. The queue has its own line.
 */
describe('filter chips on the analyst review lists', () => {
  it('shows the status and search of the request queue as chips, each removable', () => {
    navigationMocks.replace.mockClear();
    render(<AssessmentRequestList query={{ q: 'portal', queue: 'released', sort: 'submittedDate:desc', page: 1, pageSize: 25, status: 'approved' }} requests={[assessmentRequest]} />);

    expect(screen.getByText('Search: portal')).toBeInTheDocument();
    expect(screen.getByText('Status: Released')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Status filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?q=portal&queue=released&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Search filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?status=approved&queue=released&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
    // The chips' Clear filters clears what the chips show and keeps the chosen queue.
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?queue=released&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
  });

  it('shows the status of the risk assessment list by its label, Released for approved', () => {
    render(<AssessmentList assessments={[assessment]} query={{ q: 'vendor', sort: 'generatedDate:desc', page: 1, pageSize: 25, status: 'approved' }} />);

    expect(screen.getByText('Search: vendor')).toBeInTheDocument();
    expect(screen.getByText('Status: Released')).toBeInTheDocument();
    expect(screen.queryByText('Status: approved')).not.toBeInTheDocument();
  });

  it('shows no chip while no filter is active', () => {
    render(<AssessmentList assessments={[assessment]} />);
    expect(screen.queryByText(/^(Status|Search): /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('assessment review list record navigation', () => {
  it('uses the encoded identifier as the only record opener in card and table variants', () => {
    const { container } = render(<AssessmentList assessments={[assessment]} />);
    const links = screen.getAllByRole('link', { name: 'ASM-0042' });

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/app/review/assessments/assessment%2Fid%20with%20spaces');
      expect(link).toHaveClass('record-link');
    }
    expect(screen.queryByRole('link', { name: /open asm-0042/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Customer portal assessment').every((title) => title.closest('a') === null)).toBe(true);
    expect(container.querySelectorAll('tr[tabindex], [role="listitem"][tabindex]')).toHaveLength(0);
    expect(container.querySelectorAll('tr[role="link"], [role="listitem"][role="link"]')).toHaveLength(0);
  });

  it('uses the shared micro-label token for both desktop table headers', () => {
    const { container } = render(
      <>
        <AssessmentRequestList requests={[assessmentRequest]} />
        <AssessmentList assessments={[assessment]} />
      </>,
    );

    const headers = container.querySelectorAll('th');
    // Nine triage columns and Assigned to on the request queue (D-29; 13-12), seven on the risk assessment list (D-31).
    expect(headers).toHaveLength(17);
    for (const header of headers) {
      expect(header).toHaveClass(
        'font-mono',
        'text-[length:var(--text-micro-size)]',
        'font-normal',
        'uppercase',
        'tracking-[var(--tracking-micro)]',
        'text-muted-foreground',
      );
      expect(header).not.toHaveClass('text-xs', 'tracking-wide');
    }
  });

  it('clears request filters to the request collection default sort', () => {
    render(
      <AssessmentRequestList
        query={{
          q: 'portal',
          queue: 'requires-attention',
          sort: 'submittedDate:desc',
          page: 2,
          pageSize: 25,
          status: 'submitted',
        }}
        requests={[]}
      />,
    );

    // The empty state's Clear filters; the chip row above the table offers its own (verdict 4a).
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-state-kind="empty"]')!).getByRole('button', { name: 'Clear filters' }));

    expect(navigationMocks.replace).toHaveBeenCalledWith(
      '/app/review/assessments?sort=submittedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('names and navigates the analyst queue buckets', () => {
    render(<AssessmentRequestList requests={[]} />);

    expect(screen.getByText('Queue:')).toHaveTextContent('Requires attention');
    expect(screen.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by queue' }), { target: { value: 'released' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?queue=released&sort=submittedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('offers released statuses and a return to the default queue when empty', () => {
    render(<AssessmentRequestList query={{ q: '', queue: 'released', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[]} />);

    // The queue select has its own Released bucket, so the request status options are read inside their select.
    const statusFilter = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(within(statusFilter).getByRole('option', { name: 'Released' })).toHaveValue('approved');
    expect(within(statusFilter).getByRole('option', { name: 'Closed' })).toBeInTheDocument();
    expect(screen.getByText('No assessment requests match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?sort=submittedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('keeps complete human-readable request statuses independent of queue and applies shared select focus treatment', () => {
    const { rerender } = render(<AssessmentRequestList requests={[]} />);
    const expectedLabels = ['Draft', 'Submitted', 'Questionnaire in progress', 'Risk assessment drafted', 'Under review', 'Released', 'Closed'];
    const statusOptions = () => [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')].slice(1).map((option) => option.textContent);

    expect(statusOptions()).toEqual(expectedLabels);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveClass('focus-visible:ring-ring');
    expect(screen.getByRole('combobox', { name: 'Filter by queue' })).toHaveClass('focus-visible:ring-ring');

    rerender(<AssessmentRequestList query={{ q: '', queue: 'released', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[]} />);
    expect(statusOptions()).toEqual(expectedLabels);
  });

  it('names each search input after the records it searches, visible label and name alike (D-30)', () => {
    // The retired generic label, in any capitalisation.
    const genericSearchLabel = /search collection/i;
    const view = render(<AssessmentRequestList requests={[]} />);
    // The queue search matches the request number or the title (D-30, UI-SPEC §7.1).
    const requestSearch = screen.getByRole('searchbox', { name: 'Search by number or title' });
    expect(requestSearch.closest('label')?.firstChild?.textContent).toBe('Search by number or title');
    expect(screen.queryByText(genericSearchLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: genericSearchLabel })).not.toBeInTheDocument();
    view.unmount();

    render(<AssessmentList assessments={[]} />);
    const assessmentSearch = screen.getByRole('searchbox', { name: 'Search risk assessments' });
    expect(assessmentSearch.closest('label')?.firstChild?.textContent).toBe('Search risk assessments');
    expect(screen.queryByText(genericSearchLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: genericSearchLabel })).not.toBeInTheDocument();
  });

  it('offers all labelled assessment statuses, the released one as Released', () => {
    render(<AssessmentList assessments={[]} />);

    const options = [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')];
    expect(options.map((option) => option.textContent)).toEqual([
      'All statuses', 'Draft', 'In review', 'Released', 'Closed',
    ]);
    // Only the label changes: the stored value and query parameter stay approved.
    expect(options.map((option) => option.value)).toEqual(['', 'draft', 'in-review', 'approved', 'closed']);
  });

  it('shows each risk assessment status through the shared tinted badge in the table and the cards', () => {
    const released: AssessmentSummary = { ...assessment, documentId: 'released-id', assessmentNumber: 'ASM-0043', assessmentStatus: 'approved' };
    const { container } = render(<AssessmentList assessments={[assessment, released]} />);

    for (const slot of ['data-table-desktop', 'data-table-mobile']) {
      const surface = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
      expect(surface, slot).not.toBeNull();
      const badges = [...(surface as HTMLElement).querySelectorAll<HTMLElement>('[data-slot="badge"]')];
      expect(badges.map((badge) => [badge.textContent, badge.dataset.tone, badge.dataset.variant]), slot).toEqual([
        ['Draft', 'warning', 'warning'],
        ['Released', 'success', 'success'],
      ]);
      for (const badge of badges) expect(badge.querySelectorAll('svg'), `${slot} ${badge.textContent}`).toHaveLength(1);
    }
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('keeps the request badges on the request review list, in the submitted success tone', () => {
    const { container } = render(<AssessmentRequestList requests={[assessmentRequest]} />);

    const badges = [...container.querySelectorAll<HTMLElement>('[data-slot="badge"]')];
    expect(badges).toHaveLength(2);
    for (const badge of badges) {
      expect(badge).toHaveTextContent('Submitted');
      expect(badge).toHaveAttribute('data-tone', 'success');
    }
  });
});

/*
 * D-29 and UI-SPEC §7.1: the request queue shows the facts the analyst triages by, all from the server. Business
 * criticality is a business attribute in plain text, never the risk severity badge (UI-D27); the age is the server's
 * daysSinceSubmission; the submission instant reads in the viewer's time zone and the due date as its calendar day (D-55).
 */
describe('the request queue triage columns', () => {
  const triageRequest: AssessmentRequestQueueItem = {
    documentId: 'triage-id',
    requestNumber: 'RAR-2026-TRIAGE',
    title: 'Customer portal',
    requestStatus: 'submitted',
    submittedDate: '2026-09-27T23:30:00.000Z',
    requestorName: 'Jane Requestor',
    assessmentType: 'Project',
    businessCriticality: 'High',
    dueDate: '2026-10-30',
    daysSinceSubmission: 4,
    assignee: null,
    pickUp: 'not-offered',
    unreadNotes: 0,
  };

  function desktopRows(container: HTMLElement) {
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]');
    expect(table).not.toBeNull();
    return within(table as HTMLElement).getAllByRole('row').slice(1);
  }

  const cellTexts = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

  it('heads the ten columns in order, Assigned to after Status (13-UI-SPEC §2.2)', () => {
    const { container } = render(<AssessmentRequestList requests={[triageRequest]} />);
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Request', 'Title', 'Requestor', 'Assessment type', 'Business criticality', 'Status', 'Assigned to', 'Due date', 'Age', 'Submitted',
    ]);
  });

  it('shows who asked, what kind, how critical, when due, how old and when submitted, in the viewer’s zone', () => {
    const { container } = render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <AssessmentRequestList requests={[triageRequest]} />
      </TimeZoneProvider>,
    );
    const [row] = desktopRows(container);

    expect(cellTexts(row)).toEqual([
      'RAR-2026-TRIAGE', 'Customer portal', 'Jane Requestor', 'Project', 'High', 'Submitted', 'Not picked up', '30 Oct 2026', '4 days', '28 Sept 2026',
    ]);
    const cells = within(row).getAllByRole('cell');
    expect(cells[4].querySelector('[data-slot="badge"]'), 'business criticality is plain text').toBeNull();
    expect(cells[4].querySelector('svg')).toBeNull();
    expect(cells[9].querySelector('time')).toHaveAttribute('dateTime', '2026-09-27T23:30:00.000Z');
  });

  it('writes the age out in days, zero and one included', () => {
    const { container } = render(
      <AssessmentRequestList
        requests={[
          { ...triageRequest, documentId: 'today', requestNumber: 'RAR-2026-TODAY', daysSinceSubmission: 0 },
          { ...triageRequest, documentId: 'yesterday', requestNumber: 'RAR-2026-YESTERDAY', daysSinceSubmission: 1 },
        ]}
      />,
    );

    expect(desktopRows(container).map((row) => cellTexts(row)[8])).toEqual(['0 days', '1 day']);
  });

  it('reads Not recorded or Not provided for each fact the request does not carry', () => {
    const { container } = render(
      <AssessmentRequestList
        requests={[{
          ...triageRequest,
          submittedDate: null,
          requestorName: null,
          assessmentType: null,
          businessCriticality: null,
          dueDate: null,
          daysSinceSubmission: null,
        }]}
      />,
    );
    const [row] = desktopRows(container);

    expect(cellTexts(row).slice(2)).toEqual([
      'Not recorded', 'Not provided', 'Not provided', 'Submitted', 'Not picked up', 'Not provided', 'Not recorded', 'Not recorded',
    ]);
  });

  it('sorts by request, title, status, due date and submission, where the server sorts, and not by age', () => {
    navigationMocks.replace.mockClear();
    render(<AssessmentRequestList requests={[triageRequest]} />);

    for (const header of ['Request', 'Title', 'Status', 'Due date', 'Submitted']) {
      expect(screen.getByRole('button', { name: `Sort by ${header}` })).toBeInTheDocument();
    }
    for (const header of ['Requestor', 'Assessment type', 'Business criticality', 'Assigned to', 'Age']) {
      expect(screen.queryByRole('button', { name: `Sort by ${header}` })).not.toBeInTheDocument();
    }
    // The default order is the newest submission first.
    expect(screen.getByRole('columnheader', { name: /Submitted/ })).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: 'Sort by Due date' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?sort=dueDate%3Aasc&pageSize=25',
      { scroll: false },
    );
  });
});

/*
 * D-30 and UI-SPEC §7.1: All requests lists every request in review scope, and on a phone each request is a card
 * with the triage facts: the number with its status, the title, who asked and when it is due, and its age.
 */
describe('the request queue views and phone cards', () => {
  const cardRequest: AssessmentRequestQueueItem = {
    documentId: 'card-id',
    requestNumber: 'RAR-2026-CARD',
    title: 'Customer portal',
    requestStatus: 'submitted',
    submittedDate: '2026-09-27T23:30:00.000Z',
    requestorName: 'Jane Requestor',
    assessmentType: 'Project',
    businessCriticality: 'High',
    dueDate: '2026-10-30',
    daysSinceSubmission: 4,
    assignee: null,
    pickUp: 'not-offered',
    unreadNotes: 0,
  };

  function mobileCards(container: HTMLElement) {
    const list = container.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    expect(list).not.toBeNull();
    return [...(list as HTMLElement).querySelectorAll<HTMLElement>('article')];
  }

  it('offers All requests after the other queues, and names it above the controls when chosen', () => {
    navigationMocks.replace.mockClear();
    const { rerender } = render(<AssessmentRequestList requests={[]} />);
    const queue = screen.getByRole('combobox', { name: 'Filter by queue' });

    expect([...queue.querySelectorAll('option')].map((option) => [option.textContent, option.value])).toEqual([
      ['Requires attention', 'requires-attention'],
      ['Awaiting Requestor', 'awaiting-requestor'],
      ['Generation in progress', 'generation-in-progress'],
      ['All open', 'open'],
      ['Released', 'released'],
      ['All requests', 'all'],
    ]);
    fireEvent.change(queue, { target: { value: 'all' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?queue=all&sort=submittedDate%3Adesc&pageSize=25',
      { scroll: false },
    );

    rerender(<AssessmentRequestList query={{ q: '', queue: 'all', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[cardRequest]} />);
    expect(screen.getByText('Queue:')).toHaveTextContent('Queue: All requests');
    expect(screen.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('all');
  });

  it('shows the number with its status, the title, who holds it, who asked with the due date, and the age on each card', () => {
    const { container } = render(<AssessmentRequestList requests={[cardRequest]} />);
    const [card] = mobileCards(container);
    const lines = [...card.children] as HTMLElement[];

    expect(lines).toHaveLength(5);
    expect(within(lines[0]).getByRole('link', { name: 'RAR-2026-CARD' })).toHaveAttribute('href', '/app/review/requests/card-id');
    expect(within(lines[0]).getByText('Submitted').closest('[data-slot="badge"]')).not.toBeNull();
    expect(within(lines[1]).getByRole('link', { name: 'Customer portal' })).toHaveAttribute('href', '/app/review/requests/card-id');
    expect(lines[2]).toHaveTextContent(/^Not picked up$/);
    expect(lines[3]).toHaveTextContent(/^Jane Requestor · Due 30 Oct 2026$/);
    expect(lines[4]).toHaveTextContent(/^Age 4 days$/);
  });

  it('says No due date, and Not recorded for a missing requestor or age, on a card', () => {
    const { container } = render(
      <AssessmentRequestList
        requests={[
          { ...cardRequest, documentId: 'bare', requestNumber: 'RAR-2026-BARE', requestorName: null, dueDate: null, daysSinceSubmission: null },
          { ...cardRequest, documentId: 'new', requestNumber: 'RAR-2026-NEW', dueDate: null, daysSinceSubmission: 1 },
        ]}
      />,
    );
    const [bare, recent] = mobileCards(container).map((card) => [...card.children] as HTMLElement[]);

    expect(bare[3]).toHaveTextContent(/^Not recorded · No due date$/);
    expect(bare[4]).toHaveTextContent(/^Age not recorded$/);
    expect(recent[3]).toHaveTextContent(/^Jane Requestor · No due date$/);
    expect(recent[4]).toHaveTextContent(/^Age 1 day$/);
  });
});

/*
 * 13-UI-SPEC §2.2, §2.3 and §7 (D-13, D-16, D-07): the Requests queue names who holds each request in an Assigned to
 * column after Status, offers Pick up where Strapi says this viewer may take it, and says You raised it on the viewer's
 * own request. The server's pickUp decides; the web never infers it.
 */
describe('the Assigned to column and Pick up on the Requests queue', () => {
  const base: AssessmentRequestQueueItem = {
    documentId: 'held-id',
    requestNumber: 'RAR-2026-HELD',
    title: 'Held request',
    requestStatus: 'submitted',
    submittedDate: '2026-09-27T23:30:00.000Z',
    requestorName: 'Jane Requestor',
    assessmentType: 'Project',
    businessCriticality: 'High',
    dueDate: '2026-10-30',
    daysSinceSubmission: 4,
    assignee: { documentId: 'sam-id', displayName: 'Sam Analyst' },
    pickUp: 'not-offered',
    unreadNotes: 0,
  };
  const open: AssessmentRequestQueueItem = { ...base, documentId: 'open-id', requestNumber: 'RAR-2026-OPEN', assignee: null, pickUp: 'allowed' };
  const waiting: AssessmentRequestQueueItem = { ...base, documentId: 'waiting-id', requestNumber: 'RAR-2026-WAIT', assignee: null, pickUp: 'not-offered' };
  const own: AssessmentRequestQueueItem = { ...base, documentId: 'own-id', requestNumber: 'RAR-2026-OWN', assignee: null, pickUp: 'own-request' };

  const assignedCell = (container: HTMLElement, requestNumber: string) => {
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;
    const row = within(table).getByRole('link', { name: requestNumber }).closest('tr') as HTMLElement;
    return within(row).getAllByRole('cell')[6];
  };
  const card = (container: HTMLElement, requestNumber: string) => {
    const list = container.querySelector<HTMLElement>('[data-slot="data-table-mobile"]') as HTMLElement;
    return within(list).getByRole('link', { name: requestNumber }).closest('article') as HTMLElement;
  };

  it('shows the holder’s name, Pick up, Not picked up, and You raised it on the viewer’s own request', () => {
    const { container } = render(<AssessmentRequestList requests={[base, open, waiting, own]} viewer={viewer} />);

    expect(assignedCell(container, 'RAR-2026-HELD')).toHaveTextContent(/^Sam Analyst$/);
    expect(within(assignedCell(container, 'RAR-2026-OPEN')).getByRole('button', { name: 'Pick up RAR-2026-OPEN' })).toHaveTextContent('Pick up');
    expect(assignedCell(container, 'RAR-2026-WAIT')).toHaveTextContent(/^Not picked up$/);
    expect(within(assignedCell(container, 'RAR-2026-WAIT')).queryByRole('button')).not.toBeInTheDocument();
    const ownCell = assignedCell(container, 'RAR-2026-OWN');
    expect(within(ownCell).getByText('Not picked up')).toBeInTheDocument();
    expect(within(ownCell).getByText('You raised it')).toBeInTheDocument();
    expect(within(ownCell).queryByRole('button')).not.toBeInTheDocument();
  });

  it('says who holds the request on each card, with a full-width Pick up as the card’s last element', () => {
    const { container } = render(<AssessmentRequestList requests={[base, open, own]} viewer={viewer} />);

    expect(card(container, 'RAR-2026-HELD')).toHaveTextContent('Assigned to Sam Analyst');
    const openCard = card(container, 'RAR-2026-OPEN');
    expect(openCard).toHaveTextContent('Not picked up');
    const pickUp = within(openCard).getByRole('button', { name: 'Pick up RAR-2026-OPEN' });
    expect(pickUp.className).toMatch(/\bw-full\b/);
    expect(openCard.lastElementChild?.contains(pickUp)).toBe(true);
    expect(card(container, 'RAR-2026-OWN')).toHaveTextContent('You raised it');
    expect(within(card(container, 'RAR-2026-OWN')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('picks the request up from its row with the viewer’s name shown at once and an Undo toast', async () => {
    const user = userEvent.setup();
    assignmentMocks.changeAssigneeAction.mockResolvedValueOnce({
      ok: true,
      data: { assignee: viewer, assignedBy: viewer, assignedAt: '2026-10-09T01:02:03.000Z', actions: ['reassign', 'unassign'], ownRequest: false, history: [], viewer },
    });
    const { container } = render(<AssessmentRequestList requests={[open]} viewer={viewer} />);

    await user.click(within(assignedCell(container, 'RAR-2026-OPEN')).getByRole('button', { name: 'Pick up RAR-2026-OPEN' }));
    expect(assignedCell(container, 'RAR-2026-OPEN')).toHaveTextContent('Bob Doe');
    expect(assignmentMocks.changeAssigneeAction).toHaveBeenCalledWith({ requestId: 'open-id', requestNumber: 'RAR-2026-OPEN', analyst: 'bob-id', expectedAnalyst: null });
    await waitFor(() => expect(assignmentMocks.successToast).toHaveBeenCalledWith('You picked up RAR-2026-OPEN.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    await act(async () => undefined);
  });

  it('offers no Pick up without a viewer the read named, and hides the column where the view asks', () => {
    const { container, rerender } = render(<AssessmentRequestList requests={[open]} />);
    expect(within(assignedCell(container, 'RAR-2026-OPEN')).queryByRole('button')).not.toBeInTheDocument();
    expect(assignedCell(container, 'RAR-2026-OPEN')).toHaveTextContent(/^Not picked up$/);

    rerender(<AssessmentRequestList requests={[open]} showAssignee={false} viewer={viewer} />);
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;
    expect(within(table).queryByRole('columnheader', { name: 'Assigned to' })).not.toBeInTheDocument();
  });
});

/*
 * 13-UI-SPEC §2.2 and §16 U2 (D-13, D-24; UI-D9, UI-D10, UI-D30): Requests filters by who holds a request and by new
 * notes, each with its chip; All open joins the queue select; Requires attention drops "my"; an unread line under the
 * title opens the request's notes; and the description says the queue is the team's pick-up pool.
 */
describe('the Requests queue filters, unread line and labels (13-12)', () => {
  const base: AssessmentRequestQueueItem = {
    documentId: 'unread-id',
    requestNumber: 'RAR-2026-NOTES',
    title: 'Vendor support platform',
    requestStatus: 'submitted',
    submittedDate: '2026-09-27T23:30:00.000Z',
    requestorName: 'Jane Requestor',
    assessmentType: 'Project',
    businessCriticality: 'High',
    dueDate: '2026-10-30',
    daysSinceSubmission: 4,
    assignee: null,
    pickUp: 'allowed',
    unreadNotes: 2,
  };
  const defaults = { q: '', queue: 'requires-attention' as const, sort: 'submittedDate:desc' as const, page: 1, pageSize: 25 as const };

  it('names the default queue Requires attention and offers All open between Generation in progress and Released', () => {
    render(<AssessmentRequestList requests={[]} />);
    expect(screen.getByText('Queue:')).toHaveTextContent('Queue: Requires attention');
    expect([...screen.getByRole('combobox', { name: 'Filter by queue' }).querySelectorAll('option')].map((option) => [option.textContent, option.value])).toEqual([
      ['Requires attention', 'requires-attention'],
      ['Awaiting Requestor', 'awaiting-requestor'],
      ['Generation in progress', 'generation-in-progress'],
      ['All open', 'open'],
      ['Released', 'released'],
      ['All requests', 'all'],
    ]);
  });

  it('describes Requests as the team’s submitted requests to pick up', () => {
    render(<AssessmentRequestListHeader />);
    expect(screen.getByText('Submitted requests across the team. Pick up a request to make it yours.')).toBeInTheDocument();
    expect(screen.queryByText('Review submitted requests and start draft generation.')).not.toBeInTheDocument();
  });

  it('filters by Assigned to and Notes, each shown as a removable chip', () => {
    navigationMocks.replace.mockClear();
    const { rerender } = render(<AssessmentRequestList query={defaults} requests={[base]} viewer={viewer} />);

    const assignedTo = screen.getByRole('combobox', { name: 'Assigned to' });
    expect([...assignedTo.querySelectorAll('option')].map((option) => [option.textContent, option.value])).toEqual([
      ['Anyone', ''], ['Me', 'me'], ['Not picked up', 'unassigned'],
    ]);
    fireEvent.change(assignedTo, { target: { value: 'unassigned' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?assignee=unassigned&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });

    const notes = screen.getByRole('combobox', { name: 'Notes' });
    expect([...notes.querySelectorAll('option')].map((option) => [option.textContent, option.value])).toEqual([
      ['All requests', ''], ['With new notes', 'unread'],
    ]);
    fireEvent.change(notes, { target: { value: 'unread' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?notes=unread&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });

    rerender(<AssessmentRequestList query={{ ...defaults, queue: 'open', assignee: 'me', notes: 'unread' }} requests={[base]} viewer={viewer} />);
    expect(screen.getByRole('combobox', { name: 'Assigned to' })).toHaveValue('me');
    expect(screen.getByRole('combobox', { name: 'Notes' })).toHaveValue('unread');
    expect(screen.getByText('Assigned to: Me')).toBeInTheDocument();
    expect(screen.getByText('Notes: New notes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Assigned to filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?queue=open&notes=unread&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Notes filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?queue=open&assignee=me&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });

    rerender(<AssessmentRequestList query={{ ...defaults, assignee: 'unassigned' }} requests={[base]} viewer={viewer} />);
    expect(screen.getByText('Assigned to: Not picked up')).toBeInTheDocument();
  });

  it('clears the Assigned to and Notes filters with the rest, and counts them as filters when the list is empty', () => {
    navigationMocks.replace.mockClear();
    const { rerender } = render(<AssessmentRequestList query={{ ...defaults, queue: 'open', assignee: 'me', notes: 'unread', q: 'vendor' }} requests={[base]} viewer={viewer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?queue=open&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });

    rerender(<AssessmentRequestList query={{ ...defaults, notes: 'unread' }} requests={[]} viewer={viewer} />);
    expect(screen.getByText('No assessment requests match these filters')).toBeInTheDocument();
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-state-kind="empty"]')!).getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
  });

  it('shows the new notes under the title, outside its clamp, as a link to the request’s notes', () => {
    const { container } = render(<AssessmentRequestList requests={[base, { ...base, documentId: 'one-id', requestNumber: 'RAR-2026-ONE', unreadNotes: 1 }, { ...base, documentId: 'none-id', requestNumber: 'RAR-2026-NONE', unreadNotes: 0 }]} viewer={viewer} />);
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;
    const titleCell = (requestNumber: string) => within(within(table).getByRole('link', { name: requestNumber }).closest('tr') as HTMLElement).getAllByRole('cell')[1];

    const two = within(titleCell('RAR-2026-NOTES')).getByRole('link', { name: '2 new notes on RAR-2026-NOTES' });
    expect(two).toHaveAttribute('href', '/app/review/requests/unread-id#notes');
    expect(two).toHaveTextContent(/^2 new notes$/);
    expect(two.closest('.line-clamp-2')).toBeNull();
    expect(within(titleCell('RAR-2026-ONE')).getByRole('link', { name: '1 new note on RAR-2026-ONE' })).toHaveTextContent(/^1 new note$/);
    expect(within(titleCell('RAR-2026-NONE')).queryByText(/new note/)).not.toBeInTheDocument();
  });

  it('shows the unread line, then who holds the request, after the title on a card, with Pick up last', () => {
    const { container } = render(<AssessmentRequestList requests={[base]} viewer={viewer} />);
    const list = container.querySelector<HTMLElement>('[data-slot="data-table-mobile"]') as HTMLElement;
    const card = list.querySelector('article') as HTMLElement;
    const lines = [...card.children] as HTMLElement[];

    expect(within(lines[2]).getByRole('link', { name: '2 new notes on RAR-2026-NOTES' })).toHaveAttribute('href', '/app/review/requests/unread-id#notes');
    expect(lines[3]).toHaveTextContent(/^Not picked up$/);
    expect(lines[4]).toHaveTextContent(/^Jane Requestor · Due 30 Oct 2026$/);
    expect(lines[5]).toHaveTextContent(/^Age 4 days$/);
    expect(within(lines[6]).queryByRole('button') ?? lines[6]).toHaveAccessibleName('Pick up RAR-2026-NOTES');
    expect(lines).toHaveLength(7);
  });
});

/*
 * D-31 and UI-SPEC §7.2: the risk assessment list identifies each assessment by its request's title and shows how much
 * risk it holds: the server's Risk count and highest residual rating, the severity badge with its text and icon. The
 * release instant reads in the viewer's zone (D-55).
 */
describe('the risk assessment list columns', () => {
  const rated: AssessmentSummary = {
    documentId: 'rated-id',
    assessmentNumber: 'ASM-2026-2XX26G',
    assessmentStatus: 'approved',
    summary: 'Summary no longer shown in the list.',
    overallRating: 'High',
    generatedDate: '2026-09-20T01:00:00.000Z',
    generatedBy: { documentId: 'bob-id', displayName: 'Bob Doe' },
    approvalDate: '2026-09-26T23:30:00.000Z',
    requestTitle: 'UAT-A: Brightwage People cloud HR and payroll platform',
    riskCount: 4,
    highestResidualRating: 'Critical',
  };
  const bare: AssessmentSummary = {
    ...rated,
    documentId: 'bare-id',
    assessmentNumber: 'ASM-2026-BARE',
    assessmentStatus: 'draft',
    generatedBy: null,
    approvalDate: null,
    requestTitle: null,
    riskCount: 0,
    highestResidualRating: null,
  };

  function desktopRows(container: HTMLElement) {
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]');
    expect(table).not.toBeNull();
    return within(table as HTMLElement).getAllByRole('row').slice(1);
  }

  function mobileCards(container: HTMLElement) {
    const list = container.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    expect(list).not.toBeNull();
    return [...(list as HTMLElement).querySelectorAll<HTMLElement>('article')];
  }

  const cellTexts = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

  it('heads the seven columns in order, Request title in place of Summary', () => {
    const { container } = render(<AssessmentList assessments={[rated]} />);
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Assessment', 'Request title', 'Status', 'Risks', 'Highest residual rating', 'Draft initiated by', 'Released',
    ]);
    expect(screen.queryByText('Summary no longer shown in the list.')).not.toBeInTheDocument();
  });

  it('shows the request title, the Risk count, the highest residual rating and the local release date', () => {
    const { container } = render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <AssessmentList assessments={[rated]} />
      </TimeZoneProvider>,
    );
    const [row] = desktopRows(container);

    expect(cellTexts(row)).toEqual([
      'ASM-2026-2XX26G', 'UAT-A: Brightwage People cloud HR and payroll platform', 'Released', '4', 'Critical', 'Bob Doe', '27 Sept 2026',
    ]);
    const cells = within(row).getAllByRole('cell');
    const rating = within(cells[4]).getByLabelText('Severity: critical (4 of 4)');
    expect(rating.closest('[data-slot="badge"]')).not.toBeNull();
    expect(rating.querySelectorAll('svg')).toHaveLength(1);
    expect(within(cells[6]).getByText('27 Sept 2026').tagName).toBe('TIME');
  });

  it('wraps the request title as a long-text column, clamped to two lines with its full text in the DOM', () => {
    const { container } = render(<AssessmentList assessments={[rated]} />);
    const [row] = desktopRows(container);
    const title = within(row).getAllByRole('cell')[1];

    expect(title).toHaveClass('whitespace-normal');
    expect(within(title).getByText('UAT-A: Brightwage People cloud HR and payroll platform')).toHaveClass('line-clamp-2');
  });

  it('reads Not recorded, Not rated and Not released for each fact an assessment does not carry', () => {
    const { container } = render(<AssessmentList assessments={[bare]} />);
    const [row] = desktopRows(container);

    expect(cellTexts(row)).toEqual(['ASM-2026-BARE', 'Not recorded', 'Draft', '0', 'Not rated', 'Not recorded', 'Not released']);
  });

  it('shows the number with its status, the request title, the Risks with the highest residual rating, who drafted it and when it was released on each card', () => {
    const { container } = render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <AssessmentList
          assessments={[
            rated,
            { ...rated, documentId: 'one-id', assessmentNumber: 'ASM-2026-ONE', riskCount: 1, highestResidualRating: 'Low' },
            { ...rated, documentId: 'unrated-id', assessmentNumber: 'ASM-2026-UNRATED', riskCount: 2, highestResidualRating: null },
            bare,
          ]}
        />
      </TimeZoneProvider>,
    );
    const [first, one, unrated, empty] = mobileCards(container).map((card) => [...card.children] as HTMLElement[]);

    expect(first).toHaveLength(5);
    expect(within(first[0]).getByRole('link', { name: 'ASM-2026-2XX26G' })).toHaveAttribute('href', '/app/review/assessments/rated-id');
    expect(within(first[0]).getByText('Released').closest('[data-slot="badge"]')).not.toBeNull();
    expect(first[1]).toHaveTextContent(/^UAT-A: Brightwage People cloud HR and payroll platform$/);
    expect(first[2]).toHaveTextContent(/^4 Risks · Highest residual Critical$/);
    expect(within(first[2]).getByLabelText('Severity: critical (4 of 4)')).toBeInTheDocument();
    expect(first[3]).toHaveTextContent(/^Draft initiated by Bob Doe$/);
    expect(first[4]).toHaveTextContent(/^Released 27 Sept 2026$/);
    expect(one[2]).toHaveTextContent(/^1 Risk · Highest residual Low$/);
    expect(unrated[2]).toHaveTextContent(/^2 Risks · Highest residual Not rated$/);

    expect(empty).toHaveLength(4);
    expect(empty[1]).toHaveTextContent(/^Not recorded$/);
    expect(empty[2]).toHaveTextContent(/^No Risks yet$/);
    expect(empty[3]).toHaveTextContent(/^Draft initiated by Not recorded$/);
  });
});

/*
 * UI-SPEC §7.2 and UI-D30: the risk assessment list narrows by overall rating through a select, and by the released
 * date range only through removable chips (the throughput figures set it). Clear filters clears every one of them.
 */
describe('the risk assessment list filters', () => {
  const filtered = { q: '', sort: 'generatedDate:desc' as const, page: 1, pageSize: 25 as const, overallRating: 'High' as const, approvedFrom: '2026-09-01', approvedTo: '2026-09-30' };

  it('offers an Overall rating select with All ratings and the four ratings, and filters by the one chosen', () => {
    navigationMocks.replace.mockClear();
    render(<AssessmentList assessments={[assessment]} />);
    const rating = screen.getByRole('combobox', { name: 'Filter by overall rating' });

    expect(rating.closest('label')?.firstChild?.textContent).toBe('Overall rating');
    expect([...rating.querySelectorAll('option')].map((option) => [option.textContent, option.value])).toEqual([
      ['All ratings', ''], ['Low', 'Low'], ['Moderate', 'Moderate'], ['High', 'High'], ['Critical', 'Critical'],
    ]);
    fireEvent.change(rating, { target: { value: 'High' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?overallRating=High&sort=generatedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('shows the overall rating and the released date range as chips, with no visible date control', () => {
    render(<AssessmentList assessments={[assessment]} query={filtered} />);

    expect(screen.getByRole('combobox', { name: 'Filter by overall rating' })).toHaveValue('High');
    expect(screen.getByRole('button', { name: 'Remove Overall rating filter' }).parentElement).toHaveTextContent('Overall rating: High');
    expect(screen.getByRole('button', { name: 'Remove Released from (UTC) filter' }).parentElement).toHaveTextContent('Released from (UTC): 1 Sept 2026');
    expect(screen.getByRole('button', { name: 'Remove Released to (UTC) filter' }).parentElement).toHaveTextContent('Released to (UTC): 30 Sept 2026');
    expect(screen.queryByLabelText(/^Released (from|to)$/)).not.toBeInTheDocument();
  });

  it('removes each chip alone, keeps the others on every navigation, and clears all of them together', () => {
    navigationMocks.replace.mockClear();
    render(<AssessmentList assessments={[assessment]} pagination={{ page: 1, pageSize: 25, pageCount: 2, total: 26 }} query={filtered} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Released from (UTC) filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?overallRating=High&approvedTo=2026-09-30&sort=generatedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Overall rating filter' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?approvedFrom=2026-09-01&approvedTo=2026-09-30&sort=generatedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?overallRating=High&approvedFrom=2026-09-01&approvedTo=2026-09-30&sort=generatedDate%3Adesc&page=2&pageSize=25',
      { scroll: false },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?sort=generatedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('treats a list narrowed only by a rating or a date as filtered when it is empty', () => {
    const { rerender } = render(<AssessmentList assessments={[]} query={{ ...filtered, approvedFrom: undefined, approvedTo: undefined }} />);
    expect(screen.getByText('No risk assessments match these filters')).toBeInTheDocument();

    rerender(<AssessmentList assessments={[]} query={{ ...filtered, overallRating: undefined, approvedFrom: undefined }} />);
    expect(screen.getByText('No risk assessments match these filters')).toBeInTheDocument();
  });
});

/*
 * 13-UI-SPEC §2.1 (D-14; UI-D6, UI-D10): Assigned to me is the viewer’s own requests. Its scope is fixed by the
 * page, never a chip or a control; it opens on All open; it leaves out the Assigned to column and filter; and its
 * empty view says where requests waiting for pick-up are.
 */
describe('the Assigned to me view (13-13)', () => {
  const open = { q: '', queue: 'open' as const, sort: 'submittedDate:desc' as const, page: 1, pageSize: 25 as const };
  const held: AssessmentRequestQueueItem = { ...assessmentRequest, documentId: 'held-id', requestNumber: 'RAR-2026-HELD', assignee: viewer, pickUp: 'not-offered', unreadNotes: 1 };

  beforeEach(() => navigationMocks.replace.mockClear());

  it('heads the page Assigned to me with what the view is for', () => {
    render(<AssignedRequestListHeader />);
    expect(screen.getByRole('heading', { level: 1, name: 'Assigned to me' })).toBeInTheDocument();
    expect(screen.getByText('Requests you’re accountable for, and what each needs next.')).toBeInTheDocument();
  });

  it('shows the nine queue columns without Assigned to, and no Assigned to filter, holder line or Pick up', () => {
    const { container } = render(<AssessmentRequestList query={open} requests={[held]} view="assigned" viewer={viewer} />);
    const table = container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]') as HTMLElement;

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Request', 'Title', 'Requestor', 'Assessment type', 'Business criticality', 'Status', 'Due date', 'Age', 'Submitted',
    ]);
    expect(screen.queryByRole('combobox', { name: 'Assigned to' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pick up/ })).not.toBeInTheDocument();
    const card = container.querySelector<HTMLElement>('[data-slot="data-table-mobile"] article') as HTMLElement;
    expect(within(card).getByRole('link', { name: '1 new note on RAR-2026-HELD' })).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Assigned to');
  });

  it('names All open as its default queue, and keeps the URL free of it and of the assignee', () => {
    // The page's fixed scope reaches the list, which never shows it as a chip or carries it into the URL.
    render(<AssessmentRequestList query={{ ...open, assignee: 'me' }} requests={[held]} view="assigned" viewer={viewer} />);
    expect(screen.getByText('Queue:')).toHaveTextContent('Queue: All open');
    const queue = screen.getByRole('combobox', { name: 'Filter by queue' });
    expect(queue).toHaveValue('open');
    expect(screen.queryByText(/^Assigned to:/)).not.toBeInTheDocument();

    fireEvent.change(queue, { target: { value: 'requires-attention' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?queue=requires-attention&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
    fireEvent.change(screen.getByRole('combobox', { name: 'Notes' }), { target: { value: 'unread' } });
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?notes=unread&sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
  });

  it('says no open requests are assigned to the viewer, and where requests waiting for pick-up are, with no action', () => {
    render(<AssessmentRequestList query={open} requests={[]} view="assigned" viewer={viewer} />);
    const empty = document.querySelector<HTMLElement>('[data-state-kind="empty"]') as HTMLElement;

    expect(within(empty).getByRole('heading', { name: 'No open requests assigned to you' })).toBeInTheDocument();
    expect(within(empty).getByText('Requests you pick up, or that another Security Analyst assigns to you, appear here until they’re released. Requests waiting for pick-up are in Requests.')).toBeInTheDocument();
    expect(within(empty).queryByRole('button')).not.toBeInTheDocument();
    expect(within(empty).queryByRole('link')).not.toBeInTheDocument();
  });

  it.each([
    ['a notes filter', { ...open, notes: 'unread' as const }],
    ['another queue', { ...open, queue: 'requires-attention' as const }],
    ['a search', { ...open, q: 'vendor' }],
  ])('says no requests match %s, and Clear filters returns to All open', (_name, query) => {
    render(<AssessmentRequestList query={query} requests={[]} view="assigned" viewer={viewer} />);
    const empty = document.querySelector<HTMLElement>('[data-state-kind="empty"]') as HTMLElement;

    expect(within(empty).getByRole('heading', { name: 'No requests match these filters' })).toBeInTheDocument();
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith('/app/review/assessments?sort=submittedDate%3Adesc&pageSize=25', { scroll: false });
  });

  it('loads with the nine-column queue skeleton', () => {
    const { container } = render(<AssessmentRequestListSkeleton view="assigned" />);
    const layout = container.querySelector<HTMLElement>('[data-slot="data-table-loading-desktop"]') as HTMLElement;
    expect(within(layout).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Request', 'Title', 'Requestor', 'Assessment type', 'Business criticality', 'Status', 'Due date', 'Age', 'Submitted',
    ]);
  });
});
