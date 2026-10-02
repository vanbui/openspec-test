'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { administrationKinds, getAdministrationConfig, type AdministrationKind } from './administration-config';
import {
  administrationDocumentIdSchema,
  controlCreateInputSchema,
  controlUpdateInputSchema,
  type ControlAdministrationRecord,
  informationAssetCreateInputSchema,
  informationAssetUpdateInputSchema,
  informationSystemCreateInputSchema,
  informationSystemUpdateInputSchema,
  type InformationAssetAdministrationRecord,
  type InformationSystemAdministrationRecord,
  parseAdministrationQuery,
  riskTypeCreateInputSchema,
  riskTypeUpdateInputSchema,
  type RiskTypeAdministrationRecord,
} from './administration-schema';
import { commitAdministrationCsv, createAdministrationControl, createInformationAsset, createInformationSystem, createRiskType, listAdministrationControls, previewAdministrationCsv, updateAdministrationControl, updateInformationAsset, updateInformationSystem, updateRiskType } from './administration-service';
import { applicableControlSearchOptions, type ApplicableControlOption } from './applicable-controls';
import type { CsvImportPreviewData, CsvImportResultData } from './csv-import-schema';

export type AdministrationActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      values?: Record<string, unknown>;
      fieldErrors?: Record<string, string[]>;
      formError: string;
    };

export type { ApplicableControlOption };
const applicableControlSearchSchema = z.string().trim().min(1).max(200);
/* One page of the Administration page sizes (10, 25, 50, 100): enough to choose from, never the whole library. */
const applicableControlSearchPageSize = 25;

export type CsvImportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; formError: string; unknownOutcome?: true };

function csvFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 && value.size <= 5_242_880
    && value.name.toLocaleLowerCase('en-AU').endsWith('.csv') ? value : null;
}

function csvKind(value: FormDataEntryValue | null): AdministrationKind | null {
  return typeof value === 'string' && administrationKinds.includes(value as AdministrationKind)
    ? value as AdministrationKind
    : null;
}

export async function previewAdministrationCsvAction(formData: FormData): Promise<CsvImportActionResult<CsvImportPreviewData>> {
  const kind = csvKind(formData.get('kind'));
  if (!kind) return { ok: false, formError: 'This CSV import is not available.' };
  const config = getAdministrationConfig(kind);
  const file = csvFile(formData.get('file'));
  if (!file) return { ok: false, formError: 'Choose one CSV file no larger than 5 MiB.' };
  const result = await previewAdministrationCsv(kind, file);
  if (result.error) {
    const formError = result.error.status === 403 ? `You do not have permission to import ${config.pluralLabel}.`
      : result.error.status === 413 ? 'This CSV file is larger than 5 MiB.'
        : 'The CSV could not be validated. Review the file and try again.';
    return { ok: false, formError };
  }
  return { ok: true, data: result.data };
}

export async function commitAdministrationCsvAction(formData: FormData): Promise<CsvImportActionResult<CsvImportResultData>> {
  const kind = csvKind(formData.get('kind'));
  if (!kind || formData.get('confirmed') !== 'true') {
    return { ok: false, formError: 'Review and confirm the import before applying it.' };
  }
  const config = getAdministrationConfig(kind);
  const file = csvFile(formData.get('file'));
  const previewDigest = formData.get('previewDigest');
  if (!file || typeof previewDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(previewDigest)) {
    return { ok: false, formError: 'The reviewed CSV no longer matches this import. Select the file again.' };
  }
  const result = await commitAdministrationCsv(kind, file, previewDigest);
  if (result.error) {
    if (result.error.status === 409) return { ok: false, formError: 'The selected CSV no longer matches the reviewed preview.' };
    if (result.error.status === 400 || result.error.status === 403 || result.error.status === 413 || result.error.status === 415) {
      return { ok: false, formError: `The ${config.label} import was not applied. Review the file and try again.` };
    }
    return {
      ok: false,
      unknownOutcome: true,
      formError: `The connection was lost after the import began. The outcome is unknown. Review ${config.pluralLabel} before trying again.`,
    };
  }
  revalidatePath(config.listPath);
  return { ok: true, data: result.data };
}

/*
 * The Risk Type form's control search (D-29): Strapi matches the control number, name and framework under the
 * analyst's own Administration grant and returns one bounded page, so the library is never read whole.
 */
export async function searchApplicableControlsAction(input: unknown): Promise<readonly ApplicableControlOption[]> {
  const search = applicableControlSearchSchema.safeParse(input);
  if (!search.success) return [];
  const result = await listAdministrationControls(parseAdministrationQuery('controls', {
    q: search.data, page: 1, pageSize: applicableControlSearchPageSize,
  }));
  if (result.error || !result.data) return [];
  return applicableControlSearchOptions(result.data.data.flatMap((record) => 'controlNumber' in record ? [record] : []));
}

const createRiskTypeActionSchema = z.object({ values: riskTypeCreateInputSchema }).strict();
const updateRiskTypeActionSchema = z.object({
  documentId: administrationDocumentIdSchema,
  values: riskTypeUpdateInputSchema,
}).strict();

function submittedValues(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  const values = (input as { values?: unknown }).values;
  return typeof values === 'object' && values !== null && !Array.isArray(values)
    ? values as Record<string, unknown>
    : undefined;
}

function validationFailure(error: z.ZodError, input: unknown, kind: AdministrationKind = 'risk-types'): AdministrationActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path[0] === 'values' ? issue.path.slice(1) : issue.path;
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fieldErrors[key] = [...(fieldErrors[key] ?? []), `Unrecognized field: ${key}`];
    } else if (path.length > 0) {
      const field = path.join('.');
      fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
    }
  }
  const values = submittedValues(input);
  return {
    ok: false,
    ...(values ? { values } : {}),
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    formError: `Check the ${getAdministrationConfig(kind).label} details and try again.`,
  };
}

function serviceFailure(
  status: number | undefined,
  values: Record<string, unknown>,
  kind: AdministrationKind = 'risk-types',
): AdministrationActionResult<never> {
  const { label, pluralLabel: plural } = getAdministrationConfig(kind);
  const conflictField = kind === 'controls' ? 'controlNumber' : 'name';
  const formError = status === 400 ? `The submitted ${label} data is invalid.`
    : status === 403 ? `You do not have permission to manage ${plural}.`
      : status === 404 ? `This ${label} is no longer available.`
        : status === 409 ? `A ${label} with this ${kind === 'controls' ? 'control number' : 'name'} already exists.`
          : `The ${label} service is unavailable. Please try again later.`;
  return {
    ok: false,
    values,
    ...(status === 409 ? { fieldErrors: { [conflictField]: [formError] } } : {}),
    formError,
  };
}

const createControlActionSchema = z.object({ values: controlCreateInputSchema }).strict();
const updateControlActionSchema = z.object({ documentId: administrationDocumentIdSchema, values: controlUpdateInputSchema }).strict();

export async function createControlAction(input: unknown): Promise<AdministrationActionResult<ControlAdministrationRecord>> {
  const parsed = createControlActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await createAdministrationControl(parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'controls');
  revalidatePath(getAdministrationConfig('controls').listPath);
  return { ok: true, data: result.data };
}

export async function updateControlAction(input: unknown): Promise<AdministrationActionResult<ControlAdministrationRecord>> {
  const parsed = updateControlActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateAdministrationControl(parsed.data.documentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'controls');
  const config = getAdministrationConfig('controls');
  revalidatePath(config.listPath);
  revalidatePath(config.detailPath(parsed.data.documentId));
  return { ok: true, data: result.data };
}

const systemCreateActionSchema = z.object({ values: informationSystemCreateInputSchema }).strict();
const systemUpdateActionSchema = z.object({ documentId: administrationDocumentIdSchema, values: informationSystemUpdateInputSchema }).strict();
const assetCreateActionSchema = z.object({ values: informationAssetCreateInputSchema }).strict();
const assetUpdateActionSchema = z.object({ documentId: administrationDocumentIdSchema, values: informationAssetUpdateInputSchema }).strict();

export async function createInformationSystemAction(input: unknown): Promise<AdministrationActionResult<InformationSystemAdministrationRecord>> {
  const parsed = systemCreateActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input, 'information-systems');
  const result = await createInformationSystem(parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'information-systems');
  revalidatePath(getAdministrationConfig('information-systems').listPath);
  return { ok: true, data: result.data };
}

export async function updateInformationSystemAction(input: unknown): Promise<AdministrationActionResult<InformationSystemAdministrationRecord>> {
  const parsed = systemUpdateActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input, 'information-systems');
  const result = await updateInformationSystem(parsed.data.documentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'information-systems');
  const config = getAdministrationConfig('information-systems');
  revalidatePath(config.listPath); revalidatePath(config.detailPath(parsed.data.documentId));
  return { ok: true, data: result.data };
}

export async function createInformationAssetAction(input: unknown): Promise<AdministrationActionResult<InformationAssetAdministrationRecord>> {
  const parsed = assetCreateActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input, 'information-assets');
  const result = await createInformationAsset(parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'information-assets');
  revalidatePath(getAdministrationConfig('information-assets').listPath);
  return { ok: true, data: result.data };
}

export async function updateInformationAssetAction(input: unknown): Promise<AdministrationActionResult<InformationAssetAdministrationRecord>> {
  const parsed = assetUpdateActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input, 'information-assets');
  const result = await updateInformationAsset(parsed.data.documentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values, 'information-assets');
  const config = getAdministrationConfig('information-assets');
  revalidatePath(config.listPath); revalidatePath(config.detailPath(parsed.data.documentId));
  return { ok: true, data: result.data };
}

export async function createRiskTypeAction(input: unknown): Promise<AdministrationActionResult<RiskTypeAdministrationRecord>> {
  const parsed = createRiskTypeActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await createRiskType(parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidatePath(getAdministrationConfig('risk-types').listPath);
  return { ok: true, data: result.data };
}

export async function updateRiskTypeAction(input: unknown): Promise<AdministrationActionResult<RiskTypeAdministrationRecord>> {
  const parsed = updateRiskTypeActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateRiskType(parsed.data.documentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  const config = getAdministrationConfig('risk-types');
  revalidatePath(config.listPath);
  revalidatePath(config.detailPath(parsed.data.documentId));
  return { ok: true, data: result.data };
}
