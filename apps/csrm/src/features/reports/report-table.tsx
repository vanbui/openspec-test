'use client';

import { useRef } from 'react';

import { tableHeaderMicroClassName } from '@/components/csrm/data-table';
import {
  horizontalOverflowAttributes,
  horizontalScrollRegionFocusClassName,
  useHorizontalOverflow,
} from '@/components/csrm/horizontal-scroll-region';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/*
 * A client module because tableHeaderMicroClassName lives in the client DataTable module, and a
 * server component cannot read a plain value from a client module. Every prop is plain data.
 */

export type ReportTableRowData = { key: string; label: string; values: readonly number[] };

export type ReportTableProps = {
  /** Visually hidden caption that names the table; it repeats the section caption. */
  caption: string;
  /** Header of the first column, whose cells head each row. */
  rowHeader: string;
  /** Headers of the numeric columns, in order. */
  columns: readonly string[];
  rows: readonly ReportTableRowData[];
  /**
   * Puts the table in its own scroller for a matrix that can be wider than its section. While the
   * matrix overflows, the scroller is a focusable region with this name and the first column sticks
   * with its hairline (direction §4 DataTable horizontal scroll rule, X-1 and X-2).
   */
  scrollLabel?: string;
};

const countFormat = new Intl.NumberFormat('en-AU');

/*
 * Cell padding follows the section's own width: the first column sits flush with the section's
 * text and the last figure with its end, so the table aligns with the caption above it. Narrow
 * sections use the smaller 4px-scale step between columns, and headers wrap, so a report table
 * fits a phone-width section without scrolling. Rows are separated by hairlines drawn on the cells,
 * which keeps them attached to a sticky first column.
 */
const firstColumnClassName = 'pl-0 pr-2 @md:pr-4 text-left';
const numericColumnClassName = 'px-2 @md:px-4 text-right tabular-nums';
const lastNumericColumnClassName = 'pl-2 pr-0 @md:pl-4 text-right tabular-nums';
const stickyFirstColumnClassName = '@max-2xl:sticky @max-2xl:left-0 @max-2xl:z-10 @max-2xl:border-r @max-2xl:border-border bg-surface';

function numericClassName(index: number, count: number) {
  return index === count - 1 ? lastNumericColumnClassName : numericColumnClassName;
}

/**
 * A report's text equivalent (UI-SPEC §4.3): a static table with a hidden caption, `th scope="col"`
 * micro-label headers, `th scope="row"` categories and right-aligned tabular figures. Rows are
 * static, so they have no hover.
 */
export function ReportTable({ caption, columns, rowHeader, rows, scrollLabel }: ReportTableProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Without a scrollLabel there is no scroller, and the hook reports a table that fits.
  const overflow = useHorizontalOverflow(scrollerRef, [scrollLabel]);
  const sticky = Boolean(scrollLabel) && overflow.overflowing;

  const table = (
    <Table className="border-separate border-spacing-0 text-[length:var(--text-table-size)]" data-slot="report-table">
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead
            className={cn('h-10 whitespace-normal border-b border-border py-2 align-bottom', tableHeaderMicroClassName, firstColumnClassName, sticky && stickyFirstColumnClassName)}
            scope="col"
          >
            {rowHeader}
          </TableHead>
          {columns.map((header, index) => (
            <TableHead
              className={cn('h-10 whitespace-normal border-b border-border py-2 align-bottom', tableHeaderMicroClassName, numericClassName(index, columns.length))}
              key={header}
              scope="col"
            >
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow className="group hover:bg-transparent" key={row.key}>
            <TableHead
              className={cn(
                'h-11 whitespace-normal wrap-anywhere border-b border-border py-2 align-middle font-medium text-foreground group-last:border-b-0',
                firstColumnClassName,
                sticky && stickyFirstColumnClassName,
              )}
              scope="row"
            >
              {row.label}
            </TableHead>
            {row.values.map((value, index) => (
              <TableCell
                className={cn('h-11 border-b border-border py-2 text-foreground group-last:border-b-0', numericClassName(index, row.values.length))}
                // Figures sit in fixed column positions, so the index is the column's identity.
                key={index}
              >
                {countFormat.format(value)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!scrollLabel) return table;

  // scrollLabel is already the region's whole name ("{caption}, scrolls horizontally").
  const region = overflow.overflowing ? ({ role: 'region', 'aria-label': scrollLabel, tabIndex: 0 } as const) : {};

  return (
    <div
      ref={scrollerRef}
      {...region}
      {...horizontalOverflowAttributes(overflow)}
      // A one-cell grid, so the end-edge scroll cue can share the table's cell (globals.css).
      className={cn('grid overflow-x-auto [&>[data-slot=table-container]]:overflow-visible', overflow.overflowing && horizontalScrollRegionFocusClassName)}
      data-slot="report-table-scroll"
    >
      {table}
    </div>
  );
}
