import { PermissionDeniedState } from '@/components/states/states';
import { AnalystDashboard, AnalystDashboardSkeleton, ownRequestsPlacement } from '@/features/analyst-dashboard/analyst-dashboard';
import { analystDashboardCopy, analystHomePermissionAction, emptyAnalystDashboard } from '@/features/analyst-dashboard/analyst-dashboard-presentation';
import { getAnalystDashboard, type AnalystDashboard as AnalystDashboardData } from '@/features/analyst-dashboard/analyst-dashboard-service';
import { getMyRequestStatusSummary } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eAnalystDashboardPartial, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { OwnRequestsPanel, type OwnRequestHolderCounts } from './own-requests-panel';
import type { RequestorHomeSection } from './requestor-home-presentation';

type AnalystHomeContentProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The guarded partial fixture: Top alerts alone is unavailable, exactly as a failed alert page leaves it. */
function withFailedTopAlerts(dashboard: AnalystDashboardData): AnalystDashboardData {
  return { ...dashboard, units: { ...dashboard.units, topAlerts: { status: 'unavailable' } } };
}

/** The empty fixture's own requests: zero rows, never the counts the read returned. */
const noOwnRequests: RequestorHomeSection<OwnRequestHolderCounts> = { status: 'ready', data: { requestor: 0, analyst: 0, none: 0 } };

/**
 * The analyst Home: the review summary (DASH-01, D-16, D-18), ending with the analyst's own requests (D-18 item 7).
 * Home chooses it for `assessment:review`, and it keeps its own capability check before any read, so it never
 * renders analyst data on its own say-so (T-11-14). Both checks are presentation only: Strapi authorises every
 * read itself, and a refused read renders the same state. The own requests come from the caller's owner-scoped
 * status summary, read beside the review summary; that read fails on its own.
 */
export async function AnalystHomeContent({ searchParams }: AnalystHomeContentProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <PermissionDeniedState action={analystHomePermissionAction} area={analystDashboardCopy.area} />;

  const [state, summary] = await Promise.all([getAnalystDashboard(), getMyRequestStatusSummary()]);
  // A refusal or a failed summary is authoritative: no fixture can stand in for it.
  if (state.kind !== 'ready') return <AnalystDashboard state={state} />;
  const ownRequests: RequestorHomeSection<OwnRequestHolderCounts> = summary.error || !summary.data
    ? { status: 'unavailable' }
    : { status: 'ready', data: summary.data.byHolder };

  // The guarded presentation fixtures resolve only after the real, authorised reads succeed (D-23).
  const params = await searchParams;
  const fixtureState = resolveE2eUiState(params);
  const failTopAlerts = resolveE2eAnalystDashboardPartial(params);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><AnalystDashboardSkeleton /></E2eUiStateBoundary>;
  if (fixtureState === 'error') return <E2eUiStateBoundary state={fixtureState}><AnalystDashboard state={{ kind: 'error' }} /></E2eUiStateBoundary>;
  if (fixtureState === 'permission') {
    return <E2eUiStateBoundary state={fixtureState}><AnalystDashboard state={{ kind: 'permission-denied' }} /></E2eUiStateBoundary>;
  }

  // The empty fixture renders safe empty data, never the figures the reads returned.
  const empty = fixtureState === 'empty';
  const shown = empty ? emptyAnalystDashboard(state.dashboard.dueSoonWindowDays) : state.dashboard;
  const dashboard = (
    <AnalystDashboard
      ownRequests={<OwnRequestsPanel canCreate={can('assessment-request:create', granted)} className={ownRequestsPlacement} state={empty ? noOwnRequests : ownRequests} />}
      state={{ kind: 'ready', dashboard: failTopAlerts ? withFailedTopAlerts(shown) : shown }}
    />
  );
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{dashboard}</E2eUiStateBoundary> : dashboard;
}
