'use client';

import { AlertCircle, Copy, GitCompareArrows, ListX, LoaderCircle, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useViewerTimeZone } from '@/components/csrm/local-time';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { treatmentActionNote } from '@/features/ai-assistance/ai-assistance-domain';
import { AiCitations } from '@/features/ai-assistance/ai-citations';
import { citationText } from '@/features/ai-assistance/ai-provenance-domain';
import { AiRunSheetTrigger } from '@/features/ai-assistance/ai-run-sheet-trigger';
import { AiUncitedClaims } from '@/features/ai-assistance/ai-uncited-claims';
import { FieldComparison } from '@/features/ai-assistance/field-comparison';
import { compareFields } from '@/features/ai-assistance/field-comparison-domain';
import type { AssessmentRating } from '@/features/assessments/assessment-schema';
import { controlLabel } from '@/features/assessments/control-label';
import { formatInstant } from '@/lib/time/format-instant';
import { readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { cn } from '@/lib/utils';
import {
  ACCEPT_NOT_ALLOWED_LINE,
  CURATION_REASON_MAX_LENGTH,
  fieldLabel,
  leftOutCount,
  leftOutLines,
  rejectRemainingId,
  RISK_RATINGS,
  similarityNote,
  type RiskAiProposalItem,
  type RiskAiRunFacts,
  type RiskAiSourceCitation,
  type SimilarityNote,
} from './risk-curation-domain';
import { proposalKey, type ProposalDensity } from './use-risk-proposal-decisions';

/*
 * Proposed risks (16-UI-SPEC §3; X-24, X-28; D-30 to D-33): the group one Suggest more risks request produced, each
 * proposed risk as a card with its statement, facts, ratings and treatment, the similarity note with its comparison, and
 * every proposed field behind `Show proposed details`. The AI's text renders as React text with its line breaks kept,
 * never markup (T-16-36). Loaded with the section's on-demand body (D-48).
 */

/* ---- Shared pieces: the instant, a value, the left-out list and the reason row ---- */

/** X-3 times in the viewer's zone. */
export function useInstant(): (value: string | null) => string {
  const zone = useViewerTimeZone();
  return (value) => (value ? formatInstant(value, { zone, style: 'date-time' }) ?? '' : '');
}

const formatCount = (count: number): string => count.toLocaleString('en-AU');

export const FIGURE_LINK_CLASS = 'record-link inline-flex min-h-6 w-fit items-center font-medium tabular-nums';

const isRating = (value: string | null | undefined): value is AssessmentRating => typeof value === 'string' && (RISK_RATINGS as readonly string[]).includes(value);

/** A proposed or current value as the editor shows it: a rating as its badge, anything else as text. */
export function RiskValue({ field, value, empty }: { field: string; value: string | null | undefined; empty: string }) {
  if ((field === 'inherentRating' || field === 'residualRating') && isRating(value)) return <RiskRatingBadge rating={value} />;
  return <>{value === null || value === undefined || value === '' ? empty : value}</>;
}

/** X-10: `{a} left out`, toggling the lines that account for every proposal the AI's reply lost. */
export function LeftOutList({ adjustments }: { adjustments: RiskAiRunFacts['adjustments'] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const count = leftOutCount(adjustments);
  if (count === 0) return null;
  return (
    <div className="grid gap-1">
      <button aria-controls={id} aria-expanded={open} className={cn(FIGURE_LINK_CLASS, 'text-xs')} onClick={() => setOpen(!open)} type="button">{`${formatCount(count)} left out`}</button>
      <ul className="grid list-disc gap-1 pl-5 text-xs text-foreground-secondary" hidden={!open} id={id}>
        {leftOutLines(adjustments).map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

const REASON_LABEL = 'Reason (optional)';
const REASON_HINT = 'The AI reads this next time, so it doesn’t propose the same again.';
const REASON_TOO_LONG = 'Keep the reason to 500 characters or fewer.';

/*
 * §5.3 and §5.4: the inline row (an X-5 well) that rejects with an optional reason, focus in its field. Enter rejects and
 * Escape keeps; the reason is kept for the session per person and proposal, and refused over 500 characters in the row.
 */
export function ReasonRow({ draft, keepLabel, onKeep, onReject, rejectLabel }: {
  draft: { ownerKey: string | null; recordId: string };
  rejectLabel: string;
  keepLabel: string;
  /** `recorded` clears the kept reason; the caller calls it once the rejection is recorded, so a refusal keeps it (FE4-10). */
  onReject: (reason: string | undefined, recorded: () => void) => void;
  onKeep: () => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState(() => (draft.ownerKey ? readSessionDraft('risk-reject-reason', draft.ownerKey, draft.recordId) ?? '' : ''));
  const [error, setError] = useState<string | null>(null);
  useUnloadWarning(reason.trim().length > 0);
  useEffect(() => { field.current?.focus(); }, []);

  function remember(value: string) {
    if (draft.ownerKey) writeSessionDraft('risk-reject-reason', draft.ownerKey, draft.recordId, value);
  }

  function keep() {
    remember('');
    onKeep();
  }

  function reject() {
    if (reason.trim().length > CURATION_REASON_MAX_LENGTH) {
      setError(REASON_TOO_LONG);
      field.current?.focus();
      return;
    }
    onReject(reason.trim() === '' ? undefined : reason.trim(), () => remember(''));
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      reject();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      keep();
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3" data-print="hidden">
      <Label htmlFor={id}>{REASON_LABEL}</Label>
      <p className="text-xs text-foreground-secondary" id={`${id}-hint`}>{REASON_HINT}</p>
      <Input
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        aria-invalid={error ? true : undefined}
        className="max-w-[640px]"
        id={id}
        onChange={(event) => { setReason(event.target.value); remember(event.target.value); }}
        onKeyDown={keyDown}
        ref={field}
        value={reason}
      />
      {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" id={`${id}-error`} role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{error}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row">
        <Button className="max-md:min-h-11" onClick={reject} size="sm" type="button" variant="outline">{rejectLabel}</Button>
        <Button className="max-md:min-h-11" onClick={keep} size="sm" type="button" variant="ghost">{keepLabel}</Button>
      </div>
    </div>
  );
}

/** X-12's `Sources` for a proposed statement, or the `No source cited` badge. */
export function ProposalSources({ requestId, sources, subject }: { requestId: string | null; sources: readonly RiskAiSourceCitation[]; subject: string }) {
  if (sources.length === 0) return <StatusBadge family="aiReview" value="uncited" />;
  if (requestId) return <AiCitations fieldLabel={subject} requestId={requestId} sources={sources} />;
  return (
    <div className="grid gap-1">
      <p className="micro-label text-foreground-secondary">Sources</p>
      <ul aria-label={`Sources for ${subject}`} className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
        {sources.map((source) => <li className="max-w-md truncate text-xs text-foreground-secondary" key={source.key}>{citationText(source)}</li>)}
      </ul>
    </div>
  );
}

/** 12 §3.5's treatment note: an Accept the AI proposed, or one that cannot stand now (§3.2, §4.4). */
export function treatmentNoteFor(item: Pick<RiskAiProposalItem, 'aiAccept' | 'acceptBlocked' | 'proposed'>, residual?: string | null): string | null {
  if (item.acceptBlocked !== null) return ACCEPT_NOT_ALLOWED_LINE;
  if (!item.aiAccept) return null;
  return treatmentActionNote(true, 'Accept', residual ?? item.proposed.residualRating ?? null, []);
}

/* ---- Proposed details (§3.4) ---- */

const DETAIL_GROUPS: readonly { readonly heading: string; readonly fields: readonly string[] }[] = [
  { heading: 'Statement', fields: ['issueStatement', 'riskStatement', 'riskCause', 'potentialImpact'] },
  { heading: 'Classification', fields: ['riskType', 'riskCategory', 'riskSubCategory', 'informationSystemImpacted', 'informationAssetImpacted', 'dataClassification'] },
  { heading: 'Ratings', fields: ['inherentLikelihood', 'highestInherentConsequence', 'inherentRating', 'inherentRatingRationale', 'residualLikelihood', 'highestResidualConsequence', 'residualRating', 'residualRatingRationale'] },
  { heading: 'Treatment', fields: ['treatmentAction', 'treatmentPlan'] },
];

const NOT_PROPOSED = 'Not proposed';

function Definition({ children, term }: { children: ReactNode; term: string }) {
  return (
    <div className="grid gap-0.5 md:grid-cols-[12rem_1fr] md:gap-3">
      <dt className="micro-label text-foreground-secondary">{term}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function ProposedDetails({ compactLines, id, item, requestId, subject }: { compactLines: ReactNode; id: string; item: RiskAiProposalItem; requestId: string | null; subject: string }) {
  return (
    <div className="grid gap-4" id={id}>
      {compactLines}
      {DETAIL_GROUPS.map((group) => (
        <section className="grid gap-2" key={group.heading}>
          <h4 className="micro-label text-foreground">{group.heading}</h4>
          <dl className="grid gap-2">
            {group.fields.map((field) => <Definition key={field} term={fieldLabel(field)}><RiskValue empty={NOT_PROPOSED} field={field} value={item.proposed[field]} /></Definition>)}
          </dl>
          {group.heading === 'Statement' ? <ProposalSources requestId={requestId} sources={item.sources} subject={subject} /> : null}
        </section>
      ))}
      <AiUncitedClaims claims={item.uncited} reviewOutstanding riskNumber="this proposed risk" />
      <section className="grid gap-2">
        <h4 className="micro-label text-foreground">Suggested controls</h4>
        {item.suggestedControls.length > 0
          ? <ul className="grid gap-1 text-sm text-foreground">{item.suggestedControls.map((control) => <li className="[overflow-wrap:anywhere]" key={control.controlNumber}>{controlLabel(control)}</li>)}</ul>
          : <p className="text-sm text-foreground-secondary">None suggested</p>}
      </section>
    </div>
  );
}

/* ---- Similar risks (§3.3; X-28) ---- */

/** The other record a proposed risk is compared with, once the page holds it; absent, no compare is offered. */
export type CompareTarget = { readonly before: string; readonly values: Readonly<Record<string, string | null>> };

const COMPARE_FIELDS = ['riskType', 'riskStatement', 'riskCause', 'potentialImpact', 'informationSystemImpacted', 'informationAssetImpacted', 'residualRating'] as const;
const NOT_RECORDED = 'Not recorded';

export function SimilarRiskCompare({ density, item, note, target }: { density: ProposalDensity; item: RiskAiProposalItem; note: SimilarityNote; target: CompareTarget | null }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const similar = item.similarTo;
  const noteText = similar?.kind === 'open' && similar.runId && similar.itemKey
    ? <a className="record-link" href={`#ai-proposal-${similar.runId}-${similar.itemKey}`}>{note.note}</a>
    : note.note;
  const rows = compareFields(COMPARE_FIELDS.map((field) => ({ label: fieldLabel(field), current: target?.values[field] || NOT_RECORDED, proposed: item.proposed[field] || NOT_RECORDED })));
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-1 text-xs text-foreground-secondary"><Copy aria-hidden="true" className="size-3 shrink-0" />{noteText}</p>
      {target && note.compareLabel ? (
        <>
          <Button aria-controls={id} aria-expanded={open} className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setOpen(!open)} size="sm" type="button" variant="outline">
            <GitCompareArrows aria-hidden="true" />{note.compareLabel}
          </Button>
          <div hidden={!open} id={id}>
            {open ? (
              <FieldComparison
                caption={`${note.compareLabel}: ${item.proposed.riskStatement ?? 'proposed risk'}`}
                columns={{ before: target.before, after: 'Proposed' }}
                density={density}
                renderEmphasis={(row, side) => (row.label === fieldLabel('residualRating') && isRating(side === 'current' ? row.current : row.proposed) ? <RiskRatingBadge rating={(side === 'current' ? row.current : row.proposed) as AssessmentRating} /> : null)}
                rows={rows}
                showSame
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---- The card (§3.2) ---- */

/** §3.2: the subject a proposed risk is named by: its Risk statement, else its Issue statement. */
export function proposedRiskSubject(item: Pick<RiskAiProposalItem, 'proposed'>): string {
  return item.proposed.riskStatement || item.proposed.issueStatement || 'Proposed risk';
}

/** §3.2's facts: the Risk Type (or `No Risk Type`), the system and the asset, omitting any that is absent. */
export function proposedRiskFacts(item: Pick<RiskAiProposalItem, 'proposed'>): string {
  return [item.proposed.riskType || 'No Risk Type', item.proposed.informationSystemImpacted, item.proposed.informationAssetImpacted].filter((part): part is string => Boolean(part)).join(' · ');
}

export type ProposedRiskCardProps = {
  item: RiskAiProposalItem;
  density: ProposalDensity;
  requestId: string | null;
  /** Whether the viewer may decide here (the read's `decide`, an editable assessment). */
  decide: boolean;
  /** This card's Add to assessment is waiting for the server. */
  adding: boolean;
  /** Another card's Add is waiting, so this one's actions wait too. */
  busy: boolean;
  /** The decision applied at once and not yet answered (§5 pending opacity). */
  pending: boolean;
  compareWith: CompareTarget | null;
  onAdd: (item: RiskAiProposalItem) => void;
  onReject: (item: RiskAiProposalItem, opener: HTMLElement) => void;
  onRejectDuplicate: (item: RiskAiProposalItem, note: SimilarityNote) => void;
  /** The reject row, while it is open under this card. */
  extra?: ReactNode;
};

export function ProposedRiskCard({ adding, busy, compareWith, decide, density, extra, item, onAdd, onReject, onRejectDuplicate, pending, requestId }: ProposedRiskCardProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const key = proposalKey(item);
  const subject = proposedRiskSubject(item);
  const compact = density === 'compact';
  const similar = similarityNote(item.similarTo);
  const note = treatmentNoteFor(item);
  const facts = <p className="text-xs text-foreground-secondary [overflow-wrap:anywhere]">{proposedRiskFacts(item)}</p>;
  const noteLine = note ? <p className="text-xs text-foreground-secondary">{note}</p> : null;
  const rating = (label: string, value: string | null | undefined) => (
    <span className="inline-flex items-center gap-2">
      {compact ? null : <span className="micro-label text-foreground-secondary">{label}</span>}
      {isRating(value) ? <RiskRatingBadge rating={value} /> : <span className="text-xs text-foreground-secondary">Not rated</span>}
    </span>
  );
  return (
    <li
      className={cn(
        'grid gap-3 rounded-lg border border-border bg-surface transition-opacity duration-(--duration-base) ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[pending=true]:opacity-60',
        compact ? 'p-3' : 'p-4',
      )}
      data-pending={pending || adding ? 'true' : undefined}
      id={`ai-proposal-${item.runId}-${item.itemKey}`}
      tabIndex={-1}
    >
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <p className="micro-label flex items-center gap-1 text-foreground-secondary"><Plus aria-hidden="true" className="size-3" />Proposed risk</p>
      </div>
      <p className="whitespace-pre-wrap text-sm font-medium text-foreground [overflow-wrap:anywhere]">{subject}</p>
      {compact ? null : facts}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {rating('Inherent', item.proposed.inherentRating)}
        {rating('Residual', item.proposed.residualRating)}
        {item.proposed.treatmentAction ? <span className="text-xs text-foreground-secondary">{`Treatment: ${item.proposed.treatmentAction}`}</span> : null}
      </div>
      {similar ? <SimilarRiskCompare density={density} item={item} note={similar} target={compareWith} /> : null}
      {compact ? null : noteLine}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center" data-print="hidden">
        <Button aria-controls={detailsId} aria-expanded={open} className="w-fit max-md:min-h-11" onClick={() => setOpen(!open)} size="sm" type="button" variant="outline">
          {open ? 'Hide proposed details' : 'Show proposed details'}
        </Button>
        {decide ? (
          <>
            <Button aria-label={adding ? undefined : `Add to assessment: ${subject}`} className="max-md:min-h-11" data-proposal-primary={key} disabled={busy && !adding} onClick={() => { if (!adding) onAdd(item); }} size="sm" type="button" variant="outline">
              {adding ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}{adding ? 'Adding…' : 'Add to assessment'}
            </Button>
            <Button aria-label={`Reject: ${subject}`} className="max-md:min-h-11" data-proposal-reject={key} disabled={busy} onClick={(event) => onReject(item, event.currentTarget)} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" />Reject
            </Button>
            {similar ? (
              <Button aria-label={`Reject as duplicate: ${subject}`} className="max-md:min-h-11" disabled={busy} onClick={() => onRejectDuplicate(item, similar)} size="sm" type="button" variant="ghost">
                <Copy aria-hidden="true" />Reject as duplicate
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {open ? <ProposedDetails compactLines={compact ? <>{facts}{noteLine}</> : null} id={detailsId} item={item} requestId={requestId} subject={subject} /> : <div hidden id={detailsId} />}
      {extra}
    </li>
  );
}

/* ---- The group (§3.1) ---- */

export function proposedRunHeading(run: Pick<RiskAiRunFacts, 'initiatedBy' | 'instruction'>): string {
  const name = run.initiatedBy?.displayName ?? 'A Security Analyst';
  return run.instruction ? `${name} asked the AI for more risks: “${run.instruction}”` : `${name} asked the AI for more risks`;
}

export function runFactsLine(run: Pick<RiskAiRunFacts, 'providerName' | 'providerVersion' | 'counts'>, instant: string, open: number): string {
  return [
    instant || null,
    run.providerName ? `Provider: ${run.providerName}` : null,
    run.providerVersion ? `Model: ${run.providerVersion}` : null,
    `${formatCount(open)} of ${formatCount(run.counts.items)} open`,
  ].filter((part): part is string => part !== null).join(' · ');
}

export function ProposedRiskGroup({ children, groupActions, open, run }: {
  run: RiskAiRunFacts;
  /** The group's open proposals, for `{k} of {n} open`. */
  open: number;
  /** `Reject remaining ({k})` and its row, when the viewer may decide. */
  groupActions?: ReactNode;
  children: ReactNode;
}) {
  const instant = useInstant();
  const headingId = `ai-run-${run.runId}-heading`;
  const at = instant(run.completedAt ?? run.startedAt);
  return (
    <article aria-labelledby={headingId} className="grid gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0" id={`ai-run-${run.runId}`}>
      <h3 className="line-clamp-3 text-sm font-medium text-foreground [overflow-wrap:anywhere]" id={headingId}>{proposedRunHeading(run)}</h3>
      <p className="text-xs tabular-nums text-foreground-secondary">{runFactsLine(run, at, open)}</p>
      <LeftOutList adjustments={run.adjustments} />
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center" data-print="hidden">
        <AiRunSheetTrigger kind="questionnaire-proposals" name={at ? `Show what the AI used for the request at ${at}` : undefined} runId={run.runId} />
        {groupActions}
      </div>
      <ol className="grid gap-3">{children}</ol>
    </article>
  );
}

/** §3.1 and §5.4: `Reject remaining ({k})`, named by the request's time. */
export function RejectRemainingButton({ count, expanded, instant, onClick, runId }: { count: number; expanded: boolean; instant: string; onClick: () => void; runId: string }) {
  return (
    <Button aria-controls={rejectRemainingId(runId)} aria-expanded={expanded} className="max-md:min-h-11" data-reject-remaining={runId} onClick={onClick} size="sm" type="button" variant="outline">
      <ListX aria-hidden="true" />{`Reject remaining (${formatCount(count)})`}
      {instant ? <span className="sr-only">{` from the request at ${instant}`}</span> : null}
    </Button>
  );
}
