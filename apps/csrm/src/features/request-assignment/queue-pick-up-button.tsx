'use client';

import { UserRoundPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';
import { cn } from '@/lib/utils';

import type { AssignmentActionResult } from './assignment-actions';
import {
  assignmentActionName,
  assignmentFailureTitle,
  assignmentToast,
  undoAllowed,
  undoAssignmentRequest,
  undoToast,
  type AssignmentPerson,
  type RequestAssignment,
} from './assignment-domain';
import { sendAssignmentChange } from './send-assignment-change';

/*
 * Pick up from a Requests queue row or phone card (13-UI-SPEC §2.2, §7; D-16; X-15). It is offered only where Strapi
 * served `pickUp: "allowed"` for this viewer, and Strapi decides the change again (T-13-31). It applies at once: the
 * viewer's name replaces the button at the pending opacity, focus moves to the next Pick up (or the row's request
 * number link), and the X-14 toast offers Undo where the reverse is allowed. A refusal rolls back with family K's copy.
 * The words and what each change sends come from assignment-domain.ts.
 */

export type QueuePickUpButtonProps = {
  requestId: string;
  requestNumber: string;
  requestStatus: string;
  /** The viewer the queue read named (13-12): whom the pick-up sends as the analyst, and the name shown at once. */
  viewer: AssignmentPerson;
  /** A table cell, or a phone card's holder line and full-width button (with the card's lines between them). */
  layout?: 'row' | 'card';
  /** A card's lines between its holder line and its Pick up, which is the card's last element (§2.2). */
  children?: ReactNode;
};

type Failure = Extract<AssignmentActionResult<RequestAssignment>, { ok: false }>;

const PICK_UP = 'data-queue-pick-up';

/*
 * How long a focus hand-off waits for the queue to be read again after a change (§7.3). A read that lands later
 * leaves focus where it is, so a hand-off never outlives the change it belongs to (IN-302, D2).
 */
const QUEUE_READ_WINDOW_MS = 10_000;

/* A request an Undo put back in the queue: its Pick up takes focus when it is rendered again, within the window (§7.3). */
let focusAfterUndo: { requestId: string; until: number } | null = null;

/* Where focus goes when the queue read again no longer lists the focused row: the list's empty state, else the page heading. */
function queueFocusFallback(): HTMLElement | null {
  const page = document.querySelector('main') ?? document.body;
  const heading = page.querySelector<HTMLElement>('[data-slot="state"] :is(h1, h2, h3, h4, h5, h6)') ?? page.querySelector<HTMLElement>('h1');
  if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  return heading;
}

/*
 * D2: after a pick-up the queue is read again, and a filter (Assigned to: Not picked up) may no longer list the row,
 * which removes the request number link focus moved to. Focus then goes to the fallback above, never to the page
 * body; if the person has already moved it, it stays where they put it.
 */
function keepQueueFocus(target: HTMLElement): void {
  const observer = new MutationObserver(() => {
    if (target.isConnected) return;
    observer.disconnect();
    const active = document.activeElement;
    if (!active || active === document.body) queueFocusFallback()?.focus();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), QUEUE_READ_WINDOW_MS);
}

/*
 * §7.3: the next Pick up in DOM order within the same rendering (the table or the cards, as both are in the DOM),
 * or, when none follows, the row's or card's request number link.
 */
function nextFocusTarget(from: HTMLElement): HTMLElement | null {
  const scope = from.closest('[data-slot="data-table-mobile"], table') ?? document.body;
  const offers = [...scope.querySelectorAll<HTMLElement>(`[${PICK_UP}]`)];
  const next = offers.slice(offers.indexOf(from) + 1)[0];
  if (next) return next;
  return from.closest('tr, article')?.querySelector<HTMLElement>('a[href]') ?? null;
}

export function QueuePickUpButton({ children, layout = 'row', requestId, requestNumber, requestStatus, viewer }: QueuePickUpButtonProps) {
  const router = useRouter();
  /* Whether Strapi recorded this viewer's pick-up, until the queue is read again and names the holder itself. */
  const [held, setHeld] = useState(false);
  const [shownHeld, showHeld] = useOptimistic(held, (_current, next: boolean) => next);
  const [pending, startTransition] = useTransition();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shownHeld || focusAfterUndo?.requestId !== requestId) return;
    const current = Date.now() < focusAfterUndo.until;
    focusAfterUndo = null;
    if (current) button.current?.focus();
  }, [requestId, shownHeld]);

  /* §7.2: the change has already rolled back; a danger toast says why, with Try again or Refresh page. */
  function refused(title: string, failure: Failure, retry: () => void) {
    toast.error(title, {
      description: failure.message,
      duration: Infinity,
      action: failure.kind === 'retryable' ? toastAction('Try again', retry) : toastAction('Refresh page', () => router.refresh()),
    });
    /* §7.4: someone else changed it first, so the queue reads who holds it now. */
    if (failure.reason === 'ASSIGNMENT_CHANGED') router.refresh();
  }

  /* An Undo is a second recorded change: the request goes back to the queue from the viewer (§7.1). */
  function undo(after: RequestAssignment) {
    void (async () => {
      const result = await sendAssignmentChange({ requestId, requestNumber, ...undoAssignmentRequest({ assignee: null }, after) });
      if (!result.ok) {
        refused('Couldn’t undo', result, () => undo(after));
        return;
      }
      focusAfterUndo = { requestId, until: Date.now() + QUEUE_READ_WINDOW_MS };
      setHeld(false);
      successToast(undoToast('pick-up', { requestNumber }));
      router.refresh();
    })();
  }

  function pickUp() {
    const target = button.current ? nextFocusTarget(button.current) : null;
    startTransition(async () => {
      showHeld(true);
      const result = await sendAssignmentChange({ requestId, requestNumber, analyst: viewer.documentId, expectedAnalyst: null });
      if (!result.ok) {
        refused(assignmentFailureTitle('pick-up'), result, pickUp);
        return;
      }
      setHeld(true);
      const after = result.data;
      successToast(assignmentToast('pick-up', { requestNumber }, requestStatus), {
        action: undoAllowed('pick-up', requestStatus) ? toastAction('Undo', () => undo(after)) : undefined,
      });
      if (target) keepQueueFocus(target);
      router.refresh();
    });
    target?.focus();
  }

  /* 13-UI-SPEC Motion: the pending opacity applies at once; leaving it, and a rollback, ease back at --duration-base. */
  const pendingClass = 'transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none';
  const offer = (
    <Button
      {...{ [PICK_UP]: requestId }}
      aria-label={assignmentActionName('pick-up', requestNumber)}
      className={cn('print:hidden', layout === 'card' && 'min-h-11 w-full')}
      onClick={pickUp}
      ref={button}
      size="sm"
      type="button"
      variant="outline"
    >
      <UserRoundPlus aria-hidden="true" />
      Pick up
    </Button>
  );

  if (layout === 'card') {
    return (
      <>
        <p className={cn('text-xs text-foreground-secondary break-words', pendingClass)} data-pending={pending}>
          {shownHeld ? `Assigned to ${viewer.displayName}` : 'Not picked up'}
        </p>
        {children}
        {shownHeld ? null : offer}
      </>
    );
  }
  return shownHeld ? <span className={cn('break-words', pendingClass)} data-pending={pending}>{viewer.displayName}</span> : offer;
}
