import { z } from 'zod';
import { requestStatuses } from '@/features/requests/request-domain';
import { enterFieldMessage, maxCharactersMessage, selectRelationMessage } from '@/lib/schemas/validation-messages';

import { assessmentStatuses } from './assessment-domain';

// These live in the zod-free assessment-domain.ts, so the editors and the review list run in the browser without zod.
export { assessmentStatuses, controlImplementationWritableFields, riskWritableFields } from './assessment-domain';

export const documentIdSchema = z.string().trim().min(1).max(255);
// The editors show a Server Action's messages under each field, so every text limit is stated in words (WR-04).
const boundedString = z.string().max(65_535, maxCharactersMessage(65_535));
const nullableString = boundedString.nullable();
const dateSchema = z.iso.date();
const nullableDateSchema = dateSchema.nullable();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();

export const assessmentRatings = ['Low', 'Moderate', 'High', 'Critical'] as const;
export const assessmentRatingSchema = z.enum(assessmentRatings);
export type AssessmentRating = z.infer<typeof assessmentRatingSchema>;

export const assessmentStatusSchema = z.enum(assessmentStatuses);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const controlEffectivenessValues = [
  'Effective',
  'Partially Effective',
  'Ineffective',
  'Not Assessed',
] as const;
export const controlEffectivenessSchema = z.enum(controlEffectivenessValues);

export const activeUserSchema = z.object({
  documentId: documentIdSchema,
  displayName: z.string().trim().min(1).max(255),
}).strict();
export type ActiveUser = z.infer<typeof activeUserSchema>;

export const assessmentRequestQueueItemSchema = z.object({
  documentId: documentIdSchema,
  requestNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  // Every status a review queue reads: the Released queue returns approved and
  // closed requests, and no queue returns a draft.
  requestStatus: z.enum([
    'submitted',
    'questionnaire-in-progress',
    'risk-assessment-drafted',
    'under-review',
    'approved',
    'closed',
  ]),
  submittedDate: nullableTimestampSchema,
}).strict();
export type AssessmentRequestQueueItem = z.infer<typeof assessmentRequestQueueItemSchema>;

const jobBaseShape = {
  jobId: documentIdSchema,
  questionnaireId: documentIdSchema,
  attempt: z.number().int().positive(),
  queuedAt: timestampSchema,
};

export const assessmentDraftJobSchema = z.discriminatedUnion('status', [
  z.object({ ...jobBaseShape, status: z.literal('queued') }).strict(),
  z.object({ ...jobBaseShape, status: z.literal('running'), startedAt: timestampSchema }).strict(),
  z.object({
    ...jobBaseShape,
    status: z.literal('completed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    assessmentId: documentIdSchema,
  }).strict(),
  z.object({
    ...jobBaseShape,
    status: z.literal('failed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    failureCode: z.string().trim().min(1).max(255),
    failureMessage: z.string().trim().min(1).max(2_000),
  }).strict(),
]);
export type AssessmentDraftJob = z.infer<typeof assessmentDraftJobSchema>;

const questionnaireGenerationBaseShape = {
  jobId: documentIdSchema,
  requestId: documentIdSchema,
  providerName: z.string().trim().min(1).max(255),
  providerVersion: z.string().trim().min(1).max(255),
  attempt: z.number().int().positive(),
  queuedAt: timestampSchema,
};

const generatedByDocumentSchema = z.object({
  documentId: documentIdSchema,
  id: z.number().int().positive(),
  email: z.string().email().max(255),
  username: z.string().trim().min(1).max(255),
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
  displayName: z.string().trim().min(1).max(255),
  accountStatus: z.enum(['active', 'inactive']),
  externalSubject: z.string().max(255).optional(),
  createdAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
  publishedAt: timestampSchema,
}).strict();

/*
 * Mirrors the bounded GeneratedQuestionnaireSummary the server projects. It is
 * deliberately not the whole questionnaire record: parsing the raw document
 * with a closed schema made every new attribute on CsrmQuestionnaire a
 * breaking change for this route.
 */
const generatedQuestionnaireActorSchema = z.object({
  documentId: documentIdSchema,
  displayName: z.string().trim().max(255).nullable(),
}).strict();

const generatedQuestionnaireSchema = z.object({
  documentId: documentIdSchema,
  questionnaireNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  generatedDate: nullableTimestampSchema,
  generatedBy: generatedQuestionnaireActorSchema.nullable(),
}).strict();

export const questionnaireGenerationJobSchema = z.discriminatedUnion('status', [
  z.object({ ...questionnaireGenerationBaseShape, status: z.literal('queued') }).strict(),
  z.object({ ...questionnaireGenerationBaseShape, status: z.literal('running'), startedAt: timestampSchema }).strict(),
  z.object({
    ...questionnaireGenerationBaseShape,
    status: z.literal('completed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    questionnaire: generatedQuestionnaireSchema,
  }).strict(),
  z.object({
    ...questionnaireGenerationBaseShape,
    status: z.literal('failed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    failureCode: z.string().trim().min(1).max(255),
    failureMessage: z.string().trim().min(1).max(2_000),
  }).strict(),
]);
export type QuestionnaireGenerationJob = z.infer<typeof questionnaireGenerationJobSchema>;

export const assessmentSummarySchema = z.object({
  documentId: documentIdSchema,
  assessmentNumber: z.string().trim().min(1).max(255),
  assessmentStatus: assessmentStatusSchema,
  summary: nullableString,
  overallRating: assessmentRatingSchema.nullable(),
  generatedDate: nullableTimestampSchema,
  generatedBy: activeUserSchema.nullable(),
  approvalDate: nullableTimestampSchema,
}).strict();
export type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

export const releasedAssessmentSummarySchema = assessmentSummarySchema.superRefine((assessment, context) => {
  if (assessment.assessmentStatus !== 'approved' || assessment.approvalDate === null) {
    context.addIssue({ code: 'custom', path: ['assessmentStatus'], message: 'Assessment is not released.' });
  }
});
export type ReleasedAssessmentSummary = z.infer<typeof releasedAssessmentSummarySchema>;

export const assessmentRequestSummarySchema = z.object({
  documentId: documentIdSchema,
  requestNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  requestStatus: z.enum(requestStatuses),
}).strict();
export type AssessmentRequestSummary = z.infer<typeof assessmentRequestSummarySchema>;

const assessmentDetailShape = {
  documentId: documentIdSchema,
  assessmentNumber: z.string().trim().min(1).max(255),
  assessmentStatus: assessmentStatusSchema,
  assessmentDate: nullableTimestampSchema,
  generatedDate: nullableTimestampSchema,
  nextReviewDate: nullableDateSchema,
  approvalDate: nullableTimestampSchema,
  summary: nullableString,
  overallRating: assessmentRatingSchema.nullable(),
  overallControlEffectiveness: controlEffectivenessSchema.nullable(),
  recommendationsSummary: nullableString,
  overallRiskRationale: nullableString,
  assessmentRequest: assessmentRequestSummarySchema,
  generatedBy: activeUserSchema.nullable(),
  reviewedBy: activeUserSchema.nullable(),
  approvedBy: activeUserSchema.nullable(),
};

export const assessmentDetailSchema = z.object(assessmentDetailShape).strict();
export type AssessmentDetail = z.infer<typeof assessmentDetailSchema>;

export const releasedAssessmentDetailSchema = assessmentDetailSchema.superRefine((assessment, context) => {
  if (assessment.assessmentStatus !== 'approved') {
    context.addIssue({ code: 'custom', path: ['assessmentStatus'], message: 'Assessment is not released.' });
  }
  for (const field of ['assessmentDate', 'approvalDate', 'approvedBy'] as const) {
    if (assessment[field] === null) {
      context.addIssue({ code: 'custom', path: [field], message: 'Released assessment fact is incomplete.' });
    }
  }
});
export type ReleasedAssessmentDetail = z.infer<typeof releasedAssessmentDetailSchema>;

export const assessmentUpdateInputSchema = z.object({
  summary: boundedString.optional(),
  overallRating: assessmentRatingSchema.optional(),
  overallControlEffectiveness: controlEffectivenessSchema.optional(),
  recommendationsSummary: boundedString.optional(),
  overallRiskRationale: boundedString.optional(),
  nextReviewDate: nullableDateSchema.optional(),
}).strict();
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateInputSchema>;

const optionalNullableText = nullableString.optional();
const optionalNullableId = documentIdSchema.nullable().optional();
const optionalNullableDate = nullableDateSchema.optional();
const riskInputShape = {
  issueStatement: optionalNullableText,
  riskStatement: optionalNullableText,
  riskCategory: optionalNullableText,
  riskSubCategory: optionalNullableText,
  riskCause: optionalNullableText,
  potentialImpact: optionalNullableText,
  riskType: optionalNullableId,
  riskOwner: optionalNullableId,
  informationSystemImpacted: optionalNullableId,
  informationAssetImpacted: optionalNullableId,
  dataClassification: z.enum(['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive']).nullable().optional(),
  inherentLikelihood: optionalNullableText,
  highestInherentConsequence: optionalNullableText,
  inherentRating: assessmentRatingSchema.nullable().optional(),
  inherentRatingRationale: optionalNullableText,
  residualLikelihood: optionalNullableText,
  highestResidualConsequence: optionalNullableText,
  residualRating: assessmentRatingSchema.nullable().optional(),
  residualRatingRationale: optionalNullableText,
  controlEffectiveness: controlEffectivenessSchema.nullable().optional(),
  riskVelocity: z.enum(['Low', 'Moderate', 'High', 'Very High']).nullable().optional(),
  identifiedDate: optionalNullableDate,
  targetDate: optionalNullableDate,
  closureDate: optionalNullableDate,
  isExempted: z.boolean().nullable().optional(),
  // Typed as text, so its format is the one message an analyst can meet here (the field's hint shows it).
  exemptionReviewDate: z.iso.datetime({ offset: true, error: 'Enter the date and time as YYYY-MM-DDTHH:mm:ssZ.' }).nullable().optional(),
  escalationDetails: optionalNullableText,
  comments: optionalNullableText,
  riskCommunicationDate: optionalNullableDate,
  treatmentAction: z.enum(['Accept', 'Treat']).nullable().optional(),
  treatmentPlan: optionalNullableText,
  treatmentOwner: optionalNullableId,
  treatmentResolveDate: optionalNullableDate,
  treatmentStatus: z.enum(['Not Started', 'In Progress', 'Overdue', 'Complete']).nullable().optional(),
};

export const riskUpdateInputSchema = z.object(riskInputShape).strict();
export const riskCreateInputSchema = riskUpdateInputSchema.extend({
  // Add Risk sends an emptied statement as null, so a missing value and a blank one ask for it alike.
  riskStatement: z.string({ error: enterFieldMessage('Risk statement') })
    .trim()
    .min(1, enterFieldMessage('Risk statement'))
    .max(65_535, maxCharactersMessage(65_535)),
}).strict();
export type RiskCreateInput = z.infer<typeof riskCreateInputSchema>;
export type RiskUpdateInput = z.infer<typeof riskUpdateInputSchema>;

export const analystRiskSchema = riskUpdateInputSchema.required().extend({
  documentId: documentIdSchema,
  riskNumber: z.string().trim().min(1).max(255),
}).strict();
export type AnalystRisk = z.infer<typeof analystRiskSchema>;

export const riskSchema = z.object({
  documentId: documentIdSchema,
  riskNumber: z.string().trim().min(1).max(255),
  riskStatement: nullableString,
  inherentRating: assessmentRatingSchema.nullable(),
  residualRating: assessmentRatingSchema.nullable(),
}).strict();
export type Risk = z.infer<typeof riskSchema>;

const releaseReadinessRequirementBase = {
  key: z.string().trim().min(1).max(65_535),
  label: z.string().trim().min(1).max(65_535),
  state: z.enum(['met', 'outstanding']),
};

const assessmentReleaseReadinessRequirementSchema = z.object({
  ...releaseReadinessRequirementBase,
  scope: z.literal('assessment'),
  destination: z.string().trim().min(1).max(65_535).optional(),
}).strict();

const riskReleaseReadinessRequirementSchema = z.object({
  ...releaseReadinessRequirementBase,
  scope: z.literal('risk'),
  riskNumber: z.string().trim().min(1).max(255),
  destination: z.string().trim().min(1).max(65_535),
}).strict();

export const releaseReadinessRequirementSchema = z.discriminatedUnion('scope', [
  assessmentReleaseReadinessRequirementSchema,
  riskReleaseReadinessRequirementSchema,
]);
export type ReleaseReadinessRequirement = z.infer<typeof releaseReadinessRequirementSchema>;

export const releaseReadinessSchema = z.object({
  ready: z.boolean(),
  requirements: z.array(releaseReadinessRequirementSchema).max(20_000).superRefine((requirements, context) => {
    const identities = new Set<string>();
    for (const [index, requirement] of requirements.entries()) {
      const identity = requirement.scope === 'risk'
        ? `${requirement.scope}:${requirement.riskNumber}:${requirement.key}`
        : `${requirement.scope}:${requirement.key}`;
      if (identities.has(identity)) {
        context.addIssue({ code: 'custom', path: [index], message: 'Release readiness requirement identity must be unique.' });
      }
      identities.add(identity);
    }
  }),
}).strict();
export type ReleaseReadiness = z.infer<typeof releaseReadinessSchema>;

export const analystAssessmentDetailSchema = assessmentDetailSchema.extend({
  actor: z.literal('analyst'),
  risks: z.array(analystRiskSchema).max(1_000),
  ownerLabels: z.array(activeUserSchema).max(2_000),
  releaseReadiness: releaseReadinessSchema,
}).strict();
export type AnalystAssessmentDetail = z.infer<typeof analystAssessmentDetailSchema>;

export const requestorReleasedAssessmentDetailSchema = releasedAssessmentDetailSchema.extend({
  actor: z.literal('requestor'),
}).strict();
export type RequestorReleasedAssessmentDetail = z.infer<typeof requestorReleasedAssessmentDetailSchema>;

/**
 * `/v1/risk_assessments/{id}` serves the analyst detail to an analyst and the
 * Requestor detail to a Requestor, discriminated by `actor` exactly as the
 * contract declares. The released screen shows the same released facts either
 * way, so it accepts both and keeps only the fields it renders — an analyst
 * opening their own released assessment from the My screen must not be told the
 * assessment could not be loaded.
 */
export const releasedAssessmentDetailForActorSchema = z
  .discriminatedUnion('actor', [analystAssessmentDetailSchema, requestorReleasedAssessmentDetailSchema])
  .transform((detail, context) => {
    const released: Record<string, unknown> = {};
    for (const key of Object.keys(assessmentDetailSchema.shape)) {
      released[key] = (detail as Record<string, unknown>)[key];
    }
    const parsed = releasedAssessmentDetailSchema.safeParse(released);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
      return z.NEVER;
    }
    return { ...parsed.data, actor: detail.actor };
  });
export type ReleasedAssessmentDetailForActor = z.infer<typeof releasedAssessmentDetailForActorSchema>;

export const riskTypeSchema = z.object({
  documentId: documentIdSchema,
  name: z.string().trim().min(1).max(255),
  description: nullableString,
}).strict();
export type RiskType = z.infer<typeof riskTypeSchema>;

export const controlSchema = z.object({
  documentId: documentIdSchema,
  controlNumber: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  description: nullableString,
}).strict();
export type Control = z.infer<typeof controlSchema>;

const controlImplementationInputShape = {
  control: optionalNullableId,
  controlOwner: optionalNullableId,
  controlStatus: z.enum(['Existing', 'Planned', 'Implemented', 'Retired']).nullable().optional(),
  effectivenessRating: controlEffectivenessSchema.nullable().optional(),
  evidence: optionalNullableText,
  implementationDueDate: optionalNullableDate,
  implementedDate: optionalNullableDate,
  reviewDate: optionalNullableDate,
};

export const controlImplementationUpdateInputSchema = z.object(controlImplementationInputShape).strict();
export const controlImplementationCreateInputSchema = controlImplementationUpdateInputSchema.extend({
  // Add mitigation control sends no choice as null; the Risk detail's form asks the same way (WR-04).
  control: z.string({ error: selectRelationMessage('reusable Control') })
    .trim()
    .min(1, selectRelationMessage('reusable Control'))
    .max(255),
}).strict();
export type ControlImplementationCreateInput = z.infer<typeof controlImplementationCreateInputSchema>;
export type ControlImplementationUpdateInput = z.infer<typeof controlImplementationUpdateInputSchema>;

export const controlImplementationSchema = z.object({
  documentId: documentIdSchema,
  control: documentIdSchema,
  controlOwner: activeUserSchema.nullable(),
  controlStatus: z.enum(['Existing', 'Planned', 'Implemented', 'Retired']).nullable(),
  effectivenessRating: controlEffectivenessSchema.nullable(),
  evidence: nullableString,
  implementationDueDate: nullableDateSchema,
  implementedDate: nullableDateSchema,
  reviewDate: nullableDateSchema,
}).strict();
export type ControlImplementation = z.infer<typeof controlImplementationSchema>;

export const assessmentStatusSummarySchema = z.object({
  draft: z.number().int().nonnegative(),
  inReview: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();

export const assessmentRatingSummarySchema = z.object({
  Low: z.number().int().nonnegative(),
  Moderate: z.number().int().nonnegative(),
  High: z.number().int().nonnegative(),
  Critical: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();

export type AssessmentActionResult<T, V = never> =
  | { ok: true; data: T }
  | {
      ok: false;
      values?: V;
      fieldErrors?: Record<string, string[] | undefined>;
      formError: string;
    };
