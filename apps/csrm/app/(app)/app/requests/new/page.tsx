import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { RequestForm } from '@/features/requests/request-form';
import { listInformationAssets, listInformationSystems } from '@/features/requests/request-service';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';

export const metadata = { title: routeTitle(pageHeadings.newRequest) };

export default async function NewRequestPage() {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment-request:create', granted)) {
    return <><PageHeader description="Save a structured draft now and submit it when it is ready for assessment." title={pageHeadings.newRequest} /><PermissionDeniedState area="create requests" /></>;
  }

  const [systems, assets] = await Promise.all([listInformationSystems(), listInformationAssets()]);
  const error = systems.error ?? assets.error;

  return (
    <>
      <PageHeader description="Save a structured draft now and submit it when it is ready for assessment." title={pageHeadings.newRequest} />
      {error ? error.status === 403 ? <PermissionDeniedState /> : <ErrorState /> : (
        /* 14-UI-SPEC §2.1 (D-26): files chosen with the request are kept in the tab under the signed-in person's key. */
        <RequestForm assets={assets.data ?? []} draftOwnerKey={session ? draftOwnerKey(session) : null} mode="create" systems={systems.data ?? []} />
      )}
    </>
  );
}
