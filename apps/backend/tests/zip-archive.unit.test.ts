import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";

import {
  findZipEntry,
  readZipDirectory,
  readZipEntry,
  writeStoredZip,
  ZIP_EXTRACTION_MAX_INFLATED,
  ZIP_UPLOAD_BOUNDS,
  ZipArchiveError,
  type ZipArchiveErrorCode,
} from "../src/csrm/files/zip-archive";
import {
  buildDocx,
  buildEncryptedFlagZip,
  buildFakeEndRecordArchive,
  buildXlsx,
  buildZip,
  buildZip64Archive,
  buildZipBomb,
  VENDOR_QUESTIONNAIRE_SHEETS,
  type ZipEntrySpec,
} from "./helpers/attachment-fixtures";

/*
 * The ZIP reader (14-02; D-32, ASVS V5.2.3): it reads the central directory and refuses a hostile archive before it
 * inflates anything, then bounds every inflate by maxOutputLength. DOCX, XLSX and PPTX all pass through it, and
 * Phase 19's import guard reuses it.
 */

function refusal(code: ZipArchiveErrorCode) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof ZipArchiveError, `EXPECTED_ZIP_ARCHIVE_ERROR_${code}_GOT_${String(error)}`);
    assert.equal(error.code, code);
    return true;
  };
}

function emptyEntries(count: number): ZipEntrySpec[] {
  return Array.from({ length: count }, (_, index) => ({ name: `e/${index}`, data: "", method: 0 as const }));
}

test("the upload bounds are D-32's: 10,000 entries, 1 GiB declared, 200:1, and 128 MiB inflated for extraction", () => {
  assert.deepEqual({ ...ZIP_UPLOAD_BOUNDS }, { maxEntries: 10_000, maxDeclaredTotal: 1_073_741_824, maxRatio: 200 });
  assert.equal(ZIP_EXTRACTION_MAX_INFLATED, 134_217_728);
  assert.ok(Object.isFrozen(ZIP_UPLOAD_BOUNDS), "THE_UPLOAD_BOUNDS_CAN_BE_CHANGED_AT_RUN_TIME");
});

test("a DOCX's central directory lists its stored and deflated parts with their sizes, and each reads back exactly", () => {
  const bytes = buildDocx(["First paragraph.", "Second paragraph."]);
  const directory = readZipDirectory(bytes);
  assert.deepEqual(directory.entries.map((entry) => entry.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);

  const contentTypes = findZipEntry(directory, "[Content_Types].xml");
  const document = findZipEntry(directory, "word/document.xml");
  assert.ok(contentTypes && document, "THE_DOCX_PARTS_ARE_NOT_LISTED");
  assert.equal(contentTypes.method, 0);
  assert.equal(contentTypes.compressedSize, contentTypes.uncompressedSize);
  assert.equal(document.method, 8);
  assert.ok(document.compressedSize < document.uncompressedSize, "THE_DOCUMENT_PART_WAS_NOT_DEFLATED");
  assert.equal(directory.declaredTotal, directory.entries.reduce((total, entry) => total + entry.uncompressedSize, 0));

  const contentTypesText = readZipEntry(bytes, contentTypes, { maxOutputLength: 1_048_576 }).toString("utf8");
  const documentText = readZipEntry(bytes, document, { maxOutputLength: 1_048_576 }).toString("utf8");
  assert.equal(Buffer.byteLength(contentTypesText), contentTypes.uncompressedSize);
  assert.equal(Buffer.byteLength(documentText), document.uncompressedSize);
  assert.match(contentTypesText, /^<\?xml[^>]*\?>\n<Types /);
  assert.match(documentText, /<w:t xml:space="preserve">Second paragraph\.<\/w:t>/);
});

test("findZipEntry matches a part name without regard to ASCII case, as OPC does, and nothing else (IN-204)", () => {
  const directory = readZipDirectory(buildDocx(["Text."]));
  const document = findZipEntry(directory, "word/document.xml");
  assert.ok(document);
  assert.equal(findZipEntry(directory, "Word/Document.XML"), document, "A_PART_NAME_IN_ANOTHER_CASE_WAS_NOT_FOUND");
  assert.equal(findZipEntry(directory, "[content_types].XML")?.name, "[Content_Types].xml");
  assert.equal(findZipEntry(directory, "/word/document.xml"), undefined);
  assert.equal(findZipEntry(directory, "word/document"), undefined);
  assert.equal(findZipEntry(directory, "word\\document.xml"), undefined);
});

test("ZIP_TOO_MANY_ENTRIES: 10,001 entries are refused before any entry is read, and 10,000 are accepted", () => {
  assert.equal(readZipDirectory(buildZip(emptyEntries(10_000))).entries.length, 10_000);
  assert.throws(() => readZipDirectory(buildZip(emptyEntries(10_001))), refusal("ZIP_TOO_MANY_ENTRIES"));
});

test("ZIP_TOO_LARGE: a declared total of 1 GiB plus one byte is refused, and exactly 1 GiB is accepted", () => {
  const filler = new Uint8Array(3 * 1024 * 1024);
  const archive = (last: number) => buildZip([
    { name: "a.bin", data: filler, method: 0, declaredMethod: 8, declaredUncompressedSize: 536_870_912 },
    { name: "b.bin", data: filler, method: 0, declaredMethod: 8, declaredUncompressedSize: last },
  ]);
  assert.equal(readZipDirectory(archive(536_870_912)).declaredTotal, 1_073_741_824);
  assert.throws(() => readZipDirectory(archive(536_870_913)), refusal("ZIP_TOO_LARGE"));
});

test("ZIP_RATIO: an entry declaring 201:1 is refused before inflating, and 200:1 is accepted", () => {
  const archive = (declared: number) => buildZip([{ name: "ratio.bin", data: new Uint8Array(1000), method: 0, declaredMethod: 8, declaredUncompressedSize: declared }]);
  assert.equal(readZipDirectory(archive(200_000)).entries[0].uncompressedSize, 200_000);
  assert.throws(() => readZipDirectory(archive(201_000)), refusal("ZIP_RATIO"));
});

test("ZIP64_UNSUPPORTED: a ZIP64 archive, a size sentinel or an entry-count sentinel is refused", () => {
  assert.throws(() => readZipDirectory(buildZip64Archive()), refusal("ZIP64_UNSUPPORTED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0, declaredUncompressedSize: 0xffffffff }])), refusal("ZIP64_UNSUPPORTED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0, declaredLocalHeaderOffset: 0xffffffff }])), refusal("ZIP64_UNSUPPORTED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0 }], { declaredEntryCount: 0xffff })), refusal("ZIP64_UNSUPPORTED"));
});

test("ZIP_ENCRYPTED: an entry with general-purpose flag bit 0 is refused", () => {
  assert.throws(() => readZipDirectory(buildEncryptedFlagZip()), refusal("ZIP_ENCRYPTED"));
});

test("ZIP_METHOD_UNSUPPORTED: any method other than stored (0) or deflate (8) is refused", () => {
  for (const method of [12, 14, 1, 9, 99]) {
    assert.throws(() => readZipDirectory(buildZip([{ name: "a.bin", data: "abc", method: 0, declaredMethod: method }])), refusal("ZIP_METHOD_UNSUPPORTED"), `METHOD_${method}_WAS_ACCEPTED`);
  }
});

test("ZIP_MALFORMED: a truncated, empty or inconsistent archive is refused", () => {
  const docx = buildDocx(["Text."]);
  assert.throws(() => readZipDirectory(docx.subarray(0, docx.length - 10)), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(docx.subarray(0, 100)), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(Buffer.alloc(0)), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(Buffer.from("not an archive at all")), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0 }], { declaredEntryCount: 2 })), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0, declaredLocalHeaderOffset: 5000 }])), refusal("ZIP_MALFORMED"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "abc", method: 0, declaredCompressedSize: 4000, declaredUncompressedSize: 4000 }])), refusal("ZIP_MALFORMED"));
});

test("ZIP_MALFORMED: two entries with one name, or two entries sharing one data span, are refused", () => {
  assert.throws(() => readZipDirectory(buildZip([{ name: "word/document.xml", data: "a" }, { name: "word/document.xml", data: "b" }])), refusal("ZIP_MALFORMED"));
  assert.throws(
    () => readZipDirectory(buildZip([{ name: "[Content_Types].xml", data: "<Types/>", method: 0 }, { name: "[CONTENT_TYPES].XML", data: "<Types/>", method: 0 }])),
    refusal("ZIP_MALFORMED"),
    "PART_NAMES_THAT_DIFFER_ONLY_IN_CASE_WERE_ACCEPTED (IN-204)",
  );
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "abc", method: 0 }, { name: "b.txt", data: "abc", method: 0, declaredLocalHeaderOffset: 0 }])), refusal("ZIP_MALFORMED"));
});

test("ZIP_COMMENT: an archive comment is refused, so the end record read is the one at length - 22, where fflate and ClamAV start (CR-201)", () => {
  assert.throws(() => readZipDirectory(buildDocx(["Text."], { archiveComment: "Saved by an archiver" })), refusal("ZIP_COMMENT"));
  assert.throws(() => readZipDirectory(buildZip([{ name: "a.txt", data: "a", method: 0 }], { comment: "x" })), refusal("ZIP_COMMENT"));
  const plain = buildDocx(["Text."]);
  assert.equal(plain.readUInt32LE(plain.length - 22), 0x06054b50);
  assert.equal(readZipDirectory(plain).entries.length, 3);
});

test("ZIP_COMMENT: a real end record whose comment hides a fake end record (one fflate would read) is refused (CR-201)", () => {
  const real = buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS);
  const fake = buildXlsx([{ name: "Hidden", rows: [["FAKE-DIRECTORY-TEXT"]] }]);
  const archive = buildFakeEndRecordArchive(real, fake);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50, "THE_FAKE_RECORD_IS_NOT_WHERE_FFLATE_LOOKS");
  assert.equal(archive.readUInt16LE(real.length - 2), fake.length, "THE_REAL_RECORD'S_COMMENT_DOES_NOT_END_THE_BUFFER");
  assert.throws(() => readZipDirectory(archive), refusal("ZIP_COMMENT"));
});

test("ZIP_INFLATE_LIMIT: a bomb that lies about its size passes the directory and stops at the inflate bound", () => {
  const bytes = buildZipBomb();
  const directory = readZipDirectory(bytes);
  const [entry] = directory.entries;
  assert.ok(entry.uncompressedSize <= entry.compressedSize * ZIP_UPLOAD_BOUNDS.maxRatio, "THE_BOMB_SHOULD_PASS_THE_DIRECTORY_BOUNDS");
  assert.throws(() => readZipEntry(bytes, entry, { maxOutputLength: 1_048_576 }), refusal("ZIP_INFLATE_LIMIT"));
  assert.throws(() => readZipEntry(bytes, entry, { maxOutputLength: ZIP_EXTRACTION_MAX_INFLATED }), refusal("ZIP_INFLATE_LIMIT"));
});

test("ZIP_INFLATE_LIMIT: a stored or deflated entry larger than maxOutputLength is refused", () => {
  // Varied text, so the deflated entry stays well inside the 200:1 ratio bound.
  const text = Array.from({ length: 4096 }, (_, index) => String.fromCharCode(33 + ((index * 7919) % 94))).join("");
  for (const method of [0, 8] as const) {
    const bytes = buildZip([{ name: "big.txt", data: text, method }]);
    const [entry] = readZipDirectory(bytes).entries;
    assert.equal(readZipEntry(bytes, entry, { maxOutputLength: 4096 }).toString("utf8"), text);
    assert.throws(() => readZipEntry(bytes, entry, { maxOutputLength: 4095 }), refusal("ZIP_INFLATE_LIMIT"), `METHOD_${method}_EXCEEDED_ITS_BOUND`);
  }
});

test("readZipEntry refuses an entry whose bytes do not match the CRC-32 the directory declares", () => {
  const bytes = Buffer.from(buildZip([{ name: "a.txt", data: "abcdef", method: 0 }]));
  const [entry] = readZipDirectory(bytes).entries;
  bytes[30 + "a.txt".length] ^= 0xff;
  assert.throws(() => readZipEntry(bytes, entry, { maxOutputLength: 1024 }), refusal("ZIP_MALFORMED"));
});

/*
 * writeStoredZip (WR-201): the canonical archive the XLSX reader hands to read-excel-file, rebuilt from parts the ZIP
 * reader has already read and verified.
 */

test("writeStoredZip rebuilds parts as a canonical stored archive that reads back to the same parts", () => {
  const source = buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS);
  const sourceDirectory = readZipDirectory(source);
  const parts = [
    ...sourceDirectory.entries.map((entry) => ({ name: entry.name, data: readZipEntry(source, entry, { maxOutputLength: entry.uncompressedSize }) })),
    { name: "xl/données.xml", data: Buffer.from("<données/>", "utf8") },
    { name: "empty.xml", data: new Uint8Array(0) },
  ];
  const archive = writeStoredZip(parts);
  assert.ok(archive.equals(writeStoredZip(parts)), "THE_REBUILT_ARCHIVE_IS_NOT_DETERMINISTIC");
  assert.equal(archive.byteOffset, 0);
  assert.equal(archive.buffer.byteLength, archive.byteLength, "THE_REBUILT_ARCHIVE_SHARES_ITS_ARRAYBUFFER");

  const directory = readZipDirectory(archive);
  assert.deepEqual(directory.entries.map((entry) => entry.name), parts.map((part) => part.name));
  directory.entries.forEach((entry, index) => {
    assert.equal(entry.method, 0, `${entry.name}_IS_NOT_STORED`);
    assert.equal(entry.flags, 0x0800, `${entry.name}_HAS_FLAGS_OTHER_THAN_A_UTF8_NAME`);
    assert.equal(entry.compressedSize, parts[index].data.byteLength);
    assert.equal(entry.uncompressedSize, parts[index].data.byteLength);
    assert.ok(readZipEntry(archive, entry, { maxOutputLength: entry.uncompressedSize }).equals(Buffer.from(parts[index].data)), `${entry.name}_DID_NOT_READ_BACK`);
    // The local header: the same flags, method and sizes as the directory, and no extra field.
    const local = entry.localHeaderOffset;
    assert.deepEqual(
      [archive.readUInt16LE(local + 6), archive.readUInt16LE(local + 8), archive.readUInt32LE(local + 14), archive.readUInt32LE(local + 18), archive.readUInt32LE(local + 22), archive.readUInt16LE(local + 28)],
      [0x0800, 0, entry.crc32, entry.uncompressedSize, entry.uncompressedSize, 0],
      `${entry.name}_LOCAL_HEADER_DIFFERS`,
    );
  });

  // Every central entry has no extra field and no comment; the end record is at length - 22 with no comment.
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50);
  assert.equal(archive.readUInt16LE(end + 20), 0);
  let offset = archive.readUInt32LE(end + 16);
  for (let index = 0; index < parts.length; index += 1) {
    assert.deepEqual([archive.readUInt16LE(offset + 30), archive.readUInt16LE(offset + 32)], [0, 0], `CENTRAL_ENTRY_${index}_HAS_AN_EXTRA_FIELD_OR_COMMENT`);
    offset += 46 + archive.readUInt16LE(offset + 28);
  }
  assert.equal(offset, end);
});

test("writeStoredZip writes an empty archive as its end record alone, and refuses an empty name or names that differ only in case", () => {
  const empty = writeStoredZip([]);
  assert.equal(empty.length, 22);
  assert.deepEqual(readZipDirectory(empty).entries, []);
  assert.throws(() => writeStoredZip([{ name: "a.xml", data: Buffer.from("a") }, { name: "A.XML", data: Buffer.from("b") }]), RangeError);
  assert.throws(() => writeStoredZip([{ name: "", data: Buffer.from("a") }]), RangeError);
});

/*
 * IN-208: the reader checks every entry's CRC-32 with zlib.crc32, which Node added in 22.2.0 (and 20.15.0). On 22.0 or
 * 22.1 it is undefined, so every Office upload would be refused and every Office extraction unavailable. The backend's
 * engine range must not admit a Node without it.
 */
test("the backend's engine floor is at least Node 22.2.0, where zlib.crc32 exists (IN-208)", () => {
  const manifest = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as { engines?: { node?: unknown } };
  const range = String(manifest.engines?.node ?? "");
  const floor = /^>=\s*(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(range);
  assert.ok(floor, `THE_ENGINE_RANGE_HAS_NO_FLOOR: ${range}`);
  const [major, minor] = [Number(floor[1]), Number(floor[2])];
  assert.ok(major > 22 || (major === 22 && minor >= 2), `THE_ENGINE_FLOOR_ADMITS_A_NODE_WITHOUT_ZLIB_CRC32: ${range}`);
  assert.equal(typeof zlib.crc32, "function", "THIS_NODE_HAS_NO_ZLIB_CRC32");
});
