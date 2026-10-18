import { describe, expect, it } from 'vitest';
import {
  aiGenerationFactsSchema,
  answerEnvelopeSchema,
  assessmentRequestRelationshipSchema,
  questionnaireDefinitionSchema,
  type QuestionnaireQuestion,
} from './questionnaire-schema';
import { aiInputsChangedSchema } from '@/features/ai-assistance/ai-generation-facts-schema';
import {
  calculateProgress,
  clearHiddenAnswers,
  getVisibleQuestionKeys,
  orderQuestionnaire,
  validateActiveRequiredAnswers,
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

  it('carries help text and the analyst-only AI origin, and accepts null help text (D-17, D-22)', () => {
    const [withHelp, withoutHelp] = questionnaireDefinitionSchema.parse([
      { ...question('name', 'Text'), helpText: 'Use the name people know the service by.', aiOrigin: 'generated-edited' },
      { ...question('owner', 'Text', { order: 1 }), helpText: null },
    ]);
    expect(withHelp).toMatchObject({ helpText: 'Use the name people know the service by.', aiOrigin: 'generated-edited' });
    expect(withoutHelp).not.toHaveProperty('helpText');
    expect(withoutHelp).not.toHaveProperty('aiOrigin');
  });

  it('carries the analyst-only answered flag and the confirmed AI proposal origins (Phase 15 D-27, D-30)', () => {
    const [confirmed, edited, plain] = questionnaireDefinitionSchema.parse([
      { ...question('name', 'Text'), aiOrigin: 'proposal-confirmed', answered: true },
      { ...question('owner', 'Text', { order: 1 }), aiOrigin: 'proposal-edited', answered: false },
      { ...question('region', 'Text', { order: 2 }) },
    ]);
    expect(confirmed).toMatchObject({ aiOrigin: 'proposal-confirmed', answered: true });
    expect(edited).toMatchObject({ aiOrigin: 'proposal-edited', answered: false });
    expect(plain).not.toHaveProperty('answered');
    expect(questionnaireDefinitionSchema.safeParse([{ ...question('name', 'Text'), answered: 'yes' }]).success).toBe(false);
  });

  it('refuses help text over 2,000 characters and an unknown AI origin', () => {
    expect(questionnaireDefinitionSchema.safeParse([{ ...question('name', 'Text'), helpText: 'x'.repeat(2_001) }]).success).toBe(false);
    expect(questionnaireDefinitionSchema.safeParse([{ ...question('name', 'Text'), aiOrigin: 'model-written' }]).success).toBe(false);
  });
});

describe('aiGenerationFactsSchema', () => {
  const facts = {
    generatedAt: '2026-10-05T00:00:00.000Z',
    generatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
    providerName: 'deterministic-questionnaire-generation',
    providerVersion: '2',
    runId: 'run-1',
    aiInputsChanged: null,
  };
  /* Phase 13 D-29: the notes whose mark changed since the record's generation, by identity and change only. */
  const aiInputsChanged = {
    count: 2,
    notes: [
      { documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-06T00:00:00.000Z', change: 'marked' },
      { documentId: 'note-3', part: 'security-analyst', sequence: 3, postedAt: '2026-10-07T00:00:00.000Z', change: 'unmarked' },
    ],
    files: [],
  };

  it('accepts the closed facts, including a generation before run records existed (D-23, D-25)', () => {
    expect(aiGenerationFactsSchema.parse(facts)).toEqual(facts);
    expect(aiGenerationFactsSchema.parse({ ...facts, runId: null, generatedBy: null }).runId).toBeNull();
  });

  it('accepts the open AI proposal count, null for a requesting analyst, or none at all (Phase 15 D-28, D-32)', () => {
    expect(aiGenerationFactsSchema.parse({ ...facts, openProposals: 3 }).openProposals).toBe(3);
    expect(aiGenerationFactsSchema.parse({ ...facts, openProposals: null }).openProposals).toBeNull();
    expect(aiGenerationFactsSchema.parse(facts)).not.toHaveProperty('openProposals');
    expect(aiGenerationFactsSchema.safeParse({ ...facts, openProposals: -1 }).success).toBe(false);
    expect(aiGenerationFactsSchema.safeParse({ ...facts, openProposals: 1.5 }).success).toBe(false);
  });

  it('refuses a missing or unknown key', () => {
    const { runId: _runId, ...withoutRun } = facts;
    expect(aiGenerationFactsSchema.safeParse(withoutRun).success).toBe(false);
    expect(aiGenerationFactsSchema.safeParse({ ...facts, prompt: 'hidden' }).success).toBe(false);
  });

  it('requires the AI-inputs signal, null or the closed list of changed notes (D-29)', () => {
    expect(aiGenerationFactsSchema.parse({ ...facts, aiInputsChanged }).aiInputsChanged).toEqual(aiInputsChanged);
    const { aiInputsChanged: _signal, ...withoutSignal } = facts;
    expect(aiGenerationFactsSchema.safeParse(withoutSignal).success).toBe(false);
  });

  it('refuses a signal carrying note text, an unknown change or an extra key (D-29, G-3)', () => {
    const [first, second] = aiInputsChanged.notes;
    for (const signal of [
      { ...aiInputsChanged, notes: [{ ...first, body: 'The vendor moved region.' }, second] },
      { ...aiInputsChanged, notes: [{ ...first, change: 'edited' }, second] },
      { ...aiInputsChanged, notes: [{ ...first, part: 'agent' }, second] },
      { ...aiInputsChanged, runId: 'run-1' },
      { notes: aiInputsChanged.notes, files: [] },
    ]) {
      expect(aiGenerationFactsSchema.safeParse({ ...facts, aiInputsChanged: signal }).success).toBe(false);
    }
  });

  /* Phase 14 D-36 (14-PLAN-CHECK iteration 2, S-1): the one signal names files too, closed; either list may be empty. */
  const file = { documentId: 'file-csv', fileName: 'register.csv', change: 'included' } as const;

  it('accepts a files-only signal and a notes-only signal', () => {
    const filesOnly = { count: 1, notes: [], files: [file] };
    expect(aiInputsChangedSchema.parse(filesOnly)).toEqual(filesOnly);
    expect(aiInputsChangedSchema.parse(aiInputsChanged)).toEqual(aiInputsChanged);
    expect(aiInputsChangedSchema.parse({ count: 2, notes: [], files: [file, { ...file, documentId: 'file-pdf', fileName: 'pack.pdf', change: 'removed' }] }).files).toHaveLength(2);
  });

  it('refuses both lists empty, a file carrying anything else, an unknown change and a signal without files', () => {
    const { files: _files, ...withoutFiles } = aiInputsChanged;
    for (const signal of [
      { count: 1, notes: [], files: [] },
      { count: 1, notes: [], files: [{ ...file, sha256: 'a'.repeat(64) }] },
      { count: 1, notes: [], files: [{ ...file, change: 'edited' }] },
      { count: 1, notes: [], files: [{ ...file, fileName: '' }] },
      { count: 1, notes: [], files: [{ ...file, fileName: 'x'.repeat(256) }] },
      withoutFiles,
    ]) {
      expect(aiInputsChangedSchema.safeParse(signal).success).toBe(false);
    }
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

  /* Phase 13 D-16, D-25: the analyst's read names who holds the request and its notes figures; a Requestor's reads null. */
  const assignment = { assignee: { documentId: 'analyst-1', displayName: 'Bob Doe' }, pickUp: 'not-offered' as const };
  const notes = { total: 2, unread: 1 };

  it('accepts the assignee, the pick-up state and the notes figures, or null for each', () => {
    const summarised = { ...availableRequest, assignment, notes };
    expect(assessmentRequestRelationshipSchema.parse(summarised)).toEqual(summarised);
    expect(assessmentRequestRelationshipSchema.parse({ ...availableRequest, assignment: { assignee: null, pickUp: 'allowed' }, notes })).toMatchObject({ assignment: { assignee: null, pickUp: 'allowed' } });
    expect(assessmentRequestRelationshipSchema.parse({ ...availableRequest, assignment: null, notes: null })).toMatchObject({ assignment: null, notes: null });
  });

  it('refuses an assignee or notes figure the contract does not declare', () => {
    for (const relationship of [
      { ...availableRequest, assignment: { ...assignment, pickUp: 'claimed' }, notes },
      { ...availableRequest, assignment: { ...assignment, assignee: { ...assignment.assignee, email: 'bob@example.com' } }, notes },
      { ...availableRequest, assignment: { ...assignment, history: [] }, notes },
      { ...availableRequest, assignment, notes: { ...notes, accepting: true } },
      { ...availableRequest, assignment, notes: { total: 2, unread: -1 } },
    ]) {
      expect(assessmentRequestRelationshipSchema.safeParse(relationship).success).toBe(false);
    }
  });

  /* Phase 14 D-27: the analyst's read counts the request's files and those in the AI inputs; a Requestor's reads null. */
  it('accepts the files figures, or null, and refuses a files figure the contract does not declare', () => {
    const files = { count: 2, included: 1 };
    expect(assessmentRequestRelationshipSchema.parse({ ...availableRequest, assignment, notes, files })).toMatchObject({ files });
    expect(assessmentRequestRelationshipSchema.parse({ ...availableRequest, assignment: null, notes: null, files: null })).toMatchObject({ files: null });
    for (const relationship of [
      { ...availableRequest, assignment, notes, files: { ...files, names: ['vendor-security-pack.pdf'] } },
      { ...availableRequest, assignment, notes, files: { count: 2 } },
      { ...availableRequest, assignment, notes, files: { count: -1, included: 0 } },
      { ...availableRequest, assignment, notes, files: { count: 2, included: 1.5 } },
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
