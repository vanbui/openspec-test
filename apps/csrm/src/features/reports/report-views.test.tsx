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
  acceptedByResidualRating: { Critical: 1, High: 0, Moderate: 1, Low: 0, notRated: 0, total: 2 },
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
  underAssessment: { byResidualRating: { Critical: 1, High: 2, Moderate: 0, Low: 0, notRated: 1, total: 4 } },
};

const noStatus = { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 };
const noRating = { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };
const emptyExposure: RiskExposureReport = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: noRating,
  byInherentRating: noRating,
  acceptedByResidualRating: noRating,
  residualByTreatmentStatus: { Critical: noStatus, High: noStatus, Moderate: noStatus, Low: noStatus, notRated: noStatus },
  exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
  underAssessment: { byResidualRating: noRating },
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
  dueWindowDays: 14,
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

/** Each link's accessible name and destination, in document order. */
function namedLinks(container: HTMLElement) {
  return within(container).queryAllByRole('link').map((link) => [link.getAttribute('aria-label') ?? link.textContent, link.getAttribute('href')]);
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
    expect(within(ratings).getByText('Released open Risks by inherent and residual rating, with accepted Risks by residual rating.')).toBeInTheDocument();

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

    // The small multiples chart inherent and residual only; the accepted count is the table's own column.
    expect(figure!.querySelectorAll('[data-slot="bar-chart"]')).toHaveLength(2);
    const table = within(ratings).getByRole('table', { name: 'Inherent and residual rating' });
    expect(columnHeaders(table)).toEqual(['Rating', 'Inherent', 'Residual', 'Accepted']);
    expect(bodyRows(table)).toEqual([
      ['Critical', '1', '2', '1'],
      ['High', '3', '3', '0'],
      ['Moderate', '1', '1', '1'],
      ['Low', '1', '1', '0'],
      ['Not rated', '2', '1', '0'],
    ]);
  });

  it('opens each non-zero rating figure’s released open Risks, with accepted figures adding treatmentAction=Accept, and keeps zeros plain (UI-SPEC §9.3)', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const table = within(section('Inherent and residual rating')).getByRole('table', { name: 'Inherent and residual rating' });
    expect(namedLinks(table)).toEqual([
      ['1 Risk: Critical, Inherent', '/app/risks?inherentRating=Critical&state=open&stage=released'],
      ['2 Risks: Critical, Residual', '/app/risks?residualRating=Critical&state=open&stage=released'],
      ['1 Risk: Critical, Accepted', '/app/risks?residualRating=Critical&state=open&stage=released&treatmentAction=Accept'],
      ['3 Risks: High, Inherent', '/app/risks?inherentRating=High&state=open&stage=released'],
      ['3 Risks: High, Residual', '/app/risks?residualRating=High&state=open&stage=released'],
      ['1 Risk: Moderate, Inherent', '/app/risks?inherentRating=Moderate&state=open&stage=released'],
      ['1 Risk: Moderate, Residual', '/app/risks?residualRating=Moderate&state=open&stage=released'],
      ['1 Risk: Moderate, Accepted', '/app/risks?residualRating=Moderate&state=open&stage=released&treatmentAction=Accept'],
      ['1 Risk: Low, Inherent', '/app/risks?inherentRating=Low&state=open&stage=released'],
      ['1 Risk: Low, Residual', '/app/risks?residualRating=Low&state=open&stage=released'],
      ['2 Risks: Not rated, Inherent', '/app/risks?inherentRating=none&state=open&stage=released'],
      ['1 Risk: Not rated, Residual', '/app/risks?residualRating=none&state=open&stage=released'],
    ]);
  });

  it('shows the Risks under assessment apart, by residual rating, as severity bars beside their table (D-42)', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const underAssessment = section('Under assessment');
    expect(within(underAssessment).getByText('Open Risks in risk assessments not yet released, by residual rating. They are not counted in the sections above.')).toBeInTheDocument();
    const chart = underAssessment.querySelector('[data-slot="bar-chart"]')!;
    expect(chart.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(barLabels(chart)).toEqual(['Critical 1', 'High 2', 'Moderate 0', 'Low 0', 'Not rated 1']);
    // A zero draws no mark; each drawn mark fills with its rating's own token, and Not rated is ink.
    expect(marks(chart).map((mark) => mark.className.match(/\bbg-(?:risk-\w+|chart-1)\b/)?.[0])).toEqual([
      'bg-risk-critical', 'bg-risk-high', 'bg-chart-1',
    ]);
    const table = within(underAssessment).getByRole('table', { name: 'Under assessment' });
    expect(columnHeaders(table)).toEqual(['Residual rating', 'Risks']);
    expect(bodyRows(table)).toEqual([['Critical', '1'], ['High', '2'], ['Moderate', '0'], ['Low', '0'], ['Not rated', '1']]);
    // Each non-zero figure opens the register's under-assessment list with its rating; zeros stay plain.
    expect(namedLinks(table)).toEqual([
      ['1 Risk: Critical', '/app/risks?residualRating=Critical&state=open&stage=under-assessment'],
      ['2 Risks: High', '/app/risks?residualRating=High&state=open&stage=under-assessment'],
      ['1 Risk: Not rated', '/app/risks?residualRating=none&state=open&stage=under-assessment'],
    ]);

    // It is the last section, after the three released ones.
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Inherent and residual rating',
      'Residual rating by treatment status',
      'Most exposed Information Systems',
      'Under assessment',
    ]);
  });

  it('shows the cleared under-assessment state beside populated released sections', () => {
    render(<RiskExposureReportView report={{ ...riskExposure, underAssessment: { byResidualRating: noRating } }} />);

    const underAssessment = section('Under assessment');
    expect(within(underAssessment).getByRole('heading', { level: 3, name: 'No Risks under assessment' })).toBeInTheDocument();
    expect(within(underAssessment).getByText('Risks appear here while their risk assessment is a draft or in review.')).toBeInTheDocument();
    expect(within(underAssessment).queryByRole('table')).not.toBeInTheDocument();
    expect(within(section('Inherent and residual rating')).getByRole('table')).toBeInTheDocument();
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
    // Non-zero figures open their rating and treatment status; a row Total opens the rating alone (UI-SPEC §9.3).
    expect(within(table).getByRole('link', { name: '1 Risk: High, Not provided' })).toHaveAttribute('href', '/app/risks?residualRating=High&treatmentStatus=none&state=open&stage=released');
    expect(within(table).getByRole('link', { name: '3 Risks: High, Total' })).toHaveAttribute('href', '/app/risks?residualRating=High&state=open&stage=released');
    // One link per non-zero figure: 3, 4, 2, 2 and 2 by row.
    expect(within(table).getAllByRole('link')).toHaveLength(13);
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

  it('ranks the most exposed Information Systems in ink, each name opening its released open Risks, and notes Risks without one', () => {
    render(<RiskExposureReportView report={riskExposure} />);

    const systems = section('Most exposed Information Systems');
    expect(within(systems).getByText(
      'Information Systems carrying the most released open High and Critical residual Risks, highest first. Select a system to view its released open Risks.',
    )).toBeInTheDocument();
    const chart = systems.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(chart)).toEqual(['Alpha system 2', 'Beta system 2']);
    expect(marks(chart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);

    const table = within(systems).getByRole('table', { name: 'Most exposed Information Systems' });
    expect(columnHeaders(table)).toEqual(['Information System', 'Critical', 'High', 'Total']);
    expect(bodyRows(table)).toEqual([
      ['Alpha system', '1', '1', '2'],
      ['Beta system', '1', '1', '2'],
    ]);
    // The name and the Critical and High figures link; Total is their sum and stays plain (D-37).
    expect(namedLinks(table)).toEqual([
      ['Alpha system: view its released open Risks', '/app/risks?system=system-1&state=open&stage=released'],
      ['1 Risk: Alpha system, Critical', '/app/risks?system=system-1&residualRating=Critical&state=open&stage=released'],
      ['1 Risk: Alpha system, High', '/app/risks?system=system-1&residualRating=High&state=open&stage=released'],
      ['Beta system: view its released open Risks', '/app/risks?system=system-2&state=open&stage=released'],
      ['1 Risk: Beta system, Critical', '/app/risks?system=system-2&residualRating=Critical&state=open&stage=released'],
      ['1 Risk: Beta system, High', '/app/risks?system=system-2&residualRating=High&state=open&stage=released'],
    ]);
    expect(within(systems).getByText('1 High or Critical residual Risk has no impacted Information System.')).toBeInTheDocument();
    expect(within(systems).queryByText(/^Showing the top/)).not.toBeInTheDocument();
    // The note's figure is the sum of two links that open each rating with no impacted system (D-37).
    const noteLinks = systems.querySelector<HTMLElement>('[data-slot="report-section-note-links"]')!;
    expect(namedLinks(noteLinks)).toEqual([
      ['View Critical Risks with no impacted Information System', '/app/risks?impactedSystem=none&residualRating=Critical&state=open&stage=released'],
      ['View High Risks with no impacted Information System', '/app/risks?impactedSystem=none&residualRating=High&state=open&stage=released'],
    ]);
    expect(within(noteLinks).getAllByRole('link').map((link) => link.textContent)).toEqual(['View Critical', 'View High']);
  });

  it('shows no View Critical or View High links when every High and Critical Risk has an impacted system', () => {
    render(<RiskExposureReportView report={{ ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, risksWithoutSystem: 0 } }} />);

    const systems = section('Most exposed Information Systems');
    expect(systems.querySelector('[data-slot="report-section-note-links"]')).toBeNull();
    expect(within(systems).queryByRole('link', { name: /no impacted Information System/ })).not.toBeInTheDocument();
  });

  it('says how many Information Systems a truncated ranking leaves out', () => {
    render(<RiskExposureReportView report={{ ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, total: 14, truncated: true, risksWithoutSystem: 3 } }} />);

    const systems = section('Most exposed Information Systems');
    expect(within(systems).getByText('Showing the top 2 of 14 Information Systems.')).toBeInTheDocument();
    expect(within(systems).getByText('3 High or Critical residual Risks have no impacted Information System.')).toBeInTheDocument();
  });

  it('keeps every chart inert beside a text-equivalent table', () => {
    const { container } = render(<RiskExposureReportView report={riskExposure} />);

    expect(expectInertCharts(container)).toHaveLength(4);
    expect(expectTextEquivalentTables(container)).toHaveLength(4);
  });

  it('shows the cleared state in every section when no released open Risk and no Risk under assessment exists', () => {
    render(<RiskExposureReportView report={emptyExposure} />);

    for (const name of ['Inherent and residual rating', 'Residual rating by treatment status', 'Most exposed Information Systems']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No released open Risks' })).toBeInTheDocument();
      expect(within(region).getByText('Risks count here once their risk assessment is released.')).toBeInTheDocument();
      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    }
    expect(within(section('Under assessment')).getByRole('heading', { level: 3, name: 'No Risks under assessment' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="bar-chart"]')).toBeNull();
  });

  it('keeps the Risks under assessment when no released open Risk exists, so the two stages never read as one', () => {
    render(<RiskExposureReportView report={{ ...emptyExposure, underAssessment: riskExposure.underAssessment }} />);

    expect(within(section('Inherent and residual rating')).getByRole('heading', { level: 3, name: 'No released open Risks' })).toBeInTheDocument();
    const underAssessment = section('Under assessment');
    expect(bodyRows(within(underAssessment).getByRole('table'))).toEqual([['Critical', '1'], ['High', '2'], ['Moderate', '0'], ['Low', '0'], ['Not rated', '1']]);
  });

  it('keeps the High and Critical cleared state when released open Risks exist but none is High or Critical', () => {
    render(<RiskExposureReportView report={{
      ...riskExposure,
      exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
    }} />);

    const systems = section('Most exposed Information Systems');
    expect(within(systems).getByRole('heading', { level: 3, name: 'No High or Critical residual Risks' })).toBeInTheDocument();
    expect(within(systems).queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('control-effectiveness report', () => {
  it('shows implementation status and effectiveness rating as ink bars beside their tables', () => {
    const { container } = render(<ControlEffectivenessReportView report={controlEffectiveness} />);

    const status = section('Implementation status');
    expect(within(status).getByText('Mitigation controls on open Risks by implementation status. Select a status to view the Risks with those mitigation controls.')).toBeInTheDocument();
    const statusChart = status.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(statusChart)).toEqual(['Existing 1', 'Planned 1', 'Implemented 2', 'Retired 0', 'Not provided 1']);
    const statusTable = within(status).getByRole('table', { name: 'Implementation status' });
    expect(columnHeaders(statusTable)).toEqual(['Implementation status', 'Mitigation controls']);
    expect(bodyRows(statusTable)).toEqual([['Existing', '1'], ['Planned', '1'], ['Implemented', '2'], ['Retired', '0'], ['Not provided', '1']]);

    const rating = section('Effectiveness rating');
    expect(within(rating).getByText('Mitigation controls on open Risks by effectiveness rating. Select a rating to view the Risks with those mitigation controls.')).toBeInTheDocument();
    const ratingChart = rating.querySelector('[data-slot="bar-chart"]')!;
    expect(barLabels(ratingChart)).toEqual(['Effective 1', 'Partially Effective 1', 'Ineffective 1', 'Not Assessed 1', 'Not provided 1']);
    // Effectiveness is not the severity ladder, so every mark is ink.
    expect(marks(ratingChart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    const ratingTable = within(rating).getByRole('table', { name: 'Effectiveness rating' });
    expect(columnHeaders(ratingTable)).toEqual(['Effectiveness rating', 'Mitigation controls']);
    expect(bodyRows(ratingTable)).toEqual([['Effective', '1'], ['Partially Effective', '1'], ['Ineffective', '1'], ['Not Assessed', '1'], ['Not provided', '1']]);

    expect(expectInertCharts(container)).toHaveLength(2);
    expect(expectTextEquivalentTables(container)).toHaveLength(2);
  });

  it('opens the Risks with each status’s or rating’s mitigation controls from its row header, keeping every figure plain (D-36)', () => {
    render(<ControlEffectivenessReportView report={controlEffectiveness} />);

    const statusTable = within(section('Implementation status')).getByRole('table', { name: 'Implementation status' });
    expect(namedLinks(statusTable)).toEqual([
      ['Existing: view the Risks with Existing mitigation controls', '/app/risks?mitigationStatus=Existing&state=open'],
      ['Planned: view the Risks with Planned mitigation controls', '/app/risks?mitigationStatus=Planned&state=open'],
      ['Implemented: view the Risks with Implemented mitigation controls', '/app/risks?mitigationStatus=Implemented&state=open'],
      ['Retired: view the Risks with Retired mitigation controls', '/app/risks?mitigationStatus=Retired&state=open'],
    ]);
    // Every link is a row header; no figure poses as an equal list, and Not provided has no list.
    for (const link of within(statusTable).getAllByRole('link')) expect(link.closest('th')).toHaveAttribute('scope', 'row');
    expect(within(within(statusTable).getByRole('rowheader', { name: 'Not provided' })).queryByRole('link')).not.toBeInTheDocument();

    const ratingTable = within(section('Effectiveness rating')).getByRole('table', { name: 'Effectiveness rating' });
    expect(namedLinks(ratingTable)).toEqual([
      ['Effective: view the Risks with Effective mitigation controls', '/app/risks?mitigationEffectiveness=Effective&state=open'],
      ['Partially Effective: view the Risks with Partially Effective mitigation controls', '/app/risks?mitigationEffectiveness=Partially+Effective&state=open'],
      ['Ineffective: view the Risks with Ineffective mitigation controls', '/app/risks?mitigationEffectiveness=Ineffective&state=open'],
      ['Not Assessed: view the Risks with Not Assessed mitigation controls', '/app/risks?mitigationEffectiveness=Not+Assessed&state=open'],
      ['Not provided: view the Risks with mitigation controls whose effectiveness is not recorded', '/app/risks?mitigationEffectiveness=none&state=open'],
    ]);
    for (const link of within(ratingTable).getAllByRole('link')) expect(link.closest('th')).toHaveAttribute('scope', 'row');
  });

  it('shows the cleared state in both sections when there is no mitigation control', () => {
    render(<ControlEffectivenessReportView report={{
      ...controlEffectiveness,
      implementationStatus: { existing: 0, planned: 0, implemented: 0, retired: 0, notProvided: 0, total: 0 },
      effectivenessRating: { effective: 0, partiallyEffective: 0, ineffective: 0, notAssessed: 0, notProvided: 0, total: 0 },
    }} />);

    for (const name of ['Implementation status', 'Effectiveness rating']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No mitigation controls' })).toBeInTheDocument();
      expect(within(region).getByText('Mitigation controls appear here when they are added to open Risks.')).toBeInTheDocument();
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
    expect(tiles).toHaveLength(5);
    expect(within(summary).getByRole('link', { name: 'Released open Risks 8 Released Risks only' })).toHaveAttribute('href', '/app/risks?state=open&stage=released');
    expect(within(summary).getByRole('link', { name: 'Critical residual 2 Released open Risks' })).toHaveAttribute('href', '/app/risks?residualRating=Critical&state=open&stage=released');
    expect(within(summary).getByRole('link', { name: 'High residual 3 Released open Risks' })).toHaveAttribute('href', '/app/risks?residualRating=High&state=open&stage=released');
    expect(within(summary).getByRole('link', { name: 'Accepted 2 Released Risks with the treatment action Accept' }))
      .toHaveAttribute('href', '/app/risks?state=open&stage=released&treatmentAction=Accept');
    expect(within(summary).getByRole('link', { name: 'Under assessment 4 Not yet released' })).toHaveAttribute('href', '/app/risks?state=open&stage=under-assessment');
    // UI-D38: two columns below sm, three from sm and five from xl.
    expect(summary.querySelector('[data-slot="kpi-tile-strip"]')).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'xl:grid-cols-5');

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Summary',
      'Inherent and residual rating',
      'Residual rating by treatment status',
      'Most exposed Information Systems',
      'Under assessment',
    ]);
  });

  it('keeps the three-tile strip of the other reports at three columns from sm', () => {
    render(<ReportDetailFrame report={treatmentPerformance} />);

    const strip = screen.getByRole('region', { name: 'Summary' }).querySelector('[data-slot="kpi-tile-strip"]');
    expect(strip).toHaveClass('sm:grid-cols-3');
    expect(strip).not.toHaveClass('xl:grid-cols-5');
    expect(strip).not.toHaveClass('grid-cols-2');
  });

  it('opens the Risks that hold mitigation controls from the Mitigation controls tile, whose name says so (D-36, UI-D32)', () => {
    render(<ReportDetailFrame report={controlEffectiveness} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    expect(within(summary).getAllByRole('link')).toHaveLength(2);
    expect(within(summary).getByRole('link', { name: 'Mitigation controls 5 View the Risks that have them' })).toHaveAttribute('href', '/app/risks?mitigationStatus=any&state=open');
    expect(within(summary).getByRole('link', { name: 'Rated Ineffective 1' })).toHaveAttribute('href', '/app/alerts?kind=ineffective-control');
  });
});

describe('treatment-performance report', () => {
  it('links every tile to the list its figure equals: the overdue and due-soon alerts and the no-target-date register list', () => {
    render(<ReportDetailFrame report={treatmentPerformance} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('link')).toHaveLength(3);
    expect(within(summary).getByRole('link', { name: 'Overdue 2' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-overdue');
    expect(within(summary).getByRole('link', { name: 'Due within 14 days 2' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-due-soon');
    expect(within(summary).getByRole('link', { name: 'No target date 2' })).toHaveAttribute('href', '/app/risks?dueState=no-target-date');
  });

  it('opens each non-zero due state and treatment status figure’s records from its table cell, and keeps a zero plain', () => {
    render(<TreatmentPerformanceReportView report={{ ...treatmentPerformance, dueState: { ...treatmentPerformance.dueState, later: 0 } }} />);

    const dueTable = within(section('Due state')).getByRole('table', { name: 'Due state' });
    expect(within(dueTable).getAllByRole('link').map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
      ['2 Risks: Overdue', '/app/alerts?kind=risk-treatment-overdue'],
      ['2 Risks: Due within 14 days', '/app/alerts?kind=risk-treatment-due-soon'],
      ['2 Risks: No target date', '/app/risks?dueState=no-target-date'],
    ]);
    // Due later is zero here, so its figure is plain text (X-10).
    expect(within(within(dueTable).getByRole('row', { name: /Due later/ })).queryByRole('link')).not.toBeInTheDocument();

    const statusTable = within(section('Treatment status')).getByRole('table', { name: 'Treatment status' });
    expect(within(statusTable).getAllByRole('link').map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
      ['3 Risks: Not Started', '/app/risks?state=open&treatmentStatus=Not+Started'],
      ['2 Risks: In Progress', '/app/risks?state=open&treatmentStatus=In+Progress'],
      ['1 Risk: Overdue', '/app/risks?state=open&treatmentStatus=Overdue'],
      ['1 Risk: Complete', '/app/risks?state=open&treatmentStatus=Complete'],
      ['1 Risk: Not provided', '/app/risks?state=open&treatmentStatus=none'],
    ]);
  });

  it('opens the Due later figure’s register list when it is above zero', () => {
    render(<TreatmentPerformanceReportView report={treatmentPerformance} />);

    const dueTable = within(section('Due state')).getByRole('table', { name: 'Due state' });
    expect(within(dueTable).getByRole('link', { name: '1 Risk: Due later' })).toHaveAttribute('href', '/app/risks?dueState=later');
  });

  it('shows the due states and the recorded treatment statuses as ink bars beside their tables', () => {
    const { container } = render(<TreatmentPerformanceReportView report={treatmentPerformance} />);

    const dueState = section('Due state');
    const dueChart = dueState.querySelector('[data-slot="bar-chart"]')!;
    expect(within(dueState).getByText('Open Risks whose treatment is not Complete, by target date. Includes Risks under assessment.')).toBeInTheDocument();
    expect(barLabels(dueChart)).toEqual(['Overdue 2', 'Due within 14 days 2', 'Due later 1', 'No target date 2']);
    expect(marks(dueChart).every((mark) => mark.classList.contains('bg-chart-1'))).toBe(true);
    const dueTable = within(dueState).getByRole('table', { name: 'Due state' });
    expect(columnHeaders(dueTable)).toEqual(['Due state', 'Risks']);
    expect(bodyRows(dueTable)).toEqual([['Overdue', '2'], ['Due within 14 days', '2'], ['Due later', '1'], ['No target date', '2']]);

    const status = section('Treatment status');
    // This section's population is every open Risk in either stage, and its description says so (D-43).
    expect(within(status).getByText('All open Risks, by the treatment status recorded on each Risk. Includes Risks under assessment.')).toBeInTheDocument();
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

  it('shows the cleared states, and no link, when no open Risk and no overdue treatment exist', () => {
    render(<TreatmentPerformanceReportView report={{
      ...treatmentPerformance,
      dueState: { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 },
      treatmentStatus: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
      mostOverdue: { rows: [], total: 0, truncated: false },
    }} />);

    for (const name of ['Due state', 'Treatment status']) {
      const region = section(name);
      expect(within(region).getByRole('heading', { level: 3, name: 'No open Risks' })).toBeInTheDocument();
      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    }
    const mostOverdue = section('Most overdue treatments');
    expect(within(mostOverdue).getByRole('heading', { level: 3, name: 'No overdue treatments' })).toBeInTheDocument();
    expect(within(mostOverdue).getByText('Treatments past their target date appear here.')).toBeInTheDocument();
    expect(within(mostOverdue).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('assessment-throughput report', () => {
  it('opens the period’s released Risk Assessments from the released and median tiles, each naming what it counts (D-39)', () => {
    render(<ReportDetailFrame report={assessmentThroughput} />);

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    const periodReleases = '/app/review/assessments?status=approved&approvedFrom=2026-04-01&approvedTo=2026-09-24';
    expect(within(summary).getByRole('link', { name: 'Released in period 3 April 2026 to September 2026' })).toHaveAttribute('href', periodReleases);
    // The median's name says it is computed from the releases it opens.
    expect(within(summary).getByRole('link', { name: 'Median days to release 20 Across 2 releases with a submission date' })).toHaveAttribute('href', periodReleases);
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
    expect(within(perMonth).getByText('Risk Assessments released by a Security Analyst in each UTC calendar month, April 2026 to September 2026. Release dates in the lists use your time zone.')).toBeInTheDocument();
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
    // Each non-zero month opens its released Risk Assessments; the current month runs to today.
    expect(namedLinks(table)).toEqual([
      ['1 released in July 2026', '/app/review/assessments?status=approved&approvedFrom=2026-07-01&approvedTo=2026-07-31'],
      ['2 released in September 2026', '/app/review/assessments?status=approved&approvedFrom=2026-09-01&approvedTo=2026-09-24'],
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
    expect(barLabels(chart)).toEqual(['Submitted 1', 'Questionnaire in progress 2', 'Risk assessment drafted 1', 'Under review 3', 'Released 5', 'Closed 1']);
    const table = within(lifecycle).getByRole('table', { name: 'Assessment Requests by lifecycle state' });
    expect(columnHeaders(table)).toEqual(['Lifecycle state', 'Assessment Requests']);
    expect(within(table).queryByText('Draft')).not.toBeInTheDocument();
    // Each figure opens the Requests queue's All requests view with its status; approved reads Released.
    expect(namedLinks(table)).toEqual([
      ['1 request: Submitted', '/app/review/requests?queue=all&status=submitted'],
      ['2 requests: Questionnaire in progress', '/app/review/requests?queue=all&status=questionnaire-in-progress'],
      ['1 request: Risk assessment drafted', '/app/review/requests?queue=all&status=risk-assessment-drafted'],
      ['3 requests: Under review', '/app/review/requests?queue=all&status=under-review'],
      ['5 requests: Released', '/app/review/requests?queue=all&status=approved'],
      ['1 request: Closed', '/app/review/requests?queue=all&status=closed'],
    ]);

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
