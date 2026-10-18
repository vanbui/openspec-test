'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ConflictReason } from '../../lib/api/conflict-reasons';
import { aiDecisionRefusalCopy, type AiDecisionRefusal } from '../../lib/api/refusal-copy';
import { aiProposalDecisionSchema, aiRunInputSchema, type AiRun } from './ai-assistance-schema';
import { decideAiProposals, getAiRun } from './ai-assistance-service';
import { requestFieldLabel } from './ai-provenance-domain';
import { getQuestionnaireGovernanceQuestions } from '../questionnaires/questionnaire-service';
import { answerDisplay } from '../questionnaires/questionnaire-submitted-answers';
import { getRequest } from '../requests/request-service';

export type AiRunActionResult =
  | { ok: true; data: AiRun }
  | { ok: false; status?: number; formError: string };

/* 12-UI-SPEC §2 and §13: the "What the AI used" sheet's error and permission-denied copy. */
const LOAD_FAILED = 'We couldn’t load what the AI used';
const ACCESS_DENIED = 'You don’t have access to this AI run';

/* The side sheet reads the run when it opens (D-25). Nothing is revalidated: the read changes nothing. */
export async function getAiRunAction(input: unknown): Promise<AiRunActionResult> {
  const parsed = aiRunInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, formError: LOAD_FAILED };
  const result = await getAiRun(parsed.data.runId);
  if (result.error) {
    const status = result.error.status;
    return { ok: false, ...(status === undefined ? {} : { status }), formError: status === 403 ? ACCESS_DENIED : LOAD_FAILED };
  }
  return { ok: true, data: result.data };
}

/*
 * The source a citation names (12-UI-SPEC §4.2; D-03, D-14), read through the existing analyst reads: the request
 * read for a request field, and the questionnaire's questions read for an answer. No new operation is added.
 */
export type AiSourceView =
  | { kind: 'request'; label: string; value: string | null; requestNumber: string; href: string }
  | { kind: 'answer'; questionText: string; section: string; helpText: string | null; answer: string; href: string }
  | { kind: 'missing' };
export type AiSourceActionResult = { ok: true; data: AiSourceView } | { ok: false; status?: number; failure: 'permission' | 'error' };

const REQUEST_SOURCE_FIELDS = [
  'title', 'description', 'assessmentType', 'division', 'businessUnit', 'businessPurpose',
  'businessCriticality', 'thirdPartyInvolvement', 'thirdPartyDetails', 'regulatoryRequirements',
] as const;
type RequestSourceField = typeof REQUEST_SOURCE_FIELDS[number];

const aiSourceInputSchema = z.object({
  requestId: z.string().trim().min(1).max(255),
  sourceKey: z.string().regex(/^(request\.[A-Za-z]{1,64}|answer\.[A-Za-z0-9_.:-]{1,120})$/),
}).strict();

function sourceFailure(status: number | undefined): AiSourceActionResult {
  if (status === 404) return { ok: true, data: { kind: 'missing' } };
  return { ok: false, ...(status === undefined ? {} : { status }), failure: status === 403 ? 'permission' : 'error' };
}

export async function readAiSourceAction(input: unknown): Promise<AiSourceActionResult> {
  const parsed = aiSourceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, failure: 'error' };
  const { requestId, sourceKey } = parsed.data;
  const request = await getRequest(requestId);
  if (request.error) return sourceFailure(request.error.status);
  const requestHref = `/app/review/requests/${encodeURIComponent(requestId)}`;

  if (sourceKey.startsWith('request.')) {
    const field = sourceKey.slice('request.'.length);
    if (!(REQUEST_SOURCE_FIELDS as readonly string[]).includes(field)) return { ok: true, data: { kind: 'missing' } };
    const raw = request.data[field as RequestSourceField];
    const value = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : typeof raw === 'string' && raw.trim() ? raw : null;
    return { ok: true, data: { kind: 'request', label: requestFieldLabel(sourceKey), value, requestNumber: request.data.requestNumber, href: requestHref } };
  }

  const relation = request.data.relationships?.questionnaire;
  if (relation?.availability !== 'available') return { ok: true, data: { kind: 'missing' } };
  const questions = await getQuestionnaireGovernanceQuestions(relation.documentId);
  if (questions.error) return sourceFailure(questions.error.status);
  const questionKey = sourceKey.slice('answer.'.length);
  const question = questions.data.definition.find((item) => item.questionKey === questionKey);
  if (!question) return { ok: true, data: { kind: 'missing' } };
  return { ok: true, data: {
    kind: 'answer',
    questionText: question.questionText,
    section: question.section.title,
    helpText: question.helpText ?? null,
    answer: answerDisplay(question),
    href: `/app/review/questionnaires/${encodeURIComponent(relation.documentId)}`,
  } };
}

const decideAiProposalsInputSchema = z.object({
  assessmentId: z.string().trim().min(1).max(255),
  decisions: z.array(aiProposalDecisionSchema).min(1).max(200),
}).strict();

export type DecideAiProposalsActionResult =
  | { ok: true; data: { applied: number; unchanged: number } }
  | { ok: false; status?: number; reason?: ConflictReason; formError: string; kind: AiDecisionRefusal['kind'] };

function decisionFailure(status?: number, reason?: ConflictReason): DecideAiProposalsActionResult {
  const copy = aiDecisionRefusalCopy({ ...(status === undefined ? {} : { status }), ...(reason === undefined ? {} : { reason }) });
  return { ok: false, ...(status === undefined ? {} : { status }), ...(reason === undefined ? {} : { reason }), formError: copy.text, kind: copy.kind };
}

/*
 * Every review decision on AI proposals, one field or a whole batch, goes through this one action (D-24, D-36):
 * one service call per user action, then the editor is revalidated so its markers show the stored state.
 */
export async function decideAiProposalsAction(input: unknown): Promise<DecideAiProposalsActionResult> {
  const parsed = decideAiProposalsInputSchema.safeParse(input);
  if (!parsed.success) return decisionFailure(400);
  const result = await decideAiProposals(parsed.data.assessmentId, parsed.data.decisions);
  if (result.error) return decisionFailure(result.error.status, result.error.reason);
  revalidatePath(`/app/review/assessments/${encodeURIComponent(parsed.data.assessmentId)}`);
  return { ok: true, data: result.data };
}
