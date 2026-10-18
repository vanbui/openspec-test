import { afterEach, describe, expect, it, vi } from 'vitest';

const listRequestNotes = vi.hoisted(() => vi.fn());
const addRequestNote = vi.hoisted(() => vi.fn());
const markRequestNotesRead = vi.hoisted(() => vi.fn());
const setNoteAiInput = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('./notes-service', () => ({ listRequestNotes, addRequestNote, markRequestNotesRead, setNoteAiInput }));
vi.mock('next/cache', () => ({ revalidatePath }));

import * as actions from './notes-actions';

afterEach(() => {
  for (const mock of [listRequestNotes, addRequestNote, markRequestNotesRead, setNoteAiInput, revalidatePath]) mock.mockReset();
});

const note = {
  documentId: 'n1',
  sequence: 1,
  body: 'After-hours vendor support will come from an offshore team with administrator access.',
  authorPart: 'requestor',
  author: { documentId: 'u-jane', displayName: 'Jane Doe' },
  postedAt: '2026-10-09T01:02:03.000Z',
  unread: false,
};
const meta = {
  total: 1, unread: 0, lastReadSequence: 0, hasEarlier: false, accepting: true, closedReason: null, viewerPart: 'requestor', canMarkAiInputs: false,
};

describe('addRequestNoteAction', () => {
  it('adds the note through the typed service and revalidates both request pages', async () => {
    addRequestNote.mockResolvedValueOnce({ data: note, error: null });
    await expect(actions.addRequestNoteAction({ requestId: 'r 1', body: note.body })).resolves.toEqual({ ok: true, data: note });
    expect(addRequestNote).toHaveBeenCalledWith('r 1', { body: note.body });
    expect(revalidatePath).toHaveBeenCalledWith('/app/requests/r%201');
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/requests/r%201');
  });

  it('refuses a blank note in §8.3’s words without calling the service', async () => {
    for (const body of ['', '   ', '\n\t\n']) {
      await expect(actions.addRequestNoteAction({ requestId: 'r1', body })).resolves.toEqual({
        ok: false, kind: 'field', message: 'Write a note before adding it.',
      });
    }
    expect(addRequestNote).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses invalid input without calling the service', async () => {
    /* IN-505: family L's blocked sentence, which offers no Try again, as the blocked kind does. */
    for (const input of [{ requestId: 'r1', body: 'Text', extra: true }, { requestId: '', body: 'Text' }, { requestId: 'r1' }, null, 'r1']) {
      await expect(actions.addRequestNoteAction(input)).resolves.toEqual({ ok: false, kind: 'blocked', message: 'You can’t add notes to this request.' });
    }
    expect(addRequestNote).not.toHaveBeenCalled();
  });

  it('refuses a note over 5,000 characters with its length, without calling the service (§8.3)', async () => {
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'x'.repeat(5_001) })).resolves.toEqual({
      ok: false, kind: 'field', message: 'Keep the note to 5,000 characters or fewer. It has 5,001.',
    });
    expect(addRequestNote).not.toHaveBeenCalled();
  });

  it('sends the AI-input mark only when the composer sets it', async () => {
    addRequestNote.mockResolvedValueOnce({ data: { ...note, changesAiInputs: true }, error: null });
    await actions.addRequestNoteAction({ requestId: 'r1', body: 'For the AI.', changesAiInputs: true });
    expect(addRequestNote).toHaveBeenCalledWith('r1', { body: 'For the AI.', changesAiInputs: true });
  });

  it('reads family L for a refusal, with its kind and closed reason (13-UI-SPEC §9.5)', async () => {
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'NOTES_CLOSED' } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text' })).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'NOTES_CLOSED',
      message: 'Notes are closed on this request now, so your note wasn’t added. Your text is kept below.',
    });
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'NOTES_LIMIT_REACHED' } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text' })).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'NOTES_LIMIT_REACHED',
      message: 'This request has reached its limit of 500 notes, so your note wasn’t added.',
    });
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 404 } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text' })).resolves.toEqual({
      ok: false, kind: 'not-found', message: 'This request is no longer available.',
    });
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text', changesAiInputs: true })).resolves.toEqual({
      ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'You can’t add notes to this request.',
    });
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text' })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.',
    });
    /* IN-401: a 400 the composer's own check did not foresee is about the text: a field error, never the 403 sentence. */
    addRequestNote.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 400 } });
    await expect(actions.addRequestNoteAction({ requestId: 'r1', body: 'Text' })).resolves.toEqual({
      ok: false, kind: 'field', message: 'This note can’t be added as written. Check its length and remove any hidden formatting characters.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('listRequestNotesAction', () => {
  it('reads a page through the typed service and revalidates nothing', async () => {
    listRequestNotes.mockResolvedValueOnce({ data: { notes: [note], meta }, error: null });
    await expect(actions.listRequestNotesAction({ requestId: 'r1', before: 21 })).resolves.toEqual({ ok: true, data: { notes: [note], meta } });
    expect(listRequestNotes).toHaveBeenCalledWith('r1', { before: 21 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reads §9.5’s sentence when earlier notes could not load, and not-found for a request the caller can’t read', async () => {
    listRequestNotes.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.listRequestNotesAction({ requestId: 'r1', before: 21 })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t load earlier notes.',
    });
    listRequestNotes.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 404 } });
    await expect(actions.listRequestNotesAction({ requestId: 'r1' })).resolves.toEqual({
      ok: false, kind: 'not-found', message: 'This request is no longer available.',
    });
  });
});

describe('markRequestNotesReadAction', () => {
  it('marks the thread read through the typed service and revalidates nothing (UI-D15)', async () => {
    markRequestNotesRead.mockResolvedValueOnce({ data: { lastReadSequence: 1, unread: 0 }, error: null });
    await expect(actions.markRequestNotesReadAction({ requestId: 'r1', throughNoteId: 'n1' })).resolves.toEqual({
      ok: true, data: { lastReadSequence: 1, unread: 0 },
    });
    expect(markRequestNotesRead).toHaveBeenCalledWith('r1', 'n1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

/* 13-UI-SPEC §10.1 and §10.4 (family M): the switch and its Undo are the same action, each a change Strapi logs. */
describe('setNoteAiInputAction', () => {
  it('sets the mark through the typed service once, returns the note and revalidates the analyst’s request, questionnaire and assessment pages', async () => {
    const marked = { ...note, unread: true, changesAiInputs: true };
    setNoteAiInput.mockResolvedValueOnce({ data: marked, error: null });
    await expect(actions.setNoteAiInputAction({ requestId: 'r 1', noteId: 'n1', changesAiInputs: true })).resolves.toEqual({ ok: true, data: marked });
    expect(setNoteAiInput).toHaveBeenCalledTimes(1);
    expect(setNoteAiInput).toHaveBeenCalledWith('r 1', 'n1', true);
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/requests/r%201');
    // D-29: the questionnaire and assessment pages show the AI-inputs signal, so a mark change re-renders them too.
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/questionnaires', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/assessments', 'layout');
  });

  it('undoes the mark as a second change', async () => {
    setNoteAiInput.mockResolvedValueOnce({ data: { ...note, changesAiInputs: false }, error: null });
    await actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: false });
    expect(setNoteAiInput).toHaveBeenCalledWith('r1', 'n1', false);
  });

  it('refuses invalid input without calling the service', async () => {
    for (const input of [
      { requestId: 'r1', noteId: 'n1', changesAiInputs: true, extra: true },
      { requestId: 'r1', noteId: 'n1', changesAiInputs: 'yes' },
      { requestId: 'r1', noteId: '', changesAiInputs: true },
      { requestId: 'r1', changesAiInputs: true },
      null,
    ]) {
      /* IN-505: family M's blocked sentence, which offers Refresh page, as the blocked kind does. */
      await expect(actions.setNoteAiInputAction(input)).resolves.toEqual({ ok: false, kind: 'blocked', message: 'This note’s mark can’t change now. Refresh the page.' });
    }
    expect(setNoteAiInput).not.toHaveBeenCalled();
  });

  it('reads family M for a refusal (13-UI-SPEC §10.4)', async () => {
    setNoteAiInput.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: true })).resolves.toEqual({
      ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t change the AI inputs of a request they raised.',
    });
    setNoteAiInput.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403 } });
    await expect(actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: true })).resolves.toEqual({
      ok: false, kind: 'blocked', message: 'You can’t change the AI inputs on this request.',
    });
    setNoteAiInput.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 404 } });
    await expect(actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: true })).resolves.toEqual({
      ok: false, kind: 'blocked', message: 'This note is no longer available. Refresh the page.',
    });
    for (const reason of ['NOTES_CLOSED', 'HISTORY_UNAVAILABLE', undefined] as const) {
      setNoteAiInput.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, ...(reason ? { reason } : {}) } });
      await expect(actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: false })).resolves.toEqual({
        ok: false, kind: 'blocked', ...(reason ? { reason } : {}), message: 'This note’s mark can’t change now. Refresh the page.',
      });
    }
    setNoteAiInput.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.setNoteAiInputAction({ requestId: 'r1', noteId: 'n1', changesAiInputs: true })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t change the mark. Try again.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
