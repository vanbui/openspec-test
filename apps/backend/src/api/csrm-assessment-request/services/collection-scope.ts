import { isReleased, validateReleaseReadiness } from "../../csrm-assessment/services/assessment-workflow";
import { questionnaireState } from "../../csrm-questionnaire/services/questionnaire-scope";
import { daysBetween, isUtcDate, normalizeDateTime, utcToday } from "../../../csrm/insights/utc-date";
import { pickUpState } from "./request-assignment-policy";
import { deriveRequestLifecycle } from "./request-lifecycle";
import { projectPerson } from "./request-people";

type CollectionScope = "own" | "all";

type TrustedIdentity = { documentId: string };
type AuthorizationState = {
  idamboxUser?: TrustedIdentity;
  csrmAuthorization?: {
    assessmentRequestCollectionScope?: CollectionScope;
    assessmentRequestRequestorId?: number;
    assessmentReviewCollectionScope?: "all";
    /* Phase 13 (T-13-09): facts of the resolved IdamBox User, set by the policy, never read from the query. */
    humanAnalyst?: boolean;
    /* WR-101: `humanAnalyst` held by an eligible person; only such a viewer is offered a pick-up. */
    eligibleHumanAnalyst?: boolean;
    viewerId?: number;
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
/** Every request in the analyst's review scope: reviewable and released work, never a draft (D-30). */
const REVIEW_SCOPE_REQUEST_STATUSES = Object.freeze([...REVIEWABLE_REQUEST_STATUSES, ...RELEASED_REQUEST_STATUSES]);

/*
 * The lifecycle queues, then All requests (D-30), their status union. The list
 * is closed: a later queue is one more value here. Phase 13 adds open (D-13):
 * every submitted request not yet released, at any step. Its "Assigned to me"
 * is the assignee filter over open, not a queue (2026-10-01 confirmation).
 */
export const REVIEW_QUEUE_BUCKETS = Object.freeze([
  "requires-attention",
  "awaiting-requestor",
  "generation-in-progress",
  "open",
  "released",
  "all",
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
 * The request statuses each queue reads. The three action queues and open read
 * only reviewable work, the Released queue only released work, and All
 * requests both. No queue reads a draft: it belongs to its Requestor until it
 * is submitted.
 */
export function reviewQueueStatuses(bucket: ReviewQueueBucket): readonly RequestStatus[] {
  if (bucket === "all") return REVIEW_SCOPE_REQUEST_STATUSES;
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

/** Who holds the request (D-13): the viewer, or nobody. Absent means anyone; no filter names another analyst. */
export const REVIEW_ASSIGNEE_FILTERS = Object.freeze(["me", "unassigned"] as const);
export type ReviewAssigneeFilter = typeof REVIEW_ASSIGNEE_FILTERS[number];
const REVIEW_ASSIGNEE_FILTER_SET = new Set<string>(REVIEW_ASSIGNEE_FILTERS);

function safeReviewAssignee(value: unknown): ReviewAssigneeFilter | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !REVIEW_ASSIGNEE_FILTER_SET.has(value)) throw new AssessmentRequestQueryError();
  return value as ReviewAssigneeFilter;
}

/** Notes new to the viewer (D-24): the one value is unread. */
function safeReviewNotes(value: unknown): true | undefined {
  if (value === undefined) return undefined;
  if (value !== "unread") throw new AssessmentRequestQueryError();
  return true;
}

type ReviewFilters = {
  bucket: ReviewQueueBucket;
  requestStatus?: RequestStatus;
  /** One term matched against the request number or the title (D-30). */
  q?: string;
  title?: string;
  requestNumber?: string;
  dueDate?: string;
  assignee?: ReviewAssigneeFilter;
  notesUnread?: true;
};

/** The closed set of review filter keys; a later filter is one more key here. */
const REVIEW_FILTER_KEYS = Object.freeze(["requestStatus", "q", "title", "requestNumber", "dueDate", "queue", "assignee", "notes"] as const);

function safeReviewFilters(value: unknown): ReviewFilters {
  if (value === undefined) return { bucket: "requires-attention" };
  if (!isRecord(value)) throw new AssessmentRequestQueryError();
  assertOnlyKeys(value, REVIEW_FILTER_KEYS);
  const bucket = safeReviewQueue(value.queue);
  const requestStatus = safeReviewStatus(value.requestStatus);
  const q = safeReviewText(value.q);
  const title = safeReviewText(value.title);
  const requestNumber = safeReviewText(value.requestNumber);
  const dueDate = safeReviewDate(value.dueDate);
  const assignee = safeReviewAssignee(value.assignee);
  const notesUnread = safeReviewNotes(value.notes);
  return { bucket, requestStatus, q, title, requestNumber, dueDate, assignee, notesUnread };
}

/*
 * The viewer the assignee and notes filters read (T-13-40): the policy's numeric id of the resolved IdamBox User and
 * whether they hold the read through the human Security Analyst role. Never a query value; without it there is nobody
 * to filter for, so the read is refused rather than widened.
 */
function filterViewer(state: unknown): { viewerId: number; humanAnalyst: boolean } {
  const facts = isRecord(state) ? (state as AuthorizationState).csrmAuthorization : undefined;
  const viewerId = facts?.viewerId;
  if (typeof viewerId !== "number" || !Number.isSafeInteger(viewerId) || viewerId < 1) throw new AssessmentRequestQueryError();
  return { viewerId, humanAnalyst: facts?.humanAnalyst === true };
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
  q?: string;
  title?: string;
  requestNumber?: string;
  dueDate?: string;
  /** Phase 13 (D-13): who holds the request, the viewer or nobody, read for `viewerId`. */
  assignee?: ReviewAssigneeFilter;
  /** Phase 13 (D-24): only requests with notes new to the viewer, by the request read's unread rule. */
  notesUnread?: true;
  /** The policy's numeric IdamBox User id, present exactly when a filter reads the viewer. */
  viewerId?: number;
  /** Whether that viewer holds the read as a human Security Analyst, present with notesUnread (canUseRequestNotes). */
  humanAnalyst?: boolean;
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
  const { bucket, requestStatus, q, title, requestNumber, dueDate, assignee, notesUnread } = safeReviewFilters(query.filters);
  const viewer = assignee !== undefined || notesUnread ? filterViewer(state) : null;
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
    ...(q !== undefined ? { q } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(requestNumber !== undefined ? { requestNumber } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    ...(notesUnread ? { notesUnread } : {}),
    ...(viewer ? { viewerId: viewer.viewerId } : {}),
    ...(viewer && notesUnread ? { humanAnalyst: viewer.humanAnalyst } : {}),
    sort,
  };
}

/** The review queue's filters as one export parsed them, for its log line and its About sheet (19-07; D-18). */
export type AnalystReviewExportFilters = Readonly<Omit<ReviewFilters, "notesUnread"> & { notes?: "unread" }>;

/**
 * The review queue's export query (19-07; D-04, D-05): the queue's own closed query, parsed by parseAnalystReviewQuery
 * with the same filter parser, without a page. `pagination` is refused, so an export is always the whole queue.
 */
export type AnalystReviewExportQuery = {
  readonly read: AnalystReviewQuery;
  readonly filters: AnalystReviewExportFilters;
  readonly sort: readonly ReviewQueueSort[];
};

export function parseAnalystReviewExportQuery(query: unknown, state: unknown): AnalystReviewExportQuery {
  if (!isRecord(query) || query.pagination !== undefined) throw new AssessmentRequestQueryError();
  const read = parseAnalystReviewQuery(query, state);
  // The same closed filter parser, read again for the log and the About sheet; the read above validated it already.
  const { notesUnread, ...filters } = safeReviewFilters(query.filters);
  const defined = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as Omit<ReviewFilters, "notesUnread">;
  return { read, filters: { ...defined, ...(notesUnread ? { notes: "unread" as const } : {}) }, sort: safeReviewSort(query.sort) };
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
  // All requests reads every lifecycle step within its status bound.
  if (bucket === "all") return true;
  // Open reads every submitted request not yet released, at any step, generating or not (D-13).
  if (bucket === "open") return (REVIEWABLE_REQUEST_STATUSES as readonly unknown[]).includes(request.requestStatus);
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

const ASSESSMENT_TYPES: ReadonlySet<unknown> = new Set(["BAU", "Project", "Other"]);
const BUSINESS_CRITICALITIES: ReadonlySet<unknown> = new Set(["Low", "Moderate", "High", "Critical"]);

/** The requestor's display name, and nothing else of the requestor (T-11-19). */
function requestorDisplayName(requestor: unknown): string | null {
  if (!isRecord(requestor) || typeof requestor.displayName !== "string") return null;
  return requestor.displayName.trim().length > 0 && requestor.displayName.length <= 255 ? requestor.displayName : null;
}

/*
 * Whole UTC days from the submission's UTC calendar date to `today` (D-29).
 * A submission stamped after the server's today (clock skew) reads 0, never a
 * negative age; a missing or unreadable submission date reads null.
 */
export function daysSinceSubmission(submittedDate: unknown, today: string): number | null {
  const submitted = normalizeDateTime(submittedDate);
  if (!submitted) return null;
  return Math.max(0, daysBetween(utcToday(submitted), today));
}

/** The queue's viewer, from the policy's facts about the resolved IdamBox User, never from the query (T-13-40). */
/*
 * `humanAnalyst` decides what the viewer's unread notes count; `eligibleHumanAnalyst` (WR-101) decides whether a pick-up
 * is offered, exactly as the assignment operation decides whether it takes one.
 */
export type ReviewQueueViewer = { documentId: string; humanAnalyst: boolean; eligibleHumanAnalyst: boolean };

/**
 * The review queue's viewer from the request state the identity middleware and the policy set: the resolved IdamBox
 * User's documentId, whether they hold the read through the human Security Analyst role, and their numeric id for the
 * unread and assignee SQL (null when the policy did not record it). A state without a resolved user is refused.
 */
export function reviewQueueViewer(state: unknown): ReviewQueueViewer & { id: number | null } {
  if (!isRecord(state)) throw new AssessmentRequestQueryError();
  const authorizationState = state as AuthorizationState;
  const documentId = authorizationState.idamboxUser?.documentId;
  if (typeof documentId !== "string" || documentId.length === 0) throw new AssessmentRequestQueryError();
  const facts = authorizationState.csrmAuthorization;
  const id = facts?.viewerId;
  return {
    documentId,
    humanAnalyst: facts?.humanAnalyst === true,
    eligibleHumanAnalyst: facts?.eligibleHumanAnalyst === true,
    id: typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null,
  };
}

function relationDocumentId(value: unknown): string | null {
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0 ? value.documentId : null;
}

/**
 * One review queue item (D-02 item 1): the request's identity and status, and
 * the facts the analyst triages by. `today` is the server's UTC calendar date,
 * passed by the caller so the projection never reads the clock.
 *
 * Phase 13 (D-13): who holds the request (a documentId and a display name, or
 * null), whether `viewer` may pick it up (pickUpState, the assignment
 * operation's own rule) and the viewer's unread notes on it, which the caller
 * counted for the whole page in one grouped read (`unreadByRequestId`).
 */
export function projectAnalystReviewRequest(
  document: StrapiQuery,
  today: string,
  viewer: ReviewQueueViewer,
  unreadByRequestId: ReadonlyMap<string, number>,
): StrapiQuery {
  const assignee = projectPerson(document.assignedAnalyst);
  const documentId = typeof document.documentId === "string" ? document.documentId : "";
  return {
    documentId: document.documentId,
    requestNumber: document.requestNumber,
    title: document.title,
    requestStatus: document.requestStatus,
    submittedDate: document.submittedDate ?? null,
    requestorName: requestorDisplayName(document.requestor),
    assessmentType: ASSESSMENT_TYPES.has(document.assessmentType) ? document.assessmentType : null,
    businessCriticality: BUSINESS_CRITICALITIES.has(document.businessCriticality) ? document.businessCriticality : null,
    dueDate: isUtcDate(document.dueDate) ? document.dueDate : null,
    daysSinceSubmission: daysSinceSubmission(document.submittedDate, today),
    assignee,
    pickUp: pickUpState({
      requestStatus: document.requestStatus,
      requestorDocumentId: relationDocumentId(document.requestor),
      assigneeDocumentId: assignee?.documentId ?? null,
    }, { documentId: viewer.documentId, humanAnalyst: viewer.eligibleHumanAnalyst }),
    unreadNotes: unreadByRequestId.get(documentId) ?? 0,
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
