import { REVIEWABLE_REQUEST_STATUSES } from "../../csrm-assessment-request/services/collection-scope";

/*
 * Request notes (Phase 13 D-21 to D-24; docs/contract-gaps/phase-13-request-notes.md): the rules every notes path
 * decides with. Pure functions of facts the caller has already read, so the unit tests prove them without Strapi.
 */

/** A note body is 1 to 5,000 characters after trimming and normalising, by JavaScript string length. */
export const NOTE_BODY_MAX_LENGTH = 5_000;
/** The most notes one request holds; the next is refused with NOTES_LIMIT_REACHED, counted under the lock. */
export const NOTES_PER_REQUEST_MAX = 500;
/** A thread page: the newest 20 by default, never more than 50. */
export const NOTES_PAGE_DEFAULT = 20;
export const NOTES_PAGE_MAX = 50;

/** The author's part on the request, stored as `authorPart`. */
export const NOTE_PARTS = ["requestor", "security-analyst"] as const;
export type NotePart = (typeof NOTE_PARTS)[number];

/** Why a request takes no new note: never submitted, returned to draft (06.1), or released or closed. */
export type NotesClosedReason = "not-submitted" | "returned-to-draft" | "released";

const ACCEPTING_STATUSES: ReadonlySet<string> = new Set(REVIEWABLE_REQUEST_STATUSES);

/**
 * The posting window (D-22): a request takes a new note exactly while it is reviewable, from its first submission
 * until its assessment is released or it is closed. A status a later phase adds before closure joins
 * REVIEWABLE_REQUEST_STATUSES, and so this predicate; no second window check exists.
 */
export function acceptsNotes(requestStatus: unknown): boolean {
  return typeof requestStatus === "string" && ACCEPTING_STATUSES.has(requestStatus);
}

/** Why the window is shut, for the web to replace the composer with (null while it is open). */
export function notesClosedReason(request: { requestStatus: unknown; revertedAt?: unknown }): NotesClosedReason | null {
  if (acceptsNotes(request.requestStatus)) return null;
  if (request.requestStatus === "draft") {
    return request.revertedAt !== null && request.revertedAt !== undefined && request.revertedAt !== "" ? "returned-to-draft" : "not-submitted";
  }
  return "released";
}

export type NotesCaller = {
  /** The resolved IdamBox User's documentId (`ctx.state.idamboxUser`). */
  documentId: string;
  /** The policy's fact: the caller holds this operation through the human Security Analyst role. */
  humanAnalyst: boolean;
  /**
   * The policy's `canMarkNoteAiInputs` fact (WR-101, WR-102): the caller holds the AI-input mark operation itself through
   * the human Security Analyst role and is an eligible person. The mark is set or offered on this alone, never on the
   * notes grant. Absent is false.
   */
  canMarkAiInputs?: boolean;
};

/**
 * Who may use a request's notes (D-23, G-12): the request's requestor, through either grant, then any human Security
 * Analyst. Everyone else, another Requestor, the Security Analyst Agent on another person's request and a participant
 * who is not the requestor, gets the refusal a missing record gets (404).
 *
 * It is separate from the request read on purpose. Phase 17's participant read of the request summary (a nominated
 * risk owner, an executive approver) never reaches notes through this predicate: it reads no participant fact, and
 * widening it to participants needs its own decision.
 */
export function canUseRequestNotes(request: { requestorDocumentId: string | null }, caller: NotesCaller): boolean {
  if (typeof caller.documentId !== "string" || caller.documentId.length === 0) return false;
  if (request.requestorDocumentId !== null && request.requestorDocumentId === caller.documentId) return true;
  return caller.humanAnalyst === true;
}

/**
 * The part a note is posted in (G-1): the requestor's, for the request's requestor, whatever role they hold, so a
 * Security Analyst who raised the request writes as its Requestor; otherwise the Security Analysts'.
 */
export function authorPartFor(request: { requestorDocumentId: string | null }, caller: { documentId: string }): NotePart {
  return request.requestorDocumentId !== null && request.requestorDocumentId === caller.documentId ? "requestor" : "security-analyst";
}

/**
 * The unread rule (D-24), by sequence and never by time: a note is unread for a viewer when it was written in the other
 * part, not by the viewer, and above the viewer's lastReadSequence (0 when they have no read state).
 */
export function isUnreadNote(
  note: { authorPart: unknown; authorDocumentId: string | null; sequence: number },
  viewer: { part: NotePart; documentId: string; lastReadSequence: number },
): boolean {
  return note.authorPart !== viewer.part
    && note.authorDocumentId !== viewer.documentId
    && note.sequence > viewer.lastReadSequence;
}

export class NoteBodyError extends Error {
  constructor() {
    super("CSRM request note data is invalid.");
    this.name = "NoteBodyError";
  }
}

/* C0 control characters other than tab and newline (CR is normalised to LF first). */
const DISALLOWED_CONTROL = /[\u0000-\u0008\u000b-\u001f]/;

/**
 * A note's body as stored (T-13-19): CRLF and CR normalised to LF, trimmed, 1 to 5,000 characters by JavaScript
 * string length (so the web's check and the server agree), and no control character other than tab and newline.
 * The text is plain: nothing ever renders it as HTML or Markdown.
 */
export function parseNoteBody(value: unknown): string {
  if (typeof value !== "string") throw new NoteBodyError();
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (body.length < 1 || body.length > NOTE_BODY_MAX_LENGTH || DISALLOWED_CONTROL.test(body)) throw new NoteBodyError();
  return body;
}
