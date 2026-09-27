import type { Core } from "@strapi/strapi";

import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../operations";

/*
 * The analyst alert operations (D-05). Both are read-only and granted to the
 * human Security Analyst only. The policy refuses any automation identity and
 * sets the analyst insight scope that each controller asserts first.
 */
const insightPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystInsightScope: true } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
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
