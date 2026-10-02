import type { ConflictReason } from './conflict-reasons';

/*
 * What a refused workflow action tells the person who tried it (UI-SPEC §10.2 and §10.3, D-22).
 *
 * Each Server Action knows its operation, so it names its family and passes the served conflict reason;
 * one code can read differently per action. A reason the family does not list, or none, reads the
 * family's fallback, which says the action can't happen in the record's current state and never asks
 * for a reload. Only a real change by someone else asks the person to refresh the page or reload the
 * questions. The Requestor's families (A to D) say no more than the relationship state she is served.
 *
 * Plain and zod-free, so Server Actions and client components can share it.
 */

export type RefusalFamily =
  | 'requestRevert'
  | 'questionnaireRevert'
  | 'questionnaireSubmit'
  | 'questionnaireRelease'
  | 'returnToReview'
  | 'questionChange'
  | 'questionDelete'
  | 'questionnaireGeneration';

type FamilyCopy = {
  readonly reasons: Readonly<Partial<Record<ConflictReason, string>>>;
  readonly fallback: string;
};

/** §10.2 G; H reads the same sentences for the five codes the two families share. */
const questionChangeReasons = {
  DEFINITION_CONFLICT: 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.',
  QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
  ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
  REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
  QUESTION_REMOVED: 'This question has been removed. Reload the questions to see the current list.',
  HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
  ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
} as const satisfies Partial<Record<ConflictReason, string>>;

const refusalCopy: Readonly<Record<RefusalFamily, FamilyCopy>> = {
  /* A. Return request to draft (both actors). */
  requestRevert: {
    reasons: {
      REQUEST_NOT_SUBMITTED: 'Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.',
      REQUEST_WORK_STARTED: 'Work on this request has started, so it can no longer return to draft.',
    },
    fallback: 'This request can’t return to draft in its current state.',
  },
  /* B. Return questionnaire to draft (both actors). */
  questionnaireRevert: {
    reasons: {
      ASSESSMENT_STARTED: 'Assessment work has started, so this questionnaire can no longer return to draft.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to draft.',
      QUESTIONNAIRE_NOT_SUBMITTED: 'Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.',
    },
    fallback: 'This questionnaire can’t return to draft in its current state.',
  },
  /* D. Submit questionnaire (Requestor). */
  questionnaireSubmit: {
    reasons: {
      QUESTIONNAIRE_INCOMPLETE: 'Some required questions are unanswered. Answer them, then submit again.',
      QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted.',
      QUESTIONNAIRE_NOT_ANSWERABLE: 'This questionnaire is no longer open for answers, so it can’t be submitted.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
    },
    fallback: 'This questionnaire can’t be submitted in its current state.',
  },
  /* E. Release questionnaire (Security Analyst). */
  questionnaireRelease: {
    reasons: {
      QUESTIONNAIRE_RELEASED: 'This questionnaire has already been released.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can’t be released.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can’t be released.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'Add at least one question before you release this questionnaire.',
      DEFINITION_INVALID: 'Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t be released in its current state.',
  },
  /* F. Return to analyst review (Security Analyst). */
  returnToReview: {
    reasons: {
      ALREADY_IN_ANALYST_REVIEW: 'This questionnaire is already in analyst review. Refresh the page to see it.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can no longer return to analyst review.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to analyst review.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t return to analyst review in its current state.',
  },
  /* G. Add or edit a question (Security Analyst). */
  questionChange: {
    reasons: questionChangeReasons,
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  /* H. Delete a question (Security Analyst). */
  questionDelete: {
    reasons: {
      QUESTION_HAS_DEPENDENTS: 'Another question is shown only after this one is answered. Change or remove that question first.',
      LAST_ACTIVE_QUESTION: 'A questionnaire needs at least one question, so its last question can’t be removed.',
      QUESTION_REMOVED: 'This question has already been removed. Reload the page to see the current list.',
      QUESTIONNAIRE_RELEASED: questionChangeReasons.QUESTIONNAIRE_RELEASED,
      ASSESSMENT_STARTED: questionChangeReasons.ASSESSMENT_STARTED,
      REQUEST_NOT_ELIGIBLE: questionChangeReasons.REQUEST_NOT_ELIGIBLE,
      HISTORY_UNAVAILABLE: questionChangeReasons.HISTORY_UNAVAILABLE,
      ANSWER_DATA_INVALID: questionChangeReasons.ANSWER_DATA_INVALID,
    },
    fallback: 'This question can’t be removed in the questionnaire’s current state.',
  },
  /* I. Generate or replace a questionnaire (Security Analyst). */
  questionnaireGeneration: {
    reasons: {
      REQUEST_NOT_ELIGIBLE: 'A questionnaire can be generated only while the request is submitted, and this request has moved on.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.',
    },
    fallback: 'A questionnaire can’t be generated for this request in its current state.',
  },
};

/** The family's sentence for a served reason, or the family's fallback for none or one it does not list. */
export function refusalMessage(family: RefusalFamily, reason?: ConflictReason): string {
  const copy = refusalCopy[family];
  return (reason === undefined ? undefined : copy.reasons[reason]) ?? copy.fallback;
}

/** §10.3: a conflict on creating, editing or submitting a request, which is not a D-22 family. */
export const requestConflictMessage = 'This request can’t be saved in its current state.';

/**
 * Whether a failed answer save can succeed by trying again (§6.1). A blocked save stops autosave until the
 * page is refreshed; a retryable one tries again on the next change or on Retry save.
 */
export type AnswerSaveFailure = 'blocked' | 'retryable';

export type AnswerSaveRefusal = { message: string; failure: AnswerSaveFailure };

/** §10.2 C: some answers fail validation; the attention list (§5.3) names them. */
export const answerSaveAttentionMessage = 'Some answers need attention before they can be saved.';

/** §10.2 C. */
const answerSaveReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  QUESTIONNAIRE_NOT_ANSWERABLE: 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.',
  QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.',
  QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
};

/** The sentence and failure kind of a refused answer save, from its status and served reason (§10.2 C). */
export function answerSaveRefusal(status?: number, reason?: ConflictReason): AnswerSaveRefusal {
  if (status === 409) {
    return {
      message: (reason === undefined ? undefined : answerSaveReasons[reason]) ?? 'Your answers can’t be saved in this questionnaire’s current state.',
      failure: 'blocked',
    };
  }
  if (status === 403) {
    return { message: 'You can’t save answers to this questionnaire right now. Refresh the page to see its current state.', failure: 'blocked' };
  }
  if (status === 400) return { message: answerSaveAttentionMessage, failure: 'retryable' };
  /* The questionnaire is gone: trying the same save again cannot help (§10.3 keeps the sentence). */
  if (status === 404) return { message: 'This questionnaire is no longer available.', failure: 'blocked' };
  /* A network failure, a timeout or a 5xx: the next change or Retry save may succeed. */
  return { message: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable' };
}
