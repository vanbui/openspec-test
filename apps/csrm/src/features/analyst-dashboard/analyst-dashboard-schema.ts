import { z } from 'zod';

import type { components } from '../../lib/api/generated/schema';
import { ratingCountsSchema } from '../reports/report-schema';
import { riskRegisterRatings, riskTreatmentDueStates, type RiskTreatmentDueState } from '../risks/risk-schema';

type Schemas = components['schemas'];

/** True only when two unions hold exactly the same members. */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/*
 * The analyst dashboard summary (DASH-01, D-34). Strapi computes every figure,
 * every treatment due state and the activity feed; the client renders what it
 * is given and never re-derives a count, a state or an order. Each vocabulary
 * is checked against its published union in both directions, so a contract
 * change fails the typecheck until it is mirrored. The identifier bounds below
 * (documentIds, the risk number and the activity identifier: min(1) and
 * max(255)) mirror the minLength and maxLength the contract declares on
 * DashboardRiskRow and ActivityItem, so they narrow nothing. No schema below
 * narrows the contract with a minimum count, an exact length or a cross-field
 * refinement; the max(65_535) caps on the free-text risk statement, title and
 * actor display name are the one client narrowing, registered beside the
 * parser in analyst-dashboard-service.ts.
 */

/** The workflow events recent activity lists (UI-SPEC §2.5.1). */
export const activityKinds = [
  'request-submitted',
  'request-returned-to-draft',
  'questionnaire-generated',
  'questionnaire-released',
  'questionnaire-returned-to-draft',
  'assessment-draft-generated',
  'assessment-released',
] as const satisfies readonly Schemas['ActivityKind'][];
export type ActivityKind = (typeof activityKinds)[number];

/** The records an activity event can be about. */
export const activityRecordTypes = [
  'assessment-request',
  'questionnaire',
  'assessment',
] as const satisfies readonly Schemas['ActivityItem']['recordType'][];
export type ActivityRecordType = (typeof activityRecordTypes)[number];

/** The residual ratings the High and Critical widget lists, most severe first: a part of the register's ladder. */
export const highCriticalRatings = ['Critical', 'High'] as const satisfies readonly (typeof riskRegisterRatings)[number][];
export type HighCriticalRating = (typeof highCriticalRatings)[number];

const dashboardVocabulariesMatchTheContract = {
  activityKinds: true satisfies SameUnion<ActivityKind, Schemas['ActivityKind']>,
  activityRecordTypes: true satisfies SameUnion<ActivityRecordType, Schemas['ActivityItem']['recordType']>,
  highCriticalRatings: true satisfies SameUnion<HighCriticalRating, Schemas['DashboardRiskRow']['residualRating']>,
  treatmentDueStates: true satisfies SameUnion<RiskTreatmentDueState, Schemas['TreatmentDueState']>,
} as const;
void dashboardVocabulariesMatchTheContract;

const countSchema = z.number().int().nonnegative();
const documentIdSchema = z.string().min(1).max(255);

const dashboardReviewQueueSchema = z.object({
  requiresAttention: countSchema,
  awaitingRequestor: countSchema,
  generationInProgress: countSchema,
  questionnairesReadyForReview: countSchema,
  assessmentsDraft: countSchema,
  assessmentsInReview: countSchema,
}).strict();

export const dashboardRiskRowSchema = z.object({
  documentId: documentIdSchema,
  riskNumber: z.string().min(1).max(255),
  riskStatement: z.string().max(65_535).nullable(),
  residualRating: z.enum(highCriticalRatings),
  targetDate: z.iso.date().nullable(),
  treatmentDueState: z.enum(riskTreatmentDueStates),
}).strict();

/**
 * One workflow event. A questionnaire may have no number, so `identifier` may
 * be null, and the title then carries the row. `actorDisplayName` is null when
 * the event names no one: a generated draft is advisory and never attributed.
 */
export const activityItemSchema = z.object({
  kind: z.enum(activityKinds),
  recordType: z.enum(activityRecordTypes),
  documentId: documentIdSchema,
  identifier: z.string().min(1).max(255).nullable(),
  title: z.string().max(65_535).nullable(),
  actorDisplayName: z.string().max(65_535).nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
}).strict();

const dashboardSummarySchema = z.object({
  today: z.iso.date(),
  dueSoonWindowDays: z.number().int().min(1),
  reviewQueue: dashboardReviewQueueSchema,
  riskExposure: ratingCountsSchema,
  highCriticalRisks: z.object({
    rows: z.array(dashboardRiskRowSchema).max(5),
    total: countSchema,
    truncated: z.boolean(),
  }).strict(),
  treatmentsDue: z.object({
    overdue: countSchema,
    dueSoon: countSchema,
    total: countSchema,
  }).strict(),
  recentActivity: z.object({
    rows: z.array(activityItemSchema).max(8),
    truncated: z.boolean(),
  }).strict(),
}).strict();

export const dashboardSummaryResponseSchema = z.object({ data: dashboardSummarySchema }).strict();

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type DashboardReviewQueue = z.infer<typeof dashboardReviewQueueSchema>;
export type DashboardRiskRow = z.infer<typeof dashboardRiskRowSchema>;
export type ActivityItem = z.infer<typeof activityItemSchema>;

export function parseDashboardSummaryPayload(payload: unknown): DashboardSummary {
  return dashboardSummaryResponseSchema.parse(payload).data;
}
