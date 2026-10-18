'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { ConfirmDialog } from './confirm-dialog';

/*
 * The leave guard (D-12, UI-SPEC §6.3). A page with unsaved work registers its leave state with
 * `useLeaveGuard`; the shell's provider then makes every in-app link that consults it ask first, through
 * Next's `Link onNavigate` (the documented "Blocking navigation" pattern), and asks the browser to warn on
 * reload, close and external navigation (`beforeunload`). Nothing blocks once the work is saved.
 *
 * Next's Link calls `onClick` before `onNavigate`, and `onNavigate` receives only an object with
 * `preventDefault()`, never the DOM event. So a guarded link records the element that was activated in
 * its `onClick` and passes it to `guardLink` from `onNavigate`, so focus can go back to it. Ctrl, Cmd and
 * middle clicks open a new tab and never reach `onNavigate`, so the page stays as it is.
 *
 * Quick find opens a result with no link at all, so the guard also offers a programmatic entry point, `navigate`
 * (11-CONTEXT D-51): it pushes the route at once when nothing is unsaved, and otherwise opens the same warning.
 *
 * Navigation visibility is not authorisation, and neither is this: it protects typed answers, nothing more.
 */

export type LeaveReason = 'waiting' | 'failed';

/** What `onNavigate` receives from Next's Link: an object with `preventDefault()` only. */
export type NavigationEventLike = { preventDefault: () => void };

export type GuardLinkOptions = {
  /** Where the link goes. Omitted when leaving is not a navigation, such as signing out. */
  href?: string;
  /** The element that was activated, for focus after Keep answering. */
  trigger?: HTMLElement | null;
  /** Runs when the person chooses to leave, before any navigation (for example closing the mobile sheet). */
  onLeave?: () => void;
  /**
   * Asks even though nothing on the page is unsaved, in these words: signing out with unsent text kept in the session
   * (13-UI-SPEC §9.3; WR-401).
   */
  ask?: LeaveCopy;
};

/** The leave warning's words, when they are not the questionnaire's. */
export type LeaveCopy = { title: string; description: string; cancelLabel: string; confirmLabel: string; pendingLabel: string };

/** What `navigate` takes besides the href (D-51). */
export type NavigateOptions = Omit<GuardLinkOptions, 'href'>;

export type NavigationGuard = {
  blocking: boolean;
  guardLink: (event: NavigationEventLike, options: GuardLinkOptions) => void;
  /** Goes to `href` in the app, asking first while the page has unsaved work; `onLeave` runs before the route changes. */
  navigate: (href: string, options?: NavigateOptions) => void;
};

type NavigationGuardContextValue = {
  guard: NavigationGuard;
  register: (id: string, reason: LeaveReason | null, copy?: LeaveCopy) => void;
};

/** A page's registered leave state: why it blocks and, when its work is not answers, the warning's own words. */
type RegisteredGuard = { reason: LeaveReason; copy?: LeaveCopy };

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

/* Without a provider nothing is unsaved, and there is no router to borrow, so a navigation is a plain page load. */
const inactiveGuard: NavigationGuard = {
  blocking: false,
  guardLink: () => undefined,
  navigate: (href, options) => {
    options?.onLeave?.();
    window.location.assign(href);
  },
};

const leaveDescriptions: Record<LeaveReason, string> = {
  waiting: 'Your latest answers are still being saved. If you leave now, they may not be saved.',
  failed: 'Your latest answers weren’t saved. If you leave now, they’ll be lost.',
};

type PendingLeave = GuardLinkOptions & { reason: LeaveReason };

/** Moves focus to the activated element when it is still in the document, else to the page's main heading. */
function returnFocus(trigger: HTMLElement | null | undefined): void {
  if (trigger?.isConnected) {
    trigger.focus();
    return;
  }
  const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus();
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [guards, setGuards] = useState<Readonly<Record<string, RegisteredGuard>>>({});
  const entries = Object.values(guards);
  const reasons = entries.map((entry) => entry.reason);
  const blocking = reasons.length > 0;
  const reason: LeaveReason = reasons.includes('failed') ? 'failed' : 'waiting';
  /*
   * 14-UI-SPEC §10 (IN-501): the words by a fixed priority, never by the order the pages registered in. A failed save
   * outranks every waiting page, because leaving loses what was typed: its words win, a failed page's own or else the
   * default failed-save words, over any waiting page's (the upload queue's). While only waiting pages block, a page's own
   * words win over the default waiting words; a page keeps its place when it registers again.
   */
  const registeredCopy = entries.find((entry) => entry.reason === reason && entry.copy)?.copy;
  const [pending, setPending] = useState<PendingLeave | null>(null);
  /* The words of the warning last opened, kept while it closes, so they do not change as it fades out. */
  const [ask, setAsk] = useState<LeaveCopy | undefined>(undefined);

  /* Read by the stable guardLink and the beforeunload listener without re-creating them. */
  const blockingRef = useRef(blocking);
  const reasonRef = useRef(reason);
  const copyRef = useRef(registeredCopy);
  /* Set once the person has chosen to leave, so the full-page navigation that may follow is not asked about twice. */
  const leavingRef = useRef(false);
  useEffect(() => {
    blockingRef.current = blocking;
    reasonRef.current = reason;
    copyRef.current = registeredCopy;
    if (!blocking) leavingRef.current = false;
  }, [blocking, reason, registeredCopy]);

  const register = useCallback((id: string, next: LeaveReason | null, copy?: LeaveCopy) => {
    setGuards((current) => {
      const existing = current[id];
      if (next === null ? existing === undefined : existing?.reason === next && existing.copy === copy) return current;
      if (next === null) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      /* An id already registered keeps its place in the record; a new one joins at the end. */
      return { ...current, [id]: copy ? { reason: next, copy } : { reason: next } };
    });
  }, []);

  const guardLink = useCallback((event: NavigationEventLike, options: GuardLinkOptions) => {
    if (!blockingRef.current && !options.ask) return;
    event.preventDefault();
    setAsk(options.ask ?? copyRef.current);
    setPending({ ...options, reason: reasonRef.current });
  }, []);

  const navigate = useCallback((href: string, options: NavigateOptions = {}) => {
    if (blockingRef.current) {
      setAsk(options.ask ?? copyRef.current);
      setPending({ ...options, href, reason: reasonRef.current });
      return;
    }
    options.onLeave?.();
    router.push(href);
  }, [router]);

  useEffect(() => {
    if (!blocking) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [blocking]);

  function keepAnswering() {
    const trigger = pending?.trigger;
    setPending(null);
    /* After the dialog's own focus return, so focus lands where UI-SPEC §6.3 says. */
    window.setTimeout(() => returnFocus(trigger), 0);
  }

  function leave() {
    if (!pending) return;
    const { href, onLeave } = pending;
    leavingRef.current = true;
    setPending(null);
    onLeave?.();
    if (href !== undefined) router.push(href);
  }

  const guard = useMemo<NavigationGuard>(() => ({ blocking, guardLink, navigate }), [blocking, guardLink, navigate]);
  const value = useMemo(() => ({ guard, register }), [guard, register]);

  return (
    <NavigationGuardContext value={value}>
      {children}
      <ConfirmDialog
        cancelLabel="Keep answering"
        confirmLabel="Leave questionnaire"
        confirmVariant="destructive"
        description={leaveDescriptions[pending?.reason ?? reason]}
        onConfirm={leave}
        onOpenChange={(open) => { if (!open) keepAnswering(); }}
        open={pending !== null}
        pendingLabel="Leaving questionnaire…"
        title="Leave this questionnaire?"
        {...ask}
      />
    </NavigationGuardContext>
  );
}

/** The shell's guard, or one that never blocks when there is no provider. */
export function useNavigationGuard(): NavigationGuard {
  return useContext(NavigationGuardContext)?.guard ?? inactiveGuard;
}

/**
 * Registers this page's leave state: while `blocking`, in-app links ask first and the browser warns. A page whose
 * unsaved work is not answers passes the warning's own words (`copy`, a stable value), as the upload queue does.
 */
export function useLeaveGuard(blocking: boolean, reason: LeaveReason = 'waiting', copy?: LeaveCopy): void {
  const register = useContext(NavigationGuardContext)?.register;
  const id = useId();
  useEffect(() => {
    if (!register) return undefined;
    register(id, blocking ? reason : null, copy);
    return () => register(id, null);
  }, [blocking, copy, id, reason, register]);
}

type GuardedLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/** A single `next/link` that asks first while the page has unsaved work (the wordmark, a record link). */
export function GuardedLink({ href, onClick, onNavigate, ...props }: GuardedLinkProps) {
  const guard = useNavigationGuard();
  const activated = useRef<HTMLAnchorElement | null>(null);

  return (
    <Link
      {...props}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        activated.current = event.currentTarget;
        onClick?.(event);
      }}
      onNavigate={(event) => {
        onNavigate?.(event);
        guard.guardLink(event, { href, trigger: activated.current });
      }}
    />
  );
}
