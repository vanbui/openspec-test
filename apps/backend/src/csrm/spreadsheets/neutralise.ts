/*
 * CSRM's one spreadsheet neutraliser (19-03; D-11, OWASP CSV Injection, 19-RESEARCH Pitfall 9). Every text cell CSRM
 * writes to a CSV or a workbook passes through sanitizeSpreadsheetCell, and every text cell an import reads passes
 * through stripNeutraliserMark, its exact inverse: stripNeutraliserMark(sanitizeSpreadsheetCell(v)) === v for every v.
 *
 * A value needs the mark when a spreadsheet program could take it for a formula: it starts with =, +, -, @, a tab, a
 * carriage return or a line feed, or one of their full-width forms, or with whitespace before one of those signs.
 * A value that starts with a run of single quotes before such a trigger is marked too: otherwise `'=x` would leave
 * unmarked and come back as `=x`. An invisible control, format or non-character before a trigger does not hide it
 * (see INVISIBLE). Numbers and dates are typed cells, never text, and are never marked.
 */

/** The mark: one leading single quote, which spreadsheet programs read as "this cell is text". */
export const NEUTRALISER_MARK = "'";

/** A formula trigger, optionally after a run of single quotes (moved from csv-import.ts, with the quote run added). */
const NEEDS_MARK = /^'*(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u;

/*
 * The invisible characters a spreadsheet may drop or ignore (BE1-01, Phase 19 code review): the C0 controls other
 * than tab, line feed and carriage return (which are triggers themselves), DEL and the C1 controls, format characters
 * (zero-width and bidi marks), lone surrogates, non-characters and U+FFFD. write-excel-file removes the controls,
 * U+FFFD, lone surrogates and non-characters from every text node, so `\u0001=x` would reach the workbook as `=x`.
 * The neutraliser therefore also decides on the value with these removed: a value whose trigger is hidden behind
 * them is marked. The value itself is never changed here, so stripNeutraliserMark stays its exact inverse.
 */
const INVISIBLE = /[\0-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\p{Cf}\p{Cs}\p{Noncharacter_Code_Point}�]/gu;

/** True exactly when a text value must carry the mark before it reaches a spreadsheet. */
export function needsNeutraliser(value: string): boolean {
  return NEEDS_MARK.test(value) || NEEDS_MARK.test(value.replace(INVISIBLE, ""));
}

/** The value as a spreadsheet must receive it: with one leading single quote when it needs the mark, else unchanged. */
export function sanitizeSpreadsheetCell(value: string): string {
  return needsNeutraliser(value) ? `${NEUTRALISER_MARK}${value}` : value;
}

/**
 * The value as it was before sanitizeSpreadsheetCell: one leading single quote is removed only when what follows it
 * needs the mark (so the quote can only have been added by the neutraliser), else the value is returned unchanged.
 */
export function stripNeutraliserMark(value: string): string {
  if (!value.startsWith(NEUTRALISER_MARK)) return value;
  const rest = value.slice(NEUTRALISER_MARK.length);
  return needsNeutraliser(rest) ? rest : value;
}
