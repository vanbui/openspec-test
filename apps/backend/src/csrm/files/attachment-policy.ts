/*
 * The attachment policy (14-03; D-09, D-10, D-22). One module holds what a request attachment may be: the allowed
 * types and their media types, the limits, the name rule and the retention constant. Decision 2 fixes these values,
 * so no setting exposes them; Phase 22's attachment retention Admin setting takes over the retention constant.
 */

export const ATTACHMENT_TYPES = ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "png", "jpeg"] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

/** The media type each allowed type is stored and served as. */
export const ATTACHMENT_MEDIA_TYPES: Readonly<Record<AttachmentType, string>> = Object.freeze({
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpeg: "image/jpeg",
});

const EXTENSION_TYPES: Readonly<Record<string, AttachmentType>> = Object.freeze({
  ".pdf": "pdf",
  ".docx": "docx",
  ".xlsx": "xlsx",
  ".pptx": "pptx",
  ".csv": "csv",
  ".txt": "txt",
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
});

/** The allowed extensions, matched case-insensitively. */
export const ATTACHMENT_EXTENSIONS: readonly string[] = Object.freeze(Object.keys(EXTENSION_TYPES));

/** Macro-enabled Office extensions, refused as macro-enabled ("save it as .docx"). */
export const MACRO_ENABLED_EXTENSIONS: readonly string[] = Object.freeze([".docm", ".xlsm", ".pptm", ".dotm", ".xltm", ".potm"]);

/** The old binary Office extensions, refused as an old Office format. */
export const LEGACY_OFFICE_EXTENSIONS: readonly string[] = Object.freeze([".doc", ".xls", ".ppt"]);

/** The types whose text CSRM can extract (D-31); images carry none. */
export const TEXT_BEARING_ATTACHMENT_TYPES: readonly AttachmentType[] = Object.freeze(["pdf", "docx", "xlsx", "pptx", "csv", "txt"] as const);

/**
 * D-10's limits. `maxBytes` is 25 MiB, labelled "25 MB". Active files are available or awaiting the scan; stored
 * files include removed ones, so soft removal cannot grow storage without bound.
 */
export const ATTACHMENT_LIMITS = Object.freeze({
  maxBytes: 26_214_400,
  maxActivePerRequest: 20,
  maxStoredPerRequest: 60,
  noteWindowMinutes: 60,
  textCapCharacters: 20_000,
  eventLogMaxEvents: 200,
});

/** D-22: how long attachments are kept after the request closes. Phase 22's Admin setting takes this over. */
export const ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE = 7;

/** The longest display name kept, in UTF-16 code units. */
export const ATTACHMENT_NAME_MAX_LENGTH = 255;

/**
 * The closed reasons screening refuses with (D-11). The stage B amendment (2026-10-11) adds two 415s: a ZIP structure
 * CSRM will not read (IN-202) and Office active content beyond macros (WR-205).
 */
export type AttachmentRefusalReason =
  | "ATTACHMENT_TYPE_NOT_ALLOWED"
  | "ATTACHMENT_CONTENT_MISMATCH"
  | "ATTACHMENT_MACRO_ENABLED"
  | "ATTACHMENT_ENCRYPTED"
  | "ATTACHMENT_LEGACY_OFFICE"
  | "ATTACHMENT_UNSUPPORTED_STRUCTURE"
  | "ATTACHMENT_ACTIVE_CONTENT"
  | "ATTACHMENT_EMPTY"
  | "ATTACHMENT_TOO_LARGE"
  | "ATTACHMENT_MALWARE_FOUND";

/**
 * The one pattern a scanner's detection name is held to wherever CSRM serves or logs it (the stage B amendment,
 * contract item 4; WR-501, IN-704): the 422's `details.detection`, a listed file's `detection` and the security event
 * line. It is the contract's `^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$`: a letter or digit, then at most 127 letters, digits,
 * underscores (ClamAV's `Win.Test.EICAR_HDB-1`), dots, colons, slashes or hyphens, so no space, markup or quote. A name
 * outside it is never served or logged.
 */
export const ATTACHMENT_DETECTION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;

/** The extension a stored object is written with: `.jpg` for JPEG, else the type's own. */
export function storageExtensionFor(type: AttachmentType): string {
  return type === "jpeg" ? ".jpg" : `.${type}`;
}

/** The lower-cased extension of a name, including its dot, or "" when it has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 || dot === name.length - 1 ? "" : name.slice(dot).toLowerCase();
}

/*
 * The characters a display name loses (IN-205): every control (Cc: C0, DEL and C1) and format character (Cf: among them
 * the soft hyphen, the zero-width space, non-joiner and joiner, the left-to-right and right-to-left marks, the Arabic
 * letter mark, the embeddings and overrides of the RLO trick, the word joiner and invisible operators, the isolates, a
 * byte order mark inside a name, the interlinear annotation characters and the tag characters), and the line and
 * paragraph separators (Zl, Zp). Written as property escapes, so the source holds no invisible character. A joiner
 * inside an emoji sequence or a Persian or Indic name is lost too: the name stays readable, and an invisible character
 * that can hide or reorder text is worth more than that.
 */
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/**
 * Windows reserved device names (IN-205): a name whose part before its first dot, trailing spaces ignored, is one of
 * these, in any case, opens the device instead of a file when saved on Windows: CON, PRN, AUX, NUL, CONIN$, CONOUT$,
 * and COM or LPT followed by a digit or a superscript one, two or three. Such a name gets a leading `_`.
 */
const WINDOWS_RESERVED_STEM = /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00B9\u00B2\u00B3]|LPT[0-9\u00B9\u00B2\u00B3])$/i;

/** `name` with the dots and spaces at the end of its stem, before the extension, removed (Windows drops them). */
function trimStemEnd(name: string): string {
  const extension = extensionOf(name);
  if (extension === "") return name;
  const stem = name.slice(0, name.length - extension.length);
  const trimmed = stem.replace(/[. ]+$/, "");
  return trimmed === "" ? name : `${trimmed}${name.slice(stem.length)}`;
}

/** `name` with a leading `_` when its stem is a Windows reserved device name. */
function withoutReservedStem(name: string): string {
  const dot = name.indexOf(".");
  const stem = (dot === -1 ? name : name.slice(0, dot)).replace(/ +$/, "");
  return WINDOWS_RESERVED_STEM.test(stem) ? `_${name}` : name;
}

/** The first `length` UTF-16 code units of `text`, one fewer when the cut would split a surrogate pair. */
function cutAt(text: string, length: number): string {
  if (text.length <= length) return text;
  const last = text.charCodeAt(length - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? length - 1 : length);
}

/**
 * The display name of an uploaded file (D-10): the part after the last `/` or `\`, without control, format or separator
 * characters (IN-205), trimmed, with the dots and spaces at the end of its stem removed and a leading `_` before a
 * Windows reserved device stem, and at most 255 characters with its extension kept (the stem is shortened). An empty
 * result is `null`. The name is only ever displayed, escaped; it is never a storage key, prompt text or log field.
 */
export function sanitiseAttachmentName(raw: string): string | null {
  const base = raw.slice(Math.max(raw.lastIndexOf("/"), raw.lastIndexOf("\\")) + 1);
  const cleaned = base.replace(UNSAFE_NAME_CHARACTERS, "").trim();
  if (cleaned === "") return null;
  const name = withoutReservedStem(trimStemEnd(cleaned));
  if (name.length <= ATTACHMENT_NAME_MAX_LENGTH) return name;
  const extension = extensionOf(name);
  if (extension === "" || extension.length >= ATTACHMENT_NAME_MAX_LENGTH) return cutAt(name, ATTACHMENT_NAME_MAX_LENGTH).trim();
  const stem = name.slice(0, name.length - extension.length);
  return trimStemEnd(`${cutAt(stem, ATTACHMENT_NAME_MAX_LENGTH - extension.length).trimEnd()}${name.slice(name.length - extension.length)}`);
}

/** The type a name claims by its extension, or the refusal its extension earns. */
export function claimedTypeFor(name: string): { type: AttachmentType } | { refusal: "ATTACHMENT_MACRO_ENABLED" | "ATTACHMENT_LEGACY_OFFICE" | "ATTACHMENT_TYPE_NOT_ALLOWED" } {
  const extension = extensionOf(name);
  if (Object.prototype.hasOwnProperty.call(EXTENSION_TYPES, extension)) return { type: EXTENSION_TYPES[extension] };
  if (MACRO_ENABLED_EXTENSIONS.includes(extension)) return { refusal: "ATTACHMENT_MACRO_ENABLED" };
  if (LEGACY_OFFICE_EXTENSIONS.includes(extension)) return { refusal: "ATTACHMENT_LEGACY_OFFICE" };
  return { refusal: "ATTACHMENT_TYPE_NOT_ALLOWED" };
}
