import { Suspense } from 'react';

import { AssessmentRequestList, AssessmentRequestListSkeleton, AssignedRequestListHeader } from '@/features/assessments/assessment-list';
import { reviewQueueFilterChips } from '@/features/assessments/assessment-list-chips';
import { listAssessmentRequests, parseAssessmentRequestReviewQuery } from '@/features/assessments/assessment-service';
import { exportReviewRequestsAction } from '@/features/exports/export-actions';
import { exportViewColumns } from '@/features/exports/export-vocabulary';
import { ListExportButton } from '@/features/exports/list-export-button';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.assignedToMe) };

/** Assigned to me leaves out who holds each request, so its Export starts with the Requests view's other visible columns. */
const assignedVisibleColumns = exportViewColumns('requests').filter((column) => column.visible && column.key !== 'assignee').map((column) => column.key);

/*
 * Assigned to me (D-14, 13-UI-SPEC §2.1): the review queue scoped to the requests the viewer holds, All open by
 * default. The scope is fixed here and sent as filters[assignee]=me, which Strapi resolves to the policy's viewer
 * (13-12), so no URL value can widen it or name another person. Seeing this page authorises nothing: the route
 * gate and Strapi decide every read.
 *
 * The header renders here, after the read, above every state (the Export placement pattern, the pilot's ruling of
 * 2026-10-16). Export carries the page's scope in its query, never as a chip, and shows only when the read returned
 * the queue, no E2E presentation fixture replaced it, and the session holds assessment-requests:export (D-16).
 */
export async function AssignedRequestListContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = { ...parseAssessmentRequestReviewQuery(params, 'open'), assignee: 'me' as const };
  if (!(await canViewerReviewAssessments())) return <><AssignedRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="permission" view="assigned" /></>;
  const result = await listAssessmentRequests(query);
  if (result.error?.status === 403) return <><AssignedRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="permission" view="assigned" /></>;
  if (result.error) return <><AssignedRequestListHeader /><AssessmentRequestList requests={[]} query={query} state="error" view="assigned" /></>;
  const fixtureState = resolveE2eUiState(params);
  if (fixtureState === 'loading') return <><AssignedRequestListHeader /><E2eUiStateBoundary state={fixtureState}><AssessmentRequestListSkeleton view="assigned" /></E2eUiStateBoundary></>;
  const substituted = Boolean(fixtureState && fixtureState !== 'populated');
  const exportButton = !substituted && can('assessment-requests:export', await viewerCapabilities())
    ? <ListExportButton action={exportReviewRequestsAction} chips={reviewQueueFilterChips({ ...query, assignee: undefined })} heading={pageHeadings.assignedToMe} pagination={result.data.pagination} query={query} view="requests" visibleColumns={assignedVisibleColumns} />
    : undefined;
  const list = <AssessmentRequestList pagination={substituted ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 } : result.data?.pagination} query={query} requests={substituted ? [] : result.data?.records ?? []} state={fixtureState === 'empty' || fixtureState === 'populated' ? undefined : fixtureState} view="assigned" viewer={result.data?.viewer ?? null} />;
  return <><AssignedRequestListHeader action={exportButton} />{fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}</>;
}

export default function AssignedRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<><AssignedRequestListHeader /><AssessmentRequestListSkeleton view="assigned" /></>}><AssignedRequestListContent searchParams={searchParams} /></Suspense>;
}
