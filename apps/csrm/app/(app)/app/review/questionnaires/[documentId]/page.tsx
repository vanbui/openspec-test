import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { QuestionnaireReview } from '@/features/questionnaires/questionnaire-review';
import { availableAssessmentRequest } from '@/features/questionnaires/questionnaire-domain';
import { getQuestionnaire, getQuestionnaireGovernanceQuestions } from '@/features/questionnaires/questionnaire-service';
import { sectionChoices } from '@/features/questionnaires/questionnaire-placement';
import { questionnaireProvenanceHeaderProps } from '@/features/ai-assistance/ai-provenance-domain';
import { aiInputsChangedSlot } from '@/features/ai-assistance/ai-inputs-changed';
import { RequestContextLines } from '@/features/assessments/request-context-lines';
import { AiProposalsPanel, type AiProposalsOutcome } from '@/features/questionnaire-ai/ai-proposals-panel';
import { proposalAnchorsOf, questionRowAiFactsOf } from '@/features/questionnaire-ai/questionnaire-ai-domain';
import { listQuestionnaireAiProposals } from '@/features/questionnaire-ai/questionnaire-ai-service';
import { StartProposalsButton } from '@/features/questionnaire-ai/start-proposals-button';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';
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
  // One read serves the active questions and, for placing an added question, every question (D-05).
  const [questionsResult, proposalsResult, session] = await Promise.all([
    getQuestionnaireGovernanceQuestions(documentId),
    // Phase 15 D-33: the AI proposals panel's read, beside the questions. Strapi decides who may read it.
    listQuestionnaireAiProposals(documentId),
    getSessionAdapter().current(),
  ]);
  if (questionsResult.error?.status === 403) return <QuestionnaireReview state="permission" />;
  if (questionsResult.error) return <QuestionnaireReview state="error" />;
  if (!questionsResult.data?.definition.length) return <QuestionnaireReview state="empty" />;

  const state = !questionnaireResult.data.release
    ? 'analyst-review'
    : questionnaireResult.data.state === 'submitted'
      ? 'submitted'
      : 'awaiting-submission';
  // D-23: who asked for the AI generation and, in analyst review, where its questions stand, rendered on the server.
  const provenance = questionnaireProvenanceHeaderProps({ generation: questionnaireResult.data.generation, inAnalystReview: state === 'analyst-review', questions: questionsResult.data.definition });
  /*
   * Phase 13 D-29 (13-UI-SPEC §10.2): which notes changed the questionnaire's AI inputs since it was generated, rendered here
   * on the server and handed to the provenance header as a slot (D-34: the client view carries none of its code). Strapi
   * serves the signal to human Security Analysts only; each note links to the originating request's thread.
   */
  const request = availableAssessmentRequest(questionnaireResult.data.assessmentRequest);
  const aiInputsChanged = request
    ? aiInputsChangedSlot({
      // Phase 15 (15-UI-SPEC §9.1; D-29, UI-D20): Suggest follow-up questions, where the proposals read allows a start.
      action: proposalsResult.data?.actions.start.allowed ? <StartProposalsButton questionnaireId={documentId} /> : undefined,
      requestId: request.documentId,
      signal: questionnaireResult.data.generation?.aiInputsChanged,
      target: 'questionnaire',
    })
    : undefined;
  // Phase 13 D-16, D-25 (13-UI-SPEC §11) and Phase 14 D-27 (14-UI-SPEC §6.1): who holds the request, its notes figure and its
  // files figure, under its link, rendered here too.
  const requestContext = request
    ? <RequestContextLines assignment={request.assignment} files={request.files} notes={request.notes} requestId={request.documentId} />
    : null;
  /*
   * Phase 15 D-32, D-33 (15-UI-SPEC §2, §12, §14): the panel, rendered here on the server and handed to the review as a
   * slot. A Security Analyst on a request they raised reads §12's line; a failed read shows the compact error while
   * Strapi keeps refusing a release with open proposals. The instruction and edit drafts are kept per person.
   */
  const outcome: AiProposalsOutcome = proposalsResult.data
    ? { kind: 'view', view: proposalsResult.data }
    : proposalsResult.error.status === 403 && proposalsResult.error.reason === 'OWN_REQUEST' ? { kind: 'requesting-analyst' } : { kind: 'error' };
  const ownerKey = session ? draftOwnerKey(session) : null;
  const questionAi = { facts: proposalsResult.data ? questionRowAiFactsOf(proposalsResult.data) : null, ownerKey };
  // §8.1 (D-08): Release waits for open proposals and active proposal jobs; a requesting analyst is served no count (D-32).
  const releaseGate = proposalsResult.data
    ? { openCount: proposalsResult.data.openCount, activeJob: proposalsResult.data.jobs.some((job) => job.status === 'queued' || job.status === 'running') }
    : outcome.kind === 'requesting-analyst' ? { openCount: null, activeJob: false } : undefined;
  const aiProposals = <AiProposalsPanel outcome={outcome} ownerKey={ownerKey} requestId={request?.documentId ?? null} sections={sectionChoices(questionsResult.data.placements)} />;
  const proposalAnchors = proposalsResult.data ? proposalAnchorsOf(proposalsResult.data) : undefined;
  return <QuestionnaireReview aiInputsChanged={aiInputsChanged} aiProposals={aiProposals} proposalAnchors={proposalAnchors} questionAi={questionAi} releaseGate={releaseGate} assessmentRequestHref={assessmentRequestHref} definition={questionsResult.data.definition} placements={questionsResult.data.placements} provenance={provenance} questionnaire={questionnaireResult.data} requestContext={requestContext} state={state} />;
}
