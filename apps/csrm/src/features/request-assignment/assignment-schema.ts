import { z } from 'zod';

import { assignmentEventActions, assignmentViewActions } from './assignment-domain';

/*
 * The closed parsers of the request assignment contract (Phase 13 D-02): exactly the
 * `AssessmentRequestAssignmentResponse` and `AssignableAnalystListResponse` components. A person mirrors
 * `ActiveUserSummary`, which declares no bound, so the person parser declares none either; the eligible list carries
 * the one bound its own component declares, at most 50 people.
 */

export const personSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();

export const assignmentEventSchema = z.object({
  action: z.enum(assignmentEventActions),
  by: personSchema.nullable(),
  at: z.iso.datetime({ offset: true }),
  from: personSchema.nullable(),
  to: personSchema.nullable(),
  reason: z.string().nullable(),
}).strict();

export const requestAssignmentSchema = z.object({
  assignee: personSchema.nullable(),
  assignedBy: personSchema.nullable(),
  assignedAt: z.iso.datetime({ offset: true }).nullable(),
  actions: z.array(z.enum(assignmentViewActions)).max(5),
  ownRequest: z.boolean(),
  history: z.array(assignmentEventSchema).max(1000).nullable(),
  viewer: personSchema,
}).strict();

export const requestAssignmentResponseSchema = z.object({ data: requestAssignmentSchema }).strict();

/** What the web sends: the contract's `AssessmentRequestAssigneeChangeRequest` bounds, with the reason trimmed. */
export const assigneeChangeInputSchema = z.object({
  requestId: z.string().min(1).max(255),
  analyst: z.string().min(1).max(255).nullable(),
  expectedAnalyst: z.string().min(1).max(255).nullable(),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export type AssigneeChangeInput = z.input<typeof assigneeChangeInputSchema>;

/** The most people the eligible-analyst read returns (`AssignableAnalystListResponse`, maxItems 50). */
export const assignableAnalystsLimit = 50;

export const assignableAnalystListResponseSchema = z.object({
  data: z.array(personSchema).max(assignableAnalystsLimit),
}).strict();

/** The eligible-analyst read's input: the request and an optional name search of at most 100 characters. */
export const assignableAnalystsInputSchema = z.object({
  requestId: z.string().min(1).max(255),
  q: z.string().trim().max(100).optional(),
}).strict();
