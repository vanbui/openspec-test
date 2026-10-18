/*
 * The export dialog's words and states (Phase 19 X-30; 19-UI-SPEC §2.2 to §2.5), kept out of JSX. Plain TypeScript with
 * no directive and no zod, so the dialog's client component reads it without the validation library.
 */

/** The most rows one export holds (D-17): Strapi's `EXPORT_ROW_CAP` (run-export.ts), checked equal by the dialog's test. */
export const EXPORT_ROW_LIMIT = 10_000;

const counts = new Intl.NumberFormat('en-AU');

/** A count in `en-AU` digits with grouping (`10,001`). */
export function formatExportCount(count: number): string {
  return counts.format(count);
}

/** The view's record noun for a count: `risks`, or `risk` for one (every noun of the vocabulary is a plain plural). */
export function exportRecordNoun(records: string, count: number): string {
  return count === 1 ? records.replace(/s$/, '') : records;
}

/** `{n} {row|rows}.`, the success toast's body (§7). */
export function exportRowCount(count: number): string {
  return `${formatExportCount(count)} ${count === 1 ? 'row' : 'rows'}.`;
}

export type ExportScope = {
  readonly total: number;
  /** The view's record noun in running text, plural (export vocabulary `records`). */
  readonly records: string;
  readonly searchActive: boolean;
  readonly filtersActive: boolean;
  readonly multiplePages: boolean;
};

/** §2.2: what the file will hold, and that every page is included when the list has more than one. */
export function exportScopeSentence({ filtersActive, multiplePages, records, searchActive, total }: ExportScope): string {
  const count = formatExportCount(total);
  const noun = exportRecordNoun(records, total);
  const order = multiplePages ? 'in the current order: every page, not just this one.' : 'in the current order.';
  if (searchActive || filtersActive) return `${count} ${noun} that ${total === 1 ? 'matches' : 'match'} the current search and filters, ${order}`;
  return `All ${count} ${noun}, ${order}`;
}

/** §2.2: a report's scope: its title, its as-at date as the page shows it, the throughput period, and its tables. */
export function exportReportScopeSentence({ asAt, period, tables, title }: { title: string; asAt: string; period?: string; tables: number }): string {
  return `The ${title} report as at ${asAt}${period ? `, for ${period}` : ''}, with its ${formatExportCount(tables)} ${tables === 1 ? 'table' : 'tables'}.`;
}

export type ExportFilterChipLine = { readonly label: string; readonly value: string };

/** §2.2: the active search and filters, each on its own line, with the filter chips' own labels. */
export function exportFilterLines({ chips, search }: { search?: string; chips: readonly ExportFilterChipLine[] }): string[] {
  return [
    ...(search ? [`Search: “${search}”`] : []),
    ...(chips.length > 0 ? [`Filters: ${chips.map((chip) => `${chip.label}: ${chip.value}`).join(' · ')}`] : []),
  ];
}

export type ExportDialogState = 'ready' | 'empty-filtered' | 'empty' | 'over-limit' | 'no-columns';

/**
 * §2.5: the state before the request. An empty list and one over the limit say why before anything is sent; with no
 * column checked the column choice says so. Any state but `ready` disables `Export file`.
 */
export function exportDialogState({ checkedColumns, filtered, total }: { total: number; checkedColumns: number; filtered: boolean }): ExportDialogState {
  if (total === 0) return filtered ? 'empty-filtered' : 'empty';
  if (total > EXPORT_ROW_LIMIT) return 'over-limit';
  if (checkedColumns === 0) return 'no-columns';
  return 'ready';
}

/** §2.5: the empty lines. */
export function exportEmptyLine(state: 'empty-filtered' | 'empty', records: string): string {
  return state === 'empty-filtered' ? 'Nothing matches the current search and filters, so there’s nothing to export.' : `There are no ${records} to export yet.`;
}

/** §2.5: the over-the-limit alert's body. */
export function exportOverLimitBody(total: number, records: string): string {
  return `${formatExportCount(total)} ${exportRecordNoun(records, total)} match, and one export holds at most ${formatExportCount(EXPORT_ROW_LIMIT)} rows. Narrow the search or filters, then export again.`;
}

export type ExportFormat = 'xlsx' | 'csv';

/** §2.3: the hint for the checked format. */
export function exportFormatHint(format: ExportFormat, tables: number): string {
  if (format === 'csv') return 'Plain text for any tool. Excel may remove leading zeros (0042) and change date-like text when it opens a CSV.';
  return tables > 1
    ? 'Each table is its own sheet, followed by an “About this export” sheet.'
    : 'Opens in Excel with numbers, dates and leading zeros kept. Includes an “About this export” sheet.';
}

/** Where the last format chosen is remembered, per browser (§2.3; columns are never remembered, UI-D6). */
export const EXPORT_FORMAT_STORAGE_KEY = 'csrm.export.format';

/** The remembered format, or XLSX when there is none or browser storage cannot be read. */
export function readRememberedExportFormat(): ExportFormat {
  try {
    return window.localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY) === 'csv' ? 'csv' : 'xlsx';
  } catch {
    return 'xlsx';
  }
}

/** Remembers the format chosen; a storage failure is ignored, so the next opening falls back to XLSX. */
export function rememberExportFormat(format: ExportFormat): void {
  try {
    window.localStorage.setItem(EXPORT_FORMAT_STORAGE_KEY, format);
  } catch {
    // Storage is unavailable (private mode, a quota or a policy): nothing is remembered.
  }
}
