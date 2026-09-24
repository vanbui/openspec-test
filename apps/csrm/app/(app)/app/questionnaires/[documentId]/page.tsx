import { notFound } from 'next/navigation';

import { QuestionnaireDetail } from '@/features/questionnaires/questionnaire-detail';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaire, getQuestionnaireQuestions } from '@/features/questionnaires/questionnaire-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

type QuestionnaireDetailPageProps = { params: Promise<{ documentId: string }> };

export const metadata = { title: 'Questionnaire | IdamBox CSRM' };

async function requestorRequestHref(questionnaire: Awaited<ReturnType<typeof getQuestionnaire>>['data']): Promise<string | undefined> {
  if (!questionnaire) return undefined;

  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (!request) return undefined;

  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();

  return can('assessment-request:read', granted)
    ? `/app/requests/${encodeURIComponent(request.documentId)}`
    : undefined;
}

export default async function QuestionnaireDetailPage({ params }: QuestionnaireDetailPageProps) {
  const { documentId } = await params;
  const questionnaireResult = await getQuestionnaire(documentId);
  if (questionnaireResult.error?.status === 404) notFound();
  if (questionnaireResult.error) return <QuestionnaireDetail state={questionnaireResult.error.status === 403 ? 'permission' : 'error'} />;
  if (!questionnaireResult.data) notFound();

  const questionsResult = await getQuestionnaireQuestions(documentId);
  if (questionsResult.error?.status === 403) return <QuestionnaireDetail state="permission" />;
  if (questionsResult.error) return <QuestionnaireDetail state="error" />;
  const assessmentRequestHref = await requestorRequestHref(questionnaireResult.data);
  if (!questionsResult.data?.length) return <QuestionnaireDetail assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaireResult.data} state="empty" />;

  return <QuestionnaireDetail assessmentRequestHref={assessmentRequestHref} definition={questionsResult.data} questionnaire={questionnaireResult.data} state={questionnaireResult.data.state === 'submitted' ? 'submitted' : 'ready'} />;
}
