'use client';

import { CheckCircle2Icon, ListChecksIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AiReviewProvenance } from './ai-assistance-domain';
import { reviewBarState } from './ai-assistance-domain';
import { outstandingProposalsLabel } from './ai-provenance-domain';

export function AiReviewBar({ changedFields, onConfirmRemaining, pending = false, place, provenance }: {
  changedFields: ReadonlySet<string>;
  onConfirmRemaining: (fields: readonly string[]) => void;
  pending?: boolean;
  place: { kind: 'assessment' } | { kind: 'risk'; number: string };
  provenance: AiReviewProvenance | null;
}) {
  if (!provenance || provenance.fields.length === 0) return null;
  const state = reviewBarState(provenance, changedFields);
  const assessment = place.kind === 'assessment';
  const name = assessment ? 'AI review for the assessment details' : `AI review for ${place.number}`;
  /*
   * §6.2's focus target is the status line. When every proposed field left has changed in the form, there is no count to
   * show (walk D11: never a count of zero), so the caption that says why is the status line. The count line's words come
   * from the provenance domain (UI-07); `· {k} without a source` follows it as a sibling caption (§3.2; UI-05).
   */
  const counted = state.complete || state.count > 0;
  const status = { 'data-ai-review-status': true, tabIndex: -1 } as const;
  return (
    // The pending opacity applies without a transition and eases back at --duration-base (12-UI-SPEC Motion).
    <div aria-label={name} className="grid min-w-0 gap-2 rounded-lg border border-border p-4 transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" data-pending={pending} role="group">
      <div className="min-w-0">
        {counted ? (
          <div className="flex flex-wrap items-center gap-1 tabular-nums">
            <p className="flex items-center gap-1 font-medium" {...status}>
              {state.complete ? <><CheckCircle2Icon aria-hidden="true" className="size-4 text-success" />All AI proposals reviewed</> : outstandingProposalsLabel(state.count)}
            </p>
            {state.uncited > 0 ? <p className="text-xs text-foreground-secondary">· {state.uncited} without a source</p> : null}
          </div>
        ) : null}
        {state.caption ? <p className="text-xs text-foreground-secondary" {...(counted ? {} : status)}>{state.caption}</p> : null}
      </div>
      {state.count > 0 ? <Button aria-label={assessment ? `Confirm remaining (${state.count}) in the assessment details` : `Confirm remaining (${state.count}) on ${place.number}`} className="min-h-11 w-full md:min-h-9 sm:w-auto" onClick={() => onConfirmRemaining(state.fields)} size="sm" type="button" variant="outline"><ListChecksIcon aria-hidden="true" />Confirm remaining ({state.count})</Button> : null}
    </div>
  );
}
