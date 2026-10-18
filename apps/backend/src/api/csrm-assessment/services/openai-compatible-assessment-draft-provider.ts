import { CsrmAiProviderError, readCsrmAiOperationConfig, requestJsonCompletion } from "../../../csrm/openai-compatible-client";
import { UNTRUSTED_DATA_INSTRUCTION } from "../../../csrm/ai/prompt-sections";
import { acceptProposalAllowed, CONSEQUENCES, deriveRating, highestRating, isConsequence, isLikelihood, LIKELIHOODS } from "../../../csrm/risk-scale";
import type { AssessmentContext } from "../../../csrm/ai/assessment-context";
import { AssessmentDraftJobFailure } from "./assessment-draft-registry";
import { boundedString, hasExactKeys, invalid, isRecord, parseAssessmentDraftProposal, RISK_CATEGORY_FIELDS, RISK_CATEGORY_MAX_CHARACTERS, sortRiskProposals, STATEMENT_FIELDS, type AssessmentDraftProvider, type AssessmentRiskDraftProposal, type AssessmentDraftProposal } from "./assessment-draft-provider";

/* Phase 16 D-25: the risk proposal wires reuse this risk object, its schema and its per-risk adapter steps. */
export const DRAFT_WIRE_RISK_KEYS = ["riskTypeName", "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "informationSystem", "informationAsset", "inherentLikelihood", "highestInherentConsequence", "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRatingRationale", "treatmentAction", "treatmentPlan", "sources", "uncitedClaims", "suggestedControls"] as const;
const wireRiskKeys: readonly string[] = DRAFT_WIRE_RISK_KEYS;
const wireKeys = ["schemaVersion", "summary", "summarySources", "overallRiskRationale", "overallRiskRationaleSources", "recommendationsSummary", "recommendationsSummarySources", "risks"];
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const array = (items: unknown) => ({ type: "array", items });
const string = { type: "string" };
const sourceList = array(string);
/** The draft wire v2 risk object's schema, on the context's own Risk Types, systems, assets and control candidates. */
export function assessmentDraftRiskWireSchema(context: AssessmentContext): Record<string, unknown> {
  const riskProperties: Record<string, unknown> = Object.fromEntries(wireRiskKeys.map((key) => [key, string]));
  riskProperties.riskTypeName = { type: ["string", "null"], enum: [...Object.keys(context.allowed.riskTypes), null] };
  riskProperties.informationSystem = { type: ["string", "null"], enum: [...Object.keys(context.allowed.systems), null] };
  riskProperties.informationAsset = { type: ["string", "null"], enum: [...Object.keys(context.allowed.assets), null] };
  for (const key of ["inherentLikelihood", "residualLikelihood"]) riskProperties[key] = { type: "string", enum: LIKELIHOODS };
  for (const key of ["highestInherentConsequence", "highestResidualConsequence"]) riskProperties[key] = { type: "string", enum: CONSEQUENCES };
  riskProperties.treatmentAction = { type: "string", enum: ["Accept", "Treat"] };
  riskProperties.sources = object(Object.fromEntries(STATEMENT_FIELDS.map((key) => [key, sourceList])));
  riskProperties.uncitedClaims = array(string);
  // IN-106: a strict structured-output validator may reject an empty enum, so with no candidates the number is any string; the adapter drops it.
  const candidateNumbers = Object.keys(context.allowed.controlCandidates);
  riskProperties.suggestedControls = array(object({ controlNumber: candidateNumbers.length ? { type: "string", enum: candidateNumbers } : { type: "string" }, rationale: string }));
  return object(riskProperties);
}
export function assessmentDraftWireSchema(context: AssessmentContext): Record<string, unknown> {
  return object({
    schemaVersion: { type: "integer", enum: [2] }, summary: string, summarySources: sourceList,
    overallRiskRationale: string, overallRiskRationaleSources: sourceList,
    recommendationsSummary: string, recommendationsSummarySources: sourceList,
    risks: array(assessmentDraftRiskWireSchema(context)),
  });
}
/*
 * WR-107 (D-06): the portable wire schema carries no length or count bounds, so the instructions state every bound the
 * adapter enforces by failing the whole draft, and those it caps or adjusts (uncited claims, suggestions, Accept).
 * Verifier W-1 (success criterion 1, D-13): they also ask the model to link each risk to the request's own system, asset
 * or both that it concerns, which the wire schema can only allow (it accepts null for either).
 */
export const ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS = [
  "Produce one JSON object proposing concise contextual risks.",
  UNTRUSTED_DATA_INSTRUCTION,
  "Typically propose 3 to 12 risks, and at most 50 risks. A Risk Type may have several risks, and a risk may have no type.",
  "Use only the supplied likelihoods, consequences, system and asset keys, source keys and control numbers.",
  "Link each risk to the selected system, asset, or both that it concerns, using only the supplied system and asset keys, and leave informationSystem and informationAsset both null only when no selected system or asset applies to that risk.",
  "Write every statement (the summary, the overall rationale, the recommendations and each risk's text fields) in at most 2,000 characters, and a risk's category and sub-category in at most 255 characters; never leave one empty.",
  "Cite each statement separately, with at most 100 source keys per statement.",
  "List claims without a source under uncitedClaims: at most five uncited claims per risk, each at most 300 characters.",
  "Propose at most five suggested controls per risk, each with a rationale of at most 500 characters.",
  "Propose Accept only for a Low or Moderate residual rating, with its rationale in treatmentPlan and no suggested controls.",
  "Output only JSON.",
].join(" ");
/* WR-203 (D-11): the plan CSRM writes when the model proposes Accept without a rationale, for the analyst to replace. */
export const ACCEPT_WITHOUT_RATIONALE_PLAN = "The AI proposed Accept without giving a reason, so Treat is proposed instead. Replace this with the plan to treat this risk.";
const RISK_TEXT_FIELDS = ["issueStatement", "riskStatement", "riskCause", "potentialImpact", "inherentRatingRationale", "residualRatingRationale"];
const MAX_UNCITED_CLAIMS = 5;
function checkedSources(value: unknown, context: AssessmentContext, adjustments: string[]): string[] {
  if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === "string" && item.length <= 255)) invalid();
  const kept = value.filter((item: string) => context.allowed.sourceKeys.includes(item));
  if (kept.length !== value.length) adjustments.push("sources-dropped");
  return kept;
}
/**
 * Phase 12's per-risk adapter steps for one wire risk (D-10, D-11, D-13): the record keys mapped to the context's ids,
 * the ratings derived, the classification taken from the asset, sources and suggestions filtered or capped with their
 * adjustments, and the Accept rule. Its `proposalKey` is empty; the caller numbers the risks. Throws on anything the
 * draft would refuse. Phase 16's risk suggestions run each wire risk through it (D-25).
 */
export function toAssessmentDraftRisk(value: unknown, context: AssessmentContext): AssessmentRiskDraftProposal {
  if (!isRecord(value) || !hasExactKeys(value, wireRiskKeys)) invalid();
  if (value.riskTypeName !== null && (typeof value.riskTypeName !== "string" || !Object.prototype.hasOwnProperty.call(context.allowed.riskTypes, value.riskTypeName))) invalid();
  for (const key of RISK_TEXT_FIELDS) if (!boundedString(value[key])) invalid();
  for (const key of RISK_CATEGORY_FIELDS) if (!boundedString(value[key], RISK_CATEGORY_MAX_CHARACTERS)) invalid();
  // WR-203: a blank plan is an Accept without a rationale (D-11), adjusted below; a Treat must still carry its plan.
  if (typeof value.treatmentPlan !== "string" || value.treatmentPlan.length > 2_000) invalid();
  const planGiven = boundedString(value.treatmentPlan);
  if (!planGiven && value.treatmentAction !== "Accept") invalid();
  if (value.informationSystem !== null && (typeof value.informationSystem !== "string" || !Object.prototype.hasOwnProperty.call(context.allowed.systems, value.informationSystem))) invalid();
  if (value.informationAsset !== null && (typeof value.informationAsset !== "string" || !Object.prototype.hasOwnProperty.call(context.allowed.assets, value.informationAsset))) invalid();
  if (!isLikelihood(value.inherentLikelihood) || !isLikelihood(value.residualLikelihood) || !isConsequence(value.highestInherentConsequence) || !isConsequence(value.highestResidualConsequence)) invalid();
  if (value.treatmentAction !== "Accept" && value.treatmentAction !== "Treat") invalid();
  if (!isRecord(value.sources) || !hasExactKeys(value.sources, STATEMENT_FIELDS)) invalid();
  // WR-107: every claim is checked (no silent truncation, 06.7 D-10); past five they are capped, as suggestions are.
  if (!Array.isArray(value.uncitedClaims) || value.uncitedClaims.length > 100 || !value.uncitedClaims.every((claim) => boundedString(claim, 300))) invalid();
  if (!Array.isArray(value.suggestedControls) || value.suggestedControls.length > 100) invalid();
  const riskAdjustments: string[] = [];
  const uncitedClaims = (value.uncitedClaims as string[]).slice(0, MAX_UNCITED_CLAIMS);
  if (value.uncitedClaims.length > MAX_UNCITED_CLAIMS) riskAdjustments.push("uncited-claims-capped");
  const seen = new Set<string>();
  const suggestions: AssessmentRiskDraftProposal["suggestedControls"] = [];
  for (const item of value.suggestedControls) {
    if (!isRecord(item) || !hasExactKeys(item, ["controlNumber", "rationale"]) || !boundedString(item.controlNumber, 255) || !boundedString(item.rationale, 500)) invalid();
    const candidate = context.allowed.controlCandidates[item.controlNumber];
    if (!candidate || seen.has(item.controlNumber)) { riskAdjustments.push("suggestions-dropped"); continue; }
    seen.add(item.controlNumber);
    if (suggestions.length === 5) { riskAdjustments.push("suggestions-capped"); continue; }
    suggestions.push({ controlNumber: item.controlNumber, control: candidate.documentId, rationale: item.rationale });
  }
  const sources = Object.fromEntries(STATEMENT_FIELDS.map((field) => [field, checkedSources((value.sources as Record<string, unknown>)[field], context, riskAdjustments)])) as AssessmentRiskDraftProposal["sources"];
  const inherentRating = deriveRating(value.inherentLikelihood, value.highestInherentConsequence);
  const residualRating = deriveRating(value.residualLikelihood, value.highestResidualConsequence);
  // D-11: Accept only for a Low or Moderate residual rating, beside no suggested control, and with a rationale.
  const proposedAccept = value.treatmentAction === "Accept";
  let treatmentAction = value.treatmentAction as "Accept" | "Treat";
  let treatmentPlan = value.treatmentPlan as string;
  if (proposedAccept && !acceptProposalAllowed(residualRating)) { treatmentAction = "Treat"; riskAdjustments.push("accept-not-permitted"); }
  else if (proposedAccept && suggestions.length) { treatmentAction = "Treat"; riskAdjustments.push("accept-with-suggested-controls"); }
  if (proposedAccept && !planGiven) {
    treatmentAction = "Treat"; treatmentPlan = ACCEPT_WITHOUT_RATIONALE_PLAN; sources.treatmentPlan = [];
    riskAdjustments.push("accept-without-rationale");
  }
  const checked = value as unknown as AssessmentRiskDraftProposal;
  return {
    ...checked, proposalKey: "",
    informationSystem: value.informationSystem === null ? null : context.allowed.systems[value.informationSystem as string],
    informationAsset: value.informationAsset === null ? null : context.allowed.assets[value.informationAsset as string].documentId,
    dataClassification: value.informationAsset === null ? null : context.allowed.assets[value.informationAsset as string].classification,
    inherentRating, residualRating, treatmentAction, treatmentPlan, sources, uncitedClaims,
    suggestedControls: suggestions, adjustments: [...new Set(riskAdjustments)],
  };
}
export function toAssessmentDraftProposal(raw: unknown, context: AssessmentContext): AssessmentDraftProposal {
  if (!isRecord(raw) || !hasExactKeys(raw, wireKeys) || raw.schemaVersion !== 2 || !Array.isArray(raw.risks) || raw.risks.length > 50) invalid();
  for (const key of ["summary", "overallRiskRationale", "recommendationsSummary"]) if (!boundedString(raw[key])) invalid();
  const adjustments: string[] = [];
  const risks = raw.risks.map((value) => toAssessmentDraftRisk(value, context));
  const ordered = sortRiskProposals(risks).map((risk, index) => ({ ...risk, proposalKey: `risk-${index + 1}` }));
  const proposal: AssessmentDraftProposal = {
    schemaVersion: 2, summary: raw.summary as string, summarySources: checkedSources(raw.summarySources, context, adjustments),
    overallRating: highestRating(ordered.map((risk) => risk.residualRating)) ?? "Low",
    overallRiskRationale: raw.overallRiskRationale as string,
    overallRiskRationaleSources: checkedSources(raw.overallRiskRationaleSources, context, adjustments),
    recommendationsSummary: raw.recommendationsSummary as string,
    recommendationsSummarySources: checkedSources(raw.recommendationsSummarySources, context, adjustments),
    adjustments: [...new Set(adjustments)], risks: ordered,
  };
  return parseAssessmentDraftProposal(proposal, context.allowed);
}
export const openaiCompatibleAssessmentDraftProvider: AssessmentDraftProvider = {
  get name() { return readCsrmAiOperationConfig("assessmentDraft").providerLabel; },
  get version() { return readCsrmAiOperationConfig("assessmentDraft").model; },
  async generate({ context }) {
    try {
      const raw = await requestJsonCompletion({
        config: readCsrmAiOperationConfig("assessmentDraft"), systemPrompt: ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS,
        userPrompt: context.userPrompt, schemaName: "assessment_draft_proposal", jsonSchema: assessmentDraftWireSchema(context),
      });
      return toAssessmentDraftProposal(raw, context);
    } catch (error) {
      if (error instanceof AssessmentDraftJobFailure) throw error;
      if (error instanceof CsrmAiProviderError) throw new AssessmentDraftJobFailure(error.code, error.safeMessage);
      throw new AssessmentDraftJobFailure("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.");
    }
  },
};
