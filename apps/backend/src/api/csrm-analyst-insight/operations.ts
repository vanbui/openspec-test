/*
 * The five served analyst insight operations (D-05, D-07).
 *
 * Each is granted to the human Security Analyst only, through its own API-only
 * Function, and the authorization policy refuses any automation identity on
 * them even if a grant were misconfigured.
 */
export const CSRM_ANALYST_INSIGHT_OPERATIONS = Object.freeze({
  dashboardSummary: "GET:/api/v1/dashboard/summary",
  listAlerts: "GET:/api/v1/alerts",
  alertSummary: "GET:/api/v1/alerts/summary",
  listReports: "GET:/api/v1/reports",
  getReport: "GET:/api/v1/reports/{reportKey}",
} as const);
