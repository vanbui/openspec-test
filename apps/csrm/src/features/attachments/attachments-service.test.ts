import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const createStrapiClient = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
/*
 * The real normalizeTransportError, so a refusal's closed reason and a malware detection are proven to reach the
 * callers through this seam. Only the client and the parser error (whose wording depends on NODE_ENV) are stood in for.
 */
vi.mock('../../lib/api/transport/server-client', async (importOriginal) => ({
  createStrapiClient,
  normalizeTransportError: (await importOriginal<typeof import('../../lib/api/transport/server-client')>()).normalizeTransportError,
  normalizeResponseParserError: (operation: string) => ({
    data: null,
    error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation },
  }),
}));

import * as service from './attachments-service';

afterEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  createStrapiClient.mockReset();
});

/** A File's bytes; jsdom's File has no arrayBuffer, so FileReader reads it there. */
async function fileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolveBytes, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolveBytes(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ GET: get, POST: post, PUT: put });
}

const jane = { documentId: 'u-jane', displayName: 'Jane Doe' };
const attachment = {
  documentId: 'a1',
  fileName: 'data-flow.docx',
  fileType: 'docx',
  byteSize: 1567,
  state: 'available',
  uploadedBy: jane,
  uploaderPart: 'requestor',
  uploadedAt: '2026-10-10T01:02:03.000Z',
  note: null,
  removedBy: null,
  removedAt: null,
  detection: null,
  actions: { download: true, remove: true, restore: false },
};
const add = {
  canAdd: true,
  refusal: null,
  window: 'intake',
  needsNote: false,
  remaining: 19,
  activeCount: 1,
  storedCount: 1,
  limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 },
  allowedTypes: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'],
};
const meta = { total: 1, removed: 0, add };

describe('request attachments service', () => {
  it('lists a request\'s files through the generated path and returns the parsed files and meta', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: [attachment], meta }, response: { status: 200 } });
    await expect(service.listRequestAttachments('r1')).resolves.toEqual({ data: { attachments: [attachment], meta }, error: null });
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/attachments', { params: { path: { requestId: 'r1' } } });
  });

  it('lists an analyst\'s files with their AI facts and the section\'s AI policy, and refuses either with an undeclared key or value', async () => {
    useMockClient();
    const analystFile = { ...attachment, ai: { included: true, facts: { available: 30_000, kept: 20_000, truncated: true }, unavailableReason: null, canChange: true } };
    const aiPolicy = { canChange: false, refusal: 'AI_CLASSIFICATION_ABOVE_CEILING', classification: 'Restricted', ceiling: 'Internal' };
    get.mockResolvedValueOnce({ data: { data: [analystFile], meta: { ...meta, aiPolicy } }, response: { status: 200 } });
    await expect(service.listRequestAttachments('r1')).resolves.toEqual({ data: { attachments: [analystFile], meta: { ...meta, aiPolicy } }, error: null });
    for (const page of [
      { data: [{ ...analystFile, ai: { ...analystFile.ai, text: 'Extracted text' } }], meta },
      { data: [{ ...analystFile, ai: { ...analystFile.ai, unavailableReason: 'ATTACHMENT_BLOCKED' } }], meta },
      { data: [analystFile], meta: { ...meta, aiPolicy: { ...aiPolicy, refusal: 'NOT_UPLOADER' } } },
      { data: [analystFile], meta: { ...meta, aiPolicy: { ...aiPolicy, provider: 'hosted' } } },
    ]) {
      get.mockResolvedValueOnce({ data: page, response: { status: 200 } });
      expect((await service.listRequestAttachments('r1')).error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'listRequestAttachments' });
    }
  });

  /*
   * WR-501 and IN-704 (contract item 4 of the stage B amendment): a blocked file's detection is held to the one pattern
   * the 422's is, so a real ClamAV name with an underscore parses, and a served name outside the pattern is refused.
   */
  it('parses a blocked file\'s real ClamAV name, and refuses a detection outside the contract\'s pattern', async () => {
    useMockClient();
    const blocked = { ...attachment, state: 'blocked', detection: 'Win.Test.EICAR_HDB-1', actions: { download: false, remove: true, restore: false } };
    get.mockResolvedValueOnce({ data: { data: [blocked], meta }, response: { status: 200 } });
    await expect(service.listRequestAttachments('r1')).resolves.toEqual({ data: { attachments: [blocked], meta }, error: null });
    for (const detection of ['Win Test <b>Signature</b>', '_Leading.Underscore', 'Quoted"Name', 'Win.Test;Name']) {
      get.mockResolvedValueOnce({ data: { data: [{ ...blocked, detection }], meta }, response: { status: 200 } });
      expect((await service.listRequestAttachments('r1')).error, detection).toMatchObject({ kind: 'response-contract-mismatch', operation: 'listRequestAttachments' });
    }
  });

  it('refuses a list response with a key the contract does not declare', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: [{ ...attachment, sha256: 'f'.repeat(64) }], meta }, response: { status: 200 } });
    const result = await service.listRequestAttachments('r1');
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'listRequestAttachments' });
  });

  it('uploads one file as multipart with only the file part, and returns the parsed attachment', async () => {
    useMockClient();
    post.mockResolvedValueOnce({ data: { data: attachment }, response: { status: 201 } });
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'data-flow.docx');
    await expect(service.uploadRequestAttachment('r1', file)).resolves.toEqual({ data: attachment, error: null });
    expect(post).toHaveBeenCalledTimes(1);
    const [clientPath, options] = post.mock.calls[0]!;
    expect(clientPath).toBe('/v1/assessment_requests/{requestId}/attachments');
    expect(options).toEqual({ params: { path: { requestId: 'r1' } }, body: expect.any(FormData), bodySerializer: expect.any(Function) });
    const body = options.body as FormData;
    expect([...body.keys()]).toEqual(['file']);
    const sent = body.get('file') as File;
    expect(sent.name).toBe('data-flow.docx');
    expect(await fileBytes(sent)).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(options.bodySerializer(body)).toBe(body);
  });

  it('sends the note id as its own part after submission', async () => {
    useMockClient();
    post.mockResolvedValueOnce({ data: { data: { ...attachment, note: { documentId: 'n1', postedAt: '2026-10-10T01:00:00.000Z' } } }, response: { status: 201 } });
    await service.uploadRequestAttachment('r1', new File(['x'], 'plan.txt'), 'n1');
    const body = post.mock.calls[0]![1].body as FormData;
    expect([...body.keys()]).toEqual(['file', 'noteId']);
    expect(body.get('noteId')).toBe('n1');
  });

  it('refuses an invalid request or note id before calling Strapi', async () => {
    useMockClient();
    expect((await service.uploadRequestAttachment('', new File(['x'], 'plan.txt'))).error).toMatchObject({ status: 400 });
    expect((await service.uploadRequestAttachment('r1', new File(['x'], 'plan.txt'), 'n'.repeat(256))).error).toMatchObject({ status: 400 });
    expect((await service.listRequestAttachments('r'.repeat(256))).error).toMatchObject({ status: 400 });
    expect(post).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps a malware refusal\'s reason and detection, and a window refusal\'s reason', async () => {
    useMockClient();
    post.mockResolvedValueOnce({
      error: { data: null, error: { status: 422, name: 'UnprocessableEntityError', message: 'Refused.', details: { reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' } } },
      response: { status: 422 },
    });
    const malware = await service.uploadRequestAttachment('r1', new File(['x'], 'plan.txt'));
    expect(malware.error).toMatchObject({ status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' });

    post.mockResolvedValueOnce({
      error: { data: null, error: { status: 409, name: 'ConflictError', message: 'Refused.', details: { reason: 'ATTACHMENT_NOTE_REQUIRED' } } },
      response: { status: 409 },
    });
    const noNote = await service.uploadRequestAttachment('r1', new File(['x'], 'plan.txt'));
    expect(noNote.error).toMatchObject({ status: 409, reason: 'ATTACHMENT_NOTE_REQUIRED' });
  });
});

/* 14-07 (D-23, D-24): the download through the typed layer, with a binary parse and the shared file check. */

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

function fileResponse(headers: Record<string, string>, status = 200) {
  const lower = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return { status, ok: status >= 200 && status < 300, headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null } };
}

describe('request attachment download', () => {
  it('downloads through the generated path with a binary parse and returns the checked bytes as a Uint8Array', async () => {
    useMockClient();
    get.mockResolvedValueOnce({
      data: DOCX_BYTES.slice().buffer,
      response: fileResponse({ 'Content-Type': DOCX, 'Content-Disposition': "attachment; filename=\"data-flow.docx\"; filename*=UTF-8''data-flow.docx" }),
    });
    const result = await service.downloadRequestAttachment('r1', 'a1');
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
      parseAs: 'arrayBuffer',
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ fileName: 'data-flow.docx', contentType: DOCX });
    expect(result.data?.bytes).toBeInstanceOf(Uint8Array);
    expect([...(result.data?.bytes ?? [])]).toEqual([...DOCX_BYTES]);
  });

  it('refuses a file the shared check refuses, naming the failed check and never the bytes', async () => {
    useMockClient();
    get.mockResolvedValueOnce({
      data: new TextEncoder().encode('<html><script>alert(1)</script></html>').buffer,
      response: fileResponse({ 'Content-Type': 'text/html', 'Content-Disposition': 'attachment; filename="data-flow.docx"' }),
    });
    await expect(service.downloadRequestAttachment('r1', 'a1')).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'type' } });

    get.mockResolvedValueOnce({
      data: new TextEncoder().encode('%PDF-1.7').buffer,
      response: fileResponse({ 'Content-Type': DOCX, 'Content-Disposition': 'attachment; filename="data-flow.docx"' }),
    });
    await expect(service.downloadRequestAttachment('r1', 'a1')).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'signature' } });
  });

  /* IN-402: the expected type is the served name's, never the caller's; a served type that is not the name's is refused. */
  it('checks the bytes against the type of the name Strapi served, and refuses a served name of no allowed type', async () => {
    useMockClient();
    get.mockResolvedValueOnce({
      data: new TextEncoder().encode('%PDF-1.7 security pack').buffer,
      response: fileResponse({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="vendor-security-pack.pdf"' }),
    });
    await expect(service.downloadRequestAttachment('r1', 'a1')).resolves.toMatchObject({ data: { fileName: 'vendor-security-pack.pdf', contentType: 'application/pdf' }, error: null });

    get.mockResolvedValueOnce({
      data: DOCX_BYTES.slice().buffer,
      response: fileResponse({ 'Content-Type': DOCX, 'Content-Disposition': 'attachment; filename="vendor-security-pack.pdf"' }),
    });
    await expect(service.downloadRequestAttachment('r1', 'a1')).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'type' } });

    get.mockResolvedValueOnce({
      data: DOCX_BYTES.slice().buffer,
      response: fileResponse({ 'Content-Type': DOCX, 'Content-Disposition': 'attachment; filename="macro.docm"' }),
    });
    await expect(service.downloadRequestAttachment('r1', 'a1')).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'name' } });
  });

  it('keeps a refusal\'s closed reason, and refuses invalid ids before calling Strapi', async () => {
    useMockClient();
    get.mockResolvedValueOnce({
      error: { data: null, error: { status: 409, name: 'ConflictError', message: 'Refused.', details: { reason: 'ATTACHMENT_QUARANTINED' } } },
      response: fileResponse({ 'Content-Type': 'application/json' }, 409),
    });
    expect((await service.downloadRequestAttachment('r1', 'a1')).error).toMatchObject({ status: 409, reason: 'ATTACHMENT_QUARANTINED' });

    get.mockReset();
    expect((await service.downloadRequestAttachment('', 'a1')).error).toMatchObject({ status: 400 });
    expect((await service.downloadRequestAttachment('r1', 'a'.repeat(256))).error).toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });
});

/* 14-08 (D-04 item 4, D-20): removal and restore through the typed layer, one closed body, the file back. */

describe('request attachment removal', () => {
  const removedFile = {
    ...attachment,
    state: 'removed',
    removedBy: jane,
    removedAt: '2026-10-10T02:03:04.000Z',
    actions: { download: false, remove: false, restore: true },
  };

  it('removes and restores through the generated path with the closed body, and returns the parsed attachment', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: removedFile }, response: { status: 200 } });
    await expect(service.setRequestAttachmentRemoval('r1', 'a1', true)).resolves.toEqual({ data: removedFile, error: null });
    expect(put).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
      body: { data: { removed: true } },
    });

    put.mockResolvedValueOnce({ data: { data: attachment }, response: { status: 200 } });
    await expect(service.setRequestAttachmentRemoval('r1', 'a1', false)).resolves.toEqual({ data: attachment, error: null });
    expect(put).toHaveBeenLastCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
      body: { data: { removed: false } },
    });
  });

  it('refuses a response with a key the contract does not declare', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: { ...removedFile, aiText: 'Extracted text' } }, response: { status: 200 } });
    const result = await service.setRequestAttachmentRemoval('r1', 'a1', true);
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'setRequestAttachmentRemoval' });
  });

  it('keeps the closed reasons of the actor and window refusals, and refuses invalid input before calling Strapi', async () => {
    useMockClient();
    put.mockResolvedValueOnce({
      error: { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Refused.', details: { reason: 'NOT_UPLOADER' } } },
      response: { status: 403 },
    });
    expect((await service.setRequestAttachmentRemoval('r1', 'a1', true)).error).toMatchObject({ status: 403, reason: 'NOT_UPLOADER' });
    put.mockResolvedValueOnce({
      error: { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Refused.', details: { reason: 'NOT_REMOVER' } } },
      response: { status: 403 },
    });
    expect((await service.setRequestAttachmentRemoval('r1', 'a1', false)).error).toMatchObject({ status: 403, reason: 'NOT_REMOVER' });
    put.mockResolvedValueOnce({
      error: { data: null, error: { status: 409, name: 'ConflictError', message: 'Refused.', details: { reason: 'ATTACHMENTS_CLOSED' } } },
      response: { status: 409 },
    });
    expect((await service.setRequestAttachmentRemoval('r1', 'a1', true)).error).toMatchObject({ status: 409, reason: 'ATTACHMENTS_CLOSED' });

    put.mockReset();
    expect((await service.setRequestAttachmentRemoval('', 'a1', true)).error).toMatchObject({ status: 400 });
    expect((await service.setRequestAttachmentRemoval('r1', 'a'.repeat(256), true)).error).toMatchObject({ status: 400 });
    expect((await service.setRequestAttachmentRemoval('r1', 'a1', 'yes' as never)).error).toMatchObject({ status: 400 });
    expect(put).not.toHaveBeenCalled();
  });
});

/* 14-09 (D-30, D-31, D-33): the AI inclusion and its preview through the typed layer, each parsed closed. */

describe('request attachment AI inclusion and preview', () => {
  const includedFile = {
    ...attachment,
    fileType: 'pdf',
    fileName: 'vendor-security-pack.pdf',
    ai: { included: true, facts: { available: 30_000, kept: 20_000, truncated: true }, unavailableReason: null, canChange: true },
  };
  const preview = {
    text: 'Hosting and support. The offshore support team has administrator access.',
    facts: { available: 74, kept: 74, truncated: false, extractor: 'csrm-extract/1', extractedAt: '2026-10-10T03:04:05.000Z' },
  };

  it('includes and excludes through the generated path with the closed body, and returns the parsed attachment with its AI facts', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: includedFile }, response: { status: 200 } });
    await expect(service.setRequestAttachmentAiInput('r1', 'a1', true)).resolves.toEqual({ data: includedFile, error: null });
    expect(put).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
      body: { data: { included: true } },
    });

    const excluded = { ...includedFile, ai: { included: false, facts: null, unavailableReason: null, canChange: true } };
    put.mockResolvedValueOnce({ data: { data: excluded }, response: { status: 200 } });
    await expect(service.setRequestAttachmentAiInput('r1', 'a1', false)).resolves.toEqual({ data: excluded, error: null });
    expect(put).toHaveBeenLastCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
      body: { data: { included: false } },
    });
  });

  it('refuses an inclusion response carrying the text or an AI key the contract does not declare', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: { ...includedFile, aiText: preview.text } }, response: { status: 200 } });
    expect((await service.setRequestAttachmentAiInput('r1', 'a1', true)).error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'setRequestAttachmentAiInput' });
    put.mockResolvedValueOnce({ data: { data: { ...includedFile, ai: { ...includedFile.ai, text: preview.text } } }, response: { status: 200 } });
    expect((await service.setRequestAttachmentAiInput('r1', 'a1', true)).error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'setRequestAttachmentAiInput' });
  });

  it('keeps the closed reasons of the identity, file and policy refusals, and refuses invalid input before calling Strapi', async () => {
    useMockClient();
    for (const [status, reason] of [[403, 'OWN_REQUEST'], [409, 'ATTACHMENT_NOT_TEXT_BEARING'], [409, 'ATTACHMENT_TEXT_UNAVAILABLE'], [409, 'AI_CLASSIFICATION_ABOVE_CEILING']] as const) {
      put.mockResolvedValueOnce({
        error: { data: null, error: { status, name: status === 403 ? 'ForbiddenError' : 'ConflictError', message: 'Refused.', details: { reason } } },
        response: { status },
      });
      expect((await service.setRequestAttachmentAiInput('r1', 'a1', true)).error).toMatchObject({ status, reason });
    }

    put.mockReset();
    expect((await service.setRequestAttachmentAiInput('', 'a1', true)).error).toMatchObject({ status: 400 });
    expect((await service.setRequestAttachmentAiInput('r1', 'a'.repeat(256), true)).error).toMatchObject({ status: 400 });
    expect((await service.setRequestAttachmentAiInput('r1', 'a1', 'yes' as never)).error).toMatchObject({ status: 400 });
    expect(put).not.toHaveBeenCalled();
  });

  it('reads the preview through the generated path and returns the stored text with its facts', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: preview }, response: { status: 200 } });
    await expect(service.getRequestAttachmentAiText('r1', 'a1')).resolves.toEqual({ data: preview, error: null });
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text', {
      params: { path: { requestId: 'r1', attachmentId: 'a1' } },
    });
  });

  it('refuses a preview over the cap or with an undeclared key, keeps ATTACHMENT_TEXT_UNAVAILABLE, and refuses invalid ids before calling Strapi', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: { ...preview, text: 'x'.repeat(20_001) } }, response: { status: 200 } });
    expect((await service.getRequestAttachmentAiText('r1', 'a1')).error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'getRequestAttachmentAiText' });
    get.mockResolvedValueOnce({ data: { data: { ...preview, fileName: 'vendor-security-pack.pdf' } }, response: { status: 200 } });
    expect((await service.getRequestAttachmentAiText('r1', 'a1')).error).toMatchObject({ kind: 'response-contract-mismatch', operation: 'getRequestAttachmentAiText' });
    get.mockResolvedValueOnce({
      error: { data: null, error: { status: 409, name: 'ConflictError', message: 'Refused.', details: { reason: 'ATTACHMENT_TEXT_UNAVAILABLE' } } },
      response: { status: 409 },
    });
    expect((await service.getRequestAttachmentAiText('r1', 'a1')).error).toMatchObject({ status: 409, reason: 'ATTACHMENT_TEXT_UNAVAILABLE' });

    get.mockReset();
    expect((await service.getRequestAttachmentAiText('r1', '')).error).toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });
});
