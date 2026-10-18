'use client';

import type { SortingState } from '@tanstack/react-table';
import { MessageSquareDot } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, type FormEvent } from 'react';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatRequestDate,
  myRequestNextStep,
  requestHolderPresentation,
  requestHolders,
  requestStatuses,
  shownInstant,
  type MyRequestItem,
  type MyRequestListQuery,
  type RequestPagination,
  type RequestSort,
} from './request-domain';

type RequestTableState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';

export interface RequestTableProps {
  requests: readonly MyRequestItem[];
  query: MyRequestListQuery;
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

function nextSearchParameters(current: URLSearchParams, query: MyRequestListQuery): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of safePassthroughParameters) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  if (query.q) next.set('q', query.q);
  if (query.status) next.set('status', query.status);
  if (query.holder) next.set('holder', query.holder);
  if (query.notes) next.set('notes', query.notes);
  next.set('sort', query.sort);
  if (query.page > 1) next.set('page', String(query.page));
  next.set('pageSize', String(query.pageSize));
  return next;
}

function requestHref(documentId: string) {
  return `/app/requests/${encodeURIComponent(documentId)}`;
}

/**
 * Line 1 names whose turn it is; line 2 is the server's sentence, a link only for the viewer's own step (UI-SPEC §7.3).
 * The sentence clamps to two lines in the table and three on a card, its full text kept in the DOM.
 */
function NextStep({ item, clamp, className }: { item: MyRequestItem; clamp: 'line-clamp-2' | 'line-clamp-3'; className?: string }) {
  const nextStep = myRequestNextStep(item);
  return (
    <div className={className ? `space-y-0.5 ${className}` : 'space-y-0.5'}>
      <p className="micro-label text-foreground-secondary">{requestHolderPresentation[item.holder].label}</p>
      {nextStep ? (
        nextStep.href
          ? <RecordLink className={`${clamp} break-words`} href={nextStep.href}>{nextStep.summary}</RecordLink>
          : <p className={`${clamp} break-words`}>{nextStep.summary}</p>
      ) : null}
    </div>
  );
}

const countFormatter = new Intl.NumberFormat('en-AU');
const NOT_PICKED_UP_YET = 'Not picked up yet';

/** `{n} new {note|notes}`, written out (Voice; X-17). */
function newNotesLine(unread: number): string {
  return `${countFormatter.format(unread)} new ${unread === 1 ? 'note' : 'notes'}`;
}

/*
 * The X-17 unread line (13-UI-SPEC §12.4, as §2.2): the notes new to the Requestor, a link to the request's thread,
 * named for the request; nothing at zero. Unread is a personal fact, so it is ink with words, never a status hue.
 */
function UnreadLine({ item }: { item: MyRequestItem }) {
  if (item.unreadNotes <= 0) return null;
  const line = newNotesLine(item.unreadNotes);
  return (
    <RecordLink
      aria-label={`${line} on ${item.requestNumber}`}
      className="inline-flex min-h-6 items-center gap-1 text-xs font-medium tabular-nums text-foreground"
      href={`${requestHref(item.documentId)}#notes`}
    >
      <MessageSquareDot aria-hidden="true" className="size-3 shrink-0" />
      {line}
    </RecordLink>
  );
}

/** Who holds the request (D-17): the assigned Security Analyst's display name, or that nobody has picked it up yet. */
function AssigneeName({ item }: { item: MyRequestItem }) {
  return item.assignee
    ? <span className="break-words">{item.assignee.displayName}</span>
    : <span className="text-foreground-secondary">{NOT_PICKED_UP_YET}</span>;
}

/** The card's holder line (13-UI-SPEC §12.4): `Security Analyst: {name}` or `Not picked up yet`. */
function CardAssignee({ item }: { item: MyRequestItem }) {
  return item.assignee
    ? <p className="break-words text-sm">Security Analyst: {item.assignee.displayName}</p>
    : <p className="text-sm text-foreground-secondary">{NOT_PICKED_UP_YET}</p>;
}

function dueLabel(item: MyRequestItem): string {
  const due = formatRequestDate(item.dueDate);
  return due ? `Due ${due}` : 'No due date';
}

/** `Updated` with the instant in the viewer's time zone (D-55), or `No update date`. */
function Updated({ item }: { item: MyRequestItem }) {
  const updatedAt = shownInstant(item.updatedAt);
  return updatedAt ? <>Updated <LocalInstant style="date" value={updatedAt} /></> : <>No update date</>;
}

const columns: DataTableColumn<MyRequestItem>[] = [
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
      <div className="grid justify-items-start gap-1">
        <RecordLink href={requestHref(request.documentId)}>
          {request.title}
        </RecordLink>
        <UnreadLine item={request} />
      </div>
    ),
  },
  { accessorKey: 'requestStatus', header: 'Status', cell: (_value, request) => <StatusBadge status={request.requestStatus} /> },
  { id: 'assignee', accessorKey: 'assignee', header: 'Security Analyst', cell: (_value, request) => <AssigneeName item={request} /> },
  { id: 'nextStep', accessorKey: 'nextAction', header: 'Next step', wrap: true, cell: (_value, request) => <NextStep className="py-2" clamp="line-clamp-2" item={request} /> },
  { id: 'dueDate', accessorKey: 'dueDate', header: 'Due date', enableSorting: true, cell: (_value, request) => dueLabel(request) },
  { id: 'updatedAt', accessorKey: 'updatedAt', header: 'Updated', enableSorting: true, cell: (_value, request) => <Updated item={request} /> },
];

export function RequestTable({ requests, query, pagination, densityUserId, state }: RequestTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const outOfRange = pagination.total > 0 && query.page > Math.max(1, pagination.pageCount);

  const navigate = (nextQuery: MyRequestListQuery) => {
    const params = nextSearchParameters(new URLSearchParams(currentSearchParams.toString()), nextQuery);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => {
    if (outOfRange) {
      navigate({ ...query, page: Math.max(1, pagination.pageCount) });
    }
  }, [outOfRange, pagination.pageCount, query]);
  const resetPage = (changes: Partial<MyRequestListQuery>) => navigate({ ...query, ...changes, page: 1 });
  const clearFilters = () => resetPage({ q: '', status: undefined, holder: undefined, notes: undefined });
  const clearFilter = (id: string) => resetPage(
    id === 'q' ? { q: '' } : id === 'holder' ? { holder: undefined } : id === 'notes' ? { notes: undefined } : { status: undefined },
  );
  const filters = useMemo<DataTableFilter[]>(() => [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('request', query.status) }] : []),
    ...(query.holder ? [{ id: 'holder', label: 'Show', value: requestHolderPresentation[query.holder].label }] : []),
    ...(query.notes ? [{ id: 'notes', label: 'Notes', value: 'New notes' }] : []),
  ], [query.q, query.status, query.holder, query.notes]);
  const filtered = Boolean(query.q || query.status || query.holder || query.notes);
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
            onChange={(event) => resetPage({ status: event.target.value ? event.target.value as MyRequestListQuery['status'] : undefined })}
          >
            <option value="">All statuses</option>
            {requestStatuses.map((status) => <option key={status} value={status}>{statusLabel('request', status)}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Show
          <select
            aria-label="Show"
            className="block h-9 min-w-52 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query.holder ?? ''}
            disabled={resolvedState === 'loading'}
            onChange={(event) => resetPage({ holder: event.target.value ? event.target.value as MyRequestListQuery['holder'] : undefined })}
          >
            <option value="">All requests</option>
            {requestHolders.map((holder) => <option key={holder} value={holder}>{requestHolderPresentation[holder].label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Notes
          <select
            className="block h-9 min-w-52 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query.notes ?? ''}
            disabled={resolvedState === 'loading'}
            onChange={(event) => resetPage({ notes: event.target.value ? event.target.value as MyRequestListQuery['notes'] : undefined })}
          >
            <option value="">All requests</option>
            <option value="unread">With new notes</option>
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
        onClearFilter={clearFilter}
        onClearFilters={clearFilters}
        onPageChange={(page) => navigate({ ...query, page })}
        onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as MyRequestListQuery['pageSize'] })}
        onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })}
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageSizeOptions={[10, 20, 50]}
        renderMobileCard={(item) => (
          <article className="space-y-2">
            {/*
              * The row wraps and the column grows from a 6rem basis: the badge stays beside the number and title while
              * the number fits, and drops below them when it would cover the number (WCAG 1.4.10).
              */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 grow basis-24 space-y-1">
                <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={requestHref(item.documentId)}>{item.requestNumber}</RecordLink>
                <RecordLink className="block break-words" href={requestHref(item.documentId)}>{item.title}</RecordLink>
              </div>
              <StatusBadge status={item.requestStatus} />
            </div>
            <NextStep clamp="line-clamp-3" item={item} />
            <CardAssignee item={item} />
            {item.unreadNotes > 0 ? <div><UnreadLine item={item} /></div> : null}
            <p className="text-xs text-muted-foreground">{dueLabel(item)} · <Updated item={item} /></p>
          </article>
        )}
        sorting={sortingFor(query.sort)}
        state={resolvedState}
        loadingLabel="Loading assessment requests"
        stateSlots={{
          empty: <EmptyState action={{ label: 'New request', href: '/app/requests/new' }} filtered={filtered} noun="assessment requests" onClearFilters={clearFilters} />,
          error: <ErrorState noun="assessment requests" retry={() => router.refresh()} />,
          permission: <PermissionDeniedState area="assessment requests" />,
        }}
        totalCount={pagination.total}
      />
    </div>
  );
}
