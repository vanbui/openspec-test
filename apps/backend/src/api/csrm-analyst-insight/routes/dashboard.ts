import type { Core } from "@strapi/strapi";

import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../operations";

/*
 * The analyst dashboard summary (D-05, D-34). It is read-only and granted to
 * the human Security Analyst only. The policy refuses any automation identity
 * and sets the analyst insight scope that the controller asserts first.
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
      path: "/v1/dashboard/summary",
      handler: "api::csrm-analyst-insight.dashboard.summary",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.dashboardSummary),
      },
    },
  ],
};

export default config;
