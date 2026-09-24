import { PageHeader } from '@/components/csrm/page-header';
import { ReleasedAssessmentList } from '@/features/assessments/released-assessment';
import { listMyReleasedAssessments, parseAssessmentCollectionQuery } from '@/features/assessments/assessment-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'My Risk Assessments | IdamBox CSRM' };

type AssessmentsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AssessmentsPage({ searchParams }: AssessmentsPageProps) {
  const params = await searchParams;
  const query = parseAssessmentCollectionQuery(params);
  const result = await listMyReleasedAssessments(query);
  const fixtureState = result.error ? undefined : resolveE2eUiState(params);
  const state = result.error
    ? result.error.status === 403 ? 'permission' : 'error'
    : fixtureState === 'populated' || fixtureState === 'empty' ? undefined : fixtureState;
  const assessments = fixtureState && fixtureState !== 'populated' ? [] : result.data?.records ?? [];
  const pagination = fixtureState && fixtureState !== 'populated'
    ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }
    : result.data?.pagination;
  const list = <ReleasedAssessmentList assessments={assessments} pagination={pagination} query={query} state={state} />;

  return (
    <>
      <PageHeader title="My Risk Assessments" description="View risk assessments released for your authorised requests." />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}
    </>
  );
}
