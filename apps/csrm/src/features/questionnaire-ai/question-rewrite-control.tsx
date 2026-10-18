'use client';

import { AlertCircle, LoaderCircle, RotateCcw, SpellCheck } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import { RecordLink } from '@/components/csrm/record-link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { AnsweredQuestionNote } from './answered-question-note';
import { InstructionField, ShortcutHint } from './instruction-field';
import { getQuestionnaireProposalJobAction, retryQuestionnaireProposalJobAction, startQuestionRewriteAction } from './questionnaire-ai-actions';
import {
  instructionTooLongLine,
  JOB_CHECKS_STOPPED,
  KEEP_AS_IS,
  NOTHING_TO_SIMPLIFY,
  openProposalLinkLabel,
  REWRITE_FAILED,
  REWRITE_HINT,
  REWRITE_LABEL,
  REWRITE_SUBMIT,
  REWRITING,
  STATUS_UNAVAILABLE,
  type QuestionnaireProposalJobView,
  type QuestionRowAiFacts,
} from './questionnaire-ai-domain';
import { aiProposalStartRefusalCopy } from './questionnaire-ai-refusal-copy';

/*
 * Rewrite in plain language (15-UI-SPEC §6; D-11, D-33): on an active, unanswered question row, a form with the optional
 * X-25 instruction (a popover from 768px, a bottom sheet below, UI-D16). The row then follows the job: Rewriting…, the
 * link to the proposal, the nothing-to-simplify line until the next page view (UI-D17), or the failure with Retry. The
 * read's actions decide whether it shows at all; Strapi decides every rewrite again.
 */
export type RewriteTiming = { pollIntervalMs: number; timeoutMs: number };
const DEFAULT_TIMING: RewriteTiming = { pollIntervalMs: 2_000, timeoutMs: 30_000 };

const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

type QuestionRef = { readonly id: string; readonly text: string };

function RewriteForm({ onCancel, onStarted, ownerKey, phone, question, questionnaireId, titleId }: { onCancel: () => void; onStarted: (job: QuestionnaireProposalJobView) => void; ownerKey: string | null; phone: boolean; question: QuestionRef; questionnaireId: string; titleId: string }) {
  const [instruction, setInstruction] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => { field.current?.focus(); }, []);

  async function submit() {
    if (pending) return;
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
      const result = await startQuestionRewriteAction({ documentId: questionnaireId, questionId: question.id, instruction });
      if (!result.ok) {
        if (result.failure === 'field') setFieldError(result.message);
        else setFormError(result.message);
        return;
      }
      if (ownerKey) writeSessionDraft('question-rewrite-instruction', ownerKey, question.id, '');
      onStarted(result.data);
    } catch {
      setFormError(aiProposalStartRefusalCopy({}).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-labelledby={titleId} className="grid gap-3" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <InstructionField draft={{ kind: 'question-rewrite-instruction', recordId: question.id, ownerKey }} error={fieldError} fieldRef={field} hint={REWRITE_HINT} id={`${id}-instruction`} onChange={setInstruction} onSubmitShortcut={() => void submit()} value={instruction} />
      {formError ? <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{formError}</p> : null}
      <div className={phone ? 'grid gap-2' : 'flex flex-wrap items-center gap-2'}>
        <Button aria-disabled={pending ? true : undefined} className={phone ? 'min-h-11 w-full' : undefined} size="sm" type="submit">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{REWRITE_SUBMIT}</Button>
        <Button className={phone ? 'min-h-11 w-full' : undefined} onClick={onCancel} size="sm" type="button" variant="ghost">{KEEP_AS_IS}</Button>
        {phone ? null : <ShortcutHint />}
      </div>
    </form>
  );
}

export function QuestionRewriteControl({ job: seededJob, noChangeRunIds, openItemAnchor, ownerKey, question, questionnaireId, timing = DEFAULT_TIMING }: {
  questionnaireId: string;
  question: QuestionRef;
  ownerKey: string | null;
  /** This question's rewrite job from the proposals read, when one is active or failed. */
  job: QuestionnaireProposalJobView | null;
  /** The first open proposal's card anchor for this question, when there is one. */
  openItemAnchor: string | null;
  noChangeRunIds: readonly string[];
  timing?: RewriteTiming;
}) {
  const router = useRouter();
  const phone = useIsPhone();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<QuestionnaireProposalJobView | null>(seededJob);
  const [finishedRun, setFinishedRun] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [cycle, setCycle] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const focusStatus = useRef(false);
  const startedAt = useRef(Date.now());
  const seededKey = seededJob ? `${seededJob.jobId}:${seededJob.status}:${seededJob.attempt}` : null;

  useEffect(() => {
    if (seededJob) {
      setJob(seededJob);
      startedAt.current = Date.now();
      setTimedOut(false);
    }
    // Keyed on the seed's content: a refresh hands the row a new object with the same job.
  }, [seededKey]);

  useEffect(() => {
    if (focusStatus.current && status.current) {
      focusStatus.current = false;
      status.current.focus();
    }
  });

  const running = job !== null && (job.status === 'queued' || job.status === 'running');
  useEffect(() => {
    if (!job || !running || timedOut) return undefined;
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
          setFinishedRun(result.data.runId);
          setJob(null);
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
  }, [cycle, job, router, running, timedOut, timing]);

  function checkAgain() {
    startedAt.current = Date.now();
    setTimedOut(false);
    setCycle((current) => current + 1);
  }

  function started(next: QuestionnaireProposalJobView) {
    startedAt.current = Date.now();
    setTimedOut(false);
    setStatusError(false);
    setOpen(false);
    setFinishedRun(null);
    setJob(next);
    focusStatus.current = true;
  }

  async function retry() {
    if (!job) return;
    setRetryError(null);
    try {
      const result = await retryQuestionnaireProposalJobAction({ jobId: job.jobId, documentId: questionnaireId });
      if (result.ok) started(result.data);
      else setRetryError(result.message);
    } catch {
      setRetryError(aiProposalStartRefusalCopy({}).text);
    }
  }

  if (running) {
    return <div className="grid gap-2"><p className="flex items-center gap-1.5 text-xs text-foreground-secondary focus-visible:outline-none" ref={status} role="status" tabIndex={-1}><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{REWRITING}</p>{statusError ? <p className="text-xs text-destructive" role="alert">{STATUS_UNAVAILABLE}</p> : null}{timedOut ? <><p className="text-xs text-foreground-secondary">{JOB_CHECKS_STOPPED}</p><Button className="w-fit max-md:min-h-11" onClick={checkAgain} size="sm" type="button" variant="outline">Check again</Button></> : null}</div>;
  }
  if (job?.status === 'failed') {
    return (
      <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary" data-print="hidden">
        <span>{REWRITE_FAILED}</span>
        {retryError ? <span className="text-destructive">{retryError}</span> : null}
        {job.canRetry ? <Button className="max-md:min-h-11" onClick={() => void retry()} size="sm" type="button" variant="ghost"><RotateCcw aria-hidden="true" />Retry{' '}<span className="sr-only">rewrite: {question.text}</span></Button> : null}
      </div>
    );
  }
  if (openItemAnchor) return <RecordLink className="w-fit text-xs" href={`#${openItemAnchor}`}>{openProposalLinkLabel(1)}</RecordLink>;
  if (finishedRun !== null && noChangeRunIds.includes(finishedRun)) return <p aria-live="polite" className="text-xs text-foreground-secondary">{NOTHING_TO_SIMPLIFY}</p>;

  const triggerButton = (
    <Button aria-haspopup="dialog" aria-label={`${REWRITE_LABEL}: ${question.text}`} className="max-md:min-h-11" data-print="hidden" onClick={() => setOpen(true)} ref={trigger} size="sm" type="button" variant="ghost">
      <SpellCheck aria-hidden="true" />{REWRITE_LABEL}
    </Button>
  );
  const returnFocus = (event: Event) => { event.preventDefault(); trigger.current?.focus(); };
  const form = <RewriteForm onCancel={() => setOpen(false)} onStarted={started} ownerKey={ownerKey} phone={phone} question={question} questionnaireId={questionnaireId} titleId={titleId} />;

  if (phone) {
    return (
      <>
        {triggerButton}
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetContent aria-describedby={undefined} aria-labelledby={titleId} className="gap-0 border-0 bg-surface outline-none" onCloseAutoFocus={returnFocus} onOpenAutoFocus={(event) => event.preventDefault()} showCloseButton={false} side="bottom">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <SheetPrimitive.Title asChild><h2 className="text-heading-sm text-foreground" id={titleId}>{REWRITE_LABEL}</h2></SheetPrimitive.Title>
              <SheetClose asChild><Button className="h-11 shrink-0" type="button" variant="outline">Close</Button></SheetClose>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">{form}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent align="end" aria-labelledby={titleId} className="grid max-h-(--radix-popover-content-available-height) w-[min(480px,calc(100vw-2rem))] gap-3 overflow-y-auto border-border bg-surface text-foreground outline-none" collisionPadding={16} onCloseAutoFocus={returnFocus} onOpenAutoFocus={(event) => event.preventDefault()} role="dialog">
        <h2 className="text-heading-sm text-foreground" id={titleId}>{REWRITE_LABEL}</h2>
        {form}
      </PopoverContent>
    </Popover>
  );
}

/* §4.7: the row's link to its first open proposal; following it moves focus to the card. */
function OpenProposalLink({ anchor, count }: { anchor: string; count: number }) {
  return <RecordLink className="w-fit text-xs" href={`#${anchor}`} onClick={() => document.getElementById(anchor)?.focus()}>{openProposalLinkLabel(count)}</RecordLink>;
}

/*
 * A question row's Phase 15 parts (§4.7, §6, §7.1): the open-proposal link, the Answered note where the row does not show
 * it itself (the submitted view), and the rewrite control on an active, unanswered question when the read allows a rewrite.
 * Without the read (a requesting analyst, D-32) nothing shows.
 */
export function QuestionAiRowExtras({ facts, ownerKey, question, questionnaireId, withAnsweredNote = false }: {
  facts: QuestionRowAiFacts | null;
  ownerKey: string | null;
  question: QuestionRef & { readonly answered?: boolean };
  questionnaireId: string;
  withAnsweredNote?: boolean;
}) {
  if (!facts) return null;
  const open = facts.open[question.id];
  const job = facts.rewriteJobs[question.id] ?? null;
  const rewritable = facts.rewriteAllowed && question.answered !== true;
  if (!open && !rewritable && !(withAnsweredNote && question.answered === true)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {withAnsweredNote && question.answered === true ? <AnsweredQuestionNote /> : null}
      {open ? <OpenProposalLink anchor={open.anchor} count={open.count} /> : null}
      {rewritable ? <QuestionRewriteControl job={job} noChangeRunIds={facts.noChangeRunIds} openItemAnchor={null} ownerKey={ownerKey} question={question} questionnaireId={questionnaireId} /> : null}
    </span>
  );
}
