import { describe, expect, it } from 'vitest';
import {
  answerEnvelopeSchema,
  questionnaireDefinitionSchema,
  type QuestionnaireQuestion,
} from './questionnaire-schema';
import {
  calculateProgress,
  clearHiddenAnswers,
  getVisibleQuestionKeys,
  orderQuestionnaire,
  validateActiveRequiredAnswers,
  assessmentRequestRelationshipSchema,
} from './questionnaire-domain';

type AnswerType = QuestionnaireQuestion['answerType'];

const section = (key: string, order: number) => ({
  key,
  title: key === 'context' ? 'Context' : 'Details',
  description: `${key} questions`,
  order,
});

function question(
  questionKey: string,
  answerType: AnswerType,
  options: Record<string, unknown> = {},
) {
  return {
    questionText: `Question ${questionKey}`,
    answerType,
    options: {
      schemaVersion: 1,
      questionKey,
      section: section('context', 0),
      order: 0,
      required: false,
      ...options,
    },
    answer: null,
  };
}

const draft = (value: string | boolean | string[] | null) => ({
  schemaVersion: 1 as const,
  value,
  state: 'draft' as const,
  updatedAt: '2026-08-30T01:02:03.000Z',
});

const submitted = (value: string | boolean | string[] | null, submittedAt: string) => ({
  schemaVersion: 1 as const,
  value,
  state: 'submitted' as const,
  updatedAt: submittedAt,
  submittedAt,
});

describe('questionnaireDefinitionSchema', () => {
  it('parses every persisted answer type and orders sections and questions deterministically', () => {
    const parsed = questionnaireDefinitionSchema.parse([
      question('details', 'Long text', { section: section('details', 1), order: 1 }),
      question('name', 'Text', { required: true, order: 1 }),
      question('enabled', 'Boolean', { order: 2 }),
      question('region', 'Single select', {
        order: 3,
        choices: [{ value: 'au', label: 'Australia' }],
      }),
      question('controls', 'Multi select', {
        order: 4,
        choices: [
          { value: 'mfa', label: 'MFA' },
          { value: 'logging', label: 'Logging' },
        ],
      }),
      question('goLive', 'Date', { order: 5 }),
      question('evidence', 'File upload', { order: 6, required: true }),
      question('overview', 'Long text', { section: section('details', 1), order: 0 }),
    ]);

    const ordered = orderQuestionnaire(parsed);
    expect(ordered.map(({ key }) => key)).toEqual(['context', 'details']);
    expect(ordered[0]?.questions.map(({ questionKey }) => questionKey)).toEqual([
      'name', 'enabled', 'region', 'controls', 'goLive', 'evidence',
    ]);
    expect(ordered[1]?.questions.map(({ questionKey }) => questionKey)).toEqual(['overview', 'details']);
    expect(ordered[0]?.questions.at(-1)?.support).toEqual({
      status: 'unsupported',
      reason: 'file-upload-deferred',
    });
  });

  it.each([
    ['unknown schema version', [question('name', 'Text', { schemaVersion: 3 })]],
    ['duplicate question key', [question('same', 'Text'), question('same', 'Boolean', { order: 1 })]],
    ['duplicate question order', [question('one', 'Text'), question('two', 'Text')]],
    ['duplicate section order', [
      question('one', 'Text'),
      question('two', 'Text', { section: section('details', 0) }),
    ]],
    ['incompatible choices', [question('name', 'Text', { choices: [{ value: 'x', label: 'X' }] })]],
    ['missing choices', [question('region', 'Single select')]],
    ['duplicate choice values', [question('region', 'Single select', {
      choices: [{ value: 'au', label: 'Australia' }, { value: 'au', label: 'Again' }],
    })]],
  ])('rejects %s', (_case, input) => {
    expect(questionnaireDefinitionSchema.safeParse(input).success).toBe(false);
  });

  it('accepts valid earlier-question conditions and rejects unknown, forward, cyclic, and incompatible edges', () => {
    const valid = [
      question('enabled', 'Boolean'),
      question('region', 'Single select', {
        order: 1,
        choices: [{ value: 'au', label: 'Australia' }],
        visibility: { questionKey: 'enabled', operator: 'equals', value: true },
      }),
      question('details', 'Long text', {
        order: 2,
        visibility: { questionKey: 'region', operator: 'notEquals', value: 'au' },
      }),
    ];
    expect(questionnaireDefinitionSchema.safeParse(valid).success).toBe(true);

    const unknown = [question('later', 'Text', {
      visibility: { questionKey: 'missing', operator: 'equals', value: 'yes' },
    })];
    const forward = [
      question('first', 'Text', {
        visibility: { questionKey: 'second', operator: 'equals', value: 'yes' },
      }),
      question('second', 'Text', { order: 1 }),
    ];
    const cyclic = [
      question('first', 'Text', {
        visibility: { questionKey: 'second', operator: 'equals', value: 'yes' },
      }),
      question('second', 'Text', {
        order: 1,
        visibility: { questionKey: 'first', operator: 'equals', value: 'yes' },
      }),
    ];
    const incompatible = [
      question('enabled', 'Boolean'),
      question('details', 'Text', {
        order: 1,
        visibility: { questionKey: 'enabled', operator: 'includes', value: 'yes' },
      }),
    ];

    for (const input of [unknown, forward, cyclic, incompatible]) {
      expect(questionnaireDefinitionSchema.safeParse(input).success).toBe(false);
    }
  });

  it('rejects unknown question input instead of stripping it into a usable definition', () => {
    expect(questionnaireDefinitionSchema.safeParse([{
      ...question('name', 'Text'),
      injectedLifecycleState: 'submitted',
    }]).success).toBe(false);
  });
});

describe('answerEnvelopeSchema', () => {
  it.each([
    ['Text', draft('short answer')],
    ['Long text', draft('long answer')],
    ['Boolean', draft(true)],
    ['Single select', draft('au')],
    ['Multi select', draft(['mfa', 'logging'])],
    ['Date', draft('2026-08-30')],
    ['File upload', draft(null)],
  ] as const)('accepts a type-compatible %s value', (answerType, envelope) => {
    expect(answerEnvelopeSchema(answerType).safeParse(envelope).success).toBe(true);
  });

  it('rejects mismatched values, invalid dates, unknown keys, and File upload surrogates', () => {
    expect(answerEnvelopeSchema('Boolean').safeParse(draft('true')).success).toBe(false);
    expect(answerEnvelopeSchema('Date').safeParse(draft('30/08/2026')).success).toBe(false);
    expect(answerEnvelopeSchema('File upload').safeParse(draft('https://files/evidence')).success).toBe(false);
    expect(answerEnvelopeSchema('Text').safeParse({ ...draft('answer'), owner: 'client' }).success).toBe(false);
  });

  it('enforces server-shaped draft and submitted timestamp metadata', () => {
    expect(answerEnvelopeSchema('Text').safeParse({ ...draft('answer'), submittedAt: '2026-08-30T01:02:03.000Z' }).success).toBe(false);
    expect(answerEnvelopeSchema('Text').safeParse({
      ...draft('answer'),
      state: 'submitted',
    }).success).toBe(false);
    expect(answerEnvelopeSchema('Text').safeParse(submitted('answer', '2026-08-30T01:02:03.000Z')).success).toBe(true);
  });
});

describe('assessment request relationship parser', () => {
  const availableRequest = {
    availability: 'available' as const,
    documentId: 'request/one',
    requestNumber: 'RAR-2026-X7K4Q2',
    title: 'Customer portal review',
    requestStatus: 'questionnaire-in-progress',
  };

  it('accepts only the bounded available summary and identity-free absent states', () => {
    expect(assessmentRequestRelationshipSchema.parse(availableRequest)).toEqual(availableRequest);
    expect(assessmentRequestRelationshipSchema.parse({ availability: 'absent' })).toEqual({ availability: 'absent' });
    expect(assessmentRequestRelationshipSchema.parse({ availability: 'unavailable' })).toEqual({ availability: 'unavailable' });
  });

  it('rejects nullable, malformed, and identity-bearing unavailable relationships', () => {
    for (const relationship of [
      null,
      { ...availableRequest, documentId: null },
      { availability: 'unavailable', documentId: 'protected-request' },
      { availability: 'absent', requestNumber: 'RAR-2026-X7K4Q2' },
      { ...availableRequest, internalStatus: 'hidden' },
    ]) {
      expect(assessmentRequestRelationshipSchema.safeParse(relationship).success).toBe(false);
    }
  });
});

describe('questionnaire domain operations', () => {
  const definition = (includeEvidence = true) => questionnaireDefinitionSchema.parse([
    question('enabled', 'Boolean', { required: true }),
    question('controls', 'Multi select', {
      order: 1,
      required: true,
      choices: [{ value: 'mfa', label: 'MFA' }],
      visibility: { questionKey: 'enabled', operator: 'equals', value: true },
    }),
    question('details', 'Long text', {
      order: 2,
      visibility: { questionKey: 'controls', operator: 'includes', value: 'mfa' },
    }),
    ...(includeEvidence ? [question('evidence', 'File upload', { order: 3, required: true })] : []),
  ]);

  it('derives conditional visibility and removes hidden values from normalization', () => {
    const answers = {
      enabled: draft(false),
      controls: draft(['mfa']),
      details: draft('sensitive stale value'),
    };

    expect(getVisibleQuestionKeys(definition(), answers)).toEqual(['enabled', 'evidence']);
    expect(clearHiddenAnswers(definition(), answers)).toEqual({ enabled: draft(false) });
  });

  it('calculates progress over active answers and reports required unanswered keys', () => {
    const answers = { enabled: draft(true), controls: draft([]) };
    expect(calculateProgress(definition(), answers)).toEqual({ answered: 1, total: 3, percent: 33 });
    expect(validateActiveRequiredAnswers(definition(), answers)).toEqual({
      complete: false,
      requiredUnansweredKeys: ['controls', 'evidence'],
      unsupportedRequiredKeys: ['evidence'],
    });
  });

  it('recognizes a complete supported response and matching submitted batches', () => {
    const supported = definition(false);
    const submittedAt = '2026-08-30T01:02:03.000Z';
    const answers = {
      enabled: submitted(true, submittedAt),
      controls: submitted(['mfa'], submittedAt),
      details: submitted('implemented', submittedAt),
    };
    expect(validateActiveRequiredAnswers(supported, answers)).toEqual({
      complete: true,
      requiredUnansweredKeys: [],
      unsupportedRequiredKeys: [],
    });
    expect(calculateProgress(supported, answers)).toEqual({ answered: 3, total: 3, percent: 100 });

    const mismatched = { ...answers, details: submitted('implemented', '2026-08-30T02:00:00.000Z') };
    expect(validateActiveRequiredAnswers(supported, mismatched).complete).toBe(false);
  });

  it('reports required keys in form order (section, then question), not in the order the server serves them (D-13)', () => {
    // The server sorts by question order alone, so the two sections interleave.
    const served = questionnaireDefinitionSchema.parse([
      question('b0', 'Text', { section: section('details', 2), order: 0, required: true }),
      question('a0', 'Text', { section: section('context', 1), order: 0, required: true }),
      question('b1', 'File upload', { section: section('details', 2), order: 1, required: true }),
      question('a1', 'File upload', { section: section('context', 1), order: 1, required: true }),
    ]);
    expect(validateActiveRequiredAnswers(served, {})).toEqual({
      complete: false,
      requiredUnansweredKeys: ['a0', 'a1', 'b0', 'b1'],
      unsupportedRequiredKeys: ['a1', 'b1'],
    });
  });
});

/*
 * Governance writes a version-2 envelope for every question it creates or
 * edits. The client parsed only version 1, so the first question an Analyst
 * added through the governance panel made the whole review screen fail to
 * load. Neither suite caught it because no fixture carried a version-2
 * question; only the running browser did.
 */
describe('version-2 question envelopes', () => {
  const versionTwo = (questionKey: string, options: Record<string, unknown> = {}) => ({
    documentId: `doc-${questionKey}`,
    questionText: `Question ${questionKey}`,
    answerType: 'Text' as const,
    options: { schemaVersion: 2, questionKey, section: section('context', 0), order: 0, required: false, ...options },
    answer: null,
  });

  it('parses a version-2 question and its deletion marker', () => {
    const parsed = questionnaireDefinitionSchema.parse([versionTwo('added')]);
    expect(parsed[0]?.schemaVersion).toBe(2);

    const deleted = questionnaireDefinitionSchema.parse([
      versionTwo('retired', { deleted: { deletedAt: '2026-09-21T00:00:00.000Z', deletedBy: 'analyst-1' } }),
    ]);
    expect(deleted[0]).toHaveProperty('deleted');
  });

  it('rejects a deletion marker on a version-1 envelope and an unknown version', () => {
    expect(questionnaireDefinitionSchema.safeParse([
      { ...versionTwo('legacy'), options: { schemaVersion: 1, questionKey: 'legacy', section: section('context', 0), order: 0, required: false, deleted: { deletedAt: '2026-09-21T00:00:00.000Z', deletedBy: 'analyst-1' } } },
    ]).success).toBe(false);
    expect(questionnaireDefinitionSchema.safeParse([
      { ...versionTwo('future'), options: { schemaVersion: 3, questionKey: 'future', section: section('context', 0), order: 0, required: false } },
    ]).success).toBe(false);
  });
});
