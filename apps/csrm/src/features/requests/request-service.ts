import 'server-only';
import { z } from 'zod';
import {
  createStrapiClient,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  requestSortParams,
  type CsrmAssessmentRequest,
  type RequestRelationSummary,
  type RequestList,
  type RequestListQuery,
} from './request-domain';
import {
  myRequestStatusSummaryResponseSchema,
  parseMyRequestStatusSummaryPayload,
  parseRequestDetailPayload,
  parseRequestDashboardListPayload,
  parseRequestInventoryPayload,
  parseRequestListQuery,
  parseRequestMutationPayload,
  parseRequestSummaryListPayload,
  requestDetailPayloadSchema,
  requestInventoryPayloadSchema,
  requestListPayloadSchema,
  requestMutationPayloadSchema,
  type RequestDraftInput,
  type RequestMutationResult,
  type RequestStatusCount,
  requestRevertSchema,
} from './request-schema';
import type { ContractResponseParser } from '../assessments/assessment-service';

export { parseRequestListQuery };

const forbiddenResult = {
  data: null,
  error: { message: 'You do not have permission to view these requests.', status: 403 },
} as const;

function listQueryParams(query: RequestListQuery) {
  return {
    ...(query.q ? { _q: query.q } : {}),
    ...(query.status ? { filters: { requestStatus: query.status } } : {}),
    sort: requestSortParams[query.sort],
    'pagination[page]': query.page,
    'pagination[pageSize]': query.pageSize,
  };
}

function normalizeFailure(error: unknown, status?: number): TransportResult<never> {
  return status === 403 ? forbiddenResult : normalizeTransportError(error, status);
}

export async function listRequests(query: RequestListQuery): Promise<TransportResult<RequestList>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/csrm-assessment-requests', {
      params: { query: listQueryParams(query) },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestSummaryListPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export async function getRequest(documentId: string): Promise<TransportResult<CsrmAssessmentRequest>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/csrm-assessment-requests/{id}', {
      params: {
        path: { id: documentId },
        // revertedBy is a relation: without populating it the detail screen can
        // never show who last returned the request to draft.
        query: { populate: ['informationSystems', 'informationAssets', 'revertedBy'] },
      },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestDetailPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export async function listDashboardRequests(query: RequestListQuery): Promise<TransportResult<RequestList>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/csrm-assessment-requests', {
      params: {
        query: {
          populate: ['questionnaire', 'assessment'],
          ...listQueryParams(query),
        },
      },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestDashboardListPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

/** The signed-in actor's own requests counted by status, from one owner-scoped server read. */
export async function getMyRequestStatusSummary(): Promise<TransportResult<readonly RequestStatusCount[]>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/my_requests/status_summary');

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseMyRequestStatusSummaryPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export const selectorPageSize = 25 as const;
const selectorQuerySchema = z.object({
  search: z.string().trim().max(100).catch(''),
}).strict();
const selectorIdsSchema = z.array(z.string().min(1).max(255)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, 'Selected identifiers must be unique.');
const selectedRelationsSchema = z.object({ data: z.array(z.object({ documentId: z.string().min(1), name: z.string().min(1) }).strip()) }).strip();

function selectorSearch(input: unknown): string {
  return selectorQuerySchema.parse(input).search;
}

async function searchInventory(
  path: '/v1/information_systems' | '/v1/information_assets',
  input: unknown = { search: '' },
): Promise<TransportResult<readonly RequestRelationSummary[]>> {
  try {
    const client = await createStrapiClient();
    const query = { q: selectorSearch(input), page: 1, pageSize: selectorPageSize };
    const result = path === '/v1/information_systems'
      ? await client.GET('/v1/information_systems', { params: { query } })
      : await client.GET('/v1/information_assets', { params: { query } });
    if (result.error || !result.data) return normalizeFailure(result.error, result.response.status);
    return { data: parseRequestInventoryPayload(result.data).data, error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export async function searchInformationSystems(input?: unknown): Promise<TransportResult<readonly RequestRelationSummary[]>> {
  return searchInventory('/v1/information_systems', input);
}

export async function searchInformationAssets(input?: unknown): Promise<TransportResult<readonly RequestRelationSummary[]>> {
  return searchInventory('/v1/information_assets', input);
}

export async function hydrateInformationSystemSelections(selectedIds: unknown): Promise<TransportResult<readonly RequestRelationSummary[]>> {
  try {
    const client = await createStrapiClient();
    const result = await client.POST('/v1/information_systems/selected', { body: { selectedIds: selectorIdsSchema.parse(selectedIds) } });
    if (result.error || !result.data) return normalizeFailure(result.error, result.response.status);
    return { data: selectedRelationsSchema.parse(result.data).data, error: null };
  } catch (error) { return normalizeFailure(error); }
}

export async function hydrateInformationAssetSelections(selectedIds: unknown): Promise<TransportResult<readonly RequestRelationSummary[]>> {
  try {
    const client = await createStrapiClient();
    const result = await client.POST('/v1/information_assets/selected', { body: { selectedIds: selectorIdsSchema.parse(selectedIds) } });
    if (result.error || !result.data) return normalizeFailure(result.error, result.response.status);
    return { data: selectedRelationsSchema.parse(result.data).data, error: null };
  } catch (error) { return normalizeFailure(error); }
}

// Compatibility for server-rendered routes. This is one bounded selector page,
// not an inventory enumeration.
export const listInformationSystems = searchInformationSystems;
export const listInformationAssets = searchInformationAssets;

export async function createRequest(input: RequestDraftInput): Promise<TransportResult<RequestMutationResult>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/csrm-assessment-requests', {
      body: { data: input },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestMutationPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export async function updateRequest(
  documentId: string,
  input: RequestDraftInput,
): Promise<TransportResult<RequestMutationResult>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/csrm-assessment-requests/{id}', {
      params: { path: { id: documentId } },
      body: { data: input },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestMutationPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export async function submitRequest(
  documentId: string,
  input: RequestDraftInput,
): Promise<TransportResult<RequestMutationResult>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.PUT('/csrm-assessment-requests/{id}', {
      params: { path: { id: documentId } },
      body: { data: { ...input, requestStatus: 'submitted' } },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestMutationPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

export interface RequestRevertResult {
  documentId: string;
  requestNumber: string;
  title: string;
  requestStatus: 'draft';
  submittedDate: null;
  revertReason: string;
  revertedAt: string;
  revertedBy: { documentId: string; displayName: string | null };
}

const requestRevertResponseSchema = z.object({ data: z.object({
  documentId: z.string().min(1), requestNumber: z.string().min(1), title: z.string().min(1),
  requestStatus: z.literal('draft'), submittedDate: z.null(), revertReason: z.string().min(1).max(500),
  revertedAt: z.string().min(1), revertedBy: z.object({ documentId: z.string().min(1), displayName: z.string().nullable() }),
}).strip() }).strip();

/** Every external success payload parsed by this service has a named contract entry. */
export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'request.listRequests', path: '/csrm-assessment-requests', method: 'get', parser: requestListPayloadSchema },
  {
    label: 'request.getRequest',
    path: '/csrm-assessment-requests/{id}',
    method: 'get',
    parser: requestDetailPayloadSchema,
    // The eight lifecycle steps are a derived presentation vocabulary, not a
    // stored enumeration, so the contract types a step key as a bounded string
    // and caps the array at 50 rather than freezing a list the data model does
    // not own. The client pins the exact eight keys and the exact length,
    // because a lifecycle missing a step or carrying an unknown one is a
    // projection defect the stepper must fail closed on rather than render.
    narrowedPaths: ['data.lifecycle.currentKey', 'data.lifecycle.steps.0.key', 'data.lifecycle.steps'],
  },
  { label: 'request.createRequest', path: '/csrm-assessment-requests', method: 'post', parser: requestMutationPayloadSchema },
  { label: 'request.updateRequest', path: '/csrm-assessment-requests/{id}', method: 'put', parser: requestMutationPayloadSchema },
  { label: 'request.searchInformationSystems', component: 'InformationSystemsAdministrationListResponse', parser: requestInventoryPayloadSchema },
  { label: 'request.searchInformationAssets', component: 'InformationAssetsAdministrationListResponse', parser: requestInventoryPayloadSchema },
  { label: 'request.revertRequestToDraft', component: 'AssessmentRequestRevertResponse', parser: requestRevertResponseSchema },
  { label: 'request.getMyRequestStatusSummary', component: 'MyRequestStatusSummaryResponse', parser: myRequestStatusSummaryResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/requests/request-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
};

export async function revertRequestToDraft(documentId: string, reason: string): Promise<TransportResult<RequestRevertResult>> {
  try {
    const input = requestRevertSchema.parse({ documentId, reason });
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/assessment_requests/{requestId}/revert_to_draft', {
      params: { path: { requestId: input.documentId } }, body: { reason: input.reason },
    });
    if (error || !data) return normalizeFailure(error, response.status);
    return { data: requestRevertResponseSchema.parse(data).data, error: null };
  } catch (error) { return normalizeFailure(error); }
}
