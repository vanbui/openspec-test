export const CSRM_RISK_OPERATIONS = {
  listRegister: "GET:/api/v1/risks",
  getDetail: "GET:/api/v1/risks/{riskId}",
  list: "GET:/api/v1/risk_assessments/{assessmentId}/risks",
  create: "POST:/api/v1/risk_assessments/{assessmentId}/risks",
  update: "PATCH:/api/v1/risks/{riskId}",
  listRiskTypes: "GET:/api/v1/risk_types?picker=assessment",
  listControls: "GET:/api/v1/controls?picker=assessment",
  searchActiveUsers: "GET:/api/v1/users?search={query}",
  /* Phase 16 (D-03 items 1 to 3, D-43): risk curation, human Security Analyst only. */
  withdrawRisks: "POST:/api/v1/risk_assessments/{assessmentId}/risk_withdrawals",
  reinstateRisks: "POST:/api/v1/risk_assessments/{assessmentId}/risk_reinstatements",
  getRiskHistory: "GET:/api/v1/risks/{riskId}/history",
  /*
   * Phase 19 (D-03 group 1, D-13): the Risk register export, at the catalogue URL verbatim (its query included), human
   * Security Analyst only, with the register read as its underlying read.
   */
  exportRegister: "GET:/api/v1/risks/export?format={format}",
} as const;
