import 'server-only';

import type { DataTableFilter } from '@/components/csrm/data-table';
import { statusLabel } from '@/components/csrm/status-badge';
import { formatRequestDate } from '@/features/requests/request-domain';

import type { AssessmentCollectionQuery, AssessmentRequestReviewQuery } from './assessment-service';

/*
 * The filter chips of the review queue and both risk assessment lists (section 4 DataTable), as each list renders them,
 * for their header's Export (Phase 19 X-30), so the dialog names the filters exactly as the chips do. Server-only: the
 * lists keep their own chips, because a module shared with them lands in chunks every route loads (19-11's route
 * budgets); list-export-placement.test.tsx renders each list and proves its chips equal these.
 */

/* The Assigned to filter's words: the queue's unassigned reads Not picked up (Voice). */
const assigneeFilterLabels: Readonly<Record<NonNullable<AssessmentRequestReviewQuery['assignee']>, string>> = { me: 'Me', unassigned: 'Not picked up' };

type ReviewQueueChipQuery = Pick<AssessmentRequestReviewQuery, 'q' | 'status' | 'assignee' | 'notes'>;
type CollectionChipQuery = Pick<AssessmentCollectionQuery, 'q' | 'status' | 'overallRating' | 'approvedFrom' | 'approvedTo'>;

/**
 * The review queue's chips: the search, the status by the shared mapping, who holds a request and new notes
 * (13-UI-SPEC §2.2). The queue is not a chip: it has its own line above the list.
 */
export function reviewQueueFilterChips(query: ReviewQueueChipQuery): DataTableFilter[] {
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('request', query.status) }] : []),
    ...(query.assignee ? [{ id: 'assignee', label: 'Assigned to', value: assigneeFilterLabels[query.assignee] }] : []),
    ...(query.notes ? [{ id: 'notes', label: 'Notes', value: 'New notes' }] : []),
  ];
}

/**
 * A risk assessment list's chips: the search, the status by the shared mapping (approved reads Released), the overall
 * rating and the released date range, which has no visible control and shows only as its two chips (UI-SPEC §7.2,
 * UI-D30).
 */
export function assessmentCollectionFilterChips(query: CollectionChipQuery): DataTableFilter[] {
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('assessment', query.status) }] : []),
    ...(query.overallRating ? [{ id: 'overallRating', label: 'Overall rating', value: query.overallRating }] : []),
    ...(query.approvedFrom ? [{ id: 'approvedFrom', label: 'Released from (UTC)', value: formatRequestDate(query.approvedFrom) ?? query.approvedFrom }] : []),
    ...(query.approvedTo ? [{ id: 'approvedTo', label: 'Released to (UTC)', value: formatRequestDate(query.approvedTo) ?? query.approvedTo }] : []),
  ];
}
