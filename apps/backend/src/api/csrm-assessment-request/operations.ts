export const listAnalystReviewRequests = "GET:/api/v1/assessment_requests" as const;

/** Phase 19 (D-04, D-13): the review queue's export, human Security Analyst only, needing the queue read. */
export const exportAnalystReviewRequests = "GET:/api/v1/assessment_requests/export" as const;

/** The catalogue-reserved owner-scoped request status summary (D-28), granted through My Requests. */
export const myRequestStatusSummary = "GET:/api/v1/my_requests/status_summary" as const;

/** The catalogue-reserved owner-scoped list of the caller's own requests with their holder (D-03), granted through My Requests. */
export const listMyRequests = "GET:/api/v1/my_requests" as const;

/** Phase 19 (D-04, D-13): the caller's own requests as a file, through the Requestor birthright, needing the list read. */
export const exportMyRequests = "GET:/api/v1/my_requests/export" as const;

export const CSRM_ASSESSMENT_REQUEST_OPERATIONS = {
  find: "GET:/api/csrm-assessment-requests",
  create: "POST:/api/csrm-assessment-requests",
  findOne: "GET:/api/csrm-assessment-requests/{id}",
  update: "PUT:/api/csrm-assessment-requests/{id}",
  delete: "DELETE:/api/csrm-assessment-requests/{id}",
  revertToDraft: "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft",
} as const;

/**
 * Phase 13 (D-05, D-30): the request assignment operations, held by the human Security Analyst-only
 * `function.risk_assessment_requests.assignment_api` and kept apart from CSRM_ASSESSMENT_REQUEST_OPERATIONS,
 * whose values the core, delete and revert Functions hold. `listAssignableAnalysts` is served by plan 13-04.
 */
export const CSRM_REQUEST_ASSIGNMENT_OPERATIONS = {
  changeAssignee: "PUT:/api/v1/assessment_requests/{requestId}/assignee",
  listAssignableAnalysts: "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts",
} as const;
