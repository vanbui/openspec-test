import type { Database } from "@strapi/database";

import {
  reviewQueueStatuses,
  type AnalystReviewRead,
  type ReviewQueueBucket,
  type ReviewQueueSort,
  type ReviewQueueSortField,
} from "./collection-scope";
import { assertActiveGenerationCapacity } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";

/*
 * The analyst review queues as database predicates (D-21). Each queue is the
 * request-status bound ANDed with the lifecycle facts of the semantic rule
 * (selectReviewQueueBucket in collection-scope.ts), each fact an EXISTS over
 * the relation's link table correlated on the outer request row `r`. The page,
 * its total and the dashboard's bucket counts all come from this one
 * definition, so they are exact at any volume.
 *
 * Active questionnaire generation is not a stored fact. Callers pass the
 * registry's bounded snapshot, activeQuestionnaireGenerationRequestIds(strapi),
 * and it becomes an IN / NOT IN over bound document ids.
 *
 * Every column comes from a constant or a closed map, and every value is a
 * bound parameter.
 */

type Knex = Database["connection"];
type QueryBuilder = ReturnType<Knex["queryBuilder"]>;
type RecordValue = Record<string, unknown>;
type Documents = { findMany: (query: RecordValue) => Promise<RecordValue[]> };

const UID = "api::csrm-assessment-request.csrm-assessment-request";

/** A page holds at most this many requests, so hydration never reads more. */
export const MAX_REVIEW_QUEUE_HYDRATION = 100;

/** The fields the queue item projects, and so the only ones hydrated. */
const REVIEW_QUEUE_ITEM_FIELDS = Object.freeze(["documentId", "requestNumber", "title", "requestStatus", "submittedDate"] as const);

/** A parsed sort field names a column only through this closed map. */
const SORT_COLUMNS: Readonly<Record<ReviewQueueSortField, string>> = Object.freeze({
  dueDate: "r.due_date",
  submittedDate: "r.submitted_date",
  requestNumber: "r.request_number",
  title: "r.title",
  requestStatus: "r.request_status",
  updatedAt: "r.updated_at",
});

/** What selects a queue's members: the parsed read without its order and page. */
export type ReviewQueueCriteria = Pick<AnalystReviewRead, "bucket" | "statuses" | "title" | "requestNumber" | "dueDate">;

export type ReviewQueueRepository = {
  count: (criteria: ReviewQueueCriteria, activeIds: readonly string[]) => Promise<number>;
  selectPage: (read: AnalystReviewRead, activeIds: readonly string[]) => Promise<string[]>;
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
};

export class ReviewQueueRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewQueueRepositoryError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The request's questionnaire link row. */
function fromQuestionnaireLink(query: QueryBuilder): QueryBuilder {
  return query.from("csrm_questionnaires_assessment_request_lnk as ql")
    .whereRaw("ql.csrm_assessment_request_id = r.id")
    .select("ql.id");
}

function questionnaireReleased(query: QueryBuilder): void {
  fromQuestionnaireLink(query)
    .join("csrm_questionnaires as q", "q.id", "ql.csrm_questionnaire_id")
    .whereNotNull("q.released_at");
}

/*
 * In the application a questionnaire is submitted when every active question
 * holds a submitted answer. Submission is all or nothing (one submit stamps
 * every visible answer, a submitted batch is immutable, and a revert or a
 * return to review returns every answer to draft), so "some answer is
 * submitted" is the same fact. The only divergence is a malformed question
 * definition, which the application reads as not started; that divergence is
 * accepted and recorded (D-30).
 */
function questionnaireSubmitted(query: QueryBuilder): void {
  whereQuestionnaireHasSubmittedAnswer(fromQuestionnaireLink(query), "ql.csrm_questionnaire_id");
}

function assessmentExists(query: QueryBuilder): void {
  query.from("csrm_assessments_assessment_request_lnk as al")
    .whereRaw("al.csrm_assessment_request_id = r.id")
    .select("al.id");
}

/** Released means the complete triple: approved, an approval date and an approver (isReleased). */
function assessmentReleased(query: QueryBuilder): void {
  query.from("csrm_assessments_assessment_request_lnk as al")
    .join("csrm_assessments as a", "a.id", "al.csrm_assessment_id")
    .whereRaw("al.csrm_assessment_request_id = r.id")
    .where("a.assessment_status", "approved")
    .whereNotNull("a.approval_date")
    .whereExists((approver) => {
      approver.from("csrm_assessments_approved_by_lnk as ab")
        .whereRaw("ab.csrm_assessment_id = a.id")
        .select("ab.id");
    })
    .select("al.id");
}

/**
 * Adds EXISTS (a question of the questionnaire identified by
 * `questionnaireIdColumn` holds a submitted answer). The column is a
 * server-chosen identifier, bound as one, never caller input.
 */
export function whereQuestionnaireHasSubmittedAnswer(query: QueryBuilder, questionnaireIdColumn: string): QueryBuilder {
  return query.whereExists((answers) => {
    answers.from("csrm_questions_questionnaire_lnk as qql")
      .join("csrm_questions as qu", "qu.id", "qql.csrm_question_id")
      .whereRaw("?? = ??", ["qql.csrm_questionnaire_id", questionnaireIdColumn])
      .whereJsonPath("qu.answer", "$.state", "=", "submitted")
      .select("qql.id");
  });
}

/*
 * The lifecycle part of each queue, following highestMatchingStep over the
 * reviewable statuses, where neither a draft nor a closed request can occur.
 */
function applyBucket(query: QueryBuilder, bucket: ReviewQueueBucket, activeIds: readonly string[]): void {
  switch (bucket) {
    case "released":
      return;
    case "generation-in-progress":
      query.whereIn("r.document_id", [...activeIds]);
      return;
    case "awaiting-requestor":
      // With the Requestor: released, not yet submitted, and no assessment.
      // An active generation job does not remove a request from this queue.
      query.whereExists(questionnaireReleased)
        .whereNotExists(questionnaireSubmitted)
        .whereNotExists(assessmentExists);
      return;
    case "requires-attention":
      // With the analyst: not generating, not released, and either nothing is
      // released to the Requestor yet or the Requestor's part is done.
      if (activeIds.length > 0) query.whereNotIn("r.document_id", [...activeIds]);
      query.whereNotExists(assessmentReleased)
        .where((withAnalyst) => {
          withAnalyst.whereNotExists(questionnaireReleased)
            .orWhereExists(questionnaireSubmitted)
            .orWhereExists(assessmentExists);
        });
      return;
    default: {
      const unknownBucket: never = bucket;
      throw new ReviewQueueRepositoryError(`Unknown review queue ${String(unknownBucket)}.`);
    }
  }
}

/** A contains pattern that matches the term literally: `!`, `%` and `_` are escaped with `!`. */
function literalContains(term: string): string {
  return `%${term.replace(/[!%_]/g, "!$&")}%`;
}

function applyCriteria(query: QueryBuilder, criteria: ReviewQueueCriteria, activeIds: readonly string[]): QueryBuilder {
  query.whereIn("r.request_status", [...criteria.statuses]);
  // Lower-casing both sides in the database matches Strapi's $containsi.
  if (criteria.title !== undefined) {
    query.whereRaw("LOWER(r.title) LIKE LOWER(?) ESCAPE '!'", [literalContains(criteria.title)]);
  }
  if (criteria.requestNumber !== undefined) {
    query.whereRaw("LOWER(r.request_number) LIKE LOWER(?) ESCAPE '!'", [literalContains(criteria.requestNumber)]);
  }
  if (criteria.dueDate !== undefined) query.where("r.due_date", criteria.dueDate);
  applyBucket(query, criteria.bucket, activeIds);
  return query;
}

/*
 * NULL sorts as the smallest value in both directions: first ascending, last
 * descending. That is SQLite's native order and what the queue has always
 * served; the explicit CASE term keeps it on PostgreSQL, whose native order is
 * the opposite. The request id is the final tiebreak, so pages never overlap.
 */
function applyOrder(query: QueryBuilder, sort: readonly ReviewQueueSort[]): void {
  for (const { field, direction } of sort) {
    const column = SORT_COLUMNS[field];
    query.orderByRaw(`CASE WHEN ${column} IS NULL THEN 0 ELSE 1 END ${direction === "desc" ? "DESC" : "ASC"}`)
      .orderBy(column, direction);
  }
  query.orderBy("r.id", "asc");
}

/** Generation in progress with no active job selects nothing, so no query is issued. */
function selectsNothing(bucket: ReviewQueueBucket, activeIds: readonly string[]): boolean {
  return bucket === "generation-in-progress" && activeIds.length === 0;
}

export function createReviewQueueRepository(strapi: unknown): ReviewQueueRepository {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function"
    || typeof strapi.documents !== "function") {
    throw new ReviewQueueRepositoryError("CSRM review queue repository is unavailable.");
  }
  const connection = strapi.db.connection as Knex;
  const documents = (strapi.documents as (uid: string) => Documents)(UID);
  const requests = () => connection.queryBuilder().from("csrm_assessment_requests as r");
  return {
    async count(criteria, activeIds) {
      const ids = assertActiveGenerationCapacity(activeIds);
      if (selectsNothing(criteria.bucket, ids)) return 0;
      const row = await applyCriteria(requests(), criteria, ids).countDistinct({ total: "r.id" }).first() as RecordValue | undefined;
      // PostgreSQL returns COUNT as a string.
      return Number(row?.total ?? 0);
    },
    async selectPage(read, activeIds) {
      const ids = assertActiveGenerationCapacity(activeIds);
      if (selectsNothing(read.bucket, ids)) return [];
      const query = applyCriteria(requests(), read, ids).select("r.document_id");
      applyOrder(query, read.sort);
      const { page, pageSize } = read.pagination;
      const rows = await query.offset((page - 1) * pageSize).limit(pageSize) as RecordValue[];
      return rows.map((row) => row.document_id).filter((documentId): documentId is string => typeof documentId === "string");
    },
    async hydrate(documentIds) {
      if (documentIds.length === 0) return [];
      if (documentIds.length > MAX_REVIEW_QUEUE_HYDRATION) {
        throw new ReviewQueueRepositoryError("CSRM review queue page is too large.");
      }
      const found = await documents.findMany({
        filters: { documentId: { $in: [...documentIds] } },
        fields: [...REVIEW_QUEUE_ITEM_FIELDS],
        limit: documentIds.length,
      });
      const byId = new Map(found.map((document) => [document.documentId, document]));
      // Restore the page order. A request removed between the two reads is not shown.
      return documentIds.flatMap((documentId) => {
        const document = byId.get(documentId);
        return document ? [document] : [];
      });
    },
  };
}

/**
 * The whole of one queue, counted with the same definition as its pages. The
 * analyst dashboard uses this for its bucket counts.
 */
export async function countReviewQueueBucket(
  strapi: unknown,
  bucket: ReviewQueueBucket,
  activeIds: readonly string[],
): Promise<number> {
  return createReviewQueueRepository(strapi).count({ bucket, statuses: reviewQueueStatuses(bucket) }, activeIds);
}
