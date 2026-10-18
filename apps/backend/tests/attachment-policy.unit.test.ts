import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_LIMITS,
  ATTACHMENT_MEDIA_TYPES,
  ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE,
  ATTACHMENT_TYPES,
  claimedTypeFor,
  LEGACY_OFFICE_EXTENSIONS,
  MACRO_ENABLED_EXTENSIONS,
  sanitiseAttachmentName,
  storageExtensionFor,
  TEXT_BEARING_ATTACHMENT_TYPES,
} from "../src/csrm/files/attachment-policy";
import { probePdf } from "../src/csrm/files/extraction";
import { createDevelopmentScanner } from "../src/csrm/files/scanner";
import { screenAttachment } from "../src/csrm/files/screen-attachment";

/*
 * The attachment policy (14-03; D-09, D-10, D-22): the types, the limits, the name rule and the retention constant,
 * held in one module because decision 2 fixes them.
 */

test("the allow-list is eight types, each with its media type", () => {
  assert.deepEqual([...ATTACHMENT_TYPES], ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "png", "jpeg"]);
  assert.deepEqual({ ...ATTACHMENT_MEDIA_TYPES }, {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    png: "image/png",
    jpeg: "image/jpeg",
  });
  assert.deepEqual([...ATTACHMENT_EXTENSIONS], [".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".txt", ".png", ".jpg", ".jpeg"]);
  assert.deepEqual([...MACRO_ENABLED_EXTENSIONS], [".docm", ".xlsm", ".pptm", ".dotm", ".xltm", ".potm"]);
  assert.deepEqual([...LEGACY_OFFICE_EXTENSIONS], [".doc", ".xls", ".ppt"]);
  assert.deepEqual([...TEXT_BEARING_ATTACHMENT_TYPES], ["pdf", "docx", "xlsx", "pptx", "csv", "txt"]);
});

test("the limits and the retention constant are decision 2's", () => {
  assert.deepEqual({ ...ATTACHMENT_LIMITS }, {
    maxBytes: 26_214_400,
    maxActivePerRequest: 20,
    maxStoredPerRequest: 60,
    noteWindowMinutes: 60,
    textCapCharacters: 20_000,
    eventLogMaxEvents: 200,
  });
  assert.equal(ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE, 7);
});

test("a JPEG is stored as .jpg; every other type under its own extension", () => {
  assert.equal(storageExtensionFor("jpeg"), ".jpg");
  assert.equal(storageExtensionFor("docx"), ".docx");
  assert.equal(storageExtensionFor("txt"), ".txt");
});

test("the claimed type comes from the extension, case-insensitively, with its own refusal for each refused family", () => {
  assert.deepEqual(claimedTypeFor("Vendor Pack.PDF"), { type: "pdf" });
  assert.deepEqual(claimedTypeFor("photo.JPEG"), { type: "jpeg" });
  assert.deepEqual(claimedTypeFor("plan.xlsm"), { refusal: "ATTACHMENT_MACRO_ENABLED" });
  assert.deepEqual(claimedTypeFor("old.PPT"), { refusal: "ATTACHMENT_LEGACY_OFFICE" });
  assert.deepEqual(claimedTypeFor("tool.exe"), { refusal: "ATTACHMENT_TYPE_NOT_ALLOWED" });
  assert.deepEqual(claimedTypeFor("noextension"), { refusal: "ATTACHMENT_TYPE_NOT_ALLOWED" });
});

test("a name loses its Windows or POSIX path", () => {
  assert.equal(sanitiseAttachmentName("C:\\Users\\jane\\vendor pack.pdf"), "vendor pack.pdf");
  assert.equal(sanitiseAttachmentName("/home/jane/reports/data-flow.docx"), "data-flow.docx");
  assert.equal(sanitiseAttachmentName("../../etc/passwd.txt"), "passwd.txt");
});

test("a name loses the right-to-left override, so the RLO trick keeps its real .exe extension", () => {
  const name = sanitiseAttachmentName("inv\u202Efdp.exe");
  assert.equal(name, "invfdp.exe");
  assert.deepEqual(claimedTypeFor(name ?? ""), { refusal: "ATTACHMENT_TYPE_NOT_ALLOWED" });
});

test("a name loses C0 and C1 controls and every bidirectional mark and isolate", () => {
  const raw = "\u0007ven\u0000dor\u001b\u0085\u200E\u200F\u061C\u202A\u202B\u202C\u202D\u2066\u2067\u2068\u2069 pack\u007f.pdf\r\n";
  assert.equal(sanitiseAttachmentName(raw), "vendor pack.pdf");
});

/*
 * IN-205: the name rule removes every control and format character, the line and paragraph separators and the tag
 * characters ([\p{Cc}\p{Cf}\p{Zl}\p{Zp}]), written with escapes so the source holds no invisible character. A Windows
 * reserved device stem gets a leading "_", and dots or spaces left at the end of the stem, before the extension, are
 * trimmed, so a name saved on Windows is the name shown.
 */
const INVISIBLE_CHARACTERS: ReadonlyArray<readonly [label: string, character: string]> = [
  ["U+00AD soft hyphen", "\u00AD"],
  ["U+180E Mongolian vowel separator", "\u180E"],
  ["U+200B zero width space", "\u200B"],
  ["U+200C zero width non-joiner", "\u200C"],
  ["U+200D zero width joiner", "\u200D"],
  ["U+200E left-to-right mark", "\u200E"],
  ["U+200F right-to-left mark", "\u200F"],
  ["U+2028 line separator", "\u2028"],
  ["U+2029 paragraph separator", "\u2029"],
  ["U+202A left-to-right embedding", "\u202A"],
  ["U+202E right-to-left override", "\u202E"],
  ["U+2060 word joiner", "\u2060"],
  ["U+2061 function application", "\u2061"],
  ["U+2064 invisible plus", "\u2064"],
  ["U+2066 left-to-right isolate", "\u2066"],
  ["U+2069 pop directional isolate", "\u2069"],
  ["U+206F nominal digit shapes", "\u206F"],
  ["U+FEFF zero width no-break space inside a name", "\uFEFF"],
  ["U+FFF9 interlinear annotation anchor", "\uFFF9"],
  ["U+FFFA interlinear annotation separator", "\uFFFA"],
  ["U+FFFB interlinear annotation terminator", "\uFFFB"],
  ["U+E0001 language tag", "\u{E0001}"],
  ["U+E0041 tag Latin capital A", "\u{E0041}"],
  ["U+E007F cancel tag", "\u{E007F}"],
];

for (const [label, character] of INVISIBLE_CHARACTERS) {
  test(`a name loses ${label} (IN-205)`, () => {
    assert.equal(sanitiseAttachmentName(`ven${character}dor pa${character}ck.pdf`), "vendor pack.pdf", `KEPT_${label}`);
  });
}

test("a name keeps visible characters beside the removed ones: letters, digits, marks, emoji and spaces (IN-205)", () => {
  assert.equal(sanitiseAttachmentName("Café – Ω 数据 😀 rapport (v2).pdf"), "Café – Ω 数据 😀 rapport (v2).pdf");
  assert.equal(sanitiseAttachmentName("Cafe\u0301 notes.txt"), "Cafe\u0301 notes.txt", "A_COMBINING_MARK_WAS_REMOVED");
});

test("the name rule's source holds no invisible character: the removed class is written with escapes (IN-205)", () => {
  const source = readFileSync(path.resolve(process.cwd(), "src", "csrm", "files", "attachment-policy.ts"), "utf8");
  const invisible = [...source].filter((character) => /[\p{Cf}\p{Zl}\p{Zp}]/u.test(character) || (/\p{Cc}/u.test(character) && !"\n\r\t".includes(character)));
  assert.deepEqual(invisible.map((character) => `U+${character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`), [], "INVISIBLE_CHARACTERS_IN_THE_SOURCE");
});

const RESERVED_STEMS = [
  "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
  ...Array.from({ length: 10 }, (_, digit) => `COM${digit}`), "COM\u00B9", "COM\u00B2", "COM\u00B3",
  ...Array.from({ length: 10 }, (_, digit) => `LPT${digit}`), "LPT\u00B9", "LPT\u00B2", "LPT\u00B3",
];

for (const stem of RESERVED_STEMS) {
  test(`a Windows reserved device stem ${stem} gets a leading underscore, in any case, with or without an extension (IN-205)`, () => {
    for (const variant of [stem, stem.toLowerCase(), `${stem[0]}${stem.slice(1).toLowerCase()}`]) {
      assert.equal(sanitiseAttachmentName(variant), `_${variant}`, `RESERVED_STEM_KEPT_${variant}`);
      assert.equal(sanitiseAttachmentName(`${variant}.txt`), `_${variant}.txt`, `RESERVED_STEM_KEPT_${variant}.txt`);
      assert.equal(sanitiseAttachmentName(`${variant}.tar.pdf`), `_${variant}.tar.pdf`, `RESERVED_STEM_KEPT_${variant}.tar.pdf`);
    }
  });
}

test("a reserved stem followed by spaces is still reserved, and names that only start like one are kept (IN-205)", () => {
  assert.equal(sanitiseAttachmentName("CON .txt"), "_CON.txt");
  for (const name of ["CONTRACT.pdf", "console.txt", "com10.txt", "lpt.csv", "nul-report.pdf", "aux_notes.txt", "PRN2.docx", "my CON.txt"]) {
    assert.equal(sanitiseAttachmentName(name), name, `NOT_A_RESERVED_STEM_${name}`);
  }
});

test("dots and spaces at the end of the stem, before the extension, are trimmed (IN-205)", () => {
  assert.equal(sanitiseAttachmentName("report .pdf"), "report.pdf");
  assert.equal(sanitiseAttachmentName("report. . .pdf"), "report.pdf");
  assert.equal(sanitiseAttachmentName("report...pdf"), "report.pdf");
  assert.equal(sanitiseAttachmentName("v1.2 final.docx"), "v1.2 final.docx", "AN_INNER_DOT_WAS_TRIMMED");
  assert.equal(sanitiseAttachmentName("..pdf"), "..pdf", "A_STEM_OF_ONLY_DOTS_WAS_EMPTIED");
  assert.equal(sanitiseAttachmentName(".pdf"), ".pdf", "A_DOTFILE_CHANGED");
});

test("a name is trimmed", () => {
  assert.equal(sanitiseAttachmentName("   vendor pack.pdf  "), "vendor pack.pdf");
});

test("a long name is shortened to 255 characters and keeps its extension", () => {
  const name = sanitiseAttachmentName(`${"q".repeat(300)}.xlsx`);
  assert.equal(name?.length, 255);
  assert.ok(name?.endsWith(".xlsx"));
  assert.ok(name?.startsWith("qqq"));
});

test("a long name is never cut through a surrogate pair", () => {
  const name = sanitiseAttachmentName(`${"q".repeat(249)}${"😀".repeat(10)}.pdf`) ?? "";
  assert.ok(name.length <= 255);
  assert.ok(name.endsWith(".pdf"));
  assert.equal(Buffer.from(name, "utf8").toString("utf8"), name, "no lone surrogate");
});

test("a name of only controls, marks, spaces or a path is null", () => {
  assert.equal(sanitiseAttachmentName("\u0001\u0002\u202E\u2066"), null);
  assert.equal(sanitiseAttachmentName("   "), null);
  assert.equal(sanitiseAttachmentName("reports/"), null);
  assert.equal(sanitiseAttachmentName(""), null);
});

const scanner = createDevelopmentScanner();

test("a file of exactly 26,214,400 bytes is accepted", async () => {
  const bytes = Buffer.alloc(ATTACHMENT_LIMITS.maxBytes, 0x61);
  const result = await screenAttachment({ fileName: "large.txt", bytes }, { scanner, probePdf });
  assert.equal(result.outcome, "clean");
  assert.equal(result.byteSize, 26_214_400);
});

test("a file of 26,214,401 bytes is refused as too large, before its content is read", async () => {
  const bytes = Buffer.alloc(ATTACHMENT_LIMITS.maxBytes + 1, 0x61);
  const result = await screenAttachment({ fileName: "large.txt", bytes }, { scanner, probePdf });
  assert.deepEqual(result, { outcome: "refused", reason: "ATTACHMENT_TOO_LARGE", name: "large.txt", byteSize: 26_214_401 });
});

test("an empty file is refused as empty", async () => {
  const result = await screenAttachment({ fileName: "empty.txt", bytes: new Uint8Array(0) }, { scanner, probePdf });
  assert.deepEqual(result, { outcome: "refused", reason: "ATTACHMENT_EMPTY", name: "empty.txt", byteSize: 0 });
});

test("a name that sanitises to nothing is refused as not an allowed type", async () => {
  const result = await screenAttachment({ fileName: "\u202E\u0000", bytes: Buffer.from("text") }, { scanner, probePdf });
  assert.deepEqual(result, { outcome: "refused", reason: "ATTACHMENT_TYPE_NOT_ALLOWED", byteSize: 4 });
});

test("the RLO trick is screened by its real extension and refused as not an allowed type", async () => {
  const result = await screenAttachment({ fileName: "inv\u202Efdp.exe", bytes: Buffer.from("text") }, { scanner, probePdf });
  assert.deepEqual(result, { outcome: "refused", reason: "ATTACHMENT_TYPE_NOT_ALLOWED", name: "invfdp.exe", byteSize: 4 });
});
