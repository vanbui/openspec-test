'use client';

import type { SortingState } from '@tanstack/react-table';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { formatRiskTargetDate, riskRegisterSortValues, riskRegisterStateLabels, type RiskTreatmentDueState } from './risk-domain';
import type { RiskRegisterItem, RiskRegisterPayload, RiskRegisterQuery } from './risk-schema';
import { RiskRegisterFilters, type RiskRegisterPickerOptions } from './risk-register-filters';
import type { RiskRelationSearchResult } from './risk-actions';

type RiskRegisterState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';
type Pagination = RiskRegisterPayload['meta']['pagination'];

export type RiskRegisterTableProps = {
  densityUserId: string;
  pagination: Pagination;
  pickerOptions: RiskRegisterPickerOptions;
  query: RiskRegisterQuery;
  risks: readonly RiskRegisterItem[];
  selectedLabels: RiskRegisterPayload['meta']['selectedLabels'];
  searchRelations?: (input: { kind: 'owners' | 'assessments' | 'systems' | 'assets'; search: string }) => Promise<RiskRelationSearchResult>;
  state?: RiskRegisterState;
};

const filterKeys = ['q', 'treatmentStatus', 'inherentRating', 'residualRating', 'riskOwner', 'treatmentOwner', 'assessment', 'system', 'asset', 'mitigationStatus', 'state', 'targetDateFrom', 'targetDateTo'] as const;

function riskHref(documentId: string) { return `/app/risks/${encodeURIComponent(documentId)}`; }
function assessmentHref(documentId: string) { return `/app/review/assessments/${encodeURIComponent(documentId)}`; }

function searchParametersFor(query: RiskRegisterQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = query[key];
    if (value) params.set(key, String(value));
  }
  params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params;
}

function sortingFor(sort: RiskRegisterQuery['sort']): SortingState {
  const [id, direction] = sort.split(':') as [string, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

function sortFor(sorting: SortingState): RiskRegisterQuery['sort'] {
  const first = sorting[0];
  const candidate = `${first?.id ?? 'targetDate'}:${first?.desc ? 'desc' : 'asc'}`;
  return riskRegisterSortValues.includes(candidate as RiskRegisterQuery['sort']) ? candidate as RiskRegisterQuery['sort'] : 'targetDate:asc';
}

/* The stored treatment status, verbatim, through the shared status mapping; Overdue is a clock, never a severity triangle. */
function TreatmentStatus({ status }: { status: RiskRegisterItem['treatmentStatus'] }) {
  if (!status) return <span>Not provided</span>;
  return <StatusBadge family="treatment" value={status} />;
}

/*
 * The Overdue marker follows the server's treatment due state only; the client never compares dates
 * (D-04, D-26). It is the dense urgency form, so it reads as time-bound work and never as the High
 * severity triangle (UI-D13).
 */
function TargetDate({ value, dueState }: { value: string | null; dueState: RiskTreatmentDueState }) {
  if (!value) return <span>No target date</span>;
  return <span className="inline-flex flex-wrap items-center gap-1 tabular-nums"><time dateTime={value}>{formatRiskTargetDate(value)}</time>{dueState === 'overdue' ? <AlertUrgencyBadge density="dense" urgency="overdue" /> : null}</span>;
}

export function RiskRegisterAccessDenied() {
  return <PermissionDeniedState area="the Risk Register" />;
}

export function RiskRegisterInvalidFilterState() {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-surface p-6 text-center" role="alert">
      <h2 className="text-heading-md text-foreground">Risk Register filters are invalid</h2>
      <p className="text-sm text-muted-foreground">Check the Target date range, or clear the invalid filters to return to the register.</p>
      <Link className={buttonVariants({ variant: 'outline' })} href="/app/risks">Clear invalid filters</Link>
    </section>
  );
}

export function RiskRegisterTable({ densityUserId, pagination, pickerOptions, query, risks, searchRelations, selectedLabels, state }: RiskRegisterTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const outOfRange = pagination.total > 0 && query.page > Math.max(1, pagination.pageCount);
  const resolvedState = outOfRange ? 'loading' : state ?? (risks.length ? 'populated' : 'empty');
  const navigate = (next: RiskRegisterQuery) => router.replace(`${pathname}?${searchParametersFor(next).toString()}`, { scroll: false });
  const resetPage = (changes: Partial<RiskRegisterQuery>) => navigate({ ...query, ...changes, page: 1 });
  const clearFilters = () => resetPage({ q: '', treatmentStatus: undefined, inherentRating: undefined, residualRating: undefined, riskOwner: undefined, treatmentOwner: undefined, assessment: undefined, system: undefined, asset: undefined, mitigationStatus: undefined, state: undefined, targetDateFrom: undefined, targetDateTo: undefined });

  useEffect(() => {
    if (outOfRange) navigate({ ...query, page: Math.max(1, pagination.pageCount) });
  }, [outOfRange, pagination.pageCount, query]);

  const labelFor = (key: 'riskOwner' | 'treatmentOwner' | 'assessment' | 'system' | 'asset') => selectedLabels[key]?.label ?? query[key] ?? '';
  const filters = useMemo<DataTableFilter[]>(() => [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.treatmentStatus ? [{ id: 'treatmentStatus', label: 'Treatment status', value: statusLabel('treatment', query.treatmentStatus) }] : []),
    ...(query.inherentRating ? [{ id: 'inherentRating', label: 'Inherent rating', value: query.inherentRating }] : []),
    ...(query.residualRating ? [{ id: 'residualRating', label: 'Residual rating', value: query.residualRating }] : []),
    ...(query.riskOwner ? [{ id: 'riskOwner', label: 'Risk owner', value: labelFor('riskOwner') }] : []),
    ...(query.treatmentOwner ? [{ id: 'treatmentOwner', label: 'Treatment owner', value: labelFor('treatmentOwner') }] : []),
    ...(query.assessment ? [{ id: 'assessment', label: 'Related assessment', value: labelFor('assessment') }] : []),
    ...(query.system ? [{ id: 'system', label: 'Impacted system', value: labelFor('system') }] : []),
    ...(query.asset ? [{ id: 'asset', label: 'Impacted asset', value: labelFor('asset') }] : []),
    ...(query.mitigationStatus ? [{ id: 'mitigationStatus', label: 'Mitigation-control status', value: query.mitigationStatus === 'none' ? 'No mitigation controls' : query.mitigationStatus }] : []),
    ...(query.state ? [{ id: 'state', label: 'Risk state', value: riskRegisterStateLabels[query.state] }] : []),
    ...(query.targetDateFrom ? [{ id: 'targetDateFrom', label: 'Target date from', value: query.targetDateFrom }] : []),
    ...(query.targetDateTo ? [{ id: 'targetDateTo', label: 'Target date to', value: query.targetDateTo }] : []),
  ], [query, selectedLabels]);

  if (resolvedState === 'permission') return <RiskRegisterAccessDenied />;

  const columns: DataTableColumn<RiskRegisterItem>[] = [
    { accessorKey: 'riskNumber', header: 'Risk number', enableSorting: true, numeric: 'identity', cell: (_value, risk) => <RecordLink href={riskHref(risk.documentId)}>{risk.riskNumber}</RecordLink> },
    { accessorKey: 'riskStatement', header: 'Statement', enableSorting: true, wrap: true, cell: (_value, risk) => risk.riskStatement ? <RecordLink className="line-clamp-2" href={riskHref(risk.documentId)} title={risk.riskStatement}>{risk.riskStatement}</RecordLink> : 'Not provided' },
    { accessorKey: 'inherentRating', header: 'Inherent rating', enableSorting: true, cell: (_value, risk) => risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : 'Not provided' },
    { accessorKey: 'residualRating', header: 'Residual rating', enableSorting: true, cell: (_value, risk) => risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : 'Not provided' },
    { accessorKey: 'treatmentStatus', header: 'Treatment status', enableSorting: true, cell: (_value, risk) => <TreatmentStatus status={risk.treatmentStatus} /> },
    { accessorKey: 'treatmentOwner', header: 'Treatment owner', enableSorting: true, cell: (_value, risk) => risk.treatmentOwner?.displayName ?? 'Unassigned' },
    { accessorKey: 'targetDate', header: 'Target date', enableSorting: true, cell: (_value, risk) => <TargetDate dueState={risk.treatmentDueState} value={risk.targetDate} /> },
    { accessorKey: 'assessment', header: 'Related assessment', enableSorting: true, cell: (_value, risk) => <RecordLink href={assessmentHref(risk.assessment.documentId)}>{risk.assessment.assessmentNumber}</RecordLink> },
  ];
  const removeFilter = (id: string) => resetPage({ [id]: id === 'q' ? '' : undefined });

  return <div className="space-y-4">
    <RiskRegisterFilters activeCount={filters.length} disabled={resolvedState === 'loading'} onChange={resetPage} pickerOptions={pickerOptions} query={query} searchRelations={searchRelations} />
    <DataTable ariaLabel="Risk Register results" columns={columns} data={[...risks]} densityUserId={densityUserId} filters={filters} getRowId={(risk) => risk.documentId} onClearFilter={removeFilter} onClearFilters={clearFilters} onPageChange={(page) => navigate({ ...query, page })} onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as RiskRegisterQuery['pageSize'] })} onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })} page={pagination.page} pageSize={pagination.pageSize} pageSizeOptions={[10, 25, 50]} renderMobileCard={(risk) => <article className="space-y-3"><div className="flex items-start justify-between gap-3"><RecordLink className="inline-flex min-h-11 items-center tabular-nums" href={riskHref(risk.documentId)}>{risk.riskNumber}</RecordLink><TreatmentStatus status={risk.treatmentStatus} /></div><p className="line-clamp-3 text-sm text-foreground">{risk.riskStatement ?? 'Not provided'}</p><dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Inherent</dt><dd>{risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Residual</dt><dd>{risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Treatment owner</dt><dd>{risk.treatmentOwner?.displayName ?? 'Unassigned'}</dd></div><div><dt className="text-muted-foreground">Target date</dt><dd><TargetDate dueState={risk.treatmentDueState} value={risk.targetDate} /></dd></div></dl><RecordLink className="inline-flex min-h-11 items-center text-sm" href={assessmentHref(risk.assessment.documentId)}>{risk.assessment.assessmentNumber}</RecordLink></article>} sorting={sortingFor(query.sort)} state={resolvedState} loadingLabel="Loading Risk Register" stateSlots={{ empty: <EmptyState filtered={filters.length > 0} noun="Risks" onClearFilters={clearFilters} />, error: <ErrorState noun="the Risk Register" retry={() => router.refresh()} />, permission: <RiskRegisterAccessDenied /> }} totalCount={pagination.total} />
  </div>;
}
