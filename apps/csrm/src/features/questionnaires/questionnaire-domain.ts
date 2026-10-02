import { z } from 'zod';
import type {
  QuestionnaireAnswer,
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from './questionnaire-schema';

export type QuestionnaireAnswers = Readonly<Record<string, QuestionnaireAnswer | null | undefined>>;

export interface QuestionnaireSection {
  key: string;
  title: string;
  description?: string;
  order: number;
  questions: readonly QuestionnaireQuestion[];
}

export function orderQuestionnaire(definition: QuestionnaireDefinition): readonly QuestionnaireSection[] {
  const sections = new Map<string, QuestionnaireSection>();
  const orderedQuestions = [...definition].sort((left, right) =>
    left.section.order - right.section.order || left.order - right.order,
  );

  for (const question of orderedQuestions) {
    const existing = sections.get(question.section.key);
    if (existing) {
      sections.set(question.section.key, {
        ...existing,
        questions: [...existing.questions, question],
      });
      continue;
    }
    sections.set(question.section.key, {
      ...question.section,
      questions: [question],
    });
  }

  return [...sections.values()].sort((left, right) => left.order - right.order);
}

function conditionIsMet(question: QuestionnaireQuestion, answers: QuestionnaireAnswers): boolean {
  const condition = question.visibility;
  if (!condition) return true;
  const controllerValue = answers[condition.questionKey]?.value;

  switch (condition.operator) {
    case 'equals':
      return controllerValue === condition.value;
    case 'notEquals':
      return controllerValue !== condition.value;
    case 'includes':
      return Array.isArray(controllerValue) && controllerValue.includes(String(condition.value));
    case 'notIncludes':
      return !Array.isArray(controllerValue) || !controllerValue.includes(String(condition.value));
  }
}

export function getVisibleQuestionKeys(
  definition: QuestionnaireDefinition,
  answers: QuestionnaireAnswers,
): readonly string[] {
  const visible = new Set<string>();
  const keys: string[] = [];

  for (const section of orderQuestionnaire(definition)) {
    for (const question of section.questions) {
      const controllerIsVisible = !question.visibility || visible.has(question.visibility.questionKey);
      if (controllerIsVisible && conditionIsMet(question, answers)) {
        visible.add(question.questionKey);
        keys.push(question.questionKey);
      }
    }
  }
  return keys;
}

function hasAnswerValue(answer: QuestionnaireAnswer | null | undefined): boolean {
  const value = answer?.value;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function clearHiddenAnswers(
  definition: QuestionnaireDefinition,
  answers: QuestionnaireAnswers,
): Record<string, QuestionnaireAnswer> {
  const visible = new Set(getVisibleQuestionKeys(definition, answers));
  return Object.fromEntries(
    Object.entries(answers).filter(
      (entry): entry is [string, QuestionnaireAnswer] => visible.has(entry[0]) && entry[1] != null,
    ),
  );
}

export function calculateProgress(
  definition: QuestionnaireDefinition,
  answers: QuestionnaireAnswers,
): { answered: number; total: number; percent: number } {
  const visibleKeys = getVisibleQuestionKeys(definition, answers);
  const answered = visibleKeys.filter((key) => hasAnswerValue(answers[key])).length;
  return {
    answered,
    total: visibleKeys.length,
    percent: visibleKeys.length === 0 ? 100 : Math.round((answered / visibleKeys.length) * 100),
  };
}

function hasConsistentSubmittedBatch(answers: readonly QuestionnaireAnswer[]): boolean {
  const submitted = answers.filter((answer) => answer.state === 'submitted');
  if (submitted.length === 0) return true;
  if (submitted.length !== answers.length) return false;
  return new Set(submitted.map((answer) => answer.submittedAt)).size === 1;
}

export function validateActiveRequiredAnswers(
  definition: QuestionnaireDefinition,
  answers: QuestionnaireAnswers,
): {
  complete: boolean;
  requiredUnansweredKeys: readonly string[];
  unsupportedRequiredKeys: readonly string[];
} {
  const visible = new Set(getVisibleQuestionKeys(definition, answers));
  /* Form order (section, then question): the server serves questions by question order alone, so sections interleave (D-13). */
  const activeRequired = orderQuestionnaire(definition)
    .flatMap((section) => section.questions)
    .filter((question) => question.required && visible.has(question.questionKey));
  const unsupportedRequiredKeys = activeRequired
    .filter((question) => question.support.status === 'unsupported')
    .map((question) => question.questionKey);
  const requiredUnansweredKeys = activeRequired
    .filter((question) => !hasAnswerValue(answers[question.questionKey]))
    .map((question) => question.questionKey);
  const activeAnswers = [...visible]
    .map((key) => answers[key])
    .filter((answer): answer is QuestionnaireAnswer => answer != null && hasAnswerValue(answer));

  return {
    complete: requiredUnansweredKeys.length === 0
      && unsupportedRequiredKeys.length === 0
      && hasConsistentSubmittedBatch(activeAnswers),
    requiredUnansweredKeys,
    unsupportedRequiredKeys,
  };
}

/*
 * The related assessment request, in the three states the server distinguishes.
 * `absent` and `unavailable` carry no identity at all: absent because there is
 * nothing to name, unavailable because the record's existence is itself
 * protected. Only `available` may be named or linked.
 *
 * This lives in the domain module, not the service, because presentation code
 * on client components needs to narrow it and the service is server-only.
 */
export const assessmentRequestRelationshipSchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('available'),
    documentId: z.string().trim().min(1).max(255),
    requestNumber: z.string().trim().min(1).max(255),
    title: z.string().trim().min(1).max(255),
    requestStatus: z.string().trim().min(1).max(255),
  }).strict(),
  z.object({ availability: z.literal('absent') }).strict(),
  z.object({ availability: z.literal('unavailable') }).strict(),
]);
export type QuestionnaireRequestRelationship = z.infer<typeof assessmentRequestRelationshipSchema>;

/** Narrows the relation to the only state that may be named or linked. */
export function availableAssessmentRequest(
  relationship: QuestionnaireRequestRelationship,
): Extract<QuestionnaireRequestRelationship, { availability: 'available' }> | null {
  return relationship.availability === 'available' ? relationship : null;
}
