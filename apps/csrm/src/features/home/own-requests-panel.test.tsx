import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { OwnRequestsPanel } from './own-requests-panel';

/*
 * The analyst Home's Your own requests (D-18 item 7, UI-SPEC §5.3): the requests an analyst raised as a Requestor,
 * counted by who holds them from the status summary's byHolder, each count a whole-row link to My requests filtered
 * by that holder, so the list's total equals the figure (D-35).
 */

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Your own requests' });
}

describe('OwnRequestsPanel', () => {
  it('keeps the own-request links while omitting New request when creation is unavailable', () => {
    render(<OwnRequestsPanel canCreate={false} state={{ status: 'ready', data: { requestor: 1, analyst: 2, none: 0 } }} />);
    expect(within(panel()).getByRole('link', { name: 'View My requests' })).toHaveAttribute('href', '/app/requests');
    expect(within(panel()).queryByRole('link', { name: 'New request' })).not.toBeInTheDocument();
  });

  it('counts the analyst’s own requests by holder, each row one link to My requests filtered by that holder', () => {
    render(<OwnRequestsPanel state={{ status: 'ready', data: { requestor: 1, analyst: 2, none: 0 } }} />);

    expect(within(panel()).getByText('Requests you raised yourself, as a Requestor.')).toBeInTheDocument();
    const rows = within(within(panel()).getByRole('list')).getAllByRole('link');
    expect(rows.map((row) => [row.getAttribute('aria-label'), row.getAttribute('href')])).toEqual([
      ['Needs your action: 1 request', '/app/requests?holder=requestor'],
      ['With the Security Analyst: 2 requests', '/app/requests?holder=analyst'],
    ]);
    // The visible label and count begin the name (SC 2.5.3), and the chevron is the at-rest cue.
    expect(rows[0]).toHaveTextContent('Needs your action 1');
    expect(rows[1]).toHaveTextContent('With the Security Analyst 2');
    for (const row of rows) expect(row.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders a zero row, because a zero is data', () => {
    render(<OwnRequestsPanel state={{ status: 'ready', data: { requestor: 0, analyst: 0, none: 3 } }} />);

    const rows = within(within(panel()).getByRole('list')).getAllByRole('link');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['Needs your action: 0 requests', 'With the Security Analyst: 0 requests']);
  });

  it('ends with View My requests and New request', () => {
    render(<OwnRequestsPanel state={{ status: 'ready', data: { requestor: 1, analyst: 2, none: 0 } }} />);

    const footer = panel().querySelector<HTMLElement>('[data-slot="dashboard-widget-footer"]');
    expect(footer).not.toBeNull();
    expect(within(footer!).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['View My requests', '/app/requests'],
      ['New request', '/app/requests/new'],
    ]);
  });

  it('fails on its own with a compact error and Try again, with no figure or link', () => {
    render(<OwnRequestsPanel state={{ status: 'unavailable' }} />);

    expect(within(panel()).getByRole('alert')).toHaveTextContent('We couldn’t load your own requests');
    expect(within(panel()).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('link')).toBeNull();
  });
});
