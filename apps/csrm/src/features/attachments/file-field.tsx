'use client';

import { Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent, type Ref, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ATTACHMENT_ACCEPT, filesCopy } from './attachments-domain';

/*
 * The file field (X-19; 14-UI-SPEC §1.1). A labelled, visually hidden `input type="file" multiple` that `Choose files`
 * opens: the button is always the primary path and dragging is never required (2.5.7). The region's dashed boundary is
 * the drop target's only cue; while files are dragged over it the boundary turns solid ink on the hover fill, at the
 * control-state timing. The region is not a tab stop. Below 768px the drag line is not shown and `Choose files` is full
 * width at the touch-target height. The hint names the allowed types and the limits, and describes the input and the
 * button. While the field is on the page, files dropped anywhere else are ignored, so the browser never opens one and
 * leaves the page (UI-D30).
 */

export type FileFieldProps = {
  /** `Add files` on a draft; `Add files with a note` after submission (§4.1). */
  label: string;
  /** §1.1's hint: the allowed types, the size limit and how many more files can be added. */
  hint: string;
  /** §3.6: a line before the hint, `Files are added with a note, …` after submission; it describes the field too. */
  lead?: string;
  /** The files chosen or dropped, in order; the caller checks and queues them. */
  onFiles: (files: File[]) => void;
  /** `Choose files`, for focus after the last row leaves the queue (§1.4). */
  buttonRef?: Ref<HTMLButtonElement>;
  /** While the form holding the field saves, it takes no files: not by the button, the input or a drop (WR-504). */
  disabled?: boolean;
};

type DragLike = Pick<globalThis.DragEvent, 'dataTransfer'>;

/** Whether a drag carries files, as opposed to text or a link dragged within the page. */
export function carriesFiles(event: DragLike): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/** Whether a drag is over a drop target: this field's region, or any other on the page (the Notes composer, §4.1). */
function overDropTarget(target: EventTarget | null, region: HTMLElement | null): boolean {
  if (!(target instanceof Node)) return false;
  if (region?.contains(target)) return true;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest('[data-file-drop]'));
}

/**
 * UI-D30: while a file field is mounted, a file dragged or dropped outside every drop target is refused, so the browser
 * neither offers to open it nor leaves the page. The listeners go with the field.
 */
export function usePageFileDropGuard(region: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active) return undefined;
    const refuse = (event: globalThis.DragEvent) => {
      if (!carriesFiles(event)) return;
      if (overDropTarget(event.target, region.current)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', refuse);
    window.addEventListener('drop', refuse);
    return () => {
      window.removeEventListener('dragover', refuse);
      window.removeEventListener('drop', refuse);
    };
  }, [active, region]);
}

export function FileField({ buttonRef, disabled = false, hint, label, lead, onFiles }: FileFieldProps) {
  const inputId = useId();
  const leadId = `${inputId}-lead`;
  const hintId = `${inputId}-hint`;
  const describedBy = lead ? `${leadId} ${hintId}` : hintId;
  const input = useRef<HTMLInputElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  usePageFileDropGuard(region);

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    /* The same file can be chosen again once it has been handled. */
    event.currentTarget.value = '';
    if (files.length > 0) onFiles(files);
  }

  function over(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    /* Disabled, the region still refuses the drop, so the browser never opens the file in its place (UI-D30). */
    if (event.dataTransfer) event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    if (!disabled) setDragging(true);
  }

  function left(event: DragEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  }

  function dropped(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className="grid gap-2" data-print="hidden">
      <label className="text-sm font-medium text-foreground" htmlFor={inputId}>{label}</label>
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-4 text-sm transition-colors duration-(--duration-micro) ease-standard md:flex-row md:justify-center md:p-6',
          dragging && 'border-solid border-foreground bg-surface-hover',
        )}
        data-drag-active={dragging ? 'true' : 'false'}
        data-file-drop=""
        onDragEnter={over}
        onDragLeave={left}
        onDragOver={over}
        onDrop={dropped}
        ref={region}
      >
        <Upload aria-hidden="true" className="size-4 shrink-0 text-foreground-secondary" />
        <span className="hidden text-foreground md:inline">{filesCopy.dragHere}</span>
        <Button aria-describedby={describedBy} className="max-md:min-h-11 max-md:w-full" disabled={disabled} onClick={() => input.current?.click()} ref={buttonRef} size="sm" type="button" variant="outline">
          {filesCopy.chooseFiles}
        </Button>
        <input accept={ATTACHMENT_ACCEPT} aria-describedby={describedBy} className="sr-only" disabled={disabled} id={inputId} multiple onChange={chosen} ref={input} tabIndex={-1} type="file" />
      </div>
      {lead ? <p className="text-xs text-foreground-secondary" id={leadId}>{lead}</p> : null}
      <p className="text-xs text-foreground-secondary tabular-nums" id={hintId}>{hint}</p>
    </div>
  );
}
