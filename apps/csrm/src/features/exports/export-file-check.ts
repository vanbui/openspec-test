import 'server-only';

import { normalizeTransportError, type TransportError } from '@/lib/api/transport/server-client';
import {
  EXPORT_RESPONSE_CONTENT_TYPES,
  exportFileRule,
  validateFileResponse,
  type ExportFileFormat,
  type FileResponseFailure,
} from '@/lib/files/file-response';

/*
 * The one check every export service applies to what Strapi sent (Phase 19 D-19): a refusal becomes the transport
 * error with its closed reason; a file must pass the shared validator's export rule (type, the server's name, size and
 * signature) and carry a row count, or its bytes are dropped. Each service calls its own generated path with
 * `parseAs: 'arrayBuffer'` and hands the result here.
 */

/** An export file the shared validator accepted, with the rows the server says it holds. */
export type ExportedFile = { fileName: string; contentType: string; bytes: Uint8Array; rowCount: number };

/** A file Strapi sent that the web refused: a failed validator check, or a row count that is not one (its bytes are dropped). */
export type ExportFileCheckError = { kind: 'file-check'; failure: FileResponseFailure | 'row-count' };

export type ExportResult =
  | { data: ExportedFile; error: null }
  | { data: null; error: TransportError | ExportFileCheckError };

/** The two media types every export 200 declares, as the parity guard's file-response registrations name them. */
export const EXPORT_FILE_CONTENT_TYPES: readonly string[] = Object.values(EXPORT_RESPONSE_CONTENT_TYPES);

/** The most rows one export holds (D-17); `EXPORT_ROW_CAP` in Strapi's run-export.ts. */
const EXPORT_ROW_COUNT_MAX = 10_000;

/** `X-CSRM-Row-Count`: a whole number from 0 to 10,000 written in digits, else null. */
function parseExportRowCount(header: string | null): number | null {
  if (header === null || !/^[0-9]{1,5}$/.test(header)) return null;
  const count = Number(header);
  return count <= EXPORT_ROW_COUNT_MAX ? count : null;
}

/** A list export's own parameters (D-03): the format, the columns when chosen, and the viewer's zone when known. */
export type ListExportOptions = { format: ExportFileFormat; columns?: readonly string[]; timeZone?: string };

/** The format, the comma-joined columns and the zone, each sent only when given. */
export function listExportParams({ columns, format, timeZone }: ListExportOptions) {
  return {
    format,
    ...(columns && columns.length > 0 ? { columns: columns.join(',') } : {}),
    ...(timeZone ? { timeZone } : {}),
  };
}

/** What the generated client returns for a binary parse. */
type BinaryResponse = {
  data?: ArrayBuffer;
  error?: unknown;
  response: { status: number; headers: Headers };
};

/** The checked file, or the refusal: the transport error, or the check the bytes failed. */
export function checkExportResponse({ data, error, response }: BinaryResponse, format: ExportFileFormat): ExportResult {
  if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
  const checked = validateFileResponse({
    contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'),
    bytes: new Uint8Array(data),
  }, exportFileRule(format));
  if (!checked.ok) return { data: null, error: { kind: 'file-check', failure: checked.failure } };
  const rowCount = parseExportRowCount(response.headers.get('x-csrm-row-count'));
  if (rowCount === null) return { data: null, error: { kind: 'file-check', failure: 'row-count' } };
  return { data: { fileName: checked.fileName, contentType: checked.contentType, bytes: checked.bytes, rowCount }, error: null };
}
