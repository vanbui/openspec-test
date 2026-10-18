import 'server-only';
import { z } from 'zod';
import {
  createStrapiClient,
  normalizeTransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, listExportParams, type ExportResult, type ListExportOptions } from '../exports/export-file-check';
import {
  type CsrmAssessmentRequest,
  type MyRequestList,
  type MyRequestListQuery,
  type RequestRelationSummary,
} from './request-domain';
import {
  myRequestListResponseSchema,
  myRequestStatusSummaryResponseSchema,
  parseMyRequestListPayload,
  parseMyRequestStatusSummaryPayload,
  parseRequestDetailPayload,
  parseRequestInventoryPayload,
  parseRequestListQuery,
  parseRequestMutationPayload,
  requestDetailPayloadSchema,
  requestInventoryPayloadSchema,
  requestMutationPayloadSchema,
  type RequestDraftInput,
  type MyRequestStatusSummary,
  type RequestMutationResult,
  requestRevertSchema,
} from './request-schema';
import type { ContractResponseParser } from '../assessments/assessment-service';

export { parseRequestListQuery };

const forbiddenResult = {
  data: null,
  error: { message: 'You do not have permission to view these requests.', status: 403 },
} as const;

function normalizeFailure(error: unknown, status?: number): TransportResult<never> {
  return status === 403 ? forbiddenResult : normalizeTransportError(error, status);
}

export async function getRequest(documentId: string): Promise<TransportResult<CsrmAssessmentRequest>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/csrm-assessment-requests/{id}', {
      params: {
        path: { id: documentId },
        // Phase 13 D-04: the web asks for the two relation lists only. Strapi projects every person on the request
        // itself (revertedBy and the assignment, as a documentId and a display name) and refuses to populate one.
        query: { populate: ['informationSystems', 'informationAssets'] },
      },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseRequestDetailPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

/** Only the parameters the caller set: an empty search, no status, no holder and no notes filter are left out. */
function myRequestQueryParams(query: MyRequestListQuery) {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.holder ? { holder: query.holder } : {}),
    ...(query.notes ? { notes: query.notes } : {}),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * The signed-in actor's own requests with who holds each one (D-02 item 6),
 * from one owner-scoped server read; the server decides holder, stage and next step.
 */
export async function listMyRequests(query: MyRequestListQuery): Promise<TransportResult<MyRequestList>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/my_requests', {
      params: { query: myRequestQueryParams(query) },
    });

    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseMyRequestListPayload(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

/**
 * The signed-in actor's own requests counted by status and by who holds them (D-11), from one owner-scoped server
 * read. The analyst Home's Your own requests reads `byHolder` (11-12).
 */
export async function getMyRequestStatusSummary(): Promise<TransportResult<MyRequestStatusSummary>> {
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
  { label: 'request.listMyRequests', path: '/v1/my_requests', method: 'get', parser: myRequestListResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/requests/request-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
  // Phase 19 D-19: My requests' export is a file, checked by the shared validator's export rule.
  fileResponses: [
    { label: 'requests.exportMyRequests', path: '/v1/my_requests/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
  ],
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

/** My requests' query as its export takes it: every page of the owner-scoped list (D-13). */
export type MyRequestExportQuery = Pick<MyRequestListQuery, 'q' | 'sort'> & Partial<Pick<MyRequestListQuery, 'status' | 'holder' | 'notes'>>;

/**
 * Exports the signed-in actor's own requests (My requests, D-04) as the list's search and filters choose them, through
 * the generated path with a binary parse and the shared export-file check. Strapi scopes the list to its owner.
 */
export async function exportMyRequests(input: ListExportOptions & { query: MyRequestExportQuery }): Promise<ExportResult> {
  const { holder, notes, q, sort, status } = input.query;
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/my_requests/export', {
      params: {
        query: {
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(holder ? { holder } : {}),
          ...(notes ? { notes } : {}),
          sort,
          ...listExportParams(input),
        },
      },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}
