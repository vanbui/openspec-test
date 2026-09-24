import 'server-only';
import { createStrapiClient, normalizeTransportError, type TransportResult } from '../../lib/api/transport/server-client';
import { z } from 'zod';
import type { ContractResponseParser } from '../assessments/assessment-service';

export interface ShellApplication {
  id: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseApplicationIdentifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseApplicationName(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function parseShellApplications(payload: unknown): readonly ShellApplication[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Invalid shell application response.');
  }

  return payload.data.map((item) => {
    if (!isRecord(item)) {
      throw new Error('Invalid shell application response.');
    }

    const id = parseApplicationIdentifier(item.id);
    const name = parseApplicationName(item.name);

    if (!id || !name) {
      throw new Error('Invalid shell application response.');
    }

    return { id, name };
  });
}

const shellApplicationsResponseSchema = z.unknown().superRefine((payload, context) => {
  try { parseShellApplications(payload); } catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid shell application response.' }); }
});

export const responseParserModule = {
  modulePath: 'features/shell/shell-service.ts',
  mode: 'parsers' as const,
  parsers: [{ label: 'shell.listApplications', path: '/applications', method: 'get' as const, parser: shellApplicationsResponseSchema }] as const satisfies readonly ContractResponseParser[],
};

export async function listShellApplications(): Promise<TransportResult<readonly ShellApplication[]>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/applications');

    if (error || !data) {
      return normalizeTransportError(error, response.status);
    }

    return { data: parseShellApplications(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}
