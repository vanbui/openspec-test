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
  initialJob,
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
  initialJob?: QuestionnaireGenerationJob;
  timing?: QuestionnaireGenerationJobTiming;
}) {
  const [job, setJob] = useState<QuestionnaireGenerationJob | null>(initialJob ?? null);
  const [announcement, setAnnouncement] = useState(initialJob ? statusCopy[initialJob.status] : '');
  const [formError, setFormError] = useState<string | null>(null);
  /* A refused replacement is shown inside its confirmation, which stays open (UI-SPEC §3.2, §10.2 I). */
  const [replacementError, setReplacementError] = useState<string | null>(null);
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
    setReplacementError(null);
    const result = await startQuestionnaireGenerationAction({ requestId, replaceUnansweredQuestionnaire });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return false;
    setPending(false);
    if (!result.ok) {
      if (replaceUnansweredQuestionnaire) setReplacementError(result.formError);
      else setFormError(result.formError);
      setAnnouncement('Questionnaire generation could not be started');
      return false;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
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
  const replacementTrigger = <Button disabled={pending} type="button" variant="outline"><Sparkles aria-hidden="true" />Replace questionnaire</Button>;
  const replace = <ConfirmDialog cancelLabel="Keep this questionnaire" confirmLabel="Replace questionnaire" confirmVariant="destructive" description={replacementDescription(analystChangesSinceGeneration)} errorMessage={replacementError} onConfirm={confirmReplacement} onDismiss={() => setReplacementError(null)} pendingLabel="Replacing questionnaire…" title="Replace this questionnaire?" trigger={replacementTrigger} />;
  const questionnaireLabel = questionnaireNumber && existingQuestionnaireHref ? <RecordLink href={existingQuestionnaireHref}>{questionnaireNumber}</RecordLink> : (questionnaireNumber ?? 'the questionnaire');
  const releasedHint = <p className="text-sm text-foreground-secondary">This questionnaire has been released to the Requestor. To replace it, return {questionnaireLabel} to analyst review first.</p>;
  const state = job?.status === 'failed' ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription>{failureCopy.get(job.failureCode) ?? job.failureMessage}</AlertDescription></Alert>
    : job?.status === 'completed' ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">Provider: {job.providerName} ({job.providerVersion}). Review the generated questionnaire before use.</p></div></div>
      : job ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy[job.status]}</p><p className="text-sm text-muted-foreground">This page remains available while the server-owned job is checked.</p></div></div> : null;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-heading-sm">Questionnaire generation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate a questionnaire from this request for Security Analyst review.</p>
      </div>
      {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
    </CardHeader>
    <CardContent className="space-y-4"><div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
      {!job && action === 'generate' ? generate : null}
      {!job && action === 'replace' ? replace : null}
      {state}{formError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">Automatic checks stopped after 30 seconds. The server-owned job remains authoritative.</p><Button className="w-fit" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
      {/*
        * Retrying re-runs the job exactly as it was, so a refusal for a missing
        * replacement acknowledgement would fail the same way forever. Offer the
        * acknowledged replacement instead (UI-SPEC §12.1), the only route out of
        * that state, unless the questionnaire has since been released.
        */}
      {job?.status === 'failed' && job.failureCode === 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED'
        ? (action === 'released' ? null : replace)
        : job?.status === 'failed' ? <Button disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying questionnaire generation…' : 'Retry questionnaire generation'}</Button> : null}
      {/* D-09 (UI-SPEC §3.3): a released questionnaire is never offered for replacement; say how to get there. */}
      {action === 'released' && (!job || job.status === 'failed') ? releasedHint : null}
      {job?.status === 'completed' ? <Link className={buttonVariants()} href={questionnaireHref(job.questionnaire.documentId)}>Review generated questionnaire</Link> : null}
    </CardContent>
  </Card>;
}
