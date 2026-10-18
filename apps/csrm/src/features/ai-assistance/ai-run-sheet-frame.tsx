'use client';

import { AlertCircle, RotateCcw, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { aiRunSheetDescription, type AiRunSheetKind } from './ai-provenance-domain';

/* 12-UI-SPEC §2.4: a fast load shows no skeleton at all. */
export const SKELETON_DELAY_MS = 300;

/*
 * "What the AI used" (12-UI-SPEC §2, X-13; D-07, D-25): the frame, which opens at once, so its title takes focus and its
 * loading and error states show while the body's code is still on its way (WR-307). From 768px a side sheet at the form
 * dialog width; below, a full-screen sheet with a visible Close. Focus returns to the trigger on close.
 */
export function AiRunSheetFrame({ children, kind, onOpenChange, open, returnFocusTo, titleRef }: {
  children: ReactNode;
  kind: AiRunSheetKind;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <SheetPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content
          aria-describedby="ai-run-sheet-description"
          className={cn(
            'ai-run-sheet fixed inset-0 z-50 flex flex-col bg-surface shadow-overlay outline-none',
            'md:left-auto md:w-[min(640px,100vw)] md:border-l md:border-border',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-safe:md:data-[state=open]:slide-in-from-right motion-safe:md:data-[state=closed]:slide-out-to-right',
          )}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}
          onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4 md:px-6">
            <div className="grid gap-1">
              <SheetPrimitive.Title asChild>
                <h2 className="text-heading-sm text-foreground outline-none" ref={titleRef} tabIndex={-1}>What the AI used</h2>
              </SheetPrimitive.Title>
              <SheetPrimitive.Description className="text-sm text-foreground-secondary" id="ai-run-sheet-description">{aiRunSheetDescription(kind)}</SheetPrimitive.Description>
            </div>
            <SheetPrimitive.Close asChild>
              <Button aria-label="Close what the AI used" className="h-11 shrink-0 md:h-9" type="button" variant="outline">
                <X aria-hidden="true" className="hidden md:block" />
                <span className="md:sr-only">Close</span>
              </Button>
            </SheetPrimitive.Close>
          </div>
          <div aria-label="What the AI used, details" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-6" data-testid="ai-run-sheet-body" role="region" tabIndex={0}>
            {children}
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/* §2.4 Loading: the title, the description and four groups of label and value rows. */
export function AiRunSheetSkeleton() {
  return (
    <div aria-label="Loading what the AI used" className="grid gap-6" role="status">
      {[0, 1, 2, 3].map((group) => (
        <div className="grid gap-3" key={group}>
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/5" /></div>
        </div>
      ))}
    </div>
  );
}

export function AiRunSheetMessage({ action, description, title, tone }: { action?: ReactNode; description: string; title: string; tone?: 'error' }) {
  return (
    <div className="grid gap-2" role={tone === 'error' ? 'alert' : undefined}>
      <p className="flex items-center gap-2 font-medium text-foreground">{tone === 'error' ? <AlertCircle aria-hidden="true" className="size-4 text-destructive" /> : null}{title}</p>
      <p className="text-sm text-foreground-secondary">{description}</p>
      {action}
    </div>
  );
}

/* §2.4 Error: the run, or the code that shows it, could not be loaded. Try again loads it again and keeps focus on the title. */
export function AiRunSheetLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <AiRunSheetMessage
      action={<Button className="w-fit max-md:min-h-11" onClick={onRetry} type="button" variant="outline"><RotateCcw aria-hidden="true" />Try again</Button>}
      description="Please try again. If the problem continues, contact your administrator."
      title="We couldn’t load what the AI used"
      tone="error"
    />
  );
}
