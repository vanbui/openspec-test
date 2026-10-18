/*
 * Phase 14 (D-03, D-04, D-38): the request attachment operations, held by
 * `function.risk_assessment_requests.attachments_api` (the Requestor and the Security Analyst, never the Security
 * Analyst Agent). They are the only way to reach the attachment content type, which has no core router.
 *
 * 14-07 adds the download and 14-08 the removal and restore. 14-09 adds the AI inclusion and the text preview, held by
 * `function.risk_assessment_requests.attachment_ai_input_api` (the human Security Analyst alone) and listed among the
 * human analyst-only operations (D-30, D-31, D-38).
 */
export const CSRM_REQUEST_ATTACHMENT_OPERATIONS = Object.freeze({
  list: "GET:/api/v1/assessment_requests/{requestId}/attachments",
  upload: "POST:/api/v1/assessment_requests/{requestId}/attachments",
  download: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content",
  setRemoval: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal",
  setAiInput: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
  getAiText: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
} as const);
