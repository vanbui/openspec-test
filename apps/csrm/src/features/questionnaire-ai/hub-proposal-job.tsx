'use client';

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { landOn } from '@/components/csrm/use-hash-landing';
import { ContextTooLargeFailure } from '../attachments/context-too-large-files';
import { getQuestionnaireProposalJobAction, retryQuestionnaireProposalJobAction } from './questionnaire-ai-actions';
import {
  JOB_CHECKS_STOPPED,
  JOB_FAILED_TITLE,
  NOTHING_NEW,
  RETRY_PROPOSALS,
  STATUS_UNAVAILABLE,
  jobStartedBy,
  panelJobOf,
  proposalsReadyLine,
  type QuestionnaireAiProposalsView,
  type QuestionnaireProposalJobView,
} from './questionnaire-ai-domain';
import { aiProposalJobFailureCopy, aiProposalStartRefusalCopy } from './questionnaire-ai-refusal-copy';
import { clearProposalJobHandoff, takeProposalJobFocusRequest } from './proposal-job-handoff';

/*
 * The hub's proposal job (15-UI-SPEC §8.4; D-29, D-33): a job started from the hub's AI inputs signal (or by a colleague)
 * is followed on the questionnaire card as the panel follows it (§2.3), with a link to the panel; once it finishes the page
 * refreshes and the card says how many proposals are ready, or that nothing new was proposed. A failure reads Q3's copy,
 * and CONTEXT_TOO_LARGE the shared rule with Q1's sentence as the fallback, with Retry AI proposals.
 */
export const HUB_JOB_PREPARING = 'The AI is preparing follow-up questions.';
export const OPEN_AI_PROPOSALS = 'Open AI proposals';
export const REVIEW_AI_PROPOSALS = 'Review AI proposals';

export type HubProposalJobTiming = { readonly pollIntervalMs: number; readonly timeoutMs: number };

export function HubProposalJob({ view, requestId, panelHref, timing }: { view: QuestionnaireAiProposalsView; requestId: string; panelHref: string; timing: HubProposalJobTiming }) {
  const router = useRouter();
  const seed = panelJobOf(view.jobs);
  const [job, setJob] = useState<QuestionnaireProposalJobView | null>(seed);
  const [awaitingRun, setAwaitingRun] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cycle, setCycle] = useState(0);
  const startedAt = useRef(Date.now());
  const focusRequested = useRef(false);
  const seedKey = seed ? `${seed.jobId}:${seed.status}:${seed.attempt}` : null;
  const finishedRun = awaitingRun
    ? view.runs.find((run) => run.runId === awaitingRun) ?? null
    // The read serves completed runs newest first; rewrite outcomes belong to their own question row.
    : !job ? view.runs.find((run) => run.operation === 'questionnaire-proposals') ?? null : null;

  useEffect(() => {
    if (!seed) return;
    setJob(seed);
    setAwaitingRun(null);
    setTimedOut(false);
    startedAt.current = Date.now();
    // Keyed on the seed's content: a refresh hands the card a new object with the same job.
  }, [seedKey]);

  useEffect(() => {
    if (!takeProposalJobFocusRequest(view.questionnaireId)) return;
    focusRequested.current = true;
    requestAnimationFrame(() => {
      const status = document.querySelector<HTMLElement>('[data-ai-proposals-job-status]');
      if (status) {
        landOn(status);
        if (finishedRun) focusRequested.current = false;
      }
    });
  }, [seedKey, view.questionnaireId, finishedRun?.runId]);

  useLayoutEffect(() => {
    if (!focusRequested.current) return;
    const status = document.querySelector<HTMLElement>('[data-ai-proposals-job-status]');
    if (!status) return;
    landOn(status);
    if (finishedRun) focusRequested.current = false;
  }, [seedKey, job?.status, awaitingRun, finishedRun?.runId]);

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
          /* Keep the status holder mounted while the server refresh brings the completed run. */
          setJob(result.data);
          router.refresh();
          return;
        }
        setJob(result.data);
        setCycle((current) => current + 1);
      }).catch(() => {
        if (!live) return;
        setStatusError(true);
        setCycle((current) => current + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => { live = false; clearTimeout(handle); };
  }, [cycle, job, router, timedOut, timing]);

  async function retry() {
    if (!job || pending) return;
    setPending(true);
    setRetryError(null);
    try {
      const result = await retryQuestionnaireProposalJobAction({ jobId: job.jobId, documentId: view.questionnaireId });
      if (!result.ok) {
        setRetryError(result.message);
        return;
      }
      startedAt.current = Date.now();
      setTimedOut(false);
      setJob(result.data);
    } catch {
      setRetryError(aiProposalStartRefusalCopy({}).text);
    } finally {
      setPending(false);
    }
  }

  function checkAgain() {
    startedAt.current = Date.now();
    setTimedOut(false);
    setCycle((current) => current + 1);
  }

  if (finishedRun) {
    return finishedRun.outcome === 'items'
      ? (
        <div className="grid gap-2 rounded-lg border border-border p-4">
          <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-foreground focus-visible:outline-none" data-ai-proposals-job-status="" tabIndex={-1}><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />{proposalsReadyLine(finishedRun.counts.items)}</p>
          <Link className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit max-md:min-h-11' })} href={panelHref} onClick={() => clearProposalJobHandoff(view.questionnaireId)}>{REVIEW_AI_PROPOSALS}</Link>
        </div>
      )
      : <div className="grid gap-2 rounded-lg border border-border p-4"><p aria-live="polite" className="text-sm text-foreground-secondary focus-visible:outline-none" data-ai-proposals-job-status="" tabIndex={-1}>{NOTHING_NEW}</p></div>;
  }
  if (!job) return null;

  const startedBy = jobStartedBy(job);
  if (job.status === 'failed') {
    return (
      <div className="grid gap-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{JOB_FAILED_TITLE}</p>
        <div className="grid gap-1 text-sm text-foreground-secondary">
          {job.failureCode === 'CONTEXT_TOO_LARGE'
            ? <ContextTooLargeFailure failure={job} fallback={aiProposalJobFailureCopy('CONTEXT_TOO_LARGE', null) ?? ''} requestId={requestId} />
            : <p>{aiProposalJobFailureCopy(job.failureCode, job.failureMessage) ?? aiProposalStartRefusalCopy({}).text}</p>}
          {startedBy ? <p>{startedBy}</p> : null}
        </div>
        {retryError ? <p className="text-sm text-destructive">{retryError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {job.canRetry ? <Button aria-disabled={pending ? true : undefined} className="max-md:min-h-11" onClick={() => void retry()} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />{RETRY_PROPOSALS}</Button> : null}
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'max-md:min-h-11' })} href={panelHref}>{OPEN_AI_PROPOSALS}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-foreground focus-visible:outline-none" data-ai-proposals-job-status="" tabIndex={-1}>
        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />{HUB_JOB_PREPARING}
      </p>
      {startedBy ? <p className="text-sm text-foreground-secondary">{startedBy}</p> : null}
      {statusError ? <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{STATUS_UNAVAILABLE}</p> : null}
      {timedOut ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-sm text-foreground-secondary"><Clock3 aria-hidden="true" className="size-4 shrink-0" />{JOB_CHECKS_STOPPED}</p>
          <Button className="w-fit max-md:min-h-11" onClick={checkAgain} size="sm" type="button" variant="outline">Check again</Button>
        </div>
      ) : null}
      <Link className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit max-md:min-h-11' })} href={panelHref}>{OPEN_AI_PROPOSALS}</Link>
    </div>
  );
}
