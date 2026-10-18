import { Suspense } from 'react';

import { AssessmentRequestList, AssessmentRequestListHeader, AssessmentRequestListSkeleton } from '@/features/assessments/assessment-list';
import { reviewQueueFilterChips } from '@/features/assessments/assessment-list-chips';
import { listAssessmentRequests, parseAssessmentRequestReviewQuery } from '@/features/assessments/assessment-service';
import { exportReviewRequestsAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.reviewRequests) };

/*
 * The queue renders its header here, after the read, above every state (the Export placement pattern, the pilot's
 * ruling of 2026-10-16). Export shows only when the read returned the queue, no E2E presentation fixture replaced it,
 * and the session holds assessment-requests:export; the server refuses every other export (D-16).
 */
export async function AssessmentRequestListContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseAssessmentRequestReviewQuery(params);
  if (!(await canViewerReviewAssessments())) return <><AssessmentRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="permission" /></>;
  const result = await listAssessmentRequests(query);
  if (result.error?.status === 403) return <><AssessmentRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="permission" /></>;
  if (result.error) return <><AssessmentRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="error" /></>;
  const fixtureState = resolveE2eUiState(params);
  if (fixtureState === 'loading') return <><AssessmentRequestListHeader /><E2eUiStateBoundary state={fixtureState}><AssessmentRequestListSkeleton /></E2eUiStateBoundary></>;
  const substituted = Boolean(fixtureState && fixtureState !== 'populated');
  const exportButton = !substituted && can('assessment-requests:export', await viewerCapabilities())
    ? <ListExportButton action={exportReviewRequestsAction} chips={reviewQueueFilterChips(query)} heading={pageHeadings.reviewRequests} pagination={result.data.pagination} query={query} view="requests" />
    : undefined;
  const list = <AssessmentRequestList pagination={substituted ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 } : result.data?.pagination} query={query} requests={substituted ? [] : result.data?.records ?? []} state={fixtureState === 'empty' || fixtureState === 'populated' ? undefined : fixtureState} viewer={result.data?.viewer ?? null} />;
  return <><AssessmentRequestListHeader action={exportButton} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}</>;
}

export default function AssessmentRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<><AssessmentRequestListHeader /><AssessmentRequestListSkeleton /></>}><AssessmentRequestListContent searchParams={searchParams} /></Suspense>;
}
