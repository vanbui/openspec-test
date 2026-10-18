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

/*
 * Phase 19 (D-04, D-13): the insight exports, kept apart from the five served insight reads so their set and their
 * denial wording do not change. Each is human Security Analyst only (HUMAN_ANALYST_ONLY_OPERATIONS lists its literal),
 * refused to every automation identity (SERVICE_IDENTITY_REFUSED_OPERATIONS) and needs the list read it discloses as
 * well as the insight scope's underlying reads. The report export (19-09) is the catalogue's reserved POST, with the
 * report read as its list read.
 */
export const CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS = Object.freeze({
  exportAlerts: "GET:/api/v1/alerts/export",
  exportReport: "POST:/api/v1/reports/{reportKey}/export",
} as const);
