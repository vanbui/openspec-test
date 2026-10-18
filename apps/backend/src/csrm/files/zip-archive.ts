import zlib from "node:zlib";

/*
 * CSRM's ZIP reader (14-02; D-32, ASVS V5.2.3). DOCX, XLSX and PPTX are ZIP packages, and an uploaded package is
 * hostile until proven otherwise. The reader trusts nothing but the central directory, and it refuses before
 * inflating anything: too many entries, too much declared content, a compression ratio no Office part needs, ZIP64,
 * encryption, a method other than stored or deflate, or offsets that do not fit the buffer. Every inflate is then
 * bounded by maxOutputLength, so a bomb that lies about its sizes still stops at the bound.
 *
 * It is the only ZIP code in the backend: the content check (D-09), text extraction (D-31) and Phase 19's import
 * guard all call it. It is deliberately a classic-ZIP reader; ZIP64 is refused, never parsed.
 *
 * Every reader of a package must see the same package (CR-201). So the end-of-central-directory record must sit at
 * `length - 22` with no archive comment, which Office never writes: that is where fflate and ClamAV begin their scan,
 * so a comment can never hide a second record that another reader would take. And part names are compared without
 * regard to ASCII case, as OPC compares them (IN-204): two names that differ only in case are refused as duplicates,
 * which makes the case-insensitive findZipEntry unambiguous.
 *
 * writeStoredZip is the one writer: it rebuilds a canonical archive from parts this module has already read and
 * verified, so a library never parses the uploaded bytes (WR-201).
 */

export type ZipArchiveErrorCode =
  | "ZIP_MALFORMED"
  | "ZIP_COMMENT"
  | "ZIP_TOO_MANY_ENTRIES"
  | "ZIP_TOO_LARGE"
  | "ZIP_RATIO"
  | "ZIP64_UNSUPPORTED"
  | "ZIP_ENCRYPTED"
  | "ZIP_METHOD_UNSUPPORTED"
  | "ZIP_INFLATE_LIMIT";

export class ZipArchiveError extends Error {
  readonly code: ZipArchiveErrorCode;

  constructor(code: ZipArchiveErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ZipArchiveError";
    this.code = code;
  }
}

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly flags: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
  readonly crc32: number;
}

export interface ZipDirectory {
  readonly entries: readonly ZipEntry[];
  /** The sum of every entry's declared uncompressed size. */
  readonly declaredTotal: number;
}

export interface ZipBounds {
  readonly maxEntries: number;
  readonly maxDeclaredTotal: number;
  readonly maxRatio: number;
}

/** D-32's upload bounds, checked against the central directory before anything is inflated. */
export const ZIP_UPLOAD_BOUNDS: Readonly<ZipBounds> = Object.freeze({
  maxEntries: 10_000,
  maxDeclaredTotal: 1_073_741_824,
  maxRatio: 200,
});

/** The most an extraction inflates from one package, across all the parts it reads (128 MiB). */
export const ZIP_EXTRACTION_MAX_INFLATED = 134_217_728;

const END_SIGNATURE = 0x06054b50;
const END_LENGTH = 22;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_LENGTH = 20;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_LENGTH = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_LENGTH = 30;
const MAX_COMMENT = 0xffff;
const ZIP64_EXTRA_ID = 0x0001;
const FLAG_ENCRYPTED = 0x0001;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_UTF8_NAME = 0x0800;
const VERSION_20 = 20;
/** 1980-01-01 00:00, the earliest MS-DOS date, so a rebuilt archive is the same bytes every time. */
const DOS_DATE_1980 = (0 << 9) | (1 << 5) | 1;

function view(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * The end-of-central-directory record: only the one at `length - 22` with no comment (CR-201). When that is not there
 * but a record whose comment ends the buffer is, the archive carries a comment: ZIP_COMMENT. With neither, it has no
 * record at all: ZIP_MALFORMED.
 */
function findEndRecord(buffer: Buffer): number {
  const last = buffer.length - END_LENGTH;
  if (buffer.readUInt32LE(last) === END_SIGNATURE && buffer.readUInt16LE(last + 20) === 0) return last;
  const lowest = Math.max(0, last - MAX_COMMENT);
  for (let offset = last; offset >= lowest; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== END_SIGNATURE) continue;
    if (offset + END_LENGTH + buffer.readUInt16LE(offset + 20) === buffer.length) {
      throw new ZipArchiveError("ZIP_COMMENT", "an archive comment, which Office never writes");
    }
  }
  throw new ZipArchiveError("ZIP_MALFORMED", "no end-of-central-directory record");
}

/** A part name as OPC compares it: ASCII letters folded to lower case, every other character as it is (IN-204). */
function partNameKey(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function hasZip64Extra(buffer: Buffer, start: number, length: number): boolean {
  let offset = start;
  const end = start + length;
  while (offset + 4 <= end) {
    const id = buffer.readUInt16LE(offset);
    const size = buffer.readUInt16LE(offset + 2);
    if (id === ZIP64_EXTRA_ID) return true;
    offset += 4 + size;
  }
  return false;
}

/** Where an entry's data starts, from its local header, after checking that the header and data fit before `limit`. */
function dataOffset(buffer: Buffer, entry: ZipEntry, limit: number): number {
  const header = entry.localHeaderOffset;
  if (header + LOCAL_LENGTH > limit || buffer.readUInt32LE(header) !== LOCAL_SIGNATURE) {
    throw new ZipArchiveError("ZIP_MALFORMED", `no local header for ${entry.name}`);
  }
  const start = header + LOCAL_LENGTH + buffer.readUInt16LE(header + 26) + buffer.readUInt16LE(header + 28);
  if (start + entry.compressedSize > limit) throw new ZipArchiveError("ZIP_MALFORMED", `data for ${entry.name} overruns the archive`);
  return start;
}

/**
 * Reads and checks the central directory. Nothing is inflated: every refusal here is decided from declared sizes,
 * flags and offsets alone.
 */
export function readZipDirectory(bytes: Uint8Array, bounds: ZipBounds = ZIP_UPLOAD_BOUNDS): ZipDirectory {
  const buffer = view(bytes);
  if (buffer.length < END_LENGTH) throw new ZipArchiveError("ZIP_MALFORMED", "too short for an archive");
  const end = findEndRecord(buffer);

  if (end >= ZIP64_LOCATOR_LENGTH && buffer.readUInt32LE(end - ZIP64_LOCATOR_LENGTH) === ZIP64_LOCATOR_SIGNATURE) {
    throw new ZipArchiveError("ZIP64_UNSUPPORTED", "ZIP64 end-of-central-directory locator");
  }
  const diskNumber = buffer.readUInt16LE(end + 4);
  const centralDisk = buffer.readUInt16LE(end + 6);
  const diskEntries = buffer.readUInt16LE(end + 8);
  const totalEntries = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if ([diskNumber, centralDisk, diskEntries, totalEntries].includes(0xffff) || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new ZipArchiveError("ZIP64_UNSUPPORTED", "ZIP64 sentinel in the end-of-central-directory record");
  }
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) {
    throw new ZipArchiveError("ZIP_MALFORMED", "multi-disk archive");
  }
  if (totalEntries > bounds.maxEntries) throw new ZipArchiveError("ZIP_TOO_MANY_ENTRIES", `${totalEntries} entries`);
  const centralEnd = centralOffset + centralSize;
  if (centralEnd > end) throw new ZipArchiveError("ZIP_MALFORMED", "central directory outside the archive");

  const entries: ZipEntry[] = [];
  const keys = new Set<string>();
  let declaredTotal = 0;
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + CENTRAL_LENGTH > centralEnd || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new ZipArchiveError("ZIP_MALFORMED", `central entry ${index} missing`);
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc32 = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const startDisk = buffer.readUInt16LE(offset + 34);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const next = offset + CENTRAL_LENGTH + nameLength + extraLength + commentLength;
    if (next > centralEnd) throw new ZipArchiveError("ZIP_MALFORMED", `central entry ${index} overruns the directory`);
    const name = buffer.toString("utf8", offset + CENTRAL_LENGTH, offset + CENTRAL_LENGTH + nameLength);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff || startDisk === 0xffff
      || hasZip64Extra(buffer, offset + CENTRAL_LENGTH + nameLength, extraLength)) {
      throw new ZipArchiveError("ZIP64_UNSUPPORTED", `ZIP64 entry ${name}`);
    }
    if (flags & FLAG_ENCRYPTED) throw new ZipArchiveError("ZIP_ENCRYPTED", name);
    if (method !== METHOD_STORED && method !== METHOD_DEFLATE) throw new ZipArchiveError("ZIP_METHOD_UNSUPPORTED", `${name} uses method ${method}`);
    const key = partNameKey(name);
    if (keys.has(key)) throw new ZipArchiveError("ZIP_MALFORMED", `duplicate entry ${name}`);
    keys.add(key);

    const entry: ZipEntry = { name, method, flags, compressedSize, uncompressedSize, localHeaderOffset, crc32 };
    dataOffset(buffer, entry, centralOffset);
    if (uncompressedSize > bounds.maxRatio * Math.max(compressedSize, 1)) {
      throw new ZipArchiveError("ZIP_RATIO", `${name} declares ${uncompressedSize} from ${compressedSize}`);
    }
    declaredTotal += uncompressedSize;
    if (declaredTotal > bounds.maxDeclaredTotal) throw new ZipArchiveError("ZIP_TOO_LARGE", `more than ${bounds.maxDeclaredTotal} bytes declared`);
    entries.push(entry);
    offset = next;
  }

  // No two entries may share bytes: overlapping entries are how a small archive declares the same data many times.
  const spans = entries
    .map((entry) => ({ start: entry.localHeaderOffset, end: dataOffset(buffer, entry, centralOffset) + entry.compressedSize }))
    .sort((left, right) => left.start - right.start);
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index].start < spans[index - 1].end) throw new ZipArchiveError("ZIP_MALFORMED", "overlapping entries");
  }

  return { entries, declaredTotal };
}

/**
 * The entry with this name (no leading slash), compared as OPC compares part names: without regard to ASCII case.
 * readZipDirectory refuses names that differ only in case, so at most one entry matches.
 */
export function findZipEntry(directory: ZipDirectory, name: string): ZipEntry | undefined {
  const key = partNameKey(name);
  return directory.entries.find((entry) => partNameKey(entry.name) === key);
}

/**
 * Reads one entry's bytes. Inflation is bounded by the smaller of `maxOutputLength` and the entry's declared size,
 * and the result must match the declared size and CRC-32.
 */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry, options: { maxOutputLength: number }): Buffer {
  const buffer = view(bytes);
  if (!Number.isSafeInteger(options.maxOutputLength) || options.maxOutputLength < 0) {
    throw new RangeError("maxOutputLength must be a non-negative integer");
  }
  if (entry.flags & FLAG_ENCRYPTED) throw new ZipArchiveError("ZIP_ENCRYPTED", entry.name);
  if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATE) throw new ZipArchiveError("ZIP_METHOD_UNSUPPORTED", entry.name);
  if (entry.uncompressedSize > options.maxOutputLength) throw new ZipArchiveError("ZIP_INFLATE_LIMIT", `${entry.name} declares more than the bound`);

  const start = dataOffset(buffer, entry, buffer.length);
  const span = buffer.subarray(start, start + entry.compressedSize);
  let output: Buffer;
  if (entry.method === METHOD_STORED) {
    output = Buffer.from(span);
  } else {
    try {
      output = zlib.inflateRawSync(span, { maxOutputLength: Math.max(1, entry.uncompressedSize) });
    } catch (error) {
      if ((error as { code?: unknown }).code === "ERR_BUFFER_TOO_LARGE") {
        throw new ZipArchiveError("ZIP_INFLATE_LIMIT", `${entry.name} inflates past its declared size`);
      }
      throw new ZipArchiveError("ZIP_MALFORMED", `${entry.name} does not inflate`);
    }
  }
  if (output.length !== entry.uncompressedSize || zlib.crc32(output) !== entry.crc32) {
    throw new ZipArchiveError("ZIP_MALFORMED", `${entry.name} does not match its declared size and CRC-32`);
  }
  return output;
}

/** One part of a rebuilt archive: its name and its bytes, already read and verified. */
export interface StoredZipPart {
  readonly name: string;
  readonly data: Uint8Array;
}

/**
 * A canonical classic archive of `parts`, in order (WR-201): every entry stored (method 0) with its CRC-32 and exact
 * sizes in both headers, a UTF-8 name (flagged, so every reader decodes it alike), no extra field, no data descriptor
 * and no comment, and the end record at `length - 22`. The timestamps are fixed, so the same parts always give the
 * same bytes. The result is a fresh allocation of exactly the archive's length, never a view into a shared pool.
 */
export function writeStoredZip(parts: readonly StoredZipPart[]): Buffer {
  if (parts.length >= 0xffff) throw new RangeError("too many parts for a classic archive");
  const keys = new Set<string>();
  const names = parts.map((part) => {
    const key = partNameKey(part.name);
    if (part.name === "" || keys.has(key)) throw new RangeError(`empty or duplicate part name ${part.name}`);
    keys.add(key);
    const name = Buffer.from(part.name, "utf8");
    if (name.length > 0xffff) throw new RangeError("part name too long");
    return name;
  });
  const localTotal = parts.reduce((total, part, index) => total + LOCAL_LENGTH + names[index].length + part.data.byteLength, 0);
  const centralTotal = names.reduce((total, name) => total + CENTRAL_LENGTH + name.length, 0);
  if (localTotal + centralTotal >= 0xffffffff) throw new RangeError("the parts do not fit a classic archive");

  const archive = Buffer.alloc(localTotal + centralTotal + END_LENGTH);
  const offsets: number[] = [];
  const crcs: number[] = [];
  let offset = 0;
  parts.forEach((part, index) => {
    const name = names[index];
    const crc = zlib.crc32(part.data);
    offsets.push(offset);
    crcs.push(crc);
    archive.writeUInt32LE(LOCAL_SIGNATURE, offset);
    archive.writeUInt16LE(VERSION_20, offset + 4);
    archive.writeUInt16LE(FLAG_UTF8_NAME, offset + 6);
    archive.writeUInt16LE(METHOD_STORED, offset + 8);
    archive.writeUInt16LE(0, offset + 10);
    archive.writeUInt16LE(DOS_DATE_1980, offset + 12);
    archive.writeUInt32LE(crc, offset + 14);
    archive.writeUInt32LE(part.data.byteLength, offset + 18);
    archive.writeUInt32LE(part.data.byteLength, offset + 22);
    archive.writeUInt16LE(name.length, offset + 26);
    // The extra-field length (offset + 28) stays zero.
    name.copy(archive, offset + LOCAL_LENGTH);
    archive.set(part.data, offset + LOCAL_LENGTH + name.length);
    offset += LOCAL_LENGTH + name.length + part.data.byteLength;
  });

  const centralOffset = offset;
  parts.forEach((part, index) => {
    const name = names[index];
    archive.writeUInt32LE(CENTRAL_SIGNATURE, offset);
    archive.writeUInt16LE(VERSION_20, offset + 4);
    archive.writeUInt16LE(VERSION_20, offset + 6);
    archive.writeUInt16LE(FLAG_UTF8_NAME, offset + 8);
    archive.writeUInt16LE(METHOD_STORED, offset + 10);
    archive.writeUInt16LE(0, offset + 12);
    archive.writeUInt16LE(DOS_DATE_1980, offset + 14);
    archive.writeUInt32LE(crcs[index], offset + 16);
    archive.writeUInt32LE(part.data.byteLength, offset + 20);
    archive.writeUInt32LE(part.data.byteLength, offset + 24);
    archive.writeUInt16LE(name.length, offset + 28);
    // The extra field, comment, start disk and attributes (offsets 30 to 41) stay zero.
    archive.writeUInt32LE(offsets[index], offset + 42);
    name.copy(archive, offset + CENTRAL_LENGTH);
    offset += CENTRAL_LENGTH + name.length;
  });

  archive.writeUInt32LE(END_SIGNATURE, offset);
  archive.writeUInt16LE(parts.length, offset + 8);
  archive.writeUInt16LE(parts.length, offset + 10);
  archive.writeUInt32LE(offset - centralOffset, offset + 12);
  archive.writeUInt32LE(centralOffset, offset + 16);
  // The comment length (offset + 20) stays zero.
  return archive;
}
