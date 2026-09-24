'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent } from 'react';

import { DataTable, type DataTableColumn } from '@/components/csrm/data-table';
import { PageHeader } from '@/components/csrm/page-header';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { requestStatusPresentation, requestStatuses } from '@/features/requests/request-domain';
import { assessmentStatusPresentation } from './assessment-domain';
import { assessmentStatuses, type AssessmentRequestQueueItem, type AssessmentSummary, type AssessmentStatus } from './assessment-schema';
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

function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const presentation = assessmentStatusPresentation[status];
  const Icon = presentation.icon;

  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <form className="flex flex-1 gap-2" role="search" onSubmit={search}>
        <label className="flex-1 text-sm font-medium text-foreground">
          {label}
          <Input aria-label={label} defaultValue={query.q} key={query.q} name="q" type="search" />
        </label>
        <Button className="self-end" type="submit">Search</Button>
      </form>
      <label className="text-sm font-medium text-foreground">
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
        <label className="text-sm font-medium text-foreground">
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
    cell: (_value, assessment) => <AssessmentStatusBadge status={assessment.assessmentStatus} />,
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
  totalCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearFilters = () => {
    navigateFor(pathname, router, { ...query, q: '', status: undefined, ...('queue' in query ? { queue: 'requires-attention' as const } : {}), page: 1 });
  };

  return (
    <DataTable
      ariaLabel={ariaLabel}
      columns={columns}
      data={[...data]}
      densityUserId={densityUserId}
      getRowId={(row) => row.documentId}
      loadingLabel={loadingLabel}
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
  const queueLabels = { 'requires-attention': 'Requires my attention', 'awaiting-requestor': 'Awaiting Requestor', 'generation-in-progress': 'Generation in progress', released: 'Released' } as const;
  const statuses = requestStatuses.map((status) => ({ value: status, label: requestStatusPresentation[status].label }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Queue: <span className="font-medium text-foreground">{queueLabels[query.queue]}</span></p>
      <Controls
        label="Search collection"
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

  return (
    <div className="space-y-3">
      <Controls
        label="Search collection"
        onNavigate={navigate}
        query={query}
        statuses={assessmentStatuses.map((status) => ({ value: status, label: assessmentStatusPresentation[status].label }))}
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
            <AssessmentStatusBadge status={assessment.assessmentStatus} />
            <span className="text-sm text-muted-foreground">
              Draft initiated by {assessment.generatedBy?.displayName ?? 'Not recorded'}
            </span>
          </article>
        )}
        state={resolvedState}
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
