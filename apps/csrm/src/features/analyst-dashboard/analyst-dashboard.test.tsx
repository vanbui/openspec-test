import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AlertItem } from '../alerts/alert-schema';
import type { AnalystDashboard as AnalystDashboardData, AnalystDashboardUnits } from './analyst-dashboard-service';

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  getAnalystDashboard: vi.fn(),
  granted: vi.fn(),
  refresh: vi.fn(),
  resolveE2eAnalystDashboardPartial: vi.fn(),
  resolveE2eUiState: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review',
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
vi.mock('@/features/analyst-dashboard/analyst-dashboard-service', () => ({ getAnalystDashboard: mocks.getAnalystDashboard }));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eAnalystDashboardPartial: mocks.resolveE2eAnalystDashboardPartial,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import HomePage from '../../../app/(app)/app/page';
import { AnalystHomeContent } from '../home/analyst-home';
import { TimeZoneProvider } from '@/components/csrm/local-time';
import { AnalystDashboard, AnalystDashboardSkeleton } from './analyst-dashboard';
import { emptyAnalystDashboard } from './analyst-dashboard-presentation';

const homeDescription = 'What needs your action, and where your work stands.';
/* D-18 (UI-SPEC §5.3): the queue, then deadlines and alerts, then exposure, then activity. */
const widgetHeadings = [
  'Review queue',
  'Treatments due',
  'Upcoming due dates',
  'Top alerts',
  'Risk exposure',
  'High and Critical residual Risks',
  'Recent activity',
] as const;

function alertOf(overrides: Partial<Omit<AlertItem, 'source' | 'link'>> & { source?: Partial<AlertItem['source']>; link?: Partial<AlertItem['link']> } = {}): AlertItem {
  const { source, link, ...rest } = overrides;
  return {
    id: 'risk-treatment-overdue:risk-h1',
    kind: 'risk-treatment-overdue',
    urgency: 'overdue',
    governingDate: '2026-09-12',
    dayOffset: -12,
    residualRating: 'High',
    ...rest,
    source: { type: 'risk', documentId: 'risk-h1', identifier: 'RSK-2026-H1', title: 'Payroll servers are unpatched.', released: false, ...source },
    link: { type: 'risk', documentId: 'risk-h1', ...link },
  };
}

const overdueTreatment = alertOf();
const dueSoonTreatment = alertOf({
  id: 'risk-treatment-due-soon:risk-c1',
  kind: 'risk-treatment-due-soon',
  urgency: 'due-soon',
  governingDate: '2026-09-29',
  dayOffset: 5,
  residualRating: 'Critical',
  source: { documentId: 'risk-c1', identifier: 'RSK-2026-C1', title: 'Administrator sign-in lacks multi-factor authentication.' },
  link: { documentId: 'risk-c1' },
});
const dueSoonRequest = alertOf({
  id: 'request-due-soon:request-7',
  kind: 'request-due-soon',
  urgency: 'due-soon',
  governingDate: '2026-09-30',
  dayOffset: 6,
  residualRating: null,
  source: { type: 'assessment-request', documentId: 'request-7', identifier: 'RAR-2026-0007', title: 'Payroll platform assessment' },
  link: { type: 'assessment-request', documentId: 'request-7' },
});

const readyUnits: AnalystDashboardUnits = {
  kpi: { status: 'ready', data: { requiresAttention: 4, overdue: 3, dueSoon: 5, attention: 2 } },
  reviewQueue: {
    status: 'ready',
    data: { requiresAttention: 4, awaitingRequestor: 1, generationInProgress: 0, questionnairesReadyForReview: 3, assessmentsDraft: 1, assessmentsInReview: 2 },
  },
  riskExposure: { status: 'ready', data: { Critical: 1, High: 2, Moderate: 1, Low: 0, notRated: 1, total: 5 } },
  highCritical: {
    status: 'ready',
    data: {
      rows: [
        { documentId: 'risk-c1', riskNumber: 'RSK-2026-C1', riskStatement: 'Administrator sign-in lacks multi-factor authentication.', residualRating: 'Critical', targetDate: '2026-09-29', treatmentDueState: 'due-soon' },
        { documentId: 'risk-h1', riskNumber: 'RSK-2026-H1', riskStatement: 'Payroll servers are unpatched.', residualRating: 'High', targetDate: '2026-09-12', treatmentDueState: 'overdue' },
        { documentId: 'risk-h2', riskNumber: 'RSK-2026-H2', riskStatement: null, residualRating: 'High', targetDate: null, treatmentDueState: 'no-target-date' },
      ],
      total: 6,
      truncated: true,
    },
  },
  treatmentsDue: { status: 'ready', data: { rows: [overdueTreatment, dueSoonTreatment], total: 2 } },
  upcomingDueDates: { status: 'ready', data: { rows: [dueSoonTreatment, dueSoonRequest], total: 7 } },
  topAlerts: { status: 'ready', data: { rows: [overdueTreatment, dueSoonTreatment, dueSoonRequest], total: 10 } },
  recentActivity: {
    status: 'ready',
    data: {
      rows: [
        { kind: 'assessment-released', recordType: 'assessment', documentId: 'asm-1', identifier: 'ASM-2026-AB12CD', title: 'Payroll platform assessment', actorDisplayName: 'Bob Doe', occurredAt: '2026-09-24T09:30:00.000Z' },
        { kind: 'questionnaire-returned-to-draft', recordType: 'questionnaire', documentId: 'ques-2', identifier: null, title: 'Payroll questionnaire', actorDisplayName: 'Jane Doe', occurredAt: '2026-09-23T09:00:00.000Z' },
        { kind: 'assessment-draft-generated', recordType: 'assessment', documentId: 'asm-1', identifier: 'ASM-2026-AB12CD', title: 'Payroll platform assessment', actorDisplayName: null, occurredAt: '2026-09-22T17:45:00.000Z' },
      ],
      truncated: true,
    },
  },
};

const dashboard: AnalystDashboardData = { dueSoonWindowDays: 14, units: readyUnits };

function withUnavailable(unit: keyof AnalystDashboardUnits): AnalystDashboardData {
  return { ...dashboard, units: { ...readyUnits, [unit]: { status: 'unavailable' } } };
}

function region(name: string): HTMLElement {
  return screen.getByRole('region', { name });
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
  mocks.getAnalystDashboard.mockImplementation(async () => {
    calls.push('dashboard');
    return { kind: 'ready', dashboard };
  });
  mocks.resolveE2eUiState.mockImplementation(() => {
    calls.push('fixture');
    return undefined;
  });
  mocks.resolveE2eAnalystDashboardPartial.mockImplementation(() => {
    calls.push('partial');
    return false;
  });
});

describe('AnalystDashboard, populated', () => {
  it('leads with a visually hidden Needs action heading over a list of four linked tiles', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const needsAction = region('Needs action');
    const heading = within(needsAction).getByRole('heading', { level: 2, name: 'Needs action' });
    expect(heading).toHaveClass('sr-only');
    const list = within(needsAction).getByRole('list');
    expect(heading.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Two by two below xl, so the Review queue starts within the first 375px screen; four in a row from xl (UI-D20).
    expect(list).toHaveClass('grid-cols-2', 'xl:grid-cols-4');
    expect(list).not.toHaveClass('sm:grid-cols-2');
    const tiles = within(list).getAllByRole('link');
    expect(tiles.map((tile) => tile.getAttribute('href'))).toEqual([
      '/app/review/requests',
      '/app/alerts?urgency=overdue',
      '/app/alerts?urgency=due-soon',
      '/app/alerts?urgency=attention',
    ]);
    // Each tile is one link named by its caption, value and supporting line, in reading order.
    expect(tiles[0]).toHaveAccessibleName('Requires my attention 4 Assessment Requests in your review queue');
    expect(tiles[1]).toHaveAccessibleName('Overdue 3 Past a due, target or review date');
    expect(tiles[2]).toHaveAccessibleName('Due within 14 days 5 Upcoming due, target or review dates');
    expect(tiles[3]).toHaveAccessibleName('Needs attention 2 Untreated Critical Risks and ineffective Control Implementations');
  });

  it('follows the tiles with the seven widgets in D-18 order, led by the Review queue, each a region named by its heading', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Needs action', ...widgetHeadings]);
    for (const name of widgetHeadings) {
      const widget = region(name);
      expect(widget).toHaveClass('@container');
      expect(widget.closest('[data-slot="card"]')).not.toBeNull();
    }
    const grid = region('Review queue').closest('[data-slot="analyst-dashboard-widgets"]');
    expect(grid).toHaveClass('lg:grid-cols-2');
    // Recent activity spans both columns from lg.
    expect(region('Recent activity').closest('[data-slot="card"]')).toHaveClass('lg:col-span-2');
    // No widget header carries a display-size count: the tiles own the counts (UI-D4).
    for (const name of widgetHeadings) expect(region(name).querySelector('.text-display')).toBeNull();
  });

  it('lists every review list count as a link row, zeros included, grouped under micro-label captions', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const queue = region('Review queue');
    expect(within(queue).getByText('Assessment Requests by queue, and Questionnaires and Risk Assessments by status.')).toBeInTheDocument();
    const groups = within(queue).getAllByRole('heading', { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual(['Assessment Requests', 'Questionnaires', 'Risk Assessments']);
    for (const group of groups) expect(group).toHaveClass('micro-label');
    const rows = within(queue).getAllByRole('link');
    expect(rows.map((row) => [row.getAttribute('aria-label'), row.getAttribute('href')])).toEqual([
      ['Requires my attention: 4 Assessment Requests', '/app/review/requests'],
      ['Awaiting Requestor: 1 Assessment Request', '/app/review/requests?queue=awaiting-requestor'],
      ['Generation in progress: 0 Assessment Requests', '/app/review/requests?queue=generation-in-progress'],
      ['Submitted: 3 Questionnaires', '/app/review/questionnaires?status=submitted'],
      ['Draft: 1 Risk Assessment', '/app/review/assessments?status=draft'],
      ['In review: 2 Risk Assessments', '/app/review/assessments?status=in-review'],
    ]);
    // Each row's visible words open its name (SC 2.5.3): the label and the count are separate words.
    const words = (text: string | null) => (text ?? '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    for (const row of rows) expect(words(row.getAttribute('aria-label')).startsWith(words(row.textContent))).toBe(true);
    // Submitted answers stay submitted after release, so the row is a count of the list it opens, not waiting work.
    expect(rows[3]).toHaveTextContent(/^Submitted 3$/);
    expect(queue).not.toHaveTextContent(/ready for review|work waiting/i);
    // A link row is at least the default row height, with the chevron as its at-rest cue.
    for (const row of rows) {
      expect(row).toHaveClass('min-h-11');
      expect(row.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    expect(within(rows[2]).getByText('0')).toBeInTheDocument();
  });

  it('draws Risk exposure as labelled severity rows linked to the open register, and Not rated as plain text', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const exposure = region('Risk exposure');
    const list = within(exposure).getByRole('list', { name: 'Open contextual Risks by residual rating' });
    expect(within(list).getAllByRole('link').map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
      ['Critical: 1 open Risk by residual rating', '/app/risks?residualRating=Critical&state=open'],
      ['High: 2 open Risks by residual rating', '/app/risks?residualRating=High&state=open'],
      ['Moderate: 1 open Risk by residual rating', '/app/risks?residualRating=Moderate&state=open'],
      ['Low: 0 open Risks by residual rating', '/app/risks?residualRating=Low&state=open'],
    ]);
    // The badge keeps the rating's icon and word beside its colour; the link names the row, so the badge
    // inside it does not name itself, and the link's visible words open its name (SC 2.5.3).
    const critical = within(list).getAllByRole('link')[0]!;
    expect(critical).toHaveTextContent(/^Critical 1$/);
    expect(critical.querySelector('[data-slot="badge"]')).toHaveTextContent('Critical');
    expect(within(list).queryByLabelText(/^Severity:/)).toBeNull();
    const notRated = within(list).getAllByRole('listitem').at(-1)!;
    expect(notRated).toHaveTextContent(/^Not rated 1$/);
    expect(within(notRated).queryByRole('link')).toBeNull();
    const marks = [...list.querySelectorAll('[data-slot="bar-chart-mark"]')];
    expect(marks[0]).toHaveClass('bg-risk-critical');
    expect(marks.at(-1)).toHaveClass('bg-chart-1');
  });

  it('lists High and Critical residual Risks with one record link each, the overdue marker only where the server says so', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const widget = region('High and Critical residual Risks');
    const items = within(within(widget).getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    items.forEach((item, index) => {
      const row = readyUnits.highCritical.status === 'ready' ? readyUnits.highCritical.data.rows[index] : null;
      expect(within(item).getAllByRole('link')).toHaveLength(1);
      expect(within(item).getByRole('link', { name: row!.riskNumber })).toHaveAttribute('href', `/app/risks/${row!.documentId}`);
      expect(within(item).getByRole('link')).toHaveClass('record-link');
    });
    expect(within(items[0]).getByText('Administrator sign-in lacks multi-factor authentication.')).toHaveClass('line-clamp-2');
    expect(within(items[0]).getByLabelText('Severity: critical (4 of 4)')).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Target date 29 Sept 2026');
    expect(items[0].querySelector('time')).toHaveAttribute('dateTime', '2026-09-29');
    expect(items[0].querySelector('[data-slot="alert-urgency"]')).toBeNull();
    // Overdue only when the D-04 rule the server applied says so: the dense urgency marker.
    const overdue = items[1].querySelector<HTMLElement>('[data-slot="alert-urgency"]');
    expect(overdue).not.toBeNull();
    expect(overdue).toHaveAttribute('data-urgency', 'overdue');
    expect(overdue).toHaveTextContent('Urgency: Overdue');
    expect(items[2]).toHaveTextContent('No target date');
    expect(items[2].querySelector('[data-slot="alert-urgency"]')).toBeNull();
    // Truncated by the server: the note, then the register link.
    expect(within(widget).getByText('Showing 3 of 6')).toHaveClass('tabular-nums');
    expect(within(widget).getByRole('link', { name: 'Open Risk Register' })).toHaveAttribute('href', '/app/risks?state=open&sort=residualRating:desc');
  });

  it('states the list role on every tile and row list, whose markers are removed, with one item per row', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const queue = region('Review queue');
    const lists: Array<[HTMLElement, number]> = [
      [within(region('Needs action')).getByRole('list'), 4],
      [within(queue).getByRole('list', { name: 'Assessment Requests' }), 3],
      [within(queue).getByRole('list', { name: 'Questionnaires' }), 1],
      [within(queue).getByRole('list', { name: 'Risk Assessments' }), 2],
      [within(region('Risk exposure')).getByRole('list', { name: 'Open contextual Risks by residual rating' }), 5],
      [within(region('High and Critical residual Risks')).getByRole('list'), 3],
      [within(region('Treatments due')).getByRole('list'), 2],
      [within(region('Upcoming due dates')).getByRole('list'), 2],
      [within(region('Top alerts')).getByRole('list'), 3],
      [within(region('Recent activity')).getByRole('list'), 3],
    ];
    for (const [list, count] of lists) {
      // WebKit drops list semantics from an unmarked list unless the role is stated, so the count is lost.
      expect(list).toHaveAttribute('role', 'list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(count);
    }
    expect(document.querySelectorAll('ul')).toHaveLength(lists.length);
    expect(document.querySelectorAll('ul:not([role="list"])')).toHaveLength(0);
  });

  it('reuses the shared alert rows: default in Treatments due and Top alerts, the agenda variant in Upcoming due dates', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const treatments = region('Treatments due');
    expect([...treatments.querySelectorAll('[data-slot="alert-row"]')].map((row) => row.getAttribute('data-variant'))).toEqual(['default', 'default']);
    expect(within(treatments).queryByText(/^Showing /)).toBeNull();
    expect(within(treatments).getByRole('link', { name: 'View overdue treatments' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-overdue');
    expect(within(treatments).getByRole('link', { name: 'View treatments due soon' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-due-soon');
    expect(within(treatments).getByText('Risk treatments past their target date or due within 14 days, most overdue first.')).toBeInTheDocument();

    const upcoming = region('Upcoming due dates');
    expect([...upcoming.querySelectorAll('[data-slot="alert-row"]')].map((row) => row.getAttribute('data-variant'))).toEqual(['agenda', 'agenda']);
    expect(within(upcoming).getByText('Showing 2 of 7')).toBeInTheDocument();
    expect(within(upcoming).getByRole('link', { name: 'View everything due soon' })).toHaveAttribute('href', '/app/alerts?urgency=due-soon');

    const top = region('Top alerts');
    expect(top.querySelectorAll('[data-slot="alert-row"][data-variant="default"]')).toHaveLength(3);
    expect(within(top).getByRole('link', { name: 'RSK-2026-H1' })).toHaveAttribute('href', '/app/risks/risk-h1');
    expect(within(top).getByRole('link', { name: 'RAR-2026-0007' })).toHaveAttribute('href', '/app/review/requests/request-7');
    expect(within(top).getByText('Showing 3 of 10')).toBeInTheDocument();
    expect(within(top).getByRole('link', { name: 'View all alerts' })).toHaveAttribute('href', '/app/alerts');
  });

  it('words recent activity with its actor only when recorded, an absolute date and one link per event', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard }} />);

    const activity = region('Recent activity');
    const items = within(within(activity).getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const item of items) expect(within(item).getAllByRole('link')).toHaveLength(1);

    expect(within(items[0]).getByRole('link', { name: 'ASM-2026-AB12CD' })).toHaveAttribute('href', '/app/review/assessments/asm-1');
    expect(items[0]).toHaveTextContent('released by Bob Doe');
    expect(items[0].querySelector('time')).toHaveAttribute('dateTime', '2026-09-24T09:30:00.000Z');
    expect(items[0].querySelector('time')).toHaveTextContent('24 Sept 2026');
    expect(within(items[0]).getByText('Risk Assessment · Payroll platform assessment')).toHaveClass('line-clamp-1');

    // A questionnaire without a number: its title carries the link.
    expect(within(items[1]).getByRole('link', { name: 'Payroll questionnaire' })).toHaveAttribute('href', '/app/review/questionnaires/ques-2');
    expect(items[1]).toHaveTextContent('returned to draft by Jane Doe');

    // A generated draft is advisory: no actor and never "approved" or "released".
    expect(items[2]).toHaveTextContent('draft generated for Security Analyst review');
    expect(items[2]).not.toHaveTextContent(/approved|released|by /);

    expect(within(activity).getByText('Showing the 3 most recent events')).toBeInTheDocument();
  });

  it('dates recent activity in the viewer’s time zone, keeping the instant machine-readable (D-55, X-3)', () => {
    const lateEvening = {
      ...dashboard,
      units: {
        ...readyUnits,
        recentActivity: {
          status: 'ready' as const,
          data: {
            rows: [
              { kind: 'assessment-released' as const, recordType: 'assessment' as const, documentId: 'asm-1', identifier: 'ASM-2026-AB12CD', title: 'Payroll platform assessment', actorDisplayName: 'Bob Doe', occurredAt: '2026-09-24T20:30:00.000Z' },
            ],
            truncated: false,
          },
        },
      },
    };
    render(<TimeZoneProvider zone="Australia/Brisbane"><AnalystDashboard state={{ kind: 'ready', dashboard: lateEvening }} /></TimeZoneProvider>);

    // 20:30 UTC on 24 September is 06:30 on 25 September in Brisbane: the date is the viewer's, not UTC's.
    const time = within(region('Recent activity')).getByText('25 Sept 2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2026-09-24T20:30:00.000Z');
  });
});

describe('AnalystDashboard, empty', () => {
  it('shows each widget’s cleared state with its domain fact and no call to action, and zero tiles that still link', () => {
    render(<AnalystDashboard state={{ kind: 'ready', dashboard: emptyAnalystDashboard(14) }} />);

    const cleared: Array<[string, string, string]> = [
      ['Risk exposure', 'No open contextual Risks', 'Risks appear here when a Risk Assessment identifies them.'],
      ['High and Critical residual Risks', 'No High or Critical residual Risks', 'Open Risks rated High or Critical after treatment appear here.'],
      ['Treatments due', 'No treatments due', 'Treatments past their target date, or due within 14 days, appear here.'],
      ['Upcoming due dates', 'No upcoming due dates', 'Due, target and review dates in the next 14 days appear here.'],
      ['Top alerts', 'No alerts', 'Nothing is overdue, due within 14 days, or flagged for attention.'],
      ['Recent activity', 'No recent activity', 'Submissions, generated drafts, releases and returns to draft appear here.'],
    ];
    for (const [widget, heading, description] of cleared) {
      const section = region(widget);
      expect(within(section).getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
      expect(within(section).getByText(description)).toBeInTheDocument();
      // Quiet, consistent empty states: no link, button or truncation note.
      expect(within(section).queryByRole('link')).toBeNull();
      expect(within(section).queryByRole('button')).toBeNull();
      expect(section.querySelector('[data-state-kind="empty"]')).not.toBeNull();
    }

    // Zero rows are data: the Review queue has no empty state.
    const queue = region('Review queue');
    expect(queue.querySelector('[data-state-kind]')).toBeNull();
    expect(within(queue).getAllByRole('link')).toHaveLength(6);

    const tiles = within(region('Needs action')).getAllByRole('link');
    expect(tiles).toHaveLength(4);
    for (const tile of tiles) expect(within(tile).getByText('0')).toBeInTheDocument();
  });
});

describe('AnalystDashboard, partial failure', () => {
  it('replaces only the KPI strip with a compact error when the summary counts are unavailable', async () => {
    const user = userEvent.setup();
    render(<AnalystDashboard state={{ kind: 'ready', dashboard: withUnavailable('kpi') }} />);

    const needsAction = region('Needs action');
    expect(within(needsAction).getByRole('heading', { level: 2, name: 'Needs action' })).toBeInTheDocument();
    const alert = within(needsAction).getByRole('alert');
    expect(within(alert).getByRole('heading', { level: 3, name: 'We couldn’t load the summary counts' })).toBeInTheDocument();
    expect(needsAction.querySelector('[data-slot="kpi-tile"]')).toBeNull();
    expect(within(needsAction).queryByRole('link')).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    // Every widget still renders.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(region('Review queue')).getAllByRole('link')).toHaveLength(6);
  });

  it.each([
    ['reviewQueue', 'Review queue', 'We couldn’t load the review queue'],
    ['riskExposure', 'Risk exposure', 'We couldn’t load Risk exposure'],
    ['highCritical', 'High and Critical residual Risks', 'We couldn’t load High and Critical residual Risks'],
    ['treatmentsDue', 'Treatments due', 'We couldn’t load treatments due'],
    ['upcomingDueDates', 'Upcoming due dates', 'We couldn’t load upcoming due dates'],
    ['topAlerts', 'Top alerts', 'We couldn’t load alerts'],
    ['recentActivity', 'Recent activity', 'We couldn’t load recent activity'],
  ] as const)('fails %s alone: its heading stays, it shows no count or link, and every sibling renders', async (unit, heading, errorHeading) => {
    const user = userEvent.setup();
    render(<AnalystDashboard state={{ kind: 'ready', dashboard: withUnavailable(unit) }} />);

    const failed = region(heading);
    expect(within(failed).getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    const alert = within(failed).getByRole('alert');
    expect(alert).toHaveAttribute('data-state-kind', 'error');
    expect(within(alert).getByRole('heading', { level: 3, name: errorHeading })).toBeInTheDocument();
    expect(within(failed).queryByRole('link')).toBeNull();
    expect(within(failed).queryByRole('list')).toBeNull();
    expect(within(failed).queryByText(/^Showing /)).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // Exactly one failure on the page; the tiles and the other widgets are untouched.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(region('Needs action')).getAllByRole('link')).toHaveLength(4);
    for (const sibling of widgetHeadings.filter((name) => name !== heading)) {
      expect(within(region(sibling)).queryByRole('alert')).toBeNull();
    }
  });
});

describe('AnalystDashboard, page states', () => {
  it('shows the page error, with Try again, and no tile or widget when the summary itself failed', async () => {
    const user = userEvent.setup();
    render(<AnalystDashboard state={{ kind: 'error' }} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load the review summary');
    expect(alert).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.querySelector('[data-slot="kpi-tile"]')).toBeNull();
  });

  it('shows the permission state with Return to sign in, and nothing else', () => {
    render(<AnalystDashboard state={{ kind: 'permission-denied' }} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('You don’t have access to the review summary');
    // Home is where this state renders, so a link back to Home would loop (UI-D19).
    expect(within(alert).getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('loads as a labelled skeleton of four tiles and seven widgets in the final layout', () => {
    render(<AnalystDashboardSkeleton />);

    const status = screen.getByRole('status', { name: 'Loading Home' });
    expect(within(status).getByText('Loading Home')).toHaveClass('sr-only');
    expect(status.querySelectorAll('[data-slot="kpi-tile-skeleton"]')).toHaveLength(4);
    const widgets = status.querySelectorAll('[data-slot="dashboard-widget-skeleton"]');
    expect(widgets).toHaveLength(7);
    // The skeleton keeps the D-18 order's spans: only the last, Recent activity, spans both columns from lg.
    expect(widgets[6]).toHaveClass('lg:col-span-2');
    for (const widget of Array.from(widgets).slice(0, 6)) expect(widget).not.toHaveClass('lg:col-span-2');
    for (const widget of widgets) expect(widget.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(6);
    expect(status.querySelector('[data-slot="kpi-tile-strip"]')).toHaveClass('grid-cols-2', 'xl:grid-cols-4');
    expect(status.querySelector('[data-slot="kpi-tile-strip"]')).not.toHaveClass('sm:grid-cols-2');
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('Analyst Home content', () => {
  it('refuses a Requestor at the assessment:review gate before any analyst read or fixture', async () => {
    signInAsRequestor();

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'populated', __e2ePartial: 'analyst-top-alerts-error' }) }));

    expect(calls).toEqual(['capability:assessment:review']);
    expect(mocks.getAnalystDashboard).not.toHaveBeenCalled();
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the review summary');
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/sign-in');
    expect(document.querySelector('[data-slot="kpi-tile"]')).toBeNull();
    expect(document.querySelector('a[href^="/app/review/requests/"], a[href^="/app/risks/"]')).toBeNull();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('refuses a viewer with no session the same way', async () => {
    mocks.current.mockResolvedValue(null);

    render(await AnalystHomeContent({ searchParams: Promise.resolve({}) }));

    expect(mocks.getAnalystDashboard).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the review summary');
  });

  it('gates, reads, then resolves the fixture and the partial selector, in that order', async () => {
    render(await AnalystHomeContent({ searchParams: Promise.resolve({}) }));

    expect(calls[0]).toBe('capability:assessment:review');
    expect(calls[1]).toBe('dashboard');
    expect(calls.slice(2).sort()).toEqual(['fixture', 'partial']);
    expect(mocks.getAnalystDashboard).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-ui-state]')).toBeNull();
    expect(within(region('Needs action')).getAllByRole('link')).toHaveLength(4);
  });

  it('renders the permission state, outside any fixture, when Strapi refuses a read', async () => {
    mocks.getAnalystDashboard.mockResolvedValue({ kind: 'permission-denied' });

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the review summary');
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(mocks.resolveE2eAnalystDashboardPartial).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('renders the page error, outside any fixture, when the summary fails', async () => {
    mocks.getAnalystDashboard.mockResolvedValue({ kind: 'error' });

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the review summary');
    expect(mocks.resolveE2eUiState).not.toHaveBeenCalled();
    expect(document.querySelector('[data-ui-state]')).toBeNull();
  });

  it('wraps the real dashboard in the guarded boundary for the populated fixture', async () => {
    mocks.resolveE2eUiState.mockReturnValue('populated');

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'populated' }) }));

    const boundary = document.querySelector<HTMLElement>('[data-ui-state="populated"]');
    expect(boundary).not.toBeNull();
    expect(within(boundary!).getByRole('region', { name: 'Top alerts' })).toBeInTheDocument();
    expect(within(boundary!).getAllByRole('link', { name: 'RSK-2026-C1' }).length).toBeGreaterThan(0);
  });

  it('renders the safe empty dashboard for the empty fixture, never the records the read returned', async () => {
    mocks.resolveE2eUiState.mockReturnValue('empty');

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'empty' }) }));

    const boundary = document.querySelector<HTMLElement>('[data-ui-state="empty"]');
    expect(boundary).not.toBeNull();
    expect(within(boundary!).getByRole('heading', { name: 'No alerts' })).toBeInTheDocument();
    expect(within(boundary!).getByText('Nothing is overdue, due within 14 days, or flagged for attention.')).toBeInTheDocument();
    expect(boundary!.querySelector('a.record-link')).toBeNull();
    expect(within(boundary!).queryByText('Showing 3 of 10')).toBeNull();
  });

  it.each(['loading', 'error', 'permission'] as const)('renders the %s fixture inside its guarded boundary without figures or records', async (state) => {
    mocks.resolveE2eUiState.mockReturnValue(state);

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: state }) }));

    const boundary = document.querySelector<HTMLElement>(`[data-ui-state="${state}"]`);
    expect(boundary).not.toBeNull();
    expect(document.querySelector('[data-slot="kpi-tile"]')).toBeNull();
    expect(document.querySelector('a.record-link')).toBeNull();
    if (state === 'loading') expect(within(boundary!).getByRole('status', { name: 'Loading Home' })).toBeInTheDocument();
    if (state === 'error') {
      expect(within(boundary!).getByRole('alert')).toHaveTextContent('We couldn’t load the review summary');
      expect(within(boundary!).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    }
    if (state === 'permission') expect(within(boundary!).getByRole('alert')).toHaveTextContent('You don’t have access to the review summary');
  });

  it('fails only Top alerts under the attested partial selector, after the real reads succeeded', async () => {
    mocks.resolveE2eUiState.mockReturnValue('populated');
    mocks.resolveE2eAnalystDashboardPartial.mockImplementation(() => {
      calls.push('partial');
      return true;
    });

    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2eState: 'populated', __e2ePartial: 'analyst-top-alerts-error' }) }));

    expect(calls.indexOf('partial')).toBeGreaterThan(calls.indexOf('dashboard'));
    const top = region('Top alerts');
    expect(within(top).getByRole('alert')).toHaveTextContent('We couldn’t load alerts');
    expect(within(top).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(top).queryByRole('link')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(region('Review queue')).getAllByRole('link')).toHaveLength(6);
    expect(within(region('Risk exposure')).getAllByRole('link')).toHaveLength(4);
  });

  it('leaves Top alerts alone when the partial selector does not resolve', async () => {
    render(await AnalystHomeContent({ searchParams: Promise.resolve({ __e2ePartial: 'analyst-top-alerts-error' }) }));

    expect(within(region('Top alerts')).queryByRole('alert')).toBeNull();
    expect(within(region('Top alerts')).getAllByRole('link').length).toBeGreaterThan(0);
  });
});

describe('Analyst Home route files', () => {
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

  it('chooses the analyst Home from the session at /app, before the boundary and any read', () => {
    const page = source('app/(app)/app/page.tsx');
    expect(page).toContain("can('assessment:review'");
    expect(page).toContain('<Suspense');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
    expect(page.indexOf("can('assessment:review'")).toBeLessThan(page.indexOf('<Suspense'));
    // The page itself reads nothing: each Home's content makes its own authorised reads.
    expect(page).not.toContain('getAnalystDashboard(');
    expect(page).not.toContain('getRequestorDashboard(');
  });

  it('keeps the analyst Home gating before it reads and reading before any fixture', () => {
    const content = source('src/features/home/analyst-home.tsx');
    expect(content.indexOf("can('assessment:review'")).toBeGreaterThan(-1);
    expect(content.indexOf("can('assessment:review'")).toBeLessThan(content.indexOf('getAnalystDashboard('));
    expect(content.indexOf('getAnalystDashboard(')).toBeLessThan(content.indexOf('resolveE2eUiState('));
    expect(content.indexOf('getAnalystDashboard(')).toBeLessThan(content.indexOf('resolveE2eAnalystDashboardPartial('));
  });

  it('renders the Home header over the review summary it streams, with no header action', async () => {
    render(await resolveServerTree(await HomePage({ searchParams: Promise.resolve({}) })));

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText(homeDescription)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(region('Needs action')).toBeInTheDocument();
    // No header action: the tiles are the entry points (D-24).
    expect(screen.getByRole('heading', { level: 1 }).closest('.page-header')?.querySelector('a, button')).toBeNull();
  });

  it('retires the analyst dashboard route group: /app/review is a redirect, not a page', () => {
    for (const file of ['page.tsx', 'loading.tsx', 'error.tsx']) {
      expect(existsSync(resolve(process.cwd(), `app/(app)/app/review/(analyst-dashboard)/${file}`)), `(analyst-dashboard)/${file}`).toBe(false);
      expect(existsSync(resolve(process.cwd(), `app/(app)/app/review/${file}`)), `review/${file}`).toBe(false);
    }
  });
});
