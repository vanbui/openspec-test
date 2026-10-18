'use client';

import { Check, RotateCcw } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import { toast } from 'sonner';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Button } from '@/components/ui/button';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { clearOtherOwnersSessionDrafts } from '@/lib/session-drafts/session-draft-owners';
import { cn } from '@/lib/utils';

import { listAssignableAnalystsAction, type AssignmentActionResult } from './assignment-actions';
import { assignmentFailureTitle, assignmentTitle, pickerOptions, type AssignmentPerson } from './assignment-domain';

/*
 * The assign picker (13-UI-SPEC §6; X-15, X-2, X-13; D-06, D-16; UI-D5, UI-D31). It lists only the Security Analysts
 * Strapi says may hold the request, without the current assignee, searched on the server as the person types (250ms,
 * the latest answer applied, as quick find). Choosing a person marks them and never applies; `Assign to {name}` does.
 * From 768px it is a popover at the confirm dialog width anchored to its trigger; below, the X-13 full-screen sheet.
 *
 * No lost input: the reason and the chosen analyst are kept in the session store per person and request as they
 * change, so Escape, a click outside, Close, in-app navigation or a failed assign never lose them; reopening restores
 * them. A successful assignment and sign-out clear them. While a kept reason holds text the browser warns before the
 * tab closes (UI-D18), and in-app navigation is never blocked. Loaded with next/dynamic from the assignment block.
 */

export type AssignPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestNumber: string;
  mode: 'assign' | 'reassign';
  currentAssigneeId: string | null;
  /** The session-draft owner key; without one the reason is kept only while the page is open. */
  draftOwnerKey: string | null;
  /** Sends the assignment; resolves whether Strapi recorded it. */
  onAssign: (analyst: AssignmentPerson, reason?: string) => Promise<boolean>;
  /** The control that opened the picker, which the popover is anchored to and focus returns to. */
  anchor: RefObject<HTMLElement | null>;
  /** Where focus goes when the picker closes: by default the trigger; after an assignment the block decides (§7.3). */
  returnFocus?: (assigned: boolean) => void;
};

const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_DELAY_MS = 300;
const REASON_MAX_LENGTH = 500;
const SEARCH_MAX_LENGTH = 100;
const LIST_UNAVAILABLE = 'We couldn’t load Security Analysts.';

/* Below 768px the picker is the full-screen sheet. Without matchMedia (a test environment) it is the popover. */
const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

type KeptAssignment = { reason: string; analyst: AssignmentPerson | null };

/* The kept reason and choice, read defensively: anything else in the slot is no draft. */
function readKept(ownerKey: string | null, requestId: string): KeptAssignment | null {
  if (!ownerKey) return null;
  const raw = readSessionDraft('assign', ownerKey, requestId);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('reason' in value) || typeof value.reason !== 'string') return null;
    const analyst = 'analyst' in value ? value.analyst : null;
    const person = typeof analyst === 'object' && analyst !== null && 'documentId' in analyst && 'displayName' in analyst
      && typeof analyst.documentId === 'string' && typeof analyst.displayName === 'string'
      ? { documentId: analyst.documentId, displayName: analyst.displayName }
      : null;
    return { reason: value.reason, analyst: person };
  } catch {
    return null;
  }
}

function keep(ownerKey: string | null, requestId: string, kept: KeptAssignment): void {
  if (!ownerKey) return;
  writeSessionDraft('assign', ownerKey, requestId, kept.reason || kept.analyst ? JSON.stringify(kept) : '');
}

type ListState =
  | { state: 'loading' }
  | { state: 'ready'; people: AssignmentPerson[]; term: string }
  | { state: 'error' };

export function AssignPicker({ anchor, currentAssigneeId, draftOwnerKey, mode, onAssign, onOpenChange, open, requestId, requestNumber, returnFocus }: AssignPickerProps) {
  const phone = useIsPhone();
  const titleId = useId();
  const reasonId = useId();
  const title = assignmentTitle(mode, requestNumber);

  const [term, setTerm] = useState('');
  const [list, setList] = useState<ListState>({ state: 'loading' });
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [chosen, setChosen] = useState<AssignmentPerson | null>(null);
  const [reason, setReason] = useState('');
  const [restored, setRestored] = useState(false);
  const [chooseError, setChooseError] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  /* Each search's number: only the latest one's answer is applied. */
  const sequence = useRef(0);
  const requestedTerm = useRef<string | null>(null);
  /* The kept analyst, re-marked only when the first freshly served list still holds them. */
  const restoreAnalystId = useRef<string | null>(null);
  const assigned = useRef(false);
  const interactedOutside = useRef(false);
  /*
   * The owner's close handler, read when the list refuses: holding it in a ref keeps `load`, and so the opening effect,
   * from running again whenever the owner renders with a new handler, which would clear the search, the choice and the
   * list mid-use (WR-304).
   */
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  /* A reason kept from earlier in this session arms the unload warning from the start (UI-D18). */
  useEffect(() => {
    /* Only the signed-in person's text stays in the store (IN-402). */
    if (draftOwnerKey) clearOtherOwnersSessionDrafts(draftOwnerKey);
    const kept = readKept(draftOwnerKey, requestId);
    if (kept) setReason(kept.reason);
  }, [draftOwnerKey, requestId]);
  useUnloadWarning(reason.trim().length > 0);

  const load = useCallback((searchTerm: string) => {
    const mine = ++sequence.current;
    requestedTerm.current = searchTerm;
    setLoading(true);
    setSlow(false);
    const slowTimer = window.setTimeout(() => {
      if (sequence.current === mine) setSlow(true);
    }, SKELETON_DELAY_MS);
    const apply = (result: AssignmentActionResult<AssignmentPerson[]>) => {
      window.clearTimeout(slowTimer);
      if (sequence.current !== mine) return;
      setLoading(false);
      setSlow(false);
      if (result.ok) {
        setList({ state: 'ready', people: result.data, term: searchTerm });
        const keptId = restoreAnalystId.current;
        restoreAnalystId.current = null;
        const kept = keptId === null ? undefined : result.data.find((person) => person.documentId === keptId);
        if (kept) setChosen(kept);
      } else if (result.kind === 'retryable') {
        setList({ state: 'error' });
      } else {
        /* §6 Permission: family K's copy, and the picker closes. */
        toast.error(assignmentFailureTitle(mode), { description: result.message, duration: Infinity });
        onOpenChangeRef.current(false);
      }
    };
    void Promise.resolve()
      .then(() => listAssignableAnalystsAction(searchTerm ? { requestId, q: searchTerm } : { requestId }))
      .then(apply, () => apply({ ok: false, kind: 'retryable', message: LIST_UNAVAILABLE }));
  }, [mode, requestId]);

  /* Opening restores what was kept and reads the list afresh. */
  useEffect(() => {
    if (!open) return;
    assigned.current = false;
    interactedOutside.current = false;
    setTerm('');
    setChooseError(false);
    setReasonError(null);
    setChosen(null);
    if (draftOwnerKey) {
      const kept = readKept(draftOwnerKey, requestId);
      setReason(kept?.reason ?? '');
      setRestored(Boolean(kept?.reason));
      restoreAnalystId.current = kept?.analyst?.documentId ?? null;
    }
    setList({ state: 'loading' });
    load('');
  }, [draftOwnerKey, load, open, requestId]);

  /* Typing searches after a pause; the term the list was last asked for is not asked for again. */
  useEffect(() => {
    if (!open) return undefined;
    const trimmed = term.trim();
    if (trimmed === requestedTerm.current) return undefined;
    const timer = window.setTimeout(() => load(trimmed), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [load, open, term]);

  function choose(person: AssignmentPerson) {
    setChosen(person);
    setChooseError(false);
    keep(draftOwnerKey, requestId, { reason, analyst: person });
  }

  function changeReason(value: string) {
    setReason(value);
    setReasonError(null);
    setRestored(false);
    keep(draftOwnerKey, requestId, { reason: value, analyst: chosen });
  }

  function submit() {
    if (!chosen) {
      setChooseError(true);
      return;
    }
    if (reason.trim().length > REASON_MAX_LENGTH) {
      setReasonError('Keep the reason to 500 characters or fewer.');
      reasonRef.current?.focus();
      return;
    }
    const target = chosen;
    const text = reason.trim() || undefined;
    assigned.current = true;
    onOpenChange(false);
    void onAssign(target, text).then((recorded) => {
      if (!recorded) return;
      /* Recorded: the kept reason and choice are done with, and an Undo never brings them back. */
      if (draftOwnerKey) clearSessionDraft('assign', draftOwnerKey, requestId);
      setReason('');
      setChosen(null);
      setRestored(false);
    });
  }

  function reasonKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  }

  const focusSearch = (event: Event) => {
    event.preventDefault();
    inputRef.current?.focus();
  };
  const closeFocus = (event: Event) => {
    event.preventDefault();
    const wasAssigned = assigned.current;
    const outside = interactedOutside.current;
    assigned.current = false;
    interactedOutside.current = false;
    if (outside && !wasAssigned) return;
    if (returnFocus) returnFocus(wasAssigned);
    else if (!wasAssigned) anchor.current?.focus();
  };

  const options = list.state === 'ready' ? pickerOptions(list.people, currentAssigneeId) : [];
  const describedBy = [`${reasonId}-hint`, restored ? `${reasonId}-restored` : null, reasonError ? `${reasonId}-error` : null].filter(Boolean).join(' ');

  const body = (
    <div className="grid min-h-0 gap-4">
      <Command className="min-h-0 rounded-md border border-border bg-surface" label="Search Security Analysts" shouldFilter={false} vimBindings={false}>
        <CommandInput maxLength={SEARCH_MAX_LENGTH} onValueChange={setTerm} placeholder="Search Security Analysts" ref={inputRef} value={term} />
        {loading && slow && list.state !== 'ready' ? (
          <div aria-hidden="true" className="grid gap-1 p-1">
            {[0, 1, 2, 3].map((row) => <div className="flex h-9 items-center px-2" key={row}><Skeleton className="h-3 w-2/5" /></div>)}
          </div>
        ) : null}
        {list.state === 'ready' && options.length === 0 && !loading ? (
          list.term ? (
            <p className="px-3 py-4 text-sm text-foreground">{`No Security Analyst matches “${list.term}”`}</p>
          ) : (
            <div className="grid gap-1 px-3 py-4">
              <p className="text-sm font-medium text-foreground">No other Security Analyst can be assigned</p>
              <p className="text-xs text-foreground-secondary">Only active Security Analysts who didn’t raise this request can be assigned.</p>
            </div>
          )
        ) : null}
        {list.state === 'error' && !loading ? (
          <div className="grid justify-items-start gap-2 px-3 py-4" role="alert">
            <p className="text-sm text-foreground">{LIST_UNAVAILABLE}</p>
            <Button className="max-md:min-h-11" onClick={() => load(term.trim())} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Try again</Button>
          </div>
        ) : null}
        <CommandList
          aria-busy={loading ? true : undefined}
          className={cn('max-h-60 overscroll-contain p-1 transition-opacity duration-(--duration-base) ease-standard', loading && list.state === 'ready' && 'opacity-60 transition-none')}
          label="Security Analysts"
        >
          {options.map((person) => {
            const isChosen = chosen?.documentId === person.documentId;
            /*
             * UI-01: cmdk's `aria-selected` is the active option (on `--color-bg-inset`, X-2); the chosen one reads at 500
             * with its `Check` and exposes its state as `aria-checked` (ARIA 1.2 allows it on `option`).
             */
            return (
              <CommandItem
                aria-checked={isChosen}
                className="min-h-9 data-[selected=true]:bg-surface-muted max-md:min-h-11"
                data-chosen={isChosen}
                key={person.documentId}
                onSelect={() => choose(person)}
                value={person.documentId}
              >
                <Check aria-hidden="true" className={cn('size-4 text-foreground', isChosen ? 'opacity-100' : 'opacity-0')} />
                <span className={cn('min-w-0 break-words text-sm text-foreground', isChosen && 'font-medium')}>{person.displayName}</span>
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
      {chooseError ? <p className="text-xs text-destructive" role="alert">Choose a Security Analyst first.</p> : null}
      <div className="grid gap-2">
        <Label htmlFor={reasonId}>Reason (optional)</Label>
        <Textarea
          aria-describedby={describedBy}
          aria-invalid={reasonError ? true : undefined}
          className="max-h-40"
          id={reasonId}
          onChange={(event) => changeReason(event.target.value)}
          onKeyDown={reasonKeyDown}
          ref={reasonRef}
          rows={3}
          value={reason}
        />
        <p className="text-xs text-foreground-secondary" id={`${reasonId}-hint`}>Recorded in the assignment history. Up to 500 characters.</p>
        {restored ? <p className="text-xs text-foreground-secondary" id={`${reasonId}-restored`}>Restored from earlier in this session.</p> : null}
        {reasonError ? <p className="text-xs text-destructive" id={`${reasonId}-error`} role="alert">{reasonError}</p> : null}
      </div>
    </div>
  );

  const action = (
    <Button className={phone ? 'min-h-11 w-full' : 'w-fit justify-self-end'} onClick={submit} size="sm" type="button" variant="outline">
      {chosen ? `Assign to ${chosen.displayName}` : 'Assign to a Security Analyst'}
    </Button>
  );

  /*
   * UI-02: the shared Sheet and Popover (shadcn first), so the picker moves as every sheet and popover in the app does
   * (13-UI-SPEC Motion); it passes no motion of its own, and reduced motion is the global rule.
   */
  if (phone) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          aria-describedby={undefined}
          aria-labelledby={titleId}
          className="inset-0 gap-0 border-0 bg-surface outline-none"
          onCloseAutoFocus={closeFocus}
          onOpenAutoFocus={focusSearch}
          showCloseButton={false}
          side="bottom"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <SheetPrimitive.Title asChild>
              <h2 className="text-heading-sm text-foreground break-words" id={titleId}>{title}</h2>
            </SheetPrimitive.Title>
            <SheetClose asChild>
              <Button aria-label="Close assign" className="h-11 shrink-0" type="button" variant="outline">Close</Button>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{body}</div>
          <div className="border-t border-border p-4">{action}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverAnchor virtualRef={anchor as RefObject<HTMLElement>} />
      <PopoverContent
        align="end"
        aria-labelledby={titleId}
        className="grid max-h-(--radix-popover-content-available-height) w-[min(480px,calc(100vw-2rem))] gap-4 overflow-y-auto border-border bg-surface text-foreground outline-none"
        collisionPadding={16}
        onCloseAutoFocus={closeFocus}
        onInteractOutside={() => { interactedOutside.current = true; }}
        onOpenAutoFocus={focusSearch}
        role="dialog"
      >
        <h2 className="sr-only" id={titleId}>{title}</h2>
        {body}
        {action}
      </PopoverContent>
    </Popover>
  );
}
