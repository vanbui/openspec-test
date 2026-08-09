/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StateBoundary } from './state-boundary';
import { AccessDeniedState } from './access-denied-state';
import { OptionalValue } from './optional-value';
import { UnavailableState } from './unavailable-state';

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

  it('renders Not provided only for absent optional values while preserving zero and false', () => {
    const { rerender } = render(<OptionalValue value={undefined} />);

    expect(screen.getByText('Not provided').className).toContain('text-muted-foreground');

    rerender(<OptionalValue value={0} />);
    expect(screen.getByText('0')).toBeDefined();

    rerender(<OptionalValue value={false} />);
    expect(screen.getByText('false')).toBeDefined();
  });

  it('uses the recoverable error path for a required missing region', () => {
    render(
      <StateBoundary
        status="error"
        error={{ kind: 'invalid-response', message: 'missing required section', retryable: true }}
        onRetry={() => undefined}
      >
        <div>Partial content</div>
      </StateBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toContain('We couldn’t load this page');
    expect(screen.queryByText('Partial content')).toBeNull();
  });

  it('renders exact forbidden and unavailable copy with only a CSRM home return action', () => {
    const { rerender } = render(<AccessDeniedState />);

    expect(screen.getByRole('heading', { name: 'You don’t have access to this area' })).toBeDefined();
    expect(screen.getByText('Your current CSRM access does not include this page. Return to a page available to you or switch the development identity.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Go to CSRM home' }).getAttribute('href')).toBe('/');
    expect(screen.queryByText(/assessment request|protected record|internal/i)).toBeNull();

    rerender(<UnavailableState />);

    expect(screen.getByRole('heading', { name: 'This area isn’t available yet' })).toBeDefined();
    expect(screen.getByText('This CSRM capability will be available in a later release.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Go to CSRM home' }).getAttribute('href')).toBe('/');
  });

  it('uses EmptyState for zero records while preserving the ready layout for one and many', () => {
    const { rerender } = render(
      <StateBoundary status="empty">
        <ul aria-label="Records" />
      </StateBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Nothing to show yet' })).toBeDefined();

    rerender(
      <StateBoundary status="ready">
        <ul aria-label="Records">
          <li>One record</li>
        </ul>
      </StateBoundary>,
    );
    expect(screen.getByRole('list', { name: 'Records' }).parentElement?.getAttribute('data-slot')).toBe('state-boundary');

    rerender(
      <StateBoundary status="ready">
        <ul aria-label="Records">
          <li>First record</li>
          <li>Second record</li>
        </ul>
      </StateBoundary>,
    );
    expect(screen.getByRole('list', { name: 'Records' }).parentElement?.getAttribute('data-slot')).toBe('state-boundary');
  });

  it('contains overflow in a labelled content region without page-level horizontal layout rules', () => {
    const { container } = render(
      <StateBoundary status="ready">
        <p>{'Long content '.repeat(100)}</p>
      </StateBoundary>,
    );

    const region = screen.getByLabelText('CSRM content');
    expect(region.className).toContain('min-w-0');
    expect(region.className).toContain('overflow-x-auto');
    expect(container.firstElementChild).toBe(region);
  });
});
