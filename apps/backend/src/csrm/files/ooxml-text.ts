import { findZipEntry, readZipEntry, ZIP_EXTRACTION_MAX_INFLATED, ZipArchiveError, type ZipDirectory, type ZipEntry } from "./zip-archive";

/*
 * CSRM's Office text scanner (14-02; D-31, D-32). It is not a general XML parser: it tokenises tags and text, decodes
 * the five predefined entities and numeric character references, and refuses any DOCTYPE or ENTITY declaration
 * outright, so no DTD and no external entity is ever processed. DOCX and PPTX text are read from their parts through
 * the bounded ZIP reader, which finds a part by name without regard to ASCII case, as OPC does (IN-204).
 *
 * What is read: a DOCX's body paragraphs and tables, with inserted revisions kept; never deleted text, comments,
 * field instructions or the duplicate mc:Fallback copy. A PPTX's slides in presentation order; speaker notes are
 * presenter commentary, not the deck's content, and are excluded (D-31, settled by 14-RESEARCH).
 *
 * Elements are matched by their conventional prefixes (w:, a:, p:, r:, mc:), which every Office writer uses. A
 * package that binds the namespaces to other prefixes yields no text, which reads as "no text available", never as
 * text that should not have been read.
 */

export type OoxmlTextErrorCode = "DOCTYPE_REFUSED" | "OOXML_MALFORMED";

export class OoxmlTextError extends Error {
  readonly code: OoxmlTextErrorCode;

  constructor(code: OoxmlTextErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "OoxmlTextError";
    this.code = code;
  }
}

export type XmlToken =
  | { readonly kind: "open"; readonly name: string; readonly attributes: Readonly<Record<string, string>>; readonly selfClosing: boolean }
  | { readonly kind: "close"; readonly name: string }
  | { readonly kind: "text"; readonly text: string };

/** The main-part content types of the three Office formats CSRM accepts (ECMA-376). */
export const OOXML_MAIN_TYPES = Object.freeze({
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
} as const);

/** `[Content_Types].xml` is inflated with at most 1 MiB. */
export const OOXML_CONTENT_TYPES_MAX = 1_048_576;

/**
 * The package inspection's one budget (WR-205): `[Content_Types].xml` and every relationships part together inflate at
 * most 8 MiB. Relationships parts are small, but a workbook keeps each cell hyperlink as a relationship, so a link-heavy
 * register can pass 1 MiB; 8 MiB keeps such a file while bounding the request thread's work.
 */
export const OOXML_PACKAGE_INSPECTION_MAX = 8_388_608;

/**
 * A document type or entity declaration anywhere in a decoded part, comments included. tokenizeXml refuses on it, and
 * the XLSX reader applies it to every part it hands to its library (IN-207).
 */
export const DTD_DECLARATION = /<!\s*(?:DOCTYPE|ENTITY)/i;
const NAME = /^[A-Za-z_][\w.:-]*$/;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const PREDEFINED: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" };

function malformed(detail: string): OoxmlTextError {
  return new OoxmlTextError("OOXML_MALFORMED", detail);
}

function decodeEntities(raw: string): string {
  if (!raw.includes("&")) return raw;
  let result = "";
  let index = 0;
  while (index < raw.length) {
    const amp = raw.indexOf("&", index);
    if (amp === -1) {
      result += raw.slice(index);
      break;
    }
    result += raw.slice(index, amp);
    const semicolon = raw.indexOf(";", amp + 1);
    if (semicolon === -1 || semicolon - amp > 12) throw malformed("bare ampersand");
    const reference = raw.slice(amp + 1, semicolon);
    if (reference.startsWith("#")) {
      const hex = reference[1] === "x";
      const digits = reference.slice(hex ? 2 : 1);
      if (!(hex ? /^[0-9A-Fa-f]+$/ : /^[0-9]+$/).test(digits)) throw malformed(`bad character reference &${reference};`);
      const codePoint = parseInt(digits, hex ? 16 : 10);
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        throw malformed(`bad character reference &${reference};`);
      }
      result += String.fromCodePoint(codePoint);
    } else if (Object.prototype.hasOwnProperty.call(PREDEFINED, reference)) {
      result += PREDEFINED[reference];
    } else {
      throw malformed(`undeclared entity &${reference};`);
    }
    index = semicolon + 1;
  }
  return result;
}

function tagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let index = from; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  throw malformed("unterminated tag");
}

/**
 * Tokenises one XML document into tags and text. Comments, processing instructions and the XML declaration are
 * skipped; CDATA is text. Tags must nest and close, and there must be one root element.
 */
export function* tokenizeXml(xml: string): Generator<XmlToken> {
  if (DTD_DECLARATION.test(xml)) throw new OoxmlTextError("DOCTYPE_REFUSED");
  const source = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const stack: string[] = [];
  let rootClosed = false;
  let index = 0;
  while (index < source.length) {
    const lt = source.indexOf("<", index);
    const textEnd = lt === -1 ? source.length : lt;
    if (textEnd > index) {
      const raw = source.slice(index, textEnd);
      if (stack.length > 0) yield { kind: "text", text: decodeEntities(raw) };
      else if (raw.trim() !== "") throw malformed("text outside the root element");
    }
    if (lt === -1) break;

    if (source.startsWith("<!--", lt)) {
      const close = source.indexOf("-->", lt + 4);
      if (close === -1) throw malformed("unterminated comment");
      index = close + 3;
    } else if (source.startsWith("<![CDATA[", lt)) {
      const close = source.indexOf("]]>", lt + 9);
      if (close === -1 || stack.length === 0) throw malformed("misplaced or unterminated CDATA");
      yield { kind: "text", text: source.slice(lt + 9, close) };
      index = close + 3;
    } else if (source.startsWith("<?", lt)) {
      const close = source.indexOf("?>", lt + 2);
      if (close === -1) throw malformed("unterminated processing instruction");
      index = close + 2;
    } else if (source.startsWith("<!", lt)) {
      throw malformed("markup declaration");
    } else if (source.startsWith("</", lt)) {
      const close = source.indexOf(">", lt + 2);
      if (close === -1) throw malformed("unterminated end tag");
      const name = source.slice(lt + 2, close).trim();
      if (stack.pop() !== name) throw malformed(`mismatched end tag ${name}`);
      if (stack.length === 0) rootClosed = true;
      yield { kind: "close", name };
      index = close + 1;
    } else {
      const close = tagEnd(source, lt + 1);
      let inner = source.slice(lt + 1, close);
      const selfClosing = inner.endsWith("/");
      if (selfClosing) inner = inner.slice(0, -1);
      const nameMatch = /^[^\s/>]+/.exec(inner);
      const name = nameMatch ? nameMatch[0] : "";
      if (!NAME.test(name)) throw malformed(`bad element name ${name}`);
      if (stack.length === 0 && rootClosed) throw malformed("more than one root element");
      const attributes: Record<string, string> = Object.create(null);
      ATTRIBUTE.lastIndex = 0;
      const rest = inner.slice(name.length);
      let match: RegExpExecArray | null;
      while ((match = ATTRIBUTE.exec(rest)) !== null) attributes[match[1]] = decodeEntities(match[2] ?? match[3] ?? "");
      if (rest.replace(ATTRIBUTE, "").trim() !== "") throw malformed(`bad attributes on ${name}`);
      if (selfClosing) {
        if (stack.length === 0) rootClosed = true;
      } else {
        stack.push(name);
      }
      yield { kind: "open", name, attributes, selfClosing };
      index = close + 1;
    }
  }
  if (stack.length > 0) throw malformed(`unclosed element ${stack[stack.length - 1]}`);
  if (!rootClosed) throw malformed("no root element");
}

/** Reads the parts of one package against one inflation budget. */
class PartReader {
  private remaining: number;

  constructor(private readonly directory: ZipDirectory, private readonly bytes: Uint8Array, maxInflated: number) {
    this.remaining = maxInflated;
  }

  has(name: string): boolean {
    return findZipEntry(this.directory, name) !== undefined;
  }

  text(name: string, cap = this.remaining): string {
    const entry = findZipEntry(this.directory, name);
    if (!entry) throw malformed(`missing part ${name}`);
    if (this.remaining <= 0) throw new ZipArchiveError("ZIP_INFLATE_LIMIT", "the package's inflation budget is spent");
    const data = readZipEntry(this.bytes, entry, { maxOutputLength: Math.min(cap, this.remaining) });
    this.remaining -= data.length;
    return decodeXml(data, name);
  }
}

/** A part's text: UTF-16 after its byte order mark, else UTF-8 (a UTF-8 mark is dropped); anything else is malformed. */
export function decodeXml(data: Uint8Array, name: string): string {
  try {
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(data.subarray(2));
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(data.subarray(2));
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw malformed(`${name} is not UTF-8 or UTF-16`);
  }
}

/** What the package inspection found: the main part's content type, macros, and active content beyond macros. */
export interface OoxmlPackageFacts {
  readonly mainType: string | null;
  /** A macro: a macro-enabled main type, a VBA project or VBA data part, or an XLM macro sheet. */
  readonly macro: boolean;
  /** Active content that is not a macro (WR-205): an external OLE object, template, frame or subdocument, or ActiveX. */
  readonly activeContent: boolean;
}

/** Content types that are macros (WR-205): the VBA project, VBA data, and XLM macro sheets (macrosheet, intlmacrosheet). */
const MACRO_CONTENT_TYPE = /vbaproject|vbadata|macrosheet/i;
/** Part names that are macros: the VBA project and VBA data parts, wherever they sit. */
const MACRO_PART_NAMES: ReadonlySet<string> = new Set(["vbaproject.bin", "vbadata.xml"]);
/** ActiveX controls: their content type (`application/vnd.ms-office.activeX+xml`, or `…activeX` for the binary). */
const ACTIVEX_CONTENT_TYPE = /activex/i;
/** An ActiveX part, under an `activeX/` folder at any depth. */
const ACTIVEX_PART = /(?:^|\/)activex\//i;
/**
 * Relationship types that fetch and run or render content from outside the package when their target is external
 * (WR-205): an OLE object (the Follina vector, CVE-2022-30190), an attached template (remote template injection), a
 * frame and a subdocument. An external hyperlink is a plain link and is not among them.
 */
const ACTIVE_EXTERNAL_RELATIONSHIP = /\/(?:oleObject|attachedTemplate|frame|subDocument)$/i;
const OFFICE_DOCUMENT_RELATIONSHIP = /\/officeDocument$/;

/** Every `Relationship` element of a relationships part, prefixed or not, with its attributes as the XML gives them. */
function relationshipElements(xml: string): Array<Readonly<Record<string, string>>> {
  const elements: Array<Readonly<Record<string, string>>> = [];
  for (const token of tokenizeXml(xml)) {
    if (token.kind === "open" && (token.name === "Relationship" || token.name.endsWith(":Relationship"))) elements.push(token.attributes);
  }
  return elements;
}

/** The archive entry an OPC part name (`/word/document.xml`) names, found without regard to ASCII case. */
function entryForPartName(directory: ZipDirectory, partName: string): ZipEntry | undefined {
  if (!partName.startsWith("/")) return undefined;
  const name = partName.slice(1);
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // A part name that is not valid percent-encoding is looked up as it is written.
  }
  return findZipEntry(directory, name) ?? findZipEntry(directory, decoded);
}

/**
 * Inspects an Office package through one bounded budget (OOXML_PACKAGE_INSPECTION_MAX; `[Content_Types].xml` alone at
 * most 1 MiB): its main part's content type, whether it carries a macro, and whether it carries active content.
 *
 * - The main part (IN-203): the main content type must come from one Override whose PartName names an entry the archive
 *   holds, and `_rels/.rels` must hold an officeDocument relationship, internal, whose target is that entry; anything
 *   else is malformed. A ZIP of arbitrary files with a one-line `[Content_Types].xml` is not an Office document.
 * - Macros: a macro-enabled main type, a VBA project or VBA data content type or part, or an XLM macro sheet
 *   (`macrosheet`, `intlmacrosheet`) declared by an Override or a Default (WR-205).
 * - Active content (WR-205): every relationships part (`*.rels`, any case) is read through the same budget; a
 *   relationship whose TargetMode is "External" (compared as the XML gives it after entity decoding, case-sensitively
 *   as OPC defines it) and whose type ends /oleObject, /attachedTemplate, /frame or /subDocument; or an ActiveX
 *   control, by its content type in an Override or a Default, or by a part under `activeX/`.
 *
 * A part beyond the budget, a part that is not well-formed XML, or a DOCTYPE throws, as before: the content check reads
 * every throw as a mismatch.
 */
export function ooxmlMainPart(directory: ZipDirectory, bytes: Uint8Array): OoxmlPackageFacts {
  const reader = new PartReader(directory, bytes, OOXML_PACKAGE_INSPECTION_MAX);
  const mainParts: Array<{ readonly type: string; readonly partName: string }> = [];
  let macro = directory.entries.some((entry) => MACRO_PART_NAMES.has(entry.name.split("/").pop()?.toLowerCase() ?? ""));
  let activeContent = directory.entries.some((entry) => ACTIVEX_PART.test(entry.name));
  for (const token of tokenizeXml(reader.text("[Content_Types].xml", OOXML_CONTENT_TYPES_MAX))) {
    if (token.kind !== "open" || (token.name !== "Override" && token.name !== "Default")) continue;
    const type = token.attributes.ContentType ?? "";
    if (MACRO_CONTENT_TYPE.test(type)) macro = true;
    if (ACTIVEX_CONTENT_TYPE.test(type)) activeContent = true;
    if (!/main\+xml$/i.test(type)) continue;
    if (token.name === "Default") throw malformed("a main content type declared by extension names no part");
    mainParts.push({ type, partName: token.attributes.PartName ?? "" });
  }
  if (mainParts.length > 1) throw malformed("more than one main part");
  const [main] = mainParts;
  const mainType = main?.type ?? null;
  if (mainType && /macroenabled/i.test(mainType)) macro = true;

  const relationshipParts = new Map<string, Array<Readonly<Record<string, string>>>>();
  for (const entry of directory.entries) {
    if (!entry.name.toLowerCase().endsWith(".rels")) continue;
    const elements = relationshipElements(reader.text(entry.name));
    relationshipParts.set(entry.name.toLowerCase(), elements);
    if (elements.some((attributes) => attributes.TargetMode === "External" && ACTIVE_EXTERNAL_RELATIONSHIP.test(attributes.Type ?? ""))) {
      activeContent = true;
    }
  }

  if (main) {
    const mainEntry = entryForPartName(directory, main.partName);
    if (!mainEntry) throw malformed("the main part is not in the package");
    const packageRelationships = relationshipParts.get("_rels/.rels");
    if (!packageRelationships) throw malformed("the package has no _rels/.rels");
    const officeDocuments = packageRelationships.filter((attributes) => OFFICE_DOCUMENT_RELATIONSHIP.test(attributes.Type ?? ""));
    if (officeDocuments.length === 0) throw malformed("the package names no officeDocument");
    for (const attributes of officeDocuments) {
      if (attributes.TargetMode === "External" || findZipEntry(directory, resolvePart("", attributes.Target ?? "")) !== mainEntry) {
        throw malformed("the officeDocument relationship does not name the main part");
      }
    }
  }
  return { mainType, macro, activeContent };
}

interface Dialect {
  readonly paragraph: string;
  readonly text: string;
  readonly run: string;
  readonly tab: string | null;
  readonly breaks: ReadonlySet<string>;
  readonly breaksInRunOnly: boolean;
  readonly table: string;
  readonly row: string;
  readonly cell: string;
  readonly textBox: string | null;
  readonly skip: ReadonlySet<string>;
}

const WORDPROCESSING: Dialect = {
  paragraph: "w:p",
  text: "w:t",
  run: "w:r",
  tab: "w:tab",
  breaks: new Set(["w:br", "w:cr"]),
  breaksInRunOnly: true,
  table: "w:tbl",
  row: "w:tr",
  cell: "w:tc",
  textBox: "w:txbxContent",
  // Deleted and moved-away text, field instructions and the duplicate fallback copy are never current text.
  skip: new Set(["w:del", "w:delText", "w:moveFrom", "w:instrText", "mc:Fallback"]),
};

const DRAWING: Dialect = {
  paragraph: "a:p",
  text: "a:t",
  run: "a:r",
  tab: null,
  breaks: new Set(["a:br"]),
  breaksInRunOnly: false,
  table: "a:tbl",
  row: "a:tr",
  cell: "a:tc",
  textBox: null,
  skip: new Set(["mc:Fallback"]),
};

type Frame =
  | { kind: "lines"; lines: string[] }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; rows: string[] }
  | { kind: "row"; cells: string[] };

/** Paragraphs become lines; table cells are joined by a tab and rows end a line; a text box joins its paragraph. */
function partText(xml: string, dialect: Dialect): string {
  const body: Frame = { kind: "lines", lines: [] };
  const frames: Frame[] = [body];
  let skipDepth: number | null = null;
  let depth = 0;
  let runDepth = 0;

  const top = (): Frame => frames[frames.length - 1];
  const deliver = (value: string | string[]): void => {
    const parent = top();
    const parts = Array.isArray(value) ? value : [value];
    if (parent.kind === "lines") parent.lines.push(...parts);
    else if (parent.kind === "paragraph") {
      const joined = parts.join(" ");
      parent.text += parent.text === "" || /\s$/.test(parent.text) || joined === "" ? joined : ` ${joined}`;
    } else if (parent.kind === "row") parent.cells.push(parts.join(" "));
    else parent.rows.push(...parts);
  };
  const close = (kind: Frame["kind"]): void => {
    const frame = top();
    if (frame.kind !== kind || frames.length === 1) return;
    frames.pop();
    if (frame.kind === "paragraph") deliver(frame.text);
    else if (frame.kind === "lines") deliver(frame.lines);
    else if (frame.kind === "row") deliver(frame.cells.join("\t"));
    else if (frame.kind === "table") deliver(frame.rows);
  };

  let inText = false;
  for (const token of tokenizeXml(xml)) {
    if (skipDepth !== null) {
      if (token.kind === "open" && !token.selfClosing) depth += 1;
      else if (token.kind === "close") {
        depth -= 1;
        if (depth === skipDepth) skipDepth = null;
      }
      continue;
    }
    if (token.kind === "text") {
      const frame = top();
      if (inText && frame.kind === "paragraph") frame.text += token.text;
      continue;
    }
    if (token.kind === "open") {
      const { name, selfClosing } = token;
      if (dialect.skip.has(name)) {
        if (!selfClosing) {
          skipDepth = depth;
          depth += 1;
        }
        continue;
      }
      if (!selfClosing) depth += 1;
      const frame = top();
      if (name === dialect.paragraph) frames.push({ kind: "paragraph", text: "" });
      else if (name === dialect.cell || name === dialect.textBox) frames.push({ kind: "lines", lines: [] });
      else if (name === dialect.row) frames.push({ kind: "row", cells: [] });
      else if (name === dialect.table) frames.push({ kind: "table", rows: [] });
      else if (name === dialect.run) runDepth += 1;
      else if (name === dialect.text) inText = true;
      else if (frame.kind === "paragraph" && name === dialect.tab && runDepth > 0) frame.text += "\t";
      else if (frame.kind === "paragraph" && dialect.breaks.has(name) && (!dialect.breaksInRunOnly || runDepth > 0)) frame.text += "\n";
      if (selfClosing) {
        if (name === dialect.paragraph) close("paragraph");
        else if (name === dialect.cell || name === dialect.textBox) close("lines");
        else if (name === dialect.row) close("row");
        else if (name === dialect.table) close("table");
        else if (name === dialect.run) runDepth -= 1;
        else if (name === dialect.text) inText = false;
      }
      continue;
    }
    depth -= 1;
    if (token.name === dialect.paragraph) close("paragraph");
    else if (token.name === dialect.cell || token.name === dialect.textBox) close("lines");
    else if (token.name === dialect.row) close("row");
    else if (token.name === dialect.table) close("table");
    else if (token.name === dialect.run) runDepth = Math.max(0, runDepth - 1);
    else if (token.name === dialect.text) inText = false;
  }
  while (frames.length > 1) close(top().kind);
  return body.kind === "lines" ? body.lines.join("\n") : "";
}

export interface OoxmlReadOptions {
  /** The inflation budget across every part read; defaults to ZIP_EXTRACTION_MAX_INFLATED. */
  readonly maxInflated?: number;
}

/** A DOCX's body text from `word/document.xml`. */
export function docxText(directory: ZipDirectory, bytes: Uint8Array, options: OoxmlReadOptions = {}): string {
  const reader = new PartReader(directory, bytes, options.maxInflated ?? ZIP_EXTRACTION_MAX_INFLATED);
  return partText(reader.text("word/document.xml"), WORDPROCESSING);
}

interface Relationship {
  readonly type: string;
  readonly target: string;
  readonly external: boolean;
}

function readRelationships(xml: string): Map<string, Relationship> {
  const relationships = new Map<string, Relationship>();
  for (const token of tokenizeXml(xml)) {
    if (token.kind !== "open" || token.name !== "Relationship") continue;
    const { Id: id, Type: type, Target: target, TargetMode: mode } = token.attributes;
    if (id && type && target) relationships.set(id, { type, target, external: mode === "External" });
  }
  return relationships;
}

/** Resolves a relationship target against the source part's folder; a target that climbs out of the package is malformed. */
function resolvePart(folder: string, target: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    throw malformed(`bad relationship target ${target}`);
  }
  const segments = decoded.startsWith("/") ? [] : folder.split("/").filter(Boolean);
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) throw malformed(`relationship target ${target} leaves the package`);
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

/** A PPTX's slide text, slides in `p:sldIdLst` order, separated by a blank line. Speaker notes are never read. */
export function pptxText(directory: ZipDirectory, bytes: Uint8Array, options: OoxmlReadOptions = {}): string {
  const reader = new PartReader(directory, bytes, options.maxInflated ?? ZIP_EXTRACTION_MAX_INFLATED);
  const relationships = readRelationships(reader.text("ppt/_rels/presentation.xml.rels"));
  const slideIds: string[] = [];
  let inList = false;
  for (const token of tokenizeXml(reader.text("ppt/presentation.xml"))) {
    if (token.kind === "open" && token.name === "p:sldIdLst") inList = !token.selfClosing;
    else if (token.kind === "close" && token.name === "p:sldIdLst") inList = false;
    else if (inList && token.kind === "open" && token.name === "p:sldId") {
      const id = token.attributes["r:id"];
      if (id) slideIds.push(id);
    }
  }
  const slides: string[] = [];
  for (const id of slideIds) {
    const relationship = relationships.get(id);
    if (!relationship || relationship.external || !/\/slide$/.test(relationship.type)) throw malformed(`slide ${id} has no slide relationship`);
    slides.push(partText(reader.text(resolvePart("ppt", relationship.target)), DRAWING));
  }
  return slides.join("\n\n");
}
