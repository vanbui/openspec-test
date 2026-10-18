import { ATTACHMENT_DETECTION_PATTERN, type AttachmentType } from "../files/attachment-policy";

/*
 * The security event log (14-03; D-37; ISO/IEC 27001:2022 Annex A 8.15 and 8.16). One structured line per event
 * through Strapi's logger: a stable prefix and event name, then JSON with its keys in a fixed order, so the
 * deployment's log platform can parse, index and alert on it. Malware, blocked and integrity events log at warning
 * level, which the platform alerts on.
 *
 * A line never carries a file's name, content or extracted text: the event type has no such field, and the line is
 * built from an allow-list of fields, so an extra property a caller passes is dropped. Reasons and detections must be
 * closed codes; anything else is replaced. The actor's display name is personal data, so the deployment's log policy
 * treats these lines as such (R-08-13).
 *
 * Phase 19 adds its export and import members and Phase 17 its people-search member to `SecurityEvent`, here.
 */

export const SECURITY_EVENT_SCHEMA_VERSION = 1;

export const SECURITY_EVENT_PREFIX = "csrm.security_event";

export const ATTACHMENT_SECURITY_EVENT_NAMES = [
  "attachment.uploaded",
  "attachment.refused",
  "attachment.quarantined",
  "attachment.scan_verdict",
  "attachment.blocked",
  "attachment.downloaded",
  "attachment.integrity_failed",
  "attachment.removed",
  "attachment.restored",
  "attachment.ai_inclusion_changed",
  // WR-101: a withdrawal or a verdict made without its record in the attachment's own history (full or malformed).
  "attachment.history_unavailable",
] as const;

export type AttachmentSecurityEventName = (typeof ATTACHMENT_SECURITY_EVENT_NAMES)[number];

/** A person, by IdamBox User `documentId` and display name, or the in-process re-scan. */
export type SecurityEventActor = { readonly documentId: string; readonly displayName: string } | { readonly system: "rescan" };

export interface AttachmentSecurityEvent {
  /** The event name; serialised as `event`. */
  readonly name: AttachmentSecurityEventName;
  readonly actor: SecurityEventActor;
  /**
   * The request's documentId. Absent only on a readers-rule refusal (WR-103) whose requested request id fails the
   * identifier rule: such an id is dropped, never echoed.
   */
  readonly requestId?: string;
  readonly attachmentId?: string;
  readonly fileType?: AttachmentType;
  readonly byteSize?: number;
  readonly sha256?: string;
  /** A short lower-case outcome code, such as `clean`, `pending`, `refused` or `blocked`. */
  readonly outcome: string;
  /** A closed upper-case reason code, such as `ATTACHMENT_MALWARE_FOUND`. */
  readonly reason?: string;
  /** The scanner's detection name. */
  readonly detection?: string;
  /** For `attachment.ai_inclusion_changed`: the inclusion before and after. */
  readonly from?: boolean;
  readonly to?: boolean;
}

/** Phase 19's export events (19-04; D-18): one line per export attempt. */
export const EXPORT_SECURITY_EVENT_NAMES = ["export.completed", "export.refused"] as const;

/** Phase 19's import event (19-04 defines it, 19-13 writes it): one line per committed import. */
export const IMPORT_SECURITY_EVENT_NAMES = ["import.committed"] as const;

/** The closed reasons an export refusal logs: the three API reasons and the log-only `INVALID_QUERY` and `EXPORT_FAILED`. */
export type ExportSecurityEventReason = "EXPORT_ROW_LIMIT" | "INVALID_QUERY" | "ASSESSMENT_NOT_RELEASED" | "EXPORT_CELL_TOO_LONG" | "EXPORT_FAILED";

/**
 * One export attempt (phase-19-exports-and-export-log.md, "The Export Event Log"). `filters`, `search` and `sort`
 * are the closed, parsed values, never the raw query; no field holds an exported cell. `reason` is absent, never
 * null, on `export.completed`.
 */
export interface ExportSecurityEvent {
  readonly name: (typeof EXPORT_SECURITY_EVENT_NAMES)[number];
  readonly actor: { readonly documentId: string; readonly displayName: string };
  readonly view: string;
  readonly format: string;
  readonly columns: readonly string[];
  readonly table: string | null;
  readonly filters: Readonly<Record<string, string | readonly string[]>>;
  readonly search: string | null;
  readonly sort: string | null;
  /** The IANA zone, or `UTC-fallback` when the viewer's zone was not known. */
  readonly timeZone: string;
  /** Null when refused before counting. */
  readonly rowCount: number | null;
  readonly subject: { readonly kind: "risk-assessment"; readonly documentId: string } | null;
  readonly outcome: "exported" | "refused";
  readonly reason?: ExportSecurityEventReason;
}

/** One committed import (phase-19-import-tolerance.md): the file by name and digest, and the row counts. */
export interface ImportSecurityEvent {
  readonly name: (typeof IMPORT_SECURITY_EVENT_NAMES)[number];
  readonly actor: { readonly documentId: string; readonly displayName: string };
  readonly collection: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly format: string;
  readonly counts: {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly rejected: number;
    readonly ambiguous: number;
    readonly skipped: number;
  };
  readonly outcome: "committed";
}

export type SecurityEvent = AttachmentSecurityEvent | ExportSecurityEvent | ImportSecurityEvent;

export type SecurityEventName = SecurityEvent["name"];

export type SecurityEventLevel = "info" | "warn";

/** Each event's level. A refusal is `info` unless its reason is in `SECURITY_EVENT_WARN_REASONS`. */
export const SECURITY_EVENT_LEVELS: Readonly<Record<SecurityEventName, SecurityEventLevel>> = Object.freeze({
  "attachment.uploaded": "info",
  "attachment.refused": "info",
  "attachment.quarantined": "info",
  "attachment.scan_verdict": "info",
  "attachment.blocked": "warn",
  "attachment.downloaded": "info",
  "attachment.integrity_failed": "warn",
  "attachment.removed": "info",
  "attachment.restored": "info",
  "attachment.ai_inclusion_changed": "info",
  "attachment.history_unavailable": "warn",
  "export.completed": "info",
  "export.refused": "info",
  "import.committed": "info",
});

/**
 * Refusal reasons that raise an event to warning level: a malware detection, an export over the row cap (D-17), and an
 * export that failed after parsing (the review amendment, 2026-10-17, BE1-04).
 */
export const SECURITY_EVENT_WARN_REASONS: ReadonlySet<string> = new Set(["ATTACHMENT_MALWARE_FOUND", "EXPORT_ROW_LIMIT", "EXPORT_FAILED"]);

/**
 * The closed reasons only the log uses, beside the API's closed reasons (WR-103). `NOT_FOUND` is the readers-rule 404:
 * the response names no reason (D-18), and the line records why it was refused. `INVALID_QUERY` is an export refused
 * for its query (19-04): the 400 names no reason either. `EXPORT_FAILED` is an export that failed after its query was
 * parsed (the review amendment, 2026-10-17, BE1-04): the response is Strapi's 500, which names none.
 */
export const SECURITY_EVENT_LOG_REASONS = Object.freeze(["NOT_FOUND", "INVALID_QUERY", "EXPORT_FAILED"] as const);

export type SecurityEventLogReason = (typeof SECURITY_EVENT_LOG_REASONS)[number];

export interface SecurityEventLogger {
  info(message: string): void;
  warn(message: string): void;
}

const REASON = /^[A-Z][A-Z0-9_]{0,79}$/;
// The one detection pattern the contract serves (the stage B amendment, contract item 4): a line never logs a name
// the 422 or the list would not serve.
const DETECTION = ATTACHMENT_DETECTION_PATTERN;
const OUTCOME = /^[a-z][a-z0-9_-]{0,39}$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
/** An export's view: a list view's key, or a report's `report:{reportKey}` (phase-19-exports-and-export-log.md). */
const EXPORT_VIEW = /^[A-Za-z0-9_-]{1,64}(:[A-Za-z0-9_-]{1,63})?$/;
const SHA256 = /^[0-9a-f]{64}$/;
/** The longest free text a line keeps (a search, a filter value, a sort, a zone, a file name). */
const FREE_TEXT_MAX = 255;
/** C0 and C1 controls, and the bidirectional marks, embeddings, overrides and isolates. */
const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Whether a requested identifier may be logged as it is (WR-103): one that fails the rule is dropped, never echoed. */
export function isSecurityEventIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function closed(value: string, pattern: RegExp, replacement: string): string {
  return pattern.test(value) ? value : replacement;
}

/** Free text as a line may hold it: controls removed, then cut to 255 characters, never through a surrogate pair. */
function freeText(value: unknown): string {
  let text = String(value).replace(CONTROLS, "");
  if (text.length > FREE_TEXT_MAX) {
    text = text.slice(0, FREE_TEXT_MAX);
    if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
  }
  return text;
}

function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function isExportEvent(event: SecurityEvent): event is ExportSecurityEvent {
  return (EXPORT_SECURITY_EVENT_NAMES as readonly string[]).includes(event.name);
}

function isImportEvent(event: SecurityEvent): event is ImportSecurityEvent {
  return (IMPORT_SECURITY_EVENT_NAMES as readonly string[]).includes(event.name);
}

/** The parsed filters: each key closed to the identifier rule, each value free text (a list stays a list). */
function exportFilters(filters: unknown): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  if (typeof filters !== "object" || filters === null) return result;
  for (const [key, value] of Object.entries(filters)) {
    const closedKey = closed(key, IDENTIFIER, "INVALID_ID");
    if (Array.isArray(value)) result[closedKey] = value.map(freeText);
    else if (typeof value === "string") result[closedKey] = freeText(value);
  }
  return result;
}

/** The export family's fields, after the common head, in the approved record's order (19-04). */
function exportFields(line: Record<string, unknown>, event: ExportSecurityEvent): void {
  line.view = closed(String(event.view), EXPORT_VIEW, "INVALID_ID");
  line.format = closed(String(event.format), IDENTIFIER, "INVALID_ID");
  line.columns = Array.isArray(event.columns) ? event.columns.map((column) => closed(String(column), IDENTIFIER, "INVALID_ID")) : [];
  line.table = event.table === null || event.table === undefined ? null : closed(String(event.table), IDENTIFIER, "INVALID_ID");
  line.filters = exportFilters(event.filters);
  line.search = event.search === null || event.search === undefined ? null : freeText(event.search);
  line.sort = event.sort === null || event.sort === undefined ? null : freeText(event.sort);
  line.timeZone = freeText(event.timeZone);
  line.rowCount = countOrNull(event.rowCount);
  line.subject = event.subject === null || event.subject === undefined
    ? null
    : { kind: closed(String(event.subject.kind), IDENTIFIER, "INVALID_ID"), documentId: closed(String(event.subject.documentId), IDENTIFIER, "INVALID_ID") };
  line.outcome = closed(String(event.outcome), OUTCOME, "invalid");
  if (event.reason !== undefined) line.reason = closed(String(event.reason), REASON, "INVALID_REASON");
}

/** The import family's fields, after the common head (19-04 defines them for 19-13). */
function importFields(line: Record<string, unknown>, event: ImportSecurityEvent): void {
  line.collection = closed(String(event.collection), IDENTIFIER, "INVALID_ID");
  line.fileName = freeText(event.fileName);
  line.sha256 = closed(String(event.sha256), SHA256, "invalid");
  line.format = closed(String(event.format), IDENTIFIER, "INVALID_ID");
  const counts = (event.counts ?? {}) as Partial<Record<keyof ImportSecurityEvent["counts"], unknown>>;
  line.counts = {
    created: countOrNull(counts.created),
    updated: countOrNull(counts.updated),
    unchanged: countOrNull(counts.unchanged),
    rejected: countOrNull(counts.rejected),
    ambiguous: countOrNull(counts.ambiguous),
    skipped: countOrNull(counts.skipped),
  };
  line.outcome = closed(String(event.outcome), OUTCOME, "invalid");
}

function actorOf(actor: SecurityEventActor): SecurityEventActor {
  // BE1-04: a display name is free text, so it loses control and bidi characters like every other (log injection).
  return "system" in actor ? { system: "rescan" } : { documentId: String(actor.documentId), displayName: freeText(actor.displayName) };
}

/** The event's level: its name's, raised to `warn` for a malware refusal or an export over the row cap. */
export function securityEventLevel(event: SecurityEvent): SecurityEventLevel {
  // An import event has no reason; only the attachment and export families may (re-check iteration 6, I-1).
  const reason = "reason" in event ? event.reason : undefined;
  if (reason !== undefined && SECURITY_EVENT_WARN_REASONS.has(reason)) return "warn";
  return SECURITY_EVENT_LEVELS[event.name] ?? "info";
}

/** One log line: the prefix, a space, then JSON with the keys in a fixed order and `at` in UTC. */
export function formatSecurityEventLine(event: SecurityEvent, at: Date): string {
  const line: Record<string, unknown> = {
    event: event.name,
    schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
    at: at.toISOString(),
    actor: actorOf(event.actor),
  };
  if (isExportEvent(event)) {
    exportFields(line, event);
    return `${SECURITY_EVENT_PREFIX} ${JSON.stringify(line)}`;
  }
  if (isImportEvent(event)) {
    importFields(line, event);
    return `${SECURITY_EVENT_PREFIX} ${JSON.stringify(line)}`;
  }
  if (event.requestId !== undefined) line.requestId = closed(String(event.requestId), IDENTIFIER, "INVALID_ID");
  if (event.attachmentId !== undefined) line.attachmentId = closed(String(event.attachmentId), IDENTIFIER, "INVALID_ID");
  if (event.fileType !== undefined) line.fileType = closed(String(event.fileType), /^[a-z]{2,8}$/, "invalid");
  if (event.byteSize !== undefined) line.byteSize = Number.isSafeInteger(event.byteSize) ? event.byteSize : null;
  if (event.sha256 !== undefined) line.sha256 = closed(String(event.sha256), SHA256, "invalid");
  line.outcome = closed(String(event.outcome), OUTCOME, "invalid");
  if (event.reason !== undefined) line.reason = closed(String(event.reason), REASON, "INVALID_REASON");
  if (event.detection !== undefined) line.detection = closed(String(event.detection), DETECTION, "INVALID_DETECTION");
  if (event.from !== undefined) line.from = event.from === true;
  if (event.to !== undefined) line.to = event.to === true;
  return `${SECURITY_EVENT_PREFIX} ${JSON.stringify(line)}`;
}

/** Writes one event line through Strapi's logger at the event's level. */
export function logSecurityEvent(logger: SecurityEventLogger, event: SecurityEvent, at: Date = new Date()): void {
  const line = formatSecurityEventLine(event, at);
  if (securityEventLevel(event) === "warn") logger.warn(line);
  else logger.info(line);
}
