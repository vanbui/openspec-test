// The status vocabulary comes from the zod-free domain module, so the request pages download no zod (WR-07).
import { assessmentStatuses } from '@/features/assessments/assessment-domain';
import type { AssessmentStatus } from '@/features/assessments/assessment-schema';
import { DetailSection } from '@/components/csrm/detail-section';
import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { statusLabel } from '@/components/csrm/status-badge';
import { formatRequestDate, type CsrmAssessmentRequest, type RequestLifecycle } from './request-domain';

/*
 * A record opens from its identifier, not from a separate Open control: the
 * identifier of a record this actor may open is always inside the link that
 * opens it, and a record they may not open contributes no identifier at all.
 */

type RequestHubHrefs = {
  questionnaire?: string;
  assessment?: string;
  nextAction?: string;
};

type RequestHubProps = {
  request: CsrmAssessmentRequest;
  lifecycle?: RequestLifecycle;
  hrefs: RequestHubHrefs;
  governanceDetail?: boolean;
};

const ratings = ['Low', 'Moderate', 'High', 'Critical'] as const;

function SummaryCard({ children, title }: { children: React.ReactNode; title: string }) {
  return <article className="min-w-0 rounded-lg border border-border bg-card p-4"><h3 className="text-base font-semibold text-foreground">{title}</h3><div className="mt-2 grid gap-2 text-sm text-muted-foreground">{children}</div></article>;
}

function RelationLink({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? <RecordLink className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>{children}</RecordLink> : null;
}

/*
 * An available record is always named. Only the destination is conditional:
 * a record whose existence is protected never reaches this component at all,
 * so a missing href must not silently erase a record the actor may see.
 */
function RecordIdentifier({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? <RelationLink href={href}>{children}</RelationLink> : <>{children}</>;
}

function isAssessmentStatus(status: string): status is AssessmentStatus {
  return (assessmentStatuses as readonly string[]).includes(status);
}

/* The shared status mapping labels the tile, so a released assessment reads Released here as everywhere. */
function assessmentStatusLabel(status: string | null): string {
  if (!status) return 'Status not recorded';
  return isAssessmentStatus(status) ? statusLabel('assessment', status) : status;
}

function questionnaireState(state: string | null, governanceDetail: boolean): string {
  if (!governanceDetail) return state ? `Questionnaire state: ${state}.` : 'Questionnaire is available to answer.';
  if (state === 'submitted') return 'Governance state: submitted.';
  if (state === 'released') return 'Governance state: released.';
  return 'Governance state: analyst review.';
}

export function RequestHub({ governanceDetail = false, hrefs, lifecycle, request }: RequestHubProps) {
  const relationships = request.relationships;
  if (!relationships) return null;
  const { assessment, questionnaire } = relationships;
  const nextAction = lifecycle?.nextAction;

  return (
    <div className="grid gap-6">
      <DetailSection description="Where this request stands and what happens next." title="Request summary">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request</dt><dd className="text-sm text-foreground">{request.requestNumber} · {request.title}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assessment type</dt><dd className="text-sm text-foreground">{request.assessmentType ?? 'Not provided'}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business criticality</dt><dd className="text-sm text-foreground">{request.businessCriticality ?? 'Not provided'}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due date</dt><dd className="text-sm text-foreground">{formatRequestDate(request.dueDate) ?? 'Not provided'}</dd></div>
          {request.submittedDate ? <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted date</dt><dd className="text-sm text-foreground"><LocalInstant style="date" value={request.submittedDate} /></dd></div> : null}
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</dt><dd className="text-sm text-foreground">{request.requestorName ?? 'Not provided'}</dd></div>
        </dl>
        {nextAction ? <p className="mt-5 text-sm text-foreground"><span className="font-medium">Next action: </span>{hrefs.nextAction || nextAction.href ? <RelationLink href={hrefs.nextAction ?? nextAction.href}>{nextAction.summary}</RelationLink> : nextAction.summary}</p> : null}
      </DetailSection>

      <DetailSection description="Related records are shown only when they are authorised for this request." title="Request relationships">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {questionnaire.availability === 'available' ? <SummaryCard title="Questionnaire"><p><RecordIdentifier href={hrefs.questionnaire}>{questionnaire.questionnaireNumber ?? questionnaire.title ?? 'Questionnaire'}</RecordIdentifier></p><p>{questionnaireState(questionnaire.state, governanceDetail)}</p></SummaryCard> : null}
          {questionnaire.availability === 'absent' ? <SummaryCard title="Questionnaire"><p>No questionnaire is linked to this request.</p></SummaryCard> : null}
          {assessment.availability === 'available' ? <>
            <SummaryCard title="Assessment"><p><RecordIdentifier href={hrefs.assessment}>{assessment.assessmentNumber ?? 'Risk assessment'}</RecordIdentifier></p><p>Status: {assessmentStatusLabel(assessment.assessmentStatus)}.</p></SummaryCard>
            <SummaryCard title="Risks"><p>Risks by residual rating.</p><dl className="grid gap-2">{ratings.map((rating) => <div aria-label={`${rating} residual Risks: ${assessment.residualRiskCounts[rating]}`} className="flex items-center justify-between gap-3" key={rating}><dt><RiskRatingBadge rating={rating} /></dt><dd>{rating}: {assessment.residualRiskCounts[rating]}</dd></div>)}</dl><RelationLink href={hrefs.assessment}>Open identified risks</RelationLink></SummaryCard>
            <SummaryCard title="Controls"><p>{assessment.controlImplementationCount ?? 0} control {(assessment.controlImplementationCount ?? 0) === 1 ? 'implementation' : 'implementations'}.</p><RelationLink href={hrefs.assessment}>Open controls</RelationLink></SummaryCard>
          </> : null}
          {assessment.availability === 'absent' ? <><SummaryCard title="Assessment"><p>No assessment exists for this request.</p></SummaryCard><SummaryCard title="Risks"><p>No risks exist because no assessment exists.</p></SummaryCard><SummaryCard title="Controls"><p>No controls exist because no assessment exists.</p></SummaryCard></> : null}
          <SummaryCard title="Information systems"><p>{request.informationSystems.length ? request.informationSystems.map(({ documentId, name }) => <span className="block" key={documentId}>{name}</span>) : 'No information systems are selected.'}</p></SummaryCard>
          <SummaryCard title="Information assets"><p>{request.informationAssets.length ? request.informationAssets.map(({ documentId, name }) => <span className="block" key={documentId}>{name}</span>) : 'No information assets are selected.'}</p></SummaryCard>
        </div>
      </DetailSection>
    </div>
  );
}
