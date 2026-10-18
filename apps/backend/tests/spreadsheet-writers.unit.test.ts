import assert from "node:assert/strict";
import test from "node:test";

import { findZipEntry, readZipDirectory, readZipEntry } from "../src/csrm/files/zip-archive";
import { UTF8_BOM, writeCsv } from "../src/csrm/spreadsheets/csv-writer";
import { readWorkbookSheets } from "../src/csrm/spreadsheets/xlsx-reader";
import * as xlsxWriterModule from "../src/csrm/spreadsheets/xlsx-writer";
import { safeSheetName, writeWorkbook, XLSX_SHEET_NAME_MAX } from "../src/csrm/spreadsheets/xlsx-writer";

/*
 * The two spreadsheet writers (19-03; D-08, D-11). A formula-like value leaves CSRM as text in both formats, marked
 * once by the shared neutraliser, and a workbook carries typed cells with no formula element anywhere.
 */

const HYPERLINK = '=HYPERLINK("https://example.test","Click")';

test("the CSV writer emits a BOM, CRLF lines, quoted and neutralised text, bare numbers, ISO dates and empty nulls", () => {
  const bytes = writeCsv({
    header: ["Risk number", "Statement"],
    rows: [
      [{ kind: "text", value: "RSK-1" }, { kind: "text", value: HYPERLINK }],
      [null, { kind: "number", value: 3 }],
      [{ kind: "date", isoDate: "2026-10-01" }, { kind: "number", value: -5 }],
    ],
  });
  assert.deepEqual([...UTF8_BOM], [0xef, 0xbb, 0xbf]);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = bytes.subarray(3).toString("utf8");
  assert.ok(text.endsWith("\r\n"));
  const lines = text.slice(0, -2).split("\r\n");
  assert.deepEqual(lines, [
    '"Risk number","Statement"',
    '"RSK-1","\'=HYPERLINK(""https://example.test"",""Click"")"',
    ",3",
    "2026-10-01,-5",
  ]);
  assert.equal(text.replace(/\r\n/g, "").includes("\n"), false);
});

test("the CSV writer quotes text that holds commas, quotes and line breaks, and keeps non-ASCII text as UTF-8", () => {
  const bytes = writeCsv({ header: ["Name"], rows: [[{ kind: "text", value: 'Zoë, "Ōtaki"\nline' }]] });
  assert.equal(bytes.subarray(3).toString("utf8"), '"Name"\r\n"Zoë, ""Ōtaki""\nline"\r\n');
});

async function sampleWorkbook(): Promise<Buffer> {
  return writeWorkbook([
    {
      name: "Risk register",
      header: ["Risk number", "Statement", "Code", "Owner", "Due", "Score"],
      widths: [14, 40, 10, 20, 14, 8],
      rows: [
        [
          { kind: "text", value: "RSK-1" },
          { kind: "text", value: HYPERLINK },
          { kind: "text", value: "0042" },
          { kind: "text", value: "Zoë Ōtaki" },
          { kind: "date", value: new Date(Date.UTC(2026, 9, 1)) },
          { kind: "number", value: 12 },
        ],
        [{ kind: "text", value: "RSK-2" }, null, null, null, null, { kind: "number", value: -5 }],
      ],
    },
    {
      name: "About this export",
      header: ["About"],
      widths: [60],
      rows: [[{ kind: "text", value: "Exported from CSRM." }]],
    },
  ]);
}

function inflatePart(bytes: Buffer, name: string): string {
  const directory = readZipDirectory(bytes);
  const entry = findZipEntry(directory, name);
  assert.ok(entry, `${name} is in the workbook`);
  return readZipEntry(bytes, entry, { maxOutputLength: entry.uncompressedSize }).toString("utf8");
}

test("a workbook reads back with typed cells, the mark kept as text, leading zeros, non-ASCII text and calendar dates", async () => {
  const bytes = await sampleWorkbook();
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "PK\u0003\u0004");
  const sheets = await readWorkbookSheets(bytes);
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Risk register", "About this export"]);
  const [header, first, second] = sheets[0].rows;
  assert.deepEqual(header, ["Risk number", "Statement", "Code", "Owner", "Due", "Score"]);
  assert.equal(first[0], "RSK-1");
  assert.equal(first[1], `'${HYPERLINK}`);
  assert.equal(first[2], "0042");
  assert.equal(first[3], "Zoë Ōtaki");
  assert.ok(first[4] instanceof Date, "the date cell reads back as a date");
  assert.equal((first[4] as Date).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(first[5], 12);
  assert.equal(second[0], "RSK-2");
  assert.equal(second[5], -5);
  assert.deepEqual(sheets[1].rows, [["About"], ["Exported from CSRM."]]);
});

test("the sheet XML has no formula element, a frozen header row and a bold header font", async () => {
  const bytes = await sampleWorkbook();
  const sheet = inflatePart(bytes, "xl/worksheets/sheet1.xml");
  assert.doesNotMatch(sheet, /<f[\s>/]/, "no <f> element");
  assert.match(sheet, /ySplit="1"/);

  const styles = inflatePart(bytes, "xl/styles.xml");
  const fonts = [...(styles.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? "").matchAll(/<font(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/font>)/g)]
    .map((match) => match[1] ?? "");
  const cellXfs = [...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "").matchAll(/<xf\b[^>]*>/g)].map((match) => match[0]);
  const firstRow = sheet.match(/<row\b[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/)?.[1] ?? "";
  const headerCells = [...firstRow.matchAll(/<c\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(headerCells.length, 6);
  for (const cell of headerCells) {
    const style = Number(cell.match(/\bs="(\d+)"/)?.[1] ?? "0");
    const fontId = Number(cellXfs[style]?.match(/\bfontId="(\d+)"/)?.[1] ?? "0");
    assert.match(fonts[fontId] ?? "", /<b\s*\/>/, `header cell ${cell} uses a bold font`);
  }
});

test("safeSheetName removes the characters Excel forbids and keeps at most 31 characters", () => {
  assert.equal(XLSX_SHEET_NAME_MAX, 31);
  const name = safeSheetName("Risks: overview [2026]/x");
  assert.doesNotMatch(name, /[\\/?*[\]:]/);
  assert.ok(name.length <= 31);
  assert.ok(name.length > 0);
  assert.equal(safeSheetName("A".repeat(40)).length, 31);
  assert.equal(safeSheetName("Risk register"), "Risk register");
});

/*
 * BE1-01 (Phase 19 code review): write-excel-file drops C0 controls, the "discouraged" C1 range, U+FFFD and
 * non-characters from every text node, so a value with one of those before a formula trigger must be marked: the
 * workbook holds the value without the invisible character, and that string must still start with the mark.
 */
const INVISIBLE_BEFORE_TRIGGER = [
  "\u0001=1+1",
  "�=1+1",
  "\u0085=1+1",
  "\u007F=1+1",
  "\u009F+1",
  "￾@x",
  "﷐-1",
  " \u0001=1+1",
  "\u0001 =1+1",
  "\u0001'=1+1",
  "\u0001\t1",
  "​=1+1",
  "‮=1+1",
];

test("a value with an invisible character before a formula trigger leaves the workbook marked (BE1-01)", async () => {
  const bytes = await writeWorkbook([
    {
      name: "Values",
      header: ["Value"],
      widths: [20],
      rows: INVISIBLE_BEFORE_TRIGGER.map((value) => [{ kind: "text", value }]),
    },
  ]);
  const strings = [...inflatePart(bytes, "xl/sharedStrings.xml").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]);
  const written = strings.filter((text) => text !== "Value");
  assert.equal(written.length, INVISIBLE_BEFORE_TRIGGER.length);
  for (const text of written) {
    assert.ok(text.startsWith("'"), `the workbook holds ${JSON.stringify(text)} with the mark`);
  }
  const sheets = await readWorkbookSheets(bytes);
  for (const [value] of sheets[0].rows.slice(1)) {
    assert.ok(typeof value === "string" && value.startsWith("'"), `${JSON.stringify(value)} reads back marked`);
  }
});

test("a value with an invisible character before a formula trigger leaves the CSV marked (BE1-01)", () => {
  const bytes = writeCsv({ header: ["Value"], rows: INVISIBLE_BEFORE_TRIGGER.map((value) => [{ kind: "text", value }]) });
  const fields = bytes.subarray(3).toString("utf8").slice(0, -2).split("\r\n").slice(1);
  assert.equal(fields.length, INVISIBLE_BEFORE_TRIGGER.length);
  INVISIBLE_BEFORE_TRIGGER.forEach((value, index) => {
    assert.equal(fields[index], `"'${value.replace(/"/g, '""')}"`, JSON.stringify(value));
  });
});

test("both writers neutralise the header row too, once (BE1-05)", async () => {
  const csv = writeCsv({ header: ["Name", HYPERLINK], rows: [[{ kind: "text", value: "x" }, null]] });
  assert.equal(csv.subarray(3).toString("utf8").split("\r\n")[0], `"Name","'=HYPERLINK(""https://example.test"",""Click"")"`);
  const workbook = await writeWorkbook([{ name: "Values", header: ["Name", HYPERLINK, "\u0001=1+1"], widths: [10, 10, 10], rows: [] }]);
  const [header] = (await readWorkbookSheets(workbook))[0].rows;
  assert.deepEqual(header, ["Name", `'${HYPERLINK}`, "'=1+1"]);
});

test("the workbook writer refuses a text cell longer than Excel's 32,767 characters, its mark counted (BE1-02)", async () => {
  const limit = (xlsxWriterModule as unknown as { XLSX_CELL_MAX_LENGTH?: number }).XLSX_CELL_MAX_LENGTH;
  assert.equal(limit, 32_767);
  const sheet = (value: string) => [{ name: "Values", header: ["Value"], widths: [10], rows: [[{ kind: "text" as const, value }]] }];
  await writeWorkbook(sheet("x".repeat(32_767)));
  await assert.rejects(writeWorkbook(sheet("x".repeat(32_768))), RangeError);
  await assert.rejects(writeWorkbook(sheet(`=${"x".repeat(32_766)}`)), RangeError, "the mark makes 32,768");
});
