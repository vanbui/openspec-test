import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const createStrapiClient = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
/*
 * IN-506: the real normalizeTransportError, so a refusal's closed reason (OWN_REQUEST, ASSIGNMENT_CHANGED, NOTES_CLOSED)
 * is proven to reach the actions that branch on it through this seam. Only the client and the parser error (whose wording
 * depends on NODE_ENV) are stood in for.
 */
vi.mock('../../lib/api/transport/server-client', async (importOriginal) => ({
  createStrapiClient,
  normalizeTransportError: (await importOriginal<typeof import('../../lib/api/transport/server-client')>()).normalizeTransportError,
  normalizeResponseParserError: (operation: string) => ({
    data: null,
    error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation },
  }),
}));

import * as service from './notes-service';

afterEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  createStrapiClient.mockReset();
});

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ GET: get, POST: post, PUT: put });
}

const jane = { documentId: 'u-jane', displayName: 'Jane Doe' };
const janeNote = {
  documentId: 'n1',
  sequence: 1,
  body: 'After-hours vendor support will come from an offshore team with administrator access.',
  authorPart: 'requestor',
  author: jane,
  postedAt: '2026-10-09T01:02:03.000Z',
  unread: true,
  changesAiInputs: false,
};
const meta = {
  total: 1,
  unread: 1,
  lastReadSequence: 0,
  hasEarlier: false,
  accepting: true,
  closedReason: null,
  viewerPart: 'security-analyst',
  canMarkAiInputs: true,
};

describe('request notes service', () => {
  it('lists the thread through the generated path and returns the parsed notes and meta', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: [janeNote], meta }, response: { status: 200 } });
    await expect(service.listRequestNotes('r1')).resolves.toEqual({ data: { notes: [janeNote], meta }, error: null });
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/notes', { params: { path: { requestId: 'r1' } } });
  });

  it('sends the earlier-notes cursor and the page size as the query', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: [], meta: { ...meta, total: 0, unread: 0 } }, response: { status: 200 } });
    await service.listRequestNotes('r1', { before: 21, limit: 20 });
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/notes', {
      params: { path: { requestId: 'r1' }, query: { before: 21, limit: 20 } },
    });
  });

  it('adds a note with the published body and returns the parsed note', async () => {
    useMockClient();
    const added = { ...janeNote, unread: false, changesAiInputs: undefined };
    delete (added as Partial<typeof janeNote>).changesAiInputs;
    post.mockResolvedValueOnce({ data: { data: added }, response: { status: 200 } });
    await expect(service.addRequestNote('r1', { body: janeNote.body })).resolves.toEqual({ data: added, error: null });
    expect(post).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/notes', {
      params: { path: { requestId: 'r1' } },
      body: { data: { body: janeNote.body } },
    });
  });

  it('marks the thread read through one note and returns the read state', async () => {
    useMockClient();
    post.mockResolvedValueOnce({ data: { data: { lastReadSequence: 1, unread: 0 } }, response: { status: 200 } });
    await expect(service.markRequestNotesRead('r1', 'n1')).resolves.toEqual({ data: { lastReadSequence: 1, unread: 0 }, error: null });
    expect(post).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/notes/read', {
      params: { path: { requestId: 'r1' } },
      body: { data: { throughNoteId: 'n1' } },
    });
  });

  it('sets a note’s AI-input mark with the published body and returns the analyst’s note (D-26)', async () => {
    useMockClient();
    const marked = { ...janeNote, changesAiInputs: true };
    put.mockResolvedValueOnce({ data: { data: marked }, response: { status: 200 } });
    await expect(service.setNoteAiInput('r1', 'n1', true)).resolves.toEqual({ data: marked, error: null });
    expect(put).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input', {
      params: { path: { requestId: 'r1', noteId: 'n1' } },
      body: { data: { changesAiInputs: true } },
    });
    put.mockResolvedValueOnce({ data: { data: { ...marked, changesAiInputs: false } }, response: { status: 200 } });
    await service.setNoteAiInput('r1', 'n1', false);
    expect(put).toHaveBeenLastCalledWith('/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input', {
      params: { path: { requestId: 'r1', noteId: 'n1' } },
      body: { data: { changesAiInputs: false } },
    });
  });

  it('keeps the mark refusal’s status and refuses a mark response the contract does not declare', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: undefined, error: { error: { status: 403 } }, response: { status: 403 } });
    await expect(service.setNoteAiInput('r1', 'n1', true)).resolves.toMatchObject({ data: null, error: { status: 403 } });
    put.mockResolvedValueOnce({ data: { data: { ...janeNote, aiInputLog: [] } }, response: { status: 200 } });
    await expect(service.setNoteAiInput('r1', 'n1', true)).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch', operation: 'setNoteAiInput' },
    });
    await expect(service.setNoteAiInput('r1', '', true)).resolves.toMatchObject({ data: null, error: { status: 400 } });
    await expect(service.setNoteAiInput('', 'n1', true)).resolves.toMatchObject({ data: null, error: { status: 400 } });
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('refuses a response with a key the contract does not declare', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: { data: [{ ...janeNote, author: { ...jane, email: 'jane@example.test' } }], meta }, response: { status: 200 } });
    await expect(service.listRequestNotes('r1')).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch', operation: 'listRequestNotes' },
    });
    get.mockResolvedValueOnce({ data: { data: [janeNote], meta: { ...meta, readers: [] } }, response: { status: 200 } });
    await expect(service.listRequestNotes('r1')).resolves.toMatchObject({ data: null, error: { kind: 'response-contract-mismatch' } });
    post.mockResolvedValueOnce({ data: { data: { ...janeNote, editedAt: '2026-10-09T01:02:03.000Z' } }, response: { status: 200 } });
    await expect(service.addRequestNote('r1', { body: 'Text' })).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch', operation: 'addRequestNote' },
    });
  });

  it('returns the refusal status without parsing a body', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: undefined, error: { error: { status: 404 } }, response: { status: 404 } });
    await expect(service.listRequestNotes('r1')).resolves.toMatchObject({ data: null, error: { status: 404 } });
    post.mockResolvedValueOnce({ data: undefined, error: { error: { status: 409 } }, response: { status: 409 } });
    await expect(service.addRequestNote('r1', { body: 'Text' })).resolves.toMatchObject({ data: null, error: { status: 409 } });
  });

  it('keeps a refusal’s closed reason for the actions that branch on it (IN-506)', async () => {
    useMockClient();
    post.mockResolvedValueOnce({ data: undefined, error: { error: { status: 409, details: { reason: 'NOTES_CLOSED' } } }, response: { status: 409 } });
    await expect(service.addRequestNote('r1', { body: 'Text' })).resolves.toEqual({
      data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 409, reason: 'NOTES_CLOSED' },
    });
    put.mockResolvedValueOnce({ data: undefined, error: { error: { status: 403, details: { reason: 'OWN_REQUEST' } } }, response: { status: 403 } });
    await expect(service.setNoteAiInput('r1', 'n1', true)).resolves.toMatchObject({ data: null, error: { status: 403, reason: 'OWN_REQUEST' } });
  });

  it('refuses invalid input without calling Strapi', async () => {
    useMockClient();
    await expect(service.listRequestNotes('', {})).resolves.toMatchObject({ data: null, error: { status: 400 } });
    await expect(service.listRequestNotes('r1', { limit: 51 })).resolves.toMatchObject({ data: null, error: { status: 400 } });
    await expect(service.markRequestNotesRead('r1', '')).resolves.toMatchObject({ data: null, error: { status: 400 } });
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
