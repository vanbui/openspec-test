/*
 * An attachment's event log (Phase 14 D-01; the 06.8 posture of note-ai-input-log.ts and assignment-log.ts;
 * docs/contract-gaps/phase-14-request-attachments.md, "Write Discipline").
 *
 * `eventLog` is an append-only, schema-versioned envelope persisted on one CsrmRequestAttachment:
 * `{ schemaVersion: 1, events: [...] }`, one event per change of the file's facts (its upload, quarantine, scan
 * verdicts, block, removal, restore and AI inclusion), written in the same transaction as the change it documents.
 *
 * It is the history, never the fact: every gate reads `scanStatus`, `removedAt`, `aiTextIncluded` and `note`, so a
 * damaged history can never make a file downloadable or put its text in front of the AI. A malformed log projects as
 * "history unavailable" and never denies a read.
 *
 * `appendAttachmentEvent` is the only writer. This module exports nothing that removes, reorders or rewrites an
 * earlier event, and the appender returns a new envelope rather than mutating the one it was given. The parser is
 * closed: unknown keys, types and versions are invalid.
 *
 * The log holds at most 200 events, and keeps a reserve of three below that cap (WR-101). A change that adds (an upload,
 * a restore, an inclusion in the AI inputs) is refused within the reserve or on a malformed log (HISTORY_UNAVAILABLE),
 * and nothing is written. A change that withdraws text from the AI or records a system verdict (an exclusion, a removal,
 * a scan verdict, a block) always fits after the last adding change, and is never blocked by its history: one whose
 * events still do not fit (a log a seed or a legacy record filled) or that meets a malformed log is made anyway, with the
 * log left untouched (never repaired or truncated) and a warning-level security event line in its place
 * (`recordAttachmentWithdrawal`). G-3's minimisation and D-21's deletion outrank the bookkeeping.
 */

type RecordValue = Record<string, unknown>;

export const ATTACHMENT_EVENT_LOG_SCHEMA_VERSION = 1;
/** The most events one attachment's log holds. */
export const ATTACHMENT_EVENT_LOG_MAX_EVENTS = 200;

/**
 * The events below the cap that only a withdrawal or a verdict may use (WR-101). Three, because after the last adding
 * change a file can still need an included file's exclusion and removal (`ai-excluded`, then `removed`: two events)
 * and one system verdict (`scan-verdict` or `blocked`: one event). Each of those happens at most once after the last
 * adding change: a second exclusion needs an inclusion and a second removal needs a restore, both adding, and a file
 * gets one verdict while it is pending. So the last adding change, which leaves at most 197 events, always leaves room
 * for every withdrawal and verdict that can follow it.
 */
export const ATTACHMENT_EVENT_LOG_RESERVE = 3;

export const ATTACHMENT_EVENT_TYPES = [
  "uploaded",
  "quarantined",
  "scan-verdict",
  "blocked",
  "removed",
  "restored",
  "ai-included",
  "ai-excluded",
] as const;

export type AttachmentEventType = (typeof ATTACHMENT_EVENT_TYPES)[number];

/** The changes that withdraw text from the AI or record a system verdict: never refused within the reserve (WR-101). */
export const ATTACHMENT_WITHDRAWING_EVENT_TYPES = ["ai-excluded", "removed", "scan-verdict", "blocked"] as const satisfies readonly AttachmentEventType[];

/** A scan's verdict as the log records it. */
export const ATTACHMENT_SCAN_VERDICTS = ["clean", "infected", "not-scanned"] as const;
export type AttachmentScanVerdict = (typeof ATTACHMENT_SCAN_VERDICTS)[number];

export type AttachmentEvent = {
  schemaVersion: 1;
  type: AttachmentEventType;
  /** The actor's IdamBox User documentId; null for the in-process re-scan. */
  by: string | null;
  at: string;
  /** The scanner's identity, for an event a scan decided. */
  engine?: string;
  verdict?: AttachmentScanVerdict;
  /** The detection name an infected verdict reported. */
  detection?: string;
};

export type AttachmentEventLog = { schemaVersion: 1; events: readonly AttachmentEvent[] };

const ENVELOPE_KEYS = ["schemaVersion", "events"] as const;
const EVENT_KEYS = ["schemaVersion", "type", "by", "at", "engine", "verdict", "detection"] as const;
const REQUIRED_EVENT_KEYS = ["schemaVersion", "type", "by", "at"] as const;
const MAX_ACTOR_LENGTH = 255;
const MAX_ENGINE_LENGTH = 255;
const MAX_DETECTION_LENGTH = 200;
const EVENT_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_EVENT_TYPES);
const VERDICTS: ReadonlySet<string> = new Set(ATTACHMENT_SCAN_VERDICTS);
const WITHDRAWING: ReadonlySet<string> = new Set(ATTACHMENT_WITHDRAWING_EVENT_TYPES);

export class AttachmentEventLogError extends Error {
  constructor(message = "CSRM request attachment event log is invalid.") {
    super(message);
    this.name = "AttachmentEventLogError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AttachmentEventLogError();
  }
  return value;
}

function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new AttachmentEventLogError();
  }
  return value;
}

/** One event against the closed schema, as a frozen copy. */
export function parseAttachmentEvent(value: unknown): AttachmentEvent {
  if (!isRecord(value)) throw new AttachmentEventLogError();
  const keys = Object.keys(value);
  if (keys.some((key) => !(EVENT_KEYS as readonly string[]).includes(key))) throw new AttachmentEventLogError();
  if (REQUIRED_EVENT_KEYS.some((key) => !(key in value))) throw new AttachmentEventLogError();
  if (value.schemaVersion !== ATTACHMENT_EVENT_LOG_SCHEMA_VERSION) throw new AttachmentEventLogError();
  if (typeof value.type !== "string" || !EVENT_TYPES.has(value.type)) throw new AttachmentEventLogError();
  const event: AttachmentEvent = {
    schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION,
    type: value.type as AttachmentEventType,
    by: value.by === null ? null : boundedText(value.by, MAX_ACTOR_LENGTH),
    at: instant(value.at),
  };
  if (value.engine !== undefined) event.engine = boundedText(value.engine, MAX_ENGINE_LENGTH);
  if (value.verdict !== undefined) {
    if (typeof value.verdict !== "string" || !VERDICTS.has(value.verdict)) throw new AttachmentEventLogError();
    event.verdict = value.verdict as AttachmentScanVerdict;
  }
  if (value.detection !== undefined) {
    if (event.verdict !== "infected") throw new AttachmentEventLogError();
    event.detection = boundedText(value.detection, MAX_DETECTION_LENGTH);
  }
  return Object.freeze(event);
}

/** The events of a persisted `eventLog`, oldest first. Absent or null is an empty log. */
export function parseAttachmentEventLog(value: unknown): readonly AttachmentEvent[] {
  if (value === null || value === undefined) return Object.freeze([]);
  if (!isRecord(value)) throw new AttachmentEventLogError();
  const keys = Object.keys(value);
  if (keys.length !== ENVELOPE_KEYS.length || keys.some((key) => !(ENVELOPE_KEYS as readonly string[]).includes(key))) throw new AttachmentEventLogError();
  if (value.schemaVersion !== ATTACHMENT_EVENT_LOG_SCHEMA_VERSION || !Array.isArray(value.events)) throw new AttachmentEventLogError();
  if (value.events.length > ATTACHMENT_EVENT_LOG_MAX_EVENTS) throw new AttachmentEventLogError();
  return Object.freeze(value.events.map(parseAttachmentEvent));
}

/**
 * The only writer: a new envelope whose earlier events are unchanged and in their original order, with the validated
 * event last. A malformed log refuses the event, and so does a full one: an adding event within the reserve, any event
 * at the cap (an adding change's caller answers 409 HISTORY_UNAVAILABLE).
 */
export function appendAttachmentEvent(value: unknown, event: unknown): AttachmentEventLog {
  const current = parseAttachmentEventLog(value);
  const appended = parseAttachmentEvent(event);
  const limit = WITHDRAWING.has(appended.type) ? ATTACHMENT_EVENT_LOG_MAX_EVENTS : ATTACHMENT_EVENT_LOG_MAX_EVENTS - ATTACHMENT_EVENT_LOG_RESERVE;
  if (current.length + 1 > limit) throw new AttachmentEventLogError();
  return { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, events: [...current, appended] };
}

/** A withdrawal's or a verdict's history: the new log, or why the log was left untouched. */
export type AttachmentWithdrawalRecord =
  | { recorded: true; eventLog: AttachmentEventLog }
  | { recorded: false; cause: "full" | "malformed" };

/**
 * The history of a change that withdraws text or records a system verdict (WR-101), which its log never blocks: the log
 * with the change's events appended, all of them or none, or, when they do not fit or the log is malformed, why the
 * log is left as it is. The caller then makes the change without writing the log and logs a warning-level
 * `attachment.history_unavailable` line. An adding event is refused here: it goes through `appendAttachmentEvent`.
 */
export function recordAttachmentWithdrawal(value: unknown, events: readonly unknown[]): AttachmentWithdrawalRecord {
  const appended = events.map(parseAttachmentEvent);
  if (appended.length === 0 || appended.some((event) => !WITHDRAWING.has(event.type))) {
    throw new AttachmentEventLogError("Only a withdrawal or a verdict is recorded without its history.");
  }
  let current: readonly AttachmentEvent[];
  try {
    current = parseAttachmentEventLog(value);
  } catch (error) {
    if (error instanceof AttachmentEventLogError) return { recorded: false, cause: "malformed" };
    throw error;
  }
  if (current.length + appended.length > ATTACHMENT_EVENT_LOG_MAX_EVENTS) return { recorded: false, cause: "full" };
  return { recorded: true, eventLog: { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, events: [...current, ...appended] } };
}
