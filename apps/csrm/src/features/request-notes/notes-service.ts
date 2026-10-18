import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type { RequestNote, RequestNotesPage, RequestNotesReadState } from './notes-domain';
import {
  addNoteInputSchema,
  listNotesInputSchema,
  markReadInputSchema,
  setAiInputInputSchema,
  requestNoteListResponseSchema,
  requestNoteResponseSchema,
  requestNotesReadResponseSchema,
} from './notes-schema';

export const responseParserModule = {
  modulePath: 'features/request-notes/notes-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'listRequestNotes', component: 'RequestNoteListResponse', parser: requestNoteListResponseSchema },
    { label: 'addRequestNote', component: 'RequestNoteResponse', parser: requestNoteResponseSchema },
    { label: 'markRequestNotesRead', component: 'RequestNotesReadResponse', parser: requestNotesReadResponseSchema },
    { label: 'setNoteAiInput', component: 'RequestNoteResponse', parser: requestNoteResponseSchema },
  ] as const satisfies readonly ContractResponseParser[],
};

/**
 * One page of a request's notes, oldest first, with the viewer's read state (Phase 13 D-21, D-24). Strapi decides who
 * may read them: a caller who may not gets the same 404 as a missing request.
 */
export async function listRequestNotes(
  requestId: string,
  options: { before?: number; limit?: number } = {},
): Promise<TransportResult<RequestNotesPage>> {
  let parsed: z.output<typeof listNotesInputSchema>;
  try {
    parsed = listNotesInputSchema.parse({ requestId, ...options });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  const query = {
    ...(parsed.before === undefined ? {} : { before: parsed.before }),
    ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
  };
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/assessment_requests/{requestId}/notes', {
      params: { path: { requestId: parsed.requestId }, ...(Object.keys(query).length > 0 ? { query } : {}) },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    const page = requestNoteListResponseSchema.parse(data);
    return { data: { notes: page.data, meta: page.meta }, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('listRequestNotes');
    return normalizeTransportError(error);
  }
}

/** Adds a note (D-21). Strapi assigns its sequence, time and part, and decides every rule. */
export async function addRequestNote(
  requestId: string,
  note: { body: string; changesAiInputs?: boolean },
): Promise<TransportResult<RequestNote>> {
  let parsed: z.output<typeof addNoteInputSchema>;
  try {
    parsed = addNoteInputSchema.parse({ requestId, ...note });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/assessment_requests/{requestId}/notes', {
      params: { path: { requestId: parsed.requestId } },
      body: { data: { body: parsed.body, ...(parsed.changesAiInputs === undefined ? {} : { changesAiInputs: parsed.changesAiInputs }) } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestNoteResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('addRequestNote');
    return normalizeTransportError(error);
  }
}

/** Marks the viewer's own read state through one note (D-24); it only ever advances. */
export async function markRequestNotesRead(requestId: string, throughNoteId: string): Promise<TransportResult<RequestNotesReadState>> {
  let parsed: z.output<typeof markReadInputSchema>;
  try {
    parsed = markReadInputSchema.parse({ requestId, throughNoteId });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/assessment_requests/{requestId}/notes/read', {
      params: { path: { requestId: parsed.requestId } },
      body: { data: { throughNoteId: parsed.throughNoteId } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestNotesReadResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('markRequestNotesRead');
    return normalizeTransportError(error);
  }
}

/**
 * Sets or clears a note's AI-input mark (D-26), the switch and its Undo alike. Strapi decides who may: a human Security
 * Analyst who did not raise the request, while the request accepts notes; each change is logged there.
 */
export async function setNoteAiInput(requestId: string, noteId: string, changesAiInputs: boolean): Promise<TransportResult<RequestNote>> {
  let parsed: z.output<typeof setAiInputInputSchema>;
  try {
    parsed = setAiInputInputSchema.parse({ requestId, noteId, changesAiInputs });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input', {
      params: { path: { requestId: parsed.requestId, noteId: parsed.noteId } },
      body: { data: { changesAiInputs: parsed.changesAiInputs } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestNoteResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('setNoteAiInput');
    return normalizeTransportError(error);
  }
}
