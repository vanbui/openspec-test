import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { RequestForm } from '@/features/requests/request-form';
import { toRequestFormValues } from '@/features/requests/request-form-values';
import { canRequestorEdit } from '@/features/requests/request-domain';
import { getRequest, hydrateInformationAssetSelections, hydrateInformationSystemSelections } from '@/features/requests/request-service';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type EditRequestPageProps = { params: Promise<{ documentId: string }> };

const editHeading = 'Edit assessment request';

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

export async function generateMetadata({ params }: EditRequestPageProps): Promise<Metadata> {
  return recordRouteMetadata(readRequest((await params).documentId), 'Edit Request | IdamBox CSRM');
}

/*
 * A request that cannot be edited keeps the page's one level-one heading. It names the page, never the
 * record: Strapi refuses another Requestor's request, and a request past draft is not editable.
 */
function UnavailableEditHeader() {
  return <PageHeader description="Update a draft assessment request before you submit it." title={editHeading} />;
}

export default async function EditRequestPage({ params }: EditRequestPageProps) {
  const { documentId } = await params;
  const requestResult = await readRequest(documentId);
  const selectedSystems = requestResult.data?.informationSystems.map((item) => item.documentId) ?? [];
  const selectedAssets = requestResult.data?.informationAssets.map((item) => item.documentId) ?? [];
  const [systems, assets] = await Promise.all([
    selectedSystems.length ? hydrateInformationSystemSelections(selectedSystems) : Promise.resolve({ data: [], error: null }),
    selectedAssets.length ? hydrateInformationAssetSelections(selectedAssets) : Promise.resolve({ data: [], error: null }),
  ]);
  const error = requestResult.error ?? systems.error ?? assets.error;
  if (error?.status === 404) notFound();
  if (error) return <><UnavailableEditHeader />{error.status === 403 ? <PermissionDeniedState /> : <ErrorState />}</>;
  if (!requestResult.data) notFound();
  if (!canRequestorEdit(requestResult.data.requestStatus)) return <><UnavailableEditHeader /><PermissionDeniedState /></>;

  return (
    <>
      <PageHeader description={`${requestResult.data.requestNumber} · Draft`} title={editHeading} />
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
