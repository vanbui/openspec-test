import { useId, type ReactNode } from 'react';

import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { cn } from '@/lib/utils';

import type { ActiveUser, AssessmentRiskListItem, ControlImplementation } from './assessment-schema';
import { controlLabel } from './control-label';

/*
 * One read-only Risk for both actors (D-34, UI-SPEC §15.2, UI-D20): the Requestor's released view and the
 * analyst's read-only editor render it, so a released Risk reads the same to everyone who may see it. It is
 * zod-free (types only from the schema module) and names every relation, never an internal id.
 */

/** Calendar dates (JDL LocalDate) carry no zone, so they format as the stored day (D-19). */
const calendarDateFormatter = new Intl.DateTimeFormat('en-AU', { dateStyle: 'long', timeZone: 'UTC' });

const NOT_RECORDED = 'Not recorded';

export function formatCalendarDate(value: string | null | undefined): string {
  return value ? calendarDateFormatter.format(new Date(value)) : NOT_RECORDED;
}

function text(value: string | null | undefined): string {
  return value?.trim() || NOT_RECORDED;
}

function personName(person: Pick<ActiveUser, 'displayName'> | null): string {
  return text(person?.displayName);
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
const WIDE = 'sm:col-span-2 lg:col-span-3';

function Row({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('grid min-w-0 gap-1', wide && WIDE)}>
      <dt className="micro-label text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words text-sm text-foreground', wide && 'whitespace-pre-wrap')}>{value}</dd>
    </div>
  );
}

function Group({ children, headingLevel, title }: { children: ReactNode; headingLevel: 3 | 4; title: string }) {
  const headingId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-3">
      <Heading className="text-heading-sm text-foreground" id={headingId}>{title}</Heading>
      {children}
    </section>
  );
}

function ControlImplementationDetails({ implementation }: { implementation: ControlImplementation }) {
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <dl className={GRID}>
        <Row label="Control" value={implementation.controlSummary ? controlLabel(implementation.controlSummary) : NOT_RECORDED} />
        <Row label="Control owner" value={personName(implementation.controlOwner)} />
        <Row label="Status" value={implementation.controlStatus ?? NOT_RECORDED} />
        <Row label="Effectiveness" value={implementation.effectivenessRating ?? NOT_RECORDED} />
        <Row label="Implementation due" value={formatCalendarDate(implementation.implementationDueDate)} />
        <Row label="Implemented" value={formatCalendarDate(implementation.implementedDate)} />
        <Row label="Review date" value={formatCalendarDate(implementation.reviewDate)} />
        <Row label="Evidence" value={text(implementation.evidence)} wide />
      </dl>
    </li>
  );
}

export type ReleasedRiskDetailsProps = {
  risk: AssessmentRiskListItem;
  implementations: readonly ControlImplementation[];
  /** The page decides: h4 under the released view's h3 Risk number, h3 in the analyst's read-only editor. */
  groupHeadingLevel: 3 | 4;
};

export function ReleasedRiskDetails({ groupHeadingLevel, implementations, risk }: ReleasedRiskDetailsProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <dl className={GRID}>
        <Row label="Information system impacted" value={text(risk.informationSystemImpacted?.name)} />
        <Row label="Information asset impacted" value={text(risk.informationAssetImpacted?.name)} />
      </dl>
      <Group headingLevel={groupHeadingLevel} title="Ratings">
        <dl className={GRID}>
          <Row label="Inherent likelihood" value={text(risk.inherentLikelihood)} />
          <Row label="Highest inherent consequence" value={text(risk.highestInherentConsequence)} />
          <Row label="Inherent risk rating" value={risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : NOT_RECORDED} />
          <Row label="Residual likelihood" value={text(risk.residualLikelihood)} />
          <Row label="Highest residual consequence" value={text(risk.highestResidualConsequence)} />
          <Row label="Residual risk rating" value={risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : NOT_RECORDED} />
        </dl>
      </Group>
      <Group headingLevel={groupHeadingLevel} title="Ownership and treatment">
        <dl className={GRID}>
          <Row label="Risk owner" value={personName(risk.riskOwner)} />
          <Row label="Treatment owner" value={personName(risk.treatmentOwner)} />
          <Row label="Treatment action" value={risk.treatmentAction ?? NOT_RECORDED} />
          <Row label="Treatment status" value={risk.treatmentStatus ? <StatusBadge family="treatment" value={risk.treatmentStatus} /> : NOT_RECORDED} />
          <Row label="Target date" value={formatCalendarDate(risk.targetDate)} />
          <Row label="Treatment plan" value={text(risk.treatmentPlan)} wide />
        </dl>
      </Group>
      <Group headingLevel={groupHeadingLevel} title="Mitigation control implementations">
        {implementations.length > 0
          ? <ul className="grid gap-3">{implementations.map((implementation) => <ControlImplementationDetails implementation={implementation} key={implementation.documentId} />)}</ul>
          : <p className="text-sm text-muted-foreground">No mitigation control implementations are recorded.</p>}
      </Group>
    </div>
  );
}
