import type { ImportCell } from "./import-file";
import { stripNeutraliserMark } from "./neutralise";

/*
 * Value conversion for imports (19-03; D-28, D-29, docs/contract-gaps/phase-19-import-tolerance.md "Values"). One
 * cell becomes a value, a blank, a clear or an issue:
 *
 * - every cell is trimmed once; a workbook number in a text column is its text; a workbook boolean fills a flag;
 * - `#CLEAR`, in any case and as the whole trimmed cell, empties an optional field on an update, equals blank on a
 *   create, and is an issue on a required field;
 * - text loses the neutraliser's mark (its exact inverse, neutralise.ts), so an export, edit and import is lossless;
 * - flags accept Yes/No, Y/N and TRUE/FALSE in any case; enumerations match case-insensitively and return the
 *   canonical value; text longer than the column allows is an issue.
 *
 * VALUE_CONVERTERS is the interface Phase 18 extends with dates, scale labels, people and controls (D-29).
 */

export const CLEAR_TOKEN = "#CLEAR";

export type ImportValueKind = "text" | "flag" | "enum";
export type ImportMode = "create" | "update";

export interface ImportValueColumn {
  readonly field: string;
  readonly label: string;
  readonly kind: ImportValueKind;
  readonly required: boolean;
  readonly maxLength: number;
  /** The allowed values of an enumeration, in their canonical spelling. */
  readonly values?: readonly string[];
}

export type ImportValueIssueCode = "CLEAR_REQUIRED" | "INVALID_BOOLEAN" | "INVALID_ENUM" | "VALUE_TOO_LONG";

export type ConvertedCell =
  | { readonly kind: "value"; readonly value: string | boolean }
  | { readonly kind: "blank" }
  | { readonly kind: "clear" }
  | { readonly kind: "issue"; readonly code: ImportValueIssueCode; readonly message: string };

export interface ConvertContext {
  readonly mode: ImportMode;
}

/** One kind's converter: from the trimmed, unmarked, non-blank text of a cell. */
export type ValueConverter = (text: string, column: ImportValueColumn, context: ConvertContext) => ConvertedCell;

const LOCALE = "en-AU";
const TRUE_WORDS = new Set(["yes", "y", "true"]);
const FALSE_WORDS = new Set(["no", "n", "false"]);

function issue(code: ImportValueIssueCode, message: string): ConvertedCell {
  return { kind: "issue", code, message };
}

const convertText: ValueConverter = (text, column) => {
  if (text.length > column.maxLength) return issue("VALUE_TOO_LONG", `${column.label} must be at most ${column.maxLength} characters.`);
  return { kind: "value", value: text };
};

const convertFlag: ValueConverter = (text, column) => {
  const word = text.toLocaleLowerCase(LOCALE);
  if (TRUE_WORDS.has(word)) return { kind: "value", value: true };
  if (FALSE_WORDS.has(word)) return { kind: "value", value: false };
  return issue("INVALID_BOOLEAN", `${column.label} must be Yes or No. Y, N, TRUE and FALSE also work.`);
};

const convertEnum: ValueConverter = (text, column, context) => {
  const values = column.values ?? [];
  const wanted = text.toLocaleLowerCase(LOCALE);
  const canonical = values.find((candidate) => candidate.toLocaleLowerCase(LOCALE) === wanted);
  if (canonical === undefined) return issue("INVALID_ENUM", `${column.label} must be one of: ${values.join(", ")}.`);
  // The caller's own context (BE3-04): convertText reads only the length, which the canonical spelling already meets.
  return convertText(canonical, column, context);
};

/** The converters by column kind, frozen (D-29). */
export const VALUE_CONVERTERS: Readonly<Record<ImportValueKind, ValueConverter>> = Object.freeze({
  text: convertText,
  flag: convertFlag,
  enum: convertEnum,
});

/** One cell of one column, as the import reads it. */
export function convertCell(raw: ImportCell, column: ImportValueColumn, context: ConvertContext): ConvertedCell {
  if (raw === null) return { kind: "blank" };
  if (typeof raw === "boolean" && column.kind === "flag") return { kind: "value", value: raw };
  const typed = typeof raw === "boolean" ? (raw ? "TRUE" : "FALSE") : typeof raw === "number" ? String(raw) : raw;
  const trimmed = typed.trim();
  if (trimmed === "") return { kind: "blank" };
  if (trimmed.toLocaleUpperCase(LOCALE) === CLEAR_TOKEN) {
    if (column.required) return issue("CLEAR_REQUIRED", `${column.label} is required, so #CLEAR can’t empty it.`);
    return context.mode === "update" ? { kind: "clear" } : { kind: "blank" };
  }
  return VALUE_CONVERTERS[column.kind](stripNeutraliserMark(trimmed), column, context);
}
