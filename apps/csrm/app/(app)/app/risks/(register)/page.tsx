import { Suspense, type ReactNode } from 'react';
import { PageHeader } from '@/components/shell/app-shell';
import { ExportButton } from '@/components/csrm/export/export-button';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { exportRiskRegisterAction } from '@/features/exports/export-actions';
import { RiskRegisterAccessDenied, RiskRegisterInvalidFilterState, RiskRegisterTable } from '@/features/risks/risk-register';
import { riskRegisterFilterChips } from '@/features/risks/risk-register-chips';
import { mergeSelectedRiskPickerOption, riskRegisterQuerySchema, type RiskRegisterPayload, type RiskRegisterQuery } from '@/features/risks/risk-schema';
import { listRiskRegister } from '@/features/risks/risk-service';
import { searchRiskRegisterRelationsAction } from '@/features/risks/risk-actions';
import { RiskRegisterLoading } from '@/features/risks/risk-register-loading';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';

export const metadata = { title: routeTitle(pageHeadings.riskRegister) };
const description = 'Search and manage Risks from released risk assessments and from those still under assessment.';
type RisksPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function RiskRegisterHeader({ action }: { action?: ReactNode }) {
  return <PageHeader action={action} description={description} title={pageHeadings.riskRegister} />;
}

/*
 * The header's Export (Phase 19 X-30; the pilot's export placement ruling of 2026-10-16): the export's dialog is told the
 * register read's own total, search and filter chips, so no second read counts the rows, and it sends the parsed query
 * without its page and page size, because an export is every page (D-13).
 */
function RiskRegisterExport({ payload, query }: { payload: RiskRegisterPayload; query: RiskRegisterQuery }) {
  const { page: _page, pageSize: _pageSize, ...exportQuery } = query;
  const labels = payload.meta.selectedLabels;
  const chips = riskRegisterFilterChips(query, (key) => labels[key]?.label ?? query[key] ?? '').filter((chip) => chip.id !== 'q');
  return (
    <ExportButton
      action={exportRiskRegisterAction}
      chips={chips.map(({ label, value }) => ({ label, value }))}
      heading={pageHeadings.riskRegister}
      multiplePages={payload.meta.pagination.pageCount > 1}
      query={exportQuery}
      search={query.q}
      searchActive={query.q.length > 0}
      total={payload.meta.pagination.total}
      view="risk-register"
    />
  );
}

export async function RiskRegisterContent({ searchParams }: RisksPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('risk:manage', granted)) return <><RiskRegisterHeader /><RiskRegisterAccessDenied /></>;

  const parsedQuery = riskRegisterQuerySchema.safeParse(await searchParams);
  if (!parsedQuery.success) return <><RiskRegisterHeader /><RiskRegisterInvalidFilterState /></>;
  const query = parsedQuery.data;
  const result = await listRiskRegister(query);
  const fixtureState = resolveE2eUiState(await searchParams);
  const presentationFixtureState = result.error ? undefined : fixtureState;
  if (presentationFixtureState === 'loading') return <><RiskRegisterHeader /><E2eUiStateBoundary state={presentationFixtureState}><RiskRegisterLoading /></E2eUiStateBoundary></>;
  if (presentationFixtureState && presentationFixtureState !== 'populated') {
    return <><RiskRegisterHeader /><E2eUiStateBoundary state={presentationFixtureState}><RiskRegisterTable risks={[]} query={query} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={{ owners: [], assessments: [], systems: [], assets: [] }} densityUserId={session?.displayName ?? 'security-analyst'} state={presentationFixtureState === 'empty' ? undefined : presentationFixtureState} /></E2eUiStateBoundary></>;
  }

  // Export shows only for a session granted it and a read that returned data; the server refuses every other export (D-16).
  const exportAction = can('risk-register:export', granted) && result.data ? <RiskRegisterExport payload={result.data} query={query} /> : undefined;
  const labels = result.data?.meta.selectedLabels ?? {};
  const pagination = result.data?.meta.pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  const table = <RiskRegisterTable risks={result.data?.data ?? []} query={query} pagination={pagination} selectedLabels={labels} pickerOptions={{ owners: mergeSelectedRiskPickerOption(mergeSelectedRiskPickerOption([], labels.riskOwner), labels.treatmentOwner), assessments: mergeSelectedRiskPickerOption([], labels.assessment), systems: mergeSelectedRiskPickerOption([], labels.system), assets: mergeSelectedRiskPickerOption([], labels.asset) }} searchRelations={searchRiskRegisterRelationsAction} densityUserId={session?.displayName ?? 'security-analyst'} state={result.error ? result.error.status === 403 ? 'permission' : 'error' : undefined} />;
  return <><RiskRegisterHeader action={exportAction} />{presentationFixtureState ? <E2eUiStateBoundary state={presentationFixtureState}>{table}</E2eUiStateBoundary> : table}</>;
}

export default function RisksPage({ searchParams }: RisksPageProps) {
  return <Suspense fallback={<><PageHeader title={pageHeadings.riskRegister} description={description} /><RiskRegisterLoading /></>}><RiskRegisterContent searchParams={searchParams} /></Suspense>;
}
