/*
 * The browser's only check of an import file (Phase 19 D-25; 19-UI-SPEC §5.2, §5.4): its extension (.csv or .xlsx, in
 * any case) and its size (at most 5 MB, 5,242,880 bytes). The browser never reads the file: Strapi is the one parser, and
 * it checks the encoding, the delimiter, the headers, the rows and the record caps again for every upload (T-19-52).
 * This check only spares a person the upload of a file Strapi would refuse anyway, and S2 words its two refusals.
 *
 * Plain TypeScript with no directive, no zod and no CSV library, so the client flow imports it without either.
 */

/** The largest import file, in bytes: Strapi's import limit (`AdministrationImportLimits.maxBytes`). */
export const IMPORT_FILE_MAX_BYTES = 5_242_880;

/** The two extensions an import accepts, as the file field's `accept` names them. */
export const IMPORT_FILE_EXTENSIONS = ['.csv', '.xlsx'] as const;

export type BrowserImportFileCheck =
  | { ok: true }
  | { ok: false; reason: 'IMPORT_FILE_TYPE' | 'IMPORT_FILE_TOO_LARGE' };

/** Whether a chosen file may be uploaded: a `.csv` or `.xlsx` name, then a size within the limit. */
export function checkImportFileInBrowser(file: Pick<File, 'name' | 'size'>): BrowserImportFileCheck {
  const name = file.name.toLowerCase();
  const named = IMPORT_FILE_EXTENSIONS.some((extension) => name.endsWith(extension) && name.length > extension.length);
  if (!named) return { ok: false, reason: 'IMPORT_FILE_TYPE' };
  if (file.size > IMPORT_FILE_MAX_BYTES) return { ok: false, reason: 'IMPORT_FILE_TOO_LARGE' };
  return { ok: true };
}
