import { RequestorDashboard } from '@/features/dashboard/requestor-dashboard';
import { deriveRequestorDashboard, getRequestorDashboard, type RequestorDashboardState } from '@/features/dashboard/requestor-dashboard-service';
import { E2eUiStateBoundary, resolveE2eDashboardPartial, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

type RequestorHomeContentProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const emptyDashboardState: RequestorDashboardState = {
  kind: 'ready',
  dashboard: deriveRequestorDashboard([], []),
};

/**
 * The Requestor Home's body: the Requestor's own requests, questionnaires and released assessments
 * (D-16). Home chooses it for everyone without `assessment:review`, so it issues no analyst read. Its
 * guarded presentation fixtures resolve only after the real, owner-scoped reads succeed; a refused or
 * failed read is authoritative. Plan 11-09 rebuilds the sections (UI-SPEC §5.2).
 */
export async function RequestorHomeContent({ searchParams }: RequestorHomeContentProps) {
  const params = await searchParams;
  const authoritativeState = await getRequestorDashboard();
  const fixtureState = resolveE2eUiState(params);
  const presentationFixtureState = authoritativeState.kind === 'ready' ? fixtureState : undefined;
  const partialDashboard = authoritativeState.kind === 'ready' && resolveE2eDashboardPartial(params);
  const state: RequestorDashboardState = authoritativeState.kind !== 'ready' || !fixtureState || fixtureState === 'populated'
    ? authoritativeState
    : fixtureState === 'loading'
      ? { kind: 'loading' }
      : fixtureState === 'empty'
        ? emptyDashboardState
        : fixtureState === 'error'
          ? { kind: 'error' }
          : { kind: 'permission-denied' };

  return presentationFixtureState ? (
    <E2eUiStateBoundary state={presentationFixtureState}>
      <RequestorDashboard failedWidget={partialDashboard ? 'draft-requests' : undefined} state={state} />
    </E2eUiStateBoundary>
  ) : <RequestorDashboard failedWidget={partialDashboard ? 'draft-requests' : undefined} state={state} />;
}

/** The Requestor Home's loading body, the page's Suspense fallback for a Requestor. */
export function RequestorHomeSkeleton() {
  return <RequestorDashboard state={{ kind: 'loading' }} />;
}
