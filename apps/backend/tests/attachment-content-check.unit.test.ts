import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { checkAttachmentContent, sniffSignature } from "../src/csrm/files/content-check";
import { probePdf, type PdfProbe } from "../src/csrm/files/extraction";
import { createDevelopmentScanner, CSRM_TEST_MALWARE_SIGNATURE, type MalwareScanner, type ScanVerdict } from "../src/csrm/files/scanner";
import { screenAttachment } from "../src/csrm/files/screen-attachment";
import { readZipDirectory, readZipEntry, ZipArchiveError } from "../src/csrm/files/zip-archive";
import {
  buildDocx,
  buildEncryptedFlagZip,
  buildEncryptedOoxml,
  buildFakeEndRecordArchive,
  buildLegacyDoc,
  buildMacroDocx,
  buildNotOoxmlZip,
  buildPasswordPdf,
  buildPdf,
  buildPortableExecutableHeader,
  buildPptx,
  buildRenamedExecutable,
  buildVbaProjectDocx,
  buildXlsx,
  buildZip,
  contentTypesXml,
  DOCM_MAIN_TYPE,
  DOCX_MAIN_TYPE,
  docxContentTypes,
  OFFICE_RELATIONSHIPS,
  relationshipsXml,
  type ZipBuildOptions,
  type ZipEntrySpec,
} from "./helpers/attachment-fixtures";

/*
 * Screening (14-03; D-09 to D-12): one call checks a file's name, size and content against the allow-list, digests
 * the bytes and asks the malware scanner. Every refusal is a closed reason; screening stores and logs nothing.
 */

const FIXTURE_DIRECTORY = path.resolve(process.cwd(), "tests", "fixtures", "attachments");

function fixture(fileName: string): Buffer {
  return readFileSync(path.join(FIXTURE_DIRECTORY, fileName));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function scannerAnswering(verdict: ScanVerdict | Error): MalwareScanner {
  return {
    name: "scripted",
    async scan() {
      if (verdict instanceof Error) throw verdict;
      return verdict;
    },
  };
}

test("the committed data-flow DOCX is screened clean, with its type, size, digest and the scanner's engine", async () => {
  const bytes = fixture("data-flow.docx");
  const result = await screenAttachment({ fileName: "data-flow.docx", bytes }, { scanner: createDevelopmentScanner(), probePdf });
  assert.deepEqual(result, {
    outcome: "clean",
    name: "data-flow.docx",
    type: "docx",
    byteSize: bytes.length,
    sha256: sha256(bytes),
    engine: "csrm-development-double/1",
  });
  assert.match(result.outcome === "clean" ? result.sha256 : "", /^[0-9a-f]{64}$/);
});

test("the committed vendor security pack is screened clean as a PDF", async () => {
  const bytes = fixture("vendor-security-pack.pdf");
  const result = await screenAttachment({ fileName: "vendor-security-pack.pdf", bytes }, { scanner: createDevelopmentScanner(), probePdf });
  assert.equal(result.outcome, "clean");
  assert.equal(result.outcome === "clean" ? result.type : null, "pdf");
  assert.equal(result.outcome === "clean" ? result.sha256 : null, sha256(bytes));
});

test("a text file carrying the CSRM test signature is refused as malware, with the double's detection", async () => {
  const bytes = Buffer.from(`Vendor notes\n${CSRM_TEST_MALWARE_SIGNATURE}\n`, "utf8");
  const result = await screenAttachment({ fileName: "notes.txt", bytes }, { scanner: createDevelopmentScanner(), probePdf });
  assert.deepEqual(result, {
    outcome: "refused",
    reason: "ATTACHMENT_MALWARE_FOUND",
    detection: "Csrm.Test.Signature",
    engine: "csrm-development-double/1",
    name: "notes.txt",
    type: "txt",
    byteSize: bytes.length,
    sha256: sha256(bytes),
  });
});

test("a scanner that cannot give a verdict leaves the file not scanned, never clean", async () => {
  const bytes = Buffer.from("Plain vendor notes.\n", "utf8");
  const result = await screenAttachment(
    { fileName: "notes.txt", bytes },
    { scanner: scannerAnswering({ kind: "not-scanned", engine: "clamav 1.4.1", cause: "timeout" }), probePdf },
  );
  assert.deepEqual(result, { outcome: "not-scanned", name: "notes.txt", type: "txt", byteSize: bytes.length, sha256: sha256(bytes), engine: "clamav 1.4.1", cause: "timeout" });
});

test("a scanner that throws leaves the file not scanned with the error cause", async () => {
  const bytes = Buffer.from("Plain vendor notes.\n", "utf8");
  const result = await screenAttachment({ fileName: "notes.txt", bytes }, { scanner: scannerAnswering(new Error("socket hang up")), probePdf });
  assert.equal(result.outcome, "not-scanned");
  assert.equal(result.outcome === "not-scanned" ? result.cause : null, "error");
  assert.equal(result.outcome === "not-scanned" ? result.engine : null, "scripted");
});

test("a refused content check never reaches the scanner", async () => {
  let scanned = false;
  const scanner: MalwareScanner = {
    name: "watching",
    async scan() {
      scanned = true;
      return { kind: "clean", engine: "watching" };
    },
  };
  const result = await screenAttachment({ fileName: "invoice.pdf", bytes: fixture("diagram.png") }, { scanner, probePdf });
  assert.equal(result.outcome, "refused");
  assert.equal(result.outcome === "refused" ? result.reason : null, "ATTACHMENT_CONTENT_MISMATCH");
  assert.equal(scanned, false);
});

/*
 * WR-203 (the pilot's ruling, which differs from the finding: the open check is not deferred when the scanner does not
 * answer): the cheap checks come first, then the malware scan, and only then the PDF open check, a full pdf.js parse in
 * the extraction worker. An infected PDF is refused without ever being parsed. A clean one is opened. When the scanner
 * cannot answer, the open check still runs, in the worker with its empty environment, before the file is stored pending:
 * it is what refuses an encrypted PDF a scanner cannot see inside. Each double records its call in one list, in order.
 */
function recordingScreen(verdict: ScanVerdict, opened: PdfProbe) {
  const calls: string[] = [];
  const scanner: MalwareScanner = {
    name: "recording",
    async scan() {
      calls.push("scan");
      return verdict;
    },
  };
  const probe = async (): Promise<PdfProbe> => {
    calls.push("probe");
    return opened;
  };
  return { calls, dependencies: { scanner, probePdf: probe } };
}

const ORDER_PDF = buildPdf(["Vendor security pack, page one."]);

test("a PDF is scanned before it is opened, and a clean one is then opened (WR-203)", async () => {
  const { calls, dependencies } = recordingScreen({ kind: "clean", engine: "recording" }, "ok");
  const result = await screenAttachment({ fileName: "pack.pdf", bytes: ORDER_PDF }, dependencies);
  assert.deepEqual(calls, ["scan", "probe"], `THE_PDF_WAS_NOT_SCANNED_BEFORE_IT_WAS_PARSED: ${calls.join(",")}`);
  assert.deepEqual(result, { outcome: "clean", name: "pack.pdf", type: "pdf", byteSize: ORDER_PDF.length, sha256: sha256(ORDER_PDF), engine: "recording" });
});

test("an infected PDF is refused as malware without ever reaching the open check (WR-203)", async () => {
  const { calls, dependencies } = recordingScreen({ kind: "infected", engine: "recording", detection: "Win.Test.Fake" }, "invalid");
  const result = await screenAttachment({ fileName: "pack.pdf", bytes: ORDER_PDF }, dependencies);
  assert.deepEqual(calls, ["scan"], `AN_INFECTED_PDF_WAS_PARSED: ${calls.join(",")}`);
  assert.deepEqual(result, {
    outcome: "refused", reason: "ATTACHMENT_MALWARE_FOUND", detection: "Win.Test.Fake", engine: "recording",
    name: "pack.pdf", type: "pdf", byteSize: ORDER_PDF.length, sha256: sha256(ORDER_PDF),
  });
});

test("when the scanner cannot answer, the PDF is still opened in the worker before it is stored pending, and an encrypted one is refused (WR-203)", async () => {
  const notScanned: ScanVerdict = { kind: "not-scanned", engine: "recording", cause: "unavailable" };
  const opens = recordingScreen(notScanned, "ok");
  const pending = await screenAttachment({ fileName: "pack.pdf", bytes: ORDER_PDF }, opens.dependencies);
  assert.deepEqual(opens.calls, ["scan", "probe"], `UNEXPECTED_NOT_SCANNED_ORDER: ${opens.calls.join(",")}`);
  assert.deepEqual(pending, { outcome: "not-scanned", name: "pack.pdf", type: "pdf", byteSize: ORDER_PDF.length, sha256: sha256(ORDER_PDF), engine: "recording", cause: "unavailable" });

  const locked = recordingScreen(notScanned, "password");
  const refused = await screenAttachment({ fileName: "pack.pdf", bytes: ORDER_PDF }, locked.dependencies);
  assert.deepEqual(locked.calls, ["scan", "probe"], `UNEXPECTED_NOT_SCANNED_ENCRYPTED_ORDER: ${locked.calls.join(",")}`);
  assert.deepEqual(refused, { outcome: "refused", reason: "ATTACHMENT_ENCRYPTED", name: "pack.pdf", byteSize: ORDER_PDF.length }, "AN_ENCRYPTED_PDF_WAS_KEPT_WHILE_THE_SCANNER_WAS_DOWN");
});

test("the open check's refusals keep their reasons after the scan: an encrypted PDF and one pdf.js cannot open (WR-203)", async () => {
  for (const [label, verdict] of [
    ["CLEAN", { kind: "clean", engine: "recording" }],
    ["NOT_SCANNED", { kind: "not-scanned", engine: "recording", cause: "timeout" }],
  ] as const) {
    for (const [opened, reason] of [["password", "ATTACHMENT_ENCRYPTED"], ["invalid", "ATTACHMENT_CONTENT_MISMATCH"]] as const) {
      const { calls, dependencies } = recordingScreen(verdict, opened);
      const result = await screenAttachment({ fileName: "pack.pdf", bytes: ORDER_PDF }, dependencies);
      assert.deepEqual(calls, ["scan", "probe"], `UNEXPECTED_ORDER_${label}_${opened}: ${calls.join(",")}`);
      assert.deepEqual(result, { outcome: "refused", reason, name: "pack.pdf", byteSize: ORDER_PDF.length }, `UNEXPECTED_REFUSAL_${label}_${opened}`);
    }
  }
  // Through the real worker: a password-protected PDF and bytes pdf.js cannot open, with the development double clean.
  const scanner = createDevelopmentScanner();
  const encrypted = await screenAttachment({ fileName: "secret.pdf", bytes: buildPasswordPdf() }, { scanner, probePdf });
  assert.equal(encrypted.outcome === "refused" ? encrypted.reason : encrypted.outcome, "ATTACHMENT_ENCRYPTED", "THE_REAL_ENCRYPTED_PDF_WAS_NOT_REFUSED");
  const broken = Buffer.from("%PDF-1.7\nThis is not a PDF body.\n", "latin1");
  const malformed = await screenAttachment({ fileName: "broken.pdf", bytes: broken }, { scanner, probePdf });
  assert.equal(malformed.outcome === "refused" ? malformed.reason : malformed.outcome, "ATTACHMENT_CONTENT_MISMATCH", "THE_REAL_MALFORMED_PDF_WAS_NOT_REFUSED");
});

test("only a PDF reaches the open check: an Office file, an image and a text file are scanned and never opened (WR-203)", async () => {
  for (const [fileName, bytes] of [
    ["data-flow.docx", fixture("data-flow.docx")],
    ["diagram.png", fixture("diagram.png")],
    ["notes.txt", Buffer.from("Plain vendor notes.\n", "utf8")],
  ] as const) {
    const { calls, dependencies } = recordingScreen({ kind: "clean", engine: "recording" }, "ok");
    const result = await screenAttachment({ fileName, bytes }, dependencies);
    assert.equal(result.outcome, "clean", `UNEXPECTED_OUTCOME_${fileName}`);
    assert.deepEqual(calls, ["scan"], `UNEXPECTED_CALLS_${fileName}: ${calls.join(",")}`);
  }
});

/*
 * The content check (14-03; D-09): every allowed type is accepted only when its content agrees with its name, and
 * every refused variant gets its own closed reason.
 */

async function check(fileName: string, bytes: Uint8Array) {
  return checkAttachmentContent({ fileName, bytes }, { probePdf });
}

const FIXTURE_TYPES: ReadonlyArray<readonly [string, string]> = [
  ["vendor-security-pack.pdf", "pdf"],
  ["data-flow.docx", "docx"],
  ["vendor-questionnaire.xlsx", "xlsx"],
  ["architecture-deck.pptx", "pptx"],
  ["diagram.png", "png"],
  ["photo.jpg", "jpeg"],
];

for (const [fileName, type] of FIXTURE_TYPES) {
  test(`accepted: the committed ${fileName} as ${type}`, async () => {
    assert.deepEqual(await check(fileName, fixture(fileName)), { ok: true, type });
  });
}

test("accepted: an extension in capitals (DATA-FLOW.DOCX)", async () => {
  assert.deepEqual(await check("DATA-FLOW.DOCX", fixture("data-flow.docx")), { ok: true, type: "docx" });
});

test("accepted: a JPEG under .jpeg as well as .jpg", async () => {
  assert.deepEqual(await check("photo.jpeg", fixture("photo.jpg")), { ok: true, type: "jpeg" });
});

test("accepted: a UTF-8 CSV", async () => {
  assert.deepEqual(await check("controls.csv", Buffer.from("Control,Answer\nMFA for administrators,Yes\nCafé access,Non\n", "utf8")), { ok: true, type: "csv" });
});

test("accepted: UTF-8 text with a byte order mark", async () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Vendor notes\n", "utf8")]);
  assert.deepEqual(await check("notes.txt", bytes), { ok: true, type: "txt" });
});

test("accepted: UTF-16LE text with its byte order mark, NUL bytes and all", async () => {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Vendor notes\r\n", "utf16le")]);
  assert.deepEqual(await check("notes.txt", bytes), { ok: true, type: "txt" });
});

test("accepted: UTF-16BE text with its byte order mark", async () => {
  const big = Buffer.from("Vendor notes\n", "utf16le").swap16();
  assert.deepEqual(await check("notes.txt", Buffer.concat([Buffer.from([0xfe, 0xff]), big])), { ok: true, type: "txt" });
});

test("accepted: a PDF made by buildPdf", async () => {
  assert.deepEqual(await check("vendor.pdf", buildPdf(["Vendor security pack"])), { ok: true, type: "pdf" });
});

const MISMATCHES: ReadonlyArray<readonly [string, string, () => Uint8Array]> = [
  ["a PNG named invoice.pdf", "invoice.pdf", () => fixture("diagram.png")],
  ["a renamed executable named report.pdf", "report.pdf", buildRenamedExecutable],
  ["a renamed executable named notes.txt", "notes.txt", buildRenamedExecutable],
  ["a ZIP that is not an Office package named data.docx", "data.docx", buildNotOoxmlZip],
  ["the DOCX fixture named deck.pptx", "deck.pptx", () => fixture("data-flow.docx")],
  ["the XLSX fixture named data-flow.docx", "data-flow.docx", () => fixture("vendor-questionnaire.xlsx")],
  ["a text file with a NUL byte", "notes.txt", () => Buffer.from([0x56, 0x65, 0x6e, 0x00, 0x64, 0x6f, 0x72, 0x0a])],
  ["the PNG named data.csv", "data.csv", () => fixture("diagram.png")],
  ["bytes that are not UTF-8 named notes.txt", "notes.txt", () => Buffer.from([0x56, 0x65, 0xc3, 0x28, 0x0a, 0x80])],
  ["an ELF binary named tool.csv", "tool.csv", () => Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]), Buffer.from("text after the header")])],
  ["a PDF that does not open", "broken.pdf", () => Buffer.from("%PDF-1.7\nnot really a document\n", "latin1")],
];

/*
 * CR-201 and IN-204: the content check and every other reader must see one package. An archive comment (which can
 * hide a second end record) and part names that differ only in case are refused. A comment is a structure CSRM will
 * not read, ATTACHMENT_UNSUPPORTED_STRUCTURE (IN-202, below); duplicate part names are a malformed archive, a mismatch.
 */
function fakeEndRecordXlsx(): Buffer {
  return buildFakeEndRecordArchive(fixture("vendor-questionnaire.xlsx"), buildXlsx([{ name: "Hidden", rows: [["FAKE-DIRECTORY-TEXT"]] }]));
}

function caseDuplicateDocx(): Buffer {
  return buildDocx(["Quarterly plan"], { extraEntries: [{ name: "[CONTENT_TYPES].XML", data: docxContentTypes(DOCM_MAIN_TYPE), method: 0 }] });
}

const STRUCTURE_MISMATCHES: ReadonlyArray<readonly [string, string, () => Uint8Array]> = [
  ["a DOCX with a second content-types part whose name differs only in case (IN-204)", "plan.docx", caseDuplicateDocx],
];

for (const [description, fileName, build] of STRUCTURE_MISMATCHES) {
  test(`ATTACHMENT_CONTENT_MISMATCH: ${description}`, async () => {
    assert.deepEqual(await check(fileName, build()), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" });
  });
}

/*
 * IN-202 (the stage B amendment, 2026-10-11, contract item 5): a ZIP whose structure CSRM will not read is not a file
 * whose content "doesn't match its name". The ZIP reader's structure refusals, the comment (CR-201), the three bounds,
 * ZIP64 and a method other than stored or deflate, are 415 ATTACHMENT_UNSUPPORTED_STRUCTURE, whose copy says to save
 * a fresh copy. ZIP64 and an unusual method are packaging Office never writes for a file under 25 MB, and re-saving
 * writes a standard archive, so the structure sentence is the truthful one. A malformed archive stays a mismatch and
 * the encryption flag stays encrypted. Each archive is built in memory, and each case first proves which code the
 * reader raises for it, so the mapping under test is that code's.
 */
function docxPart(name: string, data: Uint8Array | string, extra: Partial<ZipEntrySpec> = {}): ZipEntrySpec {
  return { name, data, method: 0, ...extra };
}

function docxWith(extraEntries: readonly ZipEntrySpec[], options: ZipBuildOptions = {}): Buffer {
  return buildZip([
    docxPart("[Content_Types].xml", docxContentTypes(DOCX_MAIN_TYPE)),
    docxPart("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>"),
    ...extraEntries,
  ], options);
}

const STRUCTURE_REFUSALS: ReadonlyArray<readonly [code: string, description: string, build: () => Buffer, reason: string]> = [
  ["ZIP_COMMENT", "a DOCX carrying an archive comment (CR-201)", () => buildDocx(["Quarterly plan"], { archiveComment: "Saved by an archiver" }), "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_COMMENT", "an XLSX whose end record's comment hides a fake end record (CR-201)", fakeEndRecordXlsx, "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_RATIO", "a DOCX with a part declaring 201:1", () => docxWith([docxPart("word/media/fill.bin", new Uint8Array(1000), { declaredMethod: 8, declaredUncompressedSize: 201_000 })]), "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_TOO_MANY_ENTRIES", "a DOCX of 10,001 parts", () => docxWith(Array.from({ length: 9_999 }, (_, index) => docxPart(`word/media/part-${index}.bin`, new Uint8Array(0)))), "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_TOO_LARGE", "a DOCX declaring more than 1 GiB in total", () => {
    const filler = new Uint8Array(3 * 1024 * 1024);
    return docxWith([
      docxPart("word/media/a.bin", filler, { declaredMethod: 8, declaredUncompressedSize: 536_870_912 }),
      docxPart("word/media/b.bin", filler, { declaredMethod: 8, declaredUncompressedSize: 536_870_913 }),
    ]);
  }, "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP64_UNSUPPORTED", "a DOCX written as ZIP64", () => docxWith([], { zip64Locator: true }), "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_METHOD_UNSUPPORTED", "a DOCX with a part compressed by an unusual method", () => docxWith([docxPart("word/media/image.bin", "abc", { declaredMethod: 12 })]), "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
  ["ZIP_MALFORMED", "a DOCX whose directory overruns the archive", () => docxWith([], { declaredEntryCount: 3 }), "ATTACHMENT_CONTENT_MISMATCH"],
  ["ZIP_ENCRYPTED", "a DOCX whose part sets the encryption flag", () => docxWith([docxPart("word/media/secret.bin", "x", { flags: 0x0001 })]), "ATTACHMENT_ENCRYPTED"],
];

for (const [code, description, build, reason] of STRUCTURE_REFUSALS) {
  test(`${reason}: ${description} (${code}; IN-202)`, async () => {
    const bytes = build();
    assert.throws(() => readZipDirectory(bytes), (error: unknown) => error instanceof ZipArchiveError && error.code === code, `THE_READER_DOES_NOT_RAISE_${code}`);
    assert.deepEqual(await check("plan.docx", bytes), { ok: false, reason }, `${code}_IS_NOT_${reason}`);
  });
}

test("accepted: a DOCX whose only content-types part is named in another case, which OPC treats as the same part (IN-204)", async () => {
  assert.deepEqual(await check("plan.docx", buildDocx(["Quarterly plan"], { contentTypesName: "[CONTENT_TYPES].XML" })), { ok: true, type: "docx" });
});

for (const [description, fileName, build] of MISMATCHES) {
  test(`ATTACHMENT_CONTENT_MISMATCH: ${description}`, async () => {
    assert.deepEqual(await check(fileName, build()), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" });
  });
}

test("ATTACHMENT_MACRO_ENABLED: a name ending .docm, whatever its content", async () => {
  assert.deepEqual(await check("plan.docm", fixture("data-flow.docx")), { ok: false, reason: "ATTACHMENT_MACRO_ENABLED" });
});

for (const extension of [".xlsm", ".pptm", ".dotm", ".xltm", ".potm", ".DOCM"]) {
  test(`ATTACHMENT_MACRO_ENABLED: the ${extension} extension`, async () => {
    assert.deepEqual(await check(`plan${extension}`, Buffer.from("x")), { ok: false, reason: "ATTACHMENT_MACRO_ENABLED" });
  });
}

test("ATTACHMENT_MACRO_ENABLED: a .docx carrying a vbaProject.bin part", async () => {
  assert.deepEqual(await check("plan.docx", buildVbaProjectDocx()), { ok: false, reason: "ATTACHMENT_MACRO_ENABLED" });
});

test("ATTACHMENT_MACRO_ENABLED: a .docx whose main part is macro-enabled", async () => {
  assert.deepEqual(await check("plan.docx", buildMacroDocx()), { ok: false, reason: "ATTACHMENT_MACRO_ENABLED" });
});

test("ATTACHMENT_ENCRYPTED: a password-protected PDF", async () => {
  assert.deepEqual(await check("secret.pdf", buildPasswordPdf()), { ok: false, reason: "ATTACHMENT_ENCRYPTED" });
});

test("ATTACHMENT_ENCRYPTED: an encrypted OOXML file (a CFB container with EncryptedPackage)", async () => {
  assert.deepEqual(await check("secret.docx", buildEncryptedOoxml()), { ok: false, reason: "ATTACHMENT_ENCRYPTED" });
});

test("ATTACHMENT_ENCRYPTED: a ZIP whose entry sets the encryption flag", async () => {
  assert.deepEqual(await check("secret.xlsx", buildEncryptedFlagZip()), { ok: false, reason: "ATTACHMENT_ENCRYPTED" });
});

for (const name of ["old.doc", "old.xls", "old.ppt", "OLD.DOC"]) {
  test(`ATTACHMENT_LEGACY_OFFICE: ${name}, whatever its content`, async () => {
    assert.deepEqual(await check(name, Buffer.from("anything")), { ok: false, reason: "ATTACHMENT_LEGACY_OFFICE" });
  });
}

test("ATTACHMENT_LEGACY_OFFICE: a .docx that is an old binary document (a CFB without EncryptedPackage)", async () => {
  assert.deepEqual(await check("old.docx", buildLegacyDoc()), { ok: false, reason: "ATTACHMENT_LEGACY_OFFICE" });
});

for (const name of ["tool.exe", "archive.zip", "noextension", "page.html", "photo.gif", "trailing-dot."]) {
  test(`ATTACHMENT_TYPE_NOT_ALLOWED: ${name}`, async () => {
    assert.deepEqual(await check(name, Buffer.from("Plain text\n")), { ok: false, reason: "ATTACHMENT_TYPE_NOT_ALLOWED" });
  });
}

test("the signature sniffer names each format and the text rule", () => {
  assert.equal(sniffSignature(fixture("vendor-security-pack.pdf")), "pdf");
  assert.equal(sniffSignature(fixture("diagram.png")), "png");
  assert.equal(sniffSignature(fixture("photo.jpg")), "jpeg");
  assert.equal(sniffSignature(fixture("data-flow.docx")), "zip");
  assert.equal(sniffSignature(buildLegacyDoc()), "cfb");
  assert.equal(sniffSignature(Buffer.from("Vendor notes\n")), "text");
  assert.equal(sniffSignature(buildRenamedExecutable()), "binary");
  // IN-206 reverses the old assertion that this note was "binary": text that starts with MZ is text.
  assert.equal(sniffSignature(Buffer.from("MZ is how this note starts\n")), "text", "TEXT_STARTING_WITH_MZ_IS_NOT_TEXT");
  assert.equal(sniffSignature(buildPortableExecutableHeader()), "binary", "A_PE_HEADER_IS_NOT_BINARY");
});

/*
 * WR-205 (the pilot's ruling): Office active content beyond VBA. Every relationships part is read through the package
 * inspection's one bounded budget. An external relationship (TargetMode "External", compared as the XML gives it after
 * the tokenizer's entity handling, case-sensitively as OPC does) whose type ends /oleObject (the Follina vector,
 * CVE-2022-30190), /attachedTemplate (remote template injection), /frame or /subDocument, or an ActiveX control (its
 * content type in an Override or a Default, or a part under activeX/), is ATTACHMENT_ACTIVE_CONTENT. An XLM macro sheet
 * (macrosheet, intlmacrosheet) or a VBA data part (its content type or a vbaData.xml part) is a macro:
 * ATTACHMENT_MACRO_ENABLED. An ordinary external hyperlink stays accepted. Every package is built in memory; no
 * active-content file is committed.
 */
const EXTERNAL_TARGET = "https://example.invalid/payload.html!";
const ACTIVEX_TYPE = "application/vnd.ms-office.activeX+xml";
const ACTIVEX_BINARY_TYPE = "application/vnd.ms-office.activeX";
const ACTIVEX_PART = `<ax:ocx xmlns:ax="http://schemas.microsoft.com/office/2006/activeX" ax:classid="{8BD21D40-EC42-11CE-9E0D-00AA006002F3}" ax:persistence="persistStorage"/>`;
const SHEET = [{ name: "Controls", rows: [["Control", "Answer"], ["MFA", "Yes"]] }] as const;

function externalRelationship(kind: string, mode = "External") {
  return [["rId90", `${OFFICE_RELATIONSHIPS}/${kind}`, EXTERNAL_TARGET, mode]] as const;
}

const ACTIVE_CONTENT_REFUSALS: ReadonlyArray<readonly [description: string, fileName: string, build: () => Buffer, reason: string]> = [
  ["an external oleObject in word/_rels/document.xml.rels (the Follina vector)", "plan.docx",
    () => buildDocx(["Quarterly plan"], { documentRelationships: externalRelationship("oleObject") }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["a remote attachedTemplate in word/_rels/settings.xml.rels (remote template injection)", "plan.docx",
    () => buildDocx(["Quarterly plan"], { settingsRelationships: [["rId1", `${OFFICE_RELATIONSHIPS}/attachedTemplate`, "https://example.invalid/template.dotm", "External"]] }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an external frame", "plan.docx",
    () => buildDocx(["Quarterly plan"], { documentRelationships: externalRelationship("frame") }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an external subDocument", "plan.docx",
    () => buildDocx(["Quarterly plan"], { documentRelationships: externalRelationship("subDocument") }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an external oleObject whose TargetMode is written with a character reference", "plan.docx",
    () => buildDocx(["Quarterly plan"], { documentRelationships: externalRelationship("oleObject", "Ext&#101;rnal") }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an external oleObject in a header's relationships part named in capitals", "plan.docx",
    () => buildDocx(["Quarterly plan"], { extraEntries: [{ name: "word/_rels/header1.xml.RELS", data: relationshipsXml(externalRelationship("oleObject")) }] }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an external oleObject in a PPTX slide's relationships part", "deck.pptx",
    buildPptxWithSlideRelationships, "ATTACHMENT_ACTIVE_CONTENT"],
  ["an ActiveX control declared by an Override in a DOCX", "plan.docx",
    () => buildDocx(["Quarterly plan"], { overrides: [["/word/controls/control1.xml", ACTIVEX_TYPE]], extraEntries: [{ name: "word/controls/control1.xml", data: ACTIVEX_PART }] }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an ActiveX binary declared by a Default in a DOCX", "plan.docx",
    () => buildDocx(["Quarterly plan"], { defaults: [["ocx", ACTIVEX_BINARY_TYPE]], extraEntries: [{ name: "word/embeddings/control1.ocx", data: new Uint8Array(32), method: 0 }] }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an ActiveX part under xl/activeX/ in an XLSX", "controls.xlsx",
    () => buildXlsx(SHEET, { extraEntries: [{ name: "xl/activeX/activeX1.xml", data: ACTIVEX_PART }] }), "ATTACHMENT_ACTIVE_CONTENT"],
  ["an XLM macro sheet in an XLSX", "controls.xlsx",
    () => buildXlsx(SHEET, { overrides: [["/xl/macrosheets/sheet1.xml", "application/vnd.ms-excel.macrosheet+xml"]], extraEntries: [{ name: "xl/macrosheets/sheet1.xml", data: `<xm:macrosheet xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"/>` }] }), "ATTACHMENT_MACRO_ENABLED"],
  ["an international XLM macro sheet in an XLSX", "controls.xlsx",
    () => buildXlsx(SHEET, { overrides: [["/xl/macrosheets/intlsheet1.xml", "application/vnd.ms-excel.intlmacrosheet+xml"]], extraEntries: [{ name: "xl/macrosheets/intlsheet1.xml", data: `<xm:macrosheet xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"/>` }] }), "ATTACHMENT_MACRO_ENABLED"],
  ["a VBA data part declared by its content type", "plan.docx",
    () => buildDocx(["Quarterly plan"], { overrides: [["/word/customData.xml", "application/vnd.ms-word.vbaData+xml"]], extraEntries: [{ name: "word/customData.xml", data: `<wne:vbaSuppData xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"/>` }] }), "ATTACHMENT_MACRO_ENABLED"],
  ["a vbaData.xml part", "plan.docx",
    () => buildDocx(["Quarterly plan"], { extraEntries: [{ name: "word/vbaData.xml", data: `<wne:vbaSuppData xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"/>` }] }), "ATTACHMENT_MACRO_ENABLED"],
];

/** The parts of an archive, read back through CSRM's reader, so a test can rebuild it. */
function readZipParts(archive: Buffer): ZipEntrySpec[] {
  const directory = readZipDirectory(archive);
  return directory.entries.map((entry) => ({ name: entry.name, data: readZipEntry(archive, entry, { maxOutputLength: entry.uncompressedSize }) }));
}

/** A one-slide PPTX whose slide's relationships part carries an external oleObject. */
function buildPptxWithSlideRelationships(): Buffer {
  const parts = readZipParts(buildPptx([["Architecture"]]));
  return buildZip([...parts, { name: "ppt/slides/_rels/slide1.xml.rels", data: relationshipsXml(externalRelationship("oleObject")) }]);
}

for (const [description, fileName, build, reason] of ACTIVE_CONTENT_REFUSALS) {
  test(`${reason}: ${description} (WR-205)`, async () => {
    assert.deepEqual(await check(fileName, build()), { ok: false, reason }, `${reason}_NOT_RAISED: ${description}`);
  });
}

test("accepted: a DOCX with an external hyperlink, which is a plain link and not active content (WR-205)", async () => {
  const docx = buildDocx(["See the vendor's trust page."], { documentRelationships: [["rId91", `${OFFICE_RELATIONSHIPS}/hyperlink`, "https://example.invalid/trust", "External"]] });
  assert.deepEqual(await check("plan.docx", docx), { ok: true, type: "docx" });
});

/** A relationships part padded with whitespace to `size` bytes, stored, so it really inflates to that size. */
function paddedRelationships(size: number): Uint8Array {
  const head = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  const tail = `</Relationships>`;
  return Buffer.concat([Buffer.from(head), Buffer.alloc(size - head.length - tail.length, 0x20), Buffer.from(tail)]);
}

test("a relationships part beyond the inspection's one budget is refused as the budget refuses: a mismatch (WR-205)", async () => {
  // One part declaring 9 MiB: refused before anything is inflated (it is deflated data that is not 9 MiB of anything).
  let seed = 7;
  const noise = Uint8Array.from({ length: 65_536 }, () => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
    return seed & 0xff;
  });
  const oversized = buildDocx(["Quarterly plan"], { extraEntries: [{ name: "word/_rels/big.xml.rels", data: noise, method: 0, declaredMethod: 8, declaredUncompressedSize: 9 * 1_048_576 }] });
  assert.deepEqual(await check("plan.docx", oversized), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" }, "A_RELATIONSHIPS_PART_OVER_THE_BUDGET_WAS_NOT_READ");
  // Two real 5 MiB relationships parts: each fits alone, but they share one budget.
  const shared = buildDocx(["Quarterly plan"], { extraEntries: [
    { name: "word/_rels/a.xml.rels", data: paddedRelationships(5 * 1_048_576), method: 0 },
    { name: "word/_rels/b.xml.rels", data: paddedRelationships(5 * 1_048_576), method: 0 },
  ] });
  assert.deepEqual(await check("plan.docx", shared), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" }, "THE_RELATIONSHIPS_PARTS_DO_NOT_SHARE_ONE_BUDGET");
  // One real 1.5 MiB relationships part (a workbook with many hyperlinks) fits the budget.
  const roomy = buildDocx(["Quarterly plan"], { extraEntries: [{ name: "word/_rels/links.xml.rels", data: paddedRelationships(1_572_864), method: 0 }] });
  assert.deepEqual(await check("plan.docx", roomy), { ok: true, type: "docx" }, "A_LARGE_BUT_ORDINARY_RELATIONSHIPS_PART_WAS_REFUSED");
});

/*
 * IN-203: "checked by content" must mean the package is the Office document it claims. The main content type's
 * Override must name a part the archive holds (found without regard to ASCII case, as OPC does), and `_rels/.rels` must
 * carry an officeDocument relationship to that part. A ZIP of arbitrary files with a one-line [Content_Types].xml is a
 * mismatch.
 */
const MAIN_OVERRIDE_ONLY = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="${DOCX_MAIN_TYPE}"/></Types>`;
const DOCUMENT_XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Plan</w:t></w:r></w:p></w:body></w:document>`;

function officeDocumentRels(target: string, mode?: string): string {
  return relationshipsXml([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, target, mode]]);
}

const MAIN_PART_MISMATCHES: ReadonlyArray<readonly [description: string, build: () => Buffer]> = [
  ["a ZIP of arbitrary files with a one-line [Content_Types].xml naming a main part it does not hold", () => buildZip([
    { name: "[Content_Types].xml", data: MAIN_OVERRIDE_ONLY, method: 0 },
    { name: "payload/tool.bin", data: new Uint8Array(64), method: 0 },
    { name: "notes.txt", data: "Anything at all." },
  ])],
  ["a package whose main part exists but which has no _rels/.rels", () => buildZip([
    { name: "[Content_Types].xml", data: MAIN_OVERRIDE_ONLY, method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
  ])],
  ["a package whose _rels/.rels has no officeDocument relationship", () => buildZip([
    { name: "[Content_Types].xml", data: MAIN_OVERRIDE_ONLY, method: 0 },
    { name: "_rels/.rels", data: relationshipsXml([["rId1", `${OFFICE_RELATIONSHIPS}/extended-properties`, "docProps/app.xml"]]), method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
  ])],
  ["a package whose officeDocument relationship names another part", () => buildZip([
    { name: "[Content_Types].xml", data: MAIN_OVERRIDE_ONLY, method: 0 },
    { name: "_rels/.rels", data: officeDocumentRels("word/other.xml"), method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
    { name: "word/other.xml", data: DOCUMENT_XML },
  ])],
  ["a package whose officeDocument relationship is external", () => buildZip([
    { name: "[Content_Types].xml", data: MAIN_OVERRIDE_ONLY, method: 0 },
    { name: "_rels/.rels", data: officeDocumentRels("word/document.xml", "External"), method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
  ])],
  ["a package whose main type is declared only by a Default, naming no part", () => buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml([], [["main", DOCX_MAIN_TYPE]]), method: 0 },
    { name: "_rels/.rels", data: officeDocumentRels("word/document.xml"), method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
  ])],
];

for (const [description, build] of MAIN_PART_MISMATCHES) {
  test(`ATTACHMENT_CONTENT_MISMATCH: ${description}, named report.docx (IN-203)`, async () => {
    assert.deepEqual(await check("report.docx", build()), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" }, `A_PACKAGE_WITHOUT_ITS_MAIN_PART_WAS_ACCEPTED: ${description}`);
  });
}

test("accepted: a main part named in another case and reached by an absolute officeDocument target, as OPC resolves them (IN-203)", async () => {
  const docx = buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml([["/WORD/Document.xml", DOCX_MAIN_TYPE]]), method: 0 },
    { name: "_rels/.rels", data: officeDocumentRels("/word/document.XML"), method: 0 },
    { name: "word/document.xml", data: DOCUMENT_XML },
  ]);
  assert.deepEqual(await check("report.docx", docx), { ok: true, type: "docx" });
});

/*
 * IN-206: text that starts with "MZ" is text ("MZ Holdings report", "MZ,Mozambique"). A Windows executable is still
 * refused: its `e_lfanew` at 0x3C points at `PE\0\0` (and its NUL bytes fail the text rule as well).
 */
test("accepted: a TXT and a CSV that start with MZ (IN-206)", async () => {
  assert.deepEqual(await check("report.txt", Buffer.from("MZ Holdings report\nQuarterly vendor review.\n", "utf8")), { ok: true, type: "txt" }, "MZ_HOLDINGS_REFUSED");
  assert.deepEqual(await check("countries.csv", Buffer.from("MZ,Mozambique\nAU,Australia\n", "utf8")), { ok: true, type: "csv" }, "MZ_MOZAMBIQUE_REFUSED");
});

test("ATTACHMENT_CONTENT_MISMATCH: a PE header (MZ, e_lfanew to PE\\0\\0) named notes.txt or data.csv (IN-206)", async () => {
  for (const fileName of ["notes.txt", "data.csv"]) {
    assert.deepEqual(await check(fileName, buildPortableExecutableHeader()), { ok: false, reason: "ATTACHMENT_CONTENT_MISMATCH" }, `A_PE_HEADER_WAS_ACCEPTED_AS_${fileName}`);
  }
});
