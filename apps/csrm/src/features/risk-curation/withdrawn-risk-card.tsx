'use client';

import { ArchiveRestore, History } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Button } from '@/components/ui/button';
import type { AssessmentRating } from '@/features/assessments/assessment-schema';

import { curationFormId, riskCardId } from './risk-curation-domain';
import type { RiskWithdrawalFacts } from './use-risk-withdrawal';

/*
 * A withdrawn Risk's card (16-UI-SPEC §6.4; X-27; D-45, UI-D10): collapsed and read-only, on the surface with a hairline,
 * the large radius and 16px padding. The fact a reviewer needs first is in view: the `Withdrawn` badge, the residual
 * rating, the statement clamped to two lines (its full text stays in the DOM), the reason, and who withdrew it and when.
 * The shared read-only Risk and its mitigation controls are behind `Show details`. `Reinstate risk` is offered only
 * while the assessment can change; `History` always. Offering an act is a courtesy: Strapi decides it again.
 */
export type WithdrawnRisk = {
  readonly documentId: string;
  readonly riskNumber: string;
  readonly riskStatement: string | null;
  readonly residualRating: AssessmentRating | null;
  readonly withdrawal: RiskWithdrawalFacts;
};

export type WithdrawnRiskCardProps = {
  risk: WithdrawnRisk;
  /** Whether the assessment can change now, so the Risk can be reinstated. */
  editable: boolean;
  /** Opens the reinstate form; receives the control that opened it, so Keep withdrawn returns focus there. */
  onReinstate: (opener: HTMLElement | null) => void;
  /** Opens the history; receives the control that opened it. */
  onHistory: (opener: HTMLElement | null) => void;
  /** The shared read-only Risk and its mitigation controls (10 §15.2), shown by Show details. */
  details: ReactNode;
  /** The reinstate form, shown under the header while it is open. */
  form?: ReactNode;
  /** Whether the reinstate form is open, for the action's `aria-expanded`. */
  reinstateOpen?: boolean;
  /** Whether an act on this Risk is on its way: the §5 pending opacity. */
  pending?: boolean;
  headingLevel?: 3 | 4;
};

/* People are names (13-UI-SPEC); a person CSRM can no longer read is named by the role that withdraws (16-11's fallback). */
const withdrawnBy = (by: WithdrawnRisk['withdrawal']['by']): string => `Withdrawn by ${by?.displayName ?? 'a Security Analyst'} · `;

export function WithdrawnRiskCard({ details, editable, form, headingLevel = 3, onHistory, onReinstate, pending = false, reinstateOpen, risk }: WithdrawnRiskCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const id = useId();
  const headingId = `${id}-heading`;
  const detailsId = `${id}-details`;
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const action = 'max-md:min-h-11';

  return (
    <article
      aria-labelledby={headingId}
      className="grid gap-4 rounded-lg border border-border bg-surface p-4 transition-opacity duration-(--duration-base) ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[pending=true]:opacity-60 data-[pending=true]:transition-none"
      data-pending={pending}
      data-risk-card=""
      data-withdrawn=""
      id={riskCardId(risk.documentId)}
      tabIndex={-1}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Heading className="text-sm font-medium text-foreground" id={headingId}>{risk.riskNumber}</Heading>
        <StatusBadge family="risk" value="withdrawn" />
        {risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : null}
      </header>
      {form}
      {risk.riskStatement ? <p className="line-clamp-2 text-sm text-foreground [overflow-wrap:anywhere]">{risk.riskStatement}</p> : null}
      <div className="grid gap-1">
        <p className="text-sm text-foreground [overflow-wrap:anywhere]">{`Reason: “${risk.withdrawal.reason}”`}</p>
        <p className="text-xs text-foreground-secondary">{withdrawnBy(risk.withdrawal.by)}<LocalInstant style="date-time" value={risk.withdrawal.at} /></p>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-print="hidden">
        {editable ? (
          <Button aria-controls={curationFormId('reinstate', risk.documentId)} aria-expanded={reinstateOpen} aria-label={`Reinstate risk ${risk.riskNumber}`} className={action} onClick={(event) => onReinstate(event.currentTarget)} size="sm" type="button" variant="outline">
            <ArchiveRestore aria-hidden="true" />Reinstate risk
          </Button>
        ) : null}
        <Button aria-label={`History of ${risk.riskNumber}`} className={action} onClick={(event) => onHistory(event.currentTarget)} size="sm" type="button" variant="ghost">
          <History aria-hidden="true" />History
        </Button>
        <Button aria-controls={detailsId} aria-expanded={showDetails} className={action} onClick={() => setShowDetails(!showDetails)} size="sm" type="button" variant="outline">
          {showDetails ? 'Hide details' : 'Show details'}
        </Button>
      </div>
      <div hidden={!showDetails} id={detailsId}>{showDetails ? details : null}</div>
    </article>
  );
}
