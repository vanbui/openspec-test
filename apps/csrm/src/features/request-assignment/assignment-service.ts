import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type { AssignmentPerson, RequestAssignment } from './assignment-domain';
import {
  assignableAnalystListResponseSchema,
  assignableAnalystsInputSchema,
  assigneeChangeInputSchema,
  requestAssignmentResponseSchema,
  type AssigneeChangeInput,
} from './assignment-schema';

export const responseParserModule = {
  modulePath: 'features/request-assignment/assignment-service.ts',
  mode: 'parsers' as const,
  parsers: [
    {
      label: 'changeRequestAssignee',
      component: 'AssessmentRequestAssignmentResponse',
      parser: requestAssignmentResponseSchema,
    },
    {
      label: 'listAssignableAnalysts',
      component: 'AssignableAnalystListResponse',
      parser: assignableAnalystListResponseSchema,
    },
  ] as const satisfies readonly ContractResponseParser[],
};

/**
 * Picks up, assigns, reassigns or unassigns a request (Phase 13 D-05). Strapi derives the action and decides every
 * rule; a refusal comes back as its status and, for a conflict, its closed reason.
 */
export async function changeRequestAssignee(input: AssigneeChangeInput): Promise<TransportResult<RequestAssignment>> {
  let parsed: z.output<typeof assigneeChangeInputSchema>;
  try {
    parsed = assigneeChangeInputSchema.parse(input);
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/v1/assessment_requests/{requestId}/assignee', {
      params: { path: { requestId: parsed.requestId } },
      body: {
        data: {
          analyst: parsed.analyst,
          expectedAnalyst: parsed.expectedAnalyst,
          ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
        },
      },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: requestAssignmentResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('changeRequestAssignee');
    return normalizeTransportError(error);
  }
}

/**
 * The Security Analysts who may hold the request (Phase 13 D-06), by name only, at most 50, optionally searched by
 * name. Strapi decides who is eligible; a refusal comes back as its status and closed reason (OWN_REQUEST on a 403).
 */
export async function listAssignableAnalysts(requestId: string, q?: string): Promise<TransportResult<AssignmentPerson[]>> {
  let parsed: z.output<typeof assignableAnalystsInputSchema>;
  try {
    parsed = assignableAnalystsInputSchema.parse({ requestId, ...(q === undefined ? {} : { q }) });
  } catch (error) {
    return normalizeTransportError(error, 400);
  }
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/assessment_requests/{requestId}/assignable_analysts', {
      params: {
        path: { requestId: parsed.requestId },
        ...(parsed.q ? { query: { q: parsed.q } } : {}),
      },
    });
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: assignableAnalystListResponseSchema.parse(data).data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('listAssignableAnalysts');
    return normalizeTransportError(error);
  }
}
