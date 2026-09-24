'use client';

import { CheckCircle2, Clock3, type LucideIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo } from 'react';

import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/csrm/data-table';
import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { availableAssessmentRequest } from './questionnaire-domain';
import type { QuestionnaireListQuery, QuestionnairePagination, QuestionnaireSummary, QuestionnaireSort } from './questionnaire-service';

export type QuestionnaireReviewListState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';

export interface QuestionnaireReviewListProps {
  questionnaires: readonly QuestionnaireSummary[];
  pagination?: QuestionnairePagination;
  query?: QuestionnaireListQuery;
  state?: QuestionnaireReviewListState;
}

type ReviewStatePresentation = {
  className: string;
  icon: LucideIcon;
  label: string;
};

const reviewStatePresentations = {
  awaiting: { className: 'border-warning-border bg-warning-subtle text-warning', icon: Clock3, label: 'Awaiting submission' },
  submitted: { className: 'border-success-border bg-success-subtle text-success', icon: CheckCircle2, label: 'Ready for review' },
} satisfies Record<'awaiting' | 'submitted', ReviewStatePresentation>;

function reviewHref(documentId: string): string {
  return `/app/review/questionnaires/${encodeURIComponent(documentId)}`;
}

function sortingFor(sort: QuestionnaireSort) {
  const [id, direction] = sort.split(':') as [string, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

function sortFor(sorting: { id: string; desc: boolean }[]): QuestionnaireSort {
  const first = sorting[0];
  const candidate = `${first?.id ?? 'updatedAt'}:${first?.desc === false ? 'asc' : 'desc'}`;
  const allowed: readonly string[] = ['updatedAt:desc', 'updatedAt:asc', 'questionnaireNumber:asc', 'questionnaireNumber:desc', 'title:asc', 'title:desc'];
  return allowed.includes(candidate) ? candidate as QuestionnaireSort : 'updatedAt:desc';
}

const columns: DataTableColumn<QuestionnaireSummary>[] = [
  {
    accessorKey: 'questionnaireNumber',
    header: 'Questionnaire ID',
    enableSorting: true,
    numeric: 'identity',
    cell: (_value, questionnaire) => <RecordLink href={reviewHref(questionnaire.documentId)}>{questionnaire.questionnaireNumber}</RecordLink>,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    enableSorting: true,
    cell: (_value, questionnaire) => <RecordLink href={reviewHref(questionnaire.documentId)}>{questionnaire.title}</RecordLink>,
  },
  {
    accessorKey: 'assessmentRequest',
    header: 'Assessment request',
    cell: (_value, questionnaire) => {
      const request = availableAssessmentRequest(questionnaire.assessmentRequest);
      return request ? <><span>{request.title}</span><span className="block text-xs tabular-nums text-muted-foreground">{request.requestNumber}</span></> : 'No linked assessment request';
    },
  },
  {
    accessorKey: 'state',
    header: 'Status',
    cell: (_value, questionnaire) => {
      const presentation = reviewStatePresentations[questionnaire.state === 'submitted' ? 'submitted' : 'awaiting'];
      const Icon = presentation.icon;
      return <Badge className={presentation.className} variant="outline"><Icon aria-hidden="true" />{presentation.label}</Badge>;
    },
  },
];

export function QuestionnaireReviewList({ pagination, questionnaires, query, state }: QuestionnaireReviewListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedQuery = query ?? { page: 1, pageSize: 25, sort: 'updatedAt:desc' as const };
  const resolvedPagination = pagination ?? { page: resolvedQuery.page, pageSize: resolvedQuery.pageSize, pageCount: questionnaires.length ? 1 : 0, total: questionnaires.length };
  const outOfRange = resolvedPagination.total > 0 && resolvedQuery.page > Math.max(1, resolvedPagination.pageCount);
  const navigate = (next: QuestionnaireListQuery) => {
    const params = new URLSearchParams();
    const view = searchParams.get('view');
    if (view) params.set('view', view);
    if (next.q) params.set('q', next.q);
    if (next.status) params.set('status', next.status);
    params.set('sort', next.sort);
    if (next.page > 1) params.set('page', String(next.page));
    params.set('pageSize', String(next.pageSize));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => {
    if (outOfRange) navigate({ ...resolvedQuery, page: Math.max(1, resolvedPagination.pageCount) });
  }, [outOfRange, resolvedPagination.pageCount, resolvedQuery]);
  const resetPage = (changes: Partial<QuestionnaireListQuery>) => navigate({ ...resolvedQuery, ...changes, page: 1 });
  const clearFilters = () => resetPage({ q: '', status: undefined });
  const filters = useMemo<DataTableFilter[]>(() => [
    ...(resolvedQuery.q ? [{ id: 'q', label: 'Search', value: resolvedQuery.q }] : []),
    ...(resolvedQuery.status ? [{ id: 'status', label: 'Status', value: resolvedQuery.status }] : []),
  ], [resolvedQuery.q, resolvedQuery.status]);
  const resolvedState = outOfRange ? 'loading' : state ?? (questionnaires.length ? 'populated' : 'empty');
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get('q');
    resetPage({ q: typeof q === 'string' ? q.trim() : '' });
  };

  return (
    <div className="space-y-4">
      {query ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <form className="flex flex-1 gap-2" role="search" onSubmit={submitSearch}>
            <label className="flex-1 space-y-1 text-sm font-medium text-foreground">
              Search questionnaires
              <Input aria-label="Search questionnaires" defaultValue={resolvedQuery.q} disabled={resolvedState === 'loading'} key={resolvedQuery.q} name="q" type="search" />
            </label>
            <Button className="self-end" disabled={resolvedState === 'loading'} type="submit">Search</Button>
          </form>
          <label className="space-y-1 text-sm font-medium text-foreground">
            Status
            <select aria-label="Filter by status" className="block h-9 min-w-52 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={resolvedState === 'loading'} value={resolvedQuery.status ?? ''} onChange={(event) => resetPage({ status: event.target.value ? event.target.value as QuestionnaireListQuery['status'] : undefined })}>
              <option value="">All statuses</option>
              <option value="not-started">Not started</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
        </div>
      ) : null}
      <DataTable
        ariaLabel="Questionnaires for review"
        columns={columns}
        data={[...questionnaires]}
        densityUserId="questionnaire-review"
        filters={filters}
        getRowId={(questionnaire) => questionnaire.documentId}
        loadingLabel="Loading questionnaire reviews"
        onClearFilter={(id) => resetPage(id === 'q' ? { q: '' } : { status: undefined })}
        onClearFilters={clearFilters}
        onPageChange={(page) => navigate({ ...resolvedQuery, page })}
        onPageSizeChange={(pageSize) => resetPage({ pageSize: pageSize as QuestionnaireListQuery['pageSize'] })}
        onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })}
        page={resolvedPagination.page}
        pageSize={resolvedPagination.pageSize}
        renderMobileCard={(questionnaire) => {
          const presentation = reviewStatePresentations[questionnaire.state === 'submitted' ? 'submitted' : 'awaiting'];
          const Icon = presentation.icon;
          const request = availableAssessmentRequest(questionnaire.assessmentRequest);
          return <article className="space-y-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><RecordLink className="inline-flex min-h-6 items-center text-xs tabular-nums" href={reviewHref(questionnaire.documentId)}>{questionnaire.questionnaireNumber}</RecordLink><RecordLink className="block break-words" href={reviewHref(questionnaire.documentId)}>{questionnaire.title}</RecordLink></div><Badge className={presentation.className} variant="outline"><Icon aria-hidden="true" />{presentation.label}</Badge></div><div><p className="text-sm font-medium text-foreground">{request?.title ?? 'No linked assessment request'}</p>{request ? <p className="text-xs tabular-nums text-muted-foreground">{request.requestNumber}</p> : null}</div></article>;
        }}
        sorting={sortingFor(resolvedQuery.sort)}
        state={resolvedState}
        stateSlots={{
          empty: <EmptyState action={{ label: 'View assessment requests', href: '/app/review/requests' }} filtered={Boolean(resolvedQuery.q || resolvedQuery.status)} noun="questionnaires to review" onClearFilters={clearFilters} />,
          error: <ErrorState noun="questionnaire reviews" retry={() => router.refresh()} />,
          permission: <PermissionDeniedState area="questionnaire reviews" />,
        }}
        totalCount={resolvedPagination.total}
      />
    </div>
  );
}
