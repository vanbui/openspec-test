'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LocalInstant } from './local-time';

/*
 * Save status (design direction X-1, UI-SPEC §6.1). The saved state is a polite live region that is
 * present, empty, from the first render, so its first confirmation is announced. `Saving…` shows
 * visibly but is not announced. A failure is announced once with its recovery control. Colour is never
 * the only signal: every state has words, and the icons are decorative.
 */

export type SaveStatusValue =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  /** A plain message in the same polite region, with no icon: `No changes to save.` (UI-SPEC §13.4). */
  | { kind: 'note'; message: string }
  | { kind: 'failed'; failure: 'retryable' }
  | { kind: 'failed'; failure: 'blocked'; message: string };

export type SaveStatusProps = {
  status: SaveStatusValue;
  /** The saved sentence around the local time; `Saved at {time}` for autosave. */
  savedLabel?: (time: ReactNode) => ReactNode;
  onRetry?: () => void;
  onRefresh?: () => void;
  /**
   * False for a visual echo of a status announced elsewhere (UI-SPEC §6.1, beside Save draft): the echo
   * is hidden from assistive technology and carries no live region and no control.
   */
  announce?: boolean;
  className?: string;
};

const retryableMessage = 'Your latest answers weren’t saved.';
const iconClass = 'size-3.5 shrink-0';

export function SaveStatus({ status, savedLabel = (time) => <>Saved at {time}</>, onRetry, onRefresh, announce = true, className }: SaveStatusProps) {
  const saved = status.kind === 'saved'
    ? <><CheckCircle2 aria-hidden="true" className={cn(iconClass, 'text-success')} />{savedLabel(<LocalInstant style="time" value={status.at} />)}</>
    : status.kind === 'note' ? status.message : null;
  const failureMessage = status.kind === 'failed' ? (status.failure === 'blocked' ? status.message : retryableMessage) : null;
  const recovery = status.kind === 'failed' && announce
    ? (status.failure === 'blocked'
      ? (onRefresh ? <Button onClick={onRefresh} size="sm" type="button" variant="outline">Refresh page</Button> : null)
      : (onRetry ? <Button onClick={onRetry} size="sm" type="button" variant="outline">Retry save</Button> : null))
    : null;

  return (
    <div aria-hidden={announce ? undefined : true} className={cn('grid min-h-5 text-sm text-foreground-secondary', className)} data-save-status={status.kind}>
      {announce
        ? <p className="flex items-center gap-1.5" role="status">{saved}</p>
        : (saved ? <p className="flex items-center gap-1.5">{saved}</p> : null)}
      {status.kind === 'saving' ? <p>Saving…</p> : null}
      {failureMessage
        ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role={announce ? 'alert' : undefined}>
            <p className="flex items-start gap-1.5"><AlertCircle aria-hidden="true" className={cn(iconClass, 'mt-0.5 text-destructive')} />{failureMessage}</p>
            {recovery}
          </div>
        )
        : null}
    </div>
  );
}
