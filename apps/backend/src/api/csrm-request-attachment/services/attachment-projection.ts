import type { AiPolicyDecision, DataClassification } from "../../../csrm/ai/data-policy";
import {
  ATTACHMENT_DETECTION_PATTERN,
  ATTACHMENT_LIMITS,
  ATTACHMENT_NAME_MAX_LENGTH,
  ATTACHMENT_TYPES,
  TEXT_BEARING_ATTACHMENT_TYPES,
  type AttachmentType,
} from "../../../csrm/files/attachment-policy";
import { PERSON_FIELDS, projectPerson, type Person } from "../../csrm-assessment-request/services/request-people";
import {
  addRefusalFor,
  aiInputRefusalFor,
  aiPolicyRefusalFor,
  attachmentStateOf,
  attachmentWindow,
  canRemoveAttachment,
  canRestoreAttachment,
  type AttachmentAddRefusal,
  type AttachmentAiPolicyRefusal,
  type AttachmentCaller,
  type AttachmentRequestFacts,
  type AttachmentState,
  type AttachmentWindow,
} from "./attachment-rules";

/*
 * What a reader sees of a request's attachments (Phase 14 D-05, D-28). The projection is built from an allow-list of
 * record fields: never the digest, the plugin file record (its storage key, provider metadata or address) or the
 * extracted text, so nothing of the stored file leaves Strapi. A human Security Analyst also gets the file's AI facts
 * (D-28, D-30): whether its text is included, how much of it is kept, why it cannot be, and whether they may change it. The media relation is read as its id alone, to tell an
 * unavailable file from an available one. People cross as `{ documentId, displayName }` only.
 */

export type AttachmentPart = "requestor" | "security-analyst";

export type RequestAttachmentActions = { download: boolean; remove: boolean; restore: boolean };

export type RequestAttachment = {
  documentId: string;
  fileName: string;
  fileType: AttachmentType;
  byteSize: number;
  state: AttachmentState;
  uploadedBy: Person | null;
  uploaderPart: AttachmentPart;
  uploadedAt: string;
  note: { documentId: string; postedAt: string } | null;
  removedBy: Person | null;
  removedAt: string | null;
  /** The scanner's detection name, served for a blocked file only (D-21). */
  detection: string | null;
  actions: RequestAttachmentActions;
  /** The file's AI inclusion, served to a human Security Analyst only (D-28, D-30); a Requestor's file has no such key. */
  ai?: RequestAttachmentAi;
};

/** The size of an included file's stored text (D-33): never its text. */
export type RequestAttachmentAiFacts = { available: number; kept: number; truncated: boolean };

/** Why a file's text cannot be included whoever asks: an image has none the AI can read, a quarantined file is never read. */
export type RequestAttachmentAiUnavailableReason = "ATTACHMENT_NOT_TEXT_BEARING" | "ATTACHMENT_QUARANTINED";

export type RequestAttachmentAi = {
  included: boolean;
  facts: RequestAttachmentAiFacts | null;
  unavailableReason: RequestAttachmentAiUnavailableReason | null;
  canChange: boolean;
};

export type RequestAttachmentAddFacts = {
  canAdd: boolean;
  refusal: AttachmentAddRefusal | null;
  window: AttachmentWindow;
  needsNote: boolean;
  remaining: number;
  activeCount: number;
  storedCount: number;
  limits: { maxBytes: number; maxActive: number; maxStored: number };
  allowedTypes: AttachmentType[];
};

/** The record fields a projection reads, and the relations it populates, each as the fields it needs only. */
export const ATTACHMENT_READ = {
  // `aiTextFacts` is read for the analysts' AI facts; `aiText` itself is never read here (D-31: only the preview serves it).
  fields: ["documentId", "fileName", "fileType", "byteSize", "uploaderPart", "uploadedAt", "scanStatus", "scanDetection", "removedAt", "aiTextIncluded", "aiTextFacts"],
  populate: {
    file: { fields: ["id"] },
    uploadedBy: { fields: [...PERSON_FIELDS] },
    removedBy: { fields: [...PERSON_FIELDS] },
    note: { fields: ["documentId", "postedAt"] },
  },
} as const;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function instant(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "string" || typeof value === "number" || value instanceof Date ? new Date(value) : new Date(Number.NaN);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function integer(value: unknown): number | null {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) ? number : null;
}

const TYPES: ReadonlySet<string> = new Set(ATTACHMENT_TYPES);

/** A documentId safe to name in a log line: Strapi's own form, or nothing of the stored value. */
const LOGGABLE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * A stored attachment whose served facts the published schema forbids (IN-704): an empty or overlong name, a type,
 * size, uploader part or upload time outside the contract, or a note link without a readable time. Every write goes
 * through the validated attachment service, so such a record is a tamper or corruption signal, not a user path. The
 * projection refuses it rather than invent a value (fail visible, as Phase 13 IN-103 and this phase's IN-101 ruling):
 * the read answers 500 through Strapi's internal-error path, whose one error line is this message. The message names
 * the attachment's documentId and the field, never the stored value.
 */
export class MalformedAttachmentRecordError extends Error {
  constructor(readonly documentId: string, readonly field: string) {
    super(`CSRM request attachment ${documentId} has a malformed ${field}, so it is not served.`);
    this.name = "MalformedAttachmentRecordError";
  }
}

/** The facts the published `RequestAttachment` requires, read from a record, or the malformed record refused. */
function requiredFacts(record: RecordValue): {
  documentId: string;
  fileName: string;
  fileType: AttachmentType;
  byteSize: number;
  uploaderPart: AttachmentPart;
  uploadedAt: string;
  note: { documentId: string; postedAt: string } | null;
} {
  const documentId = typeof record.documentId === "string" ? record.documentId : "";
  const malformed = (field: string) => new MalformedAttachmentRecordError(LOGGABLE_ID.test(documentId) ? documentId : "with an unreadable documentId", field);
  if (!LOGGABLE_ID.test(documentId)) throw malformed("documentId");
  const { fileName, fileType, uploaderPart } = record;
  if (typeof fileName !== "string" || fileName.length < 1 || fileName.length > ATTACHMENT_NAME_MAX_LENGTH) throw malformed("fileName");
  if (typeof fileType !== "string" || !TYPES.has(fileType)) throw malformed("fileType");
  const byteSize = integer(record.byteSize);
  if (byteSize === null || byteSize < 1 || byteSize > ATTACHMENT_LIMITS.maxBytes) throw malformed("byteSize");
  if (uploaderPart !== "requestor" && uploaderPart !== "security-analyst") throw malformed("uploaderPart");
  const uploadedAt = instant(record.uploadedAt);
  if (uploadedAt === null) throw malformed("uploadedAt");
  let note: { documentId: string; postedAt: string } | null = null;
  if (isRecord(record.note) && typeof record.note.documentId === "string") {
    const postedAt = instant(record.note.postedAt);
    if (postedAt === null) throw malformed("note.postedAt");
    note = { documentId: record.note.documentId, postedAt };
  }
  return { documentId, fileName, fileType: fileType as AttachmentType, byteSize, uploaderPart, uploadedAt, note };
}

/** The viewer a projection is built for, with the request facts its actions depend on. */
export type AttachmentViewer = {
  caller: AttachmentCaller;
  request: AttachmentRequestFacts;
  /** The request's active files, for whether a restore would exceed the limit. */
  activeCount: number;
};

/** Whether the populated media relation still names a plugin file record. */
export function hasStoredFile(record: RecordValue): boolean {
  const file = record.file;
  return isRecord(file) && typeof file.id === "number";
}

/**
 * One attachment as the viewer may see it, with the actions the server says this viewer may take now. With `ai` (the
 * request's AI data policy) and a viewer holding the AI inclusion, it also carries the file's AI facts (D-28, D-30).
 * A record whose required facts the published schema forbids is refused with MalformedAttachmentRecordError (IN-704),
 * and a blocked file's detection is served only under the contract's one pattern, null otherwise (WR-501, IN-704).
 */
export function projectAttachment(record: RecordValue, viewer: AttachmentViewer, ai?: { policy: AiPolicyDecision }): RequestAttachment {
  const required = requiredFacts(record);
  const state = attachmentStateOf({ scanStatus: record.scanStatus, removedAt: record.removedAt, hasFile: hasStoredFile(record) });
  const uploadedBy = projectPerson(record.uploadedBy);
  const removedBy = projectPerson(record.removedBy);
  const facts = {
    uploadedByDocumentId: uploadedBy?.documentId ?? null,
    removedByDocumentId: removedBy?.documentId ?? null,
    scanStatus: record.scanStatus,
    removedAt: record.removedAt,
  };
  return {
    documentId: required.documentId,
    fileName: required.fileName,
    fileType: required.fileType,
    byteSize: required.byteSize,
    state,
    uploadedBy,
    uploaderPart: required.uploaderPart,
    uploadedAt: required.uploadedAt,
    note: required.note,
    removedBy,
    removedAt: instant(record.removedAt),
    detection: state === "blocked" && typeof record.scanDetection === "string" && ATTACHMENT_DETECTION_PATTERN.test(record.scanDetection) ? record.scanDetection : null,
    actions: {
      download: state === "available",
      remove: state !== "removed" && canRemoveAttachment({ request: viewer.request, caller: viewer.caller, attachment: facts }) === null,
      restore: state === "removed" && canRestoreAttachment({ request: viewer.request, caller: viewer.caller, attachment: facts, activeCount: viewer.activeCount }) === null,
    },
    ...(ai && viewer.caller.aiInputs === true ? { ai: projectAttachmentAi(record, viewer, ai.policy) } : {}),
  };
}

const TEXT_BEARING: ReadonlySet<string> = new Set(TEXT_BEARING_ATTACHMENT_TYPES);

/**
 * The file's AI facts for a viewer holding the AI inclusion (D-28, D-30, D-33): whether it is included, the size of the
 * stored text while it is, why it can never be included, and whether this viewer may change it now (exclusion when it
 * is included, inclusion when it is not), as aiInputRefusalFor decides.
 */
export function projectAttachmentAi(record: RecordValue, viewer: AttachmentViewer, policy: AiPolicyDecision): RequestAttachmentAi {
  const state = attachmentStateOf({ scanStatus: record.scanStatus, removedAt: record.removedAt, hasFile: hasStoredFile(record) });
  const included = record.aiTextIncluded === true;
  const stored = included ? parseAttachmentAiTextFacts(record.aiTextFacts) : null;
  const unavailableReason = typeof record.fileType !== "string" || !TEXT_BEARING.has(record.fileType)
    ? "ATTACHMENT_NOT_TEXT_BEARING"
    : state === "pending" ? "ATTACHMENT_QUARANTINED" : null;
  const refusal = aiInputRefusalFor({
    request: viewer.request,
    caller: viewer.caller,
    attachment: { state, fileType: record.fileType, included },
    policy,
    including: !included,
  });
  return {
    included,
    facts: stored ? { available: stored.available, kept: stored.kept, truncated: stored.truncated } : null,
    unavailableReason,
    canChange: viewer.caller.aiInputs === true && refusal === null,
  };
}

/** The section's AI policy for a viewer holding the AI inclusion (D-28, D-30): whether files can be included, and why not. */
export type RequestAttachmentAiPolicy = {
  canChange: boolean;
  refusal: AttachmentAiPolicyRefusal | null;
  classification: DataClassification;
  ceiling: DataClassification | null;
};

/**
 * The section's AI policy: the request-level refusal aiPolicyRefusalFor decides, with the request's classification and
 * the provider's ceiling, so the section can say which classification governs (Phase 12 D-26).
 */
export function projectAttachmentAiPolicy(input: { request: AttachmentRequestFacts; caller: AttachmentCaller; policy: AiPolicyDecision }): RequestAttachmentAiPolicy {
  const refusal = aiPolicyRefusalFor(input);
  return {
    canChange: input.caller.aiInputs === true && refusal === null,
    refusal,
    classification: input.policy.requestClassification,
    ceiling: input.policy.ceiling,
  };
}

/** The extraction facts stored with an included file's text (`aiTextFacts`, D-31, D-33). */
export type AttachmentAiTextFacts = { available: number; kept: number; truncated: boolean; extractor: string; extractedAt: string };

const AI_TEXT_FACT_KEYS = ["available", "kept", "truncated", "extractor", "extractedAt"] as const;

/**
 * The stored `aiTextFacts`, parsed closed: exactly its five keys, counts within the cap and agreeing with each other, and
 * a readable extraction time. Anything else is null, so a damaged record reads as having no stored text (fails safe).
 */
export function parseAttachmentAiTextFacts(value: unknown): AttachmentAiTextFacts | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== AI_TEXT_FACT_KEYS.length || keys.some((key) => !(AI_TEXT_FACT_KEYS as readonly string[]).includes(key))) return null;
  const { available, kept, truncated, extractor } = value;
  if (typeof available !== "number" || !Number.isSafeInteger(available) || available < 1) return null;
  if (typeof kept !== "number" || !Number.isSafeInteger(kept) || kept < 1 || kept > ATTACHMENT_LIMITS.textCapCharacters || kept > available) return null;
  if (typeof truncated !== "boolean" || truncated !== available > kept) return null;
  if (typeof extractor !== "string" || extractor.length < 1 || extractor.length > 255) return null;
  const extractedAt = instant(value.extractedAt);
  if (extractedAt === null) return null;
  return { available, kept, truncated, extractor, extractedAt };
}

/** Whether, and how, the viewer may add a file to the request now (D-10, D-16, D-17, D-28). */
export function projectAddFacts(input: {
  request: AttachmentRequestFacts;
  caller: AttachmentCaller;
  activeCount: number;
  storedCount: number;
  configured: boolean;
}): RequestAttachmentAddFacts {
  const refusal = addRefusalFor(input);
  const window = attachmentWindow(input.request);
  return {
    canAdd: refusal === null,
    refusal,
    window,
    needsNote: window === "after-submission",
    remaining: Math.max(0, Math.min(ATTACHMENT_LIMITS.maxActivePerRequest - input.activeCount, ATTACHMENT_LIMITS.maxStoredPerRequest - input.storedCount)),
    activeCount: input.activeCount,
    storedCount: input.storedCount,
    limits: {
      maxBytes: ATTACHMENT_LIMITS.maxBytes,
      maxActive: ATTACHMENT_LIMITS.maxActivePerRequest,
      maxStored: ATTACHMENT_LIMITS.maxStoredPerRequest,
    },
    allowedTypes: [...ATTACHMENT_TYPES],
  };
}
