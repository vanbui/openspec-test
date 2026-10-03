'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent } from 'react';

import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { PageHeader } from '@/components/csrm/page-header';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { requestStatuses, type RequestStatus } from '@/features/requests/request-domain';
import { assessmentStatuses } from './assessment-domain';
import type { AssessmentRequestQueueItem, AssessmentSummary } from './assessment-schema';
import type { AssessmentCollectionQuery, AssessmentRequestReviewQuery, CollectionPagination } from './assessment-service';

export type AssessmentCollectionState = 'populated' | 'empty' | 'error' | 'permission';

type Query = AssessmentCollectionQuery | AssessmentRequestReviewQuery;

function requestHref(documentId: string): string {
  return `/app/review/requests/${encodeURIComponent(documentId)}`;
}

function assessmentHref(documentId: string): string {
  return `/app/review/assessments/${encodeURIComponent(documentId)}`;
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
    : 'Not recorded';
}

function navigateFor(pathname: string, router: ReturnType<typeof useRouter>, next: Query) {
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.status) params.set('status', next.status);
  if ('queue' in next && next.queue !== 'requires-attention') params.set('queue', next.queue);
  params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  params.set('pageSize', String(next.pageSize));
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

function Controls({ label, onNavigate, query, statuses }: {
  label: string;
  onNavigate: (next: Query) => void;
  query: Query;
  statuses: readonly { value: string; label: string }[];
}) {
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');

    onNavigate({ ...query, q: typeof value === 'string' ? value.trim() : '', page: 1 } as Query);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end" data-print="hidden">
      <form className="flex flex-1 gap-2" role="search" onSubmit={search}>
        <label className="grid flex-1 gap-1.5 text-sm font-medium text-foreground">
          {label}
          <Input aria-label={label} defaultValue={query.q} key={query.q} name="q" type="search" />
        </label>
        <Button className="self-end" type="submit">Search</Button>
      </form>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Status
        <select
          aria-label="Filter by status"
          className={`block min-w-48 ${nativeSelectClassName}`}
          value={query.status ?? ''}
          onChange={(event) => onNavigate({ ...query, status: event.target.value || undefined, page: 1 } as Query)}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </label>
      {'queue' in query ? (
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Queue
          <select
            aria-label="Filter by queue"
            className={`block min-w-48 ${nativeSelectClassName}`}
            value={query.queue}
            onChange={(event) => onNavigate({ ...query, queue: event.target.value as AssessmentRequestReviewQuery['queue'], page: 1 })}
          >
            <option value="requires-attention">Requires my attention</option>
            <option value="awaiting-requestor">Awaiting Requestor</option>
            <option value="generation-in-progress">Generation in progress</option>
            <option value="released">Released</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}

const requestColumns: DataTableColumn<AssessmentRequestQueueItem>[] = [
  {
    accessorKey: 'requestNumber',
    header: 'Request',
    numeric: 'identity',
    cell: (_value, request) => (
      <RecordLink href={requestHref(request.documentId)}>{request.requestNumber}</RecordLink>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: (_value, request) => (
      <RecordLink href={requestHref(request.documentId)}>{request.title}</RecordLink>
    ),
  },
  {
    accessorKey: 'requestStatus',
    header: 'Status',
    cell: (_value, request) => <StatusBadge status={request.requestStatus} />,
  },
  {
    accessorKey: 'submittedDate',
    header: 'Submitted',
    cell: (_value, request) => formatDate(request.submittedDate),
  },
];

const assessmentColumns: DataTableColumn<AssessmentSummary>[] = [
  {
    accessorKey: 'assessmentNumber',
    header: 'Assessment',
    numeric: 'identity',
    cell: (_value, assessment) => (
      <RecordLink href={assessmentHref(assessment.documentId)}>{assessment.assessmentNumber}</RecordLink>
    ),
  },
  {
    accessorKey: 'summary',
    header: 'Summary',
    cell: (_value, assessment) => assessment.summary ?? 'Assessment draft',
  },
  {
    accessorKey: 'assessmentStatus',
    header: 'Status',
    cell: (_value, assessment) => <StatusBadge family="assessment" value={assessment.assessmentStatus} />,
  },
  {
    accessorKey: 'generatedBy',
    header: 'Draft initiated by',
    cell: (_value, assessment) => assessment.generatedBy?.displayName ?? 'Not recorded',
  },
];

function ListFrame<T extends { documentId: string }>({
  ariaLabel,
  columns,
  data,
  densityUserId,
  emptyDescription,
  filtered,
  loadingLabel,
  noun,
  onNavigate,
  page,
  pageSize,
  query,
  renderMobileCard,
  state,
  statusLabelFor,
  totalCount,
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  data: readonly T[];
  densityUserId: string;
  emptyDescription?: string;
  filtered: boolean;
  loadingLabel: string;
  noun: string;
  onNavigate: (page: number) => void;
  page: number;
  pageSize: number;
  query: Query;
  renderMobileCard: (row: T) => React.ReactNode;
  state: AssessmentCollectionState | 'loading';
  /** The label a status filter shows as its chip: the shared mapping's, so approved reads Released. */
  statusLabelFor?: (status: string) => string;
  totalCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearFilters = () => {
    navigateFor(pathname, router, { ...query, q: '', status: undefined, ...('queue' in query ? { queue: 'requires-attention' as const } : {}), page: 1 });
  };
  /*
   * The direction's filter chips (section 4 DataTable) for the search and status filters, so a filtered
   * list never looks, or prints, like an unfiltered one (verdict 4a). The queue has its own line above.
   */
  const filters: DataTableFilter[] = [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status && statusLabelFor ? [{ id: 'status', label: 'Status', value: statusLabelFor(query.status) }] : []),
  ];
  const clearFilter = (id: string) => navigateFor(pathname, router, { ...query, ...(id === 'q' ? { q: '' } : { status: undefined }), page: 1 } as Query);
  const clearChips = () => navigateFor(pathname, router, { ...query, q: '', status: undefined, page: 1 } as Query);

  return (
    <DataTable
      ariaLabel={ariaLabel}
      columns={columns}
      data={[...data]}
      densityUserId={densityUserId}
      filters={filters}
      getRowId={(row) => row.documentId}
      loadingLabel={loadingLabel}
      onClearFilter={clearFilter}
      onClearFilters={clearChips}
      onPageChange={onNavigate}
      page={page}
      pageSize={pageSize}
      renderMobileCard={renderMobileCard}
      state={state}
      stateSlots={{
        empty: <EmptyState description={emptyDescription} filtered={filtered} noun={noun} onClearFilters={clearFilters} />,
        error: <ErrorState noun={noun} retry={() => router.refresh()} />,
        permission: <PermissionDeniedState area={noun} />,
      }}
      totalCount={totalCount}
    />
  );
}

export function AssessmentRequestList({
  pagination,
  query = { q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 },
  requests,
  state,
}: {
  requests: readonly AssessmentRequestQueueItem[];
  pagination?: CollectionPagination;
  query?: AssessmentRequestReviewQuery;
  state?: AssessmentCollectionState;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = (next: Query) => navigateFor(pathname, router, next);
  const resolvedState = state ?? (requests.length ? 'populated' : 'empty');
  // A refusal is the page header and the permission state alone, as the Risk Register's is (W-3).
  if (resolvedState === 'permission') return <PermissionDeniedState area="assessment requests" />;
  const queueLabels = { 'requires-attention': 'Requires my attention', 'awaiting-requestor': 'Awaiting Requestor', 'generation-in-progress': 'Generation in progress', released: 'Released' } as const;
  const statuses = requestStatuses.map((status) => ({ value: status, label: statusLabel('request', status) }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Queue: <span className="font-medium text-foreground">{queueLabels[query.queue]}</span></p>
      <Controls
        label="Search assessment requests"
        onNavigate={navigate}
        query={query}
        statuses={statuses}
      />
      <ListFrame
        ariaLabel="Assessment requests for review"
        columns={requestColumns}
        data={requests}
        densityUserId="assessment-review-requests"
        emptyDescription={query.queue === 'requires-attention' ? undefined : `There is no work in the ${queueLabels[query.queue]} bucket. Return to the default queue to see work requiring your attention.`}
        filtered={Boolean(query.q || query.status || query.queue !== 'requires-attention')}
        loadingLabel="Loading assessment requests for review"
        noun="assessment requests"
        onNavigate={(page) => navigate({ ...query, page })}
        page={pagination?.page ?? query.page}
        pageSize={pagination?.pageSize ?? query.pageSize}
        query={query}
        renderMobileCard={(request) => (
          <article className="space-y-2">
            <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={requestHref(request.documentId)}>
              {request.requestNumber}
            </RecordLink>
            <RecordLink className="block" href={requestHref(request.documentId)}>
              {request.title}
            </RecordLink>
            <StatusBadge status={request.requestStatus} />
          </article>
        )}
        state={resolvedState}
        statusLabelFor={(status) => statusLabel('request', status as RequestStatus)}
        totalCount={pagination?.total ?? requests.length}
      />
    </div>
  );
}

export function AssessmentList({
  assessments,
  pagination,
  query = { q: '', sort: 'generatedDate:desc', page: 1, pageSize: 25 },
  state,
}: {
  assessments: readonly AssessmentSummary[];
  pagination?: CollectionPagination;
  query?: AssessmentCollectionQuery;
  state?: AssessmentCollectionState;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = (next: Query) => navigateFor(pathname, router, next);
  const resolvedState = state ?? (assessments.length ? 'populated' : 'empty');
  // A refusal is the page header and the permission state alone, as the Risk Register's is (W-3).
  if (resolvedState === 'permission') return <PermissionDeniedState area="risk assessments" />;

  return (
    <div className="space-y-3">
      <Controls
        label="Search risk assessments"
        onNavigate={navigate}
        query={query}
        statuses={assessmentStatuses.map((status) => ({ value: status, label: statusLabel('assessment', status) }))}
      />
      <ListFrame
        ariaLabel="Risk assessments for review"
        columns={assessmentColumns}
        data={assessments}
        densityUserId="assessment-review-assessments"
        filtered={Boolean(query.q || query.status)}
        loadingLabel="Loading risk assessments for review"
        noun="risk assessments"
        onNavigate={(page) => navigate({ ...query, page })}
        page={pagination?.page ?? query.page}
        pageSize={pagination?.pageSize ?? query.pageSize}
        query={query}
        renderMobileCard={(assessment) => (
          <article className="space-y-2">
            <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={assessmentHref(assessment.documentId)}>
              {assessment.assessmentNumber}
            </RecordLink>
            <p>{assessment.summary ?? 'Assessment draft'}</p>
            <StatusBadge family="assessment" value={assessment.assessmentStatus} />
            <span className="text-sm text-muted-foreground">
              Draft initiated by {assessment.generatedBy?.displayName ?? 'Not recorded'}
            </span>
          </article>
        )}
        state={resolvedState}
        statusLabelFor={(status) => (assessmentStatuses as readonly string[]).includes(status) ? statusLabel('assessment', status as (typeof assessmentStatuses)[number]) : status}
        totalCount={pagination?.total ?? assessments.length}
      />
    </div>
  );
}

export function AssessmentRequestListSkeleton() {
  return (
    <ListFrame
      ariaLabel="Assessment requests for review"
      columns={requestColumns}
      data={[]}
      densityUserId="assessment-review-requests"
      filtered={false}
      loadingLabel="Loading assessment requests for review"
      noun="assessment requests"
      onNavigate={() => undefined}
      page={1}
      pageSize={25}
      query={{ q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 }}
      renderMobileCard={() => null}
      state="loading"
      totalCount={0}
    />
  );
}

export function AssessmentListSkeleton() {
  return (
    <ListFrame
      ariaLabel="Risk assessments for review"
      columns={assessmentColumns}
      data={[]}
      densityUserId="assessment-review-assessments"
      filtered={false}
      loadingLabel="Loading risk assessments for review"
      noun="risk assessments"
      onNavigate={() => undefined}
      page={1}
      pageSize={25}
      query={{ q: '', sort: 'generatedDate:desc', page: 1, pageSize: 25 }}
      renderMobileCard={() => null}
      state="loading"
      totalCount={0}
    />
  );
}

export function AssessmentRequestListHeader() {
  return <PageHeader description="Review submitted requests and start draft generation." title="Assessment request review" />;
}

export function AssessmentListHeader() {
  return <PageHeader description="Open reviewable assessment drafts and continue analyst-controlled review." title="Risk assessment review" />;
}
