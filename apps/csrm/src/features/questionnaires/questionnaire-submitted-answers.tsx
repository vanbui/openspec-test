import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { FormSection } from '@/components/csrm/form-section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getVisibleQuestionKeys, orderQuestionnaire } from './questionnaire-domain';
import type { QuestionnaireAnswerInput, QuestionnaireDefinition, QuestionnaireQuestion } from './questionnaire-schema';
import type { SubmittedNoticeVariant } from './questionnaire-workflow-rules';

/*
 * A submitted questionnaire's answers, read-only. The Requestor's renderer shows this once they submit, and the
 * analyst's review shows it on its own: it validates nothing, so it holds no form and no zod, and the analyst's
 * review route downloads neither (plan 11-09, the zod client boundary).
 */

type AnswerValue = QuestionnaireAnswerInput['value'];

/* Every variant begins `Questionnaire submitted.` (UI-SPEC UI-D12). */
const submittedNoticeText: Record<SubmittedNoticeVariant, string> = {
  'requestor-revertible': 'Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.',
  'requestor-locked': 'Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.',
  analyst: 'Questionnaire submitted. These are the Requestor’s submitted answers.',
};

/** Whether an answer holds a value: a non-blank string, a non-empty list, or a boolean. */
export function hasAnswerValue(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/*
 * Phase 15 (D-05; 15-UI-SPEC §7.1): whether a submitted row is answered, for the Answered note and the rewrite control.
 * The submitted answers carry the value itself, so a row with an answer is answered even where the read serves no
 * `answered` flag.
 */
export function submittedRowAnswered(question: { answered?: boolean; answer?: { value?: AnswerValue } | null }): boolean {
  return question.answered === true || hasAnswerValue(question.answer?.value);
}

/** The id of a question's field, or of its read-only answer, which an attention link targets. */
export function questionFieldId(key: string): string {
  return `question-${key}`;
}

/** An answer as the analyst reads it: choice labels, Yes or No, else Not answered. */
export function answerDisplay(question: QuestionnaireQuestion): string {
  const value = question.answer?.value;
  if (!hasAnswerValue(value)) return 'Not answered';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const labels = new Map(question.choices?.map((choice) => [choice.value, choice.label]));
    return value.map((item) => labels.get(item) ?? item).join(', ');
  }
  if (typeof value === 'string') return question.choices?.find((choice) => choice.value === value)?.label ?? value;
  return 'Not answered';
}

function ReadOnlyQuestion({ question }: { question: QuestionnaireQuestion }) {
  return (
    <div className="grid gap-1" id={questionFieldId(question.questionKey)}>
      <h3 className="text-heading-sm text-foreground">{question.questionText}</h3>
      {question.helpText ? <p className="whitespace-pre-wrap text-xs text-foreground-secondary">{question.helpText}</p> : null}
      {question.support.status === 'unsupported' ? (
        <Alert><AlertCircle aria-hidden="true" /><AlertTitle>File upload is unavailable</AlertTitle><AlertDescription>No file answer can be displayed for this question.</AlertDescription></Alert>
      ) : <p className="whitespace-pre-wrap text-sm text-muted-foreground">{answerDisplay(question)}</p>}
    </div>
  );
}

export function SubmittedQuestionnaireAnswers({ definition, questionExtras, submittedNotice }: {
  definition: QuestionnaireDefinition;
  submittedNotice: SubmittedNoticeVariant;
  /** Phase 15 (15-UI-SPEC §6.1, §7.1): an analyst row's AI parts under the question; the Requestor's view passes none. */
  questionExtras?: (question: QuestionnaireDefinition[number]) => ReactNode;
}) {
  const answers = Object.fromEntries(definition.map((question) => [question.questionKey, question.answer]));
  const visible = new Set(getVisibleQuestionKeys(definition, answers));
  return (
    <div className="grid w-full max-w-3xl gap-8">
      <Alert><CheckCircle2 aria-hidden="true" /><AlertTitle>Submitted</AlertTitle><AlertDescription>{submittedNoticeText[submittedNotice]}</AlertDescription></Alert>
      {orderQuestionnaire(definition).map((section) => <FormSection description={section.description} headingId={`section-${section.key}`} key={section.key} title={section.title}>{section.questions.filter((question) => visible.has(question.questionKey)).map((question) => questionExtras ? <div className="grid gap-2" key={question.questionKey}><ReadOnlyQuestion question={question} />{questionExtras(question)}</div> : <ReadOnlyQuestion key={question.questionKey} question={question} />)}</FormSection>)}
    </div>
  );
}
