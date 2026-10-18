'use client';

import { AlertCircle, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { readRiskProposalJobAction, retryRiskProposalJobAction } from './risk-curation-actions';
import { JOB_STATUS_UNAVAILABLE, type RiskProposalJob as RiskProposalJobView } from './risk-curation-domain';
import { riskAiStartRefusal, riskProposalJobFailureCopy } from './risk-curation-refusal-copy';

/*
 * A Suggest more risks or Rewrite this risk job (16-UI-SPEC §2.3, §4.2; D-26), followed as Phase 10's job panels are
 * (10 §12, the assessment draft card's pattern): a check every few seconds for 30 seconds, then `Check again`. A completed
 * job hands its run to the caller, which reads the proposals again; a failed one shows R4's sentence and, for an analyst
 * the server lets retry, the retry. The status line is a polite live region, and focus is never moved on completion.
 */
export type RiskProposalJobTiming = { readonly pollIntervalMs: number; readonly timeoutMs: number };
export const DEFAULT_JOB_TIMING: RiskProposalJobTiming = { pollIntervalMs: 2_000, timeoutMs: 30_000 };

const CHECKS_STOPPED = 'Automatic checks stopped after 30 seconds. The AI may still be working.';

/** The job's words, by what it asks the AI to do (§2.3, §4.2). */
function jobCopy(job: RiskProposalJobView, riskNumber: string | null) {
  if (job.operation === 'risk-rewrite') {
    const number = riskNumber ?? 'the risk';
    return {
      status: `The AI is rewriting ${number}`,
      caption: 'You can leave this page. The proposed changes show here when you come back.',
      failedTitle: 'The AI rewrite didn’t finish',
      retry: 'Retry rewrite',
      retryName: `Retry rewrite: ${number}`,
    };
  }
  return {
    status: 'The AI is looking for more risks',
    caption: 'You can leave this page. Proposed risks show here when you come back.',
    failedTitle: 'The AI request didn’t finish',
    retry: 'Retry AI proposals',
    retryName: 'Retry AI proposals',
  };
}

/** `Started by {name}.` when another analyst asked the AI. */
export function jobStartedBy(job: Pick<RiskProposalJobView, 'initiatedBy' | 'initiatedByViewer'>): string | null {
  return !job.initiatedByViewer && job.initiatedBy ? `Started by ${job.initiatedBy.displayName}.` : null;
}

export function isActiveJob(job: RiskProposalJobView | null | undefined): job is RiskProposalJobView {
  return job !== null && job !== undefined && (job.status === 'queued' || job.status === 'running');
}

export function RiskProposalJob({ assessmentId, job: seed, onCompleted, onFailed, onGone, onRetried, riskNumber = null, slot, statusAttribute = 'data-ai-proposals-job-status', timing = DEFAULT_JOB_TIMING }: {
  assessmentId: string;
  job: RiskProposalJobView;
  /**
   * The completed job: the caller reads the proposals again and says what is ready. `hadFocus` says the status line held
   * focus, which the caller then moves on, as the line leaves the page (FE4-08).
   */
  onCompleted: (job: RiskProposalJobView, hadFocus: boolean) => void;
  /** The job failed while followed, so the caller no longer counts it as running (FE4-05); `hadFocus` as above. */
  onFailed?: (job: RiskProposalJobView, hadFocus: boolean) => void;
  /** FE4-01: the job is no longer known (jobs are process-local), so the caller reads again instead of waiting on it. */
  onGone?: (job: RiskProposalJobView) => void;
  /** The retried job, which the caller follows in this one's place. */
  onRetried: (job: RiskProposalJobView) => void;
  /** The rewritten Risk's number; null for Suggest more risks. */
  riskNumber?: string | null;
  /**
   * FE4-02: where the job shows, when not in place. The job is followed where this component is rendered, so it keeps
   * following while it shows elsewhere or, with a null slot, nowhere (the phone summary or the sheet, whichever is open).
   */
  slot?: HTMLElement | null;
  /** The status line's hook, so a start elsewhere can land focus on it. */
  statusAttribute?: string;
  timing?: RiskProposalJobTiming;
}) {
  const [job, setJob] = useState(seed);
  const [timedOut, setTimedOut] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [cycle, setCycle] = useState(0);
  const startedAt = useRef(Date.now());
  const root = useRef<HTMLDivElement>(null);
  const active = isActiveJob(job);
  const copy = jobCopy(job, riskNumber);

  useEffect(() => {
    if (!active || timedOut) return undefined;
    const remaining = timing.timeoutMs - (Date.now() - startedAt.current);
    if (remaining <= 0) {
      setTimedOut(true);
      return undefined;
    }
    let live = true;
    const handle = setTimeout(() => {
      const failed = () => {
        if (!live) return;
        setStatusError(true);
        setCycle((current) => current + 1);
      };
      void readRiskProposalJobAction({ jobId: job.jobId }).then((result) => {
        if (!live) return;
        if (!result?.ok) return result?.status === 404 && onGone ? onGone(job) : failed();
        const hadFocus = Boolean(root.current?.contains(document.activeElement));
        setStatusError(false);
        setJob(result.data);
        if (result.data.status === 'completed') onCompleted(result.data, hadFocus);
        else if (result.data.status === 'failed') onFailed?.(result.data, hadFocus);
        else setCycle((current) => current + 1);
      }, failed);
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => { live = false; clearTimeout(handle); };
    // `onCompleted` is the caller's; a new function each render must not restart the wait.
  }, [active, cycle, job.jobId, timedOut, timing]);

  function checkAgain() {
    startedAt.current = Date.now();
    setTimedOut(false);
    setCycle((current) => current + 1);
  }

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const result = await retryRiskProposalJobAction({ assessmentId, jobId: job.jobId });
      if (result.ok) onRetried(result.data);
      else setRetryError(result.message);
    } catch {
      setRetryError(riskAiStartRefusal({}).message);
    } finally {
      setRetrying(false);
    }
  }

  const place = (node: ReactNode) => (slot === undefined ? node : slot ? createPortal(node, slot) : null);
  const startedBy = jobStartedBy(job);
  if (job.status === 'failed') {
    const sentence = riskProposalJobFailureCopy(job, riskNumber) ?? riskAiStartRefusal({}).message;
    return place(
      <Alert ref={root} role="alert" variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle className="outline-none" data-proposal-job-failed={job.operation} tabIndex={-1}>{copy.failedTitle}</AlertTitle>
        <AlertDescription className="grid gap-2">
          <p>{sentence}</p>
          {startedBy ? <p>{startedBy}</p> : null}
          {retryError ? <p>{retryError}</p> : null}
          {job.canRetry ? (
            <Button aria-label={copy.retryName === copy.retry ? undefined : copy.retryName} className="w-fit max-md:min-h-11" data-print="hidden" disabled={retrying} onClick={() => void retry()} size="sm" type="button" variant="outline">
              <RotateCcw aria-hidden="true" />{copy.retry}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>,
    );
  }
  if (!active) return null;
  const rewrite = job.operation === 'risk-rewrite';
  return place(
    <div className={cn('grid gap-2', rewrite ? null : 'rounded-lg border border-border p-4')} ref={root}>
      <div className="flex flex-wrap items-center gap-2">
        <p aria-live="polite" className="text-sm font-medium text-foreground focus-visible:outline-none" tabIndex={-1} {...{ [statusAttribute]: '' }}>{copy.status}</p>
        <Badge variant="outline">Attempt {job.attempt}</Badge>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-foreground-secondary">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        {rewrite ? 'Rewriting…' : copy.caption}
      </p>
      {rewrite ? <p className="text-xs text-foreground-secondary">{copy.caption}</p> : null}
      {startedBy ? <p className="text-xs text-foreground-secondary">{startedBy}</p> : null}
      {statusError ? <p className="text-xs text-destructive" role="alert">{JOB_STATUS_UNAVAILABLE}</p> : null}
      {timedOut ? (
        <div className="grid gap-2">
          <p className="text-xs text-foreground-secondary">{CHECKS_STOPPED}</p>
          <Button className="w-fit max-md:min-h-11" onClick={checkAgain} size="sm" type="button" variant="outline">Check again</Button>
        </div>
      ) : null}
    </div>,
  );
}
