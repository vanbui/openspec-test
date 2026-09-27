import type { Database } from "@strapi/database";

import type { RequestStatus } from "./collection-scope";

/*
 * The signed-in actor's own assessment requests counted by status (D-05, D-28).
 *
 * The count is one database group-by (D-03). Ownership is decided by the
 * requestor link alone, joined on the numeric user id the authorization policy
 * resolved for the caller, so no caller-supplied value reaches the query and a
 * second Requestor's records can never be counted.
 */

type Knex = Database["connection"];

/** One count per datamodel request status, under the key the contract publishes, plus their sum. */
export type MyRequestStatusSummary = {
  draft: number;
  submitted: number;
  questionnaireInProgress: number;
  riskAssessmentDrafted: number;
  underReview: number;
  approved: number;
  closed: number;
  total: number;
};

type StatusCountKey = Exclude<keyof MyRequestStatusSummary, "total">;

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
 * Folds grouped rows into the closed summary. A status outside the datamodel
 * vocabulary is ignored, so `total` is always the sum of the seven counts.
 */
export function projectMyRequestStatusSummary(rows: readonly RequestStatusCountRow[]): MyRequestStatusSummary {
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
