import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type {
  QuestionnaireAiDecision,
  QuestionnaireAiDecisionResult,
  QuestionnaireAiProposalsView,
  QuestionnaireProposalJobView,
} from './questionnaire-ai-domain';
import {
  questionnaireAiDecisionResponseSchema,
  questionnaireAiDecisionsSchema,
  questionnaireAiProposalsResponseSchema,
  questionnaireProposalJobResponseSchema,
} from './questionnaire-ai-schema';

/*
 * The typed API layer for the questionnaire AI proposal operations (Phase 15 D-02, D-03; AGENTS.md: no raw fetch, no
 * facade). Each function names its literal contract path through the generated client and parses the response with its
 * closed parser; a refusal crosses only as the transport's closed reason. Strapi decides who may act (a human Security
 * Analyst, never on a request they raised); nothing here is authorisation.
 */
const documentIdSchema = z.string().trim().min(1).max(255);

type ClientCall = (client: StrapiClient) => Promise<{ data?: unknown; error?: unknown; response: { status: number } }>;

/** One call: the client's response parsed, a refusal normalised, and a response outside the contract named by operation. */
async function call<T>(operation: string, request: ClientCall, parse: (value: unknown) => T): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await request(client);
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError(operation);
    return normalizeTransportError(error);
  }
}

/** The questionnaire's open and recently decided proposals, the runs' facts, the active jobs and what the analyst may do. */
export async function listQuestionnaireAiProposals(questionnaireId: string): Promise<TransportResult<QuestionnaireAiProposalsView>> {
  const id = documentIdSchema.safeParse(questionnaireId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'listQuestionnaireAiProposals',
    (client) => client.GET('/v1/questionnaires/{questionnaireId}/ai_proposals', { params: { path: { questionnaireId: id.data } } }),
    (value) => questionnaireAiProposalsResponseSchema.parse(value).data,
  );
}

const parseJob = (value: unknown): QuestionnaireProposalJobView => questionnaireProposalJobResponseSchema.parse(value).data;

/** The instruction body: an empty body when there is none, so the server applies its default task (D-17). */
const instructionBody = (instruction?: string): { instruction?: string } => (instruction === undefined ? {} : { instruction });

/** Asks the AI for proposals across the questionnaire, steered by the analyst's optional instruction (D-10, D-17). */
export async function startQuestionnaireAiProposals(questionnaireId: string, instruction?: string): Promise<TransportResult<QuestionnaireProposalJobView>> {
  const id = documentIdSchema.safeParse(questionnaireId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'startQuestionnaireAiProposals',
    (client) => client.POST('/v1/questionnaires/{questionnaireId}/ai_proposals', { params: { path: { questionnaireId: id.data } }, body: instructionBody(instruction) }),
    parseJob,
  );
}

/** Asks the AI to rewrite one question in plain language (D-11); the server applies the plain-language task. */
export async function startQuestionRewrite(questionnaireId: string, questionId: string, instruction?: string): Promise<TransportResult<QuestionnaireProposalJobView>> {
  const ids = z.object({ questionnaireId: documentIdSchema, questionId: documentIdSchema }).safeParse({ questionnaireId, questionId });
  if (!ids.success) return normalizeTransportError(undefined, 400);
  return call(
    'startQuestionRewrite',
    (client) => client.POST('/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite', { params: { path: ids.data }, body: instructionBody(instruction) }),
    parseJob,
  );
}

/** One proposal or rewrite job, as the panel follows it (D-16). */
export async function getQuestionnaireProposalJob(jobId: string): Promise<TransportResult<QuestionnaireProposalJobView>> {
  const id = documentIdSchema.safeParse(jobId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'getQuestionnaireProposalJob',
    (client) => client.GET('/v1/questionnaire_proposal_jobs/{jobId}', { params: { path: { jobId: id.data } } }),
    parseJob,
  );
}

/** Retries a failed job as a new attempt; any eligible analyst may (D-16). */
export async function retryQuestionnaireProposalJob(jobId: string): Promise<TransportResult<QuestionnaireProposalJobView>> {
  const id = documentIdSchema.safeParse(jobId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'retryQuestionnaireProposalJob',
    (client) => client.POST('/v1/questionnaire_proposal_jobs/{jobId}/retry', { params: { path: { jobId: id.data } } }),
    parseJob,
  );
}

/** Every decision of one user act, one or a batch of up to 200, in one request: applied all together or not at all (D-21, D-35). */
export async function decideQuestionnaireAiProposals(questionnaireId: string, decisions: readonly QuestionnaireAiDecision[]): Promise<TransportResult<QuestionnaireAiDecisionResult>> {
  const id = documentIdSchema.safeParse(questionnaireId);
  const parsed = questionnaireAiDecisionsSchema.safeParse(decisions);
  if (!id.success || !parsed.success) return normalizeTransportError(undefined, 400);
  return call(
    'decideQuestionnaireAiProposals',
    (client) => client.POST('/v1/questionnaires/{questionnaireId}/ai_proposal_decisions', { params: { path: { questionnaireId: id.data } }, body: { decisions: parsed.data } }),
    (value) => questionnaireAiDecisionResponseSchema.parse(value).data,
  );
}

/** An item key's pattern is narrower than the sample generator serves: the contract declares it, the generator ignores it. */
const itemKeyPaths = ['data.items.0.itemKey'];

export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'listQuestionnaireAiProposals', component: 'QuestionnaireAiProposalsResponse', parser: questionnaireAiProposalsResponseSchema, narrowedPaths: itemKeyPaths },
  { label: 'startQuestionnaireAiProposals', component: 'QuestionnaireProposalJobResponse', parser: questionnaireProposalJobResponseSchema },
  { label: 'startQuestionRewrite', component: 'QuestionnaireProposalJobResponse', parser: questionnaireProposalJobResponseSchema },
  { label: 'getQuestionnaireProposalJob', component: 'QuestionnaireProposalJobResponse', parser: questionnaireProposalJobResponseSchema },
  { label: 'retryQuestionnaireProposalJob', component: 'QuestionnaireProposalJobResponse', parser: questionnaireProposalJobResponseSchema },
  { label: 'decideQuestionnaireAiProposals', component: 'QuestionnaireAiProposalDecisionResponse', parser: questionnaireAiDecisionResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/questionnaire-ai/questionnaire-ai-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
};
