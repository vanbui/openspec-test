import vocabularyFile from "./export-vocabulary.json";

/*
 * The one export vocabulary (19-04; D-06, D-07, D-31, D-33): every list view's closed columns, the released
 * assessment's and each report's fixed tables, the four collections' import columns and one label map per status
 * family. The web holds a byte-identical copy (apps/csrm/src/features/exports/export-vocabulary.json) and a parity test
 * proves its labels equal the web's one status mapping, so a file reads the words the screen shows.
 *
 * The file is validated once, when this module loads, with plain guards: a malformed vocabulary stops Strapi rather
 * than writing a wrong file.
 */

export const EXPORT_CELL_TYPES = ["text", "number", "date", "instant", "flag", "label", "person", "record"] as const;
/**
 * How a column's value becomes a cell: `text` as text; `number` as a number; `date` a calendar date; `instant` the
 * viewer's local calendar date; `flag` Yes or No; `label` its family's label; `person` a display name; `record` a
 * record number.
 */
export type ExportCellType = (typeof EXPORT_CELL_TYPES)[number];

export type ExportColumn = {
  readonly key: string;
  readonly label: string;
  readonly type: ExportCellType;
  readonly family?: string;
  readonly visible: boolean;
  /** The column's width in characters, in a workbook. */
  readonly width: number;
};

export type ExportViewMeta = {
  readonly key: string;
  readonly slug: string;
  readonly heading: string;
  /** The view's record noun, for counts. */
  readonly records: string;
  readonly columns: readonly ExportColumn[];
};

export type ExportTableColumn = {
  readonly key: string;
  readonly label: string;
  readonly type: ExportCellType;
  readonly family?: string;
};

export type ExportTableSpec = {
  readonly heading: string;
  readonly columns: readonly ExportTableColumn[];
};

export type ExportReportTableSpec = ExportTableSpec & { readonly key: string; readonly slug: string };

export type ExportReportSpec = {
  readonly slug: string;
  readonly heading: string;
  readonly tables: readonly ExportReportTableSpec[];
};

export const IMPORT_COLUMN_KINDS = ["text", "boolean", "enum"] as const;

export type ImportColumnSpec = {
  readonly field: string;
  readonly label: string;
  readonly kind: (typeof IMPORT_COLUMN_KINDS)[number];
  readonly required: boolean;
  readonly maxLength: number;
  readonly values?: readonly string[];
  /** The template's Guidance and Notes text, such as `Text, up to 255 characters`. */
  readonly format: string;
};

export type ImportSpec = {
  readonly naturalKey: string;
  /** The natural key of the template's example row, which an import skips. */
  readonly exampleKey: string;
  readonly columns: readonly ImportColumnSpec[];
  /** The export's read-only columns, which an import of its file notes and ignores. */
  readonly readOnlyLabels: readonly string[];
};

export type ExportVocabulary = {
  readonly schemaVersion: 1;
  readonly labels: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly views: Readonly<Record<string, ExportViewMeta>>;
  readonly tables: Readonly<Record<string, Readonly<Record<string, ExportTableSpec>>>>;
  readonly reports: Readonly<Record<string, ExportReportSpec>>;
  readonly imports: Readonly<Record<string, ImportSpec>>;
};

const COLUMN_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,63}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

type Raw = Record<string, unknown>;

function invalid(where: string): never {
  throw new Error(`CSRM export vocabulary is invalid: ${where}.`);
}

function record(value: unknown, where: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(where);
  return value as Raw;
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) invalid(where);
  return value;
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") invalid(where);
  return value;
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, where: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) invalid(where);
  return value as T[number];
}

function frozen<T extends object>(value: T): T {
  return Object.freeze(value);
}

function labelsOf(raw: Raw): ExportVocabulary["labels"] {
  const labels: Record<string, Readonly<Record<string, string>>> = {};
  for (const [family, entries] of Object.entries(record(raw.labels, "labels"))) {
    const map: Record<string, string> = {};
    for (const [value, label] of Object.entries(record(entries, `labels.${family}`))) map[value] = text(label, `labels.${family}.${value}`);
    labels[family] = frozen(map);
  }
  return frozen(labels);
}

function tableColumnOf(value: unknown, where: string, families: ExportVocabulary["labels"]): ExportTableColumn {
  const raw = record(value, where);
  const key = text(raw.key, `${where}.key`);
  if (!COLUMN_KEY.test(key)) invalid(`${where}.key`);
  const type = oneOf(raw.type, EXPORT_CELL_TYPES, `${where}.type`);
  const column: { key: string; label: string; type: ExportCellType; family?: string } = { key, label: text(raw.label, `${where}.label`), type };
  if (type === "label") {
    const family = text(raw.family, `${where}.family`);
    if (!Object.prototype.hasOwnProperty.call(families, family)) invalid(`${where}.family`);
    column.family = family;
  } else if (raw.family !== undefined) invalid(`${where}.family`);
  return column;
}

function uniqueKeys(columns: readonly { key: string }[], where: string): void {
  if (new Set(columns.map((column) => column.key)).size !== columns.length) invalid(`${where} repeats a key`);
}

function viewsOf(raw: Raw, families: ExportVocabulary["labels"]): ExportVocabulary["views"] {
  const views: Record<string, ExportViewMeta> = {};
  for (const [key, value] of Object.entries(record(raw.views, "views"))) {
    const view = record(value, `views.${key}`);
    const columns = list(view.columns, `views.${key}.columns`).map((entry, index) => {
      const where = `views.${key}.columns.${index}`;
      const column = record(entry, where);
      if (typeof column.visible !== "boolean") invalid(`${where}.visible`);
      if (typeof column.width !== "number" || !Number.isInteger(column.width) || column.width < 4 || column.width > 100) invalid(`${where}.width`);
      return frozen({ ...tableColumnOf(entry, where, families), visible: column.visible, width: column.width });
    });
    uniqueKeys(columns, `views.${key}.columns`);
    if (!columns.some((column) => column.visible)) invalid(`views.${key} has no visible column`);
    // Visible columns first, in on-screen order, then the view's other columns (D-06).
    const firstHidden = columns.findIndex((column) => !column.visible);
    if (firstHidden >= 0 && columns.slice(firstHidden).some((column) => column.visible)) invalid(`views.${key} lists a visible column after a hidden one`);
    const slug = text(view.slug, `views.${key}.slug`);
    if (!SLUG.test(slug)) invalid(`views.${key}.slug`);
    views[key] = frozen({ key, slug, heading: text(view.heading, `views.${key}.heading`), records: text(view.records, `views.${key}.records`), columns: frozen(columns) });
  }
  return frozen(views);
}

function tableOf(value: unknown, where: string, families: ExportVocabulary["labels"]): ExportTableSpec {
  const table = record(value, where);
  const columns = list(table.columns, `${where}.columns`).map((entry, index) => frozen(tableColumnOf(entry, `${where}.columns.${index}`, families)));
  if (columns.length === 0) invalid(`${where} has no column`);
  uniqueKeys(columns, `${where}.columns`);
  return frozen({ heading: text(table.heading, `${where}.heading`), columns: frozen(columns) });
}

function tablesOf(raw: Raw, families: ExportVocabulary["labels"]): ExportVocabulary["tables"] {
  const tables: Record<string, Readonly<Record<string, ExportTableSpec>>> = {};
  for (const [set, value] of Object.entries(record(raw.tables, "tables"))) {
    const entries: Record<string, ExportTableSpec> = {};
    for (const [table, spec] of Object.entries(record(value, `tables.${set}`))) entries[table] = tableOf(spec, `tables.${set}.${table}`, families);
    tables[set] = frozen(entries);
  }
  return frozen(tables);
}

function reportsOf(raw: Raw, families: ExportVocabulary["labels"]): ExportVocabulary["reports"] {
  const reports: Record<string, ExportReportSpec> = {};
  for (const [key, value] of Object.entries(record(raw.reports, "reports"))) {
    const report = record(value, `reports.${key}`);
    const tables = list(report.tables, `reports.${key}.tables`).map((entry, index) => {
      const where = `reports.${key}.tables.${index}`;
      const table = record(entry, where);
      const slug = text(table.slug, `${where}.slug`);
      if (!SLUG.test(slug)) invalid(`${where}.slug`);
      return frozen({ key: text(table.key, `${where}.key`), slug, ...tableOf(entry, where, families) });
    });
    uniqueKeys(tables, `reports.${key}.tables`);
    const slug = text(report.slug, `reports.${key}.slug`);
    if (!SLUG.test(slug)) invalid(`reports.${key}.slug`);
    reports[key] = frozen({ slug, heading: text(report.heading, `reports.${key}.heading`), tables: frozen(tables) });
  }
  return frozen(reports);
}

function importsOf(raw: Raw): ExportVocabulary["imports"] {
  const imports: Record<string, ImportSpec> = {};
  for (const [kind, value] of Object.entries(record(raw.imports, "imports"))) {
    const spec = record(value, `imports.${kind}`);
    const columns = list(spec.columns, `imports.${kind}.columns`).map((entry, index) => {
      const where = `imports.${kind}.columns.${index}`;
      const column = record(entry, where);
      if (typeof column.required !== "boolean") invalid(`${where}.required`);
      if (typeof column.maxLength !== "number" || !Number.isSafeInteger(column.maxLength) || column.maxLength < 1) invalid(`${where}.maxLength`);
      const kindOf = oneOf(column.kind, IMPORT_COLUMN_KINDS, `${where}.kind`);
      const values = column.values === undefined ? undefined : list(column.values, `${where}.values`).map((entry, at) => text(entry, `${where}.values.${at}`));
      if ((kindOf === "enum") !== (values !== undefined)) invalid(`${where}.values`);
      return frozen({
        field: text(column.field, `${where}.field`),
        label: text(column.label, `${where}.label`),
        kind: kindOf,
        required: column.required,
        maxLength: column.maxLength,
        ...(values ? { values: frozen(values) } : {}),
        format: text(column.format, `${where}.format`),
      });
    });
    if (new Set(columns.map((column) => column.field)).size !== columns.length) invalid(`imports.${kind}.columns repeats a field`);
    const readOnlyLabels = list(spec.readOnlyLabels, `imports.${kind}.readOnlyLabels`).map((entry, index) => text(entry, `imports.${kind}.readOnlyLabels.${index}`));
    imports[kind] = frozen({
      naturalKey: text(spec.naturalKey, `imports.${kind}.naturalKey`),
      exampleKey: text(spec.exampleKey, `imports.${kind}.exampleKey`),
      columns: frozen(columns),
      readOnlyLabels: frozen(readOnlyLabels),
    });
  }
  return frozen(imports);
}

/** Validates a vocabulary file, throwing on the first malformed entry. Exported for the vocabulary's own tests. */
export function parseExportVocabulary(value: unknown): ExportVocabulary {
  const raw = record(value, "the file");
  if (raw.schemaVersion !== 1) invalid("schemaVersion");
  const labels = labelsOf(raw);
  return frozen({
    schemaVersion: 1,
    labels,
    views: viewsOf(raw, labels),
    tables: tablesOf(raw, labels),
    reports: reportsOf(raw, labels),
    imports: importsOf(raw),
  });
}

export const EXPORT_VOCABULARY: ExportVocabulary = parseExportVocabulary(vocabularyFile);

function own<T>(entries: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined;
}

/** A view's slug, heading, record noun and columns; throws for a view the vocabulary does not hold. */
export function exportViewMeta(viewKey: string): ExportViewMeta {
  return own(EXPORT_VOCABULARY.views, viewKey) ?? invalid(`no view ${viewKey}`);
}

/** A view's columns: the visible ones first, in on-screen order, then the others. */
export function exportViewColumns(viewKey: string): readonly ExportColumn[] {
  return exportViewMeta(viewKey).columns;
}

/** One fixed table's heading and columns, such as `exportTableColumns("released-assessment", "risks")`. */
export function exportTableColumns(tableSet: string, table: string): ExportTableSpec {
  const set = own(EXPORT_VOCABULARY.tables, tableSet) ?? invalid(`no table set ${tableSet}`);
  return own(set, table) ?? invalid(`no table ${tableSet}.${table}`);
}

/** A report's slug, heading and tables. */
export function exportReport(reportKey: string): ExportReportSpec {
  return own(EXPORT_VOCABULARY.reports, reportKey) ?? invalid(`no report ${reportKey}`);
}

/** The label a stored value shows in its family, or the value unchanged when the family does not map it. */
export function exportLabel(family: string, value: string): string {
  const labels = own(EXPORT_VOCABULARY.labels, family);
  return (labels && own(labels, value)) ?? value;
}

/** A collection's import columns, natural key, example key and read-only labels. */
export function importColumns(kind: string): ImportSpec {
  return own(EXPORT_VOCABULARY.imports, kind) ?? invalid(`no import ${kind}`);
}
