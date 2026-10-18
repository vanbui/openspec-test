import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ContractResponseParser } from '../assessments/assessment-service';
import { aiProposalDecisionResponseSchema, aiProposalDecisionSchema, aiRunResponseSchema, type AiProposalDecision, type AiRun } from './ai-assistance-schema';

const runIdSchema = z.string().trim().min(1).max(255);

/* D-25: a human Security Analyst reads what an AI run used; Strapi refuses everyone else. */
export async function getAiRun(runId: string): Promise<TransportResult<AiRun>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/ai_runs/{runId}', {
      params: { path: { runId: runIdSchema.parse(runId) } },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: aiRunResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('getAiRun');
    return normalizeTransportError(error);
  }
}

export async function decideAiProposals(assessmentId: string, decisions: AiProposalDecision[]): Promise<TransportResult<{ applied: number; unchanged: number }>> {
  try {
    const parsed = z.array(aiProposalDecisionSchema).min(1).max(200).parse(decisions);
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/risk_assessments/{assessmentId}/ai_proposal_decisions', {
      params: { path: { assessmentId: runIdSchema.parse(assessmentId) } },
      body: { decisions: parsed },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: aiProposalDecisionResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('decideAiProposals');
    return normalizeTransportError(error);
  }
}

export const contractResponseParsers: readonly ContractResponseParser[] = [
  // The digest patterns (the prompt's, and each used file's, Phase 14 D-35) are enforced client-side too; the contract
  // sample generator does not honour patterns.
  { label: 'getAiRun', component: 'AiRunResponse', parser: aiRunResponseSchema, narrowedPaths: ['data.contextSummary.digest', 'data.contextSummary.attachments.included.0.sha256'] },
  { label: 'decideAiProposals', component: 'AiProposalDecisionResponse', parser: aiProposalDecisionResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/ai-assistance/ai-assistance-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
};
