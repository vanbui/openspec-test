'use client';

import { AlertCircle } from 'lucide-react';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DetailSection } from '@/components/csrm/detail-section';
import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CsrmAssessmentRequest } from '@/features/requests/request-domain';
import { revertRequestToDraftAction } from '@/features/requests/request-actions';
import { AssessmentDraftJob, draftGenerationPrecondition } from './assessment-draft-job';
import { QuestionnaireGenerationJob } from './questionnaire-generation-job';
import { RequestLifecycleStepper } from '@/features/requests/request-lifecycle-stepper';
import { RequestHub } from '@/features/requests/request-hub';

export type AssessmentDetailState = 'populated' | 'empty' | 'error' | 'permission';

export function AssessmentDetailSkeleton() {
  return (
    <div aria-label="Loading assessment request review" className="space-y-6" role="status">
      <span className="sr-only">Loading assessment request review</span>
      <div className="space-y-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
    </div>
  );
}

function SafeDetailState({ state }: { state: Exclude<AssessmentDetailState, 'populated'> }) {
  const permission = state === 'permission';
  const empty = state === 'empty';
  return (
    <>
      <PageHeader description="Inspect an authorised submitted assessment request." title="Assessment request review" />
      <Alert variant={permission || state === 'error' ? 'destructive' : 'default'} role={permission || state === 'error' ? 'alert' : undefined}>
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{permission ? 'You don’t have permission to review this request' : empty ? 'No submitted questionnaire is available' : 'We couldn’t load this assessment request'}</AlertTitle>
        <AlertDescription>{permission ? 'Access is enforced by your effective CSRM capabilities.' : empty ? draftGenerationPrecondition : 'Try again. If the problem continues, contact your administrator.'}</AlertDescription>
      </Alert>
      <Link className={buttonVariants({ variant: 'outline' })} href="/app/review/requests">Back to assessment requests</Link>
    </>
  );
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-foreground">{value || 'Not provided'}</dd></div>;
}

export function AssessmentDetail({ assessmentHref, questionnaireHref, request, state }: { assessmentHref?: string; questionnaireHref?: string; request?: CsrmAssessmentRequest; state: AssessmentDetailState }) {
  if (state !== 'populated' || !request) return <SafeDetailState state={state === 'populated' ? 'empty' : state} />;
  // Direct component callers from older route tests do not carry the server projection.
  // The production route always passes the discriminated relationship state.
  const questionnaire = request.relationships?.questionnaire ?? (request.questionnaire
    ? { availability: 'available' as const, documentId: request.questionnaire.documentId, questionnaireNumber: null, title: request.questionnaire.title, state: null }
    : { availability: 'absent' as const });
  const resolvedQuestionnaireHref = questionnaireHref ?? (questionnaire.availability === 'available' ? `/app/review/questionnaires/${encodeURIComponent(questionnaire.documentId)}` : undefined);
  /*
   * A request has at most one assessment, and Strapi refuses a second draft (409). Once one exists, open to
   * this actor or not, the draft card offers nothing to generate (W-1). It stays mounted, so the session
   * that generated the draft keeps its card when revalidation re-renders the page.
   */
  const assessmentExists = request.relationships?.assessment.availability === 'available' || request.relationships?.assessment.availability === 'unavailable';

  return (
    <>
      <PageHeader description={request.requestNumber} status={<StatusBadge status={request.requestStatus} />} title={request.title} />
      <div className="mt-6"><RequestLifecycleStepper lifecycle={request.lifecycle} /></div>
      <div className="mt-6"><RequestHub governanceDetail hrefs={{ questionnaire: resolvedQuestionnaireHref, assessment: assessmentHref }} lifecycle={request.lifecycle} request={request} /></div>
      {request.requestStatus === 'submitted' && request.relationships?.assessment.availability !== 'available' ? <div className="mb-4"><AnalystRequestRevert documentId={request.documentId} /></div> : null}
      <div className="grid gap-6">
        <DetailSection description="Submitted business context for analyst review." title="Request context">
          <dl className="grid gap-4 sm:grid-cols-2"><DetailValue label="Description" value={request.description} /><DetailValue label="Business purpose" value={request.businessPurpose} /><DetailValue label="Division" value={request.division} /><DetailValue label="Business unit" value={request.businessUnit} /><DetailValue label="Business criticality" value={request.businessCriticality} /><DetailValue label="Submitted date" value={request.submittedDate ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(request.submittedDate)) : null} /></dl>
          <RevertAuditSummary className="mt-6" facts={request} />
        </DetailSection>
      </div>
      {request.requestStatus === 'submitted' ? <div className="mt-6"><QuestionnaireGenerationJob hasExistingQuestionnaire={questionnaire.availability === 'available'} requestId={request.documentId} /></div> : null}
      {questionnaire.availability === 'available' ? <AssessmentDraftJob assessmentExists={assessmentExists} className="mt-6" questionnaireId={questionnaire.documentId} questionnaireSubmitted={questionnaire.state === 'submitted'} /> : null}
    </>
  );
}

function AnalystRequestRevert({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertRequestToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The request could not be reverted.'); throw new Error('Request revert failed'); } router.refresh(); }
  return <ConfirmDialog confirmLabel="Return request to draft" confirmVariant="destructive" description="This returns the request to draft and clears its submitted date." errorMessage={error} onConfirm={revert} pendingLabel="Returning request to draft…" reasonRequired title="Return this request to draft?" trigger={<Button type="button">Return to draft</Button>} />;
}
