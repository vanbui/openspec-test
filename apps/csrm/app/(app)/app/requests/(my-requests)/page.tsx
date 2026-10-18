import Link from 'next/link';
import { PageHeader } from '@/components/shell/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { exportMyRequestsAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { myRequestFilterChips } from '@/features/requests/my-request-chips';
import { myRequestsDescription } from '@/features/requests/my-requests-copy';
import { RequestTable } from '@/features/requests/request-table';
import { parseRequestListQuery } from '@/features/requests/request-schema';
import { listMyRequests } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';

export const metadata = { title: routeTitle(pageHeadings.myRequests) };

type RequestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const params = await searchParams;
  const query = parseRequestListQuery(params);
  const [result, session] = await Promise.all([
    listMyRequests(query),
    getSessionAdapter().current(),
  ]);
  const fixtureState = resolveE2eUiState(params);
  const denied = result?.error?.status === 403;
  const presentationFixtureState = result?.error ? undefined : fixtureState;
  // A substituted presentation must also substitute the records. RequestTable derives its
  // own state from requests.length when state is undefined, so passing the real rows with an
  // empty fixture renders the populated table and the empty state never appears.
  const fixtureSubstituted = Boolean(presentationFixtureState && presentationFixtureState !== 'populated');
  const requests = fixtureSubstituted ? [] : result?.data?.items ?? [];
  const pagination = fixtureSubstituted
    ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }
    : result?.data?.pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  const state = presentationFixtureState && presentationFixtureState !== 'populated'
    ? presentationFixtureState === 'empty' ? undefined : presentationFixtureState
    : result?.error ? denied ? 'permission' : 'error' : undefined;
  const table = <RequestTable requests={requests} query={query} pagination={pagination} densityUserId={session?.displayName ?? 'requestor'} state={state} />;

  // Export (the Export placement pattern, the pilot's ruling of 2026-10-16) shows only when the read returned the
  // list, no E2E presentation fixture replaced it, and the session holds my-requests:export (D-16).
  const exportButton = result?.data && !fixtureSubstituted && can('my-requests:export', await viewerCapabilities())
    ? <ListExportButton action={exportMyRequestsAction} chips={myRequestFilterChips(query)} heading={pageHeadings.myRequests} pagination={result.data.pagination} query={query} view="my-requests" />
    : undefined;
  const newRequest = presentationFixtureState === 'permission' ? undefined : <Link className={buttonVariants()} href="/app/requests/new">New request</Link>;
  // New request, then Export last in the markup (19-UI-SPEC §1, UI-D1): the phone stack and the keyboard read Export
  // last, and on desktop New request keeps the right edge with Export to its left.
  const action = newRequest && exportButton
    ? <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse">{newRequest}{exportButton}</div>
    : newRequest ?? exportButton;

  return (
    <>
      <PageHeader
        title={pageHeadings.myRequests}
        description={myRequestsDescription}
        action={action}
      />
      {presentationFixtureState ? <E2eUiStateBoundary state={presentationFixtureState}>{table}</E2eUiStateBoundary> : table}
    </>
  );
}
