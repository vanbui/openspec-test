import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AlertItem, AlertListUrlQuery } from './alert-schema';

const replace = vi.fn();
const refresh = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/alerts',
  useRouter: () => ({ refresh, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

import { AlertList, AlertListLoading } from './alert-list';
import { AlertRow } from './alert-row';

const overdueRisk: AlertItem = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-001', title: 'Customer identity data may be disclosed through a compromised service account.', released: false },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'High',
};

const releasedRisk: AlertItem = {
  ...overdueRisk,
  id: 'risk-treatment-overdue:risk-2',
  governingDate: '2026-09-12',
  source: { type: 'risk', documentId: 'risk-2', identifier: 'RSK-2026-002', title: 'Released Risk statement.', released: true },
  link: { type: 'risk', documentId: 'risk-2' },
  residualRating: null,
};

const controlOverdue: AlertItem = {
  id: 'control-implementation-overdue:implementation-1',
  kind: 'control-implementation-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-14',
  dayOffset: -10,
  source: { type: 'control-implementation', documentId: 'implementation-1', identifier: 'RSK-2026-001', title: 'E8-PATCH_OPERATING_SYSTEMS-001 Patch operating systems', released: false },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'High',
};

const requestDueSoon: AlertItem = {
  id: 'request-due-soon:request-7',
  kind: 'request-due-soon',
  urgency: 'due-soon',
  governingDate: '2026-09-29',
  dayOffset: 5,
  source: { type: 'assessment-request', documentId: 'request-7', identifier: 'RAR-2026-007', title: 'Phase 7 due soon review request', released: false },
  link: { type: 'assessment-request', documentId: 'request-7' },
  residualRating: null,
};

const ineffectiveControl: AlertItem = {
  id: 'ineffective-control:implementation-2',
  kind: 'ineffective-control',
  urgency: 'attention',
  governingDate: null,
  dayOffset: null,
  source: { type: 'control-implementation', documentId: 'implementation-2', identifier: 'RSK-2026-003', title: null, released: false },
  link: { type: 'risk', documentId: 'risk-3' },
  residualRating: 'Critical',
};

const dueSoonRisk: AlertItem = {
  id: 'risk-treatment-due-soon:risk-9',
  kind: 'risk-treatment-due-soon',
  urgency: 'due-soon',
  governingDate: '2026-09-29',
  dayOffset: 5,
  source: { type: 'risk', documentId: 'risk-9', identifier: 'RSK-2026-009', title: 'Third-party dependency may reduce availability.', released: false },
  link: { type: 'risk', documentId: 'risk-9' },
  residualRating: 'Moderate',
};

const alerts = [overdueRisk, releasedRisk, controlOverdue, requestDueSoon, ineffectiveControl] as const;
const unfiltered: AlertListUrlQuery = { page: 1, pageSize: 25 };

function renderList(overrides: Partial<React.ComponentProps<typeof AlertList>> = {}) {
  return render(
    <AlertList
      alerts={alerts}
      dueSoonWindowDays={14}
      pagination={{ page: 1, pageSize: 25, pageCount: 1, total: alerts.length }}
      query={unfiltered}
      {...overrides}
    />,
  );
}

function desktopTable() {
  return screen.getByRole('table', { name: 'Alerts' });
}

function desktopRow(identifier: string, condition: RegExp) {
  return within(desktopTable()).getAllByRole('row').find((row) => within(row).queryByRole('link', { name: identifier }) && condition.test(row.textContent ?? '')) as HTMLElement;
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  search = '';
});

describe('AlertList', () => {
  it('renders the five alert columns with no sortable header, most urgent first as served', () => {
    renderList();

    expect(within(desktopTable()).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Urgency', 'Residual rating', 'Condition', 'Record', 'Date',
    ]);
    // D-12: the server owns the order, so no header offers a sort.
    expect(screen.queryByRole('button', { name: /^Sort by/ })).not.toBeInTheDocument();
    expect(screen.getByText('5 results')).toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: 'Rows per page' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['10', '25', '50']);

    const bodyRows = within(desktopTable()).getAllByRole('row').slice(1);
    expect(bodyRows.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'RSK-2026-001', 'RSK-2026-002', 'RSK-2026-001', 'RAR-2026-007', 'RSK-2026-003',
    ]);
  });

  it('shows urgency, rating, condition, actor-correct record link and date in each row', () => {
    renderList();

    const overdue = desktopRow('RSK-2026-001', /Treatment overdue/);
    expect(within(overdue).getByText('Overdue')).toHaveTextContent('Urgency: Overdue');
    expect(within(overdue).getByLabelText('Severity: high (3 of 4)')).toBeInTheDocument();
    expect(within(overdue).getByText('Treatment overdue by 12 days')).toBeInTheDocument();
    expect(within(overdue).getByRole('link', { name: 'RSK-2026-001' })).toHaveAttribute('href', '/app/risks/risk-1');
    expect(within(overdue).getByRole('link', { name: 'RSK-2026-001' })).toHaveClass('record-link');
    expect(within(overdue).getByText('Risk · Customer identity data may be disclosed through a compromised service account.')).toHaveClass('line-clamp-1');
    expect(within(overdue).getByText('12 Sept 2026').closest('time')).toHaveAttribute('dateTime', '2026-09-12');
    expect(within(overdue).getByText('Target date')).toBeInTheDocument();
    expect(within(overdue).queryByText('Released · read-only')).not.toBeInTheDocument();

    const released = desktopRow('RSK-2026-002', /Treatment overdue/);
    expect(within(released).getByText('Released · read-only')).toBeInTheDocument();
    expect(within(released).getByText('Not rated')).toBeInTheDocument();

    const control = desktopRow('RSK-2026-001', /Control Implementation overdue/);
    expect(within(control).getByRole('link', { name: 'RSK-2026-001' })).toHaveAttribute('href', '/app/risks/risk-1#mitigation-controls');
    expect(within(control).getByText('Control Implementation · E8-PATCH_OPERATING_SYSTEMS-001 Patch operating systems')).toBeInTheDocument();
    expect(within(control).getByText('Implementation due')).toBeInTheDocument();

    const request = desktopRow('RAR-2026-007', /Request due in 5 days/);
    expect(within(request).getByText('Due soon')).toHaveTextContent('Urgency: Due soon');
    expect(within(request).getByRole('link', { name: 'RAR-2026-007' })).toHaveAttribute('href', '/app/review/requests/request-7');
    expect(within(request).getByText('Not applicable')).toBeInTheDocument();

    const ineffective = desktopRow('RSK-2026-003', /rated Ineffective/);
    expect(within(ineffective).getByText('Needs attention')).toHaveTextContent('Urgency: Needs attention');
    expect(within(ineffective).getByLabelText('Severity: critical (4 of 4)')).toBeInTheDocument();
    expect(within(ineffective).getByText('No date recorded')).toBeInTheDocument();
    expect(within(ineffective).getByText('Last reviewed')).toBeInTheDocument();
    expect(within(ineffective).getByText('Control Implementation')).toBeInTheDocument();
  });

  it('lets the Condition and Record cells wrap so the table fits narrow desktop widths', () => {
    renderList();

    const row = desktopRow('RSK-2026-001', /Treatment overdue/);
    expect(within(row).getByText('Treatment overdue by 12 days').closest('.whitespace-normal')).not.toBeNull();
    expect(within(row).getByRole('link', { name: 'RSK-2026-001' }).closest('.whitespace-normal')).not.toBeNull();
    // Urgency, rating and date stay on one line.
    expect(within(row).getByText('12 Sept 2026').closest('.whitespace-normal')).toBeNull();
  });

  it('renders one shared alert row per mobile card', () => {
    renderList();

    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    if (!mobile) throw new Error('The mobile alert list is missing.');
    expect(mobile).toHaveAttribute('role', 'list');
    expect(mobile).toHaveAttribute('aria-label', 'Alerts');
    const cards = within(mobile).getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    for (const card of cards) expect(card.querySelector('[data-slot="alert-row"]')).not.toBeNull();
    expect(within(cards[2]!).getByRole('link', { name: 'RSK-2026-001' })).toHaveAttribute('href', '/app/risks/risk-1#mitigation-controls');
  });

  it('offers the alert type and urgency filters as labelled selects with the §3.3 options', () => {
    renderList();

    expect(within(screen.getByRole('combobox', { name: 'Filter by alert type' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All alert types',
      'Treatment overdue',
      'Treatment due soon',
      'Request overdue',
      'Request due soon',
      'Control Implementation overdue',
      'Risk Assessment review due',
      'Critical Risk not treated',
      'Ineffective Control Implementation',
    ]);
    expect(within(screen.getByRole('combobox', { name: 'Filter by urgency' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All urgencies', 'Overdue', 'Due soon', 'Needs attention',
    ]);
    expect(screen.getByText('Alert type', { selector: 'label, label *' })).toBeInTheDocument();
    expect(screen.getByText('Urgency', { selector: 'label, label *' })).toBeInTheDocument();
  });

  it('replaces the URL at page 1 whenever a filter changes', async () => {
    const user = userEvent.setup();
    renderList({ query: { page: 3, pageSize: 25 }, pagination: { page: 3, pageSize: 25, pageCount: 4, total: 80 } });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by alert type' }), 'Treatment overdue');
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?kind=risk-treatment-overdue&page=1&pageSize=25', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by urgency' }), 'Due soon');
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?urgency=due-soon&page=1&pageSize=25', { scroll: false });
  });

  it('shows a removable chip per active filter and clears them all', async () => {
    const user = userEvent.setup();
    renderList({ query: { kind: 'request-overdue', urgency: 'attention', page: 2, pageSize: 50 }, pagination: { page: 2, pageSize: 50, pageCount: 2, total: 60 } });

    expect(screen.getByRole('combobox', { name: 'Filter by alert type' })).toHaveValue('request-overdue');
    expect(screen.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('attention');
    expect(screen.getByText('Alert type: Request overdue')).toBeInTheDocument();
    expect(screen.getByText('Urgency: Needs attention')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Alert type filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?urgency=attention&page=1&pageSize=50', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Remove Urgency filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?kind=request-overdue&page=1&pageSize=50', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by alert type' }), 'All alert types');
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?urgency=attention&page=1&pageSize=50', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?page=1&pageSize=50', { scroll: false });
  });

  it('pages and resizes through the URL', async () => {
    const user = userEvent.setup();
    renderList({ query: { kind: 'risk-treatment-overdue', page: 1, pageSize: 25 }, pagination: { page: 1, pageSize: 25, pageCount: 3, total: 60 } });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?kind=risk-treatment-overdue&page=2&pageSize=25', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?kind=risk-treatment-overdue&page=1&pageSize=50', { scroll: false });
  });

  it('says the list is clear, with the server window and no action, when nothing alerts', () => {
    renderList({ alerts: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, dueSoonWindowDays: 21 });

    const state = document.querySelector<HTMLElement>('[data-slot="state"][data-state-kind="empty"]');
    if (!state) throw new Error('The empty state is missing.');
    expect(within(state).getByRole('heading', { name: 'No alerts' })).toBeInTheDocument();
    expect(within(state).getByText('Nothing is overdue, due within 21 days, or flagged for attention.')).toBeInTheDocument();
    expect(within(state).queryByRole('button')).not.toBeInTheDocument();
    expect(within(state).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('No alerts yet')).not.toBeInTheDocument();
  });

  it('offers Clear filters when a filtered page is empty', async () => {
    const user = userEvent.setup();
    renderList({ alerts: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, query: { kind: 'request-overdue', urgency: 'attention', page: 1, pageSize: 25 } });

    const state = document.querySelector<HTMLElement>('[data-slot="state"][data-state-kind="empty"]');
    if (!state) throw new Error('The empty state is missing.');
    expect(within(state).getByRole('heading', { name: 'No alerts match these filters' })).toBeInTheDocument();
    await user.click(within(state).getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenLastCalledWith('/app/alerts?page=1&pageSize=25', { scroll: false });
  });

  it('recovers from an error by refreshing the route', async () => {
    const user = userEvent.setup();
    renderList({ alerts: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, state: 'error' });

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load alerts');
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows only the permission state when access is denied: no filters, count, table or record link', () => {
    renderList({ alerts: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, state: 'permission' });

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/results?$/)).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/risks/"]')).toBeNull();
  });

  it('moves an out-of-range page to the last page while showing the loading layout', () => {
    renderList({ alerts: [], query: { page: 9, pageSize: 25 }, pagination: { page: 9, pageSize: 25, pageCount: 2, total: 30 } });

    expect(replace).toHaveBeenCalledWith('/app/alerts?page=2&pageSize=25', { scroll: false });
    expect(screen.getByRole('status', { name: 'Loading alerts' })).toBeInTheDocument();
  });
});

describe('AlertListLoading', () => {
  it('shows the alerts loading layout under the current filters, disabled until the list arrives', () => {
    search = 'kind=request-overdue&urgency=overdue&pageSize=10';

    render(<AlertListLoading />);

    expect(screen.getByRole('status', { name: 'Loading alerts' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by alert type' })).toHaveValue('request-overdue');
    expect(screen.getByRole('combobox', { name: 'Filter by alert type' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('overdue');
    expect(screen.getByRole('combobox', { name: 'Filter by urgency' })).toBeDisabled();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe('AlertRow', () => {
  it('stacks urgency and rating, the condition, the record link, its type and title, then the date', () => {
    render(<AlertRow alert={overdueRisk} />);

    const row = document.querySelector<HTMLElement>('[data-slot="alert-row"]');
    if (!row) throw new Error('The alert row is missing.');
    // The row adapts to its own container, so a dashboard widget and a phone card share it.
    expect(row).toHaveClass('@container');
    expect(row.textContent).toMatch(/^Urgency: Overdue.*Treatment overdue by 12 days.*RSK-2026-001.*Risk · Customer identity.*Target date.*12 Sept 2026$/);
    expect(within(row).getByLabelText('Severity: high (3 of 4)')).toBeInTheDocument();
    expect(within(row).getByText('Treatment overdue by 12 days')).toHaveClass('font-medium');
    const link = within(row).getByRole('link', { name: 'RSK-2026-001' });
    expect(link).toHaveAttribute('href', '/app/risks/risk-1');
    // A standalone link meets the touch-target height below md.
    expect(link).toHaveClass('min-h-11');
    expect(within(row).getByText(/^Risk · Customer identity/)).toHaveClass('line-clamp-2');
    expect(within(row).getByText('12 Sept 2026').closest('time')).toHaveAttribute('dateTime', '2026-09-12');
    expect(within(row).getAllByRole('link')).toHaveLength(1);
  });

  it('states that released work is read-only after the record line', () => {
    render(<AlertRow alert={releasedRisk} />);

    const row = document.querySelector<HTMLElement>('[data-slot="alert-row"]');
    if (!row) throw new Error('The alert row is missing.');
    expect(within(row).getByText('Released · read-only')).toBeInTheDocument();
    expect(row.textContent).toMatch(/RSK-2026-002.*Released Risk statement\..*Released · read-only/);
    // A Risk with no residual rating says so; the hidden prefix says which rating.
    expect(within(row).getByText('Not rated')).toBeInTheDocument();
    expect(within(row).getByText('Not rated')).toHaveTextContent('Residual rating: Not rated');
  });

  it('shows no rating for a source that has none to show', () => {
    render(<AlertRow alert={requestDueSoon} />);

    const row = document.querySelector<HTMLElement>('[data-slot="alert-row"]');
    if (!row) throw new Error('The alert row is missing.');
    expect(within(row).queryByText('Not applicable')).not.toBeInTheDocument();
    expect(within(row).queryByLabelText(/^Severity:/)).not.toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'RAR-2026-007' })).toHaveAttribute('href', '/app/review/requests/request-7');
    expect(within(row).getByText('Assessment Request · Phase 7 due soon review request')).toBeInTheDocument();
  });

  it('puts the date first in the agenda variant, in place of the urgency badge', () => {
    render(<AlertRow alert={dueSoonRisk} variant="agenda" />);

    const row = document.querySelector<HTMLElement>('[data-slot="alert-row"]');
    if (!row) throw new Error('The alert row is missing.');
    expect(within(row).queryByText(/Urgency:/)).not.toBeInTheDocument();
    expect(row.textContent).toMatch(/^29 Sept 2026/);
    expect(within(row).getByText('29 Sept 2026').closest('time')).toHaveAttribute('dateTime', '2026-09-29');
    expect(within(row).getByText('29 Sept 2026')).toHaveClass('tabular-nums');
    expect(within(row).getByLabelText('Severity: moderate (2 of 4)')).toBeInTheDocument();
    expect(within(row).getByText('Treatment due in 5 days')).toBeInTheDocument();
    // The date is not repeated in a trailing date line.
    expect(within(row).getAllByText('29 Sept 2026')).toHaveLength(1);
  });
});
