import { describe, expect, it } from 'vitest';

import {
  assignmentActionLabel,
  assignmentActionName,
  assignmentCaption,
  assignmentFailureTitle,
  assignmentNotice,
  assignmentStatusLine,
  assignmentTitle,
  assignmentToast,
  assignmentViewActions,
  historySentence,
  nextAssignmentRequest,
  optimisticAssignment,
  orderedAssignmentActions,
  pickerOptions,
  undoAllowed,
  undoAssignmentRequest,
  undoToast,
  type AssignmentEvent,
  type RequestAssignment,
} from './assignment-domain';

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const second = { documentId: 'u2', displayName: 'Second Analyst' };
const third = { documentId: 'u3', displayName: 'Third Analyst' };
const sam = { documentId: 'u4', displayName: 'Sam Analyst' };
const RAR = 'RAR-2026-0001';
const at = '2026-10-09T01:02:03.000Z';

function view(overrides: Partial<RequestAssignment> = {}): RequestAssignment {
  return { assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'], ownRequest: false, history: [], viewer: bob, ...overrides };
}

function event(overrides: Partial<AssignmentEvent>): AssignmentEvent {
  return { action: 'pick-up', by: bob, at, from: null, to: bob, reason: null, ...overrides };
}

describe('request assignment domain', () => {
  it('leaves the current assignee out of the picker and keeps the server order (UI-SPEC §6)', () => {
    expect(pickerOptions([bob, second, third], 'u2')).toEqual([bob, third]);
    expect(pickerOptions([third, bob], null)).toEqual([third, bob]);
    expect(pickerOptions([bob], 'u1')).toEqual([]);
  });

  it('does not change the list it is given', () => {
    const people = [bob, second];
    pickerOptions(people, 'u1');
    expect(people).toEqual([bob, second]);
  });

  it('titles the picker by its action and the request number', () => {
    expect(assignmentTitle('assign', 'REQ-2026-001')).toBe('Assign REQ-2026-001');
    expect(assignmentTitle('reassign', 'REQ-2026-001')).toBe('Reassign REQ-2026-001');
  });
});

describe('the assignment block’s words (UI-SPEC §5.2)', () => {
  it('names who holds the request, or that nobody has picked it up', () => {
    expect(assignmentStatusLine(view())).toBe('Not picked up');
    expect(assignmentStatusLine(view({ assignee: sam }))).toBe('Assigned to Sam Analyst');
  });

  it('captions each holder state, including a request released before CSRM recorded assignments', () => {
    expect(assignmentCaption(view(), 'submitted')).toEqual({ text: 'Any Security Analyst who didn’t raise this request can pick it up.', at: null });
    expect(assignmentCaption(view({ assignee: bob, assignedBy: bob, assignedAt: at }), 'submitted')).toEqual({ text: 'Picked up', at });
    expect(assignmentCaption(view({ assignee: sam, assignedBy: bob, assignedAt: at }), 'submitted')).toEqual({ text: 'Assigned by Bob Doe ·', at });
    expect(assignmentCaption(view({ actions: ['pick-up', 'assign'] }), 'approved')).toEqual({
      text: 'Released before CSRM recorded assignments. Assign it so its monitoring reaches a Security Analyst.', at: null,
    });
    expect(assignmentCaption(view({ actions: ['pick-up', 'assign'] }), 'closed')?.text).toMatch(/^Released before CSRM recorded assignments\./);
    /* A draft or a request the viewer raised says why in its own line instead (§5.2). */
    expect(assignmentCaption(view({ actions: [] }), 'draft')).toBeNull();
    expect(assignmentCaption(view({ actions: [], ownRequest: true }), 'submitted')).toBeNull();
    expect(assignmentCaption(view({ assignee: sam, assignedBy: bob, assignedAt: at, actions: [] }), 'draft')).toEqual({ text: 'Assigned by Bob Doe ·', at });
  });

  it('says why a draft or the viewer’s own request offers no action', () => {
    expect(assignmentNotice(view({ actions: [], ownRequest: true }), 'submitted')).toBe('You raised this request, so another Security Analyst picks it up.');
    expect(assignmentNotice(view({ actions: [] }), 'draft')).toBe('This request is a draft, so its assignment stays as it is until it’s resubmitted.');
    expect(assignmentNotice(view({ actions: [], ownRequest: true }), 'draft')).toBe('You raised this request, so another Security Analyst picks it up.');
    expect(assignmentNotice(view(), 'submitted')).toBeNull();
  });

  it('labels each action and names it beginning with its visible label (WCAG 2.5.3)', () => {
    expect(assignmentViewActions.map(assignmentActionLabel)).toEqual(['Pick up', 'Assign', 'Assign to me', 'Reassign', 'Return to queue']);
    expect(assignmentViewActions.map((action) => assignmentActionName(action, RAR))).toEqual([
      `Pick up ${RAR}`, `Assign ${RAR}`, `Assign ${RAR} to me`, `Reassign ${RAR}`, `Return ${RAR} to the queue`,
    ]);
  });

  it('offers the server’s actions only, in §5.2’s order', () => {
    expect(orderedAssignmentActions(['unassign', 'reassign', 'assign-to-me'])).toEqual(['assign-to-me', 'reassign', 'unassign']);
    expect(orderedAssignmentActions(['assign', 'pick-up'])).toEqual(['pick-up', 'assign']);
    expect(orderedAssignmentActions([])).toEqual([]);
  });
});

describe('the history sentences (UI-SPEC §5.3)', () => {
  it('words each change with who, whom and from whom', () => {
    expect(historySentence(event({ action: 'pick-up', by: bob, to: bob }))).toBe('Picked up by Bob Doe');
    expect(historySentence(event({ action: 'assign', by: bob, to: sam }))).toBe('Assigned to Sam Analyst by Bob Doe');
    expect(historySentence(event({ action: 'reassign', by: bob, from: bob, to: sam }))).toBe('Reassigned from Bob Doe to Sam Analyst by Bob Doe');
    expect(historySentence(event({ action: 'unassign', by: bob, from: bob, to: null }))).toBe('Returned to the queue by Bob Doe');
    expect(historySentence(event({ action: 'unassign', by: bob, from: sam, to: null }))).toBe('Returned to the queue by Bob Doe, from Sam Analyst');
  });

  it('names a person who can no longer be read without inventing a name', () => {
    expect(historySentence(event({ action: 'assign', by: null, to: sam }))).toBe('Assigned to Sam Analyst by a Security Analyst');
  });
});

/*
 * UI-06 (13-UI-SPEC §7.1, amended 2026-10-10): a person the API serves without a display name (Strapi's `required`
 * accepts an empty string, and `projectPerson` serves a missing one as empty) or no longer resolves is named by their
 * part, `a Security Analyst`, in the status line, the history and every toast; never an empty name.
 */
describe('the fallback for a person without a name (UI-06)', () => {
  const unnamed = { documentId: 'u9', displayName: '' };

  it('names an unnamed holder a Security Analyst in the status line and the history', () => {
    expect(assignmentStatusLine({ assignee: unnamed })).toBe('Assigned to a Security Analyst');
    expect(historySentence(event({ action: 'reassign', by: unnamed, from: sam, to: unnamed }))).toBe('Reassigned from Sam Analyst to a Security Analyst by a Security Analyst');
  });

  it.each([undefined, ''])('names a holder a Security Analyst in every toast when the name is %j', (name) => {
    expect(assignmentToast('assign', { requestNumber: RAR, name }, 'submitted')).toBe(`${RAR} assigned to a Security Analyst.`);
    expect(assignmentToast('reassign', { requestNumber: RAR, name }, 'submitted')).toBe(`${RAR} reassigned to a Security Analyst.`);
    for (const action of ['assign-to-me', 'reassign', 'unassign'] as const) {
      expect(undoToast(action, { requestNumber: RAR, previous: name })).toBe(`Undone. ${RAR} is assigned to a Security Analyst again.`);
    }
  });
});

describe('the toasts and Undo (UI-SPEC §7.1, UI-D4)', () => {
  it('confirms each change in §7.1’s words', () => {
    expect(assignmentToast('pick-up', { requestNumber: RAR }, 'submitted')).toBe(`You picked up ${RAR}.`);
    expect(assignmentToast('assign', { requestNumber: RAR, name: 'Sam Analyst' }, 'submitted')).toBe(`${RAR} assigned to Sam Analyst.`);
    expect(assignmentToast('assign-to-me', { requestNumber: RAR }, 'submitted')).toBe(`${RAR} is now assigned to you.`);
    expect(assignmentToast('reassign', { requestNumber: RAR, name: 'Sam Analyst' }, 'submitted')).toBe(`${RAR} reassigned to Sam Analyst.`);
    expect(assignmentToast('unassign', { requestNumber: RAR }, 'submitted')).toBe(`${RAR} returned to the queue.`);
  });

  it('says how to correct a pick-up or an assignment that has no Undo after release', () => {
    expect(assignmentToast('pick-up', { requestNumber: RAR }, 'approved')).toBe(`You picked up ${RAR}. Reassign it if someone else should hold it.`);
    expect(assignmentToast('assign', { requestNumber: RAR, name: 'Sam Analyst' }, 'closed')).toBe(`${RAR} assigned to Sam Analyst. Reassign it if someone else should hold it.`);
    expect(assignmentToast('reassign', { requestNumber: RAR, name: 'Sam Analyst' }, 'approved')).toBe(`${RAR} reassigned to Sam Analyst.`);
  });

  it('offers Undo only where the reverse is allowed', () => {
    expect(undoAllowed('pick-up', 'approved')).toBe(false);
    expect(undoAllowed('assign', 'closed')).toBe(false);
    expect(undoAllowed('pick-up', 'submitted')).toBe(true);
    expect(undoAllowed('assign', 'under-review')).toBe(true);
    expect(undoAllowed('reassign', 'approved')).toBe(true);
    expect(undoAllowed('assign-to-me', 'closed')).toBe(true);
    expect(undoAllowed('unassign', 'submitted')).toBe(true);
  });

  it('confirms an Undo in §7.1’s words', () => {
    expect(undoToast('pick-up', { requestNumber: RAR })).toBe(`Pick-up undone. ${RAR} is back in the queue.`);
    expect(undoToast('assign', { requestNumber: RAR })).toBe(`Assignment undone. ${RAR} is back in the queue.`);
    for (const action of ['assign-to-me', 'reassign', 'unassign'] as const) {
      expect(undoToast(action, { requestNumber: RAR, previous: 'Sam Analyst' })).toBe(`Undone. ${RAR} is assigned to Sam Analyst again.`);
    }
  });

  it('titles each failure by what did not happen', () => {
    expect(assignmentFailureTitle('pick-up')).toBe('Request not picked up');
    expect(assignmentFailureTitle('assign')).toBe('Request not assigned');
    expect(assignmentFailureTitle('assign-to-me')).toBe('Request not assigned');
    expect(assignmentFailureTitle('reassign')).toBe('Request not reassigned');
    expect(assignmentFailureTitle('unassign')).toBe('Request not returned to the queue');
  });
});

describe('what each action sends (D-05, compare-and-set)', () => {
  it('sends the viewer, a chosen analyst or nobody, with the assignee the page showed', () => {
    expect(nextAssignmentRequest(view(), 'pick-up')).toEqual({ analyst: 'u1', expectedAnalyst: null });
    expect(nextAssignmentRequest(view(), 'assign', sam)).toEqual({ analyst: 'u4', expectedAnalyst: null });
    expect(nextAssignmentRequest(view({ assignee: sam }), 'assign-to-me')).toEqual({ analyst: 'u1', expectedAnalyst: 'u4' });
    expect(nextAssignmentRequest(view({ assignee: bob }), 'reassign', sam)).toEqual({ analyst: 'u4', expectedAnalyst: 'u1' });
    expect(nextAssignmentRequest(view({ assignee: sam }), 'unassign')).toEqual({ analyst: null, expectedAnalyst: 'u4' });
  });

  it('refuses to build an assign or a reassign without a chosen analyst', () => {
    expect(() => nextAssignmentRequest(view(), 'assign')).toThrow();
    expect(() => nextAssignmentRequest(view({ assignee: bob }), 'reassign')).toThrow();
  });

  it('undoes by restoring the previous holder, with the new holder as the expected one', () => {
    expect(undoAssignmentRequest(view(), view({ assignee: bob }))).toEqual({ analyst: null, expectedAnalyst: 'u1' });
    expect(undoAssignmentRequest(view({ assignee: sam }), view({ assignee: bob }))).toEqual({ analyst: 'u4', expectedAnalyst: 'u1' });
    expect(undoAssignmentRequest(view({ assignee: sam }), view())).toEqual({ analyst: 'u4', expectedAnalyst: null });
  });

  it('shows the change at once as the viewer making it', () => {
    const shown = optimisticAssignment(view(), bob, '2026-10-09T02:00:00.000Z');
    expect(shown).toMatchObject({ assignee: bob, assignedBy: bob, assignedAt: '2026-10-09T02:00:00.000Z', viewer: bob });
    expect(optimisticAssignment(view({ assignee: sam, assignedBy: sam, assignedAt: at }), null, '2026-10-09T02:00:00.000Z'))
      .toMatchObject({ assignee: null, assignedBy: null, assignedAt: null });
  });
});

describe('assignment copy never accepts or releases (UI-SPEC §16, UI-D29)', () => {
  it('holds no Accept and no release in any sentence it returns', () => {
    const statuses = ['submitted', 'approved', 'closed', 'draft'] as const;
    const views = [view(), view({ assignee: bob, assignedBy: bob, assignedAt: at }), view({ assignee: sam, assignedBy: bob, assignedAt: at }), view({ ownRequest: true, actions: [] })];
    const sentences = [
      ...views.flatMap((shown) => [assignmentStatusLine(shown), ...statuses.flatMap((status) => [assignmentCaption(shown, status)?.text ?? '', assignmentNotice(shown, status) ?? ''])]),
      ...assignmentViewActions.flatMap((action) => [
        assignmentActionLabel(action), assignmentActionName(action, RAR), assignmentFailureTitle(action),
        ...statuses.map((status) => assignmentToast(action, { requestNumber: RAR, name: 'Sam Analyst' }, status)),
        undoToast(action, { requestNumber: RAR, previous: 'Sam Analyst' }),
      ]),
      ...(['pick-up', 'assign', 'reassign', 'unassign'] as const).map((action) => historySentence(event({ action, from: sam, to: bob }))),
    ].filter(Boolean);
    expect(sentences.length).toBeGreaterThan(40);
    for (const sentence of sentences) {
      expect(sentence, sentence).not.toMatch(/accept/i);
      /* "Released before CSRM recorded assignments" states the request's own state; nothing here releases anything. */
      expect(sentence.replace(/^Released before CSRM recorded assignments\./, ''), sentence).not.toMatch(/release/i);
    }
  });
});
