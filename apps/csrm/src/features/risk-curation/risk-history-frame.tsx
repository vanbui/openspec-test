'use client';

import { AlertCircle, X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { RiskHistoryEvent } from './risk-curation-domain';

/*
 * The Risk history sheet's frame (16-UI-SPEC §8.1, §8.2, §8.5; X-13, X-29): it opens at once, so its title takes focus
 * and the loading state shows while the history's code and its first page are on their way. From 768px a side sheet at
 * the form dialog width; below, X-13's full-screen sheet with a visible `Close`, named `Close history`. `Escape` closes
 * it and focus returns to the control that opened it. The entries load with the body (risk-history-sheet.tsx), which the
 * trigger fetches on demand (D-48), so a page with History pills carries only this frame.
 */

/* §8.5: a fast load shows no skeleton at all. */
export const SKELETON_DELAY_MS = 300;

export const HISTORY_DESCRIPTION = 'Every change to this risk and its mitigation controls, newest first.';
export const HISTORY_LOAD_FAILED = { title: 'We couldn’t load the history', description: 'Please try again. If the problem continues, contact your administrator.' } as const;

/** What the sheet's body needs; the trigger passes it through the on-demand loader. */
export type RiskHistorySheetProps = {
  open: boolean;
  riskId: string;
  riskNumber: string;
  /** The session draft owner key, which keeps the density per person; null keeps it for this page only. */
  ownerKey: string | null;
  /** When the sheet opened (ms since the epoch), so the skeleton shows 300 ms after the open, not after the code arrived. */
  openedAt: number;
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** The link to an added proposal under AI proposals while it is listed (§8.3); null hides `Show in AI proposals`. */
  proposalHref?: (event: RiskHistoryEvent) => string | null;
  /** Loads the body's code again after it failed to arrive. */
  onReload: () => void;
};

export function RiskHistoryFrame({ children, onOpenChange, open, returnFocusTo, riskNumber, titleRef }: {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnFocusTo: RefObject<HTMLElement | null>;
  riskNumber: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <SheetPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-surface shadow-overlay outline-none',
            'md:left-auto md:w-[min(640px,100vw)] md:border-l md:border-border',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-safe:md:data-[state=open]:slide-in-from-right motion-safe:md:data-[state=closed]:slide-out-to-right',
          )}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnFocusTo.current;
            if (target?.isConnected) target.focus();
          }}
          onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4 md:px-6">
            <div className="grid min-w-0 gap-1">
              <SheetPrimitive.Title asChild>
                <h2 className="text-heading-sm text-foreground outline-none [overflow-wrap:anywhere]" ref={titleRef} tabIndex={-1}>{`History of ${riskNumber}`}</h2>
              </SheetPrimitive.Title>
              <SheetPrimitive.Description className="text-sm text-foreground-secondary">{HISTORY_DESCRIPTION}</SheetPrimitive.Description>
            </div>
            <SheetPrimitive.Close asChild>
              <Button aria-label="Close history" className="h-11 shrink-0 md:h-9" type="button" variant="outline">
                <X aria-hidden="true" className="hidden md:block" />
                <span className="md:sr-only">Close</span>
              </Button>
            </SheetPrimitive.Close>
          </div>
          <div aria-label={`History of ${riskNumber}, changes`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-6" role="region" tabIndex={0}>
            {children}
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/** Whether 300 ms have passed since `since` while `waiting` holds (§8.5's skeleton delay). */
export function useSkeletonDelay(waiting: boolean, since: number): boolean {
  const [late, setLate] = useState(() => waiting && Date.now() - since >= SKELETON_DELAY_MS);
  useEffect(() => {
    if (!waiting) {
      setLate(false);
      return undefined;
    }
    const remaining = SKELETON_DELAY_MS - (Date.now() - since);
    if (remaining <= 0) {
      setLate(true);
      return undefined;
    }
    const timer = setTimeout(() => setLate(true), remaining);
    return () => clearTimeout(timer);
  }, [waiting, since]);
  return late;
}

/* §8.5 Loading: three entry blocks, each with an icon, two lines and a three-row comparison (the frame holds the title). */
export function RiskHistorySkeleton() {
  return (
    <div aria-label="Loading the history" className="grid gap-4" role="status">
      <Skeleton className="h-4 w-24" />
      {[0, 1, 2].map((entry) => (
        <div className="grid gap-3 rounded-lg border border-border p-3" key={entry}>
          <div className="flex items-start gap-2">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
          </div>
          <div className="grid gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
        </div>
      ))}
    </div>
  );
}

/** The skeleton, 300 ms after `since`, while the body's code is on its way. */
export function DelayedRiskHistorySkeleton({ since }: { since: number }) {
  return useSkeletonDelay(true, since) ? <RiskHistorySkeleton /> : null;
}

/** §8.5's empty, error, permission and not-found states: a title, an optional line and an optional action. */
export function RiskHistoryMessage({ action, description, title, tone }: { action?: ReactNode; description?: string; title: string; tone?: 'error' }) {
  return (
    <div className="grid gap-2" role={tone === 'error' ? 'alert' : undefined}>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">{tone === 'error' ? <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" /> : null}{title}</p>
      {description ? <p className="text-sm text-foreground-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
