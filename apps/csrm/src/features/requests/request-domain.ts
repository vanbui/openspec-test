export const requestStatuses = [
  'draft',
  'submitted',
  'questionnaire-in-progress',
  'risk-assessment-drafted',
  'under-review',
  'approved',
  'closed',
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export const requestLifecycleStepKeys = [
  'draft', 'submitted', 'questionnaire-generated', 'questionnaire-released',
  'questionnaire-submitted', 'assessment-drafted', 'assessment-reviewed', 'assessment-released',
] as const;
export type RequestLifecycleStepKey = (typeof requestLifecycleStepKeys)[number];
export type RequestLifecycleStepState = 'completed' | 'current' | 'future';
export type RequestLifecycleStep = { key: RequestLifecycleStepKey; label: string; state: RequestLifecycleStepState };
export type RequestLifecycleNextAction = { actor: 'requestor' | 'analyst' | 'none'; summary: string; href?: string };
export type RequestLifecycle = { currentKey: RequestLifecycleStepKey; currentLabel: string; terminal: boolean; nextAction: RequestLifecycleNextAction | null; steps: readonly RequestLifecycleStep[] };

export const requestStatusPresentation = {
  draft: { label: 'Draft', order: 0 },
  submitted: { label: 'Submitted', order: 1 },
  'questionnaire-in-progress': { label: 'Questionnaire in progress', order: 2 },
  'risk-assessment-drafted': { label: 'Risk assessment drafted', order: 3 },
  'under-review': { label: 'Under review', order: 4 },
  approved: { label: 'Approved', order: 5 },
  closed: { label: 'Closed', order: 6 },
} satisfies Record<RequestStatus, { label: string; order: number }>;

export const requestSortValues = [
  'updatedAt:desc',
  'updatedAt:asc',
  'dueDate:asc',
  'dueDate:desc',
  'requestNumber:asc',
  'requestNumber:desc',
  'title:asc',
  'title:desc',
] as const;

export type RequestSort = (typeof requestSortValues)[number];

export const requestSortParams = {
  'updatedAt:desc': { updatedAt: 'desc' },
  'updatedAt:asc': { updatedAt: 'asc' },
  'dueDate:asc': { dueDate: 'asc' },
  'dueDate:desc': { dueDate: 'desc' },
  'requestNumber:asc': { requestNumber: 'asc' },
  'requestNumber:desc': { requestNumber: 'desc' },
  'title:asc': { title: 'asc' },
  'title:desc': { title: 'desc' },
} satisfies Record<RequestSort, Record<string, 'asc' | 'desc'>>;

export interface RequestListQuery {
  q: string;
  status: RequestStatus | undefined;
  sort: RequestSort;
  page: number;
  pageSize: 10 | 20 | 50;
}

export interface RequestRelationSummary {
  documentId: string;
  name: string;
}

export interface RequestQuestionnaireSummary {
  documentId: string;
  title: string;
}

export type AssessmentStatus = 'draft' | 'in-review' | 'approved' | 'closed';

export interface RequestAssessmentSummary {
  documentId: string;
  assessmentStatus: AssessmentStatus;
}

export type RequestRelationUnavailable = { availability: 'unavailable' };
export type RequestRelationAbsent = { availability: 'absent' };
export type RequestQuestionnaireRelation =
  | { availability: 'available'; documentId: string; questionnaireNumber: string | null; title: string | null; state: string | null }
  | RequestRelationAbsent
  | RequestRelationUnavailable;
export type RequestAssessmentRelation =
  | { availability: 'available'; documentId: string; assessmentNumber: string | null; assessmentStatus: string | null; residualRiskCounts: Record<'Low' | 'Moderate' | 'High' | 'Critical' | 'total', number>; controlImplementationCount?: number }
  | RequestRelationAbsent
  | RequestRelationUnavailable;
export interface AssessmentRequestRelationships {
  questionnaire: RequestQuestionnaireRelation;
  assessment: RequestAssessmentRelation;
}

export interface CsrmAssessmentRequest {
  documentId: string;
  requestNumber: string;
  title: string;
  description: string | null;
  assessmentType?: 'BAU' | 'Project' | 'Other' | null;
  division?: string | null;
  businessUnit?: string | null;
  businessPurpose?: string | null;
  businessCriticality?: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  thirdPartyInvolvement?: boolean;
  thirdPartyDetails?: string | null;
  regulatoryRequirements?: string | null;
  requestStatus: RequestStatus;
  submittedDate?: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  dueDateLabel: string | null;
  updatedDateLabel: string | null;
  informationSystems: readonly RequestRelationSummary[];
  informationAssets: readonly RequestRelationSummary[];
  requestorName?: string | null;
  questionnaire: RequestQuestionnaireSummary | null;
  assessment: RequestAssessmentSummary | null;
  relationships?: AssessmentRequestRelationships;
  lifecycle?: RequestLifecycle;
  revertReason?: string | null;
  revertedAt?: string | null;
  revertedBy?: { documentId: string; displayName: string | null } | null;
}

export function canRequestorEdit(status: RequestStatus): boolean {
  return status === 'draft';
}

/**
 * Whether a request may return to draft (D-22), mirroring the rule Strapi applies: it is submitted and
 * neither a questionnaire nor an assessment exists for it. It reads only the served relationships, where
 * `unavailable` still means one exists, never the legacy nullable fields. A request read without its
 * relationships fails closed. Both actors' pages use it to decide whether to offer the action; Strapi
 * still decides whether to perform it.
 */
export function canRevertRequestToDraft(request: Pick<CsrmAssessmentRequest, 'requestStatus' | 'relationships'>): boolean {
  const relationships = request.relationships;
  if (request.requestStatus !== 'submitted' || !relationships) return false;
  return relationships.questionnaire.availability === 'absent' && relationships.assessment.availability === 'absent';
}

export type QuestionnaireGenerationAction = 'generate' | 'replace' | 'released';

/**
 * Which generation action the analyst hub offers for a submitted request (D-08, D-09, D-22), read from the
 * served questionnaire relation alone. With no questionnaire the analyst generates one; a questionnaire still
 * in analyst review may be replaced. Any other questionnaire that exists (released, submitted, not open to
 * this analyst, or served without a state) is never offered for replacement, because Strapi would refuse it.
 * Strapi still decides.
 */
export function questionnaireGenerationAction(relation: RequestQuestionnaireRelation): QuestionnaireGenerationAction {
  if (relation.availability === 'absent') return 'generate';
  return relation.availability === 'available' && relation.state === 'analyst-review' ? 'replace' : 'released';
}

export interface RequestPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface RequestList {
  requests: readonly CsrmAssessmentRequest[];
  pagination: RequestPagination;
}

export function formatRequestDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
