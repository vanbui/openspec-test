import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { RequestForm } from '@/features/requests/request-form';
import { toRequestFormValues } from '@/features/requests/request-form-values';
import { canRequestorEdit } from '@/features/requests/request-domain';
import { getRequest, hydrateInformationAssetSelections, hydrateInformationSystemSelections } from '@/features/requests/request-service';

type EditRequestPageProps = { params: Promise<{ documentId: string }> };

export default async function EditRequestPage({ params }: EditRequestPageProps) {
  const { documentId } = await params;
  const requestResult = await getRequest(documentId);
  const selectedSystems = requestResult.data?.informationSystems.map((item) => item.documentId) ?? [];
  const selectedAssets = requestResult.data?.informationAssets.map((item) => item.documentId) ?? [];
  const [systems, assets] = await Promise.all([
    selectedSystems.length ? hydrateInformationSystemSelections(selectedSystems) : Promise.resolve({ data: [], error: null }),
    selectedAssets.length ? hydrateInformationAssetSelections(selectedAssets) : Promise.resolve({ data: [], error: null }),
  ]);
  const error = requestResult.error ?? systems.error ?? assets.error;
  if (error?.status === 404) notFound();
  if (error) return error.status === 403 ? <PermissionDeniedState /> : <ErrorState />;
  if (!requestResult.data) notFound();
  if (!canRequestorEdit(requestResult.data.requestStatus)) return <PermissionDeniedState />;

  return (
    <>
      <PageHeader description={`${requestResult.data.requestNumber} · Draft`} title="Edit assessment request" />
      <RequestForm
        assets={assets.data ?? []}
        defaultValues={toRequestFormValues(requestResult.data)}
        documentId={requestResult.data.documentId}
        mode="edit"
        systems={systems.data ?? []}
      />
    </>
  );
}
