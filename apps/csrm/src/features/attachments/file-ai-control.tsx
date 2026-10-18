'use client';

import { Loader2, ScanText } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { successToast } from '@/components/ui/success-toast';
import { Switch } from '@/components/ui/switch';
import { toastAction } from '@/components/ui/toast-action';
import { attachmentAiRefusal } from '@/lib/api/refusal-copy';
import { cn } from '@/lib/utils';

import { setAttachmentAiInputAction, type AttachmentActionResult } from './attachments-actions';
import {
  fileAiControlMode,
  fileAiCopy,
  fileAiFactsLine,
  fileAiToast,
  type FileAi,
  type FileAiPolicy,
  type RequestAttachment,
} from './attachments-domain';

/*
 * The analyst's AI control on a file (14-UI-SPEC §5.1, §9; D-30, D-33; UI-D18 to UI-D20; X-18, X-22): the switch
 * labelled `Changes the AI inputs` (X-18's label, from `fileAiCopy`), then the facts line (`Not included`,
 * `Included · all {m} characters` or `Included · first {n} of {m} characters`) and `Preview text`. The switch is
 * described by the file's name and the facts line, so its state is heard with what is sent (O9).
 *
 * - Turning it on waits for the server, which reads the file's text and may fail (UI-D19): the switch shows on at the
 *   pending opacity with `Reading the file’s text…` until Strapi answers.
 * - Turning it off applies at once and rolls back on failure.
 * - While a change is in flight the switch takes no input: it says so (`aria-disabled`) and keeps focus, so a second
 *   press never queues a contradictory change, and an off-only switch never sends an inclusion (WR-404).
 * - Each change confirms with an X-14 Undo toast; a refusal is family P in a danger toast. Nothing asks first (D-29).
 *
 * The list loads this module on demand (next/dynamic), so the Requestor's page never downloads it: she is served no
 * file's AI facts and no AI policy, and Strapi refuses her the change anyway (D-28; T-14-55). The switch renders only
 * where Strapi's facts allow it (`fileAiControlMode`); its absence is never the refusal.
 */

/* §5.3 (D-31): the text preview's code loads the first time an analyst asks for it, never with the page. */
const FileTextSheet = dynamic(() => import('./file-text-sheet').then((module) => module.FileTextSheet), { ssr: false });

export type FileAiControlLayout = 'cell' | 'card' | 'sheet';

export type FileAiControlProps = {
  requestId: string;
  attachment: RequestAttachment;
  /** The section's AI policy, which the list carries for a Security Analyst only. */
  policy: FileAiPolicy;
  /** `cell`: the table's `AI inputs` cell; `card`: the phone card's line; `sheet`: the phone actions sheet (§3.2, §3.3). */
  layout: FileAiControlLayout;
  /** The file as Strapi answered a change, so every layout of the list shows it. */
  onChange?: (answered: RequestAttachment) => void;
};

type Failure = Extract<AttachmentActionResult<RequestAttachment>, { ok: false }>;

/** §5 Motion: the pending opacity applies at once; leaving it eases back at --duration-base, as a rollback does. */
const pendingOpacity = 'transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none';

export function FileAiControl({ attachment, layout, onChange, policy, requestId }: FileAiControlProps) {
  const router = useRouter();
  const baseId = useId();
  const switchId = `${baseId}-ai-input`;
  const nameId = `${baseId}-file-name`;
  const factsId = `${baseId}-facts`;
  const control = useRef<HTMLButtonElement>(null);
  const factsLine = useRef<HTMLParagraphElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const focusFacts = useRef(false);
  /* Whether the preview was ever asked for: only then does its code load (§5.3). */
  const [previewWanted, setPreviewWanted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const ai = attachment.ai;

  /* What Strapi last served: the list's file, then each change's answer, until the list renders the file again. */
  const [served, setServed] = useState<FileAi | undefined>(ai);
  const [read, setRead] = useState(ai);
  if (ai !== read) {
    setRead(ai);
    setServed(ai);
  }
  const [shown, show] = useOptimistic(served?.included ?? false, (_current, next: boolean) => next);
  const [pending, startTransition] = useTransition();
  /* Set as a change starts and cleared as it ends, so a press, or a toast's Undo, before the next render is refused too. */
  const inFlight = useRef(false);
  const mode = fileAiControlMode({ state: attachment.state, ai: served }, policy);

  /* Under a refusing policy an excluded file loses its switch; focus stays on its facts line, which says so. */
  useEffect(() => {
    if (!focusFacts.current || mode.kind !== 'facts') return;
    focusFacts.current = false;
    factsLine.current?.focus();
  }, [mode.kind]);

  if (mode.kind === 'none' || !served) return null;
  const name = attachment.fileName;

  if (layout === 'card') {
    const line = mode.kind === 'unavailable' ? mode.line : fileAiFactsLine(served);
    return <p className="text-xs text-foreground-secondary [overflow-wrap:anywhere]">{fileAiCopy.cardLine(line)}</p>;
  }

  if (mode.kind === 'unavailable') {
    return <p className={cn('text-xs text-foreground-secondary [overflow-wrap:anywhere]', layout === 'cell' && 'py-2')}>{mode.line}</p>;
  }

  const keepFocus = () => control.current?.focus();

  /* §9: the switch has already rolled back; a danger toast says why, with Try again or Refresh page. */
  function refused(failure: Failure, undoing: boolean, retry: () => void) {
    toast.error(undoing ? fileAiCopy.undoFailed : fileAiCopy.failed, {
      description: failure.message,
      duration: Infinity,
      action: failure.kind === 'retryable' ? toastAction(fileAiCopy.tryAgain, retry) : toastAction(fileAiCopy.refresh, () => router.refresh()),
    });
  }

  /**
   * Includes (`next` true) or excludes the file; an Undo is a second recorded change that reverses the first. Nothing is
   * sent while another change is in flight, and an off-only switch never includes (WR-404; D-30).
   */
  function change(next: boolean, undoing: boolean, offOnly: boolean) {
    keepFocus();
    if (inFlight.current || (offOnly && next)) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        await send(next, undoing, offOnly);
      } finally {
        inFlight.current = false;
      }
    });
  }

  async function send(next: boolean, undoing: boolean, offOnly: boolean) {
    show(next);
    let result: AttachmentActionResult<RequestAttachment>;
    try {
      result = await setAttachmentAiInputAction({
        requestId,
        attachmentId: attachment.documentId,
        included: next,
        classification: policy.classification,
        ceiling: policy.ceiling,
      });
    } catch {
      /* A network failure or a timeout reaching the action. */
      result = { ok: false, ...attachmentAiRefusal({}) };
    }
    if (!result.ok) {
      refused(result, undoing, () => change(next, undoing, offOnly));
      keepFocus();
      return;
    }
    const answered = result.data;
    setServed(answered.ai ?? { ...served!, included: next });
    onChange?.(answered);
    const message = fileAiToast(name, { included: next, undoing });
    /* Under a refusing policy the file could not be included again, so its exclusion offers no Undo (D-30). */
    if (undoing || offOnly) successToast(message);
    else successToast(message, { action: toastAction(fileAiCopy.undo, () => change(!next, true, offOnly)) });
    if (offOnly && !next) focusFacts.current = true;
    else keepFocus();
    /* The hub's "AI inputs changed" signal follows from the page's next read. */
    router.refresh();
  }

  const sheet = layout === 'sheet';
  const reading = pending && shown;
  const line = reading ? null : shown ? fileAiFactsLine(served) : fileAiCopy.notIncluded;
  const switchControl = mode.kind === 'switch' ? (
    <Switch
      aria-describedby={`${nameId} ${factsId}`}
      aria-disabled={pending || undefined}
      checked={shown}
      id={switchId}
      onCheckedChange={(next) => change(next, false, mode.offOnly)}
      ref={control}
    />
  ) : null;

  return (
    <div className={cn('grid min-w-0 justify-items-start gap-1', !sheet && 'py-2')}>
      <span hidden id={nameId}>{name}</span>
      {mode.kind === 'switch' && sheet ? (
        /*
         * §3.3 (WR-405, D4): in the phone actions sheet the whole row is the switch's label, at full width and the
         * touch-target height, so pressing anywhere on it toggles the switch, which keeps its role, name and state.
         */
        <Label
          className={cn('min-h-11 w-full text-sm text-foreground', pendingOpacity)}
          data-pending={pending}
          data-print="hidden"
          htmlFor={switchId}
        >
          {switchControl}
          {fileAiCopy.label}
        </Label>
      ) : mode.kind === 'switch' ? (
        <div className={cn('flex min-h-6 w-fit items-center gap-2', pendingOpacity)} data-pending={pending} data-print="hidden">
          {switchControl}
          <Label className="text-sm text-foreground" htmlFor={switchId}>{fileAiCopy.label}</Label>
        </div>
      ) : null}
      {reading ? (
        <p className="flex items-center gap-1 text-xs text-foreground-secondary" id={factsId}>
          {/* UI-05 (X-22; direction §5 Optimistic UI): the 16px inline spinner, static under reduced motion. */}
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {fileAiCopy.reading}
        </p>
      ) : (
        <p
          className="text-xs text-foreground-secondary outline-none [overflow-wrap:anywhere]"
          id={factsId}
          ref={factsLine}
          tabIndex={mode.kind === 'facts' ? -1 : undefined}
        >
          {line}
        </p>
      )}
      {mode.preview && shown && !pending ? (
        <Button
          aria-haspopup="dialog"
          aria-label={fileAiCopy.previewTextName(name)}
          className={cn(sheet && 'min-h-11 w-full')}
          data-print="hidden"
          onClick={() => {
            setPreviewWanted(true);
            setPreviewOpen(true);
          }}
          ref={previewButton}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ScanText aria-hidden="true" />
          {fileAiCopy.previewText}
        </Button>
      ) : null}
      {previewWanted ? (
        <FileTextSheet
          attachmentId={attachment.documentId}
          factsLine={fileAiFactsLine(served)}
          fileName={name}
          onOpenChange={setPreviewOpen}
          open={previewOpen}
          requestId={requestId}
          returnFocusTo={previewButton}
        />
      ) : null}
    </div>
  );
}
