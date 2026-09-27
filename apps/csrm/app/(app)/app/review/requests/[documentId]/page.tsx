import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';

import { AssessmentDetail, AssessmentDetailSkeleton } from '@/features/assessments/assessment-detail';
import { getRequest } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

export type AssessmentRequestDetailPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

// A request id that does not exist takes the not-found's title; any other outcome keeps the route's.
export async function generateMetadata({ params }: AssessmentRequestDetailPageProps): Promise<Metadata> {
  return recordRouteMetadata(readRequest((await params).documentId), 'Assessment Request Review | IdamBox CSRM');
}

export async function AssessmentRequestDetailContent({ params }: AssessmentRequestDetailPageProps) {
  const { documentId } = await params;
  const result = await readRequest(documentId);
  if (result.error?.status === 404) notFound();
  if (result.error) return <AssessmentDetail state={result.error.status === 403 ? 'permission' : 'error'} />;
  if (!result.data) notFound();
  const request = result.data;
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  const relationships = request.relationships;
  const questionnaireHref = relationships?.questionnaire.availability === 'available' && can('assessment:review', granted)
    ? `/app/review/questionnaires/${encodeURIComponent(relationships.questionnaire.documentId)}` : undefined;
  const assessmentHref = relationships?.assessment.availability === 'available' && can('assessment:review', granted)
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
