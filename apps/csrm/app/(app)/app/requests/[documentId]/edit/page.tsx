import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states/states';
import { listRequestAttachments } from '@/features/attachments/attachments-service';
import { filesSectionFor } from '@/features/attachments/files-section';
import { RequestForm } from '@/features/requests/request-form';
import { toRequestFormValues } from '@/features/requests/request-form-values';
import { canRequestorEdit } from '@/features/requests/request-domain';
import { getRequest, hydrateInformationAssetSelections, hydrateInformationSystemSelections } from '@/features/requests/request-service';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';

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

  const request = requestResult.data;
  /*
   * 14-UI-SPEC §2.3 (D-27; UI-D4): the edit form lists the draft's files and adds chosen files at once. As on the request
   * page, the files are read only for a viewer the request read gave a file summary (D-18). Rendering the queue here also
   * puts the upload action in this route, where the new-request form's actions post once its address is replaced
   * (RESEARCH Pitfall 17).
   */
  const sessionAdapter = getSessionAdapter();
  const [session, files] = await Promise.all([
    sessionAdapter.current(),
    request.attachments ? listRequestAttachments(request.documentId) : Promise.resolve(null),
  ]);
  const ownerKey = session ? draftOwnerKey(session) : null;

  return (
    <>
      <PageHeader description={`${request.requestNumber} · Draft`} title={editHeading} />
      <RequestForm
        assets={assets.data ?? []}
        defaultValues={toRequestFormValues(request)}
        documentId={request.documentId}
        draftOwnerKey={ownerKey}
        files={filesSectionFor(request, files, { viewer: 'requestor', draftOwnerKey: ownerKey })}
        mode="edit"
        systems={systems.data ?? []}
      />
    </>
  );
}
