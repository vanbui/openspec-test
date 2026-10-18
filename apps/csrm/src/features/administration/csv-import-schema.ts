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

/*
 * The six import row states (Phase 19 D-30): `similar` (Matched by similar name) is a row whose natural key equals a
 * stored record's only after NFKC, lower case and collapsed whitespace; it waits for the Security Analyst's decision.
 */
export const csvRowStates = ['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'similar'] as const;
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

// An optional field a row's #CLEAR empties on an update arrives as null (Phase 19 D-28; the contract's nullable values).
const csvValuesSchema = z.object({
  name: z.string().min(1).max(255).optional(), description: z.string().max(10_000).nullable().optional(),
  controlNumber: z.string().min(1).max(255).optional(), controlType: z.enum(controlTypeValues).nullable().optional(),
  controlReference: z.string().max(500).nullable().optional(), framework: z.string().min(1).max(255).optional(),
  frameworkVersion: z.string().max(255).nullable().optional(), frameworkSource: z.string().max(2_000).nullable().optional(),
  systemType: z.string().max(255).nullable().optional(), environment: z.enum(systemEnvironmentValues).nullable().optional(),
  deploymentModel: z.enum(deploymentModelValues).nullable().optional(), businessCriticality: z.string().max(255).nullable().optional(),
  internetFacing: z.boolean().optional(), externalAccessRequired: z.boolean().optional(), hostingLocation: z.string().max(500).nullable().optional(),
  lifecycleState: z.enum(lifecycleStateValues).nullable().optional(), location: z.string().max(500).nullable().optional(),
  type: z.string().max(255).nullable().optional(),
  dataClassification: z.enum(dataClassificationValues).nullable().optional(), confidentialityRating: z.string().max(255).nullable().optional(),
  integrityRating: z.string().max(255).nullable().optional(), availabilityRating: z.string().max(255).nullable().optional(),
  containsPersonalData: z.boolean().optional(), containsLegalData: z.boolean().optional(), containsCreditCardData: z.boolean().optional(),
  comments: z.string().max(10_000).nullable().optional(),
}).strict();

const documentIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const csvImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(CSV_MAX_ROWS + 1),
  state: csvRowStateSchema,
  naturalKey: z.string().max(255).nullable(),
  matchedDocumentId: documentIdSchema.nullable(),
  /** The matched record's stored name (or control number): set for update, unchanged and similar rows. */
  matchedName: z.string().max(255).nullable(),
  values: csvValuesSchema,
  changes: z.array(csvImportChangeSchema).max(CSV_MAX_CHANGES_PER_ROW),
  issues: z.array(csvImportIssueSchema).max(CSV_MAX_ISSUES_PER_ROW),
}).strict().superRefine((row, context) => {
  if (row.state === 'similar' && (row.matchedDocumentId === null || row.matchedName === null || row.issues.length !== 0)) {
    context.addIssue({ code: 'custom', message: 'A row matched by similar name names its stored record and holds no issue.' });
  }
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

const rowCountSchema = z.number().int().min(0).max(CSV_MAX_ROWS);

/** The preview's summary: a count per row state, six in all (derived from csvRowStates). */
export const csvImportCountsSchema = z.object(
  Object.fromEntries(csvRowStates.map((state) => [state, rowCountSchema])) as Record<CsvRowState, typeof rowCountSchema>,
).strict();

/*
 * The commit's summary (D-30): today's five keys and `skipped`. A similar row decided update counts under update and
 * one decided skip under skipped, so the preview and result summaries no longer share keys.
 */
export const csvImportResultSummaryKeys = ['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'skipped'] as const;
export const csvImportResultSummarySchema = z.object(
  Object.fromEntries(csvImportResultSummaryKeys.map((key) => [key, rowCountSchema])) as Record<(typeof csvImportResultSummaryKeys)[number], typeof rowCountSchema>,
).strict();

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
export type CsvImportResultSummary = z.infer<typeof csvImportResultSummarySchema>;
export type CsvClientPreview = z.infer<typeof csvClientPreviewSchema>;

const csvImportLimitsSchema = z.object({
  maxBytes: z.literal(CSV_MAX_BYTES),
  maxRows: z.literal(CSV_MAX_ROWS),
}).strict();

/** The informational notes a preview carries (Phase 19 D-27, D-28): each says why a column or row was ignored. */
export const csvImportNotes = ['issues-column', 'read-only-columns', 'example-row'] as const;
export const CSV_IMPORT_MAX_WARNINGS = 50;
const importHeaderTextSchema = z.string().min(1).max(200);

export const csvImportPreviewDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  limits: csvImportLimitsSchema,
  summary: csvImportCountsSchema,
  /** The file's headers that match no column, as typed: ignored, and named (D-27). */
  warnings: z.array(importHeaderTextSchema).max(CSV_IMPORT_MAX_WARNINGS),
  notes: z.array(z.enum(csvImportNotes)).max(csvImportNotes.length),
  /** The reference export's read-only columns the file carries, by display label: ignored (D-33). */
  readOnlyColumns: z.array(importHeaderTextSchema).max(20),
  rows: z.array(csvImportPreviewRowSchema).min(1).max(CSV_MAX_ROWS),
}).strict();

/** The Security Analyst's decision for a row matched by similar name (D-30). */
export const csvImportDecisions = ['update', 'skip'] as const;

export const csvImportResultRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(CSV_MAX_ROWS + 1),
  state: csvRowStateSchema,
  naturalKey: z.string().max(255).nullable(),
  /** Present only on a similar row: the decision it was committed with. */
  decision: z.enum(csvImportDecisions).optional(),
  documentId: documentIdSchema.optional(),
  issues: z.array(csvImportIssueSchema).max(CSV_MAX_ISSUES_PER_ROW),
}).strict().superRefine((row, context) => {
  if ((row.state === 'similar') !== (row.decision !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Only a row matched by similar name carries a decision, and it always does.' });
  }
  const written = row.state === 'create' || row.state === 'update' || (row.state === 'similar' && row.decision === 'update');
  if (written !== (row.documentId !== undefined)) context.addIssue({ code: 'custom', message: 'Only written rows can expose a document identifier.' });
});

export const csvImportResultDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  /** The commit's result record, for the error report at Results (D-32). */
  resultToken: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  limits: csvImportLimitsSchema,
  summary: csvImportResultSummarySchema,
  previewChanged: z.number().int().min(0).max(CSV_MAX_ROWS),
  rows: z.array(csvImportResultRowSchema).max(CSV_MAX_ROWS),
}).strict();

export type CsvImportPreviewData = z.infer<typeof csvImportPreviewDataSchema>;
export type CsvImportResultData = z.infer<typeof csvImportResultDataSchema>;
