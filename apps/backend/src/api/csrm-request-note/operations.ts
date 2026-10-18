/*
 * Phase 13 (D-02, D-21, D-24, D-30): the request notes operations, held by
 * `function.risk_assessment_requests.notes_api` (the Requestor and the Security Analyst, never the Security Analyst
 * Agent). They are the only way to reach the two notes content types, which have no core router.
 *
 * The AI-input mark (D-26) is held by its own Function, `function.risk_assessment_requests.note_ai_input_api`, for the
 * human Security Analyst alone, and its operation is in HUMAN_ANALYST_ONLY_OPERATIONS as well.
 */
export const CSRM_REQUEST_NOTE_OPERATIONS = Object.freeze({
  list: "GET:/api/v1/assessment_requests/{requestId}/notes",
  create: "POST:/api/v1/assessment_requests/{requestId}/notes",
  markRead: "POST:/api/v1/assessment_requests/{requestId}/notes/read",
  setAiInput: "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input",
} as const);
