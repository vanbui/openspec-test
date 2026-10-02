/*
 * The questionnaire governance event log.
 *
 * `governanceLog` is an append-only, schema-versioned array persisted inside
 * one CsrmQuestionnaire. It carries the narrative history of governance events
 * for the D-09 revision timeline. It is deliberately never consulted for an
 * authorization decision: the release gate reads the dedicated `releasedAt` and
 * `releasedBy` facts instead (D-14), so a malformed or truncated log can never
 * deny a read of an already-released questionnaire.
 *
 * `appendGovernanceEvent` is the only writer. This module exports no function
 * capable of removing, reordering or rewriting an existing entry, and the
 * appender returns a new array rather than mutating the one it was given.
 *
 * The parser is a closed exact-key parser in the same posture as
 * `questionnaire-definition.ts` and the answer-envelope parser: anything it does
 * not recognise is rejected. Read paths treat a rejection as an empty log so a
 * malformed envelope degrades the narrative rather than the record.
 */

type RecordValue = Record<string, unknown>;

export const GOVERNANCE_LOG_SCHEMA_VERSION = 1;
export const GOVERNANCE_LOG_MAX_ENTRIES = 1_000;

export const GOVERNANCE_EVENT_KINDS = Object.freeze([
  "released",
  "returned-to-review",
  "question-added",
  "question-edited",
  "question-deleted",
  "answer-cleared",
  /*
   * Phase 10 D-10: a newly generated questionnaire replaced this one's questions. Written in the
   * transaction that replaces them, at the new generation's time, with an explanation counting the
   * questions replaced and the analyst changes discarded.
   */
  "regenerated",
] as const);

/* The analyst question changes a replacement discards (D-16): the cleared answers they caused are not counted. */
const ANALYST_QUESTION_CHANGE_KINDS: ReadonlySet<GovernanceEventKind> = new Set(["question-added", "question-edited", "question-deleted"]);

export type GovernanceEventKind = (typeof GOVERNANCE_EVENT_KINDS)[number];

export type GovernanceEvent = {
  schemaVersion: 1;
  kind: GovernanceEventKind;
  at: string;
  by: string;
  reason?: string;
  questionKey?: string;
  /*
   * The question's own words when the event was written (Phase 10 D-18): what the analyst
   * timeline names the question by after it changes again. Absent on events written before
   * Phase 10 and on events that concern no question.
   */
  questionText?: string;
  explanation?: string;
};

const GOVERNANCE_EVENT_KEYS = [
  "schemaVersion",
  "kind",
  "at",
  "by",
  "reason",
  "questionKey",
  "questionText",
  "explanation",
] as const;

const MAX_ACTOR_LENGTH = 255;
const MAX_REASON_LENGTH = 500;
const MAX_QUESTION_KEY_LENGTH = 120;
const MAX_EXPLANATION_LENGTH = 500;
export const MAX_QUESTION_TEXT_LENGTH = 500;

export class GovernanceLogError extends Error {
  constructor(message = "CSRM questionnaire governance log is invalid.") {
    super(message);
    this.name = "GovernanceLogError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new GovernanceLogError();
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    throw new GovernanceLogError();
  }
  return value.trim();
}

function optionalBoundedString(value: unknown, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  return boundedString(value, maximum);
}

function instant(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new GovernanceLogError();
  }
  return value;
}

function isGovernanceEventKind(value: unknown): value is GovernanceEventKind {
  return typeof value === "string" && (GOVERNANCE_EVENT_KINDS as readonly string[]).includes(value);
}

/**
 * Validates one governance event against the closed schema and returns a frozen
 * normalised copy. Only the keys the schema declares survive.
 */
export function parseGovernanceEvent(value: unknown): GovernanceEvent {
  if (!isRecord(value)) throw new GovernanceLogError();
  exactKeys(value, GOVERNANCE_EVENT_KEYS);
  if (value.schemaVersion !== GOVERNANCE_LOG_SCHEMA_VERSION) throw new GovernanceLogError();
  if (!isGovernanceEventKind(value.kind)) throw new GovernanceLogError();
  const reason = optionalBoundedString(value.reason, MAX_REASON_LENGTH);
  const questionKey = optionalBoundedString(value.questionKey, MAX_QUESTION_KEY_LENGTH);
  const questionText = optionalBoundedString(value.questionText, MAX_QUESTION_TEXT_LENGTH);
  const explanation = optionalBoundedString(value.explanation, MAX_EXPLANATION_LENGTH);
  return Object.freeze({
    schemaVersion: GOVERNANCE_LOG_SCHEMA_VERSION as 1,
    kind: value.kind,
    at: instant(value.at),
    by: boundedString(value.by, MAX_ACTOR_LENGTH),
    ...(reason === undefined ? {} : { reason }),
    ...(questionKey === undefined ? {} : { questionKey }),
    ...(questionText === undefined ? {} : { questionText }),
    ...(explanation === undefined ? {} : { explanation }),
  });
}

/**
 * The bounded snapshot of a question's text an event keeps (D-18): the trimmed text, or, when
 * it is longer than the event bound, its first 499 characters and a closing ellipsis.
 */
export function questionTextSnapshot(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_QUESTION_TEXT_LENGTH) return trimmed;
  let cut = trimmed.slice(0, MAX_QUESTION_TEXT_LENGTH - 1);
  // Never end on half of a surrogate pair: the bound counts UTF-16 code units, like the parser.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Parses a persisted `governanceLog`. An absent, null or empty value is an
 * empty log rather than an error, because the attribute is optional and every
 * record written before this extension has none.
 */
export function parseGovernanceLog(value: unknown): GovernanceEvent[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new GovernanceLogError();
  if (value.length > GOVERNANCE_LOG_MAX_ENTRIES) throw new GovernanceLogError();
  return value.map(parseGovernanceEvent);
}

/**
 * The only writer. Returns a new array whose prior entries are unchanged and in
 * their original order, with the validated event appended last.
 */
export function appendGovernanceEvent(existing: unknown, event: unknown): GovernanceEvent[] {
  const current = parseGovernanceLog(existing);
  const appended = parseGovernanceEvent(event);
  if (current.length + 1 > GOVERNANCE_LOG_MAX_ENTRIES) throw new GovernanceLogError();
  return [...current, appended];
}

/**
 * The narrative summary an authorised read may show. A malformed stored log
 * summarises as empty; it never throws out of a read path.
 */
export function summariseGovernanceLog(value: unknown): { eventCount: number; lastEventAt: string | null } {
  let events: GovernanceEvent[];
  try {
    events = parseGovernanceLog(value);
  } catch (error) {
    if (error instanceof GovernanceLogError) return { eventCount: 0, lastEventAt: null };
    throw error;
  }
  return { eventCount: events.length, lastEventAt: events.at(-1)?.at ?? null };
}

/**
 * How many analyst question changes (added, edited, removed) the log records at or after the
 * questionnaire's latest generation (D-16): what replacing it now would discard. Without a generation
 * date every change counts, and so does every change when the date cannot be read, because a
 * confirmation that undercounts discarded work is the worse error. For the same reason a malformed log
 * gives no count at all (null, unknown) rather than 0, which would read as "nothing discarded" (WR-102);
 * like the summary, this never throws out of a read.
 */
export function countAnalystChangesSinceGeneration(log: unknown, generatedDate: string | Date | null | undefined): number | null {
  let events: GovernanceEvent[];
  try {
    events = parseGovernanceLog(log);
  } catch (error) {
    if (error instanceof GovernanceLogError) return null;
    throw error;
  }
  const since = generatedDate instanceof Date ? generatedDate.getTime() : typeof generatedDate === "string" ? Date.parse(generatedDate) : Number.NaN;
  return events.filter((event) => ANALYST_QUESTION_CHANGE_KINDS.has(event.kind) && (Number.isNaN(since) || Date.parse(event.at) >= since)).length;
}
