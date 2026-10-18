import 'server-only';

import type { DataTableFilter } from '@/components/csrm/data-table';
import { statusLabel } from '@/components/csrm/status-badge';

import { requestHolderPresentation, type MyRequestListQuery } from './request-domain';

/**
 * My requests' filter chips: the search, the status by the shared mapping, who holds the request (Show) and new notes.
 * Server-only, for the header's Export (Phase 19 X-30): the list keeps its own chips, and
 * list-export-placement.test.tsx renders it and proves its chips equal these.
 */
export function myRequestFilterChips(query: Pick<MyRequestListQuery, 'q' | 'status' | 'holder' | 'notes'>): DataTableFilter[] {
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('request', query.status) }] : []),
    ...(query.holder ? [{ id: 'holder', label: 'Show', value: requestHolderPresentation[query.holder].label }] : []),
    ...(query.notes ? [{ id: 'notes', label: 'Notes', value: 'New notes' }] : []),
  ];
}
