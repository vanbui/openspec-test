import Link from 'next/link';
import type { ReactNode } from 'react';

import { KpiTile, KpiTileSkeleton, KpiTileStrip } from '@/components/csrm/kpi-tile';
import { PageHeader } from '@/components/csrm/page-header';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AssessmentThroughputReportView } from './assessment-throughput-report';
import { ControlEffectivenessReportView } from './control-effectiveness-report';
import type { ReportCopy, ReportKey } from './report-copy';
import { ReportBody, ReportTransitionProvider } from './report-period-control';
import { asAtLabel, reportKpiTiles } from './report-presentation';
import type { Report } from './report-schema';
import { ReportSectionSkeleton } from './report-section';
import { RiskExposureReportView } from './risk-exposure-report';
import { TreatmentPerformanceReportView } from './treatment-performance-report';

/*
 * The report detail frame (UI-SPEC §4.2): breadcrumb, header, the as-at line, the Summary strip and
 * the sections. A report is a reading page, so the whole frame is capped at the container width
 * (UI-D15); at 1440 and below the cap has no effect.
 */

const readingPageClassName = 'w-full max-w-container-max';

/** "Reports" then the report's title, or a title bar while the report is not yet known. */
export function ReportBreadcrumb({ title }: { title?: string }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/app/reports">Reports</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {title ? <BreadcrumbPage>{title}</BreadcrumbPage> : <Skeleton className="h-4 w-32" />}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * A report's page: the breadcrumb and the header from the copy map, which render before any data
 * resolves, then the report body. `action` is the header's action slot (the throughput period); it
 * shares one navigation transition with the body, which is busy while a new period loads.
 */
export function ReportDetailLayout({ action, children, copy }: { action?: ReactNode; children: ReactNode; copy: ReportCopy }) {
  return (
    <div className={readingPageClassName} data-slot="report-page">
      <ReportTransitionProvider>
        <ReportBreadcrumb title={copy.title} />
        <PageHeader action={action} description={copy.description} title={copy.title} />
        <ReportBody>{children}</ReportBody>
      </ReportTransitionProvider>
    </div>
  );
}

function ReportSections({ report }: { report: Report }) {
  switch (report.key) {
    case 'risk-exposure':
      return <RiskExposureReportView report={report} />;
    case 'treatment-performance':
      return <TreatmentPerformanceReportView report={report} />;
    case 'assessment-throughput':
      return <AssessmentThroughputReportView report={report} />;
    case 'control-effectiveness':
      return <ControlEffectivenessReportView report={report} />;
  }
}

const summaryHeadingId = 'report-summary-heading';

/** A report as the server computed it: the as-at line, the Summary tiles, then the sections. */
export function ReportDetailFrame({ report }: { report: Report }) {
  const asAt = asAtLabel(report.today);
  const tiles = reportKpiTiles(report);

  return (
    <div className="space-y-8" data-slot="report-detail">
      <div className="space-y-4">
        <p className="text-xs text-foreground-secondary">
          {asAt.lead}
          <time dateTime={asAt.dateTime}>{asAt.date}</time>
          {asAt.end}
        </p>
        <section aria-labelledby={summaryHeadingId}>
          <h2 className="sr-only" id={summaryHeadingId}>Summary</h2>
          <KpiTileStrip className={tiles.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}>
            {tiles.map((tile) => (
              <KpiTile caption={tile.caption} href={tile.href} key={tile.key} supportingText={tile.supportingText} value={tile.value} />
            ))}
          </KpiTileStrip>
        </section>
      </div>
      <ReportSections report={report} />
    </div>
  );
}

/** The skeleton shape of each report: its tiles, whether they carry a supporting line, and its sections. */
const reportSkeletonShapes = {
  'risk-exposure': { tiles: 3, supportingText: false, sections: 3 },
  'treatment-performance': { tiles: 3, supportingText: false, sections: 3 },
  'assessment-throughput': { tiles: 2, supportingText: true, sections: 2 },
  'control-effectiveness': { tiles: 2, supportingText: false, sections: 2 },
} as const satisfies Record<ReportKey, { tiles: number; supportingText: boolean; sections: number }>;

const genericSkeletonShape = { tiles: 3, supportingText: false, sections: 2 } as const;

/**
 * A loading report body in its final layout: the as-at line, one tile skeleton per tile, and one
 * section skeleton per section. Without a key (the route's own loading boundary) it draws a
 * generic report.
 */
export function ReportDetailSkeleton({ reportKey }: { reportKey?: ReportKey }) {
  const shape = reportKey ? reportSkeletonShapes[reportKey] : genericSkeletonShape;

  return (
    <div aria-label="Loading report" aria-live="polite" className="space-y-8" role="status">
      <span className="sr-only">Loading report</span>
      <div className="space-y-4">
        <Skeleton className="h-4 w-64 max-w-full" />
        <KpiTileStrip className={shape.tiles > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}>
          {Array.from({ length: shape.tiles }, (_, index) => <KpiTileSkeleton hasSupportingText={shape.supportingText} key={index} />)}
        </KpiTileStrip>
      </div>
      {Array.from({ length: shape.sections }, (_, index) => <ReportSectionSkeleton key={index} />)}
    </div>
  );
}

/** The report route's loading boundary, which cannot know the key: the Reports root, a title bar and a generic body. */
export function ReportDetailLoading() {
  return (
    <div className={readingPageClassName} data-slot="report-page">
      <ReportBreadcrumb />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <ReportDetailSkeleton />
    </div>
  );
}

/** An analyst's unknown report key (UI-SPEC §7.5). A refused viewer never reaches it. */
export function ReportNotFoundState() {
  return (
    <PageHeader
      action={<Link className={buttonVariants({ variant: 'outline' })} href="/app/reports">View reports</Link>}
      description="Choose a report from the Reports list."
      title="Report not found"
    />
  );
}
