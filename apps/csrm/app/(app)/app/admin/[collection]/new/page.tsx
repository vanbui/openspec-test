import { createControlAction, createInformationAssetAction, createInformationSystemAction, createRiskTypeAction, searchApplicableControlsAction } from '@/features/administration/administration-actions';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { administrationKinds, getAdministrationConfig, type AdministrationKind } from '@/features/administration/administration-config';
import { AdministrationForm } from '@/features/administration/administration-form';
import { AdministrationAccessDenied, AdministrationBreadcrumbs } from '@/features/administration/administration-workspace';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { listControls } from '@/features/assessments/assessment-service';
import { applicableControlOptions } from '@/features/administration/applicable-controls';
import { searchActiveUsersAction } from '@/features/assessments/assessment-actions';

type Props = { params: Promise<{ collection: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = (await params).collection;
  if (!administrationKinds.includes(collection as AdministrationKind)) notFound();
  return { title: `Create ${getAdministrationConfig(collection as AdministrationKind).label} | IdamBox CSRM` };
}

export default async function NewAdministrationRecordPage({ params }: Props) {
  const collection = (await params).collection;
  // Read before the capability check, so a denial still names the collection it refused.
  const knownKind = administrationKinds.includes(collection as AdministrationKind) ? collection as AdministrationKind : undefined;
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('administration:manage', granted)) return <AdministrationAccessDenied kind={knownKind} />;

  if (!knownKind) notFound();
  const kind = knownKind;
  getAdministrationConfig(kind);
  if (kind === 'controls') {
    return <><AdministrationBreadcrumbs kind={kind} current="New" /><AdministrationForm createAction={createControlAction} kind="controls" mode="create" /></>;
  }
  if (kind === 'information-systems') return <><AdministrationBreadcrumbs kind={kind} current="New" /><AdministrationForm createAction={createInformationSystemAction} kind={kind} mode="create" searchOwners={searchActiveUsersAction} /></>;
  if (kind === 'information-assets') return <><AdministrationBreadcrumbs kind={kind} current="New" /><AdministrationForm createAction={createInformationAssetAction} kind={kind} mode="create" /></>;
  // The first options name each control by its label; searching reaches the rest of the library (D-29, D-36).
  const controls = await listControls();
  const initialControlOptions = applicableControlOptions(controls.data ?? []);
  return <><AdministrationBreadcrumbs kind={kind} current="New" /><AdministrationForm createAction={createRiskTypeAction} initialControlOptions={initialControlOptions} kind={kind} mode="create" searchControls={searchApplicableControlsAction} /></>;
}
