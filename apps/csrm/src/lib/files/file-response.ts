/*
 * The shared file-response validator (Phase 14 D-24; Phase 19 D-19 adds its export rule beside the attachment rule).
 *
 * Strapi decides who may download a file and checks its stored digest before sending a byte (D-23). This is the web's
 * own check, on the server, of what arrived before it is handed to the browser: the content type against what the
 * caller expects, the name against a safe pattern with the type's extension, the size against its bound, and the
 * content signature (%PDF, PNG, JPEG, PK or text). A response that fails any check is refused whole, with the check
 * that failed; its bytes are never passed on.
 *
 * Plain TypeScript with no directive and no zod, so a client helper can import its types and rules too.
 */

/** `utf8-bom`: UTF-8 text that starts with its byte order mark (EF BB BF), as every CSV export does (Phase 19). */
export type FileSignature = 'pdf' | 'png' | 'jpeg' | 'zip' | 'text' | 'utf8-bom';

export type FileResponseRule = {
  /** The media types accepted, compared by their essence (`type/subtype`, lower case, no parameters). */
  readonly contentTypes: readonly string[];
  readonly maxBytes: number;
  isSafeName(name: string): boolean;
  /** The signatures the bytes may carry; one must match. */
  readonly signatures: readonly FileSignature[];
};

export type FileResponseFailure = 'type' | 'name' | 'size' | 'signature';

export type FileResponseInput = {
  readonly contentType: string | null;
  readonly contentDisposition: string | null;
  readonly bytes: Uint8Array;
};

export type ValidatedFileResponse =
  | { readonly ok: true; readonly fileName: string; readonly contentType: string; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly failure: FileResponseFailure };

/** The attachment types (`RequestAttachmentType`). */
export type AttachmentFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt' | 'png' | 'jpeg';

/** The largest attachment (D-10; `RequestAttachment.byteSize` maximum). */
export const ATTACHMENT_RESPONSE_MAX_BYTES = 26_214_400;

/** The longest attachment name (`RequestAttachment.fileName` maxLength). */
const ATTACHMENT_NAME_MAX_LENGTH = 255;

const ATTACHMENT_FILE_FACTS: Readonly<Record<AttachmentFileType, { readonly mediaType: string; readonly extensions: readonly string[]; readonly signature: FileSignature }>> = {
  pdf: { mediaType: 'application/pdf', extensions: ['.pdf'], signature: 'pdf' },
  docx: { mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['.docx'], signature: 'zip' },
  xlsx: { mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['.xlsx'], signature: 'zip' },
  pptx: { mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['.pptx'], signature: 'zip' },
  csv: { mediaType: 'text/csv', extensions: ['.csv'], signature: 'text' },
  txt: { mediaType: 'text/plain', extensions: ['.txt'], signature: 'text' },
  png: { mediaType: 'image/png', extensions: ['.png'], signature: 'png' },
  jpeg: { mediaType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], signature: 'jpeg' },
};

/** The eight media types an attachment download may carry: exactly the download's declared 200 content. */
export const ATTACHMENT_RESPONSE_CONTENT_TYPES: readonly string[] = Object.freeze(
  (['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'] as const).map((type) => ATTACHMENT_FILE_FACTS[type].mediaType),
);

/*
 * IN-403: a path separator, or a character the server's name rule removes (attachment-policy.ts, IN-205): a control
 * (\p{Cc}: C0, DEL and C1), a format character (\p{Cf}: the bidirectional marks, embeddings, overrides and isolates, the
 * zero-width and joining characters, the soft hyphen, the byte order mark and the tags), or a line or paragraph
 * separator (\p{Zl}, \p{Zp}). Written with escapes only, so no invisible character in this source can be lost.
 */
const UNSAFE_NAME = /[/\\\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/**
 * The rule for one attachment (D-24): exactly its recorded type's media type; a name of 1 to 255 characters with no
 * path, control or bidirectional character, ending in the type's extension (`.jpg` or `.jpeg` for JPEG); at most
 * 26,214,400 bytes; and the type's signature (`zip` for the Office types, `text` for CSV and TXT).
 */
export function attachmentFileRule(type: AttachmentFileType): FileResponseRule {
  const facts = ATTACHMENT_FILE_FACTS[type];
  return {
    contentTypes: [facts.mediaType],
    maxBytes: ATTACHMENT_RESPONSE_MAX_BYTES,
    isSafeName(name: string) {
      if (name.length < 1 || name.length > ATTACHMENT_NAME_MAX_LENGTH || name.trim() !== name || UNSAFE_NAME.test(name)) return false;
      const lower = name.toLowerCase();
      return facts.extensions.some((extension) => lower.endsWith(extension) && lower.length > extension.length);
    },
    signatures: [facts.signature],
  };
}

/** The two export formats (Phase 19 D-05). */
export type ExportFileFormat = 'csv' | 'xlsx';

/**
 * The media type each export format is served with: exactly the two 200 media types the specification declares for
 * every export, and the `Content-Type` values Strapi sends (`EXPORT_MEDIA_TYPES` in send-export.ts).
 */
export const EXPORT_RESPONSE_CONTENT_TYPES: Readonly<Record<ExportFileFormat, string>> = Object.freeze({
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

/** The largest export file the web hands to the browser: 64 MiB (19-RESEARCH open question 4). */
export const EXPORT_RESPONSE_MAX_BYTES = 67_108_864;

/** The server's export file name (D-10): lower case, a letter or digit first, then letters, digits and hyphens. */
const EXPORT_NAME = /^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$/;

/**
 * The rule for one export (D-19): the format's media type, compared by its essence as every rule is (so the CSV's
 * `charset` parameter is the validator's tolerance, never a registered type); the server's safe name with the format's
 * extension; at most 64 MiB; and the format's signature, the UTF-8 byte order mark for CSV and PK for XLSX.
 */
export function exportFileRule(format: ExportFileFormat): FileResponseRule {
  return {
    contentTypes: [mediaTypeEssence(EXPORT_RESPONSE_CONTENT_TYPES[format])!],
    maxBytes: EXPORT_RESPONSE_MAX_BYTES,
    isSafeName: (name: string) => EXPORT_NAME.test(name) && name.endsWith(`.${format}`),
    signatures: [format === 'csv' ? 'utf8-bom' : 'zip'],
  };
}

/** A media type's essence: `type/subtype` in lower case, without parameters; null when it is not one. */
function mediaTypeEssence(value: string | null): string | null {
  if (value === null) return null;
  const essence = value.split(';', 1)[0]!.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(essence) ? essence : null;
}

/** One `name=value` parameter of the header, its quotes and escapes undone; null when absent. */
function dispositionParameter(header: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;\\s]+))`, 'i');
  const match = pattern.exec(header);
  if (!match) return null;
  return match[1] !== undefined ? match[1].replace(/\\(.)/g, '$1') : match[2] ?? null;
}

/**
 * The file name a `Content-Disposition` header carries: the RFC 5987 `filename*=UTF-8''…` decoded first, then the
 * quoted `filename`. Null when there is neither, or the extended form does not decode and there is no fallback.
 */
export function parseContentDispositionFileName(header: string | null): string | null {
  if (header === null) return null;
  const extended = dispositionParameter(header, 'filename\\*');
  if (extended !== null) {
    const match = /^utf-8'[^']*'(.+)$/i.exec(extended);
    if (match) {
      try {
        return decodeURIComponent(match[1]!);
      } catch {
        // A broken percent-encoding: fall back to the ASCII name.
      }
    }
  }
  return dispositionParameter(header, 'filename');
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}

function decodes(encoding: 'utf-8' | 'utf-16le' | 'utf-16be', bytes: Uint8Array): boolean {
  try {
    new TextDecoder(encoding, { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * A Windows executable (Strapi's IN-206 rule): `MZ`, then an `e_lfanew` at 0x3C pointing at `PE\0\0`. `MZ` alone is not
 * enough, because text may start with it ("MZ Holdings report").
 */
function isPortableExecutable(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x4d, 0x5a]) || bytes.length < 0x40) return false;
  const offset = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0x3c, true);
  return offset + 4 <= bytes.length && [0x50, 0x45, 0x00, 0x00].every((byte, index) => bytes[offset + index] === byte);
}

/** Strapi's text rule (content-check.ts): UTF-16 after its byte order mark, else UTF-8 without a NUL; never an executable header. */
function isText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) || isPortableExecutable(bytes)) return false;
  if (startsWith(bytes, [0xff, 0xfe])) return bytes.length % 2 === 0 && decodes('utf-16le', bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return bytes.length % 2 === 0 && decodes('utf-16be', bytes.subarray(2));
  const body = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? bytes.subarray(3) : bytes;
  return !body.includes(0x00) && decodes('utf-8', body);
}

const SIGNATURE_CHECKS: Readonly<Record<FileSignature, (bytes: Uint8Array) => boolean>> = {
  pdf: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  png: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  zip: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
  text: isText,
  'utf8-bom': (bytes) => startsWith(bytes, [0xef, 0xbb, 0xbf]) && isText(bytes),
};

/**
 * The attachment type a file name's extension names (`.jpg` and `.jpeg` are JPEG), in any case; null when it names none
 * of the eight.
 */
export function attachmentTypeOfName(name: string): AttachmentFileType | null {
  const lower = name.toLowerCase();
  const types = Object.keys(ATTACHMENT_FILE_FACTS) as AttachmentFileType[];
  return types.find((type) => ATTACHMENT_FILE_FACTS[type].extensions.some((extension) => lower.endsWith(extension) && lower.length > extension.length)) ?? null;
}

/**
 * IN-402 (D-24, per the pilot's ruling): an attachment download checked against what Strapi serves for the record, never
 * the caller's claim. The expected type is the one the served name's extension names (Strapi's `Content-Disposition`,
 * which it takes from the record); the served `Content-Type` and the bytes' signature must both be that type's, under
 * the attachment rule's name, size and character checks. A served name of no allowed type is refused as `name`.
 */
export function validateAttachmentFileResponse(input: FileResponseInput): ValidatedFileResponse {
  const fileName = parseContentDispositionFileName(input.contentDisposition);
  const type = fileName === null ? null : attachmentTypeOfName(fileName);
  if (type === null) return { ok: false, failure: 'name' };
  return validateFileResponse(input, attachmentFileRule(type));
}

/** Checks a file response against a rule, cheapest check first: type, name, size, then signature. */
export function validateFileResponse(input: FileResponseInput, rule: FileResponseRule): ValidatedFileResponse {
  const contentType = mediaTypeEssence(input.contentType);
  if (contentType === null || !rule.contentTypes.includes(contentType)) return { ok: false, failure: 'type' };
  const fileName = parseContentDispositionFileName(input.contentDisposition);
  if (fileName === null || !rule.isSafeName(fileName)) return { ok: false, failure: 'name' };
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > rule.maxBytes) return { ok: false, failure: 'size' };
  if (!rule.signatures.some((signature) => SIGNATURE_CHECKS[signature](input.bytes))) return { ok: false, failure: 'signature' };
  return { ok: true, fileName, contentType, bytes: input.bytes };
}
