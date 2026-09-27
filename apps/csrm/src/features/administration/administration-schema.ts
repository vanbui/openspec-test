import { z } from 'zod';

import { enterFieldMessage, enterOrLeaveEmptyMessage, maxCharactersMessage } from '@/lib/schemas/validation-messages';

import { getAdministrationConfig, type AdministrationKind } from './administration-config';

import { administrationPageSizes, assetSortValues, controlSortValues, controlTypeValues, dataClassificationValues, deploymentModelValues, lifecycleStateValues, riskTypeSortValues, systemEnvironmentValues, systemSortValues } from './administration-domain';

// The vocabularies live in the zod-free administration-domain.ts, so the collection lists run in the browser without zod.
export { administrationPageSizes, assetSortValues, controlSortValues, controlTypeValues, dataClassificationValues, deploymentModelValues, lifecycleStateValues, riskTypeSortValues, systemEnvironmentValues, systemSortValues } from './administration-domain';

const firstValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value[0];
  return value;
};
const queryText = z.preprocess(firstValue, z.string().trim().max(200).catch('').default(''));
const queryPage = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1_000_000 ? parsed : 1;
}, z.number().int().min(1).max(1_000_000));
const queryPageSize = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  return administrationPageSizes.includes(parsed as typeof administrationPageSizes[number]) ? parsed : 25;
}, z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]));

const riskTypeQuerySchema = z.object({
  q: queryText,
  sort: z.preprocess(firstValue, z.enum(riskTypeSortValues).catch('name:asc')).default('name:asc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(25),
}).strip();

const controlQuerySchema = z.object({
  q: queryText,
  framework: z.preprocess(firstValue, z.string().trim().min(1).max(255).optional().catch(undefined)),
  controlType: z.preprocess(firstValue, z.enum(controlTypeValues).optional().catch(undefined)),
  sort: z.preprocess(firstValue, z.enum(controlSortValues).catch('controlNumber:asc')).default('controlNumber:asc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(25),
}).strip();
const booleanFilter = z.preprocess(firstValue, z.union([z.literal('true'), z.literal('false')]).optional().catch(undefined));
const systemQuerySchema = z.object({
  q: queryText,
  environment: z.preprocess(firstValue, z.enum(systemEnvironmentValues).optional().catch(undefined)),
  deploymentModel: z.preprocess(firstValue, z.enum(deploymentModelValues).optional().catch(undefined)),
  lifecycleState: z.preprocess(firstValue, z.enum(lifecycleStateValues).optional().catch(undefined)),
  internetFacing: booleanFilter,
  sort: z.preprocess(firstValue, z.enum(systemSortValues).catch('name:asc')).default('name:asc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(25),
}).strip();
const assetQuerySchema = z.object({
  q: queryText,
  dataClassification: z.preprocess(firstValue, z.enum(dataClassificationValues).optional().catch(undefined)),
  containsPersonalData: booleanFilter,
  containsLegalData: booleanFilter,
  containsCreditCardData: booleanFilter,
  sort: z.preprocess(firstValue, z.enum(assetSortValues).catch('name:asc')).default('name:asc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(25),
}).strip();

export type AdministrationQuery = {
  q: string;
  sort: typeof riskTypeSortValues[number] | typeof controlSortValues[number] | typeof systemSortValues[number] | typeof assetSortValues[number];
  page: number;
  pageSize: typeof administrationPageSizes[number];
  framework?: string;
  controlType?: typeof controlTypeValues[number];
  environment?: typeof systemEnvironmentValues[number];
  deploymentModel?: typeof deploymentModelValues[number];
  lifecycleState?: typeof lifecycleStateValues[number];
  internetFacing?: 'true' | 'false';
  dataClassification?: typeof dataClassificationValues[number];
  containsPersonalData?: 'true' | 'false';
  containsLegalData?: 'true' | 'false';
  containsCreditCardData?: 'true' | 'false';
};

function querySchema(kind: AdministrationKind) {
  if (kind === 'controls') return controlQuerySchema;
  if (kind === 'information-systems') return systemQuerySchema;
  if (kind === 'information-assets') return assetQuerySchema;
  return riskTypeQuerySchema;
}

export function parseAdministrationQuery(kind: AdministrationKind, input: unknown): AdministrationQuery {
  getAdministrationConfig(kind);
  return querySchema(kind).parse(input) as AdministrationQuery;
}

export function serializeAdministrationQuery(input: AdministrationQuery): Record<string, string | number>;
export function serializeAdministrationQuery(kind: AdministrationKind, input: AdministrationQuery): Record<string, string | number>;
export function serializeAdministrationQuery(kindOrInput: AdministrationKind | AdministrationQuery, maybeInput?: AdministrationQuery): Record<string, string | number> {
  const input = typeof kindOrInput === 'string' ? maybeInput! : kindOrInput;
  const kind = typeof kindOrInput === 'string' ? kindOrInput
    : input.sort.startsWith('controlNumber') || input.framework !== undefined || input.controlType !== undefined ? 'controls' : 'risk-types';
  const parsed = querySchema(kind).parse(input) as AdministrationQuery;
  return {
    q: parsed.q,
    ...(parsed.framework ? { framework: parsed.framework } : {}),
    ...(parsed.controlType ? { controlType: parsed.controlType } : {}),
    ...(parsed.environment ? { environment: parsed.environment } : {}),
    ...(parsed.deploymentModel ? { deploymentModel: parsed.deploymentModel } : {}),
    ...(parsed.lifecycleState ? { lifecycleState: parsed.lifecycleState } : {}),
    ...(parsed.internetFacing ? { internetFacing: parsed.internetFacing } : {}),
    ...(parsed.dataClassification ? { dataClassification: parsed.dataClassification } : {}),
    ...(parsed.containsPersonalData ? { containsPersonalData: parsed.containsPersonalData } : {}),
    ...(parsed.containsLegalData ? { containsLegalData: parsed.containsLegalData } : {}),
    ...(parsed.containsCreditCardData ? { containsCreditCardData: parsed.containsCreditCardData } : {}),
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

export const administrationDocumentIdSchema = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);

/*
 * Every bound a form field can hit carries the product's own message (WR-04), so the create and edit forms
 * and their Server Actions never show a validation library default. The bounds themselves are unchanged.
 */
const requiredText = (label: string, maxLength: number) => z.string({ error: enterFieldMessage(label) })
  .trim()
  .min(1, enterFieldMessage(label))
  .max(maxLength, maxCharactersMessage(maxLength));
const nameSchema = requiredText('Name', 255);
const descriptionSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().max(10_000, maxCharactersMessage(10_000)).nullable(),
);
const applicableControlsSchema = z.array(administrationDocumentIdSchema).max(1_000, 'Select 1,000 Applicable Controls or fewer.')
  .refine((values) => new Set(values).size === values.length, 'Applicable Controls must be distinct.');

export const riskTypeCreateInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
  applicableControls: applicableControlsSchema.optional(),
}).strict();

export const riskTypeUpdateInputSchema = riskTypeCreateInputSchema.partial().strict()
  .refine((values) => Object.keys(values).length > 0, 'Submit at least one changed Risk Type field.');

export type RiskTypeCreateInput = z.infer<typeof riskTypeCreateInputSchema>;
export type RiskTypeUpdateInput = z.infer<typeof riskTypeUpdateInputSchema>;

export const riskTypeAdministrationRecordSchema = z.object({
  documentId: administrationDocumentIdSchema,
  name: z.string().trim().min(1).max(255),
  description: descriptionSchema,
  applicableControls: applicableControlsSchema.optional(),
}).strict();

// An optional Control field is empty (null) or holds text; the form submits one holding only spaces as null.
const optionalControlText = (label: string, maxLength: number) => z.string()
  .trim()
  .min(1, enterOrLeaveEmptyMessage(label))
  .max(maxLength, maxCharactersMessage(maxLength))
  .nullable();
const controlReferenceSchema = optionalControlText('Control reference', 500);
const frameworkVersionSchema = optionalControlText('Framework version', 255);
const frameworkSourceSchema = optionalControlText('Framework source', 2_000);
export const controlCreateInputSchema = z.object({
  controlNumber: requiredText('Control number', 255),
  name: nameSchema,
  description: descriptionSchema.optional().nullable(),
  controlType: z.enum(controlTypeValues).optional().nullable(),
  controlReference: controlReferenceSchema.optional(),
  framework: requiredText('Framework', 255),
  frameworkVersion: frameworkVersionSchema.optional(),
  frameworkSource: frameworkSourceSchema.optional(),
}).strict();
export const controlUpdateInputSchema = controlCreateInputSchema.partial().strict()
  .refine((values) => Object.keys(values).length > 0, 'Submit at least one changed Control field.');
export type ControlCreateInput = z.infer<typeof controlCreateInputSchema>;
export type ControlUpdateInput = z.infer<typeof controlUpdateInputSchema>;

export const controlAdministrationRecordSchema = z.object({
  documentId: administrationDocumentIdSchema,
  controlNumber: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  description: descriptionSchema,
  controlType: z.enum(controlTypeValues).nullable(),
  controlReference: controlReferenceSchema,
  framework: z.string().trim().min(1).max(255),
  frameworkVersion: frameworkVersionSchema,
  frameworkSource: frameworkSourceSchema,
}).strict();

const nullableShortText = z.string().trim().max(255, maxCharactersMessage(255)).nullable();
const nullableLocation = z.string().trim().max(500, maxCharactersMessage(500)).nullable();
export const informationSystemCreateInputSchema = z.object({
  name: nameSchema, description: descriptionSchema.optional(), systemType: nullableShortText.optional(),
  owner: administrationDocumentIdSchema.nullable().optional(), environment: z.enum(systemEnvironmentValues).nullable().optional(),
  deploymentModel: z.enum(deploymentModelValues).nullable().optional(), businessCriticality: nullableShortText.optional(),
  internetFacing: z.boolean().optional(), externalAccessRequired: z.boolean().optional(), hostingLocation: nullableLocation.optional(),
  lifecycleState: z.enum(lifecycleStateValues).nullable().optional(),
}).strict();
export const informationSystemUpdateInputSchema = informationSystemCreateInputSchema.partial().strict().refine((values) => Object.keys(values).length > 0, 'Submit at least one changed Information System field.');
export const informationSystemAdministrationRecordSchema = informationSystemCreateInputSchema.extend({
  documentId: administrationDocumentIdSchema, description: descriptionSchema, systemType: nullableShortText, owner: administrationDocumentIdSchema.nullable(),
  environment: z.enum(systemEnvironmentValues).nullable(), deploymentModel: z.enum(deploymentModelValues).nullable(), businessCriticality: nullableShortText,
  internetFacing: z.boolean(), externalAccessRequired: z.boolean(), hostingLocation: nullableLocation,
  lifecycleState: z.enum(lifecycleStateValues).nullable(), updatedAt: z.string().datetime(),
}).strict();
export type InformationSystemCreateInput = z.infer<typeof informationSystemCreateInputSchema>;
export type InformationSystemUpdateInput = z.infer<typeof informationSystemUpdateInputSchema>;
export type InformationSystemAdministrationRecord = z.infer<typeof informationSystemAdministrationRecordSchema>;

export const informationAssetCreateInputSchema = z.object({
  name: nameSchema, description: descriptionSchema.optional(), location: nullableLocation.optional(), type: nullableShortText.optional(),
  dataClassification: z.enum(dataClassificationValues).nullable().optional(), confidentialityRating: nullableShortText.optional(), integrityRating: nullableShortText.optional(), availabilityRating: nullableShortText.optional(),
  containsPersonalData: z.boolean().optional(), containsLegalData: z.boolean().optional(), containsCreditCardData: z.boolean().optional(), comments: descriptionSchema.optional(),
}).strict();
export const informationAssetUpdateInputSchema = informationAssetCreateInputSchema.partial().strict().refine((values) => Object.keys(values).length > 0, 'Submit at least one changed Information Asset field.');
export const informationAssetAdministrationRecordSchema = informationAssetCreateInputSchema.extend({
  documentId: administrationDocumentIdSchema, description: descriptionSchema, location: nullableLocation, type: nullableShortText,
  dataClassification: z.enum(dataClassificationValues).nullable(), confidentialityRating: nullableShortText, integrityRating: nullableShortText, availabilityRating: nullableShortText,
  containsPersonalData: z.boolean(), containsLegalData: z.boolean(), containsCreditCardData: z.boolean(), comments: descriptionSchema, updatedAt: z.string().datetime(),
}).strict();
export type InformationAssetCreateInput = z.infer<typeof informationAssetCreateInputSchema>;
export type InformationAssetUpdateInput = z.infer<typeof informationAssetUpdateInputSchema>;
export type InformationAssetAdministrationRecord = z.infer<typeof informationAssetAdministrationRecordSchema>;

const administrationPaginationSchema = z.object({
  page: z.number().int().min(1).max(1_000_000),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
  pageCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();

const riskTypeListPayloadSchema = z.object({
  data: z.array(riskTypeAdministrationRecordSchema).max(100),
  meta: z.object({ pagination: administrationPaginationSchema }).strict(),
}).strict();
const riskTypeDetailPayloadSchema = z.object({ data: riskTypeAdministrationRecordSchema }).strict();
const controlListPayloadSchema = z.object({
  data: z.array(controlAdministrationRecordSchema).max(100),
  meta: z.object({ pagination: administrationPaginationSchema }).strict(),
}).strict();
const controlDetailPayloadSchema = z.object({ data: controlAdministrationRecordSchema }).strict();
const informationSystemListPayloadSchema = z.object({ data: z.array(informationSystemAdministrationRecordSchema).max(100), meta: z.object({ pagination: administrationPaginationSchema }).strict() }).strict();
const informationSystemDetailPayloadSchema = z.object({ data: informationSystemAdministrationRecordSchema }).strict();
const informationAssetListPayloadSchema = z.object({ data: z.array(informationAssetAdministrationRecordSchema).max(100), meta: z.object({ pagination: administrationPaginationSchema }).strict() }).strict();
const informationAssetDetailPayloadSchema = z.object({ data: informationAssetAdministrationRecordSchema }).strict();

export type RiskTypeAdministrationRecord = z.infer<typeof riskTypeAdministrationRecordSchema>;
export type ControlAdministrationRecord = z.infer<typeof controlAdministrationRecordSchema>;
export type AdministrationRecord = RiskTypeAdministrationRecord | ControlAdministrationRecord | InformationSystemAdministrationRecord | InformationAssetAdministrationRecord;
export type AdministrationListPayload = {
  data: AdministrationRecord[];
  meta: { pagination: z.infer<typeof administrationPaginationSchema> };
};

/** The closed schema a collection's list response is parsed with; the contract parity guard reads the same one. */
export function administrationListPayloadSchema(kind: AdministrationKind) {
  getAdministrationConfig(kind);
  return kind === 'controls' ? controlListPayloadSchema : kind === 'information-systems' ? informationSystemListPayloadSchema : kind === 'information-assets' ? informationAssetListPayloadSchema : riskTypeListPayloadSchema;
}

/** The closed schema a collection's detail response is parsed with; the contract parity guard reads the same one. */
export function administrationDetailPayloadSchema(kind: AdministrationKind) {
  getAdministrationConfig(kind);
  return kind === 'controls' ? controlDetailPayloadSchema : kind === 'information-systems' ? informationSystemDetailPayloadSchema : kind === 'information-assets' ? informationAssetDetailPayloadSchema : riskTypeDetailPayloadSchema;
}

export function parseAdministrationListPayload(kind: AdministrationKind, payload: unknown): AdministrationListPayload {
  return administrationListPayloadSchema(kind).parse(payload) as AdministrationListPayload;
}

export function parseAdministrationDetailPayload(
  kind: AdministrationKind,
  payload: unknown,
): { data: AdministrationRecord } {
  return administrationDetailPayloadSchema(kind).parse(payload) as { data: AdministrationRecord };
}
