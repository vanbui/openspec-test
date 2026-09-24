import 'server-only';

import {
  createStrapiClient,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  parseRiskOwnerSearch,
  parseRiskDetailPayload,
  parseRiskPickerPayload,
  parseRiskRegisterPayload,
  serializeRiskRegisterQuery,
  type RiskPickerKind,
  type RiskPickerOption,
  type RiskDetail,
  type RiskRegisterPayload,
  type RiskRegisterQuery,
} from './risk-schema';
import { z } from 'zod';
import type { ContractResponseParser } from '../assessments/assessment-service';

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

function responseParser(parse: (payload: unknown) => unknown) {
  return z.unknown().superRefine((payload, context) => {
    try { parse(payload); } catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Risk response.' }); }
  });
}

export const responseParserModule = {
  modulePath: 'features/risks/risk-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'risks.listRiskRegister', component: 'RiskRegisterResponse', parser: responseParser(parseRiskRegisterPayload), narrowedPaths: ['data'] },
    { label: 'risks.getRiskDetail', component: 'RiskDetailResponse', parser: responseParser(parseRiskDetailPayload) },
  ] as const satisfies readonly ContractResponseParser[],
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

export function listRiskRegisterAssessments(): Promise<TransportResult<readonly RiskPickerOption[]>> {
  return pickerRequest('assessments', (client) => client.GET('/v1/risk_assessments'));
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
