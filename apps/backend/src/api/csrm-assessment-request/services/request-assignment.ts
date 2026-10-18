import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { isRegisteredSourceServiceUser, registeredSourceServiceUserDocumentIds } from "../../../iam/identity/source-principal";
import { HUMAN_SECURITY_ANALYST_ROLE_NAME, type RoleGrant } from "../../../policies/csrm-authorization";
import {
  ASSIGNMENT_REASON_MAX_LENGTH,
  ASSIGNMENT_LOG_SCHEMA_VERSION,
  appendAssignmentEvent,
  canAppendAssignmentEvent,
  readAssignmentHistory,
} from "./assignment-log";
import {
  allowedAssignmentActions,
  deriveAssignmentAction,
  isEligibleAssignee,
  requiresAssignee,
  type AssignmentLogAction,
  type AssignmentViewAction,
} from "./request-assignment-policy";
import { withRequestLock, type RequestLockStrapi } from "./request-lock";
import { projectPerson, resolvePeople, type Person, type RequestPeopleStrapi } from "./request-people";

/*
 * PUT /api/v1/assessment_requests/{requestId}/assignee (Phase 13 D-05, D-08, D-09): the only writer of a request's
 * four assignment facts. The caller names the new analyst (or null to unassign) and the assignee they last saw; the
 * server derives the action, and inside the one request lock (request-lock.ts) decides, in this order:
 *
 *   the caller is not an eligible human analyst     403, before anything is read (WR-101: the Agent role excluded)
 *   the request is missing                          404
 *   the caller raised the request (G-1)             403 OWN_REQUEST, before anything else is decided (Pitfall 5)
 *   the request is a draft                          409 REQUEST_NOT_SUBMITTED
 *   the assignee is not the one the caller saw      409 ASSIGNMENT_CHANGED (compare-and-set)
 *   the target may not hold the request             409 ASSIGNEE_NOT_ELIGIBLE
 *   the target already holds it                     200, a no-op that writes no event, before the release rule (IN-101)
 *   unassigning a released request someone holds   409 ASSIGNMENT_REQUIRED
 *   the log cannot take the event                   409 HISTORY_UNAVAILABLE, nothing written
 *
 * and otherwise writes the facts and one log event in one `documents.update`, in the lock's transaction. Every read
 * that decides happens after the lock, and every one of them is a Document Service call, which joins the transaction.
 */

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const USER_UID = "api::idambox-user.idambox-user";
const MAX_ID_LENGTH = 255;
const BODY_KEYS = ["data"] as const;
const DATA_KEYS = ["analyst", "expectedAnalyst", "reason"] as const;
const INVALID = "CSRM request assignment data is invalid.";
const HUMAN_ANALYST_ONLY = "CSRM request assignment requires a human Security Analyst.";

type RecordValue = Record<string, unknown>;

type RequestDocuments = {
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: RecordValue) => Promise<RecordValue>;
};

export type AssignmentStrapi = RequestLockStrapi & {
  documents: (uid: string) => RequestDocuments & ReturnType<RequestPeopleStrapi["documents"]>;
};

export type AssigneeChange = { analyst: string | null; expectedAnalyst: string | null; reason: string | null };

/**
 * The caller of an assignment read or change. `humanAnalyst` is the policy's `eligibleHumanAnalyst` fact (WR-101): the
 * caller holds the operation through the human Security Analyst role and is an eligible person, so a user who also holds
 * the Security Analyst Agent role is neither offered nor allowed an assignment action.
 */
export type AssignmentViewer = { documentId: string; humanAnalyst: boolean };

export type AssignmentEventView = {
  action: AssignmentLogAction;
  by: Person | null;
  at: string;
  from: Person | null;
  to: Person | null;
  reason: string | null;
};

export type RequestAssignmentView = {
  assignee: Person | null;
  assignedBy: Person | null;
  assignedAt: string | null;
  actions: AssignmentViewAction[];
  ownRequest: boolean;
  history: AssignmentEventView[] | null;
  /** The analyst reading the view (13-09): the person a pick-up or an "assign to me" names. */
  viewer: Person;
};

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly reason?: ConflictReason,
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relationId(value: unknown): string | null {
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0 ? value.documentId : null;
}

function exactKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function userId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID_LENGTH || value.trim() !== value) {
    throw new AssignmentError(INVALID, 400);
  }
  return value;
}

/* C0 control characters other than the newline: a reason is plain text on one or more lines. */
const DISALLOWED_CONTROL = /[\u0000-\u0009\u000b-\u001f]/;

/** The published body, exactly: `{ data: { analyst, expectedAnalyst, reason? } }`; anything else is 400. */
export function parseAssigneeChange(body: unknown): AssigneeChange {
  if (!isRecord(body) || !exactKeys(body, BODY_KEYS) || !isRecord(body.data) || !exactKeys(body.data, DATA_KEYS)) {
    throw new AssignmentError(INVALID, 400);
  }
  const { data } = body;
  if (!("analyst" in data) || !("expectedAnalyst" in data)) throw new AssignmentError(INVALID, 400);
  let reason: string | null = null;
  if (data.reason !== undefined) {
    if (typeof data.reason !== "string") throw new AssignmentError(INVALID, 400);
    const trimmed = data.reason.trim();
    if (trimmed.length === 0 || trimmed.length > ASSIGNMENT_REASON_MAX_LENGTH || DISALLOWED_CONTROL.test(trimmed)) {
      throw new AssignmentError(INVALID, 400);
    }
    reason = trimmed;
  }
  return { analyst: userId(data.analyst), expectedAnalyst: userId(data.expectedAnalyst), reason };
}

function instant(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The people a request's assignment and history name, and the viewing analyst, whom the view names too. */
export function assignmentPeopleIds(request: RecordValue, viewerDocumentId: string): string[] {
  const ids = [viewerDocumentId, relationId(request.assignedAnalyst), relationId(request.assignedBy)];
  for (const event of readAssignmentHistory(request.assignmentLog) ?? []) ids.push(event.by, event.from, event.to);
  return ids.filter((id): id is string => id !== null);
}

/**
 * What an analyst sees of a request's assignment: the assignee, who assigned them and when, what this viewer may do,
 * whether the viewer raised the request, the history newest first (null when the stored log is malformed:
 * "history unavailable", never a failed read) and the viewer themselves, whom a pick-up or an "assign to me" sends as
 * the analyst (13-09). People are documentId and display name only.
 */
export function projectAnalystAssignment(
  request: RecordValue,
  viewer: AssignmentViewer,
  people: ReadonlyMap<string, Person>,
): RequestAssignmentView {
  const person = (id: string | null): Person | null => (id === null ? null : people.get(id) ?? null);
  const requestorDocumentId = relationId(request.requestor);
  const assigneeDocumentId = relationId(request.assignedAnalyst);
  const history = readAssignmentHistory(request.assignmentLog);
  return {
    assignee: person(assigneeDocumentId),
    assignedBy: person(relationId(request.assignedBy)),
    assignedAt: assigneeDocumentId === null ? null : instant(request.assignedAt),
    actions: allowedAssignmentActions({ requestStatus: request.requestStatus, requestorDocumentId, assigneeDocumentId }, viewer),
    ownRequest: requestorDocumentId !== null && requestorDocumentId === viewer.documentId,
    history: history === null ? null : history.map((event) => ({
      action: event.action,
      by: person(event.by),
      at: event.at,
      from: person(event.from),
      to: person(event.to),
      reason: event.reason,
    })),
    viewer: person(viewer.documentId) ?? { documentId: viewer.documentId, displayName: "" },
  };
}

const ASSIGNMENT_READ = {
  fields: ["requestStatus", "assignedAt", "assignmentLog"],
  populate: {
    requestor: { fields: ["documentId"] },
    assignedAnalyst: { fields: ["documentId"] },
    assignedBy: { fields: ["documentId"] },
  },
} as const;

type EligibilityRead = { documentId?: unknown; displayName?: unknown; accountStatus?: unknown; roles?: RoleGrant[] };

/* The grants eligibility reads: each role's functions and their FunctionApis (isEligibleAssignee). */
const ELIGIBILITY_ROLES_POPULATE = {
  roles: { fields: ["name"], populate: { functions: { fields: ["name"], populate: { functionApis: { fields: ["url"] } } } } },
} as const;

async function loadEligibilityUser(strapi: AssignmentStrapi, documentId: string) {
  if (await isRegisteredSourceServiceUser(strapi, documentId)) return null;
  const user = await strapi.documents(USER_UID).findOne({
    documentId,
    fields: ["documentId", "accountStatus"],
    populate: ELIGIBILITY_ROLES_POPULATE,
  }) as EligibilityRead | null;
  if (!user || typeof user.documentId !== "string") return null;
  return { documentId: user.documentId, accountStatus: user.accountStatus, roles: Array.isArray(user.roles) ? user.roles : [] };
}

export async function changeRequestAssignee(input: {
  strapi: AssignmentStrapi;
  requestDocumentId: string;
  viewer: AssignmentViewer;
  body: unknown;
  now?: Date;
}): Promise<RequestAssignmentView> {
  // WR-101 (G-1, D-05): the acting analyst's own eligibility, before the body or the request is read.
  if (input.viewer.humanAnalyst !== true) throw new AssignmentError(HUMAN_ANALYST_ONLY, 403);
  const change = parseAssigneeChange(input.body);
  const actor = input.viewer.documentId;
  if (!input.requestDocumentId || !actor) throw new AssignmentError(INVALID, 400);
  return withRequestLock(input.strapi, input.requestDocumentId, async () => {
    const requests = input.strapi.documents(REQUEST_UID);
    const request = await requests.findOne({ documentId: input.requestDocumentId, ...ASSIGNMENT_READ });
    if (!request) throw new AssignmentError("CSRM assessment request was not found.", 404);
    const requestorDocumentId = relationId(request.requestor);
    // G-1, checked first (Pitfall 5): on a request they raised, an analyst is its Requestor and takes no assignment action.
    if (requestorDocumentId === actor) {
      throw new AssignmentError("CSRM request assignment is denied.", 403, "OWN_REQUEST");
    }
    if (request.requestStatus === "draft") {
      throw new AssignmentError("CSRM assessment request is not submitted.", 409, "REQUEST_NOT_SUBMITTED");
    }
    const current = relationId(request.assignedAnalyst);
    if (current !== change.expectedAnalyst) {
      throw new AssignmentError("CSRM request assignment has changed.", 409, "ASSIGNMENT_CHANGED");
    }
    if (change.analyst !== null) {
      const target = await loadEligibilityUser(input.strapi, change.analyst);
      if (!isEligibleAssignee(target, { requestorDocumentId })) {
        throw new AssignmentError("CSRM request assignee is not eligible.", 409, "ASSIGNEE_NOT_ELIGIBLE");
      }
    } else if (current !== null && requiresAssignee(request.requestStatus)) {
      // IN-101: unassigning a request nobody holds changes nothing, so it is the no-op below, never this refusal.
      throw new AssignmentError("CSRM released request must keep an assigned analyst.", 409, "ASSIGNMENT_REQUIRED");
    }

    const action = deriveAssignmentAction(current, change.analyst, actor);
    let result = request;
    if (action !== null) {
      if (!canAppendAssignmentEvent(request.assignmentLog)) {
        throw new AssignmentError("CSRM request assignment history is unavailable.", 409, "HISTORY_UNAVAILABLE");
      }
      const at = (input.now ?? new Date()).toISOString();
      const assignmentLog = appendAssignmentEvent(request.assignmentLog, {
        schemaVersion: ASSIGNMENT_LOG_SCHEMA_VERSION,
        action,
        by: actor,
        at,
        from: current,
        to: change.analyst,
        reason: change.reason,
      });
      result = await requests.update({
        documentId: input.requestDocumentId,
        data: {
          assignedAnalyst: change.analyst,
          assignedAt: change.analyst === null ? null : at,
          assignedBy: change.analyst === null ? null : actor,
          assignmentLog,
        },
        ...ASSIGNMENT_READ,
      });
    }
    const people = await resolvePeople(input.strapi, assignmentPeopleIds(result, actor));
    return projectAnalystAssignment(result, input.viewer, people);
  });
}

/** The most people the eligible-analyst read returns (D-06): a picker shows a short list and is searched by name. */
export const ASSIGNABLE_ANALYSTS_LIMIT = 50;
/** The bound of the one candidate read the eligible list is filtered from. */
export const ASSIGNABLE_CANDIDATES_LIMIT = 200;

/**
 * GET /api/v1/assessment_requests/{requestId}/assignable_analysts (Phase 13 D-06, D-07): exactly the people
 * isEligibleAssignee admits for the request, so a picker never offers a person the assignment would refuse.
 *
 *   the caller is not an eligible human analyst     403, before anything is read (WR-101)
 *   the request is missing                          404
 *   the caller raised the request (G-1)             403 OWN_REQUEST: choosing one's own assessor is the conflict
 *   the request is a draft                          409 REQUEST_NOT_SUBMITTED
 *
 * Otherwise one bounded read of the active users holding the human Security Analyst role (by name, with `q`),
 * ordered by display name, filtered by isEligibleAssignee and projected to documentId and display name. The current
 * assignee stays in the list (they are eligible); the web picker leaves them out. A read, so it takes no lock.
 */
export async function listAssignableAnalysts(input: {
  strapi: AssignmentStrapi;
  requestDocumentId: string;
  /** `humanAnalyst` is the policy's `eligibleHumanAnalyst` fact, as for AssignmentViewer. */
  caller: { documentId: string; humanAnalyst: boolean };
  q: string | null;
}): Promise<Person[]> {
  const { strapi, requestDocumentId, caller, q } = input;
  if (caller.humanAnalyst !== true) throw new AssignmentError(HUMAN_ANALYST_ONLY, 403);
  if (!requestDocumentId || !caller.documentId) throw new AssignmentError(INVALID, 400);
  const request = await strapi.documents(REQUEST_UID).findOne({
    documentId: requestDocumentId,
    fields: ["requestStatus"],
    populate: { requestor: { fields: ["documentId"] } },
  });
  if (!request) throw new AssignmentError("CSRM assessment request was not found.", 404);
  const requestorDocumentId = relationId(request.requestor);
  if (requestorDocumentId === caller.documentId) {
    throw new AssignmentError("CSRM request assignment is denied.", 403, "OWN_REQUEST");
  }
  if (request.requestStatus === "draft") {
    throw new AssignmentError("CSRM assessment request is not submitted.", 409, "REQUEST_NOT_SUBMITTED");
  }
  const serviceIds = await registeredSourceServiceUserDocumentIds(strapi);
  const candidates = await strapi.documents(USER_UID).findMany({
    filters: {
      ...(serviceIds.length === 0 ? {} : { documentId: { $notIn: serviceIds } }),
      accountStatus: { $eq: "active" },
      roles: { name: { $eq: HUMAN_SECURITY_ANALYST_ROLE_NAME } },
      ...(q === null ? {} : { displayName: { $containsi: q } }),
    },
    fields: ["documentId", "displayName", "accountStatus"],
    populate: ELIGIBILITY_ROLES_POPULATE,
    sort: ["displayName:asc", "id:asc"],
    limit: ASSIGNABLE_CANDIDATES_LIMIT,
  }) as EligibilityRead[];
  const people: Person[] = [];
  for (const candidate of candidates) {
    if (people.length >= ASSIGNABLE_ANALYSTS_LIMIT) break;
    if (typeof candidate.documentId !== "string") continue;
    const user = { documentId: candidate.documentId, accountStatus: candidate.accountStatus, roles: Array.isArray(candidate.roles) ? candidate.roles : [] };
    if (!isEligibleAssignee(user, { requestorDocumentId })) continue;
    const person = projectPerson(candidate);
    if (person) people.push(person);
  }
  return people;
}
