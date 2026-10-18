'use client';

import { RotateCcw } from 'lucide-react';
import { Dialog as SheetPrimitive, Popover as PopoverPrimitive } from 'radix-ui';
import { useSyncExternalStore, type ReactNode, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AiCitationView } from './ai-provenance-domain';

/* 12-UI-SPEC §4.2: a fast load shows no skeleton at all. */
export const SKELETON_DELAY_MS = 300;

/* Below 768px the source is a bottom sheet (X-12). Without matchMedia (a test environment) it is the popover. */
const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

/*
 * The frame a citation's source opens in (12-UI-SPEC §4.2; D-03), which opens at once, so its title takes focus and its
 * loading and error states show while the source view's code is still on its way (WR-307). From 768px a popover
 * anchored to the citation, no wider than the 480px confirm dialog size and bounded by the viewport (direction §4
 * Dialogs, X-12; walk D7); below, a bottom sheet with a visible Close. Either frame's title is a panel title in
 * `--text-heading-sm`, as the run sheet's is (direction §4 Side sheet; UI-04). Focus returns to the citation.
 */
export function AiSourceFrame({ anchor, children, citation, onOpenChange, open, titleRef }: {
  anchor: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  citation: AiCitationView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const phone = useIsPhone();
  const focusTitle = (event: Event) => { event.preventDefault(); titleRef.current?.focus(); };
  const returnFocus = (event: Event) => { event.preventDefault(); anchor.current?.focus(); };
  const heading = <h2 className="text-heading-sm text-foreground outline-none" ref={titleRef} tabIndex={-1}>{citation.label}</h2>;

  if (phone) {
    return (
      <SheetPrimitive.Root onOpenChange={onOpenChange} open={open}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <SheetPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 grid max-h-[85vh] gap-3 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-surface p-4 shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:slide-in-from-bottom motion-safe:data-[state=closed]:slide-out-to-bottom"
            onCloseAutoFocus={returnFocus}
            onOpenAutoFocus={focusTitle}
          >
            <div className="flex items-start justify-between gap-3">
              <SheetPrimitive.Title asChild>{heading}</SheetPrimitive.Title>
              <SheetPrimitive.Close asChild>
                <Button aria-label="Close source" className="h-11 shrink-0" type="button" variant="outline">Close</Button>
              </SheetPrimitive.Close>
            </div>
            {children}
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>
    );
  }

  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <PopoverPrimitive.Anchor virtualRef={anchor as RefObject<HTMLButtonElement>} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          aria-label={citation.label}
          className="z-50 grid w-[min(480px,calc(100vw-2rem))] gap-2 rounded-lg border border-border bg-surface p-4 text-foreground shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          collisionPadding={16}
          onCloseAutoFocus={returnFocus}
          onOpenAutoFocus={focusTitle}
          role="dialog"
          sideOffset={6}
        >
          {heading}
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/* §4.2 Loading: a skeleton of a title line and three text lines; the title itself shows already. */
export function AiSourceSkeleton() {
  return <div aria-label="Loading this source" className="grid gap-2" role="status"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /></div>;
}

/* §4.2 Error: the source, or the code that shows it, could not be loaded; Try again (outline, small) loads it again. */
export function AiSourceLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-2" role="alert">
      <p className="text-sm text-foreground-secondary">We couldn’t load this source.</p>
      <Button className="max-md:min-h-11" onClick={onRetry} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Try again</Button>
    </div>
  );
}
