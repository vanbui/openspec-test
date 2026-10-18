/*
 * A note's AI-input log (Phase 13 D-26; the 06.8 posture of questionnaire-governance-log.ts and assignment-log.ts).
 *
 * `aiInputLog` is an append-only, schema-versioned envelope persisted on one CsrmRequestNote:
 * `{ schemaVersion: 1, events: [...] }`, one event per change of the note's `changesAiInputs` mark, written in the
 * same transaction as the mark. A note posted with the mark set records it as its first event (`from: false`,
 * `to: true`, by the author, at `postedAt`).
 *
 * It is the history, never the fact: whether a note reaches the AI is read from `changesAiInputs` alone, so a damaged
 * history can never add a note to the AI context or remove one from it.
 *
 * `appendNoteAiInputEvent` is the only writer. This module exports nothing that removes, reorders or rewrites an
 * earlier event, and the appender returns a new envelope rather than mutating the one it was given. The parser is
 * closed: unknown keys and versions are invalid, and an event must change the mark.
 */

type RecordValue = Record<string, unknown>;

export const NOTE_AI_INPUT_LOG_SCHEMA_VERSION = 1;
/** The most events one note's log holds; at the cap a change is refused (HISTORY_UNAVAILABLE) and nothing written. */
export const NOTE_AI_INPUT_LOG_MAX_EVENTS = 200;
const MAX_ACTOR_LENGTH = 255;

export type NoteAiInputEvent = {
  schemaVersion: 1;
  /** The IdamBox User documentId of the Security Analyst who changed the mark. */
  by: string;
  at: string;
  from: boolean;
  to: boolean;
};

export type NoteAiInputLog = { schemaVersion: 1; events: readonly NoteAiInputEvent[] };

const ENVELOPE_KEYS = ["schemaVersion", "events"] as const;
const EVENT_KEYS = ["schemaVersion", "by", "at", "from", "to"] as const;

export class NoteAiInputLogError extends Error {
  constructor(message = "CSRM request note AI-input log is invalid.") {
    super(message);
    this.name = "NoteAiInputLogError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new NoteAiInputLogError();
}

function actorId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ACTOR_LENGTH || value.trim() !== value) {
    throw new NoteAiInputLogError();
  }
  return value;
}

function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new NoteAiInputLogError();
  }
  return value;
}

/** One event against the closed schema, as a frozen copy. An event always changes the mark. */
export function parseNoteAiInputEvent(value: unknown): NoteAiInputEvent {
  if (!isRecord(value)) throw new NoteAiInputLogError();
  exactKeys(value, EVENT_KEYS);
  if (value.schemaVersion !== NOTE_AI_INPUT_LOG_SCHEMA_VERSION) throw new NoteAiInputLogError();
  if (typeof value.from !== "boolean" || typeof value.to !== "boolean" || value.from === value.to) throw new NoteAiInputLogError();
  return Object.freeze({
    schemaVersion: NOTE_AI_INPUT_LOG_SCHEMA_VERSION,
    by: actorId(value.by),
    at: instant(value.at),
    from: value.from,
    to: value.to,
  });
}

/** The events of a persisted `aiInputLog`, oldest first. Absent or null is an empty log: the mark was never set. */
export function parseNoteAiInputLog(value: unknown): readonly NoteAiInputEvent[] {
  if (value === null || value === undefined) return Object.freeze([]);
  if (!isRecord(value)) throw new NoteAiInputLogError();
  exactKeys(value, ENVELOPE_KEYS);
  if (value.schemaVersion !== NOTE_AI_INPUT_LOG_SCHEMA_VERSION || !Array.isArray(value.events)) throw new NoteAiInputLogError();
  if (value.events.length > NOTE_AI_INPUT_LOG_MAX_EVENTS) throw new NoteAiInputLogError();
  return Object.freeze(value.events.map(parseNoteAiInputEvent));
}

/**
 * The only writer: a new envelope whose earlier events are unchanged and in their original order, with the validated
 * event last. A malformed log, or one at its cap, refuses the event, so the mark never changes without its record.
 */
export function appendNoteAiInputEvent(value: unknown, event: unknown): NoteAiInputLog {
  const current = parseNoteAiInputLog(value);
  const appended = parseNoteAiInputEvent(event);
  if (current.length + 1 > NOTE_AI_INPUT_LOG_MAX_EVENTS) throw new NoteAiInputLogError();
  return { schemaVersion: NOTE_AI_INPUT_LOG_SCHEMA_VERSION, events: [...current, appended] };
}
