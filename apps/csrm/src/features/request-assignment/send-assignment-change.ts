import { assignmentRefusal } from '@/lib/api/refusal-copy';

import { changeAssigneeAction, type AssignmentActionResult } from './assignment-actions';
import type { RequestAssignment } from './assignment-domain';

/** One assignment change as a control sends it (assignment-actions.ts validates it again). */
export type AssignmentChangeInput = {
  requestId: string;
  requestNumber: string;
  analyst: string | null;
  expectedAnalyst: string | null;
  analystName?: string;
  reason?: string;
};

/*
 * Sends an assignment change from a control: the request page's block, its picker or a queue's Pick up (13-UI-SPEC
 * §7.2, WR-301). The Server Action never throws, but the call to it can: the network drops, the server cannot be
 * reached, or the action's id is stale after a deploy. That is family K's retryable failure, so the control rolls back
 * in place with Try again and never hands the page to the route's error state.
 */
export async function sendAssignmentChange(input: AssignmentChangeInput): Promise<AssignmentActionResult<RequestAssignment>> {
  try {
    return await changeAssigneeAction(input);
  } catch {
    return { ok: false, ...assignmentRefusal(undefined, {}) };
  }
}
