import { z } from 'zod';
import { REVERT_REASON_MAX_LENGTH, revertReasonSchema } from '@/lib/schemas/revert-reason';
import {
  formatRequestDate,
  requestSortValues,
  requestLifecycleStepKeys,
  requestStatuses,
  type CsrmAssessmentRequest,
  type RequestRelationSummary,
  type RequestList,
  type RequestListQuery,
  type RequestStatus,
} from './request-domain';

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;

const queryText = z.preprocess(firstValue, z.string().trim().max(120).catch(''));
const queryStatus = z.preprocess(firstValue, z.enum(requestStatuses).optional().catch(undefined));
const querySort = z.preprocess(firstValue, z.enum(requestSortValues).catch('updatedAt:desc'));
const queryPage = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10_000);
}, z.number().int().min(1).max(10_000));
const queryPageSize = z.preprocess((value) => {
  const parsed = Number(firstValue(value));
  if (parsed > 50) return 50;
  return parsed === 10 || parsed === 20 || parsed === 50 ? parsed : 10;
}, z.union([z.literal(10), z.literal(20), z.literal(50)]));

export const requestListQuerySchema = z.object({
  q: queryText.default(''),
  status: queryStatus,
  sort: querySort.default('updatedAt:desc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(10),
}).strip();

const strapiString = z.string().trim().max(255);
const strapiText = z.string().max(65_535);
const documentIdSchema = z.string().trim().min(1).max(255);
export { REVERT_REASON_MAX_LENGTH, revertReasonSchema };
export const requestRevertSchema = z.object({ documentId: documentIdSchema, reason: revertReasonSchema }).strip();
const optionalDateSchema = z.union([z.literal(''), z.iso.date()])
  .transform((value) => value || undefined)
  .optional();

// Sponsor is intentionally absent: there is no least-privilege sponsor directory
// contract. Ownership and all workflow facts remain server-owned.
export const requestEditableFieldsSchema = z.object({
  title: strapiString.min(1, 'Enter a request title.'),
  description: strapiText.optional(),
  assessmentType: z.enum(['BAU', 'Project', 'Other']).optional(),
  division: strapiString.optional(),
  businessUnit: strapiString.optional(),
  businessPurpose: strapiText.optional(),
  businessCriticality: z.enum(['Low', 'Moderate', 'High', 'Critical']).optional(),
  thirdPartyInvolvement: z.boolean().optional(),
  thirdPartyDetails: strapiText.optional(),
  regulatoryRequirements: strapiText.optional(),
  dueDate: optionalDateSchema,
  informationSystems: z.array(documentIdSchema).max(1_000).optional(),
  informationAssets: z.array(documentIdSchema).max(1_000).optional(),
}).strip();

export const requestDraftSchema = requestEditableFieldsSchema;
export const requestUpdateSchema = requestEditableFieldsSchema.extend({
  documentId: documentIdSchema,
}).strip();
export const requestSubmitSchema = requestUpdateSchema;

export type RequestDraftInput = z.infer<typeof requestDraftSchema>;

export interface RequestMutationResult extends RequestDraftInput {
  documentId: string;
  requestNumber: string;
  requestStatus: (typeof requestStatuses)[number];
  submittedDate: string | null;
}

const relationSchema = z.object({
  documentId: documentIdSchema,
  name: z.string().min(1),
}).strip();

const questionnaireSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
}).strip();

const assessmentSchema = z.object({
  documentId: z.string().min(1),
  assessmentStatus: z.enum(['draft', 'in-review', 'approved', 'closed']),
}).strip();

const relationAbsentSchema = z.object({ availability: z.literal('absent') }).strict();
const relationUnavailableSchema = z.object({ availability: z.literal('unavailable') }).strict();
const residualRiskCountsSchema = z.object({
  Low: z.number().int().min(0), Moderate: z.number().int().min(0), High: z.number().int().min(0), Critical: z.number().int().min(0), total: z.number().int().min(0),
}).strict();
const requestQuestionnaireRelationSchema = z.discriminatedUnion('availability', [
  z.object({ availability: z.literal('available'), documentId: documentIdSchema, questionnaireNumber: z.string().nullable(), title: z.string().nullable(), state: z.string().nullable() }).strict(),
  relationAbsentSchema,
  relationUnavailableSchema,
]);
const requestAssessmentRelationSchema = z.discriminatedUnion('availability', [
  // The controls tally is optional: it belongs to the available member only,
  // and a response written before the request hub declared it still parses.
  z.object({ availability: z.literal('available'), documentId: documentIdSchema, assessmentNumber: z.string().nullable(), assessmentStatus: z.string().nullable(), residualRiskCounts: residualRiskCountsSchema, controlImplementationCount: z.number().int().min(0).optional() }).strict(),
  relationAbsentSchema,
  relationUnavailableSchema,
]);
const assessmentRequestRelationshipsSchema = z.object({ questionnaire: requestQuestionnaireRelationSchema, assessment: requestAssessmentRelationSchema }).strict();
const requestLifecycleStepSchema = z.object({
  key: z.enum(requestLifecycleStepKeys), label: z.string().min(1), state: z.enum(['completed', 'current', 'future']),
}).strict();
const requestLifecycleSchema = z.object({
  currentKey: z.enum(requestLifecycleStepKeys), currentLabel: z.string().min(1), terminal: z.boolean(),
  nextAction: z.object({ actor: z.enum(['requestor', 'analyst', 'none']), summary: z.string().min(1), href: z.string().min(1).optional() }).strict().nullable(),
  steps: z.array(requestLifecycleStepSchema).length(8),
}).strict().superRefine((value, context) => {
  const currentSteps = value.steps.filter((step) => step.state === 'current');
  if (value.terminal ? currentSteps.length !== 0 : currentSteps.length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Lifecycle must have exactly one current step unless terminal.' });
  }
  if (!value.terminal && currentSteps[0]?.key !== value.currentKey) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Lifecycle current key does not match its current step.' });
  }
});

const transportRequestSchema = z.object({
  documentId: z.string().min(1),
  requestNumber: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  assessmentType: z.enum(['BAU', 'Project', 'Other']).nullish(),
  division: z.string().nullish(),
  businessUnit: z.string().nullish(),
  businessPurpose: z.string().nullish(),
  businessCriticality: z.enum(['Low', 'Moderate', 'High', 'Critical']).nullish(),
  thirdPartyInvolvement: z.boolean().nullish(),
  thirdPartyDetails: z.string().nullish(),
  regulatoryRequirements: z.string().nullish(),
  requestStatus: z.enum(requestStatuses),
  submittedDate: z.string().nullish(),
  dueDate: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  informationSystems: z.array(relationSchema).nullish(),
  informationAssets: z.array(relationSchema).nullish(),
  requestor: z.object({ displayName: z.string().max(255).nullish() }).strip().nullish(),
  questionnaire: questionnaireSchema.nullish(),
  assessment: assessmentSchema.nullish(),
  relationships: assessmentRequestRelationshipsSchema.optional(),
  lifecycle: requestLifecycleSchema.optional(),
  revertReason: z.string().nullish(),
  revertedAt: z.string().nullish(),
  revertedBy: z.object({ documentId: documentIdSchema, displayName: z.string().nullish() }).nullish(),
}).strip();

const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  pageCount: z.number().int().min(0),
  total: z.number().int().min(0),
}).strip();

export const requestListPayloadSchema = z.object({
  data: z.array(transportRequestSchema),
  meta: z.object({ pagination: paginationSchema }).strip(),
}).strip();

export const requestDetailPayloadSchema = z.object({ data: transportRequestSchema }).strip();

export const requestMutationPayloadSchema = z.object({ data: transportRequestSchema }).strip();
const statusCountSchema = z.number().int().nonnegative();

/**
 * GET /v1/my_requests/status_summary: the signed-in actor's own requests
 * counted by status, closed at both levels. There is deliberately no check that
 * the counts sum to the total: the server owns the total, and the contract
 * parity guard synthesises every count independently.
 */
export const myRequestStatusSummaryResponseSchema = z.object({
  data: z.object({
    draft: statusCountSchema,
    submitted: statusCountSchema,
    questionnaireInProgress: statusCountSchema,
    riskAssessmentDrafted: statusCountSchema,
    underReview: statusCountSchema,
    approved: statusCountSchema,
    closed: statusCountSchema,
    total: statusCountSchema,
  }).strict(),
}).strict();

type MyRequestStatusSummaryCounts = z.infer<typeof myRequestStatusSummaryResponseSchema>['data'];

/** The published key that carries each request status's count; total over the status vocabulary. */
const statusSummaryKeys = {
  draft: 'draft',
  submitted: 'submitted',
  'questionnaire-in-progress': 'questionnaireInProgress',
  'risk-assessment-drafted': 'riskAssessmentDrafted',
  'under-review': 'underReview',
  approved: 'approved',
  closed: 'closed',
} as const satisfies Record<RequestStatus, Exclude<keyof MyRequestStatusSummaryCounts, 'total'>>;

export interface RequestStatusCount {
  status: RequestStatus;
  count: number;
}

/** Parses the status summary into one count per request status, in lifecycle order. */
export function parseMyRequestStatusSummaryPayload(payload: unknown): readonly RequestStatusCount[] {
  const counts = myRequestStatusSummaryResponseSchema.parse(payload).data;
  return requestStatuses.map((status) => ({ status, count: counts[statusSummaryKeys[status]] }));
}

export const requestInventoryPayloadSchema = z.object({
  data: z.array(relationSchema),
  // The bounded selector endpoint's published response guarantees the rows;
  // pagination metadata is an implementation detail the picker never reads.
  meta: z.object({ pagination: paginationSchema }).strip().optional(),
}).strip();

function toRequest(value: z.infer<typeof transportRequestSchema>): CsrmAssessmentRequest {
  const updatedAt = value.updatedAt ?? value.createdAt ?? null;
  const dueDate = value.dueDate ?? null;

  return {
    documentId: value.documentId,
    requestNumber: value.requestNumber,
    title: value.title,
    description: value.description ?? null,
    assessmentType: value.assessmentType ?? null,
    division: value.division ?? null,
    businessUnit: value.businessUnit ?? null,
    businessPurpose: value.businessPurpose ?? null,
    businessCriticality: value.businessCriticality ?? null,
    thirdPartyInvolvement: value.thirdPartyInvolvement ?? false,
    thirdPartyDetails: value.thirdPartyDetails ?? null,
    regulatoryRequirements: value.regulatoryRequirements ?? null,
    requestStatus: value.requestStatus,
    submittedDate: value.submittedDate ?? null,
    dueDate,
    updatedAt,
    dueDateLabel: formatRequestDate(dueDate),
    updatedDateLabel: formatRequestDate(updatedAt),
    informationSystems: value.informationSystems ?? [],
    informationAssets: value.informationAssets ?? [],
    requestorName: value.requestor?.displayName ?? null,
    questionnaire: value.questionnaire ?? null,
    assessment: value.assessment ?? null,
    relationships: value.relationships,
    lifecycle: value.lifecycle,
    revertReason: value.revertReason ?? null,
    revertedAt: value.revertedAt ?? null,
    revertedBy: value.revertedBy ? { documentId: value.revertedBy.documentId, displayName: value.revertedBy.displayName ?? null } : null,
  };
}

export function parseRequestListQuery(input: unknown): RequestListQuery {
  const parsed = requestListQuerySchema.parse(input);
  return { ...parsed, status: parsed.status };
}

export function parseRequestListPayload(payload: unknown): RequestList {
  const parsed = requestListPayloadSchema.parse(payload);
  return { requests: parsed.data.map(toRequest), pagination: parsed.meta.pagination };
}

export function parseRequestSummaryListPayload(payload: unknown): RequestList {
  const parsed = parseRequestListPayload(payload);
  return {
    ...parsed,
    requests: parsed.requests.map((request) => ({
      ...request,
      informationSystems: [],
      informationAssets: [],
      questionnaire: null,
      assessment: null,
    })),
  };
}

export function parseRequestDashboardListPayload(payload: unknown): RequestList {
  const parsed = parseRequestListPayload(payload);
  return {
    ...parsed,
    requests: parsed.requests.map((request) => ({
      ...request,
      informationSystems: [],
      informationAssets: [],
    })),
  };
}

export function parseRequestDetailPayload(payload: unknown): CsrmAssessmentRequest {
  return toRequest(requestDetailPayloadSchema.parse(payload).data);
}

export function parseRequestMutationPayload(payload: unknown): RequestMutationResult {
  const request = toRequest(requestMutationPayloadSchema.parse(payload).data);
  return {
    documentId: request.documentId,
    requestNumber: request.requestNumber,
    requestStatus: request.requestStatus,
    submittedDate: request.submittedDate ?? null,
    title: request.title,
    description: request.description ?? undefined,
    assessmentType: request.assessmentType ?? undefined,
    division: request.division ?? undefined,
    businessUnit: request.businessUnit ?? undefined,
    businessPurpose: request.businessPurpose ?? undefined,
    businessCriticality: request.businessCriticality ?? undefined,
    thirdPartyInvolvement: request.thirdPartyInvolvement,
    thirdPartyDetails: request.thirdPartyDetails ?? undefined,
    regulatoryRequirements: request.regulatoryRequirements ?? undefined,
    dueDate: request.dueDate ?? undefined,
    informationSystems: request.informationSystems.map(({ documentId }) => documentId),
    informationAssets: request.informationAssets.map(({ documentId }) => documentId),
  };
}

export function parseRequestInventoryPayload(payload: unknown): {
  data: readonly RequestRelationSummary[];
  pagination?: z.infer<typeof paginationSchema>;
} {
  const parsed = requestInventoryPayloadSchema.parse(payload);
  return { data: parsed.data, ...(parsed.meta ? { pagination: parsed.meta.pagination } : {}) };
}
