/*
 * Request notes (Phase 13 D-21 to D-26), as the web reads them. Strapi decides who may read or add a note, whether the
 * request takes one, what is unread and who may mark a note for the AI; these types only name what it returns.
 * Zod-free, so client components may import it.
 */

/** The author's part on the request, in the contract's order. */
export const noteParts = ['requestor', 'security-analyst'] as const;
export type NotePart = (typeof noteParts)[number];

/** How a note's part reads in its header line (13-UI-SPEC §8.2). */
export const notePartLabels: Readonly<Record<NotePart, string>> = {
  requestor: 'Requestor',
  'security-analyst': 'Security Analyst',
};

/** Why a request takes no new note (D-22): never submitted, returned to draft, or released or closed. */
export const notesClosedReasons = ['not-submitted', 'returned-to-draft', 'released'] as const;
export type NotesClosedReason = (typeof notesClosedReasons)[number];

/** The newest notes a page shows, and how many each `Show earlier notes` loads (13-UI-SPEC §8.2). */
export const NOTES_PAGE_SIZE = 20;

/** The most notes a request holds (the contract's limit, `NOTES_LIMIT_REACHED`), so the most pages a thread can have. */
export const NOTES_PER_REQUEST_LIMIT = 500;

/** The most characters a note holds, after trimming (the contract's `RequestNote.body` maxLength). */
export const NOTE_BODY_MAX_LENGTH = 5_000;

/** A person as the API names one: a documentId and a display name, nothing else. */
export type NoteAuthor = { documentId: string; displayName: string };

export type RequestNote = {
  documentId: string;
  sequence: number;
  body: string;
  authorPart: NotePart;
  author: NoteAuthor | null;
  postedAt: string;
  /** Unread for the viewer, by Strapi's rule; it stays for the page view (D-24). */
  unread: boolean;
  /** Served to a Security Analyst only. */
  changesAiInputs?: boolean;
};

export type RequestNotesMeta = {
  total: number;
  unread: number;
  lastReadSequence: number;
  hasEarlier: boolean;
  accepting: boolean;
  closedReason: NotesClosedReason | null;
  viewerPart: NotePart;
  canMarkAiInputs: boolean;
};

/** One page of the thread, oldest first. */
export type RequestNotesPage = { notes: RequestNote[]; meta: RequestNotesMeta };

export type RequestNotesReadState = { lastReadSequence: number; unread: number };

/* The control characters Strapi refuses in a note: C0, other than tab and newline (CR is normalised to LF first). */
const DISALLOWED_CONTROL = /[\u0000-\u0008\u000b-\u001f]/;

/**
 * The composer's own check before a note is sent (13-UI-SPEC §8.3): the sentence to show under the field, or null
 * when the text may be sent. It applies Strapi's three rules to the text as Strapi stores it (LF line endings,
 * trimmed), so a note the composer sends is never refused for its text without a reason. Strapi checks again.
 */
export function validateNoteDraft(text: string): string | null {
  const trimmed = text.replace(/\r\n?/g, '\n').trim();
  if (trimmed.length === 0) return 'Write a note before adding it.';
  if (trimmed.length > NOTE_BODY_MAX_LENGTH) {
    return `Keep the note to 5,000 characters or fewer. It has ${trimmed.length.toLocaleString('en-AU')}.`;
  }
  /* Not in 13-UI-SPEC §8.3 (13-05 decision): a pasted control character would otherwise be refused without a reason. */
  if (DISALLOWED_CONTROL.test(trimmed)) return 'Remove the hidden formatting characters from the note, then add it.';
  return null;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The thread's words (13-UI-SPEC §5.1, §8, §9; X-16, X-17), verbatim. The components show them and decide nothing.
 * ------------------------------------------------------------------------------------------------------------------ */

/** Which request page shows the thread: the Requestor's own, or the analyst's review page. */
export type NotesViewer = 'requestor' | 'analyst';

/** The thread's fixed words. */
export const notesCopy = {
  title: 'Notes',
  composerLabel: 'Add a note',
  addNote: 'Add note',
  adding: 'Adding…',
  added: 'Note added.',
  tryAgain: 'Try again',
  readFailed: 'We couldn’t load the notes',
  earlierFailed: 'We couldn’t load earlier notes.',
  loading: 'Loading…',
  showFull: 'Show full note',
  showLess: 'Show less',
  unread: 'New',
  /** §8.3, §9.3: the caption under the composer when unsent text comes back from the session store. */
  restored: 'Restored from earlier in this session.',
} as const;

/**
 * Files with notes (14-UI-SPEC §4; D-17; UI-D6 to UI-D8; X-21): the composer's `Attach files` and chips, and a note's list
 * of the files that came with it. The composer's control is `Attach files`, so it never reads like `Add note` (UI-D8).
 */
export const noteFilesCopy = {
  attachFiles: 'Attach files',
  chipsName: 'Files to add with this note',
  hint: 'Files are checked for malware, then added with your note.',
  /** UI-D7: a note carrying files must say what they are. */
  needsText: 'Write a note to say what these files are.',
  /** UI-D6: above the chips once the Files section has handed files to the composer. */
  handedOff: 'Write a note to say what these files are, then add it.',
  noteFilesName: 'Files with this note',
  notAdded: 'Not added.',
  removeChip: (name: string) => `Remove ${name} from the list`,
} as const;

/* ---------------------------------------------------------------------------------------------------------------------
 * The AI-input mark (13-UI-SPEC §8.3, §10.1, §10.4; X-18; D-26). It chooses which notes CSRM sends to the AI; it never
 * generates, accepts or releases anything. Strapi's `canMarkAiInputs` decides who sees the switch and the checkbox.
 * ------------------------------------------------------------------------------------------------------------------ */

export const aiMarkCopy = {
  /** The switch's and the checkbox's label, and the X-11 note a Security Analyst who may not mark sees. */
  label: 'Changes the AI inputs',
  /** The composer checkbox's hint. */
  hint: 'Include this note in what CSRM sends to the AI for this request.',
  /** The danger toast's title when a mark, or its Undo, is refused. */
  failed: 'Mark not changed',
  undo: 'Undo',
  tryAgain: 'Try again',
  refresh: 'Refresh page',
} as const;

/** §10.4: the success toast for turning the mark on or off. */
export function aiMarkToast(on: boolean): string {
  return on ? 'Note marked as changing the AI inputs.' : 'Note no longer marked as changing the AI inputs.';
}

/** §10.4: the toast after `Undo`, for the change it reversed (`on` is that change's direction). */
export function aiMarkUndoToast(on: boolean): string {
  return on ? 'Mark removed.' : 'Mark restored.';
}

/**
 * §9.4 (D-22; UI-D19): the read-only well that keeps note text the closed window can no longer take. `copyFailed` and
 * `copyFailedHint` are this plan's (13-11) for a browser that refuses the clipboard: the text is selected instead.
 */
export const unsentWellCopy = {
  copy: 'Copy text',
  discard: 'Discard text',
  /** 14-UI-SPEC §4.3: with unsent files, discarding takes the text and the files together. */
  discardNote: 'Discard note',
  copied: 'Note text copied.',
  discarded: 'Note text discarded.',
  restored: 'Note text restored.',
  /** 14-UI-SPEC §9 (amended on 2026-10-11 in stage B, IN-504): the toasts when the discarded note had files. */
  noteDiscarded: 'Note discarded.',
  noteRestored: 'Note restored.',
  undo: 'Undo',
  copyFailed: 'Note text not copied',
  copyFailedHint: 'The text is selected, so you can copy it yourself.',
} as const;

const count = (value: number) => value.toLocaleString('en-AU');

/** `{n} {note|notes}`, written out (Voice). */
export function noteCountLabel(total: number): string {
  return `${count(total)} ${total === 1 ? 'note' : 'notes'}`;
}

/** The X-17 marker's words on a count of notes: `{k} new`. */
export function newNotesLabel(unread: number): string {
  return `${count(unread)} new`;
}

/** §8.1: the section's description, which tells the Requestor a note may reach the AI (D-25 transparency). */
export function notesDescription(viewer: NotesViewer): string {
  return viewer === 'requestor'
    ? 'Notes between you and the Security Analysts on this request. A Security Analyst may include a note in the information CSRM sends to the AI.'
    : 'Notes between the Requestor and the Security Analysts. Mark a note as changing the AI inputs to include it in AI generation.';
}

/** §8.1: `{n} {note|notes}`, then ` · {k} new` when any note is new to the viewer. */
export function notesCountLine(total: number, unread: number): string {
  return unread > 0 ? `${noteCountLabel(total)} · ${newNotesLabel(unread)}` : noteCountLabel(total);
}

/** §8.2: the ordered list's name. */
export function notesThreadName(requestNumber: string): string {
  return `Notes on ${requestNumber}`;
}

/** §8.2: the button that loads earlier notes, with how many remain. */
export function earlierNotesLabel(remaining: number): string {
  return `Show earlier notes (${count(remaining)})`;
}

/**
 * §8.3: who reads notes and that a note is permanent. On the analyst's page, Strapi's `viewerPart` tells a requesting
 * analyst (G-1) that their note is added as the Requestor's.
 */
export function composerHint(viewer: NotesViewer, viewerPart: NotePart): string {
  /* The part Strapi serves decides, not the route (IN-308): a Security Analyst reads the analyst's hint on either page. */
  if (viewerPart === 'security-analyst') return 'The Requestor and every Security Analyst can read notes. A note can’t be changed or removed once added.';
  return viewer === 'requestor'
    ? 'You and the Security Analysts on this request can read notes. A note can’t be changed or removed once added.'
    : 'You raised this request, so your note is added as its Requestor. A note can’t be changed or removed once added.';
}

/**
 * §8.4 (D-22): why the composer is replaced, for Strapi's closed reason. §8.4 marks a never-submitted draft "not
 * applicable" for an analyst; should one see it, the analyst's draft line is the true statement.
 */
export function notesClosedLine(closedReason: NotesClosedReason, viewer: NotesViewer): string {
  if (closedReason === 'released') return 'Notes closed when the assessment was released. They stay here as part of the record.';
  if (viewer === 'analyst') return 'Notes are paused while this request is a draft.';
  return closedReason === 'not-submitted'
    ? 'You can add notes once you submit this request.'
    : 'Notes are paused while this request is a draft. Resubmit it to add a note.';
}

/** §8.5: an empty thread says what to do next while open; closed, it reads `No notes` above the §8.4 line. */
export function notesEmptyState(viewer: NotesViewer, accepting: boolean): { title: string; description: string | null } {
  if (!accepting) return { title: 'No notes', description: null };
  return {
    title: 'No notes yet',
    description: viewer === 'requestor'
      ? 'Add a note if something about this request changes, or to answer a Security Analyst’s question.'
      : 'Add a note to ask the Requestor for more information or to record what you’ve learned.',
  };
}

/* A person the API can no longer name is called by their part, never an invented name (the 13-09 precedent). */
const unnamedAuthor: Readonly<Record<NotePart, string>> = { requestor: 'The Requestor', 'security-analyst': 'A Security Analyst' };

/** §8.2: a note's header line, the author's name and their part in words. */
export function noteHeader(note: Pick<RequestNote, 'author' | 'authorPart'>): { name: string; part: string } {
  return { name: note.author?.displayName ?? unnamedAuthor[note.authorPart], part: notePartLabels[note.authorPart] };
}

/** The request read's notes figures (`RequestNotesSummary`), as the hub reads them. */
export type HubNotesSummary = { total: number; unread: number; accepting: boolean; closedReason: NotesClosedReason | null };

export type HubNotesFigure =
  | { kind: 'figure'; href: '#notes'; label: string; newLabel: string | null; name: string }
  | { kind: 'add'; href: '#note-composer'; label: string }
  | { kind: 'none'; label: string };

/**
 * §5.1: the hub's `Notes` row. A figure link to the thread, named with the new notes when there are any (X-10, X-17);
 * with none, `Add a note` to the composer while the window is open (D-22), otherwise `No notes`.
 */
export function hubNotesFigure(summary: HubNotesSummary): HubNotesFigure {
  if (summary.total > 0) {
    const label = noteCountLabel(summary.total);
    const newLabel = summary.unread > 0 ? newNotesLabel(summary.unread) : null;
    return { kind: 'figure', href: '#notes', label, newLabel, name: newLabel ? `${label}, ${newLabel}` : label };
  }
  return summary.accepting ? { kind: 'add', href: '#note-composer', label: 'Add a note' } : { kind: 'none', label: 'No notes' };
}
