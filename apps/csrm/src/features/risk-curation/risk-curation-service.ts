import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import { aiProposalDecisionResponseSchema } from '../ai-assistance/ai-assistance-schema';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type {
  RiskAiProposals,
  RiskCurationResult,
  RiskHistoryPage,
  RiskProposalDecision,
  RiskProposalDecisionResult,
  RiskProposalJob,
  RiskRewriteFocus,
} from './risk-curation-domain';
import {
  parseRiskHistoryPage,
  riskAiProposalsResponseSchema,
  riskCurationResponseSchema,
  riskHistoryResponseSchema,
  riskProposalDecisionsSchema,
  riskProposalJobResponseSchema,
} from './risk-curation-schema';

/*
 * The typed API layer for Phase 16's operations (D-02; AGENTS.md: no raw fetch, no facade). Each function names its
 * literal contract path through the generated client and parses the response with its closed parser; a refusal crosses
 * only as the transport's closed reason. Strapi decides who may act (a human Security Analyst, never on a request they
 * raised for the AI operations) and what a decision does; nothing here is authorisation.
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

/**
 * A withdrawal's or reinstatement's body as the contract's RiskCurationRequest declares it: the typed reason, or the
 * closed Undo flag, never both (D-09, D-11).
 */
export type RiskCurationBody =
  | { readonly riskIds: readonly string[]; readonly reason: string }
  | { readonly riskIds: readonly string[]; readonly undo: true };

const parseCuration = (value: unknown): RiskCurationResult => riskCurationResponseSchema.parse(value).data;

/* The wire body: a fresh array and exactly the declared keys, whatever object the caller passed. */
function curationBody(body: RiskCurationBody): { riskIds: string[]; reason: string } | { riskIds: string[]; undo: true } {
  return 'undo' in body ? { riskIds: [...body.riskIds], undo: true } : { riskIds: [...body.riskIds], reason: body.reason };
}

/** Withdraws the named Risks of one unreleased assessment in one transaction (D-05, D-09); `undo` is a reinstatement's Undo. */
export async function withdrawRisks(assessmentId: string, body: RiskCurationBody): Promise<TransportResult<RiskCurationResult>> {
  const id = documentIdSchema.safeParse(assessmentId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'withdrawRisks',
    (client) => client.POST('/v1/risk_assessments/{assessmentId}/risk_withdrawals', { params: { path: { assessmentId: id.data } }, body: curationBody(body) }),
    parseCuration,
  );
}

/** Reinstates the named withdrawn Risks (D-10); `undo` is a withdrawal's Undo, which records the server's fixed reason. */
export async function reinstateRisks(assessmentId: string, body: RiskCurationBody): Promise<TransportResult<RiskCurationResult>> {
  const id = documentIdSchema.safeParse(assessmentId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'reinstateRisks',
    (client) => client.POST('/v1/risk_assessments/{assessmentId}/risk_reinstatements', { params: { path: { assessmentId: id.data } }, body: curationBody(body) }),
    parseCuration,
  );
}

/** The history query the contract closes: `page` from 1 and `pageSize` 1 to 100, each optional. */
const historyQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict();

export type RiskHistoryQuery = { readonly page?: number; readonly pageSize?: number };

/** One page of a Risk's history, newest first (D-18 to D-21). */
export async function getRiskHistory(riskId: string, query: RiskHistoryQuery): Promise<TransportResult<RiskHistoryPage>> {
  const id = documentIdSchema.safeParse(riskId);
  const parsedQuery = historyQuerySchema.safeParse(query);
  if (!id.success || !parsedQuery.success) return normalizeTransportError(undefined, 400);
  return call(
    'getRiskHistory',
    (client) => client.GET('/v1/risks/{riskId}/history', { params: { path: { riskId: id.data }, query: parsedQuery.data } }),
    parseRiskHistoryPage,
  );
}

const parseJob = (value: unknown): RiskProposalJob => riskProposalJobResponseSchema.parse(value).data;

/** Asks the AI for risks the assessment is missing, steered by the analyst's optional instruction (D-24, D-30). */
export async function startRiskSuggestions(assessmentId: string, input: { readonly instruction?: string }): Promise<TransportResult<RiskProposalJob>> {
  const id = documentIdSchema.safeParse(assessmentId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  const body = input.instruction === undefined ? {} : { instruction: input.instruction };
  return call(
    'startRiskSuggestions',
    (client) => client.POST('/v1/risk_assessments/{assessmentId}/risk_suggestions', { params: { path: { assessmentId: id.data } }, body }),
    parseJob,
  );
}

/** Asks the AI to rewrite one active Risk, optionally narrowed to some of its parts (D-34 to D-38). */
export async function startRiskRewrite(
  riskId: string,
  input: { readonly instruction?: string; readonly focus?: readonly RiskRewriteFocus[] },
): Promise<TransportResult<RiskProposalJob>> {
  const id = documentIdSchema.safeParse(riskId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  const body = {
    ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
    ...(input.focus === undefined ? {} : { focus: [...input.focus] }),
  };
  return call(
    'startRiskRewrite',
    (client) => client.POST('/v1/risks/{riskId}/rewrite', { params: { path: { riskId: id.data } }, body }),
    parseJob,
  );
}

/** One suggestion or rewrite job, as the section or the Risk card follows it (D-26). */
export async function getRiskProposalJob(jobId: string): Promise<TransportResult<RiskProposalJob>> {
  const id = documentIdSchema.safeParse(jobId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'getRiskProposalJob',
    (client) => client.GET('/v1/risk_proposal_jobs/{jobId}', { params: { path: { jobId: id.data } } }),
    parseJob,
  );
}

/** Retries a failed job as the retrying analyst's new run (D-26). */
export async function retryRiskProposalJob(jobId: string): Promise<TransportResult<RiskProposalJob>> {
  const id = documentIdSchema.safeParse(jobId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'retryRiskProposalJob',
    (client) => client.POST('/v1/risk_proposal_jobs/{jobId}/retry', { params: { path: { jobId: id.data } } }),
    parseJob,
  );
}

/** The assessment's open and recently decided AI proposals, the runs' facts, the jobs and what the analyst may do (D-41). */
export async function listRiskAiProposals(assessmentId: string): Promise<TransportResult<RiskAiProposals>> {
  const id = documentIdSchema.safeParse(assessmentId);
  if (!id.success) return normalizeTransportError(undefined, 400);
  return call(
    'listRiskAiProposals',
    (client) => client.GET('/v1/risk_assessments/{assessmentId}/ai_proposals', { params: { path: { assessmentId: id.data } } }),
    (value) => riskAiProposalsResponseSchema.parse(value).data,
  );
}

/**
 * Every decision of one user act, one or a batch of up to 200, in one request on Phase 12's decision operation, as
 * 16-10's proposal entries: applied all together or not at all (D-39, D-40). The response is read with 12-12's parser.
 */
export async function decideRiskProposals(assessmentId: string, decisions: readonly RiskProposalDecision[]): Promise<TransportResult<RiskProposalDecisionResult>> {
  const id = documentIdSchema.safeParse(assessmentId);
  const parsed = riskProposalDecisionsSchema.safeParse(decisions);
  if (!id.success || !parsed.success) return normalizeTransportError(undefined, 400);
  const entries = parsed.data.map((decision) => ({
    target: { kind: 'proposal' as const, runId: decision.runId, item: decision.item },
    action: decision.action,
    ...(decision.action === 'reject' && decision.reason !== undefined ? { reason: decision.reason } : {}),
  }));
  return call(
    'decideRiskProposals',
    (client) => client.POST('/v1/risk_assessments/{assessmentId}/ai_proposal_decisions', { params: { path: { assessmentId: id.data } }, body: { decisions: entries } }),
    (value) => aiProposalDecisionResponseSchema.parse(value).data,
  );
}

export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'withdrawRisks', component: 'RiskCurationResponse', parser: riskCurationResponseSchema },
  { label: 'reinstateRisks', component: 'RiskCurationResponse', parser: riskCurationResponseSchema },
  { label: 'getRiskHistory', component: 'RiskHistoryResponse', parser: riskHistoryResponseSchema },
  { label: 'startRiskSuggestions', component: 'RiskProposalJobResponse', parser: riskProposalJobResponseSchema },
  { label: 'startRiskRewrite', component: 'RiskProposalJobResponse', parser: riskProposalJobResponseSchema },
  { label: 'getRiskProposalJob', component: 'RiskProposalJobResponse', parser: riskProposalJobResponseSchema },
  { label: 'retryRiskProposalJob', component: 'RiskProposalJobResponse', parser: riskProposalJobResponseSchema },
  { label: 'listRiskAiProposals', component: 'RiskAiProposalsResponse', parser: riskAiProposalsResponseSchema },
  { label: 'decideRiskProposals', component: 'AiProposalDecisionResponse', parser: aiProposalDecisionResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/risk-curation/risk-curation-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
};
