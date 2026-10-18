'use client';

import { AlertCircle, Clock, ListX, LoaderCircle, Lock, RotateCcw, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type RefObject } from 'react';
import { toast, type Action } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { SegmentedControl } from '@/components/csrm/segmented-control';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { successToast } from '@/components/ui/success-toast';
import { writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { ContextTooLargeFailure } from '../attachments/context-too-large-files';
import { returnQuestionnaireToAnalystReviewAction } from '../questionnaires/questionnaire-actions';
import { useOpenQuestionForm } from '../questionnaires/questionnaire-governance';
import type { SectionChoice } from '../questionnaires/questionnaire-placement';
import { clearProposalEditDraft, ProposalEditForm } from './proposal-edit-form';
import { InstructionField, ShortcutHint } from './instruction-field';
import {
  decideQuestionnaireAiProposalsAction,
  getQuestionnaireProposalJobAction,
  retryQuestionnaireProposalJobAction,
  startQuestionnaireAiProposalsAction,
} from './questionnaire-ai-actions';
import {
  ASKING_THE_AI,
  decisionFailureTitle,
  decisionToast,
  emptyState,
  fixedQuestionsToggle,
  instructionTooLongLine,
  itemActionsFor,
  JOB_CHECKS_STOPPED,
  JOB_FAILED_TITLE,
  JOB_LEAVE_CAPTION,
  JOB_PREPARING,
  jobStartedBy,
  NOTHING_NEW,
  PANEL_INSTRUCTION_HINT,
  pluralise,
  panelGuidance,
  panelJobOf,
  panelStatusLine,
  proposalsReadyLine,
  RETRY_PROPOSALS,
  startActionLabel,
  STATUS_UNAVAILABLE,
  type QuestionnaireAiRunView,
  type QuestionnaireProposalJobView,
  type DecisionAct,
  type ProposalState,
  type QuestionnaireAiDecision,
  type QuestionnaireAiItemView,
  type QuestionnaireAiProposalsView,
} from './questionnaire-ai-domain';
import { aiProposalDecisionRefusalCopy, aiProposalJobFailureCopy, aiProposalStartRefusalCopy, type ProposalDecisionIntent } from './questionnaire-ai-refusal-copy';
import { LeftOutProposals, PROPOSAL_FIGURE_LINK_CLASS, ProposalRunGroup, proposalKey, RejectRow, useInstant, type ProposalDensity, type ProposalHandlers } from './proposal-item-card';
import { subscribeToProposalJobHandoff, takeProposalJob } from './proposal-job-handoff';

/*
 * The AI proposals panel's interactive body (15-UI-SPEC §2 to §5; D-33, D-35), loaded on demand by the frame. The
 * decided list loads on demand too: most visits never open it.
 */
const DecidedProposals = dynamic(() => import('./decided-proposals').then((module) => module.DecidedProposals));

/* The refusals after which the panel reads the proposals again, so each item shows where it really stands (§5.1). */
const REFRESH_REASONS: ReadonlySet<string> = new Set(['AI_PROPOSAL_STALE', 'AI_PROPOSAL_ALREADY_DECIDED']);

type Change = { keys: ReadonlySet<string>; state: ProposalState; edited?: boolean };

function withChange(items: readonly QuestionnaireAiItemView[], change: Change): readonly QuestionnaireAiItemView[] {
  return items.map((item) => {
    if (!change.keys.has(proposalKey(item))) return item;
    if (change.state === 'open') return { ...item, state: 'open', decision: null, canUndo: false };
    return {
      ...item,
      state: change.state,
      canUndo: true,
      decision: { action: change.state === 'accepted' ? 'accepted' : 'rejected', by: null, at: new Date().toISOString(), reason: null, edited: change.edited ?? false },
    };
  });
}

/*
 * Walk D3 (12-16): Sonner hands focus back once focus leaves its region, which a removed toast never reports, so each
 * toast action leaves the region first.
 */
function toastAction(label: string, act: () => void): Action {
  return {
    label,
    onClick: () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('[data-sonner-toaster]')) active.blur();
      act();
    },
  };
}

type DecisionsInput = {
  documentId: string;
  items: readonly QuestionnaireAiItemView[];
  containerRef: RefObject<HTMLElement | null>;
  sections?: readonly SectionChoice[];
};

/*
 * Every decision on a proposal (§5; D-21 to D-23, D-35): applied at once, one batch Server Action per act, rolled back
 * with Q2's copy when refused, confirmed with an Undo toast, and focus moved per §5.5. Accepted decisions hold until the
 * revalidated read replaces them, so a slow read never shows a decided item as open again.
 */
export function useProposalDecisions({ documentId, items, containerRef, sections = [] }: DecisionsInput) {
  const router = useRouter();
  const [decisionPending, startTransition] = useTransition();
  useUnloadWarning(decisionPending);
  const [settled, setSettled] = useState<{ source: readonly QuestionnaireAiItemView[]; changes: readonly Change[] }>({ source: items, changes: [] });
  const base = settled.source === items ? settled.changes.reduce<readonly QuestionnaireAiItemView[]>(withChange, items) : items;
  const [shown, applyOptimistic] = useOptimistic<readonly QuestionnaireAiItemView[], Change>(base, withChange);
  const pendingFocus = useRef<{ keys: ReadonlySet<string>; order: readonly string[] } | { reopen: string } | null>(null);
  const [, setFocusCycle] = useState(0);
  useEffect(() => {
    const request = pendingFocus.current;
    const container = containerRef.current;
    if (!request || !container) return;
    const controls = [...container.querySelectorAll<HTMLButtonElement>('[data-proposal-primary]')];
    let target: HTMLElement | null = null;
    if ('reopen' in request) target = controls.find((element) => element.dataset.proposalPrimary === request.reopen) ?? null;
    else {
      const start = Math.max(...request.order.map((key, index) => request.keys.has(key) ? index : -1));
      const order = [...request.order.slice(start + 1), ...request.order.slice(0, Math.max(start, 0))];
      target = order.map((key) => controls.find((element) => element.dataset.proposalPrimary === key && !request.keys.has(key))).find((element) => element !== undefined) ?? container.querySelector<HTMLElement>('[data-ai-proposals-status]');
    }
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    target.focus();
    pendingFocus.current = null;
  });

  function settle(change: Change) {
    setSettled((current) => ({ source: items, changes: current.source === items ? [...current.changes, change] : [change] }));
  }

  /* The primary control (Confirm, or Reject when only Reject shows) of each open card, in panel order. */
  function primaryKeys(): string[] {
    return [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-proposal-primary]') ?? [])].map((element) => element.dataset.proposalPrimary ?? '');
  }

  function focusAfter(keys: ReadonlySet<string>, order: readonly string[]) {
    pendingFocus.current = { keys, order };
    setFocusCycle((current) => current + 1);
  }

  function focusReopened(key: string) {
    pendingFocus.current = { reopen: key };
    setFocusCycle((current) => current + 1);
  }

  function run(input: {
    act: DecisionAct;
    targets: readonly QuestionnaireAiItemView[];
    decisions: QuestionnaireAiDecision[];
    intent: ProposalDecisionIntent;
    change: Change;
    toastMessage: string;
    undo?: () => void;
    onSuccess?: () => void;
    focus: () => void;
  }) {
    const { act, decisions, intent, change, toastMessage, undo, focus } = input;
    const failed = decisionFailureTitle(act);
    const retry = () => run(input);
    startTransition(async () => {
      applyOptimistic(change);
      focus();
      let result: Awaited<ReturnType<typeof decideQuestionnaireAiProposalsAction>> | null = null;
      try {
        result = await decideQuestionnaireAiProposalsAction({ documentId, decisions, intent });
      } catch {
        result = null;
      }
      if (result === null || !result.ok) {
        const copy = result === null ? aiProposalDecisionRefusalCopy({}, { decision: intent }) : { text: result.message, kind: result.failure };
        const refresh = () => router.refresh();
        toast.error(failed, {
          description: copy.text,
          duration: Infinity,
          action: copy.kind === 'retryable' ? toastAction('Try again', retry) : toastAction('Refresh page', refresh),
        });
        if (result !== null && !result.ok && result.reason !== undefined && REFRESH_REASONS.has(result.reason)) router.refresh();
        return;
      }
      settle(change);
      input.onSuccess?.();
      successToast(toastMessage, undo ? { action: toastAction('Undo', undo) } : {});
    });
  }

  function undoConfirm(item: QuestionnaireAiItemView) {
    const key = proposalKey(item);
    run({
      act: 'undo-confirm',
      targets: [item],
      decisions: [{ runId: item.runId, item: item.itemKey, action: 'restore' }],
      intent: 'undo-confirmation',
      change: { keys: new Set([key]), state: 'open' },
      toastMessage: decisionToast('undo-confirm', { kind: item.kind }),
      focus: () => focusReopened(key),
    });
  }

  function undoReject(item: QuestionnaireAiItemView) {
    const key = proposalKey(item);
    run({
      act: 'undo-reject',
      targets: [item],
      decisions: [{ runId: item.runId, item: item.itemKey, action: 'restore' }],
      intent: 'undo-rejection',
      change: { keys: new Set([key]), state: 'open' },
      toastMessage: decisionToast('undo-reject', {}),
      focus: () => focusReopened(key),
    });
  }

  /* Undo from the decided list (§4.6): it reverses what was decided. */
  function undo(item: QuestionnaireAiItemView) {
    if (item.state === 'rejected') undoReject(item);
    else undoConfirm(item);
  }

  function confirm(item: QuestionnaireAiItemView) {
    const key = proposalKey(item);
    const keys = new Set([key]);
    const order = primaryKeys();
    run({
      act: 'confirm',
      targets: [item],
      decisions: [{ runId: item.runId, item: item.itemKey, action: 'accept' }],
      intent: 'confirm',
      change: { keys, state: 'accepted' },
      toastMessage: decisionToast('confirm', { kind: item.kind, sectionTitle: item.placement?.sectionTitle ?? '' }),
      undo: () => undoConfirm(item),
      focus: () => focusAfter(keys, order),
    });
  }

  function undoRejections(targets: readonly QuestionnaireAiItemView[]) {
    run({
      act: 'undo-reject-remaining',
      targets,
      decisions: targets.map((item) => ({ runId: item.runId, item: item.itemKey, action: 'restore' })),
      intent: 'undo-rejection',
      change: { keys: new Set(targets.map(proposalKey)), state: 'open' },
      toastMessage: decisionToast('undo-reject-remaining', {}),
      focus: () => focusReopened(proposalKey(targets[0]!)),
    });
  }

  /* §5.3 and §5.4: Reject, or Reject remaining's whole group, with one optional reason for each. */
  function reject(targets: readonly QuestionnaireAiItemView[], reason: string | undefined, remaining: boolean, onSuccess?: () => void) {
    if (targets.length === 0) return;
    const keys = new Set(targets.map(proposalKey));
    const order = primaryKeys();
    run({
      act: remaining ? 'reject-remaining' : 'reject',
      targets,
      decisions: targets.map((item) => ({ runId: item.runId, item: item.itemKey, action: 'reject', ...(reason === undefined ? {} : { reason }) })),
      intent: 'reject',
      change: { keys, state: 'rejected' },
      toastMessage: decisionToast(remaining ? 'reject-remaining' : 'reject', { count: targets.length }),
      undo: () => (remaining ? undoRejections(targets) : undoReject(targets[0]!)),
      onSuccess,
      focus: () => focusAfter(keys, order),
    });
  }

  /*
   * §5.2: Confirm with edits waits for the server (it creates or changes a question), so it is not applied at once. A
   * refusal is returned to the form, which shows it with the text kept.
   */
  async function confirmWithEdits(item: QuestionnaireAiItemView, edits: QuestionnaireAiDecision['edits']): Promise<string | null> {
    const key = proposalKey(item);
    const keys = new Set([key]);
    const order = primaryKeys();
    const edited = edits !== undefined && Object.keys(edits).length > 0;
    let result: Awaited<ReturnType<typeof decideQuestionnaireAiProposalsAction>> | null = null;
    try {
      result = await decideQuestionnaireAiProposalsAction({ documentId, decisions: [{ runId: item.runId, item: item.itemKey, action: 'accept', ...(edited ? { edits } : {}) }], intent: 'confirm' });
    } catch {
      result = null;
    }
    if (result === null) return aiProposalDecisionRefusalCopy({}, { decision: 'confirm' }).text;
    if (!result.ok) {
      if (result.reason !== undefined && REFRESH_REASONS.has(result.reason)) router.refresh();
      return result.message;
    }
    const change: Change = { keys, state: 'accepted', edited };
    settle(change);
    focusAfter(keys, order);
    const placement = edits?.section;
    const sectionTitle = placement?.kind === 'new' ? placement.title : placement?.kind === 'existing' ? sections.find((section) => section.key === placement.key)?.section.title ?? item.placement?.sectionTitle ?? '' : item.placement?.sectionTitle ?? '';
    successToast(decisionToast('confirm', { kind: item.kind, edited, sectionTitle }), { action: toastAction('Undo', () => undoConfirm(item)) });
    return null;
  }

  return { items: shown, confirm, undo, reject, confirmWithEdits };
}

/* §2.1 (UI-D27): the density, kept per person in this browser as the DataTable's is; from 768px only. */
const densityKey = (ownerKey: string) => `csrm:ai-proposals-density:${ownerKey}`;
const wideQuery = '(min-width: 768px)';
function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia?.(wideQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
/* Without matchMedia (a test environment) the panel is wide. */
function useIsWide(): boolean {
  return useSyncExternalStore(subscribeToWidth, () => window.matchMedia?.(wideQuery).matches ?? true, () => true);
}

function useDensity(ownerKey: string | null): [ProposalDensity, (density: ProposalDensity) => void] {
  const [density, setDensity] = useState<ProposalDensity>('comfortable');
  useEffect(() => {
    if (!ownerKey) return;
    try {
      if (window.localStorage.getItem(densityKey(ownerKey)) === 'compact') setDensity('compact');
    } catch {
      /* A browser without usable storage keeps the default. */
    }
  }, [ownerKey]);
  function choose(next: ProposalDensity) {
    setDensity(next);
    if (!ownerKey) return;
    try {
      window.localStorage.setItem(densityKey(ownerKey), next);
    } catch {
      /* Not kept; the choice still applies on this page. */
    }
  }
  return [density, choose];
}

const DENSITY_OPTIONS = [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] as const;

export type ProposalJobTiming = { pollIntervalMs: number; timeoutMs: number };
const DEFAULT_TIMING: ProposalJobTiming = { pollIntervalMs: 2_000, timeoutMs: 30_000 };

/*
 * §2.3: the questionnaire-wide job, followed as Phase 10's job panels are: a check every few seconds for 30 seconds, then
 * Check again. A completed job refreshes the page; the proposals it produced are announced once they are listed.
 */
function useProposalJob({ documentId, seed, timing }: { documentId: string; seed: QuestionnaireProposalJobView | null; timing: ProposalJobTiming }) {
  const router = useRouter();
  const [job, setJob] = useState<QuestionnaireProposalJobView | null>(seed);
  const [timedOut, setTimedOut] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [awaitingRun, setAwaitingRun] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  const startedAt = useRef(Date.now());
  const seedKey = seed ? `${seed.jobId}:${seed.status}:${seed.attempt}` : null;

  useEffect(() => {
    if (!seed) return;
    setJob(seed);
    setTimedOut(false);
    startedAt.current = Date.now();
    // Keyed on the seed's content: a refresh hands the panel a new object with the same job.
  }, [seedKey]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running') || timedOut) return undefined;
    const remaining = timing.timeoutMs - (Date.now() - startedAt.current);
    if (remaining <= 0) {
      setTimedOut(true);
      return undefined;
    }
    let live = true;
    const handle = setTimeout(() => {
      void getQuestionnaireProposalJobAction({ jobId: job.jobId }).then((result) => {
        if (!live) return;
        if (!result.ok) {
          setStatusError(true);
          setCycle((current) => current + 1);
          return;
        }
        setStatusError(false);
        if (result.data.status === 'completed') {
          setAwaitingRun(result.data.runId);
          setJob(null);
          router.refresh();
          return;
        }
        setJob(result.data);
        setCycle((current) => current + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => { live = false; clearTimeout(handle); };
  }, [cycle, job, router, timedOut, timing]);

  function checkAgain() {
    startedAt.current = Date.now();
    setTimedOut(false);
    setCycle((current) => current + 1);
  }

  function started(next: QuestionnaireProposalJobView) {
    startedAt.current = Date.now();
    setTimedOut(false);
    setAwaitingRun(null);
    setJob(next);
  }

  return { job, timedOut, statusError, awaitingRun, checkAgain, started, documentId };
}

const RETURN_DESCRIPTION = 'Editing requires returning this questionnaire to review first.';

/* §2.4: Phase 10's Return to analyst review dialog, unchanged, offered beside the guidance line. */
function ReturnToReview({ documentId, onReturned }: { documentId: string; onReturned: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const returned = useRef(false);
  async function returnToReview(reason?: string) {
    setError(null);
    const result = await returnQuestionnaireToAnalystReviewAction({ documentId, reason });
    if (!result.ok) {
      setError(result.formError);
      throw new Error('Return failed');
    }
    returned.current = true;
    router.refresh();
  }
  return <ConfirmDialog confirmLabel="Return to analyst review" confirmVariant="default" description={RETURN_DESCRIPTION} errorMessage={error} onCloseAutoFocus={(event) => { if (returned.current) { returned.current = false; event.preventDefault(); onReturned(); } }} onConfirm={returnToReview} onDismiss={() => setError(null)} pendingLabel="Returning to analyst review…" reasonRequired title="Return questionnaire to analyst review?" trigger={<Button className="w-fit max-md:min-h-11" data-print="hidden" size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Return to analyst review</Button>} />;
}

/* §2.2: the start form. A refusal keeps the text; an instruction refusal shows beside the field. */
function StartForm({ anyAnswered, disabled, documentId, onStarted, ownerKey }: { anyAnswered: boolean; disabled: boolean; documentId: string; onStarted: (job: QuestionnaireProposalJobView) => void; ownerKey: string | null }) {
  const [instruction, setInstruction] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (pending || disabled) return;
    const tooLong = instructionTooLongLine(instruction.length);
    setFormError(null);
    if (tooLong) {
      setFieldError(tooLong);
      field.current?.focus();
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      const result = await startQuestionnaireAiProposalsAction({ documentId, instruction });
      if (!result.ok) {
        if (result.failure === 'field') {
          setFieldError(result.message);
          field.current?.focus();
        } else setFormError(result.message);
        return;
      }
      setInstruction('');
      if (ownerKey) writeSessionDraft('questionnaire-ai-instruction', ownerKey, documentId, '');
      onStarted(result.data);
    } catch {
      setFormError(aiProposalStartRefusalCopy({}).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-3" data-print="hidden" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <InstructionField draft={{ kind: 'questionnaire-ai-instruction', recordId: documentId, ownerKey }} error={fieldError} fieldRef={field} hint={PANEL_INSTRUCTION_HINT} id="ai-proposals-instruction" onChange={setInstruction} onSubmitShortcut={() => void submit()} value={instruction} />
      {formError ? <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{formError}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button aria-disabled={pending ? true : undefined} className="w-full max-md:min-h-11 md:w-fit" disabled={disabled} type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
          {pending ? ASKING_THE_AI : startActionLabel({ instruction, anyAnswered })}
        </Button>
        <ShortcutHint />
      </div>
    </form>
  );
}

/* §2.3: a failed job's body: Q3's sentence, or the shared CONTEXT_TOO_LARGE rule (D-29; S-3). */
function FailedJobBody({ job, requestId }: { job: QuestionnaireProposalJobView; requestId: string | null }) {
  if (job.failureCode === 'CONTEXT_TOO_LARGE' && requestId) {
    return <ContextTooLargeFailure failure={job} fallback={aiProposalJobFailureCopy('CONTEXT_TOO_LARGE', null) ?? ''} requestId={requestId} />;
  }
  return <p>{aiProposalJobFailureCopy(job.failureCode, job.failureMessage) ?? aiProposalStartRefusalCopy({}).text}</p>;
}

function JobState({ documentId, onRetried, requestId, state }: { documentId: string; onRetried: (job: QuestionnaireProposalJobView) => void; requestId: string | null; state: ReturnType<typeof useProposalJob> }) {
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const { job, timedOut, statusError, checkAgain } = state;
  if (!job) return null;
  const startedBy = jobStartedBy(job);

  async function retry() {
    if (!job || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const result = await retryQuestionnaireProposalJobAction({ jobId: job.jobId, documentId });
      if (result.ok) onRetried(result.data);
      else setRetryError(result.message);
    } catch {
      setRetryError(aiProposalStartRefusalCopy({}).text);
    } finally {
      setRetrying(false);
    }
  }

  if (job.status === 'failed') {
    return (
      <Alert role="alert" variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{JOB_FAILED_TITLE}</AlertTitle>
        <AlertDescription className="grid gap-2">
          <FailedJobBody job={job} requestId={requestId} />
          {startedBy ? <p>{startedBy}</p> : null}
          {retryError ? <p>{retryError}</p> : null}
          {job.canRetry ? <Button className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => void retry()} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />{RETRY_PROPOSALS}</Button> : null}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-foreground-secondary" />
        <Badge variant="outline">Attempt {job.attempt}</Badge>
      </div>
      <p className="text-xs text-foreground-secondary">{JOB_LEAVE_CAPTION}</p>
      {startedBy ? <p className="text-xs text-foreground-secondary">{startedBy}</p> : null}
      {statusError ? <p className="text-xs text-destructive" role="alert">{STATUS_UNAVAILABLE}</p> : null}
      {timedOut ? <div className="grid gap-2"><p className="text-xs text-foreground-secondary">{JOB_CHECKS_STOPPED}</p><Button className="w-fit max-md:min-h-11" onClick={checkAgain} size="sm" type="button" variant="outline">Check again</Button></div> : null}
    </div>
  );
}

/* §7.2: the answered questions, behind a figure link, collapsed by default; absent at zero. */
function FixedQuestions({ questions }: { questions: readonly { questionId: string; questionText: string }[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const toggle = fixedQuestionsToggle(questions.length);
  if (!toggle) return null;
  return (
    <div className="grid gap-1">
      <button aria-controls={listId} aria-expanded={open} className={`${PROPOSAL_FIGURE_LINK_CLASS} text-sm`} onClick={() => setOpen(!open)} type="button">{toggle}</button>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-foreground-secondary" hidden={!open} id={listId}>{questions.map((question) => <li className="[overflow-wrap:anywhere]" key={question.questionId}>{question.questionText}</li>)}</ul>
    </div>
  );
}

const guidanceIcons = { Clock, Lock } as const;

export function AiProposalsPanelClient({ ownerKey, requestId, sections = [], timing = DEFAULT_TIMING, view }: { view: QuestionnaireAiProposalsView; ownerKey: string | null; requestId: string | null; sections?: readonly SectionChoice[]; timing?: ProposalJobTiming }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instant = useInstant();
  const decisions = useProposalDecisions({ documentId: view.questionnaireId, items: view.items, containerRef, sections });
  const job = useProposalJob({ documentId: view.questionnaireId, seed: panelJobOf(view.jobs), timing });
  const [chosenDensity, setDensity] = useDensity(ownerKey);
  const wide = useIsWide();
  const density: ProposalDensity = wide ? chosenDensity : 'comfortable';
  const scope = useOpenQuestionForm();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [editRefusal, setEditRefusal] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectingRun, setRejectingRun] = useState<string | null>(null);
  const { setPanelFormOpen } = scope;
  useEffect(() => {
    setPanelFormOpen(editing !== null);
    return () => setPanelFormOpen(false);
  }, [editing, setPanelFormOpen]);
  /* UI-D10: an open question form, the editor's or an Edit, then confirm, blocks Confirm and asking the AI. */
  const formOpen = scope.editorFormOpen || editing !== null;
  /* §5.5: focus returns to the opener once the row or form has closed, in the render that closes it. */
  const pendingFocus = useRef<string | null>(null);
  const [, setFocusCycle] = useState(0);
  const focusControl = (selector: string) => { pendingFocus.current = selector; setFocusCycle((current) => current + 1); };
  useEffect(() => {
    if (!pendingFocus.current) return undefined;
    const resolve = () => {
      if (!pendingFocus.current || document.querySelector('[role="alertdialog"]')) return;
      const target = containerRef.current?.querySelector<HTMLElement>(pendingFocus.current);
      if (!target) return;
      target.focus();
      pendingFocus.current = null;
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
  useHashLanding((id) => {
    if (id !== 'ai-proposals' && !id.startsWith('ai-proposal-') && !id.startsWith('ai-run-')) return;
    const target = document.getElementById(id);
    if (target) landOn(target);
  });
  function started(next: QuestionnaireProposalJobView) {
    focusControl('[data-ai-proposals-job-status]');
    job.started(next);
  }
  useEffect(() => {
    const receive = () => {
      const acknowledged = takeProposalJob(view.questionnaireId);
      if (acknowledged) started(acknowledged);
    };
    const unsubscribe = subscribeToProposalJobHandoff(receive);
    receive();
    return unsubscribe;
  }, [view.questionnaireId]);
  const handlers: ProposalHandlers = {
    confirm: decisions.confirm,
    startEdit: (item) => { setEditRefusal(null); setEditing(proposalKey(item)); },
    startReject: (item) => { setRejectingRun(null); setRejecting(proposalKey(item)); },
    undo: decisions.undo,
  };
  function discardEdit(item: QuestionnaireAiItemView) {
    clearProposalEditDraft(ownerKey, item);
    setEditing(null);
    focusControl(`[data-proposal-edit="${proposalKey(item)}"]`);
  }
  async function confirmEdit(item: QuestionnaireAiItemView, edits: QuestionnaireAiDecision['edits']) {
    if (editPending) return;
    setEditPending(true);
    setEditRefusal(null);
    const refusal = await decisions.confirmWithEdits(item, edits);
    setEditPending(false);
    if (refusal) {
      setEditRefusal(refusal);
      return;
    }
    clearProposalEditDraft(ownerKey, item);
    setEditing(null);
  }
  const renderItem = (item: QuestionnaireAiItemView) => (editing === proposalKey(item)
    ? <ProposalEditForm item={item} onConfirm={(edits) => void confirmEdit(item, edits)} onDiscard={() => discardEdit(item)} ownerKey={ownerKey} pending={editPending} refusal={editRefusal} sections={sections} />
    : null);
  const renderExtra = (item: QuestionnaireAiItemView) => {
    const key = proposalKey(item);
    if (rejecting !== key) return null;
    const recordId = `reject:${key}`;
    return <RejectRow draft={{ ownerKey, recordId }} keepLabel="Keep proposal" onKeep={() => { setRejecting(null); focusControl(`[data-proposal-reject="${key}"]`); }} onReject={(reason) => { setRejecting(null); decisions.reject([item], reason, false, () => { if (ownerKey) writeSessionDraft('proposal-edit', ownerKey, recordId, ''); }); }} rejectLabel="Reject proposal" />;
  };
  const groupActionsFor = (runView: QuestionnaireAiRunView, items: readonly QuestionnaireAiItemView[], instant: string) => {
    if (!view.actions.reject.allowed || !items.some((item) => actionsFor(item).reject)) return null;
    const count = items.length;
    return (
      <>
        <Button aria-expanded={rejectingRun === runView.runId} className="max-md:min-h-11" data-reject-remaining={runView.runId} onClick={() => { setRejecting(null); setRejectingRun(runView.runId); }} size="sm" type="button" variant="outline"><ListX aria-hidden="true" />{`Reject remaining (${count.toLocaleString('en-AU')})`}{' '}<span className="sr-only">{`from the request at ${instant}`}</span></Button>
        {rejectingRun === runView.runId ? <div className="w-full"><RejectRow draft={{ ownerKey, recordId: `reject-remaining:${runView.runId}` }} keepLabel="Keep proposals" onKeep={() => { setRejectingRun(null); focusControl(`[data-reject-remaining="${runView.runId}"]`); }} onReject={(reason) => { setRejectingRun(null); decisions.reject(items, reason, true, () => { if (ownerKey) writeSessionDraft('proposal-edit', ownerKey, `reject-remaining:${runView.runId}`, ''); }); }} rejectLabel={`Reject ${pluralise(count, 'proposal', 'proposals')}`} /></div> : null}
      </>
    );
  };
  const actionsFor = (item: QuestionnaireAiItemView) => itemActionsFor(item, view, { formOpen });
  const open = decisions.items.filter((item) => item.state === 'open');
  const decided = decisions.items.filter((item) => item.state !== 'open');
  const anyAnswered = (view.fixedQuestions?.length ?? 0) > 0;
  const groups = view.runs.map((run) => ({ run, items: open.filter((item) => item.runId === run.runId) })).filter((group) => group.items.length > 0);
  const guidance = panelGuidance(view.state, { formOpen });
  const GuidanceIcon = guidance?.icon ? guidanceIcons[guidance.icon] : null;
  const active = job.job !== null && job.job.status !== 'failed';
  const finishedRun = job.awaitingRun ? view.runs.find((run) => run.runId === job.awaitingRun) ?? null : null;
  const jobLine = active || (job.awaitingRun && !finishedRun) ? JOB_PREPARING : finishedRun?.outcome === 'items' ? proposalsReadyLine(finishedRun.counts.items) : finishedRun?.outcome === 'no-change' ? NOTHING_NEW : '';
  const [jobAnnouncement, setJobAnnouncement] = useState('');
  // Even a seeded active job changes the live region's text after its empty holder has mounted.
  useEffect(() => { setJobAnnouncement(jobLine); }, [jobLine]);
  const empty = emptyState({ ...view, items: decisions.items, openCount: open.length });
  return (
    <div className="grid gap-6" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium tabular-nums text-foreground focus-visible:outline-none" data-ai-proposals-status="" tabIndex={-1}>{panelStatusLine(open.length)}</p>
        {decisions.items.length > 0 ? <div className="hidden md:block" data-density-control=""><SegmentedControl label="Density" onValueChange={setDensity} options={DENSITY_OPTIONS} value={chosenDensity} /></div> : null}
      </div>
      <p aria-live="polite" className={active || job.awaitingRun ? 'text-sm font-medium text-foreground focus-visible:outline-none' : 'sr-only'} data-ai-proposals-job-status="" tabIndex={-1}>{jobAnnouncement}</p>
      {guidance ? (
        <div className="grid gap-2">
          <p className={guidance.icon ? 'flex items-start gap-2 text-sm text-foreground-secondary' : 'text-xs text-foreground-secondary'}>{GuidanceIcon ? <GuidanceIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}{guidance.line}</p>
          {guidance.offerReturnToReview ? <ReturnToReview documentId={view.questionnaireId} onReturned={() => focusControl('[data-ai-proposals-status]')} /> : null}
        </div>
      ) : null}
      <JobState documentId={view.questionnaireId} onRetried={started} requestId={requestId} state={job} />
      {finishedRun?.outcome === 'no-change' ? <LeftOutProposals adjustments={finishedRun.adjustments} /> : null}
      {view.actions.start.allowed && !active ? <StartForm anyAnswered={anyAnswered} disabled={formOpen} documentId={view.questionnaireId} onStarted={started} ownerKey={ownerKey} /> : null}
      {view.fixedQuestions ? <FixedQuestions questions={view.fixedQuestions} /> : null}
      {empty ? <div className="grid gap-1 rounded-lg border border-dashed border-border p-4"><p className="text-sm font-medium text-foreground">{empty.title}</p><p className="text-sm text-foreground-secondary">{empty.body}</p></div> : null}
      {groups.map(({ run, items }) => (
        <ProposalRunGroup actionsFor={actionsFor} anyAnswered={anyAnswered} density={density} groupActions={groupActionsFor(run, items, instant(run.completedAt ?? run.startedAt))} handlers={handlers} items={items} key={run.runId} renderExtra={renderExtra} renderItem={renderItem} requestId={requestId} run={run} />
      ))}
      {decided.length ? <DecidedProposals actionsFor={actionsFor} items={decided} onUndo={decisions.undo} runs={view.runs} /> : null}
    </div>
  );
}
