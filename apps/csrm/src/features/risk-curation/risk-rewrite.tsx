'use client';

import { Check, ListChecks, Undo2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { Button } from '@/components/ui/button';
import { AiRunSheetTrigger } from '@/features/ai-assistance/ai-run-sheet-trigger';
import { FieldComparison, type ComparisonGroup } from '@/features/ai-assistance/field-comparison';
import { compareFields, type ComparedRow } from '@/features/ai-assistance/field-comparison-domain';
import type { AssessmentRating } from '@/features/assessments/assessment-schema';
import { cn } from '@/lib/utils';
import { LeftOutList, ProposalSources, ReasonRow, RejectRemainingButton, runFactsLine, treatmentNoteFor, useInstant } from './proposed-risk-card';
import {
  acceptPreCheck,
  ACCEPT_NOT_ALLOWED_LINE,
  changeUnitLabel,
  decidedNote,
  fieldLabel,
  rejectRemainingId,
  RISK_RATINGS,
  riskCardId,
  type AcceptCheckRisk,
  type RiskAiProposalItem,
  type RiskAiRunFacts,
  type RiskPerson,
  type RiskProposalJob as RiskProposalJobView,
  type RiskRewriteFocus,
} from './risk-curation-domain';
import { DEFAULT_JOB_TIMING, isActiveJob, RiskProposalJob, type RiskProposalJobTiming } from './risk-proposal-job';
import { proposalKey, useRiskProposalDecisions, useRiskProposalDensity } from './use-risk-proposal-decisions';

/*
 * The `AI rewrite` section in a Risk card (16-UI-SPEC §4.2 to §4.5; X-24, X-28; D-34 to D-38, D-47). It is placed first in
 * the card and renders only while a rewrite is queued, running or failed, finished with nothing this page view, or has
 * open changes; never for the analyst who raised the request (its caller does not render it, §12.3). Each change is
 * X-24's comparison with X-28's decision cell: Confirm and Reject, Reject only when it changed since proposed or its
 * Accept is not allowed now, or the decided note with Undo. While the Risk form holds unsaved changes Confirm is withheld
 * (UI-D17). Loaded on demand by the editor with the proposals it shows (D-48).
 */

/** The Risk the section rewrites: its id and number, and the values the Accept pre-check reads (the form's or the served). */
export type RewriteRisk = {
  readonly id: string;
  readonly riskNumber: string;
  readonly values?: AcceptCheckRisk;
  readonly controlImplementations?: readonly { readonly controlStatus?: string | null }[];
};

export type RiskRewriteSectionProps = {
  assessmentId: string;
  risk: RewriteRisk;
  /** This Risk's changes from its latest rewrite, open and decided. */
  items: readonly RiskAiProposalItem[];
  /** The latest rewrite of this Risk, when one completed. */
  run: RiskAiRunFacts | null;
  /** This Risk's rewrite job while it is queued, running or failed. */
  job: RiskProposalJobView | null;
  formHasUnsavedChanges: boolean;
  ownerKey: string | null;
  requestId: string | null;
  viewer?: RiskPerson | null;
  /** Whether the viewer may decide (the read's `decide` on an editable assessment). */
  decide?: boolean;
  timing?: RiskProposalJobTiming;
  /** Where focus goes once every change is decided; by default the Risk card's first field. */
  focusFirstField?: () => HTMLElement | null;
  /** The job as the section last saw it, once it completed, failed or was retried, so the caller follows the server (FE4-05). */
  onJobChange?: (job: RiskProposalJobView) => void;
  /** FE4-01: the followed job is no longer known, so the caller stops counting it as running. */
  onJobGone?: (job: RiskProposalJobView) => void;
  /** FE4-03: the job the analyst just started from this card, whose status line takes focus once it shows. */
  focusJob?: string | null;
  /** The status line of `focusJob` took focus. */
  onJobFocused?: () => void;
};

const PART_NAMES: Readonly<Record<RiskRewriteFocus, string>> = { statement: 'Statement and cause', ratings: 'Ratings', treatment: 'Treatment' };
const LONG_TEXT = new Set(['issueStatement', 'riskStatement', 'riskCause', 'potentialImpact', 'inherentRatingRationale', 'residualRatingRationale', 'treatmentPlan']);
const STATEMENT_FIELDS = new Set(['issueStatement', 'riskStatement', 'riskCause', 'potentialImpact']);
const UNSAVED_LINE = 'Save or discard your changes to this risk before you confirm AI changes.';
const NOT_RECORDED = 'Not recorded';

const isRating = (value: string): value is AssessmentRating => (RISK_RATINGS as readonly string[]).includes(value);

/** §4.2: the group header's h4. */
export function rewriteRunHeading(run: Pick<RiskAiRunFacts, 'initiatedBy' | 'instruction'>, riskNumber: string): string {
  const name = run.initiatedBy?.displayName ?? 'A Security Analyst';
  return run.instruction ? `${name} asked the AI to rewrite ${riskNumber}: “${run.instruction}”` : `${name} asked the AI to rewrite ${riskNumber}`;
}

/** §4.2: `Focus: {parts}` when not all three parts were asked for. */
export function focusLine(focus: readonly RiskRewriteFocus[] | null): string | null {
  if (!focus || focus.length === 0 || focus.length === 3) return null;
  const ordered = (['statement', 'ratings', 'treatment'] as const).filter((part) => focus.includes(part));
  return `Focus: ${ordered.map((part) => PART_NAMES[part]).join(', ')}`;
}

/** The Risk card's first field, where focus goes once the rewrite is decided (§4.4, §5.5). */
function firstFieldOf(riskId: string): HTMLElement | null {
  return document.getElementById(riskCardId(riskId))?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[role="combobox"]') ?? null;
}

/*
 * §4.3 compact density: a proposed statement's sources behind `Show sources`. Both comparison layouts are in the markup,
 * so each toggle owns its id and names its holder, which stays in the page (Accessibility contract 4.1.2; UI-01).
 */
function SourcesToggle({ children, onToggle, shown }: { children: ReactNode; onToggle: () => void; shown: boolean }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Button aria-controls={id} aria-expanded={shown} className="w-fit max-md:min-h-11" data-print="hidden" onClick={onToggle} size="sm" type="button" variant="ghost">{shown ? 'Hide sources' : 'Show sources'}</Button>
      <div hidden={!shown} id={id}>{shown ? children : null}</div>
    </div>
  );
}

function DecidedCell({ item, onUndo, undoName }: { item: RiskAiProposalItem; onUndo: (() => void) | null; undoName: string }) {
  const instant = useInstant();
  const note = decidedNote(item);
  const Icon = note.icon === 'X' ? X : Check;
  const suffix = [note.byName, note.byName ? instant(note.at) : null].filter((part): part is string => Boolean(part)).map((part) => ` · ${part}`).join('');
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-center gap-1 text-xs text-foreground-secondary"><Icon aria-hidden="true" className="size-3 shrink-0" />{`${note.label}${suffix}`}</p>
      {note.reasonLine ? <p className="whitespace-pre-wrap text-xs text-foreground-secondary [overflow-wrap:anywhere]">{note.reasonLine}</p> : null}
      {onUndo ? <Button aria-label={undoName} className="w-fit max-md:min-h-11 max-md:w-full" data-print="hidden" onClick={onUndo} size="sm" type="button" variant="ghost"><Undo2 aria-hidden="true" />Undo</Button> : null}
    </div>
  );
}

export function RiskRewriteSection({ assessmentId, decide = true, focusFirstField, focusJob = null, formHasUnsavedChanges, items: served, job: seededJob, onJobChange, onJobFocused, onJobGone, ownerKey, requestId, risk, run, timing = DEFAULT_JOB_TIMING, viewer = null }: RiskRewriteSectionProps) {
  const router = useRouter();
  const instant = useInstant();
  const sectionRef = useRef<HTMLElement>(null);
  const [density] = useRiskProposalDensity(ownerKey);
  const [job, setJob] = useState<RiskProposalJobView | null>(seededJob);
  const [finishedRun, setFinishedRun] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectingAll, setRejectingAll] = useState(false);
  const [focusSelector, setFocusSelector] = useState<string | null>(null);
  const [focusSection, setFocusSection] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState<ReadonlySet<string>>(new Set());
  const number = risk.riskNumber;
  const seedKey = seededJob ? `${seededJob.jobId}:${seededJob.status}:${seededJob.attempt}` : null;

  useEffect(() => {
    if (seededJob && seededJob.status !== 'completed') setJob(seededJob);
    // Keyed on the job's content: a read hands the card a new object with the same job.
  }, [seedKey]);

  useHashLanding((id) => {
    if (id !== riskCardId(risk.id, '-rewrite')) return;
    if (sectionRef.current) landOn(sectionRef.current);
  });

  /* Kept while the served list is the same, so a decision applied at once holds until the page's next read replaces it. */
  const runId = run?.runId ?? null;
  const ownChanges = useMemo(() => served.filter((item) => item.kind === 'change' && item.riskId === risk.id && (runId === null || item.runId === runId)), [served, risk.id, runId]);
  const decisions = useRiskProposalDecisions({
    assessmentId,
    items: ownChanges,
    containerRef: sectionRef,
    fallbackFocus: () => (focusFirstField ?? (() => firstFieldOf(risk.id)))(),
    viewer,
    onChanged: async () => {
      router.refresh();
      return null;
    },
  });

  /* §5.5: focus returns to the control that opened a row, in the layout the breakpoint shows. */
  useEffect(() => {
    if (!focusSelector) return;
    const wide = window.matchMedia?.('(min-width: 768px)').matches ?? true;
    const target = [...(sectionRef.current?.querySelectorAll<HTMLElement>(focusSelector) ?? [])]
      .find((element) => (element.closest<HTMLElement>('[data-comparison-layout]')?.dataset.comparisonLayout ?? (wide ? 'table' : 'stacked')) === (wide ? 'table' : 'stacked'));
    if (!target) return;
    target.focus();
    setFocusSelector(null);
  });

  /* FE4-08: the section takes focus its completed job's status line held, once the section shows. */
  useEffect(() => {
    if (!focusSection || !sectionRef.current) return;
    sectionRef.current.focus();
    setFocusSection(false);
  });

  /* FE4-03 (§4.2): once the AI is asked, focus goes to this section's job status line, which is the polite status. */
  useEffect(() => {
    if (!focusJob || job?.jobId !== focusJob) return;
    const status = sectionRef.current?.querySelector<HTMLElement>('[data-risk-rewrite-status]');
    if (!status) return;
    status.focus();
    onJobFocused?.();
  });

  const changes = decisions.items.filter((item) => item.state === 'open' || item.state === 'accepted' || item.state === 'rejected');
  const open = changes.filter((item) => item.state === 'open');
  const running = isActiveJob(job);
  const failed = job?.status === 'failed';
  const finished = finishedRun !== null && run !== null && run.runId === finishedRun ? run : null;
  const nothing = finished?.outcome === 'no-change';
  if (!running && !failed && open.length === 0 && !nothing) return null;

  /* FE4-08: a status line that held focus leaves the section, so focus moves to the section or the failure's title. */
  function completed(done: RiskProposalJobView, hadFocus = false) {
    if (hadFocus) setFocusSection(true);
    setFinishedRun(done.runId);
    setJob(null);
    onJobChange?.(done);
    router.refresh();
  }

  function followed(next: RiskProposalJobView) {
    setJob(next);
    onJobChange?.(next);
  }

  function failedWhileFollowed(next: RiskProposalJobView, hadFocus: boolean) {
    followed(next);
    if (hadFocus) setFocusSelector('[data-proposal-job-failed]');
  }

  function gone(lost: RiskProposalJobView) {
    setJob(null);
    onJobGone?.(lost);
    router.refresh();
  }

  const preCheck = (item: RiskAiProposalItem) => item.acceptBlocked !== null || acceptPreCheck({ item, riskNow: risk.values ?? null, controlImplementations: risk.controlImplementations ?? [] }) !== null;
  const confirmable = open.filter((item) => item.stale !== true && !preCheck(item));
  const labelOf = (item: RiskAiProposalItem) => changeUnitLabel(item.unitKey ?? item.itemKey, item.fields);
  const showConfirm = decide && !formHasUnsavedChanges;

  function decisionCell(item: RiskAiProposalItem): ReactNode {
    const key = proposalKey(item);
    const label = labelOf(item);
    const context = { riskNumber: number, label };
    const pending = decisions.pending.has(key);
    if (item.state !== 'open') {
      const undoable = decide && item.canUndo;
      return <div className={cn('transition-opacity duration-(--duration-base) ease-standard', pending ? 'opacity-60' : null)}><DecidedCell item={item} onUndo={undoable ? () => decisions.undo(item, context) : null} undoName={`Undo: ${label} on ${number}`} /></div>;
    }
    const stale = item.stale === true;
    const blocked = !stale && preCheck(item);
    const confirmOffered = showConfirm && !stale && !blocked;
    return (
      <div className="grid gap-2" data-print="hidden">
        {stale ? (
          <>
            <StatusBadge family="aiReview" value="stale" />
            <p className="text-xs text-foreground-secondary">{`${label} has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.`}</p>
          </>
        ) : null}
        {blocked ? <p className="text-xs text-foreground-secondary">{ACCEPT_NOT_ALLOWED_LINE}</p> : null}
        {decide ? (
          <div className="flex flex-col gap-2">
            {confirmOffered ? (
              <Button aria-label={`Confirm: ${label} on ${number}`} className="max-md:min-h-11 max-md:w-full" data-proposal-primary={key} onClick={() => decisions.confirm(item, context)} size="sm" type="button" variant="outline">
                <Check aria-hidden="true" />Confirm
              </Button>
            ) : null}
            <Button aria-label={`Reject: ${label} on ${number}`} className="max-md:min-h-11 max-md:w-full" data-proposal-primary={confirmOffered ? undefined : key} data-proposal-reject={key} onClick={() => { setRejectingAll(false); setRejecting(key); }} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" />Reject
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const byLabel = new Map<string, RiskAiProposalItem>();
  const groups: ComparisonGroup[] = changes.map((item) => {
    const compared = compareFields(item.fields.map((field) => ({
      label: fieldLabel(field),
      current: item.current?.[field] || NOT_RECORDED,
      proposed: item.proposed[field] || NOT_RECORDED,
    })));
    /*
     * §4.4: a confirmed change's row stays in place. Strapi serves a change against the Risk as it is now, so once
     * confirmed its current value is the proposed one; it is still a change, never folded away as unchanged.
     */
    const rows = item.state === 'accepted' ? compared.map((row) => ({ ...row, changed: true })) : compared;
    for (const field of item.fields) byLabel.set(fieldLabel(field), item);
    return { key: proposalKey(item), label: labelOf(item), rows, decision: decisionCell(item) };
  });
  const fieldOf = (row: ComparedRow) => byLabel.get(row.label)?.fields.find((field) => fieldLabel(field) === row.label) ?? '';

  function afterValue(row: ComparedRow, side: 'current' | 'proposed'): ReactNode {
    if (side !== 'proposed') return null;
    const item = byLabel.get(row.label);
    if (!item) return null;
    const field = fieldOf(row);
    if (field === 'treatmentAction') {
      const note = treatmentNoteFor(item, item.proposed.residualRating ?? risk.values?.residualRating ?? null);
      return note && item.acceptBlocked === null && item.aiAccept ? <p className="text-xs text-foreground-secondary">{note}</p> : null;
    }
    if (!STATEMENT_FIELDS.has(field)) return null;
    const sources = <ProposalSources requestId={requestId} sources={item.sources} subject={`${row.label} on ${number}`} />;
    if (density !== 'compact') return sources;
    const key = proposalKey(item);
    const shown = sourcesOpen.has(key);
    const toggle = () => setSourcesOpen((current) => {
      const next = new Set(current);
      if (shown) next.delete(key);
      else next.add(key);
      return next;
    });
    return <SourcesToggle onToggle={toggle} shown={shown}>{sources}</SourcesToggle>;
  }

  const rejectingItem = rejecting ? open.find((item) => proposalKey(item) === rejecting) ?? null : null;
  const at = run ? instant(run.completedAt ?? run.startedAt) : '';
  const facts = run ? [runFactsLine(run, at, open.length), focusLine(run.focus)].filter((part): part is string => Boolean(part)).join(' · ') : '';
  const announcement = finished ? (nothing ? `The AI proposed no changes to ${number}.` : `AI changes to ${number} are ready to review.`) : '';

  return (
    <section aria-labelledby={riskCardId(risk.id, '-rewrite-heading')} className="grid gap-4 rounded-lg border border-border bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" id={riskCardId(risk.id, '-rewrite')} ref={sectionRef} tabIndex={-1}>
      <h3 className="text-heading-sm text-foreground" id={riskCardId(risk.id, '-rewrite-heading')}>AI rewrite</h3>
      {job && (running || failed) ? (
        <RiskProposalJob assessmentId={assessmentId} job={job} key={`${job.jobId}:${job.attempt}`} onCompleted={completed} onFailed={failedWhileFollowed} onGone={gone} onRetried={followed} riskNumber={number} statusAttribute="data-risk-rewrite-status" timing={timing} />
      ) : null}
      <p aria-live="polite" className={announcement ? 'text-sm font-medium text-foreground' : 'sr-only'}>{announcement}</p>
      {nothing && run ? <LeftOutList adjustments={run.adjustments} /> : null}
      {run && open.length > 0 ? (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <h4 className="line-clamp-3 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{rewriteRunHeading(run, number)}</h4>
            <p className="text-xs tabular-nums text-foreground-secondary">{facts}</p>
          </div>
          {formHasUnsavedChanges ? <p className="text-xs text-foreground-secondary">{UNSAVED_LINE}</p> : null}
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center" data-print="hidden">
            <AiRunSheetTrigger kind="questionnaire-proposals" name={at ? `Show what the AI used for the request at ${at}` : undefined} riskNumber={number} runId={run.runId} />
            {decide && showConfirm && confirmable.length > 0 ? (
              <Button className="max-md:min-h-11" onClick={() => decisions.confirmAll(confirmable, { riskNumber: number })} size="sm" type="button" variant="outline">
                <ListChecks aria-hidden="true" />{`Confirm all (${confirmable.length.toLocaleString('en-AU')})`}
              </Button>
            ) : null}
            {decide ? <RejectRemainingButton count={open.length} expanded={rejectingAll} instant={at} onClick={() => { setRejecting(null); setRejectingAll(true); }} runId={run.runId} /> : null}
          </div>
          {/* UI-01: the row's holder stays in the page, so Reject remaining's aria-controls always names it. */}
          <div hidden={!rejectingAll} id={rejectRemainingId(run.runId)}>
            {rejectingAll ? (
              <ReasonRow
                draft={{ ownerKey, recordId: `reject-remaining:${run.runId}` }}
                keepLabel="Keep changes"
                onKeep={() => { setRejectingAll(false); setFocusSelector(`[data-reject-remaining="${run.runId}"]`); }}
                onReject={(reason, recorded) => { setRejectingAll(false); decisions.reject(open, { act: 'reject-remaining', ...(reason === undefined ? {} : { reason }), riskNumber: number, target: 'changes', onSuccess: recorded }); }}
                rejectLabel={`Reject ${open.length.toLocaleString('en-AU')} ${open.length === 1 ? 'change' : 'changes'}`}
              />
            ) : null}
          </div>
          <FieldComparison
            afterValue={afterValue}
            caption={`AI changes proposed for ${number}`}
            density={density}
            emphasis={(row) => LONG_TEXT.has(fieldOf(row))}
            groups={groups}
            renderEmphasis={(row, side) => {
              const field = fieldOf(row);
              const value = side === 'current' ? row.current : row.proposed;
              return (field === 'inherentRating' || field === 'residualRating') && isRating(value) ? <RiskRatingBadge rating={value} /> : null;
            }}
          />
          {rejectingItem ? (
            <ReasonRow
              draft={{ ownerKey, recordId: `reject:${proposalKey(rejectingItem)}` }}
              keepLabel="Keep proposal"
              onKeep={() => { setRejecting(null); setFocusSelector(`[data-proposal-reject="${proposalKey(rejectingItem)}"]`); }}
              onReject={(reason, recorded) => {
                setRejecting(null);
                decisions.reject([rejectingItem], { act: 'reject', ...(reason === undefined ? {} : { reason }), riskNumber: number, label: labelOf(rejectingItem), target: 'changes', onSuccess: recorded });
              }}
              rejectLabel="Reject proposal"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
