'use client';

import type { SortingState } from '@tanstack/react-table';
import { Archive } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { formatRiskTargetDate, isAcceptedRiskRow, riskRegisterCardMarker, riskRegisterSortValues, riskRegisterStageMarker, riskRegisterWithdrawnNotice, type RiskTreatmentDueState } from './risk-domain';
import type { RiskRegisterItem, RiskRegisterPayload, RiskRegisterQuery } from './risk-schema';
import { riskRegisterFilterChips } from './risk-register-chips';
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

const filterKeys = ['q', 'treatmentStatus', 'inherentRating', 'residualRating', 'riskOwner', 'treatmentOwner', 'assessment', 'system', 'asset', 'mitigationStatus', 'state', 'stage', 'treatmentAction', 'dueState', 'mitigationEffectiveness', 'impactedSystem', 'targetDateFrom', 'targetDateTo'] as const;

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

/* The treatment status, then Accepted on a caption line for a released Risk with Accept (D-41, D-44, UI-SPEC §9.5). */
function TreatmentStatusCell({ risk }: { risk: RiskRegisterItem }) {
  return <div><TreatmentStatus status={risk.treatmentStatus} />{isAcceptedRiskRow(risk) ? <p className="text-xs text-foreground-secondary">Accepted</p> : null}</div>;
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

/*
 * The Related assessment link, then the Risk's stage in words on a caption line (D-44, UI-SPEC §9.5). The
 * stage is the server's; it is never shown by colour alone (UI-D36).
 */
function RelatedAssessment({ risk, linkClassName, marker }: { risk: RiskRegisterItem; linkClassName?: string; marker: string }) {
  return <div><RecordLink className={linkClassName} href={assessmentHref(risk.assessment.documentId)}>{risk.assessment.assessmentNumber}</RecordLink><p className="text-xs text-foreground-secondary">{marker}</p></div>;
}

export function RiskRegisterAccessDenied() {
  return <PermissionDeniedState area="the Risk register" />;
}

export function RiskRegisterInvalidFilterState() {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-surface p-6 text-center" role="alert">
      <h2 className="text-heading-md text-foreground">Risk register filters are invalid</h2>
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
  const clearFilters = () => resetPage({ q: '', treatmentStatus: undefined, inherentRating: undefined, residualRating: undefined, riskOwner: undefined, treatmentOwner: undefined, assessment: undefined, system: undefined, asset: undefined, mitigationStatus: undefined, state: undefined, stage: undefined, treatmentAction: undefined, dueState: undefined, mitigationEffectiveness: undefined, impactedSystem: undefined, targetDateFrom: undefined, targetDateTo: undefined });

  useEffect(() => {
    if (outOfRange) navigate({ ...query, page: Math.max(1, pagination.pageCount) });
  }, [outOfRange, pagination.pageCount, query]);

  // A chip names its record by the server's selected label, else the picker's option (D-32: an assessment by its number and request title).
  const pickerKinds = { riskOwner: 'owners', treatmentOwner: 'owners', assessment: 'assessments', system: 'systems', asset: 'assets' } as const;
  const labelFor = (key: keyof typeof pickerKinds) => selectedLabels[key]?.label
    ?? pickerOptions[pickerKinds[key]].find((option) => option.documentId === query[key])?.label
    ?? query[key] ?? '';
  const filters = useMemo<DataTableFilter[]>(() => riskRegisterFilterChips(query, labelFor), [pickerOptions, query, selectedLabels]);

  if (resolvedState === 'permission') return <RiskRegisterAccessDenied />;

  // D-08, D-45: only the explicit Withdrawn state lists withdrawn Risks, so every row it serves is one (16-UI-SPEC §11.2).
  const withdrawnList = query.state === 'withdrawn';
  const withdrawnBadge = withdrawnList ? <StatusBadge family="risk" value="withdrawn" /> : null;

  const columns: DataTableColumn<RiskRegisterItem>[] = [
    { accessorKey: 'riskNumber', header: 'Risk number', enableSorting: true, numeric: 'identity', cell: (_value, risk) => withdrawnList ? <div className="grid justify-items-start gap-1"><RecordLink href={riskHref(risk.documentId)}>{risk.riskNumber}</RecordLink>{withdrawnBadge}</div> : <RecordLink href={riskHref(risk.documentId)}>{risk.riskNumber}</RecordLink> },
    { accessorKey: 'riskStatement', header: 'Statement', enableSorting: true, wrap: true, cell: (_value, risk) => risk.riskStatement ? <RecordLink className="line-clamp-2" href={riskHref(risk.documentId)} title={risk.riskStatement}>{risk.riskStatement}</RecordLink> : 'Not provided' },
    { accessorKey: 'inherentRating', header: 'Inherent rating', enableSorting: true, cell: (_value, risk) => risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : 'Not provided' },
    { accessorKey: 'residualRating', header: 'Residual rating', enableSorting: true, cell: (_value, risk) => risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : 'Not provided' },
    { accessorKey: 'treatmentStatus', header: 'Treatment status', enableSorting: true, cell: (_value, risk) => <TreatmentStatusCell risk={risk} /> },
    { accessorKey: 'treatmentOwner', header: 'Treatment owner', enableSorting: true, cell: (_value, risk) => risk.treatmentOwner?.displayName ?? 'Unassigned' },
    { accessorKey: 'targetDate', header: 'Target date', enableSorting: true, cell: (_value, risk) => <TargetDate dueState={risk.treatmentDueState} value={risk.targetDate} /> },
    { accessorKey: 'assessment', header: 'Related assessment', enableSorting: true, cell: (_value, risk) => <RelatedAssessment marker={riskRegisterStageMarker(risk)} risk={risk} /> },
  ];
  const removeFilter = (id: string) => resetPage({ [id]: id === 'q' ? '' : undefined });

  return <div className="space-y-4">
    <RiskRegisterFilters activeCount={filters.length} disabled={resolvedState === 'loading'} onChange={resetPage} pickerOptions={pickerOptions} query={query} searchRelations={searchRelations} />
    {withdrawnList ? <p className="flex items-start gap-2 text-sm text-foreground-secondary"><Archive aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{riskRegisterWithdrawnNotice}</p> : null}
    <DataTable ariaLabel="Risk Register results" columns={columns} data={[...risks]} densityUserId={densityUserId} filters={filters} getRowId={(risk) => risk.documentId} onClearFilter={removeFilter} onClearFilters={clearFilters} onPageChange={(page) => navigate({ ...query, page })} onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as RiskRegisterQuery['pageSize'] })} onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })} page={pagination.page} pageSize={pagination.pageSize} pageSizeOptions={[10, 25, 50]} renderMobileCard={(risk) => <article className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><span className="inline-flex min-w-0 grow basis-24 flex-wrap items-center gap-2"><RecordLink className="inline-flex min-h-11 items-center tabular-nums" href={riskHref(risk.documentId)}>{risk.riskNumber}</RecordLink>{withdrawnBadge}</span><TreatmentStatus status={risk.treatmentStatus} /></div><p className="line-clamp-3 text-sm text-foreground">{risk.riskStatement ?? 'Not provided'}</p><dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Inherent</dt><dd>{risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Residual</dt><dd>{risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Treatment owner</dt><dd>{risk.treatmentOwner?.displayName ?? 'Unassigned'}</dd></div><div><dt className="text-muted-foreground">Target date</dt><dd><TargetDate dueState={risk.treatmentDueState} value={risk.targetDate} /></dd></div></dl><RelatedAssessment linkClassName="inline-flex min-h-11 items-center text-sm" marker={riskRegisterCardMarker(risk)} risk={risk} /></article>} sorting={sortingFor(query.sort)} state={resolvedState} loadingLabel="Loading Risk Register" stateSlots={{ empty: <EmptyState filtered={filters.length > 0} noun="Risks" onClearFilters={clearFilters} />, error: <ErrorState noun="the Risk register" retry={() => router.refresh()} />, permission: <RiskRegisterAccessDenied /> }} totalCount={pagination.total} />
  </div>;
}
