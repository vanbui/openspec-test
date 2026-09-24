import 'server-only';

import type { AssessmentRating, ReleasedAssessmentSummary } from '../assessments/assessment-schema';
import { getMyAssessmentRatingSummary, listMyReleasedAssessments } from '../assessments/assessment-service';
import type { QuestionnaireSummary } from '../questionnaires/questionnaire-service';
import { getMyQuestionnaireSummary, listMyQuestionnaires,} from '../questionnaires/questionnaire-service';
import { availableAssessmentRequest, type QuestionnaireRequestRelationship } from '../questionnaires/questionnaire-domain';
import { formatRequestDate, requestStatuses, requestStatusPresentation, type CsrmAssessmentRequest, type RequestStatus } from '../requests/request-domain';
import { listDashboardRequests } from '../requests/request-service';
import type { ContractResponseParser } from '../assessments/assessment-service';

/** A questionnaire whose request is absent or protected shows no request context. */
function contextFor(relationship: QuestionnaireRequestRelationship): string {
  const request = availableAssessmentRequest(relationship);
  return request ? `${request.title} · ${request.requestNumber}` : 'No linked assessment request';
}

export const responseParserModule = {
  modulePath: 'features/dashboard/requestor-dashboard-service.ts',
  mode: 'no-direct-response-parser' as const,
  parsers: [] as const satisfies readonly ContractResponseParser[],
  reason: 'Dashboard composition consumes already parsed service projections and makes no direct transport response parse.',
};

interface DashboardActionItemBase {
  documentId: string;
  href: string;
  title: string;
  context: string | null;
  updatedDateLabel: string | null;
}

export interface DashboardRequestActionItem extends DashboardActionItemBase {
  kind: 'request';
  status: RequestStatus;
}

export interface DashboardQuestionnaireActionItem extends DashboardActionItemBase {
  kind: 'questionnaire';
  state: QuestionnaireSummary['state'];
  progress: QuestionnaireSummary['progress'] & { unanswered: number };
}

export type DashboardActionItem = DashboardRequestActionItem | DashboardQuestionnaireActionItem;

export interface DashboardActionProjection {
  count: number;
  items: readonly DashboardActionItem[];
}

export interface ReleasedAssessmentItem {
  documentId: string;
  assessmentNumber: string;
  href: string;
  overallRating: AssessmentRating | null;
  summary: string | null;
  approvalDateLabel: string;
}

export type AssessmentRatingSummary = Record<AssessmentRating | 'total', number>;

export type ReleasedAssessmentProjection =
  | { kind: 'empty'; count: 0; ratingSummary: AssessmentRatingSummary; items: readonly [] }
  | { kind: 'populated'; count: number; ratingSummary: AssessmentRatingSummary; items: readonly ReleasedAssessmentItem[] };

export interface RequestorDashboardProjection {
  requestLifecycleCounts: readonly { status: RequestStatus; label: string; count: number }[] | null;
  draftRequests: DashboardActionProjection;
  questionnaires: DashboardActionProjection;
  releasedAssessments: ReleasedAssessmentProjection;
}

export type RequestorDashboardState =
  | { kind: 'ready'; dashboard: RequestorDashboardProjection }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'permission-denied' };

function toRequestActionItem(request: CsrmAssessmentRequest, context: string | null): DashboardRequestActionItem {
  return {
    kind: 'request',
    documentId: request.documentId,
    href: `/app/requests/${encodeURIComponent(request.documentId)}`,
    status: request.requestStatus,
    title: request.title,
    context,
    updatedDateLabel: request.updatedDateLabel,
  };
}

function toQuestionnaireActionItem(questionnaire: QuestionnaireSummary): DashboardQuestionnaireActionItem {
  return {
    kind: 'questionnaire',
    documentId: questionnaire.documentId,
    href: `/app/questionnaires/${encodeURIComponent(questionnaire.documentId)}`,
    state: questionnaire.state,
    title: questionnaire.title,
    context: contextFor(questionnaire.assessmentRequest),
    updatedDateLabel: formatRequestDate(questionnaire.updatedAt),
    progress: {
      ...questionnaire.progress,
      unanswered: Math.max(0, questionnaire.progress.total - questionnaire.progress.answered),
    },
  };
}

function toReleasedAssessmentItem(assessment: ReleasedAssessmentSummary): ReleasedAssessmentItem {
  const approvalDateLabel = formatRequestDate(assessment.approvalDate);
  if (!approvalDateLabel) throw new Error('Released assessment is missing its approval date.');

  return {
    documentId: assessment.documentId,
    assessmentNumber: assessment.assessmentNumber,
    href: `/app/assessments/${encodeURIComponent(assessment.documentId)}`,
    overallRating: assessment.overallRating,
    summary: assessment.summary,
    approvalDateLabel,
  };
}

export function deriveRequestorDashboard(
  draftRequests: readonly CsrmAssessmentRequest[],
  questionnaires: readonly QuestionnaireSummary[] = [],
  totals?: { drafts: number; questionnaires: number },
  releasedAssessments: readonly ReleasedAssessmentSummary[] = [],
  ratingSummary: AssessmentRatingSummary = { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 },
  requestLifecycleCounts: readonly { status: RequestStatus; count: number }[] | null = null,
): RequestorDashboardProjection {
  const draftItems = draftRequests
    .filter((request) => request.requestStatus === 'draft')
    .slice(0, 50)
    .map((request) => toRequestActionItem(request, request.requestNumber));
  const questionnaireItems = questionnaires
    .filter((questionnaire) => questionnaire.state !== 'submitted')
    .slice(0, 50)
    .map(toQuestionnaireActionItem);
  const releasedItems = releasedAssessments.slice(0, 5).map(toReleasedAssessmentItem);
  const releasedProjection: ReleasedAssessmentProjection = ratingSummary.total === 0
    ? { kind: 'empty', count: 0, ratingSummary, items: [] }
    : { kind: 'populated', count: ratingSummary.total, ratingSummary, items: releasedItems };

  return {
    requestLifecycleCounts: requestLifecycleCounts === null ? null : requestStatuses.map((status) => ({
      status,
      label: requestStatusPresentation[status].label,
      count: requestLifecycleCounts.find((entry) => entry.status === status)?.count ?? 0,
    })),
    draftRequests: { count: totals?.drafts ?? draftItems.length, items: draftItems },
    questionnaires: { count: totals?.questionnaires ?? questionnaireItems.length, items: questionnaireItems },
    releasedAssessments: releasedProjection,
  };
}

export async function getRequestorDashboard(): Promise<RequestorDashboardState> {
  try {
    const [
      draftResult,
      questionnaireResult,
      questionnaireSummaryResult,
      releasedAssessmentResult,
      ratingSummaryResult,
      ...lifecycleResults
    ] = await Promise.all([
      listDashboardRequests({ q: '', status: 'draft', sort: 'updatedAt:desc', page: 1, pageSize: 50 }),
      listMyQuestionnaires(),
      getMyQuestionnaireSummary(),
      listMyReleasedAssessments(),
      getMyAssessmentRatingSummary(),
      // Only the authoritative total is read, so each count asks for one record
      // rather than a page of ten it would discard.
      ...requestStatuses.map((status) => listDashboardRequests({ q: '', status, sort: 'updatedAt:desc', page: 1, pageSize: 10 })),
    ]);

    if (
      draftResult.error?.status === 403
      || questionnaireResult.error?.status === 403
      || questionnaireSummaryResult.error?.status === 403
      || releasedAssessmentResult.error?.status === 403
      || ratingSummaryResult.error?.status === 403
      || lifecycleResults.some((result) => result.error?.status === 403)
    ) return { kind: 'permission-denied' };
    if (
      draftResult.error
      || !draftResult.data
      || questionnaireResult.error
      || !questionnaireResult.data
      || questionnaireSummaryResult.error
      || !questionnaireSummaryResult.data
      || releasedAssessmentResult.error
      || !releasedAssessmentResult.data
      || ratingSummaryResult.error
      || !ratingSummaryResult.data
    ) return { kind: 'error' };

    /*
     * The lifecycle counts summarise records the dashboard already shows, so
     * one failed count must not take the whole workspace down with it. When
     * any is unavailable the section says so and every other widget still
     * renders.
     */
    const lifecycleCounts = lifecycleResults.some((result) => result.error || !result.data)
      ? null
      : requestStatuses.map((status, index) => ({ status, count: lifecycleResults[index]?.data?.pagination.total ?? 0 }));

    return {
      kind: 'ready',
      dashboard: deriveRequestorDashboard(
        draftResult.data.requests,
        questionnaireResult.data,
        {
          drafts: draftResult.data.pagination.total,
          questionnaires: questionnaireSummaryResult.data.notStarted + questionnaireSummaryResult.data.draft,
        },
        releasedAssessmentResult.data,
        ratingSummaryResult.data,
        lifecycleCounts,
      ),
    };
  } catch {
    return { kind: 'error' };
  }
}
