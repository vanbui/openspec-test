import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFLICT_REASONS, type ConflictReason } from './conflict-reasons';
import { answerSaveRefusal, refusalMessage, requestConflictMessage, type RefusalFamily } from './refusal-copy';

const modulePath = resolve(process.cwd(), 'src/lib/api/refusal-copy.ts');

/*
 * UI-SPEC §10.2 and §10.3, verbatim. Each family maps the served reason to its sentence; any other
 * reason, or none, reads the family's fallback, which never asks for a reload (D-22).
 */
const families: Record<RefusalFamily, { rows: Partial<Record<ConflictReason, string>>; fallback: string }> = {
  requestRevert: {
    rows: {
      REQUEST_NOT_SUBMITTED: 'Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.',
      REQUEST_WORK_STARTED: 'Work on this request has started, so it can no longer return to draft.',
    },
    fallback: 'This request can’t return to draft in its current state.',
  },
  questionnaireRevert: {
    rows: {
      ASSESSMENT_STARTED: 'Assessment work has started, so this questionnaire can no longer return to draft.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to draft.',
      QUESTIONNAIRE_NOT_SUBMITTED: 'Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.',
    },
    fallback: 'This questionnaire can’t return to draft in its current state.',
  },
  questionnaireSubmit: {
    rows: {
      QUESTIONNAIRE_INCOMPLETE: 'Some required questions are unanswered. Answer them, then submit again.',
      QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted.',
      QUESTIONNAIRE_NOT_ANSWERABLE: 'This questionnaire is no longer open for answers, so it can’t be submitted.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
    },
    fallback: 'This questionnaire can’t be submitted in its current state.',
  },
  questionnaireRelease: {
    rows: {
      QUESTIONNAIRE_RELEASED: 'This questionnaire has already been released.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can’t be released.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can’t be released.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'Add at least one question before you release this questionnaire.',
      DEFINITION_INVALID: 'Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t be released in its current state.',
  },
  returnToReview: {
    rows: {
      ALREADY_IN_ANALYST_REVIEW: 'This questionnaire is already in analyst review. Refresh the page to see it.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can no longer return to analyst review.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to analyst review.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t return to analyst review in its current state.',
  },
  questionChange: {
    rows: {
      DEFINITION_CONFLICT: 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
      QUESTION_REMOVED: 'This question has been removed. Reload the questions to see the current list.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
      ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
    },
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  questionDelete: {
    rows: {
      QUESTION_HAS_DEPENDENTS: 'Another question is shown only after this one is answered. Change or remove that question first.',
      LAST_ACTIVE_QUESTION: 'A questionnaire needs at least one question, so its last question can’t be removed.',
      QUESTION_REMOVED: 'This question has already been removed. Reload the page to see the current list.',
      /* §10.2 H: these five read as in G. */
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
      ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
    },
    fallback: 'This question can’t be removed in the questionnaire’s current state.',
  },
  questionnaireGeneration: {
    rows: {
      REQUEST_NOT_ELIGIBLE: 'A questionnaire can be generated only while the request is submitted, and this request has moved on.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.',
    },
    fallback: 'A questionnaire can’t be generated for this request in its current state.',
  },
  /*
   * WR-205: generating an assessment draft (start or retry). Not a UI-SPEC §10.2 family: its refusals read the
   * card's own precondition (§12.2) and the §10.2 E and F wording for an assessment that already exists, and the
   * fallback follows §10.2's pattern, so a draft refusal never says the assessment changed (D-22).
   */
  assessmentDraft: {
    rows: {
      QUESTIONNAIRE_NOT_SUBMITTED: 'Draft generation can begin only after the linked questionnaire is submitted.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so a draft can’t be generated.',
    },
    fallback: 'An assessment draft can’t be generated for this questionnaire in its current state.',
  },
};

const familyNames = Object.keys(families) as RefusalFamily[];

describe('refusal copy by action and reason (UI-SPEC §10.2)', () => {
  for (const family of familyNames) {
    const { rows, fallback } = families[family];

    it.each(Object.entries(rows) as [ConflictReason, string][])(`${family}: %s reads its §10.2 sentence`, (reason, copy) => {
      expect(refusalMessage(family, reason)).toBe(copy);
    });

    it(`${family}: no reason, or a reason the family does not list, reads the fallback`, () => {
      expect(refusalMessage(family)).toBe(fallback);
      expect(refusalMessage(family, undefined)).toBe(fallback);
      for (const reason of CONFLICT_REASONS.filter((code) => !(code in rows))) {
        expect(refusalMessage(family, reason), `${family} ${reason}`).toBe(fallback);
      }
    });
  }

  it('reads the request revert sentences the tracer names', () => {
    expect(refusalMessage('requestRevert', 'REQUEST_WORK_STARTED')).toBe('Work on this request has started, so it can no longer return to draft.');
    expect(refusalMessage('requestRevert')).toBe('This request can’t return to draft in its current state.');
  });

  it('gives a request conflict outside the D-22 families the §10.3 sentence', () => {
    expect(requestConflictMessage).toBe('This request can’t be saved in its current state.');
  });
});

describe('answer save refusal (UI-SPEC §10.2 C and §6.1)', () => {
  it.each([
    ['QUESTIONNAIRE_NOT_ANSWERABLE', 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.'],
    ['QUESTIONNAIRE_ALREADY_SUBMITTED', 'This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.'],
    ['QUESTIONNAIRE_HAS_NO_QUESTIONS', 'This questionnaire has no questions to answer.'],
  ] as const)('a 409 %s is blocked with its sentence', (reason, message) => {
    expect(answerSaveRefusal(409, reason)).toEqual({ message, failure: 'blocked' });
  });

  it('a 409 with no reason, or one the save does not list, is blocked with the fallback', () => {
    const fallback = { message: 'Your answers can’t be saved in this questionnaire’s current state.', failure: 'blocked' };
    expect(answerSaveRefusal(409)).toEqual(fallback);
    expect(answerSaveRefusal(409, 'QUESTION_REMOVED')).toEqual(fallback);
  });

  it('a 403 is blocked and asks for a refresh, not a permission', () => {
    expect(answerSaveRefusal(403)).toEqual({
      message: 'You can’t save answers to this questionnaire right now. Refresh the page to see its current state.',
      failure: 'blocked',
    });
  });

  it('a 400 is retryable: the answers need attention', () => {
    expect(answerSaveRefusal(400)).toEqual({ message: 'Some answers need attention before they can be saved.', failure: 'retryable' });
  });

  it('a 404 is blocked: the questionnaire is gone, so retrying cannot help', () => {
    expect(answerSaveRefusal(404)).toEqual({ message: 'This questionnaire is no longer available.', failure: 'blocked' });
  });

  it.each([500, 502, 503, 504, undefined])('a %s or a transport failure is retryable', (status) => {
    expect(answerSaveRefusal(status)).toEqual({ message: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable' });
  });
});

describe('refusal copy module (UI-SPEC §10.3)', () => {
  const source = () => readFileSync(modulePath, 'utf8');

  it('never asks for a reload in the old words', () => {
    expect(source()).not.toMatch(/Reload and try again/);
    expect(source()).not.toMatch(/changed while you were editing/);
  });

  it('is zod-free, has no directive and imports only the reason type', () => {
    const text = source();
    expect(text).not.toMatch(/['"]use (server|client)['"]/);
    expect(text).not.toMatch(/from ['"]zod['"]/);
    const imports = text.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual([expect.stringMatching(/^import type \{ ConflictReason \} from '\.\/conflict-reasons';$/)]);
  });

  it('uses the typographic apostrophe in every sentence', () => {
    const sentences = familyNames.flatMap((family) => [refusalMessage(family), ...CONFLICT_REASONS.map((reason) => refusalMessage(family, reason))]);
    for (const sentence of sentences) expect(sentence).not.toContain("'");
  });
});
