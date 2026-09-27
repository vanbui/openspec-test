import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, use, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver, stubHorizontalGeometry, TestResizeObserver } from '@/test/layout-stubs';

const navigation = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/reports/assessment-throughput',
  useRouter: () => navigation,
}));

import { AssessmentThroughputReportView } from './assessment-throughput-report';
import { ControlEffectivenessReportView } from './control-effectiveness-report';
import { ReportDetailFrame } from './report-detail';
import { ReportBody, ReportPeriodControl, ReportTransitionProvider } from './report-period-control';
import type {
  AssessmentThroughputReport,
  ControlEffectivenessReport,
  ReportPeriod,
  RiskExposureReport,
  TreatmentPerformanceReport,
} from './report-schema';
import { RiskExposureReportView } from './risk-exposure-report';
import { TreatmentPerformanceReportView } from './treatment-performance-report';

beforeEach(() => {
  navigation.refresh.mockReset();
  navigation.replace.mockReset();
});

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
    rows: [
      { documentId: 'system-1', name: 'Alpha system', critical: 1, high: 1, total: 2 },
      { documentId: 'system-2', name: 'Beta system', critical: 1, high: 1, total: 2 },
    ],
    total: 2,
    truncated: false,
    risksWithoutSystem: 1,
  },
};

const noStatus = { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 };
const noRating = { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };
const emptyExposure: RiskExposureReport = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: noRating,
  byInherentRating: noRating,
  residualByTreatmentStatus: { Critical: noStatus, High: noStatus, Moderate: noStatus, Low: noStatus, notRated: noStatus },
  exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
};

const controlEffectiveness: ControlEffectivenessReport = {
  key: 'control-effectiveness',
  today: '2026-09-24',
  implementationStatus: { existing: 1, planned: 1, implemented: 2, retired: 0, notProvided: 1, total: 5 },
  effectivenessRating: { effective: 1, partiallyEffective: 1, ineffective: 1, notAssessed: 1, notProvided: 1, total: 5 },
};

const overdueAlert: TreatmentPerformanceReport['mostOverdue']['rows'][number] = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-B2QDZ6', title: 'Backups are not tested against a restore target.', released: false },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'Critical',
};

const treatmentPerformance: TreatmentPerformanceReport = {
  key: 'treatment-performance',
  today: '2026-09-24',
  dueWindowDays: 30,
  dueState: { overdue: 2, dueWithinWindow: 2, later: 1, noTargetDate: 2, total: 7 },
  treatmentStatus: { notStarted: 3, inProgress: 2, overdue: 1, complete: 1, notProvided: 1, total: 8 },
  mostOverdue: { rows: [overdueAlert], total: 2, truncated: false },
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

function section(name: string) {
  return screen.getByRole('region', { name });
}

function columnHeaders(table: HTMLElement) {
  return within(table).getAllByRole('columnheader').map((header) => header.textContent);
}

function bodyRows(table: HTMLElement) {
  return Array.from(table.querySelectorAll('tbody tr')).map((row) => Array.from(row.children).map((cell) => cell.textContent));
}

function barLabels(chart: Element) {
  return Array.from(chart.querySelectorAll('[data-slot="bar-chart-bars"] > li')).map((row) => row.textContent);
}

function marks(chart: Element) {
  return Array.from(chart.querySelectorAll<HTMLElement>('[data-slot="bar-chart-mark"]'));
}

/** Every table names itself with a hidden caption and heads its columns and rows with scoped cells. */
function expectTextEquivalentTables(container: HTMLElement) {
  const tables = within(container).queryAllByRole('table');
  for (const table of tables) {
    const caption = table.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption).toHaveClass('sr-only');
    expect(table).toHaveAccessibleName(caption!.textContent!);
    for (const header of within(table).getAllByRole('columnheader')) expect(header).toHaveAttribute('scope', 'col');
    for (const header of within(table).getAllByRole('rowheader')) expect(header).toHaveAttribute('scope', 'row');
  }
  return tables;
}

/** Every chart is hidden from assistive technology and holds nothing focusable. */
function expectInertCharts(container: HTMLElement) {
  const charts = Array.from(container.querySelectorAll('[data-slot="bar-chart"]'));
  for (const chart of charts) {
    expect(chart.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(chart.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
  }
  return charts;
}

describe('risk-exposure report', () => {
  beforeEach(() => {
    installTestResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pairs the inherent and residual rating charts, on one shared scale, with one rating table', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const ratings = section('Inherent and residual rating');
    expect(within(ratings).getByText('Open contextual Risks by inherent and residual rating.')).toBeInTheDocument();

    const figure = ratings.querySelector('[data-slot="report-chart"]');
    expect(figure).toHaveAttribute('aria-hidden', 'true');
    const [inherent, residual] = Array.from(figure!.querySelectorAll('[data-slot="bar-chart"]'));
    expect(Array.from(figure!.querySelectorAll('.micro-label')).map((caption) => caption.textContent).slice(0, 2)).toEqual(['Inherent', 'Residual']);
    expect(barLabels(inherent)).toEqual(['Critical 1', 'High 3', 'Moderate 1', 'Low 1', 'Not rated 2']);
    expect(barLabels(residual)).toEqual(['Critical 2', 'High 3', 'Moderate 1', 'Low 1', 'Not rated 1']);
    // One scale for both: 3 is the largest value in either chart.
    expect(marks(inherent).map((mark) => mark.style.inlineSize)).toEqual(['33.33%', '100%', '33.33%', '33.33%', '66.67%']);
    expect(marks(residual).map((mark) => mark.style.inlineSize)).toEqual(['66.67%', '100%', '33.33%', '33.33%', '33.33%']);
    // Severity marks fill with the rating's own fg token; Not rated is ink.
    expect(marks(residual).map((mark) => mark.className.match(/\bbg-(?:risk-\w+|chart-1)\b/)?.[0])).toEqual([
      'bg-risk-critical', 'bg-risk-high', 'bg-risk-medium', 'bg-risk-low', 'bg-chart-1',
    ]);

    const table = within(ratings).getByRole('table', { name: 'Inherent and residual rating' });
    expect(columnHeaders(table)).toEqual(['Rating', 'Inherent', 'Residual']);
    expect(bodyRows(table)).toEqual([
      ['Critical', '1', '2'],
      ['High', '3', '3'],
      ['Moderate', '1', '1'],
      ['Low', '1', '1'],
      ['Not rated', '2', '1'],
    ]);
  });

  it('shows residual rating by treatment status as a table only, in a labelled, focusable scroll region while it overflows', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const crossTab = section('Residual rating by treatment status');
    expect(within(crossTab).getByText(/Treatment status is the value recorded on each Risk\. Overdue by target date is in the Treatment performance report\.$/)).toBeInTheDocument();
    expect(crossTab.querySelector('[data-slot="bar-chart"]')).toBeNull();

    // A phone-width section: the matrix is wider than its region.
    const scroller = crossTab.querySelector<HTMLElement>('[data-slot="report-table-scroll"]')!;
    stubHorizontalGeometry(scroller, { scrollWidth: 520, clientWidth: 311 });
    act(() => TestResizeObserver.notifyAll());

    const region = within(crossTab).getByRole('region', { name: 'Residual rating by treatment status, scrolls horizontally' });
    expect(region).toBe(scroller);
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('data-overflow', 'true');
    expect(region).toHaveAttribute('data-overflow-end', 'false');
    const table = within(region).getByRole('table', { name: 'Residual rating by treatment status' });
    expect(columnHeaders(table)).toEqual(['Residual rating', 'Not Started', 'In Progress', 'Overdue', 'Complete', 'Not provided', 'Total']);
    expect(bodyRows(table)).toEqual([
      ['Critical', '1', '1', '0', '0', '0', '2'],
      ['High', '1', '1', '0', '0', '1', '3'],
      ['Moderate', '0', '0', '0', '1', '0', '1'],
      ['Low', '0', '0', '1', '0', '0', '1'],
      ['Not rated', '1', '0', '0', '0', '0', '1'],
    ]);
    // The first column stays put, with its hairline, while the rest scroll on narrow sections.
    for (const cell of Array.from(table.querySelectorAll('tr > :first-child'))) expect(cell).toHaveClass('@max-2xl:sticky', '@max-2xl:left-0', '@max-2xl:border-r');
  });

  it('exposes no region, tab stop, sticky column or hairline while the cross-tab fits its section', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const crossTab = section('Residual rating by treatment status');
    const scroller = crossTab.querySelector('[data-slot="report-table-scroll"]');
    expect(scroller).toHaveAttribute('data-overflow', 'false');
    for (const attribute of ['role', 'aria-label', 'tabindex']) expect(scroller).not.toHaveAttribute(attribute);
    expect(within(crossTab).queryByRole('region', { name: /scrolls horizontally/ })).not.toBeInTheDocument();

    const table = within(crossTab).getByRole('table', { name: 'Residual rating by treatment status' });
    for (const cell of Array.from(table.querySelectorAll('tr > :first-child'))) {
      expect(cell).not.toHaveClass('@max-2xl:sticky');
      expect(cell).not.toHaveClass('@max-2xl:border-r');
    }
  });

  it('ranks the most exposed Information Systems in ink with plain names, and notes Risks without one', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const systems = section('Most exposed Information Systems');
    const chart = systems.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(chart)).toEqual(['Alpha system 2', 'Beta system 2']);
    expect(marks(chart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    // Names are plain text: no list here has a total equal to these figures (UI-D17).
    expect(within(systems).queryAllByRole('link')).toHaveLength(0);

    const table = within(systems).getByRole('table', { name: 'Most exposed Information Systems' });
    expect(columnHeaders(table)).toEqual(['Information System', 'Critical', 'High', 'Total']);
    expect(bodyRows(table)).toEqual([
      ['Alpha system', '1', '1', '2'],
      ['Beta system', '1', '1', '2'],
    ]);
    expect(within(systems).getByText('1 High or Critical residual Risk has no impacted Information System.')).toBeInTheDocument();
    expect(within(systems).queryByText(/^Showing the top/)).not.toBeInTheDocument();
  });

  it('says how many Information Systems a truncated ranking leaves out', () => {
    render(<RiskExposureReportView report={{ ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, total: 14, truncated: true, risksWithoutSystem: 3 } }} />);

    const systems = section('Most exposed Information Systems');
    expect(within(systems).getByText('Showing the top 2 of 14 Information Systems.')).toBeInTheDocument();
    expect(within(systems).getByText('3 High or Critical residual Risks have no impacted Information System.')).toBeInTheDocument();
  });

  it('keeps every chart inert beside a text-equivalent table', () => {
    const { container } = render(<RiskExposureReportView report={riskExposure} />);

    expect(expectInertCharts(container)).toHaveLength(3);
    expect(expectTextEquivalentTables(container)).toHaveLength(3);
  });

  it('shows the cleared state in every section when no open contextual Risk exists', () => {
    render(<RiskExposureReportView report={emptyExposure} />);

    for (const name of ['Inherent and residual rating', 'Residual rating by treatment status']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No open contextual Risks' })).toBeInTheDocument();
      expect(within(region).getByText('Risks appear here when a Risk Assessment identifies them.')).toBeInTheDocument();
      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    }
    const systems = section('Most exposed Information Systems');
    expect(within(systems).getByRole('heading', { level: 3, name: 'No High or Critical residual Risks' })).toBeInTheDocument();
    expect(within(systems).queryByRole('table')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="bar-chart"]')).toBeNull();
  });
});

describe('control-effectiveness report', () => {
  it('shows implementation status and effectiveness rating as ink bars beside their tables', () => {
    const { container } = render(<ControlEffectivenessReportView report={controlEffectiveness} />);

    const status = section('Implementation status');
    expect(within(status).getByText('Control Implementations on open contextual Risks by implementation status.')).toBeInTheDocument();
    const statusChart = status.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(statusChart)).toEqual(['Existing 1', 'Planned 1', 'Implemented 2', 'Retired 0', 'Not provided 1']);
    const statusTable = within(status).getByRole('table', { name: 'Implementation status' });
    expect(columnHeaders(statusTable)).toEqual(['Implementation status', 'Control Implementations']);
    expect(bodyRows(statusTable)).toEqual([['Existing', '1'], ['Planned', '1'], ['Implemented', '2'], ['Retired', '0'], ['Not provided', '1']]);

    const rating = section('Effectiveness rating');
    expect(within(rating).getByText('Control Implementations on open contextual Risks by effectiveness rating.')).toBeInTheDocument();
    const ratingChart = rating.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(ratingChart)).toEqual(['Effective 1', 'Partially Effective 1', 'Ineffective 1', 'Not Assessed 1', 'Not provided 1']);
    // Effectiveness is not the severity ladder, so every mark is ink.
    expect(marks(ratingChart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    const ratingTable = within(rating).getByRole('table', { name: 'Effectiveness rating' });
    expect(columnHeaders(ratingTable)).toEqual(['Effectiveness rating', 'Control Implementations']);
    expect(bodyRows(ratingTable)).toEqual([['Effective', '1'], ['Partially Effective', '1'], ['Ineffective', '1'], ['Not Assessed', '1'], ['Not provided', '1']]);

    expect(expectInertCharts(container)).toHaveLength(2);
    expect(expectTextEquivalentTables(container)).toHaveLength(2);
  });

  it('shows the cleared state in both sections when there is no Control Implementation', () => {
    render(<ControlEffectivenessReportView report={{
      ...controlEffectiveness,
      implementationStatus: { existing: 0, planned: 0, implemented: 0, retired: 0, notProvided: 0, total: 0 },
      effectivenessRating: { effective: 0, partiallyEffective: 0, ineffective: 0, notAssessed: 0, notProvided: 0, total: 0 },
    }} />);

    for (const name of ['Implementation status', 'Effectiveness rating']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No Control Implementations' })).toBeInTheDocument();
      expect(within(region).getByText('Control Implementations appear here when mitigation controls are added to open Risks.')).toBeInTheDocument();
      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    }
  });
});

describe('report detail frame', () => {
  it('opens with the as-at line and a Summary strip of tiles that open equal lists, then the sections', () => {
    render(<ReportDetailFrame report={riskExposure} />);

    const asAt = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Computed from current records as at 24 Sept 2026.');
    expect(asAt).toHaveClass('text-xs', 'text-foreground-secondary');
    expect(asAt.querySelector('time')).toHaveAttribute('dateTime', '2026-09-24');

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByRole('heading', { level: 2, name: 'Summary' })).toHaveClass('sr-only');
    const tiles = within(summary).getAllByRole('listitem');
    expect(tiles).toHaveLength(3);
    expect(within(summary).getByRole('link', { name: 'Open contextual Risks 8' })).toHaveAttribute('href', '/app/risks?state=open');
    expect(within(summary).getByRole('link', { name: 'Critical residual 2' })).toHaveAttribute('href', '/app/risks?residualRating=Critical&state=open');
    expect(within(summary).getByRole('link', { name: 'High residual 3' })).toHaveAttribute('href', '/app/risks?residualRating=High&state=open');

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Summary',
      'Inherent and residual rating',
      'Residual rating by treatment status',
      'Most exposed Information Systems',
    ]);
  });

  it('keeps a tile plain when no list shares its figure', () => {
    render(<ReportDetailFrame report={controlEffectiveness} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    expect(within(summary).getAllByRole('link')).toHaveLength(1);
    expect(within(summary).getByRole('link', { name: 'Rated Ineffective 1' })).toHaveAttribute('href', '/app/alerts?kind=ineffective-control');
    expect(within(summary).getByText('Control Implementations').closest('[data-slot="kpi-tile"]')?.tagName).toBe('DIV');
  });
});

describe('treatment-performance report', () => {
  it('links the Overdue tile to its alert list and keeps the window and no-target-date tiles plain', () => {
    render(<ReportDetailFrame report={treatmentPerformance} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('link')).toHaveLength(1);
    expect(within(summary).getByRole('link', { name: 'Overdue 2' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-overdue');
    expect(within(summary).getByText('Due within 30 days').closest('[data-slot="kpi-tile"]')?.tagName).toBe('DIV');
    expect(within(summary).getByText('No target date').closest('[data-slot="kpi-tile"]')?.tagName).toBe('DIV');
  });

  it('shows the due states and the recorded treatment statuses as ink bars beside their tables', () => {
    const { container } = render(<TreatmentPerformanceReportView report={treatmentPerformance} />);

    const dueState = section('Due state');
    const dueChart = dueState.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(dueChart)).toEqual(['Overdue 2', 'Due within 30 days 2', 'Due later 1', 'No target date 2']);
    expect(marks(dueChart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    const dueTable = within(dueState).getByRole('table', { name: 'Due state' });
    expect(columnHeaders(dueTable)).toEqual(['Due state', 'Risks']);
    expect(bodyRows(dueTable)).toEqual([['Overdue', '2'], ['Due within 30 days', '2'], ['Due later', '1'], ['No target date', '2']]);

    const status = section('Treatment status');
    // This section's population is every open contextual Risk, and its description says so.
    expect(within(status).getByText('All open contextual Risks, by the treatment status recorded on each Risk.')).toBeInTheDocument();
    const statusChart = status.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(statusChart)).toEqual(['Not Started 3', 'In Progress 2', 'Overdue 1', 'Complete 1', 'Not provided 1']);
    expect(marks(statusChart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    const statusTable = within(status).getByRole('table', { name: 'Treatment status' });
    expect(columnHeaders(statusTable)).toEqual(['Treatment status', 'Risks']);

    expect(expectInertCharts(container)).toHaveLength(2);
    expect(expectTextEquivalentTables(container)).toHaveLength(2);
  });

  it('names the served due window rather than a fixed one', () => {
    render(<TreatmentPerformanceReportView report={{ ...treatmentPerformance, dueWindowDays: 21 }} />);

    const dueState = section('Due state');
    expect(within(within(dueState).getByRole('table')).getByRole('rowheader', { name: 'Due within 21 days' })).toBeInTheDocument();
  });

  it('lists the most overdue treatments as shared alert rows with a link to every overdue treatment', () => {
    render(<TreatmentPerformanceReportView report={treatmentPerformance} />);

    const mostOverdue = section('Most overdue treatments');
    // The markers are removed, and WebKit then drops list semantics unless the role is stated.
    const list = within(mostOverdue).getByRole('list');
    expect(list).toHaveAttribute('role', 'list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    const rows = mostOverdue.querySelectorAll('[data-slot="alert-row"]');
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByRole('link', { name: 'RSK-2026-B2QDZ6' })).toHaveAttribute('href', '/app/risks/risk-1');
    expect(within(rows[0] as HTMLElement).getByText('Treatment overdue by 12 days')).toBeInTheDocument();
    expect(within(mostOverdue).queryByText(/^Showing /)).not.toBeInTheDocument();
    expect(within(mostOverdue).getByRole('link', { name: 'View overdue treatments' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-overdue');
    expect(within(mostOverdue).queryByRole('table')).not.toBeInTheDocument();
  });

  it('says how many of the overdue treatments a truncated list shows', () => {
    render(<TreatmentPerformanceReportView report={{ ...treatmentPerformance, mostOverdue: { rows: [overdueAlert], total: 9, truncated: true } }} />);

    const mostOverdue = section('Most overdue treatments');
    expect(within(mostOverdue).getByText('Showing 1 of 9')).toHaveClass('text-xs', 'tabular-nums');
  });

  it('shows the cleared states, and no link, when no open contextual Risk and no overdue treatment exist', () => {
    render(<TreatmentPerformanceReportView report={{
      ...treatmentPerformance,
      dueState: { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 },
      treatmentStatus: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
      mostOverdue: { rows: [], total: 0, truncated: false },
    }} />);

    for (const name of ['Due state', 'Treatment status']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No open contextual Risks' })).toBeInTheDocument();
      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    }
    const mostOverdue = section('Most overdue treatments');
    expect(within(mostOverdue).getByRole('heading', { level: 3, name: 'No overdue treatments' })).toBeInTheDocument();
    expect(within(mostOverdue).getByText('Treatments past their target date appear here.')).toBeInTheDocument();
    expect(within(mostOverdue).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('assessment-throughput report', () => {
  it('names the period on the released tile and the sample on the median tile, neither linked', () => {
    render(<ReportDetailFrame report={assessmentThroughput} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    expect(within(summary).queryByRole('link')).not.toBeInTheDocument();
    expect(within(summary).getByText('April 2026 to September 2026')).toBeInTheDocument();
    expect(within(summary).getByText('Across 2 releases with a submission date')).toBeInTheDocument();
  });

  it('shows a missing median as Not available, never as zero', () => {
    render(<ReportDetailFrame report={{ ...assessmentThroughput, medianDaysToRelease: { value: null, sampleSize: 0, truncated: false } }} />);

    const median = screen.getByText('Median days to release').closest<HTMLElement>('[data-slot="kpi-tile"]')!;
    expect(within(median).getByText('Not available')).toBeInTheDocument();
    expect(within(median).getByText('No release in this period has a submission date.')).toBeInTheDocument();
    expect(within(median).queryByText('0')).not.toBeInTheDocument();
  });

  it('draws released months as columns with the current month dashed and explained, beside a month table', () => {
    render(<AssessmentThroughputReportView report={assessmentThroughput} />);

    const perMonth = section('Released per month');
    expect(within(perMonth).getByText('Risk Assessments released by a Security Analyst in each calendar month, April 2026 to September 2026.')).toBeInTheDocument();
    const chart = perMonth.querySelector('[data-slot="bar-chart"]')!;
    const columns = Array.from(chart.querySelectorAll('[data-slot="bar-chart-column"]'));
    expect(columns.map((column) => column.querySelector('[data-slot="bar-chart-category"]')?.textContent)).toEqual(['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept']);
    // The partial month is a dashed ink outline with no fill, a legend and "(to date)": never colour alone.
    const partialMark = columns.at(-1)!.querySelector('[data-slot="bar-chart-mark"]')!;
    expect(partialMark).toHaveClass('border-dashed', 'border-chart-1');
    expect(partialMark.className).not.toMatch(/\bbg-/);
    expect(within(chart as HTMLElement).getByText('Current month to date')).toBeInTheDocument();

    const table = within(perMonth).getByRole('table', { name: 'Released per month' });
    expect(columnHeaders(table)).toEqual(['Month', 'Released']);
    expect(bodyRows(table)).toEqual([
      ['April 2026', '0'],
      ['May 2026', '0'],
      ['June 2026', '0'],
      ['July 2026', '1'],
      ['August 2026', '0'],
      ['September 2026 (to date)', '2'],
    ]);
  });

  it('keeps every month, zero included, and never swaps the series for an empty state', () => {
    render(<AssessmentThroughputReportView report={{
      ...assessmentThroughput,
      released: { months: assessmentThroughput.released.months.map((month) => ({ ...month, count: 0 })), total: 0 },
    }} />);

    const perMonth = section('Released per month');
    expect(within(perMonth).queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(bodyRows(within(perMonth).getByRole('table', { name: 'Released per month' })).map((row) => row[1])).toEqual(['0', '0', '0', '0', '0', '0']);
  });

  it('shows Assessment Requests by lifecycle state in request order, never Draft, beside its table', () => {
    const { container } = render(<AssessmentThroughputReportView report={assessmentThroughput} />);

    const lifecycle = section('Assessment Requests by lifecycle state');
    expect(within(lifecycle).getByText('Current state of every Assessment Request in your review scope. Not limited to the period.')).toBeInTheDocument();
    const chart = lifecycle.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(chart)).toEqual(['Submitted 1', 'Questionnaire in progress 2', 'Risk assessment drafted 1', 'Under review 3', 'Approved 5', 'Closed 1']);
    const table = within(lifecycle).getByRole('table', { name: 'Assessment Requests by lifecycle state' });
    expect(columnHeaders(table)).toEqual(['Lifecycle state', 'Assessment Requests']);
    expect(within(table).queryByText('Draft')).not.toBeInTheDocument();

    expect(expectInertCharts(container)).toHaveLength(2);
    expect(expectTextEquivalentTables(container)).toHaveLength(2);
  });

  it('says there are no Assessment Requests yet when the review scope is empty', () => {
    render(<AssessmentThroughputReportView report={{
      ...assessmentThroughput,
      requestsByStatus: { submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, closed: 0, total: 0 },
    }} />);

    const lifecycle = section('Assessment Requests by lifecycle state');
    expect(within(lifecycle).getByRole('heading', { level: 3, name: 'No Assessment Requests yet' })).toBeInTheDocument();
    expect(within(lifecycle).queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('report period control', () => {
  let releaseTwelveMonths: () => void = () => undefined;
  let twelveMonths: Promise<void> = Promise.resolve();

  function PeriodReport({ period }: { period: ReportPeriod }) {
    // The twelve-month report takes a moment to arrive, as a server render does.
    if (period === 12) use(twelveMonths);
    return <p>{period}-month report</p>;
  }

  function PeriodHarness() {
    const [period, setPeriod] = useState<ReportPeriod>(6);
    navigation.replace.mockImplementation((href: string) => setPeriod(href.endsWith('period=12') ? 12 : 6));

    return (
      <ReportTransitionProvider>
        <button type="button">Before</button>
        <ReportPeriodControl period={period} />
        <ReportBody>
          <Suspense fallback={<p>Loading report</p>}>
            <PeriodReport period={period} />
          </Suspense>
        </ReportBody>
      </ReportTransitionProvider>
    );
  }

  beforeEach(() => {
    twelveMonths = new Promise<void>((resolve) => { releaseTwelveMonths = resolve; });
  });

  it('is a radio group labelled Period with 6 months then 12 months, checked from the URL value', () => {
    render(<ReportTransitionProvider><ReportPeriodControl period={12} /></ReportTransitionProvider>);

    const group = screen.getByRole('radiogroup', { name: 'Period' });
    expect(within(group).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['6 months', '12 months']);
    expect(within(group).getByRole('radio', { name: '12 months' })).toBeChecked();
    // Beside the title from md, the control keeps its width so no segment is squeezed below its label.
    expect(screen.getByText('Period').parentElement).toHaveClass('md:shrink-0');
  });

  it('replaces the URL with ?period=12 from the keyboard, keeps the report busy until it arrives, and keeps focus on the checked segment', async () => {
    const user = userEvent.setup();
    render(<PeriodHarness />);

    const body = document.querySelector<HTMLElement>('[data-slot="report-body"]')!;
    expect(body).not.toHaveAttribute('aria-busy');
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    const six = screen.getByRole('radio', { name: '6 months' });
    const twelve = screen.getByRole('radio', { name: '12 months' });
    expect(six).toHaveFocus();

    await user.keyboard('{ArrowRight>}');
    await waitFor(() => expect(twelve).toHaveFocus());
    await user.keyboard('{/ArrowRight}');

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/app/reports/assessment-throughput?period=12', { scroll: false });
    // While the new report is on its way the old one stays, marked busy, with no spinner or skeleton.
    await waitFor(() => expect(body).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByText('6-month report')).toBeInTheDocument();
    expect(screen.queryByText('Loading report')).not.toBeInTheDocument();
    expect(twelve).toBeChecked();
    expect(twelve).toHaveFocus();

    await act(async () => { releaseTwelveMonths(); });

    await waitFor(() => expect(screen.getByText('12-month report')).toBeInTheDocument());
    expect(body).not.toHaveAttribute('aria-busy');
    expect(twelve).toBeChecked();
    expect(twelve).toHaveFocus();
  });
});
