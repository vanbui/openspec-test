import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ContractResponseParser } from '../assessments/assessment-service';
import { currentUserAccessResponseSchema, parseCurrentUserAccessPayload, type CurrentUserAccess } from './access-schema';

export const responseParserModule = {
  modulePath: 'features/access/access-service.ts',
  mode: 'parsers' as const,
  parsers: [
    {
      label: 'access.getCurrentUserAccess',
      component: 'CurrentUserAccessResponse',
      parser: currentUserAccessResponseSchema,
    },
  ] as const satisfies readonly ContractResponseParser[],
};

/** The caller's own effective access, as Strapi resolves it for the forwarded identity. */
export async function getCurrentUserAccess(): Promise<TransportResult<CurrentUserAccess>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/me/access');
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parseCurrentUserAccessPayload(data), error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError('access.getCurrentUserAccess');
    return normalizeTransportError(error);
  }
}
