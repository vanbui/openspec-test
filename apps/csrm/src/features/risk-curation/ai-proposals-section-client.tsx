'use client';

import { AlertCircle, Archive, Check, ChevronDown, ChevronUp, CircleCheck, ListRestart, LoaderCircle, Lock, Plus, Sparkles, Undo2, X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { RecordLink } from '@/components/csrm/record-link';
import { SegmentedControl } from '@/components/csrm/segmented-control';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { Button } from '@/components/ui/button';
import type { AiPolicyStatus } from '@/features/ai-assistance/ai-assistance-domain';
import { AiPolicyGate } from '@/features/ai-assistance/ai-policy-gate';
import { InstructionField, ShortcutHint } from '@/features/questionnaire-ai/instruction-field';
import { writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { ProposalsReadError } from './ai-proposals-section-loader';
import {
  LeftOutList,
  ProposedRiskCard,
  ProposedRiskGroup,
  proposedRiskSubject,
  ReasonRow,
  RejectRemainingButton,
  useInstant,
  type CompareTarget,
} from './proposed-risk-card';
import { readRiskAiProposalsAction, startRiskSuggestionsAction } from './risk-curation-actions';
import {
  changeUnitLabel,
  decidedNote,
  proposalsStatusLine,
  rejectRemainingId,
  rewriteDecidedSummary,
  riskCardHref,
  similarityNote,
  type DecidedNoteIcon,
  type ProposalsAssessmentState,
  type RiskAiProposalItem,
  type RiskAiProposals,
  type RiskAiRunFacts,
  type RiskPerson,
  type RiskProposalJob as RiskProposalJobView,
  type SimilarityNote,
} from './risk-curation-domain';
import { riskAiStartRefusal } from './risk-curation-refusal-copy';
import { subscribeToRiskSuggestionHandoff, takeRiskSuggestionJob } from './risk-proposal-job-handoff';
import { DEFAULT_JOB_TIMING, isActiveJob, RiskProposalJob, type RiskProposalJobTiming } from './risk-proposal-job';
import { proposalKey, useIsWide, useRiskProposalDecisions, useRiskProposalDensity } from './use-risk-proposal-decisions';

/*
 * The `AI proposals` section's interactive body (16-UI-SPEC §2, §3, §5; D-30 to D-33, D-39 to D-41, D-45 to D-47), loaded
 * on demand by `AiProposalsSectionLoader` (D-48). In order: the status line and density, the start form or the job, the
 * open proposed-risk groups newest first, `Open AI rewrites` (so the section indexes every open proposal, X-10), and the
 * collapsed `Decided proposals`. Below 768px it is a summary card that opens a full-screen sheet holding the same body.
 * The page serves the proposals read; the section reads it again after each act and job (D-41). Every control is a
 * courtesy: Strapi decides each act again.
 */

/** A Risk on the page, by its id and number, with its values once loaded (for `Compare with …` and the index). */
export type ProposalRiskRef = { readonly id: string; readonly riskNumber: string; readonly values?: Readonly<Record<string, string | null>> };

export type AiProposalsSectionClientProps = {
  assessmentId: string;
  /** §2.4: `editable`, `released` or `not-editable`; the requesting analyst's state never renders this body. */
  state: ProposalsAssessmentState;
  /** The page's proposals read; when absent the section reads it itself. */
  proposals?: RiskAiProposals | null;
  ownerKey: string | null;
  requestId: string | null;
  viewer?: RiskPerson | null;
  /** 12 §11.1: a refused policy shows its alert in place of the start form; decisions stay. */
  policy?: AiPolicyStatus | null;
  risks?: readonly ProposalRiskRef[];
  timing?: RiskProposalJobTiming;
};

/* ---- Copy (§2.2, §2.3, §2.5, §2.6, §2.7, §3.6) ---- */

const START_HINT = 'Say what to look for, for example “Risks about payment file integrity”. The AI already reads the request, its answers, the marked notes and files, and the risks already in this assessment, withdrawn or rejected, so it doesn’t repeat them.';
const FIRST_USE = { title: 'No AI proposals yet', body: 'Ask the AI for risks this assessment may be missing, or give it an instruction such as “Risks about payment file integrity”.' } as const;
const CLEARED = { title: 'No open AI proposals', body: 'Every proposal has been decided. They’re listed under Decided proposals.' } as const;
const NOTHING_PROPOSED = 'The AI proposed no new risks for this assessment.';
const CLOSED_WHEN_FINISHED = 'The assessment could no longer be changed when the AI finished, so its proposals were closed without a decision.';
const SUGGEST = 'Suggest more risks';
const ASKING = 'Asking the AI…';

function readyLine(count: number): string {
  return count === 1 ? '1 proposed risk is ready to review.' : `${count.toLocaleString('en-AU')} proposed risks are ready to review.`;
}

function changesToReview(count: number): string {
  return `${count.toLocaleString('en-AU')} AI ${count === 1 ? 'change' : 'changes'} to review`;
}

/* ---- The start form (§2.2; X-25) ---- */

export function ProposalsStartForm({ assessmentId, fieldRef, onStarted, ownerKey }: {
  assessmentId: string;
  ownerKey: string | null;
  onStarted: (job: RiskProposalJobView) => void;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [instruction, setInstruction] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ownField = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? ownField;

  async function submit() {
    if (pending) return;
    setFieldError(null);
    setFormError(null);
    setPending(true);
    try {
      const result = await startRiskSuggestionsAction({ assessmentId, instruction });
      if (!result.ok) {
        if (result.kind === 'field') {
          setFieldError(result.message);
          field.current?.focus();
        } else setFormError(result.message);
        return;
      }
      setInstruction('');
      if (ownerKey) writeSessionDraft('risk-suggest-instruction', ownerKey, assessmentId, '');
      onStarted(result.data);
    } catch {
      setFormError(riskAiStartRefusal({}).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-3" data-print="hidden" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <InstructionField draft={{ kind: 'risk-suggest-instruction', recordId: assessmentId, ownerKey }} error={fieldError} fieldRef={field} hint={START_HINT} id="ai-proposals-instruction" onChange={setInstruction} onSubmitShortcut={() => void submit()} value={instruction} />
      {formError ? <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{formError}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button aria-disabled={pending ? true : undefined} className="w-full max-md:min-h-11 md:w-fit" type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
          {pending ? ASKING : SUGGEST}
        </Button>
        <ShortcutHint />
      </div>
    </form>
  );
}

/* ---- Open AI rewrites (§2.5) ---- */

export function OpenRewritesIndex({ items, onFollow, risks }: { items: readonly RiskAiProposalItem[]; risks: readonly ProposalRiskRef[]; onFollow?: () => void }) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'change' && item.state === 'open' && item.riskId) counts.set(item.riskId, (counts.get(item.riskId) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return (
    <section aria-labelledby="ai-proposals-open-rewrites" className="grid gap-2">
      <h3 className="text-sm font-medium text-foreground" id="ai-proposals-open-rewrites">Open AI rewrites</h3>
      <ul className="grid gap-1">
        {[...counts].map(([riskId, count]) => {
          const number = risks.find((risk) => risk.id === riskId)?.riskNumber ?? 'Risk';
          return (
            <li key={riskId}>
              <RecordLink className="text-sm tabular-nums" href={riskCardHref(riskId, '-rewrite')} onClick={onFollow}>{`${number} · ${changesToReview(count)}`}</RecordLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---- Decided proposals (§3.6) ---- */

const noteIcons: Record<DecidedNoteIcon, typeof Check> = { Plus, X, Check, Lock, ListRestart, Archive };

type DecidedEntry =
  | { readonly kind: 'risk'; readonly item: RiskAiProposalItem; readonly at: number }
  | { readonly kind: 'rewrite'; readonly runId: string; readonly riskId: string | null; readonly items: readonly RiskAiProposalItem[]; readonly at: number };

const decidedAt = (item: RiskAiProposalItem): number => (item.decision ? Date.parse(item.decision.at) || 0 : 0);

/** Proposed risks one per entry and rewrites one per request, once no change of that request is open; newest first. */
export function decidedEntries(items: readonly RiskAiProposalItem[]): DecidedEntry[] {
  const entries: DecidedEntry[] = items.filter((item) => item.kind === 'risk' && item.state !== 'open').map((item) => ({ kind: 'risk', item, at: decidedAt(item) }));
  const runs = new Map<string, RiskAiProposalItem[]>();
  for (const item of items) if (item.kind === 'change') runs.set(item.runId, [...(runs.get(item.runId) ?? []), item]);
  for (const [runId, changes] of runs) {
    if (changes.some((item) => item.state === 'open')) continue;
    entries.push({ kind: 'rewrite', runId, riskId: changes[0]?.riskId ?? null, items: changes, at: Math.max(...changes.map(decidedAt)) });
  }
  return entries.sort((a, b) => b.at - a.at);
}

function DecidedNoteLine({ item, riskNumber }: { item: RiskAiProposalItem; riskNumber: string | null }) {
  const instant = useInstant();
  const note = decidedNote(item, { riskNumber });
  const Icon = noteIcons[note.icon];
  const suffix = [note.byName, note.byName ? instant(note.at) : null].filter((part): part is string => Boolean(part)).map((part) => ` · ${part}`).join('');
  const added = item.kind === 'risk' && item.state === 'accepted' && item.addedRisk?.riskNumber ? item.addedRisk : null;
  return (
    <>
      <p className="flex flex-wrap items-center gap-1 text-xs text-foreground-secondary">
        <Icon aria-hidden="true" className="size-3 shrink-0" />
        {added ? <span>Added as <RecordLink className="text-xs" href={riskCardHref(added.riskId)}>{added.riskNumber}</RecordLink></span> : <span>{note.label}</span>}
        {suffix ? <span>{suffix}</span> : null}
      </p>
      {note.reasonLine ? <p className="whitespace-pre-wrap text-xs text-foreground-secondary [overflow-wrap:anywhere]">{note.reasonLine}</p> : null}
    </>
  );
}

function UndoButton({ name, onUndo, proposal }: { name: string; onUndo: () => void; proposal: string }) {
  return <Button aria-label={`Undo: ${name}`} className="w-fit max-md:min-h-11" data-print="hidden" data-proposal-undo={proposal} onClick={onUndo} size="sm" type="button" variant="ghost"><Undo2 aria-hidden="true" />Undo</Button>;
}

function DecidedRewrite({ canUndo, entry, onUndo, riskNumber }: { entry: Extract<DecidedEntry, { kind: 'rewrite' }>; riskNumber: string | null; canUndo: (item: RiskAiProposalItem) => boolean; onUndo: (item: RiskAiProposalItem, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const counts = {
    confirmed: entry.items.filter((item) => item.state === 'accepted').length,
    rejected: entry.items.filter((item) => item.state === 'rejected').length,
    closed: entry.items.filter((item) => item.state === 'superseded' || item.state === 'lapsed').length,
  };
  return (
    <>
      <p className="text-sm font-medium text-foreground">{`AI rewrite of ${riskNumber ?? 'a risk'}`}</p>
      <p className="text-xs tabular-nums text-foreground-secondary">{rewriteDecidedSummary(counts)}</p>
      <Button aria-controls={id} aria-expanded={open} className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setOpen(!open)} size="sm" type="button" variant="outline">{open ? 'Hide changes' : 'Show changes'}</Button>
      <ul className="grid gap-2" hidden={!open} id={id}>
        {entry.items.map((item) => {
          const label = changeUnitLabel(item.unitKey ?? item.itemKey, item.fields);
          return (
            <li className="grid gap-1" key={proposalKey(item)}>
              <p className="micro-label text-foreground">{label}</p>
              <DecidedNoteLine item={item} riskNumber={riskNumber} />
              {canUndo(item) ? <UndoButton name={`${label} on ${riskNumber ?? 'the risk'}`} onUndo={() => onUndo(item, label)} proposal={proposalKey(item)} /> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function RiskDecidedProposals({ canUndo, items, onUndo, riskNumberOf }: {
  items: readonly RiskAiProposalItem[];
  canUndo: (item: RiskAiProposalItem) => boolean;
  onUndo: (item: RiskAiProposalItem, label: string | null, riskNumber: string | null) => void;
  riskNumberOf: (riskId: string | null) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const entries = decidedEntries(items);
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3">
      <Button aria-controls={listId} aria-expanded={open} className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setOpen(!open)} size="sm" type="button" variant="outline">
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        {open ? 'Hide decided proposals' : `Show decided proposals (${entries.length.toLocaleString('en-AU')})`}
      </Button>
      <ol className="grid gap-2" hidden={!open} id={listId}>
        {entries.map((entry) => {
          if (entry.kind === 'rewrite') {
            const riskNumber = riskNumberOf(entry.riskId);
            return (
              <li className="grid gap-1 rounded-lg border border-border bg-surface p-3" key={`run:${entry.runId}`}>
                <DecidedRewrite canUndo={canUndo} entry={entry} onUndo={(item, label) => onUndo(item, label, riskNumber)} riskNumber={riskNumber} />
              </li>
            );
          }
          const subject = proposedRiskSubject(entry.item);
          return (
            <li className="grid gap-1 rounded-lg border border-border bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" id={`ai-proposal-${entry.item.runId}-${entry.item.itemKey}`} key={proposalKey(entry.item)} tabIndex={-1}>
              <p className="micro-label flex items-center gap-1 text-foreground-secondary"><Plus aria-hidden="true" className="size-3" />Proposed risk</p>
              <p className="whitespace-pre-wrap text-sm font-medium text-foreground [overflow-wrap:anywhere]">{subject}</p>
              <DecidedNoteLine item={entry.item} riskNumber={null} />
              {canUndo(entry.item) ? <UndoButton name={subject} onUndo={() => onUndo(entry.item, null, null)} proposal={proposalKey(entry.item)} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---- Phones (§2.6; D-47) ---- */

export function ProposalsPhoneSummary({ job, onReview, onSuggest, showReview, showSuggest }: {
  /** The job status and its announcement, followed by the section whether or not the sheet is open (FE4-02). */
  job: ReactNode;
  showReview: boolean;
  showSuggest: boolean;
  onReview: (opener: HTMLElement) => void;
  onSuggest: (opener: HTMLElement) => void;
}) {
  return (
    <div className="grid gap-3" data-print="hidden">
      {job}
      {showReview ? <Button className="min-h-11 w-full" onClick={(event) => onReview(event.currentTarget)} type="button" variant="outline">Review AI proposals</Button> : null}
      {showSuggest ? <Button className="min-h-11 w-full" onClick={(event) => onSuggest(event.currentTarget)} type="button"><Sparkles aria-hidden="true" />{SUGGEST}</Button> : null}
    </div>
  );
}

function ProposalsSheet({ children, focus, onOpenChange, open, returnFocusTo, skipReturn }: {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus: 'title' | 'instruction';
  returnFocusTo: RefObject<HTMLElement | null>;
  skipReturn: RefObject<boolean>;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <SheetPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-surface shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          data-ai-proposals-sheet=""
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (skipReturn.current) {
              skipReturn.current = false;
              return;
            }
            const target = returnFocusTo.current;
            if (target?.isConnected) target.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const field = focus === 'instruction' ? document.getElementById('ai-proposals-instruction') : null;
            (field ?? title.current)?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <SheetPrimitive.Title asChild><h2 className="text-heading-sm text-foreground outline-none" data-ai-proposals-sheet-title="" ref={title} tabIndex={-1}>AI proposals</h2></SheetPrimitive.Title>
            <SheetPrimitive.Close asChild><Button aria-label="Close AI proposals" className="h-11 shrink-0" type="button" variant="outline">Close</Button></SheetPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/* ---- The section's body ---- */

const DENSITY_OPTIONS = [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] as const;

/** The section's own job: the latest Suggest more risks request that is waiting, running or failed. */
function sectionJobOf(view: RiskAiProposals | null): RiskProposalJobView | null {
  return view?.jobs.find((job) => job.operation === 'risk-suggestions' && job.status !== 'completed') ?? null;
}

const jobKey = (job: RiskProposalJobView | null) => (job ? `${job.jobId}:${job.status}:${job.attempt}` : null);

export function AiProposalsSectionClient({ assessmentId, ownerKey, policy = null, proposals, requestId, risks = [], state, timing = DEFAULT_JOB_TIMING, viewer = null }: AiProposalsSectionClientProps) {
  const router = useRouter();
  const instant = useInstant();
  const [view, setView] = useState<RiskAiProposals | null>(proposals ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide();
  const [density, setDensity] = useRiskProposalDensity(ownerKey);
  const [job, setJob] = useState<RiskProposalJobView | null>(() => sectionJobOf(proposals ?? null));
  const [finishedRun, setFinishedRun] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectingRun, setRejectingRun] = useState<string | null>(null);
  const [focusSelector, setFocusSelector] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; focus: 'title' | 'instruction' }>({ open: false, focus: 'title' });
  const opener = useRef<HTMLElement | null>(null);
  const skipReturn = useRef(false);
  /* FE4-02: below 768px the job shows in the summary, or in the sheet while it is open; the section follows it either way. */
  const [summarySlot, setSummarySlot] = useState<HTMLElement | null>(null);
  const [sheetSlot, setSheetSlot] = useState<HTMLElement | null>(null);

  /* The page's read wins whenever the page is read again (a refresh after an act elsewhere). */
  useEffect(() => {
    if (proposals) setView(proposals);
  }, [proposals]);

  /* The view as last committed, so a failed read can tell whether there is anything to keep showing. */
  const shownView = useRef(view);
  shownView.current = view;
  const reload = useCallback(async (): Promise<RiskAiProposals | null> => {
    let result: Awaited<ReturnType<typeof readRiskAiProposalsAction>> | null = null;
    try {
      result = (await readRiskAiProposalsAction({ assessmentId })) ?? null;
    } catch {
      result = null;
    }
    if (result === null || !result.ok) {
      /* §2.7: a failed read keeps what is shown; with nothing shown yet, the compact error offers Try again. */
      if (shownView.current === null) setLoadFailed(true);
      return null;
    }
    setLoadFailed(false);
    setView(result.data);
    return result.data;
  }, [assessmentId]);

  /* Read on demand when the page did not serve the read (D-41). */
  useEffect(() => {
    if (!proposals) void reload();
    // Only on opening: later reads follow each act.
  }, []);

  /* A job the page's read serves (another analyst's, or one started before this view) is followed in place. */
  const seed = sectionJobOf(view);
  const seedKey = jobKey(seed);
  useEffect(() => {
    if (seed && seed.status !== 'completed') setJob(seed);
    // Keyed on the job's content: a read hands the section a new object with the same job.
  }, [seedKey]);

  /* A start from the AI inputs signal (§10.2) hands its job here and lands focus on the job status line. */
  useEffect(() => {
    const receive = () => {
      const handed = takeRiskSuggestionJob(assessmentId);
      if (!handed) return;
      started(handed);
    };
    const unsubscribe = subscribeToRiskSuggestionHandoff(receive);
    receive();
    return unsubscribe;
  }, [assessmentId]);

  /* §5.5: focus returns to the control that opened a row, once the row has closed. */
  useEffect(() => {
    if (!focusSelector) return;
    const target = document.querySelector<HTMLElement>(focusSelector);
    if (!target) return;
    target.focus();
    setFocusSelector(null);
  });

  useHashLanding((id) => {
    if (!id.startsWith('ai-proposal-') && !id.startsWith('ai-run-')) return;
    const target = document.getElementById(id);
    if (target) landOn(target);
  });

  const decisions = useRiskProposalDecisions({
    assessmentId,
    items: view?.items ?? [],
    containerRef: bodyRef,
    fallbackFocus: () => document.querySelector<HTMLElement>('[data-ai-proposals-status]'),
    viewer,
    onChanged: async () => {
      const next = await reload();
      return next;
    },
  });

  function started(next: RiskProposalJobView) {
    setFinishedRun(null);
    setJob(next);
    setFocusSelector('[data-ai-proposals-job-status]');
  }

  /*
   * FE4-08: a status line that held focus leaves the page when its job completes or fails, so focus moves to the section's
   * status line (the sheet's title inside the phone sheet) or to the failure's title. Focus held elsewhere stays put.
   */
  function completed(done: RiskProposalJobView, hadFocus = false) {
    if (hadFocus) setFocusSelector(document.activeElement?.closest('[data-ai-proposals-sheet]') ? '[data-ai-proposals-sheet-title]' : '[data-ai-proposals-status]');
    setFinishedRun(done.runId);
    setJob(null);
    void reload();
    router.refresh();
  }

  /* FE4-01 (§2.3): a job that failed or is gone while followed is no longer running, so the start form returns. */
  function failed(next: RiskProposalJobView, hadFocus: boolean) {
    setJob(next);
    if (hadFocus) setFocusSelector('[data-proposal-job-failed="risk-suggestions"]');
  }

  function gone() {
    setJob(null);
    void reload();
  }

  if (!view) return loadFailed ? <ProposalsReadError onRetry={() => void reload()} /> : null;

  const editable = state === 'editable' && view.editable;
  const canDecide = editable && view.actions.decide.allowed;
  const startAllowed = editable && view.actions.suggest.allowed;
  const shown = decisions.items;
  const openItems = shown.filter((item) => item.state === 'open');
  const openRisks = openItems.filter((item) => item.kind === 'risk');
  const activeJob = job !== null && job.status !== 'completed' ? job : null;
  const running = isActiveJob(job);
  const groups = view.runs
    .filter((run) => run.operation === 'risk-suggestions')
    .map((run) => ({ run, items: openRisks.filter((item) => item.runId === run.runId) }))
    .filter((group) => group.items.length > 0);
  const finished = finishedRun ? view.runs.find((run) => run.runId === finishedRun) ?? null : null;
  const finishedClosed = finished !== null && shown.some((item) => item.runId === finished.runId) && shown.filter((item) => item.runId === finished.runId).every((item) => item.state === 'lapsed');
  const announcement = finished === null ? '' : finishedClosed ? CLOSED_WHEN_FINISHED : finished.outcome === 'no-change' ? NOTHING_PROPOSED : readyLine(finished.counts.items);
  const neverAsked = view.runs.length === 0 && shown.length === 0;
  const cleared = !neverAsked && openItems.length === 0 && shown.length > 0;
  const riskNumberOf = (riskId: string | null) => (riskId ? risks.find((risk) => risk.id === riskId)?.riskNumber ?? null : null);

  function compareTargetFor(item: RiskAiProposalItem, note: SimilarityNote | null): CompareTarget | null {
    const similar = item.similarTo;
    if (!similar || !note) return null;
    if (similar.kind === 'active' || similar.kind === 'withdrawn') {
      const values = similar.riskId ? risks.find((risk) => risk.id === similar.riskId)?.values : undefined;
      return values && note.columns ? { before: note.columns[0], values } : null;
    }
    const other = shown.find((candidate) => candidate.runId === similar.runId && candidate.itemKey === similar.itemKey);
    if (!other || (similar.kind === 'rejected' && other.state !== 'rejected')) return null;
    return { before: similar.kind === 'rejected' ? 'Rejected proposal' : 'Open proposal', values: other.proposed };
  }

  const startForm = startAllowed && !running
    ? <AiPolicyGate action={<ProposalsStartForm assessmentId={assessmentId} onStarted={started} ownerKey={ownerKey} />} caption={false} policy={policy} />
    : null;

  const follower = (slot?: HTMLElement | null) => (activeJob
    ? <RiskProposalJob assessmentId={assessmentId} job={activeJob} key={jobKey(activeJob)} onCompleted={completed} onFailed={failed} onGone={gone} onRetried={started} slot={slot} timing={timing} />
    : null);
  const announcer = <p aria-live="polite" className={announcement ? 'text-sm font-medium text-foreground' : 'sr-only'}>{announcement}</p>;

  const body = (
    <div className="grid gap-6" ref={bodyRef}>
      {activeJob ? (wide ? follower() : <div ref={setSheetSlot} />) : null}
      {announcer}
      {finished && finished.outcome === 'no-change' ? <LeftOutList adjustments={finished.adjustments} /> : null}
      {startForm}
      {neverAsked && startAllowed && !running ? (
        <div className="grid gap-1 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">{FIRST_USE.title}</p>
          <p className="text-sm text-foreground-secondary">{FIRST_USE.body}</p>
        </div>
      ) : null}
      {cleared ? (
        <div className="grid gap-1 rounded-lg border border-dashed border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CircleCheck aria-hidden="true" className="size-4 text-success" />{CLEARED.title}</p>
          <p className="text-sm text-foreground-secondary">{CLEARED.body}</p>
        </div>
      ) : null}
      {groups.map(({ items, run }) => (
        <ProposedRiskGroup
          groupActions={canDecide ? groupActions(run, items) : null}
          key={run.runId}
          open={items.length}
          run={run}
        >
          {items.map((item) => {
            const key = proposalKey(item);
            const note = item.similarTo ? compareTargetFor(item, similarityNote(item.similarTo)) : null;
            return (
              <ProposedRiskCard
                adding={decisions.adding === key}
                busy={decisions.adding !== null}
                compareWith={note}
                decide={canDecide}
                density={density}
                extra={rejecting === key ? rejectRow(item) : null}
                item={item}
                key={key}
                onAdd={(target) => void decisions.add(target)}
                onReject={(target) => { setRejectingRun(null); setRejecting(proposalKey(target)); }}
                onRejectDuplicate={(target, similar) => decisions.reject([target], {
                  act: 'reject-duplicate',
                  reason: similar.duplicateReason,
                  duplicateOf: target.similarTo && (target.similarTo.kind === 'active' || target.similarTo.kind === 'withdrawn') ? target.similarTo.riskNumber : null,
                  target: 'proposals',
                })}
                pending={decisions.pending.has(key)}
                requestId={requestId}
              />
            );
          })}
        </ProposedRiskGroup>
      ))}
      <OpenRewritesIndex items={shown} onFollow={() => { if (sheet.open) { skipReturn.current = true; setSheet({ ...sheet, open: false }); } }} risks={risks} />
      <RiskDecidedProposals
        canUndo={(item) => canDecide && item.canUndo && (item.state === 'accepted' || item.state === 'rejected') && !(item.kind === 'risk' && item.state === 'accepted')}
        items={shown}
        onUndo={(item, label, riskNumber) => decisions.undo(item, { label, riskNumber })}
        riskNumberOf={riskNumberOf}
      />
    </div>
  );

  function rejectRow(item: RiskAiProposalItem) {
    const key = proposalKey(item);
    return (
      <ReasonRow
        draft={{ ownerKey, recordId: `reject:${key}` }}
        keepLabel="Keep proposal"
        onKeep={() => { setRejecting(null); setFocusSelector(`[data-proposal-reject="${key}"]`); }}
        onReject={(reason, recorded) => { setRejecting(null); decisions.reject([item], { act: 'reject', ...(reason === undefined ? {} : { reason }), target: 'proposals', onSuccess: recorded }); }}
        rejectLabel="Reject proposal"
      />
    );
  }

  function groupActions(run: RiskAiRunFacts, items: readonly RiskAiProposalItem[]) {
    const at = instant(run.completedAt ?? run.startedAt);
    const count = items.length;
    return (
      <>
        <RejectRemainingButton count={count} expanded={rejectingRun === run.runId} instant={at} onClick={() => { setRejecting(null); setRejectingRun(run.runId); }} runId={run.runId} />
        {/* UI-01: the row's holder stays in the page, so Reject remaining's aria-controls always names it. */}
        <div className="w-full" hidden={rejectingRun !== run.runId} id={rejectRemainingId(run.runId)}>
          {rejectingRun === run.runId ? (
            <ReasonRow
              draft={{ ownerKey, recordId: `reject-remaining:${run.runId}` }}
              keepLabel="Keep proposals"
              onKeep={() => { setRejectingRun(null); setFocusSelector(`[data-reject-remaining="${run.runId}"]`); }}
              onReject={(reason, recorded) => { setRejectingRun(null); decisions.reject(items, { act: 'reject-remaining', ...(reason === undefined ? {} : { reason }), target: 'proposals', onSuccess: recorded }); }}
              rejectLabel={`Reject ${count.toLocaleString('en-AU')} ${count === 1 ? 'proposal' : 'proposals'}`}
            />
          ) : null}
        </div>
      </>
    );
  }

  const statusLine = <p className="text-sm font-medium tabular-nums text-foreground focus-visible:outline-none" data-ai-proposals-status="" tabIndex={-1}>{proposalsStatusLine(openItems.length)}</p>;

  if (!wide) {
    const open = (focus: 'title' | 'instruction') => (element: HTMLElement) => {
      opener.current = element;
      setSheet({ open: true, focus });
    };
    return (
      <div className="grid gap-3">
        {statusLine}
        {follower(sheet.open ? sheetSlot : summarySlot)}
        <ProposalsPhoneSummary job={sheet.open ? null : <>{activeJob ? <div ref={setSummarySlot} /> : null}{announcer}</>} onReview={open('title')} onSuggest={open('instruction')} showReview={shown.length > 0} showSuggest={startAllowed && !running} />
        <ProposalsSheet focus={sheet.focus} onOpenChange={(next) => setSheet({ ...sheet, open: next })} open={sheet.open} returnFocusTo={opener} skipReturn={skipReturn}>{body}</ProposalsSheet>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {statusLine}
        {shown.length > 0 ? <div className="hidden md:block" data-density-control=""><SegmentedControl label="Density" onValueChange={setDensity} options={DENSITY_OPTIONS} value={density} /></div> : null}
      </div>
      {body}
    </div>
  );
}
