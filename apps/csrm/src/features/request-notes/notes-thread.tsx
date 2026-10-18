'use client';

import { Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useLeaveGuard } from '@/components/csrm/navigation-guard';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { EmptyState, ErrorState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { filesLeaveCopy, type RequestAttachment } from '@/features/attachments/attachments-domain';
import { useFileStoreDispatch, useQueueRows } from '@/features/attachments/file-store';
import { waitingRow, type QueueRow } from '@/features/attachments/upload-queue-model';
import { noteRefusal } from '@/lib/api/refusal-copy';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';

import { addRequestNoteAction, listRequestNotesAction, markRequestNotesReadAction } from './notes-actions';
import { NoteComposer, type ComposerFailure, type NoteSubmitOptions } from './note-composer';
import { NoteItem } from './note-item';
import { UnsentNoteWell } from './unsent-note-well';
import {
  composerHint,
  earlierNotesLabel,
  NOTES_PAGE_SIZE,
  NOTES_PER_REQUEST_LIMIT,
  notesClosedLine,
  notesCopy,
  notesEmptyState,
  notesThreadName,
  type NotePart,
  type NotesClosedReason,
  type NotesViewer,
  type RequestNote,
} from './notes-domain';

/*
 * The X-16 thread on both request pages (13-UI-SPEC §8, §9; D-21 to D-25). It holds every note this view has loaded,
 * oldest first, adds a note optimistically (§9.1) and marks the thread read once per view when the first unread note
 * is seen (§9.2). Strapi decides who may read, who may post and what is unread; nothing here grants or refuses.
 *
 * Files with notes (14-UI-SPEC §4.2; D-17, D-26): a note posted with files goes first, through Phase 13's unchanged
 * operation, with its files at `Waiting` beneath it. Only once Strapi has recorded it are the files put in that note's
 * queue in the tab's file store, which sends each with the note's id, one at a time; the note's unread flag tells the
 * other party. If the note fails, the composer takes its text and files back. Each note lists the files the page's list
 * says came with it.
 */

export type NotesThreadProps = {
  requestId: string;
  requestNumber: string;
  viewer: NotesViewer;
  /** The part Strapi gives the viewer's notes on this request (a requesting analyst writes as the Requestor). */
  viewerPart: NotePart;
  /** The viewer's display name, shown on a note while it is being added. */
  viewerName?: string | null;
  accepting: boolean;
  closedReason: NotesClosedReason | null;
  /** The newest notes Strapi served, oldest first. */
  notes: RequestNote[] | null;
  /** Strapi's `canMarkAiInputs`: the switch under each note and the composer's checkbox (D-26; X-18). */
  canMarkAiInputs?: boolean;
  /** The signed-in person's opaque draft key: unsent text is kept per person and request (§9.3; UI-D17). */
  draftOwnerKey?: string | null;
  /** Strapi's add facts when files can be added with a note (14-UI-SPEC §4.1): the composer offers `Attach files`. */
  attach?: { remaining: number } | null;
  /** The request's files grouped by the note they came with (§4.2). */
  filesByNote?: Readonly<Record<string, readonly RequestAttachment[]>>;
};

type PendingNote = { note: RequestNote; leaving: boolean; files: readonly File[] };

const NO_FILES: Readonly<Record<string, readonly RequestAttachment[]>> = {};

/* §5 Motion: a failed note leaves at --duration-base before it is removed. */
const ROLLBACK_MS = 180;

/* WR-305: the most pages a link to an earlier note can need, the whole thread at the contract's limit. */
const MOST_EARLIER_PAGES = Math.ceil(NOTES_PER_REQUEST_LIMIT / NOTES_PAGE_SIZE);

function bySequence(left: RequestNote, right: RequestNote) {
  return left.sequence - right.sequence;
}

function merged(known: ReadonlyMap<string, RequestNote>, notes: readonly RequestNote[]): Map<string, RequestNote> {
  const next = new Map(known);
  for (const note of notes) next.set(note.documentId, note);
  return next;
}

function unreadIdsOf(notes: readonly RequestNote[]): string[] {
  return notes.filter((note) => note.unread).map((note) => note.documentId);
}

export function NotesThread({ accepting, attach = null, canMarkAiInputs = false, closedReason, draftOwnerKey = null, filesByNote = NO_FILES, notes, requestId, requestNumber, viewer, viewerName = null, viewerPart }: NotesThreadProps) {
  const router = useRouter();
  /* §4.2: the notes posted with files on this view, whose queues send their files at once rather than restore them. */
  const [freshNotes, setFreshNotes] = useState<ReadonlySet<string>>(() => new Set());
  const toFileStore = useFileStoreDispatch(draftOwnerKey ?? '', requestId);
  /* §4.3: files chosen for a note and not yet posted, which the well shows once notes close; and those just discarded. */
  const composerFiles = useQueueRows(draftOwnerKey ?? '', requestId, 'composer');
  const discardedFiles = useRef<QueueRow[]>([]);
  /*
   * IN-504: once a well has been discarded it stays mounted, rendering nothing, so its toast's Undo brings it back with
   * focus on its first action. Without it, a well of files alone would unmount with its files and remount without focus.
   */
  const [wellDiscarded, setWellDiscarded] = useState(false);
  /* §9.4: text the closed window can no longer take, from a NOTES_CLOSED refusal or the session store. */
  const [unsent, setUnsent] = useState<string | null>(null);
  const closedLine = useRef<HTMLParagraphElement>(null);
  /* Every note this view has loaded, by id: the served page, then each added note, until the page is left. */
  const [known, setKnown] = useState(() => merged(new Map(), notes ?? []));
  /* D-24: a note new to the viewer when this view first showed it keeps New for the whole view. */
  const [unread, setUnread] = useState(() => new Set(unreadIdsOf(notes ?? [])));
  const [served, setServed] = useState(notes);
  if (notes !== served) {
    setServed(notes);
    setKnown(merged(known, notes ?? []));
    const fresh = unreadIdsOf(notes ?? []).filter((id) => !unread.has(id));
    if (fresh.length > 0) setUnread(new Set([...unread, ...fresh]));
  }
  const [pending, setPending] = useState<PendingNote | null>(null);
  /*
   * §10 row 1 (WR-505): while a note carrying files is being posted, its files live only here, not yet in any queue, so an
   * in-app link asks first in the files' words, as the queue does once they are on their way.
   */
  useLeaveGuard(Boolean(pending && !pending.leaving && pending.files.length > 0), 'waiting', filesLeaveCopy);
  const [announcement, setAnnouncement] = useState('');
  const marked = useRef(false);
  const [earlier, setEarlier] = useState<'idle' | 'loading' | 'failed'>('idle');
  /* After earlier notes arrive: the note to focus, and where the previous first note sat, so the viewport stays put. */
  const inserted = useRef<{ focusId: string; anchorId: string; anchorTop: number } | null>(null);
  /* WR-305: a linked note being loaded, and the one to land on once it renders. */
  const revealing = useRef(false);
  const landingId = useRef<string | null>(null);

  const ordered = [...known.values()].sort(bySequence);
  const newest = ordered.at(-1)?.documentId ?? null;
  const firstUnread = ordered.find((note) => unread.has(note.documentId))?.documentId ?? null;
  /* Sequences run from 1 with no gaps (D-21: nothing is ever removed), so what remains is what precedes the oldest. */
  const oldest = ordered[0];
  const remaining = oldest ? oldest.sequence - 1 : 0;

  /* §8.2: earlier notes go in above without moving the viewport, and focus moves to the first inserted note. */
  useLayoutEffect(() => {
    const target = inserted.current;
    if (!target) return;
    inserted.current = null;
    const anchor = document.getElementById(`note-${target.anchorId}`);
    const shift = anchor ? anchor.getBoundingClientRect().top - target.anchorTop : 0;
    if (shift !== 0) window.scrollBy(0, shift);
    document.getElementById(`note-${target.focusId}`)?.focus({ preventScroll: true });
  }, [known]);

  /* WR-305: a linked note loaded with the earlier notes before it lands once it renders. */
  useLayoutEffect(() => {
    const id = landingId.current;
    if (!id) return;
    landingId.current = null;
    const target = document.getElementById(`note-${id}`);
    if (target) landOn(target);
  }, [known]);

  /*
   * D1 and D3 (the 13-19 walk): links to the section, a note or the composer land here once the thread exists, since the
   * route streams the page in after the browser and the router have tried (§2.2, §5.1, §8.2, §10.2, §12.3, §12.4).
   */
  useHashLanding((id) => {
    if (id === 'notes') {
      const section = document.getElementById('notes');
      if (!section) return;
      landOn(section);
      /* §9.2: the first unread note is marked read once it is seen, so a link to the new notes brings it into view. */
      const first = firstUnread ? document.getElementById(`note-${firstUnread}`) : null;
      const rect = first?.getBoundingClientRect();
      if (first && rect && (rect.top >= window.innerHeight || rect.bottom <= 0)) first.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (id === 'note-composer') {
      const field = document.getElementById(id);
      if (field) landOn(field);
      return;
    }
    if (!id.startsWith('note-')) return;
    const target = document.getElementById(id);
    if (target) {
      landOn(target);
      return;
    }
    const noteId = id.slice('note-'.length);
    if (!known.has(noteId)) void reveal(noteId);
  });

  /* §9.4: on a closed request, text kept earlier in this session shows in the well rather than being lost. */
  useEffect(() => {
    if (accepting || !draftOwnerKey) return;
    const kept = readSessionDraft('note', draftOwnerKey, requestId);
    if (kept) setUnsent(kept);
  }, [accepting, draftOwnerKey, requestId]);

  /* §9.2 (UI-D15): once per view, when the first unread note enters the viewport, through the newest loaded note. */
  useEffect(() => {
    if (marked.current || firstUnread === null || newest === null || typeof IntersectionObserver === 'undefined') return;
    const target = document.getElementById(`note-${firstUnread}`);
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (marked.current || !entries.some((entry) => entry.isIntersecting)) return;
      marked.current = true;
      observer.disconnect();
      /* Silent: the markers stay for this view, and a failure is tried again on the next view. */
      markRequestNotesReadAction({ requestId, throughNoteId: newest }).catch(() => undefined);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [firstUnread, newest, requestId]);

  /** §9.1: shows the note at once, posts it, and on a failure removes it and hands its text back to the composer. */
  async function submit(body: string, options?: NoteSubmitOptions): Promise<ComposerFailure | null> {
    setAnnouncement('');
    const files = options?.files ?? [];
    const placeholder: RequestNote = {
      documentId: 'pending',
      sequence: Number.MAX_SAFE_INTEGER,
      body: body.replace(/\r\n?/g, '\n').trim(),
      authorPart: viewerPart,
      author: viewerName ? { documentId: 'pending', displayName: viewerName } : null,
      postedAt: new Date().toISOString(),
      unread: false,
    };
    setPending({ note: placeholder, leaving: false, files });
    let result: Awaited<ReturnType<typeof addRequestNoteAction>>;
    try {
      result = await addRequestNoteAction({ requestId, body, ...(options?.changesAiInputs ? { changesAiInputs: true } : {}) });
    } catch {
      /* A network failure or a timeout reaching the action. */
      const { message } = noteRefusal();
      result = { ok: false, kind: 'retryable', message };
    }
    if (result.ok) {
      const added = result.data;
      /* §4.2 step 2 (D-17): only now, with the note's id, do its files go to its queue, which sends them one at a time. */
      if (files.length > 0 && draftOwnerKey) {
        toFileStore(`note:${added.documentId}`, { type: 'add', rows: files.map(waitingRow) });
        setFreshNotes((current) => new Set(current).add(added.documentId));
      }
      setKnown((current) => merged(current, [added]));
      setPending(null);
      setAnnouncement(notesCopy.added);
      return null;
    }
    setPending({ note: placeholder, leaving: true, files: [] });
    window.setTimeout(() => setPending((current) => (current?.note === placeholder ? null : current)), ROLLBACK_MS);
    /* The request is gone or no longer the viewer's to read: the page shows its own not-found state. */
    if (result.kind === 'not-found') router.refresh();
    /* §9.4: the window closed while the note was written. The composer keeps the text in the session store; the page
     * reads the closed window, and the text shows in the well beneath the closed line. */
    if (result.reason === 'NOTES_CLOSED') {
      setUnsent(body);
      router.refresh();
    }
    return { message: result.message, retryable: result.kind === 'retryable' };
  }

  /**
   * WR-305: a link to a note outside the loaded ones (the AI-inputs signal, the run sheet) loads the earlier notes, page by
   * page, until the note is loaded, then lands on it. A page that fails stops there and offers Try again (§9.5).
   */
  async function reveal(noteId: string) {
    if (!oldest || revealing.current) return;
    revealing.current = true;
    const loaded: RequestNote[] = [];
    let before = oldest.sequence;
    let found = false;
    let failed = false;
    for (let page = 0; page < MOST_EARLIER_PAGES && before > 1 && !found; page += 1) {
      let result: Awaited<ReturnType<typeof listRequestNotesAction>>;
      try {
        result = await listRequestNotesAction({ requestId, before, limit: NOTES_PAGE_SIZE });
      } catch {
        result = { ok: false, kind: 'retryable', message: notesCopy.earlierFailed };
      }
      if (!result.ok) {
        if (result.kind === 'not-found') router.refresh();
        failed = true;
        break;
      }
      if (result.data.notes.length === 0) break;
      loaded.push(...result.data.notes);
      before = Math.min(...result.data.notes.map((note) => note.sequence));
      found = result.data.notes.some((note) => note.documentId === noteId);
    }
    revealing.current = false;
    if (failed) setEarlier('failed');
    if (loaded.length === 0) return;
    landingId.current = found ? noteId : null;
    setKnown((current) => merged(current, loaded));
    const fresh = unreadIdsOf(loaded);
    if (fresh.length > 0) setUnread((current) => new Set([...current, ...fresh]));
  }

  /** Loads the 20 notes before the oldest loaded one through the Server Action. */
  async function loadEarlier() {
    if (!oldest || earlier === 'loading') return;
    setEarlier('loading');
    let result: Awaited<ReturnType<typeof listRequestNotesAction>>;
    try {
      /* IN-305: the page's own size, so §8.2's "previous 20" never rests on the server's default. */
      result = await listRequestNotesAction({ requestId, before: oldest.sequence, limit: NOTES_PAGE_SIZE });
    } catch {
      result = { ok: false, kind: 'retryable', message: notesCopy.earlierFailed };
    }
    if (!result.ok) {
      if (result.kind === 'not-found') router.refresh();
      setEarlier('failed');
      return;
    }
    const notes = [...result.data.notes].sort(bySequence);
    const first = notes[0];
    if (first) {
      inserted.current = {
        focusId: first.documentId,
        anchorId: oldest.documentId,
        anchorTop: document.getElementById(`note-${oldest.documentId}`)?.getBoundingClientRect().top ?? 0,
      };
    }
    setKnown((current) => merged(current, notes));
    const fresh = unreadIdsOf(notes);
    if (fresh.length > 0) setUnread((current) => new Set([...current, ...fresh]));
    setEarlier('idle');
  }

  /* §9.4 (UI-D19): Discard removes the kept text and focuses the closed line; Undo keeps it again. */
  function discardUnsent() {
    if (draftOwnerKey) clearSessionDraft('note', draftOwnerKey, requestId);
    /* §4.3: `Discard note` takes the files with the text, and its Undo gives both back. */
    discardedFiles.current = [...composerFiles];
    for (const file of composerFiles) toFileStore('composer', { type: 'remove', key: file.key });
    setWellDiscarded(true);
    closedLine.current?.focus();
  }

  function restoreUnsent(text: string) {
    if (draftOwnerKey && text) writeSessionDraft('note', draftOwnerKey, requestId, text);
    if (discardedFiles.current.length > 0) toFileStore('composer', { type: 'add', rows: discardedFiles.current });
    discardedFiles.current = [];
  }

  const shown = pending ? [...ordered, pending.note] : ordered;
  const empty = notesEmptyState(viewer, accepting);

  return (
    <div className="grid gap-4">
      {remaining > 0 && earlier !== 'failed' ? (
        <Button aria-busy={earlier === 'loading' ? true : undefined} className="w-fit" data-print="hidden" onClick={() => void loadEarlier()} size="sm" type="button" variant="outline">
          {earlier === 'loading' ? <><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{notesCopy.loading}</> : earlierNotesLabel(remaining)}
        </Button>
      ) : null}
      {remaining > 0 && earlier === 'failed' ? (
        <div className="flex flex-wrap items-center gap-2" data-print="hidden">
          <p className="text-sm text-foreground">{notesCopy.earlierFailed}</p>
          <Button onClick={() => void loadEarlier()} size="sm" type="button" variant="outline">{notesCopy.tryAgain}</Button>
        </div>
      ) : null}
      {notes === null && ordered.length === 0 ? (
        /* §8.6: the read failed and the page did not; the composer stays below, so nothing typed is lost. */
        <ErrorState density="compact" headingLevel="h3" noun="the notes" retry={() => router.refresh()} />
      ) : null}
      {shown.length > 0 ? (
        <ol aria-label={notesThreadName(requestNumber)} className="grid">
          {ordered.map((note) => (
            <NoteItem
              canMarkAiInputs={canMarkAiInputs}
              fileQueue={draftOwnerKey ? { ownerKey: draftOwnerKey, remaining: attach?.remaining ?? 0, fresh: freshNotes.has(note.documentId) } : null}
              files={filesByNote[note.documentId] ?? []}
              key={note.documentId}
              note={note}
              requestId={requestId}
              unread={unread.has(note.documentId)}
            />
          ))}
          {pending ? <NoteItem key="pending" leaving={pending.leaving} note={pending.note} pending pendingFiles={pending.files} unread={false} /> : null}
        </ol>
      ) : notes !== null ? (
        /* §8.5: the composer is the call to action, so the empty state carries none. */
        <EmptyState density="compact" headingLevel="h3" noun="notes" {...(empty.description ? { kind: 'first-use' as const, description: empty.description } : { kind: 'cleared' as const })} />
      ) : null}
      {accepting ? <NoteComposer attach={attach} canMarkAiInputs={canMarkAiInputs} draftOwnerKey={draftOwnerKey} hint={composerHint(viewer, viewerPart)} onSubmit={submit} requestId={requestId} /> : null}
      {!accepting && closedReason ? (
        /* §8.4 (D-22): one line in place of the composer; the notes above stay readable. */
        <p className="flex items-start gap-2 text-sm text-foreground-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring" ref={closedLine} tabIndex={-1}>
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {notesClosedLine(closedReason, viewer)}
        </p>
      ) : null}
      {!accepting && (unsent || composerFiles.length > 0 || wellDiscarded) ? (
        <UnsentNoteWell files={composerFiles.map((file) => file.file.name)} key={unsent ?? 'files'} onDiscard={discardUnsent} onRestore={restoreUnsent} text={unsent ?? ''} />
      ) : null}
      <p aria-live="polite" className="sr-only" role="status">{announcement}</p>
    </div>
  );
}
