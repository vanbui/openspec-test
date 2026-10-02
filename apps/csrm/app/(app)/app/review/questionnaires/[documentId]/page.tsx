import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { QuestionnaireReview } from '@/features/questionnaires/questionnaire-review';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaire, getQuestionnaireQuestions } from '@/features/questionnaires/questionnaire-service';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type QuestionnaireReviewPageProps = { params: Promise<{ documentId: string }> };

const title = 'Questionnaire Review | IdamBox CSRM';

// One read per request, shared by the document title and the page.
const readQuestionnaire = cache(getQuestionnaire);

/*
 * A viewer without assessment:review keeps the static title and the questionnaire is never read (D-23), so an
 * existing id and a missing one look the same. For an analyst, a questionnaire id that does not exist takes the
 * not-found's title; any other outcome keeps the route's.
 */
export async function generateMetadata({ params }: QuestionnaireReviewPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) return { title };
  return recordRouteMetadata(readQuestionnaire((await params).documentId), title);
}

// The analyst link to the questionnaire's request. It reuses the route gate's cached capability check.
async function analystRequestHref(questionnaire: Awaited<ReturnType<typeof getQuestionnaire>>['data']): Promise<string | undefined> {
  if (!questionnaire) return undefined;

  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (!request) return undefined;

  return await canViewerReviewAssessments()
    ? `/app/review/requests/${encodeURIComponent(request.documentId)}`
    : undefined;
}

export default async function QuestionnaireReviewPage({ params }: QuestionnaireReviewPageProps) {
  // The gate comes before any read (D-23). It is presentation only: Strapi authorises every read itself.
  if (!(await canViewerReviewAssessments())) return <QuestionnaireReview refusal="role" state="permission" />;
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
