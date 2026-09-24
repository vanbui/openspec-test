import { Suspense } from 'react';

import { AssessmentList, AssessmentListHeader, AssessmentListSkeleton } from '@/features/assessments/assessment-list';
import { listAnalystAssessments, parseAssessmentCollectionQuery } from '@/features/assessments/assessment-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Risk Assessment Review | IdamBox CSRM' };

export async function AssessmentListContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseAssessmentCollectionQuery(params);
  const result = await listAnalystAssessments(query);
  if (result.error?.status === 403) {
    return <AssessmentList assessments={[]} query={query} state="permission" />;
  }
  if (result.error) {
    return <AssessmentList assessments={[]} query={query} state="error" />;
  }
  const fixtureState = resolveE2eUiState(params);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><AssessmentListSkeleton /></E2eUiStateBoundary>;
  if (fixtureState && fixtureState !== 'populated') {
    return <E2eUiStateBoundary state={fixtureState}><AssessmentList assessments={[]} query={query} state={fixtureState === 'empty' ? undefined : fixtureState} /></E2eUiStateBoundary>;
  }
  const list = <AssessmentList assessments={result.data?.records ?? []} pagination={result.data?.pagination} query={query} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list;
}

export default function AssessmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <><AssessmentListHeader /><Suspense fallback={<AssessmentListSkeleton />}><AssessmentListContent searchParams={searchParams} /></Suspense></>;
}
