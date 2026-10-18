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
import { aiJobFailureCopy, type AiPolicyStatus } from '../ai-assistance/ai-assistance-domain';
import { AiPolicyGate } from '../ai-assistance/ai-policy-gate';
import { ContextTooLargeFailure } from '../attachments/context-too-large-files';
import type { QuestionnaireGenerationJob, RequestGenerationJobs } from './assessment-schema';
import { settleGenerationAction } from './generation-failure-copy';
import { generationRefusalMessage, servedReason } from './generation-refusal';
import { InstructionField } from '../questionnaire-ai/instruction-field';
import { hubProposalsLine, instructionTooLongLine, replaceOffer, type QuestionnaireAiProposalsView } from '../questionnaire-ai/questionnaire-ai-domain';
import { HubProposalJob } from '../questionnaire-ai/hub-proposal-job';
import { writeSessionDraft } from '@/lib/session-drafts/session-drafts';

/** The request's questionnaire generation job as the jobs read serves it: the job and whether this viewer may retry it (the job's own canRetry). */
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

/*
 * 15-UI-SPEC §8.3 (D-09, UI-D21): a replacement is offered only when nothing would be lost, so its confirmation has one
 * description. Phase 10's one-change, n-change and unavailable-count descriptions are retired.
 */
const replacementDescription = 'This generates a new questionnaire from the request and replaces this one. No analyst has changed its questions and the Requestor hasn’t answered it, so nothing is lost. The new questionnaire stays in analyst review until you release it.';
/* Without the proposals read (a requesting analyst, or a failed read), the served count decides (Phase 10's relation rule). */
const ANALYST_CHANGES_LINE = 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.';
const CHANGES_UNKNOWN_LINE = 'CSRM couldn’t check whether analysts have changed this questionnaire since it was generated, so it isn’t offered for replacement. Reload the page to check again.';

/* The shortcut never confirms a destructive replacement: the analyst confirms with the dialog's own button. */
const ignoreShortcut = () => undefined;

type ReplaceDecision = { offered: true } | { offered: false; line: string | null; link: { label: string; href: string } | null };

function replaceDecision(view: QuestionnaireAiProposalsView | null | undefined, analystChanges: number | null | undefined): ReplaceDecision {
  if (view) {
    const offer = replaceOffer(view);
    if (offer.offered) return offer;
    return { offered: false, line: offer.line, link: offer.link ? { label: offer.link.label, href: `${questionnaireHref(view.questionnaireId)}${offer.link.href}` } : null };
  }
  if (analystChanges === 0) return { offered: true };
  return { offered: false, line: typeof analystChanges === 'number' ? ANALYST_CHANGES_LINE : CHANGES_UNKNOWN_LINE, link: null };
}

/**
 * A failed job's code read as a sentence about the request (UI-SPEC §12.4). Any other code shows the
 * server's own message unchanged. A Map, so a served code can never reach an inherited property.
 */
const leaveAndReturn = 'You can leave this page. The status shows here when you come back.';
/* UI-SPEC §12.1, §12.2 and §12.5; the draft card states the same copy. */
const automaticChecksStopped = 'Automatic checks stopped after 30 seconds. Generation may still be running.';
/* True because each registry hands back the request's active job instead of starting a second one (§12.5). */
const jobsReadFailedNotice = 'We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.';

/*
 * UI-SPEC §13 (D-18): a job a colleague started names them, whether it is queued, running or failed; the viewer's
 * own job, including the attempt their retry started, shows no line. A person who can no longer be read is not named.
 */
function startedByLine(job: QuestionnaireGenerationJob): string | null {
  return job.initiatedByViewer || !job.initiatedBy ? null : `Started by ${job.initiatedBy.displayName}.`;
}

type PollResult = { ok: true; entry: SeededQuestionnaireGenerationJob | null } | { ok: false; formError: string };

/*
 * D-18: any analyst on the request may read a job by id, but the request's jobs read also follows a job that a
 * colleague's start replaced, so a job the viewer did not start is followed through the request (the route is keyed
 * on initiatedByViewer, never on canRetry). The by-id result's canRetry is the served job's own.
 */
async function pollJob(requestId: string, jobId: string, byRequest: boolean): Promise<PollResult> {
  if (byRequest) {
    const result = await settleGenerationAction('generationJobs', () => getRequestGenerationJobsAction({ requestId }));
    return result.ok ? { ok: true, entry: result.data.questionnaireGeneration } : { ok: false, formError: result.formError };
  }
  const result = await settleGenerationAction('questionnaireGeneration', () => getQuestionnaireGenerationJobAction({ jobId }));
  return result.ok ? { ok: true, entry: { job: result.data, canRetry: result.data.canRetry } } : { ok: false, formError: result.formError };
}

/* Phase 15 (15-UI-SPEC §3.1, §12): the Generate field's hint and the requesting analyst's caption. */
const GENERATE_INSTRUCTION_HINT = 'Say what the questionnaire should focus on, for example “Cover the offshore support team and payroll data”. The AI already reads the request and the marked notes and files.';
const OWN_REQUEST_GENERATE_CAPTION = 'You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.';
const INSTRUCTION_REASONS: ReadonlySet<string> = new Set(['INSTRUCTION_TOO_LONG', 'INSTRUCTION_CHARACTERS_NOT_ALLOWED', 'INSTRUCTION_REPEATS_REQUESTOR_TEXT']);

const failureCopy = new Map<string, string>([
  ['REQUEST_NOT_ELIGIBLE', 'The request is no longer submitted, so a questionnaire can’t be generated for it.'],
  ['QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED', 'A questionnaire already exists for this request. Replace it to generate a new one.'],
  ['QUESTIONNAIRE_ANSWERED', 'The Requestor has started answering this questionnaire, so it can’t be replaced.'],
  ['QUESTIONNAIRE_RELEASED', 'The questionnaire was released before generation finished, so it wasn’t replaced. Return it to analyst review to replace it.'],
  ['HISTORY_UNAVAILABLE', 'This questionnaire’s change history can’t record more changes. Contact your administrator.'],
]);

export function QuestionnaireGenerationJob({
  requestId,
  action,
  aiInputsChanged,
  aiProposals = null,
  analystChangesSinceGeneration,
  aiPolicy,
  questionnaireHref: existingQuestionnaireHref,
  questionnaireNumber,
  seededJob,
  jobsReadFailed = false,
  onJobStatusChange,
  ownRequest = false,
  ownerKey = null,
  timing = defaultTiming,
}: {
  requestId: string;
  /** What the served questionnaire relation allows: `questionnaireGenerationAction` in request-domain. */
  action: QuestionnaireGenerationAction;
  /**
   * Phase 13 D-29 (13-UI-SPEC §10.2): the questionnaire's "AI inputs changed" block, rendered on the server by the hub page
   * and handed through as a slot, set above the card's idle action or state line.
   */
  aiInputsChanged?: ReactNode;
  /**
   * Phase 15 (15-UI-SPEC §8.3, §8.4; D-09, D-29, D-33): the questionnaire's AI proposals read, which decides Replace and
   * carries the proposals line and the hub's proposal job. `null` for a requesting analyst (D-32) or a failed read.
   */
  aiProposals?: QuestionnaireAiProposalsView | null;
  /** The served AI data policy (D-29); absent when the jobs read failed. */
  aiPolicy?: AiPolicyStatus | null;
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
  /** Phase 15 D-32: the viewer raised this request, so they generate without an instruction (15-UI-SPEC §12). */
  ownRequest?: boolean;
  /** The draft owner key the instruction is kept under for the session (15-UI-SPEC §3.2). */
  ownerKey?: string | null;
}) {
  /* D-18: the job carries whether this viewer may retry it and whether they started it, so the card keeps no copy. */
  const [job, setJob] = useState<QuestionnaireGenerationJob | null>(seededJob?.job ?? null);
  const [announcement, setAnnouncement] = useState(seededJob ? statusCopy[seededJob.job.status] : '');
  /* A status check that failed (UI-SPEC §12.1 `Status unavailable`). */
  const [formError, setFormError] = useState<string | null>(null);
  /* A start or retry Strapi refused: not a status check, so it has its own title. */
  const [startError, setStartError] = useState<string | null>(null);
  /* A refused replacement is shown inside its confirmation, which stays open (UI-SPEC §3.2, §10.2 I). */
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /* Phase 15 (15-UI-SPEC §3.3; D-12): the optional instruction on Generate, and its refusal beside the field. */
  const [instruction, setInstruction] = useState('');
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
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
   * resets only when the seeded job, its status, the viewer's retry right or whose it is changes. A seed that disappears
   * (the job completed, so it is no longer seeded) leaves this session's job, and its review link, in place.
   */
  const seededKey = seededJob ? `${seededJob.job.jobId}:${seededJob.job.status}:${seededJob.job.canRetry}:${seededJob.job.initiatedByViewer}` : null;
  useEffect(() => {
    if (!seededJob) return;
    setJob(seededJob.job);
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
    const byRequest = job.initiatedByViewer !== true;
    const handle = timing.setTimeout(() => {
      if (!mountedRef.current || requestInFlightRef.current) return;
      requestInFlightRef.current = true;
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
          activeJobIdRef.current = null;
          setJob(null);
          setAnnouncement('');
          return;
        }
        activeJobIdRef.current = entry.job.jobId;
        setJob((current) => {
          if (current?.jobId !== entry.job.jobId || current.status !== entry.job.status) setAnnouncement(statusCopy[entry.job.status]);
          return entry.job;
        });
      }).finally(() => {
        requestInFlightRef.current = false;
        /*
         * WR-202: always schedule the next check. A tick that found this check in flight was skipped, and the
         * job shown may have changed meanwhile (a refreshed seed); the effect re-reads whichever job is shown,
         * and stops for none, a completed or failed job, or the timeout.
         */
        if (mountedRef.current) setPollCycle((current) => current + 1);
      });
    }, Math.min(timing.pollIntervalMs, remaining));
    return () => timing.clearTimeout(handle);
  }, [job, pollCycle, requestId, timedOut, timing]);

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
    const sent = ownRequest ? '' : instruction.trim() === '' ? '' : instruction;
    const tooLong = instructionTooLongLine(sent.length);
    if (tooLong) {
      requestInFlightRef.current = false;
      setPending(false);
      setInstructionError(tooLong);
      instructionRef.current?.focus();
      return false;
    }
    setInstructionError(null);
    const result = await settleGenerationAction('questionnaireGeneration', () => startQuestionnaireGenerationAction(sent ? { requestId, replaceUnansweredQuestionnaire, instruction: sent } : { requestId, replaceUnansweredQuestionnaire }));
    /* WR-408, IN-303: a refusal by the AI data policy names the classification and the approved limit as they stand. */
    const refusal = result.ok ? null : await generationRefusalMessage({ requestId, formError: result.formError, reason: servedReason(result), servedPolicy: aiPolicy });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return false;
    setPending(false);
    if (!result.ok) {
      const reason = servedReason(result);
      if (reason !== undefined && INSTRUCTION_REASONS.has(reason)) {
        setInstructionError(result.formError);
        instructionRef.current?.focus();
      } else if (replaceUnansweredQuestionnaire) setReplacementError(refusal ?? result.formError);
      else setStartError(refusal ?? result.formError);
      setAnnouncement('Questionnaire generation could not be started');
      return false;
    }
    setInstruction('');
    if (ownerKey) writeSessionDraft(replaceUnansweredQuestionnaire ? 'replacement-instruction' : 'generation-instruction', ownerKey, requestId, '');
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    /* A start hands back the request's active job, which a colleague may have started; the job says whose it is (§12.5, §13). */
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
    const result = await settleGenerationAction('questionnaireGeneration', () => retryQuestionnaireGenerationJobAction({ jobId: job.jobId }));
    /* IN-104: Strapi refuses a retry by the AI data policy as it refuses an enqueue, so it reads the same way. */
    const refusal = result.ok ? null : await generationRefusalMessage({ requestId, formError: result.formError, reason: servedReason(result), servedPolicy: aiPolicy });
    requestInFlightRef.current = false;
    if (!mountedRef.current) return;
    setPending(false);
    if (!result.ok) {
      setStartError(refusal ?? result.formError);
      setAnnouncement('Questionnaire generation could not be retried');
      return;
    }
    pollingStartedAtRef.current = timing.now();
    setTimedOut(false);
    activeJobIdRef.current = result.data.jobId;
    /* D-18, G-3: a retry is the retrying analyst's attempt, so the served job is now the viewer's own. */
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
  const replacementField = ownRequest ? <p className="text-sm text-foreground-secondary">{OWN_REQUEST_GENERATE_CAPTION}</p> : <InstructionField draft={{ kind: 'replacement-instruction', recordId: requestId, ownerKey }} error={instructionError} fieldRef={instructionRef} hint={GENERATE_INSTRUCTION_HINT} id={`replacement-instruction-${requestId}`} onChange={setInstruction} onSubmitShortcut={ignoreShortcut} value={instruction} />;
  const replaceDialog = <ConfirmDialog cancelLabel="Keep this questionnaire" confirmLabel="Replace questionnaire" confirmVariant="destructive" description={replacementDescription} errorMessage={replacementError} onConfirm={confirmReplacement} onDismiss={() => setReplacementError(null)} pendingLabel="Replacing questionnaire…" title="Replace this questionnaire?" trigger={replacementTrigger}>{replacementField}</ConfirmDialog>;
  const decision = replaceDecision(aiProposals, analystChangesSinceGeneration);
  const replace = decision.offered ? replaceDialog : null;
  const notReplaceableLine = !decision.offered && decision.line ? <p className="text-sm text-foreground-secondary">{decision.line}{decision.link ? <>{' '}<Link className="font-medium text-primary underline-offset-4 hover:underline" href={decision.link.href}>{decision.link.label}</Link></> : null}</p> : null;
  const panelHref = aiProposals ? `${questionnaireHref(aiProposals.questionnaireId)}#ai-proposals` : null;
  const proposalsLine = aiProposals && panelHref ? hubProposalsLine(aiProposals.openCount) : null;
  const questionnaireLabel = questionnaireNumber && existingQuestionnaireHref ? <RecordLink href={existingQuestionnaireHref}>{questionnaireNumber}</RecordLink> : (questionnaireNumber ?? 'the questionnaire');
  const releasedHint = <p className="text-sm text-foreground-secondary">This questionnaire has been released to the Requestor. To replace it, return {questionnaireLabel} to analyst review first.</p>;
  /* IN-201: a questionnaire that exists but is not served as released; the page knows no more than that. */
  const existsHint = <p className="text-sm text-foreground-secondary">A questionnaire already exists for this request.</p>;
  const replacementRefused = action === 'released' || action === 'exists';
  /* What the card offers with no job on it, per the served questionnaire relation (UI-SPEC §3.1). */
  const offeredAction = action === 'generate' ? generate : action === 'replace' ? replace : null;
  /* 12-UI-SPEC §11.1: the policy gates the action wherever the card offers one. */
  const idleAction = offeredAction ? <AiPolicyGate action={offeredAction} policy={aiPolicy} /> : null;
  const retryButton = <Button disabled={pending} onClick={() => void retry()} type="button" variant="outline"><RotateCcw aria-hidden="true" />{pending ? 'Retrying questionnaire generation…' : 'Retry questionnaire generation'}</Button>;
  const startedBy = job ? startedByLine(job) : null;
  /*
   * 15-UI-SPEC §13 (D-29, D-33): CONTEXT_TOO_LARGE reads by the shared rule (the served notes sentence, the files, or 12
   * §11.2's sentence); every other code keeps 12 §12.4's order.
   */
  const state = job?.status === 'failed' ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{statusCopy.failed}</AlertTitle><AlertDescription>{job.failureCode === 'CONTEXT_TOO_LARGE' ? <ContextTooLargeFailure failure={job} fallback={aiJobFailureCopy('CONTEXT_TOO_LARGE') ?? job.failureMessage} requestId={requestId} /> : <p>{aiJobFailureCopy(job.failureCode) ?? failureCopy.get(job.failureCode) ?? job.failureMessage}</p>}{startedBy ? <p>{startedBy}</p> : null}</AlertDescription></Alert>
    : job?.status === 'completed' ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><CheckCircle2 aria-hidden="true" /><div><p className="font-medium">{statusCopy.completed}</p><p className="text-sm text-muted-foreground">Provider: {job.providerName} ({job.providerVersion}). Review the generated questionnaire before use.</p></div></div>
      : job ? <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-border p-4"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><div><p className="font-medium">{statusCopy[job.status]}</p><p className="text-sm text-muted-foreground">{leaveAndReturn}</p>{startedBy ? <p className="text-sm text-muted-foreground">{startedBy}</p> : null}</div></div> : null;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-heading-sm">Questionnaire generation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate a questionnaire from this request for Security Analyst review.</p>
      </div>
      {job ? <Badge variant="outline">Attempt {job.attempt}</Badge> : null}
    </CardHeader>
    <CardContent className="space-y-4"><div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</div>
      {aiInputsChanged}
      {!job && jobsReadFailed && idleAction ? <p className="text-sm text-foreground-secondary">{jobsReadFailedNotice}</p> : null}
      {!job && action === 'generate' && idleAction ? (ownRequest
        ? <p className="text-sm text-foreground-secondary">{OWN_REQUEST_GENERATE_CAPTION}</p>
        : <InstructionField draft={{ kind: 'generation-instruction', recordId: requestId, ownerKey }} error={instructionError} fieldRef={instructionRef} hint={GENERATE_INSTRUCTION_HINT} id={`generation-instruction-${requestId}`} onChange={setInstruction} onSubmitShortcut={() => void start(false)} value={instruction} />) : null}
      {!job ? idleAction : null}
      {!job && action === 'replace' && idleAction && ownRequest ? <p className="text-sm text-foreground-secondary">{OWN_REQUEST_GENERATE_CAPTION}</p> : null}
      {!job && action === 'replace' ? notReplaceableLine : null}
      {state}{startError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Questionnaire generation couldn’t start</AlertTitle><AlertDescription>{startError}</AlertDescription></Alert> : null}
      {formError ? <Alert role="alert" variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Status unavailable</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {timedOut ? <div className="grid gap-3 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Clock3 aria-hidden="true" /><p className="font-medium">Taking longer than expected</p></div><p className="text-sm text-muted-foreground">{automaticChecksStopped}</p><Button className="w-fit" onClick={checkAgain} type="button" variant="outline">Check again</Button></div> : null}
      {/*
        * Retrying re-runs the job exactly as it was, so a refusal for a missing
        * replacement acknowledgement would fail the same way forever. Offer the
        * acknowledged replacement instead (UI-SPEC §12.1), the only route out of
        * that state, unless the questionnaire has since been released.
        */}
      {/* D-18 (UI-SPEC §13): every analyst on the request may retry a failed job; one the viewer may not retry offers a new start. */}
      {/* WR-308 (D-29): Retry and this Replace generate too, so the served policy gates them, without the idle caption. */}
      {job?.status === 'failed' && job.failureCode === 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED'
        ? (replacementRefused ? null : replace ? <AiPolicyGate action={replace} caption={false} policy={aiPolicy} /> : notReplaceableLine)
        : job?.status === 'failed' ? (job.canRetry ? <AiPolicyGate action={retryButton} caption={false} policy={aiPolicy} /> : idleAction) : null}
      {/* D-09 (UI-SPEC §3.3): a released questionnaire is never offered for replacement; say how to get there. */}
      {action === 'released' && (!job || job.status === 'failed') ? releasedHint : null}
      {action === 'exists' && (!job || job.status === 'failed') ? existsHint : null}
      {job?.status === 'completed' ? <Link className={buttonVariants()} href={questionnaireHref(job.questionnaire.documentId)}>Review generated questionnaire</Link> : null}
      {/* 15-UI-SPEC §8.4 (D-29, D-33): the hub-started proposal job and the open proposals, never for a requesting analyst. */}
      {aiProposals && panelHref ? <HubProposalJob panelHref={panelHref} requestId={requestId} timing={timing} view={aiProposals} /> : null}
      {proposalsLine && panelHref ? (proposalsLine.linked
        ? <p className="text-sm tabular-nums"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={panelHref}>{proposalsLine.text}</Link></p>
        : <p className="text-sm text-foreground-secondary">{proposalsLine.text}</p>) : null}
    </CardContent>
  </Card>;
}
