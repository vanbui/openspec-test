/*
 * Request assignment (Phase 13 D-05 to D-09), as the web reads it. Strapi decides every rule and every action a
 * viewer may take; these types only name what it returns. Zod-free, so client components may import it.
 */

/** The assignment changes Strapi may offer a viewing analyst, in the contract's order. */
export const assignmentViewActions = ['pick-up', 'assign', 'assign-to-me', 'reassign', 'unassign'] as const;
export type AssignmentViewAction = (typeof assignmentViewActions)[number];

/** The changes a request's assignment history records. */
export const assignmentEventActions = ['pick-up', 'assign', 'reassign', 'unassign'] as const;
export type AssignmentEventAction = (typeof assignmentEventActions)[number];

/** A person as the API names one: a documentId and a display name, nothing else. */
export type AssignmentPerson = { documentId: string; displayName: string };

export type AssignmentEvent = {
  action: AssignmentEventAction;
  by: AssignmentPerson | null;
  at: string;
  from: AssignmentPerson | null;
  to: AssignmentPerson | null;
  reason: string | null;
};

export type RequestAssignment = {
  assignee: AssignmentPerson | null;
  assignedBy: AssignmentPerson | null;
  assignedAt: string | null;
  actions: AssignmentViewAction[];
  ownRequest: boolean;
  /** Newest first; null when Strapi could not read the stored history. */
  history: AssignmentEvent[] | null;
  /** The analyst reading the view: the person a pick-up or an "assign to me" names (13-09). */
  viewer: AssignmentPerson;
};

/**
 * The people the assign picker offers (UI-SPEC §6): the server's eligible list in its own order, without the current
 * assignee, who already holds the request.
 */
export function pickerOptions(people: readonly AssignmentPerson[], currentAssigneeId: string | null): AssignmentPerson[] {
  return people.filter((person) => person.documentId !== currentAssigneeId);
}

/** The picker's title (UI-SPEC §6): `Assign {request number}` or `Reassign {request number}`. */
export function assignmentTitle(action: 'assign' | 'reassign', requestNumber: string): string {
  return `${action === 'assign' ? 'Assign' : 'Reassign'} ${requestNumber}`;
}

/*
 * The assignment block's words and the changes it sends (13-UI-SPEC §5.2, §5.3, §7.1), decided here so the block holds
 * no business logic. Every sentence is the contract's own; none says "accept" or "release" (UI-D29, §16).
 */

/* The released request statuses: a released request keeps an assigned Security Analyst (D-08). */
const releasedRequestStatuses: ReadonlySet<string> = new Set(['approved', 'closed']);

function isReleased(requestStatus: string): boolean {
  return releasedRequestStatuses.has(requestStatus);
}

/*
 * A person the API could no longer read, or serves without a display name, is named by their part, never by an invented
 * name or an empty one (13-UI-SPEC §7.1, amended 2026-10-10, UI-06).
 */
const UNNAMED_ANALYST = 'a Security Analyst';
function nameOrPart(name: string | null | undefined): string {
  return name ? name : UNNAMED_ANALYST;
}

function personName(person: AssignmentPerson | null): string {
  return nameOrPart(person?.displayName);
}

/** The status line (§5.2): `Assigned to {name}`, or `Not picked up`. */
export function assignmentStatusLine(view: Pick<RequestAssignment, 'assignee'>): string {
  return view.assignee ? `Assigned to ${personName(view.assignee)}` : 'Not picked up';
}

/** A caption's words, then the instant that follows them (shown in the viewer's time, X-3), when there is one. */
export type AssignmentCaption = { text: string; at: string | null };

/**
 * The caption under the status line (§5.2): who picked it up or assigned it and when; otherwise who may pick it up, or,
 * for a request released before CSRM recorded assignments, what to do. A draft or the viewer's own request says why in
 * its notice instead, so it has no "who may pick it up" caption.
 */
export function assignmentCaption(view: RequestAssignment, requestStatus: string): AssignmentCaption | null {
  if (view.assignee) {
    if (!view.assignedAt) return null;
    if (view.assignedBy && view.assignedBy.documentId === view.assignee.documentId) return { text: 'Picked up', at: view.assignedAt };
    return { text: `Assigned by ${personName(view.assignedBy)} ·`, at: view.assignedAt };
  }
  if (view.ownRequest || requestStatus === 'draft') return null;
  if (isReleased(requestStatus)) {
    return { text: 'Released before CSRM recorded assignments. Assign it so its monitoring reaches a Security Analyst.', at: null };
  }
  return { text: 'Any Security Analyst who didn’t raise this request can pick it up.', at: null };
}

/** Why the block offers no action (§5.2): the viewer raised the request (D-07), or it is a draft. */
export function assignmentNotice(view: Pick<RequestAssignment, 'ownRequest'>, requestStatus: string): string | null {
  if (view.ownRequest) return 'You raised this request, so another Security Analyst picks it up.';
  if (requestStatus === 'draft') return 'This request is a draft, so its assignment stays as it is until it’s resubmitted.';
  return null;
}

const actionLabels: Record<AssignmentViewAction, string> = {
  'pick-up': 'Pick up',
  assign: 'Assign',
  'assign-to-me': 'Assign to me',
  reassign: 'Reassign',
  unassign: 'Return to queue',
};

/** An action's visible label (UI-D1, UI-D2). */
export function assignmentActionLabel(action: AssignmentViewAction): string {
  return actionLabels[action];
}

/** An action's accessible name, which begins with its visible words (§5.2; WCAG 2.5.3). */
export function assignmentActionName(action: AssignmentViewAction, requestNumber: string): string {
  if (action === 'assign-to-me') return `Assign ${requestNumber} to me`;
  if (action === 'unassign') return `Return ${requestNumber} to the queue`;
  return `${actionLabels[action]} ${requestNumber}`;
}

/** The actions Strapi allows this viewer, in §5.2's order; never one it did not serve. */
export function orderedAssignmentActions(actions: readonly AssignmentViewAction[]): AssignmentViewAction[] {
  return assignmentViewActions.filter((action) => actions.includes(action));
}

/** One history event as a sentence (§5.3). */
export function historySentence(event: AssignmentEvent): string {
  const actor = personName(event.by);
  switch (event.action) {
    case 'pick-up':
      return `Picked up by ${actor}`;
    case 'assign':
      return `Assigned to ${personName(event.to)} by ${actor}`;
    case 'reassign':
      return `Reassigned from ${personName(event.from)} to ${personName(event.to)} by ${actor}`;
    case 'unassign':
      return event.from && event.from.documentId !== event.by?.documentId
        ? `Returned to the queue by ${actor}, from ${personName(event.from)}`
        : `Returned to the queue by ${actor}`;
  }
}

/** The names a toast uses: the request number, the analyst it now names, and who held it before. */
export type AssignmentToastNames = { requestNumber: string; name?: string; previous?: string };

/** Whether an Undo is offered (UI-D4): taking or giving a released request can't be undone, as unassigning it is refused. */
export function undoAllowed(action: AssignmentViewAction, requestStatus: string): boolean {
  return !((action === 'pick-up' || action === 'assign') && isReleased(requestStatus));
}

/** The success toast (§7.1), with how to correct a change that has no Undo after release. */
export function assignmentToast(action: AssignmentViewAction, names: AssignmentToastNames, requestStatus: string): string {
  const { requestNumber } = names;
  const name = nameOrPart(names.name);
  const sentences: Record<AssignmentViewAction, string> = {
    'pick-up': `You picked up ${requestNumber}.`,
    assign: `${requestNumber} assigned to ${name}.`,
    'assign-to-me': `${requestNumber} is now assigned to you.`,
    reassign: `${requestNumber} reassigned to ${name}.`,
    unassign: `${requestNumber} returned to the queue.`,
  };
  const sentence = sentences[action];
  return undoAllowed(action, requestStatus) ? sentence : `${sentence} Reassign it if someone else should hold it.`;
}

/** The toast after an Undo (§7.1). */
export function undoToast(action: AssignmentViewAction, names: AssignmentToastNames): string {
  if (action === 'pick-up') return `Pick-up undone. ${names.requestNumber} is back in the queue.`;
  if (action === 'assign') return `Assignment undone. ${names.requestNumber} is back in the queue.`;
  return `Undone. ${names.requestNumber} is assigned to ${nameOrPart(names.previous)} again.`;
}

/** The danger toast's title when a change fails (§7.1). */
export function assignmentFailureTitle(action: AssignmentViewAction): string {
  if (action === 'pick-up') return 'Request not picked up';
  if (action === 'reassign') return 'Request not reassigned';
  if (action === 'unassign') return 'Request not returned to the queue';
  return 'Request not assigned';
}

/** What a change sends (D-05): the analyst to hold the request, and the assignee the page showed (compare-and-set). */
export type AssignmentChangeRequest = { analyst: string | null; expectedAnalyst: string | null };

/**
 * The change an action sends: Pick up and Assign to me name the viewer; Assign and Reassign the chosen analyst; Return
 * to queue nobody. `expectedAnalyst` is always the assignee the page showed, so a change made meanwhile is refused.
 */
export function nextAssignmentRequest(view: RequestAssignment, action: AssignmentViewAction, target?: AssignmentPerson): AssignmentChangeRequest {
  const expectedAnalyst = view.assignee?.documentId ?? null;
  if (action === 'pick-up' || action === 'assign-to-me') return { analyst: view.viewer.documentId, expectedAnalyst };
  if (action === 'unassign') return { analyst: null, expectedAnalyst };
  if (!target) throw new Error('An assignment needs a chosen Security Analyst.');
  return { analyst: target.documentId, expectedAnalyst };
}

/** An Undo is a second recorded change (§7.1): it gives the request back to who held it before, from who holds it now. */
export function undoAssignmentRequest(before: Pick<RequestAssignment, 'assignee'>, after: Pick<RequestAssignment, 'assignee'>): AssignmentChangeRequest {
  return { analyst: before.assignee?.documentId ?? null, expectedAnalyst: after.assignee?.documentId ?? null };
}

/** The view shown at once while a change is sent (§5 Optimistic UI): the new holder, assigned by the viewer, now. */
export function optimisticAssignment(view: RequestAssignment, holder: AssignmentPerson | null, now: string): RequestAssignment {
  return holder
    ? { ...view, assignee: holder, assignedBy: view.viewer, assignedAt: now }
    : { ...view, assignee: null, assignedBy: null, assignedAt: null };
}
