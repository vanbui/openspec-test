import Link from 'next/link';
import { PageHeader } from '@/components/shell/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { RequestTable } from '@/features/requests/request-table';
import { parseRequestListQuery } from '@/features/requests/request-schema';
import { listRequests } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'My Requests | IdamBox CSRM' };

type RequestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const params = await searchParams;
  const query = parseRequestListQuery(params);
  const [result, session] = await Promise.all([
    listRequests(query),
    getSessionAdapter().current(),
  ]);
  const fixtureState = resolveE2eUiState(params);
  const denied = result?.error?.status === 403;
  const presentationFixtureState = result?.error ? undefined : fixtureState;
  // A substituted presentation must also substitute the records. RequestTable derives its
  // own state from requests.length when state is undefined, so passing the real rows with an
  // empty fixture renders the populated table and the empty state never appears.
  const fixtureSubstituted = Boolean(presentationFixtureState && presentationFixtureState !== 'populated');
  const requests = fixtureSubstituted ? [] : result?.data?.requests ?? [];
  const pagination = fixtureSubstituted
    ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }
    : result?.data?.pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  const state = presentationFixtureState && presentationFixtureState !== 'populated'
    ? presentationFixtureState === 'empty' ? undefined : presentationFixtureState
    : result?.error ? denied ? 'permission' : 'error' : undefined;
  const table = <RequestTable requests={requests} query={query} pagination={pagination} densityUserId={session?.displayName ?? 'requestor'} state={state} />;

  return (
    <>
      <PageHeader
        title="My Requests"
        description="Find and track the cyber risk assessment requests you are authorised to view."
        action={presentationFixtureState === 'permission' ? undefined : <Link className={buttonVariants()} href="/app/requests/new">New request</Link>}
      />
      {presentationFixtureState ? <E2eUiStateBoundary state={presentationFixtureState}>{table}</E2eUiStateBoundary> : table}
    </>
  );
}
