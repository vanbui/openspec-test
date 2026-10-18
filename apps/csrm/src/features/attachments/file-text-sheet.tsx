'use client';

import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { getAttachmentAiTextAction, type AttachmentAiTextResult } from './attachments-actions';
import { fileAiFactsLine } from './attachments-domain';
import { sheetOverlayMotion, sideSheetMotion } from './sheet-motion';

/*
 * The text the AI will read (14-UI-SPEC §5.3; D-31, D-33; UI-D22; X-13, X-22): `Preview text` opens this sheet, which
 * reads the file's stored text through the analyst-only operation when it opens, and shows it exactly as CSRM sends it,
 * as text only: a React text node in a pre-wrapped well, never parsed as HTML (T-14-54). A truncated file ends with a
 * line that says how many characters aren't sent. The AI control loads this module with next/dynamic, so no page's first
 * load carries it.
 *
 * From 768px a side sheet at the form dialog width; below, a full-screen sheet with its title row and Close. Focus moves
 * to the title on open and back to `Preview text` on close; `Escape` closes it.
 */

/* §5.3 Loading: a fast read shows no skeleton at all. */
const SKELETON_DELAY_MS = 300;

const count = new Intl.NumberFormat('en-AU');

/* §5.3's words. They live here, in the module that loads on demand, so no page's first load carries them. */
export const fileTextSheetCopy = {
  title: 'Text the AI will read',
  description: (name: string, facts: string) => `${name} · ${facts}. CSRM sends this text to the AI as information to analyse, never as instructions.`,
  bodyName: 'Text the AI will read, text',
  endLine: (remaining: number) => `The text stops here. The remaining ${count.format(remaining)} characters aren’t sent.`,
  loading: 'Loading the file’s text',
  loadFailed: 'We couldn’t load the file’s text',
  notIncluded: 'This file’s text is no longer included, so there’s nothing to preview.',
  tryAgain: 'Try again',
  close: 'Close',
  closeName: 'Close text preview',
} as const;

export type FileTextSheetProps = {
  requestId: string;
  attachmentId: string;
  fileName: string;
  /** The facts line the list shows for the file, for the description until the text's own facts arrive. */
  factsLine: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `Preview text`, which takes focus back when the sheet closes. */
  returnFocusTo: RefObject<HTMLButtonElement | null>;
};

type SheetState =
  | { kind: 'loading' }
  | { kind: 'populated'; text: string; factsLine: string; remaining: number | null }
  | { kind: 'not-included' }
  | { kind: 'refused'; message: string }
  | { kind: 'error' };

function stateFrom(result: AttachmentAiTextResult): SheetState {
  if (result.ok) {
    const { available, kept, truncated } = result.data.facts;
    return {
      kind: 'populated',
      text: result.data.text,
      factsLine: fileAiFactsLine({ included: true, facts: { available, kept, truncated } }),
      remaining: truncated ? available - kept : null,
    };
  }
  if (result.status === 409) return { kind: 'not-included' };
  /* A malformed call (400) refuses no one and the preview changes nothing, so it reads §5.3's error (WR-502). */
  if (result.kind === 'retryable' || result.status === 400) return { kind: 'error' };
  return { kind: 'refused', message: result.message };
}

export function FileTextSheet({ attachmentId, factsLine, fileName, onOpenChange, open, requestId, returnFocusTo }: FileTextSheetProps) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const attempt = useRef(0);

  const load = useCallback(async () => {
    const current = ++attempt.current;
    setState({ kind: 'loading' });
    setShowSkeleton(false);
    const timer = setTimeout(() => { if (attempt.current === current) setShowSkeleton(true); }, SKELETON_DELAY_MS);
    let next: SheetState;
    try {
      next = stateFrom(await getAttachmentAiTextAction({ requestId, attachmentId }));
    } catch {
      next = { kind: 'error' };
    }
    clearTimeout(timer);
    if (attempt.current === current) setState(next);
  }, [attachmentId, requestId]);

  useEffect(() => {
    if (open) void load();
    else attempt.current += 1;
  }, [load, open]);

  /* §5.3 Error: Try again reads the text again and keeps focus on the title. */
  function retry() {
    void load();
    title.current?.focus();
  }

  const described = state.kind === 'populated' ? state.factsLine : factsLine;

  return (
    <SheetPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-overlay', sheetOverlayMotion)} />
        <SheetPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-surface shadow-overlay outline-none',
            'md:left-auto md:w-[min(640px,100vw)] md:border-l md:border-border',
            /* UI-02: the drawer motion, sliding up below 768px and in from the end from 768px; the fade alone under reduced motion. */
            sideSheetMotion,
          )}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}
          onOpenAutoFocus={(event) => { event.preventDefault(); title.current?.focus(); }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4 md:px-6">
            <div className="grid min-w-0 gap-1">
              <SheetPrimitive.Title asChild>
                <h2 className="text-heading-sm text-foreground outline-none" ref={title} tabIndex={-1}>{fileTextSheetCopy.title}</h2>
              </SheetPrimitive.Title>
              <SheetPrimitive.Description className="text-sm text-foreground-secondary [overflow-wrap:anywhere]">
                {fileTextSheetCopy.description(fileName, described)}
              </SheetPrimitive.Description>
            </div>
            <SheetPrimitive.Close asChild>
              <Button aria-label={fileTextSheetCopy.closeName} className="h-11 shrink-0 md:h-9" type="button" variant="outline">
                <X aria-hidden="true" className="hidden md:block" />
                <span className="md:sr-only">{fileTextSheetCopy.close}</span>
              </Button>
            </SheetPrimitive.Close>
          </div>
          <div
            aria-label={fileTextSheetCopy.bodyName}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-6"
            role="region"
            tabIndex={0}
          >
            <SheetBody onRetry={retry} showSkeleton={showSkeleton} state={state} />
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

function SheetBody({ onRetry, showSkeleton, state }: { onRetry: () => void; showSkeleton: boolean; state: SheetState }) {
  if (state.kind === 'loading') {
    if (!showSkeleton) return null;
    return (
      <div aria-label={fileTextSheetCopy.loading} className="grid gap-2 rounded-md bg-surface-muted p-4" role="status">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((line) => <Skeleton className={cn('h-4', line === 7 ? 'w-2/5' : line % 3 === 2 ? 'w-4/5' : 'w-full')} key={line} />)}
      </div>
    );
  }
  if (state.kind === 'not-included') return <p className="text-sm text-foreground-secondary">{fileTextSheetCopy.notIncluded}</p>;
  if (state.kind === 'refused') return <p className="text-sm text-foreground-secondary">{state.message}</p>;
  if (state.kind === 'error') {
    return (
      <div className="grid gap-2" role="alert">
        <p className="flex items-center gap-2 font-medium text-foreground"><AlertCircle aria-hidden="true" className="size-4 text-destructive" />{fileTextSheetCopy.loadFailed}</p>
        <Button className="w-fit max-md:min-h-11" onClick={onRetry} type="button" variant="outline"><RotateCcw aria-hidden="true" />{fileTextSheetCopy.tryAgain}</Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {/* T-14-54: the stored text is a React text node, never markup. */}
      <p className="rounded-md bg-surface-muted p-4 text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{state.text}</p>
      {state.remaining !== null ? <p className="text-xs text-foreground-secondary">{fileTextSheetCopy.endLine(state.remaining)}</p> : null}
    </div>
  );
}
