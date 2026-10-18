import { sendStoredFile, type DownloadContext } from "../../../csrm/files/send-stored-file";
import { canUseRequestNotes } from "../../csrm-request-note/services/request-notes-policy";
import { readersCallerFacts, readersRequestFacts, type AttachmentCaller } from "../services/attachment-rules";
import {
  RequestAttachmentsError,
  listRequestAttachments,
  loadAttachmentsRequest,
  readRequestAttachmentAiText,
  readRequestAttachmentContent,
  recordAttachmentNotFound,
  recordAttachmentRefusal,
  setRequestAttachmentAiInput,
  setRequestAttachmentRemoval,
  uploadRequestAttachment,
  type AttachmentUpload,
  type AttachmentsRequest,
  type AttachmentsStrapi,
} from "../services/request-attachments";

/*
 * GET and POST /api/v1/assessment_requests/{requestId}/attachments, GET …/attachments/{attachmentId}/content, PUT
 * …/attachments/{attachmentId}/removal, PUT …/attachments/{attachmentId}/ai_input and GET
 * …/attachments/{attachmentId}/ai_text (Phase 14 D-04 items 1 to 6, D-18, D-20, D-23, D-30, D-31). The policy has
 * checked the caller's Role → Function → FunctionAPI grant against the resolved IdamBox User. Every handler then
 * loads the request and asks canUseRequestNotes, the notes readers predicate, with the requestor and the caller's
 * documentId and human-analyst fact only (no participant input); a missing request and a caller who may not use its
 * attachments get the same 404 with one actor-neutral message, before anything else is read or written. Every 404 an
 * operation answers, the readers rule's and a file's that is not on the request, is one `attachment.refused` line with
 * the closed log reason NOT_FOUND and only the identifiers asked for (WR-103); the response names no reason. The
 * handlers never branch on the auth mode: they read only `ctx.state.idamboxUser` and the policy's facts.
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ERROR_NAMES = {
  400: "BadRequestError",
  403: "ForbiddenError",
  404: "NotFoundError",
  409: "ConflictError",
  413: "PayloadTooLargeError",
  415: "UnsupportedMediaTypeError",
  422: "UnprocessableEntityError",
  503: "ServiceUnavailableError",
} as const;

/**
 * The published, closed error envelope: exactly `{ error }` (IN-705; `AssessmentWorkflowErrorResponse` declares no
 * `data`, and R-08-38's `data: null` is Strapi's own framework envelope, which this hand-written refusal does not copy).
 */
function refuse(ctx: RecordValue, error: RequestAttachmentsError): unknown {
  const details = error.reason ? { reason: error.reason, ...(error.details?.detection ? { detection: error.details.detection } : {}) } : undefined;
  ctx.status = error.status;
  return { error: { status: error.status, name: ERROR_NAMES[error.status], message: error.message, ...(details ? { details } : {}) } };
}

function strapiInstance(): AttachmentsStrapi {
  return globalThis.strapi as unknown as AttachmentsStrapi;
}

/** The resolved IdamBox User and the policy's facts, as the attachment rules read them. */
function callerOf(ctx: RecordValue): AttachmentCaller {
  const state = isRecord(ctx.state) ? ctx.state : {};
  const identity = isRecord(state.idamboxUser) ? state.idamboxUser : {};
  const facts = isRecord(state.csrmAuthorization) ? state.csrmAuthorization : {};
  return {
    documentId: typeof identity.documentId === "string" ? identity.documentId : "",
    humanAnalyst: facts.humanAnalyst === true,
    aiInputs: facts.canUseAttachmentAiInputs === true,
  };
}

/** The request, admitted for the caller by canUseRequestNotes; anything else is the one 404 (D-18). */
async function admit(ctx: RecordValue, caller: AttachmentCaller): Promise<{ caller: AttachmentCaller; request: AttachmentsRequest }> {
  const params = isRecord(ctx.params) ? ctx.params : {};
  const requestDocumentId = typeof params.requestId === "string" ? params.requestId : "";
  const request = caller.documentId ? await loadAttachmentsRequest(strapiInstance(), requestDocumentId) : null;
  if (!request || !canUseRequestNotes(readersRequestFacts(request), readersCallerFacts(caller))) throw new RequestAttachmentsError(404);
  return { caller, request };
}

/**
 * The refusal's answer. A 404 is first one `attachment.refused` line (WR-103): the closed log reason NOT_FOUND and the
 * path's request and attachment ids, each logged only when it passes the log's identifier rule. Every other refusal
 * was logged where it was decided, with its reason.
 */
async function answerRefusal(ctx: RecordValue, caller: AttachmentCaller, error: RequestAttachmentsError): Promise<unknown> {
  if (error.status === 404) {
    const params = isRecord(ctx.params) ? ctx.params : {};
    await recordAttachmentNotFound(strapiInstance(), { caller, requestId: params.requestId, attachmentId: params.attachmentId });
  }
  return refuse(ctx, error);
}

/** The one `file` part, as formidable delivered it; no part, another file part or a second `file` part is 400. */
function uploadPart(request: RecordValue): AttachmentUpload {
  const files = isRecord(request.files) ? request.files : {};
  const file = files.file;
  if (Object.keys(files).length !== 1 || !isRecord(file)) throw new RequestAttachmentsError(400);
  const filepath = typeof file.filepath === "string" ? file.filepath : typeof file.path === "string" ? file.path : null;
  const originalFilename = typeof file.originalFilename === "string" ? file.originalFilename : typeof file.name === "string" ? file.name : null;
  const size = typeof file.size === "number" && Number.isSafeInteger(file.size) && file.size >= 0 ? file.size : null;
  if (filepath === null || originalFilename === null || size === null) throw new RequestAttachmentsError(400);
  return { filepath, originalFilename, size };
}

/** The optional `noteId` part, once, as a string of 1 to 255 characters; any other field is 400 (D-04 item 2). */
function noteIdPart(request: RecordValue): string | undefined {
  const body = request.body === undefined || request.body === null ? {} : request.body;
  if (!isRecord(body)) throw new RequestAttachmentsError(400);
  if (Object.keys(body).some((key) => key !== "noteId")) throw new RequestAttachmentsError(400);
  if (!("noteId" in body)) return undefined;
  const noteId = body.noteId;
  if (typeof noteId !== "string" || noteId.length < 1 || noteId.length > 255) throw new RequestAttachmentsError(400);
  return noteId;
}

/** The path's attachment id, as a string; the service answers 404 for one that is not on the request. */
function attachmentIdParam(ctx: RecordValue): string {
  const params = isRecord(ctx.params) ? ctx.params : {};
  return typeof params.attachmentId === "string" ? params.attachmentId : "";
}

/** The removal body, exactly `{ data: { removed: boolean } }`; any other shape or key is 400 (D-04 item 4). */
function removalBody(request: RecordValue): boolean {
  const body = request.body;
  if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.data)) throw new RequestAttachmentsError(400);
  const data = body.data;
  if (Object.keys(data).length !== 1 || typeof data.removed !== "boolean") throw new RequestAttachmentsError(400);
  return data.removed;
}

/** The AI inclusion body, exactly `{ data: { included: boolean } }`; any other shape or key is 400 (D-04 item 5). */
function aiInputBody(request: RecordValue): boolean {
  const body = request.body;
  if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.data)) throw new RequestAttachmentsError(400);
  const data = body.data;
  if (Object.keys(data).length !== 1 || typeof data.included !== "boolean") throw new RequestAttachmentsError(400);
  return data.included;
}

const requestAttachmentsController = {
  async list(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const { attachments, meta } = await listRequestAttachments({ strapi: strapiInstance(), request, caller });
      return { data: attachments, meta };
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },

  async upload(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const incoming = isRecord(ctx.request) ? ctx.request : {};
      let upload: AttachmentUpload;
      let noteId: string | undefined;
      try {
        upload = uploadPart(incoming);
        noteId = noteIdPart(incoming);
      } catch (error) {
        // D-37: a refused part is a security event like every other refusal, logged once the caller is admitted.
        if (error instanceof RequestAttachmentsError) await recordAttachmentRefusal(strapiInstance(), { request, caller }, error);
        throw error;
      }
      const data = await uploadRequestAttachment({ strapi: strapiInstance(), request, caller, upload, ...(noteId === undefined ? {} : { noteId }) });
      ctx.status = 201;
      return { data };
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },

  /** D-23: the verified bytes with the hardening headers; nothing of the file is sent on any refusal. */
  async download(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const content = await readRequestAttachmentContent({ strapi: strapiInstance(), request, caller, attachmentId: attachmentIdParam(ctx) });
      ctx.status = 200;
      sendStoredFile(ctx as unknown as DownloadContext, content);
      return undefined;
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },

  /** D-20: removes the file softly, or restores it, and answers the file as the caller now sees it. */
  async setRemoval(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const attachmentId = attachmentIdParam(ctx);
      let removed: boolean;
      try {
        removed = removalBody(isRecord(ctx.request) ? ctx.request : {});
      } catch (error) {
        // D-37: a refused body is a security event like every other refusal, logged once the caller is admitted.
        // The path's file id is not yet known to be on this request, so the line names the request only.
        if (error instanceof RequestAttachmentsError) await recordAttachmentRefusal(strapiInstance(), { request, caller }, error);
        throw error;
      }
      const data = await setRequestAttachmentRemoval({ strapi: strapiInstance(), request, caller, attachmentId, removed });
      ctx.status = 200;
      return { data };
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },

  /** D-30, D-31: includes the file's text in the AI inputs, or excludes it, and answers the file with its AI facts. */
  async setAiInput(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const attachmentId = attachmentIdParam(ctx);
      let included: boolean;
      try {
        included = aiInputBody(isRecord(ctx.request) ? ctx.request : {});
      } catch (error) {
        // D-37: a refused body is a security event like every other refusal; the line names the request only.
        if (error instanceof RequestAttachmentsError) await recordAttachmentRefusal(strapiInstance(), { request, caller }, error);
        throw error;
      }
      const data = await setRequestAttachmentAiInput({ strapi: strapiInstance(), request, caller, attachmentId, included });
      ctx.status = 200;
      return { data };
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },

  /** D-31: the stored text an included file sends to the AI, exactly as it would be sent, with its facts. */
  async getAiText(ctx: RecordValue) {
    const caller = callerOf(ctx);
    try {
      const { request } = await admit(ctx, caller);
      const data = await readRequestAttachmentAiText({ strapi: strapiInstance(), request, caller, attachmentId: attachmentIdParam(ctx) });
      ctx.status = 200;
      return { data };
    } catch (error) {
      if (error instanceof RequestAttachmentsError) return answerRefusal(ctx, caller, error);
      throw error;
    }
  },
};

export default requestAttachmentsController;
