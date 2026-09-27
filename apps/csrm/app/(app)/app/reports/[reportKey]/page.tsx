import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PermissionDeniedState } from '@/components/states/states';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { isReportKey, reportCopy, type ReportKey } from '@/features/reports/report-copy';
import { ReportDetailFrame, ReportDetailLayout, ReportDetailSkeleton } from '@/features/reports/report-detail';
import { ReportPeriodControl } from '@/features/reports/report-period-control';
import { zeroedReport } from '@/features/reports/report-presentation';
import { reportPeriodSchema } from '@/features/reports/report-schema';
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
async function canReadReports(): Promise<boolean> {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  return can('assessment:review', granted);
}

export async function generateMetadata({ params }: Pick<ReportPageProps, 'params'>): Promise<Metadata> {
  if (!(await canReadReports())) return { title: reportsMetadataTitle };
  const { reportKey } = await params;
  return { title: isReportKey(reportKey) ? reportCopy(reportKey).metadataTitle : reportsMetadataTitle };
}

/** One server-computed report (D-13). The guarded E2E fixture resolves only after a successful read. */
export async function ReportDetailContent({ reportKey, searchParams }: { reportKey: ReportKey; searchParams: Promise<RouteSearchParams> }) {
  const query = await searchParams;
  const result = reportKey === 'assessment-throughput'
    ? await getReport(reportKey, { period: reportPeriodSchema.parse(query.period) })
    : await getReport(reportKey);
  if (result.error?.status === 403) return <PermissionDeniedState area="reports" />;
  if (result.error) return <RetryableErrorState noun="this report" />;

  const fixtureState = resolveE2eUiState(query);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><ReportDetailSkeleton reportKey={reportKey} /></E2eUiStateBoundary>;
  if (fixtureState === 'error') return <E2eUiStateBoundary state={fixtureState}><RetryableErrorState noun="this report" /></E2eUiStateBoundary>;
  if (fixtureState === 'permission') return <E2eUiStateBoundary state={fixtureState}><PermissionDeniedState area="reports" /></E2eUiStateBoundary>;
  if (fixtureState === 'empty') return <E2eUiStateBoundary state={fixtureState}><ReportDetailFrame report={zeroedReport(result.data)} /></E2eUiStateBoundary>;

  const frame = <ReportDetailFrame report={result.data} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{frame}</E2eUiStateBoundary> : frame;
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

  // Only the throughput report has a period: an absent or unknown value reads as six months (UI-D8).
  const period = reportKey === 'assessment-throughput' ? reportPeriodSchema.parse((await searchParams).period) : undefined;

  return (
    <ReportDetailLayout action={period === undefined ? undefined : <ReportPeriodControl period={period} />} copy={reportCopy(reportKey)}>
      <Suspense fallback={<ReportDetailSkeleton reportKey={reportKey} />}>
        <ReportDetailContent reportKey={reportKey} searchParams={searchParams} />
      </Suspense>
    </ReportDetailLayout>
  );
}
