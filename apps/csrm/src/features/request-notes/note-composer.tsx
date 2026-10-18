'use client';

import { Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ATTACHMENT_ACCEPT, chosenFileType, composerChips, type QueueRow } from '@/features/attachments/attachments-domain';
import { chipIconButtonClassName, FileChip } from '@/features/attachments/file-chip';
import { carriesFiles, usePageFileDropGuard } from '@/features/attachments/file-field';
import { useAttachmentQueue } from '@/features/attachments/file-store';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { clearOtherOwnersSessionDrafts } from '@/lib/session-drafts/session-draft-owners';
import { cn } from '@/lib/utils';

import { aiMarkCopy, noteFilesCopy, notesCopy, validateNoteDraft } from './notes-domain';

/*
 * The X-16 composer (13-UI-SPEC §8.3, §9.1). It checks the text as Strapi will (validateNoteDraft), clears the field
 * and keeps focus while the thread posts, and on a failure puts the text back with the cursor at the end, so a typed
 * note is never lost. One post at a time: a second press while one is pending does nothing.
 *
 * No lost input (§9.3; D-25; UI-D17, UI-D18): the text is kept in the tab's session store per person and request as it
 * is typed (300ms after typing pauses, and at once when the composer leaves the page), restored on return with its
 * caption, and cleared once the note is added. While the field holds text only the browser's own `beforeunload` prompt
 * is armed: in-app navigation keeps the text, so it never shows a blocking dialog.
 *
 * Files with the note (14-UI-SPEC §4.1, §4.2; D-17; UI-D7, UI-D8; X-21). After submission, where Strapi lets files be
 * added with a note, `Attach files` opens the chooser and the composer is a drop target. Each chosen file is checked
 * in the browser (§1.3) and shown as a chip with its own Remove; a file that fails a check stays as a chip with its
 * reason and is never sent. A note with files must say what they are. Posting hands the files to the thread, which adds
 * the note first through Phase 13's operation and only then sends each file with that note's id (`noteId`), one at a
 * time; if the note fails its files come back here with its text. The chips live in the tab's in-memory file store
 * (scope `composer`), never in browser storage (UI-D10), and the store arms `beforeunload` while it holds them.
 */

/* §9.3: how long typing pauses before the text is kept. */
const KEEP_AFTER_MS = 300;

/** Why a post failed, in family L's words (13-UI-SPEC §9.5); a retryable failure offers Try again. */
export type ComposerFailure = { message: string; retryable: boolean };

/**
 * Sent with a note: the mark when the Security Analyst ticked `Changes the AI inputs` (§8.3; X-18), and the files to add
 * with it once Strapi has recorded it (14-UI-SPEC §4.2). Neither is passed when it does not apply.
 */
export type NoteSubmitOptions = { changesAiInputs?: true; files?: readonly File[] };

export type NoteComposerProps = {
  hint: string;
  /**
   * Posts the note; resolves null once Strapi recorded it, or the failure to show. It never rejects. The options are
   * passed only when the note is marked as changing the AI inputs or carries files.
   */
  onSubmit: (body: string, options?: NoteSubmitOptions) => Promise<ComposerFailure | null>;
  /** Strapi's `canMarkAiInputs`: offers the off-by-default `Changes the AI inputs` checkbox (D-26). */
  canMarkAiInputs?: boolean;
  /** The signed-in person's opaque draft key (13-09's `draftOwnerKey`); with `requestId`, unsent text is kept. */
  draftOwnerKey?: string | null;
  requestId?: string;
  /** Strapi's add facts when files can be added with a note (D-17): how many more the request can take. */
  attach?: { remaining: number } | null;
};

const composerId = 'note-composer';

/** Apple devices show ⌘; every other platform shows Ctrl (X-7). Both shortcuts work everywhere. */
function shortcutModifier(userAgent: string): '⌘' | 'Ctrl' {
  return /Mac|iPhone|iPad|iPod/i.test(userAgent) ? '⌘' : 'Ctrl';
}

export function NoteComposer({ attach = null, canMarkAiInputs = false, draftOwnerKey = null, hint, onSubmit, requestId }: NoteComposerProps) {
  const [text, setText] = useState('');
  /* §8.3: the caption under a draft restored from the session store, until the note is added or the field emptied. */
  const [restoredDraft, setRestoredDraft] = useState(false);
  /* The latest typed text, and the keep that waits for typing to pause. */
  const latest = useRef('');
  const keepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* X-18: off by default for every note; a failed post keeps the choice so Try again sends the same note. */
  const [changesAiInputs, setChangesAiInputs] = useState(false);
  const [failure, setFailure] = useState<ComposerFailure | null>(null);
  const posting = useRef(false);
  /* IN-303: while a note is being added its text is only in the request and the store, so the leave prompt stays armed. */
  const [inFlight, setInFlight] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  /* Set when a failed post puts its text back, so the cursor goes to the end once the text is rendered. */
  const restored = useRef(false);
  /* Decided in the browser after mount, so the server and the first client render agree (X-7). */
  const [modifier, setModifier] = useState<'⌘' | 'Ctrl' | null>(null);

  /* §4.1: the files to add with this note, kept for the tab per person and request (scope `composer`). */
  const takesFiles = attach !== null && draftOwnerKey !== null && requestId !== undefined;
  const [storedChips, dispatchChips, forgetOtherOwners] = useAttachmentQueue(draftOwnerKey ?? '', requestId ?? '', 'composer');
  const chips = takesFiles ? storedChips : [];
  const fileInput = useRef<HTMLInputElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setModifier(shortcutModifier(window.navigator.userAgent));
  }, []);

  /* §9.3: text kept earlier in this session for this person and request comes back on return. */
  useEffect(() => {
    if (!draftOwnerKey || !requestId) return undefined;
    /* Only the signed-in person's text stays in the store (IN-402). */
    clearOtherOwnersSessionDrafts(draftOwnerKey);
    const kept = readSessionDraft('note', draftOwnerKey, requestId);
    if (kept) {
      latest.current = kept;
      setText(kept);
      setRestoredDraft(true);
    }
    /* Leaving the page (or this request) keeps what was typed even if typing had not yet paused. */
    return () => {
      if (keepTimer.current === null) return;
      clearTimeout(keepTimer.current);
      keepTimer.current = null;
      writeSessionDraft('note', draftOwnerKey, requestId, latest.current);
    };
  }, [draftOwnerKey, requestId]);

  /*
   * §4.3 (UI-D10): chips kept from an earlier visit come back as they were, under the composer's caption. Another person
   * signed in on this tab never sees, or keeps, the files someone else chose.
   */
  useEffect(() => {
    if (!takesFiles || !draftOwnerKey) return;
    forgetOtherOwners(draftOwnerKey);
    dispatchChips({ type: 'restore', keepChosen: true });
  }, [dispatchChips, draftOwnerKey, forgetOtherOwners, takesFiles]);

  /* UI-D18: the browser's own prompt only, while the field holds text or files, or a note is being added (IN-303). */
  useUnloadWarning(text.trim().length > 0 || inFlight || chips.length > 0);
  /* UI-D30: files dropped beside the composer are ignored, so the browser never leaves the page to open one. */
  usePageFileDropGuard(region, takesFiles);

  /** Keeps `value` in the session store now, or once typing pauses. */
  function keep(value: string, now = false) {
    latest.current = value;
    if (!draftOwnerKey || !requestId) return;
    if (keepTimer.current !== null) clearTimeout(keepTimer.current);
    keepTimer.current = null;
    if (now) {
      writeSessionDraft('note', draftOwnerKey, requestId, value);
      return;
    }
    keepTimer.current = setTimeout(() => {
      keepTimer.current = null;
      writeSessionDraft('note', draftOwnerKey, requestId, value);
    }, KEEP_AFTER_MS);
  }

  function edit(value: string) {
    setText(value);
    if (value.length === 0) setRestoredDraft(false);
    keep(value);
  }

  useEffect(() => {
    if (!restored.current || !field.current) return;
    restored.current = false;
    const end = field.current.value.length;
    field.current.focus();
    field.current.setSelectionRange(end, end);
  }, [text]);

  /** §1.3: each chosen file is checked before anything is sent; a refused one stays as a chip with its reason. */
  function choose(files: File[]) {
    if (!takesFiles || files.length === 0) return;
    const checked = composerChips(files, chips, attach?.remaining ?? 0);
    if (checked.length > 0) dispatchChips({ type: 'add', rows: checked });
  }

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    /* The same file can be chosen again once it has been handled. */
    event.currentTarget.value = '';
    choose(files);
  }

  function over(event: DragEvent<HTMLDivElement>) {
    if (!takesFiles || !carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function left(event: DragEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  }

  function dropped(event: DragEvent<HTMLDivElement>) {
    if (!takesFiles || !carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    choose(Array.from(event.dataTransfer?.files ?? []));
  }

  async function post(body: string) {
    if (posting.current) return;
    /* Only the files that passed their checks go with the note; a refused chip stays here with its reason. */
    const sending = chips.filter((chip) => chip.stage === 'chosen');
    /* UI-D7: a note carrying files says what they are. */
    const invalid = sending.length > 0 && body.replace(/\r\n?/g, '\n').trim().length === 0 ? noteFilesCopy.needsText : validateNoteDraft(body);
    if (invalid !== null) {
      setFailure({ message: invalid, retryable: false });
      return;
    }
    posting.current = true;
    setInFlight(true);
    setFailure(null);
    /* The store holds exactly the text being sent until Strapi records it, so a refusal or a closed tab loses nothing. */
    keep(body, true);
    latest.current = '';
    setText('');
    field.current?.focus();
    /* §4.2: the files leave the composer with the note; the thread sends them once Strapi has recorded it. */
    for (const chip of sending) dispatchChips({ type: 'remove', key: chip.key });
    const marked = canMarkAiInputs && changesAiInputs;
    const options: NoteSubmitOptions = { ...(marked ? { changesAiInputs: true as const } : {}), ...(sending.length > 0 ? { files: sending.map((chip) => chip.file) } : {}) };
    const result = await (options.changesAiInputs || options.files ? onSubmit(body, options) : onSubmit(body));
    posting.current = false;
    setInFlight(false);
    if (!result) {
      setChangesAiInputs(false);
      setRestoredDraft(false);
      /* Added: the kept text goes, unless the person has already started the next note. */
      if (draftOwnerKey && requestId) {
        if (latest.current) keep(latest.current, true);
        else clearSessionDraft('note', draftOwnerKey, requestId);
      }
    }
    if (result) {
      /*
       * The failed note's text comes back without losing what was typed while it was being added (WR-303, WR-502): the
       * failed text first, then the new text, kept in the store at once so a keep still waiting cannot overwrite it.
       */
      const typedMeanwhile = latest.current;
      const restoredText = typedMeanwhile ? `${body}\n\n${typedMeanwhile}` : body;
      keep(restoredText, true);
      restored.current = true;
      setText(restoredText);
      setFailure(result);
      /* §4.2 step 3: the note's files come back to the chips with its text. */
      if (sending.length > 0) dispatchChips({ type: 'add', rows: sending.map((chip): QueueRow => ({ key: chip.key, file: chip.file, stage: 'chosen' })) });
    }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void post(event.currentTarget.value);
    }
  }

  /* §4.3: one caption covers kept text and kept files alike. */
  const restoredShown = restoredDraft || chips.some((chip) => chip.restored);
  const handedOff = chips.some((chip) => chip.handedOff);
  const describedBy = [
    `${composerId}-hint`,
    handedOff ? `${composerId}-handed-off` : null,
    chips.length > 0 ? `${composerId}-files-hint` : null,
    restoredShown ? `${composerId}-restored` : null,
    failure ? `${composerId}-error` : null,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cn('grid gap-2 rounded-lg outline-offset-4 transition-colors duration-(--duration-micro) ease-standard', dragging && 'bg-surface-hover outline-2 outline-foreground')}
      data-drag-active={takesFiles ? (dragging ? 'true' : 'false') : undefined}
      data-file-drop={takesFiles ? '' : undefined}
      data-print="hidden"
      onDragEnter={over}
      onDragLeave={left}
      onDragOver={over}
      onDrop={dropped}
      ref={region}
    >
      <Label className="text-sm font-medium text-foreground" htmlFor={composerId}>{notesCopy.composerLabel}</Label>
      <Textarea
        aria-describedby={describedBy}
        aria-invalid={failure ? true : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        className="min-h-[calc(3lh+1rem+2px)] max-h-[calc(12lh+1rem+2px)] overflow-y-auto"
        id={composerId}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={keyDown}
        ref={field}
        rows={3}
        value={text}
      />
      {handedOff ? <p className="text-xs text-foreground-secondary" id={`${composerId}-handed-off`}>{noteFilesCopy.handedOff}</p> : null}
      {chips.length > 0 ? (
        /* §4.1 (X-21): chips wrap in rows from 768px and stack at full width below. */
        <ul aria-label={noteFilesCopy.chipsName} className="grid gap-2 md:flex md:flex-wrap">
          {chips.map((chip) => (
            <li className="grid min-w-0 gap-1" key={chip.key}>
              <FileChip name={chip.file.name} size={chip.file.size} type={chosenFileType(chip.file.name)}>
                <Button aria-label={noteFilesCopy.removeChip(chip.file.name)} className={chipIconButtonClassName} onClick={() => dispatchChips({ type: 'remove', key: chip.key })} size="icon-xs" type="button" variant="ghost">
                  <X aria-hidden="true" />
                </Button>
              </FileChip>
              {chip.stage === 'refused' ? <p className="text-xs text-foreground [overflow-wrap:anywhere]">{noteFilesCopy.notAdded} {chip.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-foreground-secondary" id={`${composerId}-hint`}>{hint}</p>
      {chips.length > 0 ? <p className="text-xs text-foreground-secondary" id={`${composerId}-files-hint`}>{noteFilesCopy.hint}</p> : null}
      {restoredShown ? <p className="text-xs text-foreground-secondary" id={`${composerId}-restored`}>{notesCopy.restored}</p> : null}
      {failure ? <p className="text-xs text-destructive" id={`${composerId}-error`} role="alert">{failure.message}</p> : null}
      {canMarkAiInputs ? (
        /* §8.3 (X-18): the analyst's choice when the note is created, off by default; §4 Forms: hint under the label. */
        <div className="flex items-start gap-2 max-md:min-h-11">
          <Checkbox
            aria-describedby={`${composerId}-ai-hint`}
            checked={changesAiInputs}
            className="mt-0.5"
            id={`${composerId}-ai`}
            onCheckedChange={(checked) => setChangesAiInputs(checked === true)}
          />
          <div className="grid gap-0.5">
            <Label className="text-sm text-foreground" htmlFor={`${composerId}-ai`}>{aiMarkCopy.label}</Label>
            <p className="text-xs text-foreground-secondary" id={`${composerId}-ai-hint`}>{aiMarkCopy.hint}</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
        {takesFiles ? (
          <>
            {/* §4.1 (UI-D8): `Attach files` before `Add note`; the hidden input is reached only through it (2.1.1). */}
            <Button className="max-md:min-h-11 max-md:w-full md:me-auto" onClick={() => fileInput.current?.click()} size="sm" type="button" variant="outline">
              <Paperclip aria-hidden="true" />
              {noteFilesCopy.attachFiles}
            </Button>
            <input accept={ATTACHMENT_ACCEPT} aria-hidden="true" className="sr-only" id={`${composerId}-files`} multiple onChange={chosen} ref={fileInput} tabIndex={-1} type="file" />
          </>
        ) : null}
        {failure?.retryable ? (
          <Button className="max-md:min-h-11 max-md:w-full" onClick={() => void post(text)} type="button" variant="outline">{notesCopy.tryAgain}</Button>
        ) : null}
        <Button className="max-md:min-h-11 max-md:w-full" onClick={() => void post(text)} type="button">{notesCopy.addNote}</Button>
        {/* X-7: the keys after the action, from 768px only, once the platform is known. */}
        {modifier ? (
          <span aria-hidden="true" className="hidden md:inline-flex">
            <span className="shortcut-hint">
              <kbd className="shortcut-key micro-label">{modifier}</kbd>
              <kbd className="shortcut-key micro-label">Enter</kbd>
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
