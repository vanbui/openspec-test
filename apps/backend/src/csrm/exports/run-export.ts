import { logSecurityEvent, type ExportSecurityEvent, type ExportSecurityEventReason, type SecurityEventLogger } from "../audit/security-event-log";
import { isUtcDate, utcToday } from "../insights/utc-date";
import { writeCsv, type CsvCell } from "../spreadsheets/csv-writer";
import { sanitizeSpreadsheetCell } from "../spreadsheets/neutralise";
import { safeSheetName, writeWorkbook, XLSX_CELL_MAX_LENGTH, type SheetCell, type WorkbookSheet } from "../spreadsheets/xlsx-writer";
import { ExportQueryError, ExportRefusalError } from "./export-errors";
import { formatExportedAt, localCalendarDate, parseExportTimeZone, type ExportTimeZone } from "./export-time";
import type { ExportAuditQuery, ExportCellValue, ExportQueryDescription, ListExportView } from "./export-views";
import { exportLabel, exportViewColumns, type ExportCellType, type ExportColumn, type ExportTableColumn } from "./export-vocabulary";
import { EXPORT_MEDIA_TYPES, exportFileName } from "./send-export";

/*
 * The one export pipeline (19-04; D-05 to D-10, D-17, D-18). Every list export runs through runListExport: the
 * list's own scope and parser, a count against the cap before anything is generated, the ordered ids (read with the
 * cap plus one, so a list that grows meanwhile is refused rather than cut), hydration in batches, the list's own
 * projection, the chosen columns as typed display values, one file and one log line. The reports and the released
 * assessment run through runFixedTableExport, with the same cells, cap, About sheet and log line.
 *
 * Nothing here computes a value the list does not: the due state is the projection's (G-16), and no Risk is read
 * except through a view's own repository.
 */

export { ExportQueryError, ExportRefusalError };
export type { ExportTimeZone };

/** The most rows one export may hold (D-17): a data-leakage control, defined here once. */
export const EXPORT_ROW_CAP = 10_000;

/** How many ids each hydration reads. */
export const EXPORT_HYDRATE_BATCH = 500;

export const EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** The most columns one export may choose. */
export const EXPORT_COLUMNS_MAX = 40;

/** The person exporting: their IdamBox User and display name. */
export type ExportActor = { readonly documentId: string; readonly displayName: string };

export type ExportControls = {
  readonly format: ExportFormat;
  /** The chosen columns in the view's canonical order. */
  readonly columns: readonly ExportColumn[];
  readonly timeZone: ExportTimeZone;
};

export type ExportFile = {
  readonly fileName: string;
  readonly format: ExportFormat;
  /** Exactly one of EXPORT_MEDIA_TYPES. */
  readonly contentType: string;
  readonly bytes: Buffer;
  /** The data rows written (a one-row summary table not counted). */
  readonly rowCount: number;
};

/** One fixed table a report or the released assessment builds from its own read (UI-D5: no columns parameter). */
export type ExportTable = {
  readonly key: string;
  /** The sheet name (cut to 31 characters) and the table's caption. */
  readonly heading: string;
  /** The CSV file's slug when this table is the one chosen. */
  readonly slug: string;
  readonly columns: readonly ExportTableColumn[];
  readonly rows: readonly Readonly<Record<string, ExportCellValue>>[];
  /** A one-row summary table: written in the workbook, never counted, never a CSV on its own. */
  readonly summary?: boolean;
};

/** The About sheet's extra rows: a report's As at and Period, the released assessment's AI assistance notice. */
export type ExportAboutExtras = { readonly asAt?: string; readonly period?: string; readonly aiAssistance?: string };

const CONTROL_KEYS = ["format", "columns", "timeZone"] as const;

/** The About sheet's `Values that look like formulas` row (19-UI-SPEC §3.3). */
export const EXPORT_FORMULA_NOTE =
  "Values that begin with =, +, -, @, a tab or a line break start with an apostrophe (') so they open as text. CSRM removes it when the file is imported.";

function scalarControl(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ExportQueryError();
  return value;
}

function parseFormat(value: unknown): ExportFormat {
  const format = scalarControl(value);
  if (format === undefined || !(EXPORT_FORMATS as readonly string[]).includes(format)) throw new ExportQueryError();
  return format as ExportFormat;
}

/** The request's format when it is a known one, else null: a refused line names what the pipeline already knows (BE1-04). */
function knownFormat(query: unknown): ExportFormat | null {
  if (typeof query !== "object" || query === null || Array.isArray(query)) return null;
  try {
    return parseFormat((query as Record<string, unknown>).format);
  } catch {
    return null;
  }
}

/** The chosen columns: 1 to 40 unique keys of the view, split on commas, in the view's canonical order (D-06). */
function chosenColumns(value: string | undefined, columns: readonly ExportColumn[]): readonly ExportColumn[] {
  if (value === undefined) return columns.filter((column) => column.visible);
  const keys = value.split(",");
  if (keys.length < 1 || keys.length > EXPORT_COLUMNS_MAX || new Set(keys).size !== keys.length) throw new ExportQueryError();
  const known = new Set(columns.map((column) => column.key));
  if (keys.some((key) => !known.has(key))) throw new ExportQueryError();
  const chosen = new Set(keys);
  return columns.filter((column) => chosen.has(column.key));
}

/**
 * Takes the export controls out of a list export's query and validates them (D-06, D-16): `format` is `csv` or
 * `xlsx`, `columns` 1 to 40 unique keys of the view, and `timeZone` an IANA zone (absent: UTC). What remains is the
 * list's own query, for the list's own parser, which refuses any key it does not know.
 */
export function parseExportControls(query: unknown, view: { readonly key: string }): { controls: ExportControls; rest: Record<string, unknown> } {
  if (typeof query !== "object" || query === null || Array.isArray(query)) throw new ExportQueryError();
  const rest: Record<string, unknown> = { ...(query as Record<string, unknown>) };
  const raw: Partial<Record<(typeof CONTROL_KEYS)[number], unknown>> = {};
  for (const key of CONTROL_KEYS) {
    raw[key] = rest[key];
    delete rest[key];
  }
  const format = parseFormat(raw.format);
  const columns = chosenColumns(scalarControl(raw.columns), exportViewColumns(view.key));
  const timeZone = parseExportTimeZone(raw.timeZone);
  return { controls: { format, columns, timeZone }, rest };
}

type TypedCell = { readonly sheet: SheetCell; readonly csv: CsvCell };
type CellColumn = Pick<ExportTableColumn, "key" | "type" | "family">;

const EMPTY: TypedCell = Object.freeze({ sheet: null, csv: null });

function textCell(value: string): TypedCell {
  return value === "" ? EMPTY : { sheet: { kind: "text", value }, csv: { kind: "text", value } };
}

function cellFault(column: CellColumn): never {
  throw new TypeError(`CSRM export column ${column.key} holds a value its type ${column.type} cannot write.`);
}

/** A calendar date's cells: a date cell at its UTC midnight (19-RESEARCH Pitfall 5) and ISO text in a CSV. */
function dateCell(iso: string, utcMidnight: Date): TypedCell {
  return { sheet: { kind: "date", value: utcMidnight }, csv: { kind: "date", isoDate: iso } };
}

/**
 * One value as its column's typed cells (D-07): text and record numbers as text, labels from the vocabulary, flags as
 * Yes and No, numbers as numbers, calendar dates as dates, instants as the viewer's local calendar date, and an empty
 * cell for an absent value. Every text cell is neutralised inside the writers.
 */
function typedCell(column: CellColumn, value: ExportCellValue, zone: string): TypedCell {
  if (value === null || value === undefined) return EMPTY;
  const type: ExportCellType = column.type;
  switch (type) {
    case "text":
    case "person":
    case "record":
      return typeof value === "string" || typeof value === "number" ? textCell(String(value)) : cellFault(column);
    case "label":
      return typeof value === "string" ? textCell(exportLabel(column.family ?? "", value)) : cellFault(column);
    case "flag":
      return typeof value === "boolean" ? textCell(value ? "Yes" : "No") : cellFault(column);
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? { sheet: { kind: "number", value }, csv: { kind: "number", value } } : cellFault(column);
    case "date": {
      const iso = typeof value === "string" ? value.slice(0, 10) : "";
      return isUtcDate(iso) ? dateCell(iso, new Date(`${iso}T00:00:00.000Z`)) : cellFault(column);
    }
    case "instant": {
      const instant = typeof value === "string" ? new Date(value) : null;
      if (!instant || Number.isNaN(instant.getTime())) return cellFault(column);
      const local = localCalendarDate(instant, zone);
      return dateCell(local.iso, local.utcMidnight);
    }
  }
}

const DEFAULT_WIDTHS: Readonly<Record<ExportCellType, number>> = Object.freeze({
  text: 30, number: 12, date: 14, instant: 14, flag: 10, label: 20, person: 24, record: 16,
});

export type AboutSheetInput = {
  readonly heading: string;
  readonly description: ExportQueryDescription | null;
  /** The chosen column labels; null for a fixed-table export, which takes no columns. */
  readonly columns: readonly string[] | null;
  readonly rowCount: number;
  readonly about?: ExportAboutExtras;
  readonly now: Date;
  readonly timeZone: ExportTimeZone;
  readonly exportedBy: string;
};

/**
 * The last sheet, `About this export` (D-09; 19-UI-SPEC §3.3): `Item` and `Detail`, with View, Search, Filters,
 * Sorted by, Columns, Rows, As at, Period, Exported, Exported by, Values that look like formulas and AI assistance in
 * that order, each omitted when it does not apply.
 */
export function buildAboutSheet(input: AboutSheetInput): WorkbookSheet {
  const rows: SheetCell[][] = [];
  const text = (value: string): SheetCell => ({ kind: "text", value });
  const add = (item: string, detail: SheetCell) => rows.push([text(item), detail]);
  const { description, about } = input;
  add("View", text(input.heading));
  if (description?.search) add("Search", text(`“${description.search}”`));
  if (description && description.filters.length > 0) add("Filters", text(description.filters.map((filter) => `${filter.label}: ${filter.value}`).join("\n")));
  if (description?.sort) add("Sorted by", text(`${description.sort.label}, ${description.sort.direction}`));
  if (input.columns && input.columns.length > 0) add("Columns", text(input.columns.join(", ")));
  add("Rows", { kind: "number", value: input.rowCount });
  if (about?.asAt) add("As at", text(about.asAt));
  if (about?.period) add("Period", text(about.period));
  add("Exported", text(formatExportedAt(input.now, input.timeZone.zone, input.timeZone.fallback)));
  add("Exported by", text(input.exportedBy));
  add("Values that look like formulas", text(EXPORT_FORMULA_NOTE));
  if (about?.aiAssistance) add("AI assistance", text(about.aiAssistance));
  return { name: "About this export", header: ["Item", "Detail"], rows, widths: [32, 80] };
}

type EventInput = {
  readonly name: ExportSecurityEvent["name"];
  readonly view: string;
  readonly actor: ExportActor;
  readonly format: ExportFormat | null;
  readonly columns: readonly string[];
  readonly table: string | null;
  readonly timeZone: ExportTimeZone | null;
  readonly audit: ExportAuditQuery | null;
  readonly rowCount: number | null;
  readonly subject?: ExportSecurityEvent["subject"];
  readonly reason?: ExportSecurityEventReason;
};

/** One export line (D-18): the parsed, closed query only, never a cell value or the raw query. */
function exportEvent(input: EventInput): ExportSecurityEvent {
  return {
    name: input.name,
    actor: { documentId: input.actor.documentId, displayName: input.actor.displayName },
    view: input.view,
    format: input.format ?? "unknown",
    columns: [...input.columns],
    table: input.table,
    filters: input.audit?.filters ?? {},
    search: input.audit?.search ?? null,
    sort: input.audit?.sort ?? null,
    timeZone: input.timeZone ? (input.timeZone.fallback ? "UTC-fallback" : input.timeZone.zone) : "unknown",
    rowCount: input.rowCount,
    subject: input.subject ?? null,
    outcome: input.name === "export.completed" ? "exported" : "refused",
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
  };
}

function rowLimit(rowCount: number): ExportRefusalError {
  return new ExportRefusalError({
    reason: "EXPORT_ROW_LIMIT",
    status: 422,
    message: `This export holds ${rowCount} rows, more than the ${EXPORT_ROW_CAP} one export may hold.`,
    rowCount,
    rowCap: EXPORT_ROW_CAP,
  });
}

/*
 * The Phase 19 review amendment (2026-10-17, G-6; BE1-02): an xlsx export whose text cell, as the writer would write it
 * (after the neutraliser's mark), is longer than Excel's limit is refused before anything is written, naming the first
 * such column by its key, never the value. A CSV holds the value whole and is never checked.
 */
function cellTooLong(columns: readonly { readonly key: string }[], rows: readonly (readonly TypedCell[])[]): string | null {
  for (const row of rows) {
    for (const [index, cell] of row.entries()) {
      const sheet = cell.sheet;
      if (sheet !== null && sheet.kind === "text" && sanitizeSpreadsheetCell(sheet.value).length > XLSX_CELL_MAX_LENGTH) return columns[index]?.key ?? null;
    }
  }
  return null;
}

function cellLimit(column: string): ExportRefusalError {
  return new ExportRefusalError({
    reason: "EXPORT_CELL_TOO_LONG",
    status: 422,
    message: `This export holds text longer than the ${XLSX_CELL_MAX_LENGTH} characters an Excel cell may hold.`,
    column,
    cellLimit: XLSX_CELL_MAX_LENGTH,
  });
}

function fileOf(input: { slug: string; format: ExportFormat; bytes: Buffer; rowCount: number; now: Date; timeZone: ExportTimeZone }): ExportFile {
  const localDate = localCalendarDate(input.now, input.timeZone.zone).iso;
  return {
    fileName: exportFileName({ slug: input.slug, localDate, format: input.format }),
    format: input.format,
    contentType: EXPORT_MEDIA_TYPES[input.format],
    bytes: input.bytes,
    rowCount: input.rowCount,
  };
}

/**
 * One list export (D-05, D-17): the list's scope, its export parser, a count refused above the cap before anything is
 * generated, the ordered ids read with the cap plus one (more than the cap is refused the same way: no partial file),
 * hydration in batches of 500, the list's own projection and the chosen columns. The count, the ids and the
 * projection share one UTC `today`. Every attempt that passes the scope and completes, or is refused by its query or
 * the cap, writes exactly one `export.completed` or `export.refused` line; a scope refusal is a policy denial, logged
 * by Strapi's request log as today. An unexpected failure after parsing (a fault or a database error) writes no line
 * yet: the record's closed reasons name none for it (BE1-04; proposed in the Phase 19 review amendment).
 */
export async function runListExport<P, R>(input: {
  view: ListExportView<P, R>;
  query: unknown;
  state: unknown;
  actor: ExportActor;
  now: Date;
  log: SecurityEventLogger;
}): Promise<ExportFile> {
  const { view, actor, now, log } = input;
  view.assertScope(input.state);
  const today = utcToday(now);
  let controls: ExportControls | null = null;
  let parsed: P;
  try {
    const split = parseExportControls(input.query, view);
    controls = split.controls;
    parsed = view.parseExportQuery(split.rest, input.state);
  } catch (error) {
    if (error instanceof ExportQueryError) {
      logSecurityEvent(log, exportEvent({
        name: "export.refused", view: view.key, actor, format: controls?.format ?? knownFormat(input.query), columns: controls?.columns.map((column) => column.key) ?? [],
        table: null, timeZone: controls?.timeZone ?? null, audit: null, rowCount: null, reason: "INVALID_QUERY",
      }), now);
    }
    throw error;
  }
  const { format, columns, timeZone } = controls;
  const audit = view.auditQuery(parsed);
  const event = (name: ExportSecurityEvent["name"], rowCount: number | null, reason?: ExportSecurityEventReason) => exportEvent({
    name, view: view.key, actor, format, columns: columns.map((column) => column.key), table: null, timeZone, audit, rowCount, reason,
  });
  // One line per attempt (the review amendment, 2026-10-17, BE1-04): `logged` records that this attempt wrote its line.
  let logged = false;
  let counted: number | null = null;
  const write = (line: ExportSecurityEvent): void => {
    logged = true;
    logSecurityEvent(log, line, now);
  };
  const refuse = (rowCount: number): never => {
    write(event("export.refused", rowCount, "EXPORT_ROW_LIMIT"));
    throw rowLimit(rowCount);
  };

  try {
    const total = await view.count(parsed, today);
    counted = total;
    if (total > EXPORT_ROW_CAP) refuse(total);
    // 19-RESEARCH Pitfall 8: a list that grew past the cap between the count and the read is refused, never cut.
    const ids = await view.selectIds(parsed, EXPORT_ROW_CAP + 1, today);
    // BE1-04: the refusal names the list's count as re-read now (at least the ids read), not the cap plus one.
    if (ids.length > EXPORT_ROW_CAP) refuse(Math.max(ids.length, await view.count(parsed, today)));

    const extractors = columns.map((column) => {
      const extractor = view.extractors[column.key];
      if (!extractor) throw new TypeError(`CSRM export view ${view.key} has no extractor for ${column.key}.`);
      return extractor;
    });
    const rows: TypedCell[][] = [];
    for (let start = 0; start < ids.length; start += EXPORT_HYDRATE_BATCH) {
      const documents = await view.hydrate(ids.slice(start, start + EXPORT_HYDRATE_BATCH), columns);
      for (const document of documents) {
        const row = view.project(document, today);
        rows.push(columns.map((column, index) => typedCell(column, extractors[index](row), timeZone.zone)));
      }
    }

    if (format === "xlsx") {
      const tooLong = cellTooLong(columns, rows);
      if (tooLong !== null) {
        write(event("export.refused", rows.length, "EXPORT_CELL_TOO_LONG"));
        throw cellLimit(tooLong);
      }
    }

    const header = columns.map((column) => column.label);
    let bytes: Buffer;
    if (format === "csv") {
      bytes = writeCsv({ header, rows: rows.map((row) => row.map((cell) => cell.csv)) });
    } else {
      const description = await view.describe(parsed);
      bytes = await writeWorkbook([
        { name: safeSheetName(view.heading), header, rows: rows.map((row) => row.map((cell) => cell.sheet)), widths: columns.map((column) => column.width) },
        buildAboutSheet({ heading: view.heading, description, columns: header, rowCount: rows.length, now, timeZone, exportedBy: actor.displayName }),
      ]);
    }
    write(event("export.completed", rows.length));
    return fileOf({ slug: view.slug, format, bytes, rowCount: rows.length, now, timeZone });
  } catch (error) {
    // An attempt that fails after parsing (a fault, a writer error, a database error) writes its one line here, with the
    // log-only EXPORT_FAILED (or INVALID_QUERY for a late query refusal), never the error's message or a cell; the
    // error goes on unchanged, so the response is Strapi's 500 (the review amendment, 2026-10-17, BE1-04).
    if (!logged) write(event("export.refused", counted, error instanceof ExportQueryError ? "INVALID_QUERY" : "EXPORT_FAILED"));
    throw error;
  }
}

/**
 * The one `export.refused` line of a fixed-table export whose request its caller refused before its tables were built:
 * `INVALID_QUERY` (the default) for a request it does not take, such as a report export body with a key it does not
 * take, or `ASSESSMENT_NOT_RELEASED` for an analyst's export of an unreleased assessment (D-15, D-16, D-18). Only a
 * known format is named; the refused request is never logged.
 */
export function logRefusedFixedTableRequest(input: {
  viewKey: string;
  actor: ExportActor;
  format: unknown;
  now: Date;
  log: SecurityEventLogger;
  subject?: ExportSecurityEvent["subject"];
  reason?: Extract<ExportSecurityEventReason, "INVALID_QUERY" | "ASSESSMENT_NOT_RELEASED">;
}): void {
  const format = typeof input.format === "string" && (EXPORT_FORMATS as readonly string[]).includes(input.format) ? (input.format as ExportFormat) : null;
  logSecurityEvent(input.log, exportEvent({
    name: "export.refused", view: input.viewKey, actor: input.actor, format, columns: [], table: null, timeZone: null, audit: null, rowCount: null, subject: input.subject, reason: input.reason ?? "INVALID_QUERY",
  }), input.now);
}

/**
 * One fixed-table export (D-21, D-22; UI-D5): a report's tables or the released assessment's, built by the caller
 * from its own read. XLSX writes one sheet per table, then About this export with the caller's extra rows; CSV writes
 * only the table named by `table`, which a CSV requires and a workbook refuses. The row count is the data rows
 * written, a one-row summary table not counted, and the cap applies to it. One log line per attempt.
 */
export async function runFixedTableExport(input: {
  viewKey: string;
  slug: string;
  heading: string;
  tables: readonly ExportTable[];
  format: unknown;
  table: unknown;
  timeZone: unknown;
  actor: ExportActor;
  now: Date;
  log: SecurityEventLogger;
  about?: ExportAboutExtras;
  subject?: ExportSecurityEvent["subject"];
}): Promise<ExportFile> {
  const { actor, now, log } = input;
  let format: ExportFormat | null = null;
  let timeZone: ExportTimeZone | null = null;
  let chosen: ExportTable | null = null;
  try {
    format = parseFormat(input.format);
    timeZone = parseExportTimeZone(input.timeZone);
    const table = scalarControl(input.table);
    if (format === "xlsx" && table !== undefined) throw new ExportQueryError();
    if (format === "csv") {
      chosen = input.tables.find((entry) => entry.key === table) ?? null;
      if (!chosen || chosen.summary) throw new ExportQueryError();
    }
  } catch (error) {
    if (error instanceof ExportQueryError) {
      const table = typeof input.table === "string" ? input.table : null;
      logSecurityEvent(log, exportEvent({
        name: "export.refused", view: input.viewKey, actor, format, columns: [], table, timeZone, audit: null, rowCount: null, subject: input.subject, reason: "INVALID_QUERY",
      }), now);
    }
    throw error;
  }
  const written = chosen ? [chosen] : input.tables;
  const rowCount = written.filter((table) => !table.summary).reduce((sum, table) => sum + table.rows.length, 0);
  const event = (name: ExportSecurityEvent["name"], reason?: ExportSecurityEventReason) => exportEvent({
    name, view: input.viewKey, actor, format, columns: [], table: chosen?.key ?? null, timeZone, audit: null, rowCount, subject: input.subject, reason,
  });
  let logged = false;
  const write = (line: ExportSecurityEvent): void => {
    logged = true;
    logSecurityEvent(log, line, now);
  };
  try {
    if (rowCount > EXPORT_ROW_CAP) {
      write(event("export.refused", "EXPORT_ROW_LIMIT"));
      throw rowLimit(rowCount);
    }

    const zone = timeZone.zone;
    const cellsOf = (table: ExportTable) => table.rows.map((row) => table.columns.map((column) => typedCell(column, row[column.key] ?? null, zone)));
    let bytes: Buffer;
    if (chosen) {
      bytes = writeCsv({ header: chosen.columns.map((column) => column.label), rows: cellsOf(chosen).map((row) => row.map((cell) => cell.csv)) });
    } else {
      const cells = written.map(cellsOf);
      for (const [index, table] of written.entries()) {
        const tooLong = cellTooLong(table.columns, cells[index]);
        if (tooLong !== null) {
          write(event("export.refused", "EXPORT_CELL_TOO_LONG"));
          throw cellLimit(tooLong);
        }
      }
      bytes = await writeWorkbook([
        ...written.map((table, index) => ({
          name: safeSheetName(table.heading),
          header: table.columns.map((column) => column.label),
          rows: cells[index].map((row) => row.map((cell) => cell.sheet)),
          widths: table.columns.map((column) => DEFAULT_WIDTHS[column.type]),
        })),
        buildAboutSheet({ heading: input.heading, description: null, columns: null, rowCount, about: input.about, now, timeZone, exportedBy: actor.displayName }),
      ]);
    }
    write(event("export.completed"));
    return fileOf({ slug: chosen ? chosen.slug : input.slug, format, bytes, rowCount, now, timeZone });
  } catch (error) {
    // As in runListExport: one EXPORT_FAILED line for an attempt that fails after parsing, never a message or a cell.
    if (!logged) write(event("export.refused", error instanceof ExportQueryError ? "INVALID_QUERY" : "EXPORT_FAILED"));
    throw error;
  }
}
