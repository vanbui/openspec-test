import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';

import { AssessmentDetail, AssessmentDetailSkeleton } from '@/features/assessments/assessment-detail';
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
   * A request with no linked questionnaire is still a request the analyst is
   * authorised to review and, while it is submitted, to return to draft — it is
   * in fact the only state that is eligible. The detail view carries its own
   * deliberate treatment for the missing questionnaire, so the empty state here
   * is reserved for a missing request rather than a missing questionnaire.
   */
  return <AssessmentDetail assessmentHref={assessmentHref} questionnaireHref={questionnaireHref} request={request} state="populated" />;
}

export default function AssessmentRequestDetailPage(props: AssessmentRequestDetailPageProps) {
  return <Suspense fallback={<AssessmentDetailSkeleton />}><AssessmentRequestDetailContent {...props} /></Suspense>;
}
