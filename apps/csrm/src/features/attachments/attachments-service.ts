import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type TransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  ATTACHMENT_RESPONSE_CONTENT_TYPES,
  validateAttachmentFileResponse,
  type FileResponseFailure,
} from '../../lib/files/file-response';
import type { ContractResponseParser } from '../assessments/assessment-service';
import {
  attachmentAiInputInputSchema,
  attachmentAiInputRequestSchema,
  attachmentAiTextInputSchema,
  attachmentRemovalInputSchema,
  attachmentRemovalRequestSchema,
  downloadAttachmentInputSchema,
  listAttachmentsInputSchema,
  requestAttachmentAiTextResponseSchema,
  requestAttachmentListResponseSchema,
  requestAttachmentResponseSchema,
  uploadAttachmentInputSchema,
  type RequestAttachment,
  type RequestAttachmentAiText,
  type RequestAttachmentsPage,
} from './attachments-schema';

export const responseParserModule = {
  modulePath: 'features/attachments/attachments-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'listRequestAttachments', component: 'RequestAttachmentListResponse', parser: requestAttachmentListResponseSchema },
    { label: 'uploadRequestAttachment', component: 'RequestAttachmentResponse', parser: requestAttachmentResponseSchema },
    { label: 'setRequestAttachmentRemoval', component: 'RequestAttachmentResponse', parser: requestAttachmentResponseSchema },
    { label: 'setRequestAttachmentAiInput', component: 'RequestAttachmentResponse', parser: requestAttachmentResponseSchema },
    { label: 'getRequestAttachmentAiText', component: 'RequestAttachmentAiTextResponse', parser: requestAttachmentAiTextResponseSchema },
  ] as const satisfies readonly ContractResponseParser[],
  // D-24: the download is a file, checked by the shared file-response validator instead of a zod parser.
  fileResponses: [
    {
      label: 'downloadRequestAttachment',
      path: '/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content',
      method: 'get' as const,
      contentTypes: ATTACHMENT_RESPONSE_CONTENT_TYPES,
    },
  ],
};

/* The upload's body is the FormData itself: openapi-fetch must not serialise it, and the runtime sets its boundary. */
const multipartBodySerializer = (body: unknown) => body as FormData;

/**
 * A request's files, newest first, with whether the viewer may add one now (Phase 14 D-04 item 1, D-28). Strapi
 * decides who may read them: a caller who may not gets the same 404 as a missing request.
 */
export async function listRequestAttachments(requestId: string): Promise<TransportResult<RequestAttachmentsPage>> {
  let parsed: z.output<typeof listAttachmentsInputSchema>;
  try {
    parsed = listAttachmentsInputSchema.parse({ requestId });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/assessment_requests/{requestId}/attachments', {
      params: { path: { requestId: parsed.requestId } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    const page = requestAttachmentListResponseSchema.parse(data);
    return { data: { attachments: page.data, meta: page.meta }, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('listRequestAttachments');
    return normalizeTransportError(error);
  }
}

/**
 * Adds one file (D-04 item 2): multipart with the `file` part and, after submission, the caller's own note's id
 * (D-17). Strapi checks the content, the size, the limits and the window, scans the file and decides every rule; a
 * refusal keeps its closed reason, and a malware refusal its detection name.
 */
export async function uploadRequestAttachment(requestId: string, file: File, noteId?: string): Promise<TransportResult<RequestAttachment>> {
  let parsed: z.output<typeof uploadAttachmentInputSchema>;
  try {
    parsed = uploadAttachmentInputSchema.parse({ requestId, file, ...(noteId === undefined ? {} : { noteId }) });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  const form = new FormData();
  form.set('file', parsed.file, parsed.file.name);
  if (parsed.noteId !== undefined) form.set('noteId', parsed.noteId);
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/assessment_requests/{requestId}/attachments', {
      params: { path: { requestId: parsed.requestId } },
      body: form as never,
      bodySerializer: multipartBodySerializer,
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestAttachmentResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('uploadRequestAttachment');
    return normalizeTransportError(error);
  }
}

/**
 * Removes one file softly (`removed` true) or restores it (false) (D-04 item 4, D-20). Strapi decides who may: the
 * uploader removes their own, a Security Analyst any after submission, and only the remover restores. A refusal keeps
 * its closed reason (NOT_UPLOADER, NOT_REMOVER, ATTACHMENTS_CLOSED and the rest); the file comes back as the caller now
 * sees it.
 */
export async function setRequestAttachmentRemoval(requestId: string, attachmentId: string, removed: boolean): Promise<TransportResult<RequestAttachment>> {
  let parsed: z.output<typeof attachmentRemovalInputSchema>;
  try {
    parsed = attachmentRemovalInputSchema.parse({ requestId, attachmentId, removed });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal', {
      params: { path: { requestId: parsed.requestId, attachmentId: parsed.attachmentId } },
      body: attachmentRemovalRequestSchema.parse({ data: { removed: parsed.removed } }),
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestAttachmentResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('setRequestAttachmentRemoval');
    return normalizeTransportError(error);
  }
}

/**
 * Includes one file's text in what the AI may read (`included` true) or excludes it (false) (D-04 item 5, D-30, D-31).
 * Strapi decides who may: a human Security Analyst who did not raise the request, from submission until release, for a
 * clean text-bearing file and only while the request's AI data policy allows. A refusal keeps its closed reason
 * (OWN_REQUEST, ATTACHMENT_NOT_TEXT_BEARING, ATTACHMENT_TEXT_UNAVAILABLE, AI_CLASSIFICATION_ABOVE_CEILING and the rest);
 * the file comes back with its AI facts, never its text.
 */
export async function setRequestAttachmentAiInput(requestId: string, attachmentId: string, included: boolean): Promise<TransportResult<RequestAttachment>> {
  let parsed: z.output<typeof attachmentAiInputInputSchema>;
  try {
    parsed = attachmentAiInputInputSchema.parse({ requestId, attachmentId, included });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input', {
      params: { path: { requestId: parsed.requestId, attachmentId: parsed.attachmentId } },
      body: attachmentAiInputRequestSchema.parse({ data: { included: parsed.included } }),
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestAttachmentResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('setRequestAttachmentAiInput');
    return normalizeTransportError(error);
  }
}

/**
 * The stored text an included file sends to the AI, exactly as it would be sent, with its facts (D-04 item 6, D-31), for
 * the analyst to check before generating. The text is untrusted file content: show it as plain text. A file that is not
 * included answers ATTACHMENT_TEXT_UNAVAILABLE.
 */
export async function getRequestAttachmentAiText(requestId: string, attachmentId: string): Promise<TransportResult<RequestAttachmentAiText>> {
  let parsed: z.output<typeof attachmentAiTextInputSchema>;
  try {
    parsed = attachmentAiTextInputSchema.parse({ requestId, attachmentId });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text', {
      params: { path: { requestId: parsed.requestId, attachmentId: parsed.attachmentId } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestAttachmentAiTextResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('getRequestAttachmentAiText');
    return normalizeTransportError(error);
  }
}

/** A downloaded file whose type, name, size and signature the shared validator accepted. */
export type DownloadedAttachment = { fileName: string; contentType: string; bytes: Uint8Array };

/** A file Strapi sent that the shared validator refused, naming the check that failed; its bytes are dropped. */
export type AttachmentFileCheckError = { kind: 'file-check'; failure: FileResponseFailure };

export type AttachmentDownloadResult =
  | { data: DownloadedAttachment; error: null }
  | { data: null; error: TransportError | AttachmentFileCheckError };

/**
 * Downloads one file (D-23, D-24) through the generated path with a binary parse. Strapi decides who may read it,
 * refuses a quarantined, blocked, removed, unavailable or altered file with its closed reason, and checks the digest;
 * the shared validator then checks the response against what Strapi served for the record, the type its name names,
 * before any byte is returned (IN-402).
 */
export async function downloadRequestAttachment(requestId: string, attachmentId: string): Promise<AttachmentDownloadResult> {
  let parsed: z.output<typeof downloadAttachmentInputSchema>;
  try {
    parsed = downloadAttachmentInputSchema.parse({ requestId, attachmentId });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content', {
      params: { path: { requestId: parsed.requestId, attachmentId: parsed.attachmentId } },
      parseAs: 'arrayBuffer',
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    const checked = validateAttachmentFileResponse({
      contentType: response.headers.get('content-type'),
      contentDisposition: response.headers.get('content-disposition'),
      bytes: new Uint8Array(data),
    });
    if (!checked.ok) return { data: null, error: { kind: 'file-check', failure: checked.failure } };
    return { data: { fileName: checked.fileName, contentType: checked.contentType, bytes: checked.bytes }, error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}
