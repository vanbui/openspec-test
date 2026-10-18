'use client';

import { useRouter } from 'next/navigation';
import { useId, useOptimistic, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { successToast } from '@/components/ui/success-toast';
import { Switch } from '@/components/ui/switch';
import { toastAction } from '@/components/ui/toast-action';
import { noteAiInputRefusal } from '@/lib/api/refusal-copy';

import { setNoteAiInputAction, type NoteActionResult } from './notes-actions';
import { aiMarkCopy, aiMarkToast, aiMarkUndoToast, type RequestNote } from './notes-domain';

/*
 * The X-18 switch under a note (13-UI-SPEC §10.1, §10.4; D-26): a Security Analyst who did not raise the request
 * chooses whether the note changes what CSRM sends to the AI. It applies at once at the pending opacity, confirms with
 * an X-14 Undo toast and rolls back with family M's copy; nothing asks for confirmation (D-34). Focus stays on the
 * switch throughout. Rendered only when Strapi serves `canMarkAiInputs`, and Strapi refuses the mark for anyone else:
 * the switch's absence is never the refusal.
 */

export type NoteAiInputSwitchProps = {
  requestId: string;
  note: RequestNote;
  /** The id of the note's header line, which describes the switch (§10.1). */
  describedBy: string;
};

type Failure = Extract<NoteActionResult<RequestNote>, { ok: false }>;

export function NoteAiInputSwitch({ describedBy, note, requestId }: NoteAiInputSwitchProps) {
  const router = useRouter();
  const switchId = `${useId()}-ai-input`;
  const control = useRef<HTMLButtonElement>(null);
  const marked = Boolean(note.changesAiInputs);
  /* What Strapi last served: the page's note, then each change's answer, until the page renders the note again. */
  const [served, setServed] = useState(marked);
  const [read, setRead] = useState(marked);
  if (marked !== read) {
    setRead(marked);
    setServed(marked);
  }
  const [shown, show] = useOptimistic(served, (_current, next: boolean) => next);
  const [pending, startTransition] = useTransition();

  const keepFocus = () => control.current?.focus();

  /* §10.4: the switch has already rolled back; a danger toast says why, with Try again or Refresh page. */
  function refused(failure: Failure, retry: () => void) {
    toast.error(aiMarkCopy.failed, {
      description: failure.message,
      duration: Infinity,
      action: failure.kind === 'retryable' ? toastAction(aiMarkCopy.tryAgain, retry) : toastAction(aiMarkCopy.refresh, () => router.refresh()),
    });
  }

  /** Sets the mark to `next`; an Undo is a second recorded change that reverses the first (`undoing`). */
  function change(next: boolean, undoing: boolean) {
    keepFocus();
    startTransition(async () => {
      show(next);
      let result: NoteActionResult<RequestNote>;
      try {
        result = await setNoteAiInputAction({ requestId, noteId: note.documentId, changesAiInputs: next });
      } catch {
        /* A network failure or a timeout reaching the action. */
        result = { ok: false, ...noteAiInputRefusal() };
      }
      if (!result.ok) {
        refused(result, () => change(next, undoing));
        keepFocus();
        return;
      }
      setServed(result.data.changesAiInputs ?? next);
      if (undoing) successToast(aiMarkUndoToast(!next));
      else successToast(aiMarkToast(next), { action: toastAction(aiMarkCopy.undo, () => change(!next, true)) });
      keepFocus();
    });
  }

  return (
    /* §5 Motion: the pending opacity applies at once; leaving it eases back at --duration-base, as a rollback does. */
    <div
      className="flex w-fit items-center gap-2 transition-opacity duration-(--duration-base) ease-standard max-md:min-h-11 data-[pending=true]:opacity-60 data-[pending=true]:transition-none"
      data-pending={pending}
      data-print="hidden"
    >
      <Switch
        aria-describedby={describedBy}
        checked={shown}
        id={switchId}
        onCheckedChange={(next) => change(next, false)}
        ref={control}
      />
      <Label className="text-sm text-foreground" htmlFor={switchId}>{aiMarkCopy.label}</Label>
    </div>
  );
}
