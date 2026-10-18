import { buildAssessmentContext, type AssessmentContext, type AssessmentContextRecords } from "../../src/csrm/ai/assessment-context";
import type { SlotInstruction } from "../../src/csrm/ai/analyst-instruction";
import { buildRiskProposalContextPart, type RiskContextControl, type RiskContextRisk, type RiskContextSuggestion, type RiskProposalContextRecords } from "../../src/csrm/ai/risk-proposals/risk-proposal-context";
import type { FocusPart } from "../../src/csrm/ai/risk-proposals/field-units";
import { uatALikeRecords } from "../fixtures/uat-a-like-context";

/*
 * Phase 16 (16-08): UAT-A-like records for the two risk proposal contexts. The payroll platform request's three drafted
 * risks (offshore administrator access, personal information handling and the external payroll processor, the
 * literals 16-02's duplicate fixtures use), one withdrawn risk and one rejected suggestion. Each carries facts the
 * context must never send (a risk number, an owner, a date) so a test can look for them.
 */
export const RISK_CONTEXT_SECRETS = ["RISK-SECRET-0042", "Private Risk Owner", "2026-09-12", "Withdrawing Analyst"] as const;

const secretFacts = { riskNumber: "RISK-SECRET-0042", riskOwner: { documentId: "owner-1", displayName: "Private Risk Owner" }, identifiedDate: "2026-09-12", withdrawnBy: { displayName: "Withdrawing Analyst" } };

export const OFFSHORE_ACCESS: RiskContextRisk = {
  documentId: "risk-offshore", riskTypeName: "Internet Exposure",
  riskStatement: "Offshore support administrators with standing privileged access could read or change payroll data without detection.",
  riskCause: "Shared administrator accounts are used by the offshore support team without session recording.",
  informationSystem: "system-hr", informationAsset: "asset-pay", withdrawalReason: null,
};
export const PERSONAL_INFORMATION: RiskContextRisk = {
  documentId: "risk-personal", riskTypeName: "Personal Information Handling",
  riskStatement: "Inadequate protection of employee payment details may result in unauthorised disclosure of personal information.",
  riskCause: "Personal and bank details of employees are stored and processed by the payroll platform.",
  informationSystem: "system-hr", informationAsset: "asset-pay", withdrawalReason: null,
};
export const PAYROLL_PROCESSOR: RiskContextRisk = {
  documentId: "risk-processor", riskTypeName: "Third-Party Dependency",
  riskStatement: "Reliance on the external payroll processor may reduce direct control over payroll resilience and information protection.",
  riskCause: "An external payroll processor operates and receives payroll information for the service.",
  informationSystem: null, informationAsset: null, withdrawalReason: null,
};
export const WITHDRAWN_FALLBACK: RiskContextRisk = {
  documentId: "risk-fallback", riskTypeName: null,
  riskStatement: "An untested pay-run fallback could fail when the primary payroll platform is unavailable.",
  riskCause: "The fallback procedure has never been exercised.",
  informationSystem: null, informationAsset: null, withdrawalReason: "The fallback is covered by the business continuity assessment.",
};
export const REJECTED_IDENTITY: RiskContextSuggestion = {
  runId: "run-earlier", itemKey: "s-2", riskTypeName: "Internet Exposure",
  riskStatement: "Single-factor sign-in to the identity provider could let a stolen password reach payroll administration.",
  riskCause: "The identity provider does not enforce multi-factor sign-in for payroll administrators.",
  reason: "Multi-factor sign-in is already enforced for every payroll administrator.",
};
export const PAYMENT_FILE_STATEMENT = "Unsigned payment files reconciled by hand could be altered before the pay run without detection";
export const REJECTED_PAYMENT_FILE: RiskContextSuggestion = {
  runId: "run-earlier", itemKey: "s-1", riskTypeName: null,
  riskStatement: PAYMENT_FILE_STATEMENT, riskCause: "Payment files are not signed and are reconciled by hand",
  reason: "Payment files are signed by the bank's channel since August.",
};

/** A target Risk row as the loader reads it: the twenty AI-writable values, relations as `{ documentId, name }`, and facts never sent. */
export function targetRiskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    documentId: "risk-offshore", ...secretFacts,
    riskType: { documentId: "type-1", name: "Internet Exposure" },
    issueStatement: "Offshore administrators hold standing privileged access.",
    riskStatement: OFFSHORE_ACCESS.riskStatement, riskCategory: "Access control", riskSubCategory: "Privileged access",
    riskCause: OFFSHORE_ACCESS.riskCause, potentialImpact: "Payroll data could be read or changed without detection.",
    informationSystemImpacted: { documentId: "system-hr", name: "HR and payroll platform" },
    informationAssetImpacted: { documentId: "asset-pay", name: "Employee payment details" }, dataClassification: "Restricted",
    inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High",
    inherentRatingRationale: "Standing access is broad and unmonitored.",
    residualLikelihood: "Likely", highestResidualConsequence: "Moderate", residualRating: "High",
    residualRatingRationale: "Quarterly access reviews reduce the exposure a little.",
    treatmentAction: "Treat", treatmentPlan: "Introduce session recording and just-in-time administrator access.",
    ...overrides,
  };
}

export const TARGET_CONTROLS: RiskContextControl[] = [
  { controlNumber: "CTRL-004", name: "Privileged access review", status: "Existing" },
  { controlNumber: "CTRL-007", name: "Audit logging", status: "Implemented" },
];

export function suggestionRiskRecords(overrides: Partial<RiskProposalContextRecords> = {}): RiskProposalContextRecords {
  const base = uatALikeRecords();
  return {
    operation: "risk-suggestions", systems: base.systems, assets: base.assets,
    activeRisks: [OFFSHORE_ACCESS, PERSONAL_INFORMATION, PAYROLL_PROCESSOR], withdrawnRisks: [WITHDRAWN_FALLBACK],
    rejectedSuggestions: [REJECTED_IDENTITY], openSuggestions: [], target: null, focus: null,
    ...overrides,
  };
}

export function rewriteRiskRecords(overrides: Partial<RiskProposalContextRecords> & { targetOverrides?: Record<string, unknown>; controls?: RiskContextControl[] } = {}): RiskProposalContextRecords {
  const { targetOverrides, controls, ...rest } = overrides;
  const base = uatALikeRecords();
  return {
    operation: "risk-rewrite", systems: base.systems, assets: base.assets,
    activeRisks: [OFFSHORE_ACCESS, PERSONAL_INFORMATION, PAYROLL_PROCESSOR], withdrawnRisks: [], rejectedSuggestions: [], openSuggestions: [],
    target: { risk: targetRiskRow(targetOverrides), controls: controls ?? TARGET_CONTROLS }, focus: null,
    ...rest,
  };
}

/** The built context of a risk proposal operation over UAT-A-like records, as the loader builds it. */
export function riskProposalContext(riskRecords: RiskProposalContextRecords, options: { instruction?: SlotInstruction | null; records?: AssessmentContextRecords } = {}): { context: AssessmentContext; records: AssessmentContextRecords } {
  const records = options.records ?? uatALikeRecords();
  const instruction = options.instruction ?? null;
  const context = buildAssessmentContext(records, {
    operation: riskRecords.operation, instruction, instructionSource: instruction === null ? "default-task" : "analyst",
    riskProposals: buildRiskProposalContextPart(riskRecords),
  });
  return { context, records };
}

export const focus = (...parts: FocusPart[]): FocusPart[] => parts;
