import 'server-only';
import createClient, { type Client } from 'openapi-fetch';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import {
  developmentFixtureIdentityForRole,
  getSessionAdapter,
} from '@/lib/auth/development-session-adapter';
import { ATTACHMENT_DETECTION_PATTERN, isConflictReason, type ConflictReason } from '../conflict-reasons';
import type { paths } from '../generated/schema';

export type StrapiClient = Client<paths>;

/**
 * What a refused import file was found to hold (Phase 19 D-26, D-27): the file's own headers and the display labels the
 * refusal concerns (at most 20 strings of at most 200 characters), the separator it used in place of a comma, and the
 * rows or bytes it held, and for a CSV the parser cannot read, the line it failed on. Closed and bounded as the contract
 * publishes it; never a cell value.
 */
export type ImportRefusalFound = {
  readonly headers?: readonly string[];
  readonly labels?: readonly string[];
  readonly delimiter?: 'semicolon' | 'tab';
  readonly rows?: number;
  readonly bytes?: number;
  /** The 1-based source line a CSV failed to parse on; kept beside IMPORT_CSV_MALFORMED only (the import record's 2026-10-17 amendment). */
  readonly line?: number;
};

export type TransportError = {
  message: string;
  status?: number;
  /** The closed-list rule a refusal named (see normalizeTransportError); absent for any other failure or an unknown value. */
  reason?: ConflictReason;
  /** The scanner's name for the malware a 422 ATTACHMENT_MALWARE_FOUND found, only when it matches the contract's pattern. */
  detection?: string;
  /** The rows a refused export would hold, beside a 422 EXPORT_ROW_LIMIT only, as a non-negative safe integer. */
  rowCount?: number;
  /** The most rows one export may hold, beside a 422 EXPORT_ROW_LIMIT only, as a non-negative safe integer. */
  rowCap?: number;
  /** The export vocabulary key of the first column with a cell too long for Excel, beside a 422 EXPORT_CELL_TOO_LONG only. */
  column?: string;
  /** The most characters one xlsx text cell may hold, beside a 422 EXPORT_CELL_TOO_LONG only, as a non-negative safe integer. */
  cellLimit?: number;
  /** What a refused import file held, beside an IMPORT_ reason only, closed and bounded, its strings cleaned of controls. */
  found?: ImportRefusalFound;
  kind?: 'response-contract-mismatch';
  operation?: string;
};
export type TransportResult<T> = { data: T; error: null } | { data: null; error: TransportError };

const configurationErrorMessage = 'CSRM API configuration is invalid.';

function parseStrapiRestBase(value: string | undefined): string {
  if (!value) {
    throw new Error(configurationErrorMessage);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(configurationErrorMessage);
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(configurationErrorMessage);
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '/api' && !pathname.endsWith('/api')) {
    throw new Error(configurationErrorMessage);
  }

  return `${url.origin}${pathname}`;
}

async function developmentIdentityHeader(): Promise<Record<string, string> | undefined> {
  if (!developmentIdentityBridgeEnabled()) {
    return undefined;
  }

  const session = await getSessionAdapter().current();
  const identity = session?.developmentRole
    ? developmentFixtureIdentityForRole(session.developmentRole)
    : null;

  return identity ? { 'x-csrm-dev-identity': identity } : undefined;
}

/**
 * The identity bridge exists only where the development session does (next dev,
 * or a production build inside the attested E2E runtime) and only when the
 * operator switched it on. The resolver already demands the flag under a
 * production build; the explicit conjunct keeps next dev silent without it.
 */
function developmentIdentityBridgeEnabled(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'development' && process.env.CSRM_DEV_IDENTITY === 'true';
}

/**
 * In OIDC mode the caller's own Keycloak access token goes to Strapi in its own
 * header, which Strapi verifies against the realm JWKS and maps to an IdamBox User
 * (docs/adr/0004). `Authorization` stays with the API token below. No session, no
 * token: the call carries no identity and Strapi refuses it.
 */
async function oidcIdentityHeader(): Promise<Record<string, string> | undefined> {
  if (!oidcIdentityEnabled()) {
    return undefined;
  }

  const token = await getSessionAdapter().identityToken();
  return token ? { 'x-csrm-identity-token': token } : undefined;
}

function oidcIdentityEnabled(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'oidc';
}

function apiTokenHeader(required: boolean): Record<string, string> | undefined {
  // Optional Strapi API token (admin panel > Settings > API Tokens). When
  // configured it hardens the outer users-permissions gate; the identity
  // header and the IdamBox authorization policy remain the per-user authority.
  // Either identity path requires it, because every CSRM route sits behind it.
  const token = process.env.CSRM_API_TOKEN?.trim();
  if (required && !token) {
    throw new Error(configurationErrorMessage);
  }
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

export async function createStrapiClient(): Promise<StrapiClient> {
  const baseUrl = parseStrapiRestBase(process.env.CSRM_API_BASE_URL);
  const token = apiTokenHeader(developmentIdentityBridgeEnabled() || oidcIdentityEnabled());
  const identity = (await developmentIdentityHeader()) ?? (await oidcIdentityHeader());
  const headers = identity || token ? { ...token, ...identity } : undefined;

  return createClient<paths>({ baseUrl, ...(headers ? { headers } : {}) });
}

/**
 * The statuses a closed-list reason crosses on. Phase 10 kept the reason on a 409 and Phase 13 on a 403 (an
 * identity-relative refusal such as OWN_REQUEST, 2026-10-01 confirmation); Phase 14's refusals use 400, 413, 415 and
 * 422 as well (D-11; 14-RESEARCH Settled 8). A 404 is not here: it is the refusal a missing record gets, so it never
 * names a rule (D-18, IN-601), and a reason a 404 carried would turn "no longer available" into a sentence that
 * confirms the record.
 */
const reasonStatuses: ReadonlySet<number> = new Set([400, 403, 409, 413, 415, 422]);

/** The one reason a 5xx carries (the stage B amendment, WR-204): a full queue, refused at once and retryable. */
const retryableReason: ConflictReason = 'ATTACHMENT_BUSY';

/**
 * The error body is untrusted: only a refusal's reason crosses, and only when it is in the closed
 * list (D-22, T-10-14). The served message, name and every other detail stay behind, so the
 * application shows its own copy. The reason is kept on the refusal statuses above, and on a 503
 * only when it is ATTACHMENT_BUSY, so that sentence is shown; a 404, any other 5xx, a missing
 * status and a thrown error carry none, and a 503 without that reason stays the generic retryable 5xx.
 *
 * Beside ATTACHMENT_MALWARE_FOUND alone, the scanner's detection name crosses too, and only when it
 * matches the contract's pattern, so it is safe to show as data (Orchestrator Confirmations, T-14-17).
 *
 * Beside EXPORT_ROW_LIMIT alone, the rows the export would hold and the cap cross too, each only as a non-negative
 * safe integer, so the dialog can say the count (Phase 19 D-16, D-17; T-19-03). Beside an IMPORT_ reason alone, what
 * the file was found to hold crosses, only when it passes isImportRefusalFound, with its strings cleaned of C0 and C1
 * controls and bidirectional overrides, so the fix-it copy can name it as text (D-26, D-27; T-19-03, T-19-04). Its
 * `line`, a positive integer, crosses beside IMPORT_CSV_MALFORMED alone (the import record's 2026-10-17 amendment).
 *
 * Beside EXPORT_CELL_TOO_LONG alone, the column's export vocabulary key crosses, only when it matches the contract's
 * pattern, so it is a closed key and never a value, and the cell limit as a non-negative safe integer (the exports
 * record's code review amendment, 2026-10-17).
 */
export function normalizeTransportError(error: unknown, status?: number): TransportResult<never> {
  const details = status !== undefined && (reasonStatuses.has(status) || status === 503) ? servedDetails(error) : undefined;
  const servedReason = details?.reason;
  const listed = isConflictReason(servedReason) ? servedReason : undefined;
  const reason = status === 503 ? (listed === retryableReason ? listed : undefined) : listed;
  const detection = reason === 'ATTACHMENT_MALWARE_FOUND' ? servedDetection(details?.detection) : undefined;
  const rowCount = reason === 'EXPORT_ROW_LIMIT' ? servedCount(details?.rowCount) : undefined;
  const rowCap = reason === 'EXPORT_ROW_LIMIT' ? servedCount(details?.rowCap) : undefined;
  const column = reason === 'EXPORT_CELL_TOO_LONG' ? servedColumnKey(details?.column) : undefined;
  const cellLimit = reason === 'EXPORT_CELL_TOO_LONG' ? servedCount(details?.cellLimit) : undefined;
  const found = reason?.startsWith('IMPORT_') ? servedFound(details?.found, reason === 'IMPORT_CSV_MALFORMED') : undefined;
  return {
    data: null,
    error: {
      message: 'The CSRM service is unavailable. Please try again later.',
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
      ...(detection ? { detection } : {}),
      ...(rowCount !== undefined ? { rowCount } : {}),
      ...(rowCap !== undefined ? { rowCap } : {}),
      ...(column !== undefined ? { column } : {}),
      ...(cellLimit !== undefined ? { cellLimit } : {}),
      ...(found ? { found } : {}),
    },
  };
}

/** The contract's pattern for an export column key: a closed vocabulary key, never a value. */
const COLUMN_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,63}$/;

/** A column key a refusal serves, only when it is one, or nothing. */
function servedColumnKey(value: unknown): string | undefined {
  return typeof value === 'string' && COLUMN_KEY.test(value) ? value : undefined;
}

/** A count a refusal serves: a non-negative safe integer, or nothing. */
function servedCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

const FOUND_KEYS: ReadonlySet<string> = new Set(['headers', 'labels', 'delimiter', 'rows', 'bytes', 'line']);
const FOUND_MAX_STRINGS = 20;
const FOUND_MAX_LENGTH = 200;

const isCount = (value: unknown): boolean => servedCount(value) !== undefined;

/** At most 20 strings of at most 200 characters each, counted as the contract counts them (code points). */
function isBoundedStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.length <= FOUND_MAX_STRINGS
    && value.every((item) => typeof item === 'string' && [...item].length <= FOUND_MAX_LENGTH);
}

/**
 * True only for the closed `found` object the contract publishes beside an IMPORT_ reason: no key outside headers,
 * labels, delimiter, rows, bytes and line, each within its published bounds (a line is a positive safe integer).
 */
export function isImportRefusalFound(value: unknown): value is ImportRefusalFound {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).every((key) => FOUND_KEYS.has(key))
    && (value.headers === undefined || isBoundedStringList(value.headers))
    && (value.labels === undefined || isBoundedStringList(value.labels))
    && (value.delimiter === undefined || value.delimiter === 'semicolon' || value.delimiter === 'tab')
    && (value.rows === undefined || isCount(value.rows))
    && (value.bytes === undefined || isCount(value.bytes))
    && (value.line === undefined || (isCount(value.line) && (value.line as number) > 0));
}

/*
 * FE4-10: what the attachment name rule removes (file-response.ts IN-403), so a header or label is safe to show as text:
 * a control (\p{Cc}: C0, DEL and C1), a format character (\p{Cf}: the bidirectional marks, embeddings, overrides and
 * isolates, the zero-width and joining characters, the soft hyphen, the byte order mark and the tags), or a line or
 * paragraph separator (\p{Zl}, \p{Zp}). Written with escapes only, so no invisible character in this source can be lost.
 */
const unsafeCharacters = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

const cleaned = (list: readonly string[]): readonly string[] => list.map((item) => item.replace(unsafeCharacters, ''));

function servedFound(value: unknown, keepsLine: boolean): ImportRefusalFound | undefined {
  if (!isImportRefusalFound(value)) return undefined;
  const found: ImportRefusalFound = {
    ...(value.headers ? { headers: cleaned(value.headers) } : {}),
    ...(value.labels ? { labels: cleaned(value.labels) } : {}),
    ...(value.delimiter ? { delimiter: value.delimiter } : {}),
    ...(value.rows !== undefined ? { rows: value.rows } : {}),
    ...(value.bytes !== undefined ? { bytes: value.bytes } : {}),
    ...(keepsLine && value.line !== undefined ? { line: value.line } : {}),
  };
  return Object.keys(found).length > 0 ? found : undefined;
}

function servedDetails(body: unknown): Record<string, unknown> | undefined {
  const error = isPlainObject(body) ? body.error : undefined;
  const details = isPlainObject(error) ? error.details : undefined;
  return isPlainObject(details) ? details : undefined;
}

function servedDetection(value: unknown): string | undefined {
  return typeof value === 'string' && ATTACHMENT_DETECTION_PATTERN.test(value) ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deliberately exposes only a stable local diagnostic identifier, never parser input or internals. */
export function normalizeResponseParserError(operation: string): TransportResult<never> {
  return {
    data: null,
    error: process.env.NODE_ENV === 'development'
      ? { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation }
      : { message: 'The CSRM service is unavailable. Please try again later.' },
  };
}
