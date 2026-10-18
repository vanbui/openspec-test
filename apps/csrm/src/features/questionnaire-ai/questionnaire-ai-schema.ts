import { z } from 'zod';

import type {
  QuestionnaireAiDecisionResult,
  QuestionnaireAiProposalsView,
  QuestionnaireProposalJobView,
} from './questionnaire-ai-domain';

/*
 * The closed parsers for the questionnaire AI proposal operations (Phase 15 D-02, D-03; 15-09's components in
 * docs/references/specification.json). Their bounds are exactly the contract's, so the parity guard holds in every mode;
 * only an item key's pattern is narrower (the contract sample generator does not honour patterns), and it is registered
 * as such beside the parser. A key the contract does not declare, at any level, refuses the whole response. Typed against
 * the zod-free views in questionnaire-ai-domain.ts, which client components import instead.
 */
const timestampSchema = z.iso.datetime({ offset: true });
const countSchema = z.number().int().nonnegative();
const personSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();
/** 15-02's item key: `i-1` to `i-30`. */
export const proposalItemKeySchema = z.string().regex(/^i-([1-9]|[12][0-9]|30)$/);
const operationSchema = z.enum(['questionnaire-proposals', 'question-rewrite']);

const actionSchema = z.object({ allowed: z.boolean(), reason: z.string().nullable() }).strict();

const runFactsSchema = z.object({
  runId: z.string(),
  operation: operationSchema,
  scope: z.enum(['questionnaire', 'question']),
  initiatedBy: personSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  providerName: z.string().nullable(),
  providerVersion: z.string().nullable(),
  instruction: z.string().max(500).nullable(),
  instructionSource: z.enum(['analyst', 'plain-language-preset', 'default-task']).nullable(),
  targetQuestion: z.object({ questionId: z.string().nullable(), questionText: z.string() }).strict().nullable(),
  outcome: z.enum(['items', 'no-change']),
  counts: z.object({ items: countSchema, open: countSchema }).strict(),
  adjustments: z.array(z.object({ code: z.string(), count: z.number().int().min(1) }).strict()).max(13),
  sourcesDropped: countSchema,
}).strict();

const questionValuesSchema = z.object({
  questionText: z.string(),
  helpText: z.string().nullable(),
  answerType: z.enum(['Text', 'Long text', 'Boolean', 'Single select', 'Multi select', 'Date', 'File upload']),
  choices: z.array(z.object({ value: z.string(), label: z.string() }).strict()),
  required: z.boolean(),
}).strict();

const itemSchema = z.object({
  runId: z.string(),
  itemKey: proposalItemKeySchema,
  kind: z.enum(['add', 'change', 'remove']),
  state: z.enum(['open', 'accepted', 'rejected', 'superseded', 'lapsed']),
  stale: z.boolean().nullable(),
  target: z.object({ questionId: z.string(), questionText: z.string(), available: z.boolean() }).strict().nullable(),
  current: questionValuesSchema.nullable(),
  proposed: questionValuesSchema.nullable(),
  placement: z.object({
    sectionTitle: z.string(),
    newSection: z.boolean(),
    visibility: z.object({
      controllerText: z.string().nullable(),
      operator: z.enum(['equals', 'notEquals', 'includes', 'notIncludes']),
      value: z.union([z.string(), z.boolean()]),
    }).strict().nullable(),
  }).strict().nullable(),
  rationale: z.string(),
  sources: z.array(z.object({
    kind: z.enum(['request-field', 'note', 'file', 'answered-question', 'instruction']),
    ref: z.string(),
    label: z.string(),
    note: z.object({
      documentId: z.string(),
      part: z.enum(['requestor', 'security-analyst']),
      postedAt: timestampSchema.nullable(),
    }).strict().nullable(),
  }).strict()),
  decision: z.object({
    action: z.enum(['accepted', 'rejected', 'restored', 'superseded', 'lapsed']),
    by: personSchema.nullable(),
    at: timestampSchema,
    reason: z.string().max(500).nullable(),
    edited: z.boolean(),
  }).strict().nullable(),
  canUndo: z.boolean(),
}).strict();

/** S-3: the files a CONTEXT_TOO_LARGE failure counted, as the generation job's parser reads them (14-10). */
const failureAttachmentSchema = z.object({
  documentId: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255).nullable(),
}).strict();

/** One questionnaire AI proposal or rewrite job (D-16): the job responses and the proposals read's `jobs`. */
export const questionnaireProposalJobSchema: z.ZodType<QuestionnaireProposalJobView> = z.object({
  jobId: z.string().min(1).max(255),
  questionnaireId: z.string(),
  operation: operationSchema,
  questionId: z.string().nullable(),
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

export const questionnaireAiProposalsSchema: z.ZodType<QuestionnaireAiProposalsView> = z.object({
  questionnaireId: z.string(),
  state: z.enum(['analyst-review', 'awaiting-submission', 'submitted', 'draft-in-progress', 'assessment-started']),
  openCount: countSchema,
  actions: z.object({
    start: actionSchema,
    rewrite: actionSchema,
    confirm: actionSchema,
    reject: actionSchema,
    replace: actionSchema,
  }).strict(),
  runs: z.array(runFactsSchema),
  items: z.array(itemSchema),
  jobs: z.array(questionnaireProposalJobSchema),
  fixedQuestions: z.array(z.object({ questionId: z.string(), questionText: z.string() }).strict()).nullable(),
}).strict();

export const questionnaireAiProposalsResponseSchema = z.object({ data: questionnaireAiProposalsSchema }).strict();

export const questionnaireProposalJobResponseSchema = z.object({ data: questionnaireProposalJobSchema }).strict();

export const questionnaireAiDecisionResponseSchema = z.object({
  data: z.object({ applied: countSchema, unchanged: countSchema }).strict() satisfies z.ZodType<QuestionnaireAiDecisionResult>,
}).strict();

/*
 * One decision as the contract's QuestionnaireAiProposalDecisionRequest declares it (15-07's shape): `accept` is shown
 * as Confirm, `restore` is Undo; `edits` carries Edit, then confirm's changed fields, and `reason` a rejection's.
 */
const sectionChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('existing'), key: z.string().min(1).max(120) }).strict(),
  z.object({ kind: z.literal('new'), title: z.string().min(1).max(255) }).strict(),
]);

export const questionnaireAiDecisionSchema = z.object({
  runId: z.string().min(1).max(255),
  item: proposalItemKeySchema,
  action: z.enum(['accept', 'reject', 'restore']),
  edits: z.object({
    questionText: z.string().min(1).max(65_535).optional(),
    helpText: z.string().max(2_000).nullable().optional(),
    answerType: z.enum(['Text', 'Long text', 'Boolean', 'Single select', 'Multi select', 'Date']).optional(),
    choices: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) }).strict()).min(1).max(1_000).optional(),
    required: z.boolean().optional(),
    section: sectionChoiceSchema.optional(),
  }).strict().refine((edits) => Object.keys(edits).length > 0).optional(),
  reason: z.string().min(1).max(500).optional(),
}).strict();

export const questionnaireAiDecisionsSchema = z.array(questionnaireAiDecisionSchema).min(1).max(200);
