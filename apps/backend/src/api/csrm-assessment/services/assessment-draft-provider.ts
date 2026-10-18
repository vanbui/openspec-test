import type { AssessmentContext, AssessmentContextAllowedSets, AssessmentContextRecords } from "../../../csrm/ai/assessment-context";
import { acceptProposalAllowed, deriveRating, highestRating, isConsequence, isLikelihood, isRiskRating, type RiskRating } from "../../../csrm/risk-scale";
import { DATA_CLASSIFICATIONS } from "../../../csrm/ai/data-policy";

export const STATEMENT_FIELDS = ["issueStatement", "riskStatement", "riskCause", "potentialImpact", "inherentRatingRationale", "residualRatingRationale", "treatmentPlan"] as const;
export type StatementField = typeof STATEMENT_FIELDS[number];
export type AssessmentRiskDraftProposal = {
  proposalKey: string; riskTypeName: string | null;
  issueStatement: string; riskStatement: string; riskCategory: string; riskSubCategory: string;
  riskCause: string; potentialImpact: string; informationSystem: string | null;
  informationAsset: string | null; dataClassification: string | null;
  inherentLikelihood: string; highestInherentConsequence: string; inherentRating: RiskRating; inherentRatingRationale: string;
  residualLikelihood: string; highestResidualConsequence: string; residualRating: RiskRating; residualRatingRationale: string;
  treatmentAction: "Accept" | "Treat"; treatmentPlan: string;
  sources: Record<StatementField, string[]>; uncitedClaims: string[];
  suggestedControls: { controlNumber: string; control: string; rationale: string }[]; adjustments: string[];
};
export type AssessmentDraftProposal = {
  schemaVersion: 2; summary: string; summarySources: string[]; overallRating: RiskRating;
  overallRiskRationale: string; overallRiskRationaleSources: string[];
  recommendationsSummary: string; recommendationsSummarySources: string[];
  adjustments: string[]; risks: AssessmentRiskDraftProposal[];
};
export interface AssessmentDraftProvider {
  readonly name: string; readonly version: string;
  generate(input: { context: AssessmentContext; records: AssessmentContextRecords }): Promise<AssessmentDraftProposal>;
}
export const PROPOSAL_KEYS = ["schemaVersion", "summary", "summarySources", "overallRating", "overallRiskRationale", "overallRiskRationaleSources", "recommendationsSummary", "recommendationsSummarySources", "adjustments", "risks"] as const;
export const RISK_KEYS = ["proposalKey", "riskTypeName", "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "informationSystem", "informationAsset", "dataClassification", "inherentLikelihood", "highestInherentConsequence", "inherentRating", "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRating", "residualRatingRationale", "treatmentAction", "treatmentPlan", "sources", "uncitedClaims", "suggestedControls", "adjustments"] as const;
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
export const boundedString = (value: unknown, maximum = 2_000): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
/* WR-104: a Risk's category and sub-category are stored in 255-character fields, so a longer one is invalid output, not a failed save. */
export const RISK_CATEGORY_FIELDS = ["riskCategory", "riskSubCategory"] as const;
export const RISK_CATEGORY_MAX_CHARACTERS = 255;
export function invalid(): never { throw new Error("CSRM assessment draft proposal is invalid."); }
export function compareRiskTypeNames(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left < right ? -1 : left > right ? 1 : 0;
}
export function sortRiskProposals<T extends { riskTypeName: string | null }>(risks: readonly T[]): T[] {
  return [...risks].sort((left, right) => compareRiskTypeNames(left.riskTypeName, right.riskTypeName));
}
function sourceList(value: unknown, allowed: AssessmentContextAllowedSets | null): value is string[] {
  return Array.isArray(value) && value.length <= 100 && value.every((key) => boundedString(key, 255) && (allowed === null || allowed.sourceKeys.includes(key)));
}
/*
 * Without the context's allowed sets (Phase 16: a proposed Risk read back from a stored risk proposal envelope), every
 * record a Risk names is checked for shape only; the context-aware checks ran when the proposal was written.
 */
function parseDraftRecordLinks(value: Record<string, unknown>, allowed: AssessmentContextAllowedSets | null): void {
  if (allowed === null) {
    if (value.riskTypeName !== null && !boundedString(value.riskTypeName, 255)) invalid();
    if (value.informationSystem !== null && !boundedString(value.informationSystem, 255)) invalid();
    if (value.informationAsset !== null && !boundedString(value.informationAsset, 255)) invalid();
    if (value.dataClassification !== null && (value.informationAsset === null || !(DATA_CLASSIFICATIONS as readonly unknown[]).includes(value.dataClassification))) invalid();
    return;
  }
  if (value.riskTypeName !== null && (typeof value.riskTypeName !== "string" || !Object.prototype.hasOwnProperty.call(allowed.riskTypes, value.riskTypeName))) invalid();
  if (value.informationSystem !== null && !Object.values(allowed.systems).includes(value.informationSystem as string)) invalid();
  const asset = Object.values(allowed.assets).find((item) => item.documentId === value.informationAsset);
  if (value.informationAsset !== null && !asset) invalid();
  if (value.dataClassification !== (asset?.classification ?? null)) invalid();
}
function parseRisk(value: unknown, allowed: AssessmentContextAllowedSets | null, index: number): AssessmentRiskDraftProposal {
  if (!isRecord(value) || !hasExactKeys(value, RISK_KEYS) || value.proposalKey !== `risk-${index + 1}`) invalid();
  for (const key of STATEMENT_FIELDS) if (!boundedString(value[key])) invalid();
  for (const key of RISK_CATEGORY_FIELDS) if (!boundedString(value[key], RISK_CATEGORY_MAX_CHARACTERS)) invalid();
  parseDraftRecordLinks(value, allowed);
  if (!isLikelihood(value.inherentLikelihood) || !isLikelihood(value.residualLikelihood) || !isConsequence(value.highestInherentConsequence) || !isConsequence(value.highestResidualConsequence)) invalid();
  if (!isRiskRating(value.inherentRating) || !isRiskRating(value.residualRating)
    || value.inherentRating !== deriveRating(value.inherentLikelihood, value.highestInherentConsequence)
    || value.residualRating !== deriveRating(value.residualLikelihood, value.highestResidualConsequence)) invalid();
  if (value.treatmentAction !== "Accept" && value.treatmentAction !== "Treat") invalid();
  if (!isRecord(value.sources) || !hasExactKeys(value.sources, STATEMENT_FIELDS) || STATEMENT_FIELDS.some((key) => !sourceList((value.sources as Record<string, unknown>)[key], allowed))) invalid();
  if (!Array.isArray(value.uncitedClaims) || value.uncitedClaims.length > 5 || !value.uncitedClaims.every((claim) => boundedString(claim, 300))) invalid();
  if (!Array.isArray(value.suggestedControls) || value.suggestedControls.length > 5) invalid();
  const seen = new Set<string>();
  for (const suggestion of value.suggestedControls) {
    if (!isRecord(suggestion) || !hasExactKeys(suggestion, ["controlNumber", "control", "rationale"])
      || !boundedString(suggestion.controlNumber, 255) || !boundedString(suggestion.rationale, 500)
      || (allowed === null ? !boundedString(suggestion.control, 255) : suggestion.control !== allowed.controlCandidates[suggestion.controlNumber]?.documentId)
      || seen.has(suggestion.controlNumber)) invalid();
    seen.add(suggestion.controlNumber);
  }
  if (value.treatmentAction === "Accept" && (!acceptProposalAllowed(value.residualRating) || value.suggestedControls.length > 0)) invalid();
  if (!Array.isArray(value.adjustments) || value.adjustments.length > 100 || !value.adjustments.every((item) => boundedString(item, 255))) invalid();
  return value as AssessmentRiskDraftProposal;
}
/**
 * One proposed Risk in the internal draft risk v2 shape, keyed `risk-{index + 1}` (Phase 16: a `risk-suggestions`
 * item holds one). With `allowed`, every record it names must be one the context offered, as in a draft; with null,
 * the shape, the derived ratings and the Accept rule are checked. Throws on anything malformed.
 */
export function parseAssessmentRiskDraft(value: unknown, allowed: AssessmentContextAllowedSets | null, index: number): AssessmentRiskDraftProposal {
  return parseRisk(value, allowed, index);
}
export function parseAssessmentDraftProposal(value: unknown, allowed: AssessmentContextAllowedSets): AssessmentDraftProposal {
  if (!isRecord(value) || !hasExactKeys(value, PROPOSAL_KEYS) || value.schemaVersion !== 2) invalid();
  if (!boundedString(value.summary) || !boundedString(value.overallRiskRationale) || !boundedString(value.recommendationsSummary)) invalid();
  for (const key of ["summarySources", "overallRiskRationaleSources", "recommendationsSummarySources"]) if (!sourceList(value[key], allowed)) invalid();
  if (!Array.isArray(value.adjustments) || value.adjustments.length > 100 || !value.adjustments.every((item) => boundedString(item, 255))) invalid();
  if (!Array.isArray(value.risks) || value.risks.length > 50) invalid();
  const risks = value.risks.map((risk, index) => parseRisk(risk, allowed, index));
  if (risks.some((risk, index) => index > 0 && compareRiskTypeNames(risks[index - 1].riskTypeName, risk.riskTypeName) > 0)) invalid();
  if (!isRiskRating(value.overallRating) || value.overallRating !== (highestRating(risks.map((risk) => risk.residualRating)) ?? "Low")) invalid();
  return value as AssessmentDraftProposal;
}
