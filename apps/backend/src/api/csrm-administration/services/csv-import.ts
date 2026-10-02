import { createHash } from "node:crypto";

import { parse } from "csv-parse/sync";

import { normalizeAdministrationNaturalKey } from "./administration-query";
import type { AdministrationKind } from "./administration-config";

export const CSV_MAX_BYTES = 5_242_880;
export const CSV_MAX_ROWS = 5_000;
export const CSV_MAX_RECORD_BYTES = 65_536;
export const CSV_MAX_ISSUES_PER_ROW = 20;
export const CSV_MAX_CHANGES_PER_ROW = 16;

export const csvRowStates = ["create", "update", "unchanged", "rejected", "ambiguous"] as const;
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

function csvError(message: string): never {
  throw new Error(`This file can’t be imported: ${message}`);
}

/*
 * The matching column as people name it, lower-cased for a sentence (D-38, UI-SPEC §17.1): the web's
 * csv-client-parser.ts keyLabel gives the same words, so a row reads alike in the preview and the result.
 */
function keyLabel(contract: CsvContract): string {
  return contract.naturalKey === "controlNumber" ? "control number" : "name";
}

function assertBytesAndPreflightRecords(bytes: Uint8Array): void {
  if (!bytes || typeof bytes.byteLength !== "number" || bytes.byteLength === 0) csvError("the file is empty.");
  if (bytes.byteLength > CSV_MAX_BYTES) csvError(`the file exceeds ${CSV_MAX_BYTES} bytes.`);

  let inQuotes = false;
  let recordBytes = 0;
  let recordCount = 1;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index];
    recordBytes += 1;
    if (recordBytes > CSV_MAX_RECORD_BYTES) csvError(`a record exceeds ${CSV_MAX_RECORD_BYTES} bytes.`);
    if (byte === 0x22) {
      if (inQuotes && bytes[index + 1] === 0x22) {
        index += 1;
        recordBytes += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (byte === 0x0a || byte === 0x0d)) {
      if (byte === 0x0d && bytes[index + 1] === 0x0a) index += 1;
      recordCount += 1;
      recordBytes = 0;
      if (recordCount > CSV_MAX_ROWS + 1) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
    }
  }
  if (recordBytes === 0) recordCount -= 1;
  if (recordCount > CSV_MAX_ROWS + 1) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return csvError("the file is not valid UTF-8.");
  }
}

function normalizedHeader(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-AU");
}

function parseHeaders(rawHeaders: readonly string[], contract: CsvContract): readonly Column[] {
  const byName = new Map(contract.columns.map((column) => [normalizedHeader(column.field), column]));
  const seen = new Set<string>();
  const columns = rawHeaders.map((header) => {
    const normalized = normalizedHeader(header);
    if (!normalized) csvError("a header is blank.");
    if (seen.has(normalized)) csvError("a normalized header is duplicated.");
    seen.add(normalized);
    const column = byName.get(normalized);
    if (!column) csvError("the file contains an unsupported header.");
    return column;
  });
  for (const column of contract.columns) {
    if (column.required && !seen.has(normalizedHeader(column.field))) csvError(`the required header ${column.field} is missing.`);
  }
  return columns;
}

function issue(code: string, field: string | null, message: string): CsvImportIssue {
  return { code: code.slice(0, 100), field: field?.slice(0, 100) ?? null, message: message.slice(0, 500) };
}

function parseCell(column: Column, raw: string, issues: CsvImportIssue[]): CsvScalar | undefined {
  const value = raw.trim();
  if (!value) {
    if (column.required) issues.push(issue("REQUIRED_VALUE", column.field, `Enter a ${column.field} value.`));
    return undefined;
  }
  if (value.length > column.maxLength) {
    issues.push(issue("VALUE_TOO_LONG", column.field, `${column.field} must be at most ${column.maxLength} characters.`));
    return undefined;
  }
  if (column.type === "boolean") {
    const normalized = value.toLocaleLowerCase("en-AU");
    if (normalized !== "true" && normalized !== "false") {
      issues.push(issue("INVALID_BOOLEAN", column.field, `${column.field} must be true or false.`));
      return undefined;
    }
    return normalized === "true";
  }
  if (column.values) {
    const canonical = column.values.find((candidate) => candidate.toLocaleLowerCase("en-AU") === value.toLocaleLowerCase("en-AU"));
    if (!canonical) {
      issues.push(issue("INVALID_ENUM", column.field, `${column.field} must be one of: ${column.values.join(", ")}.`));
      return undefined;
    }
    return canonical;
  }
  return value;
}

function comparable(value: unknown): CsvScalar {
  if (typeof value === "string") return value.slice(0, 10_000);
  if (typeof value === "boolean" || typeof value === "number" || value === null) return value;
  return null;
}

function classifyRows(
  contract: CsvContract,
  columns: readonly Column[],
  records: readonly string[][],
  existing: readonly Record<string, unknown>[],
): CsvImportRow[] {
  const existingByKey = new Map<string, Record<string, unknown>[]>();
  for (const record of existing) {
    const keyValue = record[contract.naturalKey];
    if (typeof keyValue !== "string" || !keyValue.trim()) continue;
    const key = normalizeAdministrationNaturalKey(keyValue);
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), record]);
  }

  const drafts = records.map((record, index) => {
    const issues: CsvImportIssue[] = [];
    const values: Record<string, CsvScalar> = {};
    columns.forEach((column, columnIndex) => {
      const value = parseCell(column, record[columnIndex] ?? "", issues);
      if (value !== undefined) values[column.field] = value;
    });
    const naturalKey = typeof values[contract.naturalKey] === "string" ? values[contract.naturalKey] as string : null;
    return { rowNumber: index + 2, values, naturalKey, normalizedKey: naturalKey ? normalizeAdministrationNaturalKey(naturalKey) : null, issues };
  });

  const duplicateCounts = new Map<string, number>();
  for (const row of drafts) if (row.normalizedKey) duplicateCounts.set(row.normalizedKey, (duplicateCounts.get(row.normalizedKey) ?? 0) + 1);

  return drafts.map((row): CsvImportRow => {
    const matches = row.normalizedKey ? existingByKey.get(row.normalizedKey) ?? [] : [];
    if (row.normalizedKey && (duplicateCounts.get(row.normalizedKey) ?? 0) > 1) {
      return { rowNumber: row.rowNumber, state: "ambiguous", naturalKey: row.naturalKey, matchedDocumentId: null, matchedUpdatedAt: null, values: row.values, changes: [], issues: [...row.issues, issue("DUPLICATE_CSV_KEY", contract.naturalKey, `This ${keyLabel(contract)} appears more than once in the file.`)].slice(0, CSV_MAX_ISSUES_PER_ROW) };
    }
    if (matches.length > 1) {
      return { rowNumber: row.rowNumber, state: "ambiguous", naturalKey: row.naturalKey, matchedDocumentId: null, matchedUpdatedAt: null, values: row.values, changes: [], issues: [...row.issues, issue("MULTIPLE_EXISTING_MATCHES", contract.naturalKey, `More than one existing record has this ${keyLabel(contract)}.`)].slice(0, CSV_MAX_ISSUES_PER_ROW) };
    }
    if (row.issues.length > 0 || !row.normalizedKey) {
      return { rowNumber: row.rowNumber, state: "rejected", naturalKey: row.naturalKey, matchedDocumentId: null, matchedUpdatedAt: null, values: row.values, changes: [], issues: row.issues.slice(0, CSV_MAX_ISSUES_PER_ROW) };
    }
    if (matches.length === 0) {
      return { rowNumber: row.rowNumber, state: "create", naturalKey: row.naturalKey, matchedDocumentId: null, matchedUpdatedAt: null, values: row.values, changes: [], issues: [] };
    }

    const matched = matches[0];
    const authoritativeValues = {
      ...row.values,
      ...(typeof matched[contract.naturalKey] === "string" ? { [contract.naturalKey]: matched[contract.naturalKey] as string } : {}),
    };
    const changes = Object.entries(row.values)
      .filter(([field]) => field !== contract.naturalKey)
      .map(([field, after]) => ({ field, before: comparable(matched[field]), after }))
      .filter(({ before, after }) => before !== after)
      .slice(0, CSV_MAX_CHANGES_PER_ROW);
    const matchedDocumentId = typeof matched.documentId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(matched.documentId) ? matched.documentId : null;
    const matchedUpdatedAt = typeof matched.updatedAt === "string" ? matched.updatedAt : null;
    return { rowNumber: row.rowNumber, state: changes.length > 0 ? "update" : "unchanged", naturalKey: row.naturalKey, matchedDocumentId, matchedUpdatedAt, values: authoritativeValues, changes, issues: [] };
  });
}

export function parseAdministrationCsv(input: {
  kind: AdministrationKind;
  bytes: Uint8Array;
  existing?: readonly Record<string, unknown>[];
}): {
  rows: CsvImportRow[];
  counts: Record<CsvRowState, number>;
  digest: string;
  previewDigest: string;
} {
  const contract = ADMINISTRATION_CSV_CONTRACTS[input.kind];
  if (!contract) csvError("the collection is not supported.");
  assertBytesAndPreflightRecords(input.bytes);
  const decoded = decodeUtf8(input.bytes);
  let records: string[][];
  try {
    records = parse(decoded, {
      bom: true,
      columns: false,
      encoding: "utf8",
      max_record_size: CSV_MAX_RECORD_BYTES,
      relax_column_count: false,
      relax_quotes: false,
      skip_empty_lines: false,
      trim: false,
    }) as string[][];
  } catch {
    return csvError("the CSV structure is malformed.");
  }
  if (records.length < 2) csvError("include one header and at least one data row.");
  if (records.length - 1 > CSV_MAX_ROWS) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
  const columns = parseHeaders(records[0], contract);
  const rows = classifyRows(contract, columns, records.slice(1), input.existing ?? []);
  const counts = Object.fromEntries(csvRowStates.map((state) => [state, rows.filter((row) => row.state === state).length])) as Record<CsvRowState, number>;
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  return { rows, counts, digest, previewDigest: `sha256:${digest}` };
}

const FORMULA_INITIATORS = /^(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u;

export function sanitizeSpreadsheetCell(value: string): string {
  return FORMULA_INITIATORS.test(value) ? `'${value}` : value;
}
