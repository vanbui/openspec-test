import { Suspense } from 'react';

import { PermissionDeniedState } from '@/components/states/states';
import { AlertList, AlertListLoading } from '@/features/alerts/alert-list';
import { alertListUrlQuerySchema } from '@/features/alerts/alert-schema';
import { listAlerts } from '@/features/alerts/alert-service';
import { AlertsPageHeader } from '@/features/alerts/alerts-page-header';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Alerts | IdamBox CSRM' };

type AlertsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The analyst's derived alerts (DASH-02). The capability check comes before any read, so a
 * Requestor sees the permission state and issues no analyst read (D-16). The check is presentation
 * only: Strapi authorises the read itself, and its 403 renders the same state.
 */
export async function AlertsContent({ searchParams }: AlertsPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <PermissionDeniedState area="alerts" />;

  const params = await searchParams;
  const query = alertListUrlQuerySchema.parse(params);
  const result = await listAlerts({
    kinds: query.kind ? [query.kind] : undefined,
    urgency: query.urgency,
    page: query.page,
    pageSize: query.pageSize,
  });
  const emptyPagination = { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  if (result.error?.status === 403) return <PermissionDeniedState area="alerts" />;
  if (result.error) return <AlertList alerts={[]} pagination={emptyPagination} query={query} state="error" />;

  // The guarded presentation fixture resolves only after a successful, authorised read.
  const fixtureState = resolveE2eUiState(params);
  const { data, meta } = result.data;
  if (fixtureState && fixtureState !== 'populated') {
    return (
      <E2eUiStateBoundary state={fixtureState}>
        <AlertList
          alerts={[]}
          dueSoonWindowDays={meta.dueSoonWindowDays}
          pagination={emptyPagination}
          query={query}
          state={fixtureState === 'empty' ? undefined : fixtureState}
        />
      </E2eUiStateBoundary>
    );
  }

  const list = <AlertList alerts={data} dueSoonWindowDays={meta.dueSoonWindowDays} pagination={meta.pagination} query={query} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list;
}

export default function AlertsPage({ searchParams }: AlertsPageProps) {
  return (
    <>
      <AlertsPageHeader />
      <Suspense fallback={<AlertListLoading />}>
        <AlertsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
