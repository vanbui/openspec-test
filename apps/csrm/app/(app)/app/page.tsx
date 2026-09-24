import Link from 'next/link';

import { PageHeader } from '@/components/shell/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { RequestorDashboard } from '@/features/dashboard/requestor-dashboard';
import { deriveRequestorDashboard, getRequestorDashboard, type RequestorDashboardState } from '@/features/dashboard/requestor-dashboard-service';
import { E2eUiStateBoundary, resolveE2eDashboardPartial, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Dashboard | IdamBox CSRM' };

type WorkspacePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const emptyDashboardState: RequestorDashboardState = {
  kind: 'ready',
  dashboard: deriveRequestorDashboard([], []),
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your authorised requests, questionnaires, and released assessment activity."
        action={<Link className={buttonVariants({ className: '!text-primary-foreground' })} href="/app/requests/new">Create request</Link>}
      />
      {presentationFixtureState ? (
        <E2eUiStateBoundary state={presentationFixtureState}>
          <RequestorDashboard failedWidget={partialDashboard ? 'draft-requests' : undefined} state={state} />
        </E2eUiStateBoundary>
      ) : <RequestorDashboard failedWidget={partialDashboard ? 'draft-requests' : undefined} state={state} />}
    </>
  );
}
