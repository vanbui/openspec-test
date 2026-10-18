import { claimedTypeFor, type AttachmentRefusalReason, type AttachmentType } from "./attachment-policy";
import type { PdfProbe } from "./extraction";
import { OOXML_MAIN_TYPES, ooxmlMainPart, type OoxmlPackageFacts } from "./ooxml-text";
import { readZipDirectory, ZipArchiveError, type ZipArchiveErrorCode, type ZipDirectory } from "./zip-archive";

/*
 * The content check (14-03; D-09; ASVS V5.2.2). A file is accepted only when its extension and its content name the
 * same allowed type. It is dependency-free: the signatures are fixed byte prefixes, Office packages go through CSRM's
 * own bounded ZIP reader and OOXML scanner, and a PDF is opened by pdf.js in the extraction worker (probePdf).
 */

export type SniffedSignature = "pdf" | "png" | "jpeg" | "zip" | "cfb" | "text" | "binary";

export type ContentRefusalReason = Exclude<AttachmentRefusalReason, "ATTACHMENT_EMPTY" | "ATTACHMENT_TOO_LARGE" | "ATTACHMENT_MALWARE_FOUND">;

export type ContentCheckResult = { readonly ok: true; readonly type: AttachmentType } | { readonly ok: false; readonly reason: ContentRefusalReason };

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** An ELF header, which is valid UTF-8 and so is checked before the text rule. */
const ELF = [0x7f, 0x45, 0x4c, 0x46];
const MZ = [0x4d, 0x5a];
const PE_SIGNATURE = [0x50, 0x45, 0x00, 0x00];
const PE_HEADER_OFFSET = 0x3c;
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM = [0xff, 0xfe];
const UTF16BE_BOM = [0xfe, 0xff];

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}

function decodes(encoding: "utf-8" | "utf-16le" | "utf-16be", bytes: Uint8Array): boolean {
  try {
    new TextDecoder(encoding, { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * A Windows executable (IN-206): `MZ`, then an `e_lfanew` at 0x3C pointing at `PE\0\0`. `MZ` alone is not enough,
 * because text may start with it ("MZ Holdings report", "MZ,Mozambique").
 */
function isPortableExecutable(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, MZ) || bytes.length < PE_HEADER_OFFSET + 4) return false;
  const offset = view(bytes).readUInt32LE(PE_HEADER_OFFSET);
  return offset + PE_SIGNATURE.length <= bytes.length && PE_SIGNATURE.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The text rule (D-09): UTF-16 after its byte order mark; otherwise UTF-8, with or without its mark, holding no NUL
 * byte. An executable header is never text: an ELF header, or a Windows PE header (IN-206; its NUL bytes fail the rule
 * too, so the check keeps the refusal explicit).
 */
function isText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, ELF) || isPortableExecutable(bytes)) return false;
  if (startsWith(bytes, UTF16LE_BOM)) return bytes.length % 2 === 0 && decodes("utf-16le", bytes.subarray(2));
  if (startsWith(bytes, UTF16BE_BOM)) return bytes.length % 2 === 0 && decodes("utf-16be", bytes.subarray(2));
  const body = startsWith(bytes, UTF8_BOM) ? bytes.subarray(3) : bytes;
  return !body.includes(0x00) && decodes("utf-8", body);
}

/** What the bytes are by their signature, or by the text rule when they have none. */
export function sniffSignature(bytes: Uint8Array): SniffedSignature {
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, ZIP)) return "zip";
  if (startsWith(bytes, CFB)) return "cfb";
  return isText(bytes) ? "text" : "binary";
}

const CFB_HEADER = 512;
const CFB_FREE = 0xffffffff;
const CFB_END_OF_CHAIN = 0xfffffffe;
const CFB_DIRECTORY_ENTRY = 128;
const CFB_STREAM = 2;

function view(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Whether a Compound File Binary's directory names an `EncryptedPackage` stream: the container Office writes an
 * encrypted OOXML package into (MS-OFFCRYPTO). The FAT is located through the header's DIFAT and its DIFAT sectors,
 * then the directory chain is followed; every step is bounded by the file, and a structure that does not fit
 * answers false, so the file is refused as an old Office format instead.
 */
function cfbHasEncryptedPackage(bytes: Uint8Array): boolean {
  const buffer = view(bytes);
  if (buffer.length < CFB_HEADER) return false;
  const shift = buffer.readUInt16LE(30);
  if (shift !== 9 && shift !== 12) return false;
  const sectorSize = 1 << shift;
  const sectorCount = Math.floor((buffer.length - CFB_HEADER) / sectorSize) + 1;
  const sectorOffset = (sector: number): number | null => {
    const offset = (sector + 1) * sectorSize;
    return sector < sectorCount && offset + sectorSize <= buffer.length ? offset : null;
  };
  const perSector = sectorSize / 4;

  const fatSectors: number[] = [];
  for (let index = 0; index < 109; index += 1) {
    const sector = buffer.readUInt32LE(76 + index * 4);
    if (sector < CFB_END_OF_CHAIN) fatSectors.push(sector);
  }
  let difat = buffer.readUInt32LE(68);
  for (let hops = 0; difat < CFB_END_OF_CHAIN && hops < sectorCount; hops += 1) {
    const offset = sectorOffset(difat);
    if (offset === null) return false;
    for (let index = 0; index < perSector - 1; index += 1) {
      const sector = buffer.readUInt32LE(offset + index * 4);
      if (sector < CFB_END_OF_CHAIN) fatSectors.push(sector);
    }
    difat = buffer.readUInt32LE(offset + (perSector - 1) * 4);
  }
  const next = (sector: number): number | null => {
    const fatSector = fatSectors[Math.floor(sector / perSector)];
    const offset = fatSector === undefined ? null : sectorOffset(fatSector);
    return offset === null ? null : buffer.readUInt32LE(offset + (sector % perSector) * 4);
  };

  let sector: number | null = buffer.readUInt32LE(48);
  for (let hops = 0; sector !== null && sector < CFB_END_OF_CHAIN && sector !== CFB_FREE && hops < sectorCount; hops += 1) {
    const offset = sectorOffset(sector);
    if (offset === null) return false;
    for (let entry = offset; entry < offset + sectorSize; entry += CFB_DIRECTORY_ENTRY) {
      const nameLength = buffer.readUInt16LE(entry + 64);
      if (nameLength < 2 || nameLength > 64 || nameLength % 2 !== 0) continue;
      const name = buffer.toString("utf16le", entry, entry + nameLength - 2);
      if (buffer.readUInt8(entry + 66) === CFB_STREAM && name === "EncryptedPackage") return true;
    }
    sector = next(sector);
  }
  return false;
}

const MAIN_TYPE_FORMATS: ReadonlyArray<readonly [AttachmentType, string]> = [
  ["docx", OOXML_MAIN_TYPES.docx],
  ["xlsx", OOXML_MAIN_TYPES.xlsx],
  ["pptx", OOXML_MAIN_TYPES.pptx],
];

function refuse(reason: ContentRefusalReason): ContentCheckResult {
  return { ok: false, reason };
}

function agree(claimed: AttachmentType, detected: AttachmentType | null): ContentCheckResult {
  return detected === claimed ? { ok: true, type: claimed } : refuse("ATTACHMENT_CONTENT_MISMATCH");
}

/**
 * The ZIP reader's structure refusals (IN-202; the stage B amendment, contract item 5): packaging CSRM will not read,
 * which is not a file whose content "doesn't match its name". An archive comment (CR-201: it can hide a second end
 * record), the three bounds, ZIP64 and a method other than stored or deflate. Office never writes a comment, ZIP64 or
 * an unusual method for a file under 25 MB, and re-saving the file writes a standard archive, so the copy's next step
 * (save a fresh copy) is the truthful one.
 */
const STRUCTURE_REFUSALS: ReadonlySet<ZipArchiveErrorCode> = new Set<ZipArchiveErrorCode>([
  "ZIP_COMMENT",
  "ZIP_RATIO",
  "ZIP_TOO_MANY_ENTRIES",
  "ZIP_TOO_LARGE",
  "ZIP64_UNSUPPORTED",
  "ZIP_METHOD_UNSUPPORTED",
]);

/** A directory refusal's closed reason: encrypted, a structure CSRM will not read, or (malformed) a mismatch. */
function directoryRefusal(error: unknown): ContentRefusalReason {
  if (!(error instanceof ZipArchiveError)) return "ATTACHMENT_CONTENT_MISMATCH";
  if (error.code === "ZIP_ENCRYPTED") return "ATTACHMENT_ENCRYPTED";
  return STRUCTURE_REFUSALS.has(error.code) ? "ATTACHMENT_UNSUPPORTED_STRUCTURE" : "ATTACHMENT_CONTENT_MISMATCH";
}

/**
 * A ZIP must be the claimed Office package: the bounded directory read (the encryption flag is "encrypted", a
 * structure refusal "unsupported structure", a malformed archive a mismatch), then the package inspection
 * (ooxmlMainPart): a main part the package really holds and `_rels/.rels` names (IN-203), or a mismatch. Macros (a
 * macro-enabled main type, a VBA project or VBA data part, an XLM macro sheet) and then active content (an external OLE
 * object, template, frame or subdocument, or an ActiveX control; WR-205) are refused before the type is compared.
 */
function checkOfficePackage(claimed: AttachmentType, bytes: Uint8Array): ContentCheckResult {
  let directory: ZipDirectory;
  try {
    directory = readZipDirectory(bytes);
  } catch (error) {
    return refuse(directoryRefusal(error));
  }
  let main: OoxmlPackageFacts;
  try {
    main = ooxmlMainPart(directory, bytes);
  } catch {
    return refuse("ATTACHMENT_CONTENT_MISMATCH");
  }
  if (main.macro) return refuse("ATTACHMENT_MACRO_ENABLED");
  if (main.activeContent) return refuse("ATTACHMENT_ACTIVE_CONTENT");
  const format = MAIN_TYPE_FORMATS.find(([, type]) => type === main.mainType);
  return agree(claimed, format ? format[0] : null);
}

/**
 * The cheap half of the content check (WR-203): the name's claim, the signature, the ZIP and OOXML structure and the text
 * rule, with no parser beyond CSRM's own bounded readers. A PDF whose name and signature agree passes here as `pdf`; it is
 * opened by checkPdfOpens, which screening runs only after the malware scan.
 */
export function checkAttachmentSignature(input: { readonly fileName: string; readonly bytes: Uint8Array }): ContentCheckResult {
  const claim = claimedTypeFor(input.fileName);
  if ("refusal" in claim) return refuse(claim.refusal);
  const claimed = claim.type;
  const detected = sniffSignature(input.bytes);
  switch (detected) {
    case "cfb":
      return refuse(cfbHasEncryptedPackage(input.bytes) ? "ATTACHMENT_ENCRYPTED" : "ATTACHMENT_LEGACY_OFFICE");
    case "zip":
      return checkOfficePackage(claimed, input.bytes);
    case "pdf":
      return claimed === "pdf" ? { ok: true, type: "pdf" } : refuse("ATTACHMENT_CONTENT_MISMATCH");
    case "png":
      return agree(claimed, "png");
    case "jpeg":
      return agree(claimed, "jpeg");
    case "text":
      return claimed === "txt" || claimed === "csv" ? { ok: true, type: claimed } : refuse("ATTACHMENT_CONTENT_MISMATCH");
    default:
      return refuse("ATTACHMENT_CONTENT_MISMATCH");
  }
}

/**
 * The PDF open check (D-09): pdf.js opens the file in the extraction worker (`probePdf`), never on the request thread. A
 * PDF that needs a password is ATTACHMENT_ENCRYPTED; one pdf.js cannot open, ATTACHMENT_CONTENT_MISMATCH. When the one
 * screening and extraction queue is full, `probePdf` rejects with ExtractionBusyError, which this passes on (WR-204).
 */
export async function checkPdfOpens(bytes: Uint8Array, probePdf: (bytes: Uint8Array) => Promise<PdfProbe>): Promise<ContentCheckResult> {
  const opened = await probePdf(bytes);
  if (opened === "password") return refuse("ATTACHMENT_ENCRYPTED");
  return opened === "ok" ? { ok: true, type: "pdf" } : refuse("ATTACHMENT_CONTENT_MISMATCH");
}

/**
 * Whether a file's name and content agree on one allowed type: the cheap checks, then, for a PDF, the open check.
 * Screening runs the two halves apart, with the malware scan between them (WR-203).
 */
export async function checkAttachmentContent(
  input: { readonly fileName: string; readonly bytes: Uint8Array },
  dependencies: { readonly probePdf: (bytes: Uint8Array) => Promise<PdfProbe> },
): Promise<ContentCheckResult> {
  const checked = checkAttachmentSignature(input);
  if (!checked.ok || checked.type !== "pdf") return checked;
  return checkPdfOpens(input.bytes, dependencies.probePdf);
}
