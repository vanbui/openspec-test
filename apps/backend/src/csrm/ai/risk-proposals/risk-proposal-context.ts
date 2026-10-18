/*
 * The risk proposal part of an AI context (Phase 16 D-25, D-31, D-35; the approved Phase 16 amendment to
 * docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Context summary: risk proposal section" and "Bounds").
 *
 * "Suggest more risks" and "Rewrite this risk" build on Phase 12's context unchanged (its minimisation, the three prompt
 * slots, the data policy, the notes and files of Phases 13 and 14, Phase 15's instruction slot) and add only blocks
 * inside the reference data:
 *
 * - suggestions: `existingRisks` (the active Risks, "already in the assessment"), `withdrawnRisks` (with the analyst's
 *   reason) and `decidedSuggestions` (rejected ones with their reason, and open ones), each entry under a short key;
 * - a rewrite: `targetRisk` (its twenty AI-writable values, relations as short keys or names, and its control
 *   implementations by number, name and status) and `otherRisks` (the assessment's other active Risks).
 *
 * Short keys only (`existing-1`, `withdrawn-1`, `rejected-1`, `open-1`, `other-1`): never a Risk number, an owner, a
 * date or a documentId (G-3). Every value goes through the shared renderer, which writes it with `promptDataTag`, so a
 * statement, a reason or a cause is escaped data. Statements and causes listed are capped at 600 characters each; the
 * target's own values are sent whole, so the model sees what the Risk holds. More than 200 entries across the lists
 * makes the context too large: refused, never truncated (06.7 D-10, Pitfall 13).
 *
 * Pure: the loader reads the records; this module only shapes them.
 */
import { RISK_AI_FIELDS } from "../../../api/csrm-assessment/services/ai-provenance";
import { AssessmentContextTooLargeError, contextRecordKeys, type ContextSummaryRiskProposals } from "../assessment-context";
import type { PromptValue } from "../prompt-sections";
import { FOCUS_PARTS, normaliseRiskValues, type FocusPart } from "./field-units";
import type { DuplicateEntry } from "./risk-duplicates";
import type { RiskProposalOperation } from "./risk-proposal-envelope";

type Row = Record<string, unknown>;

export const RISK_PROPOSAL_CONTEXT_BOUNDS = Object.freeze({
  /** Entries listed across the existing, withdrawn, rejected and open lists (a rewrite: its other Risks). */
  entries: 200,
  /** Characters of a listed statement or cause. */
  listedTextCharacters: 600,
  /** Completed suggestion runs one context reads: the amendment's run bound (100) and one more. */
  runsRead: 101,
});

export const RISK_CONTEXT_TOO_LARGE_MESSAGE = "The AI context is too large. The assessment lists more than 200 risks and earlier suggestions, so they cannot all be sent.";

/** A Risk of the assessment as a context lists it: its Risk Type by name, its system and asset by documentId. */
export type RiskContextRisk = {
  documentId: string;
  riskTypeName: string | null;
  riskStatement: string | null;
  riskCause: string | null;
  informationSystem: string | null;
  informationAsset: string | null;
  withdrawalReason: string | null;
};
/** A suggestion of an earlier completed run, rejected (with the analyst's reason, if any) or still open. */
export type RiskContextSuggestion = { runId: string; itemKey: string; riskTypeName: string | null; riskStatement: string; riskCause: string; reason: string | null };
/** A control implementation of the rewrite's target. */
export type RiskContextControl = { controlNumber: string; name: string; status: string | null };

export type RiskProposalContextRecords = {
  operation: RiskProposalOperation;
  /** The request's selected systems and assets, which the context numbers (`system-{n}`, `asset-{n}`). */
  systems: readonly Row[];
  assets: readonly Row[];
  activeRisks: readonly RiskContextRisk[];
  withdrawnRisks: readonly RiskContextRisk[];
  rejectedSuggestions: readonly RiskContextSuggestion[];
  openSuggestions: readonly RiskContextSuggestion[];
  /** A rewrite's target: the Risk row as read (relations as `{ documentId, name }`) and its control implementations. */
  target?: { risk: Row; controls: readonly RiskContextControl[] } | null;
  /** A rewrite's focus: a non-empty unique subset of the focus parts, or absent for all three. */
  focus?: readonly FocusPart[] | null;
};

/** A listed entry as the prompt shows it (text capped), for the deterministic provider's rules. */
export type RiskListedEntry = { key: string; riskTypeName: string | null; riskStatement: string; riskCause: string };
/** What a short key names, which the adapter maps back to the record or item a suggestion resembles. */
export type RiskListedRef =
  | { kind: "active" | "withdrawn"; riskDocumentId: string }
  | { kind: "rejected" | "open"; runId: string; itemKey: string };

/** The target as the model is shown it, in the wire's own form: names and short keys, empty text as "". */
export type RiskTargetWireView = {
  riskTypeName: string | null;
  issueStatement: string; riskStatement: string; riskCategory: string; riskSubCategory: string;
  riskCause: string; potentialImpact: string;
  informationSystem: string | null; informationAsset: string | null;
  inherentLikelihood: string | null; highestInherentConsequence: string | null; inherentRatingRationale: string;
  residualLikelihood: string | null; highestResidualConsequence: string | null; residualRatingRationale: string;
  treatmentAction: string | null; treatmentPlan: string;
};

export type RiskRewriteTarget = {
  riskDocumentId: string;
  /** The twenty AI-writable values as the Risk update path stores them, captured when the context was built (D-37). */
  base: Readonly<Record<string, string | null>>;
  wire: RiskTargetWireView;
  controls: readonly RiskContextControl[];
};

export type RiskProposalContextAllowed = {
  operation: RiskProposalOperation;
  listed: { existing: RiskListedEntry[]; withdrawn: RiskListedEntry[]; rejected: RiskListedEntry[]; open: RiskListedEntry[]; other: RiskListedEntry[] };
  /** The duplicate classifier's pools, keyed by short key, on the full statement and cause (D-32). */
  pools: { active: DuplicateEntry[]; withdrawn: DuplicateEntry[]; rejected: DuplicateEntry[]; open: DuplicateEntry[] };
  refs: ReadonlyMap<string, RiskListedRef>;
  target: RiskRewriteTarget | null;
  focus: FocusPart[] | null;
  /** Risk Types the builder keeps on offer whatever the ranking: the rewrite target's own. */
  pinnedRiskTypeIds: string[];
};

export type RiskProposalContextPart = { reference: PromptValue[]; summary: ContextSummaryRiskProposals; allowed: RiskProposalContextAllowed };

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const capped = (value: unknown): string => text(value).slice(0, RISK_PROPOSAL_CONTEXT_BOUNDS.listedTextCharacters);
const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => record(value) && typeof value.documentId === "string" && value.documentId ? value.documentId : typeof value === "string" && value ? value : null;
const relationName = (value: unknown): string | null => record(value) && typeof value.name === "string" && value.name.trim() ? value.name.trim() : null;
const nullableText = (value: unknown): string | null => text(value) || null;

/** The focus as the amendment bounds it: absent or empty is null (every part); otherwise a unique subset of the parts. */
export function parseRewriteFocus(value: unknown): FocusPart[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > FOCUS_PARTS.length) throw new Error("CSRM risk rewrite focus is invalid.");
  if (value.some((part) => !(FOCUS_PARTS as readonly unknown[]).includes(part)) || new Set(value).size !== value.length) throw new Error("CSRM risk rewrite focus is invalid.");
  return FOCUS_PARTS.filter((part) => value.includes(part));
}

function listedRisk(risk: RiskContextRisk, key: string): RiskListedEntry {
  return { key, riskTypeName: risk.riskTypeName, riskStatement: capped(risk.riskStatement), riskCause: capped(risk.riskCause) };
}
function listedSuggestion(suggestion: RiskContextSuggestion, key: string): RiskListedEntry {
  return { key, riskTypeName: suggestion.riskTypeName, riskStatement: capped(suggestion.riskStatement), riskCause: capped(suggestion.riskCause) };
}
function poolEntry(source: { riskTypeName: string | null; riskStatement: string | null; riskCause: string | null }, key: string): DuplicateEntry {
  return { ref: key, riskType: source.riskTypeName, riskStatement: source.riskStatement, riskCause: source.riskCause };
}
const value = (label: string, content: string): PromptValue[] => content ? [{ label, value: content }] : [];

/* The target in the wire's form: the model returns it whole, changed where the request's data supports a change. */
function targetWireView(risk: Row, keys: ReturnType<typeof contextRecordKeys>): RiskTargetWireView {
  const system = relationId(risk.informationSystemImpacted);
  const asset = relationId(risk.informationAssetImpacted);
  return {
    riskTypeName: relationName(risk.riskType),
    issueStatement: text(risk.issueStatement), riskStatement: text(risk.riskStatement), riskCategory: text(risk.riskCategory), riskSubCategory: text(risk.riskSubCategory),
    riskCause: text(risk.riskCause), potentialImpact: text(risk.potentialImpact),
    informationSystem: system ? keys.systems.get(system) ?? null : null,
    informationAsset: asset ? keys.assets.get(asset) ?? null : null,
    inherentLikelihood: nullableText(risk.inherentLikelihood), highestInherentConsequence: nullableText(risk.highestInherentConsequence), inherentRatingRationale: text(risk.inherentRatingRationale),
    residualLikelihood: nullableText(risk.residualLikelihood), highestResidualConsequence: nullableText(risk.highestResidualConsequence), residualRatingRationale: text(risk.residualRatingRationale),
    treatmentAction: nullableText(risk.treatmentAction), treatmentPlan: text(risk.treatmentPlan),
  };
}

/* The target's values in the prompt: every AI-writable value it holds, the derived ratings and classification included. */
function targetValues(risk: Row, wire: RiskTargetWireView): PromptValue[] {
  return [
    ...value("targetRisk.riskType", wire.riskTypeName ?? ""),
    ...value("targetRisk.issueStatement", wire.issueStatement),
    ...value("targetRisk.riskStatement", wire.riskStatement),
    ...value("targetRisk.riskCategory", wire.riskCategory),
    ...value("targetRisk.riskSubCategory", wire.riskSubCategory),
    ...value("targetRisk.riskCause", wire.riskCause),
    ...value("targetRisk.potentialImpact", wire.potentialImpact),
    ...value("targetRisk.informationSystem", wire.informationSystem ?? ""),
    ...value("targetRisk.informationAsset", wire.informationAsset ?? ""),
    ...value("targetRisk.dataClassification", text(risk.dataClassification)),
    ...value("targetRisk.inherentLikelihood", wire.inherentLikelihood ?? ""),
    ...value("targetRisk.highestInherentConsequence", wire.highestInherentConsequence ?? ""),
    ...value("targetRisk.inherentRating", text(risk.inherentRating)),
    ...value("targetRisk.inherentRatingRationale", wire.inherentRatingRationale),
    ...value("targetRisk.residualLikelihood", wire.residualLikelihood ?? ""),
    ...value("targetRisk.highestResidualConsequence", wire.highestResidualConsequence ?? ""),
    ...value("targetRisk.residualRating", text(risk.residualRating)),
    ...value("targetRisk.residualRatingRationale", wire.residualRatingRationale),
    ...value("targetRisk.treatmentAction", wire.treatmentAction ?? ""),
    ...value("targetRisk.treatmentPlan", wire.treatmentPlan),
  ];
}

const tooLarge = (): AssessmentContextTooLargeError => new AssessmentContextTooLargeError([], [], RISK_CONTEXT_TOO_LARGE_MESSAGE);

/**
 * The reference blocks, the summary section and the adapter's allowed sets of one risk proposal context. Throws
 * `AssessmentContextTooLargeError` (`CONTEXT_TOO_LARGE`) when more than 200 entries would be listed, and a plain error
 * for a rewrite with no target, a withdrawn target or an invalid focus (the callers refuse these first).
 */
export function buildRiskProposalContextPart(records: RiskProposalContextRecords): RiskProposalContextPart {
  const keys = contextRecordKeys(records);
  const suggestions = records.operation === "risk-suggestions";
  const reference: PromptValue[] = [];
  const refs = new Map<string, RiskListedRef>();
  const listed: RiskProposalContextAllowed["listed"] = { existing: [], withdrawn: [], rejected: [], open: [], other: [] };
  const pools: RiskProposalContextAllowed["pools"] = { active: [], withdrawn: [], rejected: [], open: [] };
  const riskLine = (prefix: string, risk: RiskContextRisk, key: string): PromptValue[] => [
    { label: `${prefix}.key`, value: key },
    ...value(`${prefix}.riskType`, risk.riskTypeName ?? ""),
    ...value(`${prefix}.statement`, capped(risk.riskStatement)),
    ...value(`${prefix}.cause`, capped(risk.riskCause)),
    ...value(`${prefix}.system`, risk.informationSystem ? keys.systems.get(risk.informationSystem) ?? "" : ""),
    ...value(`${prefix}.asset`, risk.informationAsset ? keys.assets.get(risk.informationAsset) ?? "" : ""),
  ];

  if (suggestions) {
    if (records.target) throw new Error("CSRM risk suggestions take no target.");
    const total = records.activeRisks.length + records.withdrawnRisks.length + records.rejectedSuggestions.length + records.openSuggestions.length;
    if (total > RISK_PROPOSAL_CONTEXT_BOUNDS.entries) throw tooLarge();
    if (records.activeRisks.length) reference.push({ label: "existingRisks", value: "Risks already in the assessment. Do not propose any of them again." });
    records.activeRisks.forEach((risk, index) => {
      const key = `existing-${index + 1}`;
      refs.set(key, { kind: "active", riskDocumentId: risk.documentId });
      listed.existing.push(listedRisk(risk, key));
      pools.active.push(poolEntry(risk, key));
      reference.push(...riskLine("existingRisk", risk, key));
    });
    if (records.withdrawnRisks.length) reference.push({ label: "withdrawnRisks", value: "Risks the analyst withdrew from the assessment, with the reason. Propose one again only if new information changes that reason." });
    records.withdrawnRisks.forEach((risk, index) => {
      const key = `withdrawn-${index + 1}`;
      refs.set(key, { kind: "withdrawn", riskDocumentId: risk.documentId });
      listed.withdrawn.push(listedRisk(risk, key));
      pools.withdrawn.push(poolEntry(risk, key));
      reference.push({ label: "withdrawnRisk.key", value: key }, ...value("withdrawnRisk.statement", capped(risk.riskStatement)), ...value("withdrawnRisk.reason", text(risk.withdrawalReason)));
    });
    if (records.rejectedSuggestions.length || records.openSuggestions.length) reference.push({ label: "decidedSuggestions", value: "Earlier suggestions: rejected by the analyst, with the reason, or still open. Do not repeat any of them." });
    records.rejectedSuggestions.forEach((suggestion, index) => {
      const key = `rejected-${index + 1}`;
      refs.set(key, { kind: "rejected", runId: suggestion.runId, itemKey: suggestion.itemKey });
      listed.rejected.push(listedSuggestion(suggestion, key));
      pools.rejected.push(poolEntry(suggestion, key));
      reference.push({ label: "rejectedSuggestion.key", value: key }, ...value("rejectedSuggestion.statement", capped(suggestion.riskStatement)), ...value("rejectedSuggestion.reason", text(suggestion.reason)));
    });
    records.openSuggestions.forEach((suggestion, index) => {
      const key = `open-${index + 1}`;
      refs.set(key, { kind: "open", runId: suggestion.runId, itemKey: suggestion.itemKey });
      listed.open.push(listedSuggestion(suggestion, key));
      pools.open.push(poolEntry(suggestion, key));
      reference.push({ label: "openSuggestion.key", value: key }, ...value("openSuggestion.statement", capped(suggestion.riskStatement)));
    });
    return {
      reference,
      summary: { scope: "assessment", risksListed: listed.existing.length, withdrawnListed: listed.withdrawn.length, rejectedListed: listed.rejected.length, openListed: listed.open.length, controlsListed: null, focus: null },
      allowed: { operation: records.operation, listed, pools, refs, target: null, focus: null, pinnedRiskTypeIds: [] },
    };
  }

  // A rewrite: the target (refused upstream when withdrawn) and the assessment's other active Risks.
  const target = records.target;
  const riskDocumentId = target ? relationId(target.risk) : null;
  if (!target || !riskDocumentId) throw new Error("CSRM risk rewrite target is required.");
  if (target.risk.withdrawnAt !== null && target.risk.withdrawnAt !== undefined) throw new Error("CSRM risk rewrite target is withdrawn.");
  const focus = parseRewriteFocus(records.focus);
  const others = records.activeRisks.filter((risk) => risk.documentId !== riskDocumentId);
  if (others.length > RISK_PROPOSAL_CONTEXT_BOUNDS.entries) throw tooLarge();
  const wire = targetWireView(target.risk, keys);
  reference.push({ label: "targetRisk", value: "The risk to rewrite, as it stands. Return it whole, and keep every value that should not change." }, ...targetValues(target.risk, wire));
  // A control implementation whose control is gone has no number to list; the adapter still reads its status (BE2-12).
  const listedControls = target.controls.filter((control) => control.controlNumber);
  for (const control of listedControls) {
    reference.push({ label: "targetRisk.control.number", value: control.controlNumber }, ...value("targetRisk.control.name", text(control.name)), ...value("targetRisk.control.status", text(control.status)));
  }
  if (focus) reference.push({ label: "rewriteFocus", value: `Change only these parts of the risk: ${focus.join(", ")}.` });
  if (others.length) reference.push({ label: "otherRisks", value: "The assessment's other active risks. Do not turn the target into one of them." });
  others.forEach((risk, index) => {
    const key = `other-${index + 1}`;
    refs.set(key, { kind: "active", riskDocumentId: risk.documentId });
    listed.other.push(listedRisk(risk, key));
    reference.push({ label: "otherRisk.key", value: key }, ...value("otherRisk.statement", capped(risk.riskStatement)));
  });
  const typeId = relationId(target.risk.riskType);
  const rewriteTarget: RiskRewriteTarget = {
    riskDocumentId,
    base: Object.freeze(normaliseRiskValues(target.risk, RISK_AI_FIELDS)),
    wire, controls: target.controls.map((control) => ({ ...control })),
  };
  return {
    reference,
    summary: { scope: "risk", risksListed: listed.other.length, withdrawnListed: 0, rejectedListed: 0, openListed: 0, controlsListed: listedControls.length, focus },
    allowed: { operation: records.operation, listed, pools, refs, target: rewriteTarget, focus, pinnedRiskTypeIds: typeId ? [typeId] : [] },
  };
}
