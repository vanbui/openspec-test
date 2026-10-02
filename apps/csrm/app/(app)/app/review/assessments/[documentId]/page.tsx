import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import {
  AssessmentEditor,
  AssessmentEditorSkeleton,
} from '@/features/assessments/assessment-editor';
import {
  getAnalystAssessment,
  listControlImplementations,
  listControls,
  listRiskTypes,
} from '@/features/assessments/assessment-service';
import { searchActiveUsersAction } from '@/features/assessments/assessment-actions';
import { listInformationAssets, listInformationSystems } from '@/features/requests/request-service';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type AssessmentReviewPageProps = { params: Promise<{ documentId: string }> };

const title = 'Risk Assessment Review | IdamBox CSRM';

// One read per request, shared by the document title and the page.
const readAnalystAssessment = cache(getAnalystAssessment);

/*
 * A viewer without assessment:review keeps the static title and the assessment is never read (D-23), so an
 * existing id and a missing one look the same. For an analyst, an assessment id that does not exist takes the
 * not-found's title; any other outcome keeps the route's.
 */
export async function generateMetadata({ params }: AssessmentReviewPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) return { title };
  return recordRouteMetadata(readAnalystAssessment((await params).documentId), title);
}

export async function AssessmentEditorContent({ params }: AssessmentReviewPageProps) {
  // The gate comes before any read (D-23). It is presentation only: Strapi authorises every read itself.
  if (!(await canViewerReviewAssessments())) return <AssessmentEditor refusal="role" state="permission" />;
  const { documentId } = await params;
  const assessmentResult = await readAnalystAssessment(documentId);
  if (assessmentResult.error?.status === 404) notFound();
  if (assessmentResult.error) return <AssessmentEditor state={assessmentResult.error.status === 403 ? 'permission' : 'error'} />;
  if (!assessmentResult.data) notFound();

  const [riskTypesResult, controlsResult, systemsResult, assetsResult] = await Promise.all([
    listRiskTypes(),
    listControls(),
    listInformationSystems(),
    listInformationAssets(),
  ]);
  const results = [riskTypesResult, controlsResult, systemsResult, assetsResult];
  if (results.some((result) => result.error?.status === 403)) return <AssessmentEditor state="permission" />;
  if (results.some((result) => result.error)) return <AssessmentEditor state="error" />;

  const risks = assessmentResult.data.risks;
  const implementationResults = await Promise.all(risks.map(async (risk) => ({
    riskId: risk.documentId,
    result: await listControlImplementations(risk.documentId),
  })));
  if (implementationResults.some(({ result }) => result.error?.status === 403)) return <AssessmentEditor state="permission" />;
  if (implementationResults.some(({ result }) => result.error)) return <AssessmentEditor state="error" />;
  const controlImplementations = Object.fromEntries(implementationResults.map(({ result, riskId }) => [riskId, result.data ?? []]));

  return (
    <AssessmentEditor
      assessment={assessmentResult.data}
      assets={assetsResult.data ?? []}
      controlImplementations={controlImplementations}
      controls={controlsResult.data ?? []}
      risks={risks}
      riskTypes={riskTypesResult.data ?? []}
      systems={systemsResult.data ?? []}
      searchOwners={searchActiveUsersAction}
    />
  );
}

export default function AssessmentReviewPage({ params }: AssessmentReviewPageProps) {
  return <Suspense fallback={<AssessmentEditorSkeleton />}><AssessmentEditorContent params={params} /></Suspense>;
}
