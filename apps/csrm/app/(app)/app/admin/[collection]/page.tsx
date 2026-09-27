import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdministrationAccessDenied, AdministrationBreadcrumbs, AdministrationWorkspace } from '@/features/administration/administration-workspace';
import { administrationKinds, getAdministrationConfig, type AdministrationKind } from '@/features/administration/administration-config';
import { parseAdministrationQuery } from '@/features/administration/administration-schema';
import { listAdministrationControls, listInformationAssets, listInformationSystems, listRiskTypes } from '@/features/administration/administration-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

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
  const workspace = <AdministrationWorkspace densityUserId={session?.displayName} items={result.data?.data ?? []} kind={kind} pagination={pagination} query={query} state={result.error ? 'error' : result.data?.data.length ? 'ready' : 'empty'} />;
  return <><AdministrationBreadcrumbs kind={kind} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{workspace}</E2eUiStateBoundary> : workspace}</>;
}
