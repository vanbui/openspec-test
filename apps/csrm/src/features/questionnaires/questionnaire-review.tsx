'use client';

import { AlertCircle, Clock3 } from 'lucide-react';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { RecordLink } from '@/components/csrm/record-link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { QuestionnaireRenderer } from './questionnaire-renderer';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { revertQuestionnaireToDraftAction } from './questionnaire-actions';
import { availableAssessmentRequest } from './questionnaire-domain';
import { QuestionnaireGovernance } from './questionnaire-governance';
import { QuestionnaireRevisionTimeline } from './questionnaire-revision-timeline';

export type QuestionnaireReviewState = 'submitted' | 'analyst-review' | 'awaiting-submission' | 'empty' | 'error' | 'permission';

export interface QuestionnaireReviewProps {
  assessmentRequestHref?: string;
  definition?: QuestionnaireDefinition;
  questionnaire?: QuestionnaireSummary;
  state: QuestionnaireReviewState;
}

function SafeReviewState({ assessmentRequestHref, definition = [], questionnaire, state }: Pick<QuestionnaireReviewProps, 'assessmentRequestHref'> & { definition?: QuestionnaireDefinition; questionnaire?: QuestionnaireSummary; state: Exclude<QuestionnaireReviewState, 'submitted' | 'analyst-review'> }) {
  const content = (() => {
  if (state === 'permission') {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>You don’t have permission to review this questionnaire</AlertTitle><AlertDescription>Access is enforced by your effective CSRM capabilities.</AlertDescription></Alert>;
  }
  if (state === 'error') {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>We couldn’t load this questionnaire review</AlertTitle><AlertDescription>Try again. If the problem continues, contact your administrator.</AlertDescription></Alert>;
  }
  if (state === 'awaiting-submission') {
    return <Alert><Clock3 aria-hidden="true" /><AlertTitle>Awaiting questionnaire submission</AlertTitle><AlertDescription>Draft answers remain private until the Requestor submits one complete answer batch.</AlertDescription></Alert>;
  }
  return <Alert><AlertCircle aria-hidden="true" /><AlertTitle>No submitted answers are available</AlertTitle><AlertDescription>This questionnaire does not contain a complete submitted response.</AlertDescription></Alert>;
  })();
  /*
   * The awaiting-submission state is an authorised read of a questionnaire that simply
   * has no submitted answers yet, so name it: the number and its request are
   * metadata the review list already shows, and an analyst who has just
   * generated a questionnaire needs to see which one this is. Every other safe
   * state deliberately discards whatever was supplied, so those keep the
   * generic heading and reveal nothing about the record.
   */
  /*
   * A released questionnaire the Requestor has not submitted is still governable:
   * returning it to analyst review is the only way to correct its questions, and
   * withholding that control here left the Analyst with no route back (D-15).
   */
  const governable = state === 'awaiting-submission' && questionnaire && definition.length > 0 ? questionnaire : null;
  const identify = state === 'awaiting-submission' && questionnaire;
  const heading = identify
    ? { title: questionnaire.title, description: `${questionnaire.questionnaireNumber} · ${availableAssessmentRequest(questionnaire.assessmentRequest)?.requestNumber ?? ''}` }
    : { title: 'Questionnaire review', description: 'Review an authorised questionnaire submission.' };
  return <><PageHeader status={identify ? <StatusBadge family="questionnaire" value={identify.state} /> : undefined} title={heading.title} description={heading.description} />{identify ? <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={identify} /> : null}{governable ? <QuestionnaireGovernance definition={definition} questionnaire={governable} /> : null}{content}<RevertAuditSummary className="my-6" facts={questionnaire ?? {}} />{questionnaire ? <QuestionnaireRevisionTimeline depth="detail" questionnaire={questionnaire} /> : null}<Link className={buttonVariants({ variant: 'outline' })} href="/app/review/questionnaires">Back to questionnaire reviews</Link></>;
}

export function QuestionnaireReview({ assessmentRequestHref, definition = [], questionnaire, state }: QuestionnaireReviewProps) {
  if (state === 'analyst-review' && questionnaire) {
    if (definition.length === 0) return <SafeReviewState assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} state="empty" />;
    /*
     * The governance question editor is the single list of questions here (D-32): an unreleased
     * questionnaire has no answers to show, and the read-only renderer would repeat every question
     * under a Submitted notice that is untrue before release.
     */
    return <><PageHeader status={<StatusBadge family="questionnaire" value="analyst-review" />} description={questionnaire.questionnaireNumber} title={questionnaire.title} /><QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} /><QuestionnaireGovernance definition={definition} questionnaire={questionnaire} /><QuestionnaireRevisionTimeline depth="detail" questionnaire={questionnaire} /></>;
  }
  if (state !== 'submitted' || !questionnaire || questionnaire.state !== 'submitted') {
    return <SafeReviewState assessmentRequestHref={assessmentRequestHref} definition={definition} questionnaire={questionnaire} state={state === 'submitted' || state === 'analyst-review' ? 'empty' : state} />;
  }
  if (definition.length === 0) return <SafeReviewState assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} state="empty" />;

  return (
    <>
      <PageHeader
        status={<StatusBadge family="questionnaire" value="submitted" />}
        description={questionnaire.questionnaireNumber}
        title={questionnaire.title}
      />
      <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} />
      {/*
        * Two backward transitions can apply to a submitted questionnaire: the
        * Phase 06.1 reversal that hands the answers back to the Requestor, and
        * the governance return that takes the questionnaire back for question
        * editing. The established reversal keeps its position as the first
        * action on this screen; the governance panel follows it.
        */}
      <AnalystQuestionnaireRevert documentId={questionnaire.documentId} />
      <QuestionnaireGovernance definition={definition} questionnaire={questionnaire} />
      {questionnaire.description ? <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{questionnaire.description}</p> : null}
      <QuestionnaireRevisionTimeline depth="detail" questionnaire={questionnaire} />
      <QuestionnaireRenderer definition={definition} documentId={questionnaire.documentId} mode="read-only" />
    </>
  );
}

function QuestionnaireRequestRelationship({ assessmentRequestHref, questionnaire }: Pick<QuestionnaireReviewProps, 'assessmentRequestHref'> & { questionnaire: QuestionnaireSummary }) {
  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (questionnaire.assessmentRequest.availability === 'absent') {
    return <p className="mb-6 text-sm text-muted-foreground">No assessment request is linked to this questionnaire.</p>;
  }
  if (!request || !assessmentRequestHref) return null;

  return (
    <div className="mb-6">
      <RecordLink
        className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={assessmentRequestHref}
      >
        Assessment request {request.requestNumber}
      </RecordLink>
    </div>
  );
}

function AnalystQuestionnaireRevert({ documentId }: { documentId: string }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertQuestionnaireToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The questionnaire could not be reverted.'); throw new Error('Questionnaire revert failed'); } router.refresh(); }
  return <div className="mb-4"><ConfirmDialog confirmLabel="Return questionnaire to draft" confirmVariant="destructive" description="This returns the submitted answer batch to draft while preserving its values." errorMessage={error} onConfirm={revert} pendingLabel="Returning questionnaire to draft…" reasonRequired title="Return this questionnaire to draft?" trigger={<Button type="button">Return to draft</Button>} /></div>;
}
