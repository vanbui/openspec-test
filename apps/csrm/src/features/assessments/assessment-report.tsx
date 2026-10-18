import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInstant } from '@/lib/time/format-instant';

import type { AssessmentReportModel, AssessmentReportRisk } from './assessment-report-model';
import { formatCalendarDate, ReleasedRiskDetails } from './released-risk-details';
import { ReportToolbar } from './report-toolbar';

/*
 * The print-ready report (Phase 19 X-31; D-23, D-24; 19-UI-SPEC §4). A Server Component: the released assessment as one
 * document, a card on screen and the A4 page in print (globals.css). It shows only what the report model holds, which
 * is what the released reads disclose, and states no AI fact beyond the released read's disclosure.
 */

const NOT_RECORDED = 'Not recorded';

function text(value: string | null | undefined): string {
  return value?.trim() || NOT_RECORDED;
}

/** §4.3: the identifiers joined by the middle dot. */
function identifierLine(model: AssessmentReportModel): string {
  return [model.assessmentNumber, model.requestNumber, model.requestTitle].join(' · ');
}

function Rating({ rating }: { rating: AssessmentReportModel['overallRating'] }) {
  return rating ? <RiskRatingBadge rating={rating} /> : <>{NOT_RECORDED}</>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="micro-label text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Prose({ children }: { children: string | null }) {
  return <p className="whitespace-pre-wrap break-words text-sm text-foreground">{text(children)}</p>;
}

function ReportSection({ children, id, section, title }: { children: ReactNode; id: string; section?: string; title: string }) {
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-6" data-report-section={section}>
      <h2 className="text-heading-md text-foreground" id={id}>{title}</h2>
      {children}
    </section>
  );
}

/*
 * §4.3 `Risks overview`: the DataTable's typography without its interaction (no sort, density or scroll cue); statements
 * whole, never clamped. Plain table markup rendered on the server: the report ships no table code to the browser (the
 * shadcn table and the scroll-region hook are client modules, and a Server Component importing them makes every export
 * of both a client entry, which regrouped the shared chunks of the tight-budget routes; 19-12 route budgets). Below
 * 640px the table scrolls inside its own named, focusable region; in print the region expands (globals.css).
 */
const headerCellClassName = 'h-10 whitespace-normal border-b border-border px-2 py-2 text-left align-bottom micro-label text-muted-foreground';
const cellClassName = 'whitespace-normal border-b border-border p-2 text-left align-top text-foreground';

function RisksOverview({ risks }: { risks: readonly AssessmentReportRisk[] }) {
  if (risks.length === 0) return <p className="text-sm text-muted-foreground">No risks were recorded in this assessment.</p>;
  return (
    <div
      aria-label="Risks overview, scrolls horizontally"
      className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-slot="report-table-scroll"
      role="region"
      tabIndex={0}
    >
      <table className="w-full border-separate border-spacing-0 text-[length:var(--text-table-size)]">
        <caption className="sr-only">Risks overview</caption>
        <thead>
          <tr>
            <th className={headerCellClassName} scope="col">Risk</th>
            <th className={headerCellClassName} scope="col">Risk statement</th>
            <th className={headerCellClassName} scope="col">Inherent rating</th>
            <th className={headerCellClassName} scope="col">Residual rating</th>
            <th className={headerCellClassName} scope="col">Treatment</th>
          </tr>
        </thead>
        <tbody>
          {risks.map(({ risk }) => (
            <tr key={risk.documentId}>
              <td className={`${cellClassName} font-mono tabular-nums`}>{risk.riskNumber}</td>
              <td className={`${cellClassName} min-w-48 whitespace-pre-wrap break-words`}>{text(risk.riskStatement)}</td>
              <td className={cellClassName}><Rating rating={risk.inherentRating} /></td>
              <td className={cellClassName}><Rating rating={risk.residualRating} /></td>
              <td className={cellClassName}>{risk.treatmentAction ?? NOT_RECORDED}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** §4.3 `Risks in detail`: per Risk, its number and statement, then Phase 10 §15.2's shared read-only Risk at h4. */
function RiskInDetail({ controls, risk }: AssessmentReportRisk) {
  const headingId = `report-risk-${risk.documentId}`;
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0" data-report-risk="">
      <h3 className="font-mono text-heading-sm text-foreground" id={headingId}>{risk.riskNumber}</h3>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{text(risk.riskStatement)}</p>
      <ReleasedRiskDetails groupHeadingLevel={4} implementations={controls} risk={risk} />
    </section>
  );
}

/** §4.3 `Notes`: the time of day is named with its zone, UTC while the viewer's zone is unknown, because paper leaves the system. */
function generationLine(generatedAt: string, timeZone: string | null): string {
  const zone = timeZone ?? 'UTC';
  return `This report shows the risk assessment as released. Generated ${formatInstant(generatedAt, { zone, style: 'date-time' }) ?? generatedAt} (${zone}).`;
}

export type AssessmentReportProps = {
  model: AssessmentReportModel;
  /** The viewer's IANA zone, or null while it is unknown (the report then names UTC). */
  timeZone: string | null;
  /** When this rendering was generated, an ISO instant. */
  generatedAt: string;
};

/** The report document (§4.3). */
export function AssessmentReport({ generatedAt, model, timeZone }: AssessmentReportProps) {
  return (
    <article
      aria-labelledby="assessment-report-title"
      className="mx-auto grid w-full min-w-0 max-w-container-max gap-8 rounded-lg border border-border bg-surface p-4 md:p-10"
      data-report-document=""
    >
      <header className="grid min-w-0 gap-4 border-b border-border pb-6">
        <p className="micro-label text-foreground-secondary">IdamBox CSRM</p>
        {/*
          * UI-05 (1.3.1, pilot ruling 2026-10-17): on screen the page's one h1 is the toolbar's, so the document title is
          * an h2 under it; on paper the toolbar is hidden and the title is the document's h1.
          */}
        <h2 className="text-heading-lg font-display text-foreground print:hidden" id="assessment-report-title">Cyber security risk assessment</h2>
        <h1 className="hidden text-heading-lg font-display text-foreground print:block">Cyber security risk assessment</h1>
        <p className="break-words text-heading-sm text-foreground">{identifierLine(model)}</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Fact label="Release date">{formatInstant(model.releasedAt, { zone: timeZone, style: 'date-long' }) ?? NOT_RECORDED}</Fact>
          <Fact label="Released by">{text(model.releasedBy)}</Fact>
          <Fact label="Overall rating"><Rating rating={model.overallRating} /></Fact>
        </dl>
      </header>
      <ReportSection id="report-summary" title="Summary"><Prose>{model.summary}</Prose></ReportSection>
      <ReportSection id="report-overall-rating" title="Overall rating and rationale">
        <div><Rating rating={model.overallRating} /></div>
        <Prose>{model.overallRiskRationale}</Prose>
      </ReportSection>
      <ReportSection id="report-recommendations" title="Recommendations"><Prose>{model.recommendations}</Prose></ReportSection>
      <ReportSection id="report-control-effectiveness" title="Control effectiveness and next review">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Overall control effectiveness">{text(model.overallControlEffectiveness)}</Fact>
          <Fact label="Next review date">{formatCalendarDate(model.nextReviewDate)}</Fact>
        </dl>
      </ReportSection>
      <ReportSection id="report-risks-overview" title="Risks overview"><RisksOverview risks={model.risks} /></ReportSection>
      {/* The detail starts on a new page in print (globals.css); with no Risk there is nothing to detail. */}
      {model.risks.length > 0 ? (
        <ReportSection id="report-risks-in-detail" section="risks-in-detail" title="Risks in detail">
          <div className="grid min-w-0 gap-6">{model.risks.map((entry) => <RiskInDetail key={entry.risk.documentId} {...entry} />)}</div>
        </ReportSection>
      ) : null}
      <ReportSection id="report-notes" title="Notes">
        {model.aiAssisted ? <PaperAiNotice /> : null}
        <p className="text-sm text-foreground-secondary">{generationLine(generatedAt, timeZone)}</p>
      </ReportSection>
    </article>
  );
}

/*
 * Review amendment R1 part 4: the printed report's AI disclosure, the same on every paper whichever route printed it.
 * Paper reaches people other than the Requestor, so it never addresses the reader; it names no provider or model, and
 * never implies that the AI released anything. The screen keeps Phase 12 §10.1's sentence (AiAssistanceNotice).
 */
function PaperAiNotice() {
  return (
    <p className="flex items-start gap-2 text-sm text-foreground-secondary">
      <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.</span>
    </p>
  );
}

/** §4.2: the route's screen-only toolbar, the record's identifier as its eyebrow. It never prints. */
export function AssessmentReportToolbar({ assessmentNumber, backHref }: { assessmentNumber: string; backHref: string }) {
  return (
    <div data-print="hidden">
      <p className="micro-label mb-2 text-foreground-secondary">{assessmentNumber}</p>
      <PageHeader
        action={(
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse">
            <ReportToolbar />
            <Link className={buttonVariants({ variant: 'outline' })} href={backHref}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to the risk assessment
            </Link>
          </div>
        )}
        description="This is the released assessment as an A4 report. Print it, or save it as a PDF from your browser’s print dialog."
        title="Print report"
      />
    </div>
  );
}

/** §4.4 Loading: a card mirroring the header block, three text sections and a five-column table. */
export function AssessmentReportSkeleton() {
  return (
    <div
      aria-label="Loading report"
      className="mx-auto grid w-full min-w-0 max-w-container-max gap-8 rounded-lg border border-border bg-surface p-4 md:p-10"
      role="status"
    >
      <span className="sr-only">Loading report…</span>
      <div className="grid gap-4 border-b border-border pb-6" data-report-skeleton="header">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4 max-w-md" />
        <Skeleton className="h-6 w-2/3 max-w-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      {[0, 1, 2].map((section) => (
        <div className="grid gap-6" data-report-skeleton="section" key={section}>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
      <div className="grid gap-6">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((column) => (
            <div className="grid gap-2" data-report-skeleton="column" key={column}>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** §4.4 Loading: the toolbar's shape while the assessment number is not yet known. */
export function AssessmentReportToolbarSkeleton() {
  return (
    <div className="page-header" data-print="hidden">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
        <Skeleton className="h-9 w-full rounded-full md:w-52" />
        <Skeleton className="h-9 w-full rounded-full md:w-48" />
      </div>
    </div>
  );
}

/** A report route's content: the toolbar, then the document. */
export function AssessmentReportScreen({ backHref, ...report }: AssessmentReportProps & { backHref: string }) {
  return (
    <>
      <AssessmentReportToolbar assessmentNumber={report.model.assessmentNumber} backHref={backHref} />
      <AssessmentReport {...report} />
    </>
  );
}
