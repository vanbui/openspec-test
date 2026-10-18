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
import { commitAdministrationCsv, createAdministrationControl, createInformationAsset, createInformationSystem, createRiskType, downloadImportErrorReport, downloadImportTemplate, listAdministrationControls, previewAdministrationCsv, updateAdministrationControl, updateInformationAsset, updateInformationSystem, updateRiskType } from './administration-service';
import { applicableControlSearchOptions, type ApplicableControlOption } from './applicable-controls';
import { checkImportFileInBrowser } from './csv-client-parser';
import { csvImportDecisions, type CsvImportPreviewData, type CsvImportResultData } from './csv-import-schema';
import {
  importFileRefusal,
  importStepRefusal,
  isImportFileRefusalReason,
  type ImportFileRefusalCopy,
  type ImportFileRefusalReason,
  type ImportStepRefusalCopy,
  type ImportStepRefusalKind,
} from './import-refusal-copy';
import { formatFileSize } from '@/lib/files/format-file-size';
import type { ImportRefusalFound } from '@/lib/api/transport/server-client';
import { readViewerTimeZone } from '@/lib/time/viewer-time-zone';

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

/*
 * What a refused import step says (19-UI-SPEC §6), worded here from the feature-only family S module
 * (import-refusal-copy.ts, 19-02), never the shared refusal-copy.ts, which ships on the request detail page: a file
 * Strapi or this action refused (S2: a title, a body naming what was found, the fix's steps), or a refused step (S3).
 */
export type ImportRefusal =
  | ({ family: 'file'; reason: ImportFileRefusalReason } & ImportFileRefusalCopy)
  | ({ family: 'step'; step: ImportStepRefusalKind } & ImportStepRefusalCopy);

export type CsvImportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; formError: string; refusal?: ImportRefusal; unknownOutcome?: true };

/*
 * One .csv or .xlsx upload within the 5 MB limit (D-25): the same extension and size check the browser makes, made again
 * here because a Server Action is callable directly. Strapi reads the file and checks everything else.
 */
function csvFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 && checkImportFileInBrowser(value).ok ? value : null;
}

/** S2 for a refused file, with the file's own name and its X-23 size, and what Strapi found where it said. */
function fileRefusal(reason: ImportFileRefusalReason, file: File, found?: ImportRefusalFound): { ok: false; formError: string; refusal: ImportRefusal } {
  const copy = importFileRefusal({ reason, ...(found ? { found } : {}), fileName: file.name, fileSize: formatFileSize(file.size) });
  return { ok: false, formError: copy.title, refusal: { family: 'file', reason, ...copy } };
}

/** S3 for a refused step. */
function stepRefusal(step: ImportStepRefusalKind): { ok: false; formError: string; refusal: ImportRefusal } {
  const copy = importStepRefusal(step);
  return { ok: false, formError: copy.message, refusal: { family: 'step', step, ...copy } };
}

/** A file Strapi built for the import, checked by the export rule; or S3's copy for its refusal. */
export type ImportFileActionResult =
  | { ok: true; fileName: string; contentType: string; bytes: Uint8Array }
  | { ok: false; refusal: ImportStepRefusalCopy };

/** An error report, with the rows to correct that Strapi counted (`X-CSRM-Row-Count`). */
export type ImportReportActionResult =
  | { ok: true; fileName: string; contentType: string; bytes: Uint8Array; rowCount: number }
  | { ok: false; refusal: ImportStepRefusalCopy };

const templateInputSchema = z.object({ kind: z.enum(administrationKinds), format: z.enum(['csv', 'xlsx']) }).strict();

/** Downloads the collection's import template in the chosen format (D-31), for the browser to save. */
export async function downloadImportTemplateAction(input: unknown): Promise<ImportFileActionResult> {
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, refusal: importStepRefusal('template') };
  const result = await downloadImportTemplate(parsed.data.kind, parsed.data.format);
  if (result.error) return { ok: false, refusal: importStepRefusal('template') };
  return { ok: true, ...result.data };
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
  const upload = formData.get('file');
  if (!(upload instanceof File)) return { ok: false, formError: 'Choose one CSV or Excel file, up to 5 MB.' };
  const checked = checkImportFileInBrowser(upload);
  if (!checked.ok) return fileRefusal(checked.reason, upload);
  // An empty file has no header row to read; Strapi's reader refuses it the same way.
  if (upload.size === 0) return fileRefusal('IMPORT_NO_HEADER', upload);
  const result = await previewAdministrationCsv(kind, upload);
  if (result.error) {
    // A file Strapi can't read is 413, 415 or 422 with a closed reason; a malformed request stays a plain 400 (stop A ruling 3).
    if (isImportFileRefusalReason(result.error.reason)) return fileRefusal(result.error.reason, upload, result.error.found);
    const formError = result.error.status === 403 ? `You do not have permission to import ${config.pluralLabel}.`
      : 'We couldn’t check this file. Choose it again to retry.';
    return { ok: false, formError };
  }
  return { ok: true, data: result.data };
}

/*
 * The similar rows' decisions (D-30): a JSON object of row numbers (1 to 5 digits) to `update` or `skip`, at most 5,000
 * entries and 200,000 characters, as the commit request publishes it. Strapi checks them again against its preview.
 */
const decisionsSchema = z.string().max(200_000)
  .transform((text, context) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      context.addIssue({ code: 'custom', message: 'The decisions are not JSON.' });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string().regex(/^[0-9]{1,5}$/), z.enum(csvImportDecisions)).refine((decisions) => Object.keys(decisions).length <= 5_000));

export async function commitAdministrationCsvAction(formData: FormData): Promise<CsvImportActionResult<CsvImportResultData>> {
  const kind = csvKind(formData.get('kind'));
  if (!kind || formData.get('confirmed') !== 'true') {
    return { ok: false, formError: 'Review and confirm the import before applying it.' };
  }
  const config = getAdministrationConfig(kind);
  const file = csvFile(formData.get('file'));
  const previewDigest = formData.get('previewDigest');
  if (!file || typeof previewDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(previewDigest)) {
    return { ok: false, formError: 'The reviewed file no longer matches this import. Select the file again.' };
  }
  const submitted = formData.get('decisions');
  const decisions = submitted === null ? null : decisionsSchema.safeParse(submitted);
  if (decisions && !decisions.success) return stepRefusal('decision-missing');
  const result = await commitAdministrationCsv(kind, file, previewDigest, decisions ? JSON.stringify(decisions.data) : undefined);
  if (result.error) {
    if (result.error.reason === 'IMPORT_DECISION_MISSING') return stepRefusal('decision-missing');
    if (result.error.reason === 'IMPORT_REVIEW_EXPIRED') return stepRefusal('review-expired');
    if (isImportFileRefusalReason(result.error.reason)) return fileRefusal(result.error.reason, file, result.error.found);
    if (result.error.status === 409) return { ok: false, formError: 'The selected file no longer matches the reviewed preview.' };
    if (result.error.status === 400 || result.error.status === 403 || result.error.status === 413 || result.error.status === 415 || result.error.status === 422) {
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

const reportTokenSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

/*
 * The error report (D-32): the upload with exactly one token, the preview's at Review or the result's at Results.
 * Strapi rebuilds every cell from the file and its own record, so the browser sends no issue and no row.
 */
export async function downloadImportErrorReportAction(formData: FormData): Promise<ImportReportActionResult> {
  const kind = csvKind(formData.get('kind'));
  const file = csvFile(formData.get('file'));
  const previewDigest = reportTokenSchema.safeParse(formData.get('previewDigest'));
  const resultToken = reportTokenSchema.safeParse(formData.get('resultToken'));
  if (!kind || !file || previewDigest.success === resultToken.success) return { ok: false, refusal: importStepRefusal('error-report') };
  const timeZone = await readViewerTimeZone();
  const result = await downloadImportErrorReport(kind, {
    file,
    ...(previewDigest.success ? { previewDigest: previewDigest.data } : {}),
    ...(resultToken.success ? { resultToken: resultToken.data } : {}),
    ...(timeZone ? { timeZone } : {}),
  });
  if (result.error) {
    const expired = 'reason' in result.error && result.error.reason === 'IMPORT_REVIEW_EXPIRED';
    return { ok: false, refusal: importStepRefusal(expired ? 'review-expired' : 'error-report') };
  }
  return { ok: true, ...result.data };
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
