import {
  commitAdministrationCsvAction,
  downloadImportErrorReportAction,
  downloadImportTemplateAction,
  previewAdministrationCsvAction,
} from '@/features/administration/administration-actions';
import { CsvImportFlow } from '@/features/administration/csv-import-flow';
import { administrationKinds, type AdministrationKind } from '@/features/administration/administration-config';
import { AdministrationAccessDenied } from '@/features/administration/administration-workspace';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAdministrationConfig } from '@/features/administration/administration-config';
import { AdministrationBreadcrumbs } from '@/features/administration/administration-workspace';

type Props = { params: Promise<{ collection: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = (await params).collection;
  if (!administrationKinds.includes(collection as AdministrationKind)) notFound();
  // 19-UI-SPEC §5.1: the route title names no format, since a workbook imports too.
  return { title: `Import ${getAdministrationConfig(collection as AdministrationKind).pluralLabel} | IdamBox CSRM` };
}

export default async function AdministrationImportPage({ params }: Props) {
  const collection = (await params).collection;
  // Read before the capability check, so a denial still names the collection it refused.
  const knownKind = administrationKinds.includes(collection as AdministrationKind) ? collection as AdministrationKind : undefined;
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session
    ? await sessionAdapter.capabilitiesFor(session).granted()
    : new Set<Capability>();

  if (!can('administration:manage', granted)) {
    return <AdministrationAccessDenied kind={knownKind} />;
  }

  if (!knownKind) {
    notFound();
  }
  const kind = knownKind;

  return (<><AdministrationBreadcrumbs kind={kind} current="Import" /><CsvImportFlow
      kind={kind}
      previewAction={previewAdministrationCsvAction}
      commitAction={commitAdministrationCsvAction}
      templateAction={downloadImportTemplateAction}
      errorReportAction={downloadImportErrorReportAction}
    /></>);
}
