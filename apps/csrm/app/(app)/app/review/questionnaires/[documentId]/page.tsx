import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { QuestionnaireReview } from '@/features/questionnaires/questionnaire-review';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaire, getQuestionnaireQuestions } from '@/features/questionnaires/questionnaire-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type QuestionnaireReviewPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page.
const readQuestionnaire = cache(getQuestionnaire);

// A questionnaire id that does not exist takes the not-found's title; any other outcome keeps the route's.
export async function generateMetadata({ params }: QuestionnaireReviewPageProps): Promise<Metadata> {
  return recordRouteMetadata(readQuestionnaire((await params).documentId), 'Questionnaire Review | IdamBox CSRM');
}

async function analystRequestHref(questionnaire: Awaited<ReturnType<typeof getQuestionnaire>>['data']): Promise<string | undefined> {
  if (!questionnaire) return undefined;

  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (!request) return undefined;

  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();

  return can('assessment:review', granted)
    ? `/app/review/requests/${encodeURIComponent(request.documentId)}`
    : undefined;
}

export default async function QuestionnaireReviewPage({ params }: QuestionnaireReviewPageProps) {
  const { documentId } = await params;
  const questionnaireResult = await readQuestionnaire(documentId);
  if (questionnaireResult.error?.status === 404) notFound();
  if (questionnaireResult.error) return <QuestionnaireReview state={questionnaireResult.error.status === 403 ? 'permission' : 'error'} />;
  if (!questionnaireResult.data) notFound();

  const assessmentRequestHref = await analystRequestHref(questionnaireResult.data);
  const questionsResult = await getQuestionnaireQuestions(documentId);
  if (questionsResult.error?.status === 403) return <QuestionnaireReview state="permission" />;
  if (questionsResult.error) return <QuestionnaireReview state="error" />;
  if (!questionsResult.data?.length) return <QuestionnaireReview state="empty" />;

  const state = !questionnaireResult.data.release
    ? 'analyst-review'
    : questionnaireResult.data.state === 'submitted'
      ? 'submitted'
      : 'awaiting-submission';
  return <QuestionnaireReview assessmentRequestHref={assessmentRequestHref} definition={questionsResult.data} questionnaire={questionnaireResult.data} state={state} />;
}
