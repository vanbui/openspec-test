/*
 * 19-UI-SPEC §6, family S1: what a refused export tells the person in the export dialog, with the dialog's tone and
 * whether `Try again` is offered. Only the export dialog and the Export button (for a dialog whose code can't load,
 * FE4-12) import this module, so its sentences never ship on the request and risk detail pages, which render no Export
 * and whose first loads sit within a few hundred bytes of their budget (19-PLAN-CHECK lane C I5, as 15-10 placed family
 * Q and 16-11 family R); refusal-copy.ts never imports it, and it is not added there. Plain and
 * zod-free, with no directive and type-only imports, so Server Actions and client components can share it.
 *
 * A 403 is worded here, never with the server's message: Strapi's automation-identity, human-only and FunctionAPI
 * refusals all read `You don’t have access to export this list.` (19-PLAN-CHECK lane B W5). The 400 for an invalid
 * query, column or format carries no reason (D-17).
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';

export type ExportRefusalTone = 'warning' | 'danger';

/** S1's copy: the alert's sentence, and a title above it where S1 gives one. */
export type ExportRefusalCopy = { readonly tone: ExportRefusalTone; readonly title?: string; readonly message: string; readonly retry: boolean };

/** The kind of view an export comes from: a list, a report (a fixed-table view) or the released assessment. */
export type ExportViewKind = 'list' | 'report' | 'released-assessment';

export type ExportFailure = {
  readonly status?: number;
  readonly reason?: ConflictReason;
  readonly rowCount?: number;
  /** The view exported, which S1's 403 and 404 name (review amendment R1 part 3); a list when absent. */
  readonly view?: ExportViewKind;
  /** Beside EXPORT_CELL_TOO_LONG, the export vocabulary's label for the column whose cell is too long for Excel. */
  readonly columnLabel?: string;
};

/** R1 part 3: what a 403 says the person can't export, per view. */
const accessRefusal: Readonly<Record<ExportViewKind, string>> = {
  list: 'You don’t have access to export this list.',
  report: 'You don’t have access to export this report.',
  'released-assessment': 'You don’t have access to export this risk assessment.',
};

const rows = new Intl.NumberFormat('en-AU');

const warning = (message: string): ExportRefusalCopy => ({ tone: 'warning', message, retry: false });
const danger = (message: string): ExportRefusalCopy => ({ tone: 'danger', message, retry: false });

/** S1's last row: a network failure, a 5xx, or a response the file validator rejects. */
export const EXPORT_FAILED: ExportRefusalCopy = { tone: 'danger', message: 'We couldn’t create the file.', retry: true };

/*
 * The exports record's code review amendment (2026-10-17, 3b5c66fa), as approved: an xlsx cell over Excel's limit names
 * its column and the lossless route. A CSV holds the value whole; the released assessment's workbook has a summary that
 * no CSV holds, so it points to its two CSV tables and the print-ready report.
 */
function cellTooLong(columnLabel: string, view: ExportViewKind): ExportRefusalCopy {
  const route = view === 'released-assessment'
    ? 'Export the Risks or Mitigation controls table as CSV, or use the print-ready report for the whole record.'
    : 'Export as CSV instead, or shorten the text in CSRM.';
  return {
    tone: 'warning',
    title: 'A value is too long for Excel',
    message: `${columnLabel} holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. ${route}`,
    retry: false,
  };
}

/**
 * S1: a refused or failed export, from its status, served reason and, beside EXPORT_ROW_LIMIT, the rows the export
 * would hold. A row limit without its count (the transport dropped an unsafe value) is still the row limit, so it offers
 * no `Try again` the limit would refuse again, and says so without a count (FE4-07; review amendment R1 part 2).
 */
export function exportRefusal(failure: ExportFailure): ExportRefusalCopy {
  const { status, reason, rowCount, view = 'list', columnLabel } = failure;
  if (reason === 'EXPORT_CELL_TOO_LONG') return columnLabel ? cellTooLong(columnLabel, view) : EXPORT_FAILED;
  if (reason === 'EXPORT_ROW_LIMIT') {
    return rowCount === undefined
      ? warning('This export would hold more rows than the 10,000 limit. Narrow the search or filters, then export again.')
      : warning(`This export would hold ${rows.format(rowCount)} rows, more than the 10,000 limit. Narrow the search or filters, then export again.`);
  }
  if (reason === 'ASSESSMENT_NOT_RELEASED') {
    return warning('This risk assessment can be exported once it’s released. Refresh the page to see its current state.');
  }
  if (status === 400) return warning('The current search or filters can’t be exported. Clear the filters, then export again.');
  if (status === 403) return danger(accessRefusal[view]);
  // R1 part 3: only the released assessment is a record that can go missing; a list or report reads as the failed file.
  if (status === 404 && view === 'released-assessment') return danger('We couldn’t find this risk assessment. It may no longer be available to you.');
  return EXPORT_FAILED;
}
