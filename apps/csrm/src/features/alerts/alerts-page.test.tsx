import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AlertItem, AlertListPayload } from './alert-schema';

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  granted: vi.fn(),
  listAlerts: vi.fn(),
  refresh: vi.fn(),
  resolveE2eUiState: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/alerts',
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: mocks.current,
    capabilitiesFor: () => ({ granted: mocks.granted }),
  }),
}));
vi.mock('@/features/alerts/alert-service', () => ({ listAlerts: mocks.listAlerts }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import AlertsPage, { AlertsContent, metadata } from '../../../app/(app)/app/alerts/page';
import AlertsError from '../../../app/(app)/app/alerts/error';
import AlertsLoading from '../../../app/(app)/app/alerts/loading';

const releasedRiskAlert: AlertItem = {
  id: 'risk-treatment-overdue:risk-released',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-released', identifier: 'RSK-E2E-P7-RELEASED-001', title: 'Released Risk statement.', released: true },
  link: { type: 'risk', documentId: 'risk-released' },
  residualRating: 'Critical',
};

function listPayload(data: AlertItem[], overrides: Partial<AlertListPayload['meta']> = {}): { data: AlertListPayload; error: null } {
  return {
    data: {
      data,
      meta: {
        pagination: { page: 1, pageSize: 25, pageCount: data.length ? 1 : 0, total: data.length },
        today: '2026-09-24',
        dueSoonWindowDays: 14,
        ...overrides,
      },
    },
    error: null,
  };
}

function signInAsRequestor() {
  mocks.current.mockResolvedValue({ displayName: 'Jane Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create']));
  mocks.can.mockImplementation((capability: string, granted: ReadonlySet<string>) => {
    calls.push(`capability:${capability}`);
    return granted.has(capability);
  });
}

beforeEach(() => {
  calls.length = 0;
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment:review', 'risk:manage']));
  mocks.can.mockImplementation((capability: string, granted: ReadonlySet<string>) => {
    calls.push(`capability:${capability}`);
    return granted.has(capability);
  });
  mocks.listAlerts.mockImplementation(async () => {
    calls.push('alerts');
    return listPayload([releasedRiskAlert]);
  });
  mocks.resolveE2eUiState.mockImplementation(() => {
    calls.push('fixture');
    return undefined;
  });
});

describe('Alerts route content', () => {
  it('refuses a Requestor at the assessment:review gate before any alert read', async () => {
    signInAsRequestor();

    render(await AlertsContent({ searchParams: Promise.resolve({ kind: 'risk-treatment-overdue', __e2eState: 'populated' }) }));

    expect(calls).toEqual(['capability:assessment:review']);
    expect(mocks.listAlerts).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
    expect(screen.getByRole('link', { name: 'Return to workspace' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/risks/"]')).toBeNull();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('refuses a viewer with no session the same way', async () => {
    mocks.current.mockResolvedValue(null);

    render(await AlertsContent({ searchParams: Promise.resolve({}) }));

    expect(mocks.listAlerts).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
  });

  it('renders the permission state when Strapi refuses the read', async () => {
    mocks.listAlerts.mockResolvedValue({ data: null, error: { status: 403, message: 'Forbidden' } });

    render(await AlertsContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('renders the error state with Try again for any other failure', async () => {
    const user = userEvent.setup();
    mocks.listAlerts.mockResolvedValue({ data: null, error: { status: 500, message: 'The CSRM service is unavailable. Please try again later.' } });

    render(await AlertsContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load alerts');
    expect(alert).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
  });

  it('says the list is clear, using the window the server sent, when nothing alerts', async () => {
    mocks.listAlerts.mockResolvedValue(listPayload([], { dueSoonWindowDays: 14 }));

    render(await AlertsContent({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'No alerts' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is overdue, due within 14 days, or flagged for attention.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('never hard-codes the due-soon window', async () => {
    mocks.listAlerts.mockResolvedValue(listPayload([], { dueSoonWindowDays: 30 }));

    render(await AlertsContent({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('Nothing is overdue, due within 30 days, or flagged for attention.')).toBeInTheDocument();
  });

  it('offers Clear filters when a filtered page is empty', async () => {
    mocks.listAlerts.mockResolvedValue(listPayload([]));

    render(await AlertsContent({ searchParams: Promise.resolve({ kind: 'request-overdue', urgency: 'attention' }) }));

    expect(screen.getByRole('heading', { name: 'No alerts match these filters' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('reads the URL filters through the closed URL schema', async () => {
    render(await AlertsContent({ searchParams: Promise.resolve({ kind: 'risk-treatment-overdue', urgency: 'overdue', page: '2', pageSize: '50' }) }));
    expect(mocks.listAlerts).toHaveBeenLastCalledWith({ kinds: ['risk-treatment-overdue'], urgency: 'overdue', page: 2, pageSize: 50 });

    render(await AlertsContent({ searchParams: Promise.resolve({ kind: 'not-a-kind', urgency: 'eventually', page: '-4', pageSize: '7' }) }));
    expect(mocks.listAlerts).toHaveBeenLastCalledWith({ kinds: undefined, urgency: undefined, page: 1, pageSize: 25 });
  });

  it('renders the populated list with the released marker and an analyst record link', async () => {
    render(await AlertsContent({ searchParams: Promise.resolve({}) }));

    const table = screen.getByRole('table', { name: 'Alerts' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Urgency', 'Residual rating', 'Condition', 'Record', 'Date']);
    expect(within(table).getByRole('link', { name: 'RSK-E2E-P7-RELEASED-001' })).toHaveAttribute('href', '/app/risks/risk-released');
    expect(within(table).getByText('Released · read-only')).toBeInTheDocument();
    expect(within(table).getByText('Treatment overdue by 12 days')).toBeInTheDocument();
  });

  it('resolves the guarded E2E fixture only after a successful read', async () => {
    mocks.resolveE2eUiState.mockImplementation(() => {
      calls.push('fixture');
      return 'empty';
    });

    render(await AlertsContent({ searchParams: Promise.resolve({ __e2eState: 'empty' }) }));

    expect(calls).toEqual(['capability:assessment:review', 'alerts', 'fixture']);
    expect(document.querySelector('[data-ui-state="empty"]')).not.toBeNull();
    // A fixture renders safe empty data, never the records the read returned.
    expect(screen.queryByRole('link', { name: 'RSK-E2E-P7-RELEASED-001' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No alerts' })).toBeInTheDocument();
  });

  it.each(['loading', 'error', 'permission'] as const)('renders the %s fixture inside its guarded boundary without records', async (state) => {
    mocks.resolveE2eUiState.mockReturnValue(state);

    render(await AlertsContent({ searchParams: Promise.resolve({ __e2eState: state }) }));

    const boundary = document.querySelector<HTMLElement>(`[data-ui-state="${state}"]`);
    expect(boundary).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'RSK-E2E-P7-RELEASED-001' })).not.toBeInTheDocument();
    if (state === 'loading') expect(within(boundary!).getByRole('status', { name: 'Loading alerts' })).toBeInTheDocument();
    if (state === 'error') expect(within(boundary!).getByRole('alert')).toHaveTextContent('We couldn’t load alerts');
    if (state === 'permission') expect(within(boundary!).getByRole('alert')).toHaveTextContent('You don’t have access to alerts');
  });
});

describe('Alerts route files', () => {
  const route = (file: string) => readFileSync(resolve(process.cwd(), `app/(app)/app/alerts/${file}`), 'utf8');

  it('keeps the page server-owned, synchronous, capability-gated and typed', () => {
    const page = route('page.tsx');
    expect(metadata).toEqual({ title: 'Alerts | IdamBox CSRM' });
    expect(page).toContain("can('assessment:review'");
    expect(page).toContain('alertListUrlQuerySchema');
    expect(page).toContain('await searchParams');
    expect(page).toContain('listAlerts');
    expect(page).toContain('<Suspense');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
    expect(page).not.toMatch(/export default async function/);
    // The capability check precedes the read.
    expect(page.indexOf("can('assessment:review'")).toBeLessThan(page.indexOf('listAlerts('));
    expect(AlertsPage.constructor.name).not.toBe('AsyncFunction');
  });

  it('gives the route its own loading and error boundaries under the real header', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    const loading = render(<AlertsLoading />);
    expect(screen.getByRole('heading', { level: 1, name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByText('Overdue work, approaching dates and Risks that need attention, most urgent first. Alerts clear when the underlying record changes.')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading alerts' })).toBeInTheDocument();
    // Never the Requestor dashboard's skeleton.
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    loading.unmount();

    render(<AlertsError error={new Error('boom')} retry={retry} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load alerts');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);

    const error = route('error.tsx');
    expect(error).toContain("'use client'");
    expect(error).toMatch(/retry=\{retry\}/);
  });
});
