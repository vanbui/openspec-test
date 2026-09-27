import { isReleased, validateReleaseReadiness } from "../../csrm-assessment/services/assessment-workflow";
import { questionnaireState } from "../../csrm-questionnaire/services/questionnaire-scope";
import { deriveRequestLifecycle } from "./request-lifecycle";

type CollectionScope = "own" | "all";

type TrustedIdentity = { documentId: string };
type AuthorizationState = {
  idamboxUser?: TrustedIdentity;
  csrmAuthorization?: {
    assessmentRequestCollectionScope?: CollectionScope;
    assessmentRequestRequestorId?: number;
    assessmentReviewCollectionScope?: "all";
  };
};

type StrapiQuery = Record<string, unknown>;

export type AssessmentRequestPagination = {
  page: number;
  pageSize: number;
};

export class AssessmentRequestQueryError extends Error {
  constructor() {
    super("CSRM assessment request query is invalid.");
    this.name = "AssessmentRequestQueryError";
  }
}

/** The complete request-status vocabulary of the CSRM datamodel. */
const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
  "approved",
  "closed",
] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];
const REQUEST_STATUS_SET = new Set<string>(REQUEST_STATUSES);

/** The request statuses of submitted work that is still with the analyst or the Requestor. */
export const REVIEWABLE_REQUEST_STATUSES = Object.freeze([
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
] as const);
/** The request statuses of released work. */
export const RELEASED_REQUEST_STATUSES = Object.freeze(["approved", "closed"] as const);

export const REVIEW_QUEUE_BUCKETS = Object.freeze([
  "requires-attention",
  "awaiting-requestor",
  "generation-in-progress",
  "released",
] as const);
export type ReviewQueueBucket = typeof REVIEW_QUEUE_BUCKETS[number];
const REVIEW_QUEUE_BUCKET_SET = new Set<string>(REVIEW_QUEUE_BUCKETS);

/** The fields a review queue may be ordered by. */
export const REVIEW_QUEUE_SORT_FIELDS = Object.freeze([
  "dueDate",
  "submittedDate",
  "requestNumber",
  "title",
  "requestStatus",
  "updatedAt",
] as const);
export type ReviewQueueSortField = typeof REVIEW_QUEUE_SORT_FIELDS[number];
export type ReviewQueueSort = { field: ReviewQueueSortField; direction: "asc" | "desc" };
const REVIEW_QUEUE_SORT_FIELD_SET = new Set<string>(REVIEW_QUEUE_SORT_FIELDS);

/*
 * The request statuses each queue reads. The three action queues read only
 * reviewable work and the Released queue only released work. No queue reads a
 * draft: it belongs to its Requestor until it is submitted.
 */
export function reviewQueueStatuses(bucket: ReviewQueueBucket): readonly RequestStatus[] {
  return bucket === "released" ? RELEASED_REQUEST_STATUSES : REVIEWABLE_REQUEST_STATUSES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectionScopeFrom(state: unknown): {
  scope: CollectionScope;
  requestorId: number;
} | null {
  if (!isRecord(state)) return null;

  const authorizationState = state as AuthorizationState;
  const scope = authorizationState.csrmAuthorization?.assessmentRequestCollectionScope;
  const requestorId = authorizationState.csrmAuthorization?.assessmentRequestRequestorId;

  if ((scope !== "own" && scope !== "all") || (scope === "own" && !Number.isInteger(requestorId))) {
    return null;
  }

  return { scope, requestorId: requestorId ?? 0 };
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new AssessmentRequestQueryError();
  return parsed;
}

function safeSort(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  const entries = Array.isArray(value) ? value : [value];
  const allowed = new Set(["createdAt", "updatedAt", "dueDate", "submittedDate", "requestNumber", "title", "requestStatus"]);
  const parsed = entries.flatMap((entry) => {
    if (typeof entry === "string") {
      const [field, direction = "asc", extra] = entry.split(":");
      if (!field || extra !== undefined || !allowed.has(field) || (direction !== "asc" && direction !== "desc")) {
        throw new AssessmentRequestQueryError();
      }
      return [`${field}:${direction}`];
    }
    if (!isRecord(entry)) throw new AssessmentRequestQueryError();
    return Object.entries(entry).map(([field, direction]) => {
      if (!allowed.has(field) || (direction !== "asc" && direction !== "desc")) {
        throw new AssessmentRequestQueryError();
      }
      return `${field}:${direction}`;
    });
  });
  return parsed;
}

function safePopulate(value: unknown): string[] | undefined {
  if (value === undefined || isRecord(value)) return undefined;
  const entries = Array.isArray(value) ? value : [value];
  const allowed = new Set(["questionnaire", "assessment"]);
  const populate = entries.filter((entry): entry is string => typeof entry === "string" && allowed.has(entry));
  return populate.length ? populate : undefined;
}

function safeFilters(value: unknown): StrapiQuery | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new AssessmentRequestQueryError();

  const filters: StrapiQuery = {};
  for (const key of ["requestStatus", "title", "requestNumber"] as const) {
    if (value[key] !== undefined) filters[key] = value[key];
  }
  return filters;
}

function safeSearch(value: unknown): StrapiQuery | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > 200) throw new AssessmentRequestQueryError();
  return {
    $or: [
      { title: { $containsi: value } },
      { requestNumber: { $containsi: value } },
    ],
  };
}

function assertOnlyKeys(value: StrapiQuery, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) throw new AssessmentRequestQueryError();
}

function analystAuthorization(state: unknown): void {
  if (!isRecord(state)) throw new AssessmentRequestQueryError();
  const authorizationState = state as AuthorizationState;
  if (authorizationState.csrmAuthorization?.assessmentReviewCollectionScope !== "all") {
    throw new AssessmentRequestQueryError();
  }
}

/*
 * The status filter accepts the complete request-status vocabulary in every
 * queue, so the queue and status filters stay independent. It intersects with
 * the queue rather than widening it: a status the selected queue does not read
 * selects nothing (see parseAnalystReviewQuery), so the action queue can never
 * be asked for released work and no queue can be asked for a draft. Anything
 * that is not exactly one request status is still malformed: an unknown value,
 * a repeated parameter or an operator object.
 */
function safeReviewStatus(value: unknown): RequestStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !REQUEST_STATUS_SET.has(value)) throw new AssessmentRequestQueryError();
  return value as RequestStatus;
}

function safeReviewQueue(value: unknown): ReviewQueueBucket {
  if (value === undefined) return "requires-attention";
  if (typeof value !== "string" || !REVIEW_QUEUE_BUCKET_SET.has(value)) throw new AssessmentRequestQueryError();
  return value as ReviewQueueBucket;
}

function safeReviewText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > 200) throw new AssessmentRequestQueryError();
  return value;
}

function safeReviewDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AssessmentRequestQueryError();
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AssessmentRequestQueryError();
  }
  return value;
}

type ReviewFilters = {
  bucket: ReviewQueueBucket;
  requestStatus?: RequestStatus;
  title?: string;
  requestNumber?: string;
  dueDate?: string;
};

function safeReviewFilters(value: unknown): ReviewFilters {
  if (value === undefined) return { bucket: "requires-attention" };
  if (!isRecord(value)) throw new AssessmentRequestQueryError();
  assertOnlyKeys(value, ["requestStatus", "title", "requestNumber", "dueDate", "queue"]);
  const bucket = safeReviewQueue(value.queue);
  const requestStatus = safeReviewStatus(value.requestStatus);
  const title = safeReviewText(value.title);
  const requestNumber = safeReviewText(value.requestNumber);
  const dueDate = safeReviewDate(value.dueDate);
  return { bucket, requestStatus, title, requestNumber, dueDate };
}

function safeReviewSort(value: unknown): ReviewQueueSort[] {
  if (value === undefined) return [{ field: "submittedDate", direction: "asc" }, { field: "requestNumber", direction: "asc" }];
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length < 1 || entries.length > 2) throw new AssessmentRequestQueryError();
  return entries.map((entry) => {
    if (typeof entry !== "string") throw new AssessmentRequestQueryError();
    const [field, direction = "asc", extra] = entry.split(":");
    if (!field || extra !== undefined || !REVIEW_QUEUE_SORT_FIELD_SET.has(field) || (direction !== "asc" && direction !== "desc")) {
      throw new AssessmentRequestQueryError();
    }
    return { field: field as ReviewQueueSortField, direction };
  });
}

/**
 * A validated read of the selected queue. `statuses` is the queue's own status
 * set intersected with the requested status, so it is never empty and never
 * holds a status the queue does not read.
 */
export type AnalystReviewRead = {
  kind: "read";
  pagination: AssessmentRequestPagination;
  bucket: ReviewQueueBucket;
  statuses: readonly RequestStatus[];
  title?: string;
  requestNumber?: string;
  dueDate?: string;
  sort: readonly ReviewQueueSort[];
};

/** A request status the selected queue does not read: nothing can match, so there is nothing to query. */
export type AnalystReviewOutsideQueue = {
  kind: "outside-queue";
  pagination: AssessmentRequestPagination;
  bucket: ReviewQueueBucket;
};

export type AnalystReviewQuery = AnalystReviewRead | AnalystReviewOutsideQueue;

export function parseAnalystReviewQuery(query: unknown, state: unknown): AnalystReviewQuery {
  if (!isRecord(query)) throw new AssessmentRequestQueryError();
  analystAuthorization(state);
  assertOnlyKeys(query, ["pagination", "filters", "sort"]);
  const paginationInput = query.pagination;
  if (paginationInput !== undefined && !isRecord(paginationInput)) throw new AssessmentRequestQueryError();
  if (paginationInput) assertOnlyKeys(paginationInput, ["page", "pageSize"]);
  const page = positiveInteger(paginationInput?.page, 1, 1_000_000);
  const pageSize = positiveInteger(paginationInput?.pageSize, 25, 100);
  const { bucket, requestStatus, title, requestNumber, dueDate } = safeReviewFilters(query.filters);
  const sort = safeReviewSort(query.sort);
  const pagination = { page, pageSize };
  const queue = reviewQueueStatuses(bucket);
  // Every part of the query has been validated first, so a malformed request is
  // still refused even when its status alone would select nothing.
  if (requestStatus !== undefined && !queue.includes(requestStatus)) {
    return { kind: "outside-queue", pagination, bucket };
  }
  return {
    kind: "read",
    pagination,
    bucket,
    statuses: requestStatus !== undefined ? [requestStatus] : [...queue],
    ...(title !== undefined ? { title } : {}),
    ...(requestNumber !== undefined ? { requestNumber } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    sort,
  };
}

/*
 * The semantic bucket rule, over a fully populated request document. It is the
 * oracle the D-30 equivalence test checks the database bucket predicates
 * against, one fixture per lifecycle step, so the rule and the SQL cannot
 * drift apart unnoticed.
 */
export function selectReviewQueueBucket(
  bucket: ReviewQueueBucket,
  request: StrapiQuery,
  hasActiveJob: (requestId: string) => boolean,
): boolean {
  const requestId = typeof request.documentId === "string" ? request.documentId : "";
  const active = requestId.length > 0 && hasActiveJob(requestId);
  if (bucket === "generation-in-progress") return active;
  if (bucket === "released") return request.requestStatus === "approved" || request.requestStatus === "closed";
  const lifecycle = deriveRequestLifecycle({
    requestStatus: request.requestStatus,
    questionnaireExists: isRecord(request.questionnaire),
    questionnaireReleased: isRecord(request.questionnaire) && typeof request.questionnaire.releasedAt === "string",
    questionnaireSubmitted: isRecord(request.questionnaire) && questionnaireState(request.questionnaire) === "submitted",
    assessmentExists: isRecord(request.assessment),
    assessmentReviewedAndReady: isRecord(request.assessment)
      && request.assessment.assessmentStatus === "in-review"
      && validateReleaseReadiness(request.assessment).ready,
    assessmentReleased: isRecord(request.assessment) && isReleased(request.assessment),
  });
  if (bucket === "awaiting-requestor") return lifecycle.currentKey === "draft" || lifecycle.currentKey === "questionnaire-released";
  return !active && ["submitted", "questionnaire-generated", "questionnaire-submitted", "assessment-drafted", "assessment-reviewed"].includes(lifecycle.currentKey);
}

export function projectAnalystReviewRequest(document: StrapiQuery): StrapiQuery {
  return {
    documentId: document.documentId,
    requestNumber: document.requestNumber,
    title: document.title,
    requestStatus: document.requestStatus,
    submittedDate: document.submittedDate ?? null,
  };
}

export function applyAssessmentRequestCollectionScope(query: StrapiQuery, state: unknown): StrapiQuery {
  const decision = collectionScopeFrom(state);
  if (!decision || !isRecord(query)) throw new AssessmentRequestQueryError();
  if (decision.scope === "all") return query;

  const existingFilters = query.filters;
  if (existingFilters !== undefined && !isRecord(existingFilters)) throw new AssessmentRequestQueryError();

  return {
    ...query,
    filters: {
      ...(existingFilters ?? {}),
      requestor: { id: { $eq: decision.requestorId } },
    },
  };
}

export function buildAssessmentRequestCollectionQuery(
  query: unknown,
  state: unknown,
): { dataQuery: StrapiQuery; countQuery: StrapiQuery; pagination: AssessmentRequestPagination } {
  if (!isRecord(query)) throw new AssessmentRequestQueryError();
  const paginationInput = query.pagination;
  if (paginationInput !== undefined && !isRecord(paginationInput)) throw new AssessmentRequestQueryError();

  const page = positiveInteger(paginationInput?.page, 1, 1_000_000);
  const pageSize = positiveInteger(paginationInput?.pageSize, 25, 100);
  const filters = {
    ...(safeFilters(query.filters) ?? {}),
    ...(safeSearch(query._q) ?? {}),
  };
  const scoped = applyAssessmentRequestCollectionScope({ filters }, state);
  const sort = safeSort(query.sort);
  const populate = safePopulate(query.populate);
  const countQuery = { filters: scoped.filters };
  const dataQuery: StrapiQuery = {
    ...countQuery,
    start: (page - 1) * pageSize,
    limit: pageSize,
    ...(sort ? { sort } : {}),
    ...(populate ? { populate } : {}),
  };

  return { dataQuery, countQuery, pagination: { page, pageSize } };
}
