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
  retryAssessmentDraftJobAction,
  startAssessmentDraftAction,
} from './assessment-actions';
import type { AssessmentDraftJob as AssessmentDraftJobRecord } from './assessment-schema';

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
  queued: 'Draft assistance is queued',
  running: 'Draft assistance is running',
  completed: 'Draft assistance is ready for analyst review',
  failed: 'Draft assistance failed',
} satisfies Record<JobStatus, string>;

function assessmentHref(assessmentId: string): string {
  return `/app/review/assessments/${encodeURIComponent(assessmentId)}`;
}

function JobState({ job }: { job: AssessmentDraftJobRecord }) {
  if (job.status === 'completed') {
    return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">The generated content remains a reviewable draft and has not been released.</p></div></div>;
  }
  if (job.status === 'failed') {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription>{job.failureMessage}</AlertDescription></Alert>;
  }
  if (job.status === 'running') {
    return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy.running}</p><p className="text-sm text-muted-foreground">Deterministic draft assistance is preparing a reviewable proposal.</p></div></div>;
  }
  return <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><Clock3 aria-hidden="true" /><div><p className="font-medium">{statusCopy.queued}</p><p className="text-sm text-muted-foreground">The job is waiting to begin. This page will remain available while its status is checked.</p></div></div>;
}

function JobLifecycle({ job }: { job: AssessmentDraftJobRecord }) {
  const reached = [
    { label: 'Queued', reached: Boolean(job.queuedAt) },
    { label: 'Running', reached: 'startedAt' in job && Boolean(job.startedAt) },
    { label: job.status === 'failed' ? 'Failed' : 'Completed', reached: 'completedAt' in job && Boolean(job.completedAt) },
  ].filter((step) => step.reached);

  return (
    <ol aria-label="Draft assistance lifecycle" className="flex flex-wrap gap-2 text-sm">
      {reached.map((step) => <li className="rounded-lg border border-border bg-muted px-2 py-1 text-foreground" key={step.label}>{step.label}</li>)}
    </ol>
  );
}

export function AssessmentDraftJob({
  initialJob,
  questionnaireId,
  timing = defaultTiming,
}: {
  initialJob?: AssessmentDraftJobRecord;
  questionnaireId: string;
  timing?: AssessmentDraftJobTiming;
}) {
  const [job, setJob] = useState<AssessmentDraftJobRecord | null>(initialJob ?? null);
  const [announcement, setAnnouncement] = useState(initialJob ? statusCopy[initialJob.status] : '');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const pollingStartedAtRef = useRef<number | null>(initialJob ? timing.now() : null);
  const activeJobIdRef = useRef(initialJob?.jobId ?? null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setJob(initialJob ?? null);
    setTimedOut(false);
    setFormError(null);
    if (initialJob) setAnnouncement(statusCopy[initialJob.status]);
    if (activeJobIdRef.current !== (initialJob?.jobId ?? null)) {
      activeJobIdRef.current = initialJob?.jobId ?? null;
      pollingStartedAtRef.current = initialJob ? timing.now() : null;
      requestInFlightRef.current = false;
    }
  }, [initialJob, questionnaireId, timing]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || timedOut) return;
    if (pollingStartedAtRef.current === null) pollingStartedAtRef.current = timing.now();
    const elapsed = timing.now() - pollingStartedAtRef.current;
    const remaining = timing.timeoutMs - elapsed;
    if (remaining <= 0) {
      setTimedOut(true);
      setAnnouncement('Draft assistance polling timed out');
      return;
    }

    const handle = timing.setTimeout(() => {
      if (!mountedRef.current || requestInFlightRef.current) return;
      if (pollingStartedAtRef.current !== null && timing.now() - pollingStartedAtRef.current >= timing.timeoutMs) {
        setTimedOut(true);
        setAnnouncement('Draft assistance polling timed out');
        return;
      }
      requestInFlightRef.current = true;
      void getAssessmentDraftJobAction({ jobId: job.jobId }).then((result) => {
        if (!mountedRef.current) return;
        if (result.ok) {
          setJob((current) => {
            if (current?.status !== result.data.status) setAnnouncement(statusCopy[result.data.status]);
            return result.data;
          });
          setFormError(null);
        } else {
          setFormError(result.formError);
          setAnnouncement('Draft assistance status could not be checked');
        }
      }).finally(() => {
        requestInFlightRef.current = false;
        if (mountedRef.current) setPollCycle((cycle) => cycle + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));

    return () => timing.clearTimeout(handle);
  }, [job, pollCycle, timedOut, timing]);

  async function start() {
    if (requestInFlightRef.current || pending || job) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    const result = await startAssessmentDraftAction({ questionnaireId });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setAnnouncement('Draft assistance could not be started');
      return;
    }
    activeJobIdRef.current = result.data.jobId;
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  async function retry() {
    if (!job || job.status !== 'failed' || requestInFlightRef.current || pending) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    const result = await retryAssessmentDraftJobAction({ jobId: job.jobId });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setAnnouncement('Draft assistance could not be retried');
      return;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  function checkAgain() {
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    setFormError(null);
    setAnnouncement('Checking the current draft assistance status');
    setPollCycle((cycle) => cycle + 1);
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Deterministic draft assistance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Draft initiated by the signed-in analyst and always subject to analyst review.</p>
        </div>
        {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
        {!job ? <Button disabled={pending} onClick={() => void start()} type="button"><Sparkles aria-hidden="true" />{pending ? 'Starting draft assistance…' : 'Start deterministic draft assistance'}</Button> : <JobLifecycle job={job} />}
        {job && !timedOut ? <JobState job={job} /> : null}
        {formError ? <Alert variant="destructive" role="alert"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">Automatic checks stopped after 30 seconds. The server-owned job remains authoritative.</p><Button className="w-fit" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
        {job?.status === 'failed' ? <Button disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying draft assistance…' : 'Retry draft assistance'}</Button> : null}
        {job?.status === 'completed' ? <Link className={buttonVariants()} href={assessmentHref(job.assessmentId)}>Open completed assessment</Link> : null}
      </CardContent>
    </Card>
  );
}
