export const CSRM_ASSESSMENT_DRAFT_OPERATIONS = {
  getJob: "GET:/api/v1/assessment_draft_jobs/{jobId}",
  retryJob: "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
} as const;

export const CSRM_ASSESSMENT_OPERATIONS = {
  list: "GET:/api/v1/risk_assessments",
  statusSummary: "GET:/api/v1/risk_assessments/status_summary",
  findOne: "GET:/api/v1/risk_assessments/{assessmentId}",
  update: "PATCH:/api/v1/risk_assessments/{assessmentId}",
} as const;
