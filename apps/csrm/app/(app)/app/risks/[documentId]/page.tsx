import { Suspense } from 'react';

import { searchActiveUsersAction, searchControlsAction } from '@/features/assessments/assessment-actions';
import { documentIdSchema } from '@/features/assessments/assessment-schema';
import { getAnalystAssessment, listRiskTypes } from '@/features/assessments/assessment-service';
import { RiskDetails, RiskDetailsSkeleton } from '@/features/risks/risk-details';
import { searchInformationAssetsAction, searchInformationSystemsAction } from '@/features/requests/request-actions';
import type { RequestRelationSummary } from '@/features/requests/request-domain';
import { getRequest } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

type RiskDetailsPageProps = { params: Promise<{ documentId: string }> };

export const metadata = { title: 'Risk Details | IdamBox CSRM' };

type RequestSelections = { systems: readonly RequestRelationSummary[]; assets: readonly RequestRelationSummary[] };
const noRequestSelections: RequestSelections = { systems: [], assets: [] };

/**
 * The originating request's selected systems and assets, offered first in the pickers (D-30). The Risk names its
 * assessment and the assessment names its request; both reads run under the viewer's own grants, so Strapi
 * authorises each one. Either read failing leaves no suggestions and the editor searches only (research Open
 * Question 2); the failure shows nothing and never blocks the Risk.
 */
async function readRequestSelections(assessmentId: string): Promise<RequestSelections> {
  try {
    const assessment = await getAnalystAssessment(assessmentId);
    if (assessment.error || !assessment.data) return noRequestSelections;
    const request = await getRequest(assessment.data.assessmentRequest.documentId);
    if (request.error || !request.data) return noRequestSelections;
    return { systems: request.data.informationSystems ?? [], assets: request.data.informationAssets ?? [] };
  } catch {
    return noRequestSelections;
  }
}

export async function RiskDetailsContent({ params }: RiskDetailsPageProps) {
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

  // No option list is loaded whole (D-28): the pickers search the control library and the inventories, the Risk
  // Types carry their applicable controls (D-31), and the Risk's own relations name its system and asset (D-30).
  const [riskTypes, requestSelections] = await Promise.all([
    listRiskTypes(),
    readRequestSelections(result.data.assessment.documentId),
  ]);
  if (riskTypes.error?.status === 403) return <RiskDetails state="permission" />;
  if (riskTypes.error) return <RiskDetails state="error" />;
  const relatedUsers = [
    result.data.riskOwner,
    result.data.treatmentOwner,
    ...result.data.controlImplementations.map((implementation) => implementation.controlOwner),
  ].filter((user): user is NonNullable<typeof user> => user !== null);
  const users = [...new Map(relatedUsers.map((user) => [user.documentId, user])).values()];

  return (
    <RiskDetails
      detail={result.data}
      options={{
        riskTypes: riskTypes.data ?? [],
        users,
        requestSystems: requestSelections.systems,
        requestAssets: requestSelections.assets,
        searchControls: searchControlsAction,
        searchSystems: searchInformationSystemsAction,
        searchAssets: searchInformationAssetsAction,
      }}
      searchOwners={searchActiveUsersAction}
    />
  );
}

export default function RiskDetailsPage({ params }: RiskDetailsPageProps) {
  return <Suspense fallback={<RiskDetailsSkeleton />}><RiskDetailsContent params={params} /></Suspense>;
}
