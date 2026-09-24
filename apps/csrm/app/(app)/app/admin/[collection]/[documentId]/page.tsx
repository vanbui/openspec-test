import { searchApplicableControlsAction, updateControlAction, updateInformationAssetAction, updateInformationSystemAction, updateRiskTypeAction } from '@/features/administration/administration-actions';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { administrationKinds, getAdministrationConfig, type AdministrationKind } from '@/features/administration/administration-config';
import { administrationDocumentIdSchema } from '@/features/administration/administration-schema';
import { getAdministrationControl, getInformationAsset, getInformationSystem, getRiskType } from '@/features/administration/administration-service';
import { AdministrationAccessDenied, AdministrationBreadcrumbs, AdministrationForm, AdministrationUnavailableState } from '@/features/administration/administration-workspace';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { listControls } from '@/features/assessments/assessment-service';
import { searchActiveUsersAction } from '@/features/assessments/assessment-actions';

type Props = { params: Promise<{ collection: string; documentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = (await params).collection;
  if (!administrationKinds.includes(collection as AdministrationKind)) notFound();
  return { title: `${getAdministrationConfig(collection as AdministrationKind).label} Details | IdamBox CSRM` };
}

export default async function AdministrationRecordPage({ params }: Props) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('administration:manage', granted)) return <AdministrationAccessDenied />;

  const values = await params;
  if (!administrationKinds.includes(values.collection as AdministrationKind)) notFound();
  const kind = values.collection as 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  getAdministrationConfig(kind);
  const documentId = administrationDocumentIdSchema.safeParse(values.documentId);
  if (!documentId.success) return <AdministrationUnavailableState kind={kind} />;
  if (kind === 'controls') {
    const result = await getAdministrationControl(documentId.data);
    if (result.error?.status === 403) return <AdministrationAccessDenied />;
    if (result.error?.status === 404) return <AdministrationUnavailableState kind="controls" />;
    if (result.error || !result.data) return <AdministrationUnavailableState error kind="controls" />;
    return <><AdministrationBreadcrumbs kind={kind} current={result.data.name} /><AdministrationForm documentId={documentId.data} initialValues={result.data} kind="controls" mode="edit" updateAction={updateControlAction} /></>;
  }
  if (kind === 'information-systems') {
    const result = await getInformationSystem(documentId.data);
    if (result.error?.status === 403) return <AdministrationAccessDenied />;
    if (result.error?.status === 404) return <AdministrationUnavailableState kind={kind} />;
    if (result.error || !result.data) return <AdministrationUnavailableState error kind={kind} />;
    return <><AdministrationBreadcrumbs kind={kind} current={result.data.name} /><AdministrationForm documentId={documentId.data} initialValues={result.data} kind={kind} mode="edit" searchOwners={searchActiveUsersAction} updateAction={updateInformationSystemAction} /></>;
  }
  if (kind === 'information-assets') {
    const result = await getInformationAsset(documentId.data);
    if (result.error?.status === 403) return <AdministrationAccessDenied />;
    if (result.error?.status === 404) return <AdministrationUnavailableState kind={kind} />;
    if (result.error || !result.data) return <AdministrationUnavailableState error kind={kind} />;
    return <><AdministrationBreadcrumbs kind={kind} current={result.data.name} /><AdministrationForm documentId={documentId.data} initialValues={result.data} kind={kind} mode="edit" updateAction={updateInformationAssetAction} /></>;
  }
  const [result, controls] = await Promise.all([getRiskType(documentId.data), listControls()]);
  if (result.error?.status === 403) return <AdministrationAccessDenied />;
  if (result.error?.status === 404) return <AdministrationUnavailableState />;
  if (result.error || !result.data) return <AdministrationUnavailableState error />;
  const controlData = [...(controls.data ?? [])];
  const initialControlOptions = (controlData.length > 0 ? controlData
    .sort((left, right) => left.controlNumber.localeCompare(right.controlNumber, 'en-AU', { numeric: true }))
    .slice(0, 100)
    .map((control) => ({ documentId: control.documentId, label: `${control.controlNumber} · ${control.name}` }))
    : (result.data?.applicableControls ?? []).slice(0, 100).map((controlId, index) => ({ documentId: controlId, label: `Reusable Control ${index + 1}` })));
  return <><AdministrationBreadcrumbs kind={kind} current={result.data.name} /><AdministrationForm documentId={documentId.data} initialControlOptions={initialControlOptions} initialValues={result.data} kind={kind} mode="edit" searchControls={searchApplicableControlsAction} updateAction={updateRiskTypeAction} /></>;
}
