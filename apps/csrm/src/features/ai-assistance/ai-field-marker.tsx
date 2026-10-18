'use client';

import { CheckIcon, PenLineIcon } from 'lucide-react';

import { StatusBadge } from '@/components/csrm/status-badge';
import { Button } from '@/components/ui/button';
import type { AiMarkerState } from './ai-assistance-domain';

export function AiFieldMarker({ field, id, label, onConfirm, pending = false, state }: {
  /** The field's name. Confirm carries it, so focus can move to the next Confirm in field order (12-UI-SPEC §6.2). */
  field: string;
  id: string;
  label: string;
  onConfirm: () => void;
  pending?: boolean;
  state: AiMarkerState;
}) {
  if (!state) return null;
  const reviewed = state === 'accepted' || state === 'edited' || state === 'changed';
  return (
    /*
     * 12-UI-SPEC Motion: the pending opacity applies without a transition; leaving it eases back at --duration-base,
     * as a rollback does (§5 Optimistic UI).
     */
    <span className="inline-flex flex-wrap items-center gap-2 transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none" data-pending={pending}>
      <span id={id}>
        {state === 'proposed'
          ? <StatusBadge family="aiReview" value="proposed" />
          : <span className="inline-flex items-center gap-1 text-xs text-foreground-secondary">
              {state === 'accepted' ? <CheckIcon aria-hidden="true" className="size-3" /> : <PenLineIcon aria-hidden="true" className="size-3" />}
              {state === 'accepted' ? 'Confirmed' : state === 'changed' ? 'Edited, not saved' : 'Edited'}
            </span>}
      </span>
      {/* WR-306: the small button from 768px, and the touch-target height below it (direction §4 Buttons; 12-UI-SPEC §3.2). */}
      {!reviewed ? <Button aria-label={`Confirm ${label}`} className="max-md:min-h-11" data-ai-confirm={field} onClick={onConfirm} size="sm" type="button" variant="ghost"><CheckIcon aria-hidden="true" />Confirm</Button> : null}
    </span>
  );
}
