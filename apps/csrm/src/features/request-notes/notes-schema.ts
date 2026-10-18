import { z } from 'zod';

import { NOTE_BODY_MAX_LENGTH, noteParts, notesClosedReasons } from './notes-domain';

/*
 * The closed parsers of the request notes contract (Phase 13 D-02): exactly `RequestNoteListResponse`,
 * `RequestNoteResponse` and `RequestNotesReadResponse`. A note's author mirrors `ActiveUserSummary`, which declares no
 * bound, so the person parser declares none either (the `assessmentRiskPersonSchema` pattern); a bound appears only
 * where `RequestNote` and its siblings declare one.
 */

export const notePersonSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();

/** The most notes one page carries (`RequestNoteListResponse.data`, maxItems 50). */
export const notesPageMax = 50;

export const requestNoteSchema = z.object({
  documentId: z.string(),
  sequence: z.number().int().min(1),
  body: z.string().min(1).max(NOTE_BODY_MAX_LENGTH),
  authorPart: z.enum(noteParts),
  author: notePersonSchema.nullable(),
  postedAt: z.iso.datetime({ offset: true }),
  unread: z.boolean(),
  changesAiInputs: z.boolean().optional(),
}).strict();

export const requestNotesMetaSchema = z.object({
  total: z.number().int().min(0),
  unread: z.number().int().min(0),
  lastReadSequence: z.number().int().min(0),
  hasEarlier: z.boolean(),
  accepting: z.boolean(),
  closedReason: z.enum(notesClosedReasons).nullable(),
  viewerPart: z.enum(noteParts),
  canMarkAiInputs: z.boolean(),
}).strict();

export const requestNoteListResponseSchema = z.object({
  data: z.array(requestNoteSchema).max(notesPageMax),
  meta: requestNotesMetaSchema,
}).strict();

export const requestNoteResponseSchema = z.object({ data: requestNoteSchema }).strict();

export const requestNotesReadResponseSchema = z.object({
  data: z.object({ lastReadSequence: z.number().int().min(0), unread: z.number().int().min(0) }).strict(),
}).strict();

const requestId = z.string().min(1).max(255);

/** The list's input: the request, the earlier-notes cursor and the page size, within the contract's bounds. */
export const listNotesInputSchema = z.object({
  requestId,
  before: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(notesPageMax).optional(),
}).strict();

/** The create's input: the contract's `RequestNoteCreateRequest`, the body trimmed and LF-normalised first. */
export const addNoteInputSchema = z.object({
  requestId,
  body: z.string().transform((value) => value.replace(/\r\n?/g, '\n').trim()).pipe(z.string().min(1).max(NOTE_BODY_MAX_LENGTH)),
  changesAiInputs: z.boolean().optional(),
}).strict();

export type AddNoteInput = z.input<typeof addNoteInputSchema>;

export const markReadInputSchema = z.object({ requestId, throughNoteId: z.string().min(1).max(255) }).strict();

/** The AI-input mark's input (D-26): the request, the note and the contract's `RequestNoteAiInputRequest` value. */
export const setAiInputInputSchema = z.object({
  requestId,
  noteId: z.string().min(1).max(255),
  changesAiInputs: z.boolean(),
}).strict();
