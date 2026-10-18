import 'server-only';

import {
  createStrapiClient,
  normalizeTransportError,
  type StrapiClient,
  type TransportError,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  administrationDetailPayloadSchema,
  administrationDocumentIdSchema,
  administrationListPayloadSchema,
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
import type { ContractResponseParser } from '../assessments/assessment-service';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, listExportParams, type ExportFileCheckError, type ExportResult, type ListExportOptions } from '../exports/export-file-check';
import { exportFileRule, validateFileResponse, type ExportFileFormat } from '../../lib/files/file-response';

type ClientResponse = { data?: unknown; error?: unknown; response: { status: number } };

const multipartBodySerializer = (body: unknown) => body as FormData;

/*
 * Where each closed administration parser is narrower than its contract
 * component. The guard reads the same schemas the parse functions below use,
 * so each narrowing is named at the field it concerns (G1).
 *
 * - Always served: Strapi's administration projection (projectAdministrationRecord)
 *   serves every one of these fields on every record, and the client requires
 *   them. The contract leaves them optional because each list route also answers
 *   a narrower picker or selector shape, and the detail, create and update
 *   responses share the record component with the list.
 * - Refused: the contract declares a required updatedAt on Risk Type and Control
 *   records, but no Strapi projection serves one on either, so the closed client
 *   refuses it (a contract gap, residual R-08-18).
 * - meta: the administration list always sends the canonical paged query and is
 *   always answered with pagination meta, which the client pages by; the contract
 *   leaves meta optional, and the Risk Type and Control routes answer the
 *   assessment picker without it.
 */
const alwaysServedFields = {
  'risk-types': ['description'],
  controls: ['description', 'controlType', 'controlReference', 'frameworkVersion', 'frameworkSource'],
  'information-systems': ['description', 'systemType', 'owner', 'environment', 'deploymentModel', 'businessCriticality', 'internetFacing', 'externalAccessRequired', 'hostingLocation', 'lifecycleState'],
  'information-assets': ['description', 'location', 'type', 'dataClassification', 'confidentialityRating', 'integrityRating', 'availabilityRating', 'containsPersonalData', 'containsLegalData', 'containsCreditCardData', 'comments'],
} as const satisfies Record<AdministrationKind, readonly string[]>;
const refusedContractFields = {
  'risk-types': ['updatedAt'],
  controls: ['updatedAt'],
  'information-systems': [],
  'information-assets': [],
} as const satisfies Record<AdministrationKind, readonly string[]>;

function recordNarrowings(kind: AdministrationKind, recordPath: string): string[] {
  return [...alwaysServedFields[kind], ...refusedContractFields[kind]].map((field) => `${recordPath}.${field}`);
}

const listNarrowings = (kind: AdministrationKind) => ['meta', ...recordNarrowings(kind, 'data.0')];
const detailNarrowings = (kind: AdministrationKind) => recordNarrowings(kind, 'data');

export const responseParserModule = {
  modulePath: 'features/administration/administration-service.ts',
  mode: 'parsers' as const,
  parsers: [
    { label: 'administration.listRiskTypes', component: 'RiskTypesAdministrationListResponse', parser: administrationListPayloadSchema('risk-types'), narrowedPaths: listNarrowings('risk-types') },
    { label: 'administration.getRiskType', component: 'RiskTypesAdministrationResponse', parser: administrationDetailPayloadSchema('risk-types'), narrowedPaths: detailNarrowings('risk-types') },
    { label: 'administration.listControls', component: 'ControlsAdministrationListResponse', parser: administrationListPayloadSchema('controls'), narrowedPaths: listNarrowings('controls') },
    { label: 'administration.getControl', component: 'ControlsAdministrationResponse', parser: administrationDetailPayloadSchema('controls'), narrowedPaths: detailNarrowings('controls') },
    { label: 'administration.listInformationSystems', component: 'InformationSystemsAdministrationListResponse', parser: administrationListPayloadSchema('information-systems'), narrowedPaths: listNarrowings('information-systems') },
    { label: 'administration.getInformationSystem', component: 'InformationSystemsAdministrationResponse', parser: administrationDetailPayloadSchema('information-systems'), narrowedPaths: detailNarrowings('information-systems') },
    { label: 'administration.listInformationAssets', component: 'InformationAssetsAdministrationListResponse', parser: administrationListPayloadSchema('information-assets'), narrowedPaths: listNarrowings('information-assets') },
    { label: 'administration.getInformationAsset', component: 'InformationAssetsAdministrationResponse', parser: administrationDetailPayloadSchema('information-assets'), narrowedPaths: detailNarrowings('information-assets') },
  ] as const satisfies readonly ContractResponseParser[],
  /*
   * Phase 19 (19-15, D-31 to D-33): the Administration files, each checked by the shared validator's export rule rather
   * than a zod parser, and registered here in the task that adds its call (19-PLAN-CHECK recheck C NB1).
   */
  fileResponses: [
    { label: 'administration.downloadRiskTypesImportTemplate', path: '/v1/risk_types/import/template', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadControlsImportTemplate', path: '/v1/controls/import/template', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadInformationSystemsImportTemplate', path: '/v1/information_systems/import/template', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadInformationAssetsImportTemplate', path: '/v1/information_assets/import/template', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadRiskTypesImportErrorReport', path: '/v1/risk_types/import/error_report', method: 'post' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadControlsImportErrorReport', path: '/v1/controls/import/error_report', method: 'post' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadInformationSystemsImportErrorReport', path: '/v1/information_systems/import/error_report', method: 'post' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.downloadInformationAssetsImportErrorReport', path: '/v1/information_assets/import/error_report', method: 'post' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.exportRiskTypes', path: '/v1/risk_types/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.exportControls', path: '/v1/controls/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.exportInformationSystems', path: '/v1/information_systems/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'administration.exportInformationAssets', path: '/v1/information_assets/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
  ],
};

/** A file Strapi built for the import (a template), as the export rule accepted it. */
export type AdministrationFile = { fileName: string; contentType: string; bytes: Uint8Array };

export type AdministrationFileResult =
  | { data: AdministrationFile; error: null }
  | { data: null; error: TransportError | ExportFileCheckError };

/** What the generated client returns for a binary parse. */
type BinaryResponse = { data?: ArrayBuffer; error?: unknown; response: { status: number; headers: Headers } };

/**
 * The checked file, or the refusal: a template carries no row count, so it passes the export rule (the format's media
 * type, the server's safe name, the size bound and the signature) and nothing else (D-31).
 */
function checkFileResponse({ data, error, response }: BinaryResponse, format: ExportFileFormat): AdministrationFileResult {
  if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
  const checked = validateFileResponse({
    contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'),
    bytes: new Uint8Array(data),
  }, exportFileRule(format));
  if (!checked.ok) return { data: null, error: { kind: 'file-check', failure: checked.failure } };
  return { data: { fileName: checked.fileName, contentType: checked.contentType, bytes: checked.bytes }, error: null };
}

/** Strapi's import template for the collection (D-31): the headers, one example row and, in a workbook, its Notes sheet. */
export async function downloadImportTemplate(kind: AdministrationKind, format: ExportFileFormat): Promise<AdministrationFileResult> {
  const options = { params: { query: { format } }, parseAs: 'arrayBuffer' as const };
  try {
    const client = await createStrapiClient();
    const served = kind === 'risk-types' ? await client.GET('/v1/risk_types/import/template', options)
      : kind === 'controls' ? await client.GET('/v1/controls/import/template', options)
        : kind === 'information-systems' ? await client.GET('/v1/information_systems/import/template', options)
          : await client.GET('/v1/information_assets/import/template', options);
    return checkFileResponse(served, format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

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

function importForm(file: File, fields?: { previewDigest: string; confirmed: true; decisions?: string }): FormData {
  const form = new FormData();
  form.set('file', file, file.name);
  if (fields) {
    form.set('previewDigest', fields.previewDigest);
    form.set('confirmed', String(fields.confirmed));
    // D-30: the similar rows' decisions, one JSON string of { "<row number>": "update" | "skip" }.
    if (fields.decisions !== undefined) form.set('decisions', fields.decisions);
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

export function commitAdministrationCsv(kind: AdministrationKind, file: File, previewDigest: string, decisions?: string): Promise<TransportResult<CsvImportResultData>> {
  const body = importForm(file, { previewDigest, confirmed: true, ...(decisions === undefined ? {} : { decisions }) });
  const parse = (payload: unknown) => csvImportResultDataSchema.parse((payload as { data?: unknown }).data);
  if (kind === 'risk-types') return request((client) => client.POST('/v1/risk_types/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'controls') return request((client) => client.POST('/v1/controls/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  if (kind === 'information-systems') return request((client) => client.POST('/v1/information_systems/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
  return request((client) => client.POST('/v1/information_assets/import', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
}

/** The error report's request (D-32): the upload, exactly one of the preview's or the result's token, and the viewer's zone. */
export type ImportErrorReportInput = { file: File; previewDigest?: string; resultToken?: string; timeZone?: string };

/**
 * Strapi's error report for the upload (D-32), rebuilt by Strapi from the file and its own preview or result record, in
 * the upload's format, with the rows to correct in `X-CSRM-Row-Count`; checked by the export rule as an export is.
 */
export async function downloadImportErrorReport(kind: AdministrationKind, input: ImportErrorReportInput): Promise<ExportResult> {
  const body = new FormData();
  body.set('file', input.file, input.file.name);
  if (input.previewDigest) body.set('previewDigest', input.previewDigest);
  if (input.resultToken) body.set('resultToken', input.resultToken);
  if (input.timeZone) body.set('timeZone', input.timeZone);
  const format: ExportFileFormat = input.file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
  const options = { body: body as never, bodySerializer: multipartBodySerializer, parseAs: 'arrayBuffer' as const };
  try {
    const client = await createStrapiClient();
    const served = kind === 'risk-types' ? await client.POST('/v1/risk_types/import/error_report', options)
      : kind === 'controls' ? await client.POST('/v1/controls/import/error_report', options)
        : kind === 'information-systems' ? await client.POST('/v1/information_systems/import/error_report', options)
          : await client.POST('/v1/information_assets/import/error_report', options);
    return checkExportResponse(served, format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

/** A reference list's export query: the admin list's own parsed query without its page and page size (D-13). */
export type AdministrationExportQuery = Omit<AdministrationQuery, 'page' | 'pageSize'>;

/**
 * A reference list in its import shape (D-33): the list's search, filters and order, every page, the chosen columns, in
 * the chosen format; checked by the export rule with its row count. The query is serialised as the list read serialises
 * it, so the file holds exactly what the filtered list shows; an empty search is left out.
 */
export async function exportReferenceList(kind: AdministrationKind, input: ListExportOptions & { query: AdministrationExportQuery }): Promise<ExportResult> {
  const { page: _page, pageSize: _pageSize, q, ...listQuery } = serializeAdministrationQuery(kind, { ...input.query, page: 1, pageSize: 25 } as AdministrationQuery);
  const query = { ...(q ? { q } : {}), ...listQuery, ...listExportParams(input) } as never;
  const options = { params: { query }, parseAs: 'arrayBuffer' as const };
  try {
    const client = await createStrapiClient();
    const served = kind === 'risk-types' ? await client.GET('/v1/risk_types/export', options)
      : kind === 'controls' ? await client.GET('/v1/controls/export', options)
        : kind === 'information-systems' ? await client.GET('/v1/information_systems/export', options)
          : await client.GET('/v1/information_assets/export', options);
    return checkExportResponse(served, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
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
