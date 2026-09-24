import { z } from 'zod';

import { administrationKinds, type AdministrationKind } from './administration-config';
import {
  controlTypeValues,
  dataClassificationValues,
  deploymentModelValues,
  lifecycleStateValues,
  systemEnvironmentValues,
} from './administration-schema';

export const CSV_MAX_BYTES = 5_242_880;
export const CSV_MAX_ROWS = 5_000;
export const CSV_MAX_RECORD_BYTES = 65_536;
export const CSV_MAX_ISSUES_PER_ROW = 20;
export const CSV_MAX_CHANGES_PER_ROW = 16;

export const csvRowStates = ['create', 'update', 'unchanged', 'rejected', 'ambiguous'] as const;
export const csvRowStateSchema = z.enum(csvRowStates);
export type CsvRowState = z.infer<typeof csvRowStateSchema>;

export type CsvColumn = {
  field: string;
  required: boolean;
  maxLength: number;
  type: 'text' | 'boolean' | 'enum';
  values?: readonly string[];
};

const text = (field: string, maxLength = 255, required = false): CsvColumn => ({ field, required, maxLength, type: 'text' });
const boolean = (field: string): CsvColumn => ({ field, required: false, maxLength: 5, type: 'boolean' });
const enumeration = (field: string, values: readonly string[]): CsvColumn => ({ field, required: false, maxLength: 255, type: 'enum', values });

export const administrationCsvContracts = {
  'risk-types': {
    naturalKey: 'name',
    columns: [text('name', 255, true), text('description', 10_000)],
  },
  controls: {
    naturalKey: 'controlNumber',
    columns: [
      text('controlNumber', 255, true), text('name', 255, true), text('description', 10_000),
      enumeration('controlType', controlTypeValues), text('controlReference', 500),
      text('framework', 255, true), text('frameworkVersion'), text('frameworkSource', 2_000),
    ],
  },
  'information-systems': {
    naturalKey: 'name',
    columns: [
      text('name', 255, true), text('description', 10_000), text('systemType'),
      enumeration('environment', systemEnvironmentValues), enumeration('deploymentModel', deploymentModelValues),
      text('businessCriticality'), boolean('internetFacing'), boolean('externalAccessRequired'),
      text('hostingLocation', 500), enumeration('lifecycleState', lifecycleStateValues),
    ],
  },
  'information-assets': {
    naturalKey: 'name',
    columns: [
      text('name', 255, true), text('description', 10_000), text('location', 500), text('type'),
      enumeration('dataClassification', dataClassificationValues), text('confidentialityRating'),
      text('integrityRating'), text('availabilityRating'), boolean('containsPersonalData'),
      boolean('containsLegalData'), boolean('containsCreditCardData'), text('comments', 10_000),
    ],
  },
} as const satisfies Record<AdministrationKind, { naturalKey: 'name' | 'controlNumber'; columns: readonly CsvColumn[] }>;

export function getAdministrationCsvContract(kind: unknown) {
  if (typeof kind !== 'string' || !administrationKinds.includes(kind as AdministrationKind)) {
    throw new Error('Unsupported CSRM Administration CSV collection.');
  }
  return administrationCsvContracts[kind as AdministrationKind];
}

const csvScalarSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]);
export const csvImportIssueSchema = z.object({
  code: z.string().min(1).max(100),
  field: z.string().max(100).nullable(),
  message: z.string().min(1).max(500),
}).strict();
export const csvImportChangeSchema = z.object({
  field: z.string().min(1).max(100),
  before: csvScalarSchema,
  after: csvScalarSchema,
}).strict();

const csvValuesSchema = z.object({
  name: z.string().min(1).max(255).optional(), description: z.string().max(10_000).optional(),
  controlNumber: z.string().min(1).max(255).optional(), controlType: z.enum(controlTypeValues).optional(),
  controlReference: z.string().max(500).optional(), framework: z.string().min(1).max(255).optional(),
  frameworkVersion: z.string().max(255).optional(), frameworkSource: z.string().max(2_000).optional(),
  systemType: z.string().max(255).optional(), environment: z.enum(systemEnvironmentValues).optional(),
  deploymentModel: z.enum(deploymentModelValues).optional(), businessCriticality: z.string().max(255).optional(),
  internetFacing: z.boolean().optional(), externalAccessRequired: z.boolean().optional(), hostingLocation: z.string().max(500).optional(),
  lifecycleState: z.enum(lifecycleStateValues).optional(), location: z.string().max(500).optional(), type: z.string().max(255).optional(),
  dataClassification: z.enum(dataClassificationValues).optional(), confidentialityRating: z.string().max(255).optional(),
  integrityRating: z.string().max(255).optional(), availabilityRating: z.string().max(255).optional(),
  containsPersonalData: z.boolean().optional(), containsLegalData: z.boolean().optional(), containsCreditCardData: z.boolean().optional(),
  comments: z.string().max(10_000).optional(),
}).strict();

const documentIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const csvImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(CSV_MAX_ROWS + 1),
  state: csvRowStateSchema,
  naturalKey: z.string().max(255).nullable(),
  matchedDocumentId: documentIdSchema.nullable(),
  values: csvValuesSchema,
  changes: z.array(csvImportChangeSchema).max(CSV_MAX_CHANGES_PER_ROW),
  issues: z.array(csvImportIssueSchema).max(CSV_MAX_ISSUES_PER_ROW),
}).strict().superRefine((row, context) => {
  if (row.state === 'unchanged' && (row.changes.length !== 0 || row.issues.length !== 0)) {
    context.addIssue({ code: 'custom', message: 'Unchanged rows cannot contain changes or issues.' });
  }
  if (row.state === 'create' && row.matchedDocumentId !== null) {
    context.addIssue({ code: 'custom', message: 'Create rows cannot contain a matched document.' });
  }
  if ((row.state === 'rejected' || row.state === 'ambiguous') && row.issues.length === 0) {
    context.addIssue({ code: 'custom', message: 'Rejected and ambiguous rows require a correction.' });
  }
});

export const csvImportCountsSchema = z.object({
  create: z.number().int().min(0).max(CSV_MAX_ROWS),
  update: z.number().int().min(0).max(CSV_MAX_ROWS),
  unchanged: z.number().int().min(0).max(CSV_MAX_ROWS),
  rejected: z.number().int().min(0).max(CSV_MAX_ROWS),
  ambiguous: z.number().int().min(0).max(CSV_MAX_ROWS),
}).strict();

export const csvClientPreviewSchema = z.object({
  rows: z.array(csvImportPreviewRowSchema).min(1).max(CSV_MAX_ROWS),
  counts: csvImportCountsSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().superRefine((preview, context) => {
  const total = Object.values(preview.counts).reduce((sum, count) => sum + count, 0);
  if (total !== preview.rows.length) context.addIssue({ code: 'custom', message: 'CSV row counts do not match the bounded row list.' });
});

export type CsvImportIssue = z.infer<typeof csvImportIssueSchema>;
export type CsvImportChange = z.infer<typeof csvImportChangeSchema>;
export type CsvImportPreviewRow = z.infer<typeof csvImportPreviewRowSchema>;
export type CsvImportCounts = z.infer<typeof csvImportCountsSchema>;
export type CsvClientPreview = z.infer<typeof csvClientPreviewSchema>;

const csvImportLimitsSchema = z.object({
  maxBytes: z.literal(CSV_MAX_BYTES),
  maxRows: z.literal(CSV_MAX_ROWS),
}).strict();

export const csvImportPreviewDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  limits: csvImportLimitsSchema,
  summary: csvImportCountsSchema,
  rows: z.array(csvImportPreviewRowSchema).min(1).max(CSV_MAX_ROWS),
}).strict();

export const csvImportResultRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(CSV_MAX_ROWS + 1),
  state: csvRowStateSchema,
  naturalKey: z.string().max(255).nullable(),
  documentId: documentIdSchema.optional(),
  issues: z.array(csvImportIssueSchema).max(CSV_MAX_ISSUES_PER_ROW),
}).strict().superRefine((row, context) => {
  const written = row.state === 'create' || row.state === 'update';
  if (written !== (row.documentId !== undefined)) context.addIssue({ code: 'custom', message: 'Only written rows can expose a document identifier.' });
});

export const csvImportResultDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  limits: csvImportLimitsSchema,
  summary: csvImportCountsSchema,
  previewChanged: z.number().int().min(0).max(CSV_MAX_ROWS),
  rows: z.array(csvImportResultRowSchema).max(CSV_MAX_ROWS),
}).strict();

export type CsvImportPreviewData = z.infer<typeof csvImportPreviewDataSchema>;
export type CsvImportResultData = z.infer<typeof csvImportResultDataSchema>;
