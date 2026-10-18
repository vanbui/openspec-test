import { Suspense } from 'react';

import { AssessmentList, AssessmentListHeader, AssessmentListSkeleton } from '@/features/assessments/assessment-list';
import { assessmentCollectionFilterChips } from '@/features/assessments/assessment-list-chips';
import { listAnalystAssessments, parseAssessmentCollectionQuery } from '@/features/assessments/assessment-service';
import { exportRiskAssessmentsAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.reviewAssessments) };

/*
 * The list renders its header here, after the read, above every state (the Export placement pattern, the pilot's
 * ruling of 2026-10-16). Export shows only when the read returned the list, no E2E presentation fixture replaced it,
 * and the session holds risk-assessments:export; the server refuses every other export (D-16).
 */
export async function AssessmentListContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseAssessmentCollectionQuery(params);
  if (!(await canViewerReviewAssessments())) return <><AssessmentListHeader /><AssessmentList assessments={[]} query={query} state="permission" /></>;
  const result = await listAnalystAssessments(query);
  if (result.error?.status === 403) {
    return <><AssessmentListHeader /><AssessmentList assessments={[]} query={query} state="permission" /></>;
  }
  if (result.error) {
    return <><AssessmentListHeader /><AssessmentList assessments={[]} query={query} state="error" /></>;
  }
  const fixtureState = resolveE2eUiState(params);
  if (fixtureState === 'loading') return <><AssessmentListHeader /><E2eUiStateBoundary state={fixtureState}><AssessmentListSkeleton /></E2eUiStateBoundary></>;
  if (fixtureState && fixtureState !== 'populated') {
    return <><AssessmentListHeader /><E2eUiStateBoundary state={fixtureState}><AssessmentList assessments={[]} query={query} state={fixtureState === 'empty' ? undefined : fixtureState} /></E2eUiStateBoundary></>;
  }
  const exportButton = can('risk-assessments:export', await viewerCapabilities())
    ? <ListExportButton action={exportRiskAssessmentsAction} chips={assessmentCollectionFilterChips(query)} heading={pageHeadings.reviewAssessments} pagination={result.data.pagination} query={query} view="risk-assessments" />
    : undefined;
  const list = <AssessmentList assessments={result.data?.records ?? []} pagination={result.data?.pagination} query={query} />;
  return <><AssessmentListHeader action={exportButton} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}</>;
}

export default function AssessmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<><AssessmentListHeader /><AssessmentListSkeleton /></>}><AssessmentListContent searchParams={searchParams} /></Suspense>;
}
