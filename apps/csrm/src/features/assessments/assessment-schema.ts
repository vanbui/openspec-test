import { z } from 'zod';
import { requestStatuses } from '@/features/requests/request-domain';
import { aiGenerationFactsSchema } from '@/features/ai-assistance/ai-generation-facts-schema';
import { requestSummaryAssignmentSchema, requestSummaryFilesSchema, requestSummaryNotesSchema } from '@/features/requests/request-summary-schema';
import { chooseRelationMessage, enterFieldMessage, maxCharactersMessage } from '@/lib/schemas/validation-messages';

import { assessmentRatings, assessmentStatuses } from './assessment-domain';

// These live in the zod-free assessment-domain.ts, so the editors and the review list run in the browser without zod.
export { assessmentRatings, assessmentStatuses, controlImplementationWritableFields, riskWritableFields } from './assessment-domain';

export const documentIdSchema = z.string().trim().min(1).max(255);
// The editors show a Server Action's messages under each field, so every text limit is stated in words (WR-04).
const boundedString = z.string().max(65_535, maxCharactersMessage(65_535));
const nullableString = boundedString.nullable();
const dateSchema = z.iso.date();
const nullableDateSchema = dateSchema.nullable();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();

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

/** A person the review queue names (ActiveUserSummary): a documentId and a display name, nothing else (D-04). */
export const queuePersonSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();
export type QueuePerson = z.infer<typeof queuePersonSchema>;

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
  // D-02 item 1: the facts the analyst triages by, each null when the request does not record it.
  requestorName: z.string().min(1).max(255).nullable(),
  assessmentType: z.enum(['BAU', 'Project', 'Other']).nullable(),
  // A business attribute the Requestor records, not a risk rating (UI-D27).
  businessCriticality: z.enum(['Low', 'Moderate', 'High', 'Critical']).nullable(),
  dueDate: nullableDateSchema,
  // The server's count from its UTC today, so no browser clock is read (D-29).
  daysSinceSubmission: z.number().int().nonnegative().nullable(),
  // D-13 (13-12): who holds it (ActiveUserSummary, which declares no bound), whether this viewer may pick it up, as
  // the assignment operation decides, and the viewer's new notes on it (D-24).
  assignee: queuePersonSchema.nullable(),
  pickUp: z.enum(['allowed', 'own-request', 'not-offered']),
  unreadNotes: z.number().int().nonnegative(),
}).strict();
export type AssessmentRequestQueueItem = z.infer<typeof assessmentRequestQueueItemSchema>;
export type QueuePickUp = AssessmentRequestQueueItem['pickUp'];

/*
 * D-18: every analyst on a request follows its jobs, so each job state says who started it (ActiveUserSummary, which
 * declares no bound; null when that person can no longer be read), whether this viewer did, and whether this viewer
 * may retry it ("the job failed and this viewer may retry it", never "this viewer started it").
 */
const jobInitiatorSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();
/*
 * D-18 (13-08): the job components declare these bounds, the server's nonBlank (at most 255) and the failure message's
 * 2,000, so the parsers check exactly them and nothing more: no .trim(), which the contract's minLength cannot express.
 */
const jobTextSchema = z.string().min(1).max(255);
const jobFailureMessageSchema = z.string().min(1).max(2_000);
/*
 * Phase 14 D-33: a CONTEXT_TOO_LARGE failure names the files included in the AI inputs, in upload order, by their
 * current names (null when the record is gone), so the analyst can exclude some. Closed: nothing else of a file crosses.
 */
const jobFailureAttachmentsSchema = z.array(z.object({ documentId: jobTextSchema, fileName: jobTextSchema.nullable() }).strict()).max(20);
const jobViewerShape = {
  canRetry: z.boolean(),
  initiatedBy: jobInitiatorSchema.nullable(),
  initiatedByViewer: z.boolean(),
};

const jobBaseShape = {
  jobId: jobTextSchema,
  questionnaireId: jobTextSchema,
  attempt: z.number().int().positive(),
  queuedAt: timestampSchema,
  ...jobViewerShape,
};

export const assessmentDraftJobSchema = z.discriminatedUnion('status', [
  z.object({ ...jobBaseShape, status: z.literal('queued') }).strict(),
  z.object({ ...jobBaseShape, status: z.literal('running'), startedAt: timestampSchema }).strict(),
  z.object({
    ...jobBaseShape,
    status: z.literal('completed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    assessmentId: jobTextSchema,
  }).strict(),
  z.object({
    ...jobBaseShape,
    status: z.literal('failed'),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    failureCode: jobTextSchema,
    failureMessage: jobFailureMessageSchema,
    failureAttachments: jobFailureAttachmentsSchema.optional(),
  }).strict(),
]);
export type AssessmentDraftJob = z.infer<typeof assessmentDraftJobSchema>;

const questionnaireGenerationBaseShape = {
  jobId: jobTextSchema,
  requestId: jobTextSchema,
  providerName: jobTextSchema,
  providerVersion: jobTextSchema,
  attempt: z.number().int().positive(),
  queuedAt: timestampSchema,
  ...jobViewerShape,
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
    failureCode: jobTextSchema,
    failureMessage: jobFailureMessageSchema,
    failureAttachments: jobFailureAttachmentsSchema.optional(),
  }).strict(),
]);
export type QuestionnaireGenerationJob = z.infer<typeof questionnaireGenerationJobSchema>;

/*
 * D-25: a request's current generation jobs, read by any human analyst who may
 * review the request. Each entry is the closed job the by-id reads already
 * parse, plus whether this viewer may retry it (D-18: the job failed and this
 * viewer may retry it, the job's own canRetry); either is null when there is no
 * such job in the server process.
 */
const dataClassificationSchema = z.enum(['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive']);
/* D-29: the AI data policy the next generation for this request would apply. */
export const aiPolicyStatusSchema = z.object({
  status: z.enum(['allowed', 'refused']),
  reason: z.enum(['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED']).nullable(),
  requestClassification: dataClassificationSchema,
  classificationSource: z.enum(['assets', 'default']),
  ceiling: dataClassificationSchema.nullable(),
}).strict();

export const requestGenerationJobsSchema = z.object({
  questionnaireGeneration: z.object({ job: questionnaireGenerationJobSchema, canRetry: z.boolean() }).strict().nullable(),
  assessmentDraft: z.object({ job: assessmentDraftJobSchema, canRetry: z.boolean() }).strict().nullable(),
  aiPolicy: aiPolicyStatusSchema,
}).strict();
export const requestGenerationJobsResponseSchema = z.object({ data: requestGenerationJobsSchema }).strict();
export type RequestGenerationJobs = z.infer<typeof requestGenerationJobsSchema>;

export const assessmentSummarySchema = z.object({
  documentId: documentIdSchema,
  assessmentNumber: z.string().trim().min(1).max(255),
  assessmentStatus: assessmentStatusSchema,
  summary: nullableString,
  overallRating: assessmentRatingSchema.nullable(),
  generatedDate: nullableTimestampSchema,
  generatedBy: activeUserSchema.nullable(),
  approvalDate: nullableTimestampSchema,
  // D-02 item 2, D-31: the request's title, the Risk count and the highest residual rating, all the server's.
  requestTitle: z.string().min(1).max(255).nullable(),
  riskCount: z.number().int().nonnegative(),
  highestResidualRating: assessmentRatingSchema.nullable(),
}).strict();
export type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

export const releasedAssessmentSummarySchema = assessmentSummarySchema.superRefine((assessment, context) => {
  if (assessment.assessmentStatus !== 'approved' || assessment.approvalDate === null) {
    context.addIssue({ code: 'custom', path: ['assessmentStatus'], message: 'Assessment is not released.' });
  }
});
export type ReleasedAssessmentSummary = z.infer<typeof releasedAssessmentSummarySchema>;

/*
 * D-23, WR-304, D10: what the Requestor's released assessment list renders. Its page hands the Client Component this
 * and nothing else, so neither a generating analyst nor a field the list never shows reaches her browser.
 */
export type ReleasedAssessmentListItem = Pick<ReleasedAssessmentSummary, 'documentId' | 'assessmentNumber' | 'requestTitle' | 'overallRating' | 'approvalDate'>;

export function releasedAssessmentListItem(assessment: ReleasedAssessmentSummary): ReleasedAssessmentListItem {
  const { documentId, assessmentNumber, requestTitle, overallRating, approvalDate } = assessment;
  return { documentId, assessmentNumber, requestTitle, overallRating, approvalDate };
}

export const assessmentRequestSummarySchema = z.object({
  documentId: documentIdSchema,
  requestNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  requestStatus: z.enum(requestStatuses),
  // Phase 13 D-16, D-25 and Phase 14 D-27: the analyst's read names the assignee, the notes and the files figures; every
  // other read serves null.
  assignment: requestSummaryAssignmentSchema.nullable().optional(),
  notes: requestSummaryNotesSchema.nullable().optional(),
  files: requestSummaryFilesSchema.nullable().optional(),
}).strict();
export type AssessmentRequestSummary = z.infer<typeof assessmentRequestSummarySchema>;

export const assessmentDetailShape = {
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

type ReleaseFacts = { assessmentStatus: string; assessmentDate: string | null; approvalDate: string | null; approvedBy: unknown };

/** A released assessment's facts: approved, with its assessment date, its release date and who released it. */
export function requireReleaseFacts(assessment: ReleaseFacts, context: z.RefinementCtx<ReleaseFacts>): void {
  if (assessment.assessmentStatus !== 'approved') {
    context.addIssue({ code: 'custom', path: ['assessmentStatus'], message: 'Assessment is not released.' });
  }
  for (const field of ['assessmentDate', 'approvalDate', 'approvedBy'] as const) {
    if (assessment[field] === null) {
      context.addIssue({ code: 'custom', path: [field], message: 'Released assessment fact is incomplete.' });
    }
  }
}

export const releasedAssessmentDetailSchema = assessmentDetailSchema.superRefine(requireReleaseFacts);
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
  // Entered as a date and saved at 00:00 UTC (D-32), so a malformed value only arrives from outside the form.
  exemptionReviewDate: z.iso.datetime({ offset: true, error: 'Enter a valid exemption review date.' }).nullable().optional(),
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

/*
 * D-34: one Risk in the assessment's risk list (AssessmentRiskListItem), the read both actors' released views
 * render. It carries the brief §8 treatment and ownership facts with each relation named; the Risk create and
 * update responses keep the five fields of riskSchema (research Pitfall 9). Every bound mirrors the contract,
 * and the owners mirror ActiveUserSummary, which declares none.
 */
const assessmentRiskRelatedRecordSchema = z.object({
  documentId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
}).strict();
const assessmentRiskPersonSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();
const assessmentRiskTextSchema = z.string().max(65_535).nullable();

export const assessmentRiskListItemSchema = z.object({
  documentId: z.string().min(1).max(255),
  riskNumber: z.string().min(1).max(255),
  riskStatement: assessmentRiskTextSchema,
  informationSystemImpacted: assessmentRiskRelatedRecordSchema.nullable(),
  informationAssetImpacted: assessmentRiskRelatedRecordSchema.nullable(),
  inherentLikelihood: assessmentRiskTextSchema,
  highestInherentConsequence: assessmentRiskTextSchema,
  inherentRating: assessmentRatingSchema.nullable(),
  residualLikelihood: assessmentRiskTextSchema,
  highestResidualConsequence: assessmentRiskTextSchema,
  residualRating: assessmentRatingSchema.nullable(),
  treatmentAction: z.enum(['Accept', 'Treat']).nullable(),
  treatmentPlan: assessmentRiskTextSchema,
  treatmentStatus: z.enum(['Not Started', 'In Progress', 'Overdue', 'Complete']).nullable(),
  riskOwner: assessmentRiskPersonSchema.nullable(),
  treatmentOwner: assessmentRiskPersonSchema.nullable(),
  targetDate: nullableDateSchema,
}).strict();
export type AssessmentRiskListItem = z.infer<typeof assessmentRiskListItemSchema>;
export const assessmentRiskListResponseSchema = z.object({
  data: z.array(assessmentRiskListItemSchema).max(1_000),
}).strict();

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

/*
 * Phase 12 D-12, D-14 and D-21: the analyst's view of what the AI wrote, closed at every level. A source the
 * proposing run no longer holds arrives labelled "Source no longer available"; the server never fails the read.
 */
export const aiSourceCitationSchema = z.object({
  key: z.string().trim().min(1).max(255),
  kind: z.enum(['request', 'answer', 'system', 'asset']),
  label: z.string().trim().min(1).max(300),
  section: z.string().max(300).nullable(),
  classification: z.string().max(64).nullable(),
}).strict();
export type AiSourceCitation = z.infer<typeof aiSourceCitationSchema>;

export const aiFieldReviewSchema = z.object({
  field: z.string().trim().min(1).max(64),
  state: z.enum(['proposed', 'accepted', 'edited']),
  by: activeUserSchema.nullable(),
  at: timestampSchema.nullable(),
  sources: z.array(aiSourceCitationSchema).max(100).nullable(),
}).strict();
export type AiFieldReview = z.infer<typeof aiFieldReviewSchema>;

export const aiSuggestionReviewSchema = z.object({
  key: z.string().trim().min(1).max(255),
  control: z.object({
    documentId: documentIdSchema,
    controlNumber: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(255),
    description: z.string().max(65_535).nullable(),
  }).strict(),
  rationale: z.string().trim().min(1).max(500),
  state: z.enum(['proposed', 'added', 'dismissed', 'present']),
  by: activeUserSchema.nullable(),
  at: timestampSchema.nullable(),
  implementation: documentIdSchema.nullable(),
}).strict();
export type AiSuggestionReview = z.infer<typeof aiSuggestionReviewSchema>;

export const riskAiProvenanceSchema = z.object({
  runId: documentIdSchema,
  proposalKey: z.string().trim().min(1).max(255),
  fields: z.array(aiFieldReviewSchema).max(20),
  uncitedClaims: z.array(z.string().trim().min(1).max(300)).max(5),
  suggestions: z.array(aiSuggestionReviewSchema).max(5),
  adjustments: z.array(z.string().trim().min(1).max(255)).max(100),
  outstanding: z.number().int().nonnegative(),
}).strict();
export type RiskAiProvenance = z.infer<typeof riskAiProvenanceSchema>;

export const assessmentAiProvenanceSchema = z.object({
  runId: documentIdSchema,
  fields: z.array(aiFieldReviewSchema).max(4),
  adjustments: z.array(z.string().trim().min(1).max(255)).max(100),
  outstanding: z.number().int().nonnegative(),
}).strict();
export type AssessmentAiProvenance = z.infer<typeof assessmentAiProvenanceSchema>;

/*
 * Phase 16 D-08, D-03 item 9: why, when and by whom a Risk was withdrawn (RiskWithdrawal), closed. Only the analyst's
 * read carries it; `by` mirrors ActiveUserSummary, which declares no bound, and the reason keeps the contract's 1-500.
 */
export const riskWithdrawalSchema = z.object({
  at: timestampSchema,
  by: z.object({ documentId: z.string(), displayName: z.string() }).strict().nullable(),
  reason: z.string().min(1).max(500),
}).strict();
export type RiskWithdrawal = z.infer<typeof riskWithdrawalSchema>;

export const analystRiskDetailSchema = analystRiskSchema.extend({
  aiProvenance: riskAiProvenanceSchema.nullable(),
  /** Null on an active Risk; a withdrawn Risk stays listed for the analyst, out of readiness (D-08, D-13). */
  withdrawal: riskWithdrawalSchema.nullable(),
}).strict();
export type AnalystRiskDetail = z.infer<typeof analystRiskDetailSchema>;

export const analystAssessmentDetailSchema = assessmentDetailSchema.extend({
  actor: z.literal('analyst'),
  risks: z.array(analystRiskDetailSchema).max(1_000),
  ownerLabels: z.array(activeUserSchema).max(2_000),
  releaseReadiness: releaseReadinessSchema,
  generation: aiGenerationFactsSchema.nullable(),
  aiProvenance: assessmentAiProvenanceSchema.nullable(),
}).strict();
/*
 * 19-10 (D-14): the served analyst detail also says whether the assessment is released, decided by Strapi's one
 * record-read check. Only server-only code parses it (assessment-server-schema.ts): client modules of the tight-budget
 * routes load this module, whose top-level schemas are not tree-shaken, so the flag is typed here and parsed there.
 */
export type AnalystAssessmentDetail = z.infer<typeof analystAssessmentDetailSchema> & { released: boolean };

/*
 * D-23: the Requestor learns only that AI assisted, nothing of the provenance, and not who generated the draft
 * (WR-304, IN-107: UAT-032 removed "Generated by", and Strapi no longer serves it). The read is closed, so a
 * generator served to a Requestor is refused rather than passed on.
 */
const { generatedBy: _analystOnlyGenerator, ...requestorReleasedDetailShape } = assessmentDetailShape;
export const requestorReleasedAssessmentDetailSchema = z.object({
  ...requestorReleasedDetailShape,
  actor: z.literal('requestor'),
  aiAssisted: z.boolean(),
}).strict().superRefine(requireReleaseFacts);
export type RequestorReleasedAssessmentDetail = z.infer<typeof requestorReleasedAssessmentDetailSchema>;

/*
 * The released page's parse of either actor's detail moved to the server-only assessment-server-schema.ts (19-10), with
 * the analyst detail's released flag it needs; its type stays importable here, erased at build time.
 */
export type { ReleasedAssessmentDetailForActor } from './assessment-server-schema';

/*
 * D-34: the control a mitigation control implements, named by the served summary so no screen falls back to
 * its id. The bounds mirror ControlImplementationControlSummary in the contract (the Administration control
 * record's), and the summary is null when the populated control lacks any of them.
 */
export const controlImplementationControlSummarySchema = z.object({
  documentId: z.string().min(1).max(255),
  controlNumber: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  framework: z.string().min(1).max(255),
}).strict();
export type ControlImplementationControlSummary = z.infer<typeof controlImplementationControlSummarySchema>;

/*
 * D-31: a control that applies to a Risk Type, as the picker's Risk Type list serves it (RiskTypeApplicableControl).
 * It has the control summary's exact contract bounds, so it is the same object.
 */
export const riskTypeApplicableControlSchema = controlImplementationControlSummarySchema;
export type RiskTypeApplicableControl = z.infer<typeof riskTypeApplicableControlSchema>;

export const riskTypeSchema = z.object({
  documentId: documentIdSchema,
  name: z.string().trim().min(1).max(255),
  description: nullableString,
  applicableControls: z.array(riskTypeApplicableControlSchema).max(1_000),
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
  control: z.string({ error: chooseRelationMessage('control') })
    .trim()
    .min(1, chooseRelationMessage('control'))
    .max(255),
}).strict();
export type ControlImplementationCreateInput = z.infer<typeof controlImplementationCreateInputSchema>;
export type ControlImplementationUpdateInput = z.infer<typeof controlImplementationUpdateInputSchema>;

export const controlImplementationSchema = z.object({
  documentId: documentIdSchema,
  control: documentIdSchema,
  controlSummary: controlImplementationControlSummarySchema.nullable(),
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
