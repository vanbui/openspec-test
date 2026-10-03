'use client';

import type { SortingState } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, type FormEvent } from 'react';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  requestStatuses,
  type CsrmAssessmentRequest,
  type RequestListQuery,
  type RequestPagination,
  type RequestSort,
} from './request-domain';

type RequestTableState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';

export interface RequestTableProps {
  requests: readonly CsrmAssessmentRequest[];
  query: RequestListQuery;
  pagination: RequestPagination;
  densityUserId: string;
  state?: RequestTableState;
}

const safePassthroughParameters = ['view'] as const;

function sortingFor(sort: RequestSort): SortingState {
  const [id, direction] = sort.split(':') as [string, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

function sortFor(sorting: SortingState): RequestSort {
  const first = sorting[0];
  const candidate = `${first?.id ?? 'updatedAt'}:${first?.desc === false ? 'asc' : 'desc'}`;
  const allowed: readonly string[] = [
    'updatedAt:desc', 'updatedAt:asc', 'dueDate:asc', 'dueDate:desc',
    'requestNumber:asc', 'requestNumber:desc', 'title:asc', 'title:desc',
  ];
  return allowed.includes(candidate) ? candidate as RequestSort : 'updatedAt:desc';
}

function nextSearchParameters(current: URLSearchParams, query: RequestListQuery): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of safePassthroughParameters) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  if (query.q) next.set('q', query.q);
  if (query.status) next.set('status', query.status);
  next.set('sort', query.sort);
  if (query.page > 1) next.set('page', String(query.page));
  next.set('pageSize', String(query.pageSize));
  return next;
}

function requestHref(documentId: string) {
  return `/app/requests/${encodeURIComponent(documentId)}`;
}

const columns: DataTableColumn<CsrmAssessmentRequest>[] = [
  {
    accessorKey: 'requestNumber',
    header: 'Request ID',
    enableSorting: true,
    numeric: 'identity',
    cell: (_value, request) => <RecordLink href={requestHref(request.documentId)}>{request.requestNumber}</RecordLink>,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    enableSorting: true,
    cell: (_value, request) => (
      <RecordLink href={requestHref(request.documentId)}>
        {request.title}
      </RecordLink>
    ),
  },
  { accessorKey: 'requestStatus', header: 'Status', cell: (_value, request) => <StatusBadge status={request.requestStatus} /> },
  { id: 'dueDate', accessorKey: 'dueDateLabel', header: 'Due date', enableSorting: true, cell: (_value, request) => request.dueDateLabel ? `Due ${request.dueDateLabel}` : 'No due date' },
  { id: 'updatedAt', accessorKey: 'updatedDateLabel', header: 'Updated', enableSorting: true, cell: (_value, request) => request.updatedDateLabel ? `Updated ${request.updatedDateLabel}` : 'No update date' },
];

export function RequestTable({ requests, query, pagination, densityUserId, state }: RequestTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const outOfRange = pagination.total > 0 && query.page > Math.max(1, pagination.pageCount);

  const navigate = (nextQuery: RequestListQuery) => {
    const params = nextSearchParameters(new URLSearchParams(currentSearchParams.toString()), nextQuery);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => {
    if (outOfRange) {
      navigate({ ...query, page: Math.max(1, pagination.pageCount) });
    }
  }, [outOfRange, pagination.pageCount, query]);
  const resetPage = (changes: Partial<RequestListQuery>) => navigate({ ...query, ...changes, page: 1 });
  const clearFilters = () => resetPage({ q: '', status: undefined });
  const filters = useMemo<DataTableFilter[]>(() => [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('request', query.status) }] : []),
  ], [query.q, query.status]);
  const resolvedState = outOfRange ? 'loading' : state ?? (requests.length > 0 ? 'populated' : 'empty');

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedSearch = new FormData(event.currentTarget).get('q');
    resetPage({ q: typeof submittedSearch === 'string' ? submittedSearch.trim() : '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end" data-print="hidden">
        <form className="flex flex-1 gap-2" role="search" onSubmit={submitSearch}>
          <label className="grid flex-1 gap-1.5 text-sm font-medium text-foreground">
            Search requests
            <Input aria-label="Search requests" defaultValue={query.q} disabled={resolvedState === 'loading'} key={query.q} name="q" type="search" />
          </label>
          <Button className="self-end" disabled={resolvedState === 'loading'} type="submit">Search</Button>
        </form>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Status
          <select
            aria-label="Filter by status"
            className="block h-9 min-w-52 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query.status ?? ''}
            disabled={resolvedState === 'loading'}
            onChange={(event) => resetPage({ status: event.target.value ? event.target.value as RequestListQuery['status'] : undefined })}
          >
            <option value="">All statuses</option>
            {requestStatuses.map((status) => <option key={status} value={status}>{statusLabel('request', status)}</option>)}
          </select>
        </label>
      </div>

      <DataTable
        ariaLabel="My assessment requests"
        columns={columns}
        data={[...requests]}
        densityUserId={densityUserId}
        filters={filters}
        getRowId={(request) => request.documentId}
        onClearFilter={(id) => resetPage(id === 'q' ? { q: '' } : { status: undefined })}
        onClearFilters={clearFilters}
        onPageChange={(page) => navigate({ ...query, page })}
        onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as RequestListQuery['pageSize'] })}
        onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })}
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageSizeOptions={[10, 20, 50]}
        renderMobileCard={(item) => (
          <article className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={requestHref(item.documentId)}>{item.requestNumber}</RecordLink>
                <RecordLink className="block break-words" href={requestHref(item.documentId)}>{item.title}</RecordLink>
              </div>
              <StatusBadge status={item.requestStatus} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{item.dueDateLabel ? `Due ${item.dueDateLabel}` : 'No due date'}</span>
              <span>{item.updatedDateLabel ? `Updated ${item.updatedDateLabel}` : 'No update date'}</span>
            </div>
          </article>
        )}
        sorting={sortingFor(query.sort)}
        state={resolvedState}
        loadingLabel="Loading assessment requests"
        stateSlots={{
          empty: <EmptyState action={{ label: 'New request', href: '/app/requests/new' }} filtered={Boolean(query.q || query.status)} noun="assessment requests" onClearFilters={clearFilters} />,
          error: <ErrorState noun="assessment requests" retry={() => router.refresh()} />,
          permission: <PermissionDeniedState area="assessment requests" />,
        }}
        totalCount={pagination.total}
      />
    </div>
  );
}
