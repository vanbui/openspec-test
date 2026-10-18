import { z } from 'zod';

import type { components } from '../../lib/api/generated/schema';
import { alertItemSchema } from '../alerts/alert-schema';
import { reportKeys, type ReportKey } from './report-copy';
import { reportPeriods, type ReportPeriod } from './report-periods';

export { reportPeriods, type ReportPeriod };

type Schemas = components['schemas'];

/** True only when two unions hold exactly the same members. */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/*
 * The analyst reports (D-13). Strapi computes every figure; the client renders
 * what it is given and never re-derives a count, a month or a median. Each
 * report is one closed branch of the published union discriminated by its key,
 * and each branch has its own strict parser, so a report can never be read as
 * another. The identifier bounds below (an exposed system's documentId and
 * name: min(1) and max(255)) mirror the minLength and maxLength the contract
 * declares on ExposedSystem, so they narrow nothing. No schema below narrows
 * the contract with a bound it does not declare, an exact length or a
 * cross-field refinement, except the free-text cap of the alert rows the
 * treatment report reuses, registered as a narrowing beside that parser in
 * report-service.ts.
 */

const reportVocabulariesMatchTheContract = {
  keys: true satisfies SameUnion<ReportKey, Schemas['ReportKey']>,
  periods: true satisfies SameUnion<ReportPeriod, Schemas['AssessmentThroughputReport']['period']>,
} as const;
void reportVocabulariesMatchTheContract;

const countSchema = z.number().int().nonnegative();
const dateSchema = z.iso.date();
const periodSchema = z.union([z.literal(6), z.literal(12)]);

export const reportDefinitionSchema = z.object({
  key: z.enum(reportKeys),
  title: z.string().min(1),
  description: z.string().min(1),
}).strict();

export const reportDefinitionListResponseSchema = z.object({
  data: z.array(reportDefinitionSchema).max(reportKeys.length),
}).strict();

/** The published RatingCounts: Risks by rating on the closed ladder, plus notRated and the total. */
export const ratingCountsSchema = z.object({
  Critical: countSchema,
  High: countSchema,
  Moderate: countSchema,
  Low: countSchema,
  notRated: countSchema,
  total: countSchema,
}).strict();

const treatmentStatusCountsSchema = z.object({
  notStarted: countSchema,
  inProgress: countSchema,
  overdue: countSchema,
  complete: countSchema,
  notProvided: countSchema,
  total: countSchema,
}).strict();

const controlStatusCountsSchema = z.object({
  existing: countSchema,
  planned: countSchema,
  implemented: countSchema,
  retired: countSchema,
  notProvided: countSchema,
  total: countSchema,
}).strict();

const effectivenessCountsSchema = z.object({
  effective: countSchema,
  partiallyEffective: countSchema,
  ineffective: countSchema,
  notAssessed: countSchema,
  notProvided: countSchema,
  total: countSchema,
}).strict();

const requestStatusCountsSchema = z.object({
  submitted: countSchema,
  questionnaireInProgress: countSchema,
  riskAssessmentDrafted: countSchema,
  underReview: countSchema,
  approved: countSchema,
  closed: countSchema,
  total: countSchema,
}).strict();

const exposedSystemSchema = z.object({
  documentId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  critical: countSchema,
  high: countSchema,
  total: countSchema,
}).strict();

/*
 * D-40 to D-42: every section of the risk-exposure report counts released open Risks; the accepted Risks
 * among them and the open Risks under assessment are their own required counts, so the under-assessment
 * figure is never read as, or added to, a released one.
 */
export const riskExposureReportSchema = z.object({
  key: z.literal('risk-exposure'),
  today: dateSchema,
  byResidualRating: ratingCountsSchema,
  byInherentRating: ratingCountsSchema,
  acceptedByResidualRating: ratingCountsSchema,
  residualByTreatmentStatus: z.object({
    Critical: treatmentStatusCountsSchema,
    High: treatmentStatusCountsSchema,
    Moderate: treatmentStatusCountsSchema,
    Low: treatmentStatusCountsSchema,
    notRated: treatmentStatusCountsSchema,
  }).strict(),
  exposedSystems: z.object({
    rows: z.array(exposedSystemSchema).max(10),
    total: countSchema,
    truncated: z.boolean(),
    risksWithoutSystem: countSchema,
  }).strict(),
  underAssessment: z.object({ byResidualRating: ratingCountsSchema }).strict(),
}).strict();

export const treatmentPerformanceReportSchema = z.object({
  key: z.literal('treatment-performance'),
  today: dateSchema,
  dueWindowDays: z.number().int().min(1),
  dueState: z.object({
    overdue: countSchema,
    dueWithinWindow: countSchema,
    later: countSchema,
    noTargetDate: countSchema,
    total: countSchema,
  }).strict(),
  treatmentStatus: treatmentStatusCountsSchema,
  mostOverdue: z.object({
    rows: z.array(alertItemSchema).max(5),
    total: countSchema,
    truncated: z.boolean(),
  }).strict(),
}).strict();

export const assessmentThroughputReportSchema = z.object({
  key: z.literal('assessment-throughput'),
  today: dateSchema,
  period: periodSchema,
  periodStart: dateSchema,
  released: z.object({
    months: z.array(z.object({ monthStart: dateSchema, count: countSchema, partial: z.boolean() }).strict()).max(12),
    total: countSchema,
  }).strict(),
  medianDaysToRelease: z.object({
    value: z.number().nonnegative().nullable(),
    sampleSize: countSchema,
    truncated: z.boolean(),
  }).strict(),
  requestsByStatus: requestStatusCountsSchema,
}).strict();

export const controlEffectivenessReportSchema = z.object({
  key: z.literal('control-effectiveness'),
  today: dateSchema,
  implementationStatus: controlStatusCountsSchema,
  effectivenessRating: effectivenessCountsSchema,
}).strict();

/** Any report, discriminated by its key. */
export const reportSchema = z.discriminatedUnion('key', [
  riskExposureReportSchema,
  treatmentPerformanceReportSchema,
  assessmentThroughputReportSchema,
  controlEffectivenessReportSchema,
]);

/** One closed response parser per report key: the response for one key never parses as another report. */
export const reportResponseSchemas = {
  'risk-exposure': z.object({ data: riskExposureReportSchema }).strict(),
  'treatment-performance': z.object({ data: treatmentPerformanceReportSchema }).strict(),
  'assessment-throughput': z.object({ data: assessmentThroughputReportSchema }).strict(),
  'control-effectiveness': z.object({ data: controlEffectivenessReportSchema }).strict(),
} as const satisfies Record<ReportKey, z.ZodType>;

export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;
export type RiskExposureReport = z.infer<typeof riskExposureReportSchema>;
export type TreatmentPerformanceReport = z.infer<typeof treatmentPerformanceReportSchema>;
export type AssessmentThroughputReport = z.infer<typeof assessmentThroughputReportSchema>;
export type ControlEffectivenessReport = z.infer<typeof controlEffectivenessReportSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportFor<K extends ReportKey> = Extract<Report, { key: K }>;

export function parseReportDefinitionListPayload(payload: unknown): ReportDefinition[] {
  return reportDefinitionListResponseSchema.parse(payload).data;
}

/** Parses the response for `key` with that key's own branch parser. */
export function parseReportPayload<K extends ReportKey>(key: K, payload: unknown): ReportFor<K> {
  return reportResponseSchemas[key].parse(payload).data as ReportFor<K>;
}

/**
 * One report read: the throughput report may name its period, and no other
 * report takes one. It is validated before any request.
 */
export const reportRequestSchema = z.union([
  z.object({ key: z.literal('assessment-throughput'), period: periodSchema.optional() }).strict(),
  z.object({ key: z.enum(['risk-exposure', 'treatment-performance', 'control-effectiveness']) }).strict(),
]);
export type ReportRequest = z.infer<typeof reportRequestSchema>;

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;

/**
 * The throughput report's URL value (`?period=`). Exactly 12 reads as twelve
 * months; anything else, or nothing, reads as the default of six (UI-D8).
 */
export const reportPeriodSchema = z.preprocess((value) => {
  const period = firstValue(value);
  return period === '12' || period === 12 ? 12 : 6;
}, periodSchema);
