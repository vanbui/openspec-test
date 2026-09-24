import { fireEvent, render, screen } from '@testing-library/react';
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

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

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

    expect(screen.getByRole('option', { name: 'Approved' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Closed' })).toBeInTheDocument();
    expect(screen.getByText('No assessment requests match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      '/app/review/assessments?sort=submittedDate%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('keeps complete human-readable request statuses independent of queue and applies shared select focus treatment', () => {
    const { rerender } = render(<AssessmentRequestList requests={[]} />);
    const expectedLabels = ['Draft', 'Submitted', 'Questionnaire in progress', 'Risk assessment drafted', 'Under review', 'Approved', 'Closed'];
    const statusOptions = () => [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')].slice(1).map((option) => option.textContent);

    expect(statusOptions()).toEqual(expectedLabels);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveClass('focus-visible:ring-ring');
    expect(screen.getByRole('combobox', { name: 'Filter by queue' })).toHaveClass('focus-visible:ring-ring');

    rerender(<AssessmentRequestList query={{ q: '', queue: 'released', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[]} />);
    expect(statusOptions()).toEqual(expectedLabels);
  });

  it('offers all labelled assessment statuses', () => {
    render(<AssessmentList assessments={[]} />);

    expect([...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All statuses', 'Draft', 'In review', 'Approved', 'Closed',
    ]);
  });
});
