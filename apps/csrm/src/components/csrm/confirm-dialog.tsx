'use client';

import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type ConfirmDialogProps = {
  cancelLabel?: string;
  /** Usually a sentence; a node when part of it needs its own treatment, such as a count in tabular figures. */
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant: ComponentProps<typeof Button>['variant'];
  errorMessage?: string | null;
  onBeforeOpen?: () => boolean | Promise<boolean>;
  onDismiss?: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  reasonRequired?: boolean;
  title: string;
  /** The control that opens the dialog. Omit it, and pass `open`, for a dialog its owner opens (controlled mode). */
  trigger?: ReactNode;
  /**
   * Controlled mode: the owner decides whether the dialog is open. Dismissing (the dismiss control or
   * `Escape`) calls `onOpenChange(false)`; after a successful confirm the owner closes it from `onConfirm`.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ConfirmDialog({ cancelLabel = 'Cancel', confirmLabel, confirmVariant, description, errorMessage, onBeforeOpen, onConfirm, onDismiss, onOpenChange, open: controlledOpen, pendingLabel, reasonRequired = false, title, trigger }: ConfirmDialogProps) {
  const controlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  /*
   * The confirm button stays disabled while the reason is unusable, but the
   * field itself is only reported invalid once the person has typed in it or
   * left it. Marking an untouched field invalid paints an error state on a
   * dialog that has just opened and announces a problem nobody has made yet.
   */
  const reasonUnusable = reasonRequired && (reason.trim().length === 0 || reason.trim().length > 500);
  const reasonError = reasonUnusable && reasonTouched;
  const reasonHintId = 'confirm-dialog-reason-hint';
  /* An owner-opened dialog starts with an empty reason too, as a trigger-opened one does. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && controlled) {
      setReason('');
      setReasonTouched(false);
    }
  }

  async function handleOpenChange(nextOpen: boolean) {
    if (!pendingRef.current) {
      if (nextOpen && onBeforeOpen && !(await onBeforeOpen())) return;
      setOpen(nextOpen);
      if (nextOpen) {
        setReason('');
        setReasonTouched(false);
      }
      if (!nextOpen) onDismiss?.();
    }
  }

  async function handleConfirm() {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setPending(true);

    try {
      await onConfirm(reason.trim());
      if (!controlled) setUncontrolledOpen(false);
    } catch {
      // The caller owns normalized persistent/toast error feedback; keep the dialog open for retry.
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="w-[min(480px,calc(100vw-32px))] max-w-none">
        <AlertDialogHeader className="w-full">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {reasonRequired ? <div className="grid w-full gap-2"><label className="text-sm font-medium" htmlFor="confirm-dialog-reason">Reason</label><Textarea aria-describedby={reasonHintId} aria-invalid={reasonError} id="confirm-dialog-reason" maxLength={501} onBlur={() => setReasonTouched(true)} onChange={(event) => { setReasonTouched(true); setReason(event.target.value); }} value={reason} /><p className="text-sm text-muted-foreground" id={reasonHintId}>{reasonError ? 'Enter a reason of up to 500 characters.' : `${reason.trim().length}/500 characters`}</p></div> : null}
          {errorMessage ? <p className="text-sm text-destructive" role="alert">{errorMessage}</p> : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="w-full">
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button disabled={pending || reasonUnusable} onClick={handleConfirm} type="button" variant={confirmVariant}>
            {pending ? (
              <>
                <Loader2Icon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
