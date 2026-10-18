import { randomBytes } from "node:crypto";
import zlib from "node:zlib";

import {
  buildEncryptedOoxml,
  buildXlsx,
  buildZip,
  contentTypesXml,
  escapeXml,
  OFFICE_RELATIONSHIPS,
  relationshipsXml,
  XLSX_MAIN_TYPE,
  type XlsxSheetSpec,
} from "./attachment-fixtures";

/*
 * Spreadsheet import fixtures (19-03; D-25, D-26). Every file is built in memory from bytes; nothing binary is
 * committed. The ZIP, CFB and SpreadsheetML builders are 14-02's (attachment-fixtures.ts); these add the shapes an
 * import meets: legacy encodings, UTF-16 "Unicode Text", bombs, macro-enabled and encrypted workbooks, and the UAT
 * files of JOURNEYS.md area 6.
 */

/** UTF-8 CSV bytes from lines joined by CRLF, with an optional byte order mark and a final CRLF. */
export function buildCsvBytes(lines: readonly string[], options: { bom?: boolean; finalNewline?: boolean } = {}): Buffer {
  const text = lines.join("\r\n") + (options.finalNewline === false ? "" : "\r\n");
  const body = Buffer.from(text, "utf8");
  return options.bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body;
}

/** Windows-1252 bytes for text inside Latin-1 (what Excel's "CSV (Comma delimited)" writes on Windows). */
export function buildWindows1252Bytes(lines: readonly string[]): Buffer {
  const text = lines.join("\r\n") + "\r\n";
  for (const character of text) {
    if (character.codePointAt(0)! > 0xff) throw new RangeError(`${character} is outside the fixture's Latin-1 range`);
  }
  return Buffer.from(text, "latin1");
}

/** UTF-16 text ("Unicode Text"), little- or big-endian, with or without its byte order mark. */
export function buildUtf16Bytes(lines: readonly string[], options: { bom?: boolean; endian?: "le" | "be" } = {}): Buffer {
  const littleEndian = Buffer.from(lines.join("\r\n") + "\r\n", "utf16le");
  const body = options.endian === "be" ? Buffer.from(littleEndian).swap16() : littleEndian;
  if (!options.bom) return body;
  return Buffer.concat([Buffer.from(options.endian === "be" ? [0xfe, 0xff] : [0xff, 0xfe]), body]);
}

/** A SpreadsheetML workbook (14-02's builder) from plain sheets. */
export function buildXlsxBytes(sheets: readonly XlsxSheetSpec[], options: Parameters<typeof buildXlsx>[1] = {}): Buffer {
  return buildXlsx(sheets, options);
}

/**
 * A ZIP bomb that lies about its size: `mebibytes` of zeros deflated to a few KiB, declared as twice the compressed
 * size, so the directory passes every declared bound and only the bounded inflate stops it.
 */
export function buildZipBomb(mebibytes = 60): Buffer {
  const zeros = new Uint8Array(mebibytes * 1024 * 1024);
  const compressed = zlib.deflateRawSync(zeros, { level: 9 });
  return buildZip([{ name: "xl/worksheets/sheet1.xml", data: zeros, method: 8, declaredUncompressedSize: compressed.length * 2 }]);
}

/** An archive of `count` tiny entries. */
export function buildManyEntryZip(count: number): Buffer {
  return buildZip(Array.from({ length: count }, (_, index) => ({ name: `xl/part${index}.xml`, data: "<a/>", method: 0 as const })));
}

/** An archive whose one entry declares `declared` uncompressed bytes, from enough real data to pass the ratio bound. */
export function buildDeclaredTotalZip(declared: number): Buffer {
  const data = randomBytes(Math.ceil(declared / 150));
  return buildZip([{ name: "xl/worksheets/sheet1.xml", data, method: 0, declaredUncompressedSize: declared }]);
}

/** The macro-enabled workbook's main content type (ECMA-376 / MS-OFFMACRO). */
export const XLSM_MAIN_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.main+xml";

/** A workbook that carries `xl/vbaProject.bin`, or (with `contentType`) declares the macro-enabled content type. */
export function buildMacroWorkbook(options: { by: "vba-part" | "content-type" } = { by: "vba-part" }): Buffer {
  const sheets: XlsxSheetSpec[] = [{ name: "Sheet1", rows: [["Name"], ["Payroll"]] }];
  if (options.by === "content-type") return buildXlsx(sheets, { overrides: [["/xl/workbook.xml", XLSM_MAIN_TYPE]] });
  return buildXlsx(sheets, { extraEntries: [{ name: "xl/vbaProject.bin", data: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00]), method: 0 }] });
}

const SPREADSHEET_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const WORKSHEET_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";

/**
 * A one-sheet workbook whose cells sit at the given references (inline strings and numbers), so a test can place a
 * value far from A1: a used range a reader would pad out, from a file of a few hundred bytes.
 */
export function buildSparseWorkbook(cells: ReadonlyArray<readonly [ref: string, value: string | number]>): Buffer {
  const rows = new Map<number, string[]>();
  for (const [ref, value] of cells) {
    const row = Number(/\d+$/.exec(ref)?.[0]);
    const xml = typeof value === "number"
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    rows.set(row, [...(rows.get(row) ?? []), xml]);
  }
  const sheetData = [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([row, xml]) => `<row r="${row}">${xml.join("")}</row>`)
    .join("");
  return buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml([["/xl/workbook.xml", XLSX_MAIN_TYPE], ["/xl/worksheets/sheet1.xml", WORKSHEET_TYPE]]), method: 0 },
    { name: "_rels/.rels", data: relationshipsXml([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, "xl/workbook.xml"]]), method: 0 },
    {
      name: "xl/workbook.xml",
      data: `<workbook xmlns="${SPREADSHEET_MAIN}" xmlns:r="${OFFICE_RELATIONSHIPS}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    { name: "xl/_rels/workbook.xml.rels", data: relationshipsXml([["rId1", `${OFFICE_RELATIONSHIPS}/worksheet`, "worksheets/sheet1.xml"]]) },
    { name: "xl/worksheets/sheet1.xml", data: `<worksheet xmlns="${SPREADSHEET_MAIN}"><sheetData>${sheetData}</sheetData></worksheet>` },
  ]);
}

/**
 * A workbook from raw `<sheetData>` XML (BE3-01, Phase 19 code review), so a test can write what a crafted file
 * carries: an empty `<row r="N"/>`, a cell with no value, a `<dimension>`, and a first sheet stored at any part name.
 * `sheets` are in workbook order; each names its part (relative to `xl/`) and may omit its `name` attribute. A sheet's
 * `xml`, and `parts.workbook` or `parts.relationships`, replace that part's whole XML, so a test can write a malformed
 * part (T-19-06, stage B).
 */
export function buildRawSheetWorkbook(
  sheets: ReadonlyArray<{ readonly part: string; readonly sheetData: string; readonly dimension?: string; readonly name?: string | null; readonly xml?: string }>,
  parts: { readonly workbook?: string; readonly relationships?: string; readonly stored?: boolean } = {},
): Buffer {
  // A stored part keeps its compression ratio at 1, so a large crafted part passes the archive bounds (T-19-06).
  const method: 0 | undefined = parts.stored ? 0 : undefined;
  const workbookSheets = sheets
    .map((sheet, index) => {
      const name = sheet.name === null ? "" : ` name="${escapeXml(sheet.name ?? `Sheet${index + 1}`)}"`;
      return `<sheet${name} sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
    })
    .join("");
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: contentTypesXml([["/xl/workbook.xml", XLSX_MAIN_TYPE], ...sheets.map((sheet): [string, string] => [`/xl/${sheet.part}`, WORKSHEET_TYPE])]),
      method: 0,
    },
    { name: "_rels/.rels", data: relationshipsXml([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, "xl/workbook.xml"]]), method: 0 },
    { name: "xl/workbook.xml", data: parts.workbook ?? `<workbook xmlns="${SPREADSHEET_MAIN}" xmlns:r="${OFFICE_RELATIONSHIPS}"><sheets>${workbookSheets}</sheets></workbook>`, ...(method === undefined ? {} : { method }) },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: parts.relationships ?? relationshipsXml(sheets.map((sheet, index) => [`rId${index + 1}`, `${OFFICE_RELATIONSHIPS}/worksheet`, sheet.part])),
      ...(method === undefined ? {} : { method }),
    },
    ...sheets.map((sheet) => ({
      name: `xl/${sheet.part}`,
      data: sheet.xml ?? `<worksheet xmlns="${SPREADSHEET_MAIN}">${sheet.dimension === undefined ? "" : `<dimension ref="${sheet.dimension}"/>`}<sheetData>${sheet.sheetData}</sheetData></worksheet>`,
      ...(method === undefined ? {} : { method }),
    })),
  ]);
}

/** The two-row sheet data the bomb fixtures start from: a `Name` header and one value. */
export const NAME_HEADER_ROWS = `<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>P</t></is></c></row>`;

const CFB_SIGNATURE =[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** A Compound File Binary header (the container of the legacy `.xls`), 512 bytes, naming a `Workbook` stream. */
export function buildCfbHeader(): Buffer {
  const bytes = Buffer.alloc(1_024);
  Buffer.from(CFB_SIGNATURE).copy(bytes, 0);
  bytes.writeUInt16LE(0x003e, 24);
  bytes.writeUInt16LE(0x0003, 26);
  bytes.writeUInt16LE(0xfffe, 28);
  bytes.writeUInt16LE(9, 30);
  Buffer.from("Workbook\u0000", "utf16le").copy(bytes, 512);
  return bytes;
}

/** An encrypted (password-protected) OOXML workbook: a CFB holding `EncryptionInfo` and `EncryptedPackage`. */
export function buildEncryptedCfb(): Buffer {
  return buildEncryptedOoxml();
}

/** RT-2 (UAT-051): a UTF-8 Risk Types file without a BOM, headers in display case, and an extra `Owner` column. */
export const rt2Headers = (): Buffer => buildCsvBytes([
  "Name,Description,Owner",
  "Credential misuse,Stolen or shared credentials,Dana Lee",
  "Supplier outage,A key supplier stops delivering,Sam Ortiz",
]);

/** RT-3: the same kind of file saved as Excel's default "CSV (Comma delimited)", which is Windows-1252 (é is 0xE9). */
export const rt3Cp1252 = (): Buffer => buildWindows1252Bytes([
  "Name,Description",
  "Café systems,Point-of-sale terminals in the café",
]);

/** IS-1 (UAT-051): Information Systems with Excel habits: `Prod`, Yes/No flags, a missing name and duplicates. */
export const is1 = (): Buffer => buildCsvBytes([
  "name,description,environment,internetFacing,hostingLocation",
  "UAT-A: Payroll,Payroll system,Production,true,Sydney",
  "uat-b: core customer billing system,Billing,Production,false,Melbourne",
  "UAT-C: Portal,Customer portal,Prod,true,Sydney",
  "UAT-D: Intranet,Staff intranet,Production,Yes,Sydney",
  ",No name,Production,false,Sydney",
  "UAT-E: Duplicate,First,Production,false,Sydney",
  "UAT-E: Duplicate,Second,Production,false,Sydney",
]);

/** IS-2 (round trip): an exported list corrected in Excel and saved as CSV UTF-8, with Excel's TRUE and FALSE. */
export const is2RoundTrip = (): Buffer => buildCsvBytes([
  "name,description,environment,internetFacing,hostingLocation",
  "UAT-F: New system,New,Production,TRUE,Sydney",
  "UAT-A: Payroll,Payroll system,Production,FALSE,Sydney",
  "UAT-B: Core customer billing system,Billing,Production,FALSE,Melbourne",
  "UAT-C: Portal,,,,Brisbane",
  "UAT-D: Intranet,Staff intranet,Production,TRUE,Sydney",
], { bom: true });
