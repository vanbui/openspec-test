import { MessageSquareDot } from 'lucide-react';

import { cn } from '@/lib/utils';

import { newNotesLabel, notesCopy } from './notes-domain';

/*
 * The X-17 unread marker. Unread is a personal fact, not a status, so it is ink (`--color-text-primary`) with words,
 * never a status hue, in `--text-caption` at 500. It stays for the view in which the items were first shown.
 */

/** One unread item: an 8px ink dot and `New`. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-foreground', className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-foreground" data-unread-dot="" />
      {notesCopy.unread}
    </span>
  );
}

/** A count of unread items: a 12px `MessageSquareDot` and `{k} new`; nothing at zero. */
export function UnreadCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-foreground tabular-nums', className)}>
      <MessageSquareDot aria-hidden="true" className="size-3 shrink-0" />
      {newNotesLabel(count)}
    </span>
  );
}
