import type { Database } from "@strapi/database";

import {
  countReviewQueueBucket,
  whereQuestionnaireHasSubmittedAnswer,
} from "../../csrm-assessment-request/services/review-queue-repository";
import { activeQuestionnaireGenerationRequestIds } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import { applyDisclosableParent } from "../../csrm-risk/services/risk-register";
import { DASHBOARD_WIDGET_ROW_LIMIT, RECENT_ACTIVITY_LIMIT } from "../../../csrm/insights/insight-constants";
import { mergeRecentActivity, type RecentActivity } from "../../../csrm/insights/recent-activity";
import { ratingCounts, type RatingCounts } from "../../../csrm/insights/report-math";
import { deriveTreatmentDueState, type TreatmentDueState } from "../../../csrm/insights/treatment-due-state";
import { isUtcDate } from "../../../csrm/insights/utc-date";
import { createAlertRepository } from "./alert-repository";
import { readRecentActivityCandidates } from "./recent-activity-repository";

/*
 * The analyst dashboard summary (DASH-01, D-34), computed on read. Every
 * figure comes from the definition of the list it opens (D-18, D-24):
 * - the queue counts from countReviewQueueBucket, the definition the review
 *   queue pages use (D-21);
 * - submitted Questionnaires from the submitted-answer fact of the
 *   questionnaire review list, and Risk Assessments by status as their list
 *   filters them. Answers stay submitted after the Risk Assessment is drafted
 *   and released, so the Questionnaires figure counts that list rather than
 *   waiting work, and the dashboard labels it "Submitted";
 * - Risk exposure and the High and Critical residual Risks from open
 *   contextual Risks: the Risk Register scope (applyDisclosableParent) plus the
 *   register's own `state=open` predicate (D-36);
 * - treatments due from the alert branches the alert list reads;
 * - recent activity from one bounded read per kind of workflow event, merged
 *   newest first and capped at RECENT_ACTIVITY_LIMIT with a truncated flag.
 *
 * Every count is a database aggregate (D-03), read through Number() because
 * PostgreSQL returns COUNT as a string. Each list is capped by a named
 * constant and says when it is truncated. Every column comes from a constant
 * in this module, every value is a bound parameter, and every ORDER BY
 * fragment is a constant.
 */

type Knex = Database["connection"];
type QueryBuilder = ReturnType<Knex["queryBuilder"]>;
type RecordValue = Record<string, unknown>;

/** The residual ratings the High and Critical widget lists, most severe first. */
export const HIGH_CRITICAL_RATINGS = Object.freeze(["Critical", "High"] as const);
export type HighCriticalRating = typeof HIGH_CRITICAL_RATINGS[number];

export type DashboardReviewQueue = {
  requiresAttention: number;
  awaitingRequestor: number;
  generationInProgress: number;
  /**
   * Questionnaires whose answers are submitted: the review list's `status=submitted`, finished work
   * included. The contract names the field; the dashboard labels the figure "Submitted".
   */
  questionnairesReadyForReview: number;
  /** Risk Assessments by status: the assessment list's `status=draft` and `status=in-review`. */
  assessmentsDraft: number;
  assessmentsInReview: number;
};

export type DashboardRiskRow = {
  documentId: string;
  riskNumber: string;
  riskStatement: string | null;
  residualRating: HighCriticalRating;
  targetDate: string | null;
  /** The single D-04 rule on the summary's today (D-26). */
  treatmentDueState: TreatmentDueState;
};

export type DashboardHighCriticalRisks = {
  /** At most DASHBOARD_WIDGET_ROW_LIMIT open High and Critical residual Risks, Critical first. */
  rows: DashboardRiskRow[];
  total: number;
  truncated: boolean;
};

export type DashboardTreatmentsDue = { overdue: number; dueSoon: number; total: number };

export type DashboardSummaryFigures = {
  reviewQueue: DashboardReviewQueue;
  riskExposure: RatingCounts;
  highCriticalRisks: DashboardHighCriticalRisks;
  treatmentsDue: DashboardTreatmentsDue;
  recentActivity: RecentActivity;
};

export class DashboardSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardSummaryError";
  }
}

const DATA_INVALID = "CSRM dashboard data is invalid.";

/*
 * Critical before High, then the earliest target date with an undated Risk
 * last, then the Risk number, then the documentId, so the order is total. Each
 * fragment is a constant and the one compared value is bound.
 */
const HIGH_CRITICAL_ORDER: ReadonlyArray<readonly [string, readonly string[]]> = Object.freeze([
  ["CASE WHEN r.residual_rating = ? THEN 0 ELSE 1 END ASC", ["Critical"]],
  ["CASE WHEN r.target_date IS NULL THEN 1 ELSE 0 END ASC", []],
  ["r.target_date ASC", []],
  ["r.risk_number ASC", []],
  ["r.document_id ASC", []],
] as const);

/** The treatment kinds the Treatments due counts read, over the alert list's own branches. */
const TREATMENT_OVERDUE = Object.freeze(["risk-treatment-overdue"] as const);
const TREATMENT_DUE_SOON = Object.freeze(["risk-treatment-due-soon"] as const);
const TREATMENT_KINDS = Object.freeze(["risk-treatment-overdue", "risk-treatment-due-soon"] as const);

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A database count: a whole number, however the driver returns it. */
function wholeCount(value: unknown): number {
  const count = typeof value === "number" ? value
    : typeof value === "bigint" ? Number(value)
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 0) throw new DashboardSummaryError(DATA_INVALID);
  return count;
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new DashboardSummaryError(DATA_INVALID);
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Stored `date` columns hold YYYY-MM-DD; anything else present is invalid data. */
function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isUtcDate(value)) throw new DashboardSummaryError(DATA_INVALID);
  return value;
}

/** D-14, D-36: an open contextual Risk inside the Risk Register scope. The outer query aliases csrm_risks as `r`. */
function openContextualRisks(connection: Knex): QueryBuilder {
  return applyDisclosableParent(connection.queryBuilder().from("csrm_risks as r")).whereRaw("r.closure_date IS NULL");
}

function openHighCriticalRisks(connection: Knex): QueryBuilder {
  return openContextualRisks(connection).whereIn("r.residual_rating", [...HIGH_CRITICAL_RATINGS]);
}

async function readRows(query: QueryBuilder): Promise<RecordValue[]> {
  return await query as RecordValue[];
}

/** One aggregate row; an aggregate without GROUP BY always yields exactly one. */
async function readRow(query: QueryBuilder): Promise<RecordValue> {
  const row = await query.first() as RecordValue | undefined;
  if (!isRecord(row)) throw new DashboardSummaryError(DATA_INVALID);
  return row;
}

function highCriticalRating(value: unknown): HighCriticalRating {
  const rating = HIGH_CRITICAL_RATINGS.find((candidate) => candidate === value);
  if (rating === undefined) throw new DashboardSummaryError(DATA_INVALID);
  return rating;
}

function projectRiskRow(row: RecordValue, today: string): DashboardRiskRow {
  const targetDate = optionalDate(row.target_date);
  return {
    documentId: requiredText(row.document_id),
    riskNumber: requiredText(row.risk_number),
    riskStatement: optionalText(row.risk_statement),
    residualRating: highCriticalRating(row.residual_rating),
    targetDate,
    treatmentDueState: deriveTreatmentDueState({
      targetDate,
      treatmentStatus: optionalText(row.treatment_status),
      closureDate: optionalDate(row.closure_date),
    }, today),
  };
}

/** Folds the assessment status counts; a status the query does not select cannot occur. */
function assessmentCount(rows: readonly RecordValue[], status: "draft" | "in-review"): number {
  return rows.filter((row) => row.status === status).reduce((sum, row) => sum + wholeCount(row.total), 0);
}

/**
 * Every figure of the analyst dashboard summary on `today`, a YYYY-MM-DD UTC
 * date that fixes each treatment due state and each alert window.
 */
export async function computeDashboardSummary(strapi: unknown, today: string): Promise<DashboardSummaryFigures> {
  if (!isUtcDate(today)) throw new DashboardSummaryError("CSRM dashboard date is invalid.");
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function") {
    throw new DashboardSummaryError("CSRM dashboard summary is unavailable.");
  }
  const connection = strapi.db.connection as Knex;
  // The process-local generation registry, as a bounded snapshot shared by the three queue counts.
  const activeIds = activeQuestionnaireGenerationRequestIds(strapi as never);
  const alerts = createAlertRepository(strapi);

  const riskRowsQuery = openHighCriticalRisks(connection).select(
    "r.document_id as document_id",
    "r.risk_number as risk_number",
    "r.risk_statement as risk_statement",
    "r.residual_rating as residual_rating",
    "r.target_date as target_date",
    "r.treatment_status as treatment_status",
    "r.closure_date as closure_date",
  );
  for (const [fragment, bindings] of HIGH_CRITICAL_ORDER) riskRowsQuery.orderByRaw(fragment, [...bindings]);

  const [
    requiresAttention,
    awaitingRequestor,
    generationInProgress,
    readyForReview,
    assessmentRows,
    exposureRows,
    riskRows,
    riskTotal,
    overdue,
    dueSoon,
    treatmentsTotal,
    activityCandidates,
  ] = await Promise.all([
    countReviewQueueBucket(strapi, "requires-attention", activeIds),
    countReviewQueueBucket(strapi, "awaiting-requestor", activeIds),
    countReviewQueueBucket(strapi, "generation-in-progress", activeIds),
    // The questionnaire review list's `status=submitted`: every answer submitted (D-30).
    readRow(whereQuestionnaireHasSubmittedAnswer(connection.queryBuilder().from("csrm_questionnaires as q"), "q.id")
      .countDistinct({ total: "q.id" })),
    readRows(connection.queryBuilder().from("csrm_assessments as a")
      .whereIn("a.assessment_status", ["draft", "in-review"])
      .select("a.assessment_status as status")
      .countDistinct({ total: "a.id" })
      .groupBy("a.assessment_status")),
    readRows(openContextualRisks(connection)
      .select("r.residual_rating as rating")
      .countDistinct({ total: "r.id" })
      .groupBy("r.residual_rating")),
    // One more than the cap, so truncation is known without a second list read.
    readRows(riskRowsQuery.limit(DASHBOARD_WIDGET_ROW_LIMIT + 1)),
    readRow(openHighCriticalRisks(connection).countDistinct({ total: "r.id" })),
    alerts.count({ kinds: TREATMENT_OVERDUE, today }),
    alerts.count({ kinds: TREATMENT_DUE_SOON, today }),
    alerts.count({ kinds: TREATMENT_KINDS, today }),
    readRecentActivityCandidates(strapi),
  ]);

  const rows = riskRows.map((row) => projectRiskRow(row, today));
  return {
    reviewQueue: {
      requiresAttention: wholeCount(requiresAttention),
      awaitingRequestor: wholeCount(awaitingRequestor),
      generationInProgress: wholeCount(generationInProgress),
      questionnairesReadyForReview: wholeCount(readyForReview.total),
      assessmentsDraft: assessmentCount(assessmentRows, "draft"),
      assessmentsInReview: assessmentCount(assessmentRows, "in-review"),
    },
    riskExposure: ratingCounts(exposureRows.map((row) => ({ rating: row.rating, total: row.total }))),
    highCriticalRisks: {
      rows: rows.slice(0, DASHBOARD_WIDGET_ROW_LIMIT),
      total: wholeCount(riskTotal.total),
      truncated: rows.length > DASHBOARD_WIDGET_ROW_LIMIT,
    },
    treatmentsDue: { overdue: wholeCount(overdue), dueSoon: wholeCount(dueSoon), total: wholeCount(treatmentsTotal) },
    recentActivity: mergeRecentActivity(activityCandidates, RECENT_ACTIVITY_LIMIT),
  };
}
