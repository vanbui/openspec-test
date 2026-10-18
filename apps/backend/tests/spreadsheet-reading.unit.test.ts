import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test, { after } from "node:test";

import { CSV_MAX_BYTES, CSV_MAX_RECORD_BYTES, CSV_MAX_ROWS } from "../src/api/csrm-administration/services/csv-import";
import type { ZipArchiveErrorCode } from "../src/csrm/files/zip-archive";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_RECORD_BYTES,
  IMPORT_MAX_ROWS,
  ImportFileRefusal,
  readImportFile,
  XLSX_IMPORT_MAX_COLUMNS,
  XLSX_IMPORT_MAX_ENTRIES,
  XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES,
  ZIP_ERROR_REASONS,
} from "../src/csrm/spreadsheets/import-file";
import { readFirstSheet, xlsxCellText, XlsxReadError } from "../src/csrm/spreadsheets/xlsx-reader";
import { writeWorkbook } from "../src/csrm/spreadsheets/xlsx-writer";
import { buildEncryptedFlagZip, buildZip, buildZip64Archive } from "./helpers/attachment-fixtures";
import {
  buildCfbHeader,
  buildCsvBytes,
  buildDeclaredTotalZip,
  buildEncryptedCfb,
  buildMacroWorkbook,
  buildManyEntryZip,
  buildRawSheetWorkbook,
  buildSparseWorkbook,
  buildUtf16Bytes,
  buildWindows1252Bytes,
  buildXlsxBytes,
  buildZipBomb,
  is1,
  is2RoundTrip,
  NAME_HEADER_ROWS,
  rt2Headers,
  rt3Cp1252,
} from "./helpers/spreadsheet-fixtures";

/*
 * The bounded import reader (19-03; D-25, D-26). An upload is either read into a header and rows, or refused with one
 * closed reason and safe found details. The signature decides the path, never the extension; an archive is checked
 * against the import bounds before anything is inflated, and every inflate is bounded.
 */

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function csv(bytes: Buffer, fileName = "import.csv", mimeType = "text/csv") {
  return readImportFile({ bytes, fileName, mimeType });
}

function xlsx(bytes: Buffer, fileName = "import.xlsx", mimeType = XLSX_TYPE) {
  return readImportFile({ bytes, fileName, mimeType });
}

async function refusal(promise: Promise<unknown>): Promise<ImportFileRefusal> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ImportFileRefusal, `expected an ImportFileRefusal, got ${String(error)}`);
    return error;
  }
  assert.fail("the file was not refused");
}

async function assertRefused(promise: Promise<unknown>, reason: string, status = 422): Promise<ImportFileRefusal> {
  const error = await refusal(promise);
  assert.equal(error.reason, reason);
  assert.equal(error.status, status);
  return error;
}

test("the import bounds are the administration import's, and the archive bounds are D-26's", () => {
  assert.equal(IMPORT_MAX_BYTES, CSV_MAX_BYTES);
  assert.equal(IMPORT_MAX_ROWS, CSV_MAX_ROWS);
  assert.equal(IMPORT_MAX_RECORD_BYTES, CSV_MAX_RECORD_BYTES);
  assert.equal(XLSX_IMPORT_MAX_ENTRIES, 512);
  assert.equal(XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES, 52_428_800);
  assert.equal(XLSX_IMPORT_MAX_COLUMNS, 1_024);
});

// Accepted files.

test("RT-2: UTF-8 without a BOM returns the header as typed and the rows with their original row numbers", async () => {
  const file = await csv(rt2Headers());
  assert.equal(file.format, "csv");
  assert.deepEqual(file.header, ["Name", "Description", "Owner"]);
  assert.deepEqual(file.rows.map((row) => row.rowNumber), [2, 3]);
  assert.deepEqual(file.rows[0].cells, ["Credential misuse", "Stolen or shared credentials", "Dana Lee"]);
  assert.ok(file.rows[0].byteLength > 0);
});

test("the same file with a UTF-8 BOM reads the same header, without the BOM", async () => {
  const file = await csv(buildCsvBytes(["Name,Description,Owner", "Credential misuse,Stolen,Dana Lee"], { bom: true }));
  assert.deepEqual(file.header, ["Name", "Description", "Owner"]);
  assert.equal(file.rows.length, 1);
});

test("a single-column Name file is accepted (no comma is not a delimiter problem)", async () => {
  const file = await csv(buildCsvBytes(["Name", "Credential misuse", "Supplier outage"]));
  assert.deepEqual(file.header, ["Name"]);
  assert.deepEqual(file.rows.map((row) => row.cells), [["Credential misuse"], ["Supplier outage"]]);
});

test("IS-1 and IS-2 read whole: their values are left for the classifier", async () => {
  const first = await csv(is1());
  assert.equal(first.rows.length, 7);
  assert.equal(first.rows[2].cells[2], "Prod");
  assert.equal(first.rows[3].cells[3], "Yes");
  const second = await csv(is2RoundTrip());
  assert.equal(second.rows.length, 5);
  assert.equal(second.rows[0].cells[3], "TRUE");
  assert.deepEqual(second.rows[3].cells, ["UAT-C: Portal", "", "", "", "Brisbane"]);
});

test("the extension is matched without regard to case and the MIME type is advisory", async () => {
  for (const mimeType of ["", "application/octet-stream", "text/csv", "text/csv; charset=utf-8", "application/vnd.ms-excel"]) {
    const file = await readImportFile({ bytes: rt2Headers(), fileName: "Risk Types.CSV", mimeType });
    assert.equal(file.rows.length, 2);
  }
});

test("trailing fully blank rows are dropped; interior blank rows are kept", async () => {
  const file = await csv(buildCsvBytes(["Name,Description", "A,one", ",", "B,two", ",", " , ", ""]));
  assert.deepEqual(file.rows.map((row) => row.rowNumber), [2, 3, 4]);
});

test("an XLSX upload reads its first sheet only, with typed cells and row numbers", async () => {
  const bytes = await writeWorkbook([
    {
      name: "Information systems",
      header: ["Name", "Code", "Due", "Count"],
      widths: [20, 10, 12, 8],
      rows: [
        [{ kind: "text", value: "Payroll" }, { kind: "text", value: "0042" }, { kind: "date", value: new Date(Date.UTC(2026, 9, 1)) }, { kind: "number", value: 3 }],
        [{ kind: "text", value: "Billing" }, null, null, { kind: "number", value: 42 }],
      ],
    },
    { name: "About this export", header: ["About"], widths: [40], rows: [[{ kind: "text", value: "ignored" }]] },
  ]);
  const file = await xlsx(bytes);
  assert.equal(file.format, "xlsx");
  assert.deepEqual(file.header, ["Name", "Code", "Due", "Count"]);
  assert.deepEqual(file.rows.map((row) => row.rowNumber), [2, 3]);
  assert.deepEqual(file.rows[0].cells, ["Payroll", "0042", "2026-10-01", 3]);
  assert.deepEqual(file.rows[1].cells, ["Billing", null, null, 42]);
});

test("XLSX cells: a formula gives its cached value, a boolean stays a boolean, and nothing is trimmed", async () => {
  const bytes = buildXlsxBytes([
    { name: "Sheet1", rows: [["Name", "Flag", "Total", "Note"], ["  '=1+2", true, { formula: "SUM(1,2)", cached: 3 }, " padded "]] },
    { name: "Ignored", rows: [["Other"], ["x"]] },
  ]);
  const file = await xlsx(bytes);
  assert.deepEqual(file.rows[0].cells, ["  '=1+2", true, 3, " padded "]);
});

test("a 70,000-byte row is returned with its byte length, and the file is not refused", async () => {
  const long = "a".repeat(70_000);
  const file = await csv(buildCsvBytes(["Name,Description", `Long,${long}`, "Short,ok"]));
  assert.equal(file.rows.length, 2);
  assert.ok(file.rows[0].byteLength > IMPORT_MAX_RECORD_BYTES);
  assert.ok(file.rows[1].byteLength < IMPORT_MAX_RECORD_BYTES);
});

test("exactly 5,000 data rows are accepted", async () => {
  const lines = ["Name", ...Array.from({ length: 5_000 }, (_, index) => `Row ${index}`)];
  const file = await csv(buildCsvBytes(lines));
  assert.equal(file.rows.length, 5_000);
});

// Refusals: type and size.

test("IMPORT_FILE_TYPE: a .txt name", async () => {
  await assertRefused(readImportFile({ bytes: rt2Headers(), fileName: "import.txt", mimeType: "text/plain" }), "IMPORT_FILE_TYPE", 415);
});

test("IMPORT_FILE_TYPE: a MIME type outside the allowed set", async () => {
  await assertRefused(readImportFile({ bytes: rt2Headers(), fileName: "import.csv", mimeType: "application/pdf" }), "IMPORT_FILE_TYPE", 415);
});

test("IMPORT_FILE_TYPE: a .csv name with XLSX bytes, and an .xlsx name with CSV text", async () => {
  await assertRefused(csv(buildXlsxBytes([{ name: "Sheet1", rows: [["Name"], ["x"]] }])), "IMPORT_FILE_TYPE", 415);
  await assertRefused(xlsx(rt2Headers()), "IMPORT_FILE_TYPE", 415);
});

test("IMPORT_FILE_TYPE: an archive with a comment (ZIP_COMMENT)", async () => {
  const bytes = buildZip([{ name: "[Content_Types].xml", data: "<Types/>", method: 0 }], { comment: "made elsewhere" });
  await assertRefused(xlsx(bytes), "IMPORT_FILE_TYPE", 415);
});

test("IMPORT_FILE_TYPE: a truncated archive", async () => {
  const bytes = buildXlsxBytes([{ name: "Sheet1", rows: [["Name"], ["x"]] }]);
  await assertRefused(xlsx(bytes.subarray(0, bytes.length - 40)), "IMPORT_FILE_TYPE", 415);
});

test("IMPORT_FILE_TOO_LARGE: 5,242,881 bytes, with found.bytes", async () => {
  const bytes = Buffer.alloc(5_242_881, 0x61);
  const error = await assertRefused(csv(bytes), "IMPORT_FILE_TOO_LARGE", 413);
  assert.deepEqual(error.found, { bytes: 5_242_881 });
});

// Refusals: encodings and delimiters.

test("IMPORT_ENCODING_WINDOWS_1252: RT-3 (0xE9)", async () => {
  await assertRefused(csv(rt3Cp1252()), "IMPORT_ENCODING_WINDOWS_1252");
});

test("IMPORT_ENCODING_UNKNOWN: a byte Windows-1252 leaves undefined (0x81)", async () => {
  const bytes = Buffer.concat([Buffer.from("Name\r\nCaf", "latin1"), Buffer.from([0x81]), Buffer.from("\r\n", "latin1")]);
  await assertRefused(csv(bytes), "IMPORT_ENCODING_UNKNOWN");
});

test("IMPORT_ENCODING_UTF16: FF FE and FE FF byte order marks, and BOM-less UTF-16 (NUL bytes)", async () => {
  await assertRefused(csv(buildUtf16Bytes(["Name\tDescription", "x\ty"], { bom: true })), "IMPORT_ENCODING_UTF16");
  await assertRefused(csv(buildUtf16Bytes(["Name,Description", "x,y"], { bom: true, endian: "be" })), "IMPORT_ENCODING_UTF16");
  await assertRefused(csv(buildUtf16Bytes(["Name,Description", "x,y"])), "IMPORT_ENCODING_UTF16");
});

test("IMPORT_DELIMITER: a semicolon header, with found.delimiter", async () => {
  const error = await assertRefused(csv(buildCsvBytes(["Name;Description", "x;y"])), "IMPORT_DELIMITER");
  assert.deepEqual(error.found, { delimiter: "semicolon" });
});

test("IMPORT_DELIMITER: a tab header, with found.delimiter", async () => {
  const error = await assertRefused(csv(buildCsvBytes(["Name\tDescription", "x\ty"])), "IMPORT_DELIMITER");
  assert.deepEqual(error.found, { delimiter: "tab" });
});

/*
 * The import record's Phase 19 execution amendment (2026-10-17, G-6): a real CSV with a broken row is 422
 * IMPORT_CSV_MALFORMED with the parser's 1-based line, never the line's content, and never the 415 file-type refusal.
 */
test("IMPORT_CSV_MALFORMED: an invalid closing quote, with found.line", async () => {
  const error = await assertRefused(csv(buildCsvBytes(["Name,Description", "Payroll,ok", 'Billing,"secret"tail'])), "IMPORT_CSV_MALFORMED");
  assert.deepEqual(error.found, { line: 3 });
  assert.doesNotMatch(JSON.stringify({ message: error.message, found: error.found }), /secret|Billing/);
});

test("IMPORT_CSV_MALFORMED: a row with a different number of columns from the header, with found.line", async () => {
  const error = await assertRefused(csv(buildCsvBytes(["Name,Description", "Payroll,ok,extra"])), "IMPORT_CSV_MALFORMED");
  assert.deepEqual(error.found, { line: 2 });
});

test("IMPORT_CSV_MALFORMED: a quote that is never closed, with a positive line", async () => {
  const error = await assertRefused(csv(buildCsvBytes(["Name,Description", 'Payroll,"never closed', "Billing,ok"])), "IMPORT_CSV_MALFORMED");
  assert.ok(Number.isSafeInteger(error.found?.line) && (error.found?.line ?? 0) > 0, `line ${String(error.found?.line)}`);
  assert.deepEqual(Object.keys(error.found ?? {}), ["line"]);
});

test("IMPORT_CSV_MALFORMED keeps the check order: encoding and delimiter refusals come first", async () => {
  await assertRefused(csv(buildWindows1252Bytes(["Name,Description", 'Café,"broken'])), "IMPORT_ENCODING_WINDOWS_1252");
  await assertRefused(csv(buildCsvBytes(["Name;Description", 'x;"broken'])), "IMPORT_DELIMITER");
});

test("IMPORT_CSV_MALFORMED: a refusal never carries a line that is not a positive integer", () => {
  for (const line of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(new ImportFileRefusal("IMPORT_CSV_MALFORMED", { line }).found, {}, String(line));
  }
  assert.equal(new ImportFileRefusal("IMPORT_CSV_MALFORMED").status, 422);
});

// Refusals: workbooks.

test("IMPORT_LEGACY_XLS: a CFB container", async () => {
  await assertRefused(xlsx(buildCfbHeader(), "import.xlsx"), "IMPORT_LEGACY_XLS");
  await assertRefused(readImportFile({ bytes: buildCfbHeader(), fileName: "import.csv", mimeType: "application/vnd.ms-excel" }), "IMPORT_LEGACY_XLS");
});

test("IMPORT_ENCRYPTED_WORKBOOK: a CFB holding EncryptedPackage", async () => {
  await assertRefused(xlsx(buildEncryptedCfb()), "IMPORT_ENCRYPTED_WORKBOOK");
});

test("IMPORT_ENCRYPTED_WORKBOOK: an archive with the encryption flag", async () => {
  await assertRefused(xlsx(buildEncryptedFlagZip()), "IMPORT_ENCRYPTED_WORKBOOK");
});

test("IMPORT_MACRO_WORKBOOK: xl/vbaProject.bin, and a macro-enabled content type", async () => {
  await assertRefused(xlsx(buildMacroWorkbook({ by: "vba-part" })), "IMPORT_MACRO_WORKBOOK");
  await assertRefused(xlsx(buildMacroWorkbook({ by: "content-type" })), "IMPORT_MACRO_WORKBOOK");
});

test("IMPORT_WORKBOOK_TOO_LARGE: 513 entries", async () => {
  await assertRefused(xlsx(buildManyEntryZip(513)), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("IMPORT_WORKBOOK_TOO_LARGE: 50 MiB plus one byte declared", async () => {
  await assertRefused(xlsx(buildDeclaredTotalZip(52_428_801)), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("IMPORT_WORKBOOK_TOO_LARGE: a ZIP64 archive", async () => {
  await assertRefused(xlsx(buildZip64Archive()), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("IMPORT_WORKBOOK_TOO_LARGE: a bomb that inflates past what it declares (60 MiB of zeros)", async () => {
  await assertRefused(xlsx(buildZipBomb(60)), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("IMPORT_WORKBOOK_TOO_LARGE: a sheet whose used range is wider than 1,024 columns, before the reader pads it", async () => {
  await assertRefused(xlsx(buildSparseWorkbook([["A1", "Name"], ["XFD2", 1]])), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("every ZipArchiveError code maps to exactly one closed reason", () => {
  const expected: Record<ZipArchiveErrorCode, string> = {
    ZIP_MALFORMED: "IMPORT_FILE_TYPE",
    ZIP_COMMENT: "IMPORT_FILE_TYPE",
    ZIP_METHOD_UNSUPPORTED: "IMPORT_FILE_TYPE",
    ZIP_ENCRYPTED: "IMPORT_ENCRYPTED_WORKBOOK",
    ZIP_TOO_MANY_ENTRIES: "IMPORT_WORKBOOK_TOO_LARGE",
    ZIP_TOO_LARGE: "IMPORT_WORKBOOK_TOO_LARGE",
    ZIP_RATIO: "IMPORT_WORKBOOK_TOO_LARGE",
    ZIP64_UNSUPPORTED: "IMPORT_WORKBOOK_TOO_LARGE",
    ZIP_INFLATE_LIMIT: "IMPORT_WORKBOOK_TOO_LARGE",
  };
  assert.deepEqual({ ...ZIP_ERROR_REASONS }, expected);
  assert.ok(Object.isFrozen(ZIP_ERROR_REASONS));
});

// Refusals: shape.

test("IMPORT_NO_HEADER: an empty file, and a header row of blank cells", async () => {
  await assertRefused(csv(Buffer.alloc(0)), "IMPORT_NO_HEADER");
  await assertRefused(csv(buildCsvBytes([" , ", "x,y"])), "IMPORT_NO_HEADER");
  await assertRefused(xlsx(buildSparseWorkbook([["A2", "x"]])), "IMPORT_NO_HEADER");
});

test("IMPORT_NO_ROWS: a header only, and a header followed by blank rows", async () => {
  await assertRefused(csv(buildCsvBytes(["Name,Description"])), "IMPORT_NO_ROWS");
  await assertRefused(csv(buildCsvBytes(["Name,Description", ",", ""])), "IMPORT_NO_ROWS");
  await assertRefused(xlsx(buildSparseWorkbook([["A1", "Name"]])), "IMPORT_NO_ROWS");
});

test("IMPORT_TOO_MANY_ROWS: 5,001 data rows, with found.rows", async () => {
  const lines = ["Name", ...Array.from({ length: 5_001 }, (_, index) => `Row ${index}`)];
  const error = await assertRefused(csv(buildCsvBytes(lines)), "IMPORT_TOO_MANY_ROWS");
  assert.deepEqual(error.found, { rows: 5_001 });
});

test("IMPORT_TOO_MANY_ROWS: a workbook value on row 1,048,576 is counted before the reader pads the rows", async () => {
  const error = await assertRefused(xlsx(buildSparseWorkbook([["A1", "Name"], ["A1048576", "far"]])), "IMPORT_TOO_MANY_ROWS");
  assert.deepEqual(error.found, { rows: 1_048_575 });
});

// The first-sheet read itself.

test("readFirstSheet refuses a CFB container as a legacy workbook and anything else unreadable as a file type", async () => {
  await assert.rejects(readFirstSheet(buildCfbHeader()), (error: unknown) => error instanceof XlsxReadError && error.reason === "IMPORT_LEGACY_XLS");
  await assert.rejects(readFirstSheet(Buffer.from("not a workbook")), (error: unknown) => error instanceof XlsxReadError && error.reason === "IMPORT_FILE_TYPE");
});

/*
 * BE3-01 (Phase 19 code review, Critical; refined by the pilot's ruling): the reader pads one row per row index up to
 * every `<row r>` and every cell reference, valued or not, and reads the first sheet wherever its relationship points.
 * Real workbooks carry formatted empty rows, styled empty cells and a whole-sheet `<dimension>`, so the import reads
 * the checked sheet with only its valued cells, and the rows that hold them, before the library sees it: a bomb of
 * empty rows or value-less far cells becomes harmless, and the 1,024-column and 5,000-row caps apply to valued cells.
 * Each bomb is read in a child process with a small heap, so a read that lets the library allocate fails the test (the
 * child dies out of memory) instead of taking the test runner down.
 */
const IMPORT_FILE_MODULE = path.resolve(__dirname, "../src/csrm/spreadsheets/import-file.js");
const BOMB_HEAP_MIB = 96;
const BOMB_HEAP_GROWTH_MAX = 32 * 1024 * 1024;

type BoundedRead = {
  readonly reason?: string;
  readonly status?: number;
  readonly found?: unknown;
  readonly header?: readonly string[];
  readonly cells?: readonly (readonly unknown[])[];
  readonly heapGrowth: number;
};

function readInSmallHeap(bytes: Buffer): BoundedRead {
  const script = `
    const { readImportFile, ImportFileRefusal } = require(${JSON.stringify(IMPORT_FILE_MODULE)});
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", async () => {
      const bytes = Buffer.from(Buffer.concat(chunks).toString("utf8"), "base64");
      global.gc?.();
      const before = process.memoryUsage().heapUsed;
      let result;
      try {
        const file = await readImportFile({ bytes, fileName: "import.xlsx", mimeType: ${JSON.stringify(XLSX_TYPE)} });
        result = { header: file.header, cells: file.rows.map((row) => row.cells) };
      } catch (error) {
        if (!(error instanceof ImportFileRefusal)) throw error;
        result = { reason: error.reason, status: error.status, found: error.found };
      }
      result.heapGrowth = process.memoryUsage().heapUsed - before;
      process.stdout.write(JSON.stringify(result));
    });
  `;
  const child = spawnSync(process.execPath, [`--max-old-space-size=${BOMB_HEAP_MIB}`, "--expose-gc", "-e", script], {
    input: bytes.toString("base64"),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0, `the read finished within a ${BOMB_HEAP_MIB} MiB heap (signal ${child.signal}): ${child.stderr.slice(-400)}`);
  return JSON.parse(child.stdout) as BoundedRead;
}

/** The import heap figures the bomb tests saw, printed once so a run records them. */
const heapFigures: string[] = [];
after(() => {
  if (heapFigures.length > 0) console.log(`BE3-01 heap growth per bomb: ${heapFigures.join("; ")}`);
});

function assertBoundedRefusal(label: string, bytes: Buffer, reason: string): BoundedRead {
  const result = readInSmallHeap(bytes);
  assert.equal(result.reason, reason, JSON.stringify(result));
  assert.equal(result.status, 422);
  assert.ok(result.heapGrowth < BOMB_HEAP_GROWTH_MAX, `the refusal allocated ${result.heapGrowth} bytes of heap`);
  heapFigures.push(`${label} refused ${reason} +${result.heapGrowth} B`);
  return result;
}

/** A bomb that is harmless: it reads as its valued rows alone, within the heap bound. */
function assertBoundedRead(label: string, bytes: Buffer): BoundedRead {
  const result = readInSmallHeap(bytes);
  assert.equal(result.reason, undefined, JSON.stringify(result));
  assert.ok(result.heapGrowth < BOMB_HEAP_GROWTH_MAX, `the read allocated ${result.heapGrowth} bytes of heap`);
  heapFigures.push(`${label} read +${result.heapGrowth} B`);
  return result;
}

const sheet1 = (sheetData: string, dimension?: string) => buildRawSheetWorkbook([{ part: "worksheets/sheet1.xml", sheetData, ...(dimension ? { dimension } : {}) }]);

test("an empty high <row r> is harmless: the file reads as its valued rows, within the heap bound (BE3-01)", () => {
  const bytes = sheet1(`${NAME_HEADER_ROWS}<row r="30000000"/>`);
  assert.ok(bytes.length < 4_096, "the bomb is a few KiB");
  const result = assertBoundedRead("empty row 30,000,000", bytes);
  assert.deepEqual([result.header, result.cells], [["Name"], [["P"]]]);
});

test("a far cell with no value, in a row with no number, is harmless (BE3-01)", () => {
  assert.deepEqual(assertBoundedRead("value-less cell A30000000", sheet1(`${NAME_HEADER_ROWS}<row><c r="A30000000"/></row>`)).cells, [["P"]]);
});

test("a formula-only far cell (no cached value) is harmless, read as empty as the library reads it (BE3-01)", () => {
  assert.deepEqual(assertBoundedRead("formula-only cell A30000000", sheet1(`${NAME_HEADER_ROWS}<row r="30000000"><c r="A30000000"><f>1+1</f></c></row>`)).cells, [["P"]]);
});

test("5,000 rows with no number and no value are harmless (BE3-01)", () => {
  assert.deepEqual(assertBoundedRead("5,000 empty rows", sheet1(`${NAME_HEADER_ROWS}${"<row/>".repeat(5_000)}`)).cells, [["P"]]);
});

test("a far column with no value, and a dimension past the column cap, are harmless (BE3-01)", () => {
  assert.deepEqual(assertBoundedRead("value-less cell XFD3", sheet1(`${NAME_HEADER_ROWS}<row r="3"><c r="XFD3" s="1"/></row>`)).cells, [["P"]]);
  assert.deepEqual(assertBoundedRead("dimension A1:XFD1048576", sheet1(NAME_HEADER_ROWS, "A1:XFD1048576")).cells, [["P"]]);
});

test("IMPORT_TOO_MANY_ROWS: a valued cell on row 30,000,000 is counted before the reader pads the rows (BE3-01)", () => {
  const bytes = sheet1(`${NAME_HEADER_ROWS}<row r="30000000"><c r="A30000000" t="inlineStr"><is><t>far</t></is></c></row>`);
  assert.deepEqual(assertBoundedRefusal("valued cell A30000000", bytes, "IMPORT_TOO_MANY_ROWS").found, { rows: 29_999_999 });
});

test("IMPORT_TOO_MANY_ROWS: a valued row after many unnumbered empty rows takes its number after them (BE3-01)", () => {
  const bytes = sheet1(`${NAME_HEADER_ROWS}${"<row/>".repeat(5_000)}<row><c r="A5003"><v>1</v></c></row>`);
  assert.deepEqual(assertBoundedRefusal("valued row after 5,000 empty rows", bytes, "IMPORT_TOO_MANY_ROWS").found, { rows: 5_002 });
});

test("IMPORT_WORKBOOK_TOO_LARGE: a valued cell past column 1,024 (BE3-01)", () => {
  assertBoundedRefusal("valued cell XFD3", sheet1(`${NAME_HEADER_ROWS}<row r="3"><c r="XFD3"><v>1</v></c></row>`), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("IMPORT_WORKBOOK_TOO_LARGE: a first sheet stored outside xl/worksheets/ is held to the bounds (BE3-01)", () => {
  const sheetData = `${NAME_HEADER_ROWS}<row r="20000"><c r="XFD20000"><v>1</v></c></row>`;
  assertBoundedRefusal("valued XFD20000 at xl/data/s.xml", buildRawSheetWorkbook([{ part: "data/s.xml", sheetData }]), "IMPORT_WORKBOOK_TOO_LARGE");
});

test("the first sheet is the reader's first named <sheet>, so a nameless one cannot point the guard elsewhere (BE3-01)", () => {
  const bytes = buildRawSheetWorkbook([
    { part: "worksheets/sheet1.xml", sheetData: NAME_HEADER_ROWS, name: null },
    { part: "worksheets/sheet2.xml", sheetData: `${NAME_HEADER_ROWS}<row r="30000000"><c r="A30000000"><v>1</v></c></row>` },
  ]);
  assertBoundedRefusal("nameless first sheet, valued bomb second", bytes, "IMPORT_TOO_MANY_ROWS");
});

test("a small first sheet stored outside xl/worksheets/ still reads (BE3-01)", async () => {
  const file = await xlsx(buildRawSheetWorkbook([{ part: "data/s.xml", sheetData: NAME_HEADER_ROWS, dimension: "A1:A2" }]));
  assert.deepEqual(file.header, ["Name"]);
  assert.deepEqual(file.rows.map((row) => row.cells), [["P"]]);
});

/*
 * The pilot's ruling (BE3-01 refined): formatted empty rows past row 5,001, styled empty cells past column 1,024 and a
 * whole-sheet dimension, as real workbooks carry them, import as their valued rows with no refusal.
 */
test("formatted empty rows, styled empty cells past column 1,024 and a whole-sheet dimension import as the valued rows (BE3-01)", async () => {
  const formatted = sheet1(
    `${NAME_HEADER_ROWS}<row r="3" s="1" customFormat="1"><c r="A3" t="inlineStr"><is><t>Q</t></is></c><c r="AMK3" s="1"/></row>`
      + `<row r="9000" s="1" customFormat="1"/><row r="9001" s="1" customFormat="1"><c r="B9001" s="1"/><c r="XFD9001" s="1"/></row>`,
    "A1:XFD1048576",
  );
  const plain = sheet1(`${NAME_HEADER_ROWS}<row r="3"><c r="A3" t="inlineStr"><is><t>Q</t></is></c></row>`);
  const read = await xlsx(formatted);
  assert.deepEqual(read, await xlsx(plain), "the same file as its valued cells alone");
  assert.deepEqual(read.header, ["Name"]);
  assert.deepEqual(read.rows.map((row) => [row.rowNumber, row.cells]), [[2, ["P"]], [3, ["Q"]]]);
});

/*
 * The rewrite changes nothing a valued workbook reads as: the import's rows equal the library's own read of the
 * unrewritten sheet (readFirstSheet with no sheet part), cell for cell, with interior empty rows, unnumbered rows,
 * shared and inline strings, numbers, booleans, a formula's cached value, a formula with none, and empty styled cells
 * between valued ones.
 */
test("the valued-cell rewrite returns what the library reads from the original sheet (BE3-01)", async () => {
  const sheetData = `<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Count</t></is></c><c r="C1" t="inlineStr"><is><t>Flag</t></is></c><c r="D1" t="inlineStr"><is><t>Sum</t></is></c></row>`
    + `<row r="2"><c r="A2" t="inlineStr"><is><t> padded </t></is></c><c r="B2" s="1"/><c r="C2" t="b"><v>1</v></c><c r="D2"><f>1+1</f><v>2</v></c></row>`
    + `<row r="4"><c r="A4" t="inlineStr"><is><r><t>rich</t></r><r><t> text</t></r></is></c><c r="B4"><v>-5.5</v></c><c r="D4"><f>A1</f></c></row>`
    + `<row><c r="A5" t="inlineStr"><is><t>unnumbered</t></is></c></row>`
    + `<row r="6" s="1" customFormat="1"/>`;
  const samples: ReadonlyArray<readonly [string, Buffer]> = [
    ["raw sheet", sheet1(sheetData, "A1:XFD1048576")],
    ["shared strings", buildXlsxBytes([{ name: "Sheet1", rows: [["Name", "Code"], ["Payroll", "0042"], ["Billing", 7], [true, "x"]] }])],
    ["CSRM workbook", await writeWorkbook([
      {
        name: "Information systems",
        header: ["Name", "Code", "Due", "Count"],
        widths: [20, 10, 12, 8],
        rows: [
          [{ kind: "text", value: "=SUM(A1)" }, { kind: "text", value: "0042" }, { kind: "date", value: new Date(Date.UTC(2026, 9, 1)) }, { kind: "number", value: 3 }],
          [null, null, null, null],
          [{ kind: "text", value: "Billing" }, null, null, { kind: "number", value: 42 }],
        ],
      },
    ])],
  ];
  for (const [label, bytes] of samples) {
    const direct = await readFirstSheet(bytes);
    let end = direct.length;
    while (end > 1 && direct[end - 1].every((cell) => cell === null || cell === "")) end -= 1;
    const expected = direct.slice(1, end).map((row) => row.map((cell) => (cell instanceof Date ? xlsxCellText(cell) : cell)));
    const file = await xlsx(bytes);
    assert.deepEqual(file.header, direct[0].map(xlsxCellText), `${label}: header`);
    assert.deepEqual(file.rows.map((row) => row.cells), expected, `${label}: rows`);
  }
});

/*
 * T-19-06 (19-SECURITY.md, stage B): every scan the import makes over a checked workbook part finds each tag's `>` once.
 * A tag with no `>` (or an unclosed quote) must never make each later `<c`, `<row`, `<sheetData`, `<dimension`, `<v`,
 * `<sheet` or `<Relationship` rescan to the end of the part, which made one upload within every bound hold Strapi's
 * process for hours. Each case is built at two sizes: both settle (read, or refused with a closed reason) within 2
 * seconds, and doubling the size at most triples the time (with 100 ms of slack, so a garbage collection between two
 * fast reads cannot fail the run).
 */
const WORKBOOK_NAMESPACES = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

async function settle(bytes: Buffer): Promise<{ ms: number; outcome: string }> {
  const started = performance.now();
  let outcome = "read";
  try {
    await xlsx(bytes);
  } catch (error) {
    if (!(error instanceof ImportFileRefusal)) throw error;
    outcome = error.reason;
  }
  return { ms: performance.now() - started, outcome };
}

const stored = (sheetXml: string, parts: { workbook?: string; relationships?: string } = {}) =>
  buildRawSheetWorkbook([{ part: "worksheets/sheet1.xml", sheetData: "", xml: sheetXml }], { ...parts, stored: true });
const storedSheet = (sheetData: string) => stored(`<worksheet ${WORKBOOK_NAMESPACES}><sheetData>${sheetData}</sheetData></worksheet>`);

const UNTERMINATED_TAG_CASES: ReadonlyArray<readonly [string, (n: number) => Buffer]> = [
  ["a cell tag in the sheet data", (n) => storedSheet(`${NAME_HEADER_ROWS}${"<c a".repeat(n)}`)],
  ["a row tag in the sheet data", (n) => storedSheet(`${NAME_HEADER_ROWS}${"<row a".repeat(n)}`)],
  ["a cell attribute with an unclosed quote", (n) => storedSheet(`${NAME_HEADER_ROWS}${'<c a="'.repeat(n)}`)],
  ["the sheetData opener", (n) => stored(`<worksheet ${WORKBOOK_NAMESPACES}>${"<sheetData a".repeat(n)}`)],
  ["a dimension before the sheet data", (n) => stored(`<worksheet ${WORKBOOK_NAMESPACES}>${"<dimension a".repeat(n)}<sheetData>${NAME_HEADER_ROWS}</sheetData></worksheet>`)],
  ["a value tag inside a cell", (n) => storedSheet(`${NAME_HEADER_ROWS}<row r="3"><c r="A3">${"<v a".repeat(n)}</c></row>`)],
  ["a sheet in the workbook", (n) => stored(`<worksheet ${WORKBOOK_NAMESPACES}><sheetData>${NAME_HEADER_ROWS}</sheetData></worksheet>`, { workbook: `<workbook ${WORKBOOK_NAMESPACES}><sheets>${"<sheet a".repeat(n)}` })],
  ["a relationship of the workbook", (n) => stored(`<worksheet ${WORKBOOK_NAMESPACES}><sheetData>${NAME_HEADER_ROWS}</sheetData></worksheet>`, { relationships: `<Relationships>${"<Relationship a".repeat(n)}` })],
];

for (const [label, build] of UNTERMINATED_TAG_CASES) {
  test(`an unterminated tag in the first sheet is read or refused in linear time: ${label} (T-19-06)`, async () => {
    const small = await settle(build(50_000));
    const large = await settle(build(100_000));
    console.log(`T-19-06 ${label}: ${small.outcome} in ${Math.round(small.ms)} ms at 50,000; ${large.outcome} in ${Math.round(large.ms)} ms at 100,000`);
    for (const [size, result] of [["50,000", small], ["100,000", large]] as const) {
      assert.ok(result.outcome === "read" || result.outcome.startsWith("IMPORT_"), `${label} at ${size}: ${result.outcome}`);
      assert.ok(result.ms < 2_000, `${label} at ${size} took ${Math.round(result.ms)} ms`);
    }
    assert.ok(large.ms < 3 * small.ms + 100, `${label}: ${Math.round(small.ms)} ms at 50,000 and ${Math.round(large.ms)} ms at 100,000`);
  });
}

test("an unterminated cell tag filling the 5 MiB upload bound is refused at once as IMPORT_FILE_TYPE (T-19-06)", async () => {
  const bytes = storedSheet(`${NAME_HEADER_ROWS}${"<c a".repeat(1_250_000)}`);
  assert.ok(bytes.length <= IMPORT_MAX_BYTES, `the workbook is ${bytes.length} bytes, within the upload bound`);
  const result = await settle(bytes);
  assert.equal(result.outcome, "IMPORT_FILE_TYPE");
  assert.ok(result.ms < 2_000, `the refusal took ${Math.round(result.ms)} ms`);
});
