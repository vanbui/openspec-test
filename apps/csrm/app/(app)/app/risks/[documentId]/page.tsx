import { Suspense } from 'react';

import { searchActiveUsersAction } from '@/features/assessments/assessment-actions';
import { documentIdSchema } from '@/features/assessments/assessment-schema';
import { listControls, listRiskTypes } from '@/features/assessments/assessment-service';
import { RiskDetails, RiskDetailsSkeleton } from '@/features/risks/risk-details';
import { listInformationAssets, listInformationSystems } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

type RiskDetailsPageProps = { params: Promise<{ documentId: string }> };

export const metadata = { title: 'Risk Details | IdamBox CSRM' };

async function RiskDetailsContent({ params }: RiskDetailsPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('risk:manage', granted)) return <RiskDetails state="permission" />;

  const parsedId = documentIdSchema.safeParse((await params).documentId);
  if (!parsedId.success) return <RiskDetails state="not-available" />;

  const { getRiskDetail } = await import('@/features/risks/risk-service');
  const result = await getRiskDetail(parsedId.data);
  if (result.error?.status === 403) return <RiskDetails state="permission" />;
  if (result.error?.status === 404) return <RiskDetails state="not-available" />;
  if (result.error) return <RiskDetails state="error" />;
  if (result.data.parentLock === 'released') return <RiskDetails detail={result.data} />;

  const [riskTypes, controls, systems, assets] = await Promise.all([
    listRiskTypes(), listControls(), listInformationSystems(), listInformationAssets(),
  ]);
  const inventories = [riskTypes, controls, systems, assets];
  if (inventories.some((inventory) => inventory.error?.status === 403)) return <RiskDetails state="permission" />;
  if (inventories.some((inventory) => inventory.error)) return <RiskDetails state="error" />;
  const relatedUsers = [
    result.data.riskOwner,
    result.data.treatmentOwner,
    ...result.data.controlImplementations.map((implementation) => implementation.controlOwner),
  ].filter((user): user is NonNullable<typeof user> => user !== null);
  const users = [...new Map(relatedUsers.map((user) => [user.documentId, user])).values()];

  const mergedSystems = result.data.informationSystemImpacted
    ? [result.data.informationSystemImpacted, ...(systems.data ?? []).filter((item) => item.documentId !== result.data.informationSystemImpacted?.documentId)]
    : systems.data ?? [];
  const mergedAssets = result.data.informationAssetImpacted
    ? [result.data.informationAssetImpacted, ...(assets.data ?? []).filter((item) => item.documentId !== result.data.informationAssetImpacted?.documentId)]
    : assets.data ?? [];

  return <RiskDetails detail={result.data} options={{ riskTypes: riskTypes.data ?? [], controls: controls.data ?? [], systems: mergedSystems, assets: mergedAssets, users }} searchOwners={searchActiveUsersAction} />;
}

export default function RiskDetailsPage({ params }: RiskDetailsPageProps) {
  return <Suspense fallback={<RiskDetailsSkeleton />}><RiskDetailsContent params={params} /></Suspense>;
}
