import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReleasedAssessmentDetailView } from '@/features/assessments/released-assessment';
import { ReleasedAssessmentHeaderActions } from '@/features/assessments/released-assessment-actions';
import {
  loadRequestorReleasedAssessment,
  logContractMismatch,
  readReleasedAssessment,
  releasedAssessmentActions,
  requestorReportHref,
  toAssessmentReportModel,
} from '@/features/assessments/released-assessment-report';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type ReleasedAssessmentPageProps = { params: Promise<{ documentId: string }> };

/*
 * Strapi answers another Requestor's assessment with 404, so the page renders the in-shell not-found.
 * The title follows it (Page not found | IdamBox CSRM) only because this metadata makes the same read, the shared
 * loader's cached readReleasedAssessment, so the title and the page make one detail read between them.
 */
export async function generateMetadata({ params }: ReleasedAssessmentPageProps): Promise<Metadata> {
  return recordRouteMetadata(readReleasedAssessment((await params).documentId), 'Released Risk Assessment | IdamBox CSRM');
}

export default async function ReleasedAssessmentPage({ params }: ReleasedAssessmentPageProps) {
  const { documentId } = await params;
  // Phase 19 (D-23, W5): the reads and their branches live in the shared loader the report routes use too.
  const result = await loadRequestorReleasedAssessment(documentId);
  if (result.state === 'not-found') notFound();
  if (result.state === 'contract-mismatch') {
    logContractMismatch(result.operation);
    return <ReleasedAssessmentDetailView state="contract-mismatch" />;
  }
  if (result.state !== 'populated') return <ReleasedAssessmentDetailView state={result.state} />;

  /*
   * 19-UI-SPEC §1, §4.1: Print report, then Export {number} when the session holds the export (read as Home reads it).
   * Rendered here, after the reads, so no refused or failed state carries either; the API is the control (D-16).
   */
  const canExport = can('released-assessment:export', await viewerCapabilities());
  const model = toAssessmentReportModel({ actor: 'requestor', assessment: result.assessment, risks: result.risks, controlsByRisk: result.controlsByRisk });
  const actions = releasedAssessmentActions({ canExport, documentId, model, reportHref: requestorReportHref(documentId) });

  return (
    <ReleasedAssessmentDetailView
      assessment={result.assessment}
      controlsByRisk={result.controlsByRisk}
      headerAction={<ReleasedAssessmentHeaderActions actions={actions} />}
      risks={result.risks}
      state="populated"
    />
  );
}
