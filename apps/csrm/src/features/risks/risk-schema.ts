import { z } from 'zod';

import { parseAdministrationListPayload } from '../administration/administration-schema';

export const riskRegisterRatings = ['Low', 'Moderate', 'High', 'Critical'] as const;
export const riskRegisterTreatmentStatuses = ['Not Started', 'In Progress', 'Overdue', 'Complete'] as const;
export const riskRegisterMitigationStatuses = ['Existing', 'Planned', 'Implemented', 'Retired', 'none'] as const;
export const riskRegisterSortValues = [
  'riskNumber:asc', 'riskNumber:desc', 'riskStatement:asc', 'riskStatement:desc',
  'inherentRating:asc', 'inherentRating:desc', 'residualRating:asc', 'residualRating:desc',
  'treatmentStatus:asc', 'treatmentStatus:desc', 'treatmentOwner:asc', 'treatmentOwner:desc',
  'targetDate:asc', 'targetDate:desc', 'assessment:asc', 'assessment:desc',
] as const;

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;
const queryText = z.preprocess(firstValue, z.string().trim().max(200).catch(''));
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(firstValue, z.enum(values).optional().catch(undefined));
const optionalOpaqueId = z.preprocess(firstValue, z.string().trim().min(1).max(200)
  .regex(/^[A-Za-z0-9_-]+$/).optional().catch(undefined));
const queryPage = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1_000_000 ? parsed : 1;
}, z.number().int().min(1).max(1_000_000));
const queryPageSize = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  return parsed === 10 || parsed === 25 || parsed === 50 ? parsed : 25;
}, z.union([z.literal(10), z.literal(25), z.literal(50)]));

function calendarDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return undefined;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : undefined;
}

const targetDateQuerySchema = z.string()
  .refine((value) => calendarDate(value) === value, 'Target date must be a valid calendar date.')
  .optional();

export const riskRegisterQuerySchema = z.object({
  q: queryText.default(''),
  treatmentStatus: optionalEnum(riskRegisterTreatmentStatuses),
  inherentRating: optionalEnum(riskRegisterRatings),
  residualRating: optionalEnum(riskRegisterRatings),
  riskOwner: optionalOpaqueId,
  treatmentOwner: optionalOpaqueId,
  assessment: optionalOpaqueId,
  system: optionalOpaqueId,
  asset: optionalOpaqueId,
  mitigationStatus: optionalEnum(riskRegisterMitigationStatuses),
  targetDateFrom: targetDateQuerySchema,
  targetDateTo: targetDateQuerySchema,
  sort: z.preprocess(firstValue, z.enum(riskRegisterSortValues).catch('targetDate:asc')).default('targetDate:asc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(25),
}).strip().superRefine(({ targetDateFrom, targetDateTo }, context) => {
  if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) {
    context.addIssue({
      code: 'custom',
      path: ['targetDateTo'],
      message: 'Target date to must not precede Target date from.',
    });
  }
});

export type RiskRegisterQuery = z.infer<typeof riskRegisterQuerySchema>;
export type RiskRegisterApiQuery = Omit<RiskRegisterQuery, 'q'> & { q?: string };

export function parseRiskRegisterQuery(input: unknown): RiskRegisterQuery {
  return riskRegisterQuerySchema.parse(input);
}

export function parseRiskOwnerSearch(input: unknown): string {
  return z.string().catch('').parse(input).trim().slice(0, 100);
}

export function serializeRiskRegisterQuery(query: RiskRegisterQuery): RiskRegisterApiQuery {
  const parsed = riskRegisterQuerySchema.parse(query);
  return {
    ...(parsed.q ? { q: parsed.q } : {}),
    ...(parsed.treatmentStatus ? { treatmentStatus: parsed.treatmentStatus } : {}),
    ...(parsed.inherentRating ? { inherentRating: parsed.inherentRating } : {}),
    ...(parsed.residualRating ? { residualRating: parsed.residualRating } : {}),
    ...(parsed.riskOwner ? { riskOwner: parsed.riskOwner } : {}),
    ...(parsed.treatmentOwner ? { treatmentOwner: parsed.treatmentOwner } : {}),
    ...(parsed.assessment ? { assessment: parsed.assessment } : {}),
    ...(parsed.system ? { system: parsed.system } : {}),
    ...(parsed.asset ? { asset: parsed.asset } : {}),
    ...(parsed.mitigationStatus ? { mitigationStatus: parsed.mitigationStatus } : {}),
    ...(parsed.targetDateFrom ? { targetDateFrom: parsed.targetDateFrom } : {}),
    ...(parsed.targetDateTo ? { targetDateTo: parsed.targetDateTo } : {}),
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

const documentIdSchema = z.string().trim().min(1).max(255);
const boundedText = z.string().max(65_535);
const ratingSchema = z.enum(riskRegisterRatings);
const userSchema = z.object({
  documentId: documentIdSchema,
  displayName: z.string().trim().min(1).max(255),
}).strict();
const assessmentSchema = z.object({
  documentId: documentIdSchema,
  assessmentNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
}).strict();
const selectedLabelSchema = z.object({
  documentId: documentIdSchema,
  label: z.string().trim().min(1).max(255),
}).strict();

export const riskRegisterItemSchema = z.object({
  documentId: documentIdSchema,
  riskNumber: z.string().trim().min(1).max(255),
  riskStatement: boundedText.nullable(),
  inherentRating: ratingSchema.nullable(),
  residualRating: ratingSchema.nullable(),
  treatmentStatus: z.enum(riskRegisterTreatmentStatuses).nullable(),
  treatmentOwner: userSchema.nullable(),
  targetDate: z.iso.date().nullable(),
  assessment: assessmentSchema,
}).strict();

export const riskRegisterPayloadSchema = z.object({
  data: z.array(riskRegisterItemSchema).max(50),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().min(1).max(1_000_000),
      pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]),
      pageCount: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }).strict(),
    selectedLabels: z.object({
      riskOwner: selectedLabelSchema.optional(),
      treatmentOwner: selectedLabelSchema.optional(),
      assessment: selectedLabelSchema.optional(),
      system: selectedLabelSchema.optional(),
      asset: selectedLabelSchema.optional(),
    }).strict(),
  }).strict(),
}).strict();

export type RiskRegisterPayload = z.infer<typeof riskRegisterPayloadSchema>;
export type RiskRegisterItem = z.infer<typeof riskRegisterItemSchema>;

export function parseRiskRegisterPayload(payload: unknown): RiskRegisterPayload {
  return riskRegisterPayloadSchema.parse(payload);
}

const nullableText = boundedText.nullable();
const nullableDate = z.iso.date().nullable();
const nullableTimestamp = z.iso.datetime({ offset: true }).nullable();
const detailUserSchema = userSchema;
const detailNamedRelationSchema = z.object({
  documentId: documentIdSchema,
  name: z.string().trim().min(1).max(255),
}).strict();
const detailRiskTypeSchema = detailNamedRelationSchema.extend({ description: nullableText }).strict();
const detailAssessmentSchema = assessmentSchema;
const detailControlSchema = z.object({
  documentId: documentIdSchema,
  controlNumber: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
}).strict();
const detailControlImplementationSchema = z.object({
  documentId: documentIdSchema,
  control: detailControlSchema,
  controlOwner: detailUserSchema.nullable(),
  controlStatus: z.enum(['Existing', 'Planned', 'Implemented', 'Retired']).nullable(),
  effectivenessRating: z.enum(['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed']).nullable(),
  evidence: nullableText,
  implementationDueDate: nullableDate,
  implementedDate: nullableDate,
  reviewDate: nullableDate,
}).strict();

export const riskDetailSchema = z.object({
  documentId: documentIdSchema,
  riskNumber: z.string().trim().min(1).max(255),
  parentLock: z.enum(['mutable', 'released']),
  issueStatement: nullableText,
  riskStatement: nullableText,
  riskCategory: nullableText,
  riskSubCategory: nullableText,
  riskCause: nullableText,
  potentialImpact: nullableText,
  dataClassification: z.enum(['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive']).nullable(),
  inherentLikelihood: nullableText,
  highestInherentConsequence: nullableText,
  inherentRating: ratingSchema.nullable(),
  inherentRatingRationale: nullableText,
  residualLikelihood: nullableText,
  highestResidualConsequence: nullableText,
  residualRating: ratingSchema.nullable(),
  residualRatingRationale: nullableText,
  controlEffectiveness: z.enum(['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed']).nullable(),
  riskVelocity: z.enum(['Low', 'Moderate', 'High', 'Very High']).nullable(),
  identifiedDate: nullableDate,
  targetDate: nullableDate,
  closureDate: nullableDate,
  isExempted: z.boolean().nullable(),
  exemptionReviewDate: nullableTimestamp,
  escalationDetails: nullableText,
  comments: nullableText,
  riskCommunicationDate: nullableDate,
  treatmentAction: z.enum(['Accept', 'Treat']).nullable(),
  treatmentPlan: nullableText,
  treatmentResolveDate: nullableDate,
  treatmentStatus: z.enum(riskRegisterTreatmentStatuses).nullable(),
  riskType: detailRiskTypeSchema.nullable(),
  riskOwner: detailUserSchema.nullable(),
  treatmentOwner: detailUserSchema.nullable(),
  informationSystemImpacted: detailNamedRelationSchema.nullable(),
  informationAssetImpacted: detailNamedRelationSchema.nullable(),
  assessment: detailAssessmentSchema,
  controlImplementations: z.array(detailControlImplementationSchema).max(1_000),
}).strict();

const riskDetailPayloadSchema = z.object({ data: riskDetailSchema }).strict();
export type RiskDetail = z.infer<typeof riskDetailSchema>;

export function parseRiskDetailPayload(payload: unknown): RiskDetail {
  return riskDetailPayloadSchema.parse(payload).data;
}

const relationSchema = z.object({ documentId: documentIdSchema, name: z.string().trim().min(1).max(255) }).strict();
const riskTypeSchema = relationSchema.extend({ description: boundedText.nullable() }).strict();
const controlSchema = relationSchema.extend({
  controlNumber: z.string().trim().min(1).max(255),
  description: boundedText.nullable(),
}).strict();
const assessmentSummarySchema = z.object({
  documentId: documentIdSchema,
  assessmentNumber: z.string().trim().min(1).max(255),
  assessmentStatus: z.enum(['draft', 'in-review', 'approved', 'closed']),
  summary: boundedText.nullable(),
  overallRating: ratingSchema.nullable(),
  generatedDate: z.iso.datetime({ offset: true }).nullable(),
  generatedBy: userSchema.nullable(),
  approvalDate: z.iso.datetime({ offset: true }).nullable(),
}).strict();

const pickerSchemas = {
  owners: z.array(userSchema).max(20),
  assessments: z.array(assessmentSummarySchema).max(1_000),
  riskTypes: z.array(riskTypeSchema).max(1_000),
  controls: z.array(controlSchema).max(5_000),
  systems: z.array(relationSchema).max(100),
  assets: z.array(relationSchema).max(100),
} as const;

export type RiskPickerKind = keyof typeof pickerSchemas;
export type RiskPickerOption = { documentId: string; label: string };

/**
 * The collection routes these pickers read are paged now and answer with
 * pagination meta beside the rows. The schema stays closed; it just knows the
 * envelope it is actually served.
 */
const pickerPaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(1_000),
  pageCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();

function pickerResponseSchema(kind: RiskPickerKind) {
  return z.object({
    data: pickerSchemas[kind],
    meta: z.object({ pagination: pickerPaginationSchema }).strict().optional(),
  }).strict();
}

/**
 * Exposed to the contract parity guard: these pickers read shared collection
 * routes, so their envelope drifts whenever those routes change shape.
 */
export const riskPickerContractParsers = [
  { label: 'listRiskRegisterAssessments', component: 'AssessmentListResponse', parser: pickerResponseSchema('assessments') },
  { label: 'listRiskRegisterRiskTypes', component: 'RiskTypeListResponse', parser: pickerResponseSchema('riskTypes') },
  { label: 'listRiskRegisterControls', component: 'ControlListResponse', parser: pickerResponseSchema('controls') },
] as const;

export const responseParserModule = {
  modulePath: 'features/risks/risk-schema.ts',
  mode: 'parsers' as const,
  parsers: riskPickerContractParsers,
};

export function parseRiskPickerPayload(kind: RiskPickerKind, payload: unknown): RiskPickerOption[] {
  const data = kind === 'systems' || kind === 'assets'
    ? parseAdministrationListPayload(kind === 'systems' ? 'information-systems' : 'information-assets', payload).data
    : pickerResponseSchema(kind).parse(payload).data as unknown[];
  const options = data.map((entry) => {
    const value = entry as Record<string, unknown>;
    const label = kind === 'owners' ? value.displayName
      : kind === 'assessments' ? value.assessmentNumber
        : kind === 'controls' ? `${String(value.controlNumber)} — ${String(value.name)}`
          : value.name;
    return { documentId: String(value.documentId), label: String(label) };
  });
  return options.filter((option, index) => options.findIndex((candidate) => candidate.documentId === option.documentId) === index);
}

export function mergeSelectedRiskPickerOption(
  options: readonly RiskPickerOption[],
  selected?: RiskPickerOption,
): RiskPickerOption[] {
  if (!selected || options.some((option) => option.documentId === selected.documentId)) return [...options];
  return [selected, ...options];
}

export function riskRatingRank(rating: (typeof riskRegisterRatings)[number] | null): number {
  return rating === null ? riskRegisterRatings.length : riskRegisterRatings.indexOf(rating);
}

export function formatRiskTargetDate(value: string | null): string {
  if (value === null) return 'No target date';
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}

export function isRiskOverdue(value: string | null, now = new Date()): boolean {
  if (value === null) return false;
  return value < now.toISOString().slice(0, 10);
}
