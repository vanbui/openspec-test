'use client';

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import {
  getQuestionnaireGenerationJobAction,
  retryQuestionnaireGenerationJobAction,
  startQuestionnaireGenerationAction,
} from './assessment-actions';
import type { QuestionnaireGenerationJob } from './assessment-schema';

export interface QuestionnaireGenerationJobTiming {
  pollIntervalMs: number;
  timeoutMs: number;
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

const defaultTiming: QuestionnaireGenerationJobTiming = {
  pollIntervalMs: 1_000,
  timeoutMs: 30_000,
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

const statusCopy = {
  queued: 'Questionnaire generation is queued',
  running: 'Questionnaire generation is running',
  completed: 'Questionnaire generation is ready for review',
  failed: 'Questionnaire generation failed',
} satisfies Record<QuestionnaireGenerationJob['status'], string>;

function questionnaireHref(questionnaireId: string): string {
  return `/app/review/questionnaires/${encodeURIComponent(questionnaireId)}`;
}

export function QuestionnaireGenerationJob({
  requestId,
  hasExistingQuestionnaire,
  initialJob,
  timing = defaultTiming,
}: {
  requestId: string;
  hasExistingQuestionnaire: boolean;
  initialJob?: QuestionnaireGenerationJob;
  timing?: QuestionnaireGenerationJobTiming;
}) {
  const [job, setJob] = useState<QuestionnaireGenerationJob | null>(initialJob ?? null);
  const [announcement, setAnnouncement] = useState(initialJob ? statusCopy[initialJob.status] : '');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(initialJob?.jobId ?? null);
  const pollingStartedAtRef = useRef<number | null>(initialJob ? timing.now() : null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setJob(initialJob ?? null);
    activeJobIdRef.current = initialJob?.jobId ?? null;
    setTimedOut(false);
    setFormError(null);
    pollingStartedAtRef.current = initialJob ? timing.now() : null;
    if (initialJob) setAnnouncement(statusCopy[initialJob.status]);
  }, [initialJob, requestId, timing]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || timedOut) return;
    if (pollingStartedAtRef.current === null) pollingStartedAtRef.current = timing.now();
    const remaining = timing.timeoutMs - (timing.now() - pollingStartedAtRef.current);
    if (remaining <= 0) {
      setTimedOut(true);
      setAnnouncement('Questionnaire generation polling timed out');
      return;
    }
    const polledJobId = job.jobId;
    const handle = timing.setTimeout(() => {
      if (!mountedRef.current || requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      void getQuestionnaireGenerationJobAction({ jobId: polledJobId }).then((result) => {
        if (!mountedRef.current || activeJobIdRef.current !== polledJobId) return;
        if (result.ok) {
          setJob((current) => {
            if (current?.status !== result.data.status) setAnnouncement(statusCopy[result.data.status]);
            return result.data;
          });
          setFormError(null);
        } else {
          setFormError(result.formError);
          setAnnouncement('Questionnaire generation status could not be checked');
        }
      }).finally(() => {
        requestInFlightRef.current = false;
        if (mountedRef.current && activeJobIdRef.current === polledJobId) setPollCycle((current) => current + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => timing.clearTimeout(handle);
  }, [job, pollCycle, timedOut, timing]);

  async function start(replaceUnansweredQuestionnaire: boolean) {
    /*
     * A failed job is terminal, so starting again from that state is the only
     * way forward. Everything else stays blocked while a job is live.
     */
    if (requestInFlightRef.current || pending || (job && job.status !== 'failed')) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    const result = await startQuestionnaireGenerationAction({ requestId, replaceUnansweredQuestionnaire });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setAnnouncement('Questionnaire generation could not be started');
      return;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  async function retry() {
    if (!job || job.status !== 'failed' || requestInFlightRef.current || pending) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    const result = await retryQuestionnaireGenerationJobAction({ jobId: job.jobId });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setAnnouncement('Questionnaire generation could not be retried');
      return;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
  }

  function checkAgain() {
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    setFormError(null);
    setAnnouncement('Checking the current questionnaire generation status');
    setPollCycle((current) => current + 1);
  }

  const generate = <Button disabled={pending} onClick={() => void start(false)} type="button"><Sparkles aria-hidden="true" />{pending ? 'Starting questionnaire generation…' : 'Generate questionnaire'}</Button>;
  /*
   * AlertDialogTrigger preserves the child's click handler. A generation button
   * with `start(false)` would therefore submit an unacknowledged request while
   * opening the replacement confirmation. Keep this trigger presentation-only:
   * the only mutation it can reach is ConfirmDialog's `onConfirm` callback.
   */
  const acknowledgedReplacementTrigger = <Button disabled={pending} type="button"><Sparkles aria-hidden="true" />Generate questionnaire</Button>;
  const state = job?.status === 'failed' ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription>{job.failureMessage}</AlertDescription></Alert>
    : job?.status === 'completed' ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">Provider: {job.providerName} ({job.providerVersion}). Review the generated questionnaire before use.</p></div></div>
      : job ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy[job.status]}</p><p className="text-sm text-muted-foreground">This page remains available while the server-owned job is checked.</p></div></div> : null;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-heading-sm">Questionnaire generation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate a contextual questionnaire for analyst review.</p>
      </div>
      {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
    </CardHeader>
    <CardContent className="space-y-4"><div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
      {!job && (hasExistingQuestionnaire ? <ConfirmDialog confirmLabel="Replace unanswered questionnaire" confirmVariant="destructive" description="This replaces the existing questionnaire only when it has no Requestor answers. Answered questionnaires are protected." onConfirm={() => start(true)} pendingLabel="Starting questionnaire generation…" title="Replace the unanswered questionnaire?" trigger={acknowledgedReplacementTrigger} /> : generate)}
      {state}{formError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">Automatic checks stopped after 30 seconds. The server-owned job remains authoritative.</p><Button className="w-fit" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
      {/*
        * Retrying re-runs the job exactly as it was, so a refusal for a missing
        * replacement acknowledgement would fail the same way forever. Offer the
        * acknowledgement instead, which is the only route out of that state.
        */}
      {job?.status === 'failed' && job.failureCode === 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED'
        ? <ConfirmDialog confirmLabel="Replace unanswered questionnaire" confirmVariant="destructive" description="This replaces the existing questionnaire only when it has no Requestor answers. Answered questionnaires are protected." onConfirm={() => start(true)} pendingLabel="Starting questionnaire generation…" title="Replace the unanswered questionnaire?" trigger={<Button disabled={pending} type="button" variant="outline"><RotateCcw aria-hidden="true" />Replace and generate again</Button>} />
        : job?.status === 'failed' ? <Button disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying questionnaire generation…' : 'Retry questionnaire generation'}</Button> : null}
      {job?.status === 'completed' ? <Link className={buttonVariants()} href={questionnaireHref(job.questionnaire.documentId)}>Review generated questionnaire</Link> : null}
    </CardContent>
  </Card>;
}
