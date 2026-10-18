/*
 * Test data the risk curation tests share. It is not a test file, so importing it registers no tests, mocks or hooks,
 * and only tests import it (src/test/test-module-isolation.test.ts), so it never ships.
 */

const analyst = { documentId: 'analyst-1', displayName: 'Morgan Analyst' } as const;
const allowed = { allowed: true, reason: null } as const;

/** One page of a Risk's history, newest first, as 16-03 serves it: a withdrawal, an analyst edit and the Risk's creation. */
export const historyPageFixture = {
  data: [
    {
      id: 'event-3',
      kind: 'withdrawn',
      occurredAt: '2026-10-14T03:00:00.000Z',
      actor: analyst,
      sourceKind: 'analyst',
      aiRunId: null,
      proposalItem: null,
      reason: 'Duplicate of R-0002',
      undo: false,
      changes: { schemaVersion: 1, fields: [] },
    },
    {
      id: 'event-2',
      kind: 'updated',
      occurredAt: '2026-10-14T02:00:00.000Z',
      actor: analyst,
      sourceKind: 'analyst',
      aiRunId: null,
      proposalItem: null,
      reason: null,
      undo: false,
      changes: {
        schemaVersion: 1,
        fields: [
          { field: 'riskStatement', from: 'Unsigned files reconciled', to: 'Unsigned payment files reconciled by hand' },
          { field: 'informationSystemImpacted', from: null, to: { documentId: 'system-1', label: 'Payments gateway' } },
        ],
      },
    },
    {
      id: 'event-1',
      kind: 'control-implementation-added',
      occurredAt: '2026-10-14T01:00:00.000Z',
      actor: null,
      sourceKind: 'analyst',
      aiRunId: null,
      proposalItem: null,
      reason: null,
      undo: false,
      changes: null,
    },
  ],
  meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 3 }, recordedFrom: '2026-10-14T01:00:00.000Z' },
} as const;

/** A queued Suggest more risks job, started by another analyst. */
export const suggestionsJobFixture = {
  jobId: 'job-1',
  operation: 'risk-suggestions',
  assessmentId: 'a1',
  riskId: null,
  status: 'queued',
  attempt: 1,
  queuedAt: '2026-10-14T04:00:00.000Z',
  startedAt: null,
  completedAt: null,
  runId: null,
  failureCode: null,
  failureMessage: null,
  initiatedBy: { documentId: 'analyst-2', displayName: 'Riley Analyst' },
  initiatedByViewer: false,
  canRetry: false,
} as const;

/** A failed rewrite of one Risk refused as too large, naming one file. */
export const failedRewriteJobFixture = {
  jobId: 'job-2',
  operation: 'risk-rewrite',
  assessmentId: 'a1',
  riskId: 'r1',
  status: 'failed',
  attempt: 2,
  queuedAt: '2026-10-14T05:00:00.000Z',
  startedAt: '2026-10-14T05:00:01.000Z',
  completedAt: '2026-10-14T05:00:02.000Z',
  runId: null,
  failureCode: 'CONTEXT_TOO_LARGE',
  failureMessage: 'The AI context is too large.',
  failureAttachments: [{ documentId: 'file-1', fileName: 'Vendor security pack.pdf' }],
  initiatedBy: analyst,
  initiatedByViewer: true,
  canRetry: true,
} as const;

/** An assessment's AI proposals: one suggestions run with an open proposed risk, one rewrite run with an open change. */
export const proposalsFixture = {
  assessmentId: 'a1',
  editable: true,
  openCount: 2,
  openByRisk: [{ riskId: 'r1', count: 1 }],
  lastAskedAt: '2026-10-14T06:00:00.000Z',
  actions: { suggest: allowed, rewrite: allowed, decide: allowed },
  runs: [
    {
      runId: 'run-2',
      operation: 'risk-rewrite',
      initiatedBy: analyst,
      startedAt: '2026-10-14T05:59:00.000Z',
      completedAt: '2026-10-14T06:00:00.000Z',
      providerName: 'Deterministic',
      providerVersion: 'v1',
      instruction: 'Make it specific to unsigned payment files',
      focus: ['statement'],
      riskId: 'r1',
      outcome: 'items',
      counts: { items: 1, open: 1 },
      adjustments: [{ code: 'outside-focus', count: 1 }],
    },
    {
      runId: 'run-1',
      operation: 'risk-suggestions',
      initiatedBy: analyst,
      startedAt: '2026-10-14T04:59:00.000Z',
      completedAt: '2026-10-14T05:00:00.000Z',
      providerName: 'Deterministic',
      providerVersion: 'v1',
      instruction: null,
      focus: null,
      riskId: null,
      outcome: 'items',
      counts: { items: 1, open: 1 },
      adjustments: [{ code: 'near-duplicate-active', count: 2 }, { code: 'over-limit', count: 3 }],
    },
  ],
  items: [
    {
      runId: 'run-2',
      itemKey: 'u-risk-statement',
      kind: 'change',
      state: 'open',
      stale: false,
      riskId: 'r1',
      unitKey: 'u-risk-statement',
      fields: ['riskStatement'],
      current: { riskStatement: 'Unsigned files reconciled' },
      proposed: { riskStatement: 'Unsigned payment files reconciled by hand' },
      similarTo: null,
      aiAccept: false,
      acceptBlocked: null,
      sources: [{ key: 'request:title', kind: 'request', label: 'Request title', section: null, classification: null }],
      uncited: [],
      suggestedControls: [],
      decision: null,
      addedRisk: null,
      canUndo: false,
    },
    {
      runId: 'run-1',
      itemKey: 's-1',
      kind: 'risk',
      state: 'open',
      stale: null,
      riskId: null,
      unitKey: null,
      fields: ['riskStatement', 'residualRating'],
      current: null,
      proposed: { riskStatement: 'Payment files altered before signing', residualRating: 'High' },
      similarTo: { kind: 'active', riskId: 'r2', riskNumber: 'R-0002', runId: null, itemKey: null, score: 0.82 },
      aiAccept: false,
      acceptBlocked: null,
      sources: [],
      uncited: ['Most payment fraud starts at the file transfer.'],
      suggestedControls: [{ controlNumber: 'ISM-1234', name: 'Sign payment files', rationale: 'Detects alteration.' }],
      decision: null,
      addedRisk: null,
      canUndo: false,
    },
  ],
  jobs: [suggestionsJobFixture],
} as const;

/* ---- Plan 16-13: the AI proposals section, proposed risks and the AI rewrite, as the parsed view (RiskAiProposals) ---- */

const proposalRunBase = {
  initiatedBy: analyst,
  startedAt: '2026-10-14T04:59:00.000Z',
  completedAt: '2026-10-14T05:00:00.000Z',
  providerName: 'Deterministic',
  providerVersion: 'v1',
  focus: null,
  riskId: null,
  outcome: 'items',
} as const;

/** A Suggest more risks request with an instruction: three proposed risks kept, one left out as too close. */
export const suggestionsRunFixture = {
  ...proposalRunBase,
  runId: 'run-s',
  operation: 'risk-suggestions',
  instruction: 'Risks about payment file integrity',
  counts: { items: 3, open: 3 },
  adjustments: [{ code: 'near-duplicate-active', count: 1 }],
} as const;

const proposedRiskBase = {
  runId: 'run-s',
  kind: 'risk',
  state: 'open',
  stale: null,
  riskId: null,
  unitKey: null,
  current: null,
  similarTo: null,
  aiAccept: false,
  acceptBlocked: null,
  sources: [],
  uncited: [],
  suggestedControls: [],
  decision: null,
  addedRisk: null,
  canUndo: false,
} as const;

/** The payment-file risk: no Risk Type, no system, rated High residually. */
export const paymentFileRiskFixture = {
  ...proposedRiskBase,
  itemKey: 's-1',
  fields: ['riskStatement', 'riskCause', 'residualRating', 'treatmentAction'],
  proposed: {
    riskType: null,
    riskStatement: 'Payment files altered before signing',
    riskCause: 'Files wait unsigned on a shared drive',
    informationAssetImpacted: 'Supplier payment file',
    inherentRating: 'Critical',
    residualRating: 'High',
    treatmentAction: 'Treat',
  },
  sources: [{ key: 'request:title', kind: 'request', label: 'Request title', section: null, classification: null }],
} as const;

/** A proposed risk close to the active R-2. */
export const similarRiskFixture = {
  ...proposedRiskBase,
  itemKey: 's-2',
  fields: ['riskStatement', 'residualRating'],
  proposed: { riskType: 'Data integrity', riskStatement: 'Supplier bank details changed without checks', informationSystemImpacted: 'Payments gateway', residualRating: 'Moderate', treatmentAction: 'Treat' },
  similarTo: { kind: 'active', riskId: 'r2', riskNumber: 'R-2', runId: null, itemKey: null, score: 0.86 },
} as const;

/** A third proposed risk, unrated. */
export const unratedRiskFixture = {
  ...proposedRiskBase,
  itemKey: 's-3',
  fields: ['riskStatement'],
  proposed: { riskType: 'Access control', riskStatement: 'Shared payment approver accounts', treatmentAction: null },
} as const;

/** A rewrite of R-3 asked for every part, with three open changes. */
export const rewriteRunFixture = {
  ...proposalRunBase,
  runId: 'run-w',
  operation: 'risk-rewrite',
  instruction: 'Make it specific to unsigned payment files',
  focus: ['statement', 'ratings', 'treatment'],
  riskId: 'r3',
  startedAt: '2026-10-14T05:59:00.000Z',
  completedAt: '2026-10-14T06:00:00.000Z',
  counts: { items: 3, open: 3 },
  adjustments: [],
} as const;

const changeBase = {
  runId: 'run-w',
  kind: 'change',
  state: 'open',
  stale: false,
  riskId: 'r3',
  similarTo: null,
  aiAccept: false,
  acceptBlocked: null,
  sources: [],
  uncited: [],
  suggestedControls: [],
  decision: null,
  addedRisk: null,
  canUndo: false,
} as const;

export const statementChangeFixture = {
  ...changeBase,
  itemKey: 'u-risk-statement',
  unitKey: 'u-risk-statement',
  fields: ['riskStatement'],
  current: { riskStatement: 'Files reconciled by hand' },
  proposed: { riskStatement: 'Unsigned payment files reconciled by hand' },
  sources: [{ key: 'request:title', kind: 'request', label: 'Request title', section: null, classification: null }],
} as const;

export const causeChangeFixture = {
  ...changeBase,
  itemKey: 'u-risk-cause',
  unitKey: 'u-risk-cause',
  fields: ['riskCause'],
  current: { riskCause: 'Manual steps' },
  proposed: { riskCause: 'Manual steps with no signature check' },
} as const;

export const residualChangeFixture = {
  ...changeBase,
  itemKey: 'u-residual-rating',
  unitKey: 'u-residual-rating',
  fields: ['residualLikelihood', 'highestResidualConsequence', 'residualRating'],
  current: { residualLikelihood: 'Likely', highestResidualConsequence: 'Major', residualRating: 'High' },
  proposed: { residualLikelihood: 'Unlikely', highestResidualConsequence: 'Major', residualRating: 'Moderate' },
} as const;

/** A queued rewrite of R-3, started by the viewer. */
export const rewriteJobFixture = {
  ...suggestionsJobFixture,
  jobId: 'job-w',
  operation: 'risk-rewrite',
  riskId: 'r3',
  initiatedBy: analyst,
  initiatedByViewer: true,
} as const;
