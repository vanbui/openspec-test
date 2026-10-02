'use client';

import { CalendarDays, CheckCircle2, FileSearch, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/csrm/page-header';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ControlImplementation,
  ReleasedAssessmentDetailForActor,
  ReleasedAssessmentSummary,
  Risk,
} from './assessment-schema';
import { AssessmentLifecycleStepper } from './assessment-lifecycle-stepper';
import { AssessmentRequestLink } from './assessment-request-link';
import { controlLabel } from './control-label';
import type { AssessmentCollectionQuery, CollectionPagination } from './assessment-service';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useMemo } from 'react';

export type ReleasedAssessmentListState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';
export type ReleasedAssessmentDetailState = 'populated' | 'empty' | 'error' | 'permission' | 'unavailable' | 'contract-mismatch';

type ControlsByRisk = Readonly<Record<string, readonly ControlImplementation[]>>;

const dateFormatter = new Intl.DateTimeFormat('en-AU', { dateStyle: 'long', timeZone: 'UTC' });

function releasedAssessmentHref(documentId: string): string {
  return `/app/assessments/${encodeURIComponent(documentId)}`;
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : 'Not recorded';
}

function displayText(value: string | null): string {
  return value?.trim() || 'Not recorded';
}

function Definition({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value}</dd></div>;
}

const releasedAssessmentColumns: DataTableColumn<ReleasedAssessmentSummary>[] = [
  { accessorKey: 'assessmentNumber', header: 'Assessment', enableSorting: true, numeric: 'identity', cell: (_value, assessment) => <RecordLink href={releasedAssessmentHref(assessment.documentId)}>{assessment.assessmentNumber}</RecordLink> },
  { accessorKey: 'summary', header: 'Summary', cell: (_value, assessment) => displayText(assessment.summary) },
  { accessorKey: 'overallRating', header: 'Overall rating', cell: (_value, assessment) => assessment.overallRating ? <RiskRatingBadge rating={assessment.overallRating} /> : <Badge variant="outline">Rating not recorded</Badge> },
  { accessorKey: 'approvalDate', header: 'Released', enableSorting: true, cell: (_value, assessment) => formatDate(assessment.approvalDate) },
];

function sortingFor(sort: AssessmentCollectionQuery['sort']) {
  const [id, direction] = sort.split(':') as [string, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

function sortFor(sorting: { id: string; desc: boolean }[]): AssessmentCollectionQuery['sort'] {
  const first = sorting[0];
  const candidate = `${first?.id ?? 'generatedDate'}:${first?.desc === false ? 'asc' : 'desc'}`;
  const allowed: readonly AssessmentCollectionQuery['sort'][] = ['generatedDate:asc', 'generatedDate:desc', 'approvalDate:asc', 'approvalDate:desc', 'assessmentNumber:asc', 'assessmentNumber:desc', 'assessmentStatus:asc', 'assessmentStatus:desc'];
  return allowed.includes(candidate as AssessmentCollectionQuery['sort'])
    ? candidate as AssessmentCollectionQuery['sort']
    : 'generatedDate:desc';
}

export function ReleasedAssessmentListSkeleton() {
  return <ReleasedAssessmentList assessments={[]} state="loading" />;
}

export function ReleasedAssessmentList({ assessments, pagination, query = { q: '', sort: 'generatedDate:desc', page: 1, pageSize: 25 }, state }: { assessments: readonly ReleasedAssessmentSummary[]; pagination?: CollectionPagination; query?: AssessmentCollectionQuery; state?: ReleasedAssessmentListState }) {
  const pathname = usePathname();
  const router = useRouter();
  const resolvedPagination = pagination ?? { page: query.page, pageSize: query.pageSize, pageCount: assessments.length ? 1 : 0, total: assessments.length };
  const navigate = (next: AssessmentCollectionQuery) => { const params = new URLSearchParams(); if (next.q) params.set('q', next.q); if (next.status) params.set('status', next.status); params.set('sort', next.sort); if (next.page > 1) params.set('page', String(next.page)); params.set('pageSize', String(next.pageSize)); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); };
  const resetPage = (changes: Partial<AssessmentCollectionQuery>) => navigate({ ...query, ...changes, page: 1 });
  const filters = useMemo<DataTableFilter[]>(() => [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    // The chip reads the shared mapping, as the option does: the stored approved reads Released.
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('assessment', query.status) }] : []),
  ], [query.q, query.status]);
  const resolvedState = state ?? (assessments.length ? 'populated' : 'empty');
  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const value = new FormData(event.currentTarget).get('q'); resetPage({ q: typeof value === 'string' ? value.trim() : '' }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end" data-print="hidden"><form className="flex flex-1 gap-2" role="search" onSubmit={search}><label className="grid flex-1 gap-1.5 text-sm font-medium text-foreground">Search risk assessments<Input aria-label="Search risk assessments" defaultValue={query.q} key={query.q} name="q" type="search" /></label><Button className="self-end" type="submit">Search</Button></form><label className="grid gap-1.5 text-sm font-medium text-foreground">Status<select aria-label="Filter by status" className="block h-9 min-w-48 rounded-md border border-input bg-surface px-3 text-sm text-foreground" value={query.status ?? ''} onChange={(event) => resetPage({ status: event.target.value as AssessmentCollectionQuery['status'] || undefined })}><option value="">All statuses</option><option value="approved">{statusLabel('assessment', 'approved')}</option></select></label></div>
      <DataTable ariaLabel="My released risk assessments" columns={releasedAssessmentColumns} data={[...assessments]} densityUserId="released-assessments" filters={filters} getRowId={(assessment) => assessment.documentId} loadingLabel="Loading released risk assessments" onClearFilter={(id) => resetPage(id === 'q' ? { q: '' } : { status: undefined })} onClearFilters={() => resetPage({ q: '', status: undefined })} onPageChange={(page) => navigate({ ...query, page })} onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as AssessmentCollectionQuery['pageSize'] })} onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })} page={resolvedPagination.page} pageSize={resolvedPagination.pageSize} renderMobileCard={(assessment) => <article className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={releasedAssessmentHref(assessment.documentId)}>{assessment.assessmentNumber}</RecordLink>{assessment.overallRating ? <RiskRatingBadge rating={assessment.overallRating} /> : <Badge variant="outline">Rating not recorded</Badge>}</div><p className="text-sm text-foreground">{displayText(assessment.summary)}</p><p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays aria-hidden="true" />Released {formatDate(assessment.approvalDate)}</p></article>} sorting={sortingFor(query.sort)} state={resolvedState} stateSlots={{ empty: <EmptyState description="Assessments appear here after an authorised Security Analyst releases them." filtered={Boolean(query.q || query.status)} noun="released risk assessments" onClearFilters={() => resetPage({ q: '', status: undefined })} />, error: <ErrorState noun="released risk assessments" retry={() => router.refresh()} />, permission: <PermissionDeniedState area="released risk assessments" /> }} totalCount={resolvedPagination.total} />
    </div>
  );
}

function AssessmentUnavailableNotice({ state, operation }: { state: Exclude<ReleasedAssessmentDetailState, 'populated'>; operation?: string }) {
  const permission = state === 'permission';
  const error = state === 'error' || state === 'contract-mismatch';
  const title = permission
    ? 'You don’t have permission to view this risk assessment'
    : error
      ? 'We couldn’t load this risk assessment'
      : 'This released risk assessment is unavailable';
  const description = permission
    ? 'You can open released assessments for your own requests. Yours are listed in My Risk Assessments.'
    : error
      ? 'Try again. If the problem continues, contact your administrator.'
      : 'Only complete assessments released for your own requests can be displayed.';

  return (
    <>
      <PageHeader description="Released assessment details cannot be displayed." title="Risk assessment unavailable" />
      <div className="rounded-lg border border-border bg-card p-6 text-center" role="alert">
        <ShieldAlert aria-hidden="true" className="mx-auto mb-3 text-destructive" />
        <h2 className="text-heading-md text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {state === 'contract-mismatch' && operation ? <p className="mt-2 text-sm text-muted-foreground">Response contract mismatch: {operation}</p> : null}
        <Link className={`${buttonVariants({ variant: 'outline' })} mt-4`} href="/app/assessments">Back to released assessments</Link>
      </div>
    </>
  );
}

function ControlImplementationView({ implementation }: { implementation: ControlImplementation }) {
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Definition label="Control" value={implementation.controlSummary ? controlLabel(implementation.controlSummary) : 'Not recorded'} />
        <Definition label="Control owner" value={implementation.controlOwner?.displayName ?? 'Not recorded'} />
        <Definition label="Status" value={implementation.controlStatus ?? 'Not recorded'} />
        <Definition label="Effectiveness" value={implementation.effectivenessRating ?? 'Not recorded'} />
        <Definition label="Implementation due" value={formatDate(implementation.implementationDueDate)} />
        <Definition label="Implemented" value={formatDate(implementation.implementedDate)} />
        <Definition label="Review date" value={formatDate(implementation.reviewDate)} />
        <div className="grid gap-1 sm:col-span-2 lg:col-span-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</dt><dd className="whitespace-pre-wrap text-sm text-foreground">{displayText(implementation.evidence)}</dd></div>
      </dl>
    </li>
  );
}

function ReleasedRisk({ controls, risk }: { controls: readonly ControlImplementation[]; risk: Risk }) {
  return (
    <Card role="listitem">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{risk.riskNumber}</CardTitle><CheckCircle2 aria-label="Released risk" className="text-success" /></div>
        <p className="whitespace-pre-wrap text-sm text-foreground">{displayText(risk.riskStatement)}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Definition label="Inherent risk rating" value={risk.inherentRating ? <RiskRatingBadge rating={risk.inherentRating} /> : 'Not recorded'} />
          <Definition label="Residual risk rating" value={risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : 'Not recorded'} />
        </dl>
        <section aria-labelledby={`${risk.documentId}-controls`} className="space-y-3">
          <h3 className="text-heading-sm text-foreground" id={`${risk.documentId}-controls`}>
            Mitigation control implementations
          </h3>
          {controls.length > 0
            ? <ul className="space-y-3">{controls.map((implementation) => <ControlImplementationView implementation={implementation} key={implementation.documentId} />)}</ul>
            : <p className="text-sm text-muted-foreground">No mitigation control implementations are recorded.</p>}
        </section>
      </CardContent>
    </Card>
  );
}

export function ReleasedAssessmentDetailView({
  assessment,
  controlsByRisk = {},
  diagnosticOperation,
  risks = [],
  state,
}: {
  assessment?: ReleasedAssessmentDetailForActor;
  controlsByRisk?: ControlsByRisk;
  risks?: readonly Risk[];
  state: ReleasedAssessmentDetailState;
  diagnosticOperation?: string;
}) {
  if (state !== 'populated' || !assessment) return <AssessmentUnavailableNotice operation={diagnosticOperation} state={state === 'populated' ? 'empty' : state} />;

  return (
    <article aria-label={`Released risk assessment ${assessment.assessmentNumber}`} className="space-y-8">
      <PageHeader
        status={<StatusBadge family="assessment" value={assessment.assessmentStatus} />}
        description={assessment.assessmentNumber}
        title="Released risk assessment"
      />
      <AssessmentRequestLink actor={assessment.actor} request={assessment.assessmentRequest} />
      <AssessmentLifecycleStepper status={assessment.assessmentStatus} />
      <section className="space-y-4" aria-labelledby="assessment-overview">
        <h2 className="text-heading-md text-foreground" id="assessment-overview">Assessment overview</h2>
        <Card><CardContent className="pt-6"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1 sm:col-span-2 lg:col-span-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</dt><dd className="whitespace-pre-wrap text-sm text-foreground">{displayText(assessment.summary)}</dd></div>
          <Definition label="Assessment status" value={statusLabel('assessment', assessment.assessmentStatus)} />
          <Definition label="Overall rating" value={assessment.overallRating ? <RiskRatingBadge rating={assessment.overallRating} /> : 'Not recorded'} />
          <Definition label="Overall control effectiveness" value={assessment.overallControlEffectiveness ?? 'Not recorded'} />
          <Definition label="Assessment date" value={formatDate(assessment.assessmentDate)} />
          <Definition label="Next review date" value={formatDate(assessment.nextReviewDate)} />
          <Definition label="Approval date" value={formatDate(assessment.approvalDate)} />
          <Definition label="Generated by" value={assessment.generatedBy?.displayName ?? 'Not recorded'} />
          <Definition label="Reviewed by" value={assessment.reviewedBy?.displayName ?? 'Not recorded'} />
          <Definition label="Approved by" value={assessment.approvedBy?.displayName ?? 'Not recorded'} />
          <div className="grid gap-1 sm:col-span-2 lg:col-span-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall risk rationale</dt><dd className="whitespace-pre-wrap text-sm text-foreground">{displayText(assessment.overallRiskRationale)}</dd></div>
          <div className="grid gap-1 sm:col-span-2 lg:col-span-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommendations</dt><dd className="whitespace-pre-wrap text-sm text-foreground">{displayText(assessment.recommendationsSummary)}</dd></div>
        </dl></CardContent></Card>
      </section>
      <section className="space-y-4" aria-labelledby="released-risks">
        <div>
          <h2 className="text-heading-md text-foreground" id="released-risks">Identified risks</h2>
          <p className="mt-1 text-sm text-muted-foreground">Authoritative risks and mitigation controls included in this released assessment.</p>
        </div>
        {risks.length > 0
          ? <div className="space-y-4" role="list">{risks.map((risk) => <ReleasedRisk controls={controlsByRisk[risk.documentId] ?? []} key={risk.documentId} risk={risk} />)}</div>
          : <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No released risks are available.</p>}
      </section>
    </article>
  );
}

export function ReleasedAssessmentDetailSkeleton() {
  return (
    <section aria-label="Loading released risk assessment" className="grid gap-6" role="status">
      <span className="sr-only">Loading released risk assessment…</span>
      <div className="grid gap-3"><Skeleton className="h-8 w-2/3 max-w-md" /><Skeleton className="h-4 w-48" /></div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </section>
  );
}
