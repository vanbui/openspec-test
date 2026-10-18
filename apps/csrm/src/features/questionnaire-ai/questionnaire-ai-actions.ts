'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { TransportError } from '../../lib/api/transport/server-client';
import {
  PROPOSALS_LOAD_FAILED,
  type QuestionnaireAiDecisionResult,
  type QuestionnaireAiFailure,
  type QuestionnaireAiProposalsView,
  type QuestionnaireProposalJobView,
} from './questionnaire-ai-domain';
import { aiProposalDecisionRefusalCopy, aiProposalStartRefusalCopy, type ProposalDecisionIntent, type QuestionnaireAiRefusal } from './questionnaire-ai-refusal-copy';
import { questionnaireAiDecisionSchema } from './questionnaire-ai-schema';
import {
  decideQuestionnaireAiProposals,
  getQuestionnaireProposalJob,
  listQuestionnaireAiProposals,
  retryQuestionnaireProposalJob,
  startQuestionnaireAiProposals,
  startQuestionRewrite,
} from './questionnaire-ai-service';

/*
 * The Server Actions for the questionnaire AI proposals (Phase 15 D-02, D-35). Each validates its input strictly and
 * delegates to the typed service; a refusal comes back as its kind, its closed reason and the sentence to show (families
 * Q1 and Q2), never the served message. Every decision of one user act goes through the one batch decision action.
 * Strapi enforces who may act; nothing here is authorisation.
 */
export type QuestionnaireAiActionResult<T> = { ok: true; data: T } | ({ ok: false } & QuestionnaireAiFailure);

type Failure = { ok: false } & QuestionnaireAiFailure;

const documentIdSchema = z.string().trim().min(1).max(255);
const readInputSchema = z.object({ documentId: documentIdSchema }).strict();
/*
 * The instruction has no length cap here (D-18): the server's INSTRUCTION_TOO_LONG reaches the field with the text kept.
 * A blank instruction is none, so the server applies its default task.
 */
const instructionSchema = z.string().optional().nullable().transform((value) => (value === undefined || value === null || value.trim() === '' ? undefined : value));
const startInputSchema = z.object({ documentId: documentIdSchema, instruction: instructionSchema }).strict();
const rewriteInputSchema = z.object({ documentId: documentIdSchema, questionId: documentIdSchema, instruction: instructionSchema }).strict();
const jobInputSchema = z.object({ jobId: documentIdSchema }).strict();
const retryInputSchema = z.object({ jobId: documentIdSchema, documentId: documentIdSchema }).strict();
const decideInputSchema = z.object({
  documentId: documentIdSchema,
  decisions: z.array(questionnaireAiDecisionSchema).min(1).max(200),
  /** What the analyst did, so a refused Undo says what it would have undone; read from the first decision when absent. */
  intent: z.enum(['confirm', 'reject', 'undo-confirmation', 'undo-rejection']).optional(),
}).strict();

const reviewPath = (documentId: string): string => `/app/review/questionnaires/${encodeURIComponent(documentId)}`;

function failure(error: Pick<TransportError, 'status' | 'reason'>, copy: QuestionnaireAiRefusal): Failure {
  const { status, reason } = error;
  return { ok: false, failure: copy.kind, ...(status === undefined ? {} : { status }), ...(reason === undefined ? {} : { reason }), message: copy.text };
}

/** A refused read: a blocked refusal (a status below 500) or a failure that trying again may fix. */
function readFailure(error: Pick<TransportError, 'status' | 'reason'>): Failure {
  const retryable = error.status === undefined || error.status >= 500;
  return failure(error, { text: PROPOSALS_LOAD_FAILED, kind: retryable ? 'retryable' : 'blocked' });
}

const startFailure = (error: Pick<TransportError, 'status' | 'reason'>, instruction?: string): Failure =>
  failure(error, aiProposalStartRefusalCopy(error, instruction === undefined ? {} : { instructionLength: instruction.length }));

/* The panel reads the proposals when it opens and after each act (D-03 item 4). Nothing is revalidated: the read changes nothing. */
export async function listQuestionnaireAiProposalsAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireAiProposalsView>> {
  const parsed = readInputSchema.safeParse(input);
  if (!parsed.success) return readFailure({ status: 400 });
  const result = await listQuestionnaireAiProposals(parsed.data.documentId);
  if (result.error) return readFailure(result.error);
  return { ok: true, data: result.data };
}

/* Ask the AI for proposals across the questionnaire (D-10, D-17). */
export async function startQuestionnaireAiProposalsAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireProposalJobView>> {
  const parsed = startInputSchema.safeParse(input);
  if (!parsed.success) return startFailure({ status: 400 });
  const { documentId, instruction } = parsed.data;
  const result = await startQuestionnaireAiProposals(documentId, instruction);
  if (result.error) return startFailure(result.error, instruction);
  revalidatePath(reviewPath(documentId));
  return { ok: true, data: result.data };
}

/* Ask the AI to rewrite one question in plain language (D-11). */
export async function startQuestionRewriteAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireProposalJobView>> {
  const parsed = rewriteInputSchema.safeParse(input);
  if (!parsed.success) return startFailure({ status: 400 });
  const { documentId, questionId, instruction } = parsed.data;
  const result = await startQuestionRewrite(documentId, questionId, instruction);
  if (result.error) return startFailure(result.error, instruction);
  revalidatePath(reviewPath(documentId));
  return { ok: true, data: result.data };
}

/* Follow a job (D-16). Nothing is revalidated: the read changes nothing. */
export async function getQuestionnaireProposalJobAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireProposalJobView>> {
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return readFailure({ status: 400 });
  const result = await getQuestionnaireProposalJob(parsed.data.jobId);
  if (result.error) return readFailure(result.error);
  return { ok: true, data: result.data };
}

/* Retry a failed job as a new attempt (D-16); a refusal reads Q1, as asking again would. */
export async function retryQuestionnaireProposalJobAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireProposalJobView>> {
  const parsed = retryInputSchema.safeParse(input);
  if (!parsed.success) return startFailure({ status: 400 });
  const result = await retryQuestionnaireProposalJob(parsed.data.jobId);
  if (result.error) return startFailure(result.error);
  revalidatePath(reviewPath(parsed.data.documentId));
  return { ok: true, data: result.data };
}

function intentOf(action: 'accept' | 'reject' | 'restore'): ProposalDecisionIntent {
  if (action === 'accept') return 'confirm';
  return action === 'reject' ? 'reject' : 'undo-confirmation';
}

/*
 * Every decision on questionnaire AI proposals, one item or Reject remaining's whole batch, goes through this one action
 * (D-21, D-35): one service call per user act, applied all together or not at all, then the questionnaire page is
 * revalidated so it shows the stored state.
 */
export async function decideQuestionnaireAiProposalsAction(input: unknown): Promise<QuestionnaireAiActionResult<QuestionnaireAiDecisionResult>> {
  const parsed = decideInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, aiProposalDecisionRefusalCopy({ status: 400 }, { decision: 'confirm' }));
  const { documentId, decisions } = parsed.data;
  const decision = parsed.data.intent ?? intentOf(decisions[0]?.action ?? 'accept');
  const result = await decideQuestionnaireAiProposals(documentId, decisions);
  if (result.error) return failure(result.error, aiProposalDecisionRefusalCopy(result.error, { decision }));
  revalidatePath(reviewPath(documentId));
  return { ok: true, data: result.data };
}
