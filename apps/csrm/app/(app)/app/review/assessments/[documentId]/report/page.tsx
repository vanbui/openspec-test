import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AssessmentReportScreen } from '@/features/assessments/assessment-report';
import {
  loadAnalystReleasedAssessment,
  readAnalystReleasedAssessment,
  toAssessmentReportModel,
} from '@/features/assessments/released-assessment-report';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { readViewerTimeZone } from '@/lib/time/viewer-time-zone';

type AnalystReportPageProps = { params: Promise<{ documentId: string }> };

/*
 * The analyst's print-ready report (Phase 19 D-14, D-15, D-23; 19-UI-SPEC §4). It renders only when the analyst detail's
 * server-computed `released` is true; before release, without the review gate, or for a refused or missing read it is
 * the in-shell not-found (D-16). The paper equals the Requestor's: the model keeps active Risks only (W4).
 */
export async function generateMetadata({ params }: AnalystReportPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) notFound();
  const result = await readAnalystReleasedAssessment((await params).documentId);
  const status = result.error?.status;
  if (status === 404 || status === 403 || (!result.error && !result.data?.released)) notFound();
  return { title: result.data ? `Print report ${result.data.assessmentNumber} | IdamBox CSRM` : 'Print report | IdamBox CSRM' };
}

export default async function AnalystReportPage({ params }: AnalystReportPageProps) {
  const { documentId } = await params;
  // A failure that is not a refusal throws inside the loader, so the route's error boundary renders.
  const loaded = await loadAnalystReleasedAssessment(documentId);
  if (!loaded) notFound();

  return (
    <AssessmentReportScreen
      backHref={`/app/review/assessments/${encodeURIComponent(documentId)}`}
      generatedAt={new Date().toISOString()}
      model={toAssessmentReportModel({ actor: 'analyst', ...loaded })}
      timeZone={await readViewerTimeZone()}
    />
  );
}
