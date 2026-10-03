import type { AssessmentRating } from '../assessments/assessment-schema';
import { statusLabel } from '../../components/csrm/status-badge';
import { requestStatuses, type RequestStatus } from '../requests/request-domain';
import type {
  AssessmentThroughputReport,
  ControlEffectivenessReport,
  Report,
  RiskExposureReport,
  TreatmentPerformanceReport,
} from './report-schema';

/*
 * Every word and row a report screen shows (UI-SPEC §4.4, §7.4). Strapi computes every figure
 * (D-02, D-13); these functions only order, label and word what the report carries, so no copy is
 * assembled in JSX and the browser never re-derives a count, a month or a median.
 */

type RatingCounts = RiskExposureReport['byResidualRating'];
type TreatmentStatusCounts = RiskExposureReport['residualByTreatmentStatus']['Critical'];
type ExposedSystems = RiskExposureReport['exposedSystems'];
type ThroughputMonth = AssessmentThroughputReport['released']['months'][number];
type MedianDaysToRelease = AssessmentThroughputReport['medianDaysToRelease'];
type RequestStatusCounts = AssessmentThroughputReport['requestsByStatus'];

/** One table row: its row header, then one figure per numeric column. */
export type ReportTableRow = { key: string; label: string; values: readonly number[] };

/** One bar of a report chart, labelled in plain text. */
export type ReportBar = { key: string; label: string; labelText: string; value: number; partial?: boolean };

/** The bars of a one-figure table, in the table's order: the chart and its table always agree. */
export function singleValueBars(rows: readonly ReportTableRow[]): ReportBar[] {
  return rows.map((row) => ({ key: row.key, label: row.label, labelText: row.label, value: row.values[0] ?? 0 }));
}

/** A tile of the report's Summary strip (UI-SPEC §4.4). A tile with `href` opens a list whose total equals its value. */
export type ReportKpiTile = {
  key: string;
  caption: string;
  value: number | null;
  supportingText?: string;
  href?: string;
};

const reportDateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });
const reportMonthFormats = {
  short: new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
} as const;
const reportCountFormat = new Intl.NumberFormat('en-AU');

/** A calendar date the server sent, read at UTC midnight so it never slips a day in any zone. */
function utcCalendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** A figure as en-AU text ("1,204"), for table cells and notes. */
export function formatReportCount(value: number): string {
  return reportCountFormat.format(value);
}

export type AsAtLabel = { text: string; lead: string; date: string; dateTime: string; end: string };

/** "Computed from current records as at 24 Sept 2026.", from the server's own today (D-02). */
export function asAtLabel(today: string): AsAtLabel {
  const date = reportDateFormat.format(utcCalendarDate(today));
  const lead = 'Computed from current records as at ';
  const end = '.';
  return { text: `${lead}${date}${end}`, lead, date, dateTime: today, end };
}

/** A month the server sent, en-AU at UTC: "Sept" for chart labels, "September 2026" for tables. */
export function formatReportMonth(monthStart: string, style: 'long' | 'short'): string {
  return reportMonthFormats[style].format(utcCalendarDate(monthStart));
}

/** "April 2026 to September 2026": the first and last months of a throughput period. */
export function throughputRangeLabel(months: readonly { monthStart: string }[]): string {
  const first = months.at(0);
  const last = months.at(-1);
  if (!first || !last) return '';
  const start = formatReportMonth(first.monthStart, 'long');
  const end = formatReportMonth(last.monthStart, 'long');
  return start === end ? start : `${start} to ${end}`;
}

/* ---------------------------------------------------------------- KPI tiles */

/** The list of every overdue treatment: the risk-treatment-overdue alerts, the same D-04 predicate. */
export const overdueTreatmentsHref = '/app/alerts?kind=risk-treatment-overdue';

/** "Due within 30 days", with the window the server sent (D-13); never hard-coded. */
export function dueWithinWindowLabel(dueWindowDays: number): string {
  return `Due within ${formatReportCount(dueWindowDays)} ${dueWindowDays === 1 ? 'day' : 'days'}`;
}

/** What the median is computed over, or why there is none. A null median is never shown as zero. */
function medianSupportingText(median: MedianDaysToRelease): string {
  if (median.value === null) return 'No release in this period has a submission date.';
  const count = formatReportCount(median.sampleSize);
  const releases = median.sampleSize === 1 ? 'release' : 'releases';
  // A capped sample is the newest releases in the period (D-03), and the line says so.
  return median.truncated
    ? `Across the ${count} most recent ${releases} with a submission date`
    : `Across ${count} ${releases} with a submission date`;
}

/**
 * The Summary tiles of one report (UI-SPEC §4.4). A tile links only when a list exists whose total
 * is computed with exactly the tile's predicate (D-18, D-24); every other tile is plain. No tile
 * carries a delta: no report has an honest comparison period (UI-D6).
 */
export function reportKpiTiles(report: Report): ReportKpiTile[] {
  switch (report.key) {
    case 'risk-exposure':
      // Exposure counts open contextual Risks, so every tile opens the register filtered to open Risks (D-36).
      return [
        { key: 'open-contextual-risks', caption: 'Open contextual Risks', value: report.byResidualRating.total, href: '/app/risks?state=open' },
        { key: 'critical-residual', caption: 'Critical residual', value: report.byResidualRating.Critical, href: '/app/risks?residualRating=Critical&state=open' },
        { key: 'high-residual', caption: 'High residual', value: report.byResidualRating.High, href: '/app/risks?residualRating=High&state=open' },
      ];
    case 'treatment-performance':
      return [
        { key: 'overdue', caption: 'Overdue', value: report.dueState.overdue, href: overdueTreatmentsHref },
        // No list has the report's due window, so these tiles are plain.
        { key: 'due-within-window', caption: dueWithinWindowLabel(report.dueWindowDays), value: report.dueState.dueWithinWindow },
        { key: 'no-target-date', caption: 'No target date', value: report.dueState.noTargetDate },
      ];
    case 'assessment-throughput':
      return [
        { key: 'released-in-period', caption: 'Released in period', value: report.released.total, supportingText: throughputRangeLabel(report.released.months) },
        { key: 'median-days-to-release', caption: 'Median days to release', value: report.medianDaysToRelease.value, supportingText: medianSupportingText(report.medianDaysToRelease) },
      ];
    case 'control-effectiveness':
      return [
        // No list shows every Control Implementation, so this tile is plain.
        { key: 'control-implementations', caption: 'Control Implementations', value: report.implementationStatus.total },
        { key: 'rated-ineffective', caption: 'Rated Ineffective', value: report.effectivenessRating.ineffective, href: '/app/alerts?kind=ineffective-control' },
      ];
  }
}

/* ------------------------------------------------------------ risk exposure */

/** Vertical severity lists run Critical to Low (UI-D5). */
const ratingOrder = ['Critical', 'High', 'Moderate', 'Low'] as const satisfies readonly AssessmentRating[];

export type RatingRow = {
  key: AssessmentRating | 'notRated';
  label: string;
  /** The rating, or null for Risks that have none. */
  rating: AssessmentRating | null;
  inherent: number;
  residual: number;
};

/**
 * The rating rows of the inherent and residual small multiples. Not rated comes last and appears
 * in both charts when either has an unrated Risk, so the two charts always compare row for row.
 */
export function ratingRows(inherent: RatingCounts, residual: RatingCounts): RatingRow[] {
  const rows: RatingRow[] = ratingOrder.map((rating) => ({ key: rating, label: rating, rating, inherent: inherent[rating], residual: residual[rating] }));
  return inherent.notRated > 0 || residual.notRated > 0
    ? [...rows, { key: 'notRated', label: 'Not rated', rating: null, inherent: inherent.notRated, residual: residual.notRated }]
    : rows;
}

/** The rating table: Rating | Inherent | Residual. */
export function ratingTableRows(rows: readonly RatingRow[]): ReportTableRow[] {
  return rows.map((row) => ({ key: row.key, label: row.label, values: [row.inherent, row.residual] }));
}

/** The one scale both rating charts share, so a bar in one compares honestly with a bar in the other. */
export function ratingScaleMax(rows: readonly RatingRow[]): number {
  return rows.reduce((largest, row) => Math.max(largest, row.inherent, row.residual), 0);
}

/** Whether the report counted any open contextual Risk: the population of both rating sections. */
export function hasOpenContextualRisks(report: Pick<RiskExposureReport, 'byResidualRating'>): boolean {
  return report.byResidualRating.total > 0;
}

/** The treatment status columns, headed with the stored values as the register shows them. */
export const treatmentStatusColumns = [
  { key: 'notStarted', label: 'Not Started' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'complete', label: 'Complete' },
  { key: 'notProvided', label: 'Not provided' },
  { key: 'total', label: 'Total' },
] as const satisfies readonly { key: keyof TreatmentStatusCounts; label: string }[];

/** The residual rating by treatment status matrix, Critical to Low, then Not rated. */
export function residualByTreatmentStatusRows(matrix: RiskExposureReport['residualByTreatmentStatus']): ReportTableRow[] {
  const rows: Array<{ key: keyof RiskExposureReport['residualByTreatmentStatus']; label: string }> = [
    ...ratingOrder.map((rating) => ({ key: rating, label: rating })),
    { key: 'notRated', label: 'Not rated' },
  ];
  return rows.map(({ key, label }) => ({ key, label, values: treatmentStatusColumns.map((column) => matrix[key][column.key]) }));
}

/** The ranked Information Systems: Critical, High and their total, by plain system name (UI-D17). */
export function exposedSystemRows(exposedSystems: ExposedSystems): ReportTableRow[] {
  return exposedSystems.rows.map((system) => ({ key: system.documentId, label: system.name, values: [system.critical, system.high, system.total] }));
}

/** One ink bar per ranked Information System: its open High plus Critical residual total. */
export function exposedSystemBars(exposedSystems: ExposedSystems): ReportBar[] {
  return exposedSystems.rows.map((system) => ({ key: system.documentId, label: system.name, labelText: system.name, value: system.total }));
}

/** Truncation and coverage notes for the Information System ranking, only when they apply. */
export function exposedSystemsNotes(exposedSystems: ExposedSystems): string[] {
  const notes: string[] = [];
  if (exposedSystems.truncated) {
    notes.push(`Showing the top ${formatReportCount(exposedSystems.rows.length)} of ${formatReportCount(exposedSystems.total)} Information Systems.`);
  }
  const withoutSystem = exposedSystems.risksWithoutSystem;
  if (withoutSystem === 1) notes.push('1 High or Critical residual Risk has no impacted Information System.');
  if (withoutSystem > 1) notes.push(`${formatReportCount(withoutSystem)} High or Critical residual Risks have no impacted Information System.`);
  return notes;
}

/** Whether any open High or Critical residual Risk exists: one in a ranked system, or one with none. */
export function hasHighOrCriticalResidualRisk(exposedSystems: ExposedSystems): boolean {
  return exposedSystems.total > 0 || exposedSystems.risksWithoutSystem > 0;
}

/* ---------------------------------------------------- treatment performance */

/** The due states of open treatments that are not Complete, in fixed order (D-04). */
export function dueStateRows(report: Pick<TreatmentPerformanceReport, 'dueState' | 'dueWindowDays'>): ReportTableRow[] {
  return [
    { key: 'overdue', label: 'Overdue', values: [report.dueState.overdue] },
    { key: 'dueWithinWindow', label: dueWithinWindowLabel(report.dueWindowDays), values: [report.dueState.dueWithinWindow] },
    { key: 'later', label: 'Due later', values: [report.dueState.later] },
    { key: 'noTargetDate', label: 'No target date', values: [report.dueState.noTargetDate] },
  ];
}

/** The treatment status recorded on each open contextual Risk, headed with the stored values. */
export function treatmentStatusRows(counts: TreatmentStatusCounts): ReportTableRow[] {
  return treatmentStatusColumns
    .filter((column) => column.key !== 'total')
    .map((column) => ({ key: column.key, label: column.label, values: [counts[column.key]] }));
}

/** Whether the report counted any open contextual Risk: the population of both treatment sections. */
export function hasOpenContextualTreatments(report: Pick<TreatmentPerformanceReport, 'treatmentStatus'>): boolean {
  return report.treatmentStatus.total > 0;
}

/** "Showing 5 of 12", only when the server marks the list truncated (D-03). */
export function mostOverdueNote(mostOverdue: TreatmentPerformanceReport['mostOverdue']): string | null {
  return mostOverdue.truncated
    ? `Showing ${formatReportCount(mostOverdue.rows.length)} of ${formatReportCount(mostOverdue.total)}`
    : null;
}

/* ---------------------------------------------------- assessment throughput */

/** The table label of a month: its full name and year, and "(to date)" for the current, partial month. */
function releasedMonthLabel(month: ThroughputMonth): string {
  const label = formatReportMonth(month.monthStart, 'long');
  return month.partial ? `${label} (to date)` : label;
}

/** One column per month, oldest first, labelled with its short month; zero months stay. */
export function releasedMonthBars(months: readonly ThroughputMonth[]): ReportBar[] {
  return months.map((month) => ({
    key: month.monthStart,
    label: formatReportMonth(month.monthStart, 'short'),
    labelText: releasedMonthLabel(month),
    value: month.count,
    partial: month.partial,
  }));
}

/** The month table: Month | Released, with full month names and the partial month marked "(to date)". */
export function releasedMonthRows(months: readonly ThroughputMonth[]): ReportTableRow[] {
  return months.map((month) => ({ key: month.monthStart, label: releasedMonthLabel(month), values: [month.count] }));
}

export function releasedPerMonthDescription(months: readonly ThroughputMonth[]): string {
  return `Risk Assessments released by a Security Analyst in each calendar month, ${throughputRangeLabel(months)}.`;
}

/** Each review-scope request status's field in the report. A draft is outside the analyst's scope. */
const requestStatusCountKeys = {
  submitted: 'submitted',
  'questionnaire-in-progress': 'questionnaireInProgress',
  'risk-assessment-drafted': 'riskAssessmentDrafted',
  'under-review': 'underReview',
  approved: 'approved',
  closed: 'closed',
} as const satisfies Record<Exclude<RequestStatus, 'draft'>, keyof RequestStatusCounts>;

function isReviewScopeStatus(status: RequestStatus): status is Exclude<RequestStatus, 'draft'> {
  return status !== 'draft';
}

/** Assessment Requests by lifecycle state, in request order with the request labels, zeros included. */
export function requestLifecycleRows(counts: RequestStatusCounts): ReportTableRow[] {
  return requestStatuses
    .filter(isReviewScopeStatus)
    .map((status) => ({ key: status, label: statusLabel('request', status), values: [counts[requestStatusCountKeys[status]]] }));
}

/* ---------------------------------------------------- control effectiveness */

export function implementationStatusRows(counts: ControlEffectivenessReport['implementationStatus']): ReportTableRow[] {
  return [
    { key: 'existing', label: 'Existing', values: [counts.existing] },
    { key: 'planned', label: 'Planned', values: [counts.planned] },
    { key: 'implemented', label: 'Implemented', values: [counts.implemented] },
    { key: 'retired', label: 'Retired', values: [counts.retired] },
    { key: 'notProvided', label: 'Not provided', values: [counts.notProvided] },
  ];
}

export function effectivenessRatingRows(counts: ControlEffectivenessReport['effectivenessRating']): ReportTableRow[] {
  return [
    { key: 'effective', label: 'Effective', values: [counts.effective] },
    { key: 'partiallyEffective', label: 'Partially Effective', values: [counts.partiallyEffective] },
    { key: 'ineffective', label: 'Ineffective', values: [counts.ineffective] },
    { key: 'notAssessed', label: 'Not Assessed', values: [counts.notAssessed] },
    { key: 'notProvided', label: 'Not provided', values: [counts.notProvided] },
  ];
}

/* ------------------------------------------------------------ section copy */

/** An empty section's state (UI-SPEC §7.4): cleared "No {noun}", or first-use "No {noun} yet". */
export type ReportEmptyCopy = { kind: 'cleared' | 'first-use'; noun: string; description?: string };

export const reportEmptyStates = {
  openContextualRisks: { kind: 'cleared', noun: 'open contextual Risks', description: 'Risks appear here when a Risk Assessment identifies them.' },
  highOrCriticalResidualRisks: { kind: 'cleared', noun: 'High or Critical residual Risks' },
  overdueTreatments: { kind: 'cleared', noun: 'overdue treatments', description: 'Treatments past their target date appear here.' },
  assessmentRequests: { kind: 'first-use', noun: 'Assessment Requests' },
  controlImplementations: {
    kind: 'cleared',
    noun: 'Control Implementations',
    description: 'Control Implementations appear here when mitigation controls are added to open Risks.',
  },
} as const satisfies Record<string, ReportEmptyCopy>;

/** Each section's caption and the one line that states its measure and population (UI-SPEC §4.3, §4.4). */
export const reportSectionCopy = {
  ratings: {
    caption: 'Inherent and residual rating',
    description: 'Open contextual Risks by inherent and residual rating.',
    rowHeader: 'Rating',
    columns: ['Inherent', 'Residual'],
    /* The small multiples' own captions: the table's column headers are their text equivalent. */
    charts: { inherent: 'Inherent', residual: 'Residual' },
  },
  residualByTreatmentStatus: {
    caption: 'Residual rating by treatment status',
    description: 'Open contextual Risks by residual rating and treatment status. Treatment status is the value recorded on each Risk. Overdue by target date is in the Treatment performance report.',
    rowHeader: 'Residual rating',
    scrollLabel: 'Residual rating by treatment status, scrolls horizontally',
  },
  exposedSystems: {
    caption: 'Most exposed Information Systems',
    description: 'Information Systems carrying the most open High and Critical residual Risks, highest first.',
    rowHeader: 'Information System',
    columns: ['Critical', 'High', 'Total'],
  },
  dueState: {
    caption: 'Due state',
    description: 'Open contextual Risks whose treatment is not Complete, by target date.',
    rowHeader: 'Due state',
    columns: ['Risks'],
  },
  treatmentStatus: {
    caption: 'Treatment status',
    description: 'All open contextual Risks, by the treatment status recorded on each Risk.',
    rowHeader: 'Treatment status',
    columns: ['Risks'],
  },
  mostOverdue: {
    caption: 'Most overdue treatments',
    description: 'Open Risks past their treatment target date, oldest target date first.',
    viewAll: 'View overdue treatments',
  },
  releasedPerMonth: {
    caption: 'Released per month',
    rowHeader: 'Month',
    columns: ['Released'],
    legend: 'Current month to date',
  },
  requestLifecycle: {
    caption: 'Assessment Requests by lifecycle state',
    description: 'Current state of every Assessment Request in your review scope. Not limited to the period.',
    rowHeader: 'Lifecycle state',
    columns: ['Assessment Requests'],
  },
  implementationStatus: {
    caption: 'Implementation status',
    description: 'Control Implementations on open contextual Risks by implementation status.',
    rowHeader: 'Implementation status',
    columns: ['Control Implementations'],
  },
  effectivenessRating: {
    caption: 'Effectiveness rating',
    description: 'Control Implementations on open contextual Risks by effectiveness rating.',
    rowHeader: 'Effectiveness rating',
    columns: ['Control Implementations'],
  },
} as const;

/* ------------------------------------------------------ guarded empty fixture */

function zeroRatings(): RatingCounts {
  return { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };
}

function zeroTreatmentStatuses(): TreatmentStatusCounts {
  return { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 };
}

/**
 * The same report with every count at zero: the safe data the guarded E2E `empty` fixture renders
 * after a successful read, so each section shows its own empty state. The report's key, dates,
 * windows and months are kept, because zero months are data (UI-SPEC §4.3).
 */
export function zeroedReport<R extends Report>(report: R): R;
export function zeroedReport(report: Report): Report {
  switch (report.key) {
    case 'risk-exposure':
      return {
        key: report.key,
        today: report.today,
        byResidualRating: zeroRatings(),
        byInherentRating: zeroRatings(),
        residualByTreatmentStatus: {
          Critical: zeroTreatmentStatuses(),
          High: zeroTreatmentStatuses(),
          Moderate: zeroTreatmentStatuses(),
          Low: zeroTreatmentStatuses(),
          notRated: zeroTreatmentStatuses(),
        },
        exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
      } satisfies RiskExposureReport;
    case 'treatment-performance':
      return {
        key: report.key,
        today: report.today,
        dueWindowDays: report.dueWindowDays,
        dueState: { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 },
        treatmentStatus: zeroTreatmentStatuses(),
        mostOverdue: { rows: [], total: 0, truncated: false },
      } satisfies TreatmentPerformanceReport;
    case 'assessment-throughput':
      return {
        key: report.key,
        today: report.today,
        period: report.period,
        periodStart: report.periodStart,
        released: { months: report.released.months.map((month) => ({ ...month, count: 0 })), total: 0 },
        medianDaysToRelease: { value: null, sampleSize: 0, truncated: false },
        requestsByStatus: { submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, closed: 0, total: 0 },
      } satisfies AssessmentThroughputReport;
    case 'control-effectiveness':
      return {
        key: report.key,
        today: report.today,
        implementationStatus: { existing: 0, planned: 0, implemented: 0, retired: 0, notProvided: 0, total: 0 },
        effectivenessRating: { effective: 0, partiallyEffective: 0, ineffective: 0, notAssessed: 0, notProvided: 0, total: 0 },
      } satisfies ControlEffectivenessReport;
  }
}
