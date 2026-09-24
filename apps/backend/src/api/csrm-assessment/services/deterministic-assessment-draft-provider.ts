import {
  parseAssessmentDraftProposal,
  type AssessmentDraftAnswerValue,
  type AssessmentDraftContext,
  type AssessmentDraftProposal,
  type AssessmentDraftProvider,
  type AssessmentRiskDraftProposal,
} from "./assessment-draft-provider";
import type { AssessmentRating } from "./assessment-workflow";

const RATING_ORDER: Record<AssessmentRating, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
export const DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES = [
  "Internet Exposure", "Personal Information Handling", "Third-Party Dependency",
] as const;
export type DeterministicAssessmentRiskTypeName = typeof DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES[number];

type NormalizedContext = {
  answers: ReadonlyMap<string, AssessmentDraftAnswerValue>;
  controlsByRiskType: ReadonlyMap<string, string[]>;
};

function nonBlank(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function includesValue(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.includes(expected);
}

function normalizeContext(context: AssessmentDraftContext): NormalizedContext {
  if (!context || !Array.isArray(context.answers) || !Array.isArray(context.riskTypes)
    || context.answers.length > 10_000 || context.riskTypes.length > 1_000) {
    throw new Error("CSRM assessment draft context is invalid.");
  }
  const answers = new Map<string, AssessmentDraftAnswerValue>();
  for (const entry of context.answers) {
    if (!entry || typeof entry.questionKey !== "string" || !entry.questionKey.trim() || entry.questionKey.length > 120
      || answers.has(entry.questionKey)) throw new Error("CSRM assessment draft context is invalid.");
    const value = entry.value;
    if (!(value === null || typeof value === "boolean" || typeof value === "string"
      || (Array.isArray(value) && value.length <= 1_000 && value.every((item) => typeof item === "string")))) {
      throw new Error("CSRM assessment draft context is invalid.");
    }
    answers.set(entry.questionKey, Array.isArray(value) ? [...value].sort() : value);
  }
  const controlsByRiskType = new Map<string, string[]>();
  for (const riskType of context.riskTypes) {
    if (!riskType || typeof riskType.name !== "string" || !DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES.includes(riskType.name as never)
      || controlsByRiskType.has(riskType.name) || !Array.isArray(riskType.applicableControls)
      || riskType.applicableControls.length > 100) throw new Error("CSRM assessment draft context is invalid.");
    const controls = (riskType.applicableControls as readonly { controlNumber: string }[])
      .map(({ controlNumber }) => controlNumber);
    if (controls.some((control) => typeof control !== "string" || !control.trim() || control.length > 255)
      || new Set(controls).size !== controls.length) throw new Error("CSRM assessment draft context is invalid.");
    controlsByRiskType.set(riskType.name, [...controls].sort());
  }
  return { answers, controlsByRiskType };
}

function baseRisk(
  riskTypeName: string,
  rating: AssessmentRating,
  values: Omit<AssessmentRiskDraftProposal,
    "riskTypeName" | "inherentRating" | "residualRating" | "treatmentAction" | "treatmentPlan" | "suggestedControlNumbers">,
  suggestedControlNumbers: string[],
): AssessmentRiskDraftProposal {
  const treatmentPlan = suggestedControlNumbers.length > 0
    ? `Suggested reusable controls: ${suggestedControlNumbers.join(", ")}. Review these suggestions and record the analyst-approved treatment plan.`
    : "No reusable controls were suggested. Select appropriate controls and record the analyst-approved treatment plan.";
  return {
    riskTypeName,
    ...values,
    inherentRating: rating,
    residualRating: rating,
    treatmentAction: "Treat",
    treatmentPlan,
    suggestedControlNumbers,
  };
}

function buildRisks(context: NormalizedContext): AssessmentRiskDraftProposal[] {
  const risks: AssessmentRiskDraftProposal[] = [];
  const hosting = context.answers.get("hosting-model");
  const internetFacing = context.answers.get("internet-facing") === true
    || nonBlank(context.answers.get("production-url"))
    || ["cloud", "hybrid", "third-party"].includes(String(hosting));
  if (internetFacing && context.controlsByRiskType.has("Internet Exposure")) {
    risks.push(baseRisk("Internet Exposure", "High", {
      issueStatement: "The service has an externally reachable or externally hosted access path.",
      riskStatement: "Internet exposure may increase the likelihood of unauthorised access to the service.",
      riskCategory: "Cyber security",
      riskSubCategory: "Internet exposure",
      riskCause: "The service uses an internet-reachable or externally hosted delivery model.",
      potentialImpact: "Unauthorised access may affect the confidentiality, integrity, or availability of the service.",
      inherentLikelihood: "Likely",
      highestInherentConsequence: "Major",
      inherentRatingRationale: "An externally reachable delivery path creates a material attack surface for analyst review.",
      residualLikelihood: "Possible",
      highestResidualConsequence: "Major",
      residualRatingRationale: "Residual exposure remains until the analyst confirms applicable controls and their effectiveness.",
    }, context.controlsByRiskType.get("Internet Exposure") ?? []));
  }

  const personalTypes = context.answers.get("personal-data-types");
  const handlesPersonal = context.answers.get("handles-personal-data") === true
    || (Array.isArray(personalTypes) && personalTypes.length > 0);
  if (handlesPersonal && context.controlsByRiskType.has("Personal Information Handling")) {
    const rating: AssessmentRating = includesValue(personalTypes, "sensitive") || includesValue(personalTypes, "financial") ? "Critical" : "High";
    risks.push(baseRisk("Personal Information Handling", rating, {
      issueStatement: "The service handles personal information.",
      riskStatement: "Inadequate protection of personal information may result in unauthorised disclosure or misuse.",
      riskCategory: "Privacy",
      riskSubCategory: "Personal information handling",
      riskCause: "Personal information is collected, stored, processed, or transmitted by the service.",
      potentialImpact: "A privacy incident may harm individuals and create regulatory, financial, or reputational consequences.",
      inherentLikelihood: "Possible",
      highestInherentConsequence: rating === "Critical" ? "Severe" : "Major",
      inherentRatingRationale: "The declared personal-information categories require explicit privacy and security control review.",
      residualLikelihood: "Possible",
      highestResidualConsequence: rating === "Critical" ? "Severe" : "Major",
      residualRatingRationale: "Residual privacy risk remains until the analyst validates the proposed safeguards.",
    }, context.controlsByRiskType.get("Personal Information Handling") ?? []));
  }

  const thirdParty = context.answers.get("third-party-involvement") === true
    || nonBlank(context.answers.get("third-party-providers"))
    || hosting === "third-party";
  if (thirdParty && context.controlsByRiskType.has("Third-Party Dependency")) {
    risks.push(baseRisk("Third-Party Dependency", "Moderate", {
      issueStatement: "External organisations contribute to service delivery or data handling.",
      riskStatement: "Third-party dependency may reduce direct control over service resilience and information protection.",
      riskCategory: "Third party",
      riskSubCategory: "Supplier dependency",
      riskCause: "A provider operates, supports, hosts, or receives information from the service.",
      potentialImpact: "Provider failure or control weakness may disrupt the service or expose information.",
      inherentLikelihood: "Possible",
      highestInherentConsequence: "Moderate",
      inherentRatingRationale: "The declared provider dependency requires assurance and continuity review.",
      residualLikelihood: "Possible",
      highestResidualConsequence: "Moderate",
      residualRatingRationale: "Residual dependency remains until the analyst confirms supplier controls and treatment ownership.",
    }, context.controlsByRiskType.get("Third-Party Dependency") ?? []));
  }
  return risks.sort((left, right) => left.riskTypeName.localeCompare(right.riskTypeName));
}

export const deterministicAssessmentDraftProvider: AssessmentDraftProvider = {
  name: "deterministic-assessment-draft",
  version: "1",
  async generate(context): Promise<AssessmentDraftProposal> {
    const risks = buildRisks(normalizeContext(context));
    const overallRating = risks.reduce<AssessmentRating>((highest, risk) =>
      RATING_ORDER[risk.inherentRating] > RATING_ORDER[highest] ? risk.inherentRating : highest, "Low");
    const hasRisks = risks.length > 0;
    return parseAssessmentDraftProposal({
      schemaVersion: 1,
      summary: hasRisks
        ? `Deterministic assessment assistance identified ${risks.length} reviewable risk ${risks.length === 1 ? "proposal" : "proposals"}.`
        : "Deterministic assessment assistance found no applicable risk mappings. Human risk identification is required.",
      overallRating,
      overallRiskRationale: hasRisks
        ? "The overall draft rating reflects the highest applicable deterministic risk mapping and remains subject to analyst review."
        : "No deterministic rating was inferred; the placeholder Low rating remains subject to analyst review and cannot be released without a completed Risk.",
      recommendationsSummary: "Review every proposal, select appropriate reusable controls, edit contextual details, and explicitly release only after completing human review.",
      risks,
    });
  },
};
