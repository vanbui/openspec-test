import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/*
 * Deterministic attachment fixture builders (14-02; D-39). Every builder returns the same bytes for the same input:
 * archive timestamps are fixed at 1980-01-01 00:00 and nothing reads the clock or a random source. The hostile
 * variants (bombs, ZIP64, the encryption flag) exist only in memory; no fixture carries a malware test string.
 */

const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3), as ZIP stores it. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One archive entry. `method` is how the builder encodes `data`; the `declared*` fields overwrite what the local and
 * central headers claim, so a test can build an archive that lies about its contents.
 */
export interface ZipEntrySpec {
  name: string;
  data: Uint8Array | string;
  method?: 0 | 8;
  flags?: number;
  declaredMethod?: number;
  declaredCompressedSize?: number;
  declaredUncompressedSize?: number;
  declaredLocalHeaderOffset?: number;
  centralExtra?: Uint8Array;
}

export interface ZipBuildOptions {
  /** Writes a ZIP64 end-of-central-directory record and locator before the classic record. */
  zip64Locator?: boolean;
  /** Overwrites the entry count the end-of-central-directory record declares. */
  declaredEntryCount?: number;
  /** An archive comment after the end-of-central-directory record (Office never writes one). */
  comment?: Uint8Array | string;
}

function toBytes(data: Uint8Array | string): Buffer {
  return typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
}

/** A classic (non-ZIP64) archive writer with stored and deflated entries. */
export function buildZip(entries: readonly ZipEntrySpec[], options: ZipBuildOptions = {}): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const raw = toBytes(entry.data);
    const method = entry.method ?? 8;
    const body = method === 8 ? zlib.deflateRawSync(raw, { level: 9 }) : raw;
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(raw);
    const flags = entry.flags ?? 0;
    const declaredMethod = entry.declaredMethod ?? method;
    const compressedSize = entry.declaredCompressedSize ?? body.length;
    const uncompressedSize = entry.declaredUncompressedSize ?? raw.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(declaredMethod, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const extra = Buffer.from(entry.centralExtra ?? new Uint8Array(0));
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(declaredMethod, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(entry.declaredLocalHeaderOffset ?? offset, 42);

    locals.push(local, name, body);
    centrals.push(central, name, extra);
    offset += local.length + name.length + body.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const centralOffset = offset;
  const count = options.declaredEntryCount ?? entries.length;
  const parts: Buffer[] = [...locals, centralDirectory];

  if (options.zip64Locator) {
    const recordOffset = centralOffset + centralDirectory.length;
    const record = Buffer.alloc(56);
    record.writeUInt32LE(0x06064b50, 0);
    record.writeBigUInt64LE(BigInt(44), 4);
    record.writeUInt16LE(45, 12);
    record.writeUInt16LE(45, 14);
    record.writeUInt32LE(0, 16);
    record.writeUInt32LE(0, 20);
    record.writeBigUInt64LE(BigInt(count), 24);
    record.writeBigUInt64LE(BigInt(count), 32);
    record.writeBigUInt64LE(BigInt(centralDirectory.length), 40);
    record.writeBigUInt64LE(BigInt(centralOffset), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeUInt32LE(0, 4);
    locator.writeBigUInt64LE(BigInt(recordOffset), 8);
    locator.writeUInt32LE(1, 16);
    parts.push(record, locator);
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  const comment = options.comment === undefined ? Buffer.alloc(0) : toBytes(options.comment);
  end.writeUInt16LE(comment.length, 20);
  parts.push(end, comment);
  return Buffer.concat(parts);
}

/**
 * CR-201's parser differential: `real`, whose end record's comment is the whole of `fake`, rebased to sit after it.
 * The fake archive's own end record ends the buffer but declares a one-byte comment that is not there, so a reader
 * that wants the record whose comment ends the buffer skips it and reads `real`'s directory, while a reader that takes
 * the first signature scanning back from `length - 22` (fflate) reads `fake`'s. Both inputs must come from buildZip
 * without a comment.
 */
export function buildFakeEndRecordArchive(real: Buffer, fake: Buffer): Buffer {
  const base = real.length;
  const shifted = Buffer.from(fake);
  const fakeEnd = shifted.length - 22;
  const count = shifted.readUInt16LE(fakeEnd + 10);
  const centralOffset = shifted.readUInt32LE(fakeEnd + 16);
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    shifted.writeUInt32LE(shifted.readUInt32LE(offset + 42) + base, offset + 42);
    offset += 46 + shifted.readUInt16LE(offset + 28) + shifted.readUInt16LE(offset + 30) + shifted.readUInt16LE(offset + 32);
  }
  shifted.writeUInt32LE(centralOffset + base, fakeEnd + 16);
  shifted.writeUInt16LE(1, fakeEnd + 20);
  if (shifted.length > 0xffff) throw new RangeError("the fake archive does not fit in a comment");
  const head = Buffer.from(real);
  head.writeUInt16LE(shifted.length, head.length - 2);
  return Buffer.concat([head, shifted]);
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const XML_DECLARATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
const PACKAGE_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";
export const OFFICE_RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export const DOCX_MAIN_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
export const PPTX_MAIN_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";

/** A `[Content_Types].xml` body: the two usual Defaults, then `defaults`, then one Override per part. */
export function contentTypesXml(overrides: ReadonlyArray<readonly [string, string]>, defaults: ReadonlyArray<readonly [string, string]> = []): string {
  return `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + defaults.map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`).join("")
    + overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join("")
    + `</Types>`;
}

const contentTypes = contentTypesXml;

/**
 * One relationship: its Id, Type and Target, and, when given, its TargetMode written verbatim (so a test can write it
 * with a character reference).
 */
export type RelationshipSpec = readonly [id: string, type: string, target: string, targetMode?: string];

/** A relationships part's body. */
export function relationshipsXml(items: readonly RelationshipSpec[]): string {
  return `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}">`
    + items.map(([id, type, target, mode]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"${mode === undefined ? "" : ` TargetMode="${mode}"`}/>`).join("")
    + `</Relationships>`;
}

const relationships = relationshipsXml;

/** WordprocessingML runs for one paragraph's text: a tab becomes `w:tab`, a line feed `w:br`. */
function wordRuns(text: string): string {
  return text.split("\n").map((line) => line.split("\t")
    .map((part) => part === "" ? "" : `<w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`)
    .join("<w:r><w:tab/></w:r>")).join("<w:r><w:br/></w:r>");
}

export interface DocxOptions {
  /** A table appended after the paragraphs, one inner array per row. */
  table?: readonly (readonly string[])[];
  /** A tracked insertion (`w:ins`), current text. */
  insertedText?: string;
  /** A tracked deletion (`w:del` / `w:delText`), never current text. */
  deletedText?: string;
  /** A comment anchored on the first paragraph, stored in `word/comments.xml`. */
  comment?: string;
  /** A text box written once as `mc:Choice` and again as `mc:Fallback`. */
  textBox?: string;
  /** A field: its instruction (`w:instrText`) and its displayed result. */
  field?: { instruction: string; result: string };
  /** Puts a DOCTYPE with an internal entity at the head of `word/document.xml`. */
  doctype?: boolean;
  /** Adds a `word/vbaProject.bin` part. */
  macro?: boolean;
  /** Overrides the main part's content type (for example a macro-enabled one). */
  mainType?: string;
  /** Overrides the content-types part's name (OPC part names are case-insensitive). */
  contentTypesName?: string;
  /** Entries appended after the package's own parts. */
  extraEntries?: readonly ZipEntrySpec[];
  /** An archive comment (Office never writes one). */
  archiveComment?: string;
  /** Relationships appended to `word/_rels/document.xml.rels` (WR-205). */
  documentRelationships?: readonly RelationshipSpec[];
  /** Adds `word/settings.xml` with these relationships in `word/_rels/settings.xml.rels` (WR-205: a remote template). */
  settingsRelationships?: readonly RelationshipSpec[];
  /** Content-type Overrides and Defaults appended to the package's own. */
  overrides?: ReadonlyArray<readonly [string, string]>;
  defaults?: ReadonlyArray<readonly [string, string]>;
}

/** A `[Content_Types].xml` body that names `mainType` for `/word/document.xml`. */
export function docxContentTypes(mainType: string): string {
  return contentTypes([["/word/document.xml", mainType]]);
}

/** A minimal WordprocessingML package: `[Content_Types].xml` and `_rels/.rels` stored, the parts deflated. */
export function buildDocx(paragraphs: readonly string[], options: DocxOptions = {}): Buffer {
  const body: string[] = [];
  paragraphs.forEach((text, index) => {
    if (index === 0) {
      const tabStops = `<w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>`;
      body.push(options.comment === undefined
        ? `<w:p>${tabStops}${wordRuns(text)}</w:p>`
        : `<w:p>${tabStops}<w:commentRangeStart w:id="0"/>${wordRuns(text)}<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>`);
    } else {
      body.push(`<w:p>${wordRuns(text)}</w:p>`);
    }
  });
  if (options.table) {
    const columns = Math.max(0, ...options.table.map((row) => row.length));
    body.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${"<w:gridCol w:w=\"2000\"/>".repeat(columns)}</w:tblGrid>`
      + options.table.map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr><w:p>${wordRuns(cell)}</w:p></w:tc>`).join("")}</w:tr>`).join("")
      + `</w:tbl>`);
  }
  if (options.insertedText !== undefined || options.deletedText !== undefined) {
    const revision = `w:author="CSRM" w:date="2026-01-01T00:00:00Z"`;
    body.push(`<w:p><w:r><w:t xml:space="preserve">Revised: </w:t></w:r>`
      + (options.insertedText === undefined ? "" : `<w:ins w:id="1" ${revision}><w:r><w:t xml:space="preserve">${escapeXml(options.insertedText)}</w:t></w:r></w:ins>`)
      + (options.deletedText === undefined ? "" : `<w:del w:id="2" ${revision}><w:r><w:delText xml:space="preserve">${escapeXml(options.deletedText)}</w:delText></w:r></w:del>`)
      + `</w:p>`);
  }
  if (options.textBox !== undefined) {
    const content = `<w:txbxContent><w:p><w:r><w:t>${escapeXml(options.textBox)}</w:t></w:r></w:p></w:txbxContent>`;
    body.push(`<w:p><w:r><w:t xml:space="preserve">See the box: </w:t></w:r><w:r><mc:AlternateContent>`
      + `<mc:Choice Requires="wps"><w:drawing><wps:wsp><wps:txbx>${content}</wps:txbx></wps:wsp></w:drawing></mc:Choice>`
      + `<mc:Fallback><w:pict><v:shape><v:textbox>${content}</v:textbox></v:shape></w:pict></mc:Fallback>`
      + `</mc:AlternateContent></w:r></w:p>`);
  }
  if (options.field) {
    body.push(`<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${escapeXml(options.field.instruction)}</w:instrText></w:r>`
      + `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${escapeXml(options.field.result)}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`);
  }
  const doctype = options.doctype ? `<!DOCTYPE w:document [<!ENTITY vendor "Example vendor">]>\n` : "";
  const document = `${XML_DECLARATION}${doctype}<w:document`
    + ` xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`
    + ` xmlns:r="${OFFICE_RELATIONSHIPS}"`
    + ` xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"`
    + ` xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"`
    + ` xmlns:v="urn:schemas-microsoft-com:vml" mc:Ignorable="wps">`
    + `<w:body>${body.join("")}<w:sectPr/></w:body></w:document>`;

  const overrides: Array<readonly [string, string]> = [["/word/document.xml", options.mainType ?? DOCX_MAIN_TYPE]];
  const defaults: Array<readonly [string, string]> = [];
  const documentRelationships: RelationshipSpec[] = [];
  const entries: ZipEntrySpec[] = [];
  if (options.comment !== undefined) {
    overrides.push(["/word/comments.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"]);
    documentRelationships.push(["rId1", `${OFFICE_RELATIONSHIPS}/comments`, "comments.xml"]);
    entries.push({
      name: "word/comments.xml",
      data: `${XML_DECLARATION}<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
        + `<w:comment w:id="0" w:author="CSRM" w:date="2026-01-01T00:00:00Z"><w:p><w:r><w:t>${escapeXml(options.comment)}</w:t></w:r></w:p></w:comment></w:comments>`,
    });
  }
  if (options.macro) {
    defaults.push(["bin", "application/vnd.ms-office.vbaProject"]);
    documentRelationships.push(["rId2", "http://schemas.microsoft.com/office/2006/relationships/vbaProject", "vbaProject.bin"]);
    entries.push({ name: "word/vbaProject.bin", data: new Uint8Array(64), method: 0 });
  }
  if (options.settingsRelationships !== undefined) {
    overrides.push(["/word/settings.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"]);
    documentRelationships.push(["rId3", `${OFFICE_RELATIONSHIPS}/settings`, "settings.xml"]);
    entries.push({ name: "word/settings.xml", data: `${XML_DECLARATION}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><w:attachedTemplate r:id="rId1"/></w:settings>` });
    entries.push({ name: "word/_rels/settings.xml.rels", data: relationships(options.settingsRelationships) });
  }
  documentRelationships.push(...(options.documentRelationships ?? []));
  overrides.push(...(options.overrides ?? []));
  defaults.push(...(options.defaults ?? []));
  return buildZip([
    { name: options.contentTypesName ?? "[Content_Types].xml", data: contentTypes(overrides, defaults), method: 0 },
    { name: "_rels/.rels", data: relationships([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, "word/document.xml"]]), method: 0 },
    { name: "word/document.xml", data: document },
    ...(documentRelationships.length > 0 ? [{ name: "word/_rels/document.xml.rels", data: relationships(documentRelationships) }] : []),
    ...entries,
    ...(options.extraEntries ?? []),
  ], options.archiveComment === undefined ? {} : { comment: options.archiveComment });
}

export interface PptxOptions {
  /** Presentation order as zero-based indexes into `slides`; defaults to the slides' own order. */
  order?: readonly number[];
  /** Speaker notes, one per slide index, written to `ppt/notesSlides/`. */
  notes?: readonly (string | undefined)[];
}

const DRAWING_NAMESPACES = ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`
  + ` xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`;

function shapeTree(paragraphs: readonly string[]): string {
  const text = paragraphs.map((paragraph) => `<a:p>${paragraph.split("\n")
    .map((line) => `<a:r><a:rPr lang="en-AU"/><a:t>${escapeXml(line)}</a:t></a:r>`).join("<a:br/>")}</a:p>`).join("");
  return `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>`
    + `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/>`
    + `<p:txBody><a:bodyPr/><a:lstStyle/>${text}</p:txBody></p:sp></p:spTree></p:cSld>`;
}

/** A minimal PresentationML package: slides listed in `p:sldIdLst` order through the presentation's relationships. */
export function buildPptx(slides: readonly (readonly string[])[], options: PptxOptions = {}): Buffer {
  const order = options.order ?? slides.map((_, index) => index);
  const overrides: Array<readonly [string, string]> = [["/ppt/presentation.xml", PPTX_MAIN_TYPE]];
  const presentationRelationships: Array<readonly [string, string, string]> = [];
  const entries: ZipEntrySpec[] = [];
  slides.forEach((paragraphs, index) => {
    const number = index + 1;
    overrides.push([`/ppt/slides/slide${number}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"]);
    presentationRelationships.push([`rId${number}`, `${OFFICE_RELATIONSHIPS}/slide`, `slides/slide${number}.xml`]);
    entries.push({ name: `ppt/slides/slide${number}.xml`, data: `${XML_DECLARATION}<p:sld${DRAWING_NAMESPACES}>${shapeTree(paragraphs)}</p:sld>` });
    const note = options.notes?.[index];
    if (note !== undefined) {
      overrides.push([`/ppt/notesSlides/notesSlide${number}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"]);
      entries.push({ name: `ppt/slides/_rels/slide${number}.xml.rels`, data: relationships([["rId1", `${OFFICE_RELATIONSHIPS}/notesSlide`, `../notesSlides/notesSlide${number}.xml`]]) });
      entries.push({ name: `ppt/notesSlides/notesSlide${number}.xml`, data: `${XML_DECLARATION}<p:notes${DRAWING_NAMESPACES}>${shapeTree([note])}</p:notes>` });
    }
  });
  const presentation = `${XML_DECLARATION}<p:presentation${DRAWING_NAMESPACES}><p:sldIdLst>`
    + order.map((index, position) => `<p:sldId id="${256 + position}" r:id="rId${index + 1}"/>`).join("")
    + `</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  return buildZip([
    { name: "[Content_Types].xml", data: contentTypes(overrides), method: 0 },
    { name: "_rels/.rels", data: relationships([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, "ppt/presentation.xml"]]), method: 0 },
    { name: "ppt/presentation.xml", data: presentation },
    { name: "ppt/_rels/presentation.xml.rels", data: relationships(presentationRelationships) },
    ...entries,
  ]);
}

/**
 * A ZIP bomb that lies: 16 MiB of zeros deflated to about 16 KiB, with a declared size of only twice the compressed
 * size, so the central directory passes the ratio bound and only the inflate bound (maxOutputLength) stops it.
 */
export function buildZipBomb(): Buffer {
  const zeros = new Uint8Array(16 * 1024 * 1024);
  const compressed = zlib.deflateRawSync(zeros, { level: 9 });
  return buildZip([{ name: "payload.xml", data: zeros, method: 8, declaredUncompressedSize: compressed.length * 2 }]);
}

/** A ZIP64 archive: a ZIP64 locator, and an entry whose sizes carry the 0xFFFFFFFF sentinel with a ZIP64 extra field. */
export function buildZip64Archive(): Buffer {
  const extra = Buffer.alloc(20);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(16, 2);
  extra.writeBigUInt64LE(BigInt(5), 4);
  extra.writeBigUInt64LE(BigInt(5), 12);
  return buildZip([{ name: "data.txt", data: "hello", method: 0, declaredCompressedSize: 0xffffffff, declaredUncompressedSize: 0xffffffff, centralExtra: extra }], { zip64Locator: true });
}

/** An archive whose one entry sets general-purpose flag bit 0 (encrypted); its data is not actually encrypted. */
export function buildEncryptedFlagZip(): Buffer {
  return buildZip([{ name: "secret.txt", data: "not really encrypted", method: 0, flags: 0x0001 }]);
}

/*
 * Hostile and refused variants for the content check (14-03; D-09). They exist only in memory.
 */

/** The macro-enabled WordprocessingML main part's content type (ECMA-376 / MS-OFFMACRO). */
export const DOCM_MAIN_TYPE = "application/vnd.ms-word.document.macroEnabled.main+xml";

/** A DOCX package whose main part declares the macro-enabled content type (a renamed .docm). */
export function buildMacroDocx(): Buffer {
  return buildDocx(["Quarterly plan"], { mainType: DOCM_MAIN_TYPE });
}

/** A DOCX package with the ordinary main type that carries a `word/vbaProject.bin` part. */
export function buildVbaProjectDocx(): Buffer {
  return buildDocx(["Quarterly plan"], { macro: true });
}

const CFB_FREE = 0xffffffff;
const CFB_END_OF_CHAIN = 0xfffffffe;
const CFB_FAT_SECTOR = 0xfffffffd;
const CFB_NO_STREAM = 0xffffffff;
const CFB_SECTOR = 512;
const CFB_STREAM_SECTORS = 8;

function cfbDirectoryEntry(name: string, type: 1 | 2 | 5, rightSibling: number, child: number, start: number, size: number): Buffer {
  const entry = Buffer.alloc(128);
  const encoded = Buffer.from(`${name}\u0000`, "utf16le");
  encoded.copy(entry, 0);
  entry.writeUInt16LE(encoded.length, 64);
  entry.writeUInt8(type, 66);
  entry.writeUInt8(1, 67);
  entry.writeUInt32LE(CFB_NO_STREAM, 68);
  entry.writeUInt32LE(rightSibling, 72);
  entry.writeUInt32LE(child, 76);
  entry.writeUInt32LE(start, 116);
  entry.writeUInt32LE(size, 120);
  return entry;
}

/**
 * A version 3 Compound File Binary (the OLE container of the old Office formats and of encrypted OOXML): a FAT
 * sector, one directory sector (at most three streams) and each stream in its own 4,096-byte run of regular sectors.
 */
function buildCfb(streamNames: readonly string[]): Buffer {
  if (streamNames.length > 3) throw new RangeError("one directory sector holds the root and at most three streams");
  const header = Buffer.alloc(CFB_SECTOR);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x003e, 24);
  header.writeUInt16LE(0x0003, 26);
  header.writeUInt16LE(0xfffe, 28);
  header.writeUInt16LE(9, 30);
  header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44);
  header.writeUInt32LE(1, 48);
  header.writeUInt32LE(4096, 56);
  header.writeUInt32LE(CFB_END_OF_CHAIN, 60);
  header.writeUInt32LE(CFB_END_OF_CHAIN, 68);
  header.writeUInt32LE(0, 76);
  for (let index = 1; index < 109; index += 1) header.writeUInt32LE(CFB_FREE, 76 + index * 4);

  const fat = Buffer.alloc(CFB_SECTOR, 0xff);
  fat.writeUInt32LE(CFB_FAT_SECTOR, 0);
  fat.writeUInt32LE(CFB_END_OF_CHAIN, 4);
  const directory = Buffer.alloc(CFB_SECTOR);
  cfbDirectoryEntry("Root Entry", 5, CFB_NO_STREAM, streamNames.length > 0 ? 1 : CFB_NO_STREAM, CFB_END_OF_CHAIN, 0).copy(directory, 0);
  const data: Buffer[] = [];
  streamNames.forEach((name, index) => {
    const start = 2 + index * CFB_STREAM_SECTORS;
    for (let sector = 0; sector < CFB_STREAM_SECTORS; sector += 1) {
      fat.writeUInt32LE(sector === CFB_STREAM_SECTORS - 1 ? CFB_END_OF_CHAIN : start + sector + 1, (start + sector) * 4);
    }
    const right = index + 1 < streamNames.length ? index + 2 : CFB_NO_STREAM;
    cfbDirectoryEntry(name, 2, right, CFB_NO_STREAM, start, CFB_STREAM_SECTORS * CFB_SECTOR).copy(directory, (index + 1) * 128);
    data.push(Buffer.alloc(CFB_STREAM_SECTORS * CFB_SECTOR, 0x20 + index));
  });
  for (let index = streamNames.length + 1; index < 4; index += 1) {
    const unused = Buffer.alloc(128);
    unused.writeUInt32LE(CFB_NO_STREAM, 68);
    unused.writeUInt32LE(CFB_NO_STREAM, 72);
    unused.writeUInt32LE(CFB_NO_STREAM, 76);
    unused.copy(directory, index * 128);
  }
  return Buffer.concat([header, fat, directory, ...data]);
}

/** An encrypted OOXML file: a CFB container holding `EncryptionInfo` and `EncryptedPackage` streams. */
export function buildEncryptedOoxml(): Buffer {
  return buildCfb(["EncryptionInfo", "EncryptedPackage"]);
}

/** An old binary Word document: a CFB container holding a `WordDocument` stream. */
export function buildLegacyDoc(): Buffer {
  return buildCfb(["WordDocument", "1Table"]);
}

/** A Windows executable's start: the `MZ` header, a DOS stub and NUL padding. It runs nothing. */
export function buildRenamedExecutable(): Buffer {
  const bytes = Buffer.alloc(256);
  bytes.write("MZ", 0, "latin1");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("This program cannot be run in DOS mode.", 0x4e, "latin1");
  return bytes;
}

/**
 * A Windows executable's headers (IN-206): `MZ`, an `e_lfanew` at 0x3C pointing to `PE\0\0` and an x86-64 machine
 * type, then NUL padding. It has no code and runs nothing.
 */
export function buildPortableExecutableHeader(): Buffer {
  const bytes = Buffer.alloc(256);
  bytes.write("MZ", 0, "latin1");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("This program cannot be run in DOS mode.", 0x4e, "latin1");
  bytes.write("PE\u0000\u0000", 0x80, "latin1");
  bytes.writeUInt16LE(0x8664, 0x84);
  return bytes;
}

/** An ordinary ZIP archive that is not an Office package: no `[Content_Types].xml`. */
export function buildNotOoxmlZip(): Buffer {
  return buildZip([
    { name: "readme.txt", data: "Supporting files for the vendor review." },
    { name: "data/controls.csv", data: "Control,Answer\nMFA,Yes\n" },
  ]);
}

/** A PDF literal string. The builders write printable ASCII only, which WinAnsiEncoding maps to itself. */
function pdfString(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (character.length !== 1 || code < 0x20 || code > 0x7e) throw new RangeError("the PDF builders write printable ASCII only");
    out += character === "\\" || character === "(" || character === ")" ? `\\${character}` : character;
  }
  return `(${out})`;
}

function pdfStream(content: string): string {
  return `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
}

/**
 * Serialises numbered objects (object n is `objects[n - 1]`) with a cross-reference table whose offsets are exact, so
 * pdf.js opens the file without reconstructing it.
 */
function writePdf(objects: readonly string[], trailerExtra = ""): Buffer {
  let body = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${trailerExtra} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

/** One page's content stream: one `Tj` per line, `T*` between lines (6 pt Helvetica on a 7 pt leading). */
function pageText(text: string): string {
  const lines = text.split("\n");
  return `BT\n/F1 6 Tf\n7 TL\n36 770 Td\n${lines.map((line) => (line === "" ? "" : `${pdfString(line)} Tj\n`)).join("T*\n")}ET`;
}

function pdfPages(contents: readonly string[], trailerExtra = "", extraObjects: readonly string[] = []): Buffer {
  const pageIds = contents.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${contents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  contents.forEach((content, index) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`);
    objects.push(pdfStream(content));
  });
  return writePdf([...objects, ...extraObjects], trailerExtra);
}

/** A text PDF: one page per string, each `\n` a new line. Printable ASCII only. */
export function buildPdf(pages: readonly string[]): Buffer {
  return pdfPages(pages.map(pageText));
}

/**
 * A PDF with a Standard security handler (`/V 1 /R 2`) whose fixed 32-byte `/O` and `/U` match no password, so pdf.js
 * cannot open it with the empty password and raises its PasswordException.
 */
export function buildPasswordPdf(): Buffer {
  const encrypt = `<< /Filter /Standard /V 1 /R 2 /O <${"4f".repeat(32)}> /U <${"55".repeat(32)}> /P -44 >>`;
  const id = "0123456789abcdef".repeat(2);
  return pdfPages([pageText("Confidential.")], ` /Encrypt 6 0 R /ID [<${id}> <${id}>]`, [encrypt]);
}

/** A "scanned" PDF: one page that paints a rectangle and has no text operators. */
export function buildScannedPdf(): Buffer {
  return pdfPages(["0.5 g\n36 36 200 100 re\nf"]);
}

export type XlsxCellSpec = string | number | boolean | Date | null | { readonly formula: string; readonly cached: number };

export interface XlsxSheetSpec {
  readonly name: string;
  readonly rows: readonly (readonly XlsxCellSpec[])[];
}

export const XLSX_MAIN_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

export interface XlsxOptions {
  readonly doctype?: boolean | string;
  readonly firstSheetEncoding?: "utf-16le" | "utf-16be";
  /** Content-type Overrides and Defaults appended to the package's own (WR-205). */
  readonly overrides?: ReadonlyArray<readonly [string, string]>;
  readonly defaults?: ReadonlyArray<readonly [string, string]>;
  /** Entries appended after the package's own parts (WR-205). */
  readonly extraEntries?: readonly ZipEntrySpec[];
}
const SPREADSHEET_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function columnName(index: number): string {
  let name = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  return name;
}

/** Days since 1899-12-30 (Excel's serial date) for a UTC date. */
function excelSerial(date: Date): number {
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/**
 * A minimal SpreadsheetML package: shared strings, booleans, numbers, dates (style 1, number format 14) and formula
 * cells that carry a cached value, the way Excel saves them. `doctype` puts a DOCTYPE with an internal entity at the
 * head of the first worksheet (a string is written there instead), and `firstSheetEncoding` writes that worksheet as
 * UTF-16 after its byte order mark.
 */
export function buildXlsx(sheets: readonly XlsxSheetSpec[], options: XlsxOptions = {}): Buffer {
  const strings: string[] = [];
  const stringIndex = (text: string): number => {
    const existing = strings.indexOf(text);
    if (existing >= 0) return existing;
    strings.push(text);
    return strings.length - 1;
  };
  const worksheets = sheets.map((sheet, index) => {
    const rows = sheet.rows.map((cells, rowIndex) => {
      const row = rowIndex + 1;
      const xml = cells.map((cell, columnIndex) => {
        const ref = `${columnName(columnIndex)}${row}`;
        if (cell === null) return "";
        if (typeof cell === "string") return `<c r="${ref}" t="s"><v>${stringIndex(cell)}</v></c>`;
        if (typeof cell === "boolean") return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
        if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
        if (cell instanceof Date) return `<c r="${ref}" s="1"><v>${excelSerial(cell)}</v></c>`;
        return `<c r="${ref}"><f>${escapeXml(cell.formula)}</f><v>${cell.cached}</v></c>`;
      }).join("");
      return `<row r="${row}">${xml}</row>`;
    }).join("");
    const doctype = !options.doctype || index !== 0 ? ""
      : typeof options.doctype === "string" ? options.doctype : `<!DOCTYPE worksheet [<!ENTITY vendor "Example vendor">]>\n`;
    const xml = `${XML_DECLARATION}${doctype}<worksheet xmlns="${SPREADSHEET_MAIN}"><sheetData>${rows}</sheetData></worksheet>`;
    if (index !== 0 || !options.firstSheetEncoding) return xml;
    const utf16 = Buffer.from(xml.replace(`encoding="UTF-8"`, `encoding="UTF-16"`), "utf16le");
    return Buffer.concat(options.firstSheetEncoding === "utf-16le" ? [Buffer.from([0xff, 0xfe]), utf16] : [Buffer.from([0xfe, 0xff]), utf16.swap16()]);
  });
  const sharedStrings = `${XML_DECLARATION}<sst xmlns="${SPREADSHEET_MAIN}" count="${strings.length}" uniqueCount="${strings.length}">`
    + strings.map((text) => `<si><t xml:space="preserve">${escapeXml(text)}</t></si>`).join("") + `</sst>`;
  const styles = `${XML_DECLARATION}<styleSheet xmlns="${SPREADSHEET_MAIN}">`
    + `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>`
    + `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>`
    + `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
    + `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
    + `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>`
    + `</styleSheet>`;
  const workbook = `${XML_DECLARATION}<workbook xmlns="${SPREADSHEET_MAIN}" xmlns:r="${OFFICE_RELATIONSHIPS}"><sheets>`
    + sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")
    + `</sheets></workbook>`;
  const workbookRelationships = relationships([
    ...sheets.map((_, index) => [`rId${index + 1}`, `${OFFICE_RELATIONSHIPS}/worksheet`, `worksheets/sheet${index + 1}.xml`] as const),
    [`rId${sheets.length + 1}`, `${OFFICE_RELATIONSHIPS}/sharedStrings`, "sharedStrings.xml"],
    [`rId${sheets.length + 2}`, `${OFFICE_RELATIONSHIPS}/styles`, "styles.xml"],
  ]);
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: contentTypes([
        ["/xl/workbook.xml", XLSX_MAIN_TYPE],
        ...sheets.map((_, index) => [`/xl/worksheets/sheet${index + 1}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"] as const),
        ["/xl/sharedStrings.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"],
        ["/xl/styles.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"],
        ...(options.overrides ?? []),
      ], options.defaults ?? []),
      method: 0,
    },
    { name: "_rels/.rels", data: relationships([["rId1", `${OFFICE_RELATIONSHIPS}/officeDocument`, "xl/workbook.xml"]]), method: 0 },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelationships },
    ...worksheets.map((data, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data })),
    { name: "xl/sharedStrings.xml", data: sharedStrings },
    { name: "xl/styles.xml", data: styles },
    ...(options.extraEntries ?? []),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/** A valid 4x4 RGB PNG (a two-colour check). */
export function buildPng(): Buffer {
  const width = 4;
  const height = 4;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(2, 9);
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      const shade = (x + y) % 2 === 0 ? 0x1f : 0xe0;
      raw.writeUInt8(shade, offset);
      raw.writeUInt8(shade, offset + 1);
      raw.writeUInt8(0x80, offset + 2);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A JFIF signature stub: start of image, a JFIF APP0 segment and end of image. It carries no picture. */
export function buildJpegStub(): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

/** UAT-013's fact, carried by the committed vendor security pack. */
export const VENDOR_PACK_FACT = "The vendor's offshore support team has administrator access.";

export const VENDOR_PACK_PAGES: readonly string[] = [
  "Vendor security pack\nPayroll SaaS by Example Vendor Pty Ltd\nPrepared for the CSRM assessment.",
  `Hosting and support\nCustomer data is hosted in the Sydney region.\n${VENDOR_PACK_FACT}`,
  "Certifications\nISO/IEC 27001:2022 certificate valid to 2027-06-30.",
];

export const DATA_FLOW_PARAGRAPHS: readonly string[] = [
  "Data flow: payroll SaaS",
  "Employee records flow nightly from the HR system to the vendor over SFTP.",
];

export const DATA_FLOW_TABLE: readonly (readonly string[])[] = [["Data", "Classification"], ["Payroll", "Confidential"]];

export const VENDOR_QUESTIONNAIRE_SHEETS: readonly XlsxSheetSpec[] = [
  {
    name: "Controls",
    rows: [
      ["Control", "Answer", "Score", "Weight", "Total", "Reviewed"],
      ["MFA for administrators", true, 2, 1, { formula: "SUM(C2:D2)", cached: 3 }, new Date(Date.UTC(2026, 8, 30))],
      ["Encryption at rest", false, 1.5, null, null, null],
    ],
  },
  {
    name: "Vendors",
    rows: [
      ["Vendor", "Region"],
      ["Example Vendor Pty Ltd", "Sydney"],
    ],
  },
];

export const ARCHITECTURE_DECK_SLIDES: readonly (readonly string[])[] = [
  ["Architecture", "Payroll SaaS overview"],
  ["Integration", "SFTP from the HR system, nightly"],
];

export const ARCHITECTURE_DECK_NOTES: readonly string[] = ["Presenter notes are not part of the deck's text."];

export interface AttachmentFixture {
  readonly fileName: string;
  readonly builder: string;
  readonly knownText: string;
  readonly build: () => Buffer;
}

/** The committed fixtures (tests/fixtures/attachments), each written once by writeAttachmentFixtures. */
export const ATTACHMENT_FIXTURES: readonly AttachmentFixture[] = [
  {
    fileName: "vendor-security-pack.pdf",
    builder: "buildPdf(VENDOR_PACK_PAGES)",
    knownText: VENDOR_PACK_FACT,
    build: () => buildPdf(VENDOR_PACK_PAGES),
  },
  {
    fileName: "data-flow.docx",
    builder: "buildDocx(DATA_FLOW_PARAGRAPHS, { table: DATA_FLOW_TABLE })",
    knownText: DATA_FLOW_PARAGRAPHS[1],
    build: () => buildDocx(DATA_FLOW_PARAGRAPHS, { table: DATA_FLOW_TABLE }),
  },
  {
    fileName: "vendor-questionnaire.xlsx",
    builder: "buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS)",
    knownText: "MFA for administrators",
    build: () => buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS),
  },
  {
    fileName: "architecture-deck.pptx",
    builder: "buildPptx(ARCHITECTURE_DECK_SLIDES, { notes: ARCHITECTURE_DECK_NOTES })",
    knownText: "SFTP from the HR system, nightly",
    build: () => buildPptx(ARCHITECTURE_DECK_SLIDES, { notes: ARCHITECTURE_DECK_NOTES }),
  },
  { fileName: "diagram.png", builder: "buildPng()", knownText: "none (a 4x4 image)", build: buildPng },
  { fileName: "photo.jpg", builder: "buildJpegStub()", knownText: "none (a JFIF signature stub)", build: buildJpegStub },
];

/** Writes every committed fixture into `directory` and returns the paths written. */
export function writeAttachmentFixtures(directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  return ATTACHMENT_FIXTURES.map((fixture) => {
    const target = path.join(directory, fixture.fileName);
    writeFileSync(target, fixture.build());
    return target;
  });
}

// From apps/backend: node .tmp/tests-dist/tests/helpers/attachment-fixtures.js --write tests/fixtures/attachments
if (require.main === module) {
  const flag = process.argv.indexOf("--write");
  const directory = flag >= 0 ? process.argv[flag + 1] : undefined;
  if (directory === undefined) {
    console.error("usage: attachment-fixtures.js --write <directory>");
    process.exitCode = 1;
  } else {
    for (const written of writeAttachmentFixtures(path.resolve(directory))) console.log(written);
  }
}
