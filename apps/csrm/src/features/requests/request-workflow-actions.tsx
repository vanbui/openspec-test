'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { revertRequestToDraftAction, submitRequestAction } from './request-actions';
import { canRequestorEdit, formatRequestDate, type CsrmAssessmentRequest } from './request-domain';
import { toRequestFormValues } from './request-form-values';
import type { RequestMutationResult } from './request-schema';

/*
 * The request detail's own actions: submit a draft, or return a submitted request to draft. They live
 * apart from request-form.tsx, whose create and edit form validates with zod in the browser, so the
 * detail page, which validates nothing there, never downloads zod (plan 08-13, D-24). Both actions
 * are Server Actions, which validate on the server.
 */
export function RequestWorkflowActions({ request }: { request: CsrmAssessmentRequest }) {
  const [submitted, setSubmitted] = useState<RequestMutationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = submitted?.requestStatus ?? request.requestStatus;
  const router = useRouter();

  async function revert(reason?: string) {
    const result = await revertRequestToDraftAction({ documentId: request.documentId, reason });
    if (!result.ok) { setError(result.formError ?? 'The request could not be reverted.'); throw new Error('Request revert failed'); }
    toast.success('Request returned to draft.');
    router.refresh();
  }

  if (!canRequestorEdit(status)) {
    const canRevert = status === 'submitted' && !request.questionnaire && !request.assessment;
    return <div className="grid gap-3">{canRevert ? <div className="mb-1"><ConfirmDialog confirmLabel="Return request to draft" confirmVariant="destructive" description="This returns the request to draft and clears its submitted date." errorMessage={error} onConfirm={revert} pendingLabel="Returning request to draft…" reasonRequired title="Return this request to draft?" trigger={<Button type="button">Return to draft</Button>} /></div> : null}<StatusBadge live={Boolean(submitted)} status={status} />{(submitted?.submittedDate ?? request.submittedDate) ? <p className="text-sm text-muted-foreground">Submitted {formatRequestDate(submitted?.submittedDate ?? request.submittedDate)}</p> : null}</div>;
  }

  async function submit() {
    setError(null);
    const result = await submitRequestAction({ documentId: request.documentId, ...toRequestFormValues(request) });
    if (!result.ok) {
      setError(result.formError ?? 'Check the request and try again.');
      toast.error(result.formError ?? 'Request submission failed.');
      throw new Error('Submission failed');
    }
    setSubmitted(result.data);
    toast.success('Request submitted.');
  }

  return (
    <div className="grid gap-3">
      {error ? <Alert variant="destructive"><AlertTitle>Request not submitted</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants({ variant: 'outline' })} href={`/app/requests/${request.documentId}/edit`}>Edit request</Link>
        <ConfirmDialog confirmLabel="Submit request" confirmVariant="default" description="Submission is irreversible. This request cannot be edited after submission." errorMessage={error} onConfirm={submit} pendingLabel="Submitting request…" title="Submit this assessment request?" trigger={<Button type="button">Submit request</Button>} />
      </div>
    </div>
  );
}
