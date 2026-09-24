'use client';

import { AlertCircle, CheckCircle2, FilePenLine } from 'lucide-react';
import { RecordLink } from '@/components/csrm/record-link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { QuestionnaireRenderer } from './questionnaire-renderer';
import { revertQuestionnaireToDraftAction } from './questionnaire-actions';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { Button } from '@/components/ui/button';
import { availableAssessmentRequest } from './questionnaire-domain';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { QuestionnaireRevisionTimeline } from './questionnaire-revision-timeline';

export type QuestionnaireDetailState = 'ready' | 'empty' | 'error' | 'permission' | 'submitted';

export interface QuestionnaireDetailProps {
  assessmentRequestHref?: string;
  definition?: QuestionnaireDefinition;
  questionnaire?: QuestionnaireSummary;
  state: QuestionnaireDetailState;
}

export function QuestionnaireDetail({ assessmentRequestHref, definition = [], questionnaire, state }: QuestionnaireDetailProps) {
  if (state === 'permission') return <><PageHeader title="Questionnaire unavailable" description="This questionnaire cannot be displayed." /><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>You don’t have permission to view this questionnaire</AlertTitle><AlertDescription>Access is enforced by your effective CSRM capabilities and record scope.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Back to questionnaires</Link></>;
  if (state === 'error') return <><PageHeader title="Questionnaire unavailable" description="This questionnaire could not be loaded." /><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>We couldn’t load this questionnaire</AlertTitle><AlertDescription>Try again. If the problem continues, contact your administrator.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Try again</Link></>;
  if (!questionnaire || state === 'empty' || definition.length === 0) return <><PageHeader title="Questionnaire" description="No questions are currently available." /><Alert><AlertCircle aria-hidden="true" /><AlertTitle>No questionnaire questions are available</AlertTitle><AlertDescription>This authorised questionnaire does not yet contain a valid question definition.</AlertDescription></Alert><Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Back to questionnaires</Link></>;

  const submitted = state === 'submitted' || questionnaire.state === 'submitted';
  return (
    <>
      <PageHeader
        action={<Badge className={submitted ? 'border-success-border bg-success-subtle text-success' : 'border-info-border bg-info-subtle text-info'} variant="outline">{submitted ? <CheckCircle2 aria-hidden="true" /> : <FilePenLine aria-hidden="true" />}{submitted ? 'Submitted' : 'In progress'}</Badge>}
        description={questionnaire.questionnaireNumber}
        title={questionnaire.title}
      />
      <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} />
      {submitted ? <QuestionnaireRevertControl documentId={questionnaire.documentId} /> : null}
      {questionnaire.description ? <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{questionnaire.description}</p> : null}
      <RevertAuditSummary className="mb-6" facts={questionnaire} />
      <QuestionnaireRevisionTimeline depth="summary" questionnaire={questionnaire} />
      <QuestionnaireRenderer definition={definition} documentId={questionnaire.documentId} mode={submitted ? 'read-only' : 'edit'} />
    </>
  );
}

function QuestionnaireRequestRelationship({ assessmentRequestHref, questionnaire }: Pick<QuestionnaireDetailProps, 'assessmentRequestHref'> & { questionnaire: QuestionnaireSummary }) {
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

function QuestionnaireRevertControl({ documentId }: { documentId: string }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertQuestionnaireToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The questionnaire could not be reverted.'); throw new Error('Questionnaire revert failed'); } router.refresh(); }
  return <div className="mb-4"><ConfirmDialog confirmLabel="Return questionnaire to draft" confirmVariant="destructive" description="This returns the submitted answer batch to draft while preserving its values." errorMessage={error} onConfirm={revert} pendingLabel="Returning questionnaire to draft…" reasonRequired title="Return this questionnaire to draft?" trigger={<Button type="button">Return to draft</Button>} /></div>;
}
