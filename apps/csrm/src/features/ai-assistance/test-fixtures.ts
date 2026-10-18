/*
 * Test data the AI assistance tests share (IN-401). It is not a test file, so importing it registers no tests, mocks
 * or hooks, and only tests import it (src/test/test-module-isolation.test.ts), so it never ships.
 */

/** A completed draft run with a full context summary, as `GET /v1/ai_runs/{runId}` serves it (D-25). */
export const aiRunFixture = {
  documentId: 'run-1',
  operation: 'assessment-draft',
  status: 'completed',
  startedAt: '2026-10-05T00:00:00.000Z',
  completedAt: '2026-10-05T00:00:05.000Z',
  initiatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
  providerName: 'deterministic-assessment-draft',
  providerVersion: '2',
  instruction: null,
  contextSummary: {
    schemaVersion: 3,
    operation: 'assessment-draft',
    request: { fields: [{ key: 'request.title', label: 'request.title', characters: 22 }] },
    questions: { included: 1, answered: 1, sources: [{ key: 'answer.payment-files', label: 'Are payment files signed?', section: 'Payment processing' }] },
    systems: [{ key: 'system-1', documentId: 'system-1', name: 'Finance system' }],
    assets: [{ key: 'asset-1', documentId: 'asset-1', name: 'Employee payment details', classification: 'Restricted' }],
    riskTypes: { offered: 4, total: 4, names: ['Internet Exposure'] },
    controlCandidates: { offered: 12, total: 2_646 },
    classification: { level: 'Restricted', source: 'assets', ceiling: null, decision: 'allowed' },
    characters: 7_045,
    budget: 200_000,
    digest: `sha256:${'a'.repeat(64)}`,
    notes: {
      included: [{ documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-04T23:00:00.000Z', characters: 118 }],
      marked: 1,
      bound: 50,
    },
    // Phase 14 D-35: the files the run used, each named as it is now; this draft run used none.
    attachments: { included: [], bound: 60_000 },
    // Phase 15 (the approved amendment): a v3 summary is served with both of v4's sections null.
    questionnaire: null,
    instruction: null,
    // Phase 16 (the approved amendment): a v1 to v4 summary is served with v5's risk proposal section null.
    riskProposals: null,
  },
  failureCode: null,
  failureMessage: null,
  targets: { assessmentRequest: 'request-1', questionnaire: 'questionnaire-1', assessment: 'assessment-1', risk: null },
} as const;
