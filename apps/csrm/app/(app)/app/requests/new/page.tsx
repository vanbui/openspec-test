import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { RequestForm } from '@/features/requests/request-form';
import { listInformationAssets, listInformationSystems } from '@/features/requests/request-service';

export const metadata = { title: 'New Request | IdamBox CSRM' };

export default async function NewRequestPage() {
  const [systems, assets] = await Promise.all([listInformationSystems(), listInformationAssets()]);
  const error = systems.error ?? assets.error;

  return (
    <>
      <PageHeader description="Save a structured draft now and submit it when it is ready for assessment." title="New assessment request" />
      {error ? error.status === 403 ? <PermissionDeniedState /> : <ErrorState /> : (
        <RequestForm assets={assets.data ?? []} mode="create" systems={systems.data ?? []} />
      )}
    </>
  );
}
