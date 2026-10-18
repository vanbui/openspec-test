import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachmentFileRefusal } from '@/lib/api/refusal-copy';

import type { RequestAttachment } from './attachments-schema';

const mocks = vi.hoisted(() => ({
  listRequestAttachments: vi.fn(),
  uploadRequestAttachment: vi.fn(),
  downloadRequestAttachment: vi.fn(),
  setRequestAttachmentRemoval: vi.fn(),
  setRequestAttachmentAiInput: vi.fn(),
  getRequestAttachmentAiText: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('./attachments-service', () => ({
  listRequestAttachments: mocks.listRequestAttachments,
  uploadRequestAttachment: mocks.uploadRequestAttachment,
  downloadRequestAttachment: mocks.downloadRequestAttachment,
  setRequestAttachmentRemoval: mocks.setRequestAttachmentRemoval,
  setRequestAttachmentAiInput: mocks.setRequestAttachmentAiInput,
  getRequestAttachmentAiText: mocks.getRequestAttachmentAiText,
}));

import {
  downloadAttachmentAction,
  getAttachmentAiTextAction,
  setAttachmentAiInputAction,
  setAttachmentRemovalAction,
  uploadAttachmentAction,
} from './attachments-actions';

function attachment(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-1', fileName: 'vendor-security-pack.pdf', fileType: 'pdf', byteSize: 1457, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

function upload(parts: Record<string, string | File>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(parts)) form.set(name, value);
  return form;
}

afterEach(() => {
  vi.clearAllMocks();
});

/* D-26: one Server Action per file. Strapi decides every rule; the action reads the form and maps a refusal to family N. */
describe('uploadAttachmentAction (D-26; 14-UI-SPEC §8.1)', () => {
  it('sends the one file to the request and returns the file Strapi recorded', async () => {
    const file = new File(['%PDF-1.7'], 'vendor-security-pack.pdf', { type: 'application/pdf' });
    mocks.uploadRequestAttachment.mockResolvedValue({ data: attachment(), error: null });
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1', file }));
    expect(mocks.uploadRequestAttachment).toHaveBeenCalledTimes(1);
    const [requestId, sent, noteId] = mocks.uploadRequestAttachment.mock.calls[0]!;
    expect(requestId).toBe('req-1');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('vendor-security-pack.pdf');
    expect(noteId).toBeUndefined();
    expect(result).toEqual({ ok: true, data: attachment() });
  });

  it('refuses a form with no file without calling Strapi', async () => {
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1' }));
    expect(mocks.uploadRequestAttachment).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, kind: 'refused', message: 'This file couldn’t be added. Choose it again.', offerNewNote: false });
  });

  it('refuses a file part that is text, not a file, without calling Strapi', async () => {
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1', file: 'not a file' }));
    expect(mocks.uploadRequestAttachment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, kind: 'refused' });
  });

  it('names the size Strapi refused, in X-23’s units', async () => {
    const file = new File([new Uint8Array(2_516_582)], 'big.pdf', { type: 'application/pdf' });
    mocks.uploadRequestAttachment.mockResolvedValue({ data: null, error: { message: 'Too large', status: 413, reason: 'ATTACHMENT_TOO_LARGE' } });
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1', file }));
    expect(result).toEqual({
      ok: false, kind: 'refused', reason: 'ATTACHMENT_TOO_LARGE', offerNewNote: false,
      message: 'Files can be up to 25 MB, and this one is 2.4 MB. Make it smaller or split it, then add it again.',
    });
  });

  it('names the malware the scanner found, as data', async () => {
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    mocks.uploadRequestAttachment.mockResolvedValue({ data: null, error: { message: 'Malware', status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' } });
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1', file }));
    expect(result).toMatchObject({
      ok: false, kind: 'refused', reason: 'ATTACHMENT_MALWARE_FOUND',
      message: 'This file contains malware (Csrm.Test.Signature) and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.',
    });
  });

  /* IN-409: the action guards its argument and parses it with the shared schema, so no crafted call becomes a 500. */
  it('refuses an argument that is not a form with family N’s 400 sentence, without calling Strapi', async () => {
    const refused = { ok: false, kind: 'refused', message: 'This file couldn’t be added. Choose it again.', offerNewNote: false };
    const file = new File(['%PDF-1.7'], 'vendor-security-pack.pdf', { type: 'application/pdf' });
    const forged = { get: (name: string) => ({ requestId: 'req-1', file, noteId: null } as Record<string, unknown>)[name] ?? null };
    for (const argument of [null, undefined, 'req-1', { requestId: 'req-1', file }, forged]) {
      await expect(uploadAttachmentAction(argument as never)).resolves.toEqual(refused);
    }
    expect(mocks.uploadRequestAttachment).not.toHaveBeenCalled();
  });

  it('parses the form with the shared upload schema: an empty or overlong id is refused without calling Strapi', async () => {
    const file = new File(['%PDF-1.7'], 'vendor-security-pack.pdf', { type: 'application/pdf' });
    const refused = { ok: false, kind: 'refused', message: 'This file couldn’t be added. Choose it again.', offerNewNote: false };
    await expect(uploadAttachmentAction(upload({ requestId: '', file }))).resolves.toEqual(refused);
    await expect(uploadAttachmentAction(upload({ requestId: 'r'.repeat(256), file }))).resolves.toEqual(refused);
    await expect(uploadAttachmentAction(upload({ requestId: 'req-1', file, noteId: '' }))).resolves.toEqual(refused);
    await expect(uploadAttachmentAction(upload({ requestId: 'req-1', file, noteId: 'n'.repeat(256) }))).resolves.toEqual(refused);
    expect(mocks.uploadRequestAttachment).not.toHaveBeenCalled();
  });

  it('sends the caller’s note id with the file after submission', async () => {
    const file = new File(['%PDF-1.7'], 'vendor-security-pack.pdf', { type: 'application/pdf' });
    mocks.uploadRequestAttachment.mockResolvedValue({ data: attachment(), error: null });
    await expect(uploadAttachmentAction(upload({ requestId: 'req-1', file, noteId: 'note-7' }))).resolves.toEqual({ ok: true, data: attachment() });
    expect(mocks.uploadRequestAttachment).toHaveBeenCalledWith('req-1', file, 'note-7');
  });

  it('offers Retry when the transfer failed', async () => {
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    mocks.uploadRequestAttachment.mockResolvedValue({ data: null, error: { message: 'Bad gateway', status: 502 } });
    const result = await uploadAttachmentAction(upload({ requestId: 'req-1', file }));
    expect(result).toEqual({ ok: false, kind: 'retryable', message: 'We couldn’t add this file. Try again.', offerNewNote: false });
  });
});

/*
 * IN-406 (per the ruling): every export of a 'use server' module is a Server Action, and so an endpoint anyone signed in
 * can call. The module exports exactly the five actions the Files pages use, and no list read: the pages read the files
 * themselves, and §3.7's Try again refreshes the page.
 */
describe('the attachment Server Actions (IN-406)', () => {
  it('exports exactly the five actions the pages call, and no list read', async () => {
    const actions = await import('./attachments-actions');
    expect(Object.keys(actions).sort()).toEqual([
      'downloadAttachmentAction',
      'getAttachmentAiTextAction',
      'setAttachmentAiInputAction',
      'setAttachmentRemovalAction',
      'uploadAttachmentAction',
    ]);
  });
});

/*
 * D-23, D-24 (14-UI-SPEC §3.3, §8.2): a download is a Server Action, never a Route Handler or a raw fetch. Strapi decides
 * who may read the file and refuses one that cannot be sent with its closed reason; the web's own check refuses bytes
 * that do not look like the file the list recorded. The action hands the checked bytes to the browser as they stand.
 */
describe('downloadAttachmentAction (D-23, D-24; family O)', () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 security pack');

  it('returns the checked file’s name, type and bytes for the browser to save', async () => {
    mocks.downloadRequestAttachment.mockResolvedValue({ data: { fileName: 'vendor-security-pack.pdf', contentType: 'application/pdf', bytes }, error: null });
    const result = await downloadAttachmentAction({ requestId: 'req-1', attachmentId: 'att-1' });
    expect(mocks.downloadRequestAttachment).toHaveBeenCalledWith('req-1', 'att-1');
    expect(result).toEqual({ ok: true, fileName: 'vendor-security-pack.pdf', contentType: 'application/pdf', bytes });
    /* By its tag: the test environment's Uint8Array is another realm's. */
    expect(Object.prototype.toString.call(result.ok ? result.bytes : null)).toBe('[object Uint8Array]');
  });

  it('says a file still waiting for its malware check can be downloaded later', async () => {
    mocks.downloadRequestAttachment.mockResolvedValue({ data: null, error: { message: 'Conflict', status: 409, reason: 'ATTACHMENT_QUARANTINED' } });
    await expect(downloadAttachmentAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toEqual({
      ok: false, kind: 'blocked', message: 'This file is still waiting for its malware check. Try again later.',
    });
  });

  it('stops a download whose bytes fail the web’s own check, and lets the person try again', async () => {
    mocks.downloadRequestAttachment.mockResolvedValue({ data: null, error: { kind: 'file-check', failure: 'signature' } });
    await expect(downloadAttachmentAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'This download didn’t look right, so CSRM stopped it. Try again, or contact your administrator.',
    });
  });

  it('offers Try again when the download failed on the way', async () => {
    mocks.downloadRequestAttachment.mockResolvedValue({ data: null, error: { message: 'Bad gateway', status: 502 } });
    await expect(downloadAttachmentAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t download the file. Try again.',
    });
  });

  it('refuses input no page sends without calling Strapi', async () => {
    await expect(downloadAttachmentAction({ requestId: 'req-1', attachmentId: '' })).resolves.toMatchObject({ ok: false, kind: 'blocked' });
    await expect(downloadAttachmentAction({ requestId: 'req-1' })).resolves.toMatchObject({ ok: false, kind: 'blocked' });
    expect(mocks.downloadRequestAttachment).not.toHaveBeenCalled();
  });

  /* IN-402 (per the ruling): what the bytes must be is what Strapi serves for the record, never the caller's claim. */
  it('refuses a caller that names the file’s type, so the claim can never steer the check', async () => {
    for (const fileType of ['pdf', 'png', 'exe']) {
      await expect(downloadAttachmentAction({ requestId: 'req-1', attachmentId: 'att-1', fileType })).resolves.toEqual({
        ok: false, ...attachmentFileRefusal('download', { status: 400 }),
      });
    }
    expect(mocks.downloadRequestAttachment).not.toHaveBeenCalled();
  });
});

/*
 * D-20 (14-UI-SPEC §3.5, §8.2): removal is soft and undoable. Strapi decides who may remove (the uploader, or a Security
 * Analyst after submission) and who may restore (the remover); the action returns the file as the caller now sees it,
 * or family O's sentence for the action asked. It revalidates nothing: the list refreshes itself.
 */
describe('setAttachmentRemovalAction (D-20; family O)', () => {
  it('removes the file and returns it as the caller now sees it', async () => {
    const removed = attachment({ state: 'removed', removedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, removedAt: '2026-10-10T02:00:00.000Z', actions: { download: false, remove: false, restore: true } });
    mocks.setRequestAttachmentRemoval.mockResolvedValue({ data: removed, error: null });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: true })).resolves.toEqual({ ok: true, data: removed });
    expect(mocks.setRequestAttachmentRemoval).toHaveBeenCalledWith('req-1', 'att-1', true);
  });

  it('restores the file, and says only its remover can when Strapi refuses another person', async () => {
    mocks.setRequestAttachmentRemoval.mockResolvedValue({ data: null, error: { message: 'Forbidden', status: 403, reason: 'NOT_REMOVER' } });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: false })).resolves.toEqual({
      ok: false, kind: 'blocked', reason: 'NOT_REMOVER', message: 'Only the person who removed this file can restore it.',
    });
    expect(mocks.setRequestAttachmentRemoval).toHaveBeenCalledWith('req-1', 'att-1', false);
  });

  it('refuses a restore at 20 files with its own words', async () => {
    mocks.setRequestAttachmentRemoval.mockResolvedValue({ data: null, error: { message: 'Conflict', status: 409, reason: 'ATTACHMENT_LIMIT_REACHED' } });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: false })).resolves.toMatchObject({
      ok: false, kind: 'blocked', message: 'This request already has 20 files. Remove another file before restoring this one.',
    });
  });

  it('offers Try again in the words of the action asked when it failed on the way', async () => {
    mocks.setRequestAttachmentRemoval.mockResolvedValue({ data: null, error: { message: 'Bad gateway', status: 502 } });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: true })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t remove the file. Try again.',
    });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: false })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t restore the file. Try again.',
    });
  });

  it('refuses input no page sends without calling Strapi', async () => {
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: 'yes' })).resolves.toMatchObject({ ok: false, kind: 'blocked' });
    await expect(setAttachmentRemovalAction({ requestId: 'req-1', attachmentId: 'att-1', removed: true, reason: 'tidy' })).resolves.toMatchObject({ ok: false });
    expect(mocks.setRequestAttachmentRemoval).not.toHaveBeenCalled();
  });
});

/*
 * D-30, D-31 (14-UI-SPEC §5.1, §5.3, §8.3): a Security Analyst includes a file's text in the AI inputs, or excludes it,
 * and reads the stored text before generating. Strapi decides who may (a human Security Analyst who did not raise the
 * request), the window, the file and the AI data policy; each action returns the file as the caller now sees it, or
 * family P's sentence. The classification and limit the list served name the policy's refusal.
 */
describe('setAttachmentAiInputAction (D-30; family P)', () => {
  const included = attachment({ ai: { included: true, facts: { available: 960, kept: 960, truncated: false }, unavailableReason: null, canChange: true } });

  it('includes the file and returns it as the caller now sees it', async () => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue({ data: included, error: null });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: true })).resolves.toEqual({ ok: true, data: included });
    expect(mocks.setRequestAttachmentAiInput).toHaveBeenCalledWith('req-1', 'att-1', true);
  });

  it('excludes the file with included false', async () => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue({ data: attachment(), error: null });
    await setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: false });
    expect(mocks.setRequestAttachmentAiInput).toHaveBeenCalledWith('req-1', 'att-1', false);
  });

  it('says why Strapi refused, with the closed reason', async () => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue({ data: null, error: { message: 'Conflict', status: 409, reason: 'ATTACHMENT_TEXT_UNAVAILABLE' } });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: true })).resolves.toEqual({
      ok: false, kind: 'blocked', reason: 'ATTACHMENT_TEXT_UNAVAILABLE',
      message: 'CSRM couldn’t find text in this file, so it can’t be included. A scanned document needs a text layer.',
    });
  });

  it('names the classification and the approved limit the list served when the policy refuses', async () => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue({ data: null, error: { message: 'Conflict', status: 409, reason: 'AI_CLASSIFICATION_ABOVE_CEILING' } });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: true, classification: 'Restricted', ceiling: 'Internal' })).resolves.toMatchObject({
      ok: false, kind: 'blocked',
      message: 'Files can’t be included in the AI inputs: this request’s information is classified Restricted, above the Internal limit the AI provider is approved for.',
    });
  });

  it('offers Try again when the change failed on the way', async () => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue({ data: null, error: { message: 'Bad gateway', status: 502 } });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: true })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t change whether this file is included. Try again.',
    });
  });

  it('refuses input no page sends without calling Strapi', async () => {
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: 'yes' })).resolves.toMatchObject({ ok: false, kind: 'blocked' });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: '', included: true })).resolves.toMatchObject({ ok: false });
    await expect(setAttachmentAiInputAction({ requestId: 'req-1', attachmentId: 'att-1', included: true, classification: 'Secret' })).resolves.toMatchObject({ ok: false });
    expect(mocks.setRequestAttachmentAiInput).not.toHaveBeenCalled();
  });
});

/*
 * WR-603 (D-18; COLLAB-02 criterion 2, "by any URL"): every attachment action is an endpoint any signed-in caller can
 * reach with ids of their choosing. When Strapi answers 404 (a file or request the caller may not read, or one that is
 * gone), each action says only that the file is no longer available, in family O's words (family P reuses them), and
 * returns no bytes, no file and no text: nothing that would confirm the record or hand over its content.
 */
describe('a file the caller may not read, or that is gone (WR-603; D-18)', () => {
  const notAvailable = 'This file is no longer available. Refresh the page.';
  const notFound = { data: null, error: { message: 'Not Found', status: 404 } };
  const janes = { requestId: 'req-jane', attachmentId: 'att-jane' };

  it('the download says the file is no longer available and returns no bytes, name or type', async () => {
    mocks.downloadRequestAttachment.mockResolvedValue(notFound);
    const result = await downloadAttachmentAction(janes);
    expect(mocks.downloadRequestAttachment).toHaveBeenCalledWith('req-jane', 'att-jane');
    expect(result).toEqual({ ok: false, kind: 'blocked', message: notAvailable });
    for (const key of ['bytes', 'fileName', 'contentType', 'data']) expect(result).not.toHaveProperty(key);
  });

  it.each([
    ['the removal', true],
    ['the restore', false],
  ])('%s says the file is no longer available and returns no file', async (_action, removed) => {
    mocks.setRequestAttachmentRemoval.mockResolvedValue(notFound);
    const result = await setAttachmentRemovalAction({ ...janes, removed });
    expect(mocks.setRequestAttachmentRemoval).toHaveBeenCalledWith('req-jane', 'att-jane', removed);
    expect(result).toEqual({ ok: false, kind: 'blocked', message: notAvailable });
    expect(result).not.toHaveProperty('data');
  });

  it.each([
    ['including', true],
    ['excluding', false],
  ])('%s the file in the AI inputs says it is no longer available and returns no file', async (_change, included) => {
    mocks.setRequestAttachmentAiInput.mockResolvedValue(notFound);
    const result = await setAttachmentAiInputAction({ ...janes, included });
    expect(mocks.setRequestAttachmentAiInput).toHaveBeenCalledWith('req-jane', 'att-jane', included);
    expect(result).toEqual({ ok: false, kind: 'blocked', message: notAvailable });
    expect(result).not.toHaveProperty('data');
  });

  it('the text preview says the file is no longer available and returns no text', async () => {
    mocks.getRequestAttachmentAiText.mockResolvedValue(notFound);
    const result = await getAttachmentAiTextAction(janes);
    expect(mocks.getRequestAttachmentAiText).toHaveBeenCalledWith('req-jane', 'att-jane');
    expect(result).toEqual({ ok: false, status: 404, kind: 'blocked', message: notAvailable });
    expect(result).not.toHaveProperty('data');
  });
});

describe('getAttachmentAiTextAction (D-31; family P)', () => {
  const preview = { text: 'Offshore support staff can reach production.', facts: { available: 44, kept: 44, truncated: false, extractor: 'csrm-text-1', extractedAt: '2026-10-10T02:00:00.000Z' } };

  it('returns the stored text exactly as the AI would read it, with its facts', async () => {
    mocks.getRequestAttachmentAiText.mockResolvedValue({ data: preview, error: null });
    await expect(getAttachmentAiTextAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toEqual({ ok: true, data: preview });
    expect(mocks.getRequestAttachmentAiText).toHaveBeenCalledWith('req-1', 'att-1');
  });

  it('keeps the status of a refusal, so the sheet can say a file is no longer included', async () => {
    mocks.getRequestAttachmentAiText.mockResolvedValue({ data: null, error: { message: 'Conflict', status: 409, reason: 'ATTACHMENT_TEXT_UNAVAILABLE' } });
    await expect(getAttachmentAiTextAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toMatchObject({ ok: false, status: 409 });
  });

  it('says a requesting analyst may not read it, in family P’s words', async () => {
    mocks.getRequestAttachmentAiText.mockResolvedValue({ data: null, error: { message: 'Forbidden', status: 403, reason: 'OWN_REQUEST' } });
    await expect(getAttachmentAiTextAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toEqual({
      ok: false, status: 403, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t change the AI inputs of a request they raised.',
    });
  });

  it('reads a failure on the way as worth trying again', async () => {
    mocks.getRequestAttachmentAiText.mockResolvedValue({ data: null, error: { message: 'Down', status: 503 } });
    await expect(getAttachmentAiTextAction({ requestId: 'req-1', attachmentId: 'att-1' })).resolves.toMatchObject({ ok: false, kind: 'retryable' });
  });

  it('refuses input no page sends without calling Strapi', async () => {
    await expect(getAttachmentAiTextAction({ requestId: 'req-1' })).resolves.toMatchObject({ ok: false, kind: 'blocked' });
    expect(mocks.getRequestAttachmentAiText).not.toHaveBeenCalled();
  });
});
