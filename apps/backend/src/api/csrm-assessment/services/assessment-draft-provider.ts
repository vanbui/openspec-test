import { isAssessmentRating, type AssessmentRating } from "./assessment-workflow";

export type AssessmentDraftAnswerValue = string | boolean | readonly string[] | null;

export type AssessmentDraftContext = {
  answers: readonly { questionKey: string; value: AssessmentDraftAnswerValue }[];
  riskTypes: readonly {
    name: string;
    applicableControls: readonly { controlNumber: string }[];
  }[];
};

export type AssessmentRiskDraftProposal = {
  riskTypeName: string;
  issueStatement: string;
  riskStatement: string;
  riskCategory: string;
  riskSubCategory: string;
  riskCause: string;
  potentialImpact: string;
  inherentLikelihood: string;
  highestInherentConsequence: string;
  inherentRating: AssessmentRating;
  inherentRatingRationale: string;
  residualLikelihood: string;
  highestResidualConsequence: string;
  residualRating: AssessmentRating;
  residualRatingRationale: string;
  treatmentAction: "Treat";
  treatmentPlan: string;
  suggestedControlNumbers: string[];
};

export type AssessmentDraftProposal = {
  schemaVersion: 1;
  summary: string;
  overallRating: AssessmentRating;
  overallRiskRationale: string;
  recommendationsSummary: string;
  risks: AssessmentRiskDraftProposal[];
};

export interface AssessmentDraftProvider {
  readonly name: string;
  readonly version: string;
  generate(context: AssessmentDraftContext): Promise<AssessmentDraftProposal>;
}

const PROPOSAL_KEYS = [
  "schemaVersion", "summary", "overallRating", "overallRiskRationale", "recommendationsSummary", "risks",
] as const;
const RISK_KEYS = [
  "riskTypeName", "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact",
  "inherentLikelihood", "highestInherentConsequence", "inherentRating", "inherentRatingRationale", "residualLikelihood",
  "highestResidualConsequence", "residualRating", "residualRatingRationale", "treatmentAction", "treatmentPlan",
  "suggestedControlNumbers",
] as const;
const RISK_STRING_KEYS = RISK_KEYS.filter((key) => ![
  "inherentRating", "residualRating", "treatmentAction", "suggestedControlNumbers",
].includes(key)) as Array<Exclude<keyof AssessmentRiskDraftProposal,
  "inherentRating" | "residualRating" | "treatmentAction" | "suggestedControlNumbers">>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function boundedString(value: unknown, maximum = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function invalid(): never {
  throw new Error("CSRM assessment draft proposal is invalid.");
}

function parseRiskProposal(value: unknown): AssessmentRiskDraftProposal {
  if (!isRecord(value) || !hasExactKeys(value, RISK_KEYS)) invalid();
  for (const key of RISK_STRING_KEYS) if (!boundedString(value[key])) invalid();
  if (!isAssessmentRating(value.inherentRating) || !isAssessmentRating(value.residualRating)) invalid();
  if (value.treatmentAction !== "Treat") invalid();
  if (!Array.isArray(value.suggestedControlNumbers)
    || value.suggestedControlNumbers.length > 100
    || !value.suggestedControlNumbers.every((control) => boundedString(control, 255))) invalid();
  const controls = [...value.suggestedControlNumbers] as string[];
  if (new Set(controls).size !== controls.length || controls.some((control, index) => index > 0 && controls[index - 1] > control)) invalid();
  return { ...value, suggestedControlNumbers: controls } as AssessmentRiskDraftProposal;
}

export function parseAssessmentDraftProposal(value: unknown): AssessmentDraftProposal {
  if (!isRecord(value) || !hasExactKeys(value, PROPOSAL_KEYS) || value.schemaVersion !== 1) invalid();
  if (!boundedString(value.summary) || !boundedString(value.overallRiskRationale)
    || !boundedString(value.recommendationsSummary) || !isAssessmentRating(value.overallRating)) invalid();
  if (!Array.isArray(value.risks) || value.risks.length > 50) invalid();
  const risks = value.risks.map(parseRiskProposal);
  if (new Set(risks.map(({ riskTypeName }) => riskTypeName)).size !== risks.length
    || risks.some((risk, index) => index > 0 && risks[index - 1].riskTypeName > risk.riskTypeName)) invalid();
  return { ...value, risks } as AssessmentDraftProposal;
}
