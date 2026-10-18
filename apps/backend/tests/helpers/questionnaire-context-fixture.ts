import { buildAssessmentContext, type AssessmentContextRecords } from "../../src/csrm/ai/assessment-context";

export function questionnaireContextFixture(request: Record<string, unknown> = {}) {
  const records: AssessmentContextRecords = {
    request: { documentId: "request-1", title: "Payroll replacement", description: "Replace payroll platform", assessmentType: "Project", businessPurpose: "Pay employees", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "Hosted service", regulatoryRequirements: "Privacy Act 1988", ...request },
    systems: [], assets: [{ documentId: "asset-1", name: "Payroll records", dataClassification: "Internal" }], riskTypes: [], controls: [],
  };
  return { records, context: buildAssessmentContext(records, { operation: "questionnaire-generation" }) };
}
