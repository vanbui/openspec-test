import { Suspense } from 'react';

import { PermissionDeniedState } from '@/components/states/states';
import { AnalystDashboard, AnalystDashboardSkeleton } from '@/features/analyst-dashboard/analyst-dashboard';
import { AnalystDashboardPageHeader } from '@/features/analyst-dashboard/analyst-dashboard-page-header';
import { analystDashboardCopy, emptyAnalystDashboard } from '@/features/analyst-dashboard/analyst-dashboard-presentation';
import { getAnalystDashboard, type AnalystDashboard as AnalystDashboardData } from '@/features/analyst-dashboard/analyst-dashboard-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eAnalystDashboardPartial, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Analyst Dashboard | IdamBox CSRM' };

type AnalystDashboardPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The guarded partial fixture: Top alerts alone is unavailable, exactly as a failed alert page leaves it. */
function withFailedTopAlerts(dashboard: AnalystDashboardData): AnalystDashboardData {
  return { ...dashboard, units: { ...dashboard.units, topAlerts: { status: 'unavailable' } } };
}

/**
 * The analyst dashboard (DASH-01, D-15). The capability check comes before any read, so a Requestor
 * sees the permission state and issues no analyst read (D-16). The check is presentation only:
 * Strapi authorises every read itself, and a refused read renders the same state.
 */
export async function AnalystDashboardContent({ searchParams }: AnalystDashboardPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <PermissionDeniedState area={analystDashboardCopy.area} />;

  const state = await getAnalystDashboard();
  // A refusal or a failed summary is authoritative: no fixture can stand in for it.
  if (state.kind !== 'ready') return <AnalystDashboard state={state} />;

  // The guarded presentation fixtures resolve only after the real, authorised reads succeeded.
  const params = await searchParams;
  const fixtureState = resolveE2eUiState(params);
  const failTopAlerts = resolveE2eAnalystDashboardPartial(params);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><AnalystDashboardSkeleton /></E2eUiStateBoundary>;
  if (fixtureState === 'error') return <E2eUiStateBoundary state={fixtureState}><AnalystDashboard state={{ kind: 'error' }} /></E2eUiStateBoundary>;
  if (fixtureState === 'permission') {
    return <E2eUiStateBoundary state={fixtureState}><AnalystDashboard state={{ kind: 'permission-denied' }} /></E2eUiStateBoundary>;
  }

  // The empty fixture renders safe empty data, never the figures the read returned.
  const shown = fixtureState === 'empty' ? emptyAnalystDashboard(state.dashboard.dueSoonWindowDays) : state.dashboard;
  const dashboard = <AnalystDashboard state={{ kind: 'ready', dashboard: failTopAlerts ? withFailedTopAlerts(shown) : shown }} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{dashboard}</E2eUiStateBoundary> : dashboard;
}

export default function AnalystDashboardPage({ searchParams }: AnalystDashboardPageProps) {
  return (
    <>
      <AnalystDashboardPageHeader />
      <Suspense fallback={<AnalystDashboardSkeleton />}>
        <AnalystDashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
