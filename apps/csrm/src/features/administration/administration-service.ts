import 'server-only';

import {
  createStrapiClient,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  administrationDocumentIdSchema,
  controlCreateInputSchema,
  controlUpdateInputSchema,
  informationAssetCreateInputSchema,
  informationAssetUpdateInputSchema,
  informationSystemCreateInputSchema,
  informationSystemUpdateInputSchema,
  parseAdministrationDetailPayload,
  parseAdministrationListPayload,
  riskTypeCreateInputSchema,
  riskTypeUpdateInputSchema,
  serializeAdministrationQuery,
  type AdministrationListPayload,
  type AdministrationQuery,
  type ControlAdministrationRecord,
  type ControlCreateInput,
  type ControlUpdateInput,
  type InformationAssetAdministrationRecord,
  type InformationAssetCreateInput,
  type InformationAssetUpdateInput,
  type InformationSystemAdministrationRecord,
  type InformationSystemCreateInput,
  type InformationSystemUpdateInput,
  type RiskTypeAdministrationRecord,
  type RiskTypeCreateInput,
  type RiskTypeUpdateInput,
} from './administration-schema';
import {
  csvImportPreviewDataSchema,
  csvImportResultDataSchema,
  type CsvImportPreviewData,
  type CsvImportResultData,
} from './csv-import-schema';
import type { AdministrationKind } from './administration-config';
import { z } from 'zod';
import type { ContractResponseParser } from '../assessments/assessment-service';

type ClientResponse = { data?: unknown; error?: unknown; response: { status: number } };

const multipartBodySerializer = (body: unknown) => body as FormData;

/** Wrap the existing closed administration parsers for the contract registry. */
function responseParser(parse: (payload: unknown) => unknown) {
  return z.unknown().superRefine((payload, context) => {
    try { parse(payload); } catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid administration response.' }); }
  });
}

export const responseParserModule = {
  modulePath: 'features/administration/administration-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'administration.listRiskTypes', component: 'RiskTypesAdministrationListResponse', parser: responseParser((p) => parseAdministrationListPayload('risk-types', p)), narrowedPaths: ['data'] },
    { label: 'administration.getRiskType', component: 'RiskTypesAdministrationResponse', parser: responseParser((p) => parseAdministrationDetailPayload('risk-types', p)), narrowedPaths: ['data'] },
    { label: 'administration.listControls', component: 'ControlsAdministrationListResponse', parser: responseParser((p) => parseAdministrationListPayload('controls', p)), narrowedPaths: ['data'] },
    { label: 'administration.getControl', component: 'ControlsAdministrationResponse', parser: responseParser((p) => parseAdministrationDetailPayload('controls', p)), narrowedPaths: ['data'] },
    { label: 'administration.listInformationSystems', component: 'InformationSystemsAdministrationListResponse', parser: responseParser((p) => parseAdministrationListPayload('information-systems', p)), narrowedPaths: ['data'] },
    { label: 'administration.getInformationSystem', component: 'InformationSystemsAdministrationResponse', parser: responseParser((p) => parseAdministrationDetailPayload('information-systems', p)), narrowedPaths: ['data'] },
    { label: 'administration.listInformationAssets', component: 'InformationAssetsAdministrationListResponse', parser: responseParser((p) => parseAdministrationListPayload('information-assets', p)), narrowedPaths: ['data'] },
    { label: 'administration.getInformationAsset', component: 'InformationAssetsAdministrationResponse', parser: responseParser((p) => parseAdministrationDetailPayload('information-assets', p)), narrowedPaths: ['data'] },
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

function importForm(file: File, fields?: { previewDigest: string; confirmed: true }): FormData {
  const form = new FormData();
  form.set('file', file, file.name);
  if (fields) {
    form.set('previewDigest', fields.previewDigest);
    form.set('confirmed', String(fields.confirmed));
  }
  return form;
}

export function previewAdministrationCsv(kind: AdministrationKind, file: File): Promise<TransportResult<CsvImportPreviewData>> {
  const body = importForm(file);
  const parse = (payload: unknown) => csvImportPreviewDataSchema.parse((payload as { data?: unknown }).data);
  if (kind === 'risk-types') return request((client) => client.POST('/v1/risk_types/import/preview', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'controls') return request((client) => client.POST('/v1/controls/import/preview', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'information-systems') return request((client) => client.POST('/v1/information_systems/import/preview', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  return request((client) => client.POST('/v1/information_assets/import/preview', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
}

export function commitAdministrationCsv(kind: AdministrationKind, file: File, previewDigest: string): Promise<TransportResult<CsvImportResultData>> {
  const body = importForm(file, { previewDigest, confirmed: true });
  const parse = (payload: unknown) => csvImportResultDataSchema.parse((payload as { data?: unknown }).data);
  if (kind === 'risk-types') return request((client) => client.POST('/v1/risk_types/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'controls') return request((client) => client.POST('/v1/controls/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'information-systems') return request((client) => client.POST('/v1/information_systems/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  return request((client) => client.POST('/v1/information_assets/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
}

export const previewRiskTypesCsv = (file: File) => previewAdministrationCsv('risk-types', file);
export const commitRiskTypesCsv = (file: File, previewDigest: string) => commitAdministrationCsv('risk-types', file, previewDigest);

export async function listRiskTypes(query: AdministrationQuery): Promise<TransportResult<AdministrationListPayload>> {
  const canonical = serializeAdministrationQuery('risk-types', query);
  return request(
    (client) => client.GET('/v1/risk_types', { params: { query: canonical } }),
    (payload) => parseAdministrationListPayload('risk-types', payload),
  );
}

export async function getRiskType(documentId: string): Promise<TransportResult<RiskTypeAdministrationRecord>> {
  const riskTypeId = administrationDocumentIdSchema.parse(documentId);
  return request(
    (client) => client.GET('/v1/risk_types/{riskTypeId}', { params: { path: { riskTypeId } } }),
    (payload) => parseAdministrationDetailPayload('risk-types', payload).data,
  );
}

export async function createRiskType(values: RiskTypeCreateInput): Promise<TransportResult<RiskTypeAdministrationRecord>> {
  const body = riskTypeCreateInputSchema.parse(values);
  return request(
    (client) => client.POST('/v1/risk_types', { body }),
    (payload) => parseAdministrationDetailPayload('risk-types', payload).data,
  );
}

export async function updateRiskType(
  documentId: string,
  values: RiskTypeUpdateInput,
): Promise<TransportResult<RiskTypeAdministrationRecord>> {
  const riskTypeId = administrationDocumentIdSchema.parse(documentId);
  const body = riskTypeUpdateInputSchema.parse(values);
  return request(
    (client) => client.PATCH('/v1/risk_types/{riskTypeId}', { params: { path: { riskTypeId } }, body }),
    (payload) => parseAdministrationDetailPayload('risk-types', payload).data,
  );
}

export async function listAdministrationControls(query: AdministrationQuery): Promise<TransportResult<AdministrationListPayload>> {
  const canonical = serializeAdministrationQuery('controls', query);
  return request(
    (client) => client.GET('/v1/controls', { params: { query: canonical } }),
    (payload) => parseAdministrationListPayload('controls', payload),
  );
}

export async function listInformationSystems(query: AdministrationQuery): Promise<TransportResult<AdministrationListPayload>> {
  const canonical = serializeAdministrationQuery('information-systems', query);
  return request((client) => client.GET('/v1/information_systems', { params: { query: canonical } }), (payload) => parseAdministrationListPayload('information-systems', payload));
}

export async function getInformationSystem(documentId: string): Promise<TransportResult<InformationSystemAdministrationRecord>> {
  const informationSystemId = administrationDocumentIdSchema.parse(documentId);
  return request((client) => client.GET('/v1/information_systems/{informationSystemId}', { params: { path: { informationSystemId } } }), (payload) => parseAdministrationDetailPayload('information-systems', payload).data as InformationSystemAdministrationRecord);
}

export async function createInformationSystem(values: InformationSystemCreateInput): Promise<TransportResult<InformationSystemAdministrationRecord>> {
  const body = informationSystemCreateInputSchema.parse(values);
  return request((client) => client.POST('/v1/information_systems', { body }), (payload) => parseAdministrationDetailPayload('information-systems', payload).data as InformationSystemAdministrationRecord);
}

export async function updateInformationSystem(documentId: string, values: InformationSystemUpdateInput): Promise<TransportResult<InformationSystemAdministrationRecord>> {
  const informationSystemId = administrationDocumentIdSchema.parse(documentId);
  const body = informationSystemUpdateInputSchema.parse(values);
  return request((client) => client.PATCH('/v1/information_systems/{informationSystemId}', { params: { path: { informationSystemId } }, body }), (payload) => parseAdministrationDetailPayload('information-systems', payload).data as InformationSystemAdministrationRecord);
}

export async function listInformationAssets(query: AdministrationQuery): Promise<TransportResult<AdministrationListPayload>> {
  const canonical = serializeAdministrationQuery('information-assets', query);
  return request((client) => client.GET('/v1/information_assets', { params: { query: canonical } }), (payload) => parseAdministrationListPayload('information-assets', payload));
}

export async function getInformationAsset(documentId: string): Promise<TransportResult<InformationAssetAdministrationRecord>> {
  const informationAssetId = administrationDocumentIdSchema.parse(documentId);
  return request((client) => client.GET('/v1/information_assets/{informationAssetId}', { params: { path: { informationAssetId } } }), (payload) => parseAdministrationDetailPayload('information-assets', payload).data as InformationAssetAdministrationRecord);
}

export async function createInformationAsset(values: InformationAssetCreateInput): Promise<TransportResult<InformationAssetAdministrationRecord>> {
  const body = informationAssetCreateInputSchema.parse(values);
  return request((client) => client.POST('/v1/information_assets', { body }), (payload) => parseAdministrationDetailPayload('information-assets', payload).data as InformationAssetAdministrationRecord);
}

export async function updateInformationAsset(documentId: string, values: InformationAssetUpdateInput): Promise<TransportResult<InformationAssetAdministrationRecord>> {
  const informationAssetId = administrationDocumentIdSchema.parse(documentId);
  const body = informationAssetUpdateInputSchema.parse(values);
  return request((client) => client.PATCH('/v1/information_assets/{informationAssetId}', { params: { path: { informationAssetId } }, body }), (payload) => parseAdministrationDetailPayload('information-assets', payload).data as InformationAssetAdministrationRecord);
}

export async function getAdministrationControl(documentId: string): Promise<TransportResult<ControlAdministrationRecord>> {
  const controlId = administrationDocumentIdSchema.parse(documentId);
  return request(
    (client) => client.GET('/v1/controls/{controlId}', { params: { path: { controlId } } }),
    (payload) => parseAdministrationDetailPayload('controls', payload).data as ControlAdministrationRecord,
  );
}

export async function createAdministrationControl(values: ControlCreateInput): Promise<TransportResult<ControlAdministrationRecord>> {
  const body = controlCreateInputSchema.parse(values);
  return request(
    (client) => client.POST('/v1/controls', { body }),
    (payload) => parseAdministrationDetailPayload('controls', payload).data as ControlAdministrationRecord,
  );
}

export async function updateAdministrationControl(
  documentId: string,
  values: ControlUpdateInput,
): Promise<TransportResult<ControlAdministrationRecord>> {
  const controlId = administrationDocumentIdSchema.parse(documentId);
  const body = controlUpdateInputSchema.parse(values);
  return request(
    (client) => client.PATCH('/v1/controls/{controlId}', { params: { path: { controlId } }, body }),
    (payload) => parseAdministrationDetailPayload('controls', payload).data as ControlAdministrationRecord,
  );
}
