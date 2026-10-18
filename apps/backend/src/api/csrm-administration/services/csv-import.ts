import { createHash } from "node:crypto";

import { importColumns, type ImportColumnSpec } from "../../../csrm/exports/export-vocabulary";
import { headerKey, matchHeaders, type ImportNoteCode } from "../../../csrm/spreadsheets/header-match";
import {
  boundImportTexts,
  ImportFileRefusal,
  readImportFile,
  type ImportCell,
  type ImportFile,
  type ImportFileFormat,
  type ImportRow,
} from "../../../csrm/spreadsheets/import-file";
import { sanitizeSpreadsheetCell } from "../../../csrm/spreadsheets/neutralise";
import { convertCell, type ImportMode, type ImportValueColumn } from "../../../csrm/spreadsheets/value-convert";

import { administrationExactKey, administrationSimilarKey } from "./administration-query";
import { boundServedText, warnServedTextBounded } from "./served-text";
import type { AdministrationKind } from "./administration-config";

export const CSV_MAX_BYTES = 5_242_880;
export const CSV_MAX_ROWS = 5_000;
export const CSV_MAX_RECORD_BYTES = 65_536;
export const CSV_MAX_ISSUES_PER_ROW = 20;
export const CSV_MAX_CHANGES_PER_ROW = 16;

/*
 * The six import row states (D-30; the import record's "Classifications: the Sixth State"): `similar` is a row whose
 * natural key equals a stored one only after NFKC, lower case and collapsed whitespace; it waits for a decision.
 */
export const csvRowStates = ["create", "update", "unchanged", "rejected", "ambiguous", "similar"] as const;
export type CsvRowState = (typeof csvRowStates)[number];
export type CsvScalar = string | boolean | number | null;

export type CsvImportIssue = {
  code: string;
  field: string | null;
  message: string;
};

export type CsvImportChange = {
  field: string;
  before: CsvScalar;
  after: CsvScalar;
};

export type CsvImportRow = {
  rowNumber: number;
  state: CsvRowState;
  naturalKey: string | null;
  matchedDocumentId: string | null;
  matchedUpdatedAt: string | null;
  /** The matched record's stored natural key (its name, or control number): set for update, unchanged and similar. */
  matchedName: string | null;
  values: Readonly<Record<string, CsvScalar>>;
  changes: readonly CsvImportChange[];
  issues: readonly CsvImportIssue[];
};

type Column = {
  field: string;
  required?: true;
  maxLength: number;
  type?: "boolean";
  values?: readonly string[];
};

type CsvContract = {
  naturalKey: "name" | "controlNumber";
  columns: readonly Column[];
};

const text = (field: string, maxLength = 255, required?: true): Column => ({ field, maxLength, ...(required ? { required } : {}) });
const boolean = (field: string): Column => ({ field, maxLength: 5, type: "boolean" });
const enumeration = (field: string, values: readonly string[]): Column => ({ field, maxLength: 255, values });

export const ADMINISTRATION_CSV_CONTRACTS = {
  "risk-types": {
    naturalKey: "name",
    columns: [text("name", 255, true), text("description", 10_000)],
  },
  controls: {
    naturalKey: "controlNumber",
    columns: [
      text("controlNumber", 255, true), text("name", 255, true), text("description", 10_000),
      enumeration("controlType", ["Preventive", "Detective", "Corrective", "Compensating"]),
      text("controlReference", 500), text("framework", 255, true), text("frameworkVersion"),
      text("frameworkSource", 2_000),
    ],
  },
  "information-systems": {
    naturalKey: "name",
    columns: [
      text("name", 255, true), text("description", 10_000), text("systemType"),
      enumeration("environment", ["Production", "Non-production"]),
      enumeration("deploymentModel", ["On-prem", "Cloud", "SaaS"]), text("businessCriticality"),
      boolean("internetFacing"), boolean("externalAccessRequired"), text("hostingLocation", 500),
      enumeration("lifecycleState", ["New", "Changed", "Existing", "Decommissioning"]),
    ],
  },
  "information-assets": {
    naturalKey: "name",
    columns: [
      text("name", 255, true), text("description", 10_000), text("location", 500), text("type"),
      enumeration("dataClassification", ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"]),
      text("confidentialityRating"), text("integrityRating"), text("availabilityRating"),
      boolean("containsPersonalData"), boolean("containsLegalData"), boolean("containsCreditCardData"),
      text("comments", 10_000),
    ],
  },
} as const satisfies Record<AdministrationKind, CsvContract>;

/*
 * The matching column as people name it, lower-cased for a sentence (D-38, UI-SPEC §17.1): the web's
 * csv-client-parser.ts keyLabel gives the same words, so a row reads alike in the preview and the result.
 */
function keyLabel(contract: CsvContract): string {
  return contract.naturalKey === "controlNumber" ? "control number" : "name";
}

function issue(code: string, field: string | null, message: string): CsvImportIssue {
  return { code: code.slice(0, 100), field: field?.slice(0, 100) ?? null, message: message.slice(0, 500) };
}

/** An import column as the shared converters read it (D-28, D-29), from the collection's import vocabulary. */
type MappedColumn = { readonly field: string; readonly required: boolean; readonly value: ImportValueColumn };

function mappedColumn(spec: ImportColumnSpec): MappedColumn {
  const kind = spec.kind === "boolean" ? "flag" : spec.kind;
  return {
    field: spec.field,
    required: spec.required,
    value: {
      field: spec.field,
      label: spec.label,
      kind,
      // A flag always holds Yes or No, so #CLEAR cannot empty it: the converters' required-field rule applies.
      required: spec.required || kind === "flag",
      maxLength: spec.maxLength,
      ...(spec.values ? { values: spec.values } : {}),
    },
  };
}

/** One cell through the shared converters with the row's mode: a value, a clear (null), a blank or an issue. */
function readCell(column: MappedColumn, raw: ImportCell | undefined, mode: ImportMode, values: Record<string, CsvScalar>, issues: CsvImportIssue[]): void {
  const converted = convertCell(raw ?? null, column.value, { mode });
  if (converted.kind === "value") values[column.field] = converted.value;
  else if (converted.kind === "clear") values[column.field] = null;
  else if (converted.kind === "issue") issues.push(issue(converted.code, column.field, converted.message));
  else if (column.required) issues.push(issue("REQUIRED_VALUE", column.field, `Enter a ${column.field} value.`));
}

/** The natural key as typed, trimmed and in NFC: the comparison for the template's example row (D-28). */
function exampleKeyOf(value: string): string {
  return value.trim().normalize("NFC");
}

// AdministrationImportChange bounds `before` and `after` at 10,000 characters.
const CSV_CHANGE_VALUE_MAX_LENGTH = 10_000;

// A stored value beyond the change bound is a data defect no valid write produces: it is shown shortened,
// visibly (served-text.ts), so it never equals a file value and the row updates the record.
function comparable(value: unknown): CsvScalar {
  if (typeof value === "string") return boundServedText(value, CSV_CHANGE_VALUE_MAX_LENGTH);
  if (typeof value === "boolean" || typeof value === "number" || value === null) return value;
  return null;
}

/** A workbook or CSV cell as the text the value checks read (a workbook number is its text; a boolean TRUE or FALSE). */
function cellText(cell: ImportCell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell);
}

function classifyRows(
  contract: CsvContract,
  mapping: readonly (MappedColumn | null)[],
  records: readonly ImportRow[],
  existing: readonly Record<string, unknown>[],
): CsvImportRow[] {
  // Two tiers (D-30): the exact key (trimmed, NFC) and the similar key (NFKC, lower case, collapsed whitespace).
  const existingByExact = new Map<string, Record<string, unknown>[]>();
  const existingBySimilar = new Map<string, Record<string, unknown>[]>();
  for (const record of existing) {
    const keyValue = record[contract.naturalKey];
    if (typeof keyValue !== "string" || !keyValue.trim()) continue;
    const exact = administrationExactKey(keyValue);
    const similar = administrationSimilarKey(keyValue);
    existingByExact.set(exact, [...(existingByExact.get(exact) ?? []), record]);
    existingBySimilar.set(similar, [...(existingBySimilar.get(similar) ?? []), record]);
  }

  const keyIndex = mapping.findIndex((column) => column?.field === contract.naturalKey);
  const drafts = records.map((record) => {
    const issues: CsvImportIssue[] = [];
    const values: Record<string, CsvScalar> = {};
    // Pilot ruling 4: a record over 64 KiB is one rejected row; its values are never read or served.
    if (record.byteLength > CSV_MAX_RECORD_BYTES) {
      issues.push(issue("VALUE_TOO_LONG", null, "This row is too long to import. Shorten its values to under 64 KB."));
      return { rowNumber: record.rowNumber, values, naturalKey: null, exactKey: null, similarKey: null, issues };
    }
    // The key first, so the other cells are read with the row's mode: an update when one record matches.
    const keyColumn = keyIndex >= 0 ? mapping[keyIndex] : null;
    if (keyColumn) readCell(keyColumn, record.cells[keyIndex], "create", values, issues);
    const naturalKey = typeof values[contract.naturalKey] === "string" ? values[contract.naturalKey] as string : null;
    const exactKey = naturalKey ? administrationExactKey(naturalKey) : null;
    const similarKey = naturalKey ? administrationSimilarKey(naturalKey) : null;
    const mode: ImportMode = similarKey && (existingBySimilar.get(similarKey) ?? []).length === 1 ? "update" : "create";
    mapping.forEach((column, columnIndex) => {
      if (column && columnIndex !== keyIndex) readCell(column, record.cells[columnIndex], mode, values, issues);
    });
    return { rowNumber: record.rowNumber, values, naturalKey, exactKey, similarKey, issues };
  });

  // Two rows of one file that match each other, exactly or only by similar key, stay ambiguous.
  const duplicateCounts = new Map<string, number>();
  for (const row of drafts) if (row.similarKey) duplicateCounts.set(row.similarKey, (duplicateCounts.get(row.similarKey) ?? 0) + 1);

  const unmatched = (row: (typeof drafts)[number], state: CsvRowState, issues: readonly CsvImportIssue[]): CsvImportRow => ({
    rowNumber: row.rowNumber, state, naturalKey: row.naturalKey, matchedDocumentId: null, matchedUpdatedAt: null, matchedName: null,
    values: row.values, changes: [], issues: issues.slice(0, CSV_MAX_ISSUES_PER_ROW),
  });

  return drafts.map((row): CsvImportRow => {
    const similarMatches = row.similarKey ? existingBySimilar.get(row.similarKey) ?? [] : [];
    if (row.similarKey && (duplicateCounts.get(row.similarKey) ?? 0) > 1) {
      return unmatched(row, "ambiguous", [...row.issues, issue("DUPLICATE_CSV_KEY", contract.naturalKey, `This ${keyLabel(contract)} appears more than once in the file.`)]);
    }
    if (similarMatches.length > 1) {
      return unmatched(row, "ambiguous", [...row.issues, issue("MULTIPLE_EXISTING_MATCHES", contract.naturalKey, `More than one existing record has this ${keyLabel(contract)}.`)]);
    }
    if (row.issues.length > 0 || !row.exactKey) return unmatched(row, "rejected", row.issues);
    if (similarMatches.length === 0) return unmatched(row, "create", []);

    // One stored record: an exact hit updates as today; a similar-only hit waits for a decision (never a create).
    const matched = similarMatches[0];
    const storedKey = typeof matched[contract.naturalKey] === "string" ? matched[contract.naturalKey] as string : null;
    const exact = storedKey !== null && administrationExactKey(storedKey) === row.exactKey;
    const authoritativeValues = {
      ...row.values,
      ...(storedKey !== null ? { [contract.naturalKey]: storedKey } : {}),
    };
    const changes = Object.entries(row.values)
      .filter(([field]) => field !== contract.naturalKey)
      .map(([field, after]) => ({ field, before: comparable(matched[field]), after }))
      .filter(({ before, after }) => before !== after)
      .slice(0, CSV_MAX_CHANGES_PER_ROW);
    const matchedDocumentId = typeof matched.documentId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(matched.documentId) ? matched.documentId : null;
    const shortened = changes
      .filter(({ field }) => typeof matched[field] === "string" && (matched[field] as string).length > CSV_CHANGE_VALUE_MAX_LENGTH)
      .map(({ field }) => field);
    if (shortened.length > 0) warnServedTextBounded(`CSRM Administration record ${matchedDocumentId ?? "without a valid documentId"}`, shortened);
    const matchedUpdatedAt = typeof matched.updatedAt === "string" ? matched.updatedAt : null;
    const state: CsvRowState = !exact ? "similar" : changes.length > 0 ? "update" : "unchanged";
    return { rowNumber: row.rowNumber, state, naturalKey: row.naturalKey, matchedDocumentId, matchedUpdatedAt, matchedName: storedKey, values: authoritativeValues, changes, issues: [] };
  });
}

/*
 * The closed row-issue vocabulary as an error report writes it (19-14; D-32; 19-UI-SPEC §6 S4): a record keeps only each
 * issue's code and field, and the message is regenerated here, naming the column by its display label. A similar row's
 * message names the stored name it matches.
 */
export function importIssueMessage(kind: AdministrationKind, issue: { readonly code: string; readonly field: string | null }): string {
  const contract: CsvContract = ADMINISTRATION_CSV_CONTRACTS[kind];
  const column = importColumns(kind).columns.find((candidate) => candidate.field === issue.field);
  const label = column?.label ?? issue.field ?? "This value";
  switch (issue.code) {
    case "REQUIRED_VALUE":
      return `Enter a value for ${label}.`;
    case "VALUE_TOO_LONG":
      return column ? `${label} must be at most ${column.maxLength} characters.` : "This row is too long to import. Shorten its values to under 64 KB.";
    case "INVALID_BOOLEAN":
      return `${label} must be Yes or No. Y, N, TRUE and FALSE also work.`;
    case "INVALID_ENUM":
      return `${label} must be one of: ${(column?.values ?? []).join(", ")}.`;
    case "CLEAR_REQUIRED":
      return `${label} is required, so #CLEAR can’t empty it.`;
    case "DUPLICATE_CSV_KEY":
      return `This ${keyLabel(contract)} appears more than once in the file.`;
    case "MULTIPLE_EXISTING_MATCHES":
      return `More than one existing record has this ${keyLabel(contract)}.`;
    case "ROW_PREVIEW_DRIFT":
      return "The row changed after preview. Preview the file again before applying it.";
    case "ROW_WRITE_FAILED":
      return "The row could not be saved. Review the current record and try again.";
    default:
      return "This row can’t be imported as it is.";
  }
}

/** A similar row's issue in an error report (19-UI-SPEC §6 S4): it waits for the person to type the stored name. */
export function similarRowMessage(storedName: string): string {
  return `Matches the existing name “${storedName}” except for capitals or spacing. Type the existing name exactly to update it.`;
}

/** The informational notes a preview carries: the error report's Issues column, read-only columns, the example row. */
export const IMPORT_PREVIEW_NOTES = ["issues-column", "read-only-columns", "example-row"] as const;
export type ImportPreviewNote = ImportNoteCode | (typeof IMPORT_PREVIEW_NOTES)[number];

export type AdministrationImport = {
  format: ImportFileFormat;
  rows: CsvImportRow[];
  counts: Record<CsvRowState, number>;
  /** Unknown headers as typed, ignored (at most 50 of at most 200 characters, controls removed). */
  warnings: readonly string[];
  notes: readonly ImportPreviewNote[];
  /** The display labels of the reference export's read-only columns the file carries, ignored. */
  readOnlyColumns: readonly string[];
};

/**
 * Classifies a file the import reader has read (19-13; D-27): headers map by field name or display label through
 * matchHeaders with the collection's import columns; unknown headers are warnings, and the Issues column and a reference
 * export's read-only columns are notes. A duplicate or missing column refuses the file (ImportFileRefusal).
 */
export function classifyAdministrationImport(input: {
  kind: AdministrationKind;
  file: ImportFile;
  existing?: readonly Record<string, unknown>[];
}): AdministrationImport {
  const contract: CsvContract = ADMINISTRATION_CSV_CONTRACTS[input.kind];
  const spec = importColumns(input.kind);
  const headers = matchHeaders(input.file.header, spec.columns, {
    knownIgnored: { issuesHeader: "Issues", readOnlyLabels: spec.readOnlyLabels },
  });
  const columnsByField = new Map<string, MappedColumn>(spec.columns.map((column) => [column.field, mappedColumn(column)]));
  const mapping = headers.mapping.map((field) => (field === null ? null : columnsByField.get(field) ?? null));
  // The template's example row is skipped with a note (D-28); a file holding only it has no rows to import.
  const keyIndex = headers.mapping.indexOf(contract.naturalKey);
  const exampleKey = exampleKeyOf(spec.exampleKey);
  const records = input.file.rows.filter((row) => keyIndex < 0 || exampleKeyOf(cellText(row.cells[keyIndex])) !== exampleKey);
  if (records.length === 0) throw new ImportFileRefusal("IMPORT_NO_ROWS");
  const notes: ImportPreviewNote[] = [...headers.notes];
  if (records.length < input.file.rows.length) notes.push("example-row");
  const readOnlyByKey = new Map(spec.readOnlyLabels.map((label) => [headerKey(label), label]));
  const readOnlyColumns = [...new Set(input.file.header
    .map((header, index) => (headers.mapping[index] === null ? readOnlyByKey.get(headerKey(header)) : undefined))
    .filter((label): label is string => label !== undefined))];
  const rows = classifyRows(contract, mapping, records, input.existing ?? []);
  const counts = Object.fromEntries(csvRowStates.map((state) => [state, rows.filter((row) => row.state === state).length])) as Record<CsvRowState, number>;
  return {
    format: input.file.format,
    rows,
    counts,
    warnings: headers.warnings,
    notes,
    readOnlyColumns: boundImportTexts(readOnlyColumns),
  };
}

/** Reads and classifies an upload: ImportFileRefusal when the file cannot be read, with its closed reason. */
export async function parseAdministrationImport(input: {
  kind: AdministrationKind;
  bytes: Uint8Array;
  fileName?: string;
  mimeType?: string | null;
  existing?: readonly Record<string, unknown>[];
}): Promise<AdministrationImport & { digest: string; previewDigest: string }> {
  const file = await readImportFile({ bytes: input.bytes, fileName: input.fileName ?? "import.csv", mimeType: input.mimeType ?? null });
  const classified = classifyAdministrationImport({ kind: input.kind, file, existing: input.existing });
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  return { ...classified, digest, previewDigest: `sha256:${digest}` };
}

// The spreadsheet neutraliser lives in csrm/spreadsheets/neutralise.ts (19-03; D-11), re-exported for existing callers.
export { sanitizeSpreadsheetCell };
