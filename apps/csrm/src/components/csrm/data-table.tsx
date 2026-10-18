'use client';

import {
  columnFilteringFeature,
  createColumnHelper,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Rows3, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  horizontalOverflowAttributes,
  horizontalScrollRegionFocusClassName,
  horizontalScrollRegionProps,
  useHorizontalOverflow,
} from '@/components/csrm/horizontal-scroll-region';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
});

export type DataTableDensity = 'default' | 'compact';
export type DataTableState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';
export type DataTableNumericKind = 'magnitude' | 'identity';

export const tableHeaderMicroClassName =
  'font-mono text-[length:var(--text-micro-size)] font-normal uppercase tracking-[var(--tracking-micro)] text-muted-foreground';

const sortableHeaderTextTransformClassName = 'uppercase';

export type DataTableColumn<TData extends object> = {
  id?: string;
  accessorKey: keyof TData & string;
  header: string;
  cell?: (value: unknown, row: TData) => ReactNode;
  enableSorting?: boolean;
  numeric?: DataTableNumericKind;
  /**
   * A long-text column (direction §4 DataTable, X-3): its cells wrap within 14rem to 28rem instead
   * of forcing the table wide; the cell content clamps itself to two lines. The header is unchanged.
   */
  wrap?: boolean;
  /**
   * The header is for assistive technology only (an actions column, 14-UI-SPEC §3.2): the table keeps its header cell,
   * so every column is named (1.3.1), and shows nothing in it.
   */
  headerHidden?: boolean;
};

/** X-3 bounds as mapped utilities: `min-w-56` is 14rem and `max-w-md` is 28rem. */
const wrapColumnClassName = 'whitespace-normal min-w-56 max-w-md';

/**
 * Container widths from which a list's table is chosen over its cards (`tableFrom`). Each names the width its table
 * needs, so the classes below are written out in full for Tailwind to find.
 */
export type DataTableContainerWidth = '54rem' | '60rem' | '65rem' | '70rem';

/** Which elements show where: the cards, the table's scroller, the density toggle and the two loading layouts. */
type LayoutClasses = { cards: string; table: string; toggle: string; loadingCards: string; loadingTable: string };

/* Every list by default: the cards below 768px, the table from 768px (X-21), and the toggle only with the table (O5). */
const viewportLayout: LayoutClasses = {
  cards: 'md:hidden', table: 'hidden md:grid', toggle: 'max-md:hidden', loadingCards: 'md:hidden', loadingTable: 'hidden md:block',
};

/* The cards at every width, for a table that measured wider than its container. */
const cardsLayout: LayoutClasses = { cards: '', table: 'hidden', toggle: 'hidden', loadingCards: '', loadingTable: 'hidden' };

/* By the list's own width (its section is the `@container`): the table from the width it needs, the cards below it. */
const containerLayouts: Readonly<Record<DataTableContainerWidth, LayoutClasses>> = {
  '54rem': { cards: '@min-[54rem]:hidden', table: 'hidden @min-[54rem]:grid', toggle: '@max-[54rem]:hidden', loadingCards: '@min-[54rem]:hidden', loadingTable: 'hidden @min-[54rem]:block' },
  '60rem': { cards: '@min-[60rem]:hidden', table: 'hidden @min-[60rem]:grid', toggle: '@max-[60rem]:hidden', loadingCards: '@min-[60rem]:hidden', loadingTable: 'hidden @min-[60rem]:block' },
  '65rem': { cards: '@min-[65rem]:hidden', table: 'hidden @min-[65rem]:grid', toggle: '@max-[65rem]:hidden', loadingCards: '@min-[65rem]:hidden', loadingTable: 'hidden @min-[65rem]:block' },
  '70rem': { cards: '@min-[70rem]:hidden', table: 'hidden @min-[70rem]:grid', toggle: '@max-[70rem]:hidden', loadingCards: '@min-[70rem]:hidden', loadingTable: 'hidden @min-[70rem]:block' },
};

function layoutClasses(tableFrom: DataTableContainerWidth | 'never' | undefined): LayoutClasses {
  if (tableFrom === undefined) return viewportLayout;
  return tableFrom === 'never' ? cardsLayout : containerLayouts[tableFrom];
}

/**
 * What a list's row hook may set on a row's `tr` (14-UI-REVIEW UI-04): its classes, and `data-pending` while the row's
 * change waits for the server, so the whole row can read as pending.
 */
export type DataTableRowProps = {
  className?: string;
  'data-pending'?: true | undefined;
};

export type DataTableFilter = {
  id: string;
  label: string;
  value: string;
};

export type DataTableProps<TData extends object> = {
  ariaLabel: string;
  columns: DataTableColumn<TData>[];
  data: TData[];
  densityUserId: string;
  filters?: DataTableFilter[];
  getRowId: (row: TData) => string;
  /**
   * An opt-in row hook (14-UI-REVIEW UI-04): classes and `data-pending` for a row's `tr`, so a list can show a whole row as
   * pending where its cells alone would leave part of it looking settled. Absent by default, so a table that does not
   * ask renders every row exactly as before.
   */
  getRowProps?: (row: TData) => DataTableRowProps;
  /**
   * False for a list that is never paged (a request's files, at most 20 active ones; 14-UI-SPEC §3.2): no pager and no
   * results count, because the section around it counts it. The density toggle stays. Defaults to true.
   */
  paginated?: boolean;
  onClearFilter?: (id: string) => void;
  onClearFilters?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
  page: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  renderMobileCard: (row: TData) => ReactNode;
  /**
   * Which width chooses between the cards and the table. By default the viewport's: the cards below 768px and the table
   * from 768px, as every list. A list whose table needs more room than its column may give (a request's files; the Phase
   * 14 pilot's walk, D2; 14-UI-SPEC §3.2) names the width its table needs: its own width then chooses, the table from that
   * width and the cards below it. `never` shows the cards at every width, for a table that measured wider than its list.
   */
  tableFrom?: DataTableContainerWidth | 'never';
  sorting?: SortingState;
  state: DataTableState;
  loadingLabel: string;
  stateSlots: {
    empty: ReactNode;
    error: ReactNode;
    permission: ReactNode;
  };
  totalCount: number;
};

function densityStorageKey(userId: string) {
  return `csrm:data-table-density:${userId}`;
}

function readDensity(userId: string): DataTableDensity {
  if (typeof window === 'undefined') return 'default';
  return window.localStorage.getItem(densityStorageKey(userId)) === 'compact' ? 'compact' : 'default';
}

function columnClasses(numeric: DataTableNumericKind | undefined) {
  if (numeric === 'magnitude') return 'text-right tabular-nums';
  if (numeric === 'identity') return 'text-left tabular-nums';
  return 'text-left';
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ChevronUp aria-hidden="true" />;
  if (direction === 'desc') return <ChevronDown aria-hidden="true" />;
  // The unsorted cue is interaction-only, so it does not print; a direction cue states the printed order (X-4).
  return <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" data-print="hidden" />;
}

function TableLoading<TData extends object>({ columns, density, label, layout, pageSize }: {
  columns: DataTableColumn<TData>[];
  density: DataTableDensity;
  label: string;
  layout: LayoutClasses;
  pageSize: number;
}) {
  const rowClass = density === 'compact' ? 'h-9' : 'h-11';

  return (
    <div role="status" aria-label={label} aria-live="polite">
      <span className="sr-only">{label}</span>
      <div data-slot="data-table-loading-mobile" className={cn('space-y-2', layout.loadingCards)}>
        {Array.from({ length: pageSize }, (_, rowIndex) => (
          <div key={rowIndex} className={cn('space-y-2 rounded-lg border border-border bg-surface p-3', rowClass)}>
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
      <div data-slot="data-table-loading-desktop" className={cn('overflow-hidden rounded-lg border border-border bg-surface [&>[data-slot=table-container]]:overflow-visible', layout.loadingTable)}>
        <Table aria-label={`${label} layout`} className="text-[length:var(--text-table-size)]">
          <TableHeader className="border-b border-border bg-surface/95">
            <TableRow className="hover:bg-transparent">
              {columns.map((column, columnIndex) => (
                <TableHead key={`${column.id ?? column.accessorKey}-${columnIndex}`} className={cn('h-10 px-4', tableHeaderMicroClassName)}>
                  {column.headerHidden ? <span className="sr-only">{column.header}</span> : column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: pageSize }, (_, rowIndex) => (
              <TableRow key={rowIndex} data-testid="data-table-skeleton-row" className={rowClass}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={`${column.id ?? column.accessorKey}-${columnIndex}`} className="px-4 py-0">
                    <Skeleton className="h-3 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function DataTable<TData extends object>({
  ariaLabel,
  columns,
  data,
  densityUserId,
  filters = [],
  getRowId,
  getRowProps,
  paginated = true,
  onClearFilter,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  renderMobileCard,
  sorting = [],
  state,
  tableFrom,
  loadingLabel,
  stateSlots,
  totalCount,
}: DataTableProps<TData>) {
  const [density, setDensity] = useState<DataTableDensity>('default');
  // The desktop scroller mounts only in the populated state; the observer on its table follows
  // every change of rows, columns or density from there.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overflow = useHorizontalOverflow(scrollerRef, [state]);
  const sticky = overflow.overflowing;

  useEffect(() => {
    setDensity(readDensity(densityUserId));
  }, [densityUserId]);

  // Sorting is a caller capability; it must stay in the memo key so a handler supplied after
  // the first render enables sorting rather than being ignored.
  const sortable = Boolean(onSortingChange);
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof dataTableFeatures, TData>();
    const usedIds = new Set<string>();

    return helper.columns(
      columns.map((column, index) => {
        const baseId = column.id ?? column.accessorKey;
        const id = usedIds.has(baseId) ? `${baseId}-${index}` : baseId;
        usedIds.add(baseId);

        return helper.accessor((row) => row[column.accessorKey], {
          id,
          header: column.header,
          enableSorting: sortable && Boolean(column.enableSorting),
          cell: (context) => {
            const value = context.getValue();
            return column.cell ? column.cell(value, context.row.original) : String(value ?? '');
          },
        });
      }),
    );
  }, [columns, sortable]);

  const pagination = useMemo(() => ({ pageIndex: Math.max(0, page - 1), pageSize }), [page, pageSize]);
  const columnFilters = useMemo(
    () => filters.map((filter) => ({ id: filter.id, value: filter.value })),
    [filters],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns: tableColumns,
    data,
    getRowId,
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: totalCount,
    state: { sorting, pagination, columnFilters },
    onSortingChange: onSortingChange
      ? (updater) => onSortingChange(functionalUpdate(updater, sorting))
      : undefined,
  });

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const rowClass = density === 'compact' ? 'h-9' : 'h-11';
  const toggleDensity = () => {
    const nextDensity = density === 'default' ? 'compact' : 'default';
    window.localStorage.setItem(densityStorageKey(densityUserId), nextDensity);
    setDensity(nextDensity);
  };

  const layout = layoutClasses(tableFrom);
  const stateContent =
    state === 'loading' ? (
      <TableLoading columns={columns} density={density} label={loadingLabel} layout={layout} pageSize={pageSize} />
    ) : state === 'empty' ? (
      stateSlots.empty
    ) : state === 'error' ? (
      stateSlots.error
    ) : state === 'permission' ? (
      stateSlots.permission
    ) : null;

  return (
    <section className={cn('space-y-3', tableFrom !== undefined && tableFrom !== 'never' && '@container')} aria-label={`${ariaLabel} controls`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <span key={filter.id} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-muted px-2 text-xs text-foreground">
              {filter.label}: {filter.value}
              {onClearFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${filter.label} filter`}
                  data-print="hidden"
                  onClick={() => onClearFilter(filter.id)}
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </span>
          ))}
          {filters.length > 0 && onClearFilters ? (
            <Button type="button" variant="link" size="sm" data-print="hidden" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
        {/* The chip labels and the counts print; the controls around them do not (X-4). */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {state === 'loading' || !paginated ? null : <output className="tabular-nums">{new Intl.NumberFormat('en-AU').format(totalCount)} {totalCount === 1 ? 'result' : 'results'}</output>}
          <Button type="button" variant="outline" size="sm" className={layout.toggle} data-print="hidden" onClick={toggleDensity}>
            <Rows3 aria-hidden="true" />
            {density === 'default' ? 'Use compact density' : 'Use default density'}
          </Button>
        </div>
      </div>

      {stateContent ? (
        // The state primitives draw their own frame; wrapping them again nests two boxes.
        <div data-slot="data-table-state">{stateContent}</div>
      ) : (
        <>
          {/* Cards are a list of records, so assistive technology announces the count. */}
          <div data-slot="data-table-mobile" role="list" aria-label={ariaLabel} className={cn('space-y-2', layout.cards)}>
            {table.getRowModel().rows.map((row) => (
              <div key={row.id} role="listitem" className="rounded-lg border border-border bg-surface p-3">
                {renderMobileCard(row.original)}
              </div>
            ))}
          </div>

          <div
            ref={scrollerRef}
            data-slot="data-table-desktop"
            {...horizontalScrollRegionProps(ariaLabel, overflow.overflowing)}
            {...horizontalOverflowAttributes(overflow)}
            className={cn(
              // The table primitive wraps every table in its own overflow container. Inside
              // DataTable that inner box must not scroll: this scroller is the region while the
              // table overflows, so it is the one keyboard users focus and the one sticky cells
              // anchor to. It is a one-cell grid so the end-edge scroll cue can share the table's
              // cell (globals.css).
              'scroll-pt-10 overflow-auto rounded-lg border border-border bg-surface [&>[data-slot=table-container]]:overflow-visible',
              layout.table,
              overflow.overflowing && horizontalScrollRegionFocusClassName,
            )}
          >
            {/*
              * Separated borders: each cell draws its own rules, as the report cross-tab's do. The pinned
              * identifier column's end hairline then moves with the column while the table scrolls; a
              * collapsed border belongs to the table's grid line and slid under the pinned column (W-2).
              */}
            <Table aria-label={ariaLabel} className="border-separate border-spacing-0 text-[length:var(--text-table-size)]">
              <TableHeader
                aria-label="Table header"
                className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm"
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header, index) => {
                      const sourceColumn = columns[index];
                      const sorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                          className={cn(
                            'h-10 scroll-mt-10 border-b border-border px-4',
                            tableHeaderMicroClassName,
                            columnClasses(sourceColumn?.numeric),
                            // The identifier column and its hairline exist only while the table scrolls.
                            sticky && index === 0 && 'sticky left-0 z-20 border-r border-border bg-surface',
                          )}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              className={cn(
                                'inline-flex min-h-6 min-w-6 items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                sortableHeaderTextTransformClassName,
                                sourceColumn?.numeric === 'magnitude' && 'ml-auto',
                              )}
                              aria-label={`Sort by ${sourceColumn?.header ?? header.id}`}
                              onClick={() => header.column.toggleSorting(sorted === 'asc')}
                            >
                              <span>{sourceColumn?.header}</span>
                              <SortIndicator direction={sorted} />
                            </button>
                          ) : (
                            <span className={cn(sourceColumn?.headerHidden && 'sr-only')}>{sourceColumn?.header}</span>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody aria-label="Table body">
                {table.getRowModel().rows.map((row) => {
                  const rowProps = getRowProps?.(row.original);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'scroll-mt-10 transition-colors duration-80 ease-standard hover:bg-surface-hover [&_button]:min-h-6 [&_button]:min-w-6',
                        'group',
                        rowClass,
                        rowProps?.className,
                      )}
                      {...(rowProps?.['data-pending'] ? { 'data-pending': true } : {})}
                    >
                      {row.getAllCells().map((cell, index) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'border-b border-border px-4 py-0 text-[length:var(--text-table-size)] group-last:border-b-0',
                            columnClasses(columns[index]?.numeric),
                            columns[index]?.wrap && wrapColumnClassName,
                            sticky
                              && index === 0
                              && // The hover tint is an alpha colour, so it is layered over the opaque
                              // surface rather than replacing it; otherwise scrolled cells show through.
                              'sticky left-0 z-10 border-r border-border bg-surface group-hover:bg-[image:linear-gradient(var(--surface-hover),var(--surface-hover))] group-data-[state=selected]:bg-surface-selected',
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {paginated ? <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2" data-print="hidden">
            Rows per page
            <select
              aria-label="Rows per page"
              className="h-8 rounded-md border border-input bg-surface px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        ) : <span />}
        <div className="flex items-center gap-2">
          {state === 'loading' ? null : <output className="tabular-nums">Page {page} of {pageCount}</output>}
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Previous page"
            data-print="hidden"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Next page"
            data-print="hidden"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div> : null}
    </section>
  );
}
