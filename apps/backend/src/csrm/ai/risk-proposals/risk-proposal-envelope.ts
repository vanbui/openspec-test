/*
 * The risk proposal envelope v1 and the Risk decision payloads (Phase 16 D-39 to D-41; the approved Phase 16
 * amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Risk proposal envelope v1" and
 * "Decisions and item states").
 *
 * The two Risk operations, `risk-suggestions` and `risk-rewrite`, store this envelope once in the run's `proposal`.
 * Their decisions are Phase 15's decision event v2, folded by the one item core (`../proposal-items`): this module
 * supplies only the Risk item keys and payload parsers. No item state is stored; an item's state is always the fold
 * (Orchestrator Confirmation "One proposal model, Phase 15's").
 *
 * Every parser is closed and fail-safe: anything malformed is null, and nothing here throws on a read path. A reader
 * chooses this parser by the run's `operation`, never by `schemaVersion`.
 */
import { parseAssessmentRiskDraft, type AssessmentRiskDraftProposal } from "../../../api/csrm-assessment/services/assessment-draft-provider";
import { isRiskAiFieldFact, RISK_STATEMENT_FIELDS, type AiFieldFact } from "../../../api/csrm-assessment/services/ai-provenance";
import type { AssessmentContextAllowedSets } from "../assessment-context";
import { parseDecisionEventsV2, type DecisionEventV2, type DecisionPayloadParsers } from "../proposal-items";
import { deriveRating, isConsequence, isLikelihood } from "../../risk-scale";
import { isRiskUnitKey, RISK_UNIT_DEFINITIONS, type RiskUnitKey } from "./field-units";

export const RISK_PROPOSAL_SCHEMA_VERSION = 1;
export const RISK_PROPOSAL_OPERATIONS = Object.freeze(["risk-suggestions", "risk-rewrite"] as const);
export type RiskProposalOperation = (typeof RISK_PROPOSAL_OPERATIONS)[number];
export const RISK_PROPOSAL_OUTCOMES = Object.freeze(["items", "no-change"] as const);
export type RiskProposalOutcome = (typeof RISK_PROPOSAL_OUTCOMES)[number];

/** The thirteen approved adjustment codes. */
export const RISK_PROPOSAL_ADJUSTMENT_CODES = Object.freeze([
  "near-duplicate-active",
  "near-duplicate-withdrawn",
  "near-duplicate-rejected",
  "near-duplicate-proposed",
  "invalid-item",
  "over-limit",
  "accept-not-permitted",
  "accept-with-planned-control",
  "sources-dropped",
  "suggestions-dropped",
  "suggestions-capped",
  "outside-focus",
  "no-change",
] as const);
export type RiskProposalAdjustmentCode = (typeof RISK_PROPOSAL_ADJUSTMENT_CODES)[number];

/** Suggestions kept per run (`s-1` to `s-8`). */
export const RISK_SUGGESTIONS_MAX = 8;

export const RISK_PROPOSAL_BOUNDS = Object.freeze({
  adjustments: 60,
  adjustmentDetail: 500,
  documentId: 255,
  sources: 100,
  sourceKey: 255,
  uncited: 5,
  uncitedClaim: 300,
  runId: 255,
});

const SIMILAR_RECORD_KINDS = Object.freeze(["active", "withdrawn"] as const);
const SIMILAR_ITEM_KINDS = Object.freeze(["rejected", "open"] as const);

export type RiskSimilarity =
  | { kind: (typeof SIMILAR_RECORD_KINDS)[number]; riskDocumentId: string; score: number }
  | { kind: (typeof SIMILAR_ITEM_KINDS)[number]; runId: string; itemKey: string; score: number };

export type RiskSuggestionItem = {
  key: string;
  kind: "risk";
  proposed: AssessmentRiskDraftProposal;
  similarTo: RiskSimilarity | null;
};

/** A unit field's value as the Risk update path stores it: a trimmed non-empty string (a relation as its documentId) or null. */
export type RiskUnitValue = string | null;
export type RiskUnitValues = Readonly<Record<string, RiskUnitValue>>;

export type RiskChangeUnitItem = {
  key: RiskUnitKey;
  kind: "change";
  riskDocumentId: string;
  fields: readonly string[];
  base: RiskUnitValues;
  proposed: RiskUnitValues;
  sources?: readonly string[];
  uncited?: readonly string[];
  aiAccept?: true;
};

export type RiskProposalItem = RiskSuggestionItem | RiskChangeUnitItem;

export type RiskProposalAdjustment = { code: RiskProposalAdjustmentCode; wireIndex?: number; count?: number; detail: string };

export type RiskProposalV1 = {
  schemaVersion: 1;
  operation: RiskProposalOperation;
  outcome: RiskProposalOutcome;
  items: readonly RiskProposalItem[];
  adjustments: readonly RiskProposalAdjustment[];
};

/**
 * The adapter's gate: with these, every record a suggestion names must be one the context offered (Phase 12's
 * context-aware draft risk parser), every unit source must be a context source, and every unit must target
 * `riskDocumentId` when it is given.
 */
export type RiskProposalAllowedSets = { context: AssessmentContextAllowedSets; riskDocumentId?: string };

/** The `before` snapshot on the accept of a unit: the values and per-field facts an Undo restores. */
export type RiskDecisionBefore = { riskDocumentId: string; values: RiskUnitValues; fieldFacts: Readonly<Record<string, AiFieldFact | null>> };
/** The `applied` fact: the values a confirmed or restored unit wrote, or the Risk an added suggestion created. */
export type RiskDecisionApplied = { riskDocumentId: string; values?: RiskUnitValues };
export type RiskDecisionEvent = DecisionEventV2<RiskDecisionBefore, RiskDecisionApplied>;

type RecordValue = Record<string, unknown>;

class MalformedRiskProposal extends Error {}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, allowed: readonly string[], required: readonly string[] = allowed): RecordValue {
  if (!isRecord(value)) throw new MalformedRiskProposal();
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new MalformedRiskProposal();
  if (required.some((key) => value[key] === undefined)) throw new MalformedRiskProposal();
  return value;
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) throw new MalformedRiskProposal();
  return value.trim();
}

function boundedArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new MalformedRiskProposal();
  return value;
}

function closed<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new MalformedRiskProposal();
  return value as T;
}

function positiveOrZeroInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new MalformedRiskProposal();
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

/** `s-1` to `s-8`, a suggestion item's key. */
export function isRiskSuggestionKey(value: unknown): value is string {
  return typeof value === "string" && /^s-[1-8]$/.test(value);
}

/** A Risk proposal item key: a suggestion key or a unit key of `RISK_UNIT_DEFINITIONS`. */
export function isRiskProposalItemKey(value: unknown): boolean {
  return isRiskSuggestionKey(value) || isRiskUnitKey(value);
}

function unitValue(value: unknown): RiskUnitValue {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) throw new MalformedRiskProposal();
  return value;
}

/* Values holding exactly `fields`, each normalised as the Risk update path stores it. */
function parseUnitValues(value: unknown, fields: readonly string[]): RiskUnitValues {
  const values = exactKeys(value, fields, []);
  if (fields.some((field) => !(field in values))) throw new MalformedRiskProposal();
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, unitValue(values[field])])));
}

/* The unit whose fields are exactly the keys of `value`, for payloads that do not name their item. */
function unitFieldsOf(value: unknown): readonly string[] {
  if (!isRecord(value)) throw new MalformedRiskProposal();
  const keys = Object.keys(value);
  const definition = Object.values(RISK_UNIT_DEFINITIONS).find((candidate) => candidate.fields.length === keys.length && candidate.fields.every((field) => keys.includes(field)));
  if (!definition) throw new MalformedRiskProposal();
  return definition.fields;
}

function parseSimilarity(value: unknown): RiskSimilarity | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new MalformedRiskProposal();
  const score = value.score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) throw new MalformedRiskProposal();
  if ((SIMILAR_RECORD_KINDS as readonly unknown[]).includes(value.kind)) {
    const similarity = exactKeys(value, ["kind", "riskDocumentId", "score"]);
    return Object.freeze({
      kind: closed(similarity.kind, SIMILAR_RECORD_KINDS),
      riskDocumentId: boundedString(similarity.riskDocumentId, RISK_PROPOSAL_BOUNDS.documentId),
      score,
    });
  }
  const similarity = exactKeys(value, ["kind", "runId", "itemKey", "score"]);
  if (!isRiskSuggestionKey(similarity.itemKey)) throw new MalformedRiskProposal();
  return Object.freeze({
    kind: closed(similarity.kind, SIMILAR_ITEM_KINDS),
    runId: boundedString(similarity.runId, RISK_PROPOSAL_BOUNDS.runId),
    itemKey: similarity.itemKey,
    score,
  });
}

function parseSuggestion(value: unknown, index: number, allowed?: RiskProposalAllowedSets): RiskSuggestionItem {
  const item = exactKeys(value, ["key", "kind", "proposed", "similarTo"]);
  // Keyed s-1 to s-8 in the order CSRM kept them; each holds one Risk in Phase 12's draft risk v2 shape.
  if (item.kind !== "risk" || !isRiskSuggestionKey(item.key) || item.key !== `s-${index + 1}`) throw new MalformedRiskProposal();
  let proposed: AssessmentRiskDraftProposal;
  try {
    proposed = parseAssessmentRiskDraft(item.proposed, allowed?.context ?? null, index);
  } catch {
    throw new MalformedRiskProposal();
  }
  return Object.freeze({ key: item.key, kind: "risk", proposed: deepFreeze(structuredClone(proposed)), similarTo: parseSimilarity(item.similarTo) });
}

/*
 * Read when a unit is parsed, not when this module loads: the run record (ai-run-record.ts) reads this module and
 * ai-provenance.ts reads the run record, so a module-level copy could be taken before RISK_STATEMENT_FIELDS is defined.
 */
const isStatementField = (field: string): boolean => (RISK_STATEMENT_FIELDS as readonly string[]).includes(field);

/* A rating unit's proposed values hold a likelihood, a consequence and the rating Phase 12's scale derives from them. */
function assertDerivedRating(proposed: RiskUnitValues, likelihood: string, consequence: string, rating: string): void {
  const likelihoodValue = proposed[likelihood];
  const consequenceValue = proposed[consequence];
  if (!isLikelihood(likelihoodValue) || !isConsequence(consequenceValue) || proposed[rating] !== deriveRating(likelihoodValue, consequenceValue)) {
    throw new MalformedRiskProposal();
  }
}

function parseUnit(value: unknown, allowed?: RiskProposalAllowedSets): RiskChangeUnitItem {
  const item = exactKeys(value, ["key", "kind", "riskDocumentId", "fields", "base", "proposed", "sources", "uncited", "aiAccept"], ["key", "kind", "riskDocumentId", "fields", "base", "proposed"]);
  if (item.kind !== "change" || !isRiskUnitKey(item.key)) throw new MalformedRiskProposal();
  const key = item.key;
  const definition = RISK_UNIT_DEFINITIONS[key];
  const fields = boundedArray(item.fields, definition.fields.length);
  if (fields.length !== definition.fields.length || fields.some((field, index) => field !== definition.fields[index])) throw new MalformedRiskProposal();
  const riskDocumentId = boundedString(item.riskDocumentId, RISK_PROPOSAL_BOUNDS.documentId);
  if (allowed?.riskDocumentId !== undefined && riskDocumentId !== allowed.riskDocumentId) throw new MalformedRiskProposal();
  const base = parseUnitValues(item.base, definition.fields);
  const proposed = parseUnitValues(item.proposed, definition.fields);
  if (key === "u-inherent-rating") assertDerivedRating(proposed, "inherentLikelihood", "highestInherentConsequence", "inherentRating");
  if (key === "u-residual-rating") assertDerivedRating(proposed, "residualLikelihood", "highestResidualConsequence", "residualRating");
  // A change to Accept travels with its plan as `u-treatment`, flagged `aiAccept`; the action alone only ever proposes Treat.
  if (key === "u-treatment" && (proposed.treatmentAction !== "Accept" || item.aiAccept !== true)) throw new MalformedRiskProposal();
  if (key === "u-treatment-action" && proposed.treatmentAction !== "Treat") throw new MalformedRiskProposal();
  if (key !== "u-treatment" && item.aiAccept !== undefined) throw new MalformedRiskProposal();
  let sources: readonly string[] | undefined;
  if (item.sources !== undefined) {
    if (!definition.fields.some(isStatementField)) throw new MalformedRiskProposal();
    sources = Object.freeze(boundedArray(item.sources, RISK_PROPOSAL_BOUNDS.sources).map((source) => {
      const ref = boundedString(source, RISK_PROPOSAL_BOUNDS.sourceKey);
      if (ref !== source || (allowed && !allowed.context.sourceKeys.includes(ref))) throw new MalformedRiskProposal();
      return ref;
    }));
  }
  const uncited = item.uncited === undefined
    ? undefined
    : Object.freeze(boundedArray(item.uncited, RISK_PROPOSAL_BOUNDS.uncited).map((claim) => {
      if (typeof claim !== "string" || claim.length === 0 || claim.length > RISK_PROPOSAL_BOUNDS.uncitedClaim) throw new MalformedRiskProposal();
      return claim;
    }));
  return Object.freeze({
    key,
    kind: "change" as const,
    riskDocumentId,
    fields: Object.freeze([...definition.fields]),
    base,
    proposed,
    ...(sources === undefined ? {} : { sources }),
    ...(uncited === undefined ? {} : { uncited }),
    ...(key === "u-treatment" ? { aiAccept: true as const } : {}),
  });
}

function parseAdjustment(value: unknown): RiskProposalAdjustment {
  const adjustment = exactKeys(value, ["code", "wireIndex", "count", "detail"], ["code", "detail"]);
  const count = adjustment.count === undefined ? undefined : positiveOrZeroInteger(adjustment.count);
  if (count === 0) throw new MalformedRiskProposal();
  const wireIndex = adjustment.wireIndex === undefined ? undefined : positiveOrZeroInteger(adjustment.wireIndex);
  return Object.freeze({
    code: closed(adjustment.code, RISK_PROPOSAL_ADJUSTMENT_CODES),
    ...(wireIndex === undefined ? {} : { wireIndex }),
    ...(count === undefined ? {} : { count }),
    detail: boundedString(adjustment.detail, RISK_PROPOSAL_BOUNDS.adjustmentDetail),
  });
}

function parseEnvelope(value: unknown, allowed?: RiskProposalAllowedSets): RiskProposalV1 {
  const envelope = exactKeys(value, ["schemaVersion", "operation", "outcome", "items", "adjustments"]);
  if (envelope.schemaVersion !== RISK_PROPOSAL_SCHEMA_VERSION) throw new MalformedRiskProposal();
  const operation = closed(envelope.operation, RISK_PROPOSAL_OPERATIONS);
  const outcome = closed(envelope.outcome, RISK_PROPOSAL_OUTCOMES);
  let items: RiskProposalItem[];
  if (operation === "risk-suggestions") {
    items = boundedArray(envelope.items, RISK_SUGGESTIONS_MAX).map((item, index) => parseSuggestion(item, index, allowed));
  } else {
    const units = boundedArray(envelope.items, Object.keys(RISK_UNIT_DEFINITIONS).length).map((item) => parseUnit(item, allowed));
    // One Risk per rewrite, and no field in two units, so a run never makes its own units stale.
    if (new Set(units.map((unit) => unit.riskDocumentId)).size > 1) throw new MalformedRiskProposal();
    const fields = units.flatMap((unit) => unit.fields);
    if (new Set(fields).size !== fields.length) throw new MalformedRiskProposal();
    items = units;
  }
  if ((outcome === "no-change") !== (items.length === 0)) throw new MalformedRiskProposal();
  const adjustments = boundedArray(envelope.adjustments, RISK_PROPOSAL_BOUNDS.adjustments).map(parseAdjustment);
  return Object.freeze({
    schemaVersion: RISK_PROPOSAL_SCHEMA_VERSION as 1,
    operation,
    outcome,
    items: Object.freeze(items),
    adjustments: Object.freeze(adjustments),
  });
}

/**
 * A stored risk proposal envelope v1, parsed closed: a frozen copy, or null on anything malformed. With `allowed`
 * (the adapter's gate), every record, source and target must be one the context offered. Never throws.
 */
export function parseRiskProposal(value: unknown, allowed?: RiskProposalAllowedSets): RiskProposalV1 | null {
  try {
    return parseEnvelope(value, allowed);
  } catch {
    return null;
  }
}

function parseBefore(value: unknown): RiskDecisionBefore {
  const before = exactKeys(value, ["riskDocumentId", "values", "fieldFacts"]);
  const fields = unitFieldsOf(before.values);
  const values = parseUnitValues(before.values, fields);
  const facts = exactKeys(before.fieldFacts, fields, []);
  if (fields.some((field) => !(field in facts))) throw new MalformedRiskProposal();
  const fieldFacts = Object.fromEntries(fields.map((field) => {
    const fact = facts[field];
    if (fact !== null && !isRiskAiFieldFact(field, fact)) throw new MalformedRiskProposal();
    return [field, fact === null ? null : deepFreeze(structuredClone(fact))];
  }));
  return Object.freeze({
    riskDocumentId: boundedString(before.riskDocumentId, RISK_PROPOSAL_BOUNDS.documentId),
    values,
    fieldFacts: Object.freeze(fieldFacts),
  });
}

function parseApplied(value: unknown): RiskDecisionApplied {
  const applied = exactKeys(value, ["riskDocumentId", "values"], ["riskDocumentId"]);
  const riskDocumentId = boundedString(applied.riskDocumentId, RISK_PROPOSAL_BOUNDS.documentId);
  if (applied.values === undefined) return Object.freeze({ riskDocumentId });
  return Object.freeze({ riskDocumentId, values: parseUnitValues(applied.values, unitFieldsOf(applied.values)) });
}

function nullOnMalformed<T>(parse: (value: unknown) => T): (value: unknown) => T | null {
  return (value) => {
    try {
      return parse(value);
    } catch {
      return null;
    }
  };
}

/**
 * The Risk payload parsers for the generic decision event v2: Risk item keys, no edits (Phase 16 offers no "Edit, then
 * confirm"; UI-D18), the `before` snapshot and the `applied` fact.
 */
export const riskDecisionPayloads: DecisionPayloadParsers<RiskDecisionBefore, RiskDecisionApplied> = Object.freeze({
  editFields: Object.freeze([]) as readonly string[],
  before: nullOnMalformed(parseBefore),
  applied: nullOnMalformed(parseApplied),
  itemKey: isRiskProposalItemKey,
  causes: Object.freeze(["newer-rewrite", "risk-withdrawn", "assessment-not-editable"] as const),
});

/** A risk proposal run's stored `decisions` (v2 only), or null when the run is damaged. Never throws. */
export function parseRiskDecisionEvents(value: unknown): readonly RiskDecisionEvent[] | null {
  return parseDecisionEventsV2(value, riskDecisionPayloads);
}
