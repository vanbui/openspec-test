export const CSRM_ASSESSMENT_DRAFT_OPERATIONS = {
  getJob: "GET:/api/v1/assessment_draft_jobs/{jobId}",
  retryJob: "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
} as const;

export const CSRM_ASSESSMENT_OPERATIONS = {
  list: "GET:/api/v1/risk_assessments",
  statusSummary: "GET:/api/v1/risk_assessments/status_summary",
  findOne: "GET:/api/v1/risk_assessments/{assessmentId}",
  update: "PATCH:/api/v1/risk_assessments/{assessmentId}",
  decideAiProposals: "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
  /* Phase 16 (D-03 items 4 to 7, D-43): the human-analyst-only risk AI proposal operations (routes/risk-proposals.ts). */
  startRiskSuggestions: "POST:/api/v1/risk_assessments/{assessmentId}/risk_suggestions",
  startRiskRewrite: "POST:/api/v1/risks/{riskId}/rewrite",
  getRiskProposalJob: "GET:/api/v1/risk_proposal_jobs/{jobId}",
  retryRiskProposalJob: "POST:/api/v1/risk_proposal_jobs/{jobId}/retry",
  listRiskAiProposals: "GET:/api/v1/risk_assessments/{assessmentId}/ai_proposals",
  /* Phase 19 (D-03 group 2, D-14, D-21): the released risk assessment's export, for every reader of the released record. */
  exportReleased: "GET:/api/v1/risk_assessments/{assessmentId}/export",
  /* Phase 19 (D-03 group 1, D-04, D-13): the two assessment lists' exports, human-analyst-only and own-records. */
  exportList: "GET:/api/v1/risk_assessments/export",
  exportMine: "GET:/api/v1/my_risk_assessments/export",
} as const;
