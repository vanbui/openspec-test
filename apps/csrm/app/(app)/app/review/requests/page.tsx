import { Suspense } from 'react';

import { AssessmentRequestList, AssessmentRequestListHeader, AssessmentRequestListSkeleton } from '@/features/assessments/assessment-list';
import { listAssessmentRequests, parseAssessmentRequestReviewQuery } from '@/features/assessments/assessment-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Assessment Request Review | IdamBox CSRM' };

export async function AssessmentRequestListContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseAssessmentRequestReviewQuery(params);
  const result = await listAssessmentRequests(query);
  if (result.error?.status === 403) return <AssessmentRequestList requests={[]} query={query} state="permission" />;
  if (result.error) return <AssessmentRequestList requests={[]} query={query} state="error" />;
  const fixtureState = resolveE2eUiState(params);
  if (fixtureState === 'loading') return <E2eUiStateBoundary state={fixtureState}><AssessmentRequestListSkeleton /></E2eUiStateBoundary>;
  const list = <AssessmentRequestList pagination={fixtureState && fixtureState !== 'populated' ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 } : result.data?.pagination} query={query} requests={fixtureState && fixtureState !== 'populated' ? [] : result.data?.records ?? []} state={fixtureState === 'empty' || fixtureState === 'populated' ? undefined : fixtureState} />;
  return fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list;
}

export default function AssessmentRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <><AssessmentRequestListHeader /><Suspense fallback={<AssessmentRequestListSkeleton />}><AssessmentRequestListContent searchParams={searchParams} /></Suspense></>;
}
