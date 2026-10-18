import 'server-only';

import { z } from 'zod';

import type { components, paths } from '../../lib/api/generated/schema';
import { requestStatuses } from '@/features/requests/request-domain';
import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { ExportFileFormat } from '../../lib/files/file-response';
import { checkExportResponse, EXPORT_FILE_CONTENT_TYPES, listExportParams, type ExportResult, type ListExportOptions } from '../exports/export-file-check';
import {
  activeUserSchema,
  assessmentDraftJobSchema,
  questionnaireGenerationJobSchema,
  requestGenerationJobsResponseSchema,
  assessmentRatingSchema,
  assessmentRatingSummarySchema,
  assessmentRequestQueueItemSchema,
  queuePersonSchema,
  type QueuePerson,
  assessmentRiskListResponseSchema,
  assessmentStatusSummarySchema,
  assessmentStatusSchema,
  assessmentSummarySchema,
  assessmentDetailSchema,
  assessmentUpdateInputSchema,
  controlImplementationCreateInputSchema,
  controlImplementationSchema,
  controlImplementationUpdateInputSchema,
  controlSchema,
  documentIdSchema,
  releasedAssessmentDetailSchema,
  requestorReleasedAssessmentDetailSchema,
  releasedAssessmentSummarySchema,
  riskCreateInputSchema,
  riskSchema,
  riskTypeSchema,
  riskUpdateInputSchema,
  type ActiveUser,
  type AnalystAssessmentDetail,
  type AssessmentDetail,
  type AssessmentDraftJob,
  type QuestionnaireGenerationJob,
  type RequestGenerationJobs,
  type AssessmentRating,
  type AssessmentRiskListItem,
  type AssessmentSummary,
  type AssessmentUpdateInput,
  type Control,
  type ControlImplementation,
  type ControlImplementationCreateInput,
  type ControlImplementationUpdateInput,
  type ReleasedAssessmentDetail,
  type ReleasedAssessmentSummary,
  type Risk,
  type RiskCreateInput,
  type RiskType,
  type RiskUpdateInput,
} from './assessment-schema';
import {
  analystAssessmentReadSchema,
  releasedAssessmentDetailForActorSchema,
  type ReleasedAssessmentDetailForActor,
} from './assessment-server-schema';

export type { TransportResult } from '../../lib/api/transport/server-client';

type AssessmentUpdateBody = components['schemas']['AssessmentUpdateRequest'];
type RiskMutationBody = components['schemas']['RiskMutationRequest'];
type ControlImplementationMutationBody = components['schemas']['ControlImplementationMutationRequest'];

const responseOf = <T extends z.ZodType>(schema: T) => z.object({ data: schema }).strict();
const listResponseOf = <T extends z.ZodType>(schema: T) => responseOf(z.array(schema).max(10_000));
const paginatedResponseOf = <T extends z.ZodType>(schema: T) => z.object({
  data: z.array(schema).max(10_000),
  meta: z.object({ pagination: z.object({ page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), pageCount: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict() }).strict(),
}).strict();

/* D-13 (13-12): the queue read names its viewer, whom the queue's Pick up sends as the analyst. */
const requestQueueResponseSchema = z.object({
  data: z.array(assessmentRequestQueueItemSchema).max(10_000),
  meta: z.object({
    pagination: z.object({ page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), pageCount: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
    viewer: queuePersonSchema,
  }).strict(),
}).strict();
const jobResponseSchema = responseOf(assessmentDraftJobSchema);
const questionnaireGenerationJobResponseSchema = responseOf(questionnaireGenerationJobSchema);
const analystAssessmentListResponseSchema = paginatedResponseOf(assessmentSummarySchema);
const releasedAssessmentListResponseSchema = paginatedResponseOf(releasedAssessmentSummarySchema);
const assessmentStatusResponseSchema = responseOf(assessmentStatusSummarySchema);
// 19-10 (D-14): the analyst detail with its released flag, parsed only here, in server-only code.
const analystAssessmentResponseSchema = responseOf(analystAssessmentReadSchema);
const releasedAssessmentResponseSchema = responseOf(releasedAssessmentDetailSchema);
const requestorReleasedAssessmentResponseSchema = responseOf(requestorReleasedAssessmentDetailSchema);
const releasedAssessmentDetailGetResponseSchema = responseOf(releasedAssessmentDetailForActorSchema);
const assessmentResponseSchema = responseOf(assessmentDetailSchema);
const riskResponseSchema = responseOf(riskSchema);
const controlImplementationResponseSchema = responseOf(controlImplementationSchema);
const controlImplementationListResponseSchema = listResponseOf(controlImplementationSchema);
const riskTypeListResponseSchema = listResponseOf(riskTypeSchema);
const controlListResponseSchema = listResponseOf(controlSchema);
const activeUserListResponseSchema = responseOf(z.array(activeUserSchema).max(20));
const ratingSummaryResponseSchema = responseOf(assessmentRatingSummarySchema);

/**
 * The response parsers the contract parity guard compares against
 * docs/references/specification.json.  Every drift defect found so far was a
 * served payload the client's closed schema rejected, which the route/catalogue
 * parity suites cannot see because they never look at the Zod layer.
 */
export type ContractResponseParser = {
  /** The client operation whose response this parser guards. */
  readonly label: string;
  /** The `components.schemas` entry in docs/references/specification.json. */
  readonly component?: string;
  /** An inline success schema identified by its published operation path. */
  readonly path?: string;
  readonly method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  readonly parser: z.ZodType;
  /** Which branch of a union component this endpoint actually serves. */
  readonly branch?: string;
  /** Paths where the client is deliberately narrower than a shared component. */
  readonly narrowedPaths?: readonly string[];
};

export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'listAssessmentRequests', component: 'AssessmentRequestQueueResponse', parser: requestQueueResponseSchema },
  { label: 'getAssessmentDraftJob', component: 'AssessmentDraftJobResponse', parser: jobResponseSchema },
  {
    label: 'getQuestionnaireGenerationJob',
    component: 'QuestionnaireGenerationJobResponse',
    parser: questionnaireGenerationJobResponseSchema,
    // QuestionnaireGenerationJob is declared as one flat object with optional
    // per-state fields, while its sibling AssessmentDraftJob is a discriminated
    // oneOf and the client models both as unions. Recorded in
    // docs/contract-gaps/; the restructure belongs to the phase that owns
    // questionnaire generation. The queued job the guard is served refuses the
    // fields only a later state carries, named one by one.
    narrowedPaths: ['data.startedAt', 'data.completedAt', 'data.failureCode', 'data.failureMessage', 'data.failureAttachments', 'data.questionnaire'],
  },
  {
    label: 'getRequestGenerationJobs',
    component: 'RequestGenerationJobsResponse',
    parser: requestGenerationJobsResponseSchema,
    narrowedPaths: [
      // The flat QuestionnaireGenerationJob component, narrowed per state exactly
      // as getQuestionnaireGenerationJob narrows it (docs/contract-gaps/).
      'data.questionnaireGeneration.job.startedAt',
      'data.questionnaireGeneration.job.completedAt',
      'data.questionnaireGeneration.job.failureCode',
      'data.questionnaireGeneration.job.failureMessage',
      'data.questionnaireGeneration.job.failureAttachments',
      'data.questionnaireGeneration.job.questionnaire',
    ],
  },
  {
    label: 'listMyReleasedAssessments',
    component: 'AssessmentListResponse',
    parser: releasedAssessmentListResponseSchema,
    // /v1/my_risk_assessments shares AssessmentListResponse with the analyst
    // list, so the contract cannot express "released only". The Requestor
    // client enforces it instead.
    narrowedPaths: ['data.0.assessmentStatus'],
  },
  { label: 'listAnalystAssessments', component: 'AssessmentListResponse', parser: analystAssessmentListResponseSchema },
  { label: 'getAssessmentStatusSummary', component: 'AssessmentStatusSummaryResponse', parser: assessmentStatusResponseSchema },
  { label: 'getAssessment', component: 'AssessmentDetailResponse', parser: assessmentResponseSchema },
  {
    label: 'getReleasedAssessment',
    component: 'AssessmentDetailGetResponse',
    parser: releasedAssessmentDetailGetResponseSchema,
    branch: 'RequestorReleasedAssessmentDetail',
  },
  {
    label: 'getReleasedAssessment (analyst actor)',
    component: 'AssessmentDetailGetResponse',
    // 19-10 (D-14): its analyst branch is analystAssessmentReadSchema, the analyst detail with its released flag.
    parser: releasedAssessmentDetailGetResponseSchema,
    branch: 'AnalystAssessmentDetail',
    // The analyst detail component describes every assessment, including drafts
    // that have no release facts yet. The released screen renders only a
    // released one, so it refuses those states by design — the My list never
    // offers them.
    narrowedPaths: ['data.assessmentStatus', 'data.assessmentDate', 'data.approvalDate', 'data.approvedBy'],
  },
  // D-34: the assessment's risk list carries the treatment and ownership facts both released views render.
  // A Phase 10 parser: every bound is the contract's own, so it is never grandfathered.
  { label: 'listAssessmentRiskItems', component: 'AssessmentRiskListResponse', parser: assessmentRiskListResponseSchema },
  { label: 'listControlImplementations', component: 'ControlImplementationListResponse', parser: controlImplementationListResponseSchema },
  { label: 'listRiskTypes', component: 'RiskTypeListResponse', parser: riskTypeListResponseSchema },
  { label: 'listControls', component: 'ControlListResponse', parser: controlListResponseSchema },
  { label: 'listActiveUsers', component: 'ActiveUserListResponse', parser: activeUserListResponseSchema },
  { label: 'getRatingSummary', component: 'AssessmentRatingSummaryResponse', parser: ratingSummaryResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/assessments/assessment-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
  // Phase 19 D-19: the four assessment exports are files, checked by the shared validator's export rule.
  fileResponses: [
    { label: 'assessments.exportReviewRequests', path: '/v1/assessment_requests/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'assessments.exportRiskAssessments', path: '/v1/risk_assessments/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'assessments.exportMyRiskAssessments', path: '/v1/my_risk_assessments/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
    { label: 'assessments.exportReleasedAssessment', path: '/v1/risk_assessments/{assessmentId}/export', method: 'get' as const, contentTypes: EXPORT_FILE_CONTENT_TYPES },
  ],
};

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

/** A released-date filter: an existing YYYY-MM-DD calendar date, else absent, so a hand-edited URL never reaches Strapi malformed. */
const collectionDateSchema = z.iso.date().optional().catch(undefined);
/*
 * D-02 item 2: the overall rating and the released date range narrow both assessment lists. A range whose start
 * follows its end is dropped whole rather than sent to Strapi, which would refuse it and turn the list into its error state.
 */
const collectionQuerySchema = z.object({
  q: z.string().trim().max(200).catch(''),
  status: assessmentStatusSchema.optional().catch(undefined),
  overallRating: assessmentRatingSchema.optional().catch(undefined),
  approvedFrom: collectionDateSchema,
  approvedTo: collectionDateSchema,
  sort: z.enum(['generatedDate:asc', 'generatedDate:desc', 'approvalDate:asc', 'approvalDate:desc', 'assessmentNumber:asc', 'assessmentNumber:desc', 'assessmentStatus:asc', 'assessmentStatus:desc']).catch('generatedDate:desc'),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).catch(25),
}).strict().transform((query) => (query.approvedFrom && query.approvedTo && query.approvedFrom > query.approvedTo
  ? { ...query, approvedFrom: undefined, approvedTo: undefined }
  : query));
const reviewQueueSchema = z.enum(['requires-attention', 'awaiting-requestor', 'generation-in-progress', 'open', 'released', 'all']);
const requestReviewQuerySchema = z.object({
  q: z.string().trim().max(200).catch(''),
  queue: reviewQueueSchema.catch('requires-attention'),
  status: z.enum(requestStatuses).optional().catch(undefined),
  // D-13, D-24 (13-12): who holds the request and whether it has notes new to the viewer; Strapi reads the viewer.
  assignee: z.enum(['me', 'unassigned']).optional().catch(undefined),
  notes: z.enum(['unread']).optional().catch(undefined),
  // The orders the server serves (REVIEW_QUEUE_SORT_FIELDS): anything else in the URL falls back to the default
  // rather than reaching Strapi as a malformed sort.
  sort: z.enum([
    'submittedDate:desc', 'submittedDate:asc', 'dueDate:asc', 'dueDate:desc', 'requestNumber:asc', 'requestNumber:desc',
    'title:asc', 'title:desc', 'requestStatus:asc', 'requestStatus:desc', 'updatedAt:desc', 'updatedAt:asc',
  ]).catch('submittedDate:desc'),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).catch(25),
}).strict();
export type AssessmentCollectionQuery = z.infer<typeof collectionQuerySchema>;
export type AssessmentRequestReviewQuery = z.infer<typeof requestReviewQuerySchema>;
export type CollectionPagination = { page: number; pageSize: number; pageCount: number; total: number };
export type AssessmentCollectionResult<T> = { records: readonly T[]; pagination: CollectionPagination };
/** One page of the review queue and the viewer the read names (13-12). */
export type AssessmentRequestQueueResult = AssessmentCollectionResult<z.infer<typeof assessmentRequestQueueItemSchema>> & { viewer: QueuePerson };
export function parseAssessmentCollectionQuery(value: Record<string, string | string[] | undefined>): AssessmentCollectionQuery { return collectionQuerySchema.parse({ q: Array.isArray(value.q) ? value.q[0] : value.q, status: Array.isArray(value.status) ? value.status[0] : value.status, overallRating: Array.isArray(value.overallRating) ? value.overallRating[0] : value.overallRating, approvedFrom: Array.isArray(value.approvedFrom) ? value.approvedFrom[0] : value.approvedFrom, approvedTo: Array.isArray(value.approvedTo) ? value.approvedTo[0] : value.approvedTo, sort: Array.isArray(value.sort) ? value.sort[0] : value.sort, page: Array.isArray(value.page) ? value.page[0] : value.page, pageSize: Array.isArray(value.pageSize) ? value.pageSize[0] : value.pageSize }); }
/**
 * A review queue's query from its URL. A missing or unknown queue is the view's default: Requires attention on
 * Requests, All open on Assigned to me (13-UI-SPEC §2.1).
 */
export function parseAssessmentRequestReviewQuery(value: Record<string, string | string[] | undefined>, defaultQueue: AssessmentRequestReviewQuery['queue'] = 'requires-attention'): AssessmentRequestReviewQuery {
  const query = parseRequestReviewParams(value);
  return reviewQueueSchema.safeParse(Array.isArray(value.queue) ? value.queue[0] : value.queue).success ? query : { ...query, queue: defaultQueue };
}
function parseRequestReviewParams(value: Record<string, string | string[] | undefined>): AssessmentRequestReviewQuery { return requestReviewQuerySchema.parse({ q: Array.isArray(value.q) ? value.q[0] : value.q, queue: Array.isArray(value.queue) ? value.queue[0] : value.queue, status: Array.isArray(value.status) ? value.status[0] : value.status, assignee: Array.isArray(value.assignee) ? value.assignee[0] : value.assignee, notes: Array.isArray(value.notes) ? value.notes[0] : value.notes, sort: Array.isArray(value.sort) ? value.sort[0] : value.sort, page: Array.isArray(value.page) ? value.page[0] : value.page, pageSize: Array.isArray(value.pageSize) ? value.pageSize[0] : value.pageSize }); }

/**
 * The generated query parameters of the assessment collection routes. Typing the
 * parameters here, rather than casting the call, makes typecheck fail if a
 * status the list offers ever falls outside the published contract.
 */
type AssessmentCollectionParams = NonNullable<paths['/v1/risk_assessments']['get']['parameters']['query']>;

/**
 * An empty search box is not a search term. Sending `q=` would ask the server to
 * filter on nothing, which it rejects, so the collection routes omit it — the
 * same shape the request and questionnaire services already use.
 */
function collectionParams(query: AssessmentCollectionQuery): AssessmentCollectionParams {
  const { q, status, overallRating, approvedFrom, approvedTo, sort, page, pageSize } = query;
  return {
    sort,
    page,
    pageSize,
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(overallRating ? { overallRating } : {}),
    ...(approvedFrom ? { approvedFrom } : {}),
    ...(approvedTo ? { approvedTo } : {}),
  };
}

async function request<T>(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
  parse: (payload: unknown) => T,
  operation?: string,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    if (error !== undefined || data === undefined) {
      return normalizeTransportError(error, response.status);
    }
    return { data: parse(data), error: null };
  } catch (error) {
    if (operation && error instanceof z.ZodError) return normalizeResponseParserError(operation);
    return normalizeTransportError(error);
  }
}

async function commandWithoutBody(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
): Promise<TransportResult<void>> {
  try {
    const client = await createStrapiClient();
    const { error, response } = await invoke(client);
    if (error !== undefined || response.status < 200 || response.status >= 300) {
      return normalizeTransportError(error, response.status);
    }
    return { data: undefined, error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}

function id(value: string): string {
  return documentIdSchema.parse(value);
}

export function parseActiveUserSearch(value: unknown): string {
  return z.string().catch('').parse(value).trim().slice(0, 100);
}

function toAssessmentUpdateBody(input: AssessmentUpdateInput): AssessmentUpdateBody {
  const parsed = assessmentUpdateInputSchema.parse(input);
  return {
    ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
    ...(parsed.overallRating !== undefined ? { overallRating: parsed.overallRating } : {}),
    ...(parsed.overallControlEffectiveness !== undefined ? { overallControlEffectiveness: parsed.overallControlEffectiveness } : {}),
    ...(parsed.recommendationsSummary !== undefined ? { recommendationsSummary: parsed.recommendationsSummary } : {}),
    ...(parsed.overallRiskRationale !== undefined ? { overallRiskRationale: parsed.overallRiskRationale } : {}),
    ...(parsed.nextReviewDate !== undefined ? { nextReviewDate: parsed.nextReviewDate } : {}),
  };
}

function toRiskMutationBody(input: RiskCreateInput | RiskUpdateInput, create: boolean): RiskMutationBody {
  const parsed = create ? riskCreateInputSchema.parse(input) : riskUpdateInputSchema.parse(input);
  return {
    ...(parsed.issueStatement !== undefined ? { issueStatement: parsed.issueStatement } : {}),
    ...(parsed.riskStatement !== undefined ? { riskStatement: parsed.riskStatement } : {}),
    ...(parsed.riskCategory !== undefined ? { riskCategory: parsed.riskCategory } : {}),
    ...(parsed.riskSubCategory !== undefined ? { riskSubCategory: parsed.riskSubCategory } : {}),
    ...(parsed.riskCause !== undefined ? { riskCause: parsed.riskCause } : {}),
    ...(parsed.potentialImpact !== undefined ? { potentialImpact: parsed.potentialImpact } : {}),
    ...(parsed.riskType !== undefined ? { riskType: parsed.riskType } : {}),
    ...(parsed.riskOwner !== undefined ? { riskOwner: parsed.riskOwner } : {}),
    ...(parsed.informationSystemImpacted !== undefined ? { informationSystemImpacted: parsed.informationSystemImpacted } : {}),
    ...(parsed.informationAssetImpacted !== undefined ? { informationAssetImpacted: parsed.informationAssetImpacted } : {}),
    ...(parsed.dataClassification !== undefined ? { dataClassification: parsed.dataClassification } : {}),
    ...(parsed.inherentLikelihood !== undefined ? { inherentLikelihood: parsed.inherentLikelihood } : {}),
    ...(parsed.highestInherentConsequence !== undefined ? { highestInherentConsequence: parsed.highestInherentConsequence } : {}),
    ...(parsed.inherentRating !== undefined ? { inherentRating: parsed.inherentRating } : {}),
    ...(parsed.inherentRatingRationale !== undefined ? { inherentRatingRationale: parsed.inherentRatingRationale } : {}),
    ...(parsed.residualLikelihood !== undefined ? { residualLikelihood: parsed.residualLikelihood } : {}),
    ...(parsed.highestResidualConsequence !== undefined ? { highestResidualConsequence: parsed.highestResidualConsequence } : {}),
    ...(parsed.residualRating !== undefined ? { residualRating: parsed.residualRating } : {}),
    ...(parsed.residualRatingRationale !== undefined ? { residualRatingRationale: parsed.residualRatingRationale } : {}),
    ...(parsed.controlEffectiveness !== undefined ? { controlEffectiveness: parsed.controlEffectiveness } : {}),
    ...(parsed.riskVelocity !== undefined ? { riskVelocity: parsed.riskVelocity } : {}),
    ...(parsed.identifiedDate !== undefined ? { identifiedDate: parsed.identifiedDate } : {}),
    ...(parsed.targetDate !== undefined ? { targetDate: parsed.targetDate } : {}),
    ...(parsed.closureDate !== undefined ? { closureDate: parsed.closureDate } : {}),
    ...(parsed.isExempted !== undefined ? { isExempted: parsed.isExempted } : {}),
    ...(parsed.exemptionReviewDate !== undefined ? { exemptionReviewDate: parsed.exemptionReviewDate } : {}),
    ...(parsed.escalationDetails !== undefined ? { escalationDetails: parsed.escalationDetails } : {}),
    ...(parsed.comments !== undefined ? { comments: parsed.comments } : {}),
    ...(parsed.riskCommunicationDate !== undefined ? { riskCommunicationDate: parsed.riskCommunicationDate } : {}),
    ...(parsed.treatmentAction !== undefined ? { treatmentAction: parsed.treatmentAction } : {}),
    ...(parsed.treatmentPlan !== undefined ? { treatmentPlan: parsed.treatmentPlan } : {}),
    ...(parsed.treatmentOwner !== undefined ? { treatmentOwner: parsed.treatmentOwner } : {}),
    ...(parsed.treatmentResolveDate !== undefined ? { treatmentResolveDate: parsed.treatmentResolveDate } : {}),
    ...(parsed.treatmentStatus !== undefined ? { treatmentStatus: parsed.treatmentStatus } : {}),
  };
}

function toControlImplementationBody(
  input: ControlImplementationCreateInput | ControlImplementationUpdateInput,
  create: boolean,
): ControlImplementationMutationBody {
  const parsed = create
    ? controlImplementationCreateInputSchema.parse(input)
    : controlImplementationUpdateInputSchema.parse(input);
  return {
    ...(parsed.control !== undefined ? { control: parsed.control } : {}),
    ...(parsed.controlOwner !== undefined ? { controlOwner: parsed.controlOwner } : {}),
    ...(parsed.controlStatus !== undefined ? { controlStatus: parsed.controlStatus } : {}),
    ...(parsed.effectivenessRating !== undefined ? { effectivenessRating: parsed.effectivenessRating } : {}),
    ...(parsed.evidence !== undefined ? { evidence: parsed.evidence } : {}),
    ...(parsed.implementationDueDate !== undefined ? { implementationDueDate: parsed.implementationDueDate } : {}),
    ...(parsed.implementedDate !== undefined ? { implementedDate: parsed.implementedDate } : {}),
    ...(parsed.reviewDate !== undefined ? { reviewDate: parsed.reviewDate } : {}),
  };
}

export function listAssessmentRequests(): Promise<TransportResult<readonly z.infer<typeof assessmentRequestQueueItemSchema>[]>>;
export function listAssessmentRequests(query: AssessmentRequestReviewQuery): Promise<TransportResult<AssessmentRequestQueueResult>>;
export async function listAssessmentRequests(query?: AssessmentRequestReviewQuery): Promise<TransportResult<AssessmentRequestQueueResult | readonly z.infer<typeof assessmentRequestQueueItemSchema>[]>> {
  const resolved = query ?? { q: '', queue: 'requires-attention' as const, sort: 'submittedDate:desc', page: 1, pageSize: 25 };
  const result = await request((client) => client.GET('/v1/assessment_requests', { params: { query: { ...(resolved.q ? { 'filters[q]': resolved.q } : {}), 'filters[queue]': resolved.queue, ...(resolved.status ? { 'filters[requestStatus]': resolved.status } : {}), ...(resolved.assignee ? { 'filters[assignee]': resolved.assignee } : {}), ...(resolved.notes ? { 'filters[notes]': resolved.notes } : {}), sort: resolved.sort, 'pagination[page]': resolved.page, 'pagination[pageSize]': resolved.pageSize } } }), (payload) => { const parsed = requestQueueResponseSchema.parse(payload); return { records: parsed.data, pagination: parsed.meta.pagination, viewer: parsed.meta.viewer }; });
  return query || result.error ? result : { data: result.data.records, error: null };
}

/**
 * The total of one review queue, read as a one-row page of that queue (D-11): the sidebar's Requests count.
 * Strapi scopes and authorises the read; the page's total is the same figure the queue's list states. Phase 13 (D-14)
 * counts one person's requests, or those nobody has picked up, with the assignee filter; Strapi reads the viewer.
 */
export async function countReviewQueue(
  queue: AssessmentRequestReviewQuery['queue'],
  options: { assignee?: NonNullable<AssessmentRequestReviewQuery['assignee']> } = {},
): Promise<TransportResult<number>> {
  return request(
    (client) => client.GET('/v1/assessment_requests', { params: { query: { 'filters[queue]': queue, ...(options.assignee ? { 'filters[assignee]': options.assignee } : {}), 'pagination[page]': 1, 'pagination[pageSize]': 1 } } }),
    (payload) => requestQueueResponseSchema.parse(payload).meta.pagination.total,
  );
}

export async function startAssessmentDraft(questionnaireId: string): Promise<TransportResult<AssessmentDraftJob>> {
  return request((client) => client.POST('/v1/questionnaires/{questionnaireId}/generate_assessment', {
    params: { path: { questionnaireId: id(questionnaireId) } },
  }), (payload) => jobResponseSchema.parse(payload).data);
}

export async function getAssessmentDraftJob(jobId: string): Promise<TransportResult<AssessmentDraftJob>> {
  return request((client) => client.GET('/v1/assessment_draft_jobs/{jobId}', {
    params: { path: { jobId: id(jobId) } },
  }), (payload) => jobResponseSchema.parse(payload).data);
}

export async function retryAssessmentDraftJob(jobId: string): Promise<TransportResult<AssessmentDraftJob>> {
  return request((client) => client.POST('/v1/assessment_draft_jobs/{jobId}/retry', {
    params: { path: { jobId: id(jobId) } },
  }), (payload) => jobResponseSchema.parse(payload).data);
}

export async function startQuestionnaireGeneration(
  requestId: string,
  replaceUnansweredQuestionnaire: boolean,
  /* Phase 15 D-12: the analyst's optional instruction; Strapi holds it to its rules (D-17 to D-19). */
  instruction?: string,
): Promise<TransportResult<QuestionnaireGenerationJob>> {
  return request((client) => client.POST('/v1/assessment_requests/{requestId}/generate_questionnaire', {
    params: { path: { requestId: id(requestId) } },
    body: { ...(replaceUnansweredQuestionnaire ? { replaceUnansweredQuestionnaire: true } : {}), ...(instruction === undefined ? {} : { instruction }) },
  }), (payload) => questionnaireGenerationJobResponseSchema.parse(payload).data);
}

export async function getQuestionnaireGenerationJob(jobId: string): Promise<TransportResult<QuestionnaireGenerationJob>> {
  return request((client) => client.GET('/v1/questionnaire_generation_jobs/{jobId}', {
    params: { path: { jobId: id(jobId) } },
  }), (payload) => questionnaireGenerationJobResponseSchema.parse(payload).data);
}

export async function retryQuestionnaireGenerationJob(jobId: string): Promise<TransportResult<QuestionnaireGenerationJob>> {
  return request((client) => client.POST('/v1/questionnaire_generation_jobs/{jobId}/retry', {
    params: { path: { jobId: id(jobId) } },
  }), (payload) => questionnaireGenerationJobResponseSchema.parse(payload).data);
}

/** D-25: the request's current questionnaire generation and assessment draft jobs, each with this viewer's retry right. */
export async function getRequestGenerationJobs(requestId: string): Promise<TransportResult<RequestGenerationJobs>> {
  return request((client) => client.GET('/v1/assessment_requests/{requestId}/generation_jobs', {
    params: { path: { requestId: id(requestId) } },
  }), (payload) => requestGenerationJobsResponseSchema.parse(payload).data, 'GET /v1/assessment_requests/{requestId}/generation_jobs');
}

export function listAnalystAssessments(): Promise<TransportResult<readonly AssessmentSummary[]>>;
export function listAnalystAssessments(query: AssessmentCollectionQuery): Promise<TransportResult<AssessmentCollectionResult<AssessmentSummary>>>;
export async function listAnalystAssessments(query?: AssessmentCollectionQuery): Promise<TransportResult<AssessmentCollectionResult<AssessmentSummary> | readonly AssessmentSummary[]>> {
  const resolved = query ?? { q: '', sort: 'generatedDate:desc' as const, page: 1, pageSize: 25 };
  const result = await request((client) => client.GET('/v1/risk_assessments', { params: { query: collectionParams(resolved) } }), (payload) => { const parsed = analystAssessmentListResponseSchema.parse(payload); return { records: parsed.data, pagination: parsed.meta.pagination }; });
  return query || result.error ? result : { data: result.data.records, error: null };
}

export async function getAssessmentStatusSummary(): Promise<TransportResult<z.infer<typeof assessmentStatusSummarySchema>>> {
  return request((client) => client.GET('/v1/risk_assessments/status_summary'), (payload) => assessmentStatusResponseSchema.parse(payload).data);
}

export async function getAnalystAssessment(assessmentId: string): Promise<TransportResult<AnalystAssessmentDetail>> {
  return request((client) => client.GET('/v1/risk_assessments/{assessmentId}', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => analystAssessmentResponseSchema.parse(payload).data);
}

export async function getReleasedAssessment(assessmentId: string): Promise<TransportResult<ReleasedAssessmentDetailForActor>> {
  const result = await request((client) => client.GET('/v1/risk_assessments/{assessmentId}', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => releasedAssessmentDetailGetResponseSchema.parse(payload).data, 'GET /v1/risk_assessments/{assessmentId}');
  if (result.error) return result;
  // FE4-02 (D-16): an assessment Strapi says is not released reads as missing, the 404 a Requestor gets for it.
  if (result.data === null) return { data: null, error: { status: 404, message: 'The released assessment was not found.' } };
  return { data: result.data, error: null };
}

export async function updateAssessment(assessmentId: string, input: AssessmentUpdateInput): Promise<TransportResult<AssessmentDetail>> {
  return request((client) => client.PATCH('/v1/risk_assessments/{assessmentId}', {
    params: { path: { assessmentId: id(assessmentId) } },
    body: toAssessmentUpdateBody(input),
  }), (payload) => assessmentResponseSchema.parse(payload).data);
}

function readRisks(assessmentId: string): Promise<TransportResult<readonly AssessmentRiskListItem[]>> {
  return request((client) => client.GET('/v1/risk_assessments/{assessmentId}/risks', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => assessmentRiskListResponseSchema.parse(payload).data);
}

export const listAssessmentRisks = readRisks;
export const listReleasedAssessmentRisks = readRisks;

export async function createRisk(assessmentId: string, input: RiskCreateInput): Promise<TransportResult<Risk>> {
  return request((client) => client.POST('/v1/risk_assessments/{assessmentId}/risks', {
    params: { path: { assessmentId: id(assessmentId) } },
    body: toRiskMutationBody(input, true),
  }), (payload) => riskResponseSchema.parse(payload).data);
}

export async function updateRisk(riskId: string, input: RiskUpdateInput): Promise<TransportResult<Risk>> {
  return request((client) => client.PATCH('/v1/risks/{riskId}', {
    params: { path: { riskId: id(riskId) } },
    body: toRiskMutationBody(input, false),
  }), (payload) => riskResponseSchema.parse(payload).data);
}

function readControlImplementations(riskId: string): Promise<TransportResult<readonly ControlImplementation[]>> {
  return request((client) => client.GET('/v1/risks/{riskId}/control_implementations', {
    params: { path: { riskId: id(riskId) } },
  }), (payload) => controlImplementationListResponseSchema.parse(payload).data);
}

export const listControlImplementations = readControlImplementations;
export const listReleasedControlImplementations = readControlImplementations;

export async function createControlImplementation(
  riskId: string,
  input: ControlImplementationCreateInput,
): Promise<TransportResult<ControlImplementation>> {
  return request((client) => client.POST('/v1/risks/{riskId}/control_implementations', {
    params: { path: { riskId: id(riskId) } },
    body: toControlImplementationBody(input, true),
  }), (payload) => controlImplementationResponseSchema.parse(payload).data);
}

export async function updateControlImplementation(
  implementationId: string,
  input: ControlImplementationUpdateInput,
): Promise<TransportResult<ControlImplementation>> {
  return request((client) => client.PATCH('/v1/control_implementations/{implementationId}', {
    params: { path: { implementationId: id(implementationId) } },
    body: toControlImplementationBody(input, false),
  }), (payload) => controlImplementationResponseSchema.parse(payload).data);
}

export async function deleteControlImplementation(implementationId: string): Promise<TransportResult<void>> {
  return commandWithoutBody((client) => client.DELETE('/v1/control_implementations/{implementationId}', {
    params: { path: { implementationId: id(implementationId) } },
  }));
}

export async function listRiskTypes(): Promise<TransportResult<readonly RiskType[]>> {
  return request((client) => client.GET('/v1/risk_types'), (payload) => riskTypeListResponseSchema.parse(payload).data);
}

export async function listControls(): Promise<TransportResult<readonly Control[]>> {
  return request((client) => client.GET('/v1/controls'), (payload) => controlListResponseSchema.parse(payload).data);
}

export async function searchActiveUsers(search: string): Promise<TransportResult<readonly ActiveUser[]>> {
  return request((client) => client.GET('/v1/users', {
    params: { query: { search: parseActiveUserSearch(search) } },
  }), (payload) => activeUserListResponseSchema.parse(payload).data);
}

export async function releaseAssessment(assessmentId: string): Promise<TransportResult<ReleasedAssessmentDetail>> {
  return request((client) => client.POST('/v1/risk_assessments/{assessmentId}/release', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => releasedAssessmentResponseSchema.parse(payload).data);
}

export function listMyReleasedAssessments(): Promise<TransportResult<readonly ReleasedAssessmentSummary[]>>;
export function listMyReleasedAssessments(query: AssessmentCollectionQuery): Promise<TransportResult<AssessmentCollectionResult<ReleasedAssessmentSummary>>>;
export async function listMyReleasedAssessments(query?: AssessmentCollectionQuery): Promise<TransportResult<AssessmentCollectionResult<ReleasedAssessmentSummary> | readonly ReleasedAssessmentSummary[]>> {
  const resolved = query ?? { q: '', sort: 'generatedDate:desc' as const, page: 1, pageSize: 25 };
  const result = await request((client) => client.GET('/v1/my_risk_assessments', { params: { query: collectionParams(resolved) } }), (payload) => { const parsed = releasedAssessmentListResponseSchema.parse(payload); return { records: parsed.data, pagination: parsed.meta.pagination }; });
  return query || result.error ? result : { data: result.data.records, error: null };
}

export async function getMyAssessmentRatingSummary(): Promise<TransportResult<Record<AssessmentRating | 'total', number>>> {
  return request((client) => client.GET('/v1/my_risk_assessments/rating_summary'), (payload) => ratingSummaryResponseSchema.parse(payload).data);
}

/** A list's query as its export takes it: the whole filtered list, so no page and no page size (D-13). */
export type AssessmentRequestReviewExportQuery = Omit<AssessmentRequestReviewQuery, 'page' | 'pageSize'>;
export type AssessmentCollectionExportQuery = Omit<AssessmentCollectionQuery, 'page' | 'pageSize'>;

/** The collection filters both assessment exports take, each sent only when set. */
function collectionExportParams({ approvedFrom, approvedTo, overallRating, q, sort, status }: AssessmentCollectionExportQuery) {
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(overallRating ? { overallRating } : {}),
    ...(approvedFrom ? { approvedFrom } : {}),
    ...(approvedTo ? { approvedTo } : {}),
    sort,
  };
}

/*
 * Phase 19 D-04, D-19: each export reads its file through its generated path with a binary parse, and the shared
 * export-file check returns the server's file or the refusal. Strapi scopes, authorises and builds every file.
 */

/** Exports a review queue (Requests, or Assigned to me with its assignee scope) as the queue's own filters choose it. */
export async function exportReviewRequests(input: ListExportOptions & { query: AssessmentRequestReviewExportQuery }): Promise<ExportResult> {
  const { assignee, notes, q, queue, sort, status } = input.query;
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/assessment_requests/export', {
      params: {
        query: {
          ...(q ? { 'filters[q]': q } : {}),
          'filters[queue]': queue,
          ...(status ? { 'filters[requestStatus]': status } : {}),
          ...(assignee ? { 'filters[assignee]': assignee } : {}),
          ...(notes ? { 'filters[notes]': notes } : {}),
          sort,
          ...listExportParams(input),
        },
      },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

/** Exports the analyst's Risk assessments list as its filters choose it. */
export async function exportRiskAssessments(input: ListExportOptions & { query: AssessmentCollectionExportQuery }): Promise<ExportResult> {
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/risk_assessments/export', {
      params: { query: { ...collectionExportParams(input.query), ...listExportParams(input) } },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

/** Exports the viewer's own released risk assessments (My risk assessments) as its filters choose them. */
export async function exportMyRiskAssessments(input: ListExportOptions & { query: AssessmentCollectionExportQuery }): Promise<ExportResult> {
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/my_risk_assessments/export', {
      params: { query: { ...collectionExportParams(input.query), ...listExportParams(input) } },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

/**
 * Exports one released assessment (D-21, UI-D5): a workbook of its summary, risks and mitigation controls, or one
 * table as CSV. No columns; the table is sent for CSV only, and the zone when known.
 */
export async function exportReleasedAssessment(assessmentId: string, input: { format: ExportFileFormat; table?: 'risks' | 'mitigation-controls'; timeZone?: string }): Promise<ExportResult> {
  try {
    const client = await createStrapiClient();
    const exported = await client.GET('/v1/risk_assessments/{assessmentId}/export', {
      params: {
        path: { assessmentId: id(assessmentId) },
        query: {
          format: input.format,
          ...(input.format === 'csv' && input.table ? { table: input.table } : {}),
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        },
      },
      parseAs: 'arrayBuffer',
    });
    return checkExportResponse(exported, input.format);
  } catch (error) {
    return normalizeTransportError(error);
  }
}
