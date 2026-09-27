import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssessmentThroughputReport, ReportDefinition, RiskExposureReport } from './report-schema';

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  getReport: vi.fn(),
  granted: vi.fn(),
  listReportDefinitions: vi.fn(),
  notFound: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  resolveE2eUiState: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/reports',
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: mocks.current,
    capabilitiesFor: () => ({ granted: mocks.granted }),
  }),
}));
vi.mock('@/features/reports/report-service', () => ({
  getReport: mocks.getReport,
  listReportDefinitions: mocks.listReportDefinitions,
}));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import ReportsPage, { ReportIndexContent, metadata } from '../../../app/(app)/app/reports/(report-index)/page';
import ReportsError from '../../../app/(app)/app/reports/(report-index)/error';
import ReportsLoading from '../../../app/(app)/app/reports/(report-index)/loading';
import ReportPage, { ReportDetailContent, generateMetadata } from '../../../app/(app)/app/reports/[reportKey]/page';
import ReportError from '../../../app/(app)/app/reports/[reportKey]/error';
import ReportLoading from '../../../app/(app)/app/reports/[reportKey]/loading';
import ReportNotFound from '../../../app/(app)/app/reports/[reportKey]/not-found';

const reportsDescription = 'Read-only reports computed from current records in your authorised scope.';

const riskExposure: RiskExposureReport = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: { Critical: 2, High: 3, Moderate: 1, Low: 1, notRated: 1, total: 8 },
  byInherentRating: { Critical: 1, High: 3, Moderate: 1, Low: 1, notRated: 2, total: 8 },
  residualByTreatmentStatus: {
    Critical: { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 0, total: 2 },
    High: { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 1, total: 3 },
    Moderate: { notStarted: 0, inProgress: 0, overdue: 0, complete: 1, notProvided: 0, total: 1 },
    Low: { notStarted: 0, inProgress: 0, overdue: 1, complete: 0, notProvided: 0, total: 1 },
    notRated: { notStarted: 1, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 1 },
  },
  exposedSystems: {
    rows: [{ documentId: 'system-1', name: 'Alpha system', critical: 2, high: 2, total: 4 }],
    total: 1,
    truncated: false,
    risksWithoutSystem: 1,
  },
};

const assessmentThroughput: AssessmentThroughputReport = {
  key: 'assessment-throughput',
  today: '2026-09-24',
  period: 6,
  periodStart: '2026-04-01',
  released: {
    months: [
      { monthStart: '2026-04-01', count: 0, partial: false },
      { monthStart: '2026-05-01', count: 0, partial: false },
      { monthStart: '2026-06-01', count: 0, partial: false },
      { monthStart: '2026-07-01', count: 1, partial: false },
      { monthStart: '2026-08-01', count: 0, partial: false },
      { monthStart: '2026-09-01', count: 2, partial: true },
    ],
    total: 3,
  },
  medianDaysToRelease: { value: 20, sampleSize: 2, truncated: false },
  requestsByStatus: { submitted: 1, questionnaireInProgress: 2, riskAssessmentDrafted: 1, underReview: 3, approved: 5, closed: 1, total: 13 },
};

type RouteSearchParams = Record<string, string | string[] | undefined>;

/** A params promise that records when the page first reads the report key. */
function trackedParams(reportKey: string): Promise<{ reportKey: string }> {
  return {
    then(resolveParams: (value: { reportKey: string }) => unknown, reject?: (reason: unknown) => unknown) {
      calls.push('params');
      return Promise.resolve({ reportKey }).then(resolveParams, reject);
    },
  } as Promise<{ reportKey: string }>;
}

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

async function renderReportPage(reportKey: string, searchParams: RouteSearchParams = {}) {
  return render(await resolveServerTree(await ReportPage({ params: trackedParams(reportKey), searchParams: Promise.resolve(searchParams) })));
}

/* The served definitions, deliberately not in the copy map's order: the index follows the server. */
const definitions: ReportDefinition[] = [
  {
    key: 'control-effectiveness',
    title: 'Control effectiveness',
    description: 'Control Implementations on open contextual Risks by implementation status and effectiveness rating.',
  },
  {
    key: 'risk-exposure',
    title: 'Risk exposure',
    description: 'Open contextual Risks by rating and treatment status, and the Information Systems carrying the most High and Critical residual Risks.',
  },
  {
    key: 'assessment-throughput',
    title: 'Assessment throughput',
    description: 'Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.',
  },
  {
    key: 'treatment-performance',
    title: 'Treatment performance',
    description: 'Risk treatments by due state and treatment status, and the most overdue treatments.',
  },
];

function signInAsRequestor() {
  mocks.current.mockResolvedValue({ displayName: 'Jane Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create']));
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
  mocks.listReportDefinitions.mockImplementation(async () => {
    calls.push('report-definitions');
    return { data: definitions, error: null };
  });
  mocks.getReport.mockImplementation(async () => {
    calls.push('report');
    return { data: riskExposure, error: null };
  });
  mocks.notFound.mockImplementation(() => {
    calls.push('not-found');
    throw new Error('NEXT_NOT_FOUND');
  });
  mocks.resolveE2eUiState.mockImplementation(() => {
    calls.push('fixture');
    return undefined;
  });
});

describe('Report index route content', () => {
  it('refuses a Requestor at the assessment:review gate before any report read', async () => {
    signInAsRequestor();

    render(await ReportIndexContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(calls).toEqual(['capability:assessment:review']);
    expect(mocks.listReportDefinitions).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    expect(screen.getByRole('link', { name: 'Return to workspace' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('refuses a viewer with no session the same way', async () => {
    mocks.current.mockResolvedValue(null);

    render(await ReportIndexContent({ searchParams: Promise.resolve({}) }));

    expect(mocks.listReportDefinitions).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
  });

  it('renders the permission state when Strapi refuses the read', async () => {
    mocks.listReportDefinitions.mockResolvedValue({ data: null, error: { status: 403, message: 'Forbidden' } });

    render(await ReportIndexContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('renders the error state with Try again for any other failure', async () => {
    const user = userEvent.setup();
    mocks.listReportDefinitions.mockResolvedValue({ data: null, error: { status: 500, message: 'The CSRM service is unavailable. Please try again later.' } });

    render(await ReportIndexContent({ searchParams: Promise.resolve({}) }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load reports');
    expect(alert).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
  });

  it('says there are no reports, without an action, when the server lists none', async () => {
    mocks.listReportDefinitions.mockResolvedValue({ data: [], error: null });

    render(await ReportIndexContent({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'No reports' })).toBeInTheDocument();
    expect(screen.getByText('Reports available to your role appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders one card per served definition, in server order, each opened by its titled link', async () => {
    render(await ReportIndexContent({ searchParams: Promise.resolve({}) }));

    const list = screen.getByRole('list', { name: 'Reports' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(4);

    cards.forEach((card, index) => {
      const definition = definitions[index];
      const heading = within(card).getByRole('heading', { level: 2 });
      const link = within(heading).getByRole('link', { name: definition.title });
      expect(link).toHaveAttribute('href', `/app/reports/${definition.key}`);
      expect(within(card).getByText(definition.description)).toBeInTheDocument();
      // The stretched title link is the card's one tab stop; the description is not part of its name.
      expect(within(card).getAllByRole('link')).toEqual([link]);
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    });
    expect(within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Control effectiveness',
      'Risk exposure',
      'Assessment throughput',
      'Treatment performance',
    ]);
  });

  it('draws each card in the widget frame with the block-link cue, the link-card hover and a card focus ring', async () => {
    render(await ReportIndexContent({ searchParams: Promise.resolve({}) }));

    const card = screen.getAllByRole('listitem')[0].querySelector<HTMLElement>('[data-slot="report-card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('relative', 'rounded-lg', 'border', 'border-border', 'bg-surface', 'p-5');
    expect(card).toHaveClass('hover:border-line-ink-20', 'motion-safe:hover:-translate-y-px', 'duration-(--duration-fast)', 'ease-out-expo');
    expect(card).toHaveClass('has-focus-visible:outline-2', 'has-focus-visible:outline-offset-2', 'has-focus-visible:outline-ring');
    const heading = within(card!).getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('text-heading-sm');
    // The link's box stretches over the whole card, and the chevron is the at-rest cue (X-13).
    expect(within(heading).getByRole('link')).toHaveClass('after:absolute', 'after:inset-0');
    expect(card!.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(card!).getByText(definitions[0].description)).toHaveClass('text-sm', 'text-foreground-secondary');
  });

  it('resolves the guarded E2E fixture only after a successful read', async () => {
    mocks.resolveE2eUiState.mockImplementation(() => {
      calls.push('fixture');
      return 'empty';
    });

    render(await ReportIndexContent({ searchParams: Promise.resolve({ __e2eState: 'empty' }) }));

    expect(calls).toEqual(['capability:assessment:review', 'report-definitions', 'fixture']);
    expect(document.querySelector('[data-ui-state="empty"]')).not.toBeNull();
    // A fixture renders safe empty data, never the definitions the read returned.
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'No reports' })).toBeInTheDocument();
  });

  it('wraps the populated index in its guarded boundary for the populated fixture', async () => {
    mocks.resolveE2eUiState.mockReturnValue('populated');

    render(await ReportIndexContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    const boundary = document.querySelector<HTMLElement>('[data-ui-state="populated"]');
    expect(boundary).not.toBeNull();
    expect(within(boundary!).getAllByRole('link')).toHaveLength(4);
  });

  it.each(['loading', 'error', 'permission'] as const)('renders the %s fixture inside its guarded boundary without report links', async (state) => {
    mocks.resolveE2eUiState.mockReturnValue(state);

    render(await ReportIndexContent({ searchParams: Promise.resolve({ __e2eState: state }) }));

    const boundary = document.querySelector<HTMLElement>(`[data-ui-state="${state}"]`);
    expect(boundary).not.toBeNull();
    expect(document.querySelector('a[href^="/app/reports/"]')).toBeNull();
    if (state === 'loading') expect(within(boundary!).getByRole('status', { name: 'Loading reports' })).toBeInTheDocument();
    if (state === 'error') {
      expect(within(boundary!).getByRole('alert')).toHaveTextContent('We couldn’t load reports');
      expect(within(boundary!).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    }
    if (state === 'permission') expect(within(boundary!).getByRole('alert')).toHaveTextContent('You don’t have access to reports');
  });
});

describe('Report index route files', () => {
  const route = (file: string) => readFileSync(resolve(process.cwd(), `app/(app)/app/reports/(report-index)/${file}`), 'utf8');

  it('keeps the page a synchronous, server-owned shell that gates before it reads', () => {
    const page = route('page.tsx');
    expect(metadata).toEqual({ title: 'Reports | IdamBox CSRM' });
    expect(page).toContain("can('assessment:review'");
    expect(page).toContain('listReportDefinitions');
    expect(page).toContain('<Suspense');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
    expect(page).not.toMatch(/export default async function/);
    expect(page.indexOf("can('assessment:review'")).toBeLessThan(page.indexOf('listReportDefinitions('));
    expect(page.indexOf('listReportDefinitions(')).toBeLessThan(page.indexOf('resolveE2eUiState('));
    expect(ReportsPage.constructor.name).not.toBe('AsyncFunction');
  });

  it('gives the index its own loading and error boundaries under the real header', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    const loading = render(<ReportsLoading />);
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText(reportsDescription)).toBeInTheDocument();
    const status = screen.getByRole('status', { name: 'Loading reports' });
    expect(within(status).getByText('Loading reports')).toHaveClass('sr-only');
    expect(status.querySelectorAll('[data-slot="report-card-skeleton"]')).toHaveLength(4);
    // Never the Requestor dashboard's skeleton.
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    loading.unmount();

    render(<ReportsError error={new Error('boom')} retry={retry} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText(reportsDescription)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load reports');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);

    const error = route('error.tsx');
    expect(error).toContain("'use client'");
    expect(error).toMatch(/retry=\{retry\}/);
  });

  it('keeps the index boundaries inside the index route group, so no report detail inherits them', () => {
    expect(existsSync(resolve(process.cwd(), 'app/(app)/app/reports/(report-index)/loading.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app/(app)/app/reports/(report-index)/error.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app/(app)/app/reports/loading.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/(app)/app/reports/error.tsx'))).toBe(false);
  });
});

describe('Report detail metadata', () => {
  it.each([
    ['a Requestor', 'risk-exposure', 'Reports | IdamBox CSRM'],
    ['a Requestor', 'not-a-report', 'Reports | IdamBox CSRM'],
    ['an analyst', 'risk-exposure', 'Risk Exposure Report | IdamBox CSRM'],
    ['an analyst', 'not-a-report', 'Reports | IdamBox CSRM'],
  ] as const)('titles the document for %s on %s', async (actor, reportKey, title) => {
    if (actor === 'a Requestor') signInAsRequestor();

    expect(await generateMetadata({ params: trackedParams(reportKey) })).toEqual({ title });
    // The capability is resolved first; a refused viewer's key is never even read.
    expect(calls).toEqual(actor === 'a Requestor' ? ['capability:assessment:review'] : ['capability:assessment:review', 'params']);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getReport).not.toHaveBeenCalled();
  });
});

describe('Report detail route', () => {
  it.each(['risk-exposure', 'not-a-report'])('refuses a Requestor on %s with the Reports header, before any key check or read', async (reportKey) => {
    signInAsRequestor();

    await renderReportPage(reportKey, { __e2eState: 'populated' });

    expect(calls).toEqual(['capability:assessment:review']);
    expect(mocks.getReport).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText(reportsDescription)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    // Nothing on the page tells a real report from an invented one.
    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByText('Risk exposure')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('calls notFound for an analyst with an unknown key, before any read', async () => {
    await expect(ReportPage({ params: trackedParams('not-a-report'), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(calls).toEqual(['capability:assessment:review', 'params', 'not-found']);
    expect(mocks.getReport).not.toHaveBeenCalled();
  });

  it('renders an analyst the breadcrumb, the report header, the as-at line, the Summary tiles and the sections', async () => {
    await renderReportPage('risk-exposure');

    expect(mocks.getReport).toHaveBeenCalledTimes(1);
    expect(mocks.getReport).toHaveBeenCalledWith('risk-exposure');
    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/app/reports');
    expect(within(breadcrumb).getByText('Risk exposure')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Risk exposure' })).toBeInTheDocument();
    expect(screen.getByText('Open contextual Risks by rating and treatment status, and the Information Systems carrying the most High and Critical residual Risks.')).toBeInTheDocument();
    const asAt = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Computed from current records as at 24 Sept 2026.');
    expect(asAt.querySelector('time')).toHaveAttribute('dateTime', '2026-09-24');
    expect(within(screen.getByRole('region', { name: 'Summary' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Inherent and residual rating' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Residual rating by treatment status' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Most exposed Information Systems' })).toBeInTheDocument();
  });

  it('reads the throughput period from the URL for both the header control and the read', async () => {
    mocks.getReport.mockResolvedValue({ data: { ...assessmentThroughput, period: 12 }, error: null });

    await renderReportPage('assessment-throughput', { period: '12' });

    expect(mocks.getReport).toHaveBeenCalledTimes(1);
    expect(mocks.getReport).toHaveBeenCalledWith('assessment-throughput', { period: 12 });
    expect(screen.getByRole('heading', { level: 1, name: 'Assessment throughput' })).toBeInTheDocument();
    const period = screen.getByRole('radiogroup', { name: 'Period' });
    expect(within(period).getByRole('radio', { name: '12 months' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Released per month' })).toBeInTheDocument();
  });

  it.each([[{}], [{ period: '3' }], [{ period: 'twelve' }]] as const)('reads %j as the default six months', async (searchParams) => {
    mocks.getReport.mockResolvedValue({ data: assessmentThroughput, error: null });

    await renderReportPage('assessment-throughput', searchParams);

    expect(mocks.getReport).toHaveBeenCalledWith('assessment-throughput', { period: 6 });
    expect(within(screen.getByRole('radiogroup', { name: 'Period' })).getByRole('radio', { name: '6 months' })).toBeChecked();
  });

  it('offers no period control, and sends no period, for any other report', async () => {
    await renderReportPage('risk-exposure', { period: '12' });

    expect(mocks.getReport).toHaveBeenCalledWith('risk-exposure');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('caps the report page at the reading width', async () => {
    const { container } = await renderReportPage('risk-exposure');

    expect(container.querySelector('[data-slot="report-page"]')).toHaveClass('max-w-container-max');
  });

  it('renders the permission state when Strapi refuses the read', async () => {
    mocks.getReport.mockResolvedValue({ data: null, error: { status: 403, message: 'Forbidden' } });

    render(await ReportDetailContent({ reportKey: 'risk-exposure', searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to reports');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('renders the error state with Try again for any other failure', async () => {
    const user = userEvent.setup();
    mocks.getReport.mockResolvedValue({ data: null, error: { status: 500, message: 'The CSRM service is unavailable. Please try again later.' } });

    render(await ReportDetailContent({ reportKey: 'risk-exposure', searchParams: Promise.resolve({}) }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load this report');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
  });

  it('resolves the guarded E2E fixture only after a successful read, and empties the report safely', async () => {
    mocks.resolveE2eUiState.mockImplementation(() => {
      calls.push('fixture');
      return 'empty';
    });

    render(await ReportDetailContent({ reportKey: 'risk-exposure', searchParams: Promise.resolve({ __e2eState: 'empty' }) }));

    expect(calls).toEqual(['report', 'fixture']);
    const boundary = document.querySelector<HTMLElement>('[data-ui-state="empty"]');
    expect(boundary).not.toBeNull();
    expect(within(boundary!).getAllByRole('heading', { name: 'No open contextual Risks' })).toHaveLength(2);
    expect(within(boundary!).queryByRole('table')).not.toBeInTheDocument();
    expect(within(boundary!).getByRole('link', { name: 'Open contextual Risks 0' })).toHaveAttribute('href', '/app/risks?state=open');
  });

  it.each(['loading', 'error', 'permission'] as const)('renders the %s fixture inside its guarded boundary without figures', async (state) => {
    mocks.resolveE2eUiState.mockReturnValue(state);

    render(await ReportDetailContent({ reportKey: 'risk-exposure', searchParams: Promise.resolve({ __e2eState: state }) }));

    const boundary = document.querySelector<HTMLElement>(`[data-ui-state="${state}"]`);
    expect(boundary).not.toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Summary' })).not.toBeInTheDocument();
    if (state === 'loading') expect(within(boundary!).getByRole('status', { name: 'Loading report' })).toBeInTheDocument();
    if (state === 'error') {
      expect(within(boundary!).getByRole('alert')).toHaveTextContent('We couldn’t load this report');
      expect(within(boundary!).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    }
    if (state === 'permission') expect(within(boundary!).getByRole('alert')).toHaveTextContent('You don’t have access to reports');
  });
});

describe('Report detail route files', () => {
  const route = (file: string) => readFileSync(resolve(process.cwd(), `app/(app)/app/reports/[reportKey]/${file}`), 'utf8');

  it('ships its own page, loading, error and not-found files', () => {
    for (const file of ['page.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx']) {
      expect(existsSync(resolve(process.cwd(), `app/(app)/app/reports/[reportKey]/${file}`)), file).toBe(true);
    }
  });

  it('resolves the capability before it validates the key, in the page and in its metadata', () => {
    const page = route('page.tsx');
    expect(page).toContain('export async function generateMetadata');
    expect(page).toContain("can('assessment:review'");
    expect(page.indexOf("can('assessment:review'")).toBeLessThan(page.indexOf('isReportKey('));
    expect(page).toContain('getReport(');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
  });

  it('shows the Reports root and skeletons while any report loads, never the Requestor dashboard', () => {
    render(<ReportLoading />);

    expect(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/app/reports');
    const status = screen.getByRole('status', { name: 'Loading report' });
    expect(within(status).getByText('Loading report')).toHaveClass('sr-only');
    expect(status.querySelectorAll('[data-slot="kpi-tile-skeleton"]').length).toBeGreaterThan(0);
    expect(status.querySelectorAll('[data-slot="report-section-skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('recovers from a failed report under the Reports header with Try again', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    render(<ReportError error={new Error('boom')} retry={retry} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this report');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    const error = route('error.tsx');
    expect(error).toContain("'use client'");
    expect(error).toMatch(/retry=\{retry\}/);
  });

  it('says a report was not found and offers the Reports list', () => {
    render(<ReportNotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Report not found' })).toBeInTheDocument();
    expect(screen.getByText('Choose a report from the Reports list.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View reports' });
    expect(link).toHaveAttribute('href', '/app/reports');
    expect(link).toHaveClass('border', 'border-border', 'bg-surface', 'rounded-full');
  });
});
