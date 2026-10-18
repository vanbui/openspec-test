import { parentPort, workerData } from "node:worker_threads";

import { getDocumentProxy } from "unpdf";

import { readWorkbookSheets, xlsxCellText, type XlsxSheet } from "../spreadsheets/xlsx-reader";
import { capExtractedText, normaliseExtractedText, type ExtractionReply, type ExtractionRequest, type PdfProbe, type TextBearingType } from "./extraction";
import { docxText, pptxText } from "./ooxml-text";
import { readZipDirectory } from "./zip-archive";

/*
 * The extraction worker (14-02; D-31, D-32). It runs only inside the Worker that extraction.ts starts with a heap
 * limit and a wall clock, reads one file from `workerData`, posts one reply and is then terminated. It starts with an
 * empty environment and no Node flags (WR-202), and reads nothing from `process.env`: what it needs is in `workerData`.
 *
 * PDF goes through pdf.js (bundled by unpdf) with isEvalSupported false, so no font program becomes a Function
 * (CVE-2024-4367), and verbosity 0. Pages are read one at a time and cleaned up; unpdf's all-pages-at-once text helper
 * is never used. DOCX and PPTX go through CSRM's ZIP reader and DTD-free OOXML scanner; XLSX through the shared XLSX
 * reader, cached values only; CSV and TXT through a fatal TextDecoder.
 */

const PDF_OPTIONS = { isEvalSupported: false, verbosity: 0 } as const;

async function probePdfBytes(data: Uint8Array): Promise<PdfProbe> {
  try {
    const pdf = await getDocumentProxy(data, { ...PDF_OPTIONS });
    await pdf.loadingTask.destroy();
    return "ok";
  } catch (error) {
    return (error as { name?: unknown } | null)?.name === "PasswordException" ? "password" : "invalid";
  }
}

/** Collects normalised text up to `cap`, counting every normalised character offered after the cap as available. */
class CappedText {
  private text = "";
  private full = false;
  available = 0;

  constructor(private readonly cap: number) {}

  add(raw: string): void {
    const normalised = normaliseExtractedText(raw);
    this.available += normalised.length;
    if (this.full) return;
    const kept = capExtractedText(normalised, this.cap - this.text.length);
    this.text += kept;
    if (kept.length < normalised.length) this.full = true;
  }

  result(): { text: string; available: number } {
    return { text: this.text, available: this.available };
  }
}

async function pdfText(data: Uint8Array, cap: number): Promise<{ text: string; available: number }> {
  const pdf = await getDocumentProxy(data, { ...PDF_OPTIONS });
  try {
    const collected = new CappedText(cap);
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let pageText = "";
        for (const item of content.items) {
          if ("str" in item) pageText += item.str + (item.hasEOL ? "\n" : "");
        }
        collected.add(`${pageText}\n`);
      } finally {
        page.cleanup();
      }
    }
    return collected.result();
  } finally {
    // PDFDocumentProxy.destroy is not a function in unpdf 1.8.1; the loading task owns the document.
    await pdf.loadingTask.destroy();
  }
}

function sheetsText(sheets: readonly XlsxSheet[]): string {
  return sheets.map((sheet) => [
    `Sheet: ${sheet.name}`,
    ...sheet.rows.map((row) => {
      const cells = row.map(xlsxCellText);
      while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
      return cells.join("\t");
    }),
  ].join("\n")).join("\n\n");
}

/** UTF-16 after its byte order mark, else UTF-8 (a UTF-8 BOM is dropped); anything that does not decode throws. */
function decodeText(data: Uint8Array): string {
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(data.subarray(2));
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(data.subarray(2));
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

async function documentText(type: TextBearingType, data: Uint8Array): Promise<string> {
  switch (type) {
    case "docx":
      return docxText(readZipDirectory(data), data);
    case "pptx":
      return pptxText(readZipDirectory(data), data);
    case "xlsx":
      return sheetsText(await readWorkbookSheets(data));
    case "csv":
    case "txt":
      return decodeText(data);
    default:
      throw new TypeError("not a text-bearing type");
  }
}

/** A closed code for a failure: the error's own code when it has a CSRM one, never its message. */
function failureCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code)) return code;
  return "EXTRACTION_FAILED";
}

async function handle(request: ExtractionRequest): Promise<ExtractionReply> {
  const data = new Uint8Array(request.bytes);
  if (request.op === "probe-pdf") return { ok: true, kind: await probePdfBytes(data) };
  if (request.type === "pdf") return { ok: true, ...(await pdfText(data, request.cap)) };
  const collected = new CappedText(request.cap);
  collected.add(await documentText(request.type, data));
  return { ok: true, ...collected.result() };
}

const port = parentPort;
if (port) {
  handle(workerData as ExtractionRequest).then(
    (reply) => port.postMessage(reply),
    (error: unknown) => port.postMessage({ ok: false, code: failureCode(error) } satisfies ExtractionReply),
  );
}
