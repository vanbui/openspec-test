import 'server-only';

import {
  createStrapiClient,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ExportFileFormat } from '../../lib/files/file-response';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, type ExportResult } from '../exports/export-file-check';
import {
  parseRiskOwnerSearch,
  parseRiskDetailPayload,
  parseRiskPickerPayload,
  parseRiskRegisterPayload,
  riskDetailPayloadSchema,
  riskRegisterPayloadSchema,
  serializeRiskRegisterQuery,
  type RiskPickerKind,
  type RiskPickerOption,
  type RiskDetail,
  type RiskRegisterPayload,
  type RiskRegisterQuery,
} from './risk-schema';
import type { ContractResponseParser } from '../assessments/assessment-service';

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

/*
 * The guard reads the closed schemas parseRiskRegisterPayload and
 * parseRiskDetailPayload use, so every rejection keeps the path of the field
 * that caused it (G1).
 */
export const responseParserModule = {
  modulePath: 'features/risks/risk-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'risks.listRiskRegister', component: 'RiskRegisterResponse', parser: riskRegisterPayloadSchema },
    { label: 'risks.getRiskDetail', component: 'RiskDetailResponse', parser: riskDetailPayloadSchema },
  ] as const satisfies readonly ContractResponseParser[],
  // Phase 19 D-19: the register export is a file, checked by the shared validator's export rule instead of a zod parser.
  fileResponses: [
    {
      label: 'risks.exportRiskRegister',
      path: '/v1/risks/export',
      method: 'get' as const,
      contentTypes: EXPORT_FILE_CONTENT_TYPES,
    },
  ],
};

async function request<T>(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
  parse: (payload: unknown) => T,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}

export async function listRiskRegister(query: RiskRegisterQuery): Promise<TransportResult<RiskRegisterPayload>> {
  const canonical = serializeRiskRegisterQuery(query);
  return request(
    (client) => client.GET('/v1/risks', { params: { query: canonical } }),
    parseRiskRegisterPayload,
  );
}

export async function getRiskDetail(riskId: string): Promise<TransportResult<RiskDetail>> {
  return request(
    (client) => client.GET('/v1/risks/{riskId}', {
      params: { path: { riskId } },
    }),
    parseRiskDetailPayload,
  );
}

function pickerRequest(
  kind: RiskPickerKind,
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return request(invoke, (payload) => parseRiskPickerPayload(kind, payload));
}

/*
 * D-32 and UAT-048: the Related assessment picker searches on the server, which matches the assessment number, the
 * summary or the request title, so an assessment beyond the first page is found by any of them.
 */
export function listRiskRegisterAssessments(search?: string): Promise<TransportResult<readonly RiskPickerOption[]>> {
  const q = search === undefined ? undefined : parseRiskOwnerSearch(search);
  return pickerRequest('assessments', (client) => client.GET('/v1/risk_assessments', {
    params: { query: { ...(q ? { q } : {}), pageSize: 25 } },
  }));
}

export function listRiskRegisterRiskTypes(): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('riskTypes', (client) => client.GET('/v1/risk_types'));
}

export function listRiskRegisterControls(): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('controls', (client) => client.GET('/v1/controls'));
}

export function searchRiskRegisterOwners(search: string): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('owners', (client) => client.GET('/v1/users', {
    params: { query: { search: parseRiskOwnerSearch(search) } },
  }));
}

const inventoryQuery = {
  sort: 'name:asc' as const,
  page: 1,
  pageSize: 100 as const,
};

function inventorySearchQuery(search: string) {
  return {
    q: parseRiskOwnerSearch(search),
    sort: 'name:asc' as const,
    page: 1,
    pageSize: 25 as const,
  };
}

export function listRiskRegisterSystems(): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('systems', (client) => client.GET('/v1/information_systems', {
    params: { query: inventoryQuery },
  }));
}

export function searchRiskRegisterSystems(search: string): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('systems', (client) => client.GET('/v1/information_systems', {
    params: { query: inventorySearchQuery(search) },
  }));
}

export function listRiskRegisterAssets(): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('assets', (client) => client.GET('/v1/information_assets', {
    params: { query: inventoryQuery },
  }));
}

export function searchRiskRegisterAssets(search: string): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('assets', (client) => client.GET('/v1/information_assets', {
    params: { query: inventorySearchQuery(search) },
  }));
}

/** The register's query as an export takes it: the whole filtered list, so no page and no page size (D-13). */
export type RiskRegisterExportQuery = Omit<RiskRegisterQuery, 'page' | 'pageSize'>;

/**
 * Exports the whole filtered Risk register as CSV or XLSX (D-13, D-19) through the generated path with a binary parse.
 * Strapi decides who may export, refuses an invalid query or more than 10,000 rows with its closed reason, and builds
 * the file; the shared validator then checks the type, the server's name, the size and the signature before any byte
 * is returned. Columns and the viewer's zone are sent only when given.
 */
export async function exportRiskRegister(input: {
  query: RiskRegisterExportQuery;
  format: ExportFileFormat;
  columns?: readonly string[];
  timeZone?: string;
}): Promise<ExportResult> {
  try {
    const { page: _page, pageSize: _pageSize, ...canonical } = serializeRiskRegisterQuery({ ...input.query, page: 1, pageSize: 25 });
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/risks/export', {
      params: {
        query: {
          ...canonical,
          format: input.format,
          ...(input.columns && input.columns.length > 0 ? { columns: input.columns.join(',') } : {}),
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        },
      },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}
