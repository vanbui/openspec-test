import { importColumns } from '@/features/exports/export-vocabulary';

import { getAdministrationConfig, type AdministrationKind } from './administration-config';

/*
 * The import flow's rules and sentence parts (Phase 19 D-25 to D-32; 19-UI-SPEC §5.3 to §5.8), kept out of the flow's
 * JSX: the Guidance's columns and value rules, the preview's warnings and notes. A pure module with no directive, no zod
 * and no React, imported by the client flow (csv-import-flow.tsx) and proven through administration-workflow.test.tsx;
 * interface-copy-guard.test.ts guards it beside the flow, because it builds visible sentences. Copy is verbatim from
 * 19-UI-SPEC with typographic apostrophes and quotes.
 */

/** The column that matches a row to a stored record, as people name it (D-38): `Control number` for Controls, else `Name`. */
export function keyLabel(kind: AdministrationKind): string {
  const spec = importColumns(kind);
  return spec.columns.find((column) => column.field === spec.naturalKey)?.label ?? 'Name';
}

/** §5.3 paragraph 1: Phase 10's matching sentence, with the row that waits for a choice. */
export function guidanceSentence(kind: AdministrationKind): string {
  const config = getAdministrationConfig(kind);
  return `A row whose ${keyLabel(kind).toLocaleLowerCase('en-AU')} matches an existing ${config.runningLabel} updates it. Other valid rows create new ${config.runningPluralLabel}. A row whose name matches an existing one only by capitals or spacing waits for your choice. Unchanged, rejected and ambiguous rows are never written.`;
}

/** One row of the Guidance's column table (§5.3): the display label, the API name, whether it is required, its format. */
export type GuidanceColumn = { readonly field: string; readonly label: string; readonly required: string; readonly format: string };

/** The collection's import columns, in contract order, as the Guidance table shows them. */
export function guidanceColumns(kind: AdministrationKind): readonly GuidanceColumn[] {
  return importColumns(kind).columns.map((column) => ({
    field: column.field,
    label: column.label,
    required: column.required ? 'Required' : 'Optional',
    format: column.format,
  }));
}

/** §5.3: the `How values are read` list. */
export const VALUE_RULES: readonly string[] = [
  'Headers match whatever their capitals and spacing, by the column name or the name in the template.',
  'Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.',
  'A blank cell leaves an existing value unchanged. To empty an optional value, type #CLEAR.',
  'Columns that aren’t listed here are ignored, and you’ll see which.',
  'If you edit in Excel, use the Excel template or an Excel export: Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.',
];

/** §5.4: the file field's hint. */
export const IMPORT_FILE_HINT = 'A CSV (UTF-8) or Excel workbook (.xlsx), up to 5 MB and 5,000 rows.';

/** A written-out list: `A`, `A and B`, `A, B and C`. */
export function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** §5.5 item 1: the ignored-columns alert's body, the headers as typed, in file order. */
export function ignoredColumnsBody(kind: AdministrationKind, headers: readonly string[]): string {
  const quoted = headers.map((header) => `“${header}”`).join(', ');
  return `These columns aren’t part of the ${getAdministrationConfig(kind).runningLabel} import: ${quoted}. Their values won’t be imported.`;
}

/** The notes a preview may carry (csv-import-schema.ts `csvImportNotes`). */
export type ImportNote = 'issues-column' | 'read-only-columns' | 'example-row';

/** §5.5 item 2: one neutral line per note. */
export function noteLine(kind: AdministrationKind, note: ImportNote, readOnlyColumns: readonly string[]): string {
  if (note === 'issues-column') return 'The Issues column from an error report is ignored.';
  if (note === 'example-row') return 'Row 2 is the template’s example row, so it’s skipped.';
  const plural = getAdministrationConfig(kind).pluralLabel;
  const article = /^[aeiou]/i.test(plural) ? 'an' : 'a';
  return `Columns from ${article} ${plural} export that can’t be imported are ignored: ${listed(readOnlyColumns)}.`;
}

/*
 * Matched by similar name (D-30; X-32; 19-UI-SPEC §5.6). A similar row waits for the Security Analyst's own choice:
 * nothing is preselected, a bulk choice can be undone, and the gate refuses to continue while any row is undecided.
 * Decisions are keyed by row number.
 */
export type SimilarDecision = 'update' | 'skip';
export type ImportDecisions = Readonly<Record<number, SimilarDecision>>;

const rows = (count: number) => (count === 1 ? 'row' : 'rows');
const decisionLabel = (decision: SimilarDecision) => (decision === 'update' ? 'Update' : 'Skip');

/** The row numbers of the rows matched by similar name, in file order. */
export function similarRowNumbers(previewRows: readonly { rowNumber: number; state: string }[]): number[] {
  return previewRows.filter((row) => row.state === 'similar').map((row) => row.rowNumber);
}

/** How many similar rows are decided, how many are not, and the first undecided row. */
export function decisionProgress(similar: readonly number[], decisions: ImportDecisions) {
  const undecided = similar.filter((rowNumber) => decisions[rowNumber] === undefined);
  return { total: similar.length, decided: similar.length - undecided.length, undecided: undecided.length, firstUndecided: undecided[0] ?? null };
}

/** §5.6 the row's Details. */
export function similarDetails(kind: AdministrationKind, existingName: string): string {
  return `Similar to the existing ${getAdministrationConfig(kind).runningLabel} “${existingName}”.`;
}

/** §5.6 the row's two options and their hints. */
export function decisionOptions(existingName: string) {
  return [
    { value: 'update' as const, label: `Update “${existingName}”`, hint: 'Uses this row’s other values and keeps the existing name.' },
    { value: 'skip' as const, label: 'Skip this row', hint: `Leaves “${existingName}” as it is.` },
  ];
}

/** §5.6 the caption after the badge once a row is decided. */
export const yourChoice = (decision: SimilarDecision) => `Your choice: ${decisionLabel(decision)}`;

/** §5.6 the panel's title, body and count. */
export function similarPanelTitle(count: number): string {
  return `${count} ${count === 1 ? 'row matches' : 'rows match'} an existing name only by capitals or spacing`;
}
export function similarPanelBody(kind: AdministrationKind): string {
  const config = getAdministrationConfig(kind);
  return `Choose to update the existing ${config.runningLabel} or skip the row. No new ${config.runningPluralLabel} are created for these rows.`;
}
export const decidedCount = (decided: number, total: number) => `${decided} of ${total} decided`;

/** §5.6 the gate's line. */
export const gateLine = (undecided: number) => `Choose Update or Skip for ${undecided} more ${rows(undecided)}.`;

/** §5.6 a bulk choice: every similar row set to one decision, and whether it replaced a different individual choice. */
export function bulkDecision(similar: readonly number[], decisions: ImportDecisions, decision: SimilarDecision) {
  const next: Record<number, SimilarDecision> = { ...decisions };
  for (const rowNumber of similar) next[rowNumber] = decision;
  const replaced = similar.some((rowNumber) => decisions[rowNumber] !== undefined && decisions[rowNumber] !== decision);
  return { next, replaced };
}

/** §7 the bulk choice's Undo toast. */
export const bulkToast = (count: number, decision: SimilarDecision) => `Set ${count} rows to ${decisionLabel(decision)}`;

/** §5.6 the new-file guard (UI-D15). */
export const newFileGuard = (decided: number) => `Choosing another file clears your ${decided} ${decided === 1 ? 'choice' : 'choices'}.`;

/** The commit's `decisions` field: one JSON object of row number to decision, in row order (D-30). */
export function decisionsField(similar: readonly number[], decisions: ImportDecisions): string {
  return JSON.stringify(Object.fromEntries(similar.flatMap((rowNumber) => (decisions[rowNumber] ? [[String(rowNumber), decisions[rowNumber]]] : []))));
}

type PreviewSummary = Readonly<Record<'create' | 'update' | 'unchanged' | 'rejected' | 'ambiguous' | 'similar', number>>;

/** The rows the commit will write: creates, updates and the similar rows decided Update. */
export function writeCount(summary: PreviewSummary, similar: readonly number[], decisions: ImportDecisions): number {
  return summary.create + summary.update + similar.filter((rowNumber) => decisions[rowNumber] === 'update').length;
}

/**
 * §5.7 the Confirm summary, with zero parts omitted: `This import will create {c} and update {u} {plural}{, including {s}
 * matched by similar name}. {k} {row|rows} will be skipped: {r} rejected, {a} ambiguous, {n} unchanged{ and {x} you chose
 * to skip}.`
 */
export function confirmSummary(kind: AdministrationKind, summary: PreviewSummary, similar: readonly number[], decisions: ImportDecisions): string {
  const config = getAdministrationConfig(kind);
  const similarUpdates = similar.filter((rowNumber) => decisions[rowNumber] === 'update').length;
  const chosenSkips = similar.filter((rowNumber) => decisions[rowNumber] === 'skip').length;
  const updates = summary.update + similarUpdates;
  const including = similarUpdates > 0 ? `, including ${similarUpdates} matched by similar name` : '';
  const writes = `This import will create ${summary.create} and update ${updates} ${config.runningPluralLabel}${including}.`;
  const reasons = ([[summary.rejected, 'rejected'], [summary.ambiguous, 'ambiguous'], [summary.unchanged, 'unchanged']] as const)
    .filter(([count]) => count > 0)
    .map(([count, word]) => `${count} ${word}`);
  const skipped = summary.rejected + summary.ambiguous + summary.unchanged + chosenSkips;
  if (skipped === 0) return writes;
  const own = chosenSkips > 0 ? `${chosenSkips} you chose to skip` : '';
  const list = reasons.length && own ? `${reasons.join(', ')} and ${own}` : reasons.length ? reasons.join(', ') : own;
  return `${writes} ${skipped} ${rows(skipped)} will be skipped: ${list}.`;
}

/** §5.7 the Results tiles, in order, from the result's summary. */
export const RESULT_TILES = [
  ['create', 'Created'],
  ['update', 'Updated'],
  ['unchanged', 'Unchanged'],
  ['rejected', 'Rejected'],
  ['ambiguous', 'Ambiguous'],
  ['skipped', 'Skipped by you'],
] as const;

/** §5.7 a skipped similar row's Results details. */
export const SKIPPED_BY_CHOICE = 'Skipped by your choice.';

/**
 * §5.8 (UI-D13): the error report is offered at Review when any row is rejected, ambiguous or matched by similar name, and
 * at Results when any row was not imported other than by the person's own skip.
 */
export function reportOfferedAtReview(summary: PreviewSummary): boolean {
  return summary.rejected + summary.ambiguous + summary.similar > 0;
}
export function reportOfferedAtResults(summary: Readonly<Record<'rejected' | 'ambiguous', number>>): boolean {
  return summary.rejected + summary.ambiguous > 0;
}

/** §5.8 the line beside the button, and the saved report's toast body. */
export const ERROR_REPORT_LINE = 'The rows that weren’t imported, exactly as in your file, with an Issues column. Correct them and import the file again.';
export const reportToastBody = (count: number) => `${count.toLocaleString('en-AU')} ${rows(count)} to correct.`;
