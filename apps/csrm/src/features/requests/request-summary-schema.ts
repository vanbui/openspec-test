import { z } from 'zod';

import type { RequestSummaryAssignment, RequestSummaryFiles, RequestSummaryNotes } from './request-domain';

/*
 * Phase 13 D-16, D-25 (REQ-08 criterion 1) and Phase 14 D-27: the request summary the analyst questionnaire and assessment
 * reads carry, closed, so a person carrying anything beyond a documentId and a display name, an unknown pick-up state or
 * another notes or files figure fails the read. Strapi serves both null on every other read, a Requestor's included; the parsers that use these
 * read an absent field as null too. Zod-only and small: the questionnaire and assessment schemas share it.
 */
export const requestSummaryAssignmentSchema = z.object({
  assignee: z.object({ documentId: z.string(), displayName: z.string() }).strict().nullable(),
  pickUp: z.enum(['allowed', 'own-request', 'not-offered']),
}).strict();

export const requestSummaryNotesSchema = z.object({
  total: z.number().int().min(0),
  unread: z.number().int().min(0),
}).strict();

export const requestSummaryFilesSchema = z.object({
  count: z.number().int().min(0),
  included: z.number().int().min(0),
}).strict();

/** True only when two types are mutually assignable. */
type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const assignmentParserMatchesTheDomainType = true satisfies SameType<z.infer<typeof requestSummaryAssignmentSchema>, RequestSummaryAssignment>;
const notesParserMatchesTheDomainType = true satisfies SameType<z.infer<typeof requestSummaryNotesSchema>, RequestSummaryNotes>;
const filesParserMatchesTheDomainType = true satisfies SameType<z.infer<typeof requestSummaryFilesSchema>, RequestSummaryFiles>;
void assignmentParserMatchesTheDomainType;
void notesParserMatchesTheDomainType;
void filesParserMatchesTheDomainType;
