import { conflictDetails, type ConflictReason } from "../../../csrm/conflict-reasons";
import { NOTES_PAGE_MAX, canUseRequestNotes, type NotesCaller } from "../services/request-notes-policy";
import {
  NOTES_NOT_FOUND,
  RequestNotesError,
  addRequestNote,
  listRequestNotes,
  loadNotesRequest,
  markRequestNotesRead,
  setNoteAiInput,
  type NotesRequest,
  type NotesStrapi,
} from "../services/request-notes";

/*
 * GET and POST /api/v1/assessment_requests/{requestId}/notes, POST …/notes/read (Phase 13 D-21 to D-24) and
 * PUT …/notes/{noteId}/ai_input (D-26). The
 * policy has checked the caller's Role → Function → FunctionAPI grant against the resolved IdamBox User. Every handler
 * then loads the request and asks canUseRequestNotes; a missing request and a caller who may not use its notes get the
 * same 404 with one actor-neutral message, before anything else is read or written (D-23). The handlers never branch
 * on the auth mode: they read only `ctx.state.idamboxUser` and the policy's facts.
 */

type RecordValue = Record<string, unknown>;

type ErrorResponder = (message: string, details?: { reason: ConflictReason }) => unknown;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ERROR_NAMES = { 400: "BadRequestError", 403: "ForbiddenError", 404: "NotFoundError", 409: "ConflictError" } as const;
const RESPONDERS = { 400: "badRequest", 403: "forbidden", 404: "notFound", 409: "conflict" } as const;

function refuse(ctx: RecordValue, error: RequestNotesError): unknown {
  const details = conflictDetails(error.reason);
  const responder = ctx[RESPONDERS[error.status]];
  if (typeof responder === "function") return (responder as ErrorResponder).call(ctx, error.message, details);
  ctx.status = error.status;
  return { data: null, error: { status: error.status, name: ERROR_NAMES[error.status], message: error.message, ...(details ? { details } : {}) } };
}

function strapiInstance(): NotesStrapi {
  return globalThis.strapi as unknown as NotesStrapi;
}

/** The caller and the request, admitted by canUseRequestNotes; anything else is the one 404 (D-23). */
async function admit(ctx: RecordValue): Promise<{ caller: NotesCaller; request: NotesRequest }> {
  const params = isRecord(ctx.params) ? ctx.params : {};
  const state = isRecord(ctx.state) ? ctx.state : {};
  const identity = isRecord(state.idamboxUser) ? state.idamboxUser : {};
  const facts = isRecord(state.csrmAuthorization) ? state.csrmAuthorization : {};
  const caller: NotesCaller = {
    documentId: typeof identity.documentId === "string" ? identity.documentId : "",
    humanAnalyst: facts.humanAnalyst === true,
    canMarkAiInputs: facts.canMarkNoteAiInputs === true,
  };
  const requestDocumentId = typeof params.requestId === "string" ? params.requestId : "";
  const request = caller.documentId ? await loadNotesRequest(strapiInstance(), requestDocumentId) : null;
  if (!request || !canUseRequestNotes(request, caller)) throw new RequestNotesError(NOTES_NOT_FOUND, 404);
  return { caller, request };
}

const LIST_QUERY_KEYS = ["before", "limit"] as const;
const POSITIVE_INTEGER = /^[1-9]\d{0,8}$/;

/** The list query: `before` (a sequence, 1 or more) and `limit` (1 to 50) only; anything else is 400. */
function parseListQuery(query: unknown): { before?: number; limit?: number } {
  if (query === undefined || query === null) return {};
  const invalid = () => new RequestNotesError("CSRM request notes query is invalid.", 400);
  if (!isRecord(query) || Object.keys(query).some((key) => !(LIST_QUERY_KEYS as readonly string[]).includes(key))) throw invalid();
  const parsed: { before?: number; limit?: number } = {};
  for (const key of LIST_QUERY_KEYS) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !POSITIVE_INTEGER.test(value)) throw invalid();
    parsed[key] = Number(value);
  }
  if (parsed.limit !== undefined && parsed.limit > NOTES_PAGE_MAX) throw invalid();
  return parsed;
}

const requestNotesController = {
  async list(ctx: RecordValue) {
    try {
      const { caller, request } = await admit(ctx);
      const { notes, meta } = await listRequestNotes({ strapi: strapiInstance(), request, caller, ...parseListQuery(ctx.query) });
      return { data: notes, meta };
    } catch (error) {
      if (error instanceof RequestNotesError) return refuse(ctx, error);
      throw error;
    }
  },

  async create(ctx: RecordValue) {
    try {
      const { caller, request } = await admit(ctx);
      const body = isRecord(ctx.request) ? ctx.request.body : undefined;
      const data = await addRequestNote({ strapi: strapiInstance(), requestDocumentId: request.documentId, caller, body });
      return { data };
    } catch (error) {
      if (error instanceof RequestNotesError) return refuse(ctx, error);
      throw error;
    }
  },

  async markRead(ctx: RecordValue) {
    try {
      const { caller, request } = await admit(ctx);
      const body = isRecord(ctx.request) ? ctx.request.body : undefined;
      const data = await markRequestNotesRead({ strapi: strapiInstance(), requestDocumentId: request.documentId, caller, body });
      return { data };
    } catch (error) {
      if (error instanceof RequestNotesError) return refuse(ctx, error);
      throw error;
    }
  },

  /** PUT …/notes/{noteId}/ai_input (D-26): the human Security Analyst's mark; setNoteAiInput decides every rule. */
  async setAiInput(ctx: RecordValue) {
    try {
      const { caller, request } = await admit(ctx);
      const params = isRecord(ctx.params) ? ctx.params : {};
      const noteDocumentId = typeof params.noteId === "string" ? params.noteId : "";
      const body = isRecord(ctx.request) ? ctx.request.body : undefined;
      const data = await setNoteAiInput({ strapi: strapiInstance(), requestDocumentId: request.documentId, noteDocumentId, caller, body });
      return { data };
    } catch (error) {
      if (error instanceof RequestNotesError) return refuse(ctx, error);
      throw error;
    }
  },
};

export default requestNotesController;
