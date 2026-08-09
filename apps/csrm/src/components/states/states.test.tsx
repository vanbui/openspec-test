/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StateBoundary } from './state-boundary';

afterEach(() => {
  cleanup();
});

describe('StateBoundary', () => {
  it('renders geometry-stable loading with one concise status announcement and hidden decorative skeletons', () => {
    const { container } = render(
      <StateBoundary status="loading">
        <div>Safe content</div>
      </StateBoundary>,
    );

    expect(screen.getByRole('status', { name: 'Loading page' })).toBeDefined();
    expect(screen.getAllByTestId('loading-skeleton')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]')).toHaveLength(3);
    expect(screen.queryByText('Safe content')).toBeNull();
  });

  it('renders a recoverable error with fixed safe copy and retries without exposing raw fields', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(
      <StateBoundary
        status="error"
        error={{
          kind: 'http',
          status: 502,
          message: 'Bearer secret-token from https://strapi.internal/api',
          retryable: true,
        }}
        onRetry={retry}
      >
        <div>Safe content</div>
      </StateBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toContain('We couldn’t load this page');
    expect(screen.getByRole('alert').textContent).toContain(
      'Check your connection and try again. If the problem continues, contact your CSRM administrator.',
    );
    expect((screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/secret-token|strapi\.internal|502/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders the exact neutral empty copy without a Phase 6 feature action', () => {
    render(
      <StateBoundary status="empty">
        <div>Safe content</div>
      </StateBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Nothing to show yet' })).toBeDefined();
    expect(screen.getByText('There are no items available here yet. When work is available, it will appear in this list.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders ready children unchanged for one or many records', () => {
    const { rerender } = render(
      <StateBoundary status="ready">
        <ul aria-label="Records">
          <li>One record</li>
        </ul>
      </StateBoundary>,
    );

    expect(screen.getByRole('list', { name: 'Records' }).textContent).toContain('One record');

    rerender(
      <StateBoundary status="ready">
        <ul aria-label="Records">
          <li>First record</li>
          <li>Second record</li>
        </ul>
      </StateBoundary>,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Records' }).textContent).toContain('First record');
    expect(screen.getByRole('list', { name: 'Records' }).textContent).toContain('Second record');
  });
});
