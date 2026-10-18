/*
 * 19-UI-SPEC §6, families S2 and S3: what a refused import file tells the person (a title, a body naming what was found,
 * and numbered steps where the fix takes several), and what a refused template download, expired review, error report or
 * commit without decisions says. Only the import flow imports this module, so its sentences never ship on the request
 * and risk detail pages, whose first loads sit within a few hundred bytes of their budget (19-PLAN-CHECK lane C I5, as
 * 15-10 placed family Q and 16-11 family R); refusal-copy.ts never imports it, and it is not added there. Plain and
 * zod-free, with no directive and type-only imports, so Server Actions and client components can share it.
 *
 * The file's headers and labels arrive through the transport's closed `found` guard, already bounded and cleaned of
 * controls; they are rendered as text. S4's row issues are written by Strapi into the preview, so they are not here.
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';
import type { ImportRefusalFound } from '../../lib/api/transport/server-client';

/** The 16 file refusals S2 words, in the order of the import record's "File Refusals", then its 2026-10-17 amendment. */
export const IMPORT_FILE_REFUSAL_REASONS = [
  'IMPORT_FILE_TYPE',
  'IMPORT_FILE_TOO_LARGE',
  'IMPORT_TOO_MANY_ROWS',
  'IMPORT_ENCODING_WINDOWS_1252',
  'IMPORT_ENCODING_UTF16',
  'IMPORT_ENCODING_UNKNOWN',
  'IMPORT_DELIMITER',
  'IMPORT_LEGACY_XLS',
  'IMPORT_MACRO_WORKBOOK',
  'IMPORT_ENCRYPTED_WORKBOOK',
  'IMPORT_WORKBOOK_TOO_LARGE',
  'IMPORT_NO_HEADER',
  'IMPORT_NO_ROWS',
  'IMPORT_DUPLICATE_HEADER',
  'IMPORT_MISSING_COLUMN',
  'IMPORT_CSV_MALFORMED',
] as const satisfies readonly ConflictReason[];

export type ImportFileRefusalReason = (typeof IMPORT_FILE_REFUSAL_REASONS)[number];

const fileRefusalReasons: ReadonlySet<string> = new Set(IMPORT_FILE_REFUSAL_REASONS);

/** True only for a reason S2 words; the import flow keeps its own copy for any other refusal. */
export function isImportFileRefusalReason(reason: ConflictReason | undefined): reason is ImportFileRefusalReason {
  return reason !== undefined && fileRefusalReasons.has(reason);
}

export type ImportFileRefusalCopy = { readonly title: string; readonly body: string; readonly steps: readonly string[] };

export type ImportFileRefusalInput = {
  readonly reason: ImportFileRefusalReason;
  readonly found?: ImportRefusalFound;
  /** The chosen file's name, verbatim (X-23). */
  readonly fileName?: string;
  /**
   * The chosen file's size, already formatted in 1,024-byte units (X-23, `formatFileSize`). Required: the browser always
   * knows it, so S2's `IMPORT_FILE_TOO_LARGE` sentence always names it (FE4-07).
   */
  readonly fileSize: string;
};

/** The three steps the encoding and delimiter refusals share. */
const SAVE_AS_CSV_UTF8: readonly string[] = [
  '1. In Excel, choose File > Save As.',
  '2. Choose “CSV UTF-8 (Comma delimited) (*.csv)” and save.',
  '3. Choose the new file here. Or upload the Excel workbook (.xlsx) itself.',
];

const SAVE_AS_CSV_UTF8_TITLE = 'Save the file as CSV UTF-8';

/** A CSV the parser cannot read: check the row in Excel, then save it as CSV UTF-8 (the import record's 2026-10-17 amendment). */
const CHECK_THE_ROW: readonly string[] = ['Open the file in Excel, check that row, then:', ...SAVE_AS_CSV_UTF8];

function malformedCsv(found?: ImportRefusalFound): string {
  return found?.line !== undefined
    ? `Line ${found.line} can’t be read. A quote may be missing, or the row has a different number of columns from the header.`
    : 'A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.';
}
const SPLIT_THE_ROWS = 'Split the rows into smaller files and import each.';

const counts = new Intl.NumberFormat('en-AU');

const refusal = (title: string, body: string, steps: readonly string[] = []): ImportFileRefusalCopy => ({ title, body, steps });

/** A written-out list: `A`, `A and B`, `A, B and C`. */
function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The file's name in quotes, as X-23 shows it, or `This file` when the caller does not know it. */
const named = (fileName?: string): string => (fileName ? `“${fileName}”` : 'This file');

function missingColumn(labels: readonly string[]): string {
  if (labels.length === 0) return 'Add the required columns (they’re in the template), then choose the file again.';
  const columns = labels.length === 1 ? `a column named ${labels[0]}` : `columns named ${listed(labels)}`;
  return `Add ${columns} (they’re in the template), then choose the file again.`;
}

/* Review amendment R1 part 2 (FE4-07): without the separator found, a sentence true for any separator, never a guess. */
function delimiterBody(found?: ImportRefusalFound): string {
  if (found?.delimiter === 'tab') return 'This file separates columns with tabs.';
  if (found?.delimiter === 'semicolon') return 'This file separates columns with semicolons.';
  return 'This file doesn’t separate its columns with commas.';
}

function duplicateHeader(found?: ImportRefusalFound): string {
  const [first, second] = found?.headers ?? [];
  const label = found?.labels?.[0];
  if (first === undefined || second === undefined || label === undefined) {
    return 'Two of the column names match the same column. Delete one of them, then choose the file again.';
  }
  return `“${first}” and “${second}” both match ${label}. Delete one of them, then choose the file again.`;
}

/** S2: a refused import file's title, body and steps, naming what was found where the refusal served it. */
export function importFileRefusal(input: ImportFileRefusalInput): ImportFileRefusalCopy {
  const { reason, found, fileName, fileSize } = input;
  switch (reason) {
    case 'IMPORT_ENCODING_WINDOWS_1252':
      return refusal(SAVE_AS_CSV_UTF8_TITLE, 'This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.', SAVE_AS_CSV_UTF8);
    case 'IMPORT_ENCODING_UTF16':
      return refusal(SAVE_AS_CSV_UTF8_TITLE, 'This file is saved as “Unicode Text”.', SAVE_AS_CSV_UTF8);
    case 'IMPORT_ENCODING_UNKNOWN':
      return refusal(SAVE_AS_CSV_UTF8_TITLE, 'This file isn’t UTF-8 text.', SAVE_AS_CSV_UTF8);
    case 'IMPORT_DELIMITER':
      return refusal('Separate the columns with commas', delimiterBody(found), SAVE_AS_CSV_UTF8);
    case 'IMPORT_LEGACY_XLS':
      return refusal('Save the workbook as .xlsx', 'This is an Excel 97-2003 workbook (.xls). In Excel, choose File > Save As, choose “Excel Workbook (*.xlsx)”, then choose the new file.');
    case 'IMPORT_MACRO_WORKBOOK':
      return refusal('Save the workbook without macros', 'This workbook contains macros. In Excel, choose File > Save As and “Excel Workbook (*.xlsx)”, which removes them, then choose the copy.');
    case 'IMPORT_ENCRYPTED_WORKBOOK':
      return refusal('Remove the workbook’s password', 'This workbook is protected with a password, so it can’t be read. Open it in Excel, remove the password, save it, then choose it again.');
    case 'IMPORT_FILE_TYPE':
      return refusal('Choose a CSV or Excel file', `${named(fileName)} isn’t a CSV or Excel workbook (.xlsx).`);
    case 'IMPORT_FILE_TOO_LARGE':
      return refusal('This file is too large', `${named(fileName)} is ${fileSize}. The limit is 5 MB. ${SPLIT_THE_ROWS}`);
    case 'IMPORT_TOO_MANY_ROWS':
      return refusal('This file has too many rows', found?.rows !== undefined
        ? `It has ${counts.format(found.rows)} rows. The limit is 5,000. ${SPLIT_THE_ROWS}`
        : `It has more than 5,000 rows. ${SPLIT_THE_ROWS}`);
    case 'IMPORT_WORKBOOK_TOO_LARGE':
      return refusal('This workbook is too large to open', 'Delete unused sheets and formatting, or save the rows as CSV UTF-8, then choose the file again.');
    case 'IMPORT_NO_HEADER':
      return refusal('Add a header row', 'The first row must hold the column names. Copy them from the template.');
    case 'IMPORT_NO_ROWS':
      return refusal('There are no rows to import', 'The file has column names but no rows below them.');
    case 'IMPORT_DUPLICATE_HEADER':
      return refusal('Two columns mean the same thing', duplicateHeader(found));
    case 'IMPORT_MISSING_COLUMN':
      return refusal('A required column is missing', missingColumn(found?.labels ?? []));
    case 'IMPORT_CSV_MALFORMED':
      return refusal('Fix the CSV file', malformedCsv(found), CHECK_THE_ROW);
  }
}

/** S3: which step of the import flow failed. */
export type ImportStepRefusalKind = 'template' | 'review-expired' | 'error-report' | 'decision-missing';

export type ImportStepRefusalCopy = { readonly message: string; readonly action: string | null };

const stepRefusals: Readonly<Record<ImportStepRefusalKind, ImportStepRefusalCopy>> = {
  template: { message: 'We couldn’t download the template.', action: 'Try again' },
  'review-expired': { message: 'This review has expired. Choose the file again to check it.', action: 'Choose file again' },
  'error-report': { message: 'We couldn’t prepare the error report.', action: 'Try again' },
  // The flow returns to Review rows with the similar filter; there is no action to offer here.
  'decision-missing': { message: 'Choose Update or Skip for every row matched by similar name, then confirm again.', action: null },
};

/** S3: a refused template download, an expired review (error report or commit), a failed error report or a commit without decisions. */
export function importStepRefusal(kind: ImportStepRefusalKind): ImportStepRefusalCopy {
  return stepRefusals[kind];
}
