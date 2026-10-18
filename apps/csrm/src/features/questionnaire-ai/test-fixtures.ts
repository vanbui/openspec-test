/*
 * Test data the questionnaire AI tests share. It is not a test file, so importing it registers no tests, mocks or hooks,
 * and only tests import it (src/test/test-module-isolation.test.ts), so it never ships.
 */

const allowed = { allowed: true, reason: null };

/** A failed questionnaire proposal job refused as too large, naming two files (one gone), as 15-06 projects it. */
export const contextTooLargeJobFixture = {
  jobId: 'job-2',
  questionnaireId: 'questionnaire-1',
  operation: 'questionnaire-proposals',
  questionId: null,
  status: 'failed',
  attempt: 1,
  queuedAt: '2026-10-12T01:00:00.000Z',
  startedAt: '2026-10-12T01:00:01.000Z',
  completedAt: '2026-10-12T01:00:02.000Z',
  runId: null,
  failureCode: 'CONTEXT_TOO_LARGE',
  failureMessage: 'The AI context is too large. The 2 files included in the AI inputs hold more text than can be sent; exclude some and try again.',
  failureAttachments: [
    { documentId: 'file-1', fileName: 'Vendor security pack.pdf' },
    { documentId: 'file-2', fileName: null },
  ],
  initiatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
  initiatedByViewer: true,
  canRetry: true,
} as const;

/** A queued rewrite job of one question. */
export const rewriteJobFixture = {
  jobId: 'job-1',
  questionnaireId: 'questionnaire-1',
  operation: 'question-rewrite',
  questionId: 'question-3',
  status: 'queued',
  attempt: 1,
  queuedAt: '2026-10-12T02:00:00.000Z',
  startedAt: null,
  completedAt: null,
  runId: null,
  failureCode: null,
  failureMessage: null,
  initiatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
  initiatedByViewer: true,
  canRetry: false,
} as const;

/** `GET /v1/questionnaires/{questionnaireId}/ai_proposals` in analyst review: one run, an open addition and a decided change. */
export const proposalsFixture = {
  questionnaireId: 'questionnaire-1',
  state: 'analyst-review',
  openCount: 1,
  actions: { start: allowed, rewrite: allowed, confirm: allowed, reject: allowed, replace: { allowed: false, reason: 'AI_PROPOSALS_OPEN' } },
  runs: [{
    runId: 'run-1',
    operation: 'questionnaire-proposals',
    scope: 'questionnaire',
    initiatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
    startedAt: '2026-10-12T00:00:00.000Z',
    completedAt: '2026-10-12T00:00:05.000Z',
    providerName: 'deterministic-questionnaire-proposals',
    providerVersion: '1',
    instruction: 'Ask about payment file signing.',
    instructionSource: 'analyst',
    targetQuestion: null,
    outcome: 'items',
    counts: { items: 2, open: 1 },
    adjustments: [{ code: 'over-limit', count: 10 }],
    sourcesDropped: 0,
  }],
  items: [
    {
      runId: 'run-1',
      itemKey: 'i-1',
      kind: 'add',
      state: 'open',
      stale: false,
      target: null,
      current: null,
      proposed: { questionText: 'Are payment files signed before upload?', helpText: null, answerType: 'Boolean', choices: [], required: true },
      placement: { sectionTitle: 'Payment processing', newSection: false, visibility: { controllerText: 'Do you process payments?', operator: 'equals', value: true } },
      rationale: 'The analyst asked about payment file signing.',
      sources: [
        { kind: 'instruction', ref: 'instruction', label: 'Your instruction', note: null },
        { kind: 'note', ref: 'note.2', label: 'Note 2', note: { documentId: 'note-2', part: 'security-analyst', postedAt: '2026-10-11T00:00:00.000Z' } },
      ],
      decision: null,
      canUndo: false,
    },
    {
      runId: 'run-1',
      itemKey: 'i-2',
      kind: 'change',
      state: 'accepted',
      stale: null,
      target: { questionId: 'question-3', questionText: 'Where is data stored?', available: true },
      current: { questionText: 'Where is data stored?', helpText: null, answerType: 'Single select', choices: [{ value: 'au', label: 'Australia' }], required: true },
      proposed: { questionText: 'Where is the data stored and backed up?', helpText: 'Name every region.', answerType: 'Single select', choices: [{ value: 'au', label: 'Australia' }], required: true },
      placement: null,
      rationale: 'Backups were not covered.',
      sources: [{ kind: 'request-field', ref: 'request.description', label: 'Description', note: null }],
      decision: { action: 'accepted', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-12T00:10:00.000Z', reason: null, edited: true },
      canUndo: true,
    },
  ],
  jobs: [contextTooLargeJobFixture],
  fixedQuestions: [{ questionId: 'question-9', questionText: 'Who owns the system?' }],
} as const;
