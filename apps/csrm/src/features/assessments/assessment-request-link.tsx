import type { ReactNode } from 'react';

import { RecordLink } from '@/components/csrm/record-link';

import { assessmentRequestHref } from './assessment-domain';
import type { AssessmentRequestSummary } from './assessment-schema';

/**
 * Both assessment detail surfaces show the same return path to the request that
 * produced the assessment. The destination is the only thing that differs, and
 * it comes from the served actor discriminant rather than the current route.
 *
 * `requestContext` is the analyst page's assignee, notes and files lines (Phase 13 D-16, D-25; 13-UI-SPEC §11; Phase 14
 * D-27, 14-UI-SPEC §6.1: `RequestContextLines`), rendered on the server by the page and handed through as a slot, so this
 * module, client code by its importers, carries none of them.
 */
export function AssessmentRequestLink({ actor, request, requestContext }: { actor: 'analyst' | 'requestor'; request: AssessmentRequestSummary; requestContext?: ReactNode }) {
  return (
    <section aria-labelledby="originating-request-label" className="rounded-xl border border-border bg-surface-muted p-4">
      <p className="text-sm text-foreground-secondary" id="originating-request-label">Originating assessment request</p>
      <RecordLink href={assessmentRequestHref(actor, request.documentId)}>
        {request.requestNumber} · {request.title}
      </RecordLink>
      {requestContext}
    </section>
  );
}
