// The status vocabulary comes from the zod-free domain module, so the request pages download no zod (WR-07).
import { assessmentStatuses } from '@/features/assessments/assessment-domain';
import type { AssessmentStatus } from '@/features/assessments/assessment-schema';
import { DetailSection } from '@/components/csrm/detail-section';
import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { statusLabel } from '@/components/csrm/status-badge';
import { hubNotesFigure } from '@/features/request-notes/notes-domain';
import { UnreadCount } from '@/features/request-notes/unread-marker';
import { formatRequestDate, isAnalystAssignmentView, nextActionPresentation, type CsrmAssessmentRequest, type RequestAssignmentView, type RequestLifecycle } from './request-domain';

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
  /** Plain text that takes the place of the served next action while a generation job runs (UI-SPEC §12.3). */
  nextActionOverride?: string;
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

/*
 * Who holds the request (13-UI-SPEC §5.1; D-16, D-17; UI-D24): an analyst reads `Assigned to`, the Requestor reads
 * `Security Analyst`, each with the holder's name or their own words for nobody. A read without an assignment adds no row.
 */
function holderRow(assignment: RequestAssignmentView | null | undefined): { term: string; value: string } | null {
  if (!assignment) return null;
  const name = assignment.assignee?.displayName;
  return isAnalystAssignmentView(assignment)
    ? { term: 'Assigned to', value: name ?? 'Not picked up' }
    : { term: 'Security Analyst', value: name ?? 'Not picked up yet' };
}

const fileCount = new Intl.NumberFormat('en-AU');

/*
 * The Files row (14-UI-SPEC §3.1; UI-D2, X-10): a figure that opens the Files section, counting the main list; with none,
 * `Add files` while the viewer may add one, else `No files`. A read without a file summary (D-18) adds no row.
 */
function filesFigure(summary: NonNullable<CsrmAssessmentRequest['attachments']>): { label: string; href?: string } {
  if (summary.count > 0) return { label: `${fileCount.format(summary.count)} ${summary.count === 1 ? 'file' : 'files'}`, href: '#files' };
  return summary.canAdd ? { label: 'Add files', href: '#files' } : { label: 'No files' };
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

export function RequestHub({ governanceDetail = false, hrefs, lifecycle, nextActionOverride, request }: RequestHubProps) {
  const relationships = request.relationships;
  if (!relationships) return null;
  const { assessment, questionnaire } = relationships;
  const servedNextAction = lifecycle?.nextAction;
  /*
   * D-27, D-28: the one presentation the stepper also reads. The summary links only when the viewer holds the step
   * and an href is supplied (a page's hrefs.nextAction first), decided from the served holder, never from the words.
   */
  const nextAction = nextActionPresentation(servedNextAction && hrefs.nextAction ? { ...servedNextAction, href: hrefs.nextAction } : servedNextAction, nextActionOverride);
  const holder = holderRow(request.assignment);
  /* 13-UI-SPEC §5.1 (D-25): a read that carries no notes summary (D-23, a participant's) adds no Notes row. */
  const notesFigure = request.notes ? hubNotesFigure(request.notes) : null;
  const files = request.attachments ? filesFigure(request.attachments) : null;

  return (
    <div className="grid gap-6">
      <DetailSection description="Where this request stands and what happens next." title="Request summary">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="micro-label text-foreground-secondary">Request</dt><dd className="text-sm text-foreground">{request.requestNumber} · {request.title}</dd></div>
          <div><dt className="micro-label text-foreground-secondary">Assessment type</dt><dd className="text-sm text-foreground">{request.assessmentType ?? 'Not provided'}</dd></div>
          <div><dt className="micro-label text-foreground-secondary">Business criticality</dt><dd className="text-sm text-foreground">{request.businessCriticality ?? 'Not provided'}</dd></div>
          <div><dt className="micro-label text-foreground-secondary">Due date</dt><dd className="text-sm text-foreground">{formatRequestDate(request.dueDate) ?? 'Not provided'}</dd></div>
          {request.submittedDate ? <div><dt className="micro-label text-foreground-secondary">Submitted date</dt><dd className="text-sm text-foreground"><LocalInstant style="date" value={request.submittedDate} /></dd></div> : null}
          <div><dt className="micro-label text-foreground-secondary">Requestor</dt><dd className="text-sm text-foreground">{request.requestorName ?? 'Not provided'}</dd></div>
          {holder ? <div><dt className="micro-label text-foreground-secondary">{holder.term}</dt><dd className="text-sm text-foreground break-words">{holder.value}</dd></div> : null}
          {notesFigure ? <div><dt className="micro-label text-foreground-secondary">Notes</dt><dd className="text-sm text-foreground">{notesFigure.kind === 'none' ? notesFigure.label : (
            <RecordLink aria-label={notesFigure.kind === 'figure' ? notesFigure.name : undefined} className="inline-flex min-h-11 flex-wrap items-center gap-x-2 text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={notesFigure.href}>
              <span className="tabular-nums">{notesFigure.label}</span>
              {notesFigure.kind === 'figure' && request.notes ? <UnreadCount count={request.notes.unread} /> : null}
            </RecordLink>
          )}</dd></div> : null}
          {files ? <div><dt className="micro-label text-foreground-secondary">Files</dt><dd className="text-sm text-foreground">{files.href ? (
            <RecordLink className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={files.href}>
              <span className="tabular-nums">{files.label}</span>
            </RecordLink>
          ) : files.label}</dd></div> : null}
        </dl>
        {/* UI-D23: one next action per width. Below 768px the stepper's compact line carries it, so this line shows from 768px. */}
        {nextAction ? <p className="mt-5 text-sm text-foreground hidden md:block"><span className="font-medium">Next action: </span>{nextAction.href ? <RelationLink href={nextAction.href}>{nextAction.summary}</RelationLink> : nextAction.summary}</p> : null}
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
