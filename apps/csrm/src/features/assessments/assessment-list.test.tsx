import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review/assessments',
  useRouter: () => navigationMocks,
}));

import { AssessmentList, AssessmentRequestList } from './assessment-list';
import type { AssessmentRequestQueueItem, AssessmentSummary } from './assessment-schema';

const assessmentRequest: AssessmentRequestQueueItem = {
  documentId: 'request-id',
  requestNumber: 'REQ-0042',
  title: 'Customer portal assessment',
  requestStatus: 'submitted',
  submittedDate: '2026-08-30T01:01:00.000Z',
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
    expect(screen.getAllByText('Reviewable deterministic draft.').every((summary) => summary.closest('a') === null)).toBe(true);
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
    expect(headers).toHaveLength(8);
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

    expect(screen.getByText('Queue:')).toHaveTextContent('Requires my attention');
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
    const requestSearch = screen.getByRole('searchbox', { name: 'Search assessment requests' });
    expect(requestSearch.closest('label')?.firstChild?.textContent).toBe('Search assessment requests');
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
