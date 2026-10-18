import { z } from 'zod';

import {
  RISK_AI_ADJUSTMENT_CODES,
  RISK_HISTORY_KINDS,
  RISK_REWRITE_FOCUS,
  type RiskAiProposalItem,
  type RiskAiProposals,
  type RiskCurationResult,
  type RiskHistoryEvent,
  type RiskHistoryPage,
  type RiskProposalJob,
} from './risk-curation-domain';

/*
 * The closed parsers for Phase 16's operations (D-02; 16-05 to 16-10's components in
 * docs/references/specification.json). Their bounds are exactly the contract's, so the parity guard holds in every
 * mode. A key the contract does not declare, at any level, refuses the whole response. Typed against the zod-free views
 * in risk-curation-domain.ts, which client components import instead. The decision response is Phase 12's
 * AiProposalDecisionResponse, read with 12-12's own parser (ai-assistance-schema.ts) in the service.
 */
export type {
  RiskAiProposalItem,
  RiskAiProposals,
  RiskHistoryEvent,
  RiskProposalJob,
} from './risk-curation-domain';

const timestampSchema = z.iso.datetime({ offset: true });
const countSchema = z.number().int().nonnegative();
const riskIdSchema = z.string().min(1).max(255);
/** ActiveUserSummary, which declares no bound. */
const personSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();
const operationSchema = z.enum(['risk-suggestions', 'risk-rewrite']);
const focusSchema = z.enum(RISK_REWRITE_FOCUS);

/** RiskCurationResponse: the Risks a withdrawal or reinstatement changed and the ones it left unchanged (D-09, D-10). */
export const riskCurationResponseSchema = z.object({
  data: z.object({
    applied: z.array(riskIdSchema),
    unchanged: z.array(riskIdSchema),
  }).strict() satisfies z.ZodType<RiskCurationResult>,
}).strict();

/* ---- RiskHistoryResponse (D-18 to D-21) ---- */

const historyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({ documentId: z.string().min(1).max(255), label: z.string().nullable() }).strict(),
]);

const historyChangesSchema = z.object({
  schemaVersion: z.literal(1),
  fields: z.array(z.object({ field: z.string().min(1).max(64), from: historyValueSchema, to: historyValueSchema }).strict()).max(40),
  control: z.object({ documentId: z.string().min(1).max(255), controlNumber: z.string(), name: z.string() }).strict().optional(),
}).strict();

export const riskHistoryEventSchema: z.ZodType<RiskHistoryEvent> = z.object({
  id: z.string().min(1).max(255),
  kind: z.enum(RISK_HISTORY_KINDS),
  occurredAt: timestampSchema.nullable(),
  actor: personSchema.nullable(),
  sourceKind: z.enum(['analyst', 'ai-run']),
  aiRunId: z.string().nullable(),
  proposalItem: z.string().max(64).nullable(),
  reason: z.string().max(500).nullable(),
  undo: z.boolean(),
  changes: historyChangesSchema.nullable(),
}).strict();

export const riskHistoryResponseSchema = z.object({
  data: z.array(riskHistoryEventSchema).max(100),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      pageCount: countSchema,
      total: countSchema,
    }).strict(),
    recordedFrom: timestampSchema.nullable(),
  }).strict(),
}).strict();

/** The service's view of one history page: the events, the pagination and where the record starts. */
export const parseRiskHistoryPage = (value: unknown): RiskHistoryPage => {
  const { data, meta } = riskHistoryResponseSchema.parse(value);
  return { events: data, pagination: meta.pagination, recordedFrom: meta.recordedFrom };
};

/* ---- RiskProposalJobResponse (D-26) ---- */

/** S-3: the files a CONTEXT_TOO_LARGE failure counted, as the generation job's parser reads them (14-10). */
const failureAttachmentSchema = z.object({
  documentId: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255).nullable(),
}).strict();

export const riskProposalJobSchema: z.ZodType<RiskProposalJob> = z.object({
  jobId: z.string().min(1).max(255),
  operation: operationSchema,
  assessmentId: z.string(),
  riskId: z.string().nullable(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  attempt: z.number().int().min(1),
  queuedAt: timestampSchema,
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  runId: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  failureAttachments: z.array(failureAttachmentSchema).max(20).optional(),
  initiatedBy: personSchema.nullable(),
  initiatedByViewer: z.boolean(),
  canRetry: z.boolean(),
}).strict();

export const riskProposalJobResponseSchema = z.object({ data: riskProposalJobSchema }).strict();

/* ---- RiskAiProposalsResponse (D-41) ---- */

const actionSchema = z.object({ allowed: z.boolean(), reason: z.string().nullable() }).strict();

const runFactsSchema = z.object({
  runId: z.string(),
  operation: operationSchema,
  initiatedBy: personSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  providerName: z.string().nullable(),
  providerVersion: z.string().nullable(),
  instruction: z.string().nullable(),
  focus: z.array(focusSchema).nullable(),
  riskId: z.string().nullable(),
  outcome: z.enum(['items', 'no-change']),
  counts: z.object({ items: countSchema, open: countSchema }).strict(),
  adjustments: z.array(z.object({ code: z.enum(RISK_AI_ADJUSTMENT_CODES), count: z.number().int().min(1) }).strict()),
}).strict();

/** AiSourceCitation, which declares no bound. */
const sourceCitationSchema = z.object({
  key: z.string(),
  kind: z.enum(['request', 'answer', 'system', 'asset']),
  label: z.string(),
  section: z.string().nullable(),
  classification: z.string().nullable(),
}).strict();

const valuesSchema = z.record(z.string(), z.string().nullable());

export const riskAiProposalItemSchema: z.ZodType<RiskAiProposalItem> = z.object({
  runId: z.string(),
  itemKey: z.string(),
  kind: z.enum(['risk', 'change']),
  state: z.enum(['open', 'accepted', 'rejected', 'superseded', 'lapsed']),
  stale: z.boolean().nullable(),
  riskId: z.string().nullable(),
  unitKey: z.string().nullable(),
  fields: z.array(z.string()),
  current: valuesSchema.nullable(),
  proposed: valuesSchema,
  similarTo: z.object({
    kind: z.enum(['active', 'withdrawn', 'rejected', 'open']),
    riskId: z.string().nullable(),
    riskNumber: z.string().nullable(),
    runId: z.string().nullable(),
    itemKey: z.string().nullable(),
    score: z.number().min(0).max(1),
  }).strict().nullable(),
  aiAccept: z.boolean(),
  acceptBlocked: z.enum(['accept-not-permitted', 'accept-with-planned-control']).nullable(),
  sources: z.array(sourceCitationSchema).max(100),
  uncited: z.array(z.string().max(300)).max(5),
  suggestedControls: z.array(z.object({ controlNumber: z.string(), name: z.string(), rationale: z.string() }).strict()).max(5),
  decision: z.object({
    action: z.enum(['accepted', 'rejected', 'restored', 'superseded', 'lapsed']),
    by: personSchema.nullable(),
    at: timestampSchema,
    reason: z.string().nullable(),
    cause: z.object({
      kind: z.enum(['newer-rewrite', 'risk-withdrawn', 'assessment-not-editable']),
      runId: z.string().nullable(),
      riskId: z.string().nullable(),
    }).strict().nullable(),
  }).strict().nullable(),
  addedRisk: z.object({ riskId: z.string(), riskNumber: z.string().nullable() }).strict().nullable(),
  canUndo: z.boolean(),
}).strict();

export const riskAiProposalsSchema: z.ZodType<RiskAiProposals> = z.object({
  assessmentId: z.string(),
  editable: z.boolean(),
  openCount: countSchema,
  openByRisk: z.array(z.object({ riskId: z.string(), count: z.number().int().min(1) }).strict()),
  lastAskedAt: timestampSchema.nullable(),
  actions: z.object({ suggest: actionSchema, rewrite: actionSchema, decide: actionSchema }).strict(),
  runs: z.array(runFactsSchema).max(101),
  items: z.array(riskAiProposalItemSchema),
  jobs: z.array(riskProposalJobSchema),
}).strict();

export const riskAiProposalsResponseSchema = z.object({ data: riskAiProposalsSchema }).strict();

/* ---- Decisions (Phase 12's operation with 16-10's proposal entries; D-39, D-40) ---- */

/** AiProposalRunDecision's item: a proposed risk `s-1` to `s-8`, or a change unit `u-…`. */
export const riskProposalItemKeySchema = z.string().regex(/^(s-[1-8]|u-[a-z-]{3,40})$/);

/**
 * One decision as the analyst makes it; the service sends it as the contract's `{ target: { kind: 'proposal' } }` entry.
 * A reason goes only with `reject`, as AiProposalRunDecision says (FE4-09).
 */
const decisionTarget = { runId: z.string().trim().min(1).max(255), item: riskProposalItemKeySchema };
export const riskProposalDecisionSchema = z.discriminatedUnion('action', [
  z.object({ ...decisionTarget, action: z.literal('reject'), reason: z.string().trim().min(1).max(500).optional() }).strict(),
  z.object({ ...decisionTarget, action: z.enum(['accept', 'restore']) }).strict(),
]);

export const riskProposalDecisionsSchema = z.array(riskProposalDecisionSchema).min(1).max(200);
