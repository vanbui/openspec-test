import { sanitizeSpreadsheetCell } from "./neutralise";

/*
 * CSRM's one CSV writer (19-03; D-08, D-11, RFC 4180, OWASP CSV Injection). A UTF-8 byte order mark so Excel opens
 * the file as UTF-8, one header row and no title rows, CRLF line ends with a final CRLF, every header label and text
 * cell quoted with inner quotes doubled, every header label and text cell neutralised, numbers bare, calendar dates as
 * YYYY-MM-DD and an empty cell as an empty field.
 */

/** The UTF-8 byte order mark (EF BB BF). */
export const UTF8_BOM: Buffer = Buffer.from([0xef, 0xbb, 0xbf]);

export type CsvCell =
  | null
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "date"; readonly isoDate: string };

export interface CsvDocument {
  readonly header: readonly string[];
  readonly rows: readonly (readonly CsvCell[])[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CRLF = "\r\n";

function quote(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function field(cell: CsvCell): string {
  if (cell === null) return "";
  if (cell.kind === "text") return quote(sanitizeSpreadsheetCell(cell.value));
  if (cell.kind === "number") {
    if (!Number.isFinite(cell.value)) throw new RangeError("a CSV number cell must be finite");
    return String(cell.value);
  }
  if (!ISO_DATE.test(cell.isoDate)) throw new RangeError("a CSV date cell must be YYYY-MM-DD");
  return cell.isoDate;
}

/** The whole file, BOM first. */
export function writeCsv(document: CsvDocument): Buffer {
  // The header row is neutralised like a text cell (BE1-05): a caller may build a label from a file it read.
  const header = document.header.map((label) => quote(sanitizeSpreadsheetCell(label)));
  const lines = [header.join(","), ...document.rows.map((row) => row.map(field).join(","))];
  return Buffer.concat([UTF8_BOM, Buffer.from(lines.join(CRLF) + CRLF, "utf8")]);
}
