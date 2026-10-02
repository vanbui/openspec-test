import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import {
  AssessmentEditor,
  AssessmentEditorSkeleton,
} from '@/features/assessments/assessment-editor';
import { canMutateAssessment, relationLabelsFromRiskList } from '@/features/assessments/assessment-domain';
import {
  getAnalystAssessment,
  listAssessmentRisks,
  listControlImplementations,
  listRiskTypes,
} from '@/features/assessments/assessment-service';
import { searchActiveUsersAction, searchControlsAction } from '@/features/assessments/assessment-actions';
import { searchInformationAssetsAction, searchInformationSystemsAction } from '@/features/requests/request-actions';
import { getRequest } from '@/features/requests/request-service';
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

  // No option list is loaded whole (D-28): the Control picker searches the library (D-29) and each Risk Type
  // carries its applicable controls (D-31); the system and asset pickers search the inventory and offer the
  // originating request's selections first (D-30). The served Risk list names each Risk's system and asset, and
  // a released assessment reads as it does for the Requestor (D-34), so no editor ever shows an id.
  const mutable = canMutateAssessment(assessmentResult.data);
  const [riskTypesResult, riskListResult, requestResult] = await Promise.all([
    listRiskTypes(),
    listAssessmentRisks(documentId),
    mutable ? getRequest(assessmentResult.data.assessmentRequest.documentId) : undefined,
  ]);
  const results = [riskTypesResult, riskListResult, ...(requestResult ? [requestResult] : [])];
  if (results.some((result) => result.error?.status === 403)) return <AssessmentEditor state="permission" />;
  if (results.some((result) => result.error)) return <AssessmentEditor state="error" />;
  const riskListItems = riskListResult.data ?? [];

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
      controlImplementations={controlImplementations}
      relationLabels={relationLabelsFromRiskList(riskListItems)}
      requestAssets={requestResult?.data?.informationAssets ?? []}
      requestSystems={requestResult?.data?.informationSystems ?? []}
      risks={risks}
      riskListItems={riskListItems}
      riskTypes={riskTypesResult.data ?? []}
      searchOwners={searchActiveUsersAction}
      searchControls={searchControlsAction}
      searchSystems={searchInformationSystemsAction}
      searchAssets={searchInformationAssetsAction}
    />
  );
}

export default function AssessmentReviewPage({ params }: AssessmentReviewPageProps) {
  return <Suspense fallback={<AssessmentEditorSkeleton />}><AssessmentEditorContent params={params} /></Suspense>;
}
