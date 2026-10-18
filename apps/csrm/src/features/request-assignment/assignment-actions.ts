'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getRequest } from '@/features/requests/request-service';
import type { ConflictReason } from '@/lib/api/conflict-reasons';
import { assignmentRefusal } from '@/lib/api/refusal-copy';

import type { AssignmentPerson, RequestAssignment } from './assignment-domain';
import { changeRequestAssignee, listAssignableAnalysts } from './assignment-service';

/*
 * The Server Actions the request assignment controls call (Phase 13 D-05, D-06). Each validates its input, calls
 * Strapi only through the typed service and returns a result the controls can show as it stands: family K's
 * sentence (13-UI-SPEC §7.4), with a blocked refusal offering Refresh page and a retryable one Try again (§7.2).
 * Strapi decides every rule; nothing here grants or refuses on its own.
 */

export type AssignmentActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: 'blocked' | 'retryable';
      /** The closed-list rule Strapi named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
      message: string;
      /** On ASSIGNMENT_CHANGED: who holds the request now, by display name, or null when nobody does. */
      currentHolder?: string | null;
    };

type AssignmentFailure = Extract<AssignmentActionResult<never>, { ok: false }>;

const documentId = z.string().min(1).max(255);

const listInputSchema = z.object({
  requestId: documentId,
  q: z.string().max(100).optional(),
}).strict();

/**
 * One assignment change, as the page showed it: the analyst to hold the request (null returns it to the queue), the
 * assignee the page showed (`expectedAnalyst`, the compare-and-set), an optional reason, the request number the
 * controls title with, and the chosen analyst's display name, which only names them in a refusal.
 */
const changeInputSchema = z.object({
  requestId: documentId,
  requestNumber: z.string().min(1).max(255),
  analyst: documentId.nullable(),
  expectedAnalyst: documentId.nullable(),
  analystName: z.string().min(1).max(255).optional(),
  reason: z.string().optional(),
}).strict();

const REASON_MAX_LENGTH = 500;

/** What a refused service call carries: its status and closed reason (the transport keeps nothing else). */
type ServiceFailure = { message: string; status?: number; reason?: ConflictReason };

function refused(error: ServiceFailure, names: { holderName?: string | null; targetName?: string | null } = {}): AssignmentFailure {
  const { message, kind } = assignmentRefusal(error.reason, names, error.status);
  return { ok: false, kind, ...(error.reason ? { reason: error.reason } : {}), message };
}

/* Every page that shows who holds the request: the request pages, the queues, Home, and the analyst questionnaire and
   assessment pages, whose request context line names the assignee or offers Pick up (13-UI-SPEC §11; IN-307). */
function revalidateAssignmentPages(requestId: string): void {
  const encodedId = encodeURIComponent(requestId);
  revalidatePath('/app/review/requests');
  revalidatePath(`/app/review/requests/${encodedId}`);
  revalidatePath('/app/review/assigned');
  revalidatePath('/app');
  revalidatePath(`/app/requests/${encodedId}`);
  revalidatePath('/app/review/questionnaires', 'layout');
  revalidatePath('/app/review/assessments', 'layout');
}

/**
 * Who holds the request now, read once after ASSIGNMENT_CHANGED (2026-10-01 confirmation): the display name, null
 * when nobody does, or undefined when the re-read failed and the holder is unknown.
 */
async function currentHolderName(requestId: string): Promise<string | null | undefined> {
  const result = await getRequest(requestId);
  const assignment = result.error ? undefined : result.data.assignment;
  if (!assignment) return undefined;
  return assignment.assignee?.displayName ?? null;
}

/** Picks up, assigns, reassigns or unassigns a request (D-05); Strapi derives which and decides every rule. */
export async function changeAssigneeAction(input: unknown): Promise<AssignmentActionResult<RequestAssignment>> {
  const parsed = changeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, kind: 'blocked', message: assignmentRefusal(undefined, {}, 400).message };
  }
  const { requestId, analyst, expectedAnalyst, analystName, reason } = parsed.data;
  if (reason !== undefined && reason.trim().length > REASON_MAX_LENGTH) {
    return { ok: false, kind: 'blocked', message: 'Keep the reason to 500 characters or fewer.' };
  }
  const trimmedReason = reason?.trim() ? reason.trim() : undefined;
  const result = await changeRequestAssignee({
    requestId,
    analyst,
    expectedAnalyst,
    ...(trimmedReason === undefined ? {} : { reason: trimmedReason }),
  });
  if (!result.error) {
    revalidateAssignmentPages(requestId);
    return { ok: true, data: result.data };
  }
  if (result.error.reason === 'ASSIGNMENT_CHANGED') {
    // Someone else changed it first: refresh the pages, then name who holds the request now (§7.2, §7.4).
    revalidateAssignmentPages(requestId);
    const holderName = await currentHolderName(requestId);
    const failure = refused(result.error, { holderName });
    return holderName === undefined ? failure : { ...failure, currentHolder: holderName };
  }
  return refused(result.error, { targetName: analystName ?? null });
}

/** The Security Analysts who may hold the request, for the assign picker (D-06). A read: it revalidates nothing. */
export async function listAssignableAnalystsAction(input: unknown): Promise<AssignmentActionResult<AssignmentPerson[]>> {
  const parsed = listInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: 'blocked', message: 'We couldn’t load Security Analysts.' };
  const result = await listAssignableAnalysts(parsed.data.requestId, parsed.data.q);
  if (!result.error) return { ok: true, data: result.data };
  const failure = refused(result.error);
  /* UI-SPEC §6: a list that couldn't load reads the picker's own error, with Try again. */
  return failure.kind === 'retryable' ? { ...failure, message: 'We couldn’t load Security Analysts.' } : failure;
}
