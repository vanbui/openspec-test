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
 *
 * Phase 15 (D-26, the approved 06.8 amendment) adds the `ai-proposal` and `question-restored` kinds and ten AI keys,
 * each allowed only on the kinds the amendment names, still at `schemaVersion` 1. Only the analyst projection carries
 * them; `projectGovernanceEventsForRequestor` removes every AI kind and key before the Requestor's projection.
 */

import { INSTRUCTION_MAX_LENGTH } from "../../../csrm/ai/analyst-instruction";
import { isProposalItemKey, PROPOSAL_ITEMS_MAX } from "../../../csrm/ai/proposal-items";

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
  /*
   * Phase 15 D-26: a Security Analyst asked the AI for proposals. Written in the transaction that completes a
   * `questionnaire-proposals` or `question-rewrite` run; a run that fails writes none.
   */
  "ai-proposal",
  /* Phase 15 D-26: the Undo of a confirmed AI removal restored the question. */
  "question-restored",
] as const);

/*
 * The analyst question changes a replacement discards (D-16): the cleared answers they caused are not counted. A
 * confirmed AI proposal and its Undo are analyst changes too, so a restored question counts (Phase 15 D-09, D-26).
 */
const ANALYST_QUESTION_CHANGE_KINDS: ReadonlySet<GovernanceEventKind> = new Set(["question-added", "question-edited", "question-deleted", "question-restored"]);

export type GovernanceEventKind = (typeof GOVERNANCE_EVENT_KINDS)[number];

export const AI_PROPOSAL_SCOPES = Object.freeze(["questionnaire", "question"] as const);
export const GOVERNANCE_INSTRUCTION_SOURCES = Object.freeze(["plain-language-preset", "default-task"] as const);

/**
 * The AI keys of the approved 06.8 amendment (Phase 15 D-26). Each is allowed only on the kinds the amendment names:
 * the request on `ai-proposal`; the run, item and edit flag on a question change a confirmation or its Undo wrote; the
 * instruction or its source on `regenerated`.
 */
export type GovernanceEventAiKeys = {
  /** The AI run's documentId. */
  runId?: string;
  /** The proposal item's key, `i-1` to `i-30`. */
  itemKey?: string;
  /** The analyst edited the proposal before confirming it. */
  aiEdited?: boolean;
  /** The event reverses a confirmation. */
  aiUndo?: true;
  scope?: (typeof AI_PROPOSAL_SCOPES)[number];
  instruction?: string;
  /** Written when no instruction was given. */
  instructionSource?: (typeof GOVERNANCE_INSTRUCTION_SOURCES)[number];
  providerName?: string;
  providerVersion?: string;
  /** The items the run kept, 0 to 30. */
  itemCount?: number;
};

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
} & GovernanceEventAiKeys;

const GOVERNANCE_AI_KEYS = [
  "runId",
  "itemKey",
  "aiEdited",
  "aiUndo",
  "scope",
  "instruction",
  "instructionSource",
  "providerName",
  "providerVersion",
  "itemCount",
] as const satisfies readonly (keyof GovernanceEventAiKeys)[];

type GovernanceAiKey = (typeof GOVERNANCE_AI_KEYS)[number];

const GOVERNANCE_EVENT_KEYS = [
  "schemaVersion",
  "kind",
  "at",
  "by",
  "reason",
  "questionKey",
  "questionText",
  "explanation",
  ...GOVERNANCE_AI_KEYS,
] as const;

/* The amendment's map from each kind to the AI keys it may carry; every other kind carries none. */
const CONFIRMATION_AI_KEYS: readonly GovernanceAiKey[] = ["runId", "itemKey", "aiEdited", "aiUndo"];
const AI_KEYS_BY_KIND: Readonly<Record<GovernanceEventKind, readonly GovernanceAiKey[]>> = Object.freeze({
  released: [],
  "returned-to-review": [],
  "question-added": CONFIRMATION_AI_KEYS,
  "question-edited": CONFIRMATION_AI_KEYS,
  "question-deleted": CONFIRMATION_AI_KEYS,
  "answer-cleared": [],
  regenerated: ["instruction", "instructionSource"],
  "ai-proposal": ["runId", "scope", "instruction", "instructionSource", "providerName", "providerVersion", "itemCount"],
  "question-restored": CONFIRMATION_AI_KEYS,
});

const MAX_ACTOR_LENGTH = 255;
const MAX_RUN_ID_LENGTH = 255;
const MAX_PROVIDER_LENGTH = 255;
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

function optionalMember<T extends string>(value: unknown, members: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(members as readonly string[]).includes(value)) throw new GovernanceLogError();
  return value as T;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new GovernanceLogError();
  return value;
}

function optionalItemCount(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > PROPOSAL_ITEMS_MAX) throw new GovernanceLogError();
  return value;
}

function ensure(condition: boolean): void {
  if (!condition) throw new GovernanceLogError();
}

/*
 * "Keys and their kinds" of the approved 06.8 amendment (Phase 15 D-26). An AI key on a kind that may not carry it is
 * refused, and so is any combination the amendment does not describe:
 * - `ai-proposal` requires the run, its scope, the provider, the item count and exactly one of the instruction or its
 *   source; the `question` scope names its question (key and text) and the `questionnaire` scope names none.
 * - A question change written by a confirmation carries the run, the item and the edit flag together; its Undo adds
 *   `aiUndo: true`. A restored question requires its key, and carries the run and the item together when it has them.
 * - `regenerated` may carry the instruction or, with none given, the default-task source, never both.
 */
function parseAiKeys(value: RecordValue, kind: GovernanceEventKind, questionKey: string | undefined, questionText: string | undefined): GovernanceEventAiKeys {
  const allowed = AI_KEYS_BY_KIND[kind];
  for (const key of GOVERNANCE_AI_KEYS) {
    if (value[key] !== undefined && !allowed.includes(key)) throw new GovernanceLogError();
  }
  if (value.aiUndo !== undefined && value.aiUndo !== true) throw new GovernanceLogError();
  if (value.itemKey !== undefined && !isProposalItemKey(value.itemKey)) throw new GovernanceLogError();
  const keys: GovernanceEventAiKeys = {
    runId: optionalBoundedString(value.runId, MAX_RUN_ID_LENGTH),
    itemKey: value.itemKey as string | undefined,
    aiEdited: optionalBoolean(value.aiEdited),
    aiUndo: value.aiUndo as true | undefined,
    scope: optionalMember(value.scope, AI_PROPOSAL_SCOPES),
    instruction: optionalBoundedString(value.instruction, INSTRUCTION_MAX_LENGTH),
    instructionSource: optionalMember(value.instructionSource, GOVERNANCE_INSTRUCTION_SOURCES),
    providerName: optionalBoundedString(value.providerName, MAX_PROVIDER_LENGTH),
    providerVersion: optionalBoundedString(value.providerVersion, MAX_PROVIDER_LENGTH),
    itemCount: optionalItemCount(value.itemCount),
  };
  const has = (key: GovernanceAiKey) => keys[key] !== undefined;
  if (kind === "ai-proposal") {
    ensure(has("runId") && has("scope") && has("providerName") && has("providerVersion") && has("itemCount"));
    ensure(has("instruction") !== has("instructionSource"));
    ensure(keys.scope === "question" ? questionKey !== undefined && questionText !== undefined : questionKey === undefined && questionText === undefined);
  } else if (kind === "question-added" || kind === "question-edited" || kind === "question-deleted") {
    if (CONFIRMATION_AI_KEYS.some(has)) ensure(has("runId") && has("itemKey") && has("aiEdited"));
  } else if (kind === "question-restored") {
    ensure(questionKey !== undefined);
    if (CONFIRMATION_AI_KEYS.some(has)) ensure(has("runId") && has("itemKey"));
  } else if (kind === "regenerated") {
    ensure(!(has("instruction") && has("instructionSource")));
    ensure(keys.instructionSource === undefined || keys.instructionSource === "default-task");
  }
  return Object.fromEntries(Object.entries(keys).filter(([, entry]) => entry !== undefined)) as GovernanceEventAiKeys;
}

/**
 * Validates one governance event against the closed schema and returns a frozen
 * normalised copy. Only the keys the schema declares survive, and an AI key only on
 * a kind the Phase 15 amendment allows it on.
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
  const aiKeys = parseAiKeys(value, value.kind, questionKey, questionText);
  return Object.freeze({
    schemaVersion: GOVERNANCE_LOG_SCHEMA_VERSION as 1,
    kind: value.kind,
    at: instant(value.at),
    by: boundedString(value.by, MAX_ACTOR_LENGTH),
    ...(reason === undefined ? {} : { reason }),
    ...(questionKey === undefined ? {} : { questionKey }),
    ...(questionText === undefined ? {} : { questionText }),
    ...(explanation === undefined ? {} : { explanation }),
    ...aiKeys,
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
 * The events a Requestor's history may hold (Phase 15 D-26, D-07). Pure; the scope module's Requestor projection
 * calls it before narrowing each event to its `kind`, `at` and `explanation`.
 *
 * - Every `ai-proposal` is dropped: the Requestor never learns the AI was asked.
 * - A confirmation (an event with `runId` and `itemKey` and no `aiUndo`) and its Undo (the first later event of the
 *   same run and item with `aiUndo`) are both dropped when no `released` event lies between them: the Requestor never
 *   saw that change, so it leaves no trace. A pair a release splits stays, and each reads as an ordinary change.
 * - Every AI key is removed from the events kept.
 */
export function projectGovernanceEventsForRequestor(events: readonly GovernanceEvent[]): GovernanceEvent[] {
  const dropped = new Set<number>();
  events.forEach((confirmation, index) => {
    if (confirmation.runId === undefined || confirmation.itemKey === undefined || confirmation.aiUndo !== undefined) return;
    for (let later = index + 1; later < events.length; later += 1) {
      const candidate = events[later]!;
      if (candidate.kind === "released") return;
      if (candidate.aiUndo === true && !dropped.has(later) && candidate.runId === confirmation.runId && candidate.itemKey === confirmation.itemKey) {
        dropped.add(index);
        dropped.add(later);
        return;
      }
    }
  });
  return events
    .filter((event, index) => event.kind !== "ai-proposal" && !dropped.has(index))
    .map((event) => {
      const kept: RecordValue = { ...event };
      for (const key of GOVERNANCE_AI_KEYS) delete kept[key];
      return Object.freeze(kept) as GovernanceEvent;
    });
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
