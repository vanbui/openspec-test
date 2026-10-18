import type { AssessmentContextRecords } from "../../src/csrm/ai/assessment-context";

export function uatALikeRecords(): AssessmentContextRecords {
  const controls = ["File integrity verification", "Segregation of duties", "Backup recovery testing", "Privileged access review", "Payroll reconciliation", "Payment approval", "Audit logging", "Change control", "Incident response", "Supplier assurance", "Encryption at rest", "Access recertification"]
    .map((name, index) => ({ documentId: `control-${index + 1}`, controlNumber: `CTRL-${String(index + 1).padStart(3, "0")}`, name, description: name }));
  return {
    request: { documentId: "request-1", requestNumber: "SECRET-REQUEST-001", title: "Payroll platform change", description: "Unsigned payment files could be altered.", assessmentType: "Project", division: "Corporate", businessUnit: "People and Finance", businessPurpose: "Pay employees", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "External payroll processor", regulatoryRequirements: "Privacy Act 1988 and tax file number obligations", requestor: { displayName: "Private Requestor", email: "private@example.test" }, submittedDate: "2026-08-01T00:00:00.000Z" },
    systems: [
      { documentId: "system-hr", name: "HR and payroll platform", description: "Internet-facing pay processing", systemType: "Payroll", environment: "Production", deploymentModel: "SaaS", businessCriticality: "High", internetFacing: true, externalAccessRequired: true, hostingLocation: "Australia", lifecycleState: "Changed", owner: { displayName: "Private Owner" } },
      { documentId: "system-finance", name: "Finance system", description: "Payment reconciliation", environment: "Production" },
      { documentId: "system-id", name: "Identity provider", description: "Workforce access" },
    ],
    assets: [{ documentId: "asset-pay", name: "Employee payment details", description: "Personal and bank details", type: "Data", location: "Australia", dataClassification: "Restricted", confidentialityRating: "High", integrityRating: "High", availabilityRating: "Moderate", containsPersonalData: true, containsLegalData: false, containsCreditCardData: false, comments: "Private asset comment" }],
    riskTypes: ["Internet Exposure", "Personal Information Handling", "Third-Party Dependency", "Payment Integrity"].map((name, index) => ({ documentId: `type-${index + 1}`, name, description: `${name} risk`, applicableControls: controls.slice(index, index + 3) })),
    controls,
    answers: [
      { questionKey: "payment-files", sectionTitle: "Payment processing", questionText: "Are payment files signed?", helpText: "Describe the integrity control.", answerType: "Long text", value: "Unsigned payment files", answerLabel: "Unsigned payment files" },
      { questionKey: "duties", sectionTitle: "Payment processing", questionText: "Are duties segregated?", helpText: "Describe approval roles.", answerType: "Long text", value: "Partial segregation of duties", answerLabel: "Partial segregation of duties" },
      { questionKey: "fallback", sectionTitle: "Resilience", questionText: "Has the pay-run fallback been tested?", helpText: "Include test results.", answerType: "Long text", value: "Untested pay-run fallback", answerLabel: "Untested pay-run fallback" },
      { questionKey: "optional", sectionTitle: "Resilience", questionText: "Other recovery notes?", helpText: "Optional.", answerType: "Text", value: null, answerLabel: "Not answered" },
    ],
  };
}

/*
 * Phase 13 (D-27): the UAT-A-like request's notes thread. Jane's note is marked as changing the AI inputs; Bob's reply is
 * not, so it must never reach a provider. Each body carries a sentinel a test can look for in a prompt or a stored record.
 */
export type UatALikeNote = { part: "requestor" | "security-analyst"; sequence: number; postedAt: string; body: string; changesAiInputs: boolean };
export const UAT_A_LIKE_NOTE_SENTINELS = { jane: "JANE-MARKED-NOTE", bob: "BOB-UNMARKED-REPLY" } as const;
export function uatALikeNotes(): UatALikeNote[] {
  return [
    { part: "requestor", sequence: 1, postedAt: "2026-08-31T01:00:00.000Z", changesAiInputs: true, body: `${UAT_A_LIKE_NOTE_SENTINELS.jane}: payroll files now also go to a second processor in Singapore, & the old <signing> step is gone.` },
    { part: "security-analyst", sequence: 2, postedAt: "2026-08-31T02:00:00.000Z", changesAiInputs: false, body: `${UAT_A_LIKE_NOTE_SENTINELS.bob}: thanks, I will check the second processor's contract before the questionnaire.` },
  ];
}
