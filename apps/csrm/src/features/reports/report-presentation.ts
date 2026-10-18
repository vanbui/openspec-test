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

/** A link that opens the records a figure counts or a row header describes, named for what it opens (X-10). */
export type ReportLink = { href: string; accessibleName: string };

/**
 * One table row: its row header, then one figure per numeric column. `cells` aligns with `values`: a
 * figure's list link, or null where the figure is zero or no list holds exactly its records. `header`
 * opens the records the row describes when its figures cannot (UI-SPEC §8.1).
 */
export type ReportTableRow = {
  key: string;
  label: string;
  values: readonly number[];
  header?: ReportLink;
  cells?: readonly (ReportLink | null)[];
};

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

/* ------------------------------------------------------------ figure links */

/*
 * Every figure link is an internal path built here, never in JSX, from the target list's own closed filter
 * vocabulary (D-35, T-11-42): a served value (an id, a date, a stored status) is encoded, and the list
 * re-validates its URL. The names follow UI-SPEC §8.1 and begin with the visible figure or label (WCAG 2.5.3).
 */

/** A Risk register list filtered by `filters`, in the given order, each value encoded. */
function riskListHref(filters: Readonly<Record<string, string>>): string {
  return `/app/risks?${new URLSearchParams(filters).toString()}`;
}

/** "{n} {Risk|Risks}: {row label}", with ", {column label}" in a table of more than one figure column. */
export function cellLinkName(count: number, rowLabel: string, columnLabel?: string): string {
  const counted = `${formatReportCount(count)} ${count === 1 ? 'Risk' : 'Risks'}`;
  return columnLabel ? `${counted}: ${rowLabel}, ${columnLabel}` : `${counted}: ${rowLabel}`;
}

/** "{n} released in {Month Year}": a month cell of the throughput report. */
export function monthLinkName(count: number, monthStart: string): string {
  return `${formatReportCount(count)} released in ${formatReportMonth(monthStart, 'long')}`;
}

/** "{n} {request|requests}: {status label}": a lifecycle cell of the throughput report. */
export function lifecycleLinkName(count: number, statusLabel: string): string {
  return `${formatReportCount(count)} ${count === 1 ? 'request' : 'requests'}: ${statusLabel}`;
}

/** "{label}: view {what}": a row header that opens the records its row describes. */
export function rowHeaderLinkName(label: string, what: string): string {
  return `${label}: view ${what}`;
}

/** A figure's link, or null for a zero, which stays plain (X-10). */
function figureLink(count: number, href: string, accessibleName: string): ReportLink | null {
  return count > 0 ? { href, accessibleName } : null;
}

/** A text link beside a note, such as "View Critical" after the no-impacted-system note (UI-SPEC §9.3). */
export type ReportTextLink = ReportLink & { label: string };

/** The register filters of every released risk-exposure figure: open Risks whose risk assessment is released (D-40). */
const releasedOpenFilters = { state: 'open', stage: 'released' } as const;

/** A rating's register filter value: the rating, or `none` for a Risk with no rating (D-35). */
function ratingFilterValue(rating: AssessmentRating | null): string {
  return rating ?? 'none';
}

/**
 * The period's released Risk Assessments, as the list's own filters read them: approved, released from
 * `approvedFrom` to `approvedTo` inclusive (11-07). Both dates are calendar dates the server sent.
 */
function releasedAssessmentsHref(approvedFrom: string, approvedTo: string): string {
  return `/app/review/assessments?status=approved&approvedFrom=${encodeURIComponent(approvedFrom)}&approvedTo=${encodeURIComponent(approvedTo)}`;
}

/** The open Risks that hold mitigation controls, in either stage: what the Mitigation controls tile opens (D-36). */
const mitigationControlRisksHref = '/app/risks?mitigationStatus=any&state=open';

/* ---------------------------------------------------------------- KPI tiles */

/** The list of every overdue treatment: the risk-treatment-overdue alerts, the same D-04 predicate. */
export const overdueTreatmentsHref = '/app/alerts?kind=risk-treatment-overdue';

/** The treatments due within the product's due-soon window: the risk-treatment-due-soon alerts (D-38). */
const dueSoonTreatmentsHref = '/app/alerts?kind=risk-treatment-due-soon';

/** The register's open treatments due after the window, and those with no target date, by the shared rule (D-35). */
const dueLaterTreatmentsHref = '/app/risks?dueState=later';
const noTargetDateTreatmentsHref = '/app/risks?dueState=no-target-date';

/** The register's released open Risks: the population of every released risk-exposure figure (D-40). */
const releasedOpenRisksHref = '/app/risks?state=open&stage=released';

/** "Due within 14 days", with the window the server sent (D-38); never hard-coded. */
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
      /*
       * D-40 to D-42: the released tiles open the register's released open list (with the rating, or with
       * the treatment action Accept), and Under assessment opens the other stage's list, so the two stages
       * sit side by side as separate figures and never add up.
       */
      return [
        {
          key: 'released-open-risks',
          caption: 'Released open Risks',
          value: report.byResidualRating.total,
          supportingText: 'Released Risks only',
          href: releasedOpenRisksHref,
        },
        {
          key: 'critical-residual',
          caption: 'Critical residual',
          value: report.byResidualRating.Critical,
          supportingText: 'Released open Risks',
          href: '/app/risks?residualRating=Critical&state=open&stage=released',
        },
        {
          key: 'high-residual',
          caption: 'High residual',
          value: report.byResidualRating.High,
          supportingText: 'Released open Risks',
          href: '/app/risks?residualRating=High&state=open&stage=released',
        },
        {
          key: 'accepted',
          caption: 'Accepted',
          value: report.acceptedByResidualRating.total,
          supportingText: 'Released Risks with the treatment action Accept',
          href: `${releasedOpenRisksHref}&treatmentAction=Accept`,
        },
        {
          key: 'under-assessment',
          caption: 'Under assessment',
          value: report.underAssessment.byResidualRating.total,
          supportingText: 'Not yet released',
          href: '/app/risks?state=open&stage=under-assessment',
        },
      ];
    case 'treatment-performance':
      return [
        // Each figure equals its list: the overdue and due-soon alerts, and the register's dueState list (UI-SPEC §8.2).
        { key: 'overdue', caption: 'Overdue', value: report.dueState.overdue, href: overdueTreatmentsHref },
        { key: 'due-within-window', caption: dueWithinWindowLabel(report.dueWindowDays), value: report.dueState.dueWithinWindow, href: dueSoonTreatmentsHref },
        { key: 'no-target-date', caption: 'No target date', value: report.dueState.noTargetDate, href: noTargetDateTreatmentsHref },
      ];
    case 'assessment-throughput':
      return [
        /*
         * Both tiles open the period's released Risk Assessments, from its first day to today (UI-SPEC §8.2). The
         * median is computed from those releases (D-39), and its supporting line says from how many.
         */
        {
          key: 'released-in-period',
          caption: 'Released in period',
          value: report.released.total,
          supportingText: throughputRangeLabel(report.released.months),
          href: releasedAssessmentsHref(report.periodStart, report.today),
        },
        {
          key: 'median-days-to-release',
          caption: 'Median days to release',
          value: report.medianDaysToRelease.value,
          supportingText: medianSupportingText(report.medianDaysToRelease),
          href: releasedAssessmentsHref(report.periodStart, report.today),
        },
      ];
    case 'control-effectiveness':
      return [
        /*
         * UI-D33: "Mitigation controls" is the display term. No list shows every mitigation control, so the tile
         * opens the open Risks that hold them and its supporting line says so (D-36, UI-D32).
         */
        {
          key: 'mitigation-controls',
          caption: 'Mitigation controls',
          value: report.implementationStatus.total,
          supportingText: 'View the Risks that have them',
          href: mitigationControlRisksHref,
        },
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
  /** The released open Risks with this residual rating whose treatment action is Accept (D-41). */
  accepted: number;
};

/**
 * The rating rows of the inherent and residual small multiples, with each residual rating's accepted
 * count for the table. Not rated comes last and appears in both charts when either has an unrated
 * Risk, so the two charts always compare row for row. An accepted Risk is one of the residual
 * figures, so the residual count already decides whether Not rated shows.
 */
export function ratingRows(inherent: RatingCounts, residual: RatingCounts, accepted: RatingCounts): RatingRow[] {
  const rows: RatingRow[] = ratingOrder.map((rating) => ({
    key: rating,
    label: rating,
    rating,
    inherent: inherent[rating],
    residual: residual[rating],
    accepted: accepted[rating],
  }));
  return inherent.notRated > 0 || residual.notRated > 0
    ? [...rows, { key: 'notRated', label: 'Not rated', rating: null, inherent: inherent.notRated, residual: residual.notRated, accepted: accepted.notRated }]
    : rows;
}

/**
 * The rating table: Rating | Inherent | Residual | Accepted. Each figure opens the released open Risks with that
 * inherent or residual rating (`none` for Not rated); an accepted figure adds `treatmentAction=Accept` (UI-SPEC §9.3).
 */
export function ratingTableRows(rows: readonly RatingRow[]): ReportTableRow[] {
  const [inherentLabel, residualLabel, acceptedLabel] = reportSectionCopy.ratings.columns;
  return rows.map((row) => {
    const rating = ratingFilterValue(row.rating);
    return {
      key: row.key,
      label: row.label,
      values: [row.inherent, row.residual, row.accepted],
      cells: [
        figureLink(row.inherent, riskListHref({ inherentRating: rating, ...releasedOpenFilters }), cellLinkName(row.inherent, row.label, inherentLabel)),
        figureLink(row.residual, riskListHref({ residualRating: rating, ...releasedOpenFilters }), cellLinkName(row.residual, row.label, residualLabel)),
        figureLink(
          row.accepted,
          riskListHref({ residualRating: rating, ...releasedOpenFilters, treatmentAction: 'Accept' }),
          cellLinkName(row.accepted, row.label, acceptedLabel),
        ),
      ],
    };
  });
}

/** The one scale both rating charts share, so a bar in one compares honestly with a bar in the other. */
export function ratingScaleMax(rows: readonly RatingRow[]): number {
  return rows.reduce((largest, row) => Math.max(largest, row.inherent, row.residual), 0);
}

/** Whether the report counted any released open Risk: the population of the three released sections (D-42). */
export function hasReleasedOpenRisks(report: Pick<RiskExposureReport, 'byResidualRating'>): boolean {
  return report.byResidualRating.total > 0;
}

/** Whether any open Risk is under assessment: the population of the Under assessment section (D-42). */
export function hasRisksUnderAssessment(report: Pick<RiskExposureReport, 'underAssessment'>): boolean {
  return report.underAssessment.byResidualRating.total > 0;
}

/** One row of the Under assessment table, with its rating for the severity tone of its bar. */
export type UnderAssessmentRow = ReportTableRow & { rating: AssessmentRating | null };

/**
 * The open Risks under assessment by residual rating: Critical to Low, then Not rated, zeros included,
 * so the table always reads the same five rows (UI-SPEC §9.3). Each figure opens the register's
 * under-assessment list with its rating (`none` for Not rated).
 */
export function underAssessmentRows(counts: RatingCounts): UnderAssessmentRow[] {
  const ratings: Array<{ key: AssessmentRating | 'notRated'; label: string; rating: AssessmentRating | null }> = [
    ...ratingOrder.map((rating) => ({ key: rating, label: rating, rating })),
    { key: 'notRated', label: 'Not rated', rating: null },
  ];
  return ratings.map(({ key, label, rating }) => {
    const count = counts[key];
    const href = riskListHref({ residualRating: ratingFilterValue(rating), state: 'open', stage: 'under-assessment' });
    return { key, label, rating, values: [count], cells: [figureLink(count, href, cellLinkName(count, label))] };
  });
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

/**
 * The residual rating by treatment status matrix, Critical to Low, then Not rated. Each figure opens the released
 * open Risks with its residual rating and treatment status (`none` for Not rated and Not provided); a row's Total
 * opens them by the rating alone (UI-SPEC §9.3).
 */
export function residualByTreatmentStatusRows(matrix: RiskExposureReport['residualByTreatmentStatus']): ReportTableRow[] {
  const rows: Array<{ key: keyof RiskExposureReport['residualByTreatmentStatus']; label: string; rating: AssessmentRating | null }> = [
    ...ratingOrder.map((rating) => ({ key: rating, label: rating, rating })),
    { key: 'notRated', label: 'Not rated', rating: null },
  ];
  return rows.map(({ key, label, rating }) => ({
    key,
    label,
    values: treatmentStatusColumns.map((column) => matrix[key][column.key]),
    cells: treatmentStatusColumns.map((column) => {
      const count = matrix[key][column.key];
      const filters = isRecordedTreatmentStatus(column.key)
        ? { residualRating: ratingFilterValue(rating), treatmentStatus: treatmentStatusFilterValues[column.key], ...releasedOpenFilters }
        : { residualRating: ratingFilterValue(rating), ...releasedOpenFilters };
      return figureLink(count, riskListHref(filters), cellLinkName(count, label, column.label));
    }),
  }));
}

/**
 * The ranked Information Systems: Critical, High and their total, by system name. The name opens the system's
 * released open Risks, and Critical and High open those with the rating; Total is their sum and stays plain
 * beside them (D-37, UI-SPEC §9.3).
 */
export function exposedSystemRows(exposedSystems: ExposedSystems): ReportTableRow[] {
  const [criticalLabel, highLabel] = reportSectionCopy.exposedSystems.columns;
  return exposedSystems.rows.map((system) => ({
    key: system.documentId,
    label: system.name,
    values: [system.critical, system.high, system.total],
    header: {
      href: riskListHref({ system: system.documentId, ...releasedOpenFilters }),
      accessibleName: rowHeaderLinkName(system.name, 'its released open Risks'),
    },
    cells: [
      figureLink(system.critical, riskListHref({ system: system.documentId, residualRating: 'Critical', ...releasedOpenFilters }), cellLinkName(system.critical, system.name, criticalLabel)),
      figureLink(system.high, riskListHref({ system: system.documentId, residualRating: 'High', ...releasedOpenFilters }), cellLinkName(system.high, system.name, highLabel)),
      null,
    ],
  }));
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

/**
 * "View Critical" and "View High" after the no-impacted-system note, each opening the released open Risks of that
 * rating with no impacted Information System; the note's own figure is their sum and stays plain (D-37, §9.3).
 */
export function exposedSystemsNoteLinks(exposedSystems: ExposedSystems): ReportTextLink[] {
  if (exposedSystems.risksWithoutSystem === 0) return [];
  return (['Critical', 'High'] as const).map((rating) => ({
    label: `View ${rating}`,
    href: `/app/risks?impactedSystem=none&residualRating=${rating}&state=open&stage=released`,
    accessibleName: `View ${rating} Risks with no impacted Information System`,
  }));
}

/** Whether any open High or Critical residual Risk exists: one in a ranked system, or one with none. */
export function hasHighOrCriticalResidualRisk(exposedSystems: ExposedSystems): boolean {
  return exposedSystems.total > 0 || exposedSystems.risksWithoutSystem > 0;
}

/* ---------------------------------------------------- treatment performance */

/** A one-figure row whose figure opens `href`, named "{n} {Risk|Risks}: {label}". */
function singleFigureRow(key: string, label: string, count: number, href: string): ReportTableRow {
  return { key, label, values: [count], cells: [figureLink(count, href, cellLinkName(count, label))] };
}

/**
 * The due states of open treatments that are not Complete, in fixed order (D-04). Overdue and due within the
 * window open their alert lists; Due later and No target date open the register's dueState lists (UI-SPEC §8.2).
 */
export function dueStateRows(report: Pick<TreatmentPerformanceReport, 'dueState' | 'dueWindowDays'>): ReportTableRow[] {
  return [
    singleFigureRow('overdue', 'Overdue', report.dueState.overdue, overdueTreatmentsHref),
    singleFigureRow('dueWithinWindow', dueWithinWindowLabel(report.dueWindowDays), report.dueState.dueWithinWindow, dueSoonTreatmentsHref),
    singleFigureRow('later', 'Due later', report.dueState.later, dueLaterTreatmentsHref),
    singleFigureRow('noTargetDate', 'No target date', report.dueState.noTargetDate, noTargetDateTreatmentsHref),
  ];
}

type RecordedTreatmentStatus = Exclude<keyof TreatmentStatusCounts, 'total'>;

/** Each treatment status's register filter value: the stored status, or `none` for a Risk with none (D-35). */
const treatmentStatusFilterValues = {
  notStarted: 'Not Started',
  inProgress: 'In Progress',
  overdue: 'Overdue',
  complete: 'Complete',
  notProvided: 'none',
} as const satisfies Record<RecordedTreatmentStatus, string>;

function isRecordedTreatmentStatus(key: keyof TreatmentStatusCounts): key is RecordedTreatmentStatus {
  return key !== 'total';
}

/**
 * The treatment status recorded on each open Risk in either stage, headed with the stored values. Each figure
 * opens the open Risks with that status, in both stages, as the report counts them (D-43, UI-SPEC §8.2).
 */
export function treatmentStatusRows(counts: TreatmentStatusCounts): ReportTableRow[] {
  return treatmentStatusColumns.flatMap((column) => {
    const key = column.key;
    if (!isRecordedTreatmentStatus(key)) return [];
    return [singleFigureRow(key, column.label, counts[key], riskListHref({ state: 'open', treatmentStatus: treatmentStatusFilterValues[key] }))];
  });
}

/** Whether the report counted any open Risk, in either stage: the population of both treatment sections (D-43). */
export function hasOpenTreatmentRisks(report: Pick<TreatmentPerformanceReport, 'treatmentStatus'>): boolean {
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

/** The last calendar day of the month that starts on `monthStart`, as YYYY-MM-DD at UTC. */
function monthLastDay(monthStart: string): string {
  const start = utcCalendarDate(monthStart);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * The month table: Month | Released, with full month names and the partial month marked "(to date)". Each figure
 * opens the month's released Risk Assessments: its first day to its last, or to `today` for the current month.
 */
export function releasedMonthRows(months: readonly ThroughputMonth[], today: string): ReportTableRow[] {
  return months.map((month) => {
    const href = releasedAssessmentsHref(month.monthStart, month.partial ? today : monthLastDay(month.monthStart));
    return { key: month.monthStart, label: releasedMonthLabel(month), values: [month.count], cells: [figureLink(month.count, href, monthLinkName(month.count, month.monthStart))] };
  });
}

export function releasedPerMonthDescription(months: readonly ThroughputMonth[]): string {
  return `Risk Assessments released by a Security Analyst in each UTC calendar month, ${throughputRangeLabel(months)}. Release dates in the lists use your time zone.`;
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

/**
 * Assessment Requests by lifecycle state, in request order with the request labels, zeros included. Each figure
 * opens the Requests queue's All requests view filtered by that status, so `approved` reads Released (11-06).
 */
export function requestLifecycleRows(counts: RequestStatusCounts): ReportTableRow[] {
  return requestStatuses
    .filter(isReviewScopeStatus)
    .map((status) => {
      const label = statusLabel('request', status);
      const count = counts[requestStatusCountKeys[status]];
      const href = `/app/review/requests?queue=all&status=${encodeURIComponent(status)}`;
      return { key: status, label, values: [count], cells: [figureLink(count, href, lifecycleLinkName(count, label))] };
    });
}

/* ---------------------------------------------------- control effectiveness */

/*
 * D-36: a count of mitigation controls never poses as an equal list, so these figures stay plain. Each row header
 * opens the open Risks (in either stage, as the report counts them) that hold such mitigation controls, and its
 * name says so: "{label}: view the Risks with {label} mitigation controls" (UI-SPEC §8.2).
 */
function mitigationControlHeader(label: string, filter: 'mitigationStatus' | 'mitigationEffectiveness', value: string, what = `the Risks with ${label} mitigation controls`): ReportLink {
  return { href: riskListHref({ [filter]: value, state: 'open' }), accessibleName: rowHeaderLinkName(label, what) };
}

/**
 * Mitigation controls by implementation status. Not provided stays plain: no list holds the Risks whose mitigation
 * controls have no recorded status (the register's `none` lists Risks with no mitigation control at all); Phase
 * 18's mitigation-control table owns that list.
 */
export function implementationStatusRows(counts: ControlEffectivenessReport['implementationStatus']): ReportTableRow[] {
  return [
    { key: 'existing', label: 'Existing', values: [counts.existing], header: mitigationControlHeader('Existing', 'mitigationStatus', 'Existing') },
    { key: 'planned', label: 'Planned', values: [counts.planned], header: mitigationControlHeader('Planned', 'mitigationStatus', 'Planned') },
    { key: 'implemented', label: 'Implemented', values: [counts.implemented], header: mitigationControlHeader('Implemented', 'mitigationStatus', 'Implemented') },
    { key: 'retired', label: 'Retired', values: [counts.retired], header: mitigationControlHeader('Retired', 'mitigationStatus', 'Retired') },
    { key: 'notProvided', label: 'Not provided', values: [counts.notProvided] },
  ];
}

/** Mitigation controls by effectiveness rating; Not provided opens the register's `none` value, a rating not recorded. */
export function effectivenessRatingRows(counts: ControlEffectivenessReport['effectivenessRating']): ReportTableRow[] {
  return [
    { key: 'effective', label: 'Effective', values: [counts.effective], header: mitigationControlHeader('Effective', 'mitigationEffectiveness', 'Effective') },
    {
      key: 'partiallyEffective',
      label: 'Partially Effective',
      values: [counts.partiallyEffective],
      header: mitigationControlHeader('Partially Effective', 'mitigationEffectiveness', 'Partially Effective'),
    },
    { key: 'ineffective', label: 'Ineffective', values: [counts.ineffective], header: mitigationControlHeader('Ineffective', 'mitigationEffectiveness', 'Ineffective') },
    { key: 'notAssessed', label: 'Not Assessed', values: [counts.notAssessed], header: mitigationControlHeader('Not Assessed', 'mitigationEffectiveness', 'Not Assessed') },
    {
      key: 'notProvided',
      label: 'Not provided',
      values: [counts.notProvided],
      header: mitigationControlHeader('Not provided', 'mitigationEffectiveness', 'none', 'the Risks with mitigation controls whose effectiveness is not recorded'),
    },
  ];
}

/* ------------------------------------------------------------ section copy */

/** An empty section's state (UI-SPEC §7.4): cleared "No {noun}", or first-use "No {noun} yet". */
export type ReportEmptyCopy = { kind: 'cleared' | 'first-use'; noun: string; description?: string };

export const reportEmptyStates = {
  openRisks: { kind: 'cleared', noun: 'open Risks', description: 'Risks appear here when a Risk Assessment identifies them.' },
  releasedOpenRisks: { kind: 'cleared', noun: 'released open Risks', description: 'Risks count here once their risk assessment is released.' },
  risksUnderAssessment: { kind: 'cleared', noun: 'Risks under assessment', description: 'Risks appear here while their risk assessment is a draft or in review.' },
  highOrCriticalResidualRisks: { kind: 'cleared', noun: 'High or Critical residual Risks' },
  overdueTreatments: { kind: 'cleared', noun: 'overdue treatments', description: 'Treatments past their target date appear here.' },
  assessmentRequests: { kind: 'first-use', noun: 'Assessment Requests' },
  mitigationControls: { kind: 'cleared', noun: 'mitigation controls', description: 'Mitigation controls appear here when they are added to open Risks.' },
} as const satisfies Record<string, ReportEmptyCopy>;

/** Each section's caption and the one line that states its measure and population (UI-SPEC §4.3, §4.4). */
export const reportSectionCopy = {
  ratings: {
    caption: 'Inherent and residual rating',
    description: 'Released open Risks by inherent and residual rating, with accepted Risks by residual rating.',
    rowHeader: 'Rating',
    columns: ['Inherent', 'Residual', 'Accepted'],
    /* The small multiples' own captions: the table's Inherent and Residual headers are their text equivalent. */
    charts: { inherent: 'Inherent', residual: 'Residual' },
  },
  residualByTreatmentStatus: {
    caption: 'Residual rating by treatment status',
    description: 'Released open Risks by residual rating and treatment status. Treatment status is the value recorded on each Risk. Overdue by target date is in the Treatment performance report.',
    rowHeader: 'Residual rating',
    scrollLabel: 'Residual rating by treatment status, scrolls horizontally',
  },
  exposedSystems: {
    caption: 'Most exposed Information Systems',
    description: 'Information Systems carrying the most released open High and Critical residual Risks, highest first. Select a system to view its released open Risks.',
    rowHeader: 'Information System',
    columns: ['Critical', 'High', 'Total'],
  },
  underAssessment: {
    caption: 'Under assessment',
    description: 'Open Risks in risk assessments not yet released, by residual rating. They are not counted in the sections above.',
    rowHeader: 'Residual rating',
    columns: ['Risks'],
  },
  dueState: {
    caption: 'Due state',
    description: 'Open Risks whose treatment is not Complete, by target date. Includes Risks under assessment.',
    rowHeader: 'Due state',
    columns: ['Risks'],
  },
  treatmentStatus: {
    caption: 'Treatment status',
    description: 'All open Risks, by the treatment status recorded on each Risk. Includes Risks under assessment.',
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
    description: 'Mitigation controls on open Risks by implementation status. Select a status to view the Risks with those mitigation controls.',
    rowHeader: 'Implementation status',
    columns: ['Mitigation controls'],
  },
  effectivenessRating: {
    caption: 'Effectiveness rating',
    description: 'Mitigation controls on open Risks by effectiveness rating. Select a rating to view the Risks with those mitigation controls.',
    rowHeader: 'Effectiveness rating',
    columns: ['Mitigation controls'],
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
        acceptedByResidualRating: zeroRatings(),
        residualByTreatmentStatus: {
          Critical: zeroTreatmentStatuses(),
          High: zeroTreatmentStatuses(),
          Moderate: zeroTreatmentStatuses(),
          Low: zeroTreatmentStatuses(),
          notRated: zeroTreatmentStatuses(),
        },
        exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
        underAssessment: { byResidualRating: zeroRatings() },
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
