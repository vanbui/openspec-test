import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  aiMarkCopy,
  aiMarkToast,
  aiMarkUndoToast,
  composerHint,
  earlierNotesLabel,
  hubNotesFigure,
  NOTE_BODY_MAX_LENGTH,
  noteHeader,
  notePartLabels,
  notesClosedLine,
  notesCopy,
  notesCountLine,
  notesDescription,
  notesEmptyState,
  notesThreadName,
  unsentWellCopy,
  validateNoteDraft,
  type RequestNote,
} from './notes-domain';

function note(overrides: Partial<RequestNote> = {}): RequestNote {
  return {
    documentId: 'n1', sequence: 1, body: 'A note.', authorPart: 'requestor',
    author: { documentId: 'u-jane', displayName: 'Jane Doe' }, postedAt: '2026-10-01T05:47:00.000Z', unread: false,
    ...overrides,
  };
}

describe('the notes section’s words (13-UI-SPEC §5.1, §8.1 to §8.5)', () => {
  it('describes the section to each viewer, telling the Requestor a note may reach the AI (§8.1, D-25)', () => {
    expect(notesDescription('requestor')).toBe('Notes between you and the Security Analysts on this request. A Security Analyst may include a note in the information CSRM sends to the AI.');
    expect(notesDescription('requestor')).toContain('A Security Analyst may include a note in the information CSRM sends to the AI.');
    expect(notesDescription('analyst')).toBe('Notes between the Requestor and the Security Analysts. Mark a note as changing the AI inputs to include it in AI generation.');
  });

  it('counts the notes with written-out plurals and adds the new ones only above zero (§8.1)', () => {
    expect(notesCountLine(3, 1)).toBe('3 notes · 1 new');
    expect(notesCountLine(1, 0)).toBe('1 note');
    expect(notesCountLine(2, 2)).toBe('2 notes · 2 new');
    expect(notesCountLine(1_250, 0)).toBe('1,250 notes');
  });

  it('names the thread for its request and the earlier notes still to load', () => {
    expect(notesThreadName('RAR-2026-0001')).toBe('Notes on RAR-2026-0001');
    expect(earlierNotesLabel(25)).toBe('Show earlier notes (25)');
  });

  it('gives each composer hint verbatim: the Requestor, an analyst and a requesting analyst (§8.3)', () => {
    expect(composerHint('requestor', 'requestor')).toBe('You and the Security Analysts on this request can read notes. A note can’t be changed or removed once added.');
    expect(composerHint('analyst', 'security-analyst')).toBe('The Requestor and every Security Analyst can read notes. A note can’t be changed or removed once added.');
    expect(composerHint('analyst', 'requestor')).toBe('You raised this request, so your note is added as its Requestor. A note can’t be changed or removed once added.');
    /* IN-308: a Security Analyst on the Requestor's page reads the analyst's hint: the part decides, not the route. */
    expect(composerHint('requestor', 'security-analyst')).toBe('The Requestor and every Security Analyst can read notes. A note can’t be changed or removed once added.');
  });

  it('says why the composer is replaced, for each closed reason and viewer (§8.4, D-22)', () => {
    expect(notesClosedLine('not-submitted', 'requestor')).toBe('You can add notes once you submit this request.');
    expect(notesClosedLine('returned-to-draft', 'requestor')).toBe('Notes are paused while this request is a draft. Resubmit it to add a note.');
    expect(notesClosedLine('returned-to-draft', 'analyst')).toBe('Notes are paused while this request is a draft.');
    expect(notesClosedLine('released', 'requestor')).toBe('Notes closed when the assessment was released. They stay here as part of the record.');
    expect(notesClosedLine('released', 'analyst')).toBe('Notes closed when the assessment was released. They stay here as part of the record.');
    /* Analysts don't open drafts (§8.4 "not applicable"); should one, the analyst's own draft line says why. */
    expect(notesClosedLine('not-submitted', 'analyst')).toBe('Notes are paused while this request is a draft.');
  });

  it('says what to do next in an empty thread, and only No notes when it is closed (§8.5)', () => {
    expect(notesEmptyState('requestor', true)).toEqual({ title: 'No notes yet', description: 'Add a note if something about this request changes, or to answer a Security Analyst’s question.' });
    expect(notesEmptyState('analyst', true)).toEqual({ title: 'No notes yet', description: 'Add a note to ask the Requestor for more information or to record what you’ve learned.' });
    expect(notesEmptyState('requestor', false)).toEqual({ title: 'No notes', description: null });
    expect(notesEmptyState('analyst', false)).toEqual({ title: 'No notes', description: null });
  });

  it('heads a note with its author’s name and part in words, never an invented name (§8.2)', () => {
    expect(noteHeader(note())).toEqual({ name: 'Jane Doe', part: 'Requestor' });
    expect(noteHeader(note({ authorPart: 'security-analyst', author: { documentId: 'u-bob', displayName: 'Bob Doe' } }))).toEqual({ name: 'Bob Doe', part: 'Security Analyst' });
    expect(noteHeader(note({ authorPart: 'security-analyst', author: null }))).toEqual({ name: 'A Security Analyst', part: 'Security Analyst' });
    expect(noteHeader(note({ author: null }))).toEqual({ name: 'The Requestor', part: 'Requestor' });
  });

  it('reads the hub’s Notes figure: a link to the thread, Add a note while open, or No notes (§5.1)', () => {
    expect(hubNotesFigure({ total: 2, unread: 1, accepting: true, closedReason: null }))
      .toEqual({ kind: 'figure', href: '#notes', label: '2 notes', newLabel: '1 new', name: '2 notes, 1 new' });
    expect(hubNotesFigure({ total: 1, unread: 0, accepting: false, closedReason: 'released' }))
      .toEqual({ kind: 'figure', href: '#notes', label: '1 note', newLabel: null, name: '1 note' });
    expect(hubNotesFigure({ total: 0, unread: 0, accepting: true, closedReason: null })).toEqual({ kind: 'add', href: '#note-composer', label: 'Add a note' });
    expect(hubNotesFigure({ total: 0, unread: 0, accepting: false, closedReason: 'not-submitted' })).toEqual({ kind: 'none', label: 'No notes' });
  });

  it('keeps the thread’s fixed words verbatim, and none of them says Accept (§8, §9, §16)', () => {
    expect(notesCopy).toMatchObject({
      title: 'Notes', composerLabel: 'Add a note', addNote: 'Add note', adding: 'Adding…', added: 'Note added.',
      tryAgain: 'Try again', readFailed: 'We couldn’t load the notes', earlierFailed: 'We couldn’t load earlier notes.',
      loading: 'Loading…', showFull: 'Show full note', showLess: 'Show less', unread: 'New',
    });
    const words = [
      ...Object.values(notesCopy), notesDescription('requestor'), notesDescription('analyst'),
      composerHint('requestor', 'requestor'), composerHint('analyst', 'security-analyst'), composerHint('analyst', 'requestor'),
      ...(['not-submitted', 'returned-to-draft', 'released'] as const).flatMap((reason) => [notesClosedLine(reason, 'requestor'), notesClosedLine(reason, 'analyst')]),
    ];
    for (const text of words) expect(text).not.toMatch(/accept/i);
  });
});

describe('the AI-input mark’s and the kept text’s words (13-UI-SPEC §8.3, §9.3, §9.4, §10.1, §10.4; X-18)', () => {
  it('words the switch, the checkbox and the failure title verbatim', () => {
    expect(aiMarkCopy).toEqual({
      label: 'Changes the AI inputs',
      hint: 'Include this note in what CSRM sends to the AI for this request.',
      failed: 'Mark not changed',
      undo: 'Undo',
      tryAgain: 'Try again',
      refresh: 'Refresh page',
    });
  });

  it('confirms the mark with the toast for its direction, and its Undo with the reverse (§10.4)', () => {
    expect(aiMarkToast(true)).toBe('Note marked as changing the AI inputs.');
    expect(aiMarkToast(false)).toBe('Note no longer marked as changing the AI inputs.');
    expect(aiMarkUndoToast(true)).toBe('Mark removed.');
    expect(aiMarkUndoToast(false)).toBe('Mark restored.');
  });

  it('words the restored draft and the unsent well verbatim (§8.3, §9.4)', () => {
    expect(notesCopy.restored).toBe('Restored from earlier in this session.');
    expect(unsentWellCopy).toMatchObject({
      copy: 'Copy text',
      discard: 'Discard text',
      copied: 'Note text copied.',
      discarded: 'Note text discarded.',
      restored: 'Note text restored.',
      undo: 'Undo',
    });
  });

  it('has no notes string that says Accept (§16, UI-D29)', () => {
    const words = [
      ...Object.values(notesCopy), ...Object.values(aiMarkCopy), ...Object.values(unsentWellCopy),
      aiMarkToast(true), aiMarkToast(false), aiMarkUndoToast(true), aiMarkUndoToast(false),
      notesDescription('requestor'), notesDescription('analyst'),
      composerHint('requestor', 'requestor'), composerHint('analyst', 'security-analyst'), composerHint('analyst', 'requestor'),
      notesEmptyState('requestor', true).description, notesEmptyState('analyst', true).description,
    ];
    for (const text of words) expect(text ?? '').not.toMatch(/accept/i);
  });
});

describe('request notes domain', () => {
  it('names each part as the thread header reads it (13-UI-SPEC §8.2)', () => {
    expect(notePartLabels).toEqual({ requestor: 'Requestor', 'security-analyst': 'Security Analyst' });
    expect(NOTE_BODY_MAX_LENGTH).toBe(5_000);
  });

  it('accepts a note of 1 to 5,000 characters after trimming, tabs and line breaks included', () => {
    expect(validateNoteDraft('A note.')).toBeNull();
    expect(validateNoteDraft('Column\tvalue\r\n\r\nNext paragraph')).toBeNull();
    expect(validateNoteDraft('x'.repeat(5_000))).toBeNull();
    expect(validateNoteDraft(`  ${'x'.repeat(5_000)}  `)).toBeNull();
  });

  it('refuses an empty note in §8.3’s words', () => {
    for (const text of ['', '   ', '\n\t\n']) expect(validateNoteDraft(text)).toBe('Write a note before adding it.');
  });

  it('refuses a note over 5,000 characters and says how long it is (§8.3)', () => {
    expect(validateNoteDraft('x'.repeat(5_001))).toBe('Keep the note to 5,000 characters or fewer. It has 5,001.');
    expect(validateNoteDraft('x'.repeat(12_345))).toBe('Keep the note to 5,000 characters or fewer. It has 12,345.');
  });

  it('refuses the control characters Strapi refuses, so a pasted note is never refused without a reason', () => {
    for (const text of ['Ring \u0007 the bell', 'A\u0000B', 'A\u001bB', 'A\u000bB']) {
      expect(validateNoteDraft(text)).toBe('Remove the hidden formatting characters from the note, then add it.');
    }
  });

  it('stays free of zod, so client components may import it', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes/notes-domain.ts'), 'utf8');
    expect(source).not.toMatch(/from 'zod'/);
  });
});
