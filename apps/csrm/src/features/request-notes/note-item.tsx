'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { Button } from '@/components/ui/button';
import { AttachmentStatusBadge } from '@/features/attachments/attachment-status-badge';
import type { RequestAttachment } from '@/features/attachments/attachments-domain';
import { FileChip, FileChipDownload } from '@/features/attachments/file-chip';
import { useQueueRows } from '@/features/attachments/file-store';
import { UploadQueue, WaitingRows } from '@/features/attachments/upload-queue';
import { cn } from '@/lib/utils';

import { NoteAiInputSwitch } from './note-ai-input-switch';
import { aiMarkCopy, noteFilesCopy, noteHeader, notesCopy, type RequestNote } from './notes-domain';
import { UnreadDot } from './unread-marker';

/*
 * One note in the thread (13-UI-SPEC §8.2; X-16). The body is React text only: never HTML or Markdown, never
 * auto-linked (T-13-34). No control edits or removes a note (D-21). A body beyond ten lines clamps with
 * `Show full note`; the whole text stays in the DOM and prints whole.
 *
 * The AI-input mark (§10.1; X-18; D-26, D-07): a Security Analyst Strapi lets mark (`canMarkAiInputs`) gets the switch
 * under the body; one who may not (a requesting analyst) sees the X-11 note on a marked note; the Requestor, whose notes
 * carry no `changesAiInputs`, sees neither.
 *
 * Files with the note (14-UI-SPEC §4.2; D-17; X-21): under the body, `Files with this note` lists the files the note
 * brought as chips, each name a record link to its row in the Files section (a removed file has left that list, so its
 * name is plain), with an icon-only `Download {name}` or, for a file nobody can download, its badge. While the note is
 * being added its files wait beneath it at `Waiting`; once Strapi has recorded it, its queue sends them with its id, one
 * at a time, and a file not added keeps its row with its reason and actions, `Add with a new note` included once the
 * note can no longer take files (UI-D9).
 */

export type NoteItemProps = {
  note: RequestNote;
  /** Whether the note was new to the viewer when this view first showed it (D-24): it stays for the view. */
  unread: boolean;
  /** Being added: `Adding…` in place of its time, at the §5 pending opacity (§9.1). */
  pending?: boolean;
  /** A failed add leaving the thread with the `--duration-base` opacity transition (§9.1 rollback). */
  leaving?: boolean;
  /** The request the note belongs to, which the AI-input switch names. */
  requestId?: string;
  /** Strapi's `canMarkAiInputs` for the viewer: a human Security Analyst who did not raise the request. */
  canMarkAiInputs?: boolean;
  /** The files the page's list says came with this note (§4.2). */
  files?: readonly RequestAttachment[];
  /** The files of a note being added, shown at `Waiting` until Strapi records the note (§4.2 step 1). */
  pendingFiles?: readonly File[];
  /** The note's own queue in the tab's file store: who is keyed, the request's room, and whether it was just posted. */
  fileQueue?: NoteFileQueueProps | null;
};

type NoteFileQueueProps = { ownerKey: string; remaining: number; fresh: boolean };

/** §4.2: the note's files still on their way, or kept for the tab after one was not added; nothing once all are listed. */
function NoteFileQueue({ fresh, noteId, ownerKey, remaining, requestId }: NoteFileQueueProps & { noteId: string; requestId: string }) {
  const scope = `note:${noteId}` as const;
  const rows = useQueueRows(ownerKey, requestId, scope);
  if (!fresh && rows.length === 0) return null;
  return <UploadQueue field={false} fresh={fresh} ownerKey={ownerKey} remaining={remaining} requestId={requestId} scope={scope} />;
}

/**
 * One settled file under its note (X-21): its row's link, and `Download` or the file's badge, which takes its own line
 * below 768px so the name keeps the chip's width (14-UI-REVIEW UI-01).
 */
function NoteFile({ file, requestId }: { file: RequestAttachment; requestId: string | undefined }) {
  const href = file.state === 'removed' ? undefined : `#file-${encodeURIComponent(file.documentId)}`;
  const downloadFor = file.actions.download ? requestId : undefined;
  const badge = !downloadFor && file.state !== 'available' ? <AttachmentStatusBadge value={file.state} /> : null;
  return (
    <FileChip name={file.fileName} size={file.byteSize} type={file.fileType} {...(href ? { href } : {})} {...(badge ? { badge } : {})}>
      {downloadFor ? <FileChipDownload attachment={file} requestId={downloadFor} /> : null}
    </FileChip>
  );
}

/** Whether the clamped body hides some of its text, measured after layout and again when its box changes. */
function useClampOverflow(body: string, expanded: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = ref.current;
    /* Expanded, the clamp is off and nothing overflows: the toggle stays so the note can be clamped again. */
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [body, expanded]);
  return { ref, overflows };
}

export function NoteItem({ canMarkAiInputs = false, fileQueue = null, files = [], note, unread, pending = false, pendingFiles = [], leaving = false, requestId }: NoteItemProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const headerId = `${id}-header`;
  const bodyId = `${id}-body`;
  const { name, part } = noteHeader(note);
  const [expanded, setExpanded] = useState(false);
  const { ref, overflows } = useClampOverflow(note.body, expanded);
  return (
    <li
      className="border-t border-border py-4 first:border-t-0 transition-opacity duration-(--duration-base) ease-standard data-[leaving=true]:opacity-0 data-[pending=true]:opacity-60 data-[pending=true]:transition-none"
      data-leaving={leaving}
      data-pending={pending && !leaving}
    >
      <article aria-labelledby={nameId} className="grid min-w-0 scroll-mt-24 gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" id={`note-${note.documentId}`} tabIndex={-1}>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1" id={headerId}>
          <span className="text-sm font-medium text-foreground break-words" id={nameId}>{name}</span>
          <span className="text-xs text-foreground-secondary">
            {part} · {pending ? <span>{notesCopy.adding}</span> : <LocalInstant style="date-time" value={note.postedAt} />}
          </span>
          {unread && !pending ? <UnreadDot /> : null}
        </p>
        <p
          className={cn('text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere] print:line-clamp-none', !expanded && 'line-clamp-10')}
          data-note-body=""
          id={bodyId}
          ref={ref}
        >
          {note.body}
        </p>
        {overflows || expanded ? (
          <Button aria-controls={bodyId} aria-expanded={expanded} className="w-fit" data-print="hidden" onClick={() => setExpanded((open) => !open)} size="sm" type="button" variant="ghost">
            {expanded ? notesCopy.showLess : notesCopy.showFull}
          </Button>
        ) : null}
        {files.length > 0 ? (
          /* §4.2 (X-21): chips wrap in rows from 768px and stack at full width below. */
          <ul aria-label={noteFilesCopy.noteFilesName} className="grid gap-2 pt-1 md:flex md:flex-wrap" data-note-files="">
            {files.map((file) => <li className="min-w-0" key={file.documentId}><NoteFile file={file} requestId={requestId} /></li>)}
          </ul>
        ) : null}
        {pending ? <WaitingRows files={pendingFiles} /> : null}
        {!pending && fileQueue && requestId ? <NoteFileQueue {...fileQueue} noteId={note.documentId} requestId={requestId} /> : null}
        {!pending && canMarkAiInputs && requestId ? (
          <NoteAiInputSwitch describedBy={headerId} note={note} requestId={requestId} />
        ) : !pending && note.changesAiInputs ? (
          /* X-11 provenance note: a 12px icon and caption text, no fill or border. */
          <p className="flex items-center gap-1 text-xs text-foreground-secondary" data-ai-input-note="">
            <Sparkles aria-hidden="true" className="size-3 shrink-0" />
            {aiMarkCopy.label}
          </p>
        ) : null}
      </article>
    </li>
  );
}
