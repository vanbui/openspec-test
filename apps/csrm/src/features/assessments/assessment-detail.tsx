'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { canRevertRequestToDraft, questionnaireGenerationAction, type CsrmAssessmentRequest } from '@/features/requests/request-domain';
import { RequestContextDetails } from '@/features/requests/request-context-details';
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
      <div className="grid gap-6"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
    </div>
  );
}

/**
 * Who a permission state is for (UI-SPEC §11.1, §11.2). `role`: the viewer lacks `assessment:review`, so the
 * route refused before any read and points to the viewer's own list, never into /app/review/. `record`: an
 * analyst whose read Strapi refused, pointed back to the analyst list.
 */
export type AnalystRefusal = 'record' | 'role';

function SafeDetailState({ refusal = 'record', state }: { refusal?: AnalystRefusal; state: Exclude<AssessmentDetailState, 'populated'> }) {
  const permission = state === 'permission';
  const empty = state === 'empty';
  const roleRefusal = permission && refusal === 'role';
  const permissionDescription = roleRefusal
    ? 'Reviewing requests is for Security Analysts. Your own requests are in My Requests.'
    : 'You can’t review this request with your current access. Choose another from the assessment requests.';
  return (
    <>
      <PageHeader description="Inspect an authorised submitted assessment request." title="Assessment request review" />
      <Alert variant={permission || state === 'error' ? 'destructive' : 'default'} role={permission || state === 'error' ? 'alert' : undefined}>
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{permission ? 'You don’t have permission to review this request' : empty ? 'No submitted questionnaire is available' : 'We couldn’t load this assessment request'}</AlertTitle>
        <AlertDescription>{permission ? permissionDescription : empty ? draftGenerationPrecondition : 'Try again. If the problem continues, contact your administrator.'}</AlertDescription>
      </Alert>
      {roleRefusal
        ? <Link className={buttonVariants({ variant: 'outline' })} href="/app/requests">Go to My Requests</Link>
        : <Link className={buttonVariants({ variant: 'outline' })} href="/app/review/requests">Back to assessment requests</Link>}
    </>
  );
}

/**
 * `analystChangesSinceGeneration` is the served count from the analyst questionnaire summary (D-16), read by
 * the page on the server so this client view receives a number; `null` or absent when no count was served.
 */
export function AssessmentDetail({ analystChangesSinceGeneration, assessmentHref, questionnaireHref, refusal, request, state }: { analystChangesSinceGeneration?: number | null; assessmentHref?: string; questionnaireHref?: string; refusal?: AnalystRefusal; request?: CsrmAssessmentRequest; state: AssessmentDetailState }) {
  if (state !== 'populated' || !request) return <SafeDetailState refusal={refusal} state={state === 'populated' ? 'empty' : state} />;
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
      <div className="grid gap-6">
        <RequestLifecycleStepper lifecycle={request.lifecycle} />
        <RequestHub governanceDetail hrefs={{ questionnaire: resolvedQuestionnaireHref, assessment: assessmentHref }} lifecycle={request.lifecycle} request={request} />
        {/* Offered only while Strapi's rule allows it: submitted, with no questionnaire and no assessment (D-22). */}
        {canRevertRequestToDraft(request) ? <div><AnalystRequestRevert documentId={request.documentId} /></div> : null}
        <RequestContextDetails request={request} />
        {/* Generate, Replace or neither, from the served questionnaire relation (D-08, D-09, UI-SPEC §3.1). */}
        {request.requestStatus === 'submitted' ? <QuestionnaireGenerationJob action={questionnaireGenerationAction(questionnaire)} analystChangesSinceGeneration={analystChangesSinceGeneration ?? null} requestId={request.documentId} /> : null}
        {questionnaire.availability === 'available' ? <AssessmentDraftJob assessmentExists={assessmentExists} questionnaireId={questionnaire.documentId} questionnaireSubmitted={questionnaire.state === 'submitted'} /> : null}
      </div>
    </>
  );
}

function AnalystRequestRevert({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertRequestToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The request could not be reverted.'); throw new Error('Request revert failed'); } router.refresh(); }
  return <ConfirmDialog confirmLabel="Return request to draft" confirmVariant="destructive" description="This returns the request to draft and clears its submitted date." errorMessage={error} onConfirm={revert} pendingLabel="Returning request to draft…" reasonRequired title="Return this request to draft?" trigger={<Button type="button">Return to draft</Button>} />;
}
