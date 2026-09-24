import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

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
    expect(screen.getByRole('alert')).toHaveTextContent('Navigation visibility is not an authorization control.');
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
});
