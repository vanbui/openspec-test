import { RecordLink } from '@/components/csrm/record-link';

import { assessmentRequestHref } from './assessment-domain';
import type { AssessmentRequestSummary } from './assessment-schema';

/**
 * Both assessment detail surfaces show the same return path to the request that
 * produced the assessment. The destination is the only thing that differs, and
 * it comes from the served actor discriminant rather than the current route.
 */
export function AssessmentRequestLink({ actor, request }: { actor: 'analyst' | 'requestor'; request: AssessmentRequestSummary }) {
  return (
    <section aria-labelledby="originating-request-label" className="rounded-xl border border-border bg-surface-muted p-4">
      <p className="text-sm text-foreground-secondary" id="originating-request-label">Originating assessment request</p>
      <RecordLink href={assessmentRequestHref(actor, request.documentId)}>
        {request.requestNumber}: {request.title}
      </RecordLink>
    </section>
  );
}
