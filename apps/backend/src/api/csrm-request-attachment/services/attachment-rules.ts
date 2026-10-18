import type { AiPolicyDecision } from "../../../csrm/ai/data-policy";
import { ATTACHMENT_LIMITS, TEXT_BEARING_ATTACHMENT_TYPES } from "../../../csrm/files/attachment-policy";
import { RELEASED_REQUEST_STATUSES } from "../../csrm-assessment-request/services/collection-scope";
import { acceptsNotes } from "../../csrm-request-note/services/request-notes-policy";

/*
 * Request attachments (Phase 14 D-10, D-16 to D-19; docs/contract-gaps/phase-14-request-attachments.md, "Window and
 * Notes", "Readers and Actors"): the rules every attachment path decides with. Pure functions of facts the caller has
 * already read, so the unit tests prove them without Strapi. Every gate reads current facts only (`scanStatus`,
 * `removedAt`, the media relation, `note`, the request's status), never the event log.
 */

/**
 * When files may be added, removed, restored or included (D-16):
 *
 * - `intake`: a draft, never submitted or returned to draft; only its requestor acts, with no note.
 * - `after-submission`: exactly while `acceptsNotes` holds; the requestor and any human Security Analyst act, each
 *   file posted with the caller's own note.
 * - `closed`: released or closed, read-only; and any status neither of the above names, so an unknown status fails
 *   closed.
 */
export type AttachmentWindow = "intake" | "after-submission" | "closed";

/** The released and closed statuses (`approved`, and `closed` from Phase 17.1, G-13): read-only. */
export const ATTACHMENTS_CLOSED_STATUSES: readonly string[] = RELEASED_REQUEST_STATUSES;

export function attachmentWindow(request: { requestStatus: unknown }): AttachmentWindow {
  if (request.requestStatus === "draft") return "intake";
  if (acceptsNotes(request.requestStatus)) return "after-submission";
  // ATTACHMENTS_CLOSED_STATUSES, and any status no rule names, so an unknown status fails closed.
  return "closed";
}

/** The request facts the attachment rules read. */
export type AttachmentRequestFacts = { requestorDocumentId: string | null; requestStatus: unknown };

/**
 * The caller facts the attachment rules read: the resolved IdamBox User and the policy's human-analyst fact, and the
 * policy's `canUseAttachmentAiInputs` fact (D-28, D-30): the caller holds the AI inclusion itself through the human
 * Security Analyst role and is an eligible person. Absent is false.
 */
export type AttachmentCaller = { documentId: string; humanAnalyst: boolean; aiInputs?: boolean };

function isRequestor(request: { requestorDocumentId: string | null }, caller: { documentId: string }): boolean {
  return typeof caller.documentId === "string" && caller.documentId.length > 0 && request.requestorDocumentId === caller.documentId;
}

/**
 * The readers predicate's inputs (D-18): Phase 13's canUseRequestNotes is called with exactly these two objects, so no
 * participant fact (Phase 17's risk owner or executive approver) can reach it and widen who reads the files.
 */
export function readersRequestFacts(request: { requestorDocumentId: string | null }): { requestorDocumentId: string | null } {
  return { requestorDocumentId: request.requestorDocumentId };
}

export function readersCallerFacts(caller: AttachmentCaller): { documentId: string; humanAnalyst: boolean } {
  return { documentId: caller.documentId, humanAnalyst: caller.humanAnalyst === true };
}

/**
 * Whether the caller may add a file to the request now (D-16, D-19), before the limits: its requestor at intake and
 * after submission, any human Security Analyst after submission, nobody once it is closed. The caller is already a
 * reader (canUseRequestNotes), so anyone else never reaches this.
 */
export function acceptsAttachments(request: AttachmentRequestFacts, caller: AttachmentCaller): boolean {
  const window = attachmentWindow(request);
  if (window === "closed") return false;
  if (isRequestor(request, caller)) return true;
  return window === "after-submission" && caller.humanAnalyst === true;
}

/** The closed reasons an add is refused with before its file is read (D-10, D-15, D-16). */
export type AttachmentAddRefusal =
  | "ATTACHMENTS_NOT_CONFIGURED"
  | "ATTACHMENTS_CLOSED"
  | "REQUEST_NOT_SUBMITTED"
  | "ATTACHMENT_LIMIT_REACHED"
  | "ATTACHMENT_LIFETIME_LIMIT_REACHED";

/**
 * Why the caller may not add a file now, or null (D-10, D-15, D-16), in this order:
 *
 *   storage or scanning is not configured                                      ATTACHMENTS_NOT_CONFIGURED
 *   acceptsAttachments refuses (IN-103, D-16's one predicate):
 *     the request is a draft and the caller is not its requestor               REQUEST_NOT_SUBMITTED
 *     the request is released or closed, or after submission the caller is
 *     neither its requestor nor a human Security Analyst (never a reader, so
 *     never served this)                                                       ATTACHMENTS_CLOSED
 *   the request holds 20 active files (available or awaiting the scan)         ATTACHMENT_LIMIT_REACHED
 *   the request holds 60 files, removed and blocked ones included              ATTACHMENT_LIFETIME_LIMIT_REACHED
 */
export function addRefusalFor(input: {
  request: AttachmentRequestFacts;
  caller: AttachmentCaller;
  activeCount: number;
  storedCount: number;
  configured: boolean;
}): AttachmentAddRefusal | null {
  if (!input.configured) return "ATTACHMENTS_NOT_CONFIGURED";
  // The window and the caller are acceptsAttachments' decision, never a second copy of it.
  if (!acceptsAttachments(input.request, input.caller)) return attachmentWindow(input.request) === "intake" ? "REQUEST_NOT_SUBMITTED" : "ATTACHMENTS_CLOSED";
  if (input.activeCount >= ATTACHMENT_LIMITS.maxActivePerRequest) return "ATTACHMENT_LIMIT_REACHED";
  if (input.storedCount >= ATTACHMENT_LIMITS.maxStoredPerRequest) return "ATTACHMENT_LIFETIME_LIMIT_REACHED";
  return null;
}

/** How long after its posting a note still takes files (D-17): the composer can finish and retry its uploads. */
export const ATTACHMENT_NOTE_WINDOW_MS = ATTACHMENT_LIMITS.noteWindowMinutes * 60_000;

/** The note facts the note rule reads: the request it is on, its author and its server posting time. */
export type AttachmentNoteFacts = { requestDocumentId: string | null; authorDocumentId: string | null; postedAt: unknown };

/**
 * Whether a file may be posted with this note (D-17): only the caller's own note on the same request, posted at most
 * 60 minutes ago, so nobody can slip a file into an old note the other party has already read. A missing note, a
 * note on another request, someone else's note, one past its window and one with no readable time are all refused.
 */
export function noteAcceptsAttachments(input: {
  note: AttachmentNoteFacts | null;
  requestId: string;
  callerId: string;
  now: Date;
}): "ATTACHMENT_NOTE_INVALID" | null {
  const { note } = input;
  if (!note) return "ATTACHMENT_NOTE_INVALID";
  if (note.requestDocumentId === null || note.requestDocumentId !== input.requestId) return "ATTACHMENT_NOTE_INVALID";
  if (note.authorDocumentId === null || input.callerId.length === 0 || note.authorDocumentId !== input.callerId) return "ATTACHMENT_NOTE_INVALID";
  const postedAt = typeof note.postedAt === "string" || note.postedAt instanceof Date ? new Date(note.postedAt).getTime() : Number.NaN;
  const age = input.now.getTime() - postedAt;
  if (!Number.isFinite(age) || age < 0 || age > ATTACHMENT_NOTE_WINDOW_MS) return "ATTACHMENT_NOTE_INVALID";
  return null;
}

/** A file's state as readers see it (D-13, D-20, D-21). */
export type AttachmentState = "removed" | "blocked" | "pending" | "unavailable" | "available";

/** The record facts a state is decided from. `hasFile` is whether the media relation still names a file record. */
export type AttachmentRecordFacts = { scanStatus: unknown; removedAt: unknown; hasFile: boolean };

function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/**
 * The state, in this precedence: removed, then blocked, then pending (quarantined), then unavailable (a clean file
 * whose stored bytes are gone, after a Media Library delete), then available. Anything not clean is never available.
 */
export function attachmentStateOf(record: AttachmentRecordFacts): AttachmentState {
  if (isSet(record.removedAt)) return "removed";
  if (record.scanStatus === "blocked") return "blocked";
  if (record.scanStatus !== "clean") return "pending";
  if (!record.hasFile) return "unavailable";
  return "available";
}

/** The scan statuses a file counts against the active limit in (D-10): awaiting the scan, or clean. */
export const ACTIVE_ATTACHMENT_SCAN_STATUSES = Object.freeze(["pending", "clean"] as const);

const ACTIVE_SCAN_STATUSES: ReadonlySet<unknown> = new Set(ACTIVE_ATTACHMENT_SCAN_STATUSES);

/** Whether a record counts against the active limit: pending or clean, and not removed (D-10). */
export function isActiveAttachment(record: { scanStatus: unknown; removedAt: unknown }): boolean {
  return !isSet(record.removedAt) && ACTIVE_SCAN_STATUSES.has(record.scanStatus);
}

/**
 * isActiveAttachment as the query engine's filter, which the limits' active count reads (D-16's one predicate,
 * IN-103): the same statuses, and no removal time. A mounted test runs both over the same rows.
 */
export const ACTIVE_ATTACHMENT_WHERE = Object.freeze({
  scanStatus: { $in: [...ACTIVE_ATTACHMENT_SCAN_STATUSES] },
  removedAt: { $null: true },
});

/** The attachment facts the removal and restore rules read. */
export type AttachmentActorFacts = {
  uploadedByDocumentId: string | null;
  removedByDocumentId: string | null;
  scanStatus: unknown;
  removedAt: unknown;
};

/**
 * Why the caller may not remove the file, or null (D-19, D-20): the window is closed; a draft's file is its
 * requestor's alone; the uploader removes their own files; a human Security Analyst who is not the requestor removes
 * any file after submission; anyone else is NOT_UPLOADER.
 */
export function canRemoveAttachment(input: {
  request: AttachmentRequestFacts;
  caller: AttachmentCaller;
  attachment: AttachmentActorFacts;
}): "ATTACHMENTS_CLOSED" | "REQUEST_NOT_SUBMITTED" | "NOT_UPLOADER" | null {
  const window = attachmentWindow(input.request);
  if (window === "closed") return "ATTACHMENTS_CLOSED";
  const requestor = isRequestor(input.request, input.caller);
  if (window === "intake" && !requestor) return "REQUEST_NOT_SUBMITTED";
  if (input.attachment.uploadedByDocumentId !== null && input.attachment.uploadedByDocumentId === input.caller.documentId) return null;
  if (!requestor && input.caller.humanAnalyst === true && window === "after-submission") return null;
  return "NOT_UPLOADER";
}

/**
 * Why the caller may not restore the file, or null (D-19, D-20): the window rules as for removal, then only the
 * remover restores, a blocked file never returns, and a restore never makes a 21st active file.
 */
export function canRestoreAttachment(input: {
  request: AttachmentRequestFacts;
  caller: AttachmentCaller;
  attachment: AttachmentActorFacts;
  activeCount: number;
}): "ATTACHMENTS_CLOSED" | "REQUEST_NOT_SUBMITTED" | "NOT_REMOVER" | "ATTACHMENT_BLOCKED" | "ATTACHMENT_LIMIT_REACHED" | null {
  const window = attachmentWindow(input.request);
  if (window === "closed") return "ATTACHMENTS_CLOSED";
  if (window === "intake" && !isRequestor(input.request, input.caller)) return "REQUEST_NOT_SUBMITTED";
  if (input.attachment.removedByDocumentId === null || input.attachment.removedByDocumentId !== input.caller.documentId) return "NOT_REMOVER";
  if (input.attachment.scanStatus === "blocked") return "ATTACHMENT_BLOCKED";
  if (input.activeCount >= ATTACHMENT_LIMITS.maxActivePerRequest) return "ATTACHMENT_LIMIT_REACHED";
  return null;
}

/*
 * AI inclusion (D-30, D-31; docs/contract-gaps/phase-14-request-attachments.md, "AI Inclusion and Extracted Text").
 * The readers rule (404) runs first, in the controller, and the grant and the human-analyst-only set in the policy (403)
 * before it.
 */

/** The closed reasons a change of a file's AI inclusion is refused with, and their statuses. */
export type AttachmentAiInputRefusal =
  | { status: 403; reason: "OWN_REQUEST" }
  | {
      status: 409;
      reason:
        | "REQUEST_NOT_SUBMITTED"
        | "ATTACHMENTS_CLOSED"
        | "ATTACHMENT_REMOVED"
        | "ATTACHMENT_BLOCKED"
        | "ATTACHMENT_QUARANTINED"
        | "ATTACHMENT_UNAVAILABLE"
        | "ATTACHMENT_NOT_TEXT_BEARING"
        | "AI_CLASSIFICATION_ABOVE_CEILING"
        | "AI_POLICY_NOT_CONFIGURED";
    };

/** Why a file in each state other than available cannot be included (D-30, in the state's precedence). */
const AI_STATE_REFUSALS = {
  removed: "ATTACHMENT_REMOVED",
  blocked: "ATTACHMENT_BLOCKED",
  pending: "ATTACHMENT_QUARANTINED",
  unavailable: "ATTACHMENT_UNAVAILABLE",
} as const satisfies Record<Exclude<AttachmentState, "available">, string>;

const TEXT_BEARING: ReadonlySet<string> = new Set(TEXT_BEARING_ATTACHMENT_TYPES);

/** The attachment facts the AI inclusion rule reads: its state, its recorded type and whether it is included now. */
export type AttachmentAiFacts = { state: AttachmentState; fileType: unknown; included: boolean };

/**
 * Why the caller may not change the file's AI inclusion now, or null (D-30), in this order:
 *
 *   the caller raised the request (G-1: a requesting analyst acts as its Requestor)          403 OWN_REQUEST
 *   the request is a draft                                                                   409 REQUEST_NOT_SUBMITTED
 *   the request is released or closed                                                        409 ATTACHMENTS_CLOSED
 *   an exclusion, or a change to the value the file already has                              null (allowed)
 *   the file is removed, blocked, waiting for the malware check, or its bytes are gone
 *                     409 ATTACHMENT_REMOVED, ATTACHMENT_BLOCKED, ATTACHMENT_QUARANTINED, ATTACHMENT_UNAVAILABLE
 *   the file is an image or of no text-bearing type                                         409 ATTACHMENT_NOT_TEXT_BEARING
 *   the request's AI data policy refuses (Phase 12 D-28), or none was read
 *                                                409 AI_CLASSIFICATION_ABOVE_CEILING, AI_POLICY_NOT_CONFIGURED
 *
 * Excluding is always allowed while the window is open, whatever the policy or the file's state now: it only ever
 * takes text away from the AI. Including is refused wherever generation would refuse it, so the control never promises
 * what generation would refuse, and without a policy decision it fails closed.
 */
export function aiInputRefusalFor(input: {
  request: AttachmentRequestFacts;
  caller: AttachmentCaller;
  attachment: AttachmentAiFacts;
  policy: AiPolicyDecision | null;
  including: boolean;
}): AttachmentAiInputRefusal | null {
  const window = aiWindowRefusal(input.request, input.caller);
  if (window) return window;
  if (!input.including || input.attachment.included) return null;
  if (input.attachment.state !== "available") return { status: 409, reason: AI_STATE_REFUSALS[input.attachment.state] };
  if (typeof input.attachment.fileType !== "string" || !TEXT_BEARING.has(input.attachment.fileType)) return { status: 409, reason: "ATTACHMENT_NOT_TEXT_BEARING" };
  return aiPolicyRefusal(input.policy);
}

/** Who may change inclusion on this request, and when: the requestor never (G-1), and only from submission to release. */
function aiWindowRefusal(request: AttachmentRequestFacts, caller: AttachmentCaller): AttachmentAiInputRefusal | null {
  if (isRequestor(request, caller)) return { status: 403, reason: "OWN_REQUEST" };
  const window = attachmentWindow(request);
  if (window === "intake") return { status: 409, reason: "REQUEST_NOT_SUBMITTED" };
  if (window === "closed") return { status: 409, reason: "ATTACHMENTS_CLOSED" };
  return null;
}

/** The request's AI data policy as an inclusion refusal (Phase 12 D-28); no decision fails closed. */
function aiPolicyRefusal(policy: AiPolicyDecision | null): AttachmentAiInputRefusal | null {
  if (policy === null) return { status: 409, reason: "AI_POLICY_NOT_CONFIGURED" };
  if (policy.status !== "allowed") return { status: 409, reason: policy.reason ?? "AI_POLICY_NOT_CONFIGURED" };
  return null;
}

/** Why no file on the request can be included by this caller now, whatever the file (D-28, D-30). */
export type AttachmentAiPolicyRefusal = "OWN_REQUEST" | "REQUEST_NOT_SUBMITTED" | "ATTACHMENTS_CLOSED" | "AI_CLASSIFICATION_ABOVE_CEILING" | "AI_POLICY_NOT_CONFIGURED";

/**
 * The section's refusal (D-28, D-30): the part of aiInputRefusalFor no file changes, in the same order (the requestor,
 * the window, then the request's AI data policy), so the section never says files can be included when each would be
 * refused.
 */
export function aiPolicyRefusalFor(input: { request: AttachmentRequestFacts; caller: AttachmentCaller; policy: AiPolicyDecision | null }): AttachmentAiPolicyRefusal | null {
  const refusal = aiWindowRefusal(input.request, input.caller) ?? aiPolicyRefusal(input.policy);
  return refusal ? refusal.reason as AttachmentAiPolicyRefusal : null;
}
