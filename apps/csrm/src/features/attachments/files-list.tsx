'use client';

import { ChevronDown, ChevronUp, Download, Ellipsis, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn, type DataTableContainerWidth } from '@/components/csrm/data-table';
import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { EmptyState, ErrorState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';
import { attachmentFileRefusal, downloadFailureTitle } from '@/lib/api/refusal-copy';
import { formatFileSize } from '@/lib/files/format-file-size';
import { saveFile } from '@/lib/files/save-file';
import { cn } from '@/lib/utils';

import { AttachmentStatusBadge } from './attachment-status-badge';
import { downloadAttachmentAction, setAttachmentRemovalAction, type AttachmentActionResult, type DownloadAttachmentResult } from './attachments-actions';
import {
  fileAiControlMode,
  fileDownloadCopy,
  fileRemovalCopy,
  fileRemovalFailureTitle,
  fileRemovalToast,
  fileStateLine,
  fileTypeLabel,
  fileUploader,
  filesCopy,
  filesCountLabel,
  type AttachmentState,
  type FileAiPolicy,
  type FilesEmptyState,
  type FileRemovalChange,
  type FilesViewer,
  type RequestAttachment,
} from './attachments-domain';
import type { FileAiControlLayout } from './file-ai-control';
import { FileTypeIcon } from './file-type-icon';
import { bottomSheetMotion } from './sheet-motion';

/*
 * 14-UI-SPEC §5.1 (D-28, D-30): the analyst's AI control loads on demand, so a page whose list carries no AI policy (the
 * Requestor's) never downloads it, and the request page's first load stays within its budget.
 */
const FileAiControl = dynamic(() => import('./file-ai-control').then((module) => module.FileAiControl));

/*
 * The Files list (X-21; 14-UI-SPEC §3.2 to §3.5): the count line, every file not removed, newest first, then the removed
 * group. From 768px a DataTable with the density toggle and §3.2's columns, never paged, where the table fits the list's
 * width; elsewhere, and always below 768px, one card per file, with `Download` at full width and every other action in
 * a bottom sheet (UI-D16; the pilot's walk, D2). Each file offers only the actions Strapi served for this viewer (D-19);
 * Strapi re-checks every one (T-14-48).
 *
 * - `Download` is an explicit button (UI-D15) that reads the file through a Server Action, which checks the bytes on the
 *   server, and saves them through the shared helper, never previewing them inline (D-23, D-24; T-14-46).
 * - `Remove` applies at once (§5 Optimistic UI): the file joins the removed group at the pending opacity until Strapi
 *   answers, then an X-14 Undo toast says so; nothing asks for confirmation (D-20, D-29). A refusal rolls it back with
 *   family O's words. `Restore`, for the person who removed it, works the same way.
 * - A file that cannot be downloaded shows its state from the one status mapping, with what it means (§3.4).
 * - For a Security Analyst, whose list carries the section's AI policy, the `AI inputs` column, the card's
 *   `AI inputs: {facts}` line and the AI control in the actions sheet (§5.1; D-28, D-30). The control loads on demand.
 *
 * Each file's row or card is the `#file-{documentId}` link target (`tabIndex={-1}`), carried by the layout that shows so
 * the id is never on two elements, and a removed file's row in the removed group is too (WR-506). Links to the section
 * and to a file land here once the list has mounted (the pilot's walk, D1). The controls do not print (§3.7,
 * `data-print="hidden"`).
 */

function TypeIcon({ type }: { type: RequestAttachment['fileType'] }) {
  return <FileTypeIcon className="mt-0.5" type={type} />;
}

function NoteCell({ note }: { note: RequestAttachment['note'] }) {
  if (!note) return <span className="whitespace-normal text-foreground-secondary">{filesCopy.beforeSubmission}</span>;
  /*
   * O6 (2.5.8): 4px block padding makes the link at least 24px tall, as the direction's source citations are (§4). D2: in
   * a table short of room the link may break after `Note ·`, never inside its instant.
   */
  return (
    <RecordLink className="inline-block whitespace-normal py-1" href={`#note-${encodeURIComponent(note.documentId)}`}>
      Note · <span className="whitespace-nowrap"><LocalInstant style="date-time" value={note.postedAt} /></span>
    </RecordLink>
  );
}

/**
 * The width from which a list's table is chosen over its cards (the pilot's walk, D2; §3.2): the table's narrowest, as
 * measured at 1440, with the Name column's 14rem, the size, who added the file and their part, when, the note link, the
 * actions and, for a Security Analyst, the 10rem `AI inputs` column. A file that shows its state in place of `Download`
 * (§3.4) widens the actions by its badge. It is the server's guess; the browser then checks that the table fits.
 */
function tableFrom(ai: boolean, badge: boolean): DataTableContainerWidth {
  if (ai) return badge ? '70rem' : '65rem';
  return badge ? '60rem' : '54rem';
}

const showsBadge = (file: RequestAttachment) => file.state !== 'available' && file.state !== 'removed';

type ListLayout = { wide: boolean; measured: boolean };

/**
 * Which layout of the list shows (X-21; the pilot's walk, D2): the cards below 768px; from 768px the table where it fits
 * the list's width and the cards where it does not. The list's width chooses first (`tableFrom`, so the server's markup
 * is usually right). Once the browser shows the table, a table still wider than its list gives way to the cards
 * (`tooWide`), which stay until the list is as wide as the table measured or its files change. `measured` turns true
 * once the browser has said which layout shows, so a link waits for the element it names (D1). With no layout engine
 * (a unit test) the viewport alone decides.
 */
function useListLayout(container: RefObject<HTMLDivElement | null>, files: readonly RequestAttachment[]): ListLayout & { tooWide: boolean } {
  const [view, setView] = useState<ListLayout>({ wide: true, measured: false });
  /* The list's width the table needed when it did not fit, or null while the table has its chance. */
  const [tooWideAt, setTooWideAt] = useState<number | null>(null);
  const [filesSeen, setFilesSeen] = useState(files);
  if (files !== filesSeen) {
    setFilesSeen(files);
    setTooWideAt(null);
  }

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 48rem)') : null;
    const commit = (next: ListLayout) => setView((current) => (current.wide === next.wide && current.measured === next.measured ? current : next));
    const measure = () => {
      if (tooWideAt !== null) {
        if (element.clientWidth >= tooWideAt) setTooWideAt(null);
        else commit({ wide: false, measured: true });
        return;
      }
      const scroller = element.querySelector<HTMLElement>('[data-slot="data-table-desktop"]');
      const shown = scroller !== null && getComputedStyle(scroller).display !== 'none';
      if (shown && scroller.scrollWidth > scroller.clientWidth + 1) {
        setTooWideAt(element.clientWidth + scroller.scrollWidth - scroller.clientWidth);
        return;
      }
      commit({ wide: (query?.matches ?? true) && (shown || scroller === null), measured: true });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    query?.addEventListener('change', measure);
    return () => {
      observer?.disconnect();
      query?.removeEventListener('change', measure);
    };
  }, [container, filesSeen, tooWideAt]);

  return { ...view, tooWide: tooWideAt !== null };
}

const anchorId = (attachment: RequestAttachment) => `file-${attachment.documentId}`;

/**
 * A file as the list shows it: as Strapi last served it, or as a change not yet answered (`pending`). A file being
 * restored (`restoring`) is in the main list even while its state is not known yet.
 */
type ShownFile = RequestAttachment & { pending?: boolean; restoring?: boolean };

type RemovalIntent = { id: string; removed: boolean; before?: AttachmentState };

/*
 * §5 Optimistic UI: the change as it will most likely be answered. A removed file leaves the main list; a restored one
 * returns to it with no actions until Strapi says which it allows, in the state it had before it was removed where this
 * view knows it, and never as available when it does not (IN-408): a file whose state is unknown shows no badge until
 * Strapi answers. Who removed it, and when, are Strapi's to say.
 */
function optimisticRemoval(file: RequestAttachment, removed: boolean, before?: AttachmentState): ShownFile {
  const noActions = { download: false, remove: false, restore: false };
  return removed
    ? { ...file, state: 'removed', removedBy: null, removedAt: null, actions: noActions, pending: true }
    : { ...file, state: before ?? file.state, removedBy: null, removedAt: null, actions: noActions, pending: true, restoring: true };
}

const inMainList = (file: ShownFile) => file.state !== 'removed' || file.restoring === true;

/**
 * §3.5: where focus lands on a file: its first action in the layout shown (its `Download` where it has one), else the
 * first control on its table row; null when the file renders nothing to press.
 */
/** Whether the browser shows a control: connected and laid out (a control in the hidden layout has no boxes). */
function isShown(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0;
}

function fileFocusTarget(root: HTMLElement | null, id: string, wide: boolean): HTMLElement | null {
  const actions = root?.querySelector<HTMLElement>(`[data-file-actions="${CSS.escape(id)}"][data-layout="${wide ? 'table' : 'card'}"]`);
  if (!actions) return null;
  return actions.querySelector<HTMLElement>('button') ?? actions.closest('tr')?.querySelector<HTMLElement>('button, [role="switch"]') ?? null;
}

/** §5 Motion: the pending opacity applies at once; leaving it eases back at --duration-base, as a rollback does. */
const pendingOpacity = 'transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none';

/**
 * 14-UI-REVIEW UI-04 (§3.5, "Restoring returns the file at the pending opacity"): a table row waiting for Strapi reads as
 * pending in every cell, its state badge included. The row's `data-pending` sets the same pending opacity on each of its
 * cells, so the row's own hover tint keeps its 80ms transition (a transition on the row itself would replace it).
 */
const pendingRowOpacity = '[&>td]:transition-opacity [&>td]:duration-(--duration-base) [&>td]:ease-standard data-[pending=true]:[&>td]:opacity-60 data-[pending=true]:[&>td]:transition-none';

/** §3.4: a file that cannot be downloaded shows its state and what it means; an available file shows no badge. */
function FileState({ attachment, className }: { attachment: RequestAttachment; className?: string }) {
  if (attachment.state === 'available' || attachment.state === 'removed') return null;
  const line = fileStateLine(attachment);
  return (
    <div className={cn('grid justify-items-start gap-1', className)}>
      <AttachmentStatusBadge value={attachment.state} />
      {line ? <p className="text-xs text-foreground-secondary [overflow-wrap:anywhere]">{line}</p> : null}
    </div>
  );
}

type DownloadButtonProps = {
  attachment: RequestAttachment;
  downloading: boolean;
  onDownload: (attachment: RequestAttachment) => void;
  className?: string;
};

/**
 * §3.3 (UI-D25): `Download`, named `Download {name}`: the visible label first, then the file (2.5.3). While the file
 * comes it reads `Downloading…` with the inline spinner and ignores further presses, staying focusable.
 */
function DownloadButton({ attachment, className, downloading, onDownload }: DownloadButtonProps) {
  const label = downloading ? fileDownloadCopy.downloading : fileDownloadCopy.download;
  return (
    <Button
      aria-disabled={downloading || undefined}
      aria-label={`${label} ${attachment.fileName}`}
      className={className}
      data-print="hidden"
      onClick={() => {
        if (!downloading) onDownload(attachment);
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {downloading
        ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        : <Download aria-hidden="true" />}
      {label}
    </Button>
  );
}

/**
 * The compact error when the files read failed and the page did not (§3.7): `Try again` reads the page again. A link to
 * `#files` still lands on the section's heading (D1).
 */
export function FilesReadError() {
  const router = useRouter();
  useHashLanding((id) => {
    const heading = id === 'files' ? document.getElementById(id) : null;
    if (heading) landOn(heading);
  });
  return <ErrorState density="compact" headingLevel="h3" noun="the files" retry={() => router.refresh()} />;
}

export type FilesListProps = {
  requestId: string;
  /** Every file the list read returned, newest first: those not removed form the main list, the rest the removed group. */
  attachments: readonly RequestAttachment[];
  /**
   * The list read's count of the files not removed (`meta.total`). The count line starts from it and moves with each
   * removal or restore still waiting for Strapi (D6).
   */
  total: number;
  viewer: FilesViewer;
  /** §3.7: the empty state for this viewer and window, from `filesEmptyState`; EmptyState words its heading. */
  empty: FilesEmptyState;
  /** Keys the density choice; the signed-in person's opaque key. */
  densityUserId: string;
  /**
   * The section's AI policy, which Strapi serves to a human Security Analyst only (D-28, D-30). With it the list gains
   * the `AI inputs` column, the card's AI line and the AI control in the actions sheet (§3.2, §5.1); without it, none.
   */
  aiPolicy?: FileAiPolicy;
};

/*
 * The list's per-file handlers, read by the table's cells through context, so the columns stay the same between renders.
 * A column whose cell function changed would remount its cells, and a focused button would lose focus (§3.5).
 */
type FileHandlers = {
  downloadButton: (attachment: RequestAttachment, className?: string) => ReactNode;
  onRemove: (attachment: RequestAttachment) => void;
  /** The file's AI control in a layout, or nothing where the list carries no AI policy (§5.1). */
  aiControl: (attachment: ShownFile, layout: FileAiControlLayout) => ReactNode;
  /** Whether the file's AI control offers anything to press: its switch or `Preview text` (§3.3's actions sheet). */
  hasAiActions: (attachment: RequestAttachment) => boolean;
};

const FileHandlersContext = createContext<FileHandlers | null>(null);

function useFileHandlers(): FileHandlers {
  const handlers = useContext(FileHandlersContext);
  if (!handlers) throw new Error('FILES_LIST_HANDLERS_MISSING');
  return handlers;
}

/**
 * The table's Actions cell: the file's state, then the actions Strapi served for this viewer. D2: as narrow as its widest
 * control, with `Remove` wrapping beneath `Download` where the table is short of room, and the state's line within 14rem.
 */
function TableActions({ attachment }: { attachment: ShownFile }) {
  const { downloadButton, onRemove } = useFileHandlers();
  return (
    <div className="flex flex-wrap items-start gap-2 py-2 whitespace-normal" data-file-actions={attachment.documentId} data-layout="table">
      <FileState attachment={attachment} className="max-w-56" />
      {downloadButton(attachment)}
      {attachment.actions.remove ? (
        <Button aria-label={fileRemovalCopy.removeName(attachment.fileName)} data-print="hidden" onClick={() => onRemove(attachment)} size="sm" type="button" variant="ghost">
          {fileRemovalCopy.remove}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The table's `AI inputs` cell (§3.2, §5.1), for a Security Analyst's list only: 10rem to 12rem wide. At 12rem the switch
 * and its label share a line; where the table is short of room (D2) the label wraps beside the switch. A long facts line
 * wraps beneath, so the table stays as narrow as it can (the X-3 bound).
 */
function AiCell({ attachment }: { attachment: ShownFile }) {
  const { aiControl } = useFileHandlers();
  /* UI-04: while the file's change waits for Strapi the row dims this cell with the others. */
  return <div className="min-w-40 max-w-48 whitespace-normal">{aiControl(attachment, 'cell')}</div>;
}

const aiColumn: DataTableColumn<ShownFile> = {
  id: 'ai', accessorKey: 'documentId', header: 'AI inputs', cell: (_value, attachment) => <AiCell attachment={attachment} />,
};

/**
 * The table's columns (§3.2); `wide` places the `#file-{id}` target on the table only while the table is shown, and
 * `ai` adds the `AI inputs` column before the actions.
 */
function fileColumns(wide: boolean, ai: boolean): DataTableColumn<ShownFile>[] {
  return [
    {
      accessorKey: 'fileName',
      header: 'Name',
      wrap: true,
      cell: (_value, attachment) => (
        <div
          className="flex items-start gap-2 py-2 outline-none"
          id={wide ? anchorId(attachment) : undefined}
          tabIndex={wide ? -1 : undefined}
        >
          <TypeIcon type={attachment.fileType} />
          <div className="grid min-w-0 gap-1">
            <span className="font-medium text-foreground [overflow-wrap:anywhere]">{attachment.fileName}</span>
            <span className="micro-label">{fileTypeLabel(attachment.fileType)}</span>
          </div>
        </div>
      ),
    },
    { accessorKey: 'byteSize', header: 'Size', numeric: 'magnitude', cell: (_value, attachment) => formatFileSize(attachment.byteSize) },
    {
      accessorKey: 'uploadedBy',
      header: 'Added by',
      cell: (_value, attachment) => {
        const { name, part } = fileUploader(attachment);
        /* D2: the part may wrap beneath itself where the table is short of room; the name stays whole. */
        return <div className="grid py-2"><span>{name}</span><span className="text-xs whitespace-normal text-foreground-secondary">{part}</span></div>;
      },
    },
    { accessorKey: 'uploadedAt', header: 'Added', cell: (_value, attachment) => <LocalInstant style="date-time" value={attachment.uploadedAt} /> },
    { accessorKey: 'note', header: 'Note', cell: (_value, attachment) => <NoteCell note={attachment.note} /> },
    ...(ai ? [aiColumn] : []),
    /* Not a long-text column (D2): the actions take only the room their controls need. */
    { id: 'actions', accessorKey: 'documentId', header: 'Actions', headerHidden: true, cell: (_value, attachment) => <TableActions attachment={attachment} /> },
  ];
}

/** Where focus goes once the list re-renders (§3.5): a file's first action, or the section heading. */
type FocusIntent = { kind: 'file'; id: string } | { kind: 'heading' };

export function FilesList({ aiPolicy, attachments, densityUserId, empty, requestId, total }: FilesListProps) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const { measured, tooWide, wide } = useListLayout(container, attachments);
  const focusIntent = useRef<FocusIntent | null>(null);
  const groupId = `${useId()}-removed-files`;
  const [groupOpen, setGroupOpen] = useState(false);
  const [downloading, setDownloading] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState('');

  /* What Strapi last served: the page's list, then each change's answer, until the page renders the list again. */
  const [served, setServed] = useState<readonly RequestAttachment[]>(attachments);
  const [read, setRead] = useState(attachments);
  if (attachments !== read) {
    setRead(attachments);
    setServed(attachments);
  }
  const [shown, applyRemoval] = useOptimistic<readonly ShownFile[], RemovalIntent>(
    served,
    (current, { before, id, removed }) => current.map((file) => (file.documentId === id ? optimisticRemoval(file, removed, before) : file)),
  );
  const [, startTransition] = useTransition();
  const active = shown.filter(inMainList);
  const removedFiles = shown.filter((file) => !inMainList(file));
  /*
   * O7 (§3.5): the group's open state does not outlive the group, so a group that empties and refills starts closed. It
   * empties when Strapi says so: a restore still waiting may be refused, and the file then returns to the open group.
   */
  if (groupOpen && served.every(inMainList)) setGroupOpen(false);
  /* D6 (G-4): the count line counts the main list as it shows, so it moves with a change still waiting for Strapi. */
  const count = total + active.length - attachments.filter(inMainList).length;
  /* IN-408: the state each file had when this view removed it, so a later Restore returns it there until Strapi answers. */
  const statesBeforeRemoval = useRef(new Map<string, AttachmentState>());

  /*
   * D1 (§3.2, §6.1, §6.2, §7.1, §12; X-10): a link to `#files` or `#file-{id}` from another page arrives before the
   * streamed page exists, and one on this page moves no focus, so the list lands on them itself, as Phase 13's
   * useHashLanding lets Notes and Assignment do: `#files` on the section's heading, `#file-{id}` on the file's row or card
   * in the layout that shows, once the browser has said which shows. A removed file's link opens the removed group first
   * and lands on its row there (WR-506).
   */
  const landing = useRef<string | null>(null);
  const [landingRequest, setLandingRequest] = useState(0);
  useHashLanding((id) => {
    if (id !== 'files' && !id.startsWith('file-')) return;
    if (removedFiles.some((file) => anchorId(file) === id)) setGroupOpen(true);
    landing.current = id;
    setLandingRequest((request) => request + 1);
  });
  useEffect(() => {
    const id = landing.current;
    if (!id || !measured) return;
    landing.current = null;
    const target = document.getElementById(id);
    if (target) landOn(target);
  }, [groupOpen, landingRequest, measured, wide]);

  /*
   * §3.5 Focus (WR-403): once the list shows the change, focus moves where the person's next action is: the file's
   * first action, else the section heading, never the page. A file still waiting for Strapi's answer has no actions yet,
   * so the intent waits for it; otherwise it is spent either way, and never pulls focus on a later, unrelated change.
   */
  useEffect(() => {
    const intent = focusIntent.current;
    if (!intent) return;
    if (intent.kind === 'file' && shown.some((file) => file.documentId === intent.id && file.pending)) return;
    focusIntent.current = null;
    const target = intent.kind === 'file' ? fileFocusTarget(container.current, intent.id, wide) : null;
    (target ?? document.getElementById('files'))?.focus();
  }, [shown, wide]);

  /*
   * D5 (§3.5; found by the 16-15 gate): both layouts of the list are in the page, and its width and files choose which
   * shows. The page's next read can change that choice after focus landed on a file's action (a file gains or loses a
   * badge, or the table gets its chance again), and the browser then drops focus from the hidden control to the page.
   * Focus follows the same action into the layout that shows. A person who moved focus away is left where they are.
   */
  const focusedAction = useRef<{ element: HTMLElement; id: string; name: string } | null>(null);
  function noteFocus(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    const actions = target.closest<HTMLElement>('[data-file-actions]');
    const id = actions?.getAttribute('data-file-actions');
    const name = target.getAttribute('aria-label');
    focusedAction.current = id && name ? { element: target, id, name } : null;
  }
  function noteBlur(event: FocusEvent<HTMLDivElement>) {
    /* Leaving a control that still shows is the person's own move; a control hidden by a change of layout is not. */
    if (focusedAction.current?.element === event.target && isShown(event.target)) focusedAction.current = null;
  }
  useLayoutEffect(() => {
    const kept = focusedAction.current;
    if (!kept || isShown(kept.element)) return;
    const active = document.activeElement;
    if (active !== kept.element && active !== document.body && active !== null) return;
    const counterpart = [...(container.current?.querySelectorAll<HTMLElement>(`[data-file-actions="${CSS.escape(kept.id)}"] [aria-label]`) ?? [])]
      .find((element) => element !== kept.element && element.getAttribute('aria-label') === kept.name && isShown(element));
    if (!counterpart) return;
    focusedAction.current = { ...kept, element: counterpart };
    counterpart.focus({ preventScroll: true });
  });

  function setDownloadingFor(id: string, on: boolean) {
    setDownloading((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /* D-23, D-24: the Server Action checks the bytes; the browser saves them. A refusal is family O in a danger toast. */
  async function download(attachment: RequestAttachment) {
    setAnnouncement('');
    setDownloadingFor(attachment.documentId, true);
    let result: DownloadAttachmentResult;
    try {
      result = await downloadAttachmentAction({ requestId, attachmentId: attachment.documentId });
    } catch {
      /* A network failure or a timeout reaching the action. */
      result = { ok: false, ...attachmentFileRefusal('download', {}) };
    }
    setDownloadingFor(attachment.documentId, false);
    if (!result.ok) {
      toast.error(downloadFailureTitle, {
        description: result.message,
        duration: Infinity,
        action: result.kind === 'retryable'
          ? toastAction(fileDownloadCopy.tryAgain, () => void download(attachment))
          : toastAction(fileDownloadCopy.refresh, () => router.refresh()),
      });
      return;
    }
    saveFile({ fileName: result.fileName, contentType: result.contentType, bytes: result.bytes });
    setAnnouncement(fileDownloadCopy.downloaded(attachment.fileName));
  }

  /**
   * Removes (`removed` true) or restores a file at once, then confirms with an Undo toast; an Undo is a second recorded
   * change that reverses the first (`undoing`). A refusal rolls the file back, focus stays, and a danger toast says why
   * with Try again or Refresh page (§3.5, §9).
   */
  function changeRemoval(file: RequestAttachment, change: FileRemovalChange) {
    const { before, removed, undoing } = change;
    startTransition(async () => {
      applyRemoval({ id: file.documentId, removed, ...(before ? { before } : {}) });
      let result: AttachmentActionResult<RequestAttachment>;
      try {
        result = await setAttachmentRemovalAction({ requestId, attachmentId: file.documentId, removed });
      } catch {
        /* A network failure or a timeout reaching the action. */
        result = { ok: false, ...attachmentFileRefusal(removed ? 'remove' : 'restore', {}) };
      }
      if (!result.ok) {
        focusIntent.current = null;
        toast.error(fileRemovalFailureTitle(change), {
          description: result.message,
          duration: Infinity,
          action: result.kind === 'retryable'
            ? toastAction(fileRemovalCopy.tryAgain, () => changeRemoval(file, change))
            : toastAction(fileRemovalCopy.refresh, () => router.refresh()),
        });
        return;
      }
      const answered = result.data;
      setServed((current) => current.map((item) => (item.documentId === answered.documentId ? answered : item)));
      if (!removed) focusIntent.current = { kind: 'file', id: answered.documentId };
      const message = fileRemovalToast(file.fileName, change);
      if (undoing) successToast(message);
      else successToast(message, { action: toastAction(fileRemovalCopy.undo, () => changeRemoval(answered, { ...change, removed: !removed, undoing: true })) });
      /* The section's count, the hub and the add facts follow from the page's next read. */
      router.refresh();
    });
  }

  /*
   * §3.5 Focus (WR-403): after Remove, the next file that renders an action, else the previous such file, else the
   * section heading. A neighbour with nothing to press (a file waiting for its malware check that this viewer can
   * neither download nor remove) is skipped.
   */
  function remove(file: RequestAttachment) {
    const index = active.findIndex((item) => item.documentId === file.documentId);
    const actionable = (item: ShownFile) => item.actions.download || item.actions.remove || hasAiActions(item);
    const neighbour = active.slice(index + 1).find(actionable) ?? active.slice(0, index).reverse().find(actionable);
    focusIntent.current = neighbour ? { kind: 'file', id: neighbour.documentId } : { kind: 'heading' };
    statesBeforeRemoval.current.set(file.documentId, file.state);
    /* Its Undo restores it to the state it had (IN-408): the Undo's change carries `before`. */
    changeRemoval(file, { removed: true, undoing: false, aiIncluded: file.ai?.included === true, before: file.state });
  }

  function restore(file: RequestAttachment) {
    const before = statesBeforeRemoval.current.get(file.documentId);
    changeRemoval(file, { removed: false, undoing: false, aiIncluded: false, ...(before ? { before } : {}) });
  }

  const downloadButton = (attachment: RequestAttachment, className?: string) => (attachment.actions.download ? (
    <DownloadButton
      attachment={attachment}
      className={className}
      downloading={downloading.has(attachment.documentId)}
      onDownload={(file) => void download(file)}
    />
  ) : null);

  /* §5.1: an AI change answers with the file as Strapi now sees it; every layout of the list shows that answer. */
  function aiChanged(answered: RequestAttachment) {
    setServed((current) => current.map((item) => (item.documentId === answered.documentId ? answered : item)));
  }

  const aiControl = (attachment: ShownFile, layout: FileAiControlLayout) => (aiPolicy && attachment.ai && !attachment.pending ? (
    <FileAiControl attachment={attachment} layout={layout} onChange={aiChanged} policy={aiPolicy} requestId={requestId} />
  ) : null);

  const hasAiActions = (attachment: RequestAttachment) => {
    const mode = fileAiControlMode(attachment, aiPolicy);
    return mode.kind === 'switch' || (mode.kind === 'facts' && mode.preview);
  };

  /* Keyed on whether a policy is served, not its object: a page refresh brings a new one, which must not remount a cell. */
  const withAi = aiPolicy !== undefined;
  const columns = useMemo(() => fileColumns(wide, withAi), [wide, withAi]);
  const handlers: FileHandlers = { downloadButton, onRemove: remove, aiControl, hasAiActions };

  return (
    <FileHandlersContext.Provider value={handlers}>
      {/* One minmax(0, 1fr) track, so the list is as wide as its section and never widens the page (§3.7). */}
      <div className="grid grid-cols-1 gap-4" onBlur={noteBlur} onFocus={noteFocus} ref={container}>
        {count > 0 ? <p className="text-xs text-foreground-secondary tabular-nums" data-files-count="">{filesCountLabel(count)}</p> : null}
        {active.length > 0 ? (
          <DataTable
            ariaLabel={filesCopy.title}
            columns={columns}
            data={active}
            densityUserId={densityUserId}
            getRowId={(attachment) => attachment.documentId}
            getRowProps={(attachment) => ({ className: pendingRowOpacity, 'data-pending': attachment.pending || undefined })}
            loadingLabel="Loading files"
            onPageChange={() => undefined}
            page={1}
            pageSize={Math.max(active.length, 1)}
            paginated={false}
            renderMobileCard={(attachment) => (
              <FileCard anchored={!wide} attachment={attachment} download={downloadButton(attachment, 'min-h-11 w-full')} onRemove={remove} />
            )}
            state="populated"
            stateSlots={{ empty: null, error: null, permission: null }}
            tableFrom={tooWide ? 'never' : tableFrom(withAi, attachments.some(showsBadge))}
            totalCount={active.length}
          />
        ) : (
          <EmptyState density="compact" headingLevel="h3" noun="files" {...(empty.kind === 'first-use' ? { kind: 'first-use' as const, description: empty.description } : { kind: 'cleared' as const })} />
        )}
        {removedFiles.length > 0 ? (
          /* §3.7 Printing: the removed group prints only when it is open; its toggle never does. */
          <div className="grid gap-3" data-print={groupOpen ? undefined : 'hidden'}>
            <Button
              aria-controls={groupId}
              aria-expanded={groupOpen}
              className="w-fit max-md:min-h-11 max-md:w-full"
              data-print="hidden"
              onClick={() => setGroupOpen((open) => !open)}
              size="sm"
              type="button"
              variant="outline"
            >
              {groupOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              {groupOpen ? fileRemovalCopy.hideRemoved : fileRemovalCopy.showRemoved(removedFiles.length)}
            </Button>
            <ul aria-label={fileRemovalCopy.removedListName} className="grid gap-2" hidden={!groupOpen} id={groupId}>
              {removedFiles.map((file) => <RemovedFile file={file} key={file.documentId} onRestore={restore} />)}
            </ul>
          </div>
        ) : null}
        {/* §3.3 (4.1.3): said once, when the browser has the file; nothing else is announced here. */}
        <p className="sr-only" role="status">{announcement}</p>
      </div>
    </FileHandlersContext.Provider>
  );
}

/**
 * §3.5: a removed file, with who added it and who removed it, and `Restore` for the person who removed it. No Download.
 * While the file is removed its row is its `#file-{id}` link target (WR-506), so a link to it lands here.
 */
function RemovedFile({ file, onRestore }: { file: ShownFile; onRestore: (file: RequestAttachment) => void }) {
  const uploader = fileUploader(file);
  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 outline-none ${pendingOpacity}`}
      data-pending={file.pending || undefined}
      id={anchorId(file)}
      tabIndex={-1}
    >
      <div className="flex min-w-0 items-start gap-2">
        <TypeIcon type={file.fileType} />
        <div className="grid min-w-0 gap-1">
          <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{file.fileName}</span>
          <span className="text-xs text-foreground-secondary tabular-nums">{fileTypeLabel(file.fileType)} · {formatFileSize(file.byteSize)}</span>
          <span className="text-xs text-foreground-secondary">{fileRemovalCopy.addedBy(uploader.name)} · <LocalInstant style="date-time" value={file.uploadedAt} /></span>
          {file.removedAt ? (
            <span className="text-xs text-foreground-secondary">
              {file.removedBy ? fileRemovalCopy.removedBy(file.removedBy.displayName) : fileRemovalCopy.removed} · <LocalInstant style="date-time" value={file.removedAt} />
            </span>
          ) : null}
        </div>
      </div>
      {file.actions.restore ? (
        <Button aria-label={fileRemovalCopy.restoreName(file.fileName)} className="max-md:min-h-11 max-md:w-full" data-print="hidden" onClick={() => onRestore(file)} size="sm" type="button" variant="outline">
          {fileRemovalCopy.restore}
        </Button>
      ) : null}
    </li>
  );
}

type FileCardProps = {
  anchored: boolean;
  attachment: ShownFile;
  /** The card's full-width Download, when the file can be downloaded. */
  download: ReactNode;
  onRemove: (file: RequestAttachment) => void;
};

/**
 * Below 768px (X-21, UI-D16): the file's facts, its state, `Download` at full width and, when the file has other
 * actions, the icon-only `More actions for {name}`, which opens a bottom sheet titled with the file's name. Focus moves
 * to the title on open and returns to `More actions` on close (§3.3).
 */
function FileCard({ anchored, attachment, download, onRemove }: FileCardProps) {
  const { name, part } = fileUploader(attachment);
  const { aiControl, hasAiActions } = useFileHandlers();
  const [open, setOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  /* A removal from the sheet moves focus itself (§3.5), so the sheet does not hand it back to More actions. */
  const removing = useRef(false);

  return (
    <div
      className={`grid gap-2 outline-none ${pendingOpacity}`}
      data-pending={attachment.pending || undefined}
      id={anchored ? anchorId(attachment) : undefined}
      tabIndex={anchored ? -1 : undefined}
    >
      <div className="grid gap-1">
        <div className="flex items-start gap-2">
          <TypeIcon type={attachment.fileType} />
          <span className="line-clamp-3 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{attachment.fileName}</span>
        </div>
        <p className="text-xs text-foreground-secondary tabular-nums">{fileTypeLabel(attachment.fileType)} · {formatFileSize(attachment.byteSize)}</p>
        <p className="text-xs text-foreground-secondary">{name} · {part} · <LocalInstant style="date-time" value={attachment.uploadedAt} /></p>
        <p className="text-xs"><NoteCell note={attachment.note} /></p>
        {aiControl(attachment, 'card')}
      </div>
      <div className="grid gap-2" data-file-actions={attachment.documentId} data-layout="card">
        <FileState attachment={attachment} />
        {download}
        {/*
          * D5 (§3.5): a file whose change waits for Strapi has nothing to press yet, so its card offers no More actions;
          * focus after a Restore then lands on the restored card's Download once Strapi answers.
          */}
        {!attachment.pending && (attachment.actions.remove || hasAiActions(attachment)) ? (
          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
              <Button aria-haspopup="dialog" aria-label={fileRemovalCopy.moreActions(attachment.fileName)} className="size-11 justify-self-end rounded-full" data-print="hidden" size="icon" type="button" variant="outline">
                <Ellipsis aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              aria-describedby={undefined}
              className={cn('gap-0 bg-surface outline-none', bottomSheetMotion)}
              onCloseAutoFocus={(event) => {
                if (!removing.current) return;
                removing.current = false;
                event.preventDefault();
              }}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                title.current?.focus();
              }}
              showCloseButton={false}
              side="bottom"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <SheetTitle asChild>
                  <h2 className="text-heading-sm text-foreground outline-none [overflow-wrap:anywhere]" ref={title} tabIndex={-1}>{attachment.fileName}</h2>
                </SheetTitle>
                <SheetClose asChild>
                  <Button aria-label={fileRemovalCopy.closeActions(attachment.fileName)} className="h-11 shrink-0" type="button" variant="outline">
                    {fileRemovalCopy.close}
                  </Button>
                </SheetClose>
              </div>
              <div className="grid gap-2 p-4">
                {/* §3.3: for analysts, the AI switch with its line and `Preview text`, at full width. */}
                {aiControl(attachment, 'sheet')}
                {attachment.actions.remove ? (
                  <Button
                    aria-label={fileRemovalCopy.removeName(attachment.fileName)}
                    className="min-h-11 w-full"
                    onClick={() => {
                      removing.current = true;
                      setOpen(false);
                      onRemove(attachment);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    {fileRemovalCopy.remove}
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </div>
  );
}
