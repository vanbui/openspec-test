import type { Database } from "@strapi/database";

import {
  countReviewQueueBucket,
  whereQuestionnaireHasSubmittedAnswer,
  type UnreadNotesViewer,
} from "../../csrm-assessment-request/services/review-queue-repository";
import { activeQuestionnaireGenerationRequestIds } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import { applyActiveRisk, applyReleasedParent, applyUnderAssessmentParent } from "../../csrm-risk/services/risk-register";
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
 * - Phase 13 (D-15): the viewer's own counts, the same buckets with the
 *   queue's assignee=me filter (and its notes=unread filter over the open
 *   queue), and the team's pick-up pool, requires-attention with nobody
 *   holding the request, each for the viewer the policy resolved;
 * - submitted Questionnaires from the submitted-answer fact of the
 *   questionnaire review list, and Risk Assessments by status as their list
 *   filters them. Answers stay submitted after the Risk Assessment is drafted
 *   and released, so the Questionnaires figure counts that list rather than
 *   waiting work, and the dashboard labels it "Submitted";
 * - Risk exposure from the Risk Register's two named branches (D-40, D-41,
 *   D-42), never added together: released open Risks (applyReleasedParent), the
 *   accepted ones among them (treatment action Accept) and open Risks under
 *   assessment (applyUnderAssessmentParent), each with the register's own
 *   `state=open` predicate (D-36), so every rating count equals the register
 *   list filtered by that rating, state=open and its stage;
 * - the High and Critical residual Risks from released open Risks only (D-42),
 *   so the list and its total equal the register's released open Critical and
 *   High lists the widget's footer opens;
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

/**
 * Phase 13 (D-15): the viewer's own queue counts, each the Assigned to me list's total for that queue. No `open`
 * count is served, because no surface shows it.
 */
export type DashboardReviewQueueMine = {
  requiresAttention: number;
  awaitingRequestor: number;
  generationInProgress: number;
  /** Open requests the viewer holds with a note the viewer has not read: Assigned to me's `notes=unread`. */
  withUnreadNotes: number;
};

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
  mine: DashboardReviewQueueMine;
  /** Requires attention with nobody holding the request: Requests' `assignee=unassigned` (D-15). */
  unassigned: number;
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
  /** At most DASHBOARD_WIDGET_ROW_LIMIT released open High and Critical residual Risks, Critical first (D-42). */
  rows: DashboardRiskRow[];
  total: number;
  truncated: boolean;
};

export type DashboardTreatmentsDue = { overdue: number; dueSoon: number; total: number };

/**
 * Risk exposure by residual rating in the register's two stages (D-40 to D-42). A draft's Accept never
 * counts as accepted, because releasedAccepted reads the released branch only.
 */
export type DashboardRiskExposure = {
  released: RatingCounts;
  releasedAccepted: RatingCounts;
  underAssessment: RatingCounts;
};

export type DashboardSummaryFigures = {
  reviewQueue: DashboardReviewQueue;
  riskExposure: DashboardRiskExposure;
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

/** The open-Risk predicate of the register's `state=open` (D-36). The outer query aliases csrm_risks as `r`. */
function openRisks(query: QueryBuilder): QueryBuilder {
  return query.whereRaw("r.closure_date IS NULL");
}

/**
 * The Risk table as the outer `r`, active Risks only (Phase 16 D-13, applyActiveRisk), as the register's default view
 * reads it: every Risk figure below starts here, so a withdrawn Risk counts in none.
 */
function activeRiskTable(connection: Knex): QueryBuilder {
  return applyActiveRisk(connection.queryBuilder().from("csrm_risks as r"));
}

/** D-40: an open Risk whose risk assessment is released, the register's `stage=released` branch. */
function openReleasedRisks(connection: Knex): QueryBuilder {
  return openRisks(applyReleasedParent(activeRiskTable(connection)));
}

/** D-40: an open Risk whose risk assessment is a draft or in review, the register's `stage=under-assessment` branch. */
function openUnderAssessmentRisks(connection: Knex): QueryBuilder {
  return openRisks(applyUnderAssessmentParent(activeRiskTable(connection)));
}

/** Counts a population by its stored residual rating; ratingCounts folds null and off-ladder values into notRated. */
function residualRatingRows(query: QueryBuilder): QueryBuilder {
  return query.select("r.residual_rating as rating").countDistinct({ total: "r.id" }).groupBy("r.residual_rating");
}

/** D-42: the High and Critical widget reads the released branch only; a Risk under assessment never appears in it. */
function openHighCriticalRisks(connection: Knex): QueryBuilder {
  return openReleasedRisks(connection).whereIn("r.residual_rating", [...HIGH_CRITICAL_RATINGS]);
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

function exposureCounts(rows: readonly RecordValue[]): RatingCounts {
  return ratingCounts(rows.map((row) => ({ rating: row.rating, total: row.total })));
}

/** Folds the assessment status counts; a status the query does not select cannot occur. */
function assessmentCount(rows: readonly RecordValue[], status: "draft" | "in-review"): number {
  return rows.filter((row) => row.status === status).reduce((sum, row) => sum + wholeCount(row.total), 0);
}

/** The viewer the policy resolved (T-13-46): the IdamBox User's numeric id, never a query value. */
function assertViewer(viewer: unknown): asserts viewer is UnreadNotesViewer {
  if (!isRecord(viewer) || typeof viewer.id !== "number" || !Number.isSafeInteger(viewer.id) || viewer.id < 1
    || typeof viewer.humanAnalyst !== "boolean") {
    throw new DashboardSummaryError("CSRM dashboard viewer is invalid.");
  }
}

/**
 * Every figure of the analyst dashboard summary on `today`, a YYYY-MM-DD UTC
 * date that fixes each treatment due state and each alert window, with the
 * review queue's own counts for `viewer` (D-15).
 */
export async function computeDashboardSummary(
  strapi: unknown,
  today: string,
  viewer: UnreadNotesViewer,
): Promise<DashboardSummaryFigures> {
  if (!isUtcDate(today)) throw new DashboardSummaryError("CSRM dashboard date is invalid.");
  assertViewer(viewer);
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

  // The viewer's own counts and the pick-up pool use the queue's own assignee and notes filters (13-12).
  const mine = { assignee: "me" as const, viewer };
  const [
    requiresAttention,
    awaitingRequestor,
    generationInProgress,
    mineRequiresAttention,
    mineAwaitingRequestor,
    mineGenerationInProgress,
    mineWithUnreadNotes,
    unassigned,
    readyForReview,
    assessmentRows,
    releasedRows,
    releasedAcceptedRows,
    underAssessmentRows,
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
    countReviewQueueBucket(strapi, "requires-attention", activeIds, mine),
    countReviewQueueBucket(strapi, "awaiting-requestor", activeIds, mine),
    countReviewQueueBucket(strapi, "generation-in-progress", activeIds, mine),
    countReviewQueueBucket(strapi, "open", activeIds, { ...mine, notesUnread: true }),
    countReviewQueueBucket(strapi, "requires-attention", activeIds, { assignee: "unassigned", viewer }),
    // The questionnaire review list's `status=submitted`: every answer submitted (D-30).
    readRow(whereQuestionnaireHasSubmittedAnswer(connection.queryBuilder().from("csrm_questionnaires as q"), "q.id")
      .countDistinct({ total: "q.id" })),
    readRows(connection.queryBuilder().from("csrm_assessments as a")
      .whereIn("a.assessment_status", ["draft", "in-review"])
      .select("a.assessment_status as status")
      .countDistinct({ total: "a.id" })
      .groupBy("a.assessment_status")),
    readRows(residualRatingRows(openReleasedRisks(connection))),
    // D-41: the register's treatmentAction=Accept on the released branch; the value is a bound constant.
    readRows(residualRatingRows(openReleasedRisks(connection).where("r.treatment_action", "Accept"))),
    readRows(residualRatingRows(openUnderAssessmentRisks(connection))),
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
      mine: {
        requiresAttention: wholeCount(mineRequiresAttention),
        awaitingRequestor: wholeCount(mineAwaitingRequestor),
        generationInProgress: wholeCount(mineGenerationInProgress),
        withUnreadNotes: wholeCount(mineWithUnreadNotes),
      },
      unassigned: wholeCount(unassigned),
    },
    riskExposure: {
      released: exposureCounts(releasedRows),
      releasedAccepted: exposureCounts(releasedAcceptedRows),
      underAssessment: exposureCounts(underAssessmentRows),
    },
    highCriticalRisks: {
      rows: rows.slice(0, DASHBOARD_WIDGET_ROW_LIMIT),
      total: wholeCount(riskTotal.total),
      truncated: rows.length > DASHBOARD_WIDGET_ROW_LIMIT,
    },
    treatmentsDue: { overdue: wholeCount(overdue), dueSoon: wholeCount(dueSoon), total: wholeCount(treatmentsTotal) },
    recentActivity: mergeRecentActivity(activityCandidates, RECENT_ACTIVITY_LIMIT),
  };
}
