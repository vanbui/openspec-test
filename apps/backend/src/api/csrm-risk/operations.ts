export const CSRM_RISK_OPERATIONS = {
  listRegister: "GET:/api/v1/risks",
  getDetail: "GET:/api/v1/risks/{riskId}",
  list: "GET:/api/v1/risk_assessments/{assessmentId}/risks",
  create: "POST:/api/v1/risk_assessments/{assessmentId}/risks",
  update: "PATCH:/api/v1/risks/{riskId}",
  listRiskTypes: "GET:/api/v1/risk_types?picker=assessment",
  listControls: "GET:/api/v1/controls?picker=assessment",
  searchActiveUsers: "GET:/api/v1/users?search={query}",
} as const;
