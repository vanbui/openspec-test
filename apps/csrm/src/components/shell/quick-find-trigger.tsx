'use client';

import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dialog } from 'radix-ui';
import { createContext, use, useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuickFindDialogProps } from '@/features/quick-find/quick-find-dialog';
import { QUICK_FIND_MAX_TERM_LENGTH } from '@/features/quick-find/quick-find-constants';
import type { QuickFindViewer } from '@/features/quick-find/quick-find-domain';

/*
 * The header's search control and quick find's shortcut (D-15, D-47; UI-SPEC §3). Ctrl+K and ⌘K both work on every
 * platform, anywhere in the shell, a text field included; the handler prevents the browser default only for those
 * keys, ignores IME composition and key repeat, and does nothing while another dialog is open (the Navigation sheet,
 * a confirmation, the leave warning). Pressed while quick find is open, it closes it.
 *
 * The dialog body loads through next/dynamic the first time quick find opens, and pointer enter or focus on the
 * control starts loading it early (D-52), so no route's first-load script grows. Until it arrives the dialog's frame
 * shows with a skeleton input row and keeps what is typed; if it cannot load, the frame says search isn't available
 * and Retry search loads it again (UI-SPEC §4.7). This file ships on every route, so the frame is the shell's own
 * Radix dialog primitive and nothing more; its words are quickFindMessages', checked equal by the trigger's tests.
 *
 * The control keeps quick find's term for the page session (UI-D12). The shell renders it only for a viewer who may
 * read requests; Strapi still scopes every result.
 */

type QuickFindDialogModule = { QuickFindDialog: ComponentType<QuickFindDialogProps> };
export type QuickFindDialogLoader = () => Promise<QuickFindDialogModule>;

const loadQuickFindDialog: QuickFindDialogLoader = () => import('@/features/quick-find/quick-find-dialog');

/* What the frame shows and changes while the dialog's code is missing: the dialog's own state, and a way to load again. */
type QuickFindFrameState = Pick<QuickFindDialogProps, 'open' | 'onOpenChange' | 'term' | 'onTermChange' | 'returnFocusTo' | 'searchControl'> & {
  reload: () => void;
  isOpen: () => boolean;
};
const QuickFindFrameContext = createContext<QuickFindFrameState | null>(null);

/* The dialog's frame (X-8) before its code arrives, or when it cannot load (D-52). */
function QuickFindFrame({ failed = false }: { failed?: boolean }) {
  const frame = use(QuickFindFrameContext);
  const content = useRef<HTMLDivElement>(null);
  if (!frame) return null;
  const { open, onOpenChange, term, onTermChange, reload } = frame;

  /* While loading, what is typed is kept for the input, so nothing is lost (UI-SPEC §4.7). */
  function keep(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1) onTermChange((term + event.key).slice(0, QUICK_FIND_MAX_TERM_LENGTH));
    else if (event.key === 'Backspace') onTermChange(term.slice(0, -1));
    else return;
    event.preventDefault();
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="quick-find-content quick-find-frame"
          data-quick-find=""
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Replacement by the loaded dialog keeps focus inside search; only dismissal restores the opener.
            if (frame.isOpen()) return;
            const target = frame.returnFocusTo?.isConnected ? frame.returnFocusTo : frame.searchControl;
            if (target?.isConnected) target.focus();
          }}
          onKeyDown={failed ? undefined : keep}
          onOpenAutoFocus={failed ? undefined : (event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          ref={content}
        >
          <div className="quick-find-title-row">
            <Dialog.Title className="quick-find-frame-title text-heading-sm text-foreground">Search</Dialog.Title>
            <Dialog.Close asChild>
              <Button className="quick-find-close" type="button" variant="outline">Close{' '}<span className="sr-only">search</span></Button>
            </Dialog.Close>
          </div>
          {failed ? (
            <div className="quick-find-state">
              <p className="text-sm font-medium text-foreground">Search isn’t available right now.</p>
              <p className="text-xs text-foreground-secondary">Try again in a moment.</p>
              <Button className="quick-find-retry" onClick={reload} type="button" variant="outline">Retry search</Button>
            </div>
          ) : (
            <div aria-hidden="true" className="quick-find-input-row quick-find-skeleton-input"><Skeleton className="h-4 w-3/5" /></div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QuickFindLoading() {
  return <QuickFindFrame />;
}

function QuickFindLoadFailed() {
  return <QuickFindFrame failed />;
}

/* The lazily loaded dialog; a failed load resolves to the failure frame, so loading again needs a fresh one. */
function createQuickFindDialog(load: QuickFindDialogLoader) {
  return dynamic(
    () => load().then((module) => module.QuickFindDialog, (): ComponentType<QuickFindDialogProps> => QuickFindLoadFailed),
    { ssr: false, loading: QuickFindLoading },
  );
}

/** Apple devices show ⌘; every other platform shows Ctrl (X-7). Both shortcuts work everywhere. */
function shortcutModifier(userAgent: string): '⌘' | 'Ctrl' {
  return /Mac|iPhone|iPad|iPod/i.test(userAgent) ? '⌘' : 'Ctrl';
}

/** Any open dialog other than quick find: the Navigation sheet, a confirmation or the leave warning. */
function anotherDialogIsOpen(): boolean {
  return document.querySelector('[role="dialog"]:not([data-quick-find]), [role="alertdialog"]') !== null;
}

export function QuickFindTrigger({ viewer, loadDialog = loadQuickFindDialog }: { viewer: QuickFindViewer; loadDialog?: QuickFindDialogLoader }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  /* Mounted from the first open on, so the dialog's code is fetched only once someone asks for it. */
  const [opened, setOpened] = useState(false);
  const [term, setTerm] = useState('');
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [searchControl, setSearchControl] = useState<HTMLButtonElement | null>(null);
  const [QuickFindDialog, setQuickFindDialog] = useState(() => createQuickFindDialog(loadDialog));
  /* Decided in the browser after mount, so the server and the first client render agree (research Pitfall 18). */
  const [modifier, setModifier] = useState<'⌘' | 'Ctrl' | null>(null);

  useEffect(() => {
    setModifier(shortcutModifier(window.navigator.userAgent));
  }, []);

  /** Starts loading the dialog's code; a failed early load is retried when quick find opens. */
  const prefetch = () => {
    loadDialog().catch(() => undefined);
  };

  const openQuickFind = useCallback(() => {
    setReturnFocusTo(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOpened(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k') return;
      if (event.isComposing || event.repeat || anotherDialogIsOpen()) return;
      event.preventDefault();
      if (open) setOpen(false);
      else openQuickFind();
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, openQuickFind]);

  const frame: QuickFindFrameState = {
    open,
    isOpen: () => openRef.current,
    returnFocusTo,
    searchControl,
    onOpenChange: setOpen,
    term,
    onTermChange: setTerm,
    reload: () => setQuickFindDialog(() => createQuickFindDialog(loadDialog)),
  };

  return (
    <>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="header-search"
        onClick={openQuickFind}
        onFocus={prefetch}
        onPointerEnter={prefetch}
        ref={setSearchControl}
        type="button"
        variant="outline"
      >
        <Search aria-hidden="true" />
        <span className="header-search-label">Search</span>
        {modifier ? (
          <span aria-hidden="true" className="shortcut-hint">
            <kbd className="shortcut-key micro-label">{modifier}</kbd>
            <kbd className="shortcut-key micro-label">K</kbd>
          </span>
        ) : null}
      </Button>
      {opened ? (
        <QuickFindFrameContext value={frame}>
          <QuickFindDialog
            onOpenChange={setOpen}
            onTermChange={setTerm}
            open={open}
            returnFocusTo={returnFocusTo}
            searchControl={searchControl}
            term={term}
            viewer={viewer}
          />
        </QuickFindFrameContext>
      ) : null}
    </>
  );
}
