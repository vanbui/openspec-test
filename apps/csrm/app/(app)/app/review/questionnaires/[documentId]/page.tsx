import { notFound } from 'next/navigation';

import { QuestionnaireReview } from '@/features/questionnaires/questionnaire-review';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaire, getQuestionnaireQuestions } from '@/features/questionnaires/questionnaire-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

type QuestionnaireReviewPageProps = { params: Promise<{ documentId: string }> };

export const metadata = { title: 'Questionnaire Review | IdamBox CSRM' };

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
  const questionnaireResult = await getQuestionnaire(documentId);
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
