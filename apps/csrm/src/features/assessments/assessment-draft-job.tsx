'use client';

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  getAssessmentDraftJobAction,
  getRequestGenerationJobsAction,
  retryAssessmentDraftJobAction,
  startAssessmentDraftAction,
} from './assessment-actions';
import type { AssessmentDraftJob as AssessmentDraftJobRecord, RequestGenerationJobs } from './assessment-schema';
import { settleGenerationAction } from './generation-failure-copy';

/** The request's assessment draft job as the jobs read serves it: the job and whether this viewer may retry it. */
export type SeededAssessmentDraftJob = NonNullable<RequestGenerationJobs['assessmentDraft']>;

export interface AssessmentDraftJobTiming {
  pollIntervalMs: number;
  timeoutMs: number;
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

const defaultTiming: AssessmentDraftJobTiming = {
  pollIntervalMs: 1_000,
  timeoutMs: 30_000,
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

type JobStatus = AssessmentDraftJobRecord['status'];

const statusCopy = {
  queued: 'Draft generation is queued',
  running: 'Draft generation is running',
  completed: 'Draft generation is ready for Security Analyst review',
  failed: 'Draft generation failed',
} satisfies Record<JobStatus, string>;

/*
 * A draft is generated from the questionnaire's submitted answers, so until the linked questionnaire is
 * submitted the card offers no action and says why (WR-06). Strapi still refuses an early start (409).
 */
export const draftGenerationPrecondition = 'Draft generation can begin only after the linked questionnaire is submitted.';

/* UI-SPEC §12.1, §12.2 and §12.5; the questionnaire card states the same copy. */
const startedByAnotherAnalyst = 'Started by another Security Analyst.';
const retryRestrictedToInitiator = 'Only the Security Analyst who started it can retry it.';
const automaticChecksStopped = 'Automatic checks stopped after 30 seconds. Generation may still be running.';
/* True because each registry hands back the request's active job instead of starting a second one (§12.5). */
const jobsReadFailedNotice = 'We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.';

function assessmentHref(assessmentId: string): string {
  return `/app/review/assessments/${encodeURIComponent(assessmentId)}`;
}

type PollResult = { ok: true; entry: SeededAssessmentDraftJob | null } | { ok: false; formError: string };

/*
 * D-27: the by-id read and retry stay with the analyst who started the job, so a job this viewer may not
 * retry, or one a start handed back without saying whose it is, is followed through the request's jobs read.
 */
async function pollJob(requestId: string, jobId: string, byRequest: boolean): Promise<PollResult> {
  if (byRequest) {
    const result = await settleGenerationAction('generationJobs', () => getRequestGenerationJobsAction({ requestId }));
    return result.ok ? { ok: true, entry: result.data.assessmentDraft } : { ok: false, formError: result.formError };
  }
  const result = await settleGenerationAction('assessmentDraft', () => getAssessmentDraftJobAction({ jobId }));
  return result.ok ? { ok: true, entry: { job: result.data, canRetry: true } } : { ok: false, formError: result.formError };
}

function JobState({ canRetry, job }: { canRetry: boolean | null; job: AssessmentDraftJobRecord }) {
  if (job.status === 'completed') {
    return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">The generated draft is advisory and has not been released.</p></div></div>;
  }
  if (job.status === 'failed') {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription><p>{job.failureMessage}</p>{canRetry === false ? <p>{retryRestrictedToInitiator}</p> : null}</AlertDescription></Alert>;
  }
  const another = canRetry === false ? <p className="text-sm text-muted-foreground">{startedByAnotherAnalyst}</p> : null;
  if (job.status === 'running') {
    return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy.running}</p><p className="text-sm text-muted-foreground">A reviewable draft is being prepared from the questionnaire answers.</p>{another}</div></div>;
  }
  return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><Clock3 aria-hidden="true" /><div><p className="font-medium">{statusCopy.queued}</p><p className="text-sm text-muted-foreground">Generation is waiting to start. You can leave this page; the status shows here when you come back.</p>{another}</div></div>;
}

function JobLifecycle({ job }: { job: AssessmentDraftJobRecord }) {
  const reached = [
    { label: 'Queued', reached: Boolean(job.queuedAt) },
    { label: 'Running', reached: 'startedAt' in job && Boolean(job.startedAt) },
    { label: job.status === 'failed' ? 'Failed' : 'Completed', reached: 'completedAt' in job && Boolean(job.completedAt) },
  ].filter((step) => step.reached);

  return (
    <ol aria-label="Draft generation lifecycle" className="flex flex-wrap gap-2 text-sm">
      {reached.map((step) => <li className="rounded-lg border border-border bg-muted px-2 py-1 text-foreground" key={step.label}>{step.label}</li>)}
    </ol>
  );
}

export function AssessmentDraftJob({
  assessmentExists = false,
  className,
  jobsReadFailed = false,
  onJobStatusChange,
  questionnaireId,
  questionnaireSubmitted,
  requestId,
  seededJob,
  timing = defaultTiming,
}: {
  /**
   * Whether the request already has an assessment. A request has at most one, and Strapi refuses a second
   * draft (409), so with no job of this session the card offers nothing and renders nothing (W-1).
   */
  assessmentExists?: boolean;
  className?: string;
  /** The page's jobs read failed, so nothing could be seeded (UI-SPEC §12.5). */
  jobsReadFailed?: boolean;
  /** Reports the shown job's status, or `null` for none, so the hub can say generation is in progress (§12.3). */
  onJobStatusChange?: (status: JobStatus | null) => void;
  questionnaireId: string;
  /** Whether the linked questionnaire is submitted; until it is, generation cannot begin. */
  questionnaireSubmitted: boolean;
  /** The request the questionnaire belongs to: a job another analyst started is polled through its jobs read (D-27). */
  requestId: string;
  /**
   * The questionnaire's queued, running or failed draft job from the page's jobs read (D-26). A completed job
   * is never seeded.
   */
  seededJob?: SeededAssessmentDraftJob;
  timing?: AssessmentDraftJobTiming;
}) {
  const [job, setJob] = useState<AssessmentDraftJobRecord | null>(seededJob?.job ?? null);
  /* `null`: not yet known, as after a start, which may hand back a job another analyst started. */
  const [canRetry, setCanRetry] = useState<boolean | null>(seededJob ? seededJob.canRetry : null);
  const [announcement, setAnnouncement] = useState(seededJob ? statusCopy[seededJob.job.status] : '');
  /* A status check that failed (`Status unavailable`). */
  const [formError, setFormError] = useState<string | null>(null);
  /* A start or retry Strapi refused: not a status check, so it has its own title. */
  const [startError, setStartError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const pollingStartedAtRef = useRef<number | null>(seededJob ? timing.now() : null);
  const activeJobIdRef = useRef<string | null>(seededJob?.job.jobId ?? null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const shownStatus = job?.status ?? null;
  useEffect(() => { onJobStatusChange?.(shownStatus); }, [onJobStatusChange, shownStatus]);

  /*
   * `router.refresh()` and revalidation hand the card a new seed object with the same content, so the card
   * resets only when the seeded job, its status or the viewer's retry right changes. A seed that disappears
   * (the job completed, so it is no longer seeded) leaves this session's job, and its link, in place.
   */
  const seededKey = seededJob ? `${seededJob.job.jobId}:${seededJob.job.status}:${seededJob.canRetry}` : null;
  useEffect(() => {
    if (!seededJob) return;
    setJob(seededJob.job);
    setCanRetry(seededJob.canRetry);
    setTimedOut(false);
    setFormError(null);
    setStartError(null);
    setAnnouncement(statusCopy[seededJob.job.status]);
    if (activeJobIdRef.current !== seededJob.job.jobId) {
      activeJobIdRef.current = seededJob.job.jobId;
      pollingStartedAtRef.current = timing.now();
      /*
       * WR-202: a status check for the earlier job may still be in flight. It keeps the in-flight flag until it
       * settles and then schedules the next check, which reads this job, so two checks never overlap.
       */
    }
    // Keyed on the seed's content, not on the object (see above); `seededJob` is this render's seed.
  }, [seededKey]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || timedOut) return;
    if (pollingStartedAtRef.current === null) pollingStartedAtRef.current = timing.now();
    const elapsed = timing.now() - pollingStartedAtRef.current;
    const remaining = timing.timeoutMs - elapsed;
    if (remaining <= 0) {
      setTimedOut(true);
      setAnnouncement('Draft generation polling timed out');
      return;
    }

    const polledJobId = job.jobId;
    const byRequest = canRetry !== true;
    const handle = timing.setTimeout(() => {
      if (!mountedRef.current || requestInFlightRef.current) return;
      if (pollingStartedAtRef.current !== null && timing.now() - pollingStartedAtRef.current >= timing.timeoutMs) {
        setTimedOut(true);
        setAnnouncement('Draft generation polling timed out');
        return;
      }
      requestInFlightRef.current = true;
      void pollJob(requestId, polledJobId, byRequest).then((result) => {
        if (!mountedRef.current || activeJobIdRef.current !== polledJobId) return;
        if (!result.ok) {
          setFormError(result.formError);
          setAnnouncement('Draft generation status could not be checked');
          return;
        }
        setFormError(null);
        const { entry } = result;
        if (!entry) {
          /* The server no longer holds a draft job for this questionnaire (D-26: jobs stay in the server process). */
          activeJobIdRef.current = null;
          setJob(null);
          setCanRetry(null);
          setAnnouncement('');
          return;
        }
        activeJobIdRef.current = entry.job.jobId;
        setCanRetry(entry.canRetry);
        setJob((current) => {
          if (current?.jobId !== entry.job.jobId || current.status !== entry.job.status) setAnnouncement(statusCopy[entry.job.status]);
          return entry.job;
        });
      }).finally(() => {
        requestInFlightRef.current = false;
        if (mountedRef.current) setPollCycle((cycle) => cycle + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));

    return () => timing.clearTimeout(handle);
  }, [canRetry, job, pollCycle, requestId, timedOut, timing]);

  async function start() {
    /* A failed job is terminal, so starting again from it is how another analyst moves on (D-26). */
    if (requestInFlightRef.current || pending || (job && job.status !== 'failed')) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    setStartError(null);
    const result = await settleGenerationAction('assessmentDraft', () => startAssessmentDraftAction({ questionnaireId }));
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setStartError(result.formError);
      setAnnouncement('Draft generation could not be started');
      return;
    }
    activeJobIdRef.current = result.data.jobId;
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    /* A start hands back the active job, which another analyst may have started (UI-SPEC §12.5). */
    setCanRetry(null);
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  async function retry() {
    if (!job || job.status !== 'failed' || requestInFlightRef.current || pending) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    setStartError(null);
    const result = await settleGenerationAction('assessmentDraft', () => retryAssessmentDraftJobAction({ jobId: job.jobId }));
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setStartError(result.formError);
      setAnnouncement('Draft generation could not be retried');
      return;
    }
    activeJobIdRef.current = result.data.jobId;
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    /* Strapi lets only the analyst who started a job retry it, so this viewer started it. */
    setCanRetry(true);
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  function checkAgain() {
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    setFormError(null);
    setAnnouncement('Checking the current draft generation status');
    setPollCycle((cycle) => cycle + 1);
  }

  /*
   * The card stays mounted while the page re-renders: starting a draft revalidates this page, and the new
   * assessment can exist by then. The session that generated it keeps its job, its state and its link.
   */
  if (assessmentExists && !job) return null;

  const generate = <Button data-print="hidden" disabled={pending} onClick={() => void start()} type="button"><Sparkles aria-hidden="true" />{pending ? 'Starting draft generation…' : 'Generate assessment draft'}</Button>;

  return (
    <Card className={className}>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Assessment draft generation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Generate a draft Risk Assessment from the submitted questionnaire. The draft is advisory: it is recorded as initiated by you and is released only by a Security Analyst after review.</p>
        </div>
        {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
        {!job && questionnaireSubmitted && jobsReadFailed ? <p className="text-sm text-foreground-secondary">{jobsReadFailedNotice}</p> : null}
        {job ? <JobLifecycle job={job} />
          : questionnaireSubmitted ? generate
            : <p className="text-sm text-muted-foreground">{draftGenerationPrecondition}</p>}
        {job && !timedOut ? <JobState canRetry={canRetry} job={job} /> : null}
        {startError ? <Alert variant="destructive" role="alert"><AlertCircle aria-hidden="true" /><AlertTitle>Draft generation couldn’t start</AlertTitle><AlertDescription>{startError}</AlertDescription></Alert> : null}
        {formError ? <Alert variant="destructive" role="alert"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">{automaticChecksStopped}</p><Button className="w-fit" data-print="hidden" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
        {/* D-26: Retry stays with the analyst who started the job; anyone else may generate a new draft. */}
        {job?.status === 'failed'
          ? (canRetry === false
            ? (questionnaireSubmitted ? generate : null)
            : <Button data-print="hidden" disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying draft generation…' : 'Retry draft generation'}</Button>)
          : null}
        {job?.status === 'completed' ? <Link className={buttonVariants()} data-print="hidden" href={assessmentHref(job.assessmentId)}>Open assessment draft</Link> : null}
      </CardContent>
    </Card>
  );
}
