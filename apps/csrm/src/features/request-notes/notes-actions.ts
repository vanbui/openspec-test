'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ConflictReason } from '@/lib/api/conflict-reasons';
import { noteAiInputRefusal, noteRefusal } from '@/lib/api/refusal-copy';

import type { RequestNote, RequestNotesPage, RequestNotesReadState } from './notes-domain';
import { validateNoteDraft } from './notes-domain';
import { addRequestNote, listRequestNotes, markRequestNotesRead, setNoteAiInput } from './notes-service';

/*
 * The Server Actions the notes thread and composer call (Phase 13 D-21 to D-25). Each validates its input, calls
 * Strapi only through the typed service and returns a result the thread can show as it stands. Strapi decides every
 * rule; nothing here grants or refuses on its own.
 */

export type NoteActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /**
       * `field`: shown under the composer, nothing posted; `blocked`: trying again cannot help; `retryable`: try again;
       * `not-found`: the request is gone or not the caller's to read, so the page shows its not-found state.
       */
      kind: 'field' | 'blocked' | 'retryable' | 'not-found';
      /** The closed-list rule Strapi named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
      message: string;
    };

type NoteFailure = Extract<NoteActionResult<never>, { ok: false }>;

/** What a refused service call carries: its status and closed reason (the transport keeps nothing else). */
type ServiceFailure = { message: string; status?: number; reason?: ConflictReason };

const documentId = z.string().min(1).max(255);

const listInputSchema = z.object({
  requestId: documentId,
  before: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

const addInputSchema = z.object({
  requestId: documentId,
  body: z.string(),
  changesAiInputs: z.boolean().optional(),
}).strict();

const markReadInputSchema = z.object({ requestId: documentId, throughNoteId: documentId }).strict();

const setAiInputSchema = z.object({ requestId: documentId, noteId: documentId, changesAiInputs: z.boolean() }).strict();

/**
 * Family L (13-UI-SPEC §9.5) for a refused note: the sentence and kind noteRefusal reads from the served reason and
 * status, with the closed reason kept so the composer can tell a closed window (§9.4) from the note limit.
 */
function refused(error: ServiceFailure): NoteFailure {
  const { message, kind } = noteRefusal(error.reason, error.status);
  return { ok: false, kind, ...(error.reason ? { reason: error.reason } : {}), message };
}

/** A failed read of the thread: the page's not-found state, or §9.5's sentence with Try again. */
function readFailed(error: ServiceFailure, message: string): NoteFailure {
  if (error.status === 404) return { ok: false, kind: 'not-found', message: 'This request is no longer available.' };
  return { ok: false, kind: error.status === undefined || error.status >= 500 ? 'retryable' : 'blocked', message };
}

function revalidateRequestPages(requestId: string): void {
  const encodedId = encodeURIComponent(requestId);
  revalidatePath(`/app/requests/${encodedId}`);
  revalidatePath(`/app/review/requests/${encodedId}`);
}

/** One page of the thread: the newest notes, or the earlier notes before a sequence. A read: it revalidates nothing. */
export async function listRequestNotesAction(input: unknown): Promise<NoteActionResult<RequestNotesPage>> {
  const parsed = listInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: 'blocked', message: 'We couldn’t load earlier notes.' };
  const { requestId, ...options } = parsed.data;
  const result = await listRequestNotes(requestId, options);
  if (!result.error) return { ok: true, data: result.data };
  return readFailed(result.error, 'We couldn’t load earlier notes.');
}

/** Adds a note (D-21), after the composer's own check (§8.3); on success both request pages re-render. */
export async function addRequestNoteAction(input: unknown): Promise<NoteActionResult<RequestNote>> {
  const parsed = addInputSchema.safeParse(input);
  /* IN-505: input no composer sends cannot succeed by trying again: family L's blocked sentence. */
  if (!parsed.success) return { ok: false, kind: 'blocked', message: noteRefusal(undefined, 403).message };
  const { requestId, body, changesAiInputs } = parsed.data;
  const invalid = validateNoteDraft(body);
  if (invalid !== null) return { ok: false, kind: 'field', message: invalid };
  const result = await addRequestNote(requestId, { body, ...(changesAiInputs === undefined ? {} : { changesAiInputs }) });
  if (!result.error) {
    revalidateRequestPages(requestId);
    return { ok: true, data: result.data };
  }
  return refused(result.error);
}

/**
 * Marks the viewer's thread read through the newest loaded note (D-24, UI-D15). It revalidates nothing: the New
 * markers stay for this view, and the counts elsewhere update on their next server render.
 */
export async function markRequestNotesReadAction(input: unknown): Promise<NoteActionResult<RequestNotesReadState>> {
  const parsed = markReadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: 'blocked', message: 'We couldn’t mark the notes read.' };
  const result = await markRequestNotesRead(parsed.data.requestId, parsed.data.throughNoteId);
  if (!result.error) return { ok: true, data: result.data };
  return readFailed(result.error, 'We couldn’t mark the notes read.');
}

/**
 * Marks or unmarks a note as changing the AI inputs (D-26; 13-UI-SPEC §10.1): the switch and its Undo both call it, each
 * a change Strapi logs. Strapi decides who may; a refusal reads family M (§10.4). On success the analyst's request page
 * re-renders, and so do the analyst questionnaire and assessment pages, which show the AI-inputs-changed signal (D-29). A
 * note does not name the questionnaire or assessment its request holds, so those two are revalidated by their layout.
 */
export async function setNoteAiInputAction(input: unknown): Promise<NoteActionResult<RequestNote>> {
  const parsed = setAiInputSchema.safeParse(input);
  /* IN-505: input no switch sends cannot succeed by trying again: family M's blocked sentence, with Refresh page. */
  if (!parsed.success) return { ok: false, kind: 'blocked', message: noteAiInputRefusal(undefined, 400).message };
  const { requestId, noteId, changesAiInputs } = parsed.data;
  const result = await setNoteAiInput(requestId, noteId, changesAiInputs);
  if (!result.error) {
    revalidatePath(`/app/review/requests/${encodeURIComponent(requestId)}`);
    revalidatePath('/app/review/questionnaires', 'layout');
    revalidatePath('/app/review/assessments', 'layout');
    return { ok: true, data: result.data };
  }
  const { message, kind } = noteAiInputRefusal(result.error.reason, result.error.status);
  return { ok: false, kind, ...(result.error.reason ? { reason: result.error.reason } : {}), message };
}
