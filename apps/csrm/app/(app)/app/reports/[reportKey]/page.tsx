import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { ExportButton } from '@/components/csrm/export/export-button';
import { PermissionDeniedState } from '@/components/states/states';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { exportReportAction } from '@/features/exports/export-actions';
import { exportReportScopeSentence } from '@/features/exports/export-scope';
import { exportReport as reportExportSpec } from '@/features/exports/export-vocabulary';
import { isReportKey, reportCopy, type ReportKey } from '@/features/reports/report-copy';
import { ReportDetailFrame, ReportDetailLayout, ReportDetailSkeleton } from '@/features/reports/report-detail';
import { ReportPeriodControl } from '@/features/reports/report-period-control';
import { asAtLabel, zeroedReport } from '@/features/reports/report-presentation';
import { reportPeriodSchema, type Report, type ReportPeriod } from '@/features/reports/report-schema';
import { getReport } from '@/features/reports/report-service';
import { ReportsPageHeader } from '@/features/reports/reports-page-header';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

type RouteSearchParams = Record<string, string | string[] | undefined>;

type ReportPageProps = {
  params: Promise<{ reportKey: string }>;
  searchParams: Promise<RouteSearchParams>;
};

/** The one title a viewer who may not read reports sees on every report URL, and an analyst on an unknown key. */
const reportsMetadataTitle = 'Reports | IdamBox CSRM';

/*
 * Resolved before the key is even read, in the page and in its metadata, so a viewer who may not
 * read reports gets the same header, state and document title for every key and cannot tell a
 * real report from an invented one (D-16, T-07-07-01). Presentation only: Strapi authorises the
 * read itself.
 */
async function sessionCapabilities(): Promise<ReadonlySet<Capability>> {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  return session ? sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
}

async function canReadReports(): Promise<boolean> {
  return can('assessment:review', await sessionCapabilities());
}

export async function generateMetadata({ params }: Pick<ReportPageProps, 'params'>): Promise<Metadata> {
  if (!(await canReadReports())) return { title: reportsMetadataTitle };
  const { reportKey } = await params;
  return { title: isReportKey(reportKey) ? reportCopy(reportKey).metadataTitle : reportsMetadataTitle };
}

/** Only the throughput report has a period: an absent or unknown value reads as six months (UI-D8). */
function periodOf(reportKey: ReportKey, query: RouteSearchParams): ReportPeriod | undefined {
  return reportKey === 'assessment-throughput' ? reportPeriodSchema.parse(query.period) : undefined;
}

/*
 * The header's actions (19-UI-SPEC §1, UI-D1): the throughput period control, then Export last in the markup. Two
 * actions share the administration header's wrapper, so the phone stack and the keyboard read Export last while the
 * period control keeps the right edge on desktop.
 */
function reportHeaderAction(period: ReportPeriod | undefined, exportButton?: ReactNode): ReactNode {
  const periodControl = period === undefined ? undefined : <ReportPeriodControl period={period} />;
  if (!periodControl || !exportButton) return periodControl ?? exportButton;
  return <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse">{periodControl}{exportButton}</div>;
}

/*
 * The header's Export (Phase 19 X-30, D-22, UI-D5): a fixed-table view of the report's tables in the vocabulary's (the
 * page's) order, with no column choice. The scope comes from this read's as-at date, so no second read is made; the
 * action is bound to the report's key and sends the report's own query, the period alone.
 */
function ReportExport({ period, report, reportKey }: { period?: ReportPeriod; report: Report; reportKey: ReportKey }) {
  const { title } = reportCopy(reportKey);
  const tables = reportExportSpec(reportKey).tables.map(({ heading, key }) => ({ key, heading }));
  return (
    <ExportButton
      action={exportReportAction.bind(null, reportKey)}
      chips={[]}
      fixedTables={tables}
      heading={title}
      multiplePages={false}
      query={period === undefined ? {} : { period: `${period}` }}
      scope={exportReportScopeSentence({ title, asAt: asAtLabel(report.today).date, ...(period === undefined ? {} : { period: `${period} months` }), tables: tables.length })}
      searchActive={false}
      total={tables.length}
      view={`report:${reportKey}`}
    />
  );
}

/*
 * One server-computed report (D-13) under its header, which renders here, after the read, in every state (the Export
 * placement pattern, the pilot's ruling of 2026-10-16). Export shows only when the read returned the report, no E2E
 * presentation fixture replaced it, and the session holds reports:export; the server refuses every other export (D-16).
 * The guarded E2E fixture resolves only after a successful read.
 */
export async function ReportDetailContent({ reportKey, searchParams }: { reportKey: ReportKey; searchParams: Promise<RouteSearchParams> }) {
  const query = await searchParams;
  const period = periodOf(reportKey, query);
  const result = period === undefined ? await getReport(reportKey) : await getReport(reportKey, { period });
  const copy = reportCopy(reportKey);
  const page = (body: ReactNode, exportButton?: ReactNode) => (
    <ReportDetailLayout action={reportHeaderAction(period, exportButton)} copy={copy}>{body}</ReportDetailLayout>
  );
  if (result.error?.status === 403) return page(<PermissionDeniedState area="reports" />);
  if (result.error) return page(<RetryableErrorState noun="this report" />);

  const fixtureState = resolveE2eUiState(query);
  if (fixtureState === 'loading') return page(<E2eUiStateBoundary state={fixtureState}><ReportDetailSkeleton reportKey={reportKey} /></E2eUiStateBoundary>);
  if (fixtureState === 'error') return page(<E2eUiStateBoundary state={fixtureState}><RetryableErrorState noun="this report" /></E2eUiStateBoundary>);
  if (fixtureState === 'permission') return page(<E2eUiStateBoundary state={fixtureState}><PermissionDeniedState area="reports" /></E2eUiStateBoundary>);
  if (fixtureState === 'empty') return page(<E2eUiStateBoundary state={fixtureState}><ReportDetailFrame report={zeroedReport(result.data)} /></E2eUiStateBoundary>);

  const exportButton = can('reports:export', await sessionCapabilities())
    ? <ReportExport period={period} report={result.data} reportKey={reportKey} />
    : undefined;
  const frame = <ReportDetailFrame report={result.data} />;
  return page(fixtureState ? <E2eUiStateBoundary state={fixtureState}>{frame}</E2eUiStateBoundary> : frame, exportButton);
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  if (!(await canReadReports())) {
    return (
      <>
        <ReportsPageHeader />
        <PermissionDeniedState area="reports" />
      </>
    );
  }

  const { reportKey } = await params;
  if (!isReportKey(reportKey)) notFound();

  const period = periodOf(reportKey, await searchParams);

  // The static header the fallback shows carries the period control alone; Export renders only after the read.
  return (
    <Suspense fallback={<ReportDetailLayout action={reportHeaderAction(period)} copy={reportCopy(reportKey)}><ReportDetailSkeleton reportKey={reportKey} /></ReportDetailLayout>}>
      <ReportDetailContent reportKey={reportKey} searchParams={searchParams} />
    </Suspense>
  );
}
