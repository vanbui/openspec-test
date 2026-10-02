import { parse } from 'csv-parse/browser/esm/sync';

import type { AdministrationKind } from './administration-config';
import {
  administrationCsvContracts,
  csvClientPreviewSchema,
  csvRowStates,
  getAdministrationCsvContract,
  CSV_MAX_BYTES,
  CSV_MAX_CHANGES_PER_ROW,
  CSV_MAX_ISSUES_PER_ROW,
  CSV_MAX_RECORD_BYTES,
  CSV_MAX_ROWS,
  type CsvClientPreview,
  type CsvImportCounts,
  type CsvImportIssue,
  type CsvImportPreviewRow,
  type CsvRowState,
  type CsvColumn,
} from './csv-import-schema';

export { CSV_MAX_BYTES, CSV_MAX_ROWS, CSV_MAX_RECORD_BYTES } from './csv-import-schema';

type CsvScalar = string | boolean | number | null;

function csvError(message: string): never {
  throw new Error(`This file can’t be imported: ${message}`);
}

/*
 * The column that matches a CSV row to an existing record, as people name it (D-38, UI-SPEC §17.1): `Control
 * number` for Controls, else `Name`. Strapi's csv-import.ts derives the same label for its own messages.
 */
export function keyLabel(kind: AdministrationKind): 'Control number' | 'Name' {
  return getAdministrationCsvContract(kind).naturalKey === 'controlNumber' ? 'Control number' : 'Name';
}

function assertBytesAndPreflightRecords(bytes: Uint8Array): void {
  if (!bytes || typeof bytes.byteLength !== 'number' || bytes.byteLength === 0) csvError('the file is empty.');
  if (bytes.byteLength > CSV_MAX_BYTES) csvError(`the file exceeds ${CSV_MAX_BYTES} bytes.`);
  let inQuotes = false;
  let recordBytes = 0;
  let recordCount = 1;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index];
    recordBytes += 1;
    if (recordBytes > CSV_MAX_RECORD_BYTES) csvError(`a record exceeds ${CSV_MAX_RECORD_BYTES} bytes.`);
    if (byte === 0x22) {
      if (inQuotes && bytes[index + 1] === 0x22) { index += 1; recordBytes += 1; }
      else inQuotes = !inQuotes;
    } else if (!inQuotes && (byte === 0x0a || byte === 0x0d)) {
      if (byte === 0x0d && bytes[index + 1] === 0x0a) index += 1;
      recordCount += 1;
      recordBytes = 0;
      if (recordCount > CSV_MAX_ROWS + 1) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
    }
  }
  if (recordBytes === 0) recordCount -= 1;
  if (recordCount > CSV_MAX_ROWS + 1) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
}

function normalized(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('en-AU');
}

function parseHeaders(headers: readonly string[], columns: readonly CsvColumn[]): readonly CsvColumn[] {
  const allowed = new Map(columns.map((column) => [normalized(column.field), column]));
  const seen = new Set<string>();
  const resolved = headers.map((header) => {
    const key = normalized(header);
    if (!key) csvError('a header is blank.');
    if (seen.has(key)) csvError('a normalized header is duplicated.');
    seen.add(key);
    const column = allowed.get(key);
    if (!column) csvError('the file contains an unsupported header.');
    return column;
  });
  for (const column of columns) if (column.required && !seen.has(normalized(column.field))) csvError(`the required header ${column.field} is missing.`);
  return resolved;
}

function issue(code: string, field: string | null, message: string): CsvImportIssue {
  return { code: code.slice(0, 100), field: field?.slice(0, 100) ?? null, message: message.slice(0, 500) };
}

function parseCell(column: CsvColumn, raw: string, issues: CsvImportIssue[]): CsvScalar | undefined {
  const value = raw.trim();
  if (!value) {
    if (column.required) issues.push(issue('REQUIRED_VALUE', column.field, `Enter a ${column.field} value.`));
    return undefined;
  }
  if (value.length > column.maxLength) {
    issues.push(issue('VALUE_TOO_LONG', column.field, `${column.field} must be at most ${column.maxLength} characters.`));
    return undefined;
  }
  if (column.type === 'boolean') {
    const lower = value.toLocaleLowerCase('en-AU');
    if (lower !== 'true' && lower !== 'false') { issues.push(issue('INVALID_BOOLEAN', column.field, `${column.field} must be true or false.`)); return undefined; }
    return lower === 'true';
  }
  if (column.type === 'enum') {
    const canonical = column.values?.find((candidate) => candidate.toLocaleLowerCase('en-AU') === value.toLocaleLowerCase('en-AU'));
    if (!canonical) { issues.push(issue('INVALID_ENUM', column.field, `${column.field} has an unsupported value.`)); return undefined; }
    return canonical;
  }
  return value;
}

function scalar(value: unknown): CsvScalar {
  if (typeof value === 'string') return value.slice(0, 10_000);
  return typeof value === 'boolean' || typeof value === 'number' || value === null ? value : null;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copied.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The CSV file could not be read.'));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(new Uint8Array(reader.result))
      : reject(new Error('The CSV file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseAdministrationCsvClient(input: {
  kind: AdministrationKind;
  bytes: Uint8Array;
  existing?: readonly Record<string, unknown>[];
}): Promise<CsvClientPreview> {
  const contract = getAdministrationCsvContract(input.kind);
  assertBytesAndPreflightRecords(input.bytes);
  let decoded: string;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes); }
  catch { return csvError('the file is not valid UTF-8.'); }
  let records: string[][];
  try {
    records = parse(decoded, { bom: true, columns: false, encoding: 'utf8', max_record_size: CSV_MAX_RECORD_BYTES, relax_column_count: false, relax_quotes: false, skip_empty_lines: false, trim: false }) as string[][];
  } catch { return csvError('the CSV structure is malformed.'); }
  if (records.length < 2) csvError('include one header and at least one data row.');
  if (records.length - 1 > CSV_MAX_ROWS) csvError(`the file exceeds ${CSV_MAX_ROWS} data rows.`);
  const columns = parseHeaders(records[0], contract.columns);

  const existingByKey = new Map<string, Record<string, unknown>[]>();
  for (const record of input.existing ?? []) {
    const value = record[contract.naturalKey];
    if (typeof value !== 'string' || !value.trim()) continue;
    const key = normalized(value);
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), record]);
  }
  const drafts = records.slice(1).map((record, index) => {
    const issues: CsvImportIssue[] = [];
    const values: Record<string, CsvScalar> = {};
    columns.forEach((column, columnIndex) => {
      const value = parseCell(column, record[columnIndex] ?? '', issues);
      if (value !== undefined) values[column.field] = value;
    });
    const naturalKey = typeof values[contract.naturalKey] === 'string' ? values[contract.naturalKey] as string : null;
    return { rowNumber: index + 2, values, issues, naturalKey, key: naturalKey ? normalized(naturalKey) : null };
  });
  const duplicates = new Map<string, number>();
  for (const row of drafts) if (row.key) duplicates.set(row.key, (duplicates.get(row.key) ?? 0) + 1);
  const key = keyLabel(input.kind).toLocaleLowerCase('en-AU');

  const rows: CsvImportPreviewRow[] = drafts.map((row) => {
    const matches = row.key ? existingByKey.get(row.key) ?? [] : [];
    if (row.key && (duplicates.get(row.key) ?? 0) > 1) return { rowNumber: row.rowNumber, state: 'ambiguous', naturalKey: row.naturalKey, matchedDocumentId: null, values: row.values, changes: [], issues: [...row.issues, issue('DUPLICATE_CSV_KEY', contract.naturalKey, `This ${key} appears more than once in the file.`)].slice(0, CSV_MAX_ISSUES_PER_ROW) };
    if (matches.length > 1) return { rowNumber: row.rowNumber, state: 'ambiguous', naturalKey: row.naturalKey, matchedDocumentId: null, values: row.values, changes: [], issues: [...row.issues, issue('MULTIPLE_EXISTING_MATCHES', contract.naturalKey, `More than one existing record has this ${key}.`)].slice(0, CSV_MAX_ISSUES_PER_ROW) };
    if (row.issues.length || !row.key) return { rowNumber: row.rowNumber, state: 'rejected', naturalKey: row.naturalKey, matchedDocumentId: null, values: row.values, changes: [], issues: row.issues.slice(0, CSV_MAX_ISSUES_PER_ROW) };
    if (!matches.length) return { rowNumber: row.rowNumber, state: 'create', naturalKey: row.naturalKey, matchedDocumentId: null, values: row.values, changes: [], issues: [] };
    const match = matches[0];
    const authoritativeValues = { ...row.values, ...(typeof match[contract.naturalKey] === 'string' ? { [contract.naturalKey]: match[contract.naturalKey] as string } : {}) };
    const changes = Object.entries(row.values).filter(([field]) => field !== contract.naturalKey).map(([field, after]) => ({ field, before: scalar(match[field]), after })).filter(({ before, after }) => before !== after).slice(0, CSV_MAX_CHANGES_PER_ROW);
    const matchedDocumentId = typeof match.documentId === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(match.documentId) ? match.documentId : null;
    return { rowNumber: row.rowNumber, state: changes.length ? 'update' : 'unchanged', naturalKey: row.naturalKey, matchedDocumentId, values: authoritativeValues, changes, issues: [] };
  });
  const counts = Object.fromEntries(csvRowStates.map((state) => [state, rows.filter((row) => row.state === state).length])) as CsvImportCounts;
  const digest = await sha256(input.bytes);
  return csvClientPreviewSchema.parse({ rows, counts, digest, previewDigest: `sha256:${digest}` });
}

export async function parseAdministrationCsvFile(kind: AdministrationKind, file: File, existing?: readonly Record<string, unknown>[]): Promise<CsvClientPreview> {
  if (!file.name.toLocaleLowerCase('en-AU').endsWith('.csv')) csvError('choose a .csv file.');
  if (file.type && !['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.type.toLocaleLowerCase('en-AU'))) csvError('choose a CSV file.');
  if (file.size > CSV_MAX_BYTES) csvError('the file is too large; choose a file no larger than 5 MiB.');
  return parseAdministrationCsvClient({ kind, bytes: await readFileBytes(file), existing });
}

export async function validateAdministrationCsvFile(kind: AdministrationKind, file: File): Promise<{ rowCount: number; bytes: Uint8Array }> {
  if (!file.name.toLocaleLowerCase('en-AU').endsWith('.csv')) csvError('choose a .csv file.');
  if (file.type && !['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.type.toLocaleLowerCase('en-AU'))) csvError('choose a CSV file.');
  if (file.size > CSV_MAX_BYTES) csvError('the file is too large; choose a file no larger than 5 MiB.');
  const bytes = await readFileBytes(file);
  const preview = await parseAdministrationCsvClient({ kind, bytes });
  return { rowCount: preview.rows.length, bytes };
}

const FORMULA_INITIATORS = /^(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u;
export function sanitizeSpreadsheetCell(value: string): string { return FORMULA_INITIATORS.test(value) ? `'${value}` : value; }

function csvCell(value: unknown): string {
  const safe = sanitizeSpreadsheetCell(value === null || value === undefined ? '' : String(value));
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
function csvDocument(rows: readonly (readonly unknown[])[]): string { return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`; }

export function createAdministrationCsvTemplate(kind: AdministrationKind): string {
  return csvDocument([administrationCsvContracts[kind].columns.map((column) => column.field)]);
}

export function createAdministrationCsvErrorReport(rows: readonly CsvImportPreviewRow[]): string {
  return csvDocument([
    ['rowNumber', 'naturalKey', 'state', 'issues'],
    ...rows.filter((row) => row.state === 'rejected' || row.state === 'ambiguous').slice(0, CSV_MAX_ROWS)
      .map((row) => [row.rowNumber, row.naturalKey ?? '', row.state, row.issues.slice(0, CSV_MAX_ISSUES_PER_ROW).map((item) => `${item.field ? `${item.field}: ` : ''}${item.message}`).join(' | ')]),
  ]);
}

export function createAdministrationCsvResultReport(rows: readonly { rowNumber: number; naturalKey: string | null; state: CsvRowState; documentId?: string; issues?: readonly CsvImportIssue[] }[]): string {
  return csvDocument([
    ['rowNumber', 'naturalKey', 'state', 'documentId', 'issues'],
    ...rows.slice(0, CSV_MAX_ROWS).map((row) => [row.rowNumber, row.naturalKey ?? '', row.state.slice(0, 20), row.documentId?.slice(0, 200) ?? '', (row.issues ?? []).slice(0, CSV_MAX_ISSUES_PER_ROW).map((item) => item.message).join(' | ')]),
  ]);
}

export function sanitizedCsvFileName(value: string): string {
  const safe = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/gu, '-').replace(/\.{2,}/gu, '.').trim().slice(0, 200);
  return safe && safe !== '.' ? (safe.toLocaleLowerCase('en-AU').endsWith('.csv') ? safe : `${safe}.csv`) : 'administration.csv';
}

export function downloadAdministrationCsv(contents: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizedCsvFileName(fileName);
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
