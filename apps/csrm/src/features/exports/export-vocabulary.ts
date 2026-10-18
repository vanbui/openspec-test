import vocabularyJson from './export-vocabulary.json';

/*
 * The web's copy of the one export vocabulary (19-04; D-06, D-07, D-31, D-33). export-vocabulary.json is a
 * byte-identical copy of Strapi's (apps/backend/src/csrm/exports/export-vocabulary.json, the one to edit), and
 * export-vocabulary.test.ts proves the copy, the label parity with the one status mapping, the list headers and the
 * report tables. This module imports no validation library and nothing limited to the server, so the export dialog's client
 * component can read the columns it offers.
 */

export type ExportCellType = 'text' | 'number' | 'date' | 'instant' | 'flag' | 'label' | 'person' | 'record';

export type ExportColumn = {
  readonly key: string;
  readonly label: string;
  readonly type: ExportCellType;
  readonly family?: string;
  readonly visible: boolean;
  readonly width: number;
};

export type ExportViewMeta = {
  readonly key: string;
  readonly slug: string;
  readonly heading: string;
  readonly records: string;
  readonly columns: readonly ExportColumn[];
};

export type ExportTableColumn = { readonly key: string; readonly label: string; readonly type: ExportCellType; readonly family?: string };

export type ExportReportSpec = {
  readonly slug: string;
  readonly heading: string;
  readonly tables: readonly { readonly key: string; readonly heading: string; readonly slug: string; readonly columns: readonly ExportTableColumn[] }[];
};

export type ImportColumnSpec = {
  readonly field: string;
  readonly label: string;
  readonly kind: 'text' | 'boolean' | 'enum';
  readonly required: boolean;
  readonly maxLength: number;
  readonly values?: readonly string[];
  readonly format: string;
};

export type ImportSpec = {
  readonly naturalKey: string;
  readonly exampleKey: string;
  readonly columns: readonly ImportColumnSpec[];
  readonly readOnlyLabels: readonly string[];
};

type ExportVocabulary = {
  readonly schemaVersion: 1;
  readonly labels: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly views: Readonly<Record<string, Omit<ExportViewMeta, 'key'>>>;
  readonly tables: Readonly<Record<string, Readonly<Record<string, { readonly heading: string; readonly columns: readonly ExportTableColumn[] }>>>>;
  readonly reports: Readonly<Record<string, ExportReportSpec>>;
  readonly imports: Readonly<Record<string, ImportSpec>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A plain structural guard: Strapi validates every entry at load, and the parity test pins this copy to it. */
function isVocabulary(value: unknown): value is ExportVocabulary {
  return isRecord(value)
    && value.schemaVersion === 1
    && ['labels', 'views', 'tables', 'reports', 'imports'].every((section) => isRecord(value[section]));
}

if (!isVocabulary(vocabularyJson)) throw new Error('The export vocabulary copy is malformed.');

export const exportVocabulary: ExportVocabulary = vocabularyJson;

function own<T>(entries: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(entries, key) ? entries[key] : undefined;
}

/** A view's slug, heading, record noun and columns. */
export function exportViewMeta(viewKey: string): ExportViewMeta {
  const view = own(exportVocabulary.views, viewKey);
  if (!view) throw new Error(`The export vocabulary has no view ${viewKey}.`);
  return { key: viewKey, ...view };
}

/** A view's columns: the visible ones first, in on-screen order, then the others. */
export function exportViewColumns(viewKey: string): readonly ExportColumn[] {
  return exportViewMeta(viewKey).columns;
}

/** A report's slug, heading and tables. */
export function exportReport(reportKey: string): ExportReportSpec {
  const report = own(exportVocabulary.reports, reportKey);
  if (!report) throw new Error(`The export vocabulary has no report ${reportKey}.`);
  return report;
}

/** A collection's import columns, natural key, example key and read-only labels. */
export function importColumns(kind: string): ImportSpec {
  const spec = own(exportVocabulary.imports, kind);
  if (!spec) throw new Error(`The export vocabulary has no import ${kind}.`);
  return spec;
}

/** The label a stored value shows in its family, or the value unchanged when the family does not map it. */
export function exportLabel(family: string, value: string): string {
  const labels = own(exportVocabulary.labels, family);
  return (labels && own(labels, value)) ?? value;
}
