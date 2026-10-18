import { deriveRating, highestRating, type Consequence, type Likelihood } from "../../../csrm/risk-scale";
import type { AssessmentContext, AssessmentContextRecords } from "../../../csrm/ai/assessment-context";
import { parseAssessmentDraftProposal, sortRiskProposals, STATEMENT_FIELDS, type AssessmentDraftProvider, type AssessmentRiskDraftProposal } from "./assessment-draft-provider";

export const DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES = ["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"] as const;
export type DeterministicAssessmentRiskTypeName = typeof DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES[number];
const string = (value: unknown): string => typeof value === "string" ? value : "";
const truthy = (value: unknown): boolean => value === true || value === "yes" || value === "Yes";
const answerSources = (answers: ReadonlyMap<string, unknown>, ...keys: string[]): string[] => keys.filter((key) => answers.has(key)).map((key) => `answer.${key}`);
type BuildInput = { context: AssessmentContext; records: AssessmentContextRecords };
type RiskInput = Pick<AssessmentRiskDraftProposal, "riskTypeName" | "issueStatement" | "riskStatement" | "riskCategory" | "riskSubCategory" | "riskCause" | "potentialImpact" | "inherentRatingRationale" | "residualRatingRationale"> & {
  inherentLikelihood: Likelihood; highestInherentConsequence: Consequence; residualLikelihood: Likelihood; highestResidualConsequence: Consequence;
  informationSystem?: string | null; informationAsset?: string | null; treatmentAction?: "Accept" | "Treat"; treatmentPlan?: string;
  cited?: string[]; uncitedClaims?: string[]; uncitedField?: "potentialImpact";
};
function makeRisk(input: BuildInput, values: RiskInput): AssessmentRiskDraftProposal {
  const { context, records } = input;
  const { cited, uncitedField, uncitedClaims, ...draftValues } = values;
  const asset = Object.values(context.allowed.assets).find((item) => item.documentId === values.informationAsset);
  const type = records.riskTypes.find((row) => row.name === values.riskTypeName);
  const applicable = Array.isArray(type?.applicableControls) ? type.applicableControls : [];
  const candidates = context.allowed.controlCandidates;
  const numbers = values.treatmentAction === "Accept" ? [] : values.riskTypeName === null
    ? Object.keys(candidates).slice(0, 2)
    : applicable.map((row) => string(row.controlNumber)).filter((number) => number in candidates).slice(0, 5);
  const suggestedControls = [...new Set(numbers)].map((controlNumber) => ({
    controlNumber, control: candidates[controlNumber].documentId,
    rationale: `Applicable to ${values.riskTypeName ?? "untyped"} risks: ${candidates[controlNumber].name}.`,
  }));
  const sources = Object.fromEntries(STATEMENT_FIELDS.map((field) => [field, field === uncitedField ? [] : cited ?? []])) as AssessmentRiskDraftProposal["sources"];
  return {
    proposalKey: "", ...draftValues, informationSystem: values.informationSystem ?? null, informationAsset: values.informationAsset ?? null,
    dataClassification: asset?.classification ?? null,
    inherentRating: deriveRating(values.inherentLikelihood, values.highestInherentConsequence),
    residualRating: deriveRating(values.residualLikelihood, values.highestResidualConsequence),
    treatmentAction: values.treatmentAction ?? "Treat",
    treatmentPlan: values.treatmentPlan ?? "Review the suggested controls and record the analyst-approved treatment plan.",
    sources, uncitedClaims: uncitedClaims ?? [], suggestedControls, adjustments: [],
  };
}
type SelectedRecord = Record<string, unknown>;
/* A system a provider runs for the organisation, so a third-party dependency concerns it. */
const PROVIDER_RUN_DEPLOYMENT_MODELS = ["SaaS", "Cloud"];
/*
 * Verifier W-1 (success criterion 1, D-13): every Risk links the selected system or asset it concerns, chosen only from
 * the request's own selection and in the order the context gives it (by name), never in a relation populate's order.
 * The service's system is its internet-facing system, else its first selected system: the Internet Exposure and
 * untested-recovery Risks link it. The Third-Party Dependency Risk links the first selected system a provider runs, else
 * the service's system. A personal-information Risk links the selected asset holding personal data, else the service's
 * system. A Risk links nothing only when the request selected nothing it concerns.
 */
function selectedRecords({ context, records }: BuildInput) {
  const inContextOrder = (documentIds: string[], rows: SelectedRecord[]) => documentIds.flatMap((documentId) => rows.filter((row) => row.documentId === documentId));
  const systems = inContextOrder(Object.values(context.allowed.systems), records.systems);
  const assets = inContextOrder(Object.values(context.allowed.assets).map(({ documentId }) => documentId), records.assets);
  const internetSystem = systems.find((row) => truthy(row.internetFacing));
  const serviceSystem = internetSystem ?? systems[0];
  return {
    internetSystem, serviceSystem,
    providerSystem: systems.find((row) => PROVIDER_RUN_DEPLOYMENT_MODELS.includes(string(row.deploymentModel))) ?? serviceSystem,
    personalAsset: assets.find((row) => truthy(row.containsPersonalData)),
  };
}
const linkTo = (row: SelectedRecord | undefined): string | null => string(row?.documentId) || null;
function buildRisks(input: BuildInput): AssessmentRiskDraftProposal[] {
  const { context, records } = input;
  const answers = new Map((records.answers ?? []).map((item) => [item.questionKey, item.value]));
  const risks: AssessmentRiskDraftProposal[] = [];
  const hosting = answers.get("hosting-model");
  const { internetSystem, serviceSystem, providerSystem, personalAsset } = selectedRecords(input);
  const internet = truthy(answers.get("internet-facing")) || !!string(answers.get("production-url")).trim() || ["cloud", "hybrid", "third-party"].includes(string(hosting)) || !!internetSystem;
  if (internet && "Internet Exposure" in context.allowed.riskTypes) risks.push(makeRisk(input, {
    riskTypeName: "Internet Exposure", informationSystem: linkTo(serviceSystem),
    issueStatement: "The service has an externally reachable or externally hosted access path.",
    riskStatement: "Internet exposure may increase the likelihood of unauthorised access to the service.",
    riskCategory: "Cyber security", riskSubCategory: "Internet exposure",
    riskCause: "The service uses an internet-reachable or externally hosted delivery model.",
    potentialImpact: "Unauthorised access may affect the confidentiality, integrity, or availability of the service.",
    inherentLikelihood: "Likely", highestInherentConsequence: "Major", residualLikelihood: "Possible", highestResidualConsequence: "Major",
    inherentRatingRationale: "An externally reachable delivery path creates a material attack surface for analyst review.",
    residualRatingRationale: "Residual exposure remains until the analyst confirms applicable controls and their effectiveness.",
    cited: [...answerSources(answers, "internet-facing", "production-url", "hosting-model"), ...(internetSystem ? [Object.entries(context.allowed.systems).find(([, id]) => id === internetSystem.documentId)?.[0] ?? ""] : [])].filter(Boolean),
  }));
  const personalTypes = answers.get("personal-data-types");
  const personal = truthy(answers.get("handles-personal-data")) || (Array.isArray(personalTypes) && personalTypes.length > 0) || !!personalAsset;
  const personalInformationLinks = { informationAsset: linkTo(personalAsset), informationSystem: personalAsset ? null : linkTo(serviceSystem) };
  if (personal && "Personal Information Handling" in context.allowed.riskTypes) {
    const sensitive = Array.isArray(personalTypes) && personalTypes.some((value) => value === "sensitive" || value === "financial");
    const assetKey = Object.entries(context.allowed.assets).find(([, item]) => item.documentId === personalAsset?.documentId)?.[0];
    risks.push(makeRisk(input, {
      riskTypeName: "Personal Information Handling", ...personalInformationLinks,
      issueStatement: "The service handles personal information.",
      riskStatement: "Inadequate protection of personal information may result in unauthorised disclosure or misuse.",
      riskCategory: "Privacy", riskSubCategory: "Personal information handling",
      riskCause: "Personal information is collected, stored, processed, or transmitted by the service.",
      potentialImpact: "A privacy incident may harm individuals and create regulatory, financial, or reputational consequences.",
      inherentLikelihood: sensitive ? "Likely" : "Possible", highestInherentConsequence: sensitive ? "Severe" : "Major",
      residualLikelihood: "Possible", highestResidualConsequence: "Major",
      inherentRatingRationale: "The declared personal-information categories require explicit privacy and security control review.",
      residualRatingRationale: "Residual privacy risk remains until the analyst validates the proposed safeguards.",
      cited: [...answerSources(answers, "handles-personal-data", "personal-data-types"), ...(assetKey ? [assetKey] : [])],
    }));
  }
  if (/privacy|personal/i.test(string(records.request.regulatoryRequirements)) && "Personal Information Handling" in context.allowed.riskTypes) risks.push(makeRisk(input, {
    riskTypeName: "Personal Information Handling", ...personalInformationLinks,
    issueStatement: "The service is subject to personal information obligations.",
    riskStatement: "Failure to meet privacy obligations may result in regulatory action.",
    riskCategory: "Privacy", riskSubCategory: "Regulatory compliance", riskCause: "Regulatory requirements apply to the service.",
    potentialImpact: "Non-compliance may create financial and reputational consequences.",
    inherentLikelihood: "Possible", highestInherentConsequence: "Major", residualLikelihood: "Possible", highestResidualConsequence: "Major",
    inherentRatingRationale: "The declared obligations require compliance review.",
    residualRatingRationale: "Residual regulatory exposure remains until safeguards are confirmed.",
    cited: ["request.regulatoryRequirements"],
  }));
  const thirdParty = truthy(answers.get("third-party-involvement")) || !!string(answers.get("third-party-providers")).trim() || hosting === "third-party" || truthy(records.request.thirdPartyInvolvement);
  if (thirdParty && "Third-Party Dependency" in context.allowed.riskTypes) risks.push(makeRisk(input, {
    riskTypeName: "Third-Party Dependency", informationSystem: linkTo(providerSystem),
    issueStatement: "External organisations contribute to service delivery or data handling.",
    riskStatement: "Third-party dependency may reduce direct control over service resilience and information protection.",
    riskCategory: "Third party", riskSubCategory: "Supplier dependency",
    riskCause: "A provider operates, supports, hosts, or receives information from the service.",
    potentialImpact: "Provider failure or control weakness may disrupt the service or expose information.",
    inherentLikelihood: "Possible", highestInherentConsequence: "Moderate", residualLikelihood: "Possible", highestResidualConsequence: "Moderate",
    inherentRatingRationale: "The declared provider dependency requires assurance and continuity review.",
    residualRatingRationale: "Residual dependency remains until the analyst confirms supplier controls and treatment ownership.",
    treatmentAction: "Accept", treatmentPlan: "Review supplier assurance and document why this moderate residual risk is accepted.",
    cited: [...answerSources(answers, "third-party-involvement", "third-party-providers"), ...(["request.thirdPartyDetails", "request.thirdPartyInvolvement"].filter((key) => context.allowed.sourceKeys.includes(key)))],
  }));
  if (["no", "not-sure"].includes(string(answers.get("recovery-tested")))) risks.push(makeRisk(input, {
    riskTypeName: null, informationSystem: linkTo(serviceSystem), issueStatement: "Recovery has not been tested.",
    riskStatement: "Untested recovery may delay restoration of the service.", riskCategory: "Resilience", riskSubCategory: "Recovery",
    riskCause: "Recovery arrangements have not been validated.", potentialImpact: "An outage may last longer than expected.",
    inherentLikelihood: "Possible", highestInherentConsequence: "Major", residualLikelihood: "Possible", highestResidualConsequence: "Major",
    inherentRatingRationale: "The answer indicates uncertainty in recovery readiness.",
    residualRatingRationale: "Risk remains until the recovery process is tested.",
    cited: ["answer.recovery-tested"], uncitedField: "potentialImpact",
    uncitedClaims: ["Recovery time objectives for the service are not documented."],
  }));
  return sortRiskProposals(risks).map((risk, index) => ({ ...risk, proposalKey: `risk-${index + 1}` }));
}
/*
 * Walk D12: a Requestor reads these statements once the assessment is released (in development and in demos), so they
 * read as an assessment's own, with no back-end or review-process term.
 */
function draftSummary(count: number): string {
  return count === 0
    ? "This assessment identifies no risks from the request, its questionnaire answers or its selected systems and information assets."
    : `This assessment identifies ${count} ${count === 1 ? "risk" : "risks"} from the request, its questionnaire answers and its selected systems and information assets.`;
}
export const deterministicAssessmentDraftProvider: AssessmentDraftProvider = {
  name: "deterministic-assessment-draft", version: "2",
  async generate(input) {
    const risks = buildRisks(input);
    const proposal = {
      schemaVersion: 2 as const,
      summary: draftSummary(risks.length),
      summarySources: [], overallRating: highestRating(risks.map((risk) => risk.residualRating)) ?? "Low" as const,
      overallRiskRationale: "The overall rating is the highest residual rating among the risks identified, or Low when there are none.",
      overallRiskRationaleSources: [], recommendationsSummary: "Carry out each risk's treatment plan, and confirm that the controls each risk relies on are in place.",
      recommendationsSummarySources: [], adjustments: [], risks,
    };
    return parseAssessmentDraftProposal(proposal, input.context.allowed);
  },
};
