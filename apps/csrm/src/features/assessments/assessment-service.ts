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
import {
  activeUserSchema,
  analystAssessmentDetailSchema,
  assessmentDraftJobSchema,
  questionnaireGenerationJobSchema,
  assessmentRatingSummarySchema,
  assessmentRequestQueueItemSchema,
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
  type ReleasedAssessmentDetailForActor,
  requestorReleasedAssessmentDetailSchema,
  releasedAssessmentDetailForActorSchema,
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
  type AssessmentRating,
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

const requestQueueResponseSchema = paginatedResponseOf(assessmentRequestQueueItemSchema);
const jobResponseSchema = responseOf(assessmentDraftJobSchema);
const questionnaireGenerationJobResponseSchema = responseOf(questionnaireGenerationJobSchema);
const analystAssessmentListResponseSchema = paginatedResponseOf(assessmentSummarySchema);
const releasedAssessmentListResponseSchema = paginatedResponseOf(releasedAssessmentSummarySchema);
const assessmentStatusResponseSchema = responseOf(assessmentStatusSummarySchema);
const analystAssessmentResponseSchema = responseOf(analystAssessmentDetailSchema);
const releasedAssessmentResponseSchema = responseOf(releasedAssessmentDetailSchema);
const requestorReleasedAssessmentResponseSchema = responseOf(requestorReleasedAssessmentDetailSchema);
const releasedAssessmentDetailGetResponseSchema = responseOf(releasedAssessmentDetailForActorSchema);
const assessmentResponseSchema = responseOf(assessmentDetailSchema);
const riskResponseSchema = responseOf(riskSchema);
const riskListResponseSchema = listResponseOf(riskSchema);
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
    narrowedPaths: ['data.startedAt', 'data.completedAt', 'data.failureCode', 'data.failureMessage', 'data.questionnaire'],
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
    parser: releasedAssessmentDetailGetResponseSchema,
    branch: 'AnalystAssessmentDetail',
    // The analyst detail component describes every assessment, including drafts
    // that have no release facts yet. The released screen renders only a
    // released one, so it refuses those states by design — the My list never
    // offers them.
    narrowedPaths: ['data.assessmentStatus', 'data.assessmentDate', 'data.approvalDate', 'data.approvedBy'],
  },
  { label: 'listAssessmentRisks', component: 'RiskListResponse', parser: riskListResponseSchema },
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
};

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

const collectionQuerySchema = z.object({
  q: z.string().trim().max(200).catch(''),
  status: assessmentStatusSchema.optional().catch(undefined),
  sort: z.enum(['generatedDate:asc', 'generatedDate:desc', 'approvalDate:asc', 'approvalDate:desc', 'assessmentNumber:asc', 'assessmentNumber:desc', 'assessmentStatus:asc', 'assessmentStatus:desc']).catch('generatedDate:desc'),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).catch(25),
}).strict();
const requestReviewQuerySchema = z.object({
  q: z.string().trim().max(200).catch(''),
  queue: z.enum(['requires-attention', 'awaiting-requestor', 'generation-in-progress', 'released']).catch('requires-attention'),
  status: z.enum(requestStatuses).optional().catch(undefined),
  sort: z.string().trim().max(100).catch('submittedDate:desc'),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).catch(25),
}).strict();
export type AssessmentCollectionQuery = z.infer<typeof collectionQuerySchema>;
export type AssessmentRequestReviewQuery = z.infer<typeof requestReviewQuerySchema>;
export type CollectionPagination = { page: number; pageSize: number; pageCount: number; total: number };
export type AssessmentCollectionResult<T> = { records: readonly T[]; pagination: CollectionPagination };
export function parseAssessmentCollectionQuery(value: Record<string, string | string[] | undefined>): AssessmentCollectionQuery { return collectionQuerySchema.parse({ q: Array.isArray(value.q) ? value.q[0] : value.q, status: Array.isArray(value.status) ? value.status[0] : value.status, sort: Array.isArray(value.sort) ? value.sort[0] : value.sort, page: Array.isArray(value.page) ? value.page[0] : value.page, pageSize: Array.isArray(value.pageSize) ? value.pageSize[0] : value.pageSize }); }
export function parseAssessmentRequestReviewQuery(value: Record<string, string | string[] | undefined>): AssessmentRequestReviewQuery { return requestReviewQuerySchema.parse({ q: Array.isArray(value.q) ? value.q[0] : value.q, queue: Array.isArray(value.queue) ? value.queue[0] : value.queue, status: Array.isArray(value.status) ? value.status[0] : value.status, sort: Array.isArray(value.sort) ? value.sort[0] : value.sort, page: Array.isArray(value.page) ? value.page[0] : value.page, pageSize: Array.isArray(value.pageSize) ? value.pageSize[0] : value.pageSize }); }

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
  const { q, status, ...rest } = query;
  return { ...rest, ...(q ? { q } : {}), ...(status ? { status } : {}) };
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
export function listAssessmentRequests(query: AssessmentRequestReviewQuery): Promise<TransportResult<AssessmentCollectionResult<z.infer<typeof assessmentRequestQueueItemSchema>>>>;
export async function listAssessmentRequests(query?: AssessmentRequestReviewQuery): Promise<TransportResult<AssessmentCollectionResult<z.infer<typeof assessmentRequestQueueItemSchema>> | readonly z.infer<typeof assessmentRequestQueueItemSchema>[]>> {
  const resolved = query ?? { q: '', queue: 'requires-attention' as const, sort: 'submittedDate:desc', page: 1, pageSize: 25 };
  const result = await request((client) => client.GET('/v1/assessment_requests', { params: { query: { ...(resolved.q ? { 'filters[title]': resolved.q } : {}), 'filters[queue]': resolved.queue, ...(resolved.status ? { 'filters[requestStatus]': resolved.status } : {}), sort: resolved.sort, 'pagination[page]': resolved.page, 'pagination[pageSize]': resolved.pageSize } } }), (payload) => { const parsed = requestQueueResponseSchema.parse(payload); return { records: parsed.data, pagination: parsed.meta.pagination }; });
  return query || result.error ? result : { data: result.data.records, error: null };
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
): Promise<TransportResult<QuestionnaireGenerationJob>> {
  return request((client) => client.POST('/v1/assessment_requests/{requestId}/generate_questionnaire', {
    params: { path: { requestId: id(requestId) } },
    body: replaceUnansweredQuestionnaire ? { replaceUnansweredQuestionnaire: true } : {},
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
  return request((client) => client.GET('/v1/risk_assessments/{assessmentId}', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => releasedAssessmentDetailGetResponseSchema.parse(payload).data, 'GET /v1/risk_assessments/{assessmentId}');
}

export async function updateAssessment(assessmentId: string, input: AssessmentUpdateInput): Promise<TransportResult<AssessmentDetail>> {
  return request((client) => client.PATCH('/v1/risk_assessments/{assessmentId}', {
    params: { path: { assessmentId: id(assessmentId) } },
    body: toAssessmentUpdateBody(input),
  }), (payload) => assessmentResponseSchema.parse(payload).data);
}

function readRisks(assessmentId: string): Promise<TransportResult<readonly Risk[]>> {
  return request((client) => client.GET('/v1/risk_assessments/{assessmentId}/risks', {
    params: { path: { assessmentId: id(assessmentId) } },
  }), (payload) => riskListResponseSchema.parse(payload).data);
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
