import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdministrationAccessDenied, AdministrationBreadcrumbs, AdministrationWorkspace } from '@/features/administration/administration-workspace';
import { administrationKinds, getAdministrationConfig, type AdministrationKind } from '@/features/administration/administration-config';
import { administrationFilterChips } from '@/features/administration/administration-domain';
import { parseAdministrationQuery } from '@/features/administration/administration-schema';
import { listAdministrationControls, listInformationAssets, listInformationSystems, listRiskTypes } from '@/features/administration/administration-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { keyLabel } from '@/features/administration/import-flow-rules';
import { exportReferenceListAction } from '@/features/exports/export-actions';
import { exportViewColumns } from '@/features/exports/export-vocabulary';
import { ListExportButton } from '@/features/exports/list-export-button';

/*
 * Each reference list's own export capability (19-15, D-33): the list read and the collection's export, held as Strapi
 * grants them. administration:manage (the list reads) never decides Export.
 */
const exportCapabilities = {
  'risk-types': 'risk-types:export',
  controls: 'controls:export',
  'information-systems': 'information-systems:export',
  'information-assets': 'information-assets:export',
} as const satisfies Record<AdministrationKind, Capability>;

type Props = {
  params: Promise<{ collection: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const collection = (await params).collection;
  if (!administrationKinds.includes(collection as AdministrationKind)) notFound();
  return { title: `${getAdministrationConfig(collection as AdministrationKind).pluralLabel} | IdamBox CSRM` };
}

export default async function AdministrationCollectionPage({ params, searchParams }: Props) {
  const collection = (await params).collection;
  if (!administrationKinds.includes(collection as AdministrationKind)) notFound();
  const kind = collection as 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  getAdministrationConfig(kind);
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('administration:manage', granted)) return <AdministrationAccessDenied kind={kind} />;
  const paramsValue = await searchParams;
  const query = parseAdministrationQuery(kind, paramsValue);
  const result = kind === 'controls' ? await listAdministrationControls(query) : kind === 'information-systems' ? await listInformationSystems(query) : kind === 'information-assets' ? await listInformationAssets(query) : await listRiskTypes(query);
  if (result.error?.status === 403) return <AdministrationAccessDenied kind={kind} />;
  if (result.error) return <><AdministrationBreadcrumbs kind={kind} /><AdministrationWorkspace densityUserId={session?.displayName} items={[]} kind={kind} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} state="error" /></>;
  const fixtureState = resolveE2eUiState(paramsValue);
  if (fixtureState === 'permission') return <E2eUiStateBoundary state={fixtureState}><AdministrationAccessDenied kind={kind} /></E2eUiStateBoundary>;
  if (fixtureState && fixtureState !== 'populated') {
    return <><AdministrationBreadcrumbs kind={kind} /><E2eUiStateBoundary state={fixtureState}><AdministrationWorkspace densityUserId={session?.displayName} items={[]} kind={kind} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} state={fixtureState === 'empty' ? 'empty' : fixtureState} /></E2eUiStateBoundary></>;
  }
  const pagination = result.data?.meta.pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  /*
   * The Export placement pattern (19-06, 19-11): Export renders only when the read succeeded (no error and no presentation
   * fixture replaced it) and the session holds this collection's export. Every column is checked, with the round-trip hint
   * (19-UI-SPEC §2.4), so the file imports back.
   */
  const exportButton = result.data && can(exportCapabilities[kind], granted)
    ? <ListExportButton
        action={exportReferenceListAction.bind(null, kind)}
        chips={administrationFilterChips(query)}
        columnsHint={`To edit this file and import it again, keep ${keyLabel(kind)} and every required column.`}
        heading={getAdministrationConfig(kind).pluralLabel}
        pagination={pagination}
        query={query}
        view={kind}
        visibleColumns={exportViewColumns(kind).map((column) => column.key)}
      />
    : undefined;
  const workspace = <AdministrationWorkspace densityUserId={session?.displayName} exportButton={exportButton} items={result.data?.data ?? []} kind={kind} pagination={pagination} query={query} state={result.error ? 'error' : result.data?.data.length ? 'ready' : 'empty'} />;
  return <><AdministrationBreadcrumbs kind={kind} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{workspace}</E2eUiStateBoundary> : workspace}</>;
}
