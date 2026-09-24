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

const REVIEWABLE_STATUSES = [
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
] as const;
const RELEASED_STATUSES = ["approved", "closed"] as const;
const REVIEWABLE_STATUS_SET = new Set<string>(REVIEWABLE_STATUSES);
const RELEASED_STATUS_SET = new Set<string>(RELEASED_STATUSES);

export const REVIEW_QUEUE_BUCKETS = Object.freeze([
  "requires-attention",
  "awaiting-requestor",
  "generation-in-progress",
  "released",
] as const);
export type ReviewQueueBucket = typeof REVIEW_QUEUE_BUCKETS[number];
const REVIEW_QUEUE_BUCKET_SET = new Set<string>(REVIEW_QUEUE_BUCKETS);

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
 * A status filter may only name a status the selected queue actually contains.
 * Widening one shared set instead would let the action queue be asked for
 * released work, which is the query expansion the mounted denial test forbids.
 */
function safeReviewStatus(value: unknown, permitted: Set<string>): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !permitted.has(value)) throw new AssessmentRequestQueryError();
  return value;
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

function safeReviewFilters(value: unknown): { filters: StrapiQuery; bucket: ReviewQueueBucket } {
  if (value === undefined) return { filters: {}, bucket: "requires-attention" };
  if (!isRecord(value)) throw new AssessmentRequestQueryError();
  assertOnlyKeys(value, ["requestStatus", "title", "requestNumber", "dueDate", "queue"]);
  const bucket = safeReviewQueue(value.queue);
  const requestStatus = safeReviewStatus(value.requestStatus, bucket === "released" ? RELEASED_STATUS_SET : REVIEWABLE_STATUS_SET);
  const title = safeReviewText(value.title);
  const requestNumber = safeReviewText(value.requestNumber);
  const dueDate = safeReviewDate(value.dueDate);
  return { bucket, filters: {
    ...(requestStatus ? { requestStatus: { $eq: requestStatus } } : {}),
    ...(title ? { title: { $containsi: title } } : {}),
    ...(requestNumber ? { requestNumber: { $containsi: requestNumber } } : {}),
    ...(dueDate ? { dueDate: { $eq: dueDate } } : {}),
  } };
}

function safeReviewSort(value: unknown): string[] {
  if (value === undefined) return ["submittedDate:asc", "requestNumber:asc"];
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length < 1 || entries.length > 2) throw new AssessmentRequestQueryError();
  const allowed = new Set(["dueDate", "submittedDate", "requestNumber", "title", "requestStatus", "updatedAt"]);
  return entries.map((entry) => {
    if (typeof entry !== "string") throw new AssessmentRequestQueryError();
    const [field, direction = "asc", extra] = entry.split(":");
    if (!field || extra !== undefined || !allowed.has(field) || (direction !== "asc" && direction !== "desc")) {
      throw new AssessmentRequestQueryError();
    }
    return `${field}:${direction}`;
  });
}

export function buildAnalystReviewCollectionQuery(
  query: unknown,
  state: unknown,
): { dataQuery: StrapiQuery; countQuery: StrapiQuery; pagination: AssessmentRequestPagination; bucket: ReviewQueueBucket } {
  if (!isRecord(query)) throw new AssessmentRequestQueryError();
  analystAuthorization(state);
  assertOnlyKeys(query, ["pagination", "filters", "sort"]);
  const paginationInput = query.pagination;
  if (paginationInput !== undefined && !isRecord(paginationInput)) throw new AssessmentRequestQueryError();
  if (paginationInput) assertOnlyKeys(paginationInput, ["page", "pageSize"]);
  const page = positiveInteger(paginationInput?.page, 1, 1_000_000);
  const pageSize = positiveInteger(paginationInput?.pageSize, 25, 100);
  const { filters: requestedFilters, bucket } = safeReviewFilters(query.filters);
  const statuses = bucket === "released" ? RELEASED_STATUSES : REVIEWABLE_STATUSES;
  const filters: StrapiQuery = {
    $and: [
      { requestStatus: { $in: [...statuses] } },
      requestedFilters,
    ],
  };
  return {
    countQuery: { filters },
    dataQuery: {
      filters,
      sort: safeReviewSort(query.sort),
      start: (page - 1) * pageSize,
      limit: pageSize,
    },
    pagination: { page, pageSize },
    bucket,
  };
}

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
