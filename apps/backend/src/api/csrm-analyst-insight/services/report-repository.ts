import type { Database } from "@strapi/database";

import { RELEASED_REQUEST_STATUSES, REVIEWABLE_REQUEST_STATUSES } from "../../csrm-assessment-request/services/collection-scope";
import { applyActiveRisk, applyDisclosableParent, applyReleasedParent, applyUnderAssessmentParent } from "../../csrm-risk/services/risk-register";
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
import { applyTreatmentDueStatePredicate, type TreatmentDueState } from "../../../csrm/insights/treatment-due-state";
import { isUtcDate, normalizeDateTime } from "../../../csrm/insights/utc-date";
import { createAlertRepository, projectAlertRow, type AlertItem } from "./alert-repository";
import type { ThroughputPeriod } from "./report-query";

/*
 * The analyst reports, computed on read from database aggregates (D-01, D-03,
 * D-13). Every figure is a COUNT, or a SUM of CASE terms, over one closed
 * scope; every list is capped by a named constant and says when it is
 * truncated, and the median reads a capped, flagged sample.
 *
 * Scope (D-14, D-36, D-40 to D-43): every Risk figure reads the Risk Register's
 * scope with its `state=open` predicate (`r.closure_date IS NULL`).
 * - Risk exposure counts released open Risks only, through the register's
 *   named released branch (applyReleasedParent), and counts the open Risks
 *   under assessment apart through its other branch
 *   (applyUnderAssessmentParent). The two are never added together, so each
 *   figure equals the register list filtered by its stage (D-42).
 * - Treatment performance and control effectiveness keep both stages
 *   (applyDisclosableParent, the union of the two branches), as the alerts do
 *   (D-43).
 * Throughput counts only released Risk Assessments (the complete release
 * triple) and requests in the six review-scope statuses. No figure widens
 * those scopes.
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
  /** Every Information System carrying at least one released open High or Critical residual Risk. */
  total: number;
  truncated: boolean;
  /** Released open High or Critical residual Risks with no impacted Information System. */
  risksWithoutSystem: number;
};

/** D-42: the open Risks whose risk assessment is a draft or in review, counted apart from every released section. */
export type RiskExposureUnderAssessment = { byResidualRating: RatingCounts };

export type RiskExposureFigures = {
  /** Released open Risks (D-40). */
  byResidualRating: RatingCounts;
  byInherentRating: RatingCounts;
  /** Released open Risks whose treatment action is Accept; a draft's Accept is never counted (D-41). */
  acceptedByResidualRating: RatingCounts;
  residualByTreatmentStatus: ResidualByTreatmentStatus;
  exposedSystems: ExposedSystems;
  underAssessment: RiskExposureUnderAssessment;
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

/** The open-Risk predicate of the register's `state=open` (D-36). The outer query aliases csrm_risks as `r`. */
function openRisks(query: QueryBuilder): QueryBuilder {
  return query.whereRaw("r.closure_date IS NULL");
}

/**
 * The Risk table as the outer `r`, active Risks only (Phase 16 D-13, applyActiveRisk), as the register's default view
 * reads it: every Risk figure below starts here, so a withdrawn Risk counts in no report.
 */
function activeRiskTable(connection: Knex): QueryBuilder {
  return applyActiveRisk(connection.queryBuilder().from("csrm_risks as r"));
}

/** D-14, D-36, D-43: an open Risk in either stage of the Risk Register scope, for the figures that keep both. */
function openDisclosableRisks(connection: Knex): QueryBuilder {
  return openRisks(applyDisclosableParent(activeRiskTable(connection)));
}

/** D-40: an open Risk whose risk assessment is released, the register's `stage=released` branch. */
function openReleasedRisks(connection: Knex): QueryBuilder {
  return openRisks(applyReleasedParent(activeRiskTable(connection)));
}

/** D-40: an open Risk whose risk assessment is a draft or in review, the register's `stage=under-assessment` branch. */
function openUnderAssessmentRisks(connection: Knex): QueryBuilder {
  return openRisks(applyUnderAssessmentParent(activeRiskTable(connection)));
}

/** Counts a population by one stored rating column; ratingCounts folds null and off-ladder values into notRated. */
function ratingRowsBy(query: QueryBuilder, column: "r.residual_rating" | "r.inherent_rating"): QueryBuilder {
  return query.select(`${column} as rating`).countDistinct({ total: "r.id" }).groupBy(column);
}

/** A Control Implementation joined to its Risk, which must be open in either stage (the ineffective-control alert scope, D-43). */
function implementationsOnOpenDisclosableRisks(connection: Knex): QueryBuilder {
  const query = connection.queryBuilder().from("csrm_control_implementations as ci")
    .join("csrm_control_implementations_risk_lnk as ci_risk", "ci_risk.csrm_control_implementation_id", "ci.id")
    .join("csrm_risks as r", "r.id", "ci_risk.csrm_risk_id");
  // Phase 16 D-13: a Control Implementation on a withdrawn Risk counts in no report.
  return openRisks(applyActiveRisk(applyDisclosableParent(query)));
}

/** The four due states of an open treatment the report partitions, in the shared rule's vocabulary (D-04). */
const REPORT_DUE_STATES = Object.freeze(["overdue", "due-soon", "later", "no-target-date"] as const satisfies readonly TreatmentDueState[]);

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

/** Released open Risks rated High or Critical, each joined to the Information System it impacts (D-42). */
function highOrCriticalRisksWithSystem(connection: Knex): QueryBuilder {
  return openReleasedRisks(connection)
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

/** Folds rating rows (rating, total) into the closed RatingCounts. */
function ratingCountsOf(rows: readonly RecordValue[]): RatingCounts {
  return ratingCounts(rows.map((row) => ({ rating: row.rating, total: row.total })));
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
      const [residualRows, inherentRows, acceptedRows, underAssessmentRows, systemRows, systemTotal, withoutSystem] = await Promise.all([
        // (a) released open Risks by residual rating and treatment status.
        readRows(openReleasedRisks(connection)
          .select("r.residual_rating as rating", "r.treatment_status as status")
          .countDistinct({ total: "r.id" })
          .groupBy("r.residual_rating", "r.treatment_status")),
        // (b) released open Risks by inherent rating.
        readRows(ratingRowsBy(openReleasedRisks(connection), "r.inherent_rating")),
        // D-41: the register's treatmentAction=Accept on the released branch; the value is a bound constant.
        readRows(ratingRowsBy(openReleasedRisks(connection).where("r.treatment_action", "Accept"), "r.residual_rating")),
        // D-42: the open Risks under assessment, never added to a released figure.
        readRows(ratingRowsBy(openUnderAssessmentRisks(connection), "r.residual_rating")),
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
        // Released High or Critical Risks that impact no Information System.
        readRow(openReleasedRisks(connection)
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
        byResidualRating: ratingCountsOf(residualRows),
        byInherentRating: ratingCountsOf(inherentRows),
        acceptedByResidualRating: ratingCountsOf(acceptedRows),
        residualByTreatmentStatus: residualByTreatmentStatus(residualRows),
        exposedSystems: {
          rows: systems.slice(0, EXPOSED_SYSTEMS_LIMIT),
          total: wholeCount(systemTotal.total),
          truncated: systems.length > EXPOSED_SYSTEMS_LIMIT,
          risksWithoutSystem: wholeCount(withoutSystem.total),
        },
        underAssessment: { byResidualRating: ratingCountsOf(underAssessmentRows) },
      };
    },

    async controlEffectiveness() {
      // (g) Control Implementations on open Risks in either stage, by status and effectiveness together (D-43).
      const rows = await readRows(implementationsOnOpenDisclosableRisks(connection)
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
      const alerts = createAlertRepository(strapi);
      const overdueKinds = ["risk-treatment-overdue"] as const;
      /*
       * (c) The due-state partition of open treatments in either stage (D-43), one count per state, each read
       * with the shared due-state rule over the product's due-soon window (D-38). Each figure therefore equals
       * the Risk register's dueState list and, for overdue and due soon, the alert list it opens.
       */
      const dueStateCount = (state: typeof REPORT_DUE_STATES[number]) => readRow(
        // Phase 20 (G-16) switches the governing date in treatment-due-state.ts; this figure follows it.
        applyTreatmentDueStatePredicate(openDisclosableRisks(connection), state, { today, windowDays: TREATMENT_REPORT_DUE_WINDOW_DAYS })
          .countDistinct({ total: "r.id" }),
      );
      const [dueRows, statusRows, overdueRows, overdueTotal] = await Promise.all([
        Promise.all(REPORT_DUE_STATES.map(dueStateCount)),
        // Every open Risk in either stage by its recorded treatment status (D-43).
        readRows(openDisclosableRisks(connection)
          .select("r.treatment_status as status")
          .countDistinct({ total: "r.id" })
          .groupBy("r.treatment_status")),
        // The most overdue are the risk-treatment-overdue alerts: the same branch, order and projection.
        alerts.listPage({ kinds: overdueKinds, page: 1, pageSize: MOST_OVERDUE_TREATMENTS_LIMIT, today }),
        alerts.count({ kinds: overdueKinds, today }),
      ]);
      const [overdue, dueWithinWindow, later, noTargetDate] = dueRows.map((row) => wholeCount(row.total));
      return {
        dueWindowDays: TREATMENT_REPORT_DUE_WINDOW_DAYS,
        // The four states partition the open treatments, so their sum is the total.
        dueState: treatmentDueStateCounts({ overdue, dueWithinWindow, later, noTargetDate, total: overdue + dueWithinWindow + later + noTargetDate }),
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
