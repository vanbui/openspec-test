import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneElement, isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Home at /app (D-16, UI-SPEC §5.1). The page reads the session's capabilities, which needs no Strapi
 * read, and chooses the analyst or the Requestor Home before any data read. A Requestor therefore
 * issues no analyst read, fixture or partial selector (T-11-01). The choice is presentation only:
 * Strapi still authorises every read the chosen Home makes.
 */

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  granted: vi.fn(),
  getAnalystDashboard: vi.fn(),
  getDashboardSummary: vi.fn(),
  getAlertSummary: vi.fn(),
  listAlerts: vi.fn(),
  getRequestorHome: vi.fn(),
  resolveE2eUiState: vi.fn(),
  resolveE2eRequestorHomePartial: vi.fn(),
  resolveE2eAnalystDashboardPartial: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }),
}));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/features/analyst-dashboard/analyst-dashboard-service', () => ({
  getAnalystDashboard: mocks.getAnalystDashboard,
  getDashboardSummary: mocks.getDashboardSummary,
}));
vi.mock('@/features/alerts/alert-service', () => ({ getAlertSummary: mocks.getAlertSummary, listAlerts: mocks.listAlerts }));
vi.mock('@/features/home/requestor-home-service', () => ({ getRequestorHome: mocks.getRequestorHome }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
  resolveE2eRequestorHomePartial: mocks.resolveE2eRequestorHomePartial,
  resolveE2eAnalystDashboardPartial: mocks.resolveE2eAnalystDashboardPartial,
}));

import HomeError from '../../../app/(app)/app/error';
import HomeLoading from '../../../app/(app)/app/loading';
import HomePage, { metadata } from '../../../app/(app)/app/page';
import { emptyAnalystDashboard } from '../analyst-dashboard/analyst-dashboard-presentation';
import { emptyRequestorHome } from './requestor-home-presentation';

const homeDescription = 'What needs your action, and where your work stands.';
const fixtureQuery = Promise.resolve({ __e2eState: 'error', __e2ePartial: 'analyst-top-alerts-error' });

/*
 * jsdom renders client React, which cannot await a server component. This resolves every async
 * component in a server-rendered tree first, so a test sees what the server streams to the page.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveServerTree(child)));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    return resolveServerTree(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = await resolveServerTree(element.props.children);
  return cloneElement(element, undefined, ...(Array.isArray(children) ? children : [children]));
}

/** The page's own Suspense boundary, so a test can render the skeleton it streams first. */
function suspenseFallback(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = suspenseFallback(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<{ children?: ReactNode; fallback?: ReactNode }>;
  if (element.type === Suspense) return element.props.fallback;
  return suspenseFallback(element.props.children);
}

function pageHeader(): HTMLElement {
  const header = screen.getByRole('heading', { level: 1, name: 'Home' }).closest('.page-header');
  if (!(header instanceof HTMLElement)) throw new Error('HOME_PAGE_HEADER_MISSING');
  return header;
}

function signInAsRequestor() {
  mocks.current.mockResolvedValue({ displayName: 'Jane Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create']));
}

function signInAsSecurityAnalyst() {
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create', 'assessment:review', 'risk:manage']));
}

beforeEach(() => {
  calls.length = 0;
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.can.mockImplementation((capability: string, granted: ReadonlySet<string>) => {
    calls.push(`capability:${capability}`);
    return granted.has(capability);
  });
  mocks.getAnalystDashboard.mockImplementation(async () => { calls.push('analyst-dashboard'); return { kind: 'ready', dashboard: emptyAnalystDashboard(14) }; });
  mocks.getRequestorHome.mockImplementation(async () => { calls.push('requestor-home'); return { kind: 'ready', home: emptyRequestorHome }; });
  mocks.resolveE2eUiState.mockImplementation(() => { calls.push('fixture'); return undefined; });
  mocks.resolveE2eRequestorHomePartial.mockImplementation(() => { calls.push('requestor-partial'); return false; });
  mocks.resolveE2eAnalystDashboardPartial.mockImplementation(() => { calls.push('analyst-partial'); return false; });
});

describe('Home at /app', () => {
  it('omits every New request action for a Requestor who can read but cannot create', async () => {
    signInAsRequestor();
    mocks.granted.mockResolvedValue(new Set(['assessment-request:read']));
    render(await resolveServerTree(await HomePage({ searchParams: Promise.resolve({}) })));
    expect(screen.getByRole('region', { name: 'Needs your action' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New request' })).not.toBeInTheDocument();
  });

  it('is titled Home for every actor', () => {
    expect(metadata).toEqual({ title: 'Home | IdamBox CSRM' });
  });

  it('gives a Requestor the Requestor Home with New request, and never an analyst read, fixture or partial', async () => {
    signInAsRequestor();

    render(await resolveServerTree(await HomePage({ searchParams: fixtureQuery })));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(pageHeader()).getByText(homeDescription)).toBeInTheDocument();
    expect(within(pageHeader()).getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/app/requests/new');
    expect(mocks.getRequestorHome).toHaveBeenCalledTimes(1);
    expect(calls).toContain('capability:assessment:review');
    expect(calls.indexOf('capability:assessment:review')).toBeLessThan(calls.indexOf('requestor-home'));
    // The Requestor Home leads with the work waiting for them (D-19, D-22).
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Needs your action');
    for (const analystRead of [mocks.getAnalystDashboard, mocks.getDashboardSummary, mocks.getAlertSummary, mocks.listAlerts]) {
      expect(analystRead).not.toHaveBeenCalled();
    }
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot="kpi-tile"], [data-slot="analyst-dashboard"]')).toBeNull();
  });

  it('gives a Security Analyst the analyst Home with no header action, and no Requestor read', async () => {
    signInAsSecurityAnalyst();

    render(await resolveServerTree(await HomePage({ searchParams: Promise.resolve({}) })));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(pageHeader()).getByText(homeDescription)).toBeInTheDocument();
    // No header action: the tiles are the analyst's entry points (D-24).
    expect(pageHeader().querySelector('a, button')).toBeNull();
    expect(mocks.getAnalystDashboard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Needs action' })).toBeInTheDocument();
    // Phase 13 (D-15; UI-SPEC §3): the analyst Home leads with the viewer's own work, then the team's queue.
    const tiles = within(screen.getByRole('region', { name: 'Needs action' })).getAllByRole('link');
    expect(tiles[0]).toHaveAttribute('href', '/app/review/assigned?queue=requires-attention');
    expect(tiles[0]).toHaveAccessibleName('Needs your action 0 Requests assigned to you that need analyst action');
    const queue = screen.getByRole('region', { name: 'Review queue' });
    expect(within(queue).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent).slice(0, 2)).toEqual(['Assigned to you', 'Assessment Requests']);
    expect(within(queue).getAllByRole('link')).toHaveLength(11);
    expect(document.body).not.toHaveTextContent(/my attention/i);
    expect(mocks.getRequestorHome).not.toHaveBeenCalled();
    expect(mocks.resolveE2eRequestorHomePartial).not.toHaveBeenCalled();
  });

  it('streams each Home behind its own skeleton, chosen before the boundary', async () => {
    signInAsSecurityAnalyst();
    const analyst = render(<>{suspenseFallback(await HomePage({ searchParams: Promise.resolve({}) }))}</>);
    expect(analyst.container.querySelectorAll('[data-slot="kpi-tile-skeleton"]')).toHaveLength(4);
    analyst.unmount();

    signInAsRequestor();
    const requestor = render(<>{suspenseFallback(await HomePage({ searchParams: Promise.resolve({}) }))}</>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(requestor.container.querySelector('[data-slot="kpi-tile-skeleton"]')).toBeNull();

    // Choosing the skeleton reads only the session: no data read happens before the boundary.
    expect(mocks.getAnalystDashboard).not.toHaveBeenCalled();
    expect(mocks.getRequestorHome).not.toHaveBeenCalled();
  });

  it('loads with the Home header alone: no action and no body, since the variant is not chosen yet (UI-D4)', () => {
    render(<HomeLoading />);

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(within(pageHeader()).getByText(homeDescription)).toBeInTheDocument();
    expect(pageHeader().querySelector('a, button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();
  });

  it('recovers from a route error under the Home header with Try again, which retries the segment', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    render(<HomeError error={new Error('boom')} retry={retry} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(pageHeader().querySelector('a, button')).toBeNull();
    const alert = screen.getByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();

    const source = readFileSync(resolve(process.cwd(), 'app/(app)/app/error.tsx'), 'utf8');
    expect(source).toContain("'use client'");
    expect(source).toMatch(/retry=\{retry\}/);
  });
});
