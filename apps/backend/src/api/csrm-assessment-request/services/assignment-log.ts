/*
 * The request assignment log (Phase 13 D-09; the 06.8 posture of questionnaire-governance-log.ts).
 *
 * `assignmentLog` is an append-only, schema-versioned envelope persisted on one CsrmAssessmentRequest:
 * `{ schemaVersion: 1, events: [...] }`, one event per assignment change, written in the same transaction as the
 * current facts (`assignedAnalyst`, `assignedAt`, `assignedBy`). It is the history of who held the request and why.
 *
 * It is never read by an authorisation decision. Gates read `assignedAnalyst` only, so a damaged history can never
 * move who is accountable for a request.
 *
 * `appendAssignmentEvent` is the only writer. This module exports nothing that removes, reorders or rewrites an
 * earlier event, and the appender returns a new envelope rather than mutating the one it was given. The parser is
 * closed: unknown keys, actions and versions are invalid. Reads fail safe: a malformed log reads as "history
 * unavailable" (`readAssignmentHistory` returns null), never as an error out of the read of the request.
 */

import { ASSIGNMENT_LOG_ACTIONS, type AssignmentLogAction } from "./request-assignment-policy";

type RecordValue = Record<string, unknown>;

export const ASSIGNMENT_LOG_SCHEMA_VERSION = 1;
export const ASSIGNMENT_LOG_MAX_EVENTS = 1_000;
export const ASSIGNMENT_REASON_MAX_LENGTH = 500;
const MAX_ACTOR_LENGTH = 255;

export type AssignmentLogEvent = {
  schemaVersion: 1;
  action: AssignmentLogAction;
  by: string;
  at: string;
  from: string | null;
  to: string | null;
  reason: string | null;
};

export type AssignmentLog = { schemaVersion: 1; events: readonly AssignmentLogEvent[] };

const ENVELOPE_KEYS = ["schemaVersion", "events"] as const;
const EVENT_KEYS = ["schemaVersion", "action", "by", "at", "from", "to", "reason"] as const;

export class AssignmentLogError extends Error {
  constructor(message = "CSRM request assignment log is invalid.") {
    super(message);
    this.name = "AssignmentLogError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new AssignmentLogError();
}

function actorId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ACTOR_LENGTH || value.trim() !== value) {
    throw new AssignmentLogError();
  }
  return value;
}

function optionalActorId(value: unknown): string | null {
  return value === null ? null : actorId(value);
}

function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new AssignmentLogError();
  }
  return value;
}

function reasonValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > ASSIGNMENT_REASON_MAX_LENGTH) {
    throw new AssignmentLogError();
  }
  return value;
}

function isAction(value: unknown): value is AssignmentLogAction {
  return typeof value === "string" && (ASSIGNMENT_LOG_ACTIONS as readonly string[]).includes(value);
}

/** One event against the closed schema, as a frozen copy. */
export function parseAssignmentEvent(value: unknown): AssignmentLogEvent {
  if (!isRecord(value)) throw new AssignmentLogError();
  exactKeys(value, EVENT_KEYS);
  if (value.schemaVersion !== ASSIGNMENT_LOG_SCHEMA_VERSION || !isAction(value.action)) throw new AssignmentLogError();
  const event: AssignmentLogEvent = {
    schemaVersion: ASSIGNMENT_LOG_SCHEMA_VERSION,
    action: value.action,
    by: actorId(value.by),
    at: instant(value.at),
    from: optionalActorId(value.from),
    to: optionalActorId(value.to),
    reason: reasonValue(value.reason),
  };
  // The action and the transition it names agree, so the history can never say something the change did not do.
  const consistent = event.action === "pick-up" ? event.from === null && event.to === event.by
    : event.action === "assign" ? event.from === null && event.to !== null && event.to !== event.by
      : event.action === "reassign" ? event.from !== null && event.to !== null && event.from !== event.to
        : event.from !== null && event.to === null;
  if (!consistent) throw new AssignmentLogError();
  return Object.freeze(event);
}

/**
 * The events of a persisted `assignmentLog`, oldest first. Absent or null is an empty log, because the attribute is
 * optional and every request written before Phase 13 has none (D-11).
 */
export function parseAssignmentLog(value: unknown): readonly AssignmentLogEvent[] {
  if (value === null || value === undefined) return Object.freeze([]);
  if (!isRecord(value)) throw new AssignmentLogError();
  exactKeys(value, ENVELOPE_KEYS);
  if (value.schemaVersion !== ASSIGNMENT_LOG_SCHEMA_VERSION || !Array.isArray(value.events)) throw new AssignmentLogError();
  if (value.events.length > ASSIGNMENT_LOG_MAX_EVENTS) throw new AssignmentLogError();
  return Object.freeze(value.events.map(parseAssignmentEvent));
}

/** Whether the log can take one more event; a malformed log cannot. */
export function canAppendAssignmentEvent(value: unknown): boolean {
  try {
    return parseAssignmentLog(value).length < ASSIGNMENT_LOG_MAX_EVENTS;
  } catch (error) {
    if (error instanceof AssignmentLogError) return false;
    throw error;
  }
}

/**
 * The only writer: a new envelope whose earlier events are unchanged and in their original order, with the
 * validated event last. A malformed log, or one at its cap, refuses the event, so no change is ever written
 * without its record.
 */
export function appendAssignmentEvent(value: unknown, event: unknown): AssignmentLog {
  const current = parseAssignmentLog(value);
  const appended = parseAssignmentEvent(event);
  if (current.length + 1 > ASSIGNMENT_LOG_MAX_EVENTS) throw new AssignmentLogError();
  return { schemaVersion: ASSIGNMENT_LOG_SCHEMA_VERSION, events: [...current, appended] };
}

/** The history newest first, or null when the stored log is malformed ("history unavailable"); never throws. */
export function readAssignmentHistory(value: unknown): readonly AssignmentLogEvent[] | null {
  try {
    return [...parseAssignmentLog(value)].reverse();
  } catch (error) {
    if (error instanceof AssignmentLogError) return null;
    throw error;
  }
}
