import { readFile } from "node:fs/promises";

import { evaluateAiDataPolicy, readAiDataPolicyConfiguration, type AiPolicyDecision } from "../../../csrm/ai/data-policy";
import { isSecurityEventIdentifier, logSecurityEvent, type SecurityEventActor, type SecurityEventLogReason } from "../../../csrm/audit/security-event-log";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { attachmentConfigOf } from "../../../csrm/files/attachment-config";
import { ATTACHMENT_DETECTION_PATTERN, ATTACHMENT_LIMITS, ATTACHMENT_MEDIA_TYPES, ATTACHMENT_TYPES, TEXT_BEARING_ATTACHMENT_TYPES, type AttachmentType } from "../../../csrm/files/attachment-policy";
import { ExtractionBusyError, extractAttachmentText, type TextBearingType } from "../../../csrm/files/extraction";
import { createRescanScheduler, type RescanOutcome, type RescanScheduler } from "../../../csrm/files/rescan-scheduler";
import { selectMalwareScanner, type MalwareScanner, type ScanVerdict } from "../../../csrm/files/scanner";
import { readVerifiedStoredFile } from "../../../csrm/files/send-stored-file";
import { screenAttachment, type ScreenResult } from "../../../csrm/files/screen-attachment";
import { AttachmentStorageError, createAttachmentStorage, type AttachmentStorageStrapi } from "../../../csrm/files/storage-port";
import { withRequestLock, type RequestLockStrapi } from "../../csrm-assessment-request/services/request-lock";
import { PERSON_FIELDS } from "../../csrm-assessment-request/services/request-people";
import { authorPartFor, canUseRequestNotes } from "../../csrm-request-note/services/request-notes-policy";
import { loadNotesRequest, type NotesRequest } from "../../csrm-request-note/services/request-notes";
import {
  ATTACHMENT_EVENT_LOG_SCHEMA_VERSION,
  AttachmentEventLogError,
  appendAttachmentEvent,
  recordAttachmentWithdrawal,
  type AttachmentEventLog,
} from "./attachment-event-log";
import {
  ATTACHMENT_READ,
  hasStoredFile,
  parseAttachmentAiTextFacts,
  projectAddFacts,
  projectAttachment,
  projectAttachmentAiPolicy,
  type AttachmentAiTextFacts,
  type RequestAttachment,
  type RequestAttachmentAddFacts,
  type RequestAttachmentAiPolicy,
} from "./attachment-projection";
import {
  ACTIVE_ATTACHMENT_WHERE,
  addRefusalFor,
  aiInputRefusalFor,
  attachmentStateOf,
  attachmentWindow,
  canRemoveAttachment,
  canRestoreAttachment,
  noteAcceptsAttachments,
  readersCallerFacts,
  readersRequestFacts,
  type AttachmentCaller,
  type AttachmentNoteFacts,
  type AttachmentState,
} from "./attachment-rules";

/*
 * Request attachments (Phase 14 D-04 items 1 to 4, D-05, D-10 to D-23, D-37; docs/contract-gaps/
 * phase-14-request-attachments.md): list a request's files, add one, download one, remove or restore one, and re-scan
 * the quarantined ones. The controller has already admitted the caller
 * with canUseRequestNotes (D-18). The slow work, reading, screening, scanning and storing the bytes, runs outside the
 * request lock; the final checks and the insert run inside withRequestLock, which re-reads everything it decides on,
 * so two uploads at 19 can never make 21. A refusal that arrives under the lock deletes the bytes already stored.
 * Every outcome is one security event line (D-37), which never carries the file's name or content; every refusal after
 * the policy is one `attachment.refused` line, the readers-rule 404 included (WR-103, logged by the controller as the
 * closed log reason NOT_FOUND).
 *
 * The attachment content type is not in the generated Strapi types until they are regenerated, so the Document
 * Service and the query engine are reached through the csrm-request-note cast pattern.
 */

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";
const USER_UID = "api::idambox-user.idambox-user";
const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
export const ATTACHMENTS_NOT_FOUND = "CSRM request attachments were not found.";

type RecordValue = Record<string, unknown>;

type AttachmentDocuments = {
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  findFirst: (query: RecordValue) => Promise<RecordValue | null>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  count: (query: RecordValue) => Promise<number>;
  create: (query: RecordValue) => Promise<RecordValue>;
  update: (query: RecordValue) => Promise<RecordValue | null>;
};

type AttachmentQuery = { count: (query: { where: RecordValue }) => Promise<number> };

export type AttachmentsStrapi = RequestLockStrapi & AttachmentStorageStrapi & {
  documents: unknown;
  log: { info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void };
};

function documents(strapi: AttachmentsStrapi, uid: string): AttachmentDocuments {
  return (strapi.documents as unknown as (uid: string) => AttachmentDocuments)(uid);
}

function attachmentQuery(strapi: AttachmentsStrapi): AttachmentQuery {
  return (strapi.db as unknown as { query: (uid: string) => AttachmentQuery }).query(ATTACHMENT_UID);
}

/** A refusal with its HTTP status and closed reason; `detection` only beside ATTACHMENT_MALWARE_FOUND. */
export class RequestAttachmentsError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 422 | 503,
    readonly reason?: ConflictReason,
    readonly details?: { detection?: string },
    message = RequestAttachmentsError.messageFor(status),
  ) {
    super(message);
    this.name = "RequestAttachmentsError";
  }

  static messageFor(status: number): string {
    switch (status) {
      case 400: return "CSRM request attachment data is invalid.";
      case 403: return "CSRM request attachment access is denied.";
      case 404: return ATTACHMENTS_NOT_FOUND;
      case 413: return "The file is too large.";
      case 415: return "The file type is not allowed.";
      case 422: return "The file was refused by the malware check.";
      case 503: return "CSRM is busy checking files. Try again shortly.";
      default: return "The request attachment could not be changed.";
    }
  }
}

/** The request facts every attachment decision reads (the notes request: requestor, status, return to draft). */
export type AttachmentsRequest = NotesRequest;

export { loadNotesRequest as loadAttachmentsRequest };

/** The list's meta; `aiPolicy` is served only to a viewer holding the AI inclusion (D-28, D-30). */
export type AttachmentsMeta = { total: number; removed: number; add: RequestAttachmentAddFacts; aiPolicy?: RequestAttachmentAiPolicy };

function onRequest(requestDocumentId: string): RecordValue {
  return { assessmentRequest: { documentId: { $eq: requestDocumentId } } };
}

/**
 * The request's active and stored counts, through the query engine, which joins the lock's transaction (D-10). The
 * active count's filter is ACTIVE_ATTACHMENT_WHERE, isActiveAttachment's rule as a query (D-16's one predicate, IN-103).
 */
async function countAttachments(strapi: AttachmentsStrapi, requestDocumentId: string): Promise<{ activeCount: number; storedCount: number }> {
  const query = attachmentQuery(strapi);
  const onThisRequest = { assessmentRequest: { documentId: requestDocumentId } };
  const storedCount = Number(await query.count({ where: onThisRequest }));
  const activeCount = Number(await query.count({ where: { ...onThisRequest, ...ACTIVE_ATTACHMENT_WHERE } }));
  return { activeCount, storedCount };
}

/**
 * Every attachment of the request, removed and blocked ones included, through the query engine, so the request delete
 * counts inside its withRequestLock transaction (D-04 item 11): above zero it refuses with REQUEST_HAS_ATTACHMENTS.
 */
export async function countStoredRequestAttachments(strapi: AttachmentsStrapi, requestDocumentId: string): Promise<number> {
  return (await countAttachments(strapi, requestDocumentId)).storedCount;
}

/** The request read's file summary for one reader (D-04 item 7): the main list's count, then the add facts. */
export type RequestAttachmentSummary = { count: number } & RequestAttachmentAddFacts;

/**
 * The viewer's file summary on the request read (D-04 item 7, D-18): how many files the request holds that are not
 * removed, then whether and how this viewer may add one now. A caller canUseRequestNotes refuses gets null, so nothing of
 * the files, not even their count, reaches anyone who may not read them. It writes nothing.
 */
export async function requestAttachmentSummary(strapi: AttachmentsStrapi, request: AttachmentsRequest, caller: AttachmentCaller): Promise<RequestAttachmentSummary | null> {
  if (!canUseRequestNotes(readersRequestFacts(request), readersCallerFacts(caller))) return null;
  const query = attachmentQuery(strapi);
  const count = Number(await query.count({ where: { assessmentRequest: { documentId: request.documentId }, removedAt: { $null: true } } }));
  const { activeCount, storedCount } = await countAttachments(strapi, request.documentId);
  return { count, ...projectAddFacts({ request, caller, activeCount, storedCount, configured: configuredScanner(strapi).configured }) };
}

/**
 * The scanner for each scanner configuration, kept for the running Strapi (IN-210): the ClamAV adapter caches the
 * engine's name, and the fallback name after a failed VERSION, so a scanner made afresh for every upload would ask
 * clamd for its name on every scan, and an outage would cost every upload a second connection.
 */
const scannersByConfiguration = new WeakMap<object, MalwareScanner>();

/** Whether storage and scanning are configured, with the scanner to screen with. */
function configuredScanner(strapi: AttachmentsStrapi) {
  const config = attachmentConfigOf(strapi);
  if (!config.available || config.scanner === null) return { configured: false, scanner: null };
  let scanner = scannersByConfiguration.get(config.scanner) ?? null;
  if (scanner === null) {
    scanner = selectMalwareScanner(config.scanner);
    if (scanner !== null) scannersByConfiguration.set(config.scanner, scanner);
  }
  return { configured: scanner !== null, scanner };
}

/**
 * GET …/attachments (D-04 item 1, D-28): every file of the request, newest first, at most the lifetime bound (60),
 * each with the actions this viewer may take, and whether and how the viewer may add one now. It writes nothing.
 */
export async function listRequestAttachments(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
}): Promise<{ attachments: RequestAttachment[]; meta: AttachmentsMeta }> {
  const { strapi, request, caller } = input;
  const records = await documents(strapi, ATTACHMENT_UID).findMany({
    filters: onRequest(request.documentId),
    ...ATTACHMENT_READ,
    sort: ["uploadedAt:desc", "id:desc"],
    limit: ATTACHMENT_LIMITS.maxStoredPerRequest,
  });
  const { activeCount, storedCount } = await countAttachments(strapi, request.documentId);
  const viewer = { caller, request, activeCount };
  // D-28, D-30: a viewer holding the AI inclusion also gets each file's AI facts and the section's AI policy.
  const ai = await aiViewOf(strapi, request, caller);
  const attachments = records.map((record) => projectAttachment(record, viewer, ai));
  // The list holds every stored file (at most the lifetime bound), so these two counts are exact: `total` is the main
  // list (the files not removed, D-20; UI-SPEC "its total equal to the main list"), `removed` the removed group.
  const removed = attachments.filter((attachment) => attachment.state === "removed").length;
  return {
    attachments,
    meta: {
      total: attachments.length - removed,
      removed,
      add: projectAddFacts({ request, caller, activeCount, storedCount, configured: configuredScanner(strapi).configured }),
      ...(ai ? { aiPolicy: projectAttachmentAiPolicy({ request, caller, policy: ai.policy }) } : {}),
    },
  };
}

/** The request's AI data policy for a viewer holding the AI inclusion, or undefined: nobody else is served AI facts. */
async function aiViewOf(strapi: AttachmentsStrapi, request: AttachmentsRequest, caller: AttachmentCaller): Promise<{ policy: AiPolicyDecision } | undefined> {
  return caller.aiInputs === true ? { policy: await requestAiPolicy(strapi, request.documentId) } : undefined;
}

/**
 * WR-204: the uploaders (IdamBox User documentIds) with a screening in flight in this process. Strapi runs as one
 * process (R-08-36), so this is every screening the deployment has in flight.
 */
const uploadersScreening = new Set<string>();

/** The multipart file part as formidable delivered it. */
export type AttachmentUpload = { filepath: string; originalFilename: string; size: number };

/** The security event actor: the caller's documentId and display name, read once. */
async function actorOf(strapi: AttachmentsStrapi, caller: AttachmentCaller): Promise<SecurityEventActor> {
  const user = await documents(strapi, USER_UID).findOne({ documentId: caller.documentId, fields: [...PERSON_FIELDS] });
  return { documentId: caller.documentId, displayName: typeof user?.displayName === "string" ? user.displayName : "" };
}

/** The note a file names, as the note rule reads it, or null when no note has that documentId. */
async function noteFactsOf(strapi: AttachmentsStrapi, noteDocumentId: string): Promise<AttachmentNoteFacts | null> {
  const note = await documents(strapi, NOTE_UID).findOne({
    documentId: noteDocumentId,
    fields: ["documentId", "postedAt"],
    populate: { author: { fields: ["documentId"] }, assessmentRequest: { fields: ["documentId"] } },
  });
  if (!note) return null;
  const idOf = (value: unknown) => (typeof value === "object" && value !== null && typeof (value as RecordValue).documentId === "string" ? (value as RecordValue).documentId as string : null);
  return { requestDocumentId: idOf(note.assessmentRequest), authorDocumentId: idOf(note.author), postedAt: note.postedAt };
}

/**
 * The note rule for an add (D-17): a draft takes no note id; after submission a file needs the caller's own fresh
 * note on this request. A closed request has already been refused by addRefusalFor.
 */
async function noteRefusalFor(
  strapi: AttachmentsStrapi,
  input: { request: AttachmentsRequest; caller: AttachmentCaller; noteId: string | undefined; now: Date },
): Promise<"ATTACHMENT_NOTE_REQUIRED" | "ATTACHMENT_NOTE_INVALID" | null> {
  const window = attachmentWindow(input.request);
  if (window === "intake") return input.noteId === undefined ? null : "ATTACHMENT_NOTE_INVALID";
  if (window !== "after-submission") return null;
  if (input.noteId === undefined) return "ATTACHMENT_NOTE_REQUIRED";
  return noteAcceptsAttachments({
    note: await noteFactsOf(strapi, input.noteId),
    requestId: input.request.documentId,
    callerId: input.caller.documentId,
    now: input.now,
  });
}

/** What screening learnt about a refused file, for its event line: never its name or content. */
type RefusedFileFacts = Pick<Extract<ScreenResult, { outcome: "refused" }>, "type" | "byteSize" | "sha256" | "detection">;

/**
 * Logs a refusal as one `attachment.refused` line (D-37), warning level for malware, and returns the error to throw.
 * The line carries the closed reason and, for malware, the engine's detection; never the file's name or content.
 */
async function refused(
  strapi: AttachmentsStrapi,
  context: { request: AttachmentsRequest; caller: AttachmentCaller; attachmentId?: string },
  error: RequestAttachmentsError,
  file?: RefusedFileFacts,
): Promise<RequestAttachmentsError> {
  const detection = file?.detection ?? error.details?.detection;
  logSecurityEvent(strapi.log, {
    name: "attachment.refused",
    actor: await actorOf(strapi, context.caller),
    requestId: context.request.documentId,
    ...(context.attachmentId ? { attachmentId: context.attachmentId } : {}),
    ...(file?.type ? { fileType: file.type } : {}),
    ...(file ? { byteSize: file.byteSize } : {}),
    ...(file?.sha256 ? { sha256: file.sha256 } : {}),
    outcome: "refused",
    ...(error.reason ? { reason: error.reason } : {}),
    ...(detection ? { detection } : {}),
  });
  return error;
}

/**
 * A refusal the controller decides before the service (a part other than one file and a noteId, or a removal body other
 * than `{ data: { removed } }`): logged the same way.
 */
export async function recordAttachmentRefusal(
  strapi: AttachmentsStrapi,
  context: { request: AttachmentsRequest; caller: AttachmentCaller; attachmentId?: string },
  error: RequestAttachmentsError,
): Promise<void> {
  await refused(strapi, context, error);
}

/** The readers-rule 404's closed log reason (WR-103): a log value only, so the response stays a reasonless 404. */
const NOT_FOUND_REASON: SecurityEventLogReason = "NOT_FOUND";

/**
 * The readers-rule 404 as one `attachment.refused` line (WR-103, D-11, D-37), for every attachment operation: another
 * Requestor, a caller who may not read the request, a missing request, or a file that is not on the path's request. It
 * carries the closed log reason NOT_FOUND and only the identifiers the caller asked for, each kept only when it passes
 * the log's identifier rule (one that fails is dropped, never echoed). Nothing else of the request or the file is read.
 */
export async function recordAttachmentNotFound(
  strapi: AttachmentsStrapi,
  input: { caller: AttachmentCaller; requestId: unknown; attachmentId?: unknown },
): Promise<void> {
  logSecurityEvent(strapi.log, {
    name: "attachment.refused",
    actor: await actorOf(strapi, input.caller),
    ...(isSecurityEventIdentifier(input.requestId) ? { requestId: input.requestId } : {}),
    ...(isSecurityEventIdentifier(input.attachmentId) ? { attachmentId: input.attachmentId } : {}),
    outcome: "refused",
    reason: NOT_FOUND_REASON,
  });
}

/** A line the bookkeeping after a committed upload could not write, reported once and never thrown (IN-102). */
function reportLostBookkeeping(strapi: AttachmentsStrapi, message: string): void {
  try {
    strapi.log.error(message);
  } catch {
    // The logger itself failed: nothing else can record it, and the committed upload stands.
  }
}

/**
 * The contract's bound on a served detection name (`AssessmentWorkflowErrorResponse.error.details.detection` and
 * `RequestAttachment.detection`): the one pattern of the stage B amendment, contract item 4.
 */
const SERVED_DETECTION = ATTACHMENT_DETECTION_PATTERN;

/**
 * A screening refusal as its HTTP answer (D-11; 14-RESEARCH Settled 8): an empty file 400, an oversize one 413,
 * malware 422 with the detection when it fits the contract's pattern, and every content refusal 415.
 */
function screeningError(screen: Extract<ScreenResult, { outcome: "refused" }>): RequestAttachmentsError {
  switch (screen.reason) {
    case "ATTACHMENT_EMPTY":
      return new RequestAttachmentsError(400, screen.reason);
    case "ATTACHMENT_TOO_LARGE":
      return new RequestAttachmentsError(413, screen.reason);
    case "ATTACHMENT_MALWARE_FOUND":
      return new RequestAttachmentsError(422, screen.reason, screen.detection && SERVED_DETECTION.test(screen.detection) ? { detection: screen.detection } : undefined);
    default:
      return new RequestAttachmentsError(415, screen.reason);
  }
}

/**
 * POST …/attachments (D-04 item 2, D-10 to D-17): adds one file.
 *
 *   attachments are not configured, or the window, the caller or the limits refuse          409 (addRefusalFor)
 *   a note id on a draft                                                                     409 ATTACHMENT_NOTE_INVALID
 *   after submission, without a note                                                         409 ATTACHMENT_NOTE_REQUIRED
 *   after submission, a note that is not the caller's own on this request, posted at most
 *     60 minutes ago (noteAcceptsAttachments)                                                409 ATTACHMENT_NOTE_INVALID
 *   the declared size is over 26,214,400 bytes, or zero (before the bytes are read)        413, 400
 *   another upload by the same person is still being screened (one in flight per uploader)  503 ATTACHMENT_BUSY
 *   screening refuses the file: empty 400, too large 413, its name or content 415, malware 422 with its detection
 *   the screening and extraction queue is full (the PDF open check cannot wait)              503 ATTACHMENT_BUSY
 *   the file is stored, then under the request lock the window, the note and the counts are re-read;
 *     a refusal there deletes the stored bytes                                               409
 *
 * Success is 201 with the attachment, clean and available, or pending while the scan could not run.
 *
 * WR-204 (the pilot's ruling): each uploader, the resolved IdamBox User and never anything the client sends, has at most
 * one screening in flight in this process. The slot is taken after the cheap refusals and before the bytes are read, and
 * released in a `finally` once screening ends, whatever its outcome; the storing and the lock come after it. A busy
 * refusal stores nothing and is one `attachment.refused` line, as every refusal after the policy is.
 */
export async function uploadRequestAttachment(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  upload: AttachmentUpload;
  noteId?: string;
  now?: () => Date;
}): Promise<RequestAttachment> {
  const { strapi, request, caller, upload } = input;
  const now = input.now ?? (() => new Date());
  const context = { request, caller };
  const { configured, scanner } = configuredScanner(strapi);

  const before = await countAttachments(strapi, request.documentId);
  const preRefusal = addRefusalFor({ request, caller, ...before, configured });
  if (preRefusal) throw await refused(strapi, context, new RequestAttachmentsError(409, preRefusal));
  const noteRefusal = await noteRefusalFor(strapi, { request, caller, noteId: input.noteId, now: now() });
  if (noteRefusal) throw await refused(strapi, context, new RequestAttachmentsError(409, noteRefusal));

  // The declared size refuses an oversize or empty file before a byte of it is read (D-10, D-11).
  if (upload.size > ATTACHMENT_LIMITS.maxBytes) throw await refused(strapi, context, new RequestAttachmentsError(413, "ATTACHMENT_TOO_LARGE"), { byteSize: upload.size });
  if (upload.size === 0) throw await refused(strapi, context, new RequestAttachmentsError(400, "ATTACHMENT_EMPTY"), { byteSize: 0 });

  // WR-204: one screening in flight per uploader; a second is refused at once rather than queued behind the first.
  if (uploadersScreening.has(caller.documentId)) throw await refused(strapi, context, new RequestAttachmentsError(503, "ATTACHMENT_BUSY"));
  uploadersScreening.add(caller.documentId);
  let bytes: Buffer;
  let screen: ScreenResult;
  try {
    bytes = await readFile(upload.filepath);
    screen = await screenAttachment({ fileName: upload.originalFilename, bytes }, { scanner: scanner! });
  } catch (error) {
    // The screening and extraction queue is full: the PDF open check cannot wait (WR-204).
    if (error instanceof ExtractionBusyError) throw await refused(strapi, context, new RequestAttachmentsError(503, "ATTACHMENT_BUSY"));
    throw error;
  } finally {
    uploadersScreening.delete(caller.documentId);
  }
  if (screen.outcome === "refused") throw await refused(strapi, context, screeningError(screen), screen);
  // IN-102: the actor is read before anything is stored, so the bookkeeping after the commit reads nothing more.
  const actor = await actorOf(strapi, caller);
  const screened: RefusedFileFacts = { type: screen.type, byteSize: screen.byteSize, sha256: screen.sha256 };

  const storage = createAttachmentStorage(strapi);
  const stored = await storage.put(bytes, { type: screen.type });
  const pending = screen.outcome === "not-scanned";
  // IN-105: the lock answers the request it re-read with the record, and the 201 is projected against it.
  let locked: { created: RecordValue; current: AttachmentsRequest };
  try {
    locked = await withRequestLock(strapi, request.documentId, async () => {
      const current = await loadNotesRequest(strapi, request.documentId);
      if (!current || !canUseRequestNotes(readersRequestFacts(current), readersCallerFacts(caller))) throw new RequestAttachmentsError(404);
      const counts = await countAttachments(strapi, request.documentId);
      const lateRefusal = addRefusalFor({ request: current, caller, ...counts, configured });
      if (lateRefusal) throw new RequestAttachmentsError(409, lateRefusal);
      // The note is re-read under the lock too: the request may have returned to draft, or the window passed.
      const lateNoteRefusal = await noteRefusalFor(strapi, { request: current, caller, noteId: input.noteId, now: now() });
      if (lateNoteRefusal) throw new RequestAttachmentsError(409, lateNoteRefusal);
      const noteDocumentId = attachmentWindow(current) === "after-submission" ? input.noteId ?? null : null;
      const at = now().toISOString();
      let eventLog: AttachmentEventLog = appendAttachmentEvent(null, {
        schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type: "uploaded", by: caller.documentId, at, engine: screen.engine, verdict: pending ? "not-scanned" : "clean",
      });
      if (pending) {
        eventLog = appendAttachmentEvent(eventLog, {
          schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type: "quarantined", by: caller.documentId, at, engine: screen.engine, verdict: "not-scanned",
        });
      }
      const created = await documents(strapi, ATTACHMENT_UID).create({
        data: {
          fileName: screen.name,
          fileType: screen.type,
          byteSize: screen.byteSize,
          sha256: screen.sha256,
          uploaderPart: authorPartFor(current, caller),
          uploadedAt: at,
          scanStatus: pending ? "pending" : "clean",
          scanCheckedAt: pending ? null : at,
          scanEngine: screen.engine.slice(0, 255),
          scanAttempts: pending ? 1 : 0,
          aiTextIncluded: false,
          eventLog,
          file: stored.fileId,
          assessmentRequest: request.documentId,
          uploadedBy: caller.documentId,
          note: noteDocumentId,
        },
        ...ATTACHMENT_READ,
      });
      return { created, current };
    });
  } catch (error) {
    // Nothing of a refused file is kept: the bytes and the plugin's file record stored before the lock go too.
    await storage.remove(stored.fileId).catch(() => undefined);
    // A refusal under the lock carries what screening learnt, as every other upload refusal does (IN-102). A 404 is
    // logged by the controller, as every readers-rule 404 is (WR-103).
    if (error instanceof RequestAttachmentsError && error.status !== 404) throw await refused(strapi, context, error, screened);
    throw error;
  }

  /*
   * IN-102: the record is committed, so its re-scan and its event lines come first, each on its own, before any further
   * read: a read that fails below answers 500, but never loses the file's re-scan or its audit lines.
   */
  const attachmentId = String(locked.created.documentId);
  const facts = { actor, requestId: request.documentId, attachmentId, fileType: screen.type, byteSize: screen.byteSize, sha256: screen.sha256 };
  if (pending) {
    try {
      // D-13: its first re-scan follows the backoff from the upload's own attempt.
      attachmentRescans.get(strapi)?.schedule(attachmentId, 1);
    } catch {
      reportLostBookkeeping(strapi, `csrm.attachment_rescan: the re-scan of quarantined attachment ${attachmentId} could not be scheduled; it is re-scanned at the next start.`);
    }
  }
  try {
    logSecurityEvent(strapi.log, { name: "attachment.uploaded", ...facts, outcome: pending ? "pending" : "clean" });
  } catch {
    reportLostBookkeeping(strapi, `csrm.security_event: the attachment.uploaded line for attachment ${attachmentId} could not be written.`);
  }
  if (screen.outcome === "not-scanned") {
    try {
      // D-13, G-7: the scan could not run, so the file waits in quarantine; the line names why (unavailable, timeout,
      // limits or error), and an operator alerting on it can raise the engine's limits or bring it back.
      logSecurityEvent(strapi.log, { name: "attachment.quarantined", ...facts, outcome: screen.cause });
    } catch {
      reportLostBookkeeping(strapi, `csrm.security_event: the attachment.quarantined line for attachment ${attachmentId} could not be written.`);
    }
  }

  const counts = await countAttachments(strapi, request.documentId);
  return projectAttachment(locked.created, { caller, request: locked.current, activeCount: counts.activeCount }, await aiViewOf(strapi, locked.current, caller));
}

/** A file ready to send: its display name, its recorded type's media type and its verified bytes. */
export type AttachmentContent = { fileName: string; mediaType: string; bytes: Buffer };

const DOWNLOAD_READ = {
  fields: ["documentId", "fileName", "fileType", "byteSize", "sha256", "scanStatus", "removedAt"],
  populate: { file: { fields: ["id"] } },
} as const;

const DOWNLOADABLE_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_TYPES);

const DOWNLOAD_REFUSED = "The request attachment cannot be downloaded.";

/** Why a file the reader can see is not sent (D-13, D-20, D-21, D-23). */
const STATE_REFUSALS = {
  removed: "ATTACHMENT_REMOVED",
  blocked: "ATTACHMENT_BLOCKED",
  pending: "ATTACHMENT_QUARANTINED",
  unavailable: "ATTACHMENT_UNAVAILABLE",
} as const satisfies Record<Exclude<AttachmentState, "available">, ConflictReason>;

/**
 * GET …/attachments/{attachmentId}/content (D-23): the file's verified bytes, for a caller the controller has admitted
 * as a reader of the request (D-18). A file id that is not on this request is 404, as a missing one is; a file that is
 * not available, or whose stored bytes are gone or no longer match their digest, is refused before any byte is read
 * out. Each download is one `attachment.downloaded` line (D-37), without the file's name, and every refusal but a 404
 * one `attachment.refused` line with its reason (WR-103); the controller logs the 404 as NOT_FOUND.
 */
export async function readRequestAttachmentContent(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
}): Promise<AttachmentContent> {
  try {
    return await verifiedAttachmentContent(input);
  } catch (error) {
    const { strapi, request, caller, attachmentId } = input;
    if (error instanceof RequestAttachmentsError && error.status !== 404) throw await refused(strapi, { request, caller, attachmentId }, error);
    throw error;
  }
}

/** The download's decision and verified read, which readRequestAttachmentContent logs the refusals of. */
async function verifiedAttachmentContent(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
}): Promise<AttachmentContent> {
  const { strapi, request, caller, attachmentId } = input;
  if (attachmentId.length < 1 || attachmentId.length > 255) throw new RequestAttachmentsError(404);
  const record = await documents(strapi, ATTACHMENT_UID).findFirst({
    filters: { documentId: { $eq: attachmentId }, ...onRequest(request.documentId) },
    ...DOWNLOAD_READ,
  });
  if (!record) throw new RequestAttachmentsError(404);
  const state = attachmentStateOf({ scanStatus: record.scanStatus, removedAt: record.removedAt, hasFile: hasStoredFile(record) });
  // A reader can see the entry, so a file that cannot be sent is refused with why (D-23), in the state's precedence.
  if (state !== "available") throw new RequestAttachmentsError(409, STATE_REFUSALS[state], undefined, DOWNLOAD_REFUSED);
  const fileType = typeof record.fileType === "string" && DOWNLOADABLE_TYPES.has(record.fileType) ? record.fileType as AttachmentType : null;
  if (fileType === null) throw new RequestAttachmentsError(409, "ATTACHMENT_UNAVAILABLE", undefined, DOWNLOAD_REFUSED);
  const file = record.file as RecordValue;
  const verified = await readVerifiedStoredFile(strapi, { fileId: typeof file.id === "number" ? file.id : null, sha256: record.sha256 });
  if ("failure" in verified) {
    if (verified.failure === "missing") throw new RequestAttachmentsError(409, "ATTACHMENT_UNAVAILABLE", undefined, DOWNLOAD_REFUSED);
    // Tamper evidence (D-23, D-37): the stored bytes no longer match the digest recorded at upload. Nothing is sent,
    // and the warning-level line carries the recorded digest for the investigation.
    logSecurityEvent(strapi.log, {
      name: "attachment.integrity_failed",
      actor: await actorOf(strapi, caller),
      requestId: request.documentId,
      attachmentId: String(record.documentId),
      fileType,
      ...(typeof record.byteSize === "number" ? { byteSize: record.byteSize } : {}),
      ...(typeof record.sha256 === "string" ? { sha256: record.sha256 } : {}),
      outcome: "refused",
      reason: "ATTACHMENT_INTEGRITY_FAILED",
    });
    throw new RequestAttachmentsError(409, "ATTACHMENT_INTEGRITY_FAILED", undefined, DOWNLOAD_REFUSED);
  }

  logSecurityEvent(strapi.log, {
    name: "attachment.downloaded",
    actor: await actorOf(strapi, caller),
    requestId: request.documentId,
    attachmentId: String(record.documentId),
    fileType,
    byteSize: verified.bytes.length,
    sha256: String(record.sha256),
    outcome: "downloaded",
  });
  return { fileName: typeof record.fileName === "string" ? record.fileName : "", mediaType: ATTACHMENT_MEDIA_TYPES[fileType], bytes: verified.bytes };
}

/*
 * Removal and restore (D-19 to D-21; docs/contract-gaps/phase-14-request-attachments.md, "Removal, Blocked Files and
 * Retention"). Removal is soft: it sets the current facts `removedAt` and `removedBy` and appends an event, and never
 * touches the stored bytes or the plugin's file record, so the record stays complete and its retention follows the
 * request's (D-22, ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE). Restore clears both facts and appends its own event.
 */

/** A populated relation's documentId, or null. */
function relationDocumentId(value: unknown): string | null {
  return typeof value === "object" && value !== null && typeof (value as RecordValue).documentId === "string" ? (value as RecordValue).documentId as string : null;
}

function isRemoved(record: RecordValue): boolean {
  return record.removedAt !== null && record.removedAt !== undefined && record.removedAt !== "";
}

/** The record facts the removal reads under the lock: the projection's, the AI inclusion it ends, and the event log. */
const REMOVAL_READ = {
  fields: [...ATTACHMENT_READ.fields, "eventLog"],
  populate: ATTACHMENT_READ.populate,
} as const;

/**
 * The log with an adding change's event appended (a restore, an inclusion): within the log's reserve, or on a log that
 * cannot be read, the change is refused with 409 HISTORY_UNAVAILABLE and nothing is written (WR-101), so no adding fact
 * changes without its audit record.
 */
function appendAddingEvent(eventLog: unknown, type: "restored" | "ai-included", by: string, at: string): AttachmentEventLog {
  try {
    return appendAttachmentEvent(eventLog, { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type, by, at });
  } catch (error) {
    if (error instanceof AttachmentEventLogError) {
      throw new RequestAttachmentsError(409, "HISTORY_UNAVAILABLE", undefined, "The request attachment history is unavailable.");
    }
    throw error;
  }
}

/**
 * A withdrawal's history (WR-101): the `eventLog` to write with it, or none when the log cannot take its events (full,
 * or malformed). The withdrawal is made either way; `historyUnavailable` asks the caller for the warning line.
 */
function withdrawalHistory(eventLog: unknown, types: ReadonlyArray<"ai-excluded" | "removed">, by: string, at: string): { data: { eventLog?: AttachmentEventLog }; historyUnavailable: boolean } {
  const history = recordAttachmentWithdrawal(eventLog, types.map((type) => ({ schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type, by, at })));
  return history.recorded ? { data: { eventLog: history.eventLog }, historyUnavailable: false } : { data: {}, historyUnavailable: true };
}

/** The 403 reasons are about who the caller is; every other refusal is about the record's state (409). */
function removalRefusal(reason: "ATTACHMENTS_CLOSED" | "REQUEST_NOT_SUBMITTED" | "NOT_UPLOADER" | "NOT_REMOVER" | "ATTACHMENT_BLOCKED" | "ATTACHMENT_LIMIT_REACHED"): RequestAttachmentsError {
  return reason === "NOT_UPLOADER" || reason === "NOT_REMOVER"
    ? new RequestAttachmentsError(403, reason)
    : new RequestAttachmentsError(409, reason);
}

/**
 * PUT …/attachments/{attachmentId}/removal (D-04 item 4, D-19 to D-21): removes the file softly (`removed` true) or
 * restores it (false), under the request lock, which re-reads the request and the file before deciding.
 *
 *   the request is gone or the caller no longer reads it, or the file is not on this request          404
 *   the file is already as asked (removed, or not removed)                                             200, nothing written
 *   remove: canRemoveAttachment refuses        403 NOT_UPLOADER; 409 ATTACHMENTS_CLOSED, REQUEST_NOT_SUBMITTED
 *   restore: canRestoreAttachment refuses      403 NOT_REMOVER; 409 ATTACHMENTS_CLOSED, REQUEST_NOT_SUBMITTED,
 *                                              ATTACHMENT_BLOCKED, ATTACHMENT_LIMIT_REACHED
 *   restore: the file's event log is within its reserve (197 events) or unreadable                     409 HISTORY_UNAVAILABLE
 *
 * A removal is never refused by the file's history (WR-101): when the log cannot take its events (full, or malformed),
 * the file is removed with the log left untouched, and a warning-level `attachment.history_unavailable` line records it.
 *
 * A removal also ends the file's AI inclusion: `aiTextIncluded` false, the stored `aiText` and `aiTextFacts` deleted,
 * and, when it was included, an `ai-excluded` event before `removed`. A restore never includes it again.
 *
 * Success is 200 with the file as the caller now sees it, and one `attachment.removed` or `attachment.restored` line
 * (after an `attachment.ai_inclusion_changed` line from true to false when inclusion ended). Every refusal but a 404
 * is one `attachment.refused` line with its reason here; the controller logs the 404 as NOT_FOUND (WR-103).
 */
export async function setRequestAttachmentRemoval(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
  removed: boolean;
  now?: () => Date;
}): Promise<RequestAttachment> {
  const { strapi, request, caller, attachmentId, removed } = input;
  const now = input.now ?? (() => new Date());
  if (attachmentId.length < 1 || attachmentId.length > 255) throw new RequestAttachmentsError(404);

  let outcome: { changed: boolean; endedInclusion: boolean; historyUnavailable: boolean; current: AttachmentsRequest; record: RecordValue; activeCount: number };
  try {
    outcome = await withRequestLock(strapi, request.documentId, async () => {
      const current = await loadNotesRequest(strapi, request.documentId);
      if (!current || !canUseRequestNotes(readersRequestFacts(current), readersCallerFacts(caller))) throw new RequestAttachmentsError(404);
      const record = await documents(strapi, ATTACHMENT_UID).findFirst({
        filters: { documentId: { $eq: attachmentId }, ...onRequest(request.documentId) },
        ...REMOVAL_READ,
      });
      if (!record) throw new RequestAttachmentsError(404);
      const counts = await countAttachments(strapi, request.documentId);
      // PUT is idempotent: a file already as asked is answered as it is, and nothing is written or logged.
      if (isRemoved(record) === removed) return { changed: false, endedInclusion: false, historyUnavailable: false, current, record, activeCount: counts.activeCount };

      const facts = {
        uploadedByDocumentId: relationDocumentId(record.uploadedBy),
        removedByDocumentId: relationDocumentId(record.removedBy),
        scanStatus: record.scanStatus,
        removedAt: record.removedAt,
      };
      const refusal = removed
        ? canRemoveAttachment({ request: current, caller, attachment: facts })
        : canRestoreAttachment({ request: current, caller, attachment: facts, activeCount: counts.activeCount });
      if (refusal) throw removalRefusal(refusal);

      // D-20: removal ends the AI inclusion and deletes the stored text and its facts; a restore never re-includes.
      const endedInclusion = removed && record.aiTextIncluded === true;
      const at = now().toISOString();
      // WR-101: a removal withdraws text, so its history never blocks it; a restore adds, so its history can refuse it.
      const history = removed
        ? withdrawalHistory(record.eventLog, [...(endedInclusion ? ["ai-excluded" as const] : []), "removed"], caller.documentId, at)
        : { data: { eventLog: appendAddingEvent(record.eventLog, "restored", caller.documentId, at) }, historyUnavailable: false };
      const updated = await documents(strapi, ATTACHMENT_UID).update({
        documentId: attachmentId,
        data: removed
          ? { removedAt: at, removedBy: caller.documentId, aiTextIncluded: false, aiText: null, aiTextFacts: null, ...history.data }
          : { removedAt: null, removedBy: null, ...history.data },
        ...ATTACHMENT_READ,
      });
      if (!updated) throw new RequestAttachmentsError(404);
      const after = await countAttachments(strapi, request.documentId);
      return { changed: true, endedInclusion, historyUnavailable: history.historyUnavailable, current, record: updated, activeCount: after.activeCount };
    });
  } catch (error) {
    // D-37: a refused change of a file the caller can see is one attachment.refused line; the controller logs a 404 as
    // the closed log reason NOT_FOUND (WR-103).
    if (error instanceof RequestAttachmentsError && error.status !== 404) throw await refused(strapi, { request, caller, attachmentId }, error);
    throw error;
  }

  const attachment = projectAttachment(outcome.record, { caller, request: outcome.current, activeCount: outcome.activeCount }, await aiViewOf(strapi, outcome.current, caller));
  if (outcome.changed) {
    const stored = await documents(strapi, ATTACHMENT_UID).findOne({ documentId: attachmentId, fields: ["fileType", "byteSize", "sha256"] });
    const facts = {
      actor: await actorOf(strapi, caller),
      requestId: request.documentId,
      attachmentId,
      ...(typeof stored?.fileType === "string" && DOWNLOADABLE_TYPES.has(stored.fileType) ? { fileType: stored.fileType as AttachmentType } : {}),
      ...(typeof stored?.byteSize === "number" ? { byteSize: stored.byteSize } : {}),
      ...(typeof stored?.sha256 === "string" ? { sha256: stored.sha256 } : {}),
    };
    if (outcome.endedInclusion) logSecurityEvent(strapi.log, { name: "attachment.ai_inclusion_changed", ...facts, outcome: "excluded", from: true, to: false });
    logSecurityEvent(strapi.log, { name: removed ? "attachment.removed" : "attachment.restored", ...facts, outcome: removed ? "removed" : "restored" });
    // WR-101: the removal was made without its record in the file's own history, so this line records it.
    if (outcome.historyUnavailable) logSecurityEvent(strapi.log, { name: "attachment.history_unavailable", ...facts, outcome: "removed", reason: "HISTORY_UNAVAILABLE" });
  }
  return attachment;
}

/*
 * AI inclusion and the text preview (D-30, D-31, D-33, D-37; docs/contract-gaps/phase-14-request-attachments.md, "AI
 * Inclusion and Extracted Text"). Opting in reads the verified bytes and extracts the text in the bounded worker,
 * outside the request lock; the decision and the write run under withRequestLock, which re-reads the request, the file
 * and the AI data policy. Opting out deletes the stored text and its facts. The text never leaves Strapi except through
 * the analyst's preview, and no event line carries it.
 */

/** The record facts the AI inclusion reads: the projection's, the stored text's facts, the digest and the event log. */
const AI_INPUT_READ = {
  fields: [...ATTACHMENT_READ.fields, "sha256", "eventLog"],
  populate: ATTACHMENT_READ.populate,
} as const;

const TEXT_BEARING_TYPES: ReadonlySet<string> = new Set(TEXT_BEARING_ATTACHMENT_TYPES);

/** The request's AI data policy, as generation would apply it now (Phase 12 D-26, D-28): its assets' classification. */
async function requestAiPolicy(strapi: AttachmentsStrapi, requestDocumentId: string): Promise<AiPolicyDecision> {
  const request = await documents(strapi, REQUEST_UID).findOne({
    documentId: requestDocumentId,
    fields: ["documentId"],
    populate: { informationAssets: { fields: ["dataClassification"] } },
  });
  const assets = Array.isArray(request?.informationAssets)
    ? (request.informationAssets as unknown[]).filter((asset): asset is RecordValue => typeof asset === "object" && asset !== null)
    : [];
  return evaluateAiDataPolicy({ assets, ...readAiDataPolicyConfiguration(strapi as unknown as { config: { get: (key: string) => unknown } }) });
}

/** One file of the request, read with `read`, or null when no file with that id is on this request. */
async function attachmentOnRequest(strapi: AttachmentsStrapi, requestDocumentId: string, attachmentId: string, read: { fields: readonly string[]; populate?: unknown }): Promise<RecordValue | null> {
  return documents(strapi, ATTACHMENT_UID).findFirst({ filters: { documentId: { $eq: attachmentId }, ...onRequest(requestDocumentId) }, ...read });
}

/** The AI rule's facts of a record: its state, its recorded type and whether it is included now. */
function aiFactsOf(record: RecordValue) {
  return {
    state: attachmentStateOf({ scanStatus: record.scanStatus, removedAt: record.removedAt, hasFile: hasStoredFile(record) }),
    fileType: record.fileType,
    included: record.aiTextIncluded === true,
  };
}

const AI_INPUT_DENIED = "CSRM request attachment AI inclusion is denied.";

/**
 * PUT …/attachments/{attachmentId}/ai_input (D-04 item 5, D-30, D-31, D-33): a human Security Analyst includes the
 * file's text in what the AI may read (`included` true) or excludes it (false). The policy has already refused every
 * caller without the human-only grant (403).
 *
 *   the request is gone or the caller no longer reads it, or the file is not on this request          404
 *   the caller does not hold the AI inclusion as an eligible human Security Analyst                    403
 *   aiInputRefusalFor refuses                                     403 OWN_REQUEST; 409 with its closed reason
 *   the file is already as asked                                                                       200, nothing written
 *   including: the file's event log is within its reserve (197 events) or unreadable                   409 HISTORY_UNAVAILABLE
 *   including: the stored bytes are gone, or no longer match their digest (a warning-level
 *     attachment.integrity_failed line)                          409 ATTACHMENT_UNAVAILABLE, ATTACHMENT_INTEGRITY_FAILED
 *   including: the file has no text the extractor can read                                            409 ATTACHMENT_TEXT_UNAVAILABLE
 *   including: the screening and extraction queue is full (WR-204), nothing written                   503 ATTACHMENT_BUSY
 *
 * Including reads the verified bytes and extracts the text outside the lock, capped at 20,000 characters, then under
 * the lock re-checks the rule and writes `aiTextIncluded`, `aiText`, `aiTextFacts` (available, kept, truncated,
 * extractor, extractedAt) and an `ai-included` event. Excluding writes `aiTextIncluded` false, deletes the text and its
 * facts, and appends `ai-excluded`. Each change is one `attachment.ai_inclusion_changed` line with `from` and `to`, and
 * every refusal but a 404 one `attachment.refused` line; neither carries the text or the file's name. The controller logs
 * a 404 as NOT_FOUND (WR-103). An exclusion is never refused by the file's history (WR-101): when the log cannot take its
 * event (full, or malformed), the text is excluded with the log left untouched, and a warning-level
 * `attachment.history_unavailable` line records it.
 */
export async function setRequestAttachmentAiInput(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
  included: boolean;
  now?: () => Date;
}): Promise<RequestAttachment> {
  const { strapi, request, caller, attachmentId, included } = input;
  const now = input.now ?? (() => new Date());
  if (attachmentId.length < 1 || attachmentId.length > 255) throw new RequestAttachmentsError(404);

  let outcome: { changed: boolean; historyUnavailable: boolean; current: AttachmentsRequest; record: RecordValue; activeCount: number; policy: AiPolicyDecision };
  try {
    // Outside the lock: the decision's first reading, then the verified bytes and the extraction (D-31, D-32).
    const record = await attachmentOnRequest(strapi, request.documentId, attachmentId, AI_INPUT_READ);
    if (!record) throw new RequestAttachmentsError(404);
    if (caller.aiInputs !== true) throw new RequestAttachmentsError(403, undefined, undefined, AI_INPUT_DENIED);
    const policy = await requestAiPolicy(strapi, request.documentId);
    const early = aiInputRefusalFor({ request, caller, attachment: aiFactsOf(record), policy, including: included });
    if (early) throw new RequestAttachmentsError(early.status, early.reason, undefined, early.status === 403 ? AI_INPUT_DENIED : undefined);
    // PUT is idempotent: a file already as asked is answered as it is, and nothing is read, extracted, written or logged.
    if ((record.aiTextIncluded === true) === included) {
      const counts = await countAttachments(strapi, request.documentId);
      return projectAttachment(record, { caller, request, activeCount: counts.activeCount }, { policy });
    }
    // An inclusion adds: a history that cannot take it refuses before the parser runs, and the lock checks it again
    // before writing. An exclusion withdraws text, so its history never refuses it (WR-101).
    if (included) appendAddingEvent(record.eventLog, "ai-included", caller.documentId, now().toISOString());

    let extracted: { text: string; facts: Omit<AttachmentAiTextFacts, "extractedAt"> } | null = null;
    if (included) {
      const fileType = record.fileType as TextBearingType;
      const file = record.file as RecordValue | null;
      const verified = await readVerifiedStoredFile(strapi, { fileId: typeof file?.id === "number" ? file.id : null, sha256: record.sha256 });
      if ("failure" in verified) {
        if (verified.failure === "missing") throw new RequestAttachmentsError(409, "ATTACHMENT_UNAVAILABLE");
        // Tamper evidence (D-23, D-37): bytes that no longer match the digest recorded at upload are never parsed or
        // offered to the AI, and the warning-level line carries the recorded digest for the investigation.
        logSecurityEvent(strapi.log, {
          name: "attachment.integrity_failed",
          actor: await actorOf(strapi, caller),
          requestId: request.documentId,
          attachmentId,
          ...(typeof record.fileType === "string" && DOWNLOADABLE_TYPES.has(record.fileType) ? { fileType: record.fileType as AttachmentType } : {}),
          ...(typeof record.byteSize === "number" ? { byteSize: record.byteSize } : {}),
          ...(typeof record.sha256 === "string" ? { sha256: record.sha256 } : {}),
          outcome: "refused",
          reason: "ATTACHMENT_INTEGRITY_FAILED",
        });
        throw new RequestAttachmentsError(409, "ATTACHMENT_INTEGRITY_FAILED");
      }
      const text = await extractAttachmentText({ type: fileType, bytes: verified.bytes, cap: ATTACHMENT_LIMITS.textCapCharacters }).catch((error: unknown) => {
        // WR-204: the one screening and extraction queue is full; the analyst may try again in a moment.
        if (error instanceof ExtractionBusyError) throw new RequestAttachmentsError(503, "ATTACHMENT_BUSY");
        throw error;
      });
      if (!text.ok) throw new RequestAttachmentsError(409, "ATTACHMENT_TEXT_UNAVAILABLE");
      extracted = { text: text.text, facts: { available: text.available, kept: text.kept, truncated: text.truncated, extractor: text.extractor } };
    }

    outcome = await withRequestLock(strapi, request.documentId, async () => {
      const current = await loadNotesRequest(strapi, request.documentId);
      if (!current || !canUseRequestNotes(readersRequestFacts(current), readersCallerFacts(caller))) throw new RequestAttachmentsError(404);
      const locked = await attachmentOnRequest(strapi, request.documentId, attachmentId, AI_INPUT_READ);
      if (!locked) throw new RequestAttachmentsError(404);
      const lockedPolicy = await requestAiPolicy(strapi, request.documentId);
      const refusal = aiInputRefusalFor({ request: current, caller, attachment: aiFactsOf(locked), policy: lockedPolicy, including: included });
      if (refusal) throw new RequestAttachmentsError(refusal.status, refusal.reason, undefined, refusal.status === 403 ? AI_INPUT_DENIED : undefined);
      if ((locked.aiTextIncluded === true) === included || (included && !extracted)) {
        // Another change reached the same value first: nothing more is written.
        const counts = await countAttachments(strapi, request.documentId);
        return { changed: false, historyUnavailable: false, current, record: locked, activeCount: counts.activeCount, policy: lockedPolicy };
      }

      const at = now().toISOString();
      const history = extracted
        ? { data: { eventLog: appendAddingEvent(locked.eventLog, "ai-included", caller.documentId, at) }, historyUnavailable: false }
        : withdrawalHistory(locked.eventLog, ["ai-excluded"], caller.documentId, at);
      const updated = await documents(strapi, ATTACHMENT_UID).update({
        documentId: attachmentId,
        data: extracted
          ? { aiTextIncluded: true, aiText: extracted.text, aiTextFacts: { ...extracted.facts, extractedAt: at }, ...history.data }
          : { aiTextIncluded: false, aiText: null, aiTextFacts: null, ...history.data },
        ...ATTACHMENT_READ,
      });
      if (!updated) throw new RequestAttachmentsError(404);
      const counts = await countAttachments(strapi, request.documentId);
      return { changed: true, historyUnavailable: history.historyUnavailable, current, record: updated, activeCount: counts.activeCount, policy: lockedPolicy };
    });
  } catch (error) {
    // D-37: a refused change of a file the caller can see is one attachment.refused line; the controller logs a 404 as
    // the closed log reason NOT_FOUND (WR-103).
    if (error instanceof RequestAttachmentsError && error.status !== 404) throw await refused(strapi, { request, caller, attachmentId }, error);
    throw error;
  }

  const answer = projectAttachment(outcome.record, { caller, request: outcome.current, activeCount: outcome.activeCount }, { policy: outcome.policy });
  if (!outcome.changed) return answer;
  const stored = await documents(strapi, ATTACHMENT_UID).findOne({ documentId: attachmentId, fields: ["fileType", "byteSize", "sha256"] });
  const facts = {
    actor: await actorOf(strapi, caller),
    requestId: request.documentId,
    attachmentId,
    ...(typeof stored?.fileType === "string" && DOWNLOADABLE_TYPES.has(stored.fileType) ? { fileType: stored.fileType as AttachmentType } : {}),
    ...(typeof stored?.byteSize === "number" ? { byteSize: stored.byteSize } : {}),
    ...(typeof stored?.sha256 === "string" ? { sha256: stored.sha256 } : {}),
  };
  logSecurityEvent(strapi.log, { name: "attachment.ai_inclusion_changed", ...facts, outcome: included ? "included" : "excluded", from: !included, to: included });
  // WR-101: the exclusion was made without its record in the file's own history, so this line records it.
  if (outcome.historyUnavailable) logSecurityEvent(strapi.log, { name: "attachment.history_unavailable", ...facts, outcome: "excluded", reason: "HISTORY_UNAVAILABLE" });
  return answer;
}

/** The stored text an included file sends, exactly as it would be sent, with its facts (D-31). */
export type AttachmentAiText = { text: string; facts: AttachmentAiTextFacts };

const AI_TEXT_READ = { fields: ["documentId", "aiTextIncluded", "aiText", "aiTextFacts"] } as const;

/**
 * GET …/attachments/{attachmentId}/ai_text (D-04 item 6, D-31): the stored text and its facts, for a human Security
 * Analyst who may change the file's inclusion. It reads the record only, so it has no window: a file included before
 * release is still checked after it.
 *
 *   the file is not on this request                                                        404
 *   the caller does not hold the AI inclusion as an eligible human Security Analyst        403
 *   the caller raised the request (G-1)                                                    403 OWN_REQUEST
 *   the file is not included, or its stored text or facts cannot be read                   409 ATTACHMENT_TEXT_UNAVAILABLE
 *
 * It writes nothing. Every refusal but a 404 is one `attachment.refused` line with its reason, as the inclusion's are,
 * and the controller logs the 404 as NOT_FOUND (WR-103).
 */
export async function readRequestAttachmentAiText(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
}): Promise<AttachmentAiText> {
  try {
    return await storedAiText(input);
  } catch (error) {
    const { strapi, request, caller, attachmentId } = input;
    if (error instanceof RequestAttachmentsError && error.status !== 404) throw await refused(strapi, { request, caller, attachmentId }, error);
    throw error;
  }
}

/** The preview's decision and read, which readRequestAttachmentAiText logs the refusals of. */
async function storedAiText(input: {
  strapi: AttachmentsStrapi;
  request: AttachmentsRequest;
  caller: AttachmentCaller;
  attachmentId: string;
}): Promise<AttachmentAiText> {
  const { request, caller, attachmentId, strapi } = input;
  if (attachmentId.length < 1 || attachmentId.length > 255) throw new RequestAttachmentsError(404);
  const record = await attachmentOnRequest(strapi, request.documentId, attachmentId, AI_TEXT_READ);
  if (!record) throw new RequestAttachmentsError(404);
  if (caller.aiInputs !== true) throw new RequestAttachmentsError(403, undefined, undefined, AI_INPUT_DENIED);
  if (request.requestorDocumentId !== null && request.requestorDocumentId === caller.documentId) {
    throw new RequestAttachmentsError(403, "OWN_REQUEST", undefined, AI_INPUT_DENIED);
  }
  const facts = record.aiTextIncluded === true ? parseAttachmentAiTextFacts(record.aiTextFacts) : null;
  const text = record.aiText;
  if (!facts || typeof text !== "string" || text.length < 1 || text.length !== facts.kept) {
    throw new RequestAttachmentsError(409, "ATTACHMENT_TEXT_UNAVAILABLE", undefined, "The file has no stored text for the AI.");
  }
  return { text, facts };
}

/*
 * Re-scans (D-13, D-21; 14-RESEARCH Settled 5, Pitfall 11). A file the scanner could not check waits, pending, and is
 * re-scanned by the in-process scheduler: after 1, 5, 15 and 60 minutes, then hourly, at most 24 attempts, and once at
 * every Strapi start. The read and the scan run outside the request lock; the verdict is written under it, after
 * re-reading that the file is still pending, so a removal or a second re-scan in between is never overwritten.
 */

/** One scheduler per running Strapi: started by bootstrap(), stopped by destroy(). */
const attachmentRescans = new WeakMap<object, RescanScheduler>();

const RESCAN_ACTOR: SecurityEventActor = { system: "rescan" };

/** The scanner's detection as stored and served: only a name that fits the contract's pattern (as at upload). */
function storedDetection(detection: string): string | null {
  return SERVED_DETECTION.test(detection) ? detection : null;
}

/** What clamd must allow for a 25 MiB file to be scanned at all (14-RESEARCH Settled 5). */
const SCANNER_LIMITS_REQUIREMENT =
  "clamd needs StreamMaxLength and MaxFileSize of at least 30M, MaxScanSize of at least 256M and AlertExceedsMax yes";

/**
 * Re-scans one quarantined file and records the verdict (D-13, D-21). A verdict is never refused by the file's history
 * (WR-101): when the log cannot take its event (full, or malformed), the verdict is written with the log left untouched,
 * and a warning-level `attachment.history_unavailable` line records it.
 *
 *   clean         scanStatus clean, scanCheckedAt, scanEngine, a scan-verdict event; attachment.scan_verdict   released
 *   infected      scanStatus blocked and its detection, the media link cleared, a blocked event, then its bytes and
 *                 plugin file record deleted; name, size, digest and uploader kept; warn-level attachment.blocked  blocked
 *   not scanned   scanAttempts + 1; a `limits` cause logs an error naming the deployment requirement         still-pending
 *   not pending   nothing (released, blocked or gone since)                                                  gone
 *   aborted       nothing: `signal` aborted while the scan ran (the scheduler is stopping; IN-210)           still-pending
 */
export async function rescanPendingAttachment(input: {
  strapi: AttachmentsStrapi;
  attachmentId: string;
  scanner?: MalwareScanner;
  signal?: AbortSignal;
  now?: () => Date;
}): Promise<RescanOutcome> {
  return (await rescanAttachment(input)).outcome;
}

/** The re-scan, with the attempts the file has had after it, for the scheduler's backoff. */
async function rescanAttachment(input: {
  strapi: AttachmentsStrapi;
  attachmentId: string;
  scanner?: MalwareScanner;
  signal?: AbortSignal;
  now?: () => Date;
}): Promise<{ outcome: RescanOutcome; attempts: number }> {
  const { strapi, attachmentId } = input;
  const now = input.now ?? (() => new Date());
  const scanner = input.scanner ?? configuredScanner(strapi).scanner;
  const read = { fields: ["documentId", "fileType", "byteSize", "sha256", "scanStatus", "scanAttempts"], populate: { file: { fields: ["id"] }, assessmentRequest: { fields: ["documentId"] } } };
  const record = await documents(strapi, ATTACHMENT_UID).findOne({ documentId: attachmentId, ...read });
  const requestOf = (value: RecordValue | null) => (value && typeof value.assessmentRequest === "object" && value.assessmentRequest !== null ? String((value.assessmentRequest as RecordValue).documentId ?? "") : "");
  const requestId = requestOf(record);
  if (!record || record.scanStatus !== "pending" || !requestId) return { outcome: "gone", attempts: 0 };
  const file = typeof record.file === "object" && record.file !== null ? record.file as RecordValue : null;
  const fileId = typeof file?.id === "number" ? file.id : null;

  // Outside the lock: the stored bytes and the scan. Bytes that cannot be read cannot be released.
  let verdict: ScanVerdict;
  if (scanner === null) {
    verdict = { kind: "not-scanned", engine: "", cause: "unavailable" };
  } else {
    let bytes: Buffer | null = null;
    try {
      bytes = fileId === null ? null : await createAttachmentStorage(strapi).read(fileId);
    } catch (error) {
      if (!(error instanceof AttachmentStorageError)) throw error;
    }
    if (bytes === null) verdict = { kind: "not-scanned", engine: scanner.name, cause: "error" };
    else {
      try {
        verdict = await scanner.scan(bytes, input.signal);
      } catch {
        verdict = { kind: "not-scanned", engine: scanner.name, cause: "error" };
      }
    }
  }
  // IN-210: the scheduler is stopping (Strapi's destroy()). The aborted scan is no verdict and no attempt: nothing is
  // written, and the file stays pending for the next start's re-scan.
  if (input.signal?.aborted) {
    return { outcome: "still-pending", attempts: typeof record.scanAttempts === "number" ? record.scanAttempts : 0 };
  }

  const at = now().toISOString();
  const outcome = await withRequestLock(strapi, requestId, async (): Promise<{ outcome: RescanOutcome; attempts: number; historyUnavailable?: boolean }> => {
    const current = await documents(strapi, ATTACHMENT_UID).findOne({ documentId: attachmentId, fields: ["documentId", "scanStatus", "scanAttempts", "eventLog"] });
    if (!current || current.scanStatus !== "pending") return { outcome: "gone", attempts: 0 };
    const attempts = typeof current.scanAttempts === "number" && Number.isSafeInteger(current.scanAttempts) ? current.scanAttempts : 0;
    if (verdict.kind === "clean") {
      const history = recordAttachmentWithdrawal(current.eventLog, [
        { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type: "scan-verdict", by: null, at, engine: verdict.engine, verdict: "clean" },
      ]);
      await documents(strapi, ATTACHMENT_UID).update({
        documentId: attachmentId,
        data: {
          scanStatus: "clean",
          scanCheckedAt: at,
          scanEngine: verdict.engine.slice(0, 255),
          ...(history.recorded ? { eventLog: history.eventLog } : {}),
        },
      });
      return { outcome: "released", attempts, historyUnavailable: !history.recorded };
    }
    if (verdict.kind === "infected") {
      const detection = storedDetection(verdict.detection);
      const history = recordAttachmentWithdrawal(current.eventLog, [
        { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type: "blocked", by: null, at, engine: verdict.engine, verdict: "infected", ...(detection ? { detection } : {}) },
      ]);
      await documents(strapi, ATTACHMENT_UID).update({
        documentId: attachmentId,
        data: {
          scanStatus: "blocked",
          scanCheckedAt: at,
          scanEngine: verdict.engine.slice(0, 255),
          scanDetection: detection,
          file: null,
          ...(history.recorded ? { eventLog: history.eventLog } : {}),
        },
      });
      return { outcome: "blocked", attempts, historyUnavailable: !history.recorded };
    }
    await documents(strapi, ATTACHMENT_UID).update({ documentId: attachmentId, data: { scanAttempts: attempts + 1 } });
    return { outcome: "still-pending", attempts: attempts + 1 };
  });

  const facts = {
    requestId,
    attachmentId,
    ...(typeof record.fileType === "string" && DOWNLOADABLE_TYPES.has(record.fileType) ? { fileType: record.fileType as AttachmentType } : {}),
    ...(typeof record.byteSize === "number" ? { byteSize: record.byteSize } : {}),
    ...(typeof record.sha256 === "string" ? { sha256: record.sha256 } : {}),
  };
  if (outcome.outcome === "released") {
    logSecurityEvent(strapi.log, { name: "attachment.scan_verdict", actor: RESCAN_ACTOR, ...facts, outcome: "clean" });
  } else if (outcome.outcome === "blocked") {
    // The record no longer links the file; its bytes and plugin file record go now, outside the lock. A failure here
    // leaves an orphaned object, never a reachable one, and is logged for the operator.
    if (fileId !== null) {
      await createAttachmentStorage(strapi).remove(fileId).catch(() => {
        strapi.log.error(`csrm.attachment_rescan: the stored bytes of blocked attachment ${attachmentId} could not be deleted; delete plugin file record ${fileId} and its object.`);
      });
    }
    logSecurityEvent(strapi.log, {
      name: "attachment.blocked",
      actor: RESCAN_ACTOR,
      ...facts,
      outcome: "blocked",
      reason: "ATTACHMENT_MALWARE_FOUND",
      ...(verdict.kind === "infected" ? { detection: verdict.detection } : {}),
    });
  }
  if (outcome.historyUnavailable === true && (outcome.outcome === "released" || outcome.outcome === "blocked")) {
    // WR-101: the verdict was written without its record in the file's own history, so this line records it.
    logSecurityEvent(strapi.log, { name: "attachment.history_unavailable", actor: RESCAN_ACTOR, ...facts, outcome: outcome.outcome === "released" ? "clean" : "blocked", reason: "HISTORY_UNAVAILABLE" });
  } else if (outcome.outcome === "still-pending" && verdict.kind === "not-scanned" && verdict.cause === "limits") {
    // G-7: re-scans repeat a limits verdict until an operator raises the engine's limits.
    strapi.log.error(`csrm.attachment_rescan: attachment ${attachmentId} is over the malware scanner's limits and stays quarantined; ${SCANNER_LIMITS_REQUIREMENT}.`);
  }
  return { outcome: outcome.outcome, attempts: outcome.attempts };
}

/** Every quarantined file, with its attempts so far, for the scheduler's start. */
async function listPendingAttachments(strapi: AttachmentsStrapi): Promise<Array<{ id: string; attempts: number }>> {
  const records = await documents(strapi, ATTACHMENT_UID).findMany({
    filters: { scanStatus: { $eq: "pending" } },
    fields: ["documentId", "scanAttempts"],
    sort: ["id:asc"],
    limit: 10_000,
  });
  return records.map((record) => ({ id: String(record.documentId), attempts: typeof record.scanAttempts === "number" ? record.scanAttempts : 1 }));
}

/**
 * Starts the re-scans for this Strapi (D-13): re-scans every quarantined file once, then schedules each still pending.
 * A no-op when attachments are not configured. The returned promise settles when the start's re-scans have run;
 * bootstrap() does not wait for it, so an unavailable scanner never holds up a start.
 */
export async function startAttachmentRescans(strapi: AttachmentsStrapi): Promise<void> {
  const { configured, scanner } = configuredScanner(strapi);
  if (!configured || scanner === null || attachmentRescans.has(strapi)) return;
  const scheduler = createRescanScheduler({
    listPending: () => listPendingAttachments(strapi),
    rescan: (id, signal) => rescanAttachment({ strapi, attachmentId: id, scanner, signal }),
    logger: { error: (message) => strapi.log.error(message) },
  });
  attachmentRescans.set(strapi, scheduler);
  try {
    await scheduler.start();
  } catch {
    strapi.log.error("csrm.attachment_rescan: the start's re-scan of quarantined attachments failed; each is re-scanned at the next start.");
  }
}

/**
 * Stops this Strapi's re-scans (D-13; Pitfall 11): every timer is cleared, a scan in flight is aborted (IN-210) and its
 * re-scan ends without writing.
 */
export async function stopAttachmentRescans(strapi: AttachmentsStrapi): Promise<void> {
  const scheduler = attachmentRescans.get(strapi);
  attachmentRescans.delete(strapi);
  await scheduler?.stop();
}

/** The attachments with a re-scan scheduled for this Strapi, or null when its re-scans are not running. */
export function scheduledAttachmentRescans(strapi: AttachmentsStrapi): readonly string[] | null {
  return attachmentRescans.get(strapi)?.scheduled() ?? null;
}
