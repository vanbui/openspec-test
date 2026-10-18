import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, listExportParams, type ExportResult, type ListExportOptions } from '../exports/export-file-check';
import type { ContractResponseParser } from '../assessments/assessment-service';
import {
  alertListQuerySchema,
  alertListResponseSchema,
  alertSummaryResponseSchema,
  parseAlertListPayload,
  parseAlertSummaryPayload,
  type AlertListPayload,
  type AlertListQuery,
  type AlertSummary,
} from './alert-schema';

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

/** Both alert reads are parsed closed, with no narrowing, and guarded against the published contract. */
export const responseParserModule = {
  modulePath: 'features/alerts/alert-service.ts',
  mode: 'parsers' as const,
  parsers: [
    {
      label: 'alerts.listAlerts',
      component: 'AlertListResponse',
      parser: alertListResponseSchema,
      // The contract leaves an alert's free-text source title unbounded: a
      // Strapi text or string attribute carries no server-enforced maximum,
      // so the contract cannot declare one (D-02). The client caps free text
      // at 65,535 characters as every feature schema does; registered so the
      // parity guard's boundary mode sees the narrowing (D-05).
      narrowedPaths: ['data.0.source.title'],
    },
    { label: 'alerts.getAlertSummary', component: 'AlertSummaryResponse', parser: alertSummaryResponseSchema },
  ] as const satisfies readonly ContractResponseParser[],
  // Phase 19 D-19: the alerts export is a file, checked by the shared validator's export rule.
  fileResponses: [
    { label: 'alerts.exportAlerts', path: '/v1/alerts/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
  ],
};

async function request<T>(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
  parse: (payload: unknown) => T,
  operation: string,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    // A refusal keeps its status, so a 403 reaches the screen as permission denied.
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError(operation);
    return normalizeTransportError(error);
  }
}

/** One page of the analyst's derived alerts, most urgent first (D-12). */
export async function listAlerts(input: AlertListQuery): Promise<TransportResult<AlertListPayload>> {
  const query = alertListQuerySchema.parse(input);
  return request(
    (client) => client.GET('/v1/alerts', {
      params: {
        query: {
          ...(query.kinds ? { kind: [...query.kinds] } : {}),
          ...(query.urgency ? { urgency: query.urgency } : {}),
          page: query.page,
          pageSize: query.pageSize,
        },
      },
    }),
    parseAlertListPayload,
    'alerts.listAlerts',
  );
}

/** Every current alert counted by kind and by urgency over the list's own predicate. */
export async function getAlertSummary(): Promise<TransportResult<AlertSummary>> {
  return request((client) => client.GET('/v1/alerts/summary'), parseAlertSummaryPayload, 'alerts.getAlertSummary');
}

/** The alert list's filters as its export takes them: every page (D-13), so no page and no page size. */
export type AlertExportQuery = Omit<AlertListQuery, 'page' | 'pageSize'>;

/** Exports the analyst's alerts (D-04) as the kind and urgency filters choose them, with the shared export-file check. */
export async function exportAlerts(input: ListExportOptions & { query: AlertExportQuery }): Promise<ExportResult> {
  const { kinds, urgency } = input.query;
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/alerts/export', {
      params: { query: { ...(kinds ? { kind: [...kinds] } : {}), ...(urgency ? { urgency } : {}), ...listExportParams(input) } },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}
