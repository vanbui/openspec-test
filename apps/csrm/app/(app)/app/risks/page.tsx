import { Suspense } from 'react';
import { PageHeader } from '@/components/shell/app-shell';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { RiskRegisterAccessDenied, RiskRegisterInvalidFilterState, RiskRegisterTable } from '@/features/risks/risk-register';
import { mergeSelectedRiskPickerOption, riskRegisterQuerySchema } from '@/features/risks/risk-schema';
import { listRiskRegister } from '@/features/risks/risk-service';
import { searchRiskRegisterRelationsAction } from '@/features/risks/risk-actions';
import { RiskRegisterLoading } from '@/features/risks/risk-register-loading';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Risk Register | IdamBox CSRM' };
const description = 'Search and manage contextual Risks across authorised assessments.';
type RisksPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function RiskRegisterContent({ searchParams }: RisksPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('risk:manage', granted)) return <RiskRegisterAccessDenied />;

  const parsedQuery = riskRegisterQuerySchema.safeParse(await searchParams);
  if (!parsedQuery.success) return <RiskRegisterInvalidFilterState />;
  const query = parsedQuery.data;
  const result = await listRiskRegister(query);
  const fixtureState = resolveE2eUiState(await searchParams);
  const presentationFixtureState = result.error ? undefined : fixtureState;
  if (presentationFixtureState === 'loading') return <E2eUiStateBoundary state={presentationFixtureState}><RiskRegisterLoading /></E2eUiStateBoundary>;
  if (presentationFixtureState && presentationFixtureState !== 'populated') {
    return <E2eUiStateBoundary state={presentationFixtureState}><RiskRegisterTable risks={[]} query={query} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={{ owners: [], assessments: [], systems: [], assets: [] }} densityUserId={session?.displayName ?? 'security-analyst'} state={presentationFixtureState === 'empty' ? undefined : presentationFixtureState} /></E2eUiStateBoundary>;
  }

  const labels = result.data?.meta.selectedLabels ?? {};
  const pagination = result.data?.meta.pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 };
  const table = <RiskRegisterTable risks={result.data?.data ?? []} query={query} pagination={pagination} selectedLabels={labels} pickerOptions={{ owners: mergeSelectedRiskPickerOption(mergeSelectedRiskPickerOption([], labels.riskOwner), labels.treatmentOwner), assessments: mergeSelectedRiskPickerOption([], labels.assessment), systems: mergeSelectedRiskPickerOption([], labels.system), assets: mergeSelectedRiskPickerOption([], labels.asset) }} searchRelations={searchRiskRegisterRelationsAction} densityUserId={session?.displayName ?? 'security-analyst'} state={result.error ? result.error.status === 403 ? 'permission' : 'error' : undefined} />;
  return presentationFixtureState ? <E2eUiStateBoundary state={presentationFixtureState}>{table}</E2eUiStateBoundary> : table;
}

export default function RisksPage({ searchParams }: RisksPageProps) {
  return <><PageHeader title="Risk Register" description={description} /><Suspense fallback={<RiskRegisterLoading />}><RiskRegisterContent searchParams={searchParams} /></Suspense></>;
}
