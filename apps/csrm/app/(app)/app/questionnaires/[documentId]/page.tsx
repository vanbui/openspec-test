import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { QuestionnaireDetail } from '@/features/questionnaires/questionnaire-detail';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaireQuestions, getRequestorQuestionnaire } from '@/features/questionnaires/questionnaire-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';

type QuestionnaireDetailPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page. The Requestor's read keeps none of the
// analyst-only AI facts (CR-401, D-23), so none reaches the client view.
const readQuestionnaire = cache(getRequestorQuestionnaire);

// A questionnaire id that does not exist takes the not-found's title; any other outcome keeps the route's.
export async function generateMetadata({ params }: QuestionnaireDetailPageProps): Promise<Metadata> {
  return recordRouteMetadata(readQuestionnaire((await params).documentId), 'Questionnaire | IdamBox CSRM');
}

async function requestorRequestHref(questionnaire: Awaited<ReturnType<typeof getRequestorQuestionnaire>>['data']): Promise<string | undefined> {
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
  const questionnaireResult = await readQuestionnaire(documentId);
  if (questionnaireResult.error?.status === 404) notFound();
  if (questionnaireResult.error) return <QuestionnaireDetail state={questionnaireResult.error.status === 403 ? 'permission' : 'error'} />;
  if (!questionnaireResult.data) notFound();

  const questionsResult = await getQuestionnaireQuestions(documentId);
  if (questionsResult.error?.status === 403) return <QuestionnaireDetail state="permission" />;
  if (questionsResult.error) return <QuestionnaireDetail state="error" />;
  const assessmentRequestHref = await requestorRequestHref(questionnaireResult.data);
  if (!questionsResult.data?.length) return <QuestionnaireDetail assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaireResult.data} state="empty" />;

  /* 15-UI-SPEC §11.2 (D-25, UI-D25): the Requestor's unsaved answers are kept per person; the key names nobody in clear. */
  const session = await getSessionAdapter().current();
  const ownerKey = session ? draftOwnerKey(session) : null;
  return <QuestionnaireDetail assessmentRequestHref={assessmentRequestHref} definition={questionsResult.data} draftOwnerKey={ownerKey} questionnaire={questionnaireResult.data} state={questionnaireResult.data.state === 'submitted' ? 'submitted' : 'ready'} />;
}
