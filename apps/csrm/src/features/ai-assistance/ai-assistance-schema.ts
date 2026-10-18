import { z } from 'zod';

/*
 * The closed parsers for the AI run read. Their bounds are exactly the contract's (AiRun and
 * AiRunContextSummary in docs/references/specification.json), so the parity guard holds in every mode;
 * only the digest's pattern is narrower, and it is registered as such beside the parser.
 */
const idSchema = z.string().min(1);
const timestampSchema = z.iso.datetime({ offset: true });
const countSchema = z.number().int().nonnegative();
// Phase 15 D-19: questionnaire proposals and the plain-language rewrite of one question join Phase 12's two.
// Phase 16 D-25: "Suggest more risks" and "Rewrite this risk".
const operationSchema = z.enum(['questionnaire-generation', 'assessment-draft', 'questionnaire-proposals', 'question-rewrite', 'risk-suggestions', 'risk-rewrite']);

/*
 * Phase 13 D-28 (G-3): the request notes a run used, each by documentId, part, sequence, posting time and length, never
 * its text, so a note entry with any other key (a `body`) is refused. The server serves a v1 summary with none.
 */
export const aiRunContextNoteSchema = z.object({
  documentId: idSchema,
  part: z.enum(['requestor', 'security-analyst']),
  sequence: z.number().int().min(1),
  postedAt: timestampSchema,
  characters: countSchema,
}).strict();
export const aiRunContextNotesSchema = z.object({
  included: z.array(aiRunContextNoteSchema).max(50),
  marked: countSchema.max(50),
  bound: z.literal(50),
}).strict();
export type AiRunContextNotes = z.infer<typeof aiRunContextNotesSchema>;

/*
 * Phase 14 D-35 (G-3): the request files a run used, each by documentId, digest, type, part and counts, never its text,
 * so an entry with any other key (a `text`) is refused. fileName, requestId and removed are what the attachment record
 * says when the run is read (null name and request when it is gone). The server serves a v1 or v2 summary with none.
 */
export const aiRunContextAttachmentSchema = z.object({
  documentId: idSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  type: z.enum(['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt']),
  part: z.enum(['requestor', 'security-analyst']),
  charactersSent: countSchema.max(20_000),
  charactersAvailable: countSchema,
  truncated: z.boolean(),
  fileName: z.string().min(1).max(255).nullable(),
  requestId: idSchema.nullable(),
  removed: z.boolean(),
}).strict();
export const aiRunContextAttachmentsSchema = z.object({
  included: z.array(aiRunContextAttachmentSchema).max(20),
  bound: z.union([z.literal(30_000), z.literal(60_000)]),
}).strict();
export type AiRunContextAttachments = z.infer<typeof aiRunContextAttachmentsSchema>;

/*
 * Phase 15 D-14 (G-3): what a questionnaire proposal or rewrite run was shown of the questionnaire, as counts and closed
 * values only. The server serves a v1 to v3 summary, and a questionnaire generation or draft summary, with it null.
 */
export const aiRunContextQuestionnaireSchema = z.object({
  scope: z.enum(['questionnaire', 'question']),
  questionsOffered: countSchema.max(150),
  answered: countSchema.max(150),
  answerContent: z.enum(['included', 'withheld']),
  openItemsListed: countSchema.max(200),
  rejectedItemsListed: countSchema.max(100),
  rejectedItemsTotal: countSchema,
  removedListed: countSchema.max(200),
}).strict();
export type AiRunContextQuestionnaire = z.infer<typeof aiRunContextQuestionnaireSchema>;
/* Phase 15 D-17 (G-3): what steered the run, by its source only; never the instruction's text (that is the run's own). */
export const aiRunContextInstructionSchema = z.object({
  source: z.enum(['analyst', 'plain-language-preset', 'default-task']),
}).strict();
export type AiRunContextInstruction = z.infer<typeof aiRunContextInstructionSchema>;
/*
 * Phase 16 D-25 and D-31 (G-3): what a risk proposal run listed, as counts and closed values only: never a Risk's text,
 * a reason or the instruction. The server serves a v1 to v4 summary, and any other operation's, with it null.
 */
const listedCountSchema = countSchema.max(200);
export const aiRunContextRiskProposalsSchema = z.object({
  scope: z.enum(['assessment', 'risk']),
  risksListed: listedCountSchema,
  withdrawnListed: listedCountSchema,
  rejectedListed: listedCountSchema,
  openListed: listedCountSchema,
  controlsListed: countSchema.nullable(),
  focus: z.array(z.enum(['statement', 'ratings', 'treatment'])).min(1).max(3)
    .refine((parts) => new Set(parts).size === parts.length)
    .nullable(),
}).strict();
export type AiRunContextRiskProposals = z.infer<typeof aiRunContextRiskProposalsSchema>;

/*
 * The closed summary of the context an AI run used (Phase 12 D-07; v2, Phase 13 D-28, adds the notes it used; v3,
 * Phase 14 D-35, the files; v4, Phase 15 D-19, the questionnaire and instruction sections; v5, Phase 16 D-25, the risk
 * proposal section): no Requestor, note, file or Risk free text, by construction.
 */
export const aiRunContextSummarySchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  operation: operationSchema,
  request: z.object({
    fields: z.array(z.object({ key: idSchema, label: idSchema, characters: countSchema }).strict()),
  }).strict(),
  questions: z.object({
    included: countSchema,
    answered: countSchema,
    sources: z.array(z.object({ key: idSchema, label: z.string().min(1).max(300), section: idSchema }).strict()),
  }).strict(),
  systems: z.array(z.object({ key: idSchema, documentId: idSchema, name: idSchema }).strict()),
  assets: z.array(z.object({ key: idSchema, documentId: idSchema, name: idSchema, classification: z.string().nullable() }).strict()),
  riskTypes: z.object({ offered: countSchema, total: countSchema, names: z.array(idSchema).max(60) }).strict(),
  controlCandidates: z.object({ offered: countSchema, total: countSchema }).strict(),
  classification: z.object({
    level: idSchema,
    source: z.enum(['assets', 'default']),
    ceiling: z.string().nullable(),
    decision: z.enum(['allowed', 'refused']),
  }).strict(),
  characters: countSchema,
  budget: countSchema,
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  notes: aiRunContextNotesSchema,
  attachments: aiRunContextAttachmentsSchema,
  questionnaire: aiRunContextQuestionnaireSchema.nullable(),
  instruction: aiRunContextInstructionSchema.nullable(),
  riskProposals: aiRunContextRiskProposalsSchema.nullable(),
}).strict();
export type AiRunContextSummary = z.infer<typeof aiRunContextSummarySchema>;

/* D-25: what an AI run used and how it ended. Never the proposal. */
export const aiRunSchema = z.object({
  documentId: idSchema,
  operation: operationSchema,
  status: z.enum(['running', 'completed', 'failed', 'interrupted']),
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  initiatedBy: z.object({ documentId: z.string(), displayName: z.string() }).strict().nullable(),
  providerName: idSchema,
  providerVersion: idSchema,
  instruction: z.string().nullable(),
  contextSummary: aiRunContextSummarySchema.nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  targets: z.object({
    assessmentRequest: idSchema.nullable(),
    questionnaire: idSchema.nullable(),
    assessment: idSchema.nullable(),
    risk: idSchema.nullable(),
  }).strict(),
}).strict();
export type AiRun = z.infer<typeof aiRunSchema>;

export const aiRunResponseSchema = z.object({ data: aiRunSchema }).strict();

export const aiRunInputSchema = z.object({ runId: z.string().trim().min(1).max(255) }).strict();

export const aiProposalDecisionResponseSchema = z.object({
  data: z.object({ applied: countSchema, unchanged: countSchema }).strict(),
}).strict();

export const aiProposalDecisionSchema = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('assessment') }).strict(),
    z.object({ kind: z.literal('risk'), riskId: idSchema.max(255) }).strict(),
  ]),
  action: z.enum(['accept', 'dismiss', 'restore']),
  fields: z.array(idSchema).min(1).max(20).optional(),
  suggestion: idSchema.max(255).optional(),
}).strict();
export type AiProposalDecision = z.infer<typeof aiProposalDecisionSchema>;
