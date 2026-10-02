import { describe, expect, it } from 'vitest';

import { introductionFacts } from './questionnaire-domain';
import type { QuestionnaireDefinition } from './questionnaire-schema';

/*
 * IN-303: the introduction's facts (UI-SPEC §5.2) are a domain rule, out of the JSX module: the number of questions
 * shown for the answers held, and whether more may appear.
 */
describe('introductionFacts', () => {
  const base = {
    documentId: 'question-one', questionText: 'Does the service store customer data?', answerType: 'Boolean', schemaVersion: 1,
    questionKey: 'stores_data', section: { key: 'general', title: 'General', order: 0 }, order: 0, required: true, answer: null,
    support: { status: 'supported' },
  };
  const conditional = {
    ...base, documentId: 'question-two', questionKey: 'data_kinds', questionText: 'Which data does it store?', answerType: 'Long text', order: 1,
    visibility: { questionKey: 'stores_data', operator: 'equals', value: true },
  };

  it('counts the questions shown for the answers held, and says more may appear', () => {
    expect(introductionFacts([base, conditional] as unknown as QuestionnaireDefinition)).toEqual({ questionCount: 1, hasConditionalQuestions: true });

    const answered = [{ ...base, answer: { value: true, updatedAt: '2026-09-28T01:00:00.000Z' } }, conditional];
    expect(introductionFacts(answered as unknown as QuestionnaireDefinition)).toEqual({ questionCount: 2, hasConditionalQuestions: true });
  });

  it('says nothing more may appear when no question is conditional', () => {
    expect(introductionFacts([base] as unknown as QuestionnaireDefinition)).toEqual({ questionCount: 1, hasConditionalQuestions: false });
  });
});
