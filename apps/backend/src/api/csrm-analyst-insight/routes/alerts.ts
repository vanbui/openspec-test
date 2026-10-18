import type { Core } from "@strapi/strapi";

import { CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS, CSRM_ANALYST_INSIGHT_OPERATIONS } from "../operations";

/*
 * The analyst alert operations (D-05). All are read-only and granted to the
 * human Security Analyst only. The policy refuses any automation identity and
 * sets the analyst insight scope that each controller asserts first. The export
 * (Phase 19 D-13) also names the alert list read it discloses (underlyingRead);
 * the key is added only when given, so the reads' configs keep exactly two keys.
 */
const insightPolicies = (operation: string, underlyingRead?: string) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: { operation, requireAnalystInsightScope: true, ...(underlyingRead === undefined ? {} : { underlyingRead }) },
  },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      // Phase 19 (D-04): the alert list exported whole, before every other /v1/alerts/ route.
      method: "GET",
      path: "/v1/alerts/export",
      handler: "api::csrm-analyst-insight.alerts.exportAlerts",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS.exportAlerts, CSRM_ANALYST_INSIGHT_OPERATIONS.listAlerts),
      },
    },
    {
      method: "GET",
      path: "/v1/alerts/summary",
      handler: "api::csrm-analyst-insight.alerts.summary",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.alertSummary),
      },
    },
    {
      method: "GET",
      path: "/v1/alerts",
      handler: "api::csrm-analyst-insight.alerts.list",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.listAlerts),
      },
    },
  ],
};

export default config;
