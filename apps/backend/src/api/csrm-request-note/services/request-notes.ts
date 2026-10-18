import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { withRequestLock, type RequestLockStrapi } from "../../csrm-assessment-request/services/request-lock";
import { PERSON_FIELDS, projectPerson, type Person } from "../../csrm-assessment-request/services/request-people";
import { NOTE_AI_INPUT_LOG_SCHEMA_VERSION, NoteAiInputLogError, appendNoteAiInputEvent } from "./note-ai-input-log";
import {
  NOTES_PAGE_DEFAULT,
  NOTES_PAGE_MAX,
  NOTES_PER_REQUEST_MAX,
  acceptsNotes,
  authorPartFor,
  canUseRequestNotes,
  isUnreadNote,
  notesClosedReason,
  parseNoteBody,
  NoteBodyError,
  type NotePart,
  type NotesCaller,
  type NotesClosedReason,
} from "./request-notes-policy";

/*
 * Request notes (Phase 13 D-21 to D-24; docs/contract-gaps/phase-13-request-notes.md): list a request's thread, add a
 * note and mark the thread read. The controller has already admitted the caller with canUseRequestNotes; every write
 * runs inside withRequestLock (request-lock.ts) and re-reads, after the lock, everything it decides on. Every read in
 * the lock is a Document Service call, which joins the lock's transaction.
 *
 * Neither notes content type is in the generated Strapi types until they are regenerated, so the Document Service is
 * reached through the csrm-ai-run cast pattern (`strapi.documents as unknown as (uid: string) => …`).
 */

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";
const READ_STATE_UID = "api::csrm-request-note.csrm-request-note-read-state";
const MAX_ID_LENGTH = 255;
const INVALID = "CSRM request note data is invalid.";
export const NOTES_NOT_FOUND = "CSRM request notes were not found.";

type RecordValue = Record<string, unknown>;

type NotesDocuments = {
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  findFirst: (query: RecordValue) => Promise<RecordValue | null>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  count: (query: RecordValue) => Promise<number>;
  create: (query: RecordValue) => Promise<RecordValue>;
  update: (query: RecordValue) => Promise<RecordValue>;
};

export type NotesStrapi = RequestLockStrapi & { documents: unknown };

function documents(strapi: NotesStrapi, uid: string): NotesDocuments {
  return (strapi.documents as unknown as (uid: string) => NotesDocuments)(uid);
}

export class RequestNotesError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly reason?: ConflictReason,
  ) {
    super(message);
    this.name = "RequestNotesError";
  }
}

/** The request facts every notes decision reads. */
export type NotesRequest = {
  documentId: string;
  requestorDocumentId: string | null;
  requestStatus: unknown;
  revertedAt: unknown;
};

export type RequestNote = {
  documentId: string;
  sequence: number;
  body: string;
  authorPart: NotePart;
  author: Person | null;
  postedAt: string;
  unread: boolean;
  /** Present for a human Security Analyst only: the Requestor never sees the AI-input mark (D-26). */
  changesAiInputs?: boolean;
};

export type RequestNotesMeta = {
  total: number;
  unread: number;
  lastReadSequence: number;
  hasEarlier: boolean;
  accepting: boolean;
  closedReason: NotesClosedReason | null;
  viewerPart: NotePart;
  canMarkAiInputs: boolean;
};

export type RequestNotesReadState = { lastReadSequence: number; unread: number };

type Viewer = { part: NotePart; documentId: string; lastReadSequence: number; humanAnalyst: boolean };

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relationId(value: unknown): string | null {
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0 ? value.documentId : null;
}

function exactKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function instant(value: unknown): string {
  const date = typeof value === "string" || typeof value === "number" || value instanceof Date ? new Date(value) : new Date(Number.NaN);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function integer(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) ? number : 0;
}

const REQUEST_READ = { fields: ["requestStatus", "revertedAt"], populate: { requestor: { fields: ["documentId"] } } } as const;

/** The request with the facts the notes rules read, or null when it does not exist. */
export async function loadNotesRequest(strapi: NotesStrapi, requestDocumentId: string): Promise<NotesRequest | null> {
  if (!requestDocumentId || requestDocumentId.length > MAX_ID_LENGTH) return null;
  const request = await documents(strapi, REQUEST_UID).findOne({ documentId: requestDocumentId, ...REQUEST_READ });
  if (!request) return null;
  return {
    documentId: requestDocumentId,
    requestorDocumentId: relationId(request.requestor),
    requestStatus: request.requestStatus,
    revertedAt: request.revertedAt ?? null,
  };
}

const NOTE_READ = {
  fields: ["documentId", "sequence", "body", "authorPart", "postedAt", "changesAiInputs"],
  populate: { author: { fields: [...PERSON_FIELDS] } },
} as const;

/** One note as the caller may see it: the author by documentId and display name only, the mark for analysts only. */
export function projectNote(note: RecordValue, viewer: Viewer): RequestNote {
  const author = projectPerson(note.author);
  const sequence = integer(note.sequence);
  const authorPart = note.authorPart === "requestor" ? "requestor" : "security-analyst";
  return {
    documentId: String(note.documentId),
    sequence,
    body: typeof note.body === "string" ? note.body : "",
    authorPart,
    author,
    postedAt: instant(note.postedAt),
    unread: isUnreadNote({ authorPart, authorDocumentId: author?.documentId ?? null, sequence }, viewer),
    ...(viewer.humanAnalyst ? { changesAiInputs: note.changesAiInputs === true } : {}),
  };
}

function onRequest(requestDocumentId: string): RecordValue {
  return { assessmentRequest: { documentId: { $eq: requestDocumentId } } };
}

async function readStateOf(strapi: NotesStrapi, requestDocumentId: string, readerDocumentId: string): Promise<RecordValue | null> {
  return documents(strapi, READ_STATE_UID).findFirst({
    filters: { ...onRequest(requestDocumentId), reader: { documentId: { $eq: readerDocumentId } } },
    fields: ["documentId", "lastReadSequence"],
    sort: ["id:asc"],
  });
}

/**
 * The viewer's unread count over the whole thread, by the unread rule (D-24). A note whose author link is gone is not
 * the viewer's, so it counts, as its own row's flag says (WR-103): a relation filter alone would drop it on the join.
 */
async function countUnread(strapi: NotesStrapi, requestDocumentId: string, viewer: Viewer): Promise<number> {
  return documents(strapi, NOTE_UID).count({
    filters: {
      ...onRequest(requestDocumentId),
      authorPart: { $ne: viewer.part },
      sequence: { $gt: viewer.lastReadSequence },
      $or: [{ author: { documentId: { $ne: viewer.documentId } } }, { author: { documentId: { $null: true } } }],
    },
  });
}

async function viewerOf(strapi: NotesStrapi, request: NotesRequest, caller: NotesCaller): Promise<Viewer> {
  const state = await readStateOf(strapi, request.documentId, caller.documentId);
  return {
    part: authorPartFor(request, caller),
    documentId: caller.documentId,
    lastReadSequence: state ? integer(state.lastReadSequence) : 0,
    humanAnalyst: caller.humanAnalyst === true,
  };
}

export type NotesPage = { notes: RequestNote[]; meta: RequestNotesMeta };

/**
 * How many notes a request holds (D-21). The request delete counts them inside withRequestLock, through the Document
 * Service so the count joins the lock's transaction, and refuses with REQUEST_HAS_NOTES above zero.
 */
export async function countRequestNotes(strapi: NotesStrapi, requestDocumentId: string): Promise<number> {
  return integer(await documents(strapi, NOTE_UID).count({ filters: onRequest(requestDocumentId) }));
}

/** The request read's notes figures for one viewer (D-24, D-25), by the same unread rule as the thread. */
export type RequestNotesSummary = {
  total: number;
  unread: number;
  accepting: boolean;
  closedReason: NotesClosedReason | null;
};

/**
 * The viewer's notes summary for the request read (D-24, D-25; T-13-24): how many notes the request holds, how many are
 * new to the viewer, and whether it takes a new note and why not. A viewer canUseRequestNotes refuses gets null, and
 * nothing about the notes is read for them, so a later widening of the request read never discloses the thread's
 * size. It writes nothing: reading a request never marks a note read.
 */
export async function summarizeRequestNotes(strapi: NotesStrapi, request: NotesRequest, caller: NotesCaller): Promise<RequestNotesSummary | null> {
  if (!canUseRequestNotes(request, caller)) return null;
  const viewer = await viewerOf(strapi, request, caller);
  return {
    total: await countRequestNotes(strapi, request.documentId),
    unread: await countUnread(strapi, request.documentId, viewer),
    accepting: acceptsNotes(request.requestStatus),
    closedReason: notesClosedReason(request),
  };
}

/**
 * GET …/notes (D-21, D-24): one page of the thread, oldest first, the newest `limit` notes before the `before`
 * sequence (all of them when absent), with the viewer's unread count and read state. It writes nothing.
 */
export async function listRequestNotes(input: {
  strapi: NotesStrapi;
  request: NotesRequest;
  caller: NotesCaller;
  before?: number;
  limit?: number;
}): Promise<NotesPage> {
  const { strapi, request, caller } = input;
  const limit = Math.min(Math.max(input.limit ?? NOTES_PAGE_DEFAULT, 1), NOTES_PAGE_MAX);
  const viewer = await viewerOf(strapi, request, caller);
  const notes = documents(strapi, NOTE_UID);
  const page = await notes.findMany({
    filters: { ...onRequest(request.documentId), ...(input.before === undefined ? {} : { sequence: { $lt: input.before } }) },
    ...NOTE_READ,
    sort: ["sequence:desc", "id:desc"],
    limit: limit + 1,
  });
  const accepting = acceptsNotes(request.requestStatus);
  return {
    notes: page.slice(0, limit).reverse().map((note) => projectNote(note, viewer)),
    meta: {
      total: await notes.count({ filters: onRequest(request.documentId) }),
      unread: await countUnread(strapi, request.documentId, viewer),
      lastReadSequence: viewer.lastReadSequence,
      hasEarlier: page.length > limit,
      accepting,
      closedReason: notesClosedReason(request),
      viewerPart: viewer.part,
      // WR-101, WR-102: offered exactly where the mark is taken, on the mark's own grant and eligibility.
      canMarkAiInputs: viewer.humanAnalyst && caller.canMarkAiInputs === true && viewer.part === "security-analyst" && accepting,
    },
  };
}

/**
 * The published create body, exactly: `{ data: { body, changesAiInputs? } }`; anything else, a server-owned key such
 * as `sequence` or `postedAt` included, is 400.
 */
export function parseNoteCreate(body: unknown): { body: string; changesAiInputs?: boolean } {
  if (!isRecord(body) || !exactKeys(body, ["data"]) || !isRecord(body.data) || !exactKeys(body.data, ["body", "changesAiInputs"])) {
    throw new RequestNotesError(INVALID, 400);
  }
  const mark = body.data.changesAiInputs;
  if (mark !== undefined && typeof mark !== "boolean") throw new RequestNotesError(INVALID, 400);
  try {
    return { body: parseNoteBody(body.data.body), ...(mark === undefined ? {} : { changesAiInputs: mark }) };
  } catch (error) {
    if (error instanceof NoteBodyError) throw new RequestNotesError(INVALID, 400);
    throw error;
  }
}

/** Re-reads the request inside the lock: gone, or no longer usable by the caller, is the same 404. */
async function lockedRequest(strapi: NotesStrapi, requestDocumentId: string, caller: NotesCaller): Promise<NotesRequest> {
  const request = await loadNotesRequest(strapi, requestDocumentId);
  if (!request || !canUseRequestNotes(request, caller)) throw new RequestNotesError(NOTES_NOT_FOUND, 404);
  return request;
}

/**
 * POST …/notes (D-21, D-22, D-26): appends one note. Under the request lock the request is re-read, then, in order:
 *
 *   the request is gone or no longer the caller's to use     404
 *   the AI-input mark from the request's requestor:
 *     a Security Analyst who raised it (G-1)                 403 OWN_REQUEST
 *     a Requestor, who never sets or sees the mark           400
 *   the AI-input mark from anyone without the mark's own
 *     grant or who is not an eligible person (WR-101, -102)  403
 *   the request takes no new note (acceptsNotes)            409 NOTES_CLOSED
 *   the request already holds 500 notes                     409 NOTES_LIMIT_REACHED
 *
 * The count and the highest sequence are read after the lock, so the cap is exact and concurrent posts get 1, 2, 3 …
 * with no gap or duplicate. `postedAt` is the server's clock and `authorPart` is fixed by authorPartFor. A note
 * posted with the mark records it as its first AI-input event, in the same create.
 */
export async function addRequestNote(input: {
  strapi: NotesStrapi;
  requestDocumentId: string;
  caller: NotesCaller;
  body: unknown;
  now?: Date;
}): Promise<RequestNote> {
  const { strapi, requestDocumentId, caller } = input;
  const create = parseNoteCreate(input.body);
  return withRequestLock(strapi, requestDocumentId, async () => {
    const request = await lockedRequest(strapi, requestDocumentId, caller);
    const part = authorPartFor(request, caller);
    if (create.changesAiInputs !== undefined && part === "requestor") {
      if (caller.humanAnalyst) throw new RequestNotesError("CSRM request note AI-input mark is denied.", 403, "OWN_REQUEST");
      throw new RequestNotesError(INVALID, 400);
    }
    // WR-102: guarded exactly as the mark operation is, by the mark's own grant through the human role, never the notes grant.
    if (create.changesAiInputs !== undefined && caller.canMarkAiInputs !== true) {
      throw new RequestNotesError("CSRM request note AI-input mark is denied.", 403);
    }
    if (!acceptsNotes(request.requestStatus)) throw new RequestNotesError("CSRM request notes are closed.", 409, "NOTES_CLOSED");
    const notes = documents(strapi, NOTE_UID);
    if (await notes.count({ filters: onRequest(requestDocumentId) }) >= NOTES_PER_REQUEST_MAX) {
      throw new RequestNotesError("CSRM request notes have reached their limit.", 409, "NOTES_LIMIT_REACHED");
    }
    const last = await notes.findFirst({ filters: onRequest(requestDocumentId), fields: ["sequence"], sort: ["sequence:desc"] });
    const postedAt = (input.now ?? new Date()).toISOString();
    const changesAiInputs = create.changesAiInputs === true;
    const created = await notes.create({
      data: {
        body: create.body,
        authorPart: part,
        sequence: (last ? integer(last.sequence) : 0) + 1,
        postedAt,
        changesAiInputs,
        aiInputLog: changesAiInputs
          ? appendNoteAiInputEvent(null, { schemaVersion: NOTE_AI_INPUT_LOG_SCHEMA_VERSION, by: caller.documentId, at: postedAt, from: false, to: true })
          : null,
        assessmentRequest: requestDocumentId,
        author: caller.documentId,
      },
      ...NOTE_READ,
    });
    return projectNote(created, { part, documentId: caller.documentId, lastReadSequence: 0, humanAnalyst: caller.humanAnalyst === true });
  });
}

/** The published read body, exactly: `{ data: { throughNoteId } }`; anything else is 400. */
export function parseNotesRead(body: unknown): { throughNoteId: string } {
  if (!isRecord(body) || !exactKeys(body, ["data"]) || !isRecord(body.data) || !exactKeys(body.data, ["throughNoteId"])) {
    throw new RequestNotesError(INVALID, 400);
  }
  const id = body.data.throughNoteId;
  if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH || id.trim() !== id) throw new RequestNotesError(INVALID, 400);
  return { throughNoteId: id };
}

/**
 * POST …/notes/read (D-24): the caller has read the thread through one note of this request. Under the request lock
 * the caller's one read state for the request is found, then created or advanced; it only ever increases, so naming an
 * earlier note changes nothing and succeeds. A note that is not on this request is 404.
 */
export async function markRequestNotesRead(input: {
  strapi: NotesStrapi;
  requestDocumentId: string;
  caller: NotesCaller;
  body: unknown;
  now?: Date;
}): Promise<RequestNotesReadState> {
  const { strapi, requestDocumentId, caller } = input;
  const { throughNoteId } = parseNotesRead(input.body);
  return withRequestLock(strapi, requestDocumentId, async () => {
    const request = await lockedRequest(strapi, requestDocumentId, caller);
    const note = await documents(strapi, NOTE_UID).findFirst({
      filters: { ...onRequest(requestDocumentId), documentId: { $eq: throughNoteId } },
      fields: ["sequence"],
    });
    if (!note) throw new RequestNotesError(NOTES_NOT_FOUND, 404);
    const through = integer(note.sequence);
    const states = documents(strapi, READ_STATE_UID);
    const state = await readStateOf(strapi, requestDocumentId, caller.documentId);
    const at = (input.now ?? new Date()).toISOString();
    let lastReadSequence = state ? integer(state.lastReadSequence) : 0;
    if (!state) {
      await states.create({ data: { lastReadSequence: through, lastReadAt: at, reader: caller.documentId, assessmentRequest: requestDocumentId } });
      lastReadSequence = through;
    } else if (through > lastReadSequence) {
      await states.update({ documentId: String(state.documentId), data: { lastReadSequence: through, lastReadAt: at } });
      lastReadSequence = through;
    }
    const viewer: Viewer = { part: authorPartFor(request, caller), documentId: caller.documentId, lastReadSequence, humanAnalyst: caller.humanAnalyst === true };
    return { lastReadSequence, unread: await countUnread(strapi, requestDocumentId, viewer) };
  });
}

/** The published mark body, exactly: `{ data: { changesAiInputs: boolean } }`; anything else is 400. */
export function parseNoteAiInput(body: unknown): { changesAiInputs: boolean } {
  if (!isRecord(body) || !exactKeys(body, ["data"]) || !isRecord(body.data) || !exactKeys(body.data, ["changesAiInputs"])) {
    throw new RequestNotesError(INVALID, 400);
  }
  if (typeof body.data.changesAiInputs !== "boolean") throw new RequestNotesError(INVALID, 400);
  return { changesAiInputs: body.data.changesAiInputs };
}

/**
 * PUT …/notes/{noteId}/ai_input (D-26, D-07, D-30): a human Security Analyst sets or clears the AI-input mark on any
 * note of a request they did not raise, the Requestor's included. The policy has already refused everyone without the
 * human-only grant. Under the request lock the request and the note are re-read, then, in order:
 *
 *   the request is gone, no longer the caller's to use, or the note is not on it     404
 *   the caller raised the request (G-1)                                              403 OWN_REQUEST
 *   the caller is not an eligible human Security Analyst holding the mark (WR-101)   403
 *   the request takes no new note (acceptsNotes), so the mark is frozen              409 NOTES_CLOSED
 *   the mark already has the value                                                   200, nothing written
 *   the log is full (200 events) or cannot be read                                   409 HISTORY_UNAVAILABLE
 *
 * Otherwise the mark changes and one `{ schemaVersion: 1, by, at, from, to }` event is appended in the same update, so
 * the mark never changes without its audit record. Undo is a second change. The answer is the analyst's projection.
 */
export async function setNoteAiInput(input: {
  strapi: NotesStrapi;
  requestDocumentId: string;
  noteDocumentId: string;
  caller: NotesCaller;
  body: unknown;
  now?: Date;
}): Promise<RequestNote> {
  const { strapi, requestDocumentId, caller } = input;
  const { changesAiInputs } = parseNoteAiInput(input.body);
  const noteDocumentId = input.noteDocumentId;
  if (!noteDocumentId || noteDocumentId.length > MAX_ID_LENGTH) throw new RequestNotesError(NOTES_NOT_FOUND, 404);
  return withRequestLock(strapi, requestDocumentId, async () => {
    const request = await lockedRequest(strapi, requestDocumentId, caller);
    const notes = documents(strapi, NOTE_UID);
    const note = await notes.findFirst({
      filters: { ...onRequest(requestDocumentId), documentId: { $eq: noteDocumentId } },
      fields: [...NOTE_READ.fields, "aiInputLog"],
      populate: NOTE_READ.populate,
    });
    if (!note) throw new RequestNotesError(NOTES_NOT_FOUND, 404);
    const part = authorPartFor(request, caller);
    if (part === "requestor") throw new RequestNotesError("CSRM request note AI-input mark is denied.", 403, "OWN_REQUEST");
    if (caller.humanAnalyst !== true || caller.canMarkAiInputs !== true) throw new RequestNotesError("CSRM request note AI-input mark is denied.", 403);
    if (!acceptsNotes(request.requestStatus)) throw new RequestNotesError("CSRM request notes are closed.", 409, "NOTES_CLOSED");

    const state = await readStateOf(strapi, requestDocumentId, caller.documentId);
    const viewer: Viewer = { part, documentId: caller.documentId, lastReadSequence: state ? integer(state.lastReadSequence) : 0, humanAnalyst: true };
    const current = note.changesAiInputs === true;
    if (current === changesAiInputs) return projectNote(note, viewer);

    let aiInputLog;
    try {
      aiInputLog = appendNoteAiInputEvent(note.aiInputLog ?? null, {
        schemaVersion: NOTE_AI_INPUT_LOG_SCHEMA_VERSION,
        by: caller.documentId,
        at: (input.now ?? new Date()).toISOString(),
        from: current,
        to: changesAiInputs,
      });
    } catch (error) {
      if (error instanceof NoteAiInputLogError) {
        throw new RequestNotesError("CSRM request note AI-input history is unavailable.", 409, "HISTORY_UNAVAILABLE");
      }
      throw error;
    }
    const updated = await notes.update({ documentId: noteDocumentId, data: { changesAiInputs, aiInputLog }, ...NOTE_READ });
    return projectNote(updated, viewer);
  });
}
