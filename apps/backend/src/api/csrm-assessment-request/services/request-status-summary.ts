import type { Database } from "@strapi/database";

import type { RequestStatus } from "./collection-scope";
import { applyRequestHolder, MY_REQUEST_HOLDERS, ownedRequests } from "./my-requests";
import type { RequestHolder } from "./request-lifecycle";
import { hasUnreadNotes } from "./review-queue-repository";

/*
 * The signed-in actor's own assessment requests counted by status (D-05, D-28).
 *
 * The count is one database group-by (D-03). Ownership is decided by the
 * requestor link alone, joined on the numeric user id the authorization policy
 * resolved for the caller, so no caller-supplied value reaches the query and a
 * second Requestor's records can never be counted.
 */

type Knex = Database["connection"];

/** The caller's own requests counted by who holds them (D-02 item 6, D-11); the three counts sum to the total. */
export type MyRequestHolderCounts = Record<RequestHolder, number>;

/** One count per datamodel request status, under the key the contract publishes, plus their sum and the holder counts. */
export type MyRequestStatusSummary = {
  draft: number;
  submitted: number;
  questionnaireInProgress: number;
  riskAssessmentDrafted: number;
  underReview: number;
  approved: number;
  closed: number;
  total: number;
  byHolder: MyRequestHolderCounts;
  /** The caller's own requests with at least one note new to them as the Requestor (D-24): my requests with notes=unread. */
  withUnreadNotes: number;
};

/** The status counts alone, before the holder and notes counts are added. */
export type MyRequestStatusCounts = Omit<MyRequestStatusSummary, "byHolder" | "withUnreadNotes">;

type StatusCountKey = Exclude<keyof MyRequestStatusCounts, "total">;

/** One grouped row: a stored request status and how many of the caller's requests hold it. */
export type RequestStatusCountRow = { status: unknown; total: unknown };

/* Every datamodel request status has exactly one published key; `satisfies` keeps the map total. */
const COUNT_KEY_BY_STATUS = {
  draft: "draft",
  submitted: "submitted",
  "questionnaire-in-progress": "questionnaireInProgress",
  "risk-assessment-drafted": "riskAssessmentDrafted",
  "under-review": "underReview",
  approved: "approved",
  closed: "closed",
} as const satisfies Record<RequestStatus, StatusCountKey>;

/* A Map, not an object lookup, so a stored value such as "constructor" can never match a key. */
const COUNT_KEYS: ReadonlyMap<string, StatusCountKey> = new Map(Object.entries(COUNT_KEY_BY_STATUS));

/** The union row that carries the notes count; no request status can take this value. */
const UNREAD_NOTES_ROW = "notes:unread";

/**
 * All counts in one statement: UNION branches share the database's statement
 * snapshot, including PostgreSQL READ COMMITTED. Reuse the list's exact holder
 * and notes predicates rather than copying lifecycle SQL into conditional
 * aggregates, so each count equals the my requests total it opens.
 */
export async function readOwnedRequestStatusSummary(connection: Knex, requestorId: number): Promise<MyRequestStatusSummary> {
  const statusCounts = ownedRequests(connection, requestorId)
    .select("r.request_status as status").countDistinct({ total: "r.id" }).groupBy("r.request_status");
  const holderCounts = MY_REQUEST_HOLDERS.map((holder) => applyRequestHolder(ownedRequests(connection, requestorId), holder)
    .select(connection.raw("? as status", [`holder:${holder}`])).countDistinct({ total: "r.id" }));
  // D-24: the owner reads their own requests as their Requestor, so notes are counted from the Requestor's side.
  const unreadCount = ownedRequests(connection, requestorId)
    .whereExists(hasUnreadNotes({ id: requestorId, humanAnalyst: false }))
    .select(connection.raw("? as status", [UNREAD_NOTES_ROW])).countDistinct({ total: "r.id" });
  const rows = await connection.queryBuilder().unionAll([statusCounts, ...holderCounts, unreadCount]) as RequestStatusCountRow[];
  const byHolder: MyRequestHolderCounts = { requestor: 0, analyst: 0, none: 0 };
  for (const holder of MY_REQUEST_HOLDERS) {
    byHolder[holder] = wholeCount(rows.find((row) => row.status === `holder:${holder}`)?.total ?? 0);
  }
  const withUnreadNotes = wholeCount(rows.find((row) => row.status === UNREAD_NOTES_ROW)?.total ?? 0);
  return { ...projectMyRequestStatusSummary(rows), byHolder, withUnreadNotes };
}

export class RequestStatusSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestStatusSummaryError";
  }
}

/** PostgreSQL returns COUNT as a string, so each count is read through Number() and must be a whole count. */
function wholeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value
    : typeof value === "bigint" ? Number(value)
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new RangeError("A request status count must be a whole count.");
  return parsed;
}

/**
 * Counts the requests whose requestor link names `requestorId`, grouped by
 * status. The id is the caller's own, resolved by the policy, never a query value.
 */
export async function countOwnedRequestsByStatus(connection: Knex, requestorId: number): Promise<RequestStatusCountRow[]> {
  if (!Number.isSafeInteger(requestorId) || requestorId < 1) {
    throw new RequestStatusSummaryError("CSRM assessment request owner is invalid.");
  }
  const rows = await connection.queryBuilder()
    .from("csrm_assessment_requests as r")
    .join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
    .where("o.idambox_user_id", requestorId)
    .select("r.request_status as status")
    .countDistinct({ total: "r.id" })
    .groupBy("r.request_status") as Array<Record<string, unknown>>;
  return rows.map((row) => ({ status: row.status, total: row.total }));
}

/**
 * Counts the owner's requests by holder with the same D-20 predicate the my
 * requests holder filter applies (applyRequestHolder), one counted query per
 * holder, so the counts always equal that list's totals. The id is the caller's
 * own, resolved by the policy, never a query value.
 */
export async function countOwnedRequestsByHolder(connection: Knex, requestorId: number): Promise<MyRequestHolderCounts> {
  if (!Number.isSafeInteger(requestorId) || requestorId < 1) {
    throw new RequestStatusSummaryError("CSRM assessment request owner is invalid.");
  }
  const counts = await Promise.all(MY_REQUEST_HOLDERS.map(async (holder) => {
    const row = await applyRequestHolder(ownedRequests(connection, requestorId), holder)
      .countDistinct({ total: "r.id" })
      .first() as Record<string, unknown> | undefined;
    return [holder, wholeCount(row?.total ?? 0)] as const;
  }));
  return Object.fromEntries(counts) as MyRequestHolderCounts;
}

/**
 * Folds grouped rows into the closed status counts. A status outside the
 * datamodel vocabulary is ignored, so `total` is always the sum of the seven counts.
 */
export function projectMyRequestStatusSummary(rows: readonly RequestStatusCountRow[]): MyRequestStatusCounts {
  const counts: Record<StatusCountKey, number> = {
    draft: 0,
    submitted: 0,
    questionnaireInProgress: 0,
    riskAssessmentDrafted: 0,
    underReview: 0,
    approved: 0,
    closed: 0,
  };
  for (const row of rows) {
    const key = typeof row.status === "string" ? COUNT_KEYS.get(row.status) : undefined;
    if (key === undefined) continue;
    counts[key] += wholeCount(row.total);
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { ...counts, total };
}
