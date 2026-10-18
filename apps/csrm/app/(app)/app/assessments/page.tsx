import { PageHeader } from '@/components/csrm/page-header';
import { assessmentCollectionFilterChips } from '@/features/assessments/assessment-list-chips';
import { exportMyRiskAssessmentsAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { ReleasedAssessmentList } from '@/features/assessments/released-assessment';
import { listMyReleasedAssessments, parseAssessmentCollectionQuery } from '@/features/assessments/assessment-service';
import { releasedAssessmentListItem } from '@/features/assessments/assessment-schema';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.myRiskAssessments) };

type AssessmentsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AssessmentsPage({ searchParams }: AssessmentsPageProps) {
  const params = await searchParams;
  const query = parseAssessmentCollectionQuery(params);
  const result = await listMyReleasedAssessments(query);
  const fixtureState = result.error ? undefined : resolveE2eUiState(params);
  const state = result.error
    ? result.error.status === 403 ? 'permission' : 'error'
    : fixtureState === 'populated' || fixtureState === 'empty' ? undefined : fixtureState;
  // D-23, WR-304, D10: the client list gets only what it renders, never a generating analyst.
  const assessments = fixtureState && fixtureState !== 'populated' ? [] : (result.data?.records ?? []).map(releasedAssessmentListItem);
  const pagination = fixtureState && fixtureState !== 'populated'
    ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }
    : result.data?.pagination;
  const list = <ReleasedAssessmentList assessments={assessments} pagination={pagination} query={query} state={state} />;
  // Export (the Export placement pattern, the pilot's ruling of 2026-10-16) shows only when the read returned the
  // list, no E2E presentation fixture replaced it, and the session holds my-risk-assessments:export (D-16).
  const exportButton = result.data && (!fixtureState || fixtureState === 'populated') && can('my-risk-assessments:export', await viewerCapabilities())
    ? <ListExportButton action={exportMyRiskAssessmentsAction} chips={assessmentCollectionFilterChips(query)} heading={pageHeadings.myRiskAssessments} pagination={result.data.pagination} query={query} view="my-risk-assessments" />
    : undefined;

  return (
    <>
      <PageHeader action={exportButton} title={pageHeadings.myRiskAssessments} description="View risk assessments released for your authorised requests." />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}
    </>
  );
}
