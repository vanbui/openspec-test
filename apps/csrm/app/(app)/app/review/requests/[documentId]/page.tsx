import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';

import { AssessmentDetail, AssessmentDetailSkeleton } from '@/features/assessments/assessment-detail';
import { getRequestGenerationJobs } from '@/features/assessments/assessment-service';
import { getQuestionnaire } from '@/features/questionnaires/questionnaire-service';
import { questionnaireGenerationAction, type CsrmAssessmentRequest } from '@/features/requests/request-domain';
import { getRequest } from '@/features/requests/request-service';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

export type AssessmentRequestDetailPageProps = { params: Promise<{ documentId: string }> };

const title = 'Assessment Request Review | IdamBox CSRM';

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

/*
 * A viewer without assessment:review keeps the static title and the request is never read (D-23), so an
 * existing id and a missing one look the same. For an analyst, a request id that does not exist takes the
 * not-found's title; any other outcome keeps the route's.
 */
export async function generateMetadata({ params }: AssessmentRequestDetailPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) return { title };
  return recordRouteMetadata(readRequest((await params).documentId), title);
}

export async function AssessmentRequestDetailContent({ params }: AssessmentRequestDetailPageProps) {
  // The gate comes before any read (D-23). It is presentation only: Strapi authorises the read itself.
  if (!(await canViewerReviewAssessments())) return <AssessmentDetail refusal="role" state="permission" />;
  const { documentId } = await params;
  const result = await readRequest(documentId);
  if (result.error?.status === 404) notFound();
  if (result.error) return <AssessmentDetail state={result.error.status === 403 ? 'permission' : 'error'} />;
  if (!result.data) notFound();
  const request = result.data;
  // Past the gate, every record link is an analyst link: the viewer holds assessment:review.
  const relationships = request.relationships;
  const questionnaireHref = relationships?.questionnaire.availability === 'available'
    ? `/app/review/questionnaires/${encodeURIComponent(relationships.questionnaire.documentId)}` : undefined;
  const assessmentHref = relationships?.assessment.availability === 'available'
    ? `/app/review/assessments/${encodeURIComponent(relationships.assessment.documentId)}` : undefined;
  /*
   * D-26: the request's current generation jobs seed the hub's two cards, so an analyst who comes back
   * mid-generation sees the job instead of a second Generate. The read follows the gate and the request read.
   */
  const [analystChangesSinceGeneration, generationJobs] = await Promise.all([
    readAnalystChangesSinceGeneration(request),
    getRequestGenerationJobs(request.documentId),
  ]);
  /*
   * A request with no linked questionnaire is still a request the analyst is
   * authorised to review and, while it is submitted, to return to draft — it is
   * in fact the only state that is eligible. The detail view carries its own
   * deliberate treatment for the missing questionnaire, so the empty state here
   * is reserved for a missing request rather than a missing questionnaire.
   */
  return <AssessmentDetail analystChangesSinceGeneration={analystChangesSinceGeneration} assessmentHref={assessmentHref} generationJobs={generationJobs.data ?? null} jobsReadFailed={Boolean(generationJobs.error)} questionnaireHref={questionnaireHref} request={request} state="populated" />;
}

/*
 * The Replace confirmation states how many analyst changes a replacement discards (D-08, D-16). The count is
 * on the analyst questionnaire summary, so it is read here, on the server, only when the hub offers Replace:
 * the request is submitted and its questionnaire is still in analyst review. A failed read or a summary
 * without the count gives `null`, and the dialog then says it cannot count the changes.
 */
async function readAnalystChangesSinceGeneration(request: CsrmAssessmentRequest): Promise<number | null> {
  const questionnaire = request.relationships?.questionnaire;
  if (request.requestStatus !== 'submitted' || !questionnaire || questionnaire.availability !== 'available') return null;
  if (questionnaireGenerationAction(questionnaire) !== 'replace') return null;
  const summary = await getQuestionnaire(questionnaire.documentId);
  return summary.data?.revision?.analystChangesSinceGeneration ?? null;
}

export default function AssessmentRequestDetailPage(props: AssessmentRequestDetailPageProps) {
  return <Suspense fallback={<AssessmentDetailSkeleton />}><AssessmentRequestDetailContent {...props} /></Suspense>;
}
