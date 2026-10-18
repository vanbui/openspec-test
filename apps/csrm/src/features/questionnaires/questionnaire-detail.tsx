'use client';

import { AlertCircle } from 'lucide-react';
import { GuardedLink } from '@/components/csrm/navigation-guard';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { QuestionnaireRenderer } from './questionnaire-renderer';
import { revertQuestionnaireToDraftAction } from './questionnaire-actions';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { Button } from '@/components/ui/button';
import { availableAssessmentRequest, introductionFacts } from './questionnaire-domain';
import { answersUpdatedAt, savedQuestionnaireAfter } from './use-answer-autosave';
import { offersNotSure } from '@/features/ai-assistance/ai-assistance-domain';
import { QuestionnaireIntroduction } from './questionnaire-introduction';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { QuestionnaireRevisionTimeline } from './questionnaire-revision-timeline';
import { canRevertQuestionnaireToDraft, submittedNoticeVariant } from './questionnaire-workflow-rules';

export type QuestionnaireDetailState = 'ready' | 'empty' | 'error' | 'permission' | 'submitted';

export interface QuestionnaireDetailProps {
  assessmentRequestHref?: string;
  definition?: QuestionnaireDefinition;
  /** Phase 15 (15-UI-SPEC §11.2; D-25): the key the Requestor's unsaved answers are kept under for the session. */
  draftOwnerKey?: string | null;
  questionnaire?: QuestionnaireSummary;
  state: QuestionnaireDetailState;
}

export function QuestionnaireDetail({ assessmentRequestHref, definition = [], draftOwnerKey = null, questionnaire, state }: QuestionnaireDetailProps) {
  if (state === 'permission') return <><PageHeader title="Questionnaire unavailable" description="This questionnaire cannot be displayed." /><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>You don’t have permission to view this questionnaire</AlertTitle><AlertDescription>You can open questionnaires sent to you about your own requests. Yours are listed in My questionnaires.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Back to questionnaires</Link></>;
  if (state === 'error') return <><PageHeader title="Questionnaire unavailable" description="This questionnaire could not be loaded." /><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>We couldn’t load this questionnaire</AlertTitle><AlertDescription>Try again. If the problem continues, contact your administrator.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Try again</Link></>;
  if (!questionnaire || state === 'empty' || definition.length === 0) return <><PageHeader title="Questionnaire" description="No questions are currently available." /><Alert><AlertCircle aria-hidden="true" /><AlertTitle>No questionnaire questions are available</AlertTitle><AlertDescription>This authorised questionnaire does not yet contain a valid question definition.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Back to questionnaires</Link></>;

  const submitted = state === 'submitted' || questionnaire.state === 'submitted';
  /*
   * UI-SPEC §5.1: while answering, the introduction comes first and carries the description; once submitted,
   * the description returns above the revert summary. The history always follows the questions.
   */
  return (
    <>
      <PageHeader
        status={<StatusBadge family="questionnaire" value={submitted ? 'submitted' : questionnaire.state} />}
        description={questionnaire.questionnaireNumber}
        title={questionnaire.title}
      />
      <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} />
      {submitted && canRevertQuestionnaireToDraft({ state: 'submitted', assessmentRequest: questionnaire.assessmentRequest }) ? <QuestionnaireRevertControl documentId={questionnaire.documentId} /> : null}
      <div className="grid min-w-0 grid-cols-1 gap-8">
        {submitted
          ? (questionnaire.description ? <p className="max-w-3xl text-sm text-muted-foreground">{questionnaire.description}</p> : null)
          : <AnsweringIntroduction aiAssisted={questionnaire.aiAssisted} definition={definition} description={questionnaire.description} documentId={questionnaire.documentId} serverUpdatedAt={answersUpdatedAt(questionnaire, definition)} />}
        <RevertAuditSummary facts={questionnaire} />
        <QuestionnaireRenderer definition={definition} documentId={questionnaire.documentId} ownerKey={draftOwnerKey} mode={submitted ? 'read-only' : 'edit'} serverUpdatedAt={answersUpdatedAt(questionnaire, definition)} submittedNotice={submittedNoticeVariant('requestor', questionnaire)} />
        <QuestionnaireRevisionTimeline depth="summary" questionnaire={questionnaire} />
      </div>
    </>
  );
}

/*
 * The introduction counts from the answers the renderer starts from (UI-SPEC §5.2: the same count as the completion
 * card). At mount a newer save this tab remembers wins, as it does in the renderer (Back and Forward, D-11); a new
 * page payload replaces it. On the server and at a fresh load the tab remembers nothing, so both render the page's
 * answers (IN-302).
 */
function AnsweringIntroduction({ aiAssisted, definition, description, documentId, serverUpdatedAt }: {
  aiAssisted: boolean;
  definition: QuestionnaireDefinition;
  description: QuestionnaireSummary['description'];
  documentId: string;
  serverUpdatedAt: string;
}) {
  const [seed, setSeed] = useState(() => ({ from: definition, answers: savedQuestionnaireAfter(documentId, serverUpdatedAt)?.answers ?? definition }));
  if (seed.from !== definition) setSeed({ from: definition, answers: definition });
  return <QuestionnaireIntroduction aiAssisted={aiAssisted} description={description} offersNotSure={offersNotSure(definition)} {...introductionFacts(seed.answers)} />;
}

function QuestionnaireRequestRelationship({ assessmentRequestHref, questionnaire }: Pick<QuestionnaireDetailProps, 'assessmentRequestHref'> & { questionnaire: QuestionnaireSummary }) {
  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (questionnaire.assessmentRequest.availability === 'absent') {
    return <p className="mb-6 text-sm text-muted-foreground">No assessment request is linked to this questionnaire.</p>;
  }
  if (!request || !assessmentRequestHref) return null;

  return (
    <div className="mb-6">
      {/* The record link treatment, asking first while answers are unsaved (UI-SPEC §6.3). */}
      <GuardedLink
        className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring record-link"
        href={assessmentRequestHref}
      >
        Assessment request {request.requestNumber}
      </GuardedLink>
    </div>
  );
}

function QuestionnaireRevertControl({ documentId }: { documentId: string }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertQuestionnaireToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The questionnaire could not be reverted.'); throw new Error('Questionnaire revert failed'); } router.refresh(); }
  return <div className="mb-4"><ConfirmDialog confirmLabel="Return questionnaire to draft" confirmVariant="destructive" description="Your answers go back to draft so you can change them. Submit the questionnaire again when you’re ready." errorMessage={error} onConfirm={revert} pendingLabel="Returning questionnaire to draft…" reasonRequired title="Return this questionnaire to draft?" trigger={<Button type="button">Return to draft</Button>} /></div>;
}
