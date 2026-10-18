import type { Sheet } from "read-excel-file/universal";

import type { ConflictReason } from "../conflict-reasons";
import { decodeXml, DTD_DECLARATION } from "../files/ooxml-text";
import { readZipDirectory, readZipEntry, writeStoredZip, ZIP_EXTRACTION_MAX_INFLATED, type StoredZipPart, type ZipEntry } from "../files/zip-archive";

/*
 * CSRM's one XLSX reader (14-02; D-31, D-32; Phase 19 extends it for imports). It is the only module that names
 * read-excel-file, which returns each cell's cached value and never its formula.
 *
 * The library never sees the uploaded bytes (CR-201, WR-201). The CSRM ZIP reader checks the archive first (D-32's
 * upload bounds, one end record, no duplicate part names) and the declared size of every part the library reads (the
 * `.xml` and `.xml.rels` parts) against `maxInflated` (128 MiB by default). It then inflates each of those parts itself:
 * each must give exactly its declared size and CRC-32, decode as UTF-8 or UTF-16, and declare no DOCTYPE or ENTITY by
 * tokenizeXml's own rule. The library is handed a canonical archive rebuilt from those verified parts only, every entry
 * stored, so it reads exactly what CSRM checked, and fflate copies each entry synchronously without starting a Worker.
 *
 * Phase 19 (19-03; D-25, D-26) adds readFirstSheet for imports: the same verified archive, the first sheet only, with
 * nothing trimmed (19-RESEARCH Pitfall 11), and every failure carrying the closed reason an import refuses with.
 */

/** The library and version behind every XLSX read, recorded in the extractor version. */
export const XLSX_READER_ENGINE = "read-excel-file/9.3.10";

export type XlsxCell = string | number | boolean | Date | null;

export interface XlsxSheet {
  readonly name: string;
  readonly rows: readonly (readonly XlsxCell[])[];
}

export type XlsxReadErrorCode = "XLSX_TOO_LARGE" | "XLSX_UNREADABLE";

/** The import refusal each read failure becomes, unless the failure names its own (19-03). */
const DEFAULT_REASON: Readonly<Record<XlsxReadErrorCode, ConflictReason>> = Object.freeze({
  XLSX_TOO_LARGE: "IMPORT_WORKBOOK_TOO_LARGE",
  XLSX_UNREADABLE: "IMPORT_FILE_TYPE",
});

export class XlsxReadError extends Error {
  readonly code: XlsxReadErrorCode;
  /** The closed reason an import refuses this workbook with (19-03). */
  readonly reason: ConflictReason;
  readonly cause?: unknown;

  constructor(code: XlsxReadErrorCode, detail: string, cause?: unknown, reason?: ConflictReason) {
    super(`${code}: ${detail}`);
    this.name = "XlsxReadError";
    this.code = code;
    this.reason = reason ?? DEFAULT_REASON[code];
    if (cause !== undefined) this.cause = cause;
  }
}

export interface XlsxReadOptions {
  /** The most the library may inflate, summed over the declared sizes of the parts it reads. */
  readonly maxInflated?: number;
  /**
   * readFirstSheet only (BE3-01): the first sheet's part name as the import resolved and bounded it. Every other part
   * that holds sheet data is withheld from the archive the library reads, so the library can only read the sheet the
   * import checked (or fail), never a different one it resolves on its own.
   */
  readonly sheetPart?: string;
  /**
   * readFirstSheet only, with `sheetPart` (BE3-01): the sheet's XML as the import rewrote it (its valued cells alone),
   * written in place of that part, UTF-8 encoded, so the library reads exactly the sheet the import bounded.
   */
  readonly sheetXml?: string;
}

/** A part that holds worksheet cells. */
const SHEET_DATA = /<(?:[\w.-]+:)?sheetData\b/u;

/** The parts the library reads (its own filter, matched exactly): everything else stays out of the rebuilt archive. */
const INFLATED_PART = /\.xml(\.rels)?$/;

function toCell(value: unknown): XlsxCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  return String(value);
}

/**
 * The archive the library reads: each part it would read, inflated through CSRM's bounded reader (exactly its
 * declared size and CRC-32), decoded as UTF-8 or UTF-16 and free of any DOCTYPE or ENTITY declaration (D-32; the
 * library's parser would skip a DTD rather than refuse it), then rebuilt as stored entries. The archive is returned as
 * an ArrayBuffer holding exactly its bytes, as the library takes a whole ArrayBuffer.
 */
function canonicalWorkbook(bytes: Uint8Array, parts: readonly ZipEntry[], sheetPart?: string, sheetXml?: string): ArrayBuffer {
  const verified: StoredZipPart[] = [];
  for (const entry of parts) {
    let data: Buffer;
    try {
      data = readZipEntry(bytes, entry, { maxOutputLength: entry.uncompressedSize });
    } catch (error) {
      throw new XlsxReadError("XLSX_UNREADABLE", "a part does not inflate to its declared size", error);
    }
    let xml: string;
    try {
      xml = decodeXml(data, entry.name);
    } catch (error) {
      throw new XlsxReadError("XLSX_UNREADABLE", "a part is not UTF-8 or UTF-16", error);
    }
    if (DTD_DECLARATION.test(xml)) throw new XlsxReadError("XLSX_UNREADABLE", "a part declares a DOCTYPE or ENTITY");
    if (sheetPart !== undefined && entry.name.toLowerCase() !== sheetPart && SHEET_DATA.test(xml)) continue;
    if (sheetPart !== undefined && sheetXml !== undefined && entry.name.toLowerCase() === sheetPart) {
      if (DTD_DECLARATION.test(sheetXml)) throw new XlsxReadError("XLSX_UNREADABLE", "a part declares a DOCTYPE or ENTITY");
      verified.push({ name: entry.name, data: Buffer.from(sheetXml, "utf8") });
      continue;
    }
    verified.push({ name: entry.name, data });
  }
  let archive: Buffer;
  try {
    archive = writeStoredZip(verified);
  } catch (error) {
    throw new XlsxReadError("XLSX_UNREADABLE", "the verified parts do not make an archive", error);
  }
  // writeStoredZip allocates exactly the archive, so its ArrayBuffer is normally the archive itself; copy otherwise.
  const { buffer } = archive;
  if (buffer instanceof ArrayBuffer && archive.byteOffset === 0 && archive.byteLength === buffer.byteLength) return buffer;
  const copy = new Uint8Array(archive.byteLength);
  copy.set(archive);
  return copy.buffer;
}

/**
 * Every sheet of a workbook, in workbook order, with typed cells: text, numbers, booleans, dates (as UTC `Date`s) and
 * empty cells as `null`. Every failure is an XlsxReadError.
 */
export async function readWorkbookSheets(bytes: Uint8Array, options: XlsxReadOptions = {}): Promise<XlsxSheet[]> {
  const input = verifiedWorkbook(bytes, options);
  let sheets: Sheet[];
  try {
    const { default: readXlsxFile } = await import("read-excel-file/universal");
    sheets = await readXlsxFile(input, { trim: false });
  } catch (error) {
    throw new XlsxReadError("XLSX_UNREADABLE", "the workbook could not be read", error);
  }
  return sheets.map(({ sheet, data }) => ({ name: sheet, rows: data.map((row) => row.map(toCell)) }));
}

/** The archive the library may read: checked, bounded by `maxInflated` and rebuilt from verified parts. */
function verifiedWorkbook(bytes: Uint8Array, options: XlsxReadOptions): ArrayBuffer {
  const maxInflated = options.maxInflated ?? ZIP_EXTRACTION_MAX_INFLATED;
  let parts: ZipEntry[];
  try {
    parts = readZipDirectory(bytes).entries.filter((entry) => INFLATED_PART.test(entry.name));
  } catch (error) {
    throw new XlsxReadError("XLSX_UNREADABLE", "the workbook is not a readable archive", error);
  }
  const declared = parts.reduce((total, entry) => total + entry.uncompressedSize, 0);
  if (declared > maxInflated) throw new XlsxReadError("XLSX_TOO_LARGE", `the workbook declares ${declared} bytes of XML`);
  return canonicalWorkbook(bytes, parts, options.sheetPart?.toLowerCase(), options.sheetXml);
}

/** The Compound File Binary signature: a legacy `.xls` (or an encrypted OOXML, which the import tells apart first). */
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** The library's own refusal codes (InvalidInputError.code), as the closed reasons an import gives (19-03). */
const READER_REASONS: Readonly<Record<string, ConflictReason>> = Object.freeze({
  XLS_FILE_NOT_SUPPORTED: "IMPORT_LEGACY_XLS",
  FILE_NOT_SUPPORTED: "IMPORT_FILE_TYPE",
  INVALID_ZIP: "IMPORT_FILE_TYPE",
});

function readerReason(error: unknown): ConflictReason {
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown };
  if (name === "InvalidInputError" && typeof code === "string" && Object.prototype.hasOwnProperty.call(READER_REASONS, code)) {
    return READER_REASONS[code];
  }
  return "IMPORT_FILE_TYPE";
}

/**
 * The first sheet of a workbook, in the same typed cells as readWorkbookSheets, nothing trimmed (19-03; D-25). Rows
 * keep their sheet positions: sheet row `n` is element `n - 1`, and empty rows above the last value stay as empty
 * rows. The library reads the same verified, rebuilt archive as readWorkbookSheets. Every failure is an XlsxReadError
 * carrying the import's closed reason.
 */
export async function readFirstSheet(bytes: Uint8Array, options: XlsxReadOptions = {}): Promise<XlsxCell[][]> {
  if (bytes.byteLength >= CFB_SIGNATURE.length && CFB_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new XlsxReadError("XLSX_UNREADABLE", "a legacy .xls workbook", undefined, "IMPORT_LEGACY_XLS");
  }
  const input = verifiedWorkbook(bytes, options);
  try {
    const { readSheet } = await import("read-excel-file/universal");
    const data = await readSheet(input, 1, { trim: false });
    return data.map((row) => row.map(toCell));
  } catch (error) {
    throw new XlsxReadError("XLSX_UNREADABLE", "the first sheet could not be read", error, readerReason(error));
  }
}

/** One cell as text: dates as `YYYY-MM-DD`, booleans as `TRUE` and `FALSE`, numbers as `String(n)`, empty as "". */
export function xlsxCellText(cell: XlsxCell): string {
  if (cell === null) return "";
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell);
}
