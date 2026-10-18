import type {
  AssessmentThroughputFigures,
  ControlEffectivenessFigures,
  RiskExposureFigures,
  TreatmentPerformanceFigures,
} from "../../api/csrm-analyst-insight/services/report-repository";
import type { ReportKey } from "../../api/csrm-analyst-insight/services/report-definitions";
import type { RequestStatusCounts, TreatmentStatusCounts } from "../insights/report-math";
import type { ExportCellValue } from "./export-views";
import { exportLabel, exportReport } from "./export-vocabulary";
import type { ExportAboutExtras, ExportTable } from "./run-export";

/*
 * Each report's figures as the tables its page shows (Phase 19 D-22; 19-UI-SPEC §3.3). The report is computed by the
 * report read's own code (createReportRepository, with the active-Risk rule), and this module only shapes those
 * figures: row order and row labels are the page's (apps/csrm/src/features/reports/report-presentation.ts), the table
 * keys, headings and column labels are the export vocabulary's `reports` section, and every value is a figure the
 * report carries. No figure is recomputed and no Risk is read here.
 */

/** One computed report, as GET /api/v1/reports/{reportKey} returns it: its key, its UTC today and its figures. */
export type ComputedReport =
  | ({ key: "risk-exposure"; today: string } & RiskExposureFigures)
  | ({ key: "control-effectiveness"; today: string } & ControlEffectivenessFigures)
  | ({ key: "treatment-performance"; today: string } & TreatmentPerformanceFigures)
  | ({ key: "assessment-throughput"; today: string } & AssessmentThroughputFigures);

type Row = Readonly<Record<string, ExportCellValue>>;

/** Vertical severity lists run Critical to Low, then Risks with no rating (the page's ratingOrder). */
const RATING_ROWS = [
  ["Critical", "Critical"],
  ["High", "High"],
  ["Moderate", "Moderate"],
  ["Low", "Low"],
  ["notRated", "Not rated"],
] as const;

/** The treatment statuses as the register shows them, in the page's order. */
const TREATMENT_STATUS_ROWS = [
  ["notStarted", "Not Started"],
  ["inProgress", "In Progress"],
  ["overdue", "Overdue"],
  ["complete", "Complete"],
  ["notProvided", "Not provided"],
] as const satisfies readonly (readonly [keyof TreatmentStatusCounts, string])[];

/** The review-scope request statuses in request order, each with its count's field; a draft is outside the scope. */
const REQUEST_STATUS_ROWS = [
  ["submitted", "submitted"],
  ["questionnaire-in-progress", "questionnaireInProgress"],
  ["risk-assessment-drafted", "riskAssessmentDrafted"],
  ["under-review", "underReview"],
  ["approved", "approved"],
  ["closed", "closed"],
] as const satisfies readonly (readonly [string, keyof RequestStatusCounts])[];

const asAtFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const countFormat = new Intl.NumberFormat("en-AU");

/** A calendar date the report carries, read at UTC midnight so it never slips a day. */
function calendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** "September 2026", or "October 2026 (to date)" for the current, partial month (the page's month table label). */
function monthLabel(month: { monthStart: string; partial: boolean }): string {
  const label = monthFormat.format(calendarDate(month.monthStart));
  return month.partial ? `${label} (to date)` : label;
}

/** "Due within 14 days", with the window the report carries (the page's dueWithinWindowLabel). */
function dueWithinWindowLabel(days: number): string {
  return `Due within ${countFormat.format(days)} ${days === 1 ? "day" : "days"}`;
}

function riskExposureRows(report: RiskExposureFigures): Record<string, Row[]> {
  const inherent = report.byInherentRating;
  const residual = report.byResidualRating;
  const accepted = report.acceptedByResidualRating;
  // The page's rating table shows Not rated only when either chart has an unrated Risk.
  const ratings = RATING_ROWS.filter(([key]) => key !== "notRated" || inherent.notRated > 0 || residual.notRated > 0);
  return {
    ratings: ratings.map(([key, label]) => ({ rating: label, inherent: inherent[key], residual: residual[key], accepted: accepted[key] })),
    "residual-by-treatment-status": RATING_ROWS.map(([key, label]) => {
      const counts = report.residualByTreatmentStatus[key];
      return { residualRating: label, ...Object.fromEntries(TREATMENT_STATUS_ROWS.map(([status]) => [status, counts[status]])), total: counts.total };
    }),
    "exposed-systems": report.exposedSystems.rows.map((system) => ({ informationSystem: system.name, critical: system.critical, high: system.high, total: system.total })),
    "under-assessment": RATING_ROWS.map(([key, label]) => ({ residualRating: label, risks: report.underAssessment.byResidualRating[key] })),
  };
}

function treatmentPerformanceRows(report: TreatmentPerformanceFigures): Record<string, Row[]> {
  return {
    "due-state": [
      { dueState: "Overdue", risks: report.dueState.overdue },
      { dueState: dueWithinWindowLabel(report.dueWindowDays), risks: report.dueState.dueWithinWindow },
      { dueState: "Due later", risks: report.dueState.later },
      { dueState: "No target date", risks: report.dueState.noTargetDate },
    ],
    "treatment-status": TREATMENT_STATUS_ROWS.map(([key, label]) => ({ treatmentStatus: label, risks: report.treatmentStatus[key] })),
  };
}

function assessmentThroughputRows(report: AssessmentThroughputFigures): Record<string, Row[]> {
  return {
    "released-per-month": report.released.months.map((month) => ({ month: monthLabel(month), released: month.count })),
    "request-lifecycle": REQUEST_STATUS_ROWS.map(([status, key]) => ({ lifecycleState: exportLabel("requestStatus", status), assessmentRequests: report.requestsByStatus[key] })),
  };
}

function controlEffectivenessRows(report: ControlEffectivenessFigures): Record<string, Row[]> {
  const status = report.implementationStatus;
  const rating = report.effectivenessRating;
  return {
    "implementation-status": [
      { implementationStatus: "Existing", mitigationControls: status.existing },
      { implementationStatus: "Planned", mitigationControls: status.planned },
      { implementationStatus: "Implemented", mitigationControls: status.implemented },
      { implementationStatus: "Retired", mitigationControls: status.retired },
      { implementationStatus: "Not provided", mitigationControls: status.notProvided },
    ],
    "effectiveness-rating": [
      { effectivenessRating: "Effective", mitigationControls: rating.effective },
      { effectivenessRating: "Partially Effective", mitigationControls: rating.partiallyEffective },
      { effectivenessRating: "Ineffective", mitigationControls: rating.ineffective },
      { effectivenessRating: "Not Assessed", mitigationControls: rating.notAssessed },
      { effectivenessRating: "Not provided", mitigationControls: rating.notProvided },
    ],
  };
}

function rowsOf(report: ComputedReport): Record<string, Row[]> {
  switch (report.key) {
    case "risk-exposure":
      return riskExposureRows(report);
    case "treatment-performance":
      return treatmentPerformanceRows(report);
    case "assessment-throughput":
      return assessmentThroughputRows(report);
    case "control-effectiveness":
      return controlEffectivenessRows(report);
    default: {
      const unreachable: never = report;
      throw new Error(`Unknown report: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * The report's tables in the vocabulary's (the page's) order, each with its vocabulary key, heading and columns. A CSV
 * of one table is named `{reportKey}-{table slug}` (19-UI-SPEC §3.2).
 */
export function reportExportTables(report: ComputedReport): ExportTable[] {
  const rows = rowsOf(report);
  return exportReport(report.key).tables.map((table) => {
    const tableRows = rows[table.key];
    if (!tableRows) throw new TypeError(`CSRM report ${report.key} has no rows for its table ${table.key}.`);
    return { key: table.key, heading: table.heading, slug: `${report.key}-${table.slug}`, columns: table.columns, rows: tableRows };
  });
}

/** The About sheet's report rows (D-22): As at, the report's date as its page shows it, and the throughput Period. */
export function reportExportAbout(report: ComputedReport): ExportAboutExtras {
  const asAt = asAtFormat.format(calendarDate(report.today));
  if (report.key !== "assessment-throughput") return { asAt };
  const first = report.released.months.at(0);
  const last = report.released.months.at(-1);
  const range = first && last ? `, ${monthFormat.format(calendarDate(first.monthStart))} to ${monthFormat.format(calendarDate(last.monthStart))}` : "";
  return { asAt, period: `${report.period} months${range}` };
}

/** The report's file slug (`{reportKey}-report`), heading and log view (`report:{reportKey}`). */
export function reportExportView(reportKey: ReportKey): { viewKey: string; slug: string; heading: string } {
  const spec = exportReport(reportKey);
  return { viewKey: `report:${reportKey}`, slug: spec.slug, heading: spec.heading };
}
