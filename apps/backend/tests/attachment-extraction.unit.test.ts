import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { ATTACHMENT_LIMITS } from "../src/csrm/files/attachment-policy";
import {
  EXTRACTION_LIMITS,
  EXTRACTION_TEXT_CAP,
  extractAttachmentText,
  EXTRACTOR_VERSION,
  HEAP_WATCH_INTERVAL_MS,
  normaliseExtractedText,
  probePdf,
  type ExtractedText,
} from "../src/csrm/files/extraction";
import { docxText, OOXML_MAIN_TYPES, ooxmlMainPart, OoxmlTextError, pptxText, tokenizeXml, type XmlToken } from "../src/csrm/files/ooxml-text";
import { findZipEntry, readZipDirectory, ZipArchiveError } from "../src/csrm/files/zip-archive";
import { readWorkbookSheets, xlsxCellText, XlsxReadError } from "../src/csrm/spreadsheets/xlsx-reader";
import {
  ARCHITECTURE_DECK_SLIDES,
  ATTACHMENT_FIXTURES,
  buildDocx,
  buildFakeEndRecordArchive,
  buildPasswordPdf,
  buildPdf,
  buildPptx,
  buildScannedPdf,
  buildXlsx,
  buildZipBomb,
  DATA_FLOW_PARAGRAPHS,
  DOCX_MAIN_TYPE,
  PPTX_MAIN_TYPE,
  VENDOR_PACK_FACT,
  VENDOR_PACK_PAGES,
  VENDOR_QUESTIONNAIRE_SHEETS,
  type XlsxCellSpec,
} from "./helpers/attachment-fixtures";

/*
 * Office text (14-02; D-31, D-32): DOCX and PPTX become ordered text through CSRM's own ZIP reader and a DTD-free
 * OOXML scanner. No XML library and no DTD is involved; deleted text, comments, field instructions and speaker notes
 * are never read.
 */

function refusedWith(code: "DOCTYPE_REFUSED" | "OOXML_MALFORMED") {
  return (error: unknown): boolean => {
    assert.ok(error instanceof OoxmlTextError, `EXPECTED_OOXML_TEXT_ERROR_${code}_GOT_${String(error)}`);
    assert.equal(error.code, code);
    return true;
  };
}

function textOf(bytes: Buffer, read: typeof docxText): string {
  return read(readZipDirectory(bytes), bytes);
}

test("tokenizeXml yields tags, attributes and decoded text, skipping the declaration, comments and processing instructions", () => {
  const tokens: XmlToken[] = [...tokenizeXml(`<?xml version="1.0"?><!-- a comment --><a x="1 &amp; 2" y='&#x41;'>T&lt;&gt;&quot;&apos;&#65;&#x1F600;<b/><![CDATA[<raw>]]></a>`)];
  assert.deepEqual(tokens, [
    { kind: "open", name: "a", attributes: Object.assign(Object.create(null), { x: "1 & 2", y: "A" }), selfClosing: false },
    { kind: "text", text: "T<>\"'A\u{1F600}" },
    { kind: "open", name: "b", attributes: Object.create(null), selfClosing: true },
    { kind: "text", text: "<raw>" },
    { kind: "close", name: "a" },
  ]);
});

test("tokenizeXml refuses any DOCTYPE or ENTITY declaration before reading a token", () => {
  for (const xml of [
    `<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>`,
    `<?xml version="1.0"?>\n<!doctype a><a/>`,
    `<a><!ENTITY x "y"></a>`,
    `<a><!-- <!DOCTYPE hidden> --></a>`,
  ]) {
    assert.throws(() => [...tokenizeXml(xml)], refusedWith("DOCTYPE_REFUSED"), `ACCEPTED_${xml}`);
  }
});

test("tokenizeXml refuses unknown entities, mismatched tags and unterminated markup as malformed", () => {
  for (const xml of [`<a>&nbsp;</a>`, `<a>& b</a>`, `<a>&#0;</a>`, `<a>&#xD800;</a>`, `<a></b>`, `<a>`, `<a x="1>`, `<a><!-- open</a>`, `<a/><b/>`]) {
    assert.throws(() => [...tokenizeXml(xml)], refusedWith("OOXML_MALFORMED"), `ACCEPTED_${xml}`);
  }
});

test("tokenizeXml gives attributes no prototype, so a __proto__ attribute is only data", () => {
  const [open] = [...tokenizeXml(`<a __proto__="polluted"/>`)];
  assert.ok(open.kind === "open");
  assert.equal(Object.getPrototypeOf(open.attributes), null);
  assert.equal(open.attributes.__proto__, "polluted");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("ooxmlMainPart names the WordprocessingML and PresentationML main types, macro-free", () => {
  const docx = buildDocx(["Text."]);
  assert.deepEqual(ooxmlMainPart(readZipDirectory(docx), docx), { mainType: DOCX_MAIN_TYPE, macro: false, activeContent: false });
  assert.equal(OOXML_MAIN_TYPES.docx, DOCX_MAIN_TYPE);
  const pptx = buildPptx([["Slide."]]);
  assert.deepEqual(ooxmlMainPart(readZipDirectory(pptx), pptx), { mainType: PPTX_MAIN_TYPE, macro: false, activeContent: false });
  assert.equal(OOXML_MAIN_TYPES.pptx, PPTX_MAIN_TYPE);
  assert.equal(OOXML_MAIN_TYPES.xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml");
});

test("ooxmlMainPart reports a macro for a vbaProject.bin part", () => {
  const docx = buildDocx(["Text."], { macro: true });
  assert.deepEqual(ooxmlMainPart(readZipDirectory(docx), docx), { mainType: DOCX_MAIN_TYPE, macro: true, activeContent: false });
});

test("ooxmlMainPart refuses a package with no [Content_Types].xml", () => {
  const docx = buildDocx(["Text."]);
  const directory = readZipDirectory(docx);
  const withoutContentTypes = { ...directory, entries: directory.entries.filter((entry) => entry.name !== "[Content_Types].xml") };
  assert.throws(() => ooxmlMainPart(withoutContentTypes, docx), refusedWith("OOXML_MALFORMED"));
});

test("docxText gives paragraphs, a table as tab-separated rows and inserted text, without deleted text or the comment", () => {
  const docx = buildDocx(["The vendor hosts data in Sydney.", "Support\tis offshore."], {
    table: [["System", "Owner"], ["Payroll", "Finance"]],
    insertedText: "approved scope",
    deletedText: "DELETED-WORDING-7f3a",
    comment: "COMMENT-WORDING-2b9c",
  });
  const text = textOf(docx, docxText);
  assert.equal(text, [
    "The vendor hosts data in Sydney.",
    "Support\tis offshore.",
    "System\tOwner",
    "Payroll\tFinance",
    "Revised: approved scope",
  ].join("\n"));
  assert.ok(!text.includes("DELETED-WORDING-7f3a"), "DELETED_TEXT_WAS_READ");
  assert.ok(!text.includes("COMMENT-WORDING-2b9c"), "THE_COMMENT_WAS_READ");
});

test("docxText reads a text box once (mc:Fallback skipped) and a field's result but never its instruction", () => {
  const docx = buildDocx(["Intro."], {
    textBox: "Boxed fact.",
    field: { instruction: " HYPERLINK \"https://instruction.invalid\" ", result: "the portal" },
  });
  const text = textOf(docx, docxText);
  assert.equal(text.split("Boxed fact.").length - 1, 1, "THE_TEXT_BOX_WAS_NOT_READ_EXACTLY_ONCE");
  assert.match(text, /the portal/);
  assert.ok(!text.includes("instruction.invalid"), "THE_FIELD_INSTRUCTION_WAS_READ");
});

test("docxText refuses a document.xml containing a DOCTYPE", () => {
  assert.throws(() => textOf(buildDocx(["Text."], { doctype: true }), docxText), refusedWith("DOCTYPE_REFUSED"));
});

test("pptxText reads slides in p:sldIdLst order and never their speaker notes", () => {
  const pptx = buildPptx([["Slide one title", "Slide one body"], ["Slide two title"]], {
    order: [1, 0],
    notes: ["NOTES-ONE-91c2", "NOTES-TWO-44de"],
  });
  const text = textOf(pptx, pptxText);
  assert.equal(text, "Slide two title\n\nSlide one title\nSlide one body");
  assert.ok(!text.includes("NOTES-"), "SPEAKER_NOTES_WERE_READ");
});

test("pptxText keeps a line break inside a paragraph", () => {
  assert.equal(textOf(buildPptx([["Line one\nLine two"]]), pptxText), "Line one\nLine two");
});

/*
 * Worker extraction (14-02 Task 3; D-31 to D-33): every text-bearing type becomes capped, normalised text in an
 * isolated worker with heap and wall-clock limits, one extraction at a time, through the shared readers.
 */

const FIXTURE_DIRECTORY = path.resolve(process.cwd(), "tests", "fixtures", "attachments");
const SOURCE_DIRECTORY = path.resolve(process.cwd(), "src");

function extracted(result: Awaited<ReturnType<typeof extractAttachmentText>>): ExtractedText {
  assert.ok(result.ok, `EXPECTED_TEXT_GOT_${JSON.stringify(result)}`);
  return result;
}

function assertUnavailable(result: Awaited<ReturnType<typeof extractAttachmentText>>, label: string): void {
  assert.deepEqual(result, { ok: false, reason: "ATTACHMENT_TEXT_UNAVAILABLE" }, `${label}_WAS_NOT_UNAVAILABLE`);
}

/** A text PDF of `pages` pages, each `lines` lines of exactly `width` printable characters, and the text pdf.js gives. */
function linesPdf(pages: number, lines: number, width: number): { bytes: Buffer; text: string } {
  const pageTexts: string[] = [];
  for (let page = 0; page < pages; page += 1) {
    const rows: string[] = [];
    for (let line = 0; line < lines; line += 1) {
      const head = `p${page}l${line} `;
      rows.push((head + "abcdefghijklmnopqrstuvwxyz0123456789".repeat(Math.ceil(width / 36))).slice(0, width));
    }
    pageTexts.push(rows.join("\n"));
  }
  return { bytes: buildPdf(pageTexts), text: pageTexts.map((page) => `${page}\n`).join("") };
}

function utf16be(text: string): Buffer {
  const little = Buffer.from(text, "utf16le");
  for (let index = 0; index < little.length; index += 2) {
    const low = little[index];
    little[index] = little[index + 1];
    little[index + 1] = low;
  }
  return little;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|js)$/.test(entry.name) ? [full] : [];
  });
}

test("normaliseExtractedText keeps tabs and line feeds, converts CR and CRLF, drops other controls and applies NFC", () => {
  assert.equal(normaliseExtractedText("a\r\nb\u0007c\u0085d\te"), "a\nbcd\te");
  assert.equal(normaliseExtractedText("one\rtwo\u0000\u001f\u007f\u0080\u009f"), "one\ntwo");
  assert.equal(normaliseExtractedText("Café"), "Café");
});

test("EXTRACTOR_VERSION names CSRM's extractor and the installed unpdf and read-excel-file versions", () => {
  const version = (name: string): string => (JSON.parse(readFileSync(path.resolve(process.cwd(), "node_modules", name, "package.json"), "utf8")) as { version: string }).version;
  assert.equal(EXTRACTOR_VERSION, `csrm-extract/1 unpdf/${version("unpdf")} read-excel-file/${version("read-excel-file")}`);
  assert.equal(EXTRACTOR_VERSION, "csrm-extract/1 unpdf/1.8.1 read-excel-file/9.3.10");
  assert.deepEqual(EXTRACTION_LIMITS, { heapMb: 768, wallClockMs: 30_000, pdfProbeMs: 10_000 });
});

test("a PDF's pages are read in order, each line and page ending with a line feed", async () => {
  const result = extracted(await extractAttachmentText({ type: "pdf", bytes: buildPdf(["Page one text", "Page two\ntext", "Page three text"]) }));
  assert.deepEqual(result, {
    ok: true,
    text: "Page one text\nPage two\ntext\nPage three text\n",
    available: 44,
    kept: 44,
    truncated: false,
    extractor: EXTRACTOR_VERSION,
  });
});

test("the vendor security pack gives UAT-013's fact, counting every character it keeps", async () => {
  const result = extracted(await extractAttachmentText({ type: "pdf", bytes: buildPdf(VENDOR_PACK_PAGES) }));
  const expected = VENDOR_PACK_PAGES.map((page) => `${page}\n`).join("");
  assert.match(result.text, /offshore support team has administrator access/);
  assert.ok(result.text.includes(VENDOR_PACK_FACT), "THE_FACT_WAS_NOT_READ_VERBATIM");
  assert.equal(result.text, expected);
  assert.equal(result.available, expected.length);
  assert.equal(result.kept, expected.length);
  assert.equal(result.truncated, false);
});

test("a PDF of 30,000 characters keeps the first 20,000 and reports the rest as available", async () => {
  const { bytes, text } = linesPdf(3, 100, 99);
  assert.equal(text.length, 30_000);
  const result = extracted(await extractAttachmentText({ type: "pdf", bytes }));
  assert.equal(result.kept, 20_000);
  assert.equal(result.truncated, true);
  assert.equal(result.available, 30_000);
  assert.equal(result.text, text.slice(0, 20_000));
});

test("the cap is the caller's, and it never splits a surrogate pair", async () => {
  const small = extracted(await extractAttachmentText({ type: "txt", bytes: Buffer.from("abcdefghij", "utf8"), cap: 4 }));
  assert.deepEqual([small.text, small.kept, small.available, small.truncated], ["abcd", 4, 10, true]);
  const emoji = extracted(await extractAttachmentText({ type: "txt", bytes: Buffer.from("ab\u{1F600}cd", "utf8"), cap: 3 }));
  assert.deepEqual([emoji.text, emoji.kept, emoji.available, emoji.truncated], ["ab", 2, 6, true]);
});

test("probePdf opens a text PDF, names a password-protected one and calls anything else invalid", async () => {
  assert.equal(await probePdf(buildPdf(["Opens."])), "ok");
  assert.equal(await probePdf(buildScannedPdf()), "ok");
  assert.equal(await probePdf(buildPasswordPdf()), "password");
  assert.equal(await probePdf(buildDocx(["Not a PDF."])), "invalid");
  assert.equal(await probePdf(Buffer.from("%PDF-1.4\nnot really\n", "latin1")), "invalid");
  assert.equal(await probePdf(buildPdf(["Opens."]), { ...EXTRACTION_LIMITS, pdfProbeMs: 1 }), "invalid", "A_PROBE_TIMEOUT_WAS_NOT_INVALID");
});

test("a scanned PDF, a password-protected PDF and ZIP bytes named PDF have no text", async () => {
  assertUnavailable(await extractAttachmentText({ type: "pdf", bytes: buildScannedPdf() }), "SCANNED_PDF");
  assertUnavailable(await extractAttachmentText({ type: "pdf", bytes: buildPasswordPdf() }), "PASSWORD_PDF");
  assertUnavailable(await extractAttachmentText({ type: "pdf", bytes: buildDocx(["Not a PDF."]) }), "ZIP_AS_PDF");
});

test("readWorkbookSheets returns every sheet with typed cells, the formula's cached value and never the formula", async () => {
  const sheets = await readWorkbookSheets(buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS));
  assert.deepEqual(sheets, [
    {
      name: "Controls",
      rows: [
        ["Control", "Answer", "Score", "Weight", "Total", "Reviewed"],
        ["MFA for administrators", true, 2, 1, 3, new Date(Date.UTC(2026, 8, 30))],
        ["Encryption at rest", false, 1.5, null, null, null],
      ],
    },
    { name: "Vendors", rows: [["Vendor", "Region"], ["Example Vendor Pty Ltd", "Sydney"]] },
  ]);
});

test("xlsxCellText gives ISO dates, TRUE and FALSE, plain numbers and empty cells", () => {
  assert.equal(xlsxCellText(new Date(Date.UTC(2026, 8, 30))), "2026-09-30");
  assert.equal(xlsxCellText(true), "TRUE");
  assert.equal(xlsxCellText(false), "FALSE");
  assert.equal(xlsxCellText(1.5), "1.5");
  assert.equal(xlsxCellText(3), "3");
  assert.equal(xlsxCellText("text"), "text");
  assert.equal(xlsxCellText(null), "");
});

test("readWorkbookSheets refuses a workbook over its inflation bound before reading it, and wraps an unreadable one", async () => {
  const bytes = buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS);
  await assert.rejects(readWorkbookSheets(bytes, { maxInflated: 256 }), (error: unknown) => {
    assert.ok(error instanceof XlsxReadError, `EXPECTED_XLSX_READ_ERROR_GOT_${String(error)}`);
    assert.equal(error.code, "XLSX_TOO_LARGE");
    return true;
  });
  for (const unreadable of [Buffer.from("not a workbook"), buildDocx(["A document, not a workbook."]), buildZipBomb()]) {
    await assert.rejects(readWorkbookSheets(unreadable), (error: unknown) => {
      assert.ok(error instanceof XlsxReadError, `EXPECTED_XLSX_READ_ERROR_GOT_${String(error)}`);
      assert.equal(error.code, "XLSX_UNREADABLE");
      return true;
    });
  }
});

test("readWorkbookSheets refuses a workbook whose XML declares a DOCTYPE, before the library parses it", async () => {
  await assert.rejects(readWorkbookSheets(buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS, { doctype: true })), (error: unknown) => {
    assert.ok(error instanceof XlsxReadError, `EXPECTED_XLSX_READ_ERROR_GOT_${String(error)}`);
    assert.equal(error.code, "XLSX_UNREADABLE");
    assert.match(error.message, /DOCTYPE/);
    return true;
  });
  assertUnavailable(await extractAttachmentText({ type: "xlsx", bytes: buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS, { doctype: true }) }), "DOCTYPE_XLSX");
});

test("readWorkbookSheets refuses a DOCTYPE in a UTF-16 part, or written with a space, by tokenizeXml's own rule (IN-207)", async () => {
  for (const [label, bytes] of [
    ["UTF16LE", buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS, { doctype: true, firstSheetEncoding: "utf-16le" })],
    ["UTF16BE", buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS, { doctype: true, firstSheetEncoding: "utf-16be" })],
    ["SPACED", buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS, { doctype: "<! DOCTYPE worksheet>\n" })],
  ] as const) {
    const outcome = await readWorkbookSheets(bytes).then((sheets) => sheets, (error: unknown) => error);
    assert.ok(outcome instanceof XlsxReadError && outcome.code === "XLSX_UNREADABLE" && /DOCTYPE/.test(outcome.message),
      `${label}_DOCTYPE_WAS_NOT_REFUSED_BY_CSRM'S_CHECK: ${outcome instanceof Error ? outcome.message : JSON.stringify(outcome)}`);
  }
});

test("readWorkbookSheets never lets the library read an end record CSRM did not validate: a fake one hidden in a comment is refused (CR-201)", async () => {
  const archive = buildFakeEndRecordArchive(buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS), buildXlsx([{ name: "Hidden", rows: [["FAKE-DIRECTORY-TEXT"]] }]));
  const outcome = await readWorkbookSheets(archive).then((sheets) => sheets, (error: unknown) => error);
  assert.ok(outcome instanceof XlsxReadError, `THE_LIBRARY_READ_A_DIRECTORY_CSRM_NEVER_VALIDATED: ${JSON.stringify(outcome)}`);
  assert.equal(outcome.code, "XLSX_UNREADABLE");
  assert.ok(outcome.cause instanceof ZipArchiveError, `EXPECTED_A_ZIP_REFUSAL_GOT_${String(outcome.cause)}`);
  assert.equal(outcome.cause.code, "ZIP_COMMENT");
  assertUnavailable(await extractAttachmentText({ type: "xlsx", bytes: archive }), "FAKE_END_RECORD_XLSX");
});

/** A worksheet big and repetitive enough that fflate's unzip would inflate it in a Worker of its own (WR-201). */
function largeRegisterRows(): XlsxCellSpec[][] {
  return Array.from({ length: 12_000 }, (_, index) => [index, index * 3, index % 2 === 0]);
}

test("reading an XLSX starts no nested Worker, even when a part is large enough for fflate's worker path (WR-201)", async () => {
  let started = 0;
  const count = (): void => {
    started += 1;
  };
  process.on("worker", count);
  try {
    // The counter sees a Worker this thread starts.
    await new Promise<void>((resolve, reject) => new Worker("", { eval: true }).once("exit", () => resolve()).once("error", reject));
    assert.equal(started, 1, "THE_WORKER_COUNTER_DOES_NOT_SEE_A_WORKER");
    started = 0;

    const rows = largeRegisterRows();
    const bytes = buildXlsx([{ name: "Register", rows }]);
    const sheet = findZipEntry(readZipDirectory(bytes), "xl/worksheets/sheet1.xml");
    // fflate 0.8.3's unzip inflates a deflated part in a new Worker when it is 512 KiB or more and saves 20% or more.
    assert.ok(sheet && sheet.method === 8 && sheet.uncompressedSize >= 524_288 && sheet.compressedSize <= 0.8 * sheet.uncompressedSize,
      "THE_WORKSHEET_WOULD_NOT_TAKE_FFLATE'S_WORKER_PATH");

    const sheets = await readWorkbookSheets(bytes);
    assert.equal(started, 0, `NESTED_WORKERS_STARTED: ${started}`);
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0].rows.length, rows.length);
    assert.deepEqual(sheets[0].rows[11_999], [11_999, 35_997, false]);
  } finally {
    process.off("worker", count);
  }
});

/** What today's extractor gives for each committed text-bearing fixture (recorded before CR-201's fix). */
const FIXTURE_TEXTS: Readonly<Record<string, readonly ["pdf" | "docx" | "xlsx" | "pptx", string]>> = {
  "vendor-security-pack.pdf": ["pdf", VENDOR_PACK_PAGES.map((page) => `${page}\n`).join("")],
  "data-flow.docx": ["docx", [
    "Data flow: payroll SaaS",
    "Employee records flow nightly from the HR system to the vendor over SFTP.",
    "Data\tClassification",
    "Payroll\tConfidential",
  ].join("\n")],
  "vendor-questionnaire.xlsx": ["xlsx", [
    "Sheet: Controls",
    "Control\tAnswer\tScore\tWeight\tTotal\tReviewed",
    "MFA for administrators\tTRUE\t2\t1\t3\t2026-09-30",
    "Encryption at rest\tFALSE\t1.5",
    "",
    "Sheet: Vendors",
    "Vendor\tRegion",
    "Example Vendor Pty Ltd\tSydney",
  ].join("\n")],
  "architecture-deck.pptx": ["pptx", "Architecture\nPayroll SaaS overview\n\nIntegration\nSFTP from the HR system, nightly"],
};

test("every committed text-bearing fixture extracts exactly its recorded text", async () => {
  for (const [fileName, [type, expected]] of Object.entries(FIXTURE_TEXTS)) {
    const result = extracted(await extractAttachmentText({ type, bytes: readFileSync(path.join(FIXTURE_DIRECTORY, fileName)) }));
    assert.deepEqual({ text: result.text, available: result.available, truncated: result.truncated }, { text: expected, available: expected.length, truncated: false }, `${fileName}_TEXT_CHANGED`);
  }
});

test("an XLSX gives a Sheet line per sheet and tab-separated rows, with cached values and no formula", async () => {
  const result = extracted(await extractAttachmentText({ type: "xlsx", bytes: buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS) }));
  assert.equal(result.text, [
    "Sheet: Controls",
    "Control\tAnswer\tScore\tWeight\tTotal\tReviewed",
    "MFA for administrators\tTRUE\t2\t1\t3\t2026-09-30",
    "Encryption at rest\tFALSE\t1.5",
    "",
    "Sheet: Vendors",
    "Vendor\tRegion",
    "Example Vendor Pty Ltd\tSydney",
  ].join("\n"));
  assert.ok(!result.text.includes("=SUM(") && !result.text.includes("SUM("), "A_FORMULA_WAS_READ");
});

test("a DOCX and a PPTX through the worker give exactly the direct scanner's text", async () => {
  const docx = buildDocx(DATA_FLOW_PARAGRAPHS, { table: [["Data", "Classification"], ["Payroll", "Confidential"]], deletedText: "DELETED-WORDING-7f3a", comment: "COMMENT-WORDING-2b9c" });
  const pptx = buildPptx(ARCHITECTURE_DECK_SLIDES, { order: [1, 0], notes: ["NOTES-ONE-91c2", "NOTES-TWO-44de"] });
  const docxResult = extracted(await extractAttachmentText({ type: "docx", bytes: docx }));
  const pptxResult = extracted(await extractAttachmentText({ type: "pptx", bytes: pptx }));
  assert.equal(docxResult.text, normaliseExtractedText(docxText(readZipDirectory(docx), docx)));
  assert.equal(pptxResult.text, normaliseExtractedText(pptxText(readZipDirectory(pptx), pptx)));
  assert.ok(!docxResult.text.includes("DELETED-WORDING") && !docxResult.text.includes("COMMENT-WORDING"));
  assert.ok(!pptxResult.text.includes("NOTES-"));
});

test("an Office file with a DOCTYPE, a ZIP bomb or the wrong package has no text", async () => {
  assertUnavailable(await extractAttachmentText({ type: "docx", bytes: buildDocx(["Text."], { doctype: true }) }), "DOCTYPE_DOCX");
  assertUnavailable(await extractAttachmentText({ type: "docx", bytes: buildZipBomb() }), "ZIP_BOMB_DOCX");
  assertUnavailable(await extractAttachmentText({ type: "pptx", bytes: buildDocx(["A document."]) }), "DOCX_AS_PPTX");
  assertUnavailable(await extractAttachmentText({ type: "xlsx", bytes: buildZipBomb() }), "ZIP_BOMB_XLSX");
});

test("TXT and CSV decode as UTF-8, or UTF-16 after its byte order mark, and invalid UTF-8 has no text", async () => {
  const text = async (bytes: Buffer, type: "txt" | "csv" = "txt") => extracted(await extractAttachmentText({ type, bytes })).text;
  assert.equal(await text(Buffer.from("Line one\r\nLine two café", "utf8")), "Line one\nLine two café");
  assert.equal(await text(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("With a BOM", "utf8")])), "With a BOM");
  assert.equal(await text(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("UTF-16 little-endian", "utf16le")])), "UTF-16 little-endian");
  assert.equal(await text(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be("UTF-16 big-endian")])), "UTF-16 big-endian");
  assert.equal(await text(Buffer.from("Control,Answer\nMFA,Yes\n", "utf8"), "csv"), "Control,Answer\nMFA,Yes\n");
  assertUnavailable(await extractAttachmentText({ type: "txt", bytes: Buffer.from([0x41, 0xff, 0x42]) }), "INVALID_UTF8");
  assertUnavailable(await extractAttachmentText({ type: "txt", bytes: Buffer.from(" \r\n\t\u0007 ", "utf8") }), "BLANK_TXT");
});

test("the caller's bytes stay usable after an extraction", async () => {
  const bytes = buildPdf(["Still mine."]);
  const before = Buffer.from(bytes);
  extracted(await extractAttachmentText({ type: "pdf", bytes }));
  assert.equal(bytes.byteLength, before.byteLength, "THE_CALLER'S_BUFFER_WAS_DETACHED");
  assert.ok(bytes.equals(before));
});

test("an extraction over its wall clock is unavailable and its worker is terminated before it settles", async () => {
  const events: string[] = [];
  const result = await extractAttachmentText(
    { type: "pdf", bytes: buildPdf(VENDOR_PACK_PAGES) },
    { ...EXTRACTION_LIMITS, wallClockMs: 1 },
    { onWorkerStart: () => events.push("start"), onWorkerExit: () => events.push("exit") },
  );
  assertUnavailable(result, "WALL_CLOCK_OVERRUN");
  assert.deepEqual(events, ["start", "exit"], "THE_WORKER_WAS_NOT_TERMINATED_BEFORE_THE_RESULT");
});

/*
 * IN-306: the heap a worker is given to prove an overrun during extraction, not while it loads pdf.js. Measured on the
 * build host (2026-10-11, ten runs each at 24 and 32 MB): a one-page PDF needs 16 MB (at 8 MB it fails while the parser
 * loads), and the 300-page PDF below fails up to 48 MB and extracts at 64 MB, so 32 MB sits inside the band with room on
 * both sides.
 */
const HEAP_PROBE_MB = 32;

test("an extraction over its heap limit is unavailable, though the same heap loads the parser and reads a small PDF, and the same PDF reads within the default limits (IN-306)", async () => {
  const limits = { ...EXTRACTION_LIMITS, heapMb: HEAP_PROBE_MB };
  // The control: at this heap a worker loads pdf.js and runs its handler to the end.
  const small = extracted(await extractAttachmentText({ type: "pdf", bytes: buildPdf(["One page that fits the probe heap."]) }, limits));
  assert.equal(small.text, "One page that fits the probe heap.\n", "THE_PROBE_HEAP_CANNOT_LOAD_THE_PARSER");
  const { bytes, text } = linesPdf(300, 100, 99);
  const events: string[] = [];
  const started = Date.now();
  const overrun = await extractAttachmentText({ type: "pdf", bytes }, limits, { onWorkerStart: () => events.push("start"), onWorkerExit: () => events.push("exit") });
  assertUnavailable(overrun, "HEAP_OVERRUN");
  assert.deepEqual(events, ["start", "exit"], "THE_WORKER_WAS_NOT_STARTED_AND_ENDED_BEFORE_THE_RESULT");
  assert.ok(Date.now() - started < EXTRACTION_LIMITS.wallClockMs, "THE_OVERRUN_WAS_THE_WALL_CLOCK");
  const result = extracted(await extractAttachmentText({ type: "pdf", bytes }));
  assert.equal(result.available, text.length);
  assert.equal(result.kept, 20_000);
});

test("the heap watchdog reads the worker's heap and leaves no timer behind when the worker reads its file or overruns (IN-306)", async () => {
  const timers = (): number => process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
  const before = timers();
  const limits = { ...EXTRACTION_LIMITS, heapMb: HEAP_PROBE_MB };
  extracted(await extractAttachmentText({ type: "pdf", bytes: buildPdf(["One page that fits the probe heap."]) }, limits));
  assert.equal(timers(), before, "A_TIMER_OUTLIVED_A_READ_FILE");
  assertUnavailable(await extractAttachmentText({ type: "pdf", bytes: linesPdf(300, 100, 99).bytes }, limits), "HEAP_OVERRUN");
  assert.equal(timers(), before, "A_TIMER_OUTLIVED_AN_OVERRUN");
  assert.ok(HEAP_WATCH_INTERVAL_MS > 0 && HEAP_WATCH_INTERVAL_MS <= 50, "THE_WATCHDOG_READS_TOO_RARELY");
});

test("two concurrent extractions run one after the other", async () => {
  const events: string[] = [];
  const observer = (label: string) => ({ onWorkerStart: () => events.push(`${label} start`), onWorkerExit: () => events.push(`${label} exit`) });
  const [first, second] = await Promise.all([
    extractAttachmentText({ type: "pdf", bytes: buildPdf(VENDOR_PACK_PAGES) }, EXTRACTION_LIMITS, observer("first")),
    extractAttachmentText({ type: "txt", bytes: Buffer.from("Second.", "utf8") }, EXTRACTION_LIMITS, observer("second")),
  ]);
  extracted(first);
  assert.equal(extracted(second).text, "Second.");
  assert.deepEqual(events, ["first start", "first exit", "second start", "second exit"]);
});

test("the committed fixtures are exactly the builders' output, and the README names each with its builder", async () => {
  const readme = readFileSync(path.join(FIXTURE_DIRECTORY, "README.md"), "utf8");
  for (const fixture of ATTACHMENT_FIXTURES) {
    const committed = readFileSync(path.join(FIXTURE_DIRECTORY, fixture.fileName));
    assert.ok(committed.equals(fixture.build()), `${fixture.fileName}_DIFFERS_FROM_ITS_BUILDER`);
    assert.ok(readme.includes(fixture.fileName) && readme.includes(fixture.builder), `README_MISSES_${fixture.fileName}`);
  }
  assert.equal(ATTACHMENT_FIXTURES.length, 6);
  assert.ok(readme.includes("No fixture contains a malware test string; hostile variants are built in memory by tests/helpers/attachment-fixtures.ts."));
  const textBearing = { "vendor-security-pack.pdf": "pdf", "data-flow.docx": "docx", "vendor-questionnaire.xlsx": "xlsx", "architecture-deck.pptx": "pptx" } as const;
  for (const [fileName, type] of Object.entries(textBearing)) {
    const fixture = ATTACHMENT_FIXTURES.find((candidate) => candidate.fileName === fileName);
    assert.ok(fixture);
    const result = extracted(await extractAttachmentText({ type, bytes: readFileSync(path.join(FIXTURE_DIRECTORY, fileName)) }));
    assert.ok(result.text.includes(fixture.knownText), `${fileName}_LOST_ITS_KNOWN_TEXT`);
  }
});

/**
 * WR-305 (D-14): the two markers the phase's EICAR gate searches for, built from character codes so that no source,
 * test or compiled file spells them and the gate never matches this test.
 */
const ANTIVIRUS_TEST_MARKERS = [
  [69, 73, 67, 65, 82, 45, 83, 84, 65, 78, 68, 65, 82, 68],
  [65, 78, 84, 73, 86, 73, 82, 85, 83, 45, 84, 69, 83, 84],
].map((codes) => Buffer.from(String.fromCharCode(...codes), "latin1"));

function carriesAntivirusTestMarker(bytes: Buffer): boolean {
  return ANTIVIRUS_TEST_MARKERS.some((marker) => bytes.includes(marker));
}

test("no file in the fixture folder carries the antivirus test file's markers, and the folder holds only the README and the builders' six files (WR-305)", () => {
  // The detector is calibrated in memory only: nothing that carries a marker is ever written to disk.
  for (const [index, marker] of ANTIVIRUS_TEST_MARKERS.entries()) {
    assert.equal(marker.length, 14, `MARKER_${index}_IS_NOT_14_BYTES`);
    assert.ok(carriesAntivirusTestMarker(Buffer.concat([Buffer.from("leading bytes "), marker, Buffer.from(" trailing bytes")])), `THE_DETECTOR_MISSED_MARKER_${index}`);
  }
  const names = readdirSync(FIXTURE_DIRECTORY).sort();
  assert.deepEqual(names, ["README.md", ...ATTACHMENT_FIXTURES.map((fixture) => fixture.fileName)].sort(), "THE_FIXTURE_FOLDER_HOLDS_A_FILE_NO_BUILDER_WROTE");
  for (const name of names) {
    assert.equal(carriesAntivirusTestMarker(readFileSync(path.join(FIXTURE_DIRECTORY, name))), false, `${name}_CARRIES_AN_ANTIVIRUS_TEST_MARKER`);
  }
});

test("the worker never evaluates PDF code or loads every page at once, and only the XLSX reader names read-excel-file", () => {
  const worker = readFileSync(path.join(SOURCE_DIRECTORY, "csrm", "files", "extraction-worker.ts"), "utf8");
  assert.match(worker, /isEvalSupported: false/);
  assert.ok(!worker.includes("extractText("), "THE_WORKER_CALLS_UNPDF_EXTRACT_TEXT");
  const naming = sourceFiles(SOURCE_DIRECTORY).filter((file) => readFileSync(file, "utf8").includes("read-excel-file"));
  assert.deepEqual(naming.map((file) => path.relative(SOURCE_DIRECTORY, file).split(path.sep).join("/")), ["csrm/spreadsheets/xlsx-reader.ts"]);
});

/*
 * WR-202: the extraction and PDF-probe workers parse hostile bytes, so they start with an empty environment and no Node
 * flags, and none of Strapi's secrets is in their reach. The test puts sentinel secrets in this process's environment,
 * then lets the real call path (probePdf and extractAttachmentText, through the one worker runner) construct its Worker
 * with its own options; only the script is swapped, for one that reports the worker's `process.env` keys and its
 * `process.execArgv`. Nothing in production changes for the test. A worker is a resource boundary, not a privilege
 * boundary: it has the full Node API, and the empty environment is what keeps the secrets out of it (R-08-43).
 */
const STRAPI_SECRET_SENTINELS: Readonly<Record<string, string>> = {
  DATABASE_PASSWORD: "sentinel-database-password",
  APP_KEYS: "sentinel-app-key-1,sentinel-app-key-2",
  JWT_SECRET: "sentinel-jwt-secret",
  ADMIN_JWT_SECRET: "sentinel-admin-jwt-secret",
  API_TOKEN_SALT: "sentinel-api-token-salt",
  ENCRYPTION_KEY: "sentinel-encryption-key",
  CSRM_AI_QUESTIONNAIRE_API_KEY: "sentinel-ai-key",
  CSRM_ATTACHMENT_S3_SECRET_ACCESS_KEY: "sentinel-s3-secret",
  AWS_SECRET_ACCESS_KEY: "sentinel-aws-secret",
  KEYCLOAK_ADMIN_CLIENT_SECRET: "sentinel-keycloak-secret",
};

type WorkerReport = { environmentKeys: string[]; execArgv: string[] };

const REPORTING_WORKER = [
  "const { parentPort } = require('node:worker_threads');",
  "parentPort.postMessage({ environmentKeys: Object.keys(process.env), execArgv: process.execArgv });",
].join("\n");

/**
 * Runs `start` with node:worker_threads' Worker swapped for one that keeps the caller's filename and options but runs
 * REPORTING_WORKER, and returns what the caller asked for and what the worker reported.
 */
async function workerStartedBy(start: () => Promise<unknown>): Promise<{ filename: string; report: WorkerReport }> {
  const threads = require("node:worker_threads") as { Worker: typeof Worker };
  const RealWorker = threads.Worker;
  let filename = "";
  let reported: (report: WorkerReport) => void = () => undefined;
  const report = new Promise<WorkerReport>((resolve) => { reported = resolve; });
  threads.Worker = class ReportingWorker extends RealWorker {
    constructor(file: string | URL, options: ConstructorParameters<typeof Worker>[1] = {}) {
      super(REPORTING_WORKER, { ...options, eval: true });
      filename = String(file);
      this.once("message", (message: WorkerReport) => reported(message));
    }
  };
  try {
    await start();
  } finally {
    threads.Worker = RealWorker;
  }
  return { filename, report: await report };
}

test("the extraction and probe workers start with an empty environment and no Node flags, so none of Strapi's secrets reaches a parser (WR-202)", async () => {
  const previous = new Map(Object.keys(STRAPI_SECRET_SENTINELS).map((key) => [key, process.env[key]] as const));
  Object.assign(process.env, STRAPI_SECRET_SENTINELS);
  try {
    for (const [label, start] of [
      ["PROBE", () => probePdf(buildPdf(["Environment probe."]))],
      ["EXTRACT", () => extractAttachmentText({ type: "txt", bytes: Buffer.from("Environment probe.", "utf8") })],
    ] as const) {
      const { filename, report } = await workerStartedBy(start);
      assert.equal(path.basename(filename), "extraction-worker.js", `UNEXPECTED_WORKER_SCRIPT_${label}: ${filename}`);
      const leaked = report.environmentKeys.filter((key) => key in STRAPI_SECRET_SENTINELS);
      assert.deepEqual(leaked, [], `THE_WORKER_SEES_STRAPI_SECRETS_${label}: ${leaked.join(",")}`);
      assert.deepEqual(report.environmentKeys, [], `THE_WORKER_ENVIRONMENT_IS_NOT_EMPTY_${label}: ${report.environmentKeys.length} keys`);
      assert.deepEqual(report.execArgv, [], `THE_WORKER_INHERITS_NODE_FLAGS_${label}: ${report.execArgv.join(" ")}`);
    }
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  // The real worker still reads every type in that empty environment.
  assert.equal(await probePdf(buildPdf(["Still opens."])), "ok", "THE_REAL_PROBE_FAILED_IN_AN_EMPTY_ENVIRONMENT");
  assert.ok(extracted(await extractAttachmentText({ type: "pdf", bytes: buildPdf(["Still reads."]) })).text.includes("Still reads."), "THE_REAL_EXTRACTION_FAILED_IN_AN_EMPTY_ENVIRONMENT");
});

/* IN-201: the per-file text cap has one source, the attachment policy's D-33 figure. */
test("the extraction's default cap is the attachment policy's one text cap (IN-201)", async () => {
  assert.equal(EXTRACTION_TEXT_CAP, ATTACHMENT_LIMITS.textCapCharacters, "THE_EXTRACTION_CAP_IS_NOT_THE_POLICY_CAP");
  const long = "a".repeat(ATTACHMENT_LIMITS.textCapCharacters + 5);
  const result = extracted(await extractAttachmentText({ type: "txt", bytes: Buffer.from(long, "utf8") }));
  assert.deepEqual([result.kept, result.available, result.truncated], [ATTACHMENT_LIMITS.textCapCharacters, long.length, true], "THE_DEFAULT_CAP_IS_NOT_THE_POLICY_CAP");
});

/*
 * WR-204 (the pilot's ruling): the one screening and extraction queue runs one task and holds at most
 * EXTRACTION_QUEUE_MAX_WAITING more. The next is refused at once with ExtractionBusyError, which the service answers 503
 * ATTACHMENT_BUSY, instead of waiting behind a queue anyone can fill. Probes and extractions share the same places
 * (separate slots would double the worst-case worker memory). A task that ends, settled or failed, frees its place.
 */
type BoundedQueue = {
  runExclusively?: <T>(task: () => Promise<T>) => Promise<T>;
  EXTRACTION_QUEUE_MAX_WAITING?: number;
  ExtractionBusyError?: new () => Error;
};

test("the screening and extraction queue holds one running and four waiting tasks: the next is refused at once, and the queue recovers when the held task ends (WR-204)", async () => {
  const queue = require("../src/csrm/files/extraction") as BoundedQueue;
  const { runExclusively, EXTRACTION_QUEUE_MAX_WAITING: bound, ExtractionBusyError } = queue;
  assert.ok(runExclusively && ExtractionBusyError, "THE_QUEUE_IS_NOT_BOUNDED");
  assert.equal(bound, 4, "THE_WAITING_BOUND_IS_NOT_FOUR");
  const busy = (error: unknown): boolean => {
    assert.ok(error instanceof ExtractionBusyError, `NOT_REFUSED_AS_BUSY: ${String(error)}`);
    assert.equal((error as { code?: unknown }).code, "EXTRACTION_BUSY");
    return true;
  };

  const order: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const held = runExclusively(async () => {
    order.push("held");
    await gate;
  });
  try {
    const waiting = Array.from({ length: 4 }, (_, index) => runExclusively(async () => {
      order.push(`waiting ${index}`);
      if (index === 1) throw new Error("a waiting task that fails");
    }));
    const settledWaiting = Promise.allSettled(waiting);
    await assert.rejects(runExclusively(async () => order.push("over the bound")), busy, "THE_FIFTH_WAITING_TASK_WAS_QUEUED");
    await assert.rejects(probePdf(buildPdf(["Over the bound."])), busy, "THE_PROBE_WAITED_BEYOND_THE_BOUND");
    await assert.rejects(extractAttachmentText({ type: "txt", bytes: Buffer.from("Over the bound.", "utf8") }), busy, "THE_EXTRACTION_WAITED_BEYOND_THE_BOUND");
    assert.deepEqual(order, ["held"], "A_TASK_RAN_BESIDE_THE_HELD_ONE");

    release();
    await held;
    const outcomes = await settledWaiting;
    assert.deepEqual(outcomes.map((outcome) => outcome.status), ["fulfilled", "rejected", "fulfilled", "fulfilled"], "UNEXPECTED_WAITING_OUTCOMES");
    assert.deepEqual(order, ["held", "waiting 0", "waiting 1", "waiting 2", "waiting 3"], "THE_WAITING_TASKS_DID_NOT_RUN_IN_ORDER");
  } finally {
    release();
  }
  assert.equal(await probePdf(buildPdf(["Recovered."])), "ok", "THE_QUEUE_DID_NOT_RECOVER");
  assert.equal(extracted(await extractAttachmentText({ type: "txt", bytes: Buffer.from("Recovered.", "utf8") })).text, "Recovered.", "THE_QUEUE_DID_NOT_RECOVER_FOR_AN_EXTRACTION");
});
