export const listAnalystReviewRequests = "GET:/api/v1/assessment_requests" as const;

/** The catalogue-reserved owner-scoped request status summary (D-28), granted through My Requests. */
export const myRequestStatusSummary = "GET:/api/v1/my_requests/status_summary" as const;

export const CSRM_ASSESSMENT_REQUEST_OPERATIONS = {
  find: "GET:/api/csrm-assessment-requests",
  create: "POST:/api/csrm-assessment-requests",
  findOne: "GET:/api/csrm-assessment-requests/{id}",
  update: "PUT:/api/csrm-assessment-requests/{id}",
  delete: "DELETE:/api/csrm-assessment-requests/{id}",
  revertToDraft: "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft",
} as const;
