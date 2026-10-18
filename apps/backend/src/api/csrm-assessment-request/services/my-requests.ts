import type { Database } from "@strapi/database";

import { questionnaireProgress } from "../../csrm-questionnaire/services/questionnaire-scope";
import { isUtcDate, normalizeDateTime } from "../../../csrm/insights/utc-date";
import { daysSinceSubmission, RELEASED_REQUEST_STATUSES, REVIEWABLE_REQUEST_STATUSES, type RequestStatus } from "./collection-scope";
import { holderFor, projectRequestLifecycle, type RequestHolder } from "./request-lifecycle";
import { projectRequestRelationships, REQUEST_RELATIONSHIP_POPULATE } from "./relationship-scope";
import { PERSON_FIELDS, projectRequestorAssignment } from "./request-people";
import {
  assessmentExists,
  countUnreadNotesByRequest,
  hasUnreadNotes,
  literalContains,
  questionnaireReleased,
  questionnaireSubmitted,
  type UnreadNotesViewer,
} from "./review-queue-repository";

/*
 * The signed-in actor's own assessment requests, each with who holds it
 * (D-02 item 6, D-03, D-20).
 *
 * Ownership is the requestor link alone, joined on the numeric user id the
 * authorization policy resolved for the caller, so no caller-supplied value
 * reaches the owner check and another Requestor's request can never be read.
 * Every actor, a Security Analyst included, is the Requestor of the requests
 * it raised, so each item is read from the Requestor's side.
 *
 * Each item names the Security Analyst who holds it by display name alone
 * (D-17) and counts the notes new to its Requestor (D-24) with the review
 * queue's own unread predicate, so the notes filter, the page's counts and the
 * status summary share one definition.
 *
 * The holder is decided in SQL from the review queue's own lifecycle facts, so
 * the page, its total and the holder counts share one definition, and it equals
 * the lifecycle's holderFor(currentKey) at every reachable step (proved by
 * tests/my-requests.integration.test.ts). Every column comes from a constant or
 * a closed map, and every value is a bound parameter.
 */

type Knex = Database["connection"];
type QueryBuilder = ReturnType<Knex["queryBuilder"]>;
type RecordValue = Record<string, unknown>;
type Documents = { findMany: (query: RecordValue) => Promise<RecordValue[]> };

const UID = "api::csrm-assessment-request.csrm-assessment-request";

export const MY_REQUEST_HOLDERS = Object.freeze(["requestor", "analyst", "none"] as const satisfies readonly RequestHolder[]);
const HOLDER_SET: ReadonlySet<string> = new Set(MY_REQUEST_HOLDERS);
export const MY_REQUEST_PAGE_SIZES = Object.freeze([10, 20, 50] as const);
export type MyRequestPageSize = typeof MY_REQUEST_PAGE_SIZES[number];
const PAGE_SIZE_BY_VALUE: ReadonlyMap<string, MyRequestPageSize> = new Map(MY_REQUEST_PAGE_SIZES.map((size) => [String(size), size]));
const DEFAULT_PAGE_SIZE: MyRequestPageSize = 10;
const MAX_PAGE = 1_000_000;

/** The parameters the operation publishes; any other key is refused. */
const QUERY_KEYS: ReadonlySet<string> = new Set(["q", "status", "holder", "notes", "sort", "page", "pageSize"]);

/** The notes filter's one value (D-24): the requests with a note new to their Requestor. */
export const MY_REQUEST_NOTES_FILTERS = Object.freeze(["unread"] as const);
export type MyRequestNotesFilter = typeof MY_REQUEST_NOTES_FILTERS[number];
const NOTES_FILTER_SET: ReadonlySet<string> = new Set(MY_REQUEST_NOTES_FILTERS);
const MAX_SEARCH_LENGTH = 200;

/** Every request status a caller may filter by: the whole datamodel vocabulary. */
const REQUEST_STATUS_SET: ReadonlySet<string> = new Set<RequestStatus>(["draft", ...REVIEWABLE_REQUEST_STATUSES, ...RELEASED_REQUEST_STATUSES]);

/** The fields a page may be ordered by, each naming a column only through this closed map. */
const SORT_COLUMNS = Object.freeze({
  updatedAt: "r.updated_at",
  dueDate: "r.due_date",
  requestNumber: "r.request_number",
  title: "r.title",
} as const);
export type MyRequestSortField = keyof typeof SORT_COLUMNS;
export type MyRequestSort = { field: MyRequestSortField; direction: "asc" | "desc" };
/** Today's My requests sort values (the web's requestSortValues), each one closed field and direction. */
const SORT_BY_VALUE: ReadonlyMap<string, MyRequestSort> = new Map(
  (Object.keys(SORT_COLUMNS) as MyRequestSortField[]).flatMap((field) =>
    (["asc", "desc"] as const).map((direction) => [`${field}:${direction}`, Object.freeze({ field, direction })] as const)),
);
const DEFAULT_SORT: MyRequestSort = Object.freeze({ field: "updatedAt", direction: "desc" });

/** Each item is projected as its Requestor sees it, whatever explicit grants the caller also holds (T-11-27). */
const REQUESTOR_VIEW = Object.freeze({ csrmAuthorization: Object.freeze({ assessmentRequestActor: "requestor" }) });

export type MyRequestsQuery = {
  /** One term matched against the request number or the title. */
  q?: string;
  status?: RequestStatus;
  holder?: RequestHolder;
  /** unread: only the requests with a note new to the caller as their Requestor (D-24). */
  notes?: MyRequestNotesFilter;
  sort: MyRequestSort;
  page: number;
  pageSize: MyRequestPageSize;
};

export class MyRequestsQueryError extends Error {
  constructor() {
    super("CSRM assessment request query is invalid.");
    this.name = "MyRequestsQueryError";
  }
}

export class MyRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MyRequestsError";
  }
}

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** A single string parameter: a repeated parameter or an operator object is malformed. */
function single(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new MyRequestsQueryError();
  return value;
}

function parsePage(value: unknown): number {
  const text = single(value);
  if (text === undefined) return 1;
  if (!/^[1-9]\d{0,6}$/.test(text) || Number(text) > MAX_PAGE) throw new MyRequestsQueryError();
  return Number(text);
}

function parsePageSize(value: unknown): MyRequestPageSize {
  const text = single(value);
  if (text === undefined) return DEFAULT_PAGE_SIZE;
  const size = PAGE_SIZE_BY_VALUE.get(text);
  if (size === undefined) throw new MyRequestsQueryError();
  return size;
}

function parseSearch(value: unknown): string | undefined {
  const text = single(value);
  if (text === undefined) return undefined;
  if (text.length < 1 || text.length > MAX_SEARCH_LENGTH) throw new MyRequestsQueryError();
  return text;
}

function parseStatus(value: unknown): RequestStatus | undefined {
  const text = single(value);
  if (text === undefined) return undefined;
  if (!REQUEST_STATUS_SET.has(text)) throw new MyRequestsQueryError();
  return text as RequestStatus;
}

function parseSort(value: unknown): MyRequestSort {
  const text = single(value);
  if (text === undefined) return DEFAULT_SORT;
  const sort = SORT_BY_VALUE.get(text);
  if (sort === undefined) throw new MyRequestsQueryError();
  return sort;
}

function parseHolder(value: unknown): RequestHolder | undefined {
  const text = single(value);
  if (text === undefined) return undefined;
  if (!HOLDER_SET.has(text)) throw new MyRequestsQueryError();
  return text as RequestHolder;
}

function parseNotes(value: unknown): MyRequestNotesFilter | undefined {
  const text = single(value);
  if (text === undefined) return undefined;
  if (!NOTES_FILTER_SET.has(text)) throw new MyRequestsQueryError();
  return text as MyRequestNotesFilter;
}

/** Parses the closed query; anything outside the published parameters throws MyRequestsQueryError. */
export function parseMyRequestsQuery(query: unknown): MyRequestsQuery {
  if (query === undefined || query === null) return { sort: DEFAULT_SORT, page: 1, pageSize: DEFAULT_PAGE_SIZE };
  if (!isRecord(query)) throw new MyRequestsQueryError();
  if (Object.keys(query).some((key) => !QUERY_KEYS.has(key))) throw new MyRequestsQueryError();
  const q = parseSearch(query.q);
  const status = parseStatus(query.status);
  const holder = parseHolder(query.holder);
  const notes = parseNotes(query.notes);
  return {
    ...(q !== undefined ? { q } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(holder !== undefined ? { holder } : {}),
    ...(notes !== undefined ? { notes } : {}),
    sort: parseSort(query.sort),
    page: parsePage(query.page),
    pageSize: parsePageSize(query.pageSize),
  };
}

/**
 * The My requests export's query (19-07; D-04): the list's own closed query, parsed by parseMyRequestsQuery, without a
 * page. `page` and `pageSize` are refused, so an export is always every request the list pages through.
 */
export function parseMyRequestsExportQuery(query: unknown): MyRequestsQuery {
  if (isRecord(query) && (query.page !== undefined || query.pageSize !== undefined)) throw new MyRequestsQueryError();
  return parseMyRequestsQuery(query);
}

/** The caller's own user id, only when the policy decided an owner scope for this request. */
export function ownRequestorId(state: unknown): number | null {
  const authorization = isRecord(state) && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  if (authorization?.assessmentRequestCollectionScope !== "own") return null;
  const requestorId = authorization.assessmentRequestRequestorId;
  return typeof requestorId === "number" && Number.isSafeInteger(requestorId) && requestorId > 0 ? requestorId : null;
}

/**
 * Adds the D-20 holder predicate over the outer request row `r`:
 * - requestor: a draft, or reviewable work whose questionnaire is released,
 *   not yet submitted, and has no Risk Assessment;
 * - none: released work (approved or closed);
 * - analyst: every other reviewable request.
 */
export function applyRequestHolder(query: QueryBuilder, holder: RequestHolder): QueryBuilder {
  switch (holder) {
    case "requestor":
      return query.where((held) => {
        held.where("r.request_status", "draft")
          .orWhere((answering) => {
            answering.whereIn("r.request_status", [...REVIEWABLE_REQUEST_STATUSES])
              .whereExists(questionnaireReleased)
              .whereNotExists(questionnaireSubmitted)
              .whereNotExists(assessmentExists);
          });
      });
    case "none":
      return query.whereIn("r.request_status", [...RELEASED_REQUEST_STATUSES]);
    case "analyst":
      return query.whereIn("r.request_status", [...REVIEWABLE_REQUEST_STATUSES])
        .where((withAnalyst) => {
          withAnalyst.whereNotExists(questionnaireReleased)
            .orWhereExists(questionnaireSubmitted)
            .orWhereExists(assessmentExists);
        });
    default: {
      const unknownHolder: never = holder;
      throw new MyRequestsError(`Unknown request holder ${String(unknownHolder)}.`);
    }
  }
}

/** The requests whose requestor link names `requestorId`, as a fresh query over `r`. */
export function ownedRequests(connection: Knex, requestorId: number): QueryBuilder {
  if (!Number.isSafeInteger(requestorId) || requestorId < 1) {
    throw new MyRequestsError("CSRM assessment request owner is invalid.");
  }
  return connection.queryBuilder()
    .from("csrm_assessment_requests as r")
    .join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
    .where("o.idambox_user_id", requestorId);
}

/*
 * NULL sorts as the smallest value in both directions, as the review queue
 * orders; the request id is the final tiebreak, so pages never overlap.
 */
export function applyMyRequestsOrder(query: QueryBuilder, sort: MyRequestSort): void {
  const column = SORT_COLUMNS[sort.field];
  query.orderByRaw(`CASE WHEN ${column} IS NULL THEN 0 ELSE 1 END ${sort.direction === "desc" ? "DESC" : "ASC"}`)
    .orderBy(column, sort.direction)
    .orderBy("r.id", "asc");
}

/** An instant as an ISO string, or null when absent or unreadable. */
function isoInstant(value: unknown): string | null {
  return normalizeDateTime(value)?.toISOString() ?? null;
}

/**
 * One item (D-02 item 6). It names the request's lifecycle stage and holder,
 * the Requestor's next step, its age, the return facts of a returned draft and
 * the questionnaire's progress once it is released to the Requestor, the
 * assigned Security Analyst's display name alone (D-17) and the notes new to
 * the Requestor (D-24). It never carries a Risk Assessment field (T-11-06, T-11-53).
 */
export function projectMyRequest(document: RecordValue, today: string, unreadNotes = 0): RecordValue {
  const { assignee } = projectRequestorAssignment(document.assignedAnalyst);
  const lifecycle = projectRequestLifecycle(document, REQUESTOR_VIEW, { assigneeName: assignee?.displayName ?? null });
  const relationships = projectRequestRelationships(document, REQUESTOR_VIEW);
  const relation = isRecord(relationships.questionnaire) ? relationships.questionnaire : {};
  const questionnaire = relation.availability === "available" && nonEmptyString(relation.documentId) && isRecord(document.questionnaire)
    ? { documentId: relation.documentId, ...questionnaireProgress(document.questionnaire) }
    : null;
  const revertedAt = document.requestStatus === "draft" ? isoInstant(document.revertedAt) : null;
  const nextAction = lifecycle.nextAction
    ? { summary: lifecycle.nextAction.summary, ...(lifecycle.nextAction.href ? { href: lifecycle.nextAction.href } : {}) }
    : null;
  return {
    documentId: document.documentId,
    requestNumber: document.requestNumber,
    title: document.title,
    requestStatus: document.requestStatus,
    submittedDate: isoInstant(document.submittedDate),
    dueDate: isUtcDate(document.dueDate) ? document.dueDate : null,
    updatedAt: isoInstant(document.updatedAt),
    daysSinceSubmission: daysSinceSubmission(document.submittedDate, today),
    holder: holderFor(lifecycle.currentKey),
    stage: { key: lifecycle.currentKey, label: lifecycle.currentLabel },
    nextAction,
    returned: revertedAt ? { reason: nonEmptyString(document.revertReason) ? document.revertReason : null, at: revertedAt } : null,
    questionnaire,
    assignee,
    unreadNotes: Number.isSafeInteger(unreadNotes) && unreadNotes > 0 ? unreadNotes : 0,
  };
}

export type MyRequestList = {
  data: RecordValue[];
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } };
};

/** The pieces of the Strapi instance My requests reads through. */
export type MyRequestsReader = {
  connection: Knex;
  /** A fresh query over `r` of the owner's requests the query's filters select, with no order and no page. */
  selected: () => QueryBuilder;
  /** The owner's documents for `documentIds`, in their order; a request removed between the two reads is left out. */
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
  /** Who unread notes are counted for: the owner, as their Requestor (D-24). */
  viewer: UnreadNotesViewer;
};

/**
 * The owner's requests as the list reads them (D-03): the owner scope, the query's filters and the hydration with the
 * relations the lifecycle reads, still bound to the owner. listMyRequests pages through it; the My requests export
 * (19-07) reads every row of it in the same order.
 */
export function myRequestsReader(strapi: unknown, requestorId: number, query: Omit<MyRequestsQuery, "page" | "pageSize" | "sort">): MyRequestsReader {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function"
    || typeof strapi.documents !== "function") {
    throw new MyRequestsError("CSRM my requests are unavailable.");
  }
  const connection = strapi.db.connection as Knex;
  const documents = (strapi.documents as (uid: string) => Documents)(UID);
  // The owner reads My requests as their Requestor: notes are counted from the Requestor's side (D-24).
  const viewer: UnreadNotesViewer = { id: requestorId, humanAnalyst: false };
  const selected = () => {
    const owned = ownedRequests(connection, requestorId);
    if (query.status !== undefined) owned.where("r.request_status", query.status);
    if (query.q !== undefined) {
      // One term finds a request by its number or its title, bound twice as a literal pattern, as the review queue matches.
      const pattern = literalContains(query.q);
      owned.whereRaw("(LOWER(r.request_number) LIKE LOWER(?) ESCAPE '!' OR LOWER(r.title) LIKE LOWER(?) ESCAPE '!')", [pattern, pattern]);
    }
    if (query.notes === "unread") owned.whereExists(hasUnreadNotes(viewer));
    return query.holder === undefined ? owned : applyRequestHolder(owned, query.holder);
  };
  const hydrate = async (documentIds: readonly string[]): Promise<RecordValue[]> => {
    if (documentIds.length === 0) return [];
    const found = await documents.findMany({
      filters: { documentId: { $in: [...documentIds] }, requestor: { id: { $eq: requestorId } } },
      // The assigned analyst is read as a documentId and a display name alone (D-04, D-17; T-13-49).
      populate: { ...REQUEST_RELATIONSHIP_POPULATE, assignedAnalyst: { fields: [...PERSON_FIELDS] } },
      limit: documentIds.length,
    });
    const byId = new Map(found.map((document) => [document.documentId, document]));
    return documentIds.flatMap((documentId) => {
      const document = byId.get(documentId);
      return document ? [document] : [];
    });
  };
  return { connection, selected, hydrate, viewer };
}

/**
 * Counts and pages the owner's requests in SQL, then hydrates only the page,
 * still bound to the owner, with the relations the lifecycle reads.
 */
export async function listMyRequests(
  strapi: unknown,
  input: { requestorId: number; query: MyRequestsQuery; today: string },
): Promise<MyRequestList> {
  const { requestorId, query, today } = input;
  const { connection, selected, hydrate, viewer } = myRequestsReader(strapi, requestorId, query);

  const row = await selected().countDistinct({ total: "r.id" }).first() as RecordValue | undefined;
  // PostgreSQL returns COUNT as a string.
  const total = Number(row?.total ?? 0);
  const { page, pageSize } = query;
  const pagination = { page, pageSize, pageCount: Math.ceil(total / pageSize), total };
  if (total === 0 || (page - 1) * pageSize >= total) return { data: [], meta: { pagination } };

  const pageQuery = selected().select("r.document_id");
  applyMyRequestsOrder(pageQuery, query.sort);
  const rows = await pageQuery.offset((page - 1) * pageSize).limit(pageSize) as RecordValue[];
  const documentIds = rows.map((entry) => entry.document_id).filter((documentId): documentId is string => typeof documentId === "string");
  if (documentIds.length === 0) return { data: [], meta: { pagination } };

  // Restore the page order. A request removed between the two reads is not shown.
  const found = await hydrate(documentIds);
  // One grouped read for the page's unread notes, never one per row (T-13-43).
  const unread = await countUnreadNotesByRequest(connection, documentIds, viewer);
  const data = found.map((document) => projectMyRequest(document, today, unread.get(String(document.documentId)) ?? 0));
  return { data, meta: { pagination } };
}
