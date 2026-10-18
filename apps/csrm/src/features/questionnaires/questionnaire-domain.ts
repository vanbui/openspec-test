import type {
  QuestionnaireAnswer,
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from './questionnaire-schema';
import type { RequestSummaryAssignment, RequestSummaryFiles, RequestSummaryNotes } from '@/features/requests/request-domain';

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

/**
 * The introduction's facts (UI-SPEC §5.2): the number of questions shown for the answers the definition holds, the
 * count the completion card starts from, and whether more may appear.
 */
export function introductionFacts(definition: QuestionnaireDefinition): { questionCount: number; hasConditionalQuestions: boolean } {
  const heldAnswers = Object.fromEntries(definition.map((question) => [question.questionKey, question.answer]));
  return {
    questionCount: getVisibleQuestionKeys(definition, heldAnswers).length,
    hasConditionalQuestions: definition.some((question) => question.visibility != null),
  };
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
 * The type lives in this zod-free domain module because presentation code on
 * client components narrows it; its parser lives in questionnaire-schema.ts,
 * which proves the two equal, so no client module downloads zod (plan 11-09).
 */
export type QuestionnaireRequestRelationship =
  | {
    availability: 'available';
    documentId: string;
    requestNumber: string;
    title: string;
    requestStatus: string;
    /** Phase 13 D-16: who holds the request, on the analyst's questionnaire read; null (or absent) on every other. */
    assignment?: RequestSummaryAssignment | null;
    /** Phase 13 D-25: the request's notes figures, on the analyst's questionnaire read; null (or absent) on every other. */
    notes?: RequestSummaryNotes | null;
    /** Phase 14 D-27: the request's files figures, on the analyst's questionnaire read; null (or absent) on every other. */
    files?: RequestSummaryFiles | null;
  }
  | { availability: 'absent' }
  | { availability: 'unavailable' };

/** Narrows the relation to the only state that may be named or linked. */
export function availableAssessmentRequest(
  relationship: QuestionnaireRequestRelationship,
): Extract<QuestionnaireRequestRelationship, { availability: 'available' }> | null {
  return relationship.availability === 'available' ? relationship : null;
}

/*
 * Phase 15 (15-UI-SPEC §11.2; D-25, D-07, UI-D25, SD-1): the Requestor's unsaved answers, kept for the browser session
 * when a save is refused because a Security Analyst took the questionnaire back (QUESTIONNAIRE_NOT_ANSWERABLE). The
 * session draft store keeps strings, so they are kept as JSON and read back defensively; on the next released load only
 * answers that still fit their question are restored, and the rest are discarded silently.
 */
export type KeptAnswerValue = string | boolean | readonly string[] | null;

export type KeptUnsavedAnswer = {
  readonly questionKey: string;
  readonly answerType: string;
  /** The question's choice values when it was answered, so a changed choice list never takes an old answer. */
  readonly choicesSignature: string;
  readonly value: KeptAnswerValue;
};

/** The choice values in order, as JSON; '' for a question without choices. */
export function choicesSignature(question: Pick<QuestionnaireQuestion, 'choices'>): string {
  return question.choices ? JSON.stringify(question.choices.map((choice) => choice.value)) : '';
}

const isKeptValue = (value: unknown): value is KeptAnswerValue => value === null
  || typeof value === 'string'
  || typeof value === 'boolean'
  || (Array.isArray(value) && value.every((item) => typeof item === 'string'));

function isKeptUnsavedAnswer(entry: unknown): entry is KeptUnsavedAnswer {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
  const candidate = entry as Record<string, unknown>;
  return typeof candidate.questionKey === 'string'
    && typeof candidate.answerType === 'string'
    && typeof candidate.choicesSignature === 'string'
    && isKeptValue(candidate.value);
}

/** The kept answers, or null when there are none or the value does not parse or holds an entry of another shape. */
export function parseKeptUnsavedAnswers(raw: string | null): readonly KeptUnsavedAnswer[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(parsed) && parsed.every(isKeptUnsavedAnswer) ? parsed : null;
}

const holdsValue = (value: unknown): boolean => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);

/** The answers worth keeping: a supported question's value that has content and differs from the saved answer. */
export function keptUnsavedAnswersOf(definition: QuestionnaireDefinition, answers: readonly { questionKey: string; value: KeptAnswerValue }[]): KeptUnsavedAnswer[] {
  const questions = new Map(definition.map((question) => [question.questionKey, question]));
  return answers.flatMap(({ questionKey, value }) => {
    const question = questions.get(questionKey);
    if (!question || question.support.status !== 'supported' || !holdsValue(value)) return [];
    if (JSON.stringify(question.answer?.value ?? null) === JSON.stringify(value)) return [];
    return [{ questionKey, answerType: question.answerType, choicesSignature: choicesSignature(question), value }];
  });
}

/**
 * The kept answers that may be restored: the question has the same key, is still active (served to the Requestor and
 * answerable), has the same answer type and choices, and holds no saved answer.
 */
export function restorableUnsavedAnswers(kept: readonly KeptUnsavedAnswer[], questions: QuestionnaireDefinition): KeptUnsavedAnswer[] {
  const byKey = new Map(questions.map((question) => [question.questionKey, question]));
  return kept.filter((entry) => {
    const question = byKey.get(entry.questionKey);
    return question !== undefined
      && question.support.status === 'supported'
      && question.answerType === entry.answerType
      && choicesSignature(question) === entry.choicesSignature
      && !holdsValue(question.answer?.value);
  });
}

export function unsavedAnswersRestoredCaption(count: number): string {
  return count === 1
    ? '1 unsaved answer was restored from earlier in this session. Check it before you carry on.'
    : `${count.toLocaleString('en-AU')} unsaved answers were restored from earlier in this session. Check them before you carry on.`;
}
