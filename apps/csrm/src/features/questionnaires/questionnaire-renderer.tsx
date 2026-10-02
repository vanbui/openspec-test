'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { FormSection } from '@/components/csrm/form-section';
import { useLeaveGuard } from '@/components/csrm/navigation-guard';
import { SaveStatus } from '@/components/csrm/save-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  calculateProgress,
  getVisibleQuestionKeys,
  orderQuestionnaire,
  validateActiveRequiredAnswers,
  type QuestionnaireAnswers,
} from './questionnaire-domain';
import {
  autosaveQuestionnaireDraftAction,
  saveQuestionnaireDraftAction,
  submitQuestionnaireAction,
  type QuestionnaireActionResult,
} from './questionnaire-actions';
import type {
  QuestionnaireAnswerInput,
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from './questionnaire-schema';
import type { SubmittedNoticeVariant } from './questionnaire-workflow-rules';
import {
  rememberSavedQuestionnaire,
  savedQuestionnaireAfter,
  useAnswerAutosave,
  type AutosaveOutcome,
  type AutosaveTrigger,
} from './use-answer-autosave';

type AnswerValue = QuestionnaireAnswerInput['value'];
type FormValues = { answers: Record<string, AnswerValue> };

export type QuestionnaireRendererProps = {
  definition: QuestionnaireDefinition;
  documentId: string;
  mode: 'edit' | 'read-only';
  /** Which submitted notice to show (UI-SPEC §8.2), chosen by the page from the served questionnaire and request. */
  submittedNotice?: SubmittedNoticeVariant;
  /**
   * When the page's answers were last changed on the server. A save this tab remembers that is later than
   * this wins at mount, so a page restored by Back or Forward never shows answers older than the last save.
   */
  serverUpdatedAt?: string;
};

/* Every variant begins `Questionnaire submitted.` (UI-SPEC UI-D12). */
const submittedNoticeText: Record<SubmittedNoticeVariant, string> = {
  'requestor-revertible': 'Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.',
  'requestor-locked': 'Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.',
  analyst: 'Questionnaire submitted. These are the Requestor’s submitted answers.',
};

const answerValueSchema = z.union([
  z.string().max(65_535),
  z.boolean(),
  z.array(z.string().max(255)).max(1_000),
  z.null(),
]);

function hasValue(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function initialValue(question: QuestionnaireQuestion): AnswerValue {
  if (question.answer?.value !== null && question.answer?.value !== undefined) return question.answer.value;
  if (question.answerType === 'Multi select') return [];
  if (
    question.answerType === 'Boolean'
    || question.answerType === 'Single select'
    || question.answerType === 'Date'
    || question.answerType === 'File upload'
  ) return null;
  return '';
}

function initialValues(definition: QuestionnaireDefinition): FormValues {
  return { answers: Object.fromEntries(definition.map((question) => [question.questionKey, initialValue(question)])) };
}

function toDomainAnswers(values: Record<string, AnswerValue>): QuestionnaireAnswers {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {
    schemaVersion: 1 as const,
    value,
    state: 'draft' as const,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }]));
}

function createFormSchema(definition: QuestionnaireDefinition) {
  return z.object({ answers: z.record(z.string(), answerValueSchema) }).superRefine((values, context) => {
    const answers = toDomainAnswers(values.answers);
    const visible = new Set(getVisibleQuestionKeys(definition, answers));
    for (const question of definition) {
      if (!visible.has(question.questionKey) || !question.required) continue;
      if (question.support.status === 'unsupported') {
        context.addIssue({
          code: 'custom',
          path: ['answers', question.questionKey],
          message: `${question.questionText} is required, but file upload is unavailable.`,
        });
      } else if (!hasValue(values.answers[question.questionKey])) {
        context.addIssue({
          code: 'custom',
          path: ['answers', question.questionKey],
          message: `Enter an answer for ${question.questionText}.`,
        });
      }
    }
  });
}

function activeAnswerInputs(
  definition: QuestionnaireDefinition,
  values: Record<string, AnswerValue>,
): QuestionnaireAnswerInput[] {
  const visible = new Set(getVisibleQuestionKeys(definition, toDomainAnswers(values)));
  return definition
    .filter((question) => visible.has(question.questionKey) && question.support.status === 'supported')
    .map((question) => ({ questionKey: question.questionKey, value: values[question.questionKey] ?? null }));
}

function answerDisplay(question: QuestionnaireQuestion): string {
  const value = question.answer?.value;
  if (!hasValue(value)) return 'Not answered';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const labels = new Map(question.choices?.map((choice) => [choice.value, choice.label]));
    return value.map((item) => labels.get(item) ?? item).join(', ');
  }
  if (typeof value === 'string') return question.choices?.find((choice) => choice.value === value)?.label ?? value;
  return 'Not answered';
}

function fieldId(key: string): string {
  return `question-${key}`;
}

function QuestionError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p className="flex items-start gap-1.5 text-xs text-destructive" id={id} role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{message}</p>;
}

function EditableQuestion({ control, error, question }: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  error?: string;
  question: QuestionnaireQuestion;
}) {
  const id = fieldId(question.questionKey);
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;
  const name = `answers.${question.questionKey}` as const;

  if (question.support.status === 'unsupported') {
    return (
      <div id={id} tabIndex={-1}>
        <p className="text-sm font-medium" id={labelId}>{question.questionText}{question.required ? ' (required)' : ''}</p>
        <Alert className="mt-2"><AlertCircle aria-hidden="true" /><AlertTitle>File upload is unavailable</AlertTitle><AlertDescription>This answer type cannot be completed until an authorised upload workflow is available.</AlertDescription></Alert>
        <QuestionError id={errorId} message={error} />
      </div>
    );
  }

  return (
    <Controller control={control} name={name} render={({ field }) => {
      if (question.answerType === 'Boolean') {
        const value = typeof field.value === 'boolean' ? String(field.value) : '';
        return (
          <fieldset aria-labelledby={labelId} className="grid gap-3" id={id} tabIndex={-1}>
            <legend className="text-sm font-medium" id={labelId}>{question.questionText}{question.required ? ' (required)' : ''}</legend>
            <RadioGroup name={field.name} onBlur={field.onBlur} onValueChange={(next) => field.onChange(next === 'true')} value={value}>
              <label className="flex min-h-9 items-center gap-3 text-sm"><RadioGroupItem aria-describedby={describedBy} aria-invalid={Boolean(error)} ref={field.ref} value="true" />Yes</label>
              <label className="flex min-h-9 items-center gap-3 text-sm"><RadioGroupItem aria-describedby={describedBy} aria-invalid={Boolean(error)} value="false" />No</label>
            </RadioGroup>
            <QuestionError id={errorId} message={error} />
          </fieldset>
        );
      }
      if (question.answerType === 'Single select') {
        return (
          <fieldset aria-labelledby={labelId} className="grid gap-3" id={id} tabIndex={-1}>
            <legend className="text-sm font-medium" id={labelId}>{question.questionText}{question.required ? ' (required)' : ''}</legend>
            <RadioGroup name={field.name} onBlur={field.onBlur} onValueChange={field.onChange} value={typeof field.value === 'string' ? field.value : ''}>
              {question.choices?.map((choice, index) => <label className="flex min-h-9 items-center gap-3 text-sm" key={choice.value}><RadioGroupItem aria-describedby={describedBy} aria-invalid={Boolean(error)} ref={index === 0 ? field.ref : undefined} value={choice.value} />{choice.label}</label>)}
            </RadioGroup>
            <QuestionError id={errorId} message={error} />
          </fieldset>
        );
      }
      if (question.answerType === 'Multi select') {
        const selected = Array.isArray(field.value) ? field.value : [];
        return (
          <fieldset aria-labelledby={labelId} className="grid gap-3" id={id} tabIndex={-1}>
            <legend className="text-sm font-medium" id={labelId}>{question.questionText}{question.required ? ' (required)' : ''}</legend>
            {question.choices?.map((choice, index) => <label className="flex min-h-9 items-center gap-3 text-sm" key={choice.value}><Checkbox aria-describedby={describedBy} aria-invalid={Boolean(error)} checked={selected.includes(choice.value)} name={field.name} onBlur={field.onBlur} onCheckedChange={(checked) => field.onChange(checked ? [...selected, choice.value] : selected.filter((item) => item !== choice.value))} ref={index === 0 ? field.ref : undefined} />{choice.label}</label>)}
            <QuestionError id={errorId} message={error} />
          </fieldset>
        );
      }
      const common = {
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
        id,
        name: field.name,
        onBlur: field.onBlur,
        onChange: field.onChange,
        ref: field.ref,
        value: typeof field.value === 'string' ? field.value : '',
      };
      return (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor={id} id={labelId}>{question.questionText}{question.required ? ' (required)' : ''}</label>
          {question.answerType === 'Long text' ? <Textarea {...common} /> : <Input {...common} type={question.answerType === 'Date' ? 'date' : 'text'} />}
          <QuestionError id={errorId} message={error} />
        </div>
      );
    }} />
  );
}

function ReadOnlyQuestion({ question }: { question: QuestionnaireQuestion }) {
  return (
    <div className="grid gap-1" id={fieldId(question.questionKey)}>
      <h3 className="text-heading-sm text-foreground">{question.questionText}</h3>
      {question.support.status === 'unsupported' ? (
        <Alert><AlertCircle aria-hidden="true" /><AlertTitle>File upload is unavailable</AlertTitle><AlertDescription>No file answer can be displayed for this question.</AlertDescription></Alert>
      ) : <p className="whitespace-pre-wrap text-sm text-muted-foreground">{answerDisplay(question)}</p>}
    </div>
  );
}

function hasFieldErrors(result: Extract<QuestionnaireActionResult, { ok: false }>): boolean {
  return Object.entries(result.fieldErrors ?? {}).some(([key, messages]) => key.startsWith('answers.') && Boolean(messages?.[0]));
}

function applyFailure(result: Extract<QuestionnaireActionResult, { ok: false }>, setError: ReturnType<typeof useForm<FormValues>>['setError']): string {
  for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message && key.startsWith('answers.')) setError(key as `answers.${string}`, { type: 'server', message });
  }
  return result.formError ?? 'Check the highlighted answers and try again.';
}

/** A save failure as the save status shows it (UI-SPEC §6.1): blocked carries its §10.2 C sentence. */
function saveOutcome(result: Extract<QuestionnaireActionResult, { ok: false }>): AutosaveOutcome {
  return result.failure === 'blocked'
    ? { ok: false, failure: 'blocked', message: result.formError ?? 'Your answers can’t be saved in this questionnaire’s current state.' }
    : { ok: false, failure: 'retryable' };
}

const retryableSaveMessage = 'Your latest answers weren’t saved.';

export function QuestionnaireRenderer({ definition: initialDefinition, documentId, mode, submittedNotice = 'requestor-revertible', serverUpdatedAt }: QuestionnaireRendererProps) {
  const router = useRouter();
  /* A save this tab remembers wins at mount only when it is later than the page (Back and Forward, D-11). */
  const [definition, setDefinition] = useState(() => (mode === 'edit' ? savedQuestionnaireAfter(documentId, serverUpdatedAt)?.answers : undefined) ?? initialDefinition);
  const [submitted, setSubmitted] = useState(mode === 'read-only');
  /*
   * Submitting in-page flips `submitted` locally without a server round trip, so
   * it cannot simply mirror `mode`. But returning a questionnaire to draft
   * changes `mode` underneath a renderer that stays mounted, and seeded state
   * would keep showing the read-only view. Re-seed whenever the server-owned
   * mode actually changes, and reload the answers it came back with.
   */
  const [renderedMode, setRenderedMode] = useState(mode);
  if (mode !== renderedMode) {
    setRenderedMode(mode);
    setSubmitted(mode === 'read-only');
    setDefinition(initialDefinition);
  }
  /*
   * Refresh page after a blocked save is a soft refresh. When the refreshed page brings a new payload, the
   * form starts again from it: what the server holds now, with autosave running again.
   */
  const [refreshFrom, setRefreshFrom] = useState<QuestionnaireDefinition | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);
  /* A refused submit shows inside its dialog (UI-SPEC §5.4); save failures show in the save status. */
  const [submitError, setSubmitError] = useState<string | null>(null);
  /* The attention list appears only after a submit attempt or a server field error (UI-SPEC §5.3). */
  const [attempted, setAttempted] = useState(false);
  if (refreshFrom !== null && initialDefinition !== refreshFrom) {
    setRefreshFrom(null);
    setDefinition(initialDefinition);
    setAttempted(false);
    setSubmitError(null);
    setSeedVersion((version) => version + 1);
  }
  /* After Save draft the status is echoed beside the button until the next change (UI-SPEC §6.1). */
  const [echo, setEcho] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const previousVisible = useRef<readonly string[]>([]);
  const formSchema = useMemo(() => createFormSchema(definition), [definition]);
  const form = useForm<FormValues>({
    defaultValues: initialValues(definition),
    mode: 'onBlur',
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
  });

  /*
   * Autosave (D-11): the debounced and blur saves use the action that revalidates nothing; Save draft and
   * the save before submit keep the revalidating one. Each success is remembered for Back and Forward.
   */
  async function saveAnswers(answers: QuestionnaireAnswerInput[], trigger: AutosaveTrigger): Promise<AutosaveOutcome> {
    const action = trigger === 'explicit' ? saveQuestionnaireDraftAction : autosaveQuestionnaireDraftAction;
    const result = await action({ documentId, answers });
    if (!result.ok) {
      applyFailure(result, form.setError);
      if (hasFieldErrors(result)) setAttempted(true);
      return saveOutcome(result);
    }
    rememberSavedQuestionnaire(documentId, { updatedAt: result.data.updatedAt, answers: result.data.answers });
    return { ok: true, savedAt: result.data.updatedAt };
  }
  const autosave = useAnswerAutosave({
    save: saveAnswers,
    getAnswers: () => activeAnswerInputs(definition, form.getValues('answers')),
  });
  const { schedule, flush, reset: resetAutosave } = autosave;
  /* Leaving warns while a change waits, a save is in flight or the last one failed; never once submitted (D-12). */
  useLeaveGuard(autosave.blocking && !submitted, autosave.status.kind === 'failed' ? 'failed' : 'waiting');

  useEffect(() => {
    const subscription = form.watch((_values, { type }) => {
      if (type !== 'change') return;
      setEcho(false);
      schedule();
    });
    return () => subscription.unsubscribe();
  }, [form, schedule]);

  /* A new seed after Refresh page resets the form to it; the definition state already holds it. */
  const seededDefinition = useRef(definition);
  seededDefinition.current = definition;
  useEffect(() => {
    if (seedVersion === 0) return;
    form.reset(initialValues(seededDefinition.current));
    resetAutosave();
  }, [form, resetAutosave, seedVersion]);

  /* A field losing focus saves at once; moving between the choices of one group is not leaving it. */
  function flushOnLeavingField(event: FocusEvent<HTMLFormElement>) {
    const group = event.target instanceof Element ? event.target.closest('fieldset') : null;
    if (group && event.relatedTarget instanceof Node && group.contains(event.relatedTarget)) return;
    flush();
  }
  const watchedAnswers = useWatch({ control: form.control, name: 'answers' }) ?? {};
  const domainAnswers = useMemo(() => toDomainAnswers(watchedAnswers), [watchedAnswers]);
  const visibleKeys = getVisibleQuestionKeys(definition, domainAnswers);
  const visibleSet = new Set(visibleKeys);
  const progress = calculateProgress(definition, domainAnswers);
  const completeness = validateActiveRequiredAnswers(definition, domainAnswers);
  const unsupportedSet = new Set(completeness.unsupportedRequiredKeys);
  const supportedUnanswered = completeness.requiredUnansweredKeys.filter((key) => !unsupportedSet.has(key));
  const supportedUnansweredSet = new Set(supportedUnanswered);

  useEffect(() => {
    const hidden = previousVisible.current.filter((key) => !visibleSet.has(key));
    for (const key of hidden) {
      const element = document.getElementById(fieldId(key));
      const heldFocus = element?.contains(document.activeElement) || element === document.activeElement;
      form.unregister(`answers.${key}`);
      form.setValue(`answers.${key}`, null, { shouldDirty: true, shouldValidate: false });
      if (heldFocus) {
        const controllerKey = definition.find((question) => question.questionKey === key)?.visibility?.questionKey;
        if (controllerKey) setTimeout(() => document.getElementById(fieldId(controllerKey))?.focus(), 0);
      }
    }
    previousVisible.current = visibleKeys;
  }, [definition, form, visibleKeys, visibleSet]);

  const sections = orderQuestionnaire(definition);
  const errors = form.formState.errors.answers ?? {};
  /* Form order: section order, then question order, whatever order the server served them in (D-13). */
  const formOrder = sections.flatMap((section) => section.questions).filter((question) => visibleSet.has(question.questionKey));
  /*
   * A required question leaves the list as soon as it is answered; a server field error stays until the
   * field is validated again on blur, which replaces it.
   */
  const attention = formOrder.filter((question) => unsupportedSet.has(question.questionKey)
    || supportedUnansweredSet.has(question.questionKey)
    || (errors[question.questionKey] as { type?: string } | undefined)?.type === 'server');

  /* Save draft saves now, cancelling the waiting autosave, and echoes the status beside the button. */
  async function saveDraft() {
    setEcho(true);
    setSavingDraft(true);
    try {
      await autosave.saveNow();
    } finally {
      setSavingDraft(false);
    }
  }

  async function prepareSubmission(): Promise<boolean> {
    setSubmitError(null);
    const valid = await form.trigger();
    if (valid) {
      /* Autosave waits while the submit dialog confirms (UI-SPEC §6.2). */
      autosave.pause();
      return true;
    }
    /* The attention list is the one list of what to fix (UI-D29). */
    setAttempted(true);
    const firstInvalid = formOrder.find((question) => form.getFieldState(`answers.${question.questionKey}`).invalid || unsupportedSet.has(question.questionKey));
    if (firstInvalid) setTimeout(() => document.getElementById(fieldId(firstInvalid.questionKey))?.focus(), 0);
    return false;
  }

  /* Submitting saves first, then submits (unchanged). A failure stays in the open dialog. */
  async function submitCurrent() {
    setSubmitError(null);
    const saved = await autosave.saveNow();
    if (!saved.ok) {
      setSubmitError(saved.failure === 'blocked' ? saved.message : retryableSaveMessage);
      throw new Error('Draft save failed');
    }
    const result = await submitQuestionnaireAction({ documentId, answers: activeAnswerInputs(definition, form.getValues('answers')) });
    if (!result.ok) {
      setSubmitError(applyFailure(result, form.setError));
      if (hasFieldErrors(result)) setAttempted(true);
      throw new Error('Questionnaire submission failed');
    }
    setDefinition(result.data.answers);
    setSubmitted(true);
    setEcho(false);
  }

  function refreshPage() {
    setRefreshFrom(initialDefinition);
    router.refresh();
  }

  if (submitted) {
    const readOnlyAnswers = Object.fromEntries(definition.map((question) => [question.questionKey, question.answer]));
    const readOnlyVisible = new Set(getVisibleQuestionKeys(definition, readOnlyAnswers));
    return (
      <div className="grid w-full max-w-3xl gap-8">
        <Alert><CheckCircle2 aria-hidden="true" /><AlertTitle>Submitted</AlertTitle><AlertDescription>{submittedNoticeText[submittedNotice]}</AlertDescription></Alert>
        {sections.map((section) => <FormSection description={section.description} headingId={`section-${section.key}`} key={section.key} title={section.title}>{section.questions.filter((question) => readOnlyVisible.has(question.questionKey)).map((question) => <ReadOnlyQuestion key={question.questionKey} question={question} />)}</FormSection>)}
      </div>
    );
  }

  return (
    <form className="grid w-full max-w-3xl grid-cols-1 gap-8" noValidate onBlur={flushOnLeavingField} onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
      <section aria-label="Questionnaire completion" className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium tabular-nums">{progress.answered} of {progress.total} answered</p>
        <Progress aria-label={`${progress.answered} of ${progress.total} questionnaire questions answered`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} value={progress.percent} />
        <p className="text-sm text-muted-foreground">{supportedUnanswered.length} required {supportedUnanswered.length === 1 ? 'question' : 'questions'} unanswered</p>
        <SaveStatus onRefresh={refreshPage} onRetry={autosave.retry} status={autosave.status} />
      </section>
      {attempted && attention.length > 0 ? (
        <section aria-label="Questionnaire validation guidance" className="grid gap-2 rounded-lg border border-warning-border bg-warning-subtle p-4">
          <h2 className="text-heading-sm text-warning">Questions requiring attention</h2>
          <p className="text-sm text-foreground">Answer or correct these questions, then submit again.</p>
          <ul className="grid gap-1 text-sm">
            {attention.map((question) => unsupportedSet.has(question.questionKey)
              ? <li key={question.questionKey}>{`${question.questionText} - required but unavailable`}</li>
              : <li key={question.questionKey}><a className="text-link underline underline-offset-4" href={`#${fieldId(question.questionKey)}`}>{question.questionText}</a></li>)}
          </ul>
        </section>
      ) : null}
      {sections.map((section) => (
        <FormSection description={section.description} headingId={`section-${section.key}`} key={section.key} title={section.title}>
          {section.questions.filter((question) => visibleSet.has(question.questionKey)).map((question) => (
            <EditableQuestion control={form.control} error={(errors[question.questionKey] as { message?: string } | undefined)?.message} key={question.questionKey} question={question} />
          ))}
        </FormSection>
      ))}
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <Button className="w-full sm:w-auto" disabled={savingDraft} type="submit">{savingDraft ? <><Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Saving draft…</> : 'Save draft'}</Button>
        <ConfirmDialog
          confirmLabel="Submit questionnaire"
          confirmVariant="default"
          description="The Security Analyst will review your answers and use them to assess the request’s risk. Until they start the assessment, you can return the questionnaire to draft to change your answers."
          errorMessage={submitError}
          onBeforeOpen={prepareSubmission}
          onConfirm={submitCurrent}
          onDismiss={autosave.resume}
          pendingLabel="Submitting questionnaire…"
          title="Submit this questionnaire?"
          trigger={<Button className="w-full sm:w-auto" type="button" variant="outline">Submit questionnaire</Button>}
        />
        {echo ? <SaveStatus announce={false} status={autosave.status} /> : null}
      </div>
    </form>
  );
}
