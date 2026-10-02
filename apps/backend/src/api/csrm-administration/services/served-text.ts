/*
 * Stored text served within its contract bound. No valid write stores a value beyond its bound: the
 * Administration create and update refuse one with a 400, and the CSV import rejects the row. A longer stored
 * value is therefore a data defect, and a read must still serve a contract-valid record, because the web's
 * closed parsers refuse a whole page for one field beyond its bound. The value is cut at the last word
 * boundary inside the bound and closed with an ellipsis, so the shortening is visible, never silent, and the
 * caller logs a warning that names the record, never its text.
 */
export function boundServedText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength - 1);
  // Never end on half of a surrogate pair: the bound counts UTF-16 code units, like the parsers.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  if (!/\s/.test(text.charAt(cut.length))) {
    const boundary = cut.search(/\s\S*$/);
    if (boundary > 0) cut = cut.slice(0, boundary);
  }
  return `${cut.trimEnd()}…`;
}

/** Logs that a read served stored text shortened. It names the record and the fields, never the text. */
export function warnServedTextBounded(record: string, fields: readonly string[]): void {
  globalThis.strapi?.log?.warn?.(
    `${record} has stored ${fields.join(", ")} beyond the contract bound; the read served it shortened. Correct the stored record.`,
  );
}
