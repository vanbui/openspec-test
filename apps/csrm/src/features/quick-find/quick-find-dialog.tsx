'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useNavigationGuard } from '@/components/csrm/navigation-guard';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { quickFindAction } from './quick-find-actions';
import {
  QUICK_FIND_DEBOUNCE_MS,
  QUICK_FIND_MAX_TERM_LENGTH,
  isSearchableTerm,
  matchCount,
  quickFindAnnouncement,
  quickFindDescription,
  quickFindMessages,
  quickFindOutcomeState,
  quickFindShowAllLabel,
  type QuickFindGroup,
  type QuickFindOutcome,
  type QuickFindViewer,
} from './quick-find-domain';

/*
 * Quick find (UX-10; D-48, D-50, D-51, D-53; UI-SPEC §4). The WAI-ARIA APG modal dialog holding the combobox and
 * listbox of the source-owned shadcn Command over cmdk 1.1.1. The title sits inside the dialog content, so the shipped
 * command dialog wrapper, whose title sits outside it, is not used (research Pitfall 16). cmdk's client filter is off,
 * because the server matched each result, perhaps by a word its options do not show; its Ctrl+J, K, N and P
 * bindings are off, because Ctrl+K closes quick find (Pitfall 15).
 *
 * From 768px it is the 640px frame anchored below the header with a footer of key hints; below 768px it is a
 * full-screen sheet with a visible title and Close, whose name is Close search from a visually hidden word (X-8). The
 * input row holds Clear search while it has text. Every state of UI-SPEC §4.4 shows in the list area, its words from
 * quickFindMessages: a failed list, or every list, offers the option Retry search. One polite region announces each
 * completed search once.
 *
 * The dialog loads through next/dynamic on first open (D-52), so none of this reaches a route's first-load script.
 */

export type QuickFindDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element focused before quick find opened, for focus on Escape (UI-SPEC §4.5). */
  returnFocusTo: HTMLElement | null;
  /** The header's Search control, where focus rests once a result opens (UI-D13). */
  searchControl: HTMLElement | null;
  /** The term, which the header control keeps for the page session (UI-D12). */
  term: string;
  onTermChange: (term: string) => void;
  viewer: QuickFindViewer;
};

/*
 * The APG combobox names its active option with aria-activedescendant on the input. cmdk 1.1.1 marks the option it
 * selects by itself when results arrive (aria-selected) without setting the input's attribute until an arrow key
 * moves the selection, so a screen reader would hear no active option. This keeps the input's attribute on the
 * selected option; once cmdk sets the attribute itself the two agree, so React and this never disagree.
 */
function useActiveOptionOnInput(inputRef: React.RefObject<HTMLInputElement | null>) {
  return useCallback((list: HTMLDivElement | null) => {
    if (!list) return undefined;
    const sync = () => {
      const input = inputRef.current;
      if (!input) return;
      const active = list.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]');
      if (active && input.getAttribute('aria-activedescendant') !== active.id) input.setAttribute('aria-activedescendant', active.id);
      else if (!active && input.hasAttribute('aria-activedescendant')) input.removeAttribute('aria-activedescendant');
    };
    const observer = new MutationObserver(sync);
    observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected'] });
    sync();
    return () => observer.disconnect();
  }, [inputRef]);
}

/* Below 768px quick find is the phone sheet (X-8). Without matchMedia (a test environment) it is the desktop frame. */
const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

/* The skeleton shows 300ms after a first search starts (§4 Skeletons), if it is still running. */
const SKELETON_DELAY_MS = 300;

type SearchState = {
  /** The last completed search, kept until a newer one replaces it (UI-D14). */
  outcome: QuickFindOutcome | null;
  /** Advances only when the latest term's answer is applied, including equal-count retries. */
  completion: number;
  /** A search is in flight. */
  busy: boolean;
  /** The search in flight has run for 300ms. */
  slow: boolean;
  /** Runs the latest term again through the same single flight (T-11-48). */
  retry: () => void;
  /** Forgets the last outcome once the term is too short to search, so it does not return with the next term. */
  reset: () => void;
};

/*
 * D-50: typing is debounced by 250ms and one search is in flight at a time. Next dispatches Server Actions one at a
 * time per client, so a term typed while a search runs waits here instead of queueing behind it; when the search
 * returns, its outcome is applied only if its term is still the latest, and the waiting term is sent if it differs.
 * A refused or thrown search is an outcome too: search is unavailable for that term (D-53).
 */
function useSingleFlightSearch(term: string): SearchState {
  const [outcome, setOutcome] = useState<QuickFindOutcome | null>(null);
  const [completion, setCompletion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  /* The term the person last typed, trimmed: an outcome for any other term is stale and is dropped. */
  const latestTerm = useRef('');
  const inFlight = useRef(false);
  const pendingTerm = useRef<string | null>(null);

  const search = useCallback(function send(searchTerm: string) {
    if (inFlight.current) {
      pendingTerm.current = searchTerm;
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const slowTimer = window.setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
    const apply = (next: QuickFindOutcome) => {
      if (next.term === latestTerm.current) {
        setOutcome(next);
        setCompletion((previous) => previous + 1);
      }
    };
    const unavailable: QuickFindOutcome = { term: searchTerm, unavailable: true };
    // The executor runs at once, so the search is sent now and a synchronous throw becomes a rejection.
    void new Promise<Awaited<ReturnType<typeof quickFindAction>>>((resolve) => resolve(quickFindAction({ term: searchTerm })))
      .then((response) => apply(response.ok ? response.data : unavailable), () => apply(unavailable))
      .finally(() => {
        window.clearTimeout(slowTimer);
        inFlight.current = false;
        setSlow(false);
        setBusy(false);
        const next = pendingTerm.current;
        pendingTerm.current = null;
        if (next !== null && next !== searchTerm && next === latestTerm.current) send(next);
      });
  }, []);

  useEffect(() => {
    const trimmed = term.trim();
    latestTerm.current = trimmed;
    if (!isSearchableTerm(trimmed)) return undefined;
    const timer = window.setTimeout(() => search(trimmed), QUICK_FIND_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, term]);

  const retry = useCallback(() => {
    if (isSearchableTerm(latestTerm.current)) search(latestTerm.current);
  }, [search]);
  const reset = useCallback(() => setOutcome(null), []);

  return { outcome, completion, busy, slow, retry, reset };
}

/* A stable region gets an empty frame before each completed answer, so even identical retry text is announced. */
function useSearchAnnouncement(outcome: QuickFindOutcome | null, completion: number): string {
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    setAnnouncement('');
    if (!outcome) return;
    const timer = window.setTimeout(() => setAnnouncement(quickFindAnnouncement(outcome)), 100);
    return () => window.clearTimeout(timer);
  }, [outcome, completion]);
  return announcement;
}

/*
 * A group's heading: its label, then its total (`REQUESTS 12`, the micro-label lockup). Its name, which the group
 * takes, adds a comma that is read but not seen and the noun: `Requests, 12 matches` (UI-SPEC §4.3). The comma
 * stays inline beside the label, as the navigation counts' does, so the name has no space before it. A list that
 * could not be searched has no total, so its heading is its label alone.
 */
function GroupHeading({ group }: { group: QuickFindGroup }) {
  if (group.status === 'failed') return <span className="quick-find-group-heading micro-label">{group.label}</span>;
  const { figure, noun } = matchCount(group.total);
  return (
    <span className="quick-find-group-heading micro-label">
      {group.label}<span className="quick-find-group-separator">,</span> <span className="tabular-nums">{figure}</span>{' '}
      <span className="sr-only">{noun}</span>
    </span>
  );
}

/* A state with no option of its own: a first line, then a secondary one (UI-SPEC §4.4). */
function StateMessage({ first, second, strong = false, pending = false }: { first: string; second: string; strong?: boolean; pending?: boolean }) {
  return (
    <div className={cn('quick-find-state', pending && 'quick-find-pending')}>
      <p className={cn('text-sm text-foreground', strong && 'font-medium')}>{first}</p>
      <p className="text-xs text-foreground-secondary">{second}</p>
    </div>
  );
}

/* The X-7 keys that move, open and close, from 768px; hidden from assistive technology, which the combobox informs. */
function KeyHints() {
  return (
    <div aria-hidden="true" className="quick-find-footer">
      <span className="quick-find-footer-hint">
        <kbd className="shortcut-key micro-label">↑</kbd>
        <kbd className="shortcut-key micro-label">↓</kbd>
        to move
      </span>
      <span>·</span>
      <span className="quick-find-footer-hint">
        <kbd className="shortcut-key micro-label">Enter</kbd>
        to open
      </span>
      <span>·</span>
      <span className="quick-find-footer-hint">
        <kbd className="shortcut-key micro-label">Esc</kbd>
        to close
      </span>
    </div>
  );
}

export function QuickFindDialog({ open, onOpenChange, returnFocusTo, searchControl, term, onTermChange, viewer }: QuickFindDialogProps) {
  const guard = useNavigationGuard();
  const isPhone = useIsPhone();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useActiveOptionOnInput(inputRef);
  const search = useSingleFlightSearch(term);
  /* After the first open the kept term is selected, so typing replaces it (UI-D12); first, the caret follows what was typed. */
  const openedBefore = useRef(false);
  /* Set when a result opens, so focus then rests on the header Search control (UI-D13). */
  const resultOpened = useRef(false);

  const searchable = isSearchableTerm(term);
  const outcome = searchable ? search.outcome : null;
  const announcement = useSearchAnnouncement(outcome, search.completion);
  const state = outcome ? quickFindOutcomeState(outcome) : null;
  /* A newer search keeps the previous answer at the pending opacity, still openable (UI-D14). */
  const pending = outcome !== null && (search.busy || outcome.term !== term.trim());
  const groups = outcome && !('unavailable' in outcome) && state === 'results'
    ? outcome.groups.filter((group) => group.status === 'failed' || group.total > 0)
    : [];

  function changeTerm(value: string) {
    onTermChange(value);
    if (!isSearchableTerm(value)) search.reset();
  }

  function clearTerm() {
    changeTerm('');
    inputRef.current?.focus();
  }

  function retry() {
    search.retry();
    inputRef.current?.focus();
  }

  function openResult(href: string) {
    // Through the guard (D-51): a Requestor with unsaved answers is asked first, and quick find closes only on leaving;
    // Keep answering then returns focus to the input, the trigger the guard is given.
    guard.navigate(href, {
      trigger: inputRef.current,
      onLeave: () => {
        resultOpened.current = true;
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="quick-find-content"
        data-quick-find=""
        onCloseAutoFocus={(event) => {
          // Back to the element focused before quick find opened, or after a result opens to the header control (A3, UI-D13).
          const target = !resultOpened.current && returnFocusTo?.isConnected ? returnFocusTo : searchControl;
          resultOpened.current = false;
          event.preventDefault();
          if (target?.isConnected) target.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const input = inputRef.current;
          if (!input) return;
          input.focus();
          if (openedBefore.current) input.select();
          else input.setSelectionRange(input.value.length, input.value.length);
          openedBefore.current = true;
        }}
        showCloseButton={false}
      >
        {isPhone ? (
          <div className="quick-find-title-row">
            <DialogTitle className="text-heading-sm text-foreground">Search</DialogTitle>
            <DialogClose asChild>
              <Button className="quick-find-close" type="button" variant="outline">
                Close{' '}<span className="sr-only">search</span>
              </Button>
            </DialogClose>
          </div>
        ) : (
          <DialogTitle className="sr-only">Search</DialogTitle>
        )}
        <DialogDescription className="sr-only">{quickFindDescription(viewer)}</DialogDescription>
        <Command className="quick-find-command" label="Search by number or title" shouldFilter={false} vimBindings={false}>
          <div className="quick-find-input-row">
            <CommandInput
              maxLength={QUICK_FIND_MAX_TERM_LENGTH}
              onValueChange={changeTerm}
              placeholder="Search by number or title"
              ref={inputRef}
              value={term}
            />
            {term ? (
              <Button className="quick-find-clear" onClick={clearTerm} onKeyDown={(event) => event.stopPropagation()} size="icon" type="button" variant="ghost">
                <X aria-hidden="true" />
                <span className="sr-only">Clear search</span>
              </Button>
            ) : null}
          </div>
          {/* The states that hold no option sit in the list area, before the listbox (UI-SPEC §4.4). */}
          {!searchable ? <StateMessage first={quickFindMessages.hint} second={quickFindDescription(viewer)} /> : null}
          {outcome && state === 'no-matches' ? (
            <StateMessage first={quickFindMessages.noMatches(outcome.term)} pending={pending} second={quickFindMessages.noMatchesDetail} strong />
          ) : null}
          {state === 'unavailable' ? (
            <StateMessage first={quickFindMessages.unavailable} pending={pending} second={quickFindMessages.unavailableDetail} strong />
          ) : null}
          {searchable && !outcome && search.slow ? (
            <div aria-hidden="true" className="quick-find-skeleton">
              {Array.from({ length: 5 }, (_, row) => (
                <div className="quick-find-skeleton-row" key={row}>
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              ))}
            </div>
          ) : null}
          <CommandList
            aria-busy={(search.busy || pending) && searchable ? true : undefined}
            className={cn('quick-find-list', pending && 'quick-find-pending')}
            label="Search results"
            ref={listRef}
          >
            {state === 'unavailable' ? (
              <CommandItem className="quick-find-option" onSelect={retry} value="retry">{quickFindMessages.retry}</CommandItem>
            ) : null}
            {groups.map((group) => (
              <CommandGroup heading={<GroupHeading group={group} />} key={group.kind}>
                {group.status === 'failed' ? (
                  <>
                    <p className="quick-find-group-message text-xs text-foreground-secondary">{quickFindMessages.groupFailed(group.label)}</p>
                    <CommandItem className="quick-find-option" onSelect={retry} value={`retry:${group.kind}`}>{quickFindMessages.retry}</CommandItem>
                  </>
                ) : null}
                {group.options.map((option) => (
                  <CommandItem className="quick-find-option" key={option.href} onSelect={() => openResult(option.href)} value={option.href}>
                    {/* A Risk's statement clamps to one line; every other name to two (UI-SPEC §4.3). */}
                    <span className={group.kind === 'risks' ? 'quick-find-option-primary quick-find-option-single-line text-sm text-foreground' : 'quick-find-option-primary text-sm text-foreground'}>
                      {option.primary}
                    </span>
                    <span className="text-xs text-foreground-secondary">{option.secondary}</span>
                  </CommandItem>
                ))}
                {group.showAllHref ? (
                  <CommandItem className="quick-find-option quick-find-show-all" onSelect={() => openResult(group.showAllHref ?? '')} value={group.showAllHref}>
                    {quickFindShowAllLabel(group)}
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {isPhone ? null : <KeyHints />}
        {/* The one polite region (UI-SPEC §4.4): each completed search, once. */}
        <p aria-atomic="true" aria-live="polite" className="sr-only">{announcement}</p>
      </DialogContent>
    </Dialog>
  );
}
