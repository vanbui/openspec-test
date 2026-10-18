'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, ShieldEllipsis, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState, useTransition, type ChangeEvent, type Ref } from 'react';

import { useLeaveGuard, type LeaveCopy } from '@/components/csrm/navigation-guard';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/files/format-file-size';

import { uploadAttachmentAction } from './attachments-actions';
import {
  ATTACHMENT_ACCEPT,
  chosenFileType,
  chosenRow,
  fileKey,
  fileFieldHint,
  filesCopy,
  filesLeaveCopy,
  holdsRoom,
  precheckChosenFiles,
  queueControlNames,
  queueCountLine,
  queueReducer,
  queueSettlement,
  shownInQueue,
  type QueueRow,
  type QueueSettlement,
} from './attachments-domain';
import { FileField } from './file-field';
import { FileTypeIcon } from './file-type-icon';
import { useAttachmentQueue, useFileStoreDispatch, useQueueRows, type QueueScope } from './file-store';

export type { QueueSettlement } from './attachments-domain';

/*
 * The upload queue (X-20; 14-UI-SPEC §1.4) with its file field (X-19). On a draft files are added as soon as they are
 * chosen (UI-D4). Chosen files are checked in the browser first (§1.3): a refused one is listed at once with its reason
 * and never sent, and a duplicate choice is listed once. The rest are each one Server Action (D-26), sent one at a time
 * in the order chosen, so one failure never stops the others; `Retry` sends the same file again without choosing it.
 *
 * The rows live in the tab's file store (file-store.tsx): a file not added survives an in-app navigation and returns
 * under `Restored from earlier in this session.` (§1.5). While a file is waiting or being added, in-app links ask first
 * in the files' words and the browser warns before unloading (§10). Once every file has settled the page refreshes
 * once, and the added rows leave as the Files list they join re-renders; the count line keeps counting them and is the
 * queue's only announcement (UI-D11). A row being added is `aria-busy`.
 *
 * On the new-request form (`mode="deferred"`; §2.1, §2.2; UI-D3) there is no draft yet, so chosen files wait as
 * "chosen, not yet sent", in this component only: leaving before the draft exists loses them, which the form's leave
 * warning says. Once the form has saved the draft it calls `sendAll(requestId)`: the rows move to the tab's store under
 * that draft and are sent like any other, and the promise tells the form how they settled. A deferred queue never
 * refreshes the page, because the route now answers for the replaced address and a refresh would unmount the form
 * (RESEARCH Pitfall 18); the form moves on itself.
 *
 * Under a posted note (`field={false}`; §4.2) the queue has no field: the thread puts the note's files in its scope and
 * the queue sends them with the note's id, one at a time. A note just posted on this view is `fresh`, so its files are
 * sent at once rather than restored as files left behind. Once the page re-renders, a settled file is the note's chip
 * (X-21), so its row leaves the queue.
 */

/** What the form holding the queue may ask of it (§2.2). */
export type UploadQueueHandle = {
  /**
   * Whether a save has files to send or wait for: chosen and not yet sent, failed and awaiting Retry, or in flight. Before
   * the draft exists every row listed is work, a refused one too, because only the draft's store can keep it (WR-402).
   */
  hasWork: () => boolean;
  /** Sends every chosen or failed file to the draft, one at a time, and resolves once nothing is waiting or being added. */
  sendAll: (requestId: string) => Promise<QueueSettlement>;
};

export type UploadQueueProps = {
  /** The draft the files go to; a deferred queue learns it from `sendAll`. */
  requestId?: string;
  /** The signed-in person's opaque key (`draftOwnerKey`): the file store keys each queue by person and request. */
  ownerKey: string;
  scope: QueueScope;
  /** How many more files the request can take, from Strapi's add facts. */
  remaining: number;
  /** `Add files` on a draft; none without a field. */
  label?: string;
  /** Whether the queue offers the file field; a posted note's queue has none (§4.2). */
  field?: boolean;
  /** A note's queue the thread has just filled: its files are sent, not restored as left behind. */
  fresh?: boolean;
  /** `immediate` (the default) sends a file as soon as it is chosen; `deferred` waits for `sendAll` (the new-request form). */
  mode?: 'immediate' | 'deferred';
  /** A deferred queue's warning while it holds chosen files that leaving would lose (the form's §10 words). */
  leaveCopy?: LeaveCopy;
  /**
   * While the form holding the queue saves, the queue takes no change (WR-504): no file is chosen or dropped, and no row is
   * taken off, retried or replaced, so the save sends exactly the files listed. Files already on their way go on.
   */
  disabled?: boolean;
  ref?: Ref<UploadQueueHandle>;
};

const isInFlight = (row: QueueRow) => row.stage === 'waiting' || row.stage === 'adding';
const isAddedUnlisted = (row: QueueRow) => (row.stage === 'added' || row.stage === 'pending') && !row.listed;
const EMPTY_ROWS: readonly QueueRow[] = [];

/** Where focus goes once the rows re-render (§1.4). */
type FocusIntent = { kind: 'after-remove'; index: number } | { kind: 'row'; key: string };

export function UploadQueue({ disabled = false, field = true, fresh = false, label = '', leaveCopy, mode = 'immediate', ownerKey, ref, remaining, requestId, scope }: UploadQueueProps) {
  const router = useRouter();
  const deferred = mode === 'deferred';
  /* The draft a deferred queue sends to, once the form has saved it. */
  const [boundId, setBoundId] = useState<string | null>(null);
  const target = deferred ? boundId : requestId ?? null;
  const [storedRows, storeDispatch, forgetOtherOwners] = useAttachmentQueue(ownerKey, target ?? '', scope);
  /* §4.2 (UI-D9): the composer's chips, where `Add with a new note` moves a file. */
  const toFileStore = useFileStoreDispatch(ownerKey, target ?? '');
  const composerChips = useQueueRows(ownerKey, target ?? '', 'composer');
  /* Rows chosen before the draft exists stay here, not in the tab's store: nothing can keep them for a draft yet. */
  const [chosenRows, chosenDispatch] = useReducer(queueReducer, EMPTY_ROWS);
  const rows = target === null ? chosenRows : storedRows;
  const dispatch = target === null ? chosenDispatch : storeDispatch;
  const [refreshing, startRefresh] = useTransition();
  /* The key this queue is sending, so a re-run effect never sends a second file at once. */
  const sending = useRef<string | null>(null);
  const refreshRequested = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const focusIntent = useRef<FocusIntent | null>(null);
  /* False until the rows kept from an earlier visit are restored, so none of them is sent behind the person's back. A
   * fresh note's rows were never left behind: they are sent at once. */
  const restored = useRef(fresh);
  const skipRestore = useRef(fresh);
  /* sendAll: the chosen rows on their way into the store, the keys the store must show before settling is judged, and the
   * form waiting to hear how they settled. */
  const binding = useRef<QueueRow[] | null>(null);
  /*
   * WR-504: true from the render that hands the chosen rows to the new draft until they reach the tab's store, so the
   * files' leave guard stands up in the same render the "before the draft" guards stand down, with no moment between.
   */
  const [handingOver, setHandingOver] = useState(false);
  const expected = useRef<ReadonlySet<string> | null>(null);
  const waiter = useRef<((settlement: QueueSettlement) => void) | null>(null);
  /* WR-504: the rows as last rendered, which sendAll judges, whatever render the form's handle came from. */
  const latestRows = useRef(rows);
  useLayoutEffect(() => {
    latestRows.current = rows;
  }, [rows]);

  /* §1.5: on showing again, rows kept from an earlier visit are restored; another person's are forgotten. */
  useEffect(() => {
    forgetOtherOwners(ownerKey);
    if (skipRestore.current) {
      skipRestore.current = false;
      return;
    }
    dispatch({ type: 'restore' });
  }, [dispatch, forgetOtherOwners, ownerKey]);

  /* sendAll, once the draft is known: the chosen rows join the draft's queue in the tab's store, waiting to be sent. */
  useEffect(() => {
    const moving = binding.current;
    if (target === null || moving === null) return;
    binding.current = null;
    dispatch({ type: 'add', rows: moving });
    setHandingOver(false);
  }, [dispatch, target]);

  /* One at a time (D-26): the next waiting file goes once nothing is being added. */
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      return;
    }
    if (target === null) return;
    if (sending.current !== null || rows.some((row) => row.stage === 'adding')) return;
    const next = rows.find((row) => row.stage === 'waiting');
    if (!next) return;
    sending.current = next.key;
    dispatch({ type: 'settle', key: next.key, stage: 'adding' });
    const form = new FormData();
    form.set('requestId', target);
    /* The chosen File itself, so Retry sends exactly the file the person chose (a name would make a copy). */
    form.set('file', next.file);
    if (scope.startsWith('note:')) form.set('noteId', scope.slice('note:'.length));
    const settle = (action: Parameters<typeof dispatch>[0]) => {
      /* Freed before the row settles, so the render that follows sends the next file. */
      sending.current = null;
      dispatch(action);
    };
    void uploadAttachmentAction(form).then(
      (result) => {
        if (result.ok) settle({ type: 'settle', key: next.key, stage: result.data.state === 'pending' ? 'pending' : 'added' });
        else settle({ type: 'settle', key: next.key, stage: result.kind === 'retryable' ? 'failed' : 'refused', message: result.message, ...(result.offerNewNote ? { offerNewNote: true } : {}) });
      },
      () => settle({ type: 'settle', key: next.key, stage: 'failed', message: filesCopy.transferFailed }),
    );
  }, [dispatch, rows, scope, target]);

  /* sendAll's answer: once the moved rows are in the store and nothing is waiting or being added. */
  useEffect(() => {
    const resolve = waiter.current;
    if (!resolve || binding.current !== null) return;
    if (expected.current) {
      const shown = new Set(rows.map((row) => row.key));
      if (![...expected.current].every((key) => shown.has(key))) return;
      expected.current = null;
    }
    if (rows.some(isInFlight)) return;
    waiter.current = null;
    resolve(queueSettlement(rows));
  }, [rows]);

  /* The list re-renders once the queue settles; its rows then leave the queue (Pitfall 18: never one refresh per file). */
  useEffect(() => {
    if (refreshRequested.current && !refreshing) {
      refreshRequested.current = false;
      dispatch({ type: 'listed' });
    }
  }, [dispatch, refreshing]);

  const inFlight = rows.some(isInFlight);
  const settled = rows.length > 0 && !inFlight;
  const unlisted = rows.some(isAddedUnlisted);
  useEffect(() => {
    /* A deferred queue's form moves on itself: a refresh would re-render the replaced address and unmount it. */
    if (deferred || !settled || !unlisted || refreshRequested.current) return;
    refreshRequested.current = true;
    startRefresh(() => router.refresh());
  }, [deferred, router, settled, unlisted]);

  useLeaveGuard(inFlight || handingOver, 'waiting', filesLeaveCopy);
  /*
   * §10: every row listed before the draft exists, chosen or refused, lives only here and is lost by leaving, so in-app
   * links ask first in the form's words (WR-402).
   */
  useLeaveGuard(Boolean(leaveCopy) && target === null && rows.length > 0, 'waiting', leaveCopy);

  useImperativeHandle(ref, () => ({
    hasWork: () => target === null
      ? latestRows.current.some((row) => row.stage !== 'added' && row.stage !== 'pending' && !row.listed)
      : latestRows.current.some((row) => row.stage === 'chosen' || row.stage === 'failed' || isInFlight(row)),
    sendAll: (draftId: string) => new Promise<QueueSettlement>((resolve) => {
      /* The rows as they are now, never as they were when the form took this handle (WR-504). */
      const current = latestRows.current;
      waiter.current = resolve;
      if (target === null) {
        const moving = current.map((row): QueueRow => row.stage === 'chosen' ? { key: row.key, file: row.file, stage: 'waiting' } : row);
        binding.current = moving;
        expected.current = new Set(moving.map((row) => row.key));
        setHandingOver(moving.some((row) => row.stage === 'waiting'));
        setBoundId(draftId);
        return;
      }
      /* Saving again sends the files still listed that can be sent: a failed transfer is retried; a refused file waits to
       * be replaced or removed. */
      const failed = current.filter((row) => row.stage === 'failed');
      for (const row of failed) dispatch({ type: 'retry', key: row.key });
      if (failed.length === 0 && !current.some(isInFlight)) {
        waiter.current = null;
        resolve(queueSettlement(current));
      }
    }),
  }), [dispatch, target]);

  /* §1.4: focus stays where the person acted, and moves only after a row leaves or is replaced. */
  useEffect(() => {
    const intent = focusIntent.current;
    if (!intent) return;
    focusIntent.current = null;
    const items = Array.from(list.current?.querySelectorAll<HTMLLIElement>(':scope > li') ?? []);
    if (intent.kind === 'row') {
      /* The row itself, which keeps focus while its stage changes under it. */
      items.find((candidate) => candidate.dataset.key === intent.key)?.focus();
      return;
    }
    const target = items[intent.index] ?? items[intent.index - 1];
    if (target) (target.querySelector<HTMLButtonElement>('button') ?? target).focus();
    else chooseButton.current?.focus();
  }, [rows]);

  /* Files in this queue still count against the request until the list carries them. */
  const room = Math.max(0, remaining - rows.filter(holdsRoom).length);
  /* Under a note, a file the page lists is the note's chip, which carries its state (§4.2). */
  const shown = rows.filter(field ? shownInQueue : (row) => !row.listed);
  const existingKeys = (except?: string) => new Set(rows.filter((row) => row.key !== except && !row.listed).map((row) => row.key));
  /* Before the draft exists a file waits to be sent with it (§1.4 "chosen, not yet sent"). */
  const asChosen = (row: QueueRow): QueueRow => target === null && row.stage === 'waiting' ? { ...row, stage: 'chosen' } : row;
  /* The count line counts a transfer (§12), so it stays empty while every row only waits for the draft. */
  const counting = rows.some((row) => row.stage !== 'chosen');

  function choose(files: File[]) {
    if (disabled) return;
    dispatch({ type: 'add', rows: precheckChosenFiles(files, { remaining: room, existingKeys: existingKeys() }).map(chosenRow).map(asChosen) });
  }

  function remove(row: QueueRow) {
    /*
     * The last row of a draft's queue without a field: the queue leaves with it (WR-401), so focus moves now, before the
     * row's button unmounts, to the line that stands where `Choose files` was.
     */
    if (!field && scope === 'draft' && shown.length === 1) lockedLineOrHeading(root.current)?.focus();
    else focusIntent.current = { kind: 'after-remove', index: shown.findIndex((candidate) => candidate.key === row.key) };
    dispatch({ type: 'remove', key: row.key });
  }

  function retry(row: QueueRow) {
    focusIntent.current = { kind: 'row', key: row.key };
    dispatch({ type: 'retry', key: row.key });
  }

  /**
   * §4.2 step 4 (UI-D9): a file its note can no longer take leaves the note for the composer's chips, so it goes with the
   * next note; focus moves to the composer's text, where that note is written. A file already a chip is not listed twice.
   */
  function addWithNewNote(row: QueueRow) {
    dispatch({ type: 'remove', key: row.key });
    if (!composerChips.some((chip) => chip.key === row.key)) toFileStore('composer', { type: 'add', rows: [{ key: row.key, file: row.file, stage: 'chosen' }] });
    document.getElementById('note-composer')?.focus();
  }

  function chooseAnother(row: QueueRow) {
    replacing.current = row.key;
    replaceInput.current?.click();
  }

  function replaced(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const key = replacing.current;
    replacing.current = null;
    if (!file || key === null) return;
    const [checked] = precheckChosenFiles([file], { remaining: room, existingKeys: existingKeys(key) });
    if (!checked) {
      /*
       * IN-409: the file is already listed (UI-D13), so nothing is added twice. The refused row stays with its reason and
       * actions, and takes focus where a replacement row would have (§1.4). After the chooser has handed focus back.
       */
      const row = Array.from(list.current?.querySelectorAll<HTMLLIElement>(':scope > li') ?? []).find((item) => item.dataset.key === key);
      queueMicrotask(() => row?.focus());
      return;
    }
    focusIntent.current = { kind: 'row', key: checked.key };
    dispatch({ type: 'replace', key, row: asChosen(chosenRow(checked)) });
  }

  /* Under a note the count line stays only while the note has rows to show; the chips say the rest. */
  const countLine = counting && (field || shown.length > 0) ? queueCountLine(rows) : '';

  return (
    <div className="grid gap-3" ref={root}>
      {field ? <FileField buttonRef={chooseButton} disabled={disabled} hint={fileFieldHint(room)} label={label} onFiles={choose} /> : null}
      <div className="grid gap-2" data-print="hidden">
        {field || shown.length > 0 ? <p className="text-xs text-foreground-secondary tabular-nums" role="status">{countLine}</p> : null}
        {shown.some((row) => row.restored) ? <p className="text-xs text-foreground-secondary">{filesCopy.restored}</p> : null}
        {shown.length > 0 ? (
          <ul aria-label={filesCopy.queueName} className="divide-y divide-border rounded-lg border border-border bg-surface" ref={list}>
            {shown.map((row) => <QueueRowItem disabled={disabled} key={row.key} onAddWithNewNote={addWithNewNote} onChooseAnother={chooseAnother} onRemove={remove} onRetry={retry} row={row} />)}
          </ul>
        ) : null}
        {/* `Choose another file` opens the chooser for one file, which takes the refused row's place. */}
        <input accept={ATTACHMENT_ACCEPT} aria-hidden="true" className="sr-only" disabled={disabled} onChange={replaced} ref={replaceInput} tabIndex={-1} type="file" />
      </div>
    </div>
  );
}

/**
 * §1.4's last focus target where the queue has no field: the §1.2 line that stands in its place on the Files panel, else
 * the section heading (WR-401).
 */
function lockedLineOrHeading(from: HTMLElement | null): HTMLElement | null {
  return from?.closest('[data-files-panel]')?.querySelector<HTMLElement>('[data-files-locked]') ?? document.getElementById('files');
}

export type DraftUploadQueueProps = Omit<UploadQueueProps, 'field' | 'scope' | 'mode' | 'leaveCopy' | 'fresh'> & {
  requestId: string;
  /** Whether Strapi lets the person add files to the draft now: only then does the queue offer its field. */
  canAdd: boolean;
};

/**
 * A draft's queue on its request page and its edit form (§1.5, §2.3; WR-401). It renders while files can be added, and
 * also while the tab keeps files not added for this draft, without its field: the rows return with their reasons and
 * actions even after Strapi says no more files can be added, so `Remove from list` always reaches them.
 */
export function DraftUploadQueue({ canAdd, ...props }: DraftUploadQueueProps) {
  const kept = useQueueRows(props.ownerKey, props.requestId, 'draft');
  if (!canAdd && !kept.some((row) => !row.listed)) return null;
  return <UploadQueue {...props} field={canAdd} scope="draft" />;
}

/*
 * X-20's stage icon, 14px beside its caption text (the spinner 16px), drawn inline so it sits on the caption's line and
 * the stage follows the name and size on theirs (§1.4).
 */
function StageIcon({ stage }: { stage: QueueRow['stage'] }) {
  const className = 'me-1 inline-block size-3.5 shrink-0 align-text-bottom';
  switch (stage) {
    case 'waiting':
      return <Clock aria-hidden="true" className={`${className} text-foreground-secondary`} />;
    case 'adding':
      return <Loader2 aria-hidden="true" className="me-1 inline-block size-4 shrink-0 animate-spin align-text-bottom text-foreground-secondary motion-reduce:animate-none" />;
    case 'added':
      return <CheckCircle2 aria-hidden="true" className={`${className} text-success`} />;
    case 'pending':
      return <ShieldEllipsis aria-hidden="true" className={`${className} text-foreground-secondary`} />;
    case 'refused':
    case 'failed':
      return <AlertCircle aria-hidden="true" className={`${className} text-destructive`} />;
    default:
      return null;
  }
}

/** A row's stage caption, which sits on the name's line (§1.4), or null while the file is chosen and not yet sent. */
function stageText(row: QueueRow): string | null {
  switch (row.stage) {
    case 'waiting': return filesCopy.waiting;
    case 'adding': return filesCopy.adding;
    case 'added': return filesCopy.added;
    case 'pending': return filesCopy.pending;
    case 'refused':
    case 'failed': return filesCopy.notAdded;
    default: return null;
  }
}

/** What is wrong with a file not added and how to fix it, which wraps beneath the name's line (§1.4). */
function stageReason(row: QueueRow): string | null {
  return row.stage === 'refused' || row.stage === 'failed' ? row.message ?? filesCopy.transferFailed : null;
}

/**
 * §4.2 step 1: the files of a note still being added, as X-20 rows at `Waiting`. They are sent with the note's id once
 * Strapi has recorded the note, so until then nothing can be done to them.
 */
export function WaitingRows({ files }: { files: readonly File[] }) {
  if (files.length === 0) return null;
  return (
    <ul aria-label={filesCopy.queueName} className="divide-y divide-border rounded-lg border border-border bg-surface" data-print="hidden">
      {files.map((file) => <QueueRowItem key={fileKey(file)} row={{ key: fileKey(file), file, stage: 'waiting' }} />)}
    </ul>
  );
}

type QueueRowItemProps = {
  row: QueueRow;
  /** A row's actions; a row shown only to say where a file stands has none. */
  onRetry?: (row: QueueRow) => void;
  onRemove?: (row: QueueRow) => void;
  onChooseAnother?: (row: QueueRow) => void;
  /** §4.2 (UI-D9): for a file its note can no longer take, in place of Retry or Choose another file. */
  onAddWithNewNote?: (row: QueueRow) => void;
  /** While the form holding the queue saves, no row action takes input (WR-504). */
  disabled?: boolean;
};

function QueueRowItem({ disabled = false, onAddWithNewNote, onChooseAnother, onRemove, onRetry, row }: QueueRowItemProps) {
  const name = row.file.name;
  const notAdded = row.stage === 'refused' || row.stage === 'failed';
  const removable = Boolean(onRemove) && (row.stage === 'waiting' || row.stage === 'chosen');
  const text = stageText(row);
  const reason = stageReason(row);
  const actionClass = 'max-md:min-h-11 max-md:w-full';
  return (
    <li aria-busy={row.stage === 'adding' ? true : undefined} className="flex min-h-11 flex-col gap-3 px-4 py-4 outline-none md:flex-row md:items-start" data-key={row.key} tabIndex={-1}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* O1 (X-20): the file-type icon from the Files list's mapping; the stage has its own icon beside its text. */}
        <FileTypeIcon className="mt-0.5" type={chosenFileType(name)} />
        <div className="grid min-w-0 flex-1 gap-1">
          {/*
            * O3 (§1.4): one line where it fits, the name, the size and the stage; the stage wraps beneath the name only
            * when the line has no room, and below 768px always starts its own line (the stacked phone row). A refusal's
            * reason wraps beneath. The stage ends in a space, so the row still reads `Not added. {reason}` as text.
            */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{name}</span>
            <span className="text-xs text-foreground-secondary tabular-nums">{formatFileSize(row.file.size)}</span>
            {text ? (
              <span className={`text-xs max-md:basis-full ${notAdded ? 'text-foreground' : 'text-foreground-secondary'}`} data-queue-stage="">
                <StageIcon stage={row.stage} />{text}{reason ? ' ' : null}
              </span>
            ) : null}
          </div>
          {reason ? <p className="text-xs text-foreground [overflow-wrap:anywhere]">{reason}</p> : null}
        </div>
      </div>
      {removable ? (
        /*
         * §1.4 at 375 (WR-405): the row's action, at full width and the touch-target height with its visible label, which
         * begins its accessible name (2.5.3); from 768px the 24px icon-only X (2.5.8).
         */
        <Button aria-label={queueControlNames.removeWaiting(name)} className={`${actionClass} max-md:px-3`} disabled={disabled} onClick={() => onRemove?.(row)} size="icon-xs" type="button" variant="ghost">
          <X aria-hidden="true" />
          <span className="md:hidden">{filesCopy.removeChosen}</span>
        </Button>
      ) : null}
      {notAdded && onRemove ? (
        <div className="flex flex-col gap-2 md:flex-row md:shrink-0">
          {row.offerNewNote && onAddWithNewNote ? (
            <Button aria-label={queueControlNames.addWithNewNote(name)} className={actionClass} disabled={disabled} onClick={() => onAddWithNewNote(row)} size="sm" type="button" variant="outline">{filesCopy.addWithNewNote}</Button>
          ) : row.stage === 'failed' ? (
            <Button aria-label={queueControlNames.retry(name)} className={actionClass} disabled={disabled} onClick={() => onRetry?.(row)} size="sm" type="button" variant="outline">{filesCopy.retry}</Button>
          ) : (
            <Button aria-label={queueControlNames.chooseAnother(name)} className={actionClass} disabled={disabled} onClick={() => onChooseAnother?.(row)} size="sm" type="button" variant="outline">{filesCopy.chooseAnother}</Button>
          )}
          <Button aria-label={queueControlNames.removeFromList(name)} className={actionClass} disabled={disabled} onClick={() => onRemove?.(row)} size="sm" type="button" variant="ghost">{filesCopy.removeFromList}</Button>
        </div>
      ) : null}
    </li>
  );
}
