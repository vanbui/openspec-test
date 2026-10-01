import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { DetailSection } from '@/components/csrm/detail-section';
import { PageHeader } from '@/components/csrm/page-header';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { StatusBadge } from '@/components/csrm/status-badge';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { RequestWorkflowActions } from '@/features/requests/request-workflow-actions';
import { formatRequestDate } from '@/features/requests/request-domain';
import { getRequest } from '@/features/requests/request-service';
import { RequestLifecycleStepper } from '@/features/requests/request-lifecycle-stepper';
import { RequestHub } from '@/features/requests/request-hub';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type RequestDetailPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

export async function generateMetadata({ params }: RequestDetailPageProps): Promise<Metadata> {
  return recordRouteMetadata(readRequest((await params).documentId), 'Assessment Request | IdamBox CSRM');
}

/*
 * A request that cannot be shown keeps the page's one level-one heading. It names the page, never the
 * record: Strapi refuses another Requestor's request, and its title is theirs.
 */
function UnavailableRequestHeader() {
  return <PageHeader description="Track the lifecycle and linked records of an assessment request." title="Assessment request" />;
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="grid gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap text-sm text-foreground">{value || 'Not provided'}</dd></div>;
}

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { documentId } = await params;
  const result = await readRequest(documentId);
  if (result.error?.status === 404) notFound();
  if (result.error) return <><UnavailableRequestHeader />{result.error.status === 403 ? <PermissionDeniedState /> : <ErrorState />}</>;
  if (!result.data) notFound();
  const request = result.data;
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  const relationships = request.relationships;
  const questionnaireHref = relationships?.questionnaire.availability === 'available' && can('assessment-request:read', granted)
    ? `/app/questionnaires/${encodeURIComponent(relationships.questionnaire.documentId)}` : undefined;
  const assessmentHref = relationships?.assessment.availability === 'available' && can('assessment-request:read', granted)
    ? `/app/assessments/${encodeURIComponent(relationships.assessment.documentId)}` : undefined;

  return (
    <>
      <PageHeader description={request.requestNumber} status={<StatusBadge status={request.requestStatus} />} title={request.title} />
      <div className="grid gap-6">
        <RequestLifecycleStepper lifecycle={request.lifecycle} />
        <RequestHub hrefs={{ questionnaire: questionnaireHref, assessment: assessmentHref }} lifecycle={request.lifecycle} request={request} />
        {/*
          * The hub is a compact operational summary, not a replacement for the
          * record. A Requestor must still be able to read back the business
          * context they submitted, and the revert audit that Phase 06.1
          * delivered, from the request they own.
          */}
        <DetailSection description="The business context submitted with this request." title="Request context">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailItem label="Description" value={request.description} />
            <DetailItem label="Division" value={request.division} />
            <DetailItem label="Business unit" value={request.businessUnit} />
            <DetailItem label="Business purpose" value={request.businessPurpose} />
            <DetailItem label="Third-party involvement" value={request.thirdPartyInvolvement ? 'Yes' : 'No'} />
            <DetailItem label="Third-party details" value={request.thirdPartyDetails} />
            <DetailItem label="Regulatory requirements" value={request.regulatoryRequirements} />
            <DetailItem label="Updated" value={formatRequestDate(request.updatedAt)} />
          </dl>
          <RevertAuditSummary className="mt-6" facts={request} />
        </DetailSection>
        <section aria-label="Request actions" className="rounded-lg border border-border p-6">
          <RequestWorkflowActions request={request} />
        </section>
      </div>
    </>
  );
}
