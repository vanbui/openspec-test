'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { cn } from '@/lib/utils';
import {
  alertConditionSentence,
  alertDateLabel,
  alertKindLabels,
  alertReleasedNote,
  alertResidualDisplay,
  alertsClearedDescription,
  alertSourceHref,
  alertSourceSecondaryText,
  alertUrgencyLabels,
  formatAlertDate,
} from './alert-presentation';
import { AlertRow } from './alert-row';
// The vocabularies and the URL reader come from the zod-free domain module, so the Alerts route downloads no zod.
import { alertKinds, alertUrgencies, readAlertListUrlQuery, type AlertListUrlQuery } from './alert-domain';
import type { AlertItem, AlertListPayload } from './alert-schema';

export type AlertListState = 'loading' | 'error' | 'permission';

export type AlertListProps = {
  alerts: readonly AlertItem[];
  /** The server's due-soon window, stated by the cleared empty state. Absent when no read succeeded. */
  dueSoonWindowDays?: number;
  pagination: AlertListPayload['meta']['pagination'];
  query: AlertListUrlQuery;
  /** A state the route already knows; otherwise populated or empty follows from the alerts. */
  state?: AlertListState;
};

/** One density preference for the alerts table, whether it is loading or loaded. */
const densityUserId = 'analyst-alerts';
const pageSizeOptions = [10, 25, 50] as const;

function pageSizeFor(value: number): AlertListUrlQuery['pageSize'] {
  return value === 10 || value === 50 ? value : 25;
}

/** The canonical Alerts URL: `kind`, `urgency`, then the page and its size. */
function alertsSearch(query: AlertListUrlQuery): string {
  const params = new URLSearchParams();
  if (query.kind) params.set('kind', query.kind);
  if (query.urgency) params.set('urgency', query.urgency);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

function ResidualRatingCell({ alert }: { alert: AlertItem }) {
  const residual = alertResidualDisplay(alert);
  return residual.kind === 'rating'
    ? <RiskRatingBadge rating={residual.rating} />
    : <span className="text-foreground-secondary">{residual.text}</span>;
}

function RecordCell({ alert }: { alert: AlertItem }) {
  const releasedNote = alertReleasedNote(alert);
  return (
    <div className="max-w-80 whitespace-normal py-2">
      <RecordLink href={alertSourceHref(alert)}>{alert.source.identifier}</RecordLink>
      <p className="line-clamp-1 text-xs text-foreground-secondary">{alertSourceSecondaryText(alert)}</p>
      {releasedNote ? <p className="text-xs text-foreground-secondary">{releasedNote}</p> : null}
    </div>
  );
}

function DateCell({ alert }: { alert: AlertItem }) {
  const text = formatAlertDate(alert.governingDate);
  return (
    <div className="py-2">
      {alert.governingDate
        ? <time className="block tabular-nums" dateTime={alert.governingDate}>{text}</time>
        : <span className="block">{text}</span>}
      <span className="block text-xs text-foreground-secondary">{alertDateLabel(alert.kind)}</span>
    </div>
  );
}

/*
 * UI-SPEC §3.4. The shared table cell does not wrap, so the Condition and Record content opts back
 * into wrapping and the table fits the content column at 768 and 1024. Urgency, rating and date stay
 * on one line. No column sorts: the server owns the order (D-12).
 */
const alertColumns: DataTableColumn<AlertItem>[] = [
  { accessorKey: 'urgency', header: 'Urgency', cell: (_value, alert) => <AlertUrgencyBadge urgency={alert.urgency} /> },
  { accessorKey: 'residualRating', header: 'Residual rating', cell: (_value, alert) => <ResidualRatingCell alert={alert} /> },
  {
    id: 'condition',
    accessorKey: 'kind',
    header: 'Condition',
    cell: (_value, alert) => <span className="block whitespace-normal py-2">{alertConditionSentence(alert)}</span>,
  },
  { id: 'record', accessorKey: 'source', header: 'Record', numeric: 'identity', cell: (_value, alert) => <RecordCell alert={alert} /> },
  { accessorKey: 'governingDate', header: 'Date', cell: (_value, alert) => <DateCell alert={alert} /> },
];

/* Selects stay selects, as every list filter in the product is (UI-D10). Below md they meet the touch-target height. */
const filterSelectClassName = cn('block w-full sm:w-auto sm:min-w-48', nativeSelectClassName, 'h-11 md:h-9');

function AlertFilters({ disabled, onChange, query }: {
  disabled: boolean;
  onChange: (changes: Partial<AlertListUrlQuery>) => void;
  query: AlertListUrlQuery;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end" data-print="hidden">
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Alert type
        <select
          aria-label="Filter by alert type"
          className={filterSelectClassName}
          disabled={disabled}
          value={query.kind ?? ''}
          onChange={(event) => onChange({ kind: alertKinds.find((kind) => kind === event.target.value) })}
        >
          <option value="">All alert types</option>
          {alertKinds.map((kind) => <option key={kind} value={kind}>{alertKindLabels[kind]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Urgency
        <select
          aria-label="Filter by urgency"
          className={filterSelectClassName}
          disabled={disabled}
          value={query.urgency ?? ''}
          onChange={(event) => onChange({ urgency: alertUrgencies.find((urgency) => urgency === event.target.value) })}
        >
          <option value="">All urgencies</option>
          {alertUrgencies.map((urgency) => <option key={urgency} value={urgency}>{alertUrgencyLabels[urgency]}</option>)}
        </select>
      </label>
    </div>
  );
}

/**
 * The Security Analyst's derived alerts, most urgent first (UI-SPEC §3). Filters, chips and paging
 * live in the URL and replace it; the route re-reads from the server. A denied viewer sees the
 * permission state alone: no filters, count, table or record link.
 */
export function AlertList({ alerts, dueSoonWindowDays, pagination, query, state }: AlertListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const outOfRange = pagination.total > 0 && query.page > Math.max(1, pagination.pageCount);
  const resolvedState = outOfRange ? 'loading' : state ?? (alerts.length ? 'populated' : 'empty');
  const navigate = (next: AlertListUrlQuery) => router.replace(`${pathname}?${alertsSearch(next)}`, { scroll: false });
  const resetPage = (changes: Partial<AlertListUrlQuery>) => navigate({ ...query, ...changes, page: 1 });
  const clearFilters = () => resetPage({ kind: undefined, urgency: undefined });

  // An out-of-range page moves to the last page, as the register does. navigate is rebuilt each
  // render, so the effect keys on the range and the query instead.
  useEffect(() => {
    if (outOfRange) navigate({ ...query, page: Math.max(1, pagination.pageCount) });
  }, [outOfRange, pagination.pageCount, query]);

  const filters = useMemo<DataTableFilter[]>(() => [
    ...(query.kind ? [{ id: 'kind', label: 'Alert type', value: alertKindLabels[query.kind] }] : []),
    ...(query.urgency ? [{ id: 'urgency', label: 'Urgency', value: alertUrgencyLabels[query.urgency] }] : []),
  ], [query.kind, query.urgency]);

  if (resolvedState === 'permission') return <PermissionDeniedState area="alerts" />;

  const emptyState = filters.length > 0
    ? <EmptyState filtered noun="alerts" onClearFilters={clearFilters} />
    : <EmptyState description={dueSoonWindowDays === undefined ? undefined : alertsClearedDescription(dueSoonWindowDays)} kind="cleared" noun="alerts" />;

  return (
    <div className="space-y-4">
      <AlertFilters disabled={resolvedState === 'loading'} onChange={resetPage} query={query} />
      <DataTable
        ariaLabel="Alerts"
        columns={alertColumns}
        data={[...alerts]}
        densityUserId={densityUserId}
        filters={filters}
        getRowId={(alert) => alert.id}
        loadingLabel="Loading alerts"
        onClearFilter={(id) => resetPage(id === 'kind' ? { kind: undefined } : { urgency: undefined })}
        onClearFilters={clearFilters}
        onPageChange={(page) => navigate({ ...query, page })}
        onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSizeFor(pageSize) })}
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageSizeOptions={pageSizeOptions}
        renderMobileCard={(alert) => <AlertRow alert={alert} />}
        state={resolvedState}
        stateSlots={{
          empty: emptyState,
          error: <ErrorState noun="alerts" retry={() => router.refresh()} />,
          permission: <PermissionDeniedState area="alerts" />,
        }}
        totalCount={pagination.total}
      />
    </div>
  );
}

/** The alerts loading layout under the current URL's filters, which stay disabled until the list arrives. */
export function AlertListLoading() {
  const searchParams = useSearchParams();
  const query = readAlertListUrlQuery(Object.fromEntries(searchParams.entries()));
  return <AlertList alerts={[]} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} state="loading" />;
}
