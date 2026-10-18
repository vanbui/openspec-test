import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AssessmentReportScreen } from '@/features/assessments/assessment-report';
import {
  loadRequestorReleasedAssessment,
  logContractMismatch,
  readReleasedAssessment,
  toAssessmentReportModel,
} from '@/features/assessments/released-assessment-report';
import { readViewerTimeZone } from '@/lib/time/viewer-time-zone';

type RequestorReportPageProps = { params: Promise<{ documentId: string }> };

/*
 * The Requestor's print-ready report (Phase 19 D-14, D-23; 19-UI-SPEC §4). It reads through the released page's loader,
 * so Strapi's one released-assessment record-read check gates it: another person's assessment, or an unreleased one,
 * is the in-shell not-found, and so is a refused one, because an unreadable assessment reads as missing (D-16).
 * The title makes the same cached detail read, so it takes the not-found's title in those cases too.
 */
export async function generateMetadata({ params }: RequestorReportPageProps): Promise<Metadata> {
  const result = await readReleasedAssessment((await params).documentId);
  const status = result.error?.status;
  if (status === 404 || status === 403) notFound();
  return { title: result.data ? `Print report ${result.data.assessmentNumber} | IdamBox CSRM` : 'Print report | IdamBox CSRM' };
}

export default async function RequestorReportPage({ params }: RequestorReportPageProps) {
  const { documentId } = await params;
  const result = await loadRequestorReleasedAssessment(documentId);
  if (result.state === 'not-found' || result.state === 'permission') notFound();
  if (result.state === 'contract-mismatch') logContractMismatch(result.operation);
  // A failed, mismatched or unavailable read renders the route's error boundary (`We couldn’t load this report`).
  if (result.state !== 'populated') throw new Error('The released assessment report could not be loaded.');

  const model = toAssessmentReportModel({ actor: 'requestor', assessment: result.assessment, risks: result.risks, controlsByRisk: result.controlsByRisk });
  return (
    <AssessmentReportScreen
      backHref={`/app/assessments/${encodeURIComponent(documentId)}`}
      generatedAt={new Date().toISOString()}
      model={model}
      timeZone={await readViewerTimeZone()}
    />
  );
}
