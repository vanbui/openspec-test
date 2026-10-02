'use client';

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { RecordLink } from '@/components/csrm/record-link';
import type { QuestionnaireGenerationAction } from '@/features/requests/request-domain';
import {
  getQuestionnaireGenerationJobAction,
  getRequestGenerationJobsAction,
  retryQuestionnaireGenerationJobAction,
  startQuestionnaireGenerationAction,
} from './assessment-actions';
import type { QuestionnaireGenerationJob, RequestGenerationJobs } from './assessment-schema';

/** The request's questionnaire generation job as the jobs read serves it: the job and whether this viewer may retry it. */
export type SeededQuestionnaireGenerationJob = NonNullable<RequestGenerationJobs['questionnaireGeneration']>;

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

const replacementOpening = 'This generates a new questionnaire from the request and replaces this one';
const replacementClosing = ' Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.';

/**
 * What a replacement discards (UI-SPEC §3.2, D-08): the served count of analyst changes to the questions
 * since the latest generation (D-16). A count the read did not serve is never guessed.
 */
function replacementDescription(analystChanges: number | null | undefined): ReactNode {
  if (analystChanges === 0) return `${replacementOpening}. No analyst has changed its questions since it was generated.${replacementClosing}`;
  if (analystChanges === 1) return <>{`${replacementOpening}, discarding the `}<span className="tabular-nums">1</span>{` change an analyst made to its questions since it was generated.${replacementClosing}`}</>;
  if (typeof analystChanges === 'number') return <>{`${replacementOpening}, discarding the `}<span className="tabular-nums">{analystChanges}</span>{` changes analysts made to its questions since it was generated.${replacementClosing}`}</>;
  return `${replacementOpening}, discarding any changes analysts made to its questions since it was generated.${replacementClosing}`;
}

/**
 * A failed job's code read as a sentence about the request (UI-SPEC §12.4). Any other code shows the
 * server's own message unchanged. A Map, so a served code can never reach an inherited property.
 */
const leaveAndReturn = 'You can leave this page. The status shows here when you come back.';
/* UI-SPEC §12.1, §12.2 and §12.5; the draft card states the same copy. */
const startedByAnotherAnalyst = 'Started by another Security Analyst.';
const retryRestrictedToInitiator = 'Only the Security Analyst who started it can retry it.';
const automaticChecksStopped = 'Automatic checks stopped after 30 seconds. Generation may still be running.';
/* True because each registry hands back the request's active job instead of starting a second one (§12.5). */
const jobsReadFailedNotice = 'We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.';

type PollResult = { ok: true; entry: SeededQuestionnaireGenerationJob | null } | { ok: false; formError: string };

/*
 * D-27: the by-id read and retry stay with the analyst who started the job, so a job this viewer may not
 * retry, or one a start handed back without saying whose it is, is followed through the request's jobs read.
 */
async function pollJob(requestId: string, jobId: string, byRequest: boolean): Promise<PollResult> {
  if (byRequest) {
    const result = await getRequestGenerationJobsAction({ requestId });
    return result.ok ? { ok: true, entry: result.data.questionnaireGeneration } : { ok: false, formError: result.formError };
  }
  const result = await getQuestionnaireGenerationJobAction({ jobId });
  return result.ok ? { ok: true, entry: { job: result.data, canRetry: true } } : { ok: false, formError: result.formError };
}

const failureCopy = new Map<string, string>([
  ['REQUEST_NOT_ELIGIBLE', 'The request is no longer submitted, so a questionnaire can’t be generated for it.'],
  ['QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED', 'A questionnaire already exists for this request. Replace it to generate a new one.'],
  ['QUESTIONNAIRE_ANSWERED', 'The Requestor has started answering this questionnaire, so it can’t be replaced.'],
  ['QUESTIONNAIRE_RELEASED', 'The questionnaire was released before generation finished, so it wasn’t replaced. Return it to analyst review to replace it.'],
]);

export function QuestionnaireGenerationJob({
  requestId,
  action,
  analystChangesSinceGeneration,
  questionnaireHref: existingQuestionnaireHref,
  questionnaireNumber,
  seededJob,
  jobsReadFailed = false,
  onJobStatusChange,
  timing = defaultTiming,
}: {
  requestId: string;
  /** What the served questionnaire relation allows: `questionnaireGenerationAction` in request-domain. */
  action: QuestionnaireGenerationAction;
  /** The existing questionnaire's analyst route, linked from the released hint (UI-SPEC §3.3). */
  questionnaireHref?: string;
  questionnaireNumber?: string | null;
  /** The served count of analyst changes since the latest generation; `null` when the read served none. */
  analystChangesSinceGeneration?: number | null;
  /**
   * The request's queued, running or failed job from the page's jobs read (D-26). A completed job is never
   * seeded, so the card then offers its normal action.
   */
  seededJob?: SeededQuestionnaireGenerationJob;
  /** The page's jobs read failed, so nothing could be seeded (UI-SPEC §12.5). */
  jobsReadFailed?: boolean;
  /** Reports the shown job's status, or `null` for none, so the hub can say generation is in progress (§12.3). */
  onJobStatusChange?: (status: QuestionnaireGenerationJob['status'] | null) => void;
  timing?: QuestionnaireGenerationJobTiming;
}) {
  const [job, setJob] = useState<QuestionnaireGenerationJob | null>(seededJob?.job ?? null);
  /* `null`: not yet known, as after a start, which may hand back a job another analyst started. */
  const [canRetry, setCanRetry] = useState<boolean | null>(seededJob ? seededJob.canRetry : null);
  const [announcement, setAnnouncement] = useState(seededJob ? statusCopy[seededJob.job.status] : '');
  /* A status check that failed (UI-SPEC §12.1 `Status unavailable`). */
  const [formError, setFormError] = useState<string | null>(null);
  /* A start or retry Strapi refused: not a status check, so it has its own title. */
  const [startError, setStartError] = useState<string | null>(null);
  /* A refused replacement is shown inside its confirmation, which stays open (UI-SPEC §3.2, §10.2 I). */
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(seededJob?.job.jobId ?? null);
  const pollingStartedAtRef = useRef<number | null>(seededJob ? timing.now() : null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const shownStatus = job?.status ?? null;
  useEffect(() => { onJobStatusChange?.(shownStatus); }, [onJobStatusChange, shownStatus]);

  /*
   * `router.refresh()` and revalidation hand the card a new seed object with the same content, so the card
   * resets only when the seeded job, its status or the viewer's retry right changes. A seed that disappears
   * (the job completed, so it is no longer seeded) leaves this session's job, and its review link, in place.
   */
  const seededKey = seededJob ? `${seededJob.job.jobId}:${seededJob.job.status}:${seededJob.canRetry}` : null;
  useEffect(() => {
    if (!seededJob) return;
    setJob(seededJob.job);
    setCanRetry(seededJob.canRetry);
    activeJobIdRef.current = seededJob.job.jobId;
    setTimedOut(false);
    setFormError(null);
    setStartError(null);
    pollingStartedAtRef.current = timing.now();
    setAnnouncement(statusCopy[seededJob.job.status]);
    // Keyed on the seed's content, not on the object (see above); `seededJob` is this render's seed.
  }, [seededKey]);

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
    const byRequest = canRetry !== true;
    const handle = timing.setTimeout(() => {
      if (!mountedRef.current || requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      let followedJobId: string | null = polledJobId;
      void pollJob(requestId, polledJobId, byRequest).then((result) => {
        if (!mountedRef.current || activeJobIdRef.current !== polledJobId) return;
        if (!result.ok) {
          setFormError(result.formError);
          setAnnouncement('Questionnaire generation status could not be checked');
          return;
        }
        setFormError(null);
        const { entry } = result;
        if (!entry) {
          /* The server no longer holds a job for this request (D-26: jobs stay in the server process). */
          followedJobId = null;
          activeJobIdRef.current = null;
          setJob(null);
          setCanRetry(null);
          setAnnouncement('');
          return;
        }
        followedJobId = entry.job.jobId;
        activeJobIdRef.current = entry.job.jobId;
        setCanRetry(entry.canRetry);
        setJob((current) => {
          if (current?.jobId !== entry.job.jobId || current.status !== entry.job.status) setAnnouncement(statusCopy[entry.job.status]);
          return entry.job;
        });
      }).finally(() => {
        requestInFlightRef.current = false;
        if (mountedRef.current && followedJobId !== null && activeJobIdRef.current === followedJobId) setPollCycle((current) => current + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => timing.clearTimeout(handle);
  }, [canRetry, job, pollCycle, requestId, timedOut, timing]);

  /** Starts generation; resolves `true` once a job exists, `false` when nothing started. */
  async function start(replaceUnansweredQuestionnaire: boolean): Promise<boolean> {
    /*
     * A failed job is terminal, so starting again from that state is the only
     * way forward. Everything else stays blocked while a job is live.
     */
    if (requestInFlightRef.current || pending || (job && job.status !== 'failed')) return false;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    setStartError(null);
    setReplacementError(null);
    const result = await startQuestionnaireGenerationAction({ requestId, replaceUnansweredQuestionnaire });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return false;
    setPending(false);
    if (!result.ok) {
      if (replaceUnansweredQuestionnaire) setReplacementError(result.formError);
      else setStartError(result.formError);
      setAnnouncement('Questionnaire generation could not be started');
      return false;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    /* A start hands back the request's active job, which another analyst may have started (UI-SPEC §12.5). */
    setCanRetry(null);
    setJob(result.data);
    setAnnouncement(statusCopy[result.data.status]);
    return true;
  }

  /* ConfirmDialog stays open when its confirm throws, so a refusal is read where the analyst confirmed. */
  async function confirmReplacement() {
    if (!(await start(true))) throw new Error('Questionnaire replacement did not start');
  }

  async function retry() {
    if (!job || job.status !== 'failed' || requestInFlightRef.current || pending) return;
    requestInFlightRef.current = true;
    setPending(true);
    setFormError(null);
    setStartError(null);
    const result = await retryQuestionnaireGenerationJobAction({ jobId: job.jobId });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setStartError(result.formError);
      setAnnouncement('Questionnaire generation could not be retried');
      return;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    /* Strapi lets only the analyst who started a job retry it, so this viewer started it. */
    setCanRetry(true);
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
  const replacementTrigger = <Button disabled={pending} type="button" variant="outline"><Sparkles aria-hidden="true" />Replace questionnaire</Button>;
  const replace = <ConfirmDialog cancelLabel="Keep this questionnaire" confirmLabel="Replace questionnaire" confirmVariant="destructive" description={replacementDescription(analystChangesSinceGeneration)} errorMessage={replacementError} onConfirm={confirmReplacement} onDismiss={() => setReplacementError(null)} pendingLabel="Replacing questionnaire…" title="Replace this questionnaire?" trigger={replacementTrigger} />;
  const questionnaireLabel = questionnaireNumber && existingQuestionnaireHref ? <RecordLink href={existingQuestionnaireHref}>{questionnaireNumber}</RecordLink> : (questionnaireNumber ?? 'the questionnaire');
  const releasedHint = <p className="text-sm text-foreground-secondary">This questionnaire has been released to the Requestor. To replace it, return {questionnaireLabel} to analyst review first.</p>;
  /* What the card offers with no job on it, per the served questionnaire relation (UI-SPEC §3.1). */
  const idleAction = action === 'generate' ? generate : action === 'replace' ? replace : null;
  const retryButton = <Button disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying questionnaire generation…' : 'Retry questionnaire generation'}</Button>;
  const state = job?.status === 'failed' ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription><p>{failureCopy.get(job.failureCode) ?? job.failureMessage}</p>{canRetry === false ? <p>{retryRestrictedToInitiator}</p> : null}</AlertDescription></Alert>
    : job?.status === 'completed' ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">Provider: {job.providerName} ({job.providerVersion}). Review the generated questionnaire before use.</p></div></div>
      : job ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy[job.status]}</p><p className="text-sm text-muted-foreground">{leaveAndReturn}</p>{canRetry === false ? <p className="text-sm text-muted-foreground">{startedByAnotherAnalyst}</p> : null}</div></div> : null;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-heading-sm">Questionnaire generation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate a questionnaire from this request for Security Analyst review.</p>
      </div>
      {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
    </CardHeader>
    <CardContent className="space-y-4"><div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
      {!job && jobsReadFailed && idleAction ? <p className="text-sm text-foreground-secondary">{jobsReadFailedNotice}</p> : null}
      {!job ? idleAction : null}
      {state}{startError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Questionnaire generation couldn’t start</AlertTitle><AlertDescription>{startError}</AlertDescription></Alert> : null}
      {formError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">{automaticChecksStopped}</p><Button className="w-fit" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
      {/*
        * Retrying re-runs the job exactly as it was, so a refusal for a missing
        * replacement acknowledgement would fail the same way forever. Offer the
        * acknowledged replacement instead (UI-SPEC §12.1), the only route out of
        * that state, unless the questionnaire has since been released.
        */}
      {/* D-26: Retry stays with the analyst who started the job; anyone else may start a new one. */}
      {job?.status === 'failed' && job.failureCode === 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED'
        ? (action === 'released' ? null : replace)
        : job?.status === 'failed' ? (canRetry === false ? idleAction : retryButton) : null}
      {/* D-09 (UI-SPEC §3.3): a released questionnaire is never offered for replacement; say how to get there. */}
      {action === 'released' && (!job || job.status === 'failed') ? releasedHint : null}
      {job?.status === 'completed' ? <Link className={buttonVariants()} href={questionnaireHref(job.questionnaire.documentId)}>Review generated questionnaire</Link> : null}
    </CardContent>
  </Card>;
}
