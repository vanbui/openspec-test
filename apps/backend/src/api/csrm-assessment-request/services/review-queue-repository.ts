import type { Database } from "@strapi/database";

import {
  reviewQueueStatuses,
  type AnalystReviewRead,
  type ReviewAssigneeFilter,
  type ReviewQueueBucket,
  type ReviewQueueSort,
  type ReviewQueueSortField,
} from "./collection-scope";
import { assertActiveGenerationCapacity } from "../../csrm-questionnaire/services/questionnaire-generation-workflow";
import { PERSON_FIELDS } from "./request-people";

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
const REVIEW_QUEUE_ITEM_FIELDS = Object.freeze([
  "documentId",
  "requestNumber",
  "title",
  "requestStatus",
  "submittedDate",
  "assessmentType",
  "businessCriticality",
  "dueDate",
] as const);

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
export type ReviewQueueCriteria = Pick<
  AnalystReviewRead,
  "bucket" | "statuses" | "q" | "title" | "requestNumber" | "dueDate" | "assignee" | "notesUnread" | "viewerId" | "humanAnalyst"
>;

export type ReviewQueueRepository = {
  count: (criteria: ReviewQueueCriteria, activeIds: readonly string[]) => Promise<number>;
  selectPage: (read: AnalystReviewRead, activeIds: readonly string[]) => Promise<string[]>;
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
  /** The viewer's unread note count per request of one page, in one grouped read (D-24; T-13-43). */
  countUnreadNotes: (documentIds: readonly string[], viewer: UnreadNotesViewer) => Promise<Map<string, number>>;
};

/**
 * Who unread notes are counted for (D-24): the policy's numeric IdamBox User id and whether the caller holds the read
 * through the human Security Analyst role. Both are facts of the resolved user, never of the query (T-13-40).
 */
export type UnreadNotesViewer = { id: number; humanAnalyst: boolean };

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

/*
 * The three lifecycle facts below are exported so the owner's My requests
 * holder predicate (services/my-requests.ts, D-20) composes the same
 * definitions rather than restating them. Each correlates on the outer request
 * row aliased `r`.
 */
export function questionnaireReleased(query: QueryBuilder): void {
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
export function questionnaireSubmitted(query: QueryBuilder): void {
  whereQuestionnaireHasSubmittedAnswer(fromQuestionnaireLink(query), "ql.csrm_questionnaire_id");
}

export function assessmentExists(query: QueryBuilder): void {
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
 * D-24's unread rule over the note row `n` of the request row `r`, as request-notes-policy.ts states it and
 * summarizeRequestNotes counts it: written in the other part, not by the viewer, and above the viewer's
 * lastReadSequence (0 without a read state; the first read state by id, as readStateOf takes it). The viewer's part is
 * the requestor's when the request's requestor link names them, else the Security Analysts' (G-1). A viewer who is not
 * a human Security Analyst counts notes only on a request they raised (canUseRequestNotes). Constant identifiers; the
 * viewer's id is bound.
 */
const VIEWER_PART_SQL = "CASE WHEN EXISTS (SELECT 1 FROM csrm_assessment_requests_requestor_lnk AS vp"
  + " WHERE vp.csrm_assessment_request_id = r.id AND vp.idambox_user_id = ?) THEN 'requestor' ELSE 'security-analyst' END";
const LAST_READ_SEQUENCE_SQL = "COALESCE((SELECT rs.last_read_sequence FROM csrm_request_note_read_states AS rs"
  + " JOIN csrm_request_note_read_states_reader_lnk AS rr ON rr.csrm_request_note_read_state_id = rs.id"
  + " JOIN csrm_request_note_read_states_assessment_request_lnk AS rl ON rl.csrm_request_note_read_state_id = rs.id"
  + " WHERE rr.idambox_user_id = ? AND rl.csrm_assessment_request_id = r.id ORDER BY rs.id ASC LIMIT 1), 0)";

function requestedByViewer(viewerId: number) {
  return (query: QueryBuilder) => {
    query.from("csrm_assessment_requests_requestor_lnk as rq")
      .whereRaw("rq.csrm_assessment_request_id = r.id")
      .where("rq.idambox_user_id", viewerId)
      .select("rq.id");
  };
}

/*
 * "Not by the viewer" is "no author link names the viewer": a note whose author link is gone is not the viewer's, so it
 * is unread like its own row's flag says (WR-103), never dropped for want of a link row.
 */
function whereNoteUnreadFor(query: QueryBuilder, viewer: UnreadNotesViewer): QueryBuilder {
  query.whereRaw(`n.author_part <> ${VIEWER_PART_SQL}`, [viewer.id])
    .whereNotExists((author) => {
      author.from("csrm_request_notes_author_lnk as na")
        .whereRaw("na.csrm_request_note_id = n.id")
        .where("na.idambox_user_id", viewer.id)
        .select("na.id");
    })
    .whereRaw(`n.sequence > ${LAST_READ_SEQUENCE_SQL}`, [viewer.id]);
  if (!viewer.humanAnalyst) query.whereExists(requestedByViewer(viewer.id));
  return query;
}

/** The notes of the request row `r`, joined as `n`. */
function fromRequestNotes(query: QueryBuilder): QueryBuilder {
  return query.join("csrm_request_notes_assessment_request_lnk as nl", "nl.csrm_assessment_request_id", "r.id")
    .join("csrm_request_notes as n", "n.id", "nl.csrm_request_note_id");
}

function assertUnreadViewer(viewer: UnreadNotesViewer): void {
  if (!Number.isSafeInteger(viewer.id) || viewer.id < 1) throw new ReviewQueueRepositoryError("CSRM review queue viewer is invalid.");
}

/**
 * The EXISTS body "some note of the request row `r` is unread for `viewer`" (D-24): the same unread body the page's
 * grouped count (countUnreadNotesByRequest) uses, so a list's notes=unread filter, its flags and its counts never
 * disagree. The review queue and the owner's My requests and status summary compose it (13-12, 13-15).
 */
export function hasUnreadNotes(viewer: UnreadNotesViewer): (query: QueryBuilder) => void {
  assertUnreadViewer(viewer);
  return (notes) => {
    whereNoteUnreadFor(
      notes.from("csrm_request_notes_assessment_request_lnk as nl")
        .join("csrm_request_notes as n", "n.id", "nl.csrm_request_note_id")
        .whereRaw("nl.csrm_assessment_request_id = r.id")
        .select("n.id"),
      viewer,
    );
  };
}

/**
 * The viewer's unread notes on each of `documentIds`, keyed by request documentId, in one grouped read (D-24; T-13-43):
 * never one query per row. A request without unread notes is absent from the map.
 */
export async function countUnreadNotesByRequest(
  connection: Knex,
  documentIds: readonly string[],
  viewer: UnreadNotesViewer,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (documentIds.length === 0) return counts;
  if (documentIds.length > MAX_REVIEW_QUEUE_HYDRATION) throw new ReviewQueueRepositoryError("CSRM review queue page is too large.");
  assertUnreadViewer(viewer);
  const query = fromRequestNotes(connection.queryBuilder().from("csrm_assessment_requests as r"))
    .whereIn("r.document_id", [...documentIds]);
  const rows = await whereNoteUnreadFor(query, viewer)
    .groupBy("r.document_id")
    .select("r.document_id")
    .countDistinct({ unread: "n.id" }) as RecordValue[];
  for (const row of rows) {
    // PostgreSQL returns COUNT as a string.
    const unread = Number(row.unread ?? 0);
    if (typeof row.document_id === "string" && Number.isSafeInteger(unread) && unread > 0) counts.set(row.document_id, unread);
  }
  return counts;
}

/*
 * The lifecycle part of each queue, following highestMatchingStep over the
 * reviewable statuses, where neither a draft nor a closed request can occur.
 */
function applyBucket(query: QueryBuilder, bucket: ReviewQueueBucket, activeIds: readonly string[]): void {
  switch (bucket) {
    case "released":
    case "open":
    case "all":
      // The status bound alone: open, released and All requests add no lifecycle predicate (D-30, D-13).
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
export function literalContains(term: string): string {
  return `%${term.replace(/[!%_]/g, "!$&")}%`;
}

function applyCriteria(query: QueryBuilder, criteria: ReviewQueueCriteria, activeIds: readonly string[]): QueryBuilder {
  query.whereIn("r.request_status", [...criteria.statuses]);
  // Lower-casing both sides in the database matches Strapi's $containsi.
  if (criteria.q !== undefined) {
    // D-30: one term finds a request by its number or its title, bound twice as a literal pattern.
    const pattern = literalContains(criteria.q);
    query.whereRaw("(LOWER(r.request_number) LIKE LOWER(?) ESCAPE '!' OR LOWER(r.title) LIKE LOWER(?) ESCAPE '!')", [pattern, pattern]);
  }
  if (criteria.title !== undefined) {
    query.whereRaw("LOWER(r.title) LIKE LOWER(?) ESCAPE '!'", [literalContains(criteria.title)]);
  }
  if (criteria.requestNumber !== undefined) {
    query.whereRaw("LOWER(r.request_number) LIKE LOWER(?) ESCAPE '!'", [literalContains(criteria.requestNumber)]);
  }
  if (criteria.dueDate !== undefined) query.where("r.due_date", criteria.dueDate);
  applyBucket(query, criteria.bucket, activeIds);
  applyViewerFilters(query, criteria);
  return query;
}

/** The request row `r`'s assigned-analyst link (D-01): Strapi keeps the manyToOne in a link table. */
function fromAssignedAnalystLink(query: QueryBuilder): QueryBuilder {
  return query.from("csrm_assessment_requests_assigned_analyst_lnk as aa")
    .whereRaw("aa.csrm_assessment_request_id = r.id")
    .select("aa.id");
}

/*
 * D-13, D-24: the assignee and notes filters, for the policy's viewer (T-13-40). assignee=me holds when the link names
 * the viewer, unassigned when there is no link; notes=unread holds when some note of the request is unread for the
 * viewer, the same body the page's grouped count uses. Constant identifiers and bound values only (T-13-41).
 */
function applyViewerFilters(query: QueryBuilder, criteria: ReviewQueueCriteria): void {
  if (criteria.assignee === undefined && !criteria.notesUnread) return;
  const viewerId = criteria.viewerId;
  if (viewerId === undefined) throw new ReviewQueueRepositoryError("CSRM review queue filter has no viewer.");
  if (criteria.assignee === "me") {
    query.whereExists((assigned) => {
      fromAssignedAnalystLink(assigned).where("aa.idambox_user_id", viewerId);
    });
  } else if (criteria.assignee === "unassigned") {
    query.whereNotExists(fromAssignedAnalystLink);
  }
  if (criteria.notesUnread) {
    query.whereExists(hasUnreadNotes({ id: viewerId, humanAnalyst: criteria.humanAnalyst === true }));
  }
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
        /*
         * People are read as a documentId and a display name alone: no email, username, roles or other identifier
         * (T-11-19, T-13-42). The requestor's documentId decides only whether the viewer raised the request (D-07).
         */
        populate: { requestor: { fields: [...PERSON_FIELDS] }, assignedAnalyst: { fields: [...PERSON_FIELDS] } },
        limit: documentIds.length,
      });
      const byId = new Map(found.map((document) => [document.documentId, document]));
      // Restore the page order. A request removed between the two reads is not shown.
      return documentIds.flatMap((documentId) => {
        const document = byId.get(documentId);
        return document ? [document] : [];
      });
    },
    countUnreadNotes(documentIds, viewer) {
      return countUnreadNotesByRequest(connection, documentIds, viewer);
    },
  };
}

/**
 * The whole of one queue, counted with the same definition as its pages. The
 * analyst dashboard uses this for its bucket counts; Phase 13's counts (D-14,
 * D-15) add the assignee and notes filters for the policy's viewer.
 */
export async function countReviewQueueBucket(
  strapi: unknown,
  bucket: ReviewQueueBucket,
  activeIds: readonly string[],
  filters?: { assignee?: ReviewAssigneeFilter; notesUnread?: true; viewer: UnreadNotesViewer },
): Promise<number> {
  return createReviewQueueRepository(strapi).count({
    bucket,
    statuses: reviewQueueStatuses(bucket),
    ...(filters?.assignee !== undefined ? { assignee: filters.assignee } : {}),
    ...(filters?.notesUnread ? { notesUnread: true as const } : {}),
    ...(filters ? { viewerId: filters.viewer.id, humanAnalyst: filters.viewer.humanAnalyst } : {}),
  }, activeIds);
}
