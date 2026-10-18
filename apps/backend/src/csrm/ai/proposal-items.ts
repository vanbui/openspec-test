/*
 * The generic AI proposal item core (Phase 15 D-20, D-24; the approved Phase 15 amendment to
 * docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Decision event v2 and item states").
 *
 * A run's proposal is immutable and its `decisions` are append-only. An item's state is never stored: it is a pure fold
 * of the run's decision events v2 over the proposal's item keys. The core knows nothing about questions: a target kind
 * supplies its own payload parsers (`DecisionPayloadParsers`), the questionnaire today and Phases 16 and 17's risk and
 * assessment items later, so there is one item mechanism.
 *
 * Fail-safe direction: a stored log that does not parse, or a fold that meets an event naming an unknown item or a
 * transition that is not legal (a no-op is never stored, so a stored one is illegal too), makes the whole run damaged
 * (null). A damaged run counts no open item, and none of its items can be confirmed or restored. Nothing here throws
 * on a read path.
 */

type RecordValue = Record<string, unknown>;

export const PROPOSAL_ITEM_STATES = Object.freeze(["open", "accepted", "rejected", "superseded", "lapsed"] as const);
export type ProposalItemState = (typeof PROPOSAL_ITEM_STATES)[number];

export const DECISION_ACTIONS = Object.freeze(["accepted", "rejected", "restored", "superseded", "lapsed"] as const);
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const DECISION_EVENT_SCHEMA_VERSION = 2;
/* `AI_RUN_BOUNDS.decisionEvents`, restated so the core imports nothing from a content-type API. */
export const DECISION_EVENTS_MAX = 5_000;
export const PROPOSAL_ITEMS_MAX = 30;
export const DECISION_EDITS_MAX = 10;
export const DECISION_REASON_MAX_LENGTH = 500;
const ACTOR_MAX_LENGTH = 255;
const RUN_ID_MAX_LENGTH = 255;
const INSTANT_MAX_LENGTH = 64;

/** `i-1` to `i-30`. */
export function isProposalItemKey(value: unknown): value is string {
  return typeof value === "string" && /^i-([1-9]|[12][0-9]|30)$/.test(value);
}

/*
 * Why an item closed without a decision. Phase 15's two causes, and Phase 16's two (the Phase 16 amendment, "Decisions
 * and item states"): a withdrawn Risk supersedes the open units of its rewrite runs, and an assessment that stopped
 * being editable lapses a completing run's items.
 */
export type DecisionCause =
  | { kind: "newer-rewrite"; runId: string }
  | { kind: "questionnaire-frozen" }
  | { kind: "risk-withdrawn"; riskDocumentId: string }
  | { kind: "assessment-not-editable" };

export type DecisionEventV2<TBefore, TApplied> = {
  schemaVersion: 2;
  at: string;
  by: string;
  item: string;
  action: DecisionAction;
  edits?: string[];
  reason?: string;
  cause?: DecisionCause;
  before?: TBefore;
  applied?: TApplied;
};

/**
 * What a target kind supplies: the field names an analyst may edit before confirming (empty when the target offers no
 * edit, so any `edits` is malformed), and parsers for the `before` snapshot (on the accept of a change or removal) and
 * the `applied` fact. Each returns the parsed payload or null. `itemKey` validates the target's item keys; absent, the
 * questionnaire's `i-1` to `i-30` apply (Phase 16 D-39: one item core, item keys per target).
 */
export type DecisionPayloadParsers<TBefore, TApplied> = {
  editFields: readonly string[];
  before: (value: unknown) => TBefore | null;
  applied: (value: unknown) => TApplied | null;
  itemKey?: (value: unknown) => boolean;
  /** The cause kinds this target's runs record (BE2-14); absent: every kind, each with its one action. */
  causes?: readonly DecisionCause["kind"][];
};

const EVENT_KEYS = ["schemaVersion", "at", "by", "item", "action", "edits", "reason", "cause", "before", "applied"] as const;

class MalformedEvent extends Error {}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new MalformedEvent();
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) throw new MalformedEvent();
  return value.trim();
}

function instant(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > INSTANT_MAX_LENGTH || Number.isNaN(Date.parse(value))) throw new MalformedEvent();
  return value;
}

function isDecisionAction(value: unknown): value is DecisionAction {
  return typeof value === "string" && (DECISION_ACTIONS as readonly string[]).includes(value);
}

function parseEdits(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > DECISION_EDITS_MAX) throw new MalformedEvent();
  if (!value.every((field) => typeof field === "string" && allowed.includes(field))) throw new MalformedEvent();
  if (new Set(value).size !== value.length) throw new MalformedEvent();
  return [...(value as string[])];
}

/*
 * One cause per action: a supersession names the newer rewrite run or the withdrawn Risk; a lapse names the frozen
 * questionnaire or the assessment that is no longer editable (the Phase 15 and Phase 16 amendments). Any other pairing
 * is malformed.
 */
function parseCause(value: unknown, action: DecisionAction): DecisionCause {
  if (!isRecord(value)) throw new MalformedEvent();
  if (value.kind === "newer-rewrite" && action === "superseded") {
    exactKeys(value, ["kind", "runId"]);
    return Object.freeze({ kind: "newer-rewrite", runId: boundedString(value.runId, RUN_ID_MAX_LENGTH) });
  }
  if (value.kind === "risk-withdrawn" && action === "superseded") {
    exactKeys(value, ["kind", "riskDocumentId"]);
    return Object.freeze({ kind: "risk-withdrawn", riskDocumentId: boundedString(value.riskDocumentId, RUN_ID_MAX_LENGTH) });
  }
  if (value.kind === "questionnaire-frozen" && action === "lapsed") {
    exactKeys(value, ["kind"]);
    return Object.freeze({ kind: "questionnaire-frozen" });
  }
  if (value.kind === "assessment-not-editable" && action === "lapsed") {
    exactKeys(value, ["kind"]);
    return Object.freeze({ kind: "assessment-not-editable" });
  }
  throw new MalformedEvent();
}

function payload<T>(value: unknown, parse: (value: unknown) => T | null): T {
  let parsed: T | null;
  try {
    parsed = parse(value);
  } catch {
    parsed = null;
  }
  if (parsed === null) throw new MalformedEvent();
  return parsed;
}

function parseEvent<TBefore, TApplied>(value: unknown, parsers: DecisionPayloadParsers<TBefore, TApplied>): DecisionEventV2<TBefore, TApplied> {
  if (!isRecord(value)) throw new MalformedEvent();
  exactKeys(value, EVENT_KEYS);
  if (value.schemaVersion !== DECISION_EVENT_SCHEMA_VERSION) throw new MalformedEvent();
  const isItemKey = parsers.itemKey ?? isProposalItemKey;
  if (typeof value.item !== "string" || !isItemKey(value.item) || !isDecisionAction(value.action)) throw new MalformedEvent();
  const action = value.action;
  // Each optional key belongs to the actions the amendment gives it.
  if (value.edits !== undefined && action !== "accepted") throw new MalformedEvent();
  if (value.before !== undefined && action !== "accepted") throw new MalformedEvent();
  if (value.applied !== undefined && action !== "accepted" && action !== "restored") throw new MalformedEvent();
  if (value.reason !== undefined && action !== "rejected") throw new MalformedEvent();
  const closing = action === "superseded" || action === "lapsed";
  if ((value.cause !== undefined) !== closing) throw new MalformedEvent();
  const edits = value.edits === undefined ? undefined : parseEdits(value.edits, parsers.editFields);
  const reason = value.reason === undefined ? undefined : boundedString(value.reason, DECISION_REASON_MAX_LENGTH);
  const cause = value.cause === undefined ? undefined : parseCause(value.cause, action);
  if (cause && parsers.causes && !parsers.causes.includes(cause.kind)) throw new MalformedEvent();
  const before = value.before === undefined ? undefined : payload(value.before, parsers.before);
  const applied = value.applied === undefined ? undefined : payload(value.applied, parsers.applied);
  return Object.freeze({
    schemaVersion: DECISION_EVENT_SCHEMA_VERSION as 2,
    at: instant(value.at),
    by: boundedString(value.by, ACTOR_MAX_LENGTH),
    item: value.item,
    action,
    ...(edits === undefined ? {} : { edits: Object.freeze(edits) as string[] }),
    ...(reason === undefined ? {} : { reason }),
    ...(cause === undefined ? {} : { cause }),
    ...(before === undefined ? {} : { before }),
    ...(applied === undefined ? {} : { applied }),
  });
}

/** One decision event v2, parsed closed: a frozen copy, or null on anything malformed. Never throws. */
export function parseDecisionEventV2<TBefore, TApplied>(value: unknown, parsers: DecisionPayloadParsers<TBefore, TApplied>): DecisionEventV2<TBefore, TApplied> | null {
  try {
    return parseEvent(value, parsers);
  } catch (error) {
    if (error instanceof MalformedEvent) return null;
    throw error;
  }
}

/**
 * A run's stored `decisions`, parsed closed. Absent or null is a run with no decision yet (an empty log). Anything
 * else malformed, a v1 event included, is null: the run is damaged. Never throws.
 */
export function parseDecisionEventsV2<TBefore, TApplied>(value: unknown, parsers: DecisionPayloadParsers<TBefore, TApplied>): readonly DecisionEventV2<TBefore, TApplied>[] | null {
  if (value === null || value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > DECISION_EVENTS_MAX) return null;
  const events: DecisionEventV2<TBefore, TApplied>[] = [];
  for (const entry of value) {
    const event = parseDecisionEventV2(entry, parsers);
    if (event === null) return null;
    events.push(event);
  }
  return Object.freeze(events);
}

/**
 * The amendment's transition table. `no-op` is a repeated identical decision: it succeeds, is counted as unchanged and
 * is never stored. `not-open` is refused with `AI_PROPOSAL_ALREADY_DECIDED`. Superseded and lapsed are final.
 */
export function nextState(state: ProposalItemState, action: DecisionAction, options: { withEdits: boolean }): ProposalItemState | "no-op" | "not-open" {
  switch (state) {
    case "open":
      return action === "restored" ? "no-op" : action;
    case "accepted":
      if (action === "accepted") return options.withEdits ? "not-open" : "no-op";
      return action === "restored" ? "open" : "not-open";
    case "rejected":
      if (action === "rejected") return "no-op";
      return action === "restored" ? "open" : "not-open";
    case "superseded":
    case "lapsed":
      return "not-open";
  }
}

/**
 * Each item's state, folded from its events in order, or null when the run is damaged: an event names an item the
 * proposal does not hold, or is not a legal transition (a stored no-op included).
 */
export function foldItemStates(itemKeys: readonly string[], events: readonly Pick<DecisionEventV2<unknown, unknown>, "item" | "action" | "edits">[]): ReadonlyMap<string, ProposalItemState> | null {
  const states = new Map<string, ProposalItemState>(itemKeys.map((key) => [key, "open"]));
  for (const event of events) {
    const current = states.get(event.item);
    if (current === undefined) return null;
    const next = nextState(current, event.action, { withEdits: (event.edits?.length ?? 0) > 0 });
    if (next === "no-op" || next === "not-open") return null;
    states.set(event.item, next);
  }
  return states;
}

/** The open items of a folded run, in proposal order. A damaged run (null) has none. */
export function openItemKeys(states: ReadonlyMap<string, ProposalItemState> | null): string[] {
  if (states === null) return [];
  return [...states].filter(([, state]) => state === "open").map(([key]) => key);
}
