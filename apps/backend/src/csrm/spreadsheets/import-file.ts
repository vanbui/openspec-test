import path from "node:path";

import { parse } from "csv-parse/sync";

import type { ConflictReason } from "../conflict-reasons";
import { decodeXml } from "../files/ooxml-text";
import {
  findZipEntry,
  readZipDirectory,
  readZipEntry,
  ZipArchiveError,
  type ZipArchiveErrorCode,
  type ZipBounds,
  type ZipDirectory,
} from "../files/zip-archive";
import { readFirstSheet, xlsxCellText, XlsxReadError, type XlsxCell } from "./xlsx-reader";

/*
 * CSRM's one import reader (19-03; D-25, D-26, docs/contract-gaps/phase-19-import-tolerance.md "File Refusals").
 * An upload is either read into its header and rows, or refused with one closed reason and safe found details.
 *
 * - The extension must be `.csv` or `.xlsx`; the MIME type is advisory, but one outside the allowed set is refused.
 * - The file is at most 5 MiB.
 * - The signature decides the path, never the extension: `PK\x03\x04` is a workbook, a Compound File Binary is a legacy
 *   `.xls` or an encrypted workbook, a UTF-16 byte order mark or a NUL byte is UTF-16, and anything else is CSV text.
 * - CSV is strict UTF-8 (a BOM is dropped); CSRM never decodes a legacy encoding, because a wrong guess silently
 *   corrupts names. A header line with no comma but a semicolon or a tab is the wrong delimiter.
 * - A workbook is checked against the import bounds (512 entries, 50 MiB declared, ratio 200, no ZIP64) before anything
 *   is inflated; then every entry is inflated against one 50 MiB budget, macros are checked, the first sheet is
 *   rewritten to its valued cells and the rows that hold them (valuedSheet) and held to the caps, and only then does
 *   xlsx-reader.ts (the one module that names the reading library) read that rewritten sheet, every other sheet withheld.
 * - Both: the first row is the header, trailing fully blank rows are dropped, and there are 1 to 5,000 data rows. A row
 *   over 64 KiB is returned with its byte length, for the classifier to reject as VALUE_TOO_LONG; the file stands.
 */

/** The administration import's bounds (csv-import.ts CSV_MAX_BYTES, CSV_MAX_ROWS, CSV_MAX_RECORD_BYTES). */
export const IMPORT_MAX_BYTES = 5_242_880;
export const IMPORT_MAX_ROWS = 5_000;
export const IMPORT_MAX_RECORD_BYTES = 65_536;

/** D-26's archive bounds for an imported workbook (19-RESEARCH Pattern 5). */
export const XLSX_IMPORT_MAX_ENTRIES = 512;
export const XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES = 52_428_800;
/** The widest first-sheet used range read (the reader pads every row to it); wider is IMPORT_WORKBOOK_TOO_LARGE. */
export const XLSX_IMPORT_MAX_COLUMNS = 1_024;

export const XLSX_IMPORT_BOUNDS: Readonly<ZipBounds> = Object.freeze({
  maxEntries: XLSX_IMPORT_MAX_ENTRIES,
  maxDeclaredTotal: XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES,
  maxRatio: 200,
});

export type ImportFileFormat = "csv" | "xlsx";
export type ImportCell = string | number | boolean | null;

export interface ImportRow {
  /** The row's number in the file as a spreadsheet shows it: the header is row 1. */
  readonly rowNumber: number;
  readonly cells: readonly ImportCell[];
  /** The UTF-8 length of the row's cells as text, plus one per separator. */
  readonly byteLength: number;
}

export interface ImportFile {
  readonly format: ImportFileFormat;
  readonly header: readonly string[];
  readonly rows: readonly ImportRow[];
}

/** The closed reasons an import file is refused with (19-02's IMPORT_ codes, less the two commit-step reasons). */
export const IMPORT_FILE_REFUSAL_REASONS = Object.freeze([
  "IMPORT_FILE_TYPE",
  "IMPORT_FILE_TOO_LARGE",
  "IMPORT_TOO_MANY_ROWS",
  "IMPORT_ENCODING_WINDOWS_1252",
  "IMPORT_ENCODING_UTF16",
  "IMPORT_ENCODING_UNKNOWN",
  "IMPORT_DELIMITER",
  "IMPORT_LEGACY_XLS",
  "IMPORT_MACRO_WORKBOOK",
  "IMPORT_ENCRYPTED_WORKBOOK",
  "IMPORT_WORKBOOK_TOO_LARGE",
  "IMPORT_NO_HEADER",
  "IMPORT_NO_ROWS",
  "IMPORT_DUPLICATE_HEADER",
  "IMPORT_MISSING_COLUMN",
  // The import record's Phase 19 execution amendment (2026-10-17): a CSV the parser cannot read.
  "IMPORT_CSV_MALFORMED",
] as const satisfies readonly ConflictReason[]);

export type ImportFileRefusalReason = (typeof IMPORT_FILE_REFUSAL_REASONS)[number];

export function isImportFileRefusalReason(value: unknown): value is ImportFileRefusalReason {
  return typeof value === "string" && (IMPORT_FILE_REFUSAL_REASONS as readonly string[]).includes(value);
}

/**
 * The closed `found` details: integers, the delimiter, and at most 20 strings of at most 200 characters. `line` (a
 * positive integer, the CSV parser's 1-based source line) is sent only with IMPORT_CSV_MALFORMED.
 */
export interface ImportRefusalFound {
  readonly bytes?: number;
  readonly rows?: number;
  readonly line?: number;
  readonly delimiter?: "semicolon" | "tab";
  readonly headers?: readonly string[];
  readonly labels?: readonly string[];
}

export const IMPORT_FOUND_MAX_ITEMS = 20;
export const IMPORT_FOUND_MAX_LENGTH = 200;

/** C0 and C1 controls, DEL, and the bidirectional marks, embeddings, overrides and isolates. */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

/**
 * At most `maxItems` texts from a file, each with controls removed and at most `maxLength` characters. A text that
 * is empty once its controls are removed is dropped, so no bounded list ever holds `""` (BE3-02: the preview's
 * `warnings`, `readOnlyColumns` and `found` items are `minLength: 1`).
 */
export function boundImportTexts(values: readonly string[], maxItems = IMPORT_FOUND_MAX_ITEMS, maxLength = IMPORT_FOUND_MAX_LENGTH): string[] {
  return values
    .map((value) => Array.from(value.replace(UNSAFE_TEXT, "")).slice(0, maxLength).join(""))
    .filter((value) => value !== "")
    .slice(0, maxItems);
}

const safeFoundText = (values: readonly string[]): string[] => boundImportTexts(values);

function boundFound(found: ImportRefusalFound): ImportRefusalFound {
  const bounded: { -readonly [Key in keyof ImportRefusalFound]: ImportRefusalFound[Key] } = {};
  if (found.bytes !== undefined) bounded.bytes = found.bytes;
  if (found.rows !== undefined) bounded.rows = found.rows;
  if (found.line !== undefined && Number.isSafeInteger(found.line) && found.line > 0) bounded.line = found.line;
  if (found.delimiter !== undefined) bounded.delimiter = found.delimiter;
  if (found.headers !== undefined) bounded.headers = safeFoundText(found.headers);
  if (found.labels !== undefined) bounded.labels = safeFoundText(found.labels);
  return bounded;
}

/** 415 for the wrong type, 413 for too large, 422 for every other file refusal (19-02, conflict-reasons.ts). */
export function importRefusalStatus(reason: ImportFileRefusalReason): 413 | 415 | 422 {
  if (reason === "IMPORT_FILE_TYPE") return 415;
  if (reason === "IMPORT_FILE_TOO_LARGE") return 413;
  return 422;
}

export class ImportFileRefusal extends Error {
  readonly reason: ImportFileRefusalReason;
  readonly status: 413 | 415 | 422;
  readonly found?: ImportRefusalFound;

  constructor(reason: ImportFileRefusalReason, found?: ImportRefusalFound) {
    super(reason);
    this.name = "ImportFileRefusal";
    this.reason = reason;
    this.status = importRefusalStatus(reason);
    if (found !== undefined) this.found = boundFound(found);
  }
}

/** Each ZIP reader refusal as exactly one import reason (an unmapped code fails to compile). */
export const ZIP_ERROR_REASONS: Readonly<Record<ZipArchiveErrorCode, ImportFileRefusalReason>> = Object.freeze({
  ZIP_MALFORMED: "IMPORT_FILE_TYPE",
  ZIP_COMMENT: "IMPORT_FILE_TYPE",
  ZIP_METHOD_UNSUPPORTED: "IMPORT_FILE_TYPE",
  ZIP_ENCRYPTED: "IMPORT_ENCRYPTED_WORKBOOK",
  ZIP_TOO_MANY_ENTRIES: "IMPORT_WORKBOOK_TOO_LARGE",
  ZIP_TOO_LARGE: "IMPORT_WORKBOOK_TOO_LARGE",
  ZIP_RATIO: "IMPORT_WORKBOOK_TOO_LARGE",
  ZIP64_UNSUPPORTED: "IMPORT_WORKBOOK_TOO_LARGE",
  ZIP_INFLATE_LIMIT: "IMPORT_WORKBOOK_TOO_LARGE",
});

function zipRefusal(error: unknown): ImportFileRefusal {
  if (error instanceof ZipArchiveError) return new ImportFileRefusal(ZIP_ERROR_REASONS[error.code]);
  return new ImportFileRefusal("IMPORT_FILE_TYPE");
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ALLOWED_MIME: Readonly<Record<ImportFileFormat, readonly string[]>> = Object.freeze({
  csv: ["", "application/octet-stream", "text/csv", "application/vnd.ms-excel"],
  xlsx: ["", "application/octet-stream", XLSX_MIME],
});

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ENCRYPTED_PACKAGE = Buffer.from("EncryptedPackage", "utf16le");
const SNIFF_LENGTH = 4_096;
/** The five bytes Windows-1252 leaves undefined: a file holding one is in some other encoding. */
const UNDEFINED_IN_WINDOWS_1252 = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

function startsWith(bytes: Buffer, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function extensionFormat(fileName: string): ImportFileFormat | null {
  const extension = path.extname(fileName.trim()).toLowerCase();
  if (extension === ".csv") return "csv";
  if (extension === ".xlsx") return "xlsx";
  return null;
}

function cellText(cell: ImportCell): string {
  if (cell === null) return "";
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell);
}

function isBlank(cell: ImportCell): boolean {
  return cell === null || (typeof cell === "string" && cell.trim() === "");
}

function rowByteLength(cells: readonly ImportCell[]): number {
  return cells.reduce<number>((total, cell) => total + Buffer.byteLength(cellText(cell), "utf8"), Math.max(cells.length - 1, 0));
}

/** The shape rules both formats share: a header, trailing blank rows dropped, 1 to 5,000 data rows. */
function shapeRows(format: ImportFileFormat, rows: readonly (readonly ImportCell[])[]): ImportFile {
  const header = rows[0];
  if (!header || header.length === 0 || header.every(isBlank)) throw new ImportFileRefusal("IMPORT_NO_HEADER");
  let end = rows.length;
  while (end > 1 && rows[end - 1].every(isBlank)) end -= 1;
  const data = rows.slice(1, end);
  if (data.length === 0) throw new ImportFileRefusal("IMPORT_NO_ROWS");
  if (data.length > IMPORT_MAX_ROWS) throw new ImportFileRefusal("IMPORT_TOO_MANY_ROWS", { rows: data.length });
  return {
    format,
    header: header.map(cellText),
    rows: data.map((cells, index) => ({ rowNumber: index + 2, cells, byteLength: rowByteLength(cells) })),
  };
}

// CSV.

function decodeStrictUtf8(bytes: Buffer): string {
  try {
    // A UTF-8 byte order mark is dropped by the decoder.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    for (const byte of bytes) {
      if (UNDEFINED_IN_WINDOWS_1252.has(byte)) throw new ImportFileRefusal("IMPORT_ENCODING_UNKNOWN");
    }
    throw new ImportFileRefusal("IMPORT_ENCODING_WINDOWS_1252");
  }
}

/**
 * Counts records without building them, quote-aware: how many records run to the last one that is not blank (only
 * commas, quotes and whitespace), and where that record ends. Trailing blank records are never parsed, so a file of
 * five million empty lines costs a scan, not five million arrays.
 */
function scanCsvRecords(text: string): { records: number; end: number } {
  let inQuotes = false;
  let content = false;
  let records = 0;
  let lastContent = 0;
  let end = 0;
  let started = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    started = true;
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (character === "\n" || character === "\r")) {
      records += 1;
      if (content) {
        lastContent = records;
        end = index;
      }
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      content = false;
      started = false;
      continue;
    }
    if (character !== "," && !/\s/u.test(character)) content = true;
  }
  if (started) {
    records += 1;
    if (content) {
      lastContent = records;
      end = text.length;
    }
  }
  return { records: lastContent, end };
}

function readCsv(bytes: Buffer): ImportFile {
  const text = decodeStrictUtf8(bytes);
  const headerLine = /^[^\r\n]*/u.exec(text)?.[0] ?? "";
  if (!headerLine.includes(",")) {
    if (headerLine.includes(";")) throw new ImportFileRefusal("IMPORT_DELIMITER", { delimiter: "semicolon" });
    if (headerLine.includes("\t")) throw new ImportFileRefusal("IMPORT_DELIMITER", { delimiter: "tab" });
  }
  const { records, end } = scanCsvRecords(text);
  if (records === 0) throw new ImportFileRefusal("IMPORT_NO_HEADER");
  if (records - 1 > IMPORT_MAX_ROWS) throw new ImportFileRefusal("IMPORT_TOO_MANY_ROWS", { rows: records - 1 });
  let parsed: string[][];
  try {
    parsed = parse(text.slice(0, end), {
      bom: true,
      columns: false,
      encoding: "utf8",
      // The file bound, so one long record never refuses the file: the classifier rejects that row instead.
      max_record_size: IMPORT_MAX_BYTES,
      relax_column_count: false,
      relax_quotes: false,
      skip_empty_lines: false,
      trim: false,
    }) as string[][];
  } catch (error) {
    // A real CSV with a broken row: its own reason, with the parser's line number and never the line's content.
    const line = typeof error === "object" && error !== null ? (error as { lines?: unknown }).lines : undefined;
    const found = typeof line === "number" && Number.isSafeInteger(line) && line > 0 ? { line } : undefined;
    throw new ImportFileRefusal("IMPORT_CSV_MALFORMED", found);
  }
  return shapeRows("csv", parsed);
}

// XLSX.

/** The parts the reading library reads (its own filter): the guard keeps each of them until the first sheet is known. */
const READ_PART = /\.xml(\.rels)?$/iu;

/**
 * The longest run between a tag's name and its `>` that a checked part may carry (T-19-06). A real `<sheet>`,
 * `<Relationship>`, `<sheetData>`, `<dimension>`, `<row>`, `<c>`, `<v>` or `<t>` tag is far shorter.
 */
export const XML_TAG_ATTRIBUTES_MAX = 8_192;

/** One tag a checked part holds, as the guard reads it. */
type XmlTag = {
  /** The index of the tag's `<`, and the index just past its `>`. */
  readonly start: number;
  readonly end: number;
  readonly closing: boolean;
  /** The namespace prefix with its colon, or "". */
  readonly prefix: string;
  readonly local: string;
  /** The text between the name and the `>`, less a self-closing `/`. */
  readonly attributes: string;
  readonly selfClosing: boolean;
};

/** `[\w.-]`: a character of an XML name as the guard reads one. */
function isXmlNameCode(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f || code === 0x2e || code === 0x2d;
}

/**
 * The next tag named one of `names` at or after `from` (T-19-06, 19-SECURITY.md): one forward scan with `indexOf`
 * that reads each named tag's attributes to its `>` once, quotes honoured, so no tag is ever scanned twice. A named
 * tag with no `>` (or an unclosed quote), or with attributes longer than XML_TAG_ATTRIBUTES_MAX, is refused as
 * IMPORT_FILE_TYPE, where an open-ended pattern would rescan the rest of the part for every later tag.
 */
function nextXmlTag(xml: string, from: number, names: ReadonlySet<string>): XmlTag | undefined {
  const end = xml.length;
  for (let start = xml.indexOf("<", from); start !== -1; start = xml.indexOf("<", start + 1)) {
    let cursor = start + 1;
    const closing = xml.charCodeAt(cursor) === 0x2f;
    if (closing) cursor += 1;
    const nameStart = cursor;
    while (cursor < end && isXmlNameCode(xml.charCodeAt(cursor))) cursor += 1;
    let localStart = nameStart;
    if (cursor > nameStart && xml.charCodeAt(cursor) === 0x3a) {
      cursor += 1;
      localStart = cursor;
      while (cursor < end && isXmlNameCode(xml.charCodeAt(cursor))) cursor += 1;
    }
    const local = xml.slice(localStart, cursor);
    if (!names.has(local)) continue;
    const attributesStart = cursor;
    let quote = 0;
    for (; cursor < end; cursor += 1) {
      if (cursor - attributesStart > XML_TAG_ATTRIBUTES_MAX) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
      const code = xml.charCodeAt(cursor);
      if (quote !== 0) {
        if (code === quote) quote = 0;
      } else if (code === 0x22 || code === 0x27) {
        quote = code;
      } else if (code === 0x3e) {
        break;
      }
    }
    if (cursor >= end) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
    const selfClosing = cursor > attributesStart && xml.charCodeAt(cursor - 1) === 0x2f;
    return {
      start,
      end: cursor + 1,
      closing,
      prefix: xml.slice(nameStart, localStart),
      local,
      attributes: xml.slice(attributesStart, selfClosing ? cursor - 1 : cursor),
      selfClosing,
    };
  }
  return undefined;
}

/** The first opening (or, with `closing`, closing) tag named `name` at or after `from`. */
function findXmlTag(xml: string, from: number, names: ReadonlySet<string>, closing = false): XmlTag | undefined {
  for (let tag = nextXmlTag(xml, from, names); tag !== undefined; tag = nextXmlTag(xml, tag.end, names)) {
    if (tag.closing === closing) return tag;
  }
  return undefined;
}

const SHEET_TAG = new Set(["sheet"]);
const RELATIONSHIP_TAG = new Set(["Relationship"]);
const SHEET_DATA_TAG = new Set(["sheetData"]);
const DIMENSION_TAG = new Set(["dimension"]);
const ROW_OR_CELL_TAG = new Set(["row", "c"]);
const VALUE_TAG = new Set(["v", "t"]);
const CELL_TAG = new Set(["c"]);

function attribute(attributes: string, name: RegExp): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name.source}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "u");
  const match = pattern.exec(attributes);
  return match ? match[1] ?? match[2] : undefined;
}

/**
 * The first sheet's part name, as the reader resolves it: the workbook's first `<sheet>` that has a name (the reader
 * skips a nameless one), then its relationship's target. Undefined when it cannot be resolved.
 */
function firstSheetPart(workbook: string | undefined, relationships: string | undefined): string | undefined {
  if (!workbook || !relationships) return undefined;
  let id: string | undefined;
  // T-19-06: one linear scan per part, never an open-ended pattern over the upload.
  for (let sheet = findXmlTag(workbook, 0, SHEET_TAG); sheet !== undefined; sheet = findXmlTag(workbook, sheet.end, SHEET_TAG)) {
    if (!attribute(sheet.attributes, /name/)) continue;
    id = attribute(sheet.attributes, /[\w.-]+:id/) ?? attribute(sheet.attributes, /id/);
    break;
  }
  if (!id) return undefined;
  for (let match = findXmlTag(relationships, 0, RELATIONSHIP_TAG); match !== undefined; match = findXmlTag(relationships, match.end, RELATIONSHIP_TAG)) {
    if (attribute(match.attributes, /Id/) !== id) continue;
    const target = attribute(match.attributes, /Target/);
    if (!target) return undefined;
    const resolved = target.startsWith("/") ? target.slice(1) : path.posix.normalize(`xl/${target}`);
    return resolved.toLowerCase();
  }
  return undefined;
}

/** A cell reference as the reader parses it, or a refusal: a crafted reference must never be under-counted. */
function cellReference(reference: string): { row: number; column: number } {
  const match = /^([A-Z]+)([0-9]+)$/u.exec(reference);
  if (!match) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  let column = 0;
  for (const letter of match[1]) column = column * 26 + (letter.charCodeAt(0) - 64);
  return { row: Number(match[2]), column };
}

/** A `<row r>` number, or undefined when the row has none (the reader then numbers it from its first cell or the last row). */
function rowReference(attributes: string): number | undefined {
  const reference = attribute(attributes, /r/);
  if (reference === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(reference)) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  return Number(reference);
}

/**
 * A cell the reader reads a value from: a `<v>` (a number, a shared-string index, a boolean, an error or a formula's
 * cached value) or an inline string's `<t>` with content. A cell with neither is empty to the reader: a styled empty
 * cell, a `<v/>`, an empty inline string, and a formula with no cached value (`<f>` without `<v>`, which the reader
 * reads as an empty cell today, since it returns cached values only, never formulas). Content is text that is not
 * markup, or a CDATA section holding at least one character.
 */
function hasValueContent(content: string): boolean {
  for (let tag = findXmlTag(content, 0, VALUE_TAG); tag !== undefined; tag = findXmlTag(content, tag.end, VALUE_TAG)) {
    if (tag.end >= content.length) return false;
    if (content.charCodeAt(tag.end) !== 0x3c) return true;
    if (content.startsWith("<![CDATA[", tag.end) && tag.end + 9 < content.length && content[tag.end + 9] !== "]") return true;
  }
  return false;
}

/** The part with every `<dimension/>`, or `<dimension>` holding text alone, removed (BE3-01). */
function withoutDimension(part: string): string {
  const kept: string[] = [];
  let last = 0;
  for (let tag = findXmlTag(part, 0, DIMENSION_TAG); tag !== undefined; tag = findXmlTag(part, tag.end, DIMENSION_TAG)) {
    let end = tag.end;
    if (!tag.selfClosing) {
      const textEnd = part.indexOf("<", tag.end);
      const close = textEnd === -1 ? undefined : nextXmlTag(part, textEnd, DIMENSION_TAG);
      if (close === undefined || close.start !== textEnd || !close.closing) continue;
      end = close.end;
    }
    kept.push(part.slice(last, tag.start));
    last = end;
  }
  kept.push(part.slice(last));
  return kept.join("");
}

/**
 * The checked sheet as the reader is given it (BE3-01, Phase 19 code review, refined by the pilot's ruling): one
 * linear scan over the sheet XML (T-19-06: each tag is found with `indexOf` and read to its `>` once, and a tag with no
 * `>` is refused) that keeps only the valued cells and the rows that hold them, each row with its
 * explicit number, and drops the `<dimension>`. Real workbooks carry formatted empty rows, styled empty cells and a
 * whole-sheet dimension; the reader would pad one row per row index up to each of them, so the rewrite makes such a
 * file (and a bomb built from them) harmless, and the 1,024-column and 5,000-row caps then apply to valued cells only,
 * which bound everything the reader allocates.
 *
 * Rows are numbered as the reader numbers them: a row's `r`, else its first cell's row, else the row after the last;
 * an empty row dropped here still advances that count. A reference the reader could read differently (an entity, an
 * exponent, a lower-case letter) is refused as IMPORT_FILE_TYPE rather than guessed at, and so is a valued cell outside
 * any row, which the reader cannot place. Every valued cell is kept byte for byte, so what the reader returns for a
 * valued cell is unchanged.
 */
function valuedSheet(xml: string): { xml: string; rows: number; columns: number } {
  const open = findXmlTag(xml, 0, SHEET_DATA_TAG);
  const declared = (part: string) => part.replace(/^﻿?<\?xml\b[^?]*\?>/u, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  if (!open) return { xml: declared(withoutDimension(xml)), rows: 0, columns: 0 };
  const contentStart = open.end;
  if (open.selfClosing) return { xml: declared(withoutDimension(xml.slice(0, contentStart))) + xml.slice(contentStart), rows: 0, columns: 0 };
  const closing = findXmlTag(xml, contentStart, SHEET_DATA_TAG, true);
  if (!closing) throw new ImportFileRefusal("IMPORT_FILE_TYPE");

  const kept: string[] = [];
  let rows = 0;
  let columns = 0;
  let last = 0;
  let open_: { number: number | undefined; prefix: string; cells: string[] } | undefined;
  const finishRow = (): void => {
    if (!open_) return;
    last = Math.max(last + 1, open_.number ?? 0);
    if (open_.cells.length > 0) {
      kept.push(`<${open_.prefix}row r="${last}">${open_.cells.join("")}</${open_.prefix}row>`);
      rows = Math.max(rows, last);
    }
    open_ = undefined;
  };
  const body = xml.slice(contentStart, closing.start);
  for (let element = nextXmlTag(body, 0, ROW_OR_CELL_TAG), next = 0; element !== undefined; element = nextXmlTag(body, next, ROW_OR_CELL_TAG)) {
    const { attributes, prefix } = element;
    next = element.end;
    if (element.local === "row") {
      finishRow();
      if (element.closing) continue;
      open_ = { number: rowReference(attributes), prefix, cells: [] };
      if (element.selfClosing) finishRow();
      continue;
    }
    if (element.closing) continue;
    let cellXml = body.slice(element.start, element.end);
    let content = "";
    if (!element.selfClosing) {
      // The cell's own close, `</{prefix}c>`: the same linear scan, from the cell's `>` on.
      let cellEnd: XmlTag | undefined;
      for (let tag = nextXmlTag(body, element.end, CELL_TAG); tag !== undefined; tag = nextXmlTag(body, tag.end, CELL_TAG)) {
        if (tag.closing && tag.prefix === prefix && tag.attributes.trim() === "") {
          cellEnd = tag;
          break;
        }
      }
      if (!cellEnd) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
      content = body.slice(element.end, cellEnd.start);
      cellXml = body.slice(element.start, cellEnd.end);
      next = cellEnd.end;
    }
    const reference = attribute(attributes, /r/);
    const cell = reference === undefined ? undefined : cellReference(reference);
    if (cell && open_ && open_.number === undefined) open_.number = cell.row;
    if (!hasValueContent(content)) continue;
    if (!open_) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
    if (cell) columns = Math.max(columns, cell.column);
    open_.cells.push(cellXml);
  }
  finishRow();
  return {
    xml: `${declared(withoutDimension(xml.slice(0, contentStart)))}${kept.join("")}${xml.slice(closing.start)}`,
    rows,
    columns,
  };
}

function xlsxImportCell(cell: XlsxCell): ImportCell {
  if (cell instanceof Date) return xlsxCellText(cell) || null;
  return cell;
}

async function readXlsx(bytes: Buffer): Promise<ImportFile> {
  let directory: ZipDirectory;
  try {
    directory = readZipDirectory(bytes, XLSX_IMPORT_BOUNDS);
  } catch (error) {
    throw zipRefusal(error);
  }
  if (findZipEntry(directory, "xl/vbaProject.bin")) throw new ImportFileRefusal("IMPORT_MACRO_WORKBOOK");

  // Every entry inflates against one budget before the reader sees the archive; every part the reader could read is
  // kept until the first sheet is known, because that sheet may be stored at any part name (BE3-01).
  const parts = new Map<string, Buffer>();
  let remaining = XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES;
  for (const entry of directory.entries) {
    let data: Buffer;
    try {
      data = readZipEntry(bytes, entry, { maxOutputLength: remaining });
    } catch (error) {
      throw zipRefusal(error);
    }
    remaining -= data.length;
    if (READ_PART.test(entry.name)) parts.set(entry.name.toLowerCase(), data);
  }
  const text = (name: string): string | undefined => {
    const data = parts.get(name);
    if (data === undefined) return undefined;
    try {
      return decodeXml(data, name);
    } catch {
      throw new ImportFileRefusal("IMPORT_FILE_TYPE");
    }
  };

  if (/macroEnabled/iu.test(text("[content_types].xml") ?? "")) throw new ImportFileRefusal("IMPORT_MACRO_WORKBOOK");

  // The sheet the reader reads is the one held to the bounds; a first sheet that cannot be resolved is refused.
  const first = firstSheetPart(text("xl/workbook.xml"), text("xl/_rels/workbook.xml.rels"));
  const sheet = first === undefined ? undefined : text(first);
  parts.clear();
  if (first === undefined || sheet === undefined) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  // The reader is given the checked sheet with its valued cells alone; the caps apply to those (BE3-01).
  const valued = valuedSheet(sheet);
  if (valued.columns > XLSX_IMPORT_MAX_COLUMNS || !Number.isSafeInteger(valued.rows)) throw new ImportFileRefusal("IMPORT_WORKBOOK_TOO_LARGE");
  if (valued.rows - 1 > IMPORT_MAX_ROWS) throw new ImportFileRefusal("IMPORT_TOO_MANY_ROWS", { rows: valued.rows - 1 });

  let rows: XlsxCell[][];
  try {
    rows = await readFirstSheet(bytes, { maxInflated: XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES, sheetPart: first, sheetXml: valued.xml });
  } catch (error) {
    if (error instanceof XlsxReadError) {
      throw new ImportFileRefusal(isImportFileRefusalReason(error.reason) ? error.reason : "IMPORT_FILE_TYPE");
    }
    throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  }
  return shapeRows("xlsx", rows.map((row) => row.map(xlsxImportCell)));
}

/** Reads an uploaded import file, or throws ImportFileRefusal with its closed reason. */
export async function readImportFile(input: { bytes: Uint8Array; fileName: string; mimeType?: string | null }): Promise<ImportFile> {
  const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
  const named = extensionFormat(input.fileName ?? "");
  if (named === null) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  const mimeType = (input.mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME[named].includes(mimeType)) throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw new ImportFileRefusal("IMPORT_FILE_TOO_LARGE", { bytes: bytes.byteLength });

  if (startsWith(bytes, ZIP_SIGNATURE)) {
    if (named !== "xlsx") throw new ImportFileRefusal("IMPORT_FILE_TYPE");
    return readXlsx(bytes);
  }
  if (startsWith(bytes, CFB_SIGNATURE)) {
    throw new ImportFileRefusal(bytes.includes(ENCRYPTED_PACKAGE) ? "IMPORT_ENCRYPTED_WORKBOOK" : "IMPORT_LEGACY_XLS");
  }
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff]) || bytes.subarray(0, SNIFF_LENGTH).includes(0)) {
    throw new ImportFileRefusal("IMPORT_ENCODING_UTF16");
  }
  if (named !== "csv") throw new ImportFileRefusal("IMPORT_FILE_TYPE");
  return readCsv(bytes);
}
