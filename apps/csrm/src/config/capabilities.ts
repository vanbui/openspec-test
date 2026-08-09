/**
 * Frontend capability vocabulary mirrored from the committed CSRM Function
 * catalogue. FunctionApi URLs are operation-grant metadata, not capabilities.
 */
export const capabilityIds = [
  "function.dashboard.dashboard",
  "function.risk_assessment_requests.my_requests",
  "function.risk_assessment_requests.new_request",
  "function.risk_assessment_requests.request_details",
  "function.questionnaire.my_questionnaires",
  "function.questionnaire.questionnaire_details",
  "function.risk_assessments.my_risk_assessments",
  "function.risk_assessments.risk_assessment_details_read_only",
  "function.risk_assessment_requests.requests",
  "function.questionnaires.questionnaires",
  "function.questionnaires.questionnaire_details",
  "function.risk_assessments.risk_assessments",
  "function.risk_assessments.risk_assessment_details",
  "function.risk_register.risk_register",
  "function.risk_register.risk_details",
  "function.risk_register.mitigation_controls",
  "function.risk_register.mitigation_control_details",
  "function.administration.risk_types",
  "function.administration.risk_type_details",
  "function.administration.controls",
  "function.administration.control_details",
  "function.reports.reports",
  "function.reports.alerts",
] as const;

export type CapabilityId = (typeof capabilityIds)[number];

/** Every authenticated identity receives the Requestor Function birthright. */
export const requestorCapabilityIds = [
  "function.dashboard.dashboard",
  "function.risk_assessment_requests.my_requests",
  "function.risk_assessment_requests.new_request",
  "function.risk_assessment_requests.request_details",
  "function.questionnaire.my_questionnaires",
  "function.questionnaire.questionnaire_details",
  "function.risk_assessments.my_risk_assessments",
  "function.risk_assessments.risk_assessment_details_read_only",
] as const satisfies readonly CapabilityId[];

/** Explicit Security Analyst Functions; these are additive to the birthright. */
export const securityAnalystCapabilityIds = [
  "function.dashboard.dashboard",
  "function.risk_assessment_requests.request_details",
  "function.risk_assessment_requests.requests",
  "function.questionnaires.questionnaires",
  "function.questionnaires.questionnaire_details",
  "function.risk_assessments.risk_assessments",
  "function.risk_assessments.risk_assessment_details",
  "function.risk_register.risk_register",
  "function.risk_register.risk_details",
  "function.risk_register.mitigation_controls",
  "function.risk_register.mitigation_control_details",
  "function.administration.risk_types",
  "function.administration.risk_type_details",
  "function.administration.controls",
  "function.administration.control_details",
  "function.reports.reports",
  "function.reports.alerts",
] as const satisfies readonly CapabilityId[];

/**
 * UI preflight capabilities only. Backend FunctionApi and record-level checks
 * remain the authorization authority and are integrated in Phase 13.
 */
export function resolveEffectiveCapabilities(
  explicitCapabilities: readonly CapabilityId[] = [],
): readonly CapabilityId[] {
  return [...new Set<CapabilityId>([
    ...requestorCapabilityIds,
    ...explicitCapabilities,
  ])];
}
