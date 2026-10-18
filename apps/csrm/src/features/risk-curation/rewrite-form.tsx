'use client';

import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useId, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { RiskProposalJob } from './risk-curation-domain';
import type { RewriteFormBodyProps } from './rewrite-form-body';

/*
 * Rewrite this risk (16-UI-SPEC §4.1; D-34, UI-D20): the control on an active Risk's card and its form, a `Popover`
 * anchored to it from 768px and a bottom `Sheet` below. The control ships with the editor; the form's body (the X-25
 * instruction, the parts to rewrite and the actions) loads the first time it opens (D-48), so a page of Risk cards
 * carries only this frame. The caller offers the control only where §4.1 allows it; Strapi decides every rewrite again.
 */
const RewriteFormBody = dynamic<RewriteFormBodyProps>(() => import('./rewrite-form-body').then((module) => module.RewriteFormBody), {
  /*
   * A Suspense boundary of the form's own: without `loading`, the first open suspends the page's boundary, which hides
   * the editor behind its skeleton and leaves the popover anchored to nothing (16-15).
   */
  loading: () => <div aria-label="Loading the rewrite form" className="grid gap-3" role="status"><Skeleton className="h-24 w-full" /><Skeleton className="h-8 w-32" /></div>,
});

/*
 * From 768px (SSR renders the wide form). Its own hook, not the decisions module's, which reads family R and loads on
 * demand: this control ships with every Risk card.
 */
const wideQuery = '(min-width: 768px)';
function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia?.(wideQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsWide(): boolean {
  return useSyncExternalStore(subscribeToWidth, () => window.matchMedia?.(wideQuery).matches ?? true, () => true);
}

export type RewriteFormProps = {
  assessmentId: string;
  riskId: string;
  riskNumber: string;
  /** The Risk's open AI changes, which a new rewrite replaces when it is ready (D-37). */
  openChanges: number;
  ownerKey: string | null;
  /** The started job: the Risk card's `AI rewrite` follows it. */
  onStarted: (job: RiskProposalJob) => void;
  /** Controlled, so the card's phone menu can open the form (RiskCardActions' `rewrite.open`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function RewriteForm({ assessmentId, onOpenChange, onStarted, open: controlledOpen, openChanges, ownerKey, riskId, riskNumber }: RewriteFormProps) {
  const wide = useIsWide();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  }

  /*
   * Once the AI is asked, the card withholds this control while the rewrite runs (FE4-04), so the form unmounts and the
   * card's `AI rewrite` section moves focus to its job status line (FE4-03).
   */
  function started(job: RiskProposalJob) {
    setOpen(false);
    onStarted(job);
  }

  function closeAutoFocus(event: Event) {
    event.preventDefault();
    /* From the phone menu the control is hidden; Radix then hands focus back to where the menu was. */
    const control = trigger.current;
    if (control && (control.checkVisibility?.() ?? true)) control.focus();
  }

  const title = `Rewrite ${riskNumber}`;
  const body = open ? (
    <RewriteFormBody assessmentId={assessmentId} onCancel={() => setOpen(false)} onStarted={started} openChanges={openChanges} ownerKey={ownerKey} phone={!wide} riskId={riskId} riskNumber={riskNumber} titleId={titleId} />
  ) : null;
  const triggerButton = (
    <Button aria-haspopup="dialog" aria-label={`Rewrite this risk: ${riskNumber}`} className="max-md:min-h-11" data-print="hidden" onClick={() => setOpen(true)} ref={trigger} size="sm" type="button" variant="outline">
      <Sparkles aria-hidden="true" />Rewrite this risk
    </Button>
  );

  if (!wide) {
    return (
      <>
        {triggerButton}
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetContent aria-describedby={undefined} aria-labelledby={titleId} className="gap-0 border-0 bg-surface outline-none" data-rewrite-form="sheet" onCloseAutoFocus={closeAutoFocus} onOpenAutoFocus={(event) => event.preventDefault()} showCloseButton={false} side="bottom">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <SheetPrimitive.Title asChild><h2 className="text-heading-sm text-foreground" id={titleId}>{title}</h2></SheetPrimitive.Title>
              <SheetClose asChild><Button className="h-11 shrink-0" type="button" variant="outline">Close</Button></SheetClose>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">{body}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent align="end" aria-labelledby={titleId} className="grid max-h-(--radix-popover-content-available-height) w-[min(480px,calc(100vw-2rem))] gap-3 overflow-y-auto border-border bg-surface text-foreground outline-none" collisionPadding={16} data-rewrite-form="popover" onCloseAutoFocus={closeAutoFocus} onOpenAutoFocus={(event) => event.preventDefault()} role="dialog">
        <h2 className="text-heading-sm text-foreground" id={titleId}>{title}</h2>
        {body}
      </PopoverContent>
    </Popover>
  );
}
