'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { TransportError } from '../../lib/api/transport/server-client';
import {
  curationReasonError,
  JOB_STATUS_UNAVAILABLE,
  PROPOSALS_LOAD_FAILED,
  RISK_REWRITE_FOCUS,
  type CurationAct,
  type RiskAiProposals,
  type RiskCurationFailure,
  type RiskCurationResult,
  type RiskDecisionIntent,
  type RiskHistoryPage,
  type RiskProposalDecisionResult,
  type RiskProposalJob,
} from './risk-curation-domain';
import { riskAiStartRefusal, riskCurationRefusal, riskDecisionRefusal, type RiskRefusal } from './risk-curation-refusal-copy';
import { riskProposalDecisionSchema } from './risk-curation-schema';
import {
  decideRiskProposals,
  getRiskHistory,
  getRiskProposalJob,
  listRiskAiProposals,
  reinstateRisks,
  retryRiskProposalJob,
  startRiskRewrite,
  startRiskSuggestions,
  withdrawRisks,
  type RiskCurationBody,
} from './risk-curation-service';

/*
 * The Server Actions for Phase 16's acts (D-02, D-11, D-39): one per user act. Each validates its input with a closed
 * schema, calls one typed service function, and returns the data or the refusal's kind, closed reason and sentence
 * (family R), never the served message. An act that changes something revalidates the assessment page, and a curation
 * or decision act the Risk Register paths it changes; a read revalidates nothing. Every decision of one user act goes
 * through the one batch decision action, because Next dispatches Server Actions one at a time (16-RESEARCH Pattern 5).
 * Strapi enforces who may act and re-validates every input; nothing here is authorisation.
 */
export type RiskCurationActionResult<T> = { ok: true; data: T } | ({ ok: false } & RiskCurationFailure);

type Failure = { ok: false } & RiskCurationFailure;

const documentIdSchema = z.string().trim().min(1).max(255);
/** The contract's RiskCurationRequest bounds: 1 to 200 distinct Risk ids. */
const riskIdsSchema = z.array(documentIdSchema).min(1).max(200).refine((ids) => new Set(ids).size === ids.length);
const curationInputSchema = z.object({ assessmentId: documentIdSchema, riskIds: riskIdsSchema, reason: z.string() }).strict();
const undoInputSchema = z.object({ assessmentId: documentIdSchema, riskIds: riskIdsSchema }).strict();
const historyInputSchema = z.object({
  riskId: documentIdSchema,
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict();
/* A blank instruction is none, so the server applies its default task (Phase 15 D-17). */
const instructionSchema = z.string().optional().nullable().transform((value) => (value === undefined || value === null || value.trim() === '' ? undefined : value));
const INSTRUCTION_MAX_LENGTH = 500;
const suggestionsInputSchema = z.object({ assessmentId: documentIdSchema, instruction: instructionSchema }).strict();
const rewriteInputSchema = z.object({
  assessmentId: documentIdSchema,
  riskId: documentIdSchema,
  instruction: instructionSchema,
  focus: z.array(z.enum(RISK_REWRITE_FOCUS)).min(1).max(3).refine((parts) => new Set(parts).size === parts.length).optional(),
}).strict();
const jobInputSchema = z.object({ jobId: documentIdSchema }).strict();
const retryInputSchema = z.object({ assessmentId: documentIdSchema, jobId: documentIdSchema }).strict();
const proposalsInputSchema = z.object({ assessmentId: documentIdSchema }).strict();
const decideInputSchema = z.object({
  assessmentId: documentIdSchema,
  decisions: z.array(riskProposalDecisionSchema).min(1).max(200),
  /** What the analyst did, so a refused Undo says what it would have undone; read from the first decision when absent. */
  intent: z.enum(['add', 'confirm', 'reject', 'undo-confirmation', 'undo-rejection']).optional(),
  /** The Risk and the change's label the refusal names (R3), when the act is about one. */
  riskNumber: z.string().trim().min(1).max(255).optional(),
  label: z.string().trim().min(1).max(255).optional(),
}).strict();

const NOT_IN_CURRENT_STATE: RiskRefusal = { message: 'This change can’t be made in the assessment’s current state.', kind: 'blocked' };

function failure(error: Pick<TransportError, 'status' | 'reason'>, copy: RiskRefusal): Failure {
  const { status, reason } = error;
  return {
    ok: false,
    kind: copy.kind,
    ...(status === undefined ? {} : { status }),
    ...(reason === undefined ? {} : { reason }),
    message: copy.message,
    ...(copy.detail === undefined ? {} : { detail: copy.detail }),
    ...(copy.field === undefined ? {} : { field: copy.field }),
  };
}

/** A refused read: blocked below 500, retryable on a failure that trying again may fix. */
function readFailure(error: Pick<TransportError, 'status' | 'reason'>, message: string): Failure {
  const retryable = error.status === undefined || error.status >= 500;
  return failure(error, { message, kind: retryable ? 'retryable' : 'blocked' });
}

const assessmentPath = (assessmentId: string): string => `/app/review/assessments/${encodeURIComponent(assessmentId)}`;

/*
 * A withdrawal or reinstatement changes the assessment page, the review list's Risk counts and the Risk Register's
 * rows and each Risk's detail (D-08, D-13).
 */
function revalidateCuration(assessmentId: string, riskIds: readonly string[]): void {
  revalidatePath(assessmentPath(assessmentId));
  revalidatePath('/app/review/assessments');
  revalidatePath('/app/risks');
  for (const riskId of riskIds) revalidatePath(`/app/risks/${encodeURIComponent(riskId)}`);
}

type CurationService = (assessmentId: string, body: RiskCurationBody) => ReturnType<typeof withdrawRisks>;

const curationService = (act: CurationAct): CurationService => (act === 'withdraw' ? withdrawRisks : reinstateRisks);

/* A typed-reason withdrawal or reinstatement: the reason is checked before anything is sent, then sent trimmed. */
async function curate(act: CurationAct, input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  const parsed = curationInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, NOT_IN_CURRENT_STATE);
  const { assessmentId, riskIds } = parsed.data;
  const fieldError = curationReasonError(act, parsed.data.reason);
  if (fieldError) return failure({ status: 400 }, { message: fieldError, kind: 'field' });
  const reason = parsed.data.reason.trim();
  const result = await curationService(act)(assessmentId, { riskIds, reason });
  if (result.error) return failure(result.error, riskCurationRefusal(result.error, act, { reasonLength: reason.length }));
  revalidateCuration(assessmentId, riskIds);
  return { ok: true, data: result.data };
}

/* An Undo sends the closed flag and never a reason (D-11, research Pitfall 5): the server restores the reason itself. */
async function undo(act: CurationAct, input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  const parsed = undoInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, NOT_IN_CURRENT_STATE);
  const { assessmentId, riskIds } = parsed.data;
  const result = await curationService(act)(assessmentId, { riskIds, undo: true });
  if (result.error) return failure(result.error, riskCurationRefusal(result.error, act, { undo: true }));
  revalidateCuration(assessmentId, riskIds);
  return { ok: true, data: result.data };
}

/* Withdraw risks with the analyst's reason (D-05, D-09; UI-SPEC §6.1). */
export async function withdrawRisksAction(input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  return curate('withdraw', input);
}

/* Reinstate withdrawn risks with the analyst's reason (D-10; UI-SPEC §6.2). */
export async function reinstateRisksAction(input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  return curate('reinstate', input);
}

/* Undo a withdrawal: reinstate with the closed undo flag (D-11; UI-SPEC §6.1). */
export async function undoWithdrawalAction(input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  return undo('reinstate', input);
}

/* Undo a reinstatement: withdraw again with the closed undo flag, restoring the earlier reason (UI-D7; §6.2). */
export async function undoReinstatementAction(input: unknown): Promise<RiskCurationActionResult<RiskCurationResult>> {
  return undo('withdraw', input);
}

/* One page of a Risk's history when the sheet opens or loads older changes (D-21). Nothing is revalidated. */
export async function readRiskHistoryAction(input: unknown): Promise<RiskCurationActionResult<RiskHistoryPage>> {
  const parsed = historyInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, riskCurationRefusal({ status: 400 }, 'history'));
  const { riskId, page, pageSize } = parsed.data;
  const result = await getRiskHistory(riskId, { ...(page === undefined ? {} : { page }), ...(pageSize === undefined ? {} : { pageSize }) });
  if (result.error) return failure(result.error, riskCurationRefusal(result.error, 'history'));
  return { ok: true, data: result.data };
}

/* The instruction's length rule, checked as the server checks it, so the field shows Q1's error with nothing sent. */
function instructionTooLong(instruction: string | undefined): Failure | null {
  if (instruction === undefined || instruction.length <= INSTRUCTION_MAX_LENGTH) return null;
  const error = { status: 400, reason: 'INSTRUCTION_TOO_LONG' as const };
  return failure(error, riskAiStartRefusal(error, { instructionLength: instruction.length }));
}

/* Suggest more risks, with the analyst's optional instruction (D-24, D-30; UI-SPEC §2.2). */
export async function startRiskSuggestionsAction(input: unknown): Promise<RiskCurationActionResult<RiskProposalJob>> {
  const parsed = suggestionsInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, riskAiStartRefusal({ status: 400 }, { operation: 'suggest' }));
  const { assessmentId, instruction } = parsed.data;
  const tooLong = instructionTooLong(instruction);
  if (tooLong) return tooLong;
  const result = await startRiskSuggestions(assessmentId, instruction === undefined ? {} : { instruction });
  if (result.error) return failure(result.error, riskAiStartRefusal(result.error, { operation: 'suggest', ...(instruction === undefined ? {} : { instructionLength: instruction.length }) }));
  revalidatePath(assessmentPath(assessmentId));
  return { ok: true, data: result.data };
}

/* Rewrite this risk, with an optional instruction and the parts to rewrite (D-34 to D-38; UI-SPEC §4.1). */
export async function startRiskRewriteAction(input: unknown): Promise<RiskCurationActionResult<RiskProposalJob>> {
  const parsed = rewriteInputSchema.safeParse(input);
  if (!parsed.success) {
    /* FE4-09: no part chosen is §4.1's field error (the contract's `minItems: 1`); any other malformed input is R2's 400. */
    const noPart = parsed.error.issues.some((issue) => issue.code === 'too_small' && issue.path.length === 1 && issue.path[0] === 'focus');
    return failure({ status: 400 }, riskAiStartRefusal({ status: 400 }, noPart ? { operation: 'rewrite' } : {}));
  }
  const { assessmentId, riskId, instruction, focus } = parsed.data;
  const tooLong = instructionTooLong(instruction);
  if (tooLong) return tooLong;
  const result = await startRiskRewrite(riskId, { ...(instruction === undefined ? {} : { instruction }), ...(focus === undefined ? {} : { focus }) });
  if (result.error) return failure(result.error, riskAiStartRefusal(result.error, { operation: 'rewrite', ...(instruction === undefined ? {} : { instructionLength: instruction.length }) }));
  revalidatePath(assessmentPath(assessmentId));
  return { ok: true, data: result.data };
}

/* Follow a job (D-26). Nothing is revalidated: the read changes nothing. */
export async function readRiskProposalJobAction(input: unknown): Promise<RiskCurationActionResult<RiskProposalJob>> {
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return readFailure({ status: 400 }, JOB_STATUS_UNAVAILABLE);
  const result = await getRiskProposalJob(parsed.data.jobId);
  if (result.error) return readFailure(result.error, JOB_STATUS_UNAVAILABLE);
  return { ok: true, data: result.data };
}

/* Retry a failed job as the retrying analyst's new run (D-26); a refusal reads R2, as asking again would. */
export async function retryRiskProposalJobAction(input: unknown): Promise<RiskCurationActionResult<RiskProposalJob>> {
  const parsed = retryInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, riskAiStartRefusal({ status: 409 }));
  const result = await retryRiskProposalJob(parsed.data.jobId);
  if (result.error) return failure(result.error, riskAiStartRefusal(result.error));
  revalidatePath(assessmentPath(parsed.data.assessmentId));
  return { ok: true, data: result.data };
}

/* The section reads the proposals when it opens and after each act (D-41). Nothing is revalidated. */
export async function readRiskAiProposalsAction(input: unknown): Promise<RiskCurationActionResult<RiskAiProposals>> {
  const parsed = proposalsInputSchema.safeParse(input);
  if (!parsed.success) return readFailure({ status: 400 }, PROPOSALS_LOAD_FAILED);
  const result = await listRiskAiProposals(parsed.data.assessmentId);
  if (result.error) return readFailure(result.error, PROPOSALS_LOAD_FAILED);
  return { ok: true, data: result.data };
}

function intentOf(action: 'accept' | 'reject' | 'restore'): RiskDecisionIntent {
  if (action === 'accept') return 'confirm';
  return action === 'reject' ? 'reject' : 'undo-confirmation';
}

/*
 * Every decision on Phase 16 proposals, one item or a Confirm all or Reject remaining batch, goes through this one action
 * (D-39, D-40): one service call per user act, applied all together or not at all, then the assessment page and the Risk
 * Register are revalidated so they show the stored state (an added risk, a confirmed change, readiness).
 */
export async function decideRiskProposalsAction(input: unknown): Promise<RiskCurationActionResult<RiskProposalDecisionResult>> {
  const parsed = decideInputSchema.safeParse(input);
  if (!parsed.success) return failure({ status: 400 }, riskDecisionRefusal({ status: 400 }));
  const { assessmentId, decisions, riskNumber, label } = parsed.data;
  const intent = parsed.data.intent ?? intentOf(decisions[0]?.action ?? 'accept');
  const result = await decideRiskProposals(assessmentId, decisions);
  if (result.error) {
    return failure(result.error, riskDecisionRefusal(result.error, { intent, ...(riskNumber === undefined ? {} : { riskNumber }), ...(label === undefined ? {} : { label }) }));
  }
  revalidatePath(assessmentPath(assessmentId));
  revalidatePath('/app/review/assessments');
  revalidatePath('/app/risks');
  return { ok: true, data: result.data };
}
