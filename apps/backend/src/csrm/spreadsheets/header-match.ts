import { boundImportTexts, ImportFileRefusal } from "./import-file";

/*
 * Header matching for imports (19-03; D-27, docs/contract-gaps/phase-19-import-tolerance.md "Headers"). A header
 * matches a column when its key equals the key of the column's API field name, its display label (the template's
 * header) or an alias, where the key ignores case, surrounding and inner spaces, underscores, hyphens and character
 * width. Unknown headers are ignored with a warning naming them as typed; the error report's `Issues` column and a
 * reference export's read-only columns are ignored with a note instead. Two headers for one column, or a missing
 * required column, refuse the file.
 */

export interface ImportColumnHeader {
  readonly field: string;
  readonly label: string;
  readonly required: boolean;
  /** Other headers this column answers to. No aliases are proposed in Phase 19 (D-27). */
  readonly aliases?: readonly string[];
}

export type ImportNoteCode = "issues-column" | "read-only-columns";

export interface HeaderMatch {
  /** For each header in file order, the field it fills, or null when it is ignored. */
  readonly mapping: readonly (string | null)[];
  /** Unknown headers as typed, in file order (at most 50, controls removed, at most 200 characters each). */
  readonly warnings: readonly string[];
  readonly notes: readonly ImportNoteCode[];
}

export interface KnownIgnoredHeaders {
  readonly issuesHeader: "Issues";
  readonly readOnlyLabels: readonly string[];
}

/** The most warnings a preview carries (phase-19-import-tolerance.md "Headers"). */
export const HEADER_WARNINGS_MAX = 50;
export const HEADER_WARNING_MAX_LENGTH = 200;

/** The comparison key of a header, a field name or a label. */
export function headerKey(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-AU").replace(/[\s_-]+/gu, "");
}

export function matchHeaders(
  headers: readonly string[],
  columns: readonly ImportColumnHeader[],
  options: { readonly knownIgnored?: KnownIgnoredHeaders } = {},
): HeaderMatch {
  const knownIgnored: KnownIgnoredHeaders = options.knownIgnored ?? { issuesHeader: "Issues", readOnlyLabels: [] };
  const byKey = new Map<string, ImportColumnHeader>();
  for (const column of columns) {
    for (const name of [column.field, column.label, ...(column.aliases ?? [])]) {
      const key = headerKey(name);
      if (key !== "" && !byKey.has(key)) byKey.set(key, column);
    }
  }
  const issuesKey = headerKey(knownIgnored.issuesHeader);
  const readOnlyKeys = new Set(knownIgnored.readOnlyLabels.map(headerKey));

  const mapping: (string | null)[] = [];
  const warnings: string[] = [];
  const notes: ImportNoteCode[] = [];
  const firstHeaderFor = new Map<string, string>();
  const note = (code: ImportNoteCode): void => {
    if (!notes.includes(code)) notes.push(code);
  };

  for (const header of headers) {
    const key = headerKey(header);
    const column = key === "" ? undefined : byKey.get(key);
    if (column) {
      const earlier = firstHeaderFor.get(column.field);
      if (earlier !== undefined) {
        throw new ImportFileRefusal("IMPORT_DUPLICATE_HEADER", { headers: [earlier, header], labels: [column.label] });
      }
      firstHeaderFor.set(column.field, header);
      mapping.push(column.field);
      continue;
    }
    mapping.push(null);
    if (key === "") continue;
    if (key === issuesKey) note("issues-column");
    else if (readOnlyKeys.has(key)) note("read-only-columns");
    else warnings.push(header);
  }

  const missing = columns.filter((column) => column.required && !firstHeaderFor.has(column.field)).map((column) => column.label);
  if (missing.length > 0) throw new ImportFileRefusal("IMPORT_MISSING_COLUMN", { labels: missing });

  return { mapping, warnings: boundImportTexts(warnings, HEADER_WARNINGS_MAX, HEADER_WARNING_MAX_LENGTH), notes };
}
