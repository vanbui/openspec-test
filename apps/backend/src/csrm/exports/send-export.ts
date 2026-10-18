import { isUtcDate } from "../insights/utc-date";
import { sendStoredFile, type DownloadContext } from "../files/send-stored-file";
import { ExportForbiddenError, ExportQueryError, ExportRefusalError } from "./export-errors";

/*
 * The export file response (19-04; D-10, D-37; phase-19-exports-and-export-log.md, "File Responses"). A 200 is the
 * file through 14-07's sendStoredFile: an attachment, never sniffed, cached or rendered, with exactly one of the two
 * media types below and the row count the web's toast reads.
 */

/**
 * The one definition of the two export media types. sendStoredFile sets them with ctx.set, so the response's
 * Content-Type is exactly these strings; 19-05 declares them in the specification and 19-06's validator accepts
 * exactly them (19-PLAN-CHECK lane B W2).
 */
export const EXPORT_MEDIA_TYPES = Object.freeze({
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const);

export type ExportFileFormat = keyof typeof EXPORT_MEDIA_TYPES;

const FILE_NAME = /^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$/;

/** `{slug}-{YYYY-MM-DD}.{format}` (19-UI-SPEC §3.2); any name outside the safe pattern is refused. */
export function exportFileName(input: { slug: string; localDate: string; format: ExportFileFormat }): string {
  if (!isUtcDate(input.localDate)) throw new RangeError("an export file name needs a YYYY-MM-DD date");
  const name = `${input.slug}-${input.localDate}.${input.format}`;
  if (!FILE_NAME.test(name) || !(input.format in EXPORT_MEDIA_TYPES)) throw new RangeError("an export file name must be a lower-case slug, a date and csv or xlsx");
  return name;
}

/** Sends an export as a download, with `X-CSRM-Row-Count`, the data rows it holds. */
export function sendExportFile(
  ctx: DownloadContext,
  file: { readonly fileName: string; readonly format: ExportFileFormat; readonly bytes: Buffer; readonly rowCount: number },
): void {
  sendStoredFile(ctx, { fileName: file.fileName, mediaType: EXPORT_MEDIA_TYPES[file.format], bytes: file.bytes });
  ctx.set("X-CSRM-Row-Count", String(file.rowCount));
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const IDENTIFIER = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * The person exporting, for the log and the About sheet: the resolved IdamBox User's documentId and display name. No
 * resolved identity is a 403, whatever the authentication mode (the policy resolved it already; this never branches
 * on how).
 */
export async function resolveExportActor(strapi: unknown, state: unknown): Promise<{ documentId: string; displayName: string }> {
  const identity = isRecord(state) && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  const documentId = identity?.documentId;
  if (typeof documentId !== "string" || !IDENTIFIER.test(documentId)) throw new ExportForbiddenError();
  if (!isRecord(strapi) || typeof strapi.documents !== "function") throw new ExportForbiddenError();
  const users = (strapi.documents as (uid: string) => { findOne: (query: RecordValue) => Promise<RecordValue | null> })("api::idambox-user.idambox-user");
  const user = await users.findOne({ documentId, fields: ["displayName"] });
  if (!user || typeof user.displayName !== "string") throw new ExportForbiddenError();
  return { documentId, displayName: user.displayName };
}

/** The part of Koa's context an error response writes. */
export type ExportErrorContext = { status: number; body: unknown };

/**
 * Writes an export refusal in the AssessmentWorkflowErrorResponse envelope and returns true: an invalid query is a 400
 * with a safe message and no reason; a closed refusal carries `details.reason` (and the row limit its count and cap);
 * a missing identity is a 403. Any other error returns false, so the controller rethrows it.
 */
export function sendExportError(ctx: ExportErrorContext, error: unknown): boolean {
  if (error instanceof ExportQueryError || error instanceof ExportForbiddenError) {
    ctx.status = error.status;
    ctx.body = { data: null, error: { status: error.status, name: error.name, message: error.message } };
    return true;
  }
  if (error instanceof ExportRefusalError) {
    const details = {
      reason: error.reason,
      ...(error.rowCount !== undefined ? { rowCount: error.rowCount } : {}),
      ...(error.rowCap !== undefined ? { rowCap: error.rowCap } : {}),
      ...(error.column !== undefined ? { column: error.column } : {}),
      ...(error.cellLimit !== undefined ? { cellLimit: error.cellLimit } : {}),
    };
    ctx.status = error.status;
    ctx.body = { data: null, error: { status: error.status, name: error.name, message: error.message, details } };
    return true;
  }
  return false;
}
