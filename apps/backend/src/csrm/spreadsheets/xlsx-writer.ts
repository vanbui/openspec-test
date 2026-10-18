import writeXlsxFile from "write-excel-file/node";
import type { Cell, Sheet } from "write-excel-file/node";

import { sanitizeSpreadsheetCell } from "./neutralise";

/*
 * CSRM's one XLSX writer (19-03; D-08, D-11, D-12). It is the only module that names write-excel-file, so the
 * library stays behind this interface and can be replaced without touching a caller.
 *
 * Every cell is typed: text is a string cell in the `@` (text) format, neutralised like a CSV cell; numbers are number
 * cells; dates are date cells in `d mmm yyyy`. No cell is ever written as a formula: the library writes a formula
 * only for an explicit `type: "Formula"`, which this module never passes. The header row is bold and frozen, and each
 * column takes its width.
 *
 * A date cell is the UTC midnight of a calendar date (19-RESEARCH Pitfall 5): the library writes a date's serial from
 * its UTC time, so a local midnight would shift a day.
 */

/** The longest sheet name Excel accepts. */
export const XLSX_SHEET_NAME_MAX = 31;

/**
 * The most characters one text cell may hold, as written (the neutraliser's mark included): Excel's specification limit.
 * Excel cuts a longer cell when it opens the file, so the writer refuses one (a RangeError) rather than hand Excel a
 * value it would cut silently (the Phase 19 review amendment, 2026-10-17, BE1-02). The export pipeline refuses such an
 * export earlier, with EXPORT_CELL_TOO_LONG.
 */
export const XLSX_CELL_MAX_LENGTH = 32_767;

/** A neutralised text cell's value, or a RangeError when it is longer than XLSX_CELL_MAX_LENGTH. */
function textValue(value: string): string {
  const written = sanitizeSpreadsheetCell(value);
  if (written.length > XLSX_CELL_MAX_LENGTH) throw new RangeError(`a workbook text cell holds at most ${XLSX_CELL_MAX_LENGTH} characters`);
  return written;
}

export type SheetCell =
  | null
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "date"; readonly value: Date };

export interface WorkbookSheet {
  readonly name: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly SheetCell[])[];
  /** Column widths in characters, one per header column. */
  readonly widths: readonly number[];
}

const TEXT_FORMAT = "@";
const DATE_FORMAT = "d mmm yyyy";
const FORBIDDEN_IN_SHEET_NAME = /[\\/?*[\]:]/g;

/** A name Excel accepts: none of `\ / ? * [ ] :`, no leading or trailing quote, at most 31 characters, never empty. */
export function safeSheetName(name: string): string {
  let safe = name.replace(FORBIDDEN_IN_SHEET_NAME, "").trim().replace(/^'+|'+$/g, "");
  if (safe.length > XLSX_SHEET_NAME_MAX) {
    safe = safe.slice(0, XLSX_SHEET_NAME_MAX);
    // Never leave half of a surrogate pair at the cut.
    if (/[\uD800-\uDBFF]$/.test(safe)) safe = safe.slice(0, -1);
    safe = safe.trimEnd();
  }
  return safe === "" ? "Sheet" : safe;
}

function cell(value: SheetCell): Cell {
  if (value === null) return null;
  if (value.kind === "text") return { value: textValue(value.value), type: String, format: TEXT_FORMAT };
  if (value.kind === "number") {
    if (!Number.isFinite(value.value)) throw new RangeError("a workbook number cell must be finite");
    return { value: value.value, type: Number };
  }
  if (Number.isNaN(value.value.getTime())) throw new RangeError("a workbook date cell must be a valid date");
  return { value: value.value, type: Date, format: DATE_FORMAT };
}

/** The workbook's bytes: one sheet per entry, in order. */
export async function writeWorkbook(sheets: readonly WorkbookSheet[]): Promise<Buffer> {
  if (sheets.length === 0) throw new RangeError("a workbook needs at least one sheet");
  const names = new Set<string>();
  const input: Sheet<Buffer>[] = sheets.map((sheet) => {
    const name = safeSheetName(sheet.name);
    const key = name.toLocaleLowerCase("en-AU");
    if (names.has(key)) throw new RangeError(`two sheets are named ${name}`);
    names.add(key);
    return {
      sheet: name,
      stickyRowsCount: 1,
      columns: sheet.widths.map((width) => ({ width })),
      data: [
        // The header row is a neutralised text cell too (BE1-05): a caller may build a label from a file it read.
        sheet.header.map((label): Cell => ({ value: textValue(label), type: String, format: TEXT_FORMAT, fontWeight: "bold" })),
        ...sheet.rows.map((row) => row.map(cell)),
      ],
    };
  });
  return writeXlsxFile(input).toBuffer();
}
