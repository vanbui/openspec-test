'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { useViewerTimeZone } from '@/components/csrm/local-time';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { revertRequestToDraftAction, submitRequestAction } from './request-actions';
import { canRequestorEdit, canRevertRequestToDraft, type CsrmAssessmentRequest } from './request-domain';
import { toRequestFormValues } from './request-form-values';
import { formatInstant } from '@/lib/time/format-instant';

/*
 * The request detail's own actions: submit a draft, or return a submitted request to draft. They live
 * apart from request-form.tsx, whose create and edit form validates with zod in the browser, so the
 * detail page, which validates nothing there, never downloads zod (plan 08-13, D-24). Both actions
 * are Server Actions, which validate on the server.
 *
 * The actions come only from the request the route serves (D-21). A transition refreshes the route and
 * the refreshed request decides what is offered next; no in-page result ever overrides it, which is what
 * left the submitted actions showing after a return to draft in the same page session (UAT-037).
 */

const submitDescription = 'A Security Analyst will review your request and send you a questionnaire to answer. Until they start work on it, you can return the request to draft to make changes.';

export function RequestWorkflowActions({ request }: { request: CsrmAssessmentRequest }) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const status = request.requestStatus;
  /* The viewer's local date, never a zone label (D-19), as one sentence the status reads with. */
  const submittedOn = formatInstant(request.submittedDate, { zone: useViewerTimeZone(), style: 'date' });
  const root = useRef<HTMLDivElement>(null);
  /* Set by a transition this component started; the refreshed status then moves focus once. */
  const transitioned = useRef(false);

  /*
   * After a submit or a return to draft, focus moves to the first control of the new action set, else to
   * the Request actions region (UI-SPEC §9.2). It never moves on first render, and the trigger that held
   * focus has gone with the old action set.
   */
  useEffect(() => {
    if (!transitioned.current) return;
    transitioned.current = false;
    const container = root.current;
    const target = container?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      ?? container?.closest<HTMLElement>('#request-actions');
    target?.focus();
  }, [status]);

  async function revert(reason?: string) {
    const result = await revertRequestToDraftAction({ documentId: request.documentId, reason });
    if (!result.ok) { setError(result.formError ?? 'The request could not be reverted.'); throw new Error('Request revert failed'); }
    setError(null);
    transitioned.current = true;
    toast.success('Request returned to draft.');
    router.refresh();
  }

  async function submit() {
    setError(null);
    const result = await submitRequestAction({ documentId: request.documentId, ...toRequestFormValues(request) });
    if (!result.ok) {
      setError(result.formError ?? 'Check the request and try again.');
      toast.error(result.formError ?? 'Request submission failed.');
      throw new Error('Submission failed');
    }
    transitioned.current = true;
    toast.success('Request submitted.');
    router.refresh();
  }

  if (!canRequestorEdit(status)) {
    const canRevert = canRevertRequestToDraft(request);
    /* The hint names why the action is or is not offered; a request read without relationships says nothing. */
    const hint = status !== 'submitted' ? null
      : canRevert ? 'You can return this request to draft to make changes until a Security Analyst starts work on it.'
        : request.relationships ? 'A Security Analyst has started work on this request, so it can no longer return to draft.' : null;
    return (
      <div className="grid gap-3" ref={root}>
        {canRevert ? <div className="mb-1"><ConfirmDialog confirmLabel="Return request to draft" confirmVariant="destructive" description="This returns the request to draft and clears its submitted date." errorMessage={error} onConfirm={revert} pendingLabel="Returning request to draft…" reasonRequired title="Return this request to draft?" trigger={<Button type="button">Return to draft</Button>} /></div> : null}
        <StatusBadge live status={status} />
        {submittedOn ? <p className="text-sm text-muted-foreground">{`Submitted ${submittedOn}`}</p> : null}
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3" ref={root}>
      {error ? <Alert variant="destructive"><AlertTitle>Request not submitted</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants({ variant: 'outline' })} href={`/app/requests/${request.documentId}/edit`}>Edit request</Link>
        <ConfirmDialog confirmLabel="Submit request" confirmVariant="default" description={submitDescription} errorMessage={error} onConfirm={submit} pendingLabel="Submitting request…" title="Submit this assessment request?" trigger={<Button type="button">Submit request</Button>} />
      </div>
    </div>
  );
}
