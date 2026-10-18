'use server';

import { z } from 'zod';

import type { ConflictReason } from '@/lib/api/conflict-reasons';
import {
  attachmentAddRefusal,
  attachmentAiRefusal,
  attachmentFileRefusal,
  downloadCheckFailedMessage,
  type AttachmentRefusalKind,
} from '@/lib/api/refusal-copy';
import { formatFileSize } from '@/lib/files/format-file-size';

import {
  dataClassifications,
  uploadAttachmentInputSchema,
  type RequestAttachment,
  type RequestAttachmentAiText,
} from './attachments-schema';
import {
  downloadRequestAttachment,
  getRequestAttachmentAiText,
  setRequestAttachmentAiInput,
  setRequestAttachmentRemoval,
  uploadRequestAttachment,
} from './attachments-service';

/*
 * The Server Actions the Files section calls (Phase 14 D-04, D-26). Each reads its input, calls Strapi only through
 * the typed service and returns a result the page can show as it stands. Strapi decides every rule (who may add, the
 * window, the type, the content, the size, the limits and the malware check); nothing here grants or refuses on its
 * own, except input no page sends, which never reaches Strapi.
 *
 * An upload never revalidates, refreshes or redirects (14-RESEARCH Pitfall 18): the queue sends files one at a time and
 * refreshes the page once, after it settles, so no file's render races the next file's request.
 *
 * Every export of this module is a Server Action, and so an endpoint any signed-in caller can reach: it exports only the
 * actions the Files pages call (IN-406). The pages read the files themselves, and §3.7's Try again refreshes the page.
 */

export type AttachmentActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /**
       * `refused`: this file cannot be added as it is (`Choose another file`); `retryable`: try again (`Retry`);
       * `blocked`: trying again cannot help; `not-found`: the request is gone or not the caller's to read.
       */
      kind: AttachmentRefusalKind | 'not-found';
      message: string;
      /** The closed-list rule Strapi named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
      /** `Add with a new note` in place of `Retry` (ATTACHMENT_NOTE_REQUIRED, ATTACHMENT_NOTE_INVALID; 14-15). */
      offerNewNote?: boolean;
    };

const documentId = z.string().min(1).max(255);

/**
 * Adds one file (D-04 item 2, D-26): the form's `requestId`, its `file` and, after submission, the caller's own note's
 * `noteId` (D-17). The argument is checked at the boundary (IN-409): anything but a form, or a form the shared upload
 * schema refuses (no file part, an empty or overlong id), reads family N's 400 sentence and never reaches Strapi. A
 * refusal reads family N (14-UI-SPEC §8.1) with the file's size in X-23's units and the scanner's detection name, which
 * the transport validated.
 */
export async function uploadAttachmentAction(form: FormData): Promise<AttachmentActionResult<RequestAttachment>> {
  /* Typed as the pages call it; checked as any caller may (a Server Action is an endpoint). */
  const parsed = form instanceof FormData
    ? uploadAttachmentInputSchema.safeParse({
        requestId: form.get('requestId'),
        file: form.get('file'),
        ...(form.has('noteId') ? { noteId: form.get('noteId') } : {}),
      })
    : null;
  if (!parsed?.success) {
    const { message, kind, offerNewNote } = attachmentAddRefusal({ status: 400 });
    return { ok: false, kind, message, offerNewNote };
  }
  const { file, noteId, requestId } = parsed.data;
  const result = await uploadRequestAttachment(requestId, file, noteId);
  if (!result.error) return { ok: true, data: result.data };
  const { status, reason, detection } = result.error;
  const { message, kind, offerNewNote } = attachmentAddRefusal({
    ...(status === undefined ? {} : { status }),
    ...(reason ? { reason } : {}),
    ...(detection ? { detection } : {}),
    sizeLabel: formatFileSize(file.size),
  });
  return { ok: false, kind, message, ...(reason ? { reason } : {}), offerNewNote };
}

/* IN-402: no type from the caller; a call that names one is refused, because the check is against what Strapi serves. */
const downloadInputSchema = z.object({ requestId: documentId, attachmentId: documentId }).strict();

/** A downloaded file, checked on the server before a byte reaches the browser, or family O's refusal. */
export type DownloadAttachmentResult =
  | { ok: true; fileName: string; contentType: string; bytes: Uint8Array }
  | { ok: false; kind: AttachmentRefusalKind; message: string };

/**
 * Downloads one file for the browser to save (D-23, D-24): Strapi decides who may read it and refuses a file that
 * cannot be sent with its closed reason; the shared validator then checks the bytes against what Strapi served for the
 * record, never a type the caller names (IN-402). Only checked bytes are returned, with the checked name and type; a
 * failed check drops them and reads
 * family O's own sentence. No Route Handler and no raw `fetch`: the action is the download's only path. It revalidates
 * nothing and never redirects.
 */
export async function downloadAttachmentAction(input: unknown): Promise<DownloadAttachmentResult> {
  const parsed = downloadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...attachmentFileRefusal('download', { status: 400 }) };
  const { attachmentId, requestId } = parsed.data;
  const result = await downloadRequestAttachment(requestId, attachmentId);
  if (!result.error) return { ok: true, fileName: result.data.fileName, contentType: result.data.contentType, bytes: result.data.bytes };
  if (result.error.kind === 'file-check') return { ok: false, kind: 'retryable', message: downloadCheckFailedMessage };
  const { reason, status } = result.error;
  return { ok: false, ...attachmentFileRefusal('download', { ...(status === undefined ? {} : { status }), ...(reason ? { reason } : {}) }) };
}

const removalInputSchema = z.object({ requestId: documentId, attachmentId: documentId, removed: z.boolean() }).strict();

/**
 * Removes one file softly (`removed` true) or restores it (false) (D-20, D-21). Strapi decides who may: the uploader
 * removes their own, a Security Analyst any after submission, and only the remover restores; each change is recorded.
 * Returns the file as the caller now sees it, or family O's sentence for the action asked. It revalidates nothing and
 * never redirects: the list applies the change at once and refreshes the page itself.
 */
export async function setAttachmentRemovalAction(input: unknown): Promise<AttachmentActionResult<RequestAttachment>> {
  const parsed = removalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...attachmentFileRefusal('remove', { status: 400 }) };
  const { attachmentId, removed, requestId } = parsed.data;
  const result = await setRequestAttachmentRemoval(requestId, attachmentId, removed);
  if (!result.error) return { ok: true, data: result.data };
  const { reason, status } = result.error;
  const refusal = attachmentFileRefusal(removed ? 'remove' : 'restore', { ...(status === undefined ? {} : { status }), ...(reason ? { reason } : {}) });
  return { ok: false, ...refusal, ...(reason ? { reason } : {}) };
}

const aiInputSchema = z.object({
  requestId: documentId,
  attachmentId: documentId,
  included: z.boolean(),
  /* The classification and approved limit the list served, which word the policy's refusal (§5.1); copy only. */
  classification: z.enum(dataClassifications).optional(),
  ceiling: z.enum(dataClassifications).nullable().optional(),
}).strict();

/**
 * Includes a file's text in the AI inputs (`included` true) or excludes it (false) (D-30, D-33). Strapi decides who may
 * (a human Security Analyst who did not raise the request), the window, the file's state and type, and the AI data
 * policy; including reads the file's text, which can fail. Returns the file as the caller now sees it, with its AI facts,
 * or family P's sentence. It revalidates nothing and never redirects: the control applies the answer itself.
 */
export async function setAttachmentAiInputAction(input: unknown): Promise<AttachmentActionResult<RequestAttachment>> {
  const parsed = aiInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...attachmentAiRefusal({ status: 400 }) };
  const { attachmentId, ceiling, classification, included, requestId } = parsed.data;
  const result = await setRequestAttachmentAiInput(requestId, attachmentId, included);
  if (!result.error) return { ok: true, data: result.data };
  const { reason, status } = result.error;
  const refusal = attachmentAiRefusal({
    ...(status === undefined ? {} : { status }),
    ...(reason ? { reason } : {}),
    ...(classification ? { classification } : {}),
    ...(ceiling === undefined ? {} : { ceiling }),
  });
  return { ok: false, ...refusal, ...(reason ? { reason } : {}) };
}

const aiTextInputSchema = z.object({ requestId: documentId, attachmentId: documentId }).strict();

/** The stored text, or why it can't be shown, with the status the preview maps to its own lines (§5.3). */
export type AttachmentAiTextResult =
  | { ok: true; data: RequestAttachmentAiText }
  | { ok: false; kind: AttachmentRefusalKind; message: string; status?: number; reason?: ConflictReason };

/**
 * Reads the text CSRM sends to the AI for an included file, exactly as stored (D-31). Strapi refuses a requesting
 * analyst (403) and a file that is not included (409). A read: it writes and revalidates nothing.
 */
export async function getAttachmentAiTextAction(input: unknown): Promise<AttachmentAiTextResult> {
  const parsed = aiTextInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...attachmentAiRefusal({ status: 400 }), status: 400 };
  const result = await getRequestAttachmentAiText(parsed.data.requestId, parsed.data.attachmentId);
  if (!result.error) return { ok: true, data: result.data };
  const { reason, status } = result.error;
  const refusal = attachmentAiRefusal({ ...(status === undefined ? {} : { status }), ...(reason ? { reason } : {}) });
  return { ok: false, ...(status === undefined ? {} : { status }), ...refusal, ...(reason ? { reason } : {}) };
}
