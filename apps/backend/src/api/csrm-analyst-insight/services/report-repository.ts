import type { Database } from "@strapi/database";

import { RELEASED_REQUEST_STATUSES, REVIEWABLE_REQUEST_STATUSES } from "../../csrm-assessment-request/services/collection-scope";
import { applyDisclosableParent } from "../../csrm-risk/services/risk-register";
import {
  EXPOSED_SYSTEMS_LIMIT,
  MOST_OVERDUE_TREATMENTS_LIMIT,
  THROUGHPUT_PERIODS,
  THROUGHPUT_SAMPLE_CAP,
  TREATMENT_REPORT_DUE_WINDOW_DAYS,
} from "../../../csrm/insights/insight-constants";
import {
  controlStatusCounts,
  effectivenessCounts,
  medianDays,
  normaliseRating,
  ratingCounts,
  requestStatusCounts,
  throughputMonths,
  throughputReleased,
  treatmentDueStateCounts,
  treatmentStatusCounts,
  type ControlStatusCounts,
  type EffectivenessCounts,
  type MedianDays,
  type RatingCounts,
  type RequestStatusCounts,
  type ThroughputReleased,
  type TreatmentDueStateCounts,
  type TreatmentStatusCounts,
} from "../../../csrm/insights/report-math";
import { addUtcDays, isUtcDate, normalizeDateTime } from "../../../csrm/insights/utc-date";
import { createAlertRepository, projectAlertRow, type AlertItem } from "./alert-repository";
import type { ThroughputPeriod } from "./report-query";

/*
 * The analyst reports, computed on read from database aggregates (D-01, D-03,
 * D-13). Every figure is a COUNT, or a SUM of CASE terms, over one closed
 * scope; every list is capped by a named constant and says when it is
 * truncated, and the median reads a capped, flagged sample.
 *
 * Scope (D-14, D-36): Risk and Control Implementation figures count open
 * contextual Risks only, which is the Risk Register's applyDisclosableParent
 * plus `r.closure_date IS NULL`, the same predicate as the register's
 * `state=open` filter. Throughput counts only released Risk Assessments (the
 * complete release triple) and requests in the six review-scope statuses. No
 * figure widens those scopes.
 *
 * Every column and alias comes from a constant in this module and every value
 * is a bound parameter.
 */

type Knex = Database["connection"];
type QueryBuilder = ReturnType<Knex["queryBuilder"]>;
type RecordValue = Record<string, unknown>;

/** The rows of the residual-rating by treatment-status table: the ladder, then Risks with no recognised rating. */
export const RATING_KEYS = Object.freeze(["Critical", "High", "Moderate", "Low", "notRated"] as const);
export type RatingKey = typeof RATING_KEYS[number];

export type ResidualByTreatmentStatus = Record<RatingKey, TreatmentStatusCounts>;

export type ExposedSystem = { documentId: string; name: string; critical: number; high: number; total: number };

export type ExposedSystems = {
  /** At most EXPOSED_SYSTEMS_LIMIT systems, most exposed first. */
  rows: ExposedSystem[];
  /** Every Information System carrying at least one open High or Critical residual Risk. */
  total: number;
  truncated: boolean;
  /** Open High or Critical residual Risks with no impacted Information System. */
  risksWithoutSystem: number;
};

export type RiskExposureFigures = {
  byResidualRating: RatingCounts;
  byInherentRating: RatingCounts;
  residualByTreatmentStatus: ResidualByTreatmentStatus;
  exposedSystems: ExposedSystems;
};

export type ControlEffectivenessFigures = {
  implementationStatus: ControlStatusCounts;
  effectivenessRating: EffectivenessCounts;
};

export type MostOverdueTreatments = {
  /** At most MOST_OVERDUE_TREATMENTS_LIMIT risk-treatment-overdue alerts, oldest target date first. */
  rows: AlertItem[];
  total: number;
  truncated: boolean;
};

export type TreatmentPerformanceFigures = {
  dueWindowDays: number;
  dueState: TreatmentDueStateCounts;
  treatmentStatus: TreatmentStatusCounts;
  mostOverdue: MostOverdueTreatments;
};

export type AssessmentThroughputFigures = {
  period: ThroughputPeriod;
  /** The first day of the oldest month in the period. */
  periodStart: string;
  released: ThroughputReleased;
  medianDaysToRelease: MedianDays;
  requestsByStatus: RequestStatusCounts;
};

export type ReportRepository = {
  riskExposure: () => Promise<RiskExposureFigures>;
  controlEffectiveness: () => Promise<ControlEffectivenessFigures>;
  /** `today` is the UTC calendar date (YYYY-MM-DD) the due window and the overdue list are evaluated on. */
  treatmentPerformance: (today: string) => Promise<TreatmentPerformanceFigures>;
  /** `today` fixes the current, partial month; the period is six or twelve months ending with it. */
  assessmentThroughput: (today: string, period: ThroughputPeriod) => Promise<AssessmentThroughputFigures>;
};

export class ReportRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportRepositoryError";
  }
}

const DATA_INVALID = "CSRM report data is invalid.";

/** D-13: the Information Systems list ranks systems by their open High and Critical residual Risks. */
const HIGH_OR_CRITICAL = Object.freeze(["Critical", "High"] as const);

/*
 * Most exposed first: more Critical residual Risks, then more High and
 * Critical together, then the name, then the documentId, so the order is total.
 */
const EXPOSED_SYSTEM_ORDER = Object.freeze([
  { column: "critical", order: "desc" },
  { column: "total", order: "desc" },
  { column: "s.name", order: "asc" },
  { column: "s.document_id", order: "asc" },
] as const);

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** PostgreSQL returns COUNT as a string, so every count is read through Number() and must be whole. */
function wholeCount(value: unknown): number {
  const count = typeof value === "number" ? value
    : typeof value === "bigint" ? Number(value)
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 0) throw new ReportRepositoryError(DATA_INVALID);
  return count;
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new ReportRepositoryError(DATA_INVALID);
  return value;
}

/** D-14, D-36: an open contextual Risk inside the Risk Register scope. The outer query aliases csrm_risks as `r`. */
function openContextualRisks(connection: Knex): QueryBuilder {
  return applyDisclosableParent(connection.queryBuilder().from("csrm_risks as r")).whereRaw("r.closure_date IS NULL");
}

/** A Control Implementation joined to its Risk, which must be an open contextual Risk (the ineffective-control alert scope). */
function implementationsOnOpenContextualRisks(connection: Knex): QueryBuilder {
  const query = connection.queryBuilder().from("csrm_control_implementations as ci")
    .join("csrm_control_implementations_risk_lnk as ci_risk", "ci_risk.csrm_control_implementation_id", "ci.id")
    .join("csrm_risks as r", "r.id", "ci_risk.csrm_risk_id");
  return applyDisclosableParent(query).whereRaw("r.closure_date IS NULL");
}

/*
 * D-04, D-31: a treatment is open while its Risk has no closure date and its
 * status is not Complete. A NULL status records no treatment, so it is not
 * Complete; a bare `<>` would drop it. The status is a bound value.
 */
const TREATMENT_NOT_COMPLETE = "(r.treatment_status IS NULL OR r.treatment_status <> ?)";

/**
 * A released Risk Assessment: the complete release triple of an approved
 * status, an approval date and an approver (the same triple the alerts and the
 * Risk Register read). The outer query aliases csrm_assessments as `a`.
 */
function releasedAssessments(connection: Knex): QueryBuilder {
  return connection.queryBuilder().from("csrm_assessments as a")
    .where("a.assessment_status", "approved")
    .whereNotNull("a.approval_date")
    .whereExists((approver) => {
      approver.from("csrm_assessments_approved_by_lnk as a_approver")
        .whereRaw("a_approver.csrm_assessment_id = a.id")
        .select("a_approver.id");
    });
}

/** Open contextual Risks rated High or Critical, each joined to the Information System it impacts. */
function highOrCriticalRisksWithSystem(connection: Knex): QueryBuilder {
  return openContextualRisks(connection)
    .join("csrm_risks_information_system_impacted_lnk as risk_system", "risk_system.csrm_risk_id", "r.id")
    .join("csrm_information_systems as s", "s.id", "risk_system.csrm_information_system_id")
    .whereIn("r.residual_rating", [...HIGH_OR_CRITICAL]);
}

async function readRows(query: QueryBuilder): Promise<RecordValue[]> {
  return await query as RecordValue[];
}

/** One aggregate row; an aggregate without GROUP BY always yields exactly one. */
async function readRow(query: QueryBuilder): Promise<RecordValue> {
  const row = await query.first() as RecordValue | undefined;
  if (!isRecord(row)) throw new ReportRepositoryError(DATA_INVALID);
  return row;
}

function ratingKey(value: unknown): RatingKey {
  return normaliseRating(value) ?? "notRated";
}

/** Splits the residual rating by treatment status rows into one treatment-status partition per rating. */
function residualByTreatmentStatus(rows: readonly RecordValue[]): ResidualByTreatmentStatus {
  return Object.fromEntries(RATING_KEYS.map((rating) => [
    rating,
    treatmentStatusCounts(rows
      .filter((row) => ratingKey(row.rating) === rating)
      .map((row) => ({ status: row.status, total: row.total }))),
  ])) as ResidualByTreatmentStatus;
}

function assertToday(today: string): void {
  if (!isUtcDate(today)) throw new ReportRepositoryError("CSRM report date is invalid.");
}

function projectExposedSystem(row: RecordValue): ExposedSystem {
  return {
    documentId: requiredText(row.document_id),
    name: requiredText(row.name),
    critical: wholeCount(row.critical),
    high: wholeCount(row.high),
    total: wholeCount(row.total),
  };
}

export function createReportRepository(strapi: unknown): ReportRepository {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function") {
    throw new ReportRepositoryError("CSRM report repository is unavailable.");
  }
  const connection = strapi.db.connection as Knex;

  return {
    async riskExposure() {
      const [residualRows, inherentRows, systemRows, systemTotal, withoutSystem] = await Promise.all([
        // (a) residual rating by treatment status.
        readRows(openContextualRisks(connection)
          .select("r.residual_rating as rating", "r.treatment_status as status")
          .countDistinct({ total: "r.id" })
          .groupBy("r.residual_rating", "r.treatment_status")),
        // (b) inherent rating.
        readRows(openContextualRisks(connection)
          .select("r.inherent_rating as rating")
          .countDistinct({ total: "r.id" })
          .groupBy("r.inherent_rating")),
        // (h) the most exposed systems, one more than the cap so truncation is known.
        readRows(highOrCriticalRisksWithSystem(connection)
          .select(
            "s.document_id as document_id",
            "s.name as name",
            connection.raw("COUNT(DISTINCT CASE WHEN r.residual_rating = ? THEN r.id END) AS ??", ["Critical", "critical"]),
            connection.raw("COUNT(DISTINCT CASE WHEN r.residual_rating = ? THEN r.id END) AS ??", ["High", "high"]),
          )
          .countDistinct({ total: "r.id" })
          .groupBy("s.id", "s.document_id", "s.name")
          .orderBy(EXPOSED_SYSTEM_ORDER.map(({ column, order }) => ({ column, order })))
          .limit(EXPOSED_SYSTEMS_LIMIT + 1)),
        // Every system that would be listed, however many the cap shows.
        readRow(highOrCriticalRisksWithSystem(connection).countDistinct({ total: "s.id" })),
        // High or Critical Risks that impact no Information System.
        readRow(openContextualRisks(connection)
          .whereIn("r.residual_rating", [...HIGH_OR_CRITICAL])
          .whereNotExists((system) => {
            system.from("csrm_risks_information_system_impacted_lnk as risk_system")
              .join("csrm_information_systems as s", "s.id", "risk_system.csrm_information_system_id")
              .whereRaw("risk_system.csrm_risk_id = r.id")
              .select("risk_system.id");
          })
          .countDistinct({ total: "r.id" })),
      ]);
      const systems = systemRows.map(projectExposedSystem);
      return {
        byResidualRating: ratingCounts(residualRows.map((row) => ({ rating: row.rating, total: row.total }))),
        byInherentRating: ratingCounts(inherentRows.map((row) => ({ rating: row.rating, total: row.total }))),
        residualByTreatmentStatus: residualByTreatmentStatus(residualRows),
        exposedSystems: {
          rows: systems.slice(0, EXPOSED_SYSTEMS_LIMIT),
          total: wholeCount(systemTotal.total),
          truncated: systems.length > EXPOSED_SYSTEMS_LIMIT,
          risksWithoutSystem: wholeCount(withoutSystem.total),
        },
      };
    },

    async controlEffectiveness() {
      // (g) Control Implementations on open contextual Risks, by status and effectiveness together.
      const rows = await readRows(implementationsOnOpenContextualRisks(connection)
        .select("ci.control_status as status", "ci.effectiveness_rating as rating")
        .countDistinct({ total: "ci.id" })
        .groupBy("ci.control_status", "ci.effectiveness_rating"));
      return {
        implementationStatus: controlStatusCounts(rows.map((row) => ({ status: row.status, total: row.total }))),
        effectivenessRating: effectivenessCounts(rows.map((row) => ({ rating: row.rating, total: row.total }))),
      };
    },

    async treatmentPerformance(today) {
      assertToday(today);
      // Target dates are `date` columns stored as YYYY-MM-DD, so the window bounds bind as the same strings.
      const windowEnd = addUtcDays(today, TREATMENT_REPORT_DUE_WINDOW_DAYS);
      const alerts = createAlertRepository(strapi);
      const overdueKinds = ["risk-treatment-overdue"] as const;
      const [dueRow, statusRows, overdueRows, overdueTotal] = await Promise.all([
        // (c) the due-state partition of open, not-Complete treatments, both window ends inclusive.
        readRow(openContextualRisks(connection)
          .whereRaw(TREATMENT_NOT_COMPLETE, ["Complete"])
          .select(
            connection.raw("SUM(CASE WHEN r.target_date < ? THEN 1 ELSE 0 END) AS ??", [today, "overdue"]),
            connection.raw("SUM(CASE WHEN r.target_date >= ? AND r.target_date <= ? THEN 1 ELSE 0 END) AS ??", [today, windowEnd, "due_within_window"]),
            connection.raw("SUM(CASE WHEN r.target_date > ? THEN 1 ELSE 0 END) AS ??", [windowEnd, "later"]),
            connection.raw("SUM(CASE WHEN r.target_date IS NULL THEN 1 ELSE 0 END) AS ??", ["no_target_date"]),
          )
          .countDistinct({ total: "r.id" })),
        // Every open contextual Risk by its recorded treatment status.
        readRows(openContextualRisks(connection)
          .select("r.treatment_status as status")
          .countDistinct({ total: "r.id" })
          .groupBy("r.treatment_status")),
        // The most overdue are the risk-treatment-overdue alerts: the same branch, order and projection.
        alerts.listPage({ kinds: overdueKinds, page: 1, pageSize: MOST_OVERDUE_TREATMENTS_LIMIT, today }),
        alerts.count({ kinds: overdueKinds, today }),
      ]);
      return {
        dueWindowDays: TREATMENT_REPORT_DUE_WINDOW_DAYS,
        dueState: treatmentDueStateCounts({
          overdue: dueRow.overdue,
          dueWithinWindow: dueRow.due_within_window,
          later: dueRow.later,
          noTargetDate: dueRow.no_target_date,
          total: dueRow.total,
        }),
        treatmentStatus: treatmentStatusCounts(statusRows.map((row) => ({ status: row.status, total: row.total }))),
        mostOverdue: {
          rows: overdueRows.map((row) => projectAlertRow(row, today)),
          total: overdueTotal,
          truncated: overdueTotal > MOST_OVERDUE_TREATMENTS_LIMIT,
        },
      };
    },

    async assessmentThroughput(today, period) {
      assertToday(today);
      if (!(THROUGHPUT_PERIODS as readonly number[]).includes(period)) throw new ReportRepositoryError("CSRM report period is invalid.");
      const months = throughputMonths(today, period);
      // approval_date and submitted_date are datetime columns, so every bound binds as a JS Date.
      const periodStart = months[0].start;
      const periodEnd = months[months.length - 1].end;
      const [monthRow, sampleRows, statusRows] = await Promise.all([
        // (e) releases per UTC calendar month, one SUM per month in one read.
        readRow(releasedAssessments(connection).select(...months.map((month, index) => connection.raw(
          "SUM(CASE WHEN a.approval_date >= ? AND a.approval_date < ? THEN 1 ELSE 0 END) AS ??",
          [month.start, month.end, `month_${index}`],
        )))),
        // (f) the releases in the period whose request records a submission, newest first, one more than the cap.
        readRows(releasedAssessments(connection)
          .join("csrm_assessments_assessment_request_lnk as a_request", "a_request.csrm_assessment_id", "a.id")
          .join("csrm_assessment_requests as rq", "rq.id", "a_request.csrm_assessment_request_id")
          .where("a.approval_date", ">=", periodStart)
          .where("a.approval_date", "<", periodEnd)
          .whereNotNull("rq.submitted_date")
          .select("rq.submitted_date as submitted_date", "a.approval_date as approval_date")
          .orderBy([{ column: "a.approval_date", order: "desc" }, { column: "a.id", order: "desc" }])
          .limit(THROUGHPUT_SAMPLE_CAP + 1)),
        // (d) Assessment Requests in the analyst's review scope by status; a draft is never in it.
        readRows(connection.queryBuilder().from("csrm_assessment_requests as rq")
          .whereIn("rq.request_status", [...REVIEWABLE_REQUEST_STATUSES, ...RELEASED_REQUEST_STATUSES])
          .select("rq.request_status as status")
          .countDistinct({ total: "rq.id" })
          .groupBy("rq.request_status")),
      ]);
      return {
        period,
        periodStart: months[0].monthStart,
        released: throughputReleased(months, months.map((_, index) => monthRow[`month_${index}`])),
        medianDaysToRelease: medianDays(sampleRows.map((row) => ({
          from: normalizeDateTime(row.submitted_date),
          to: normalizeDateTime(row.approval_date),
        })), THROUGHPUT_SAMPLE_CAP),
        requestsByStatus: requestStatusCounts(statusRows.map((row) => ({ status: row.status, total: row.total }))),
      };
    },
  };
}
