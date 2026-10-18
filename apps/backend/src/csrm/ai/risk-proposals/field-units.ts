/*
 * The generic field-change units (Phase 16 D-34 to D-38; the approved Phase 16 amendment to
 * docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Risk proposal envelope v1").
 *
 * An operation that proposes new values for a Risk's AI-writable fields proposes them as units: fields that derive
 * from one another are one unit, decided together, so a Risk never holds an inconsistent combination (D-36). The
 * ratings travel with their derivation, the information asset with its classification, and an AI-proposed Accept with
 * its plan. A unit's `base` is what the Risk held when the context was built; a unit is stale exactly when any of its
 * fields no longer holds its base (D-37).
 *
 * The mechanism is generic: it names no operation, so any operation that proposes field changes to a Risk (today's
 * targeted rewrite, Phase 17's reassessment) reuses one set of units, one staleness check and one Accept rule (S-11).
 * The Accept rule reads Phase 12's `acceptProposalAllowed`, the one configuration point Phase 22 takes over, and the
 * caller's planned-control boolean from Phase 12's `riskHasPlannedControl`; there is no second predicate (D-38).
 */
import { RISK_AI_FIELDS } from "../../../api/csrm-assessment/services/ai-provenance";
import { normaliseHistoryValue } from "../../risk-history-changes";
import { acceptProposalAllowed, deriveRating, isConsequence, isLikelihood, isRiskRating, type RiskRating } from "../../risk-scale";

export type RiskAiField = (typeof RISK_AI_FIELDS)[number];

/** The parts of a Risk a targeted operation may focus on (absent focus means all three). */
export const FOCUS_PARTS = Object.freeze(["statement", "ratings", "treatment"] as const);
export type FocusPart = (typeof FOCUS_PARTS)[number];

export type RiskUnitDefinition = { readonly fields: readonly RiskAiField[]; readonly focus: FocusPart };

const unit = (focus: FocusPart, ...fields: RiskAiField[]): RiskUnitDefinition => Object.freeze({ fields: Object.freeze(fields), focus });

/**
 * The approved units, keyed by their item key `u-{unit}`, each with its fields in order and its focus part. Apart from
 * `u-treatment` (action and plan together, formed only when the action changes to Accept), every AI-writable field is
 * in exactly one unit.
 */
export const RISK_UNIT_DEFINITIONS = Object.freeze({
  "u-risk-type": unit("statement", "riskType"),
  "u-issue-statement": unit("statement", "issueStatement"),
  "u-risk-statement": unit("statement", "riskStatement"),
  "u-risk-category": unit("statement", "riskCategory"),
  "u-risk-sub-category": unit("statement", "riskSubCategory"),
  "u-risk-cause": unit("statement", "riskCause"),
  "u-potential-impact": unit("statement", "potentialImpact"),
  "u-information-system": unit("statement", "informationSystemImpacted"),
  "u-information-asset": unit("statement", "informationAssetImpacted", "dataClassification"),
  "u-inherent-rating": unit("ratings", "inherentLikelihood", "highestInherentConsequence", "inherentRating"),
  "u-inherent-rating-rationale": unit("ratings", "inherentRatingRationale"),
  "u-residual-rating": unit("ratings", "residualLikelihood", "highestResidualConsequence", "residualRating"),
  "u-residual-rating-rationale": unit("ratings", "residualRatingRationale"),
  "u-treatment": unit("treatment", "treatmentAction", "treatmentPlan"),
  "u-treatment-action": unit("treatment", "treatmentAction"),
  "u-treatment-plan": unit("treatment", "treatmentPlan"),
} as const);

export type RiskUnitKey = keyof typeof RISK_UNIT_DEFINITIONS;

export function isRiskUnitKey(value: unknown): value is RiskUnitKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RISK_UNIT_DEFINITIONS, value);
}

/** A unit field's value as the Risk update path stores it: a trimmed non-empty string, a relation as its documentId, or null. */
export type UnitValue = string | null;
export type UnitValues = Readonly<Record<string, UnitValue>>;

/** One proposed unit: its key, its fields in order, what the Risk held (`base`) and what is proposed. */
export type ChangeUnit = {
  readonly key: RiskUnitKey;
  readonly fields: readonly RiskAiField[];
  readonly base: UnitValues;
  readonly proposed: UnitValues;
  /** Set on `u-treatment`: the unit proposes the Accept treatment action. */
  readonly aiAccept?: true;
};

export type DroppedUnitCode = "no-change" | "outside-focus";
export type DroppedUnit = { readonly key: RiskUnitKey; readonly code: DroppedUnitCode };
export type UnitAdjustment = { readonly code: DroppedUnitCode; readonly count: number; readonly detail: string };

const ADJUSTMENT_DETAIL: Readonly<Record<DroppedUnitCode, (count: number) => string>> = {
  "no-change": (count) => `${count} ${count === 1 ? "part of the risk was" : "parts of the risk were"} proposed unchanged and left out.`,
  "outside-focus": (count) => `${count} proposed ${count === 1 ? "change was" : "changes were"} outside the requested focus and left out.`,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The values of `fields` on `risk`, normalised as the Risk update path stores them and as the history compares them
 * (strings trimmed, an empty string as null, a relation by its documentId, a date as `YYYY-MM-DD`).
 */
export function normaliseRiskValues(risk: unknown, fields: readonly string[]): Record<string, UnitValue> {
  const source = isRecord(risk) ? risk : {};
  return Object.fromEntries(fields.map((field) => {
    const value = normaliseHistoryValue(field, source[field]);
    if (value === null) return [field, null];
    if (typeof value === "object") return [field, value.documentId];
    return [field, String(value)];
  }));
}

function sameValues(fields: readonly string[], left: UnitValues, right: UnitValues): boolean {
  return fields.every((field) => left[field] === right[field]);
}

/* A rating unit keeps its derivation: the rating is the one Phase 12's scale derives from the likelihood and consequence. */
function withDerivedRating(values: Record<string, UnitValue>, likelihood: string, consequence: string, rating: string): void {
  const likelihoodValue = values[likelihood];
  const consequenceValue = values[consequence];
  if (isLikelihood(likelihoodValue) && isConsequence(consequenceValue)) values[rating] = deriveRating(likelihoodValue, consequenceValue);
}

/**
 * The units a proposal forms against the Risk's base, in definition order. A unit whose proposed values equal its base
 * is dropped as `no-change`; a changed unit outside `focus` (absent or empty: every part) is dropped as
 * `outside-focus`. A proposed Accept that differs from the base forms `u-treatment` with the plan (and `aiAccept`);
 * otherwise the action and the plan are separate units. A field the proposal does not name keeps its base value.
 */
export function diffIntoUnits(
  base: unknown,
  proposed: unknown,
  options: { focus?: readonly FocusPart[] } = {},
): { units: ChangeUnit[]; dropped: DroppedUnit[]; adjustments: UnitAdjustment[] } {
  const baseValues = normaliseRiskValues(base, RISK_AI_FIELDS);
  const proposedSource = isRecord(proposed) ? proposed : {};
  const proposedValues: Record<string, UnitValue> = { ...baseValues };
  for (const field of RISK_AI_FIELDS) {
    if (proposedSource[field] !== undefined) proposedValues[field] = normaliseRiskValues(proposedSource, [field])[field];
  }
  withDerivedRating(proposedValues, "inherentLikelihood", "highestInherentConsequence", "inherentRating");
  withDerivedRating(proposedValues, "residualLikelihood", "highestResidualConsequence", "residualRating");
  const focus = new Set<FocusPart>(options.focus && options.focus.length > 0 ? options.focus : FOCUS_PARTS);
  const acceptChange = proposedValues.treatmentAction === "Accept" && baseValues.treatmentAction !== "Accept";
  const units: ChangeUnit[] = [];
  const dropped: DroppedUnit[] = [];
  for (const [key, definition] of Object.entries(RISK_UNIT_DEFINITIONS) as [RiskUnitKey, RiskUnitDefinition][]) {
    const separateTreatment = key === "u-treatment-action" || key === "u-treatment-plan";
    if (key === "u-treatment" ? !acceptChange : acceptChange && separateTreatment) continue;
    const unitBase: UnitValues = Object.freeze(Object.fromEntries(definition.fields.map((field) => [field, baseValues[field]])));
    const unitProposed: UnitValues = Object.freeze(Object.fromEntries(definition.fields.map((field) => [field, proposedValues[field]])));
    if (sameValues(definition.fields, unitBase, unitProposed)) {
      dropped.push({ key, code: "no-change" });
    } else if (!focus.has(definition.focus)) {
      dropped.push({ key, code: "outside-focus" });
    } else {
      units.push(Object.freeze({
        key,
        fields: definition.fields,
        base: unitBase,
        proposed: unitProposed,
        ...(key === "u-treatment" ? { aiAccept: true as const } : {}),
      }));
    }
  }
  const adjustments = (["no-change", "outside-focus"] as const).flatMap((code) => {
    const count = dropped.filter((entry) => entry.code === code).length;
    return count === 0 ? [] : [{ code, count, detail: ADJUSTMENT_DETAIL[code](count) }];
  });
  return { units, dropped, adjustments };
}

/** Whether the Risk no longer holds the unit's base in any of its fields, compared after normalisation. */
export function isUnitStale(unit: ChangeUnit, current: unknown): boolean {
  return !sameValues(unit.fields, unit.base, normaliseRiskValues(current, unit.fields));
}

/** The values confirming the unit writes through the Risk update path. A restore writes the decision event's `before` instead. */
export function unitApplyValues(unit: ChangeUnit): Record<string, UnitValue> {
  return Object.fromEntries(unit.fields.map((field) => [field, unit.proposed[field] ?? null]));
}

/**
 * The residual rating the Risk would hold with the units' proposed values applied over its current values in order,
 * derived through Phase 12's scale; the stored rating when the likelihood or consequence is missing; null when neither
 * gives a rating.
 */
export function residualRatingAfter(current: unknown, units: readonly ChangeUnit[]): RiskRating | null {
  const values = normaliseRiskValues(current, RISK_AI_FIELDS);
  for (const change of units) for (const field of change.fields) values[field] = change.proposed[field] ?? null;
  const likelihood = values.residualLikelihood;
  const consequence = values.highestResidualConsequence;
  if (isLikelihood(likelihood) && isConsequence(consequence)) return deriveRating(likelihood, consequence);
  return isRiskRating(values.residualRating) ? values.residualRating : null;
}

export type AiAcceptRefusal = "accept-not-permitted" | "accept-with-planned-control";

/**
 * The one Accept rule for an AI-proposed Accept (D-38, G-14): not permitted with a residual rating Phase 12 does not
 * allow to be accepted (High or Critical, or none) or without a plan; not while the Risk has a planned control
 * implementation (`hasPlannedControl`, from Phase 12's `riskHasPlannedControl`). Null when the Accept may stand.
 */
export function aiAcceptCheck(input: { residualRating: unknown; plan: unknown; hasPlannedControl: boolean }): AiAcceptRefusal | null {
  if (!isRiskRating(input.residualRating) || !acceptProposalAllowed(input.residualRating)) return "accept-not-permitted";
  if (typeof input.plan !== "string" || input.plan.trim().length === 0) return "accept-not-permitted";
  if (input.hasPlannedControl) return "accept-with-planned-control";
  return null;
}
