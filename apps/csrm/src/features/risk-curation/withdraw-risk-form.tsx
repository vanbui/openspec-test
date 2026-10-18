'use client';

import { AlertCircle } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { readSessionDraft, writeSessionDraft, type SessionDraftKind } from '@/lib/session-drafts/session-drafts';

import { CURATION_REASON_MAX_LENGTH, curationFormId, curationReasonError, type CurationAct } from './risk-curation-domain';

/*
 * The withdraw and reinstate form (16-UI-SPEC §6.1, §6.2; X-27; D-09 to D-11, D-47, UI-D8). From 768px an X-5 well under
 * the card header; below 768px a bottom sheet with a title row and Close. The reason is required and kept to 500
 * characters, said on submit; `Enter` in the field submits and `Escape` keeps the record as it is. The typed reason is
 * kept for the browser session per person and Risk, restored with a caption and guarded on unload, and a refusal reopens
 * the form with it (the hook clears it once the act is recorded). While the Risk's own form holds unsaved changes, one
 * line replaces the field, because a withdrawn Risk could not save them (UI-D8). Nothing here is styled destructive:
 * withdrawing is reversible and never a deletion.
 */
export type WithdrawRiskFormProps = {
  mode: CurationAct;
  riskId: string;
  riskNumber: string;
  /** The Risk's open AI changes that withdrawing closes; null for the requesting analyst, whose view serves no count. */
  openChanges: number | null;
  /** Whether the Risk's form holds unsaved changes (withdraw only). */
  hasUnsavedChanges?: boolean;
  /** The session draft owner key (draft-owner-key.ts); null keeps nothing. */
  draftOwnerKey: string | null;
  /** The reason a refused act reopens the form with. */
  initialReason?: string;
  /** §13 R1's line for a refused act, shown under the field. */
  error?: string | null;
  onSubmit: (reason: string) => void;
  /** Keep risk or Keep withdrawn, Escape, or Close. */
  onKeep: () => void;
  /** The control that opened the form, which takes focus back when it is kept. */
  returnFocusTo?: HTMLElement | null;
};

const RESTORED = 'Restored from earlier in this session.';
const UNSAVED = 'This risk has unsaved changes. Save or discard them before you withdraw it.';

const formatCount = (count: number): string => count.toLocaleString('en-AU');

/* §6.1 and §6.2: the form's words for each act. */
function formCopy(mode: CurationAct, riskNumber: string, openChanges: number | null) {
  if (mode === 'reinstate') {
    return {
      title: `Reinstate ${riskNumber}`,
      description: 'The risk returns to this assessment, its counts and release readiness, and can be edited again.',
      label: 'Reason for reinstating',
      hint: 'Kept in the risk’s history.',
      submit: 'Reinstate risk',
      keep: 'Keep withdrawn',
      draft: 'risk-reinstate-reason' as SessionDraftKind,
    };
  }
  const closes = openChanges === null
    ? ' Any open AI changes on it will close without a decision.'
    : openChanges > 0 ? ` Its ${formatCount(openChanges)} open AI ${openChanges === 1 ? 'change' : 'changes'} will close without a decision.` : '';
  return {
    title: `Withdraw ${riskNumber}`,
    description: `A withdrawn risk leaves this assessment, its counts and release readiness. It keeps its details and history, and you can reinstate it while the assessment is being edited.${closes}`,
    label: 'Reason for withdrawing',
    hint: 'Kept in the risk’s history. The AI reads it, so it doesn’t propose this risk again.',
    submit: 'Withdraw risk',
    keep: 'Keep risk',
    draft: 'risk-withdraw-reason' as SessionDraftKind,
  };
}

const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
/* Without matchMedia (a test environment) the form is the in-place well. */
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

/*
 * The opener, or the control that replaced it: a refused act moves the card and back, so its controls are rendered
 * anew, and the opener is found again by its name (FE3-03).
 */
function sameControl(opener: HTMLElement): HTMLElement | null {
  if (opener.isConnected) return opener;
  const name = opener.getAttribute('aria-label');
  return name ? [...document.querySelectorAll<HTMLElement>('button[aria-label]')].find((control) => control.getAttribute('aria-label') === name) ?? null : null;
}

export function WithdrawRiskForm({ draftOwnerKey, error = null, hasUnsavedChanges = false, initialReason, mode, onKeep, onSubmit, openChanges, returnFocusTo = null, riskId, riskNumber }: WithdrawRiskFormProps) {
  const phone = useIsPhone();
  const id = useId();
  const copy = formCopy(mode, riskNumber, openChanges);
  const blocked = mode === 'withdraw' && hasUnsavedChanges;
  const [reason, setReason] = useState(initialReason ?? '');
  const [restored, setRestored] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const ids = { title: `${id}-title`, description: `${id}-description`, hint: `${id}-hint`, count: `${id}-count`, error: `${id}-error`, restored: `${id}-restored` };
  const shownError = fieldError ?? error;

  /*
   * §6.1: restore the session's reason once, when the field first shows empty (on opening, or once unsaved changes no
   * longer hold it back, FE3-10); a refusal reopens the form with the reason it held.
   */
  const restoreChecked = useRef(false);
  useEffect(() => {
    if (blocked || restoreChecked.current) return;
    // Only once: a later empty value is the analyst's own.
    restoreChecked.current = true;
    if (initialReason !== undefined || !draftOwnerKey) return;
    const kept = readSessionDraft(copy.draft, draftOwnerKey, riskId);
    if (kept) {
      setReason(kept);
      setRestored(true);
    }
  }, [blocked]);

  /*
   * Focus goes to the field when the form opens, or to Keep risk when unsaved changes leave no field. Unsaved changes
   * coming or going later move no focus (FE3-02, WCAG 3.2.2): the analyst is typing or saving in the Risk form then.
   */
  const focusFirst = () => (blocked ? keepButton.current : field.current)?.focus();
  useEffect(() => {
    if (phone) return undefined;
    focusFirst();
    /* Again after the frame, so a reopened form takes focus back from the card move its refused act scheduled. */
    const frame = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(frame);
  }, [phone]);
  /* Only when the swap removed the control that held focus, so focus fell to the page. */
  useEffect(() => {
    if (!phone && (document.activeElement === null || document.activeElement === document.body)) focusFirst();
  }, [blocked]);

  useUnloadWarning(!blocked && reason.trim().length > 0);

  function change(next: string) {
    setReason(next);
    if (draftOwnerKey) writeSessionDraft(copy.draft, draftOwnerKey, riskId, next);
  }

  function keep() {
    onKeep();
    const target = returnFocusTo;
    if (target) requestAnimationFrame(() => sameControl(target)?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    const problem = curationReasonError(mode, reason);
    setFieldError(problem);
    if (problem) {
      field.current?.focus();
      return;
    }
    onSubmit(reason.trim());
  }

  function keyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Escape' || phone) return;
    event.preventDefault();
    event.stopPropagation();
    keep();
  }

  const Title = phone ? 'h2' : 'h4';
  const actionClass = phone ? 'min-h-11 w-full' : undefined;
  const body = (
    <form aria-describedby={ids.description} aria-labelledby={ids.title} id={curationFormId(mode, riskId)} className={phone ? 'grid gap-4' : 'grid w-full gap-4 rounded-lg border border-border bg-surface-muted p-4'} data-print="hidden" noValidate onKeyDown={keyDown} onSubmit={submit}>
      <div className="grid w-full max-w-[640px] gap-4">
        {phone ? null : <Title className="text-heading-sm text-foreground" id={ids.title}>{copy.title}</Title>}
        <p className="text-sm text-foreground-secondary" id={ids.description}>{copy.description}</p>
        {blocked ? <p className="text-sm text-foreground">{UNSAVED}</p> : (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-reason`}>{copy.label}</Label>
            <Input
              aria-describedby={[ids.hint, reason ? ids.count : null, restored && reason ? ids.restored : null, shownError ? ids.error : null].filter(Boolean).join(' ')}
              aria-invalid={shownError ? true : undefined}
              className="bg-surface"
              id={`${id}-reason`}
              onChange={(event) => change(event.target.value)}
              ref={field}
              required
              value={reason}
            />
            <p className="text-xs text-foreground-secondary" id={ids.hint}>{copy.hint}</p>
            {reason ? <p className="text-xs tabular-nums text-foreground-secondary" id={ids.count}>{`${formatCount(reason.trim().length)} of ${formatCount(CURATION_REASON_MAX_LENGTH)} characters`}</p> : null}
            {restored && reason ? <p className="text-xs text-foreground-secondary" id={ids.restored}>{RESTORED}</p> : null}
            {shownError ? <p className="flex items-start gap-1.5 text-sm text-destructive [overflow-wrap:anywhere]" id={ids.error} role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{shownError}</p> : null}
          </div>
        )}
        <div className={phone ? 'grid gap-2' : 'flex flex-wrap items-center gap-2'}>
          {blocked ? null : <Button className={actionClass} size="sm" type="submit" variant="outline">{copy.submit}</Button>}
          <Button className={actionClass} onClick={keep} ref={keepButton} size="sm" type="button" variant="ghost">{copy.keep}</Button>
        </div>
      </div>
    </form>
  );

  if (!phone) return body;

  return (
    <Sheet onOpenChange={(open) => { if (!open) keep(); }} open>
      <SheetContent
        aria-describedby={ids.description}
        aria-labelledby={ids.title}
        className="gap-0 border-0 bg-surface outline-none"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => { event.preventDefault(); focusFirst(); }}
        showCloseButton={false}
        side="bottom"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <SheetPrimitive.Title asChild><Title className="text-heading-sm text-foreground" id={ids.title}>{copy.title}</Title></SheetPrimitive.Title>
          <SheetClose asChild><Button className="h-11 shrink-0" type="button" variant="outline">Close</Button></SheetClose>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{body}</div>
      </SheetContent>
    </Sheet>
  );
}
