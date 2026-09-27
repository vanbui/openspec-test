import { Suspense } from 'react';

import { PermissionDeniedState } from '@/components/states/states';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { ReportIndex, ReportIndexSkeleton } from '@/features/reports/report-index';
import { listReportDefinitions } from '@/features/reports/report-service';
import { ReportsPageHeader } from '@/features/reports/reports-page-header';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Reports | IdamBox CSRM' };

type ReportsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The analyst report index (DASH-02, D-13). The capability check comes before any read, so a
 * Requestor sees the permission state and issues no analyst read (D-16). The check is presentation
 * only: Strapi authorises the read itself, and its 403 renders the same state.
 */
export async function ReportIndexContent({ searchParams }: ReportsPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <PermissionDeniedState area="reports" />;

  const result = await listReportDefinitions();
  if (result.error?.status === 403) return <PermissionDeniedState area="reports" />;
  if (result.error) return <RetryableErrorState noun="reports" />;

  // The guarded presentation fixture resolves only after a successful, authorised read.
  const fixtureState = resolveE2eUiState(await searchParams);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><ReportIndexSkeleton /></E2eUiStateBoundary>;
  if (fixtureState === 'error') return <E2eUiStateBoundary state={fixtureState}><RetryableErrorState noun="reports" /></E2eUiStateBoundary>;
  if (fixtureState === 'permission') return <E2eUiStateBoundary state={fixtureState}><PermissionDeniedState area="reports" /></E2eUiStateBoundary>;
  if (fixtureState === 'empty') return <E2eUiStateBoundary state={fixtureState}><ReportIndex definitions={[]} /></E2eUiStateBoundary>;

  const index = <ReportIndex definitions={result.data} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{index}</E2eUiStateBoundary> : index;
}

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return (
    <>
      <ReportsPageHeader />
      <Suspense fallback={<ReportIndexSkeleton />}>
        <ReportIndexContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
