import type { ReactNode } from 'react';

import { DetailSection } from '@/components/csrm/detail-section';
import { LocalInstant } from '@/components/csrm/local-time';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { formatRequestDate, type CsrmAssessmentRequest, type RequestRelationSummary } from './request-domain';

/*
 * The request as its Requestor submitted it, read-only, for both actors (D-20, UI-SPEC §9.1): the
 * Requestor's /app/requests/{id} and the analyst's /app/review/requests/{id} render this one component,
 * so neither actor sees less than the other. The groups follow the request form's order. Instants show
 * the viewer's local date (D-19); the due date is a calendar date and keeps its own formatting.
 *
 * Both routes are zod-free (plan 08-13), so this module imports nothing that defines a schema.
 */

const notProvided = 'Not provided';

function Row({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'grid min-w-0 gap-1 sm:col-span-2' : 'grid min-w-0 gap-1'}>
      <dt className="micro-label text-foreground-secondary">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function TextRow({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <Row label={label} wide={wide}>{value?.trim() ? value : notProvided}</Row>;
}

function NameList({ items }: { items: readonly RequestRelationSummary[] }) {
  if (items.length === 0) return <>None selected</>;
  return <ul className="grid gap-1">{items.map((item) => <li key={item.documentId}>{item.name}</li>)}</ul>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4">
      <h3 className="text-heading-sm text-foreground">{title}</h3>
      <dl className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export function RequestContextDetails({ request }: { request: CsrmAssessmentRequest }) {
  return (
    <DetailSection description="The details submitted with this request." title="Request context">
      <div className="grid min-w-0 gap-6">
        <Group title="Request overview">
          <TextRow label="Description" value={request.description} wide />
          <TextRow label="Assessment type" value={request.assessmentType} />
          <TextRow label="Division" value={request.division} />
          <TextRow label="Business unit" value={request.businessUnit} />
        </Group>
        <Group title="Business context">
          <TextRow label="Business purpose" value={request.businessPurpose} wide />
          <TextRow label="Business criticality" value={request.businessCriticality} />
          <Row label="Third-party involvement">{request.thirdPartyInvolvement ? 'Yes' : 'No'}</Row>
          <TextRow label="Third-party details" value={request.thirdPartyDetails} wide />
          <TextRow label="Regulatory requirements" value={request.regulatoryRequirements} wide />
        </Group>
        <Group title="Scope and timing">
          <TextRow label="Due date" value={formatRequestDate(request.dueDate)} />
          {request.submittedDate ? (
            <Row label="Submitted"><LocalInstant fallback={notProvided} style="date" value={request.submittedDate} /></Row>
          ) : null}
          <Row label="Last updated"><LocalInstant fallback={notProvided} style="date" value={request.updatedAt} /></Row>
          <Row label="Information systems"><NameList items={request.informationSystems} /></Row>
          <Row label="Information assets"><NameList items={request.informationAssets} /></Row>
        </Group>
        <RevertAuditSummary facts={request} />
      </div>
    </DetailSection>
  );
}
