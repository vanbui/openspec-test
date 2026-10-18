import { CheckCircle2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { cn } from '@/lib/utils';
import {
  generationRequesterLine,
  openProposalsLine,
  outstandingProposalsLabel,
  questionnaireOriginLine,
  untrackedGenerationLine,
  type AiProvenanceHeaderProps,
} from './ai-provenance-domain';
import { AiRunSheetTrigger } from './ai-run-sheet-trigger';

/*
 * The provenance header (12-UI-SPEC §1, X-11; D-23). Rendered on the server and handed to the editor or the
 * questionnaire review as a slot, so it adds no client code beyond the sheet trigger. It prints, without its
 * action, so a printed record still says AI assisted.
 */
export function AiProvenanceHeader({ aiInputsChanged, className, kind, generation, openProposals, released, review }: AiProvenanceHeaderProps & {
  /**
   * Phase 13 D-29 (13-UI-SPEC §10.2): the "AI inputs changed" block, rendered on the server by the record page and handed
   * through as a slot, so this header, client code by its importers, carries none of its code. Its last block.
   */
  aiInputsChanged?: ReactNode;
  /** Spacing set by the page that places it: the editor's grid gives a gap, the questionnaire review a margin (walk D6). */
  className?: string;
}) {
  const details = [
    generation.providerName ? `Provider: ${generation.providerName}` : null,
    generation.providerVersion ? `Model: ${generation.providerVersion}` : null,
  ].filter((part): part is string => part !== null);
  const reviewLine = released ? null : <ReviewLine kind={kind} review={review} />;

  return (
    <section aria-label="AI generation" className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 text-foreground-secondary" />
          <p className="text-sm font-medium text-foreground">{generationRequesterLine(generation)}</p>
          <p className="col-start-2 text-xs text-foreground-secondary [overflow-wrap:anywhere]">
            {generation.generatedAt ? <LocalInstant style="date-time" value={generation.generatedAt} /> : null}
            {details.map((part, index) => <span key={part}>{index > 0 || generation.generatedAt ? ' · ' : ''}{part}</span>)}
          </p>
          {reviewLine ? <div className="col-start-2 mt-1">{reviewLine}</div> : null}
          {openProposals ? <a className="record-link col-start-2 w-fit text-sm tabular-nums" href="#ai-proposals">{openProposalsLine(openProposals)}</a> : null}
        </div>
        {generation.runId ? <AiRunSheetTrigger kind={kind} runId={generation.runId} /> : null}
      </div>
      {aiInputsChanged ? <div className="mt-4 border-t border-border pt-4">{aiInputsChanged}</div> : null}
    </section>
  );
}

function ReviewLine({ kind, review }: Pick<AiProvenanceHeaderProps, 'kind' | 'review'>) {
  if (review.kind === 'untracked') return <p className="text-sm text-foreground-secondary">{untrackedGenerationLine(kind)}</p>;
  if (review.kind === 'questionnaire-counts') {
    const line = questionnaireOriginLine(review);
    return line ? <p className="text-xs tabular-nums text-foreground-secondary">{line}</p> : null;
  }
  if (review.kind !== 'counts') return null;
  if (review.outstanding === 0) {
    return <p className="flex items-center gap-1.5 text-sm text-foreground"><CheckCircle2 aria-hidden="true" className="size-4 text-success" />All AI proposals reviewed</p>;
  }
  const label = outstandingProposalsLabel(review.outstanding);
  return review.firstDestination
    ? <a className="record-link text-sm tabular-nums" href={review.firstDestination}>{label}</a>
    : <p className="text-sm tabular-nums text-foreground">{label}</p>;
}
