import type { DataTableFilter } from '@/components/csrm/data-table';
import { ExportButton } from '@/components/csrm/export/export-button';
import type { ExportActionResult } from '@/features/exports/export-actions';

/*
 * A list header's Export (Phase 19 X-30, 19-UI-SPEC §1; the pilot's export placement ruling of 2026-10-16), rendered by
 * the list's data component after its read: the dialog is told the read's own total and page count, so no second read
 * counts the rows, and the list's own chips, so it names the search and filters as the list does. The query is the
 * list's parsed query without its page and page size (an export is every page, D-13), with no unset value, because the
 * action parses it again. Rendering it is presentation only; Strapi refuses every export the viewer may not make (D-16).
 */

type ListExportButtonProps = {
  heading: string;
  view: string;
  action: (input: unknown) => Promise<ExportActionResult>;
  /** The list's parsed query. */
  query: object;
  pagination: { readonly pageCount: number; readonly total: number };
  /** The list's chips, the search's (`q`) included. */
  chips: readonly DataTableFilter[];
  /** The column keys the page shows, when they differ from the view's visible columns. */
  visibleColumns?: readonly string[];
  /** A line under the Columns legend: a reference list's import rule (§2.4, D-33). */
  columnsHint?: string;
};

/** The parsed query without its page, its page size and any unset value. */
function exportQuery(query: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(query).filter(([key, value]) => key !== 'page' && key !== 'pageSize' && value !== undefined));
}

export function ListExportButton({ action, chips, columnsHint, heading, pagination, query, view, visibleColumns }: ListExportButtonProps) {
  const search = chips.find((chip) => chip.id === 'q')?.value;
  return (
    <ExportButton
      action={action}
      chips={chips.filter((chip) => chip.id !== 'q').map(({ label, value }) => ({ label, value }))}
      heading={heading}
      multiplePages={pagination.pageCount > 1}
      query={exportQuery(query)}
      {...(search ? { search } : {})}
      searchActive={Boolean(search)}
      total={pagination.total}
      view={view}
      {...(visibleColumns ? { visibleColumns } : {})}
      {...(columnsHint ? { columnsHint } : {})}
    />
  );
}
