import { isEligiblePerson } from "../../../csrm/people/eligible-person";
import { hasHumanAnalystOperation, type RoleGrant } from "../../../policies/csrm-authorization";
import { listAnalystReviewRequests } from "../operations";
import { RELEASED_REQUEST_STATUSES } from "./collection-scope";

/*
 * The request assignment rules (Phase 13 D-06 to D-10, G-1), in one module, so the assignment operation, the
 * eligible-analyst read and every projection of what a viewer may do decide the same way (13-RESEARCH Pitfall 9).
 * Nothing here reads a request or a user: callers pass what they loaded inside the request lock.
 */

/** The changes the log records (D-09). The server derives which one a change is. */
export const ASSIGNMENT_LOG_ACTIONS = Object.freeze(["pick-up", "assign", "reassign", "unassign"] as const);
export type AssignmentLogAction = (typeof ASSIGNMENT_LOG_ACTIONS)[number];

/** What a viewer may do to a request's assignment, as its projections offer it. */
export const ASSIGNMENT_VIEW_ACTIONS = Object.freeze(["pick-up", "assign", "assign-to-me", "reassign", "unassign"] as const);
export type AssignmentViewAction = (typeof ASSIGNMENT_VIEW_ACTIONS)[number];

/** A user as eligibility reads it: roles populated to their functions' FunctionApis. */
export type EligibilityUser = {
  documentId: string;
  accountStatus?: unknown;
  roles: RoleGrant[];
};

/*
 * Read at call time, never at load: collection-scope.ts imports pickUpState from this module, so a set built from
 * RELEASED_REQUEST_STATUSES while the two modules load would be built from a binding not yet initialised.
 */
function isReleasedStatus(requestStatus: string): boolean {
  return (RELEASED_REQUEST_STATUSES as readonly string[]).includes(requestStatus);
}

/**
 * Who may hold a request (D-06, D-07, G-1): an eligible person (active, never the Security Analyst Agent; the shared
 * predicate of src/csrm/people/eligible-person.ts) who holds the analyst review grant through the human Security
 * Analyst role, and who did not raise the request.
 *
 * Phase 17 adds the G-11 exclusion here: not a nominated risk owner or a named executive approver of the request's
 * assessment.
 */
export function isEligibleAssignee(
  user: EligibilityUser | null | undefined,
  request: { requestorDocumentId: string | null },
): boolean {
  if (!user || typeof user.documentId !== "string" || user.documentId.length === 0) return false;
  return isEligiblePerson(user)
    && hasHumanAnalystOperation(user.roles, listAnalystReviewRequests)
    && user.documentId !== request.requestorDocumentId;
}

/**
 * The action a change from `current` to `target` is, made by `actorDocumentId`, or null when nothing changes.
 * Taking an unassigned request is a pick-up when the actor takes it and an assignment otherwise; moving it from one
 * analyst to another (the actor included) is a reassignment; returning it to the queue is an unassignment.
 */
export function deriveAssignmentAction(
  current: string | null,
  target: string | null,
  actorDocumentId: string,
): AssignmentLogAction | null {
  if (current === target) return null;
  if (current === null) return target === actorDocumentId ? "pick-up" : "assign";
  return target === null ? "unassign" : "reassign";
}

/**
 * What `viewer` may do to the request's assignment (D-08). Nothing when the viewer raised the request (G-1), is not
 * a human Security Analyst, or the request is a draft; a released request keeps an accountable analyst, so it can be
 * reassigned but never unassigned.
 */
export function allowedAssignmentActions(
  request: { requestStatus: unknown; requestorDocumentId: string | null; assigneeDocumentId: string | null },
  viewer: { documentId: string; humanAnalyst: boolean },
): AssignmentViewAction[] {
  if (!viewer.humanAnalyst || viewer.documentId === request.requestorDocumentId) return [];
  if (typeof request.requestStatus !== "string" || request.requestStatus === "draft") return [];
  const actions: AssignmentViewAction[] = request.assigneeDocumentId === null
    ? ["pick-up", "assign"]
    : request.assigneeDocumentId === viewer.documentId
      ? ["reassign", "unassign"]
      : ["assign-to-me", "reassign", "unassign"];
  return isReleasedStatus(request.requestStatus) ? actions.filter((action) => action !== "unassign") : actions;
}

/** Whether a viewer may pick a request up, as the review queue says it (D-13): one closed field per item. */
export const PICK_UP_STATES = Object.freeze(["allowed", "own-request", "not-offered"] as const);
export type PickUpState = (typeof PICK_UP_STATES)[number];

/**
 * Whether `viewer` may pick the request up (D-13, D-16), from allowedAssignmentActions so the queue offers a pick-up
 * exactly where the assignment operation takes one (13-RESEARCH Pitfall 9): "allowed" when the viewer's actions hold a
 * pick-up; "own-request" when a human Security Analyst views a submitted request they raised (G-1, D-07), so the queue
 * can say why without a fourth field; "not-offered" otherwise (held, a draft, or a viewer who is not a human analyst).
 */
export function pickUpState(
  request: { requestStatus: unknown; requestorDocumentId: string | null; assigneeDocumentId: string | null },
  viewer: { documentId: string; humanAnalyst: boolean },
): PickUpState {
  if (allowedAssignmentActions(request, viewer).includes("pick-up")) return "allowed";
  const submitted = typeof request.requestStatus === "string" && request.requestStatus !== "draft";
  return viewer.humanAnalyst && submitted && viewer.documentId === request.requestorDocumentId ? "own-request" : "not-offered";
}

/*
 * The assigned analyst's refusals (D-10). Defined here and nowhere else; Phase 17.1 publishes them in the API
 * contract's reason lists when a route first returns them. Phase 13 returns neither.
 */
/** Nobody holds the request: a record-state refusal, since an eligible viewer can pick it up (409). */
export const REQUEST_UNASSIGNED = "REQUEST_UNASSIGNED" as const;
/** Someone else holds it, or the caller may not hold it any more: an identity-relative refusal (403). */
export const NOT_ASSIGNED_ANALYST = "NOT_ASSIGNED_ANALYST" as const;

export class AssignedAnalystRefusal extends Error {
  readonly status: 403 | 409;

  constructor(readonly reason: typeof REQUEST_UNASSIGNED | typeof NOT_ASSIGNED_ANALYST) {
    super(reason === REQUEST_UNASSIGNED
      ? "CSRM assessment request has no assigned analyst."
      : "CSRM assessment request step is reserved to its assigned analyst.");
    this.name = "AssignedAnalystRefusal";
    this.status = reason === REQUEST_UNASSIGNED ? 409 : 403;
  }
}

/**
 * The one server-side predicate for the steps reserved to a request's assigned analyst (D-10; Phase 17.1 gates Mark
 * reviewed, Submit final assessment, recall, and release and close with it). It holds when the caller is the
 * request's current assignee, is still eligible at the moment of use (`isEligibleAssignee`, read from `callerUser`,
 * the caller's own user record loaded with its roles), and reaches the operation through the human Security Analyst
 * grant (`caller.humanAnalyst`, the policy's fact). Otherwise it throws AssignedAnalystRefusal.
 *
 * In Phase 13 it gates nothing: editing stays non-exclusive (decision 10), and no questionnaire, assessment, Risk or
 * control mutation reads the assignment.
 */
export function assertAssignedAnalyst(input: {
  request: { requestorDocumentId: string | null; assigneeDocumentId: string | null };
  caller: { documentId: string; humanAnalyst: boolean };
  callerUser: EligibilityUser | null;
}): void {
  const { request, caller, callerUser } = input;
  if (request.assigneeDocumentId === null) throw new AssignedAnalystRefusal(REQUEST_UNASSIGNED);
  const holds = caller.humanAnalyst
    && caller.documentId.length > 0
    && request.assigneeDocumentId === caller.documentId
    && callerUser?.documentId === caller.documentId
    && isEligibleAssignee(callerUser, { requestorDocumentId: request.requestorDocumentId });
  if (!holds) throw new AssignedAnalystRefusal(NOT_ASSIGNED_ANALYST);
}

/** Whether a request in `requestStatus` must keep an accountable analyst (D-08). */
export function requiresAssignee(requestStatus: unknown): boolean {
  return typeof requestStatus === "string" && isReleasedStatus(requestStatus);
}
