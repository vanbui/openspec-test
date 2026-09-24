'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { FormSection } from '@/components/csrm/form-section';
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
  saveQuestionnaireDraftAction,
  submitQuestionnaireAction,
  type QuestionnaireActionResult,
} from './questionnaire-actions';
import type {
  QuestionnaireAnswerInput,
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from './questionnaire-schema';

type AnswerValue = QuestionnaireAnswerInput['value'];
type FormValues = { answers: Record<string, AnswerValue> };

export type QuestionnaireRendererProps = {
  definition: QuestionnaireDefinition;
  documentId: string;
  mode: 'edit' | 'read-only';
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

function applyFailure(result: Extract<QuestionnaireActionResult, { ok: false }>, setError: ReturnType<typeof useForm<FormValues>>['setError']): string {
  for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message && key.startsWith('answers.')) setError(key as `answers.${string}`, { message });
  }
  return result.formError ?? 'Check the highlighted answers and try again.';
}

export function QuestionnaireRenderer({ definition: initialDefinition, documentId, mode }: QuestionnaireRendererProps) {
  const [definition, setDefinition] = useState(initialDefinition);
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
  const [formError, setFormError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const previousVisible = useRef<readonly string[]>([]);
  const formSchema = useMemo(() => createFormSchema(definition), [definition]);
  const form = useForm<FormValues>({
    defaultValues: initialValues(definition),
    mode: 'onBlur',
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
  });
  const watchedAnswers = useWatch({ control: form.control, name: 'answers' }) ?? {};
  const domainAnswers = useMemo(() => toDomainAnswers(watchedAnswers), [watchedAnswers]);
  const visibleKeys = getVisibleQuestionKeys(definition, domainAnswers);
  const visibleSet = new Set(visibleKeys);
  const progress = calculateProgress(definition, domainAnswers);
  const completeness = validateActiveRequiredAnswers(definition, domainAnswers);
  const unsupportedSet = new Set(completeness.unsupportedRequiredKeys);
  const supportedUnanswered = completeness.requiredUnansweredKeys.filter((key) => !unsupportedSet.has(key));

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

  async function saveCurrentDraft(): Promise<boolean> {
    setSaving(true);
    setFormError(null);
    setDraftMessage(null);
    try {
      const result = await saveQuestionnaireDraftAction({
        documentId,
        answers: activeAnswerInputs(definition, form.getValues('answers')),
      });
      if (!result.ok) {
        setFormError(applyFailure(result, form.setError));
        return false;
      }
      setDraftMessage('Draft saved. Your answers remain editable.');
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function prepareSubmission(): Promise<boolean> {
    setFormError(null);
    const valid = await form.trigger();
    if (valid) return true;
    setFormError('Check the questions requiring attention before submitting.');
    const firstInvalid = definition.find((question) => visibleSet.has(question.questionKey) && (form.getFieldState(`answers.${question.questionKey}`).invalid || unsupportedSet.has(question.questionKey)));
    if (firstInvalid) setTimeout(() => document.getElementById(fieldId(firstInvalid.questionKey))?.focus(), 0);
    return false;
  }

  async function submitCurrent() {
    setFormError(null);
    if (!(await saveCurrentDraft())) throw new Error('Draft save failed');
    const result = await submitQuestionnaireAction({ documentId, answers: activeAnswerInputs(definition, form.getValues('answers')) });
    if (!result.ok) {
      setFormError(applyFailure(result, form.setError));
      throw new Error('Questionnaire submission failed');
    }
    setDefinition(result.data.answers);
    setSubmitted(true);
    setDraftMessage(null);
  }

  if (submitted) {
    const readOnlyAnswers = Object.fromEntries(definition.map((question) => [question.questionKey, question.answer]));
    const readOnlyVisible = new Set(getVisibleQuestionKeys(definition, readOnlyAnswers));
    return (
      <div className="grid w-full max-w-3xl gap-8">
        <Alert><CheckCircle2 aria-hidden="true" /><AlertTitle>Submitted</AlertTitle><AlertDescription>Questionnaire submitted. This questionnaire is read-only and can no longer be edited.</AlertDescription></Alert>
        {sections.map((section) => <FormSection description={section.description} headingId={`section-${section.key}`} key={section.key} title={section.title}>{section.questions.filter((question) => readOnlyVisible.has(question.questionKey)).map((question) => <ReadOnlyQuestion key={question.questionKey} question={question} />)}</FormSection>)}
      </div>
    );
  }

  return (
    <form className="grid w-full max-w-3xl grid-cols-1 gap-8" noValidate onSubmit={(event) => { event.preventDefault(); void saveCurrentDraft(); }}>
      {formError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Questionnaire not saved</AlertTitle>
          <AlertDescription>
            <p>{formError}</p>
            {definition.some((question) => visibleSet.has(question.questionKey) && errors[question.questionKey]) ? (
              <ul className="mt-2 grid gap-1">
                {definition.filter((question) => visibleSet.has(question.questionKey) && errors[question.questionKey]).map((question) => (
                  <li key={question.questionKey}><a className="underline underline-offset-4" href={`#${fieldId(question.questionKey)}`}>{question.questionText}</a></li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="flex min-h-5 items-center gap-2 text-sm text-success" role="status">{draftMessage ? <><CheckCircle2 aria-hidden="true" className="size-4" />{draftMessage}</> : null}</p>
      <section aria-label="Questionnaire completion" className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium tabular-nums">{progress.answered} of {progress.total} answered</p>
        <Progress aria-label={`${progress.answered} of ${progress.total} questionnaire questions answered`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} value={progress.percent} />
        <p className="text-sm text-muted-foreground">{supportedUnanswered.length} required {supportedUnanswered.length === 1 ? 'question' : 'questions'} unanswered</p>
      </section>
      {(supportedUnanswered.length > 0 || completeness.unsupportedRequiredKeys.length > 0) ? (
        <section aria-label="Questionnaire validation guidance" className="grid gap-2 rounded-lg border border-warning-border bg-warning-subtle p-4">
          <h2 className="text-heading-sm text-warning">Questions requiring attention</h2>
          <ul className="grid gap-1 text-sm">
            {supportedUnanswered.map((key) => { const item = definition.find((question) => question.questionKey === key); return item ? <li key={key}><a className="text-link underline underline-offset-4" href={`#${fieldId(key)}`}>{item.questionText}</a></li> : null; })}
            {completeness.unsupportedRequiredKeys.map((key) => { const item = definition.find((question) => question.questionKey === key); return item ? <li key={key}>{item.questionText} — required but unavailable</li> : null; })}
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
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        <Button className="w-full sm:w-auto" disabled={saving} type="submit">{saving ? <><Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Saving draft…</> : 'Save draft'}</Button>
        <ConfirmDialog
          confirmLabel="Submit questionnaire"
          confirmVariant="default"
          description="Submission is irreversible. This questionnaire cannot be edited after submission."
          errorMessage={formError}
          onBeforeOpen={prepareSubmission}
          onConfirm={submitCurrent}
          pendingLabel="Submitting questionnaire…"
          title="Submit this questionnaire?"
          trigger={<Button className="w-full sm:w-auto" type="button" variant="outline">Submit questionnaire</Button>}
        />
      </div>
    </form>
  );
}
