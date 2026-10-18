'use client';

import type { SortingState } from '@tanstack/react-table';
import { MessageSquareDot } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent } from 'react';

import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { LocalInstant } from '@/components/csrm/local-time';
import { PageHeader } from '@/components/csrm/page-header';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { formatRequestDate, requestStatuses, type RequestStatus } from '@/features/requests/request-domain';
import { QueuePickUpButton } from '@/features/request-assignment/queue-pick-up-button';
import { assessmentRatings, assessmentStatuses } from './assessment-domain';
import type { AssessmentRequestQueueItem, AssessmentSummary, QueuePerson } from './assessment-schema';
import type { AssessmentCollectionQuery, AssessmentRequestReviewQuery, CollectionPagination } from './assessment-service';
import { pageHeadings } from '@/config/navigation/page-headings';

export type AssessmentCollectionState = 'populated' | 'empty' | 'error' | 'permission';

type Query = AssessmentCollectionQuery | AssessmentRequestReviewQuery;

function requestHref(documentId: string): string {
  return `/app/review/requests/${encodeURIComponent(documentId)}`;
}

function assessmentHref(documentId: string): string {
  return `/app/review/assessments/${encodeURIComponent(documentId)}`;
}

const NOT_RECORDED = 'Not recorded';
const NOT_PROVIDED = 'Not provided';
const countFormatter = new Intl.NumberFormat('en-AU');

/** The server's days since submission, written out: `0 days`, `1 day`, `12 days` (D-29). */
function ageLabel(days: number | null): string {
  return days === null ? NOT_RECORDED : `${countFormatter.format(days)} ${days === 1 ? 'day' : 'days'}`;
}

/** A phone card's third line (UI-SPEC §7.1): who asked, and when it is due. */
function requestCardSummary(request: AssessmentRequestQueueItem): string {
  const due = formatRequestDate(request.dueDate);
  return `${request.requestorName ?? NOT_RECORDED} · ${due ? `Due ${due}` : 'No due date'}`;
}

/** A phone card's fourth line: the server's age, written out. */
function requestCardAge(days: number | null): string {
  return days === null ? 'Age not recorded' : `Age ${ageLabel(days)}`;
}

/** A phone card's who-asked and age lines. */
function RequestCardFacts({ request }: { request: AssessmentRequestQueueItem }) {
  return (
    <>
      <p className="text-xs text-muted-foreground">{requestCardSummary(request)}</p>
      <p className="text-xs tabular-nums text-muted-foreground">{requestCardAge(request.daysSinceSubmission)}</p>
    </>
  );
}

const NOT_RATED = 'Not rated';
const NOT_RELEASED = 'Not released';

/** An assessment's Risk count with its noun: `1 Risk`, `4 Risks` (UI-SPEC §7.2). */
function riskCountLabel(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? 'Risk' : 'Risks'}`;
}

/** The highest residual rating as the severity badge, with its text and icon, or `Not rated` (D-31). */
function HighestResidualRating({ rating }: { rating: AssessmentSummary['highestResidualRating'] }) {
  return rating ? <RiskRatingBadge rating={rating} /> : <>{NOT_RATED}</>;
}

/** A phone card's Risk line: `{n} {Risk|Risks} · Highest residual` with the badge, or `No Risks yet`. */
function AssessmentCardRisks({ assessment }: { assessment: AssessmentSummary }) {
  if (assessment.riskCount === 0) return <p className="text-xs text-muted-foreground">No Risks yet</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <span className="tabular-nums">{riskCountLabel(assessment.riskCount)} · Highest residual</span>{' '}
      <HighestResidualRating rating={assessment.highestResidualRating} />
    </p>
  );
}

/** The queue columns the server sorts by; each column's id is its sort field (UI-D28). */
const requestSortFields: readonly string[] = ['requestNumber', 'title', 'requestStatus', 'dueDate', 'submittedDate'];

function requestSortingFor(sort: string): SortingState {
  const [id, direction] = sort.split(':');
  return id && requestSortFields.includes(id) ? [{ id, desc: direction === 'desc' }] : [];
}

function requestSortFor(sorting: SortingState): AssessmentRequestReviewQuery['sort'] {
  const first = sorting[0];
  if (!first || !requestSortFields.includes(first.id)) return 'submittedDate:desc';
  return `${first.id}:${first.desc ? 'desc' : 'asc'}` as AssessmentRequestReviewQuery['sort'];
}

/** A review queue view: the team's Requests, or Assigned to me, the viewer's own (13-UI-SPEC §2.1, §2.2). */
export type RequestQueueView = 'requests' | 'assigned';
type ReviewQueue = AssessmentRequestReviewQuery['queue'];

/* Each view's own default queue, which its URL leaves out: Requires attention on Requests, All open on Assigned to me. */
const defaultQueues: Readonly<Record<RequestQueueView, ReviewQueue>> = { requests: 'requires-attention', assigned: 'open' };

function navigateFor(pathname: string, router: ReturnType<typeof useRouter>, next: Query, defaultQueue: ReviewQueue = 'requires-attention') {
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.status) params.set('status', next.status);
  if (!('queue' in next)) {
    if (next.overallRating) params.set('overallRating', next.overallRating);
    if (next.approvedFrom) params.set('approvedFrom', next.approvedFrom);
    if (next.approvedTo) params.set('approvedTo', next.approvedTo);
  }
  if ('queue' in next && next.queue !== defaultQueue) params.set('queue', next.queue);
  if ('queue' in next && next.assignee) params.set('assignee', next.assignee);
  if ('queue' in next && next.notes) params.set('notes', next.notes);
  params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  params.set('pageSize', String(next.pageSize));
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

function Controls({ label, onNavigate, query, showAssignee = false, statuses }: {
  label: string;
  onNavigate: (next: Query) => void;
  query: Query;
  /** Requests filters by who holds a request; a view of one person's requests does not (13-UI-SPEC §2.1). */
  showAssignee?: boolean;
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
            {reviewQueues.map((queue) => <option key={queue} value={queue}>{queueLabels[queue]}</option>)}
          </select>
        </label>
      ) : (
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Overall rating
          <select
            aria-label="Filter by overall rating"
            className={`block min-w-48 ${nativeSelectClassName}`}
            value={query.overallRating ?? ''}
            onChange={(event) => onNavigate({ ...query, overallRating: (event.target.value || undefined) as AssessmentCollectionQuery['overallRating'], page: 1 })}
          >
            <option value="">All ratings</option>
            {assessmentRatings.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
          </select>
        </label>
      )}
      {'queue' in query && showAssignee ? (
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Assigned to
          <select
            className={`block min-w-40 ${nativeSelectClassName}`}
            value={query.assignee ?? ''}
            onChange={(event) => onNavigate({ ...query, assignee: (event.target.value || undefined) as AssessmentRequestReviewQuery['assignee'], page: 1 })}
          >
            <option value="">Anyone</option>
            {assigneeFilters.map((assignee) => <option key={assignee} value={assignee}>{assigneeFilterLabels[assignee]}</option>)}
          </select>
        </label>
      ) : null}
      {'queue' in query ? (
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Notes
          <select
            className={`block min-w-40 ${nativeSelectClassName}`}
            value={query.notes ?? ''}
            onChange={(event) => onNavigate({ ...query, notes: (event.target.value || undefined) as AssessmentRequestReviewQuery['notes'], page: 1 })}
          >
            <option value="">All requests</option>
            <option value="unread">With new notes</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}

/* 13-UI-SPEC §2.2 (UI-D9, UI-D10): the queues in the select's order; Requires attention drops "my". */
const reviewQueues = ['requires-attention', 'awaiting-requestor', 'generation-in-progress', 'open', 'released', 'all'] as const satisfies readonly AssessmentRequestReviewQuery['queue'][];
const queueLabels: Readonly<Record<AssessmentRequestReviewQuery['queue'], string>> = {
  'requires-attention': 'Requires attention',
  'awaiting-requestor': 'Awaiting Requestor',
  'generation-in-progress': 'Generation in progress',
  open: 'All open',
  released: 'Released',
  all: 'All requests',
};

/* Assigned to me's empty view (13-UI-SPEC §2.1): cleared, saying where requests waiting for pick-up are; filtered, the locked copy. */
const assignedEmptyCopy = {
  noun: 'open requests assigned to you',
  description: 'Requests you pick up, or that another Security Analyst assigns to you, appear here until they’re released. Requests waiting for pick-up are in Requests.',
  filteredNoun: 'requests',
};

/* The Assigned to filter's values and words: the queue's unassigned reads Not picked up (Voice). */
const assigneeFilters = ['me', 'unassigned'] as const;
const assigneeFilterLabels: Readonly<Record<(typeof assigneeFilters)[number], string>> = { me: 'Me', unassigned: 'Not picked up' };

/** The chips of the Requests queue's own filters: who holds a request and new notes (13-UI-SPEC §2.2). */
function requestFilterChips(query: AssessmentRequestReviewQuery): DataTableFilter[] {
  return [
    ...(query.assignee ? [{ id: 'assignee', label: 'Assigned to', value: assigneeFilterLabels[query.assignee] }] : []),
    ...(query.notes ? [{ id: 'notes', label: 'Notes', value: 'New notes' }] : []),
  ];
}

/** `{n} new {note|notes}`, written out (Voice; X-17). */
function newNotesLine(unread: number): string {
  return `${countFormatter.format(unread)} new ${unread === 1 ? 'note' : 'notes'}`;
}

/*
 * The X-17 unread line (13-UI-SPEC §2.2): the viewer's new notes on the request, a link to its thread, named for the
 * request; nothing at zero. Unread is a personal fact, so it is ink with words, never a status hue.
 */
function QueueUnreadLine({ request }: { request: AssessmentRequestQueueItem }) {
  if (request.unreadNotes <= 0) return null;
  const line = newNotesLine(request.unreadNotes);
  return (
    <RecordLink
      aria-label={`${line} on ${request.requestNumber}`}
      className="inline-flex min-h-6 items-center gap-1 text-xs font-medium tabular-nums text-foreground"
      href={`${requestHref(request.documentId)}#notes`}
    >
      <MessageSquareDot aria-hidden="true" className="size-3 shrink-0" />
      {line}
    </RecordLink>
  );
}

const NOT_PICKED_UP = 'Not picked up';
const YOU_RAISED_IT = 'You raised it';

/*
 * 13-UI-SPEC §2.2, §2.3 (D-13, D-07): who holds the request, by name; Pick up where Strapi says this viewer may take
 * it; otherwise Not picked up, with You raised it on the viewer's own request. The server's pickUp decides.
 */
function AssignedToCell({ request, viewer }: { request: AssessmentRequestQueueItem; viewer: QueuePerson | null }) {
  if (request.assignee) return <span className="break-words">{request.assignee.displayName}</span>;
  if (request.pickUp === 'allowed' && viewer) {
    return <QueuePickUpButton requestId={request.documentId} requestNumber={request.requestNumber} requestStatus={request.requestStatus} viewer={viewer} />;
  }
  return (
    <span className="grid text-foreground-secondary">
      <span>{NOT_PICKED_UP}</span>
      {request.pickUp === 'own-request' ? <span className="text-xs">{YOU_RAISED_IT}</span> : null}
    </span>
  );
}

/* A phone card's holder line (§2.2): Assigned to {name}, or Not picked up, with You raised it on the viewer's own. */
function CardHolderLine({ request }: { request: AssessmentRequestQueueItem }) {
  if (request.assignee) return <p className="text-xs text-foreground-secondary break-words">Assigned to {request.assignee.displayName}</p>;
  return (
    <div className="text-xs text-foreground-secondary">
      <p>{NOT_PICKED_UP}</p>
      {request.pickUp === 'own-request' ? <p>{YOU_RAISED_IT}</p> : null}
    </div>
  );
}

/*
 * The nine triage columns (D-29, UI-SPEC §7.1), and Phase 13's Assigned to after Status on Requests (13-UI-SPEC §2.2).
 * Every value is the server's: business criticality is plain text, never the risk severity badge (UI-D27); the age is
 * daysSinceSubmission; the submission instant reads in the viewer's time zone and the due date as its calendar day
 * (D-55).
 */
function requestColumnsFor(viewer: QueuePerson | null, showAssignee: boolean): DataTableColumn<AssessmentRequestQueueItem>[] {
  return showAssignee
    ? [...triageColumns.slice(0, 6), assignedToColumn(viewer), ...triageColumns.slice(6)]
    : triageColumns;
}

function assignedToColumn(viewer: QueuePerson | null): DataTableColumn<AssessmentRequestQueueItem> {
  return {
    accessorKey: 'assignee',
    header: 'Assigned to',
    cell: (_value, request) => <AssignedToCell request={request} viewer={viewer} />,
  };
}

const triageColumns: DataTableColumn<AssessmentRequestQueueItem>[] = [
  {
    accessorKey: 'requestNumber',
    header: 'Request',
    enableSorting: true,
    numeric: 'identity',
    cell: (_value, request) => (
      <RecordLink href={requestHref(request.documentId)}>{request.requestNumber}</RecordLink>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    enableSorting: true,
    wrap: true,
    cell: (_value, request) => (
      <div className="grid justify-items-start gap-1">
        <RecordLink className="line-clamp-2" href={requestHref(request.documentId)}>{request.title}</RecordLink>
        <QueueUnreadLine request={request} />
      </div>
    ),
  },
  {
    accessorKey: 'requestorName',
    header: 'Requestor',
    cell: (_value, request) => request.requestorName ?? NOT_RECORDED,
  },
  {
    accessorKey: 'assessmentType',
    header: 'Assessment type',
    cell: (_value, request) => request.assessmentType ?? NOT_PROVIDED,
  },
  {
    accessorKey: 'businessCriticality',
    header: 'Business criticality',
    cell: (_value, request) => request.businessCriticality ?? NOT_PROVIDED,
  },
  {
    accessorKey: 'requestStatus',
    header: 'Status',
    enableSorting: true,
    cell: (_value, request) => <StatusBadge status={request.requestStatus} />,
  },
  {
    accessorKey: 'dueDate',
    header: 'Due date',
    enableSorting: true,
    cell: (_value, request) => formatRequestDate(request.dueDate) ?? NOT_PROVIDED,
  },
  {
    accessorKey: 'daysSinceSubmission',
    header: 'Age',
    numeric: 'magnitude',
    cell: (_value, request) => ageLabel(request.daysSinceSubmission),
  },
  {
    accessorKey: 'submittedDate',
    header: 'Submitted',
    enableSorting: true,
    cell: (_value, request) => <LocalInstant fallback={NOT_RECORDED} style="date" value={request.submittedDate} />,
  },
];

/*
 * The risk assessment columns (D-31, UI-SPEC §7.2): the request's title identifies the work without opening it, and
 * the server's Risk count and highest residual rating show how much risk it holds. The release instant reads in the
 * viewer's time zone (D-55).
 */
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
    accessorKey: 'requestTitle',
    header: 'Request title',
    wrap: true,
    cell: (_value, assessment) => <span className="line-clamp-2">{assessment.requestTitle ?? NOT_RECORDED}</span>,
  },
  {
    accessorKey: 'assessmentStatus',
    header: 'Status',
    cell: (_value, assessment) => <StatusBadge family="assessment" value={assessment.assessmentStatus} />,
  },
  {
    accessorKey: 'riskCount',
    header: 'Risks',
    numeric: 'magnitude',
    cell: (_value, assessment) => countFormatter.format(assessment.riskCount),
  },
  {
    accessorKey: 'highestResidualRating',
    header: 'Highest residual rating',
    cell: (_value, assessment) => <HighestResidualRating rating={assessment.highestResidualRating} />,
  },
  {
    accessorKey: 'generatedBy',
    header: 'Draft initiated by',
    cell: (_value, assessment) => assessment.generatedBy?.displayName ?? NOT_RECORDED,
  },
  {
    accessorKey: 'approvalDate',
    header: 'Released',
    cell: (_value, assessment) => <LocalInstant fallback={NOT_RELEASED} style="date" value={assessment.approvalDate} />,
  },
];

const clearedAssessmentFilters = { overallRating: undefined, approvedFrom: undefined, approvedTo: undefined } as const;
const clearedRequestFilters = { assignee: undefined, notes: undefined } as const;

/** The chips of the risk assessment list's own filters: the overall rating and the released date range (UI-SPEC §7.2). */
function assessmentFilterChips(query: AssessmentCollectionQuery): DataTableFilter[] {
  return [
    ...(query.overallRating ? [{ id: 'overallRating', label: 'Overall rating', value: query.overallRating }] : []),
    ...(query.approvedFrom ? [{ id: 'approvedFrom', label: 'Released from (UTC)', value: formatRequestDate(query.approvedFrom) ?? query.approvedFrom }] : []),
    ...(query.approvedTo ? [{ id: 'approvedTo', label: 'Released to (UTC)', value: formatRequestDate(query.approvedTo) ?? query.approvedTo }] : []),
  ];
}

/** The query change that removes one chip's filter. */
function clearedFilter(id: string): Partial<AssessmentCollectionQuery> {
  return id === 'q' ? { q: '' } : { [id]: undefined };
}

function ListFrame<T extends { documentId: string }>({
  ariaLabel,
  columns,
  data,
  defaultQueue = 'requires-attention',
  densityUserId,
  emptyCopy,
  emptyDescription,
  filtered,
  loadingLabel,
  noun,
  onNavigate,
  onSortingChange,
  page,
  pageSize,
  query,
  renderMobileCard,
  sorting,
  state,
  statusLabelFor,
  totalCount,
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  data: readonly T[];
  /** The view's default queue, to which Clear filters returns and which its URL leaves out. */
  defaultQueue?: ReviewQueue;
  densityUserId: string;
  /** A view's own empty copy: the cleared heading and fact when unfiltered, and the noun its filtered heading names. */
  emptyCopy?: { noun: string; description: string; filteredNoun: string };
  emptyDescription?: string;
  filtered: boolean;
  loadingLabel: string;
  noun: string;
  onNavigate: (page: number) => void;
  /** Sorting is offered only where the caller passes it: the server sorts the request queue. */
  onSortingChange?: (sorting: SortingState) => void;
  page: number;
  pageSize: number;
  query: Query;
  renderMobileCard: (row: T) => React.ReactNode;
  sorting?: SortingState;
  state: AssessmentCollectionState | 'loading';
  /** The label a status filter shows as its chip: the shared mapping's, so approved reads Released. */
  statusLabelFor?: (status: string) => string;
  totalCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearFilters = () => {
    navigateFor(pathname, router, { ...query, q: '', status: undefined, ...('queue' in query ? { queue: defaultQueue, ...clearedRequestFilters } : clearedAssessmentFilters), page: 1 }, defaultQueue);
  };
  /*
   * The direction's filter chips (section 4 DataTable) for the search, status, overall rating and released date
   * filters, so a filtered list never looks, or prints, like an unfiltered one (verdict 4a). The released date range
   * has no visible control: it shows only as its two chips (UI-D30). The queue has its own line above.
   */
  const filters: DataTableFilter[] = [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status && statusLabelFor ? [{ id: 'status', label: 'Status', value: statusLabelFor(query.status) }] : []),
    ...('queue' in query ? requestFilterChips(query) : assessmentFilterChips(query)),
  ];
  const clearFilter = (id: string) => navigateFor(pathname, router, { ...query, ...clearedFilter(id), page: 1 } as Query, defaultQueue);
  const clearChips = () => navigateFor(pathname, router, { ...query, q: '', status: undefined, ...('queue' in query ? clearedRequestFilters : clearedAssessmentFilters), page: 1 } as Query, defaultQueue);

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
      onSortingChange={onSortingChange}
      page={page}
      pageSize={pageSize}
      renderMobileCard={renderMobileCard}
      sorting={sorting}
      state={state}
      stateSlots={{
        empty: emptyCopy
          ? filtered
            ? <EmptyState filtered noun={emptyCopy.filteredNoun} onClearFilters={clearFilters} />
            : <EmptyState description={emptyCopy.description} kind="cleared" noun={emptyCopy.noun} />
          : <EmptyState description={emptyDescription} filtered={filtered} noun={noun} onClearFilters={clearFilters} />,
        error: <ErrorState noun={noun} retry={() => router.refresh()} />,
        permission: <PermissionDeniedState area={noun} />,
      }}
      totalCount={totalCount}
    />
  );
}

export function AssessmentRequestList({
  pagination,
  query: requestedQuery = { q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 },
  requests,
  showAssignee = true,
  state,
  view = 'requests',
  viewer = null,
}: {
  requests: readonly AssessmentRequestQueueItem[];
  pagination?: CollectionPagination;
  query?: AssessmentRequestReviewQuery;
  /** Requests shows who holds each request; a view of one person's own requests leaves the column out (13-UI-SPEC §2.1). */
  showAssignee?: boolean;
  state?: AssessmentCollectionState;
  /**
   * Assigned to me is the viewer's own requests (13-UI-SPEC §2.1): its scope is the page's, never a chip, a
   * control or a URL value; it opens on All open; and it leaves out who holds each request.
   */
  view?: RequestQueueView;
  /** The viewer the queue read named (13-12), whom a row's Pick up sends; without it no Pick up is offered. */
  viewer?: QueuePerson | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const assigned = view === 'assigned';
  const defaultQueue = defaultQueues[view];
  const query: AssessmentRequestReviewQuery = assigned ? { ...requestedQuery, assignee: undefined } : requestedQuery;
  const holders = showAssignee && !assigned;
  const navigate = (next: Query) => navigateFor(pathname, router, next, defaultQueue);
  const resolvedState = state ?? (requests.length ? 'populated' : 'empty');
  // A refusal is the page header and the permission state alone, as the Risk Register's is (W-3).
  if (resolvedState === 'permission') return <PermissionDeniedState area="assessment requests" />;
  const statuses = requestStatuses.map((status) => ({ value: status, label: statusLabel('request', status) }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Queue: <span className="font-medium text-foreground">{queueLabels[query.queue]}</span></p>
      <Controls
        label="Search by number or title"
        onNavigate={navigate}
        query={query}
        showAssignee={holders}
        statuses={statuses}
      />
      <ListFrame
        ariaLabel="Assessment requests for review"
        columns={requestColumnsFor(viewer, holders)}
        data={requests}
        defaultQueue={defaultQueue}
        densityUserId="assessment-review-requests"
        emptyCopy={assigned ? assignedEmptyCopy : undefined}
        emptyDescription={query.queue === 'requires-attention' ? undefined : `There is no work in the ${queueLabels[query.queue]} queue. Return to the default queue to see work requiring attention.`}
        filtered={Boolean(query.q || query.status || query.assignee || query.notes || query.queue !== defaultQueue)}
        loadingLabel="Loading assessment requests for review"
        noun="assessment requests"
        onNavigate={(page) => navigate({ ...query, page })}
        onSortingChange={(sorting) => navigate({ ...query, sort: requestSortFor(sorting), page: 1 })}
        page={pagination?.page ?? query.page}
        pageSize={pagination?.pageSize ?? query.pageSize}
        query={query}
        sorting={requestSortingFor(query.sort)}
        renderMobileCard={(request) => (
          <article className="space-y-2">
            {/* The row wraps, so a long badge drops below a long number instead of leaving the card (WCAG 1.4.10). */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={requestHref(request.documentId)}>
                {request.requestNumber}
              </RecordLink>
              <StatusBadge status={request.requestStatus} />
            </div>
            <div>
              <RecordLink className="line-clamp-3 break-words" href={requestHref(request.documentId)}>
                {request.title}
              </RecordLink>
            </div>
            {request.unreadNotes > 0 ? <div><QueueUnreadLine request={request} /></div> : null}
            {holders && !request.assignee && request.pickUp === 'allowed' && viewer ? (
              /* §2.2: the holder line after the title, and Pick up at full width as the card's last element. */
              <QueuePickUpButton layout="card" requestId={request.documentId} requestNumber={request.requestNumber} requestStatus={request.requestStatus} viewer={viewer}>
                <RequestCardFacts request={request} />
              </QueuePickUpButton>
            ) : (
              <>
                {holders ? <CardHolderLine request={request} /> : null}
                <RequestCardFacts request={request} />
              </>
            )}
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
        filtered={Boolean(query.q || query.status || query.overallRating || query.approvedFrom || query.approvedTo)}
        loadingLabel="Loading risk assessments for review"
        noun="risk assessments"
        onNavigate={(page) => navigate({ ...query, page })}
        page={pagination?.page ?? query.page}
        pageSize={pagination?.pageSize ?? query.pageSize}
        query={query}
        renderMobileCard={(assessment) => (
          <article className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={assessmentHref(assessment.documentId)}>
                {assessment.assessmentNumber}
              </RecordLink>
              <StatusBadge family="assessment" value={assessment.assessmentStatus} />
            </div>
            <p className="line-clamp-3 break-words">{assessment.requestTitle ?? NOT_RECORDED}</p>
            <AssessmentCardRisks assessment={assessment} />
            <p className="text-xs text-muted-foreground">Draft initiated by {assessment.generatedBy?.displayName ?? NOT_RECORDED}</p>
            {assessment.approvalDate ? (
              <p className="text-xs text-muted-foreground">
                Released <LocalInstant style="date" value={assessment.approvalDate} />
              </p>
            ) : null}
          </article>
        )}
        state={resolvedState}
        statusLabelFor={(status) => (assessmentStatuses as readonly string[]).includes(status) ? statusLabel('assessment', status as (typeof assessmentStatuses)[number]) : status}
        totalCount={pagination?.total ?? assessments.length}
      />
    </div>
  );
}

/** The queue's loading state: ten columns on Requests, nine on Assigned to me (13-UI-SPEC §2.1). */
export function AssessmentRequestListSkeleton({ view = 'requests' }: { view?: RequestQueueView } = {}) {
  return (
    <ListFrame
      ariaLabel="Assessment requests for review"
      columns={requestColumnsFor(null, view === 'requests')}
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

/*
 * The three review headers. `action` is the header's Export, which only each page's data component passes, after a
 * successful read; the Suspense fallback renders the header without it (Phase 19 export placement).
 */
type ListHeaderProps = { action?: React.ReactNode };

export function AssessmentRequestListHeader({ action }: ListHeaderProps = {}) {
  return <PageHeader action={action} description="Submitted requests across the team. Pick up a request to make it yours." title={pageHeadings.reviewRequests} />;
}

export function AssignedRequestListHeader({ action }: ListHeaderProps = {}) {
  return <PageHeader action={action} description="Requests you’re accountable for, and what each needs next." title={pageHeadings.assignedToMe} />;
}

export function AssessmentListHeader({ action }: ListHeaderProps = {}) {
  return <PageHeader action={action} description="Open reviewable assessment drafts and continue analyst-controlled review." title={pageHeadings.reviewAssessments} />;
}
