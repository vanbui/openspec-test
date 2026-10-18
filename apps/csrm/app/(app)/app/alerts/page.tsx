import { Suspense } from 'react';

import { PermissionDeniedState } from '@/components/states/states';
import { AlertList, AlertListLoading } from '@/features/alerts/alert-list';
import { alertFilterChips } from '@/features/alerts/alert-list-chips';
import { alertListUrlQuerySchema } from '@/features/alerts/alert-schema';
import { listAlerts } from '@/features/alerts/alert-service';
import { AlertsPageHeader } from '@/features/alerts/alerts-page-header';
import { exportAlertsAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings } from '@/config/navigation/page-headings';

export const metadata = { title: 'Alerts | IdamBox CSRM' };

type AlertsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The analyst's derived alerts (DASH-02). The capability check comes before any read, so a
 * Requestor sees the permission state and issues no analyst read (D-16). The check is presentation
 * only: Strapi authorises the read itself, and its 403 renders the same state.
 *
 * The header renders here, after the read, above every state (the Export placement pattern, the
 * pilot's ruling of 2026-10-16). Export shows only when the read returned the alerts, no E2E
 * presentation fixture replaced them, and the session holds alerts:export (D-16).
 */
export async function AlertsContent({ searchParams }: AlertsPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <><AlertsPageHeader /><PermissionDeniedState area="alerts" /></>;

  const params = await searchParams;
  const query = alertListUrlQuerySchema.parse(params);
  const result = await listAlerts({
    kinds: query.kind ? [query.kind] : undefined,
    urgency: query.urgency,
    page: query.page,
    pageSize: query.pageSize,
  });
  const emptyPagination = { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  if (result.error?.status === 403) return <><AlertsPageHeader /><PermissionDeniedState area="alerts" /></>;
  if (result.error) return <><AlertsPageHeader /><AlertList alerts={[]} pagination={emptyPagination} query={query} state="error" /></>;

  // The guarded presentation fixture resolves only after a successful, authorised read.
  const fixtureState = resolveE2eUiState(params);
  const { data, meta } = result.data;
  if (fixtureState && fixtureState !== 'populated') {
    return (
      <>
        <AlertsPageHeader />
        <E2eUiStateBoundary state={fixtureState}>
          <AlertList
            alerts={[]}
            dueSoonWindowDays={meta.dueSoonWindowDays}
            pagination={emptyPagination}
            query={query}
            state={fixtureState === 'empty' ? undefined : fixtureState}
          />
        </E2eUiStateBoundary>
      </>
    );
  }

  const exportButton = can('alerts:export', granted)
    ? (
      <ListExportButton
        action={exportAlertsAction}
        chips={alertFilterChips(query)}
        heading={pageHeadings.alerts}
        pagination={meta.pagination}
        query={{ ...(query.kind ? { kinds: [query.kind] } : {}), ...(query.urgency ? { urgency: query.urgency } : {}) }}
        view="alerts"
      />
    )
    : undefined;
  const list = <AlertList alerts={data} dueSoonWindowDays={meta.dueSoonWindowDays} pagination={meta.pagination} query={query} />;
  return <><AlertsPageHeader action={exportButton} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}</>;
}

export default function AlertsPage({ searchParams }: AlertsPageProps) {
  return (
    <Suspense fallback={<><AlertsPageHeader /><AlertListLoading /></>}>
      <AlertsContent searchParams={searchParams} />
    </Suspense>
  );
}
