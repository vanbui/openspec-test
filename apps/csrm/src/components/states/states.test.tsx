import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { RetryableErrorState } from './retryable-error-state';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from './states';

describe('shell state components', () => {
  it('presents the locked loading and empty-state copy accessibly', () => {
    const { rerender } = render(<LoadingState />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…');
    expect(screen.getByText('Preparing your authorised workspace.')).toBeInTheDocument();

    rerender(<EmptyState />);
    expect(screen.getByRole('heading', { name: 'Nothing to show yet' })).toBeInTheDocument();
    expect(screen.getByText('Items available to you will appear here. Try changing your filters or return when work has been assigned.')).toBeInTheDocument();
  });

  it('announces errors, invokes retry, and returns denied users to the workspace', () => {
    const retry = vi.fn();
    const { rerender } = render(<ErrorState retry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this workspace');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<PermissionDeniedState />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your workspace shows the work you can open. If you think you should have access, contact your administrator.');
    expect(screen.getByRole('link', { name: 'Return to workspace' })).toHaveAttribute('href', '/app');
  });

  it('owns parameterised list-state copy, actions, data markers, and compact density', () => {
    const clearFilters = vi.fn();
    const { rerender } = render(<EmptyState noun="assessments" filtered onClearFilters={clearFilters} density="compact" headingLevel="h3" />);

    expect(screen.getByRole('heading', { name: 'No assessments match these filters', level: 3 })).toHaveClass('text-heading-sm');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(clearFilters).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading').parentElement).toHaveAttribute('data-slot', 'state');
    expect(screen.getByRole('heading').parentElement).toHaveAttribute('data-state-kind', 'empty');
    expect(screen.getByRole('heading').parentElement?.querySelector('svg')).toHaveClass('size-4');

    rerender(<ErrorState noun="requests" action={{ label: 'Return to requests', href: '/app/requests' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load requests');
    expect(screen.getByRole('link', { name: 'Return to requests' })).toHaveAttribute('href', '/app/requests');

    rerender(<PermissionDeniedState area="the Risk Register" />);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the Risk Register');

    rerender(<PermissionDeniedState action={{ label: 'Open My Requests', href: '/app/requests' }} area="your dashboard" />);
    expect(screen.getByRole('link', { name: 'Open My Requests' })).toHaveAttribute('href', '/app/requests');
    expect(screen.queryByRole('link', { name: 'Return to workspace' })).not.toBeInTheDocument();
  });

  it('says a cleared list is clear, without "yet" and without an action', () => {
    render(
      <EmptyState
        action={{ label: 'Create alert', href: '/app/alerts/new' }}
        description="Nothing is overdue, due within 14 days, or flagged for attention."
        kind="cleared"
        noun="alerts"
      />,
    );

    const heading = screen.getByRole('heading', { name: 'No alerts', level: 2 });
    expect(heading).toHaveClass('text-heading-sm');
    expect(heading.parentElement).toHaveAttribute('data-state-kind', 'empty');
    expect(heading.parentElement?.querySelector('svg')).toHaveClass('size-5');
    expect(screen.getByText('Nothing is overdue, due within 14 days, or flagged for attention.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps first-use copy and actions as the default for existing callers', () => {
    const { rerender } = render(<EmptyState action={{ label: 'Create request', href: '/app/requests/new' }} noun="requests" />);

    expect(screen.getByRole('heading', { name: 'No requests yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create request' })).toHaveAttribute('href', '/app/requests/new');

    rerender(<EmptyState kind="first-use" noun="requests" />);
    expect(screen.getByRole('heading', { name: 'No requests yet' })).toBeInTheDocument();
  });

  it('keeps a filtered empty list recoverable even when the unfiltered list would be cleared', () => {
    const clearFilters = vi.fn();
    render(<EmptyState filtered kind="cleared" noun="alerts" onClearFilters={clearFilters} />);

    expect(screen.getByRole('heading', { name: 'No alerts match these filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(clearFilters).toHaveBeenCalledOnce();
  });
});

describe('RetryableErrorState', () => {
  it('retries by refreshing the route, with the shared error copy', () => {
    refresh.mockClear();
    render(<RetryableErrorState noun="alerts" />);

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load alerts');
    expect(screen.getByText('Please try again. If the problem continues, contact your administrator.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('passes density, heading level and description through to the shared error state', () => {
    render(
      <RetryableErrorState
        density="compact"
        description="The summary counts are unavailable right now."
        headingLevel="h3"
        noun="the summary counts"
      />,
    );

    const heading = screen.getByRole('heading', { name: 'We couldn’t load the summary counts', level: 3 });
    expect(heading.parentElement).toHaveAttribute('data-state-kind', 'error');
    expect(heading.parentElement?.querySelector('svg')).toHaveClass('size-4');
    expect(screen.getByText('The summary counts are unavailable right now.')).toBeInTheDocument();
  });
});
